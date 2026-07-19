/**
 * (Track-4 Unit 1, item 4) Audit — enumerate child SOURCE photos still reachable in the PUBLIC book-images bucket,
 * classify each against the DB, and REPORT THE COUNT. Read-only by default. Core + tests: lib/child-photo-audit.ts.
 *
 *   # report (default — read-only): counts + disposition (in-flight / delivered-residue / orphan-residue)
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/audit-child-photos.ts
 *   # clean up ONLY residue (delivered-order + orphan objects; NEVER an in-flight order's photo):
 *   npx tsx … scripts/audit-child-photos.ts --delete-residue --i-understand-this-deletes-production-objects
 *
 * Identifies child photos by key path (wizard/char-photos/* and orders/{id}/references/(main-child|stage0-child-photo)-*);
 * rendered pages/covers are excluded. Run against staging AND production (child photos are public in both).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { isOriginalChildPhotoStorageKey, resolveDeletableStorageKeysFromOrder } from '../lib/child-photo-deletion-policy';
import { classifyExposedChildPhotos, summarizeExposure, deletableResidueKeys, type OrderRef } from '../lib/child-photo-audit';

const argv = process.argv.slice(2);
const DELETE = argv.includes('--delete-residue') && argv.includes('--i-understand-this-deletes-production-objects');
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'book-images';

function client(): SupabaseClient {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) { console.error('[audit] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required'); process.exit(2); }
  return createClient(url, key);
}
function mask(): string { try { return new URL(process.env.SUPABASE_URL ?? '').host; } catch { return '(no SUPABASE_URL)'; } }

/** List a single prefix (paginated). Returns { files, folders } — Supabase list is non-recursive. */
async function listPrefix(sb: SupabaseClient, prefix: string): Promise<{ files: string[]; folders: string[] }> {
  const files: string[] = [];
  const folders: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb.storage.from(BUCKET).list(prefix, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error || !data || data.length === 0) break;
    for (const o of data) {
      const full = `${prefix}/${o.name}`.replace(/^\/+/, '');
      if (o.id === null || (o as { metadata?: unknown }).metadata == null) folders.push(full); // folder placeholder
      else files.push(full);
    }
    if (data.length < 1000) break;
  }
  return { files, folders };
}

/** Enumerate every exposed child-photo object: the flat wizard prefix + each order's references sub-folder. */
async function enumerateExposedKeys(sb: SupabaseClient): Promise<string[]> {
  const keys: string[] = [];
  keys.push(...(await listPrefix(sb, 'wizard/char-photos')).files);
  const { folders: orderFolders } = await listPrefix(sb, 'orders');
  for (const orderFolder of orderFolders) {
    keys.push(...(await listPrefix(sb, `${orderFolder}/references`)).files);
  }
  return keys.filter(isOriginalChildPhotoStorageKey);
}

/** Every order that references a child photo, with its resolved storage keys (for classification). */
async function loadOrderRefs(): Promise<OrderRef[]> {
  const orders = await prisma.order.findMany({
    where: { OR: [{ childImageUrl: { not: null } }, { characterAnchors: { not: Prisma.JsonNull } }] },
    select: { id: true, status: true, packageStatus: true, childImageUrl: true, characterAnchors: true },
  });
  return orders.map((o) => ({ id: o.id, status: o.status, packageStatus: o.packageStatus, keys: resolveDeletableStorageKeysFromOrder(o, BUCKET) }))
    .filter((o) => o.keys.length > 0);
}

async function main(): Promise<void> {
  console.log(`[audit] host=${mask()} bucket=${BUCKET} mode=${DELETE ? 'DELETE residue' : 'REPORT (read-only)'}`);
  const sb = client();
  const [exposedKeys, orderRefs] = await Promise.all([enumerateExposedKeys(sb), loadOrderRefs()]);
  const classified = classifyExposedChildPhotos(exposedKeys, orderRefs);
  const summary = summarizeExposure(classified);

  console.log(`\n[audit] EXPOSED child-photo objects in the PUBLIC bucket: ${summary.total}`);
  console.log(`  in-flight (KEEP — order still generating): ${summary.in_flight_keep}`);
  console.log(`  delivered-order residue (should be gone):  ${summary.completed_residue}`);
  console.log(`  orphan residue (no owning order):          ${summary.orphan_residue}`);
  console.log(`  → deletable now (residue only):            ${summary.deletable}`);

  if (!DELETE) {
    console.log('\n[audit] REPORT complete — nothing deleted. Re-run with --delete-residue --i-understand-this-deletes-production-objects to clean the residue.');
    return;
  }
  const toDelete = deletableResidueKeys(classified);
  if (toDelete.length === 0) { console.log('\n[audit] no residue to delete.'); return; }
  let removed = 0;
  for (let i = 0; i < toDelete.length; i += 100) {
    const batch = toDelete.slice(i, i + 100);
    const { error } = await sb.storage.from(BUCKET).remove(batch);
    if (error) { console.error(`[audit] remove batch failed: ${error.message}`); continue; }
    removed += batch.length;
  }
  console.log(`\n[audit] DELETE complete — removed ${removed}/${toDelete.length} residue objects (in-flight photos untouched).`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
