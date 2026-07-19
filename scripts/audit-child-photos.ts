/**
 * (Track-4 Unit 1a, item 4) Audit — enumerate child SOURCE photos still reachable in the PUBLIC book-images bucket,
 * classify each BY OWNING-ORDER STATUS, and REPORT THE COUNT. Read-only by default. Core + tests: lib/child-photo-audit.ts.
 *
 * KEEP iff the owning order can still render (draft/pending_payment/paid/generating/needs_human_qa). ready/partial/
 * failed owners and orphans (no resolvable owner) are RESIDUE. Character-anchors (%/character-anchors/%) are AI
 * illustrations — counted separately and NEVER touched.
 *
 *   # report (read-only): keep-vs-residue by status + anchor count
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/audit-child-photos.ts
 *   # remediate residue (two passes): object-driven (delete object, then clear owner ref) + order-driven (clear a
 *   # residue order's reference WHETHER OR NOT its object still exists — the dangling refs, incl. the 118 on prod):
 *   npx tsx … scripts/audit-child-photos.ts --delete-residue  --i-understand-this-deletes-objects
 *   npx tsx … scripts/audit-child-photos.ts --migrate-residue --i-understand-this-deletes-objects   # copy→private, then delete+clear
 * A destructive flag WITHOUT --i-understand-this-deletes-objects EXITS NON-ZERO (never a silent report fallback).
 *
 * Run against staging AND production. NEVER touches character-anchors or a renderable order's photo.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { buildCharacterAnchorsAfterPhotoDeletion } from '../lib/child-photo-deletion-policy';
import {
  buildKeyOwnerMap, classifyExposedChildPhotos, summarizeExposure, residueObjects,
  isExposedChildSourcePhotoKey, isCharacterAnchorKey, remediateResidueReferences, resolveRemediationMode,
} from '../lib/child-photo-audit';
import { downloadStorageObjectBytes, storeChildPhotoToPrivateBucket } from '../lib/image-storage';

const argv = process.argv.slice(2);
// A destructive flag WITHOUT the acknowledgement is a HARD error, never a silent fallback to report (it trains the
// wrong habit). The ack flag is env-agnostic ('objects', not 'production-objects') — the target host is printed below.
const MODE_RESULT = resolveRemediationMode({
  deleteResidue: argv.includes('--delete-residue'),
  migrateResidue: argv.includes('--migrate-residue'),
  ack: argv.includes('--i-understand-this-deletes-objects'),
});
if (!MODE_RESULT.ok) { console.error(`[audit] REFUSED: ${MODE_RESULT.error}`); process.exit(2); }
const MODE = MODE_RESULT.mode;
const DELETE = MODE !== 'report';
const MIGRATE = MODE === 'migrate';
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'book-images';
// (age-gated escape hatch) EXPLICITLY reclassify long-abandoned failed+retryable=true orders as residue.
const INCLUDE_STALE = argv.includes('--include-stale-retryable-failed');
const MIN_AGE_DAYS = Number((argv.find((x) => x.startsWith('--min-age-days=')) ?? '').split('=')[1] || '30');
const STALE_CUTOFF = INCLUDE_STALE ? new Date(Date.now() - MIN_AGE_DAYS * 86_400_000) : undefined;

function client(): SupabaseClient {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) { console.error('[audit] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required'); process.exit(2); }
  return createClient(url, key);
}
function mask(): string { try { return new URL(process.env.SUPABASE_URL ?? '').host; } catch { return '(no SUPABASE_URL)'; } }

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
async function walk(sb: SupabaseClient, prefix: string, acc: string[]): Promise<void> {
  const { files, folders } = await listPrefix(sb, prefix);
  acc.push(...files);
  for (const f of folders) await walk(sb, f, acc);
}

type OrderRow = { id: string; status: string; retryable?: boolean; updatedAt: Date; childImageUrl: string | null; characterAnchors: Prisma.JsonValue };
async function loadOrdersWithPhotoRefs(): Promise<OrderRow[]> {
  // Catch a reference held in childImageUrl OR nested only in characterAnchors — the order-driven pass needs both.
  const rows = await prisma.order.findMany({
    where: { OR: [{ childImageUrl: { not: null } }, { characterAnchors: { not: Prisma.JsonNull } }] },
    select: { id: true, status: true, updatedAt: true, childImageUrl: true, characterAnchors: true, generationJob: { select: { retryable: true } } },
  });
  return rows.map((o) => ({ id: o.id, status: o.status, retryable: o.generationJob?.retryable ?? undefined, updatedAt: o.updatedAt, childImageUrl: o.childImageUrl, characterAnchors: o.characterAnchors as Prisma.JsonValue }));
}

/** Clear a residue order's persisted child-photo reference — childImageUrl + the nested characterAnchors URL fields. */
async function clearOrderReference(orderId: string): Promise<void> {
  const o = await prisma.order.findUnique({ where: { id: orderId }, select: { characterAnchors: true } });
  await prisma.order.update({
    where: { id: orderId },
    data: { childImageUrl: null, characterAnchors: buildCharacterAnchorsAfterPhotoDeletion(o?.characterAnchors ?? null, 'completed') as Prisma.InputJsonValue },
  });
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
  const orders = await loadOrdersWithPhotoRefs();
  const ownerMap = buildKeyOwnerMap(orders, BUCKET);
  const classified = classifyExposedChildPhotos(realPhotoKeys, ownerMap, { staleRetryableFailedCutoff: STALE_CUTOFF });
  const summary = summarizeExposure(classified, allKeys);

  // status breakdown of the exposed objects (failed split by retryable — the decisive terminal signal)
  const byStatus = new Map<string, number>();
  for (const o of classified) {
    const label = o.orderStatus === 'failed' ? `failed(retryable=${o.retryable === true ? 'true' : o.retryable === false ? 'false' : '?'})` : (o.orderStatus ?? '(orphan)');
    byStatus.set(label, (byStatus.get(label) ?? 0) + 1);
  }

  console.log(`\n[audit] REAL child SOURCE photos still PUBLIC: ${summary.realPhotos}`);
  console.log(`  KEEP (renderable, or failed+retryable=true ambivalent): ${summary.in_flight_keep}`);
  console.log(`  RESIDUE (ready/partial/failed-terminal/orphan): ${summary.residue}`);
  console.log(`  by owning-order status: ${[...byStatus.entries()].map(([s, n]) => `${s}=${n}`).join('  ')}`);
  if (STALE_CUTOFF) console.log(`  (--include-stale-retryable-failed: failed+retryable=true older than ${MIN_AGE_DAYS}d reclassified as residue)`);
  console.log(`[audit] character-anchors (AI illustrations — NOT touched): ${summary.characterAnchors}`);
  const misfiled = realPhotoKeys.filter(isCharacterAnchorKey);
  if (misfiled.length) console.error(`[audit] WARNING: ${misfiled.length} keys matched BOTH photo + anchor — investigate`);

  if (!DELETE && !MIGRATE) {
    console.log('\n[audit] REPORT complete — nothing changed.');
    return;
  }

  const migrateObject = MIGRATE
    ? async (key: string): Promise<void> => {
        const bytes = await downloadStorageObjectBytes(key);
        if (!bytes) { console.error(`[audit] migrate skip (unreadable): ${key}`); return; }
        const ext = key.split('.').pop()?.toLowerCase();
        await storeChildPhotoToPrivateBucket({ buffer: bytes, contentType: ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg', key });
      }
    : undefined;
  const deleteObject = async (key: string): Promise<{ ok: boolean; error?: string }> => {
    const { error } = await sb.storage.from(BUCKET).remove([key]);
    return { ok: !error, error: error?.message };
  };

  // ── Pass 1 (OBJECT-DRIVEN, verified correct) — delete residue OBJECTS first, then clear each owner's reference ─────
  const residue = residueObjects(classified);
  const clearedOrders = new Set<string>();
  let p1Objects = 0;
  for (const obj of residue) {
    if (migrateObject) await migrateObject(obj.key);
    const del = await deleteObject(obj.key);
    if (!del.ok) { console.error(`[audit] remove failed ${obj.key}: ${del.error} — NOT clearing its field`); continue; }
    p1Objects += 1;
    if (obj.orderId && !clearedOrders.has(obj.orderId)) { await clearOrderReference(obj.orderId); clearedOrders.add(obj.orderId); }
  }
  const p1Refs = clearedOrders.size;

  // ── Pass 2 (ORDER-DRIVEN, Finding 2) — clear residue orders' references whether or not the object still exists ─────
  const existing = new Set(realPhotoKeys);
  const p2 = await remediateResidueReferences(orders, existing, BUCKET, { deleteObject, clearReference: clearOrderReference, migrateObject }, { staleRetryableFailedCutoff: STALE_CUTOFF, alreadyCleared: clearedOrders });

  console.log(`\n[audit] Pass 1 (object-driven): ${p1Objects}/${residue.length} residue objects ${MIGRATE ? 'migrated+' : ''}deleted; ${p1Refs} references cleared.`);
  console.log(`[audit] Pass 2 (order-driven):  ${p2.referencesCleared} references cleared (of which ${p2.danglingCleared} DANGLING — object already gone); ${p2.objectsDeleted} objects deleted here; ${p2.aborted.length} aborted on delete-failure${p2.aborted.length ? ` (${p2.aborted.join(', ')})` : ''}.`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
