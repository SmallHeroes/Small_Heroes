/**
 * (Track-4 Unit 1a, item 4) Audit — enumerate child SOURCE photos still reachable in the PUBLIC book-images bucket,
 * classify each against the DB, and REPORT THE COUNT. Read-only by default. Core + tests: lib/child-photo-audit.ts.
 *
 * Real child photos are matched BROADLY at `%/references/main-child-%` (+ stage0-child-photo, + wizard/char-photos) —
 * they sit at paths like orders/OLD/draft-<id>/references/main-child-<id>.jpg. Character-anchors (%/character-anchors/%)
 * are AI ILLUSTRATIONS, counted separately and NEVER touched. Rendered pages/covers are excluded.
 *
 *   # report (read-only): real-photo count + sample keys, anchor count, residue-vs-in-flight
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/audit-child-photos.ts
 *   # remediate residue (delivered/orphan real photos; NEVER an in-flight order's photo):
 *   npx tsx … scripts/audit-child-photos.ts --delete-residue  --i-understand-this-deletes-production-objects
 *   npx tsx … scripts/audit-child-photos.ts --migrate-residue --i-understand-this-deletes-production-objects   # copy→private, then delete
 *
 * Run against staging AND production (child photos are public in both). NEVER touches character-anchors.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { prisma } from '../lib/prisma';
import {
  classifyExposedChildPhotos, summarizeExposure, residueKeys, orderReferencedChildPhotoKeys,
  isExposedChildSourcePhotoKey, isCharacterAnchorKey,
} from '../lib/child-photo-audit';
import { downloadStorageObjectBytes, storeChildPhotoToPrivateBucket } from '../lib/image-storage';

const argv = process.argv.slice(2);
const ACK = argv.includes('--i-understand-this-deletes-production-objects');
const DELETE = argv.includes('--delete-residue') && ACK;
const MIGRATE = argv.includes('--migrate-residue') && ACK;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'book-images';

function client(): SupabaseClient {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) { console.error('[audit] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required'); process.exit(2); }
  return createClient(url, key);
}
function mask(): string { try { return new URL(process.env.SUPABASE_URL ?? '').host; } catch { return '(no SUPABASE_URL)'; } }

/** List a single prefix (paginated). Supabase list is non-recursive → returns files + sub-folder placeholders. */
async function listPrefix(sb: SupabaseClient, prefix: string): Promise<{ files: string[]; folders: string[] }> {
  const files: string[] = [];
  const folders: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb.storage.from(BUCKET).list(prefix, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error || !data || data.length === 0) break;
    for (const o of data) {
      const full = `${prefix}/${o.name}`.replace(/^\/+/, '');
      if (o.id === null || (o as { metadata?: unknown }).metadata == null) folders.push(full);
      else files.push(full);
    }
    if (data.length < 1000) break;
  }
  return { files, folders };
}

/** Recursively enumerate every object key under a prefix (walks sub-folders). */
async function walk(sb: SupabaseClient, prefix: string, acc: string[]): Promise<void> {
  const { files, folders } = await listPrefix(sb, prefix);
  acc.push(...files);
  for (const f of folders) await walk(sb, f, acc);
}

/** Every child-photo storage key referenced by an order that is NOT yet delivered (its render still needs the photo). */
async function loadInflightReferencedKeys(): Promise<Set<string>> {
  const orders = await prisma.order.findMany({
    where: { NOT: { AND: [{ status: { in: ['ready', 'partial'] } }, { packageStatus: 'done' }] } },
    select: { childImageUrl: true, characterAnchors: true },
  });
  const set = new Set<string>();
  for (const o of orders) for (const k of orderReferencedChildPhotoKeys(o, BUCKET)) set.add(k);
  return set;
}

async function main(): Promise<void> {
  const mode = MIGRATE ? 'MIGRATE→private' : DELETE ? 'DELETE residue' : 'REPORT (read-only)';
  console.log(`[audit] host=${mask()} bucket=${BUCKET} mode=${mode}`);
  const sb = client();

  const allKeys: string[] = [];
  await walk(sb, 'wizard/char-photos', allKeys);
  const { folders: orderFolders } = await listPrefix(sb, 'orders');
  for (const f of orderFolders) await walk(sb, f, allKeys);

  const realPhotoKeys = allKeys.filter(isExposedChildSourcePhotoKey);
  const inflight = await loadInflightReferencedKeys();
  const classified = classifyExposedChildPhotos(realPhotoKeys, inflight);
  const summary = summarizeExposure(classified, allKeys);

  console.log(`\n[audit] REAL child SOURCE photos still PUBLIC: ${summary.realPhotos}`);
  console.log(`  in-flight (KEEP — render still needs it): ${summary.in_flight_keep}`);
  console.log(`  residue (delivered/orphan — remediate):   ${summary.residue}`);
  console.log(`[audit] character-anchors (AI illustrations — NOT touched): ${summary.characterAnchors}`);
  console.log(`\n[audit] sample real-photo keys:`);
  for (const k of realPhotoKeys.slice(0, 20)) console.log(`   ${k}${inflight.has(k) ? '   [KEEP]' : ''}`);
  // sanity: the walk must never mis-file an anchor as a photo
  const misfiled = realPhotoKeys.filter(isCharacterAnchorKey);
  if (misfiled.length) console.error(`[audit] WARNING: ${misfiled.length} keys matched BOTH photo + anchor — investigate: ${misfiled.slice(0, 5).join(', ')}`);

  if (!DELETE && !MIGRATE) {
    console.log('\n[audit] REPORT complete — nothing changed.');
    return;
  }
  const toRemediate = residueKeys(classified);
  if (toRemediate.length === 0) { console.log('\n[audit] no residue to remediate.'); return; }

  let done = 0;
  for (const key of toRemediate) {
    if (MIGRATE) {
      const bytes = await downloadStorageObjectBytes(key);
      if (!bytes) { console.error(`[audit] migrate skip (unreadable): ${key}`); continue; }
      const ext = key.split('.').pop()?.toLowerCase();
      const ct = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      await storeChildPhotoToPrivateBucket({ buffer: bytes, contentType: ct, key });
    }
    const { error } = await sb.storage.from(BUCKET).remove([key]);
    if (error) { console.error(`[audit] remove failed ${key}: ${error.message}`); continue; }
    done += 1;
  }
  console.log(`\n[audit] ${MIGRATE ? 'MIGRATE+DELETE' : 'DELETE'} complete — ${done}/${toRemediate.length} residue objects handled (in-flight + character-anchors untouched).`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
