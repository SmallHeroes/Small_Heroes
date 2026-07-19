import 'server-only';
import { parseSupabasePublicObjectKey } from '@/lib/child-photo-deletion-policy';

/**
 * (Track-4 Unit 1a, item 4) Audit + remediation of already-exposed child SOURCE photos in the PUBLIC bucket.
 * "Assume prior deletion failures left residue; prove otherwise rather than hoping." PURE classification (testable
 * without Supabase); scripts/audit-child-photos.ts wires the real storage list + DB read + optional cleanup.
 *
 * IMPORTANT (verified against prod/staging 2026-07-19): real child photos sit at paths like
 * `orders/OLD/draft-<id>/references/main-child-<id>.jpg` — an EXTRA path segment that the shared
 * `isOriginalChildPhotoStorageKey` regex (^orders/[^/]+/references/) never matched, which is why the per-order
 * deletion left them as residue. The audit therefore uses a BROAD, LIKE-style matcher on `%/references/main-child-%`
 * (+ stage0-child-photo, + wizard/char-photos), independent of the (unchanged) deletion regex.
 *
 * SEPARATE HANDLING: `%/character-anchors/%` objects are AI-GENERATED ILLUSTRATIONS, not photographs — the system
 * uses them for consistency. They are counted + reported but NEVER remediated by this tool.
 */

/** Broad match for a child SOURCE photograph object, wherever it sits in the tree. */
export function isExposedChildSourcePhotoKey(key: string): boolean {
  const k = key.replace(/\\/g, '/').replace(/^\/+/, '');
  return /(?:^|\/)references\/(?:main-child|stage0-child-photo)-/i.test(k) || /^wizard\/char-photos\//i.test(k);
}

/** An AI-generated character anchor (illustration) — reported separately, NEVER remediated here. */
export function isCharacterAnchorKey(key: string): boolean {
  return /(?:^|\/)character-anchors\//i.test(key.replace(/\\/g, '/'));
}

export type ExposedDisposition = 'in_flight_keep' | 'delivered_or_orphan_residue';

export interface ExposedObject {
  key: string;
  disposition: ExposedDisposition;
}

/**
 * Classify each exposed child-photo object as KEEP (an in-flight order still references it) or RESIDUE (safe to remove
 * — a delivered order's leftover, or an orphan with no owning order). Conservative + safe: an object is only ever
 * remediated when it is NOT in the in-flight-referenced set, so an active render's photo is never deleted.
 * PURE — `inflightReferencedKeys` is the set of keys referenced by orders that are NOT yet delivered.
 */
export function classifyExposedChildPhotos(objectKeys: string[], inflightReferencedKeys: Set<string>): ExposedObject[] {
  return objectKeys
    .filter(isExposedChildSourcePhotoKey)
    .map((key) => ({ key, disposition: (inflightReferencedKeys.has(key) ? 'in_flight_keep' : 'delivered_or_orphan_residue') as ExposedDisposition }));
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
    residue: objects.filter((o) => o.disposition === 'delivered_or_orphan_residue').length,
  };
}

/** Keys the cleanup may safely remove — residue only, never an in-flight order's photo. */
export function residueKeys(objects: ExposedObject[]): string[] {
  return objects.filter((o) => o.disposition === 'delivered_or_orphan_residue').map((o) => o.key);
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
