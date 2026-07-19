import 'server-only';
import { parseSupabasePublicObjectKey } from '@/lib/child-photo-deletion-policy';

/**
 * (Track-4 Unit 1a, item 4) Audit + remediation of already-exposed child SOURCE photos in the PUBLIC bucket.
 * PURE classification (testable without Supabase); scripts/audit-child-photos.ts wires the real storage list + DB read
 * + optional cleanup.
 *
 * CLASSIFY BY ORDER STATUS, never by "a record still references it" — 118 prod orders hold a dangling child-photo URL
 * while only ~14 objects exist, so reference-existence marks almost everything KEEP and remediates nothing. An object
 * is *needed* only if its owning order can STILL RENDER (draft / pending_payment / paid / generating / needs_human_qa).
 * ready / partial / failed orders, and any object with no resolvable owning order (orphan), are RESIDUE.
 *
 * Real child photos match BROADLY at `%/references/main-child-%` (+ stage0-child-photo, + wizard/char-photos) — they
 * sit at deep paths like orders/OLD/draft-<id>/references/main-child-<id>.jpg. Character-anchors (%/character-anchors/%)
 * are AI ILLUSTRATIONS — counted separately and NEVER remediated.
 */

/** An order in one of these statuses can still render, so its source photo must be KEPT. */
export const RENDERABLE_STATUSES = new Set(['draft', 'pending_payment', 'paid', 'generating', 'needs_human_qa']);

/**
 * `Order.status='failed'` is NOT terminal: chain-worker.ts:failGenerationChain sets the order `failed` while marking
 * the job `retryable:true` in the SAME write (the sweeper/recovery may still redrive it). Only `retryable=false`
 * (the sweeper's exhausted hard-fail) is terminal. So classification MUST consult GenerationJob.retryable.
 */
export interface ClassifyOptions {
  /** If set, a `failed`+retryable=true owner whose order.updatedAt is BEFORE this cutoff is treated as residue — an
   *  EXPLICIT, age-gated escape hatch for long-abandoned ambivalent failures. Default undefined → keep the ambivalent. */
  staleRetryableFailedCutoff?: Date;
}

/** True when the owning order still needs its source photo (KEEP). Orphan / ready / partial / terminal-failed → residue. */
export function isKeepOwner(owner: KeyOwner | undefined, opts: ClassifyOptions = {}): boolean {
  if (!owner) return false; // orphan (no resolvable owner) → residue
  if (RENDERABLE_STATUSES.has(owner.status)) return true;
  if (owner.status === 'failed' && owner.retryable === true) {
    // AMBIVALENT — a retryable failure may still recover. Keep by default; a long-abandoned one is residue only
    // under an EXPLICIT stale cutoff.
    if (opts.staleRetryableFailedCutoff && owner.updatedAt && owner.updatedAt < opts.staleRetryableFailedCutoff) return false;
    return true;
  }
  return false; // ready / partial / failed(retryable=false, terminal) → residue
}

/** Broad match for a child SOURCE photograph object, wherever it sits in the tree. */
export function isExposedChildSourcePhotoKey(key: string): boolean {
  const k = key.replace(/\\/g, '/').replace(/^\/+/, '');
  return /(?:^|\/)references\/(?:main-child|stage0-child-photo)-/i.test(k) || /^wizard\/char-photos\//i.test(k);
}

/** An AI-generated character anchor (illustration) — reported separately, NEVER remediated here. */
export function isCharacterAnchorKey(key: string): boolean {
  return /(?:^|\/)character-anchors\//i.test(key.replace(/\\/g, '/'));
}

export type ExposedDisposition = 'in_flight_keep' | 'residue';

export interface ExposedObject {
  key: string;
  disposition: ExposedDisposition;
  orderId?: string;
  orderStatus?: string;
  /** The owning order's GenerationJob.retryable — surfaced so the report can show the failed/retryable split. */
  retryable?: boolean;
}

/** The owning order of a storage key: id (to clear the reference), status + job.retryable + updatedAt (to classify). */
export interface KeyOwner {
  orderId: string;
  status: string;
  retryable?: boolean;
  updatedAt?: Date;
}

