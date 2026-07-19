import 'server-only';
import { isOriginalChildPhotoStorageKey } from '@/lib/child-photo-deletion-policy';

/**
 * (Track-4 Unit 1, item 4) Audit of already-exposed child SOURCE photos in the PUBLIC bucket. "Assume prior deletion
 * failures left residue; prove otherwise rather than hoping." This module holds the PURE classification (testable
 * without Supabase); scripts/audit-child-photos.ts wires the real storage list + DB read + optional cleanup.
 *
 * Child source photos live under two key shapes (recognised by isOriginalChildPhotoStorageKey): `wizard/char-photos/*`
 * and `orders/{id}/references/(main-child|stage0-child-photo)-*`. Rendered pages/covers are DIFFERENT prefixes and are
 * correctly out of scope.
 */

export type ExposedDisposition = 'in_flight_keep' | 'completed_residue' | 'orphan_residue';

export interface ExposedObject {
  key: string;
  disposition: ExposedDisposition;
  orderId?: string;
  orderStatus?: string;
}

/** An order and the child-photo storage keys it currently references (via childImageUrl + characterAnchors). */
export interface OrderRef {
  id: string;
  status: string;
  packageStatus: string;
  keys: string[];
}

const DELIVERED_STATUSES = new Set(['ready', 'partial']);

/**
 * Classify every exposed child-photo object against the orders that reference it:
 *   - in_flight_keep    — an order that is still generating/pre-delivery references it → the render still needs it, DO NOT delete.
 *   - completed_residue — a delivered order (ready/partial + packageStatus done) references it → it SHOULD already be gone.
 *   - orphan_residue    — no order references it → deletion residue from a past failure (the exact case to prove/clean).
 * PURE — no I/O; the caller supplies the enumerated keys and the orders.
 */
export function classifyExposedChildPhotos(objectKeys: string[], orders: OrderRef[]): ExposedObject[] {
  const keyToOrder = new Map<string, OrderRef>();
  for (const o of orders) for (const k of o.keys) if (!keyToOrder.has(k)) keyToOrder.set(k, o);

  return objectKeys
    .filter(isOriginalChildPhotoStorageKey)
    .map((key) => {
      const o = keyToOrder.get(key);
      if (!o) return { key, disposition: 'orphan_residue' as const };
      const delivered = DELIVERED_STATUSES.has(o.status) && o.packageStatus === 'done';
      return { key, disposition: (delivered ? 'completed_residue' : 'in_flight_keep') as ExposedDisposition, orderId: o.id, orderStatus: o.status };
    });
}

export interface ExposureSummary {
  total: number;
  in_flight_keep: number;
  completed_residue: number;
  orphan_residue: number;
  /** Objects safe to remove now (residue of delivered/orphan) — NEVER includes in-flight orders' photos. */
  deletable: number;
}

export function summarizeExposure(objects: ExposedObject[]): ExposureSummary {
  const by = (d: ExposedDisposition): number => objects.filter((o) => o.disposition === d).length;
  const completed = by('completed_residue');
  const orphan = by('orphan_residue');
  return { total: objects.length, in_flight_keep: by('in_flight_keep'), completed_residue: completed, orphan_residue: orphan, deletable: completed + orphan };
}

/** The keys that a cleanup pass may safely remove: residue only (delivered-order + orphan), never an in-flight order's photo. */
export function deletableResidueKeys(objects: ExposedObject[]): string[] {
  return objects.filter((o) => o.disposition !== 'in_flight_keep').map((o) => o.key);
}