/** Deep-collect every Supabase public-object URL embedded anywhere in a JSON blob (characterAnchors). */
export function collectPublicUrlsDeep(json: unknown, out: string[] = []): string[] {
  if (typeof json === 'string') { if (json.includes('/storage/v1/object/public/')) out.push(json); return out; }
  if (Array.isArray(json)) { for (const v of json) collectPublicUrlsDeep(v, out); return out; }
  if (json && typeof json === 'object') { for (const v of Object.values(json)) collectPublicUrlsDeep(v, out); return out; }
  return out;
}

/** Every child-photo storage key an order references today (childImageUrl + any URL nested in characterAnchors). */
export function orderReferencedChildPhotoKeys(
  order: { childImageUrl?: string | null; characterAnchors?: unknown },
  bucket: string,
): string[] {
  const urls = new Set<string>();
  if (order.childImageUrl) urls.add(order.childImageUrl);
  for (const u of collectPublicUrlsDeep(order.characterAnchors)) urls.add(u);
  const keys = new Set<string>();
  for (const u of urls) {
    const k = parseSupabasePublicObjectKey(u, bucket);
    if (k && isExposedChildSourcePhotoKey(k)) keys.add(k);
  }
  return [...keys];
}

/**
 * Map every referenced child-photo key → its owning order (id + status). On a conflict (two orders reference the same
 * key) a RENDERABLE owner wins, so a photo a renderable order still needs is never mistaken for residue.
 */
export function buildKeyOwnerMap(
  orders: Array<{ id: string; status: string; retryable?: boolean; updatedAt?: Date; childImageUrl?: string | null; characterAnchors?: unknown }>,
  bucket: string,
): Map<string, KeyOwner> {
  const map = new Map<string, KeyOwner>();
  for (const o of orders) {
    const owner: KeyOwner = { orderId: o.id, status: o.status, retryable: o.retryable, updatedAt: o.updatedAt };
    for (const key of orderReferencedChildPhotoKeys(o, bucket)) {
      const existing = map.get(key);
      // On a shared key the most-protective owner wins — a KEEP owner beats a residue owner, so a still-needed photo
      // is never mistaken for residue (default keep-rules; no stale cutoff applied to the tie-break).
      if (!existing || (isKeepOwner(owner) && !isKeepOwner(existing))) map.set(key, owner);
    }
  }
  return map;
}

/**
 * Classify each exposed child-photo object by its OWNING ORDER'S STATUS: KEEP iff the owner can still render; RESIDUE
 * for ready/partial/failed owners AND for orphans (no resolvable owner). PURE.
 */
export function classifyExposedChildPhotos(objectKeys: string[], ownerMap: Map<string, KeyOwner>, opts: ClassifyOptions = {}): ExposedObject[] {
  return objectKeys
    .filter(isExposedChildSourcePhotoKey)
    .map((key) => {
      const owner = ownerMap.get(key);
      const keep = isKeepOwner(owner, opts);
      return { key, disposition: (keep ? 'in_flight_keep' : 'residue') as ExposedDisposition, orderId: owner?.orderId, orderStatus: owner?.status ?? '(orphan)', retryable: owner?.retryable };
    });
}

export interface ExposureSummary {
  realPhotos: number;
  characterAnchors: number;
  in_flight_keep: number;
  residue: number;
}

export function summarizeExposure(objects: ExposedObject[], allKeys: string[]): ExposureSummary {
  return {
    realPhotos: objects.length,
    characterAnchors: allKeys.filter(isCharacterAnchorKey).length,
    in_flight_keep: objects.filter((o) => o.disposition === 'in_flight_keep').length,
    residue: objects.filter((o) => o.disposition === 'residue').length,
  };
}

/** Residue objects — safe to remediate (delete/migrate + clear the owner's reference). Never a renderable order's photo. */
export function residueObjects(objects: ExposedObject[]): ExposedObject[] {
  return objects.filter((o) => o.disposition === 'residue');
}
