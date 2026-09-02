import type { Prisma, PrismaClient } from '@prisma/client';

import type { PipelineCache } from './types';

/**
 * Barrier-owned keys of `GenerationJob.pipelineCache`. Each is written ONLY by
 * a `withDeliveryInputMutation` barrier mutation (single-key `jsonb_set`,
 * atomic with its receipt + `Order.inputVersion` bump):
 *   - `visualContract` + `visualPackageAuthority` — the freeze
 *     (ensure-frozen-visual-contract.ts): the durable producing-provenance
 *     record the delivery gates bind every ship/enqueue/reissue/repair/release
 *     to (`requireProducingSnapshotBinding`);
 *   - `setIdentityBoards` — the Board lifecycle (set-identity-board-stage.ts):
 *     the bound Board context the pre-render assert and prompt transport read.
 * The writer census (delivery-input-writer-coverage.spec.ts) derives this same
 * inventory from the barrier `jsonb_set` call sites and pins set-equality, so
 * a new barrier-owned key cannot appear without joining this list.
 *
 * Ordinary cache persistence must be STRUCTURALLY unable to create, replace,
 * delete, or NORMALIZE these keys: the writer below overlays whatever the
 * DATABASE row already holds for them on top of the caller's snapshot —
 * key-existence-gated, value-verbatim (nested nulls, null array entries and an
 * explicit top-level JSON `null` all survive byte-for-byte; `jsonb_strip_nulls`
 * is deliberately NOT used because PostgreSQL applies it recursively and it
 * would rewrite frozen contract bytes). Combined with the barrier (whose
 * writes bump `Order.inputVersion`, which every ship/send CAS binds), the
 * barrier-owned keys are fenced across the whole eval→commit→send window.
 */
export const BARRIER_OWNED_PIPELINE_CACHE_KEYS = [
  'visualContract',
  'visualPackageAuthority',
  'setIdentityBoards',
] as const;

/**
 * The producing-provenance subset — the two keys the delivery binding
 * evaluator (`requireProducingSnapshotBinding`) reads. Kept distinct from the
 * full barrier-owned set: Boards are barrier-owned state but not provenance.
 */
export const PRODUCING_PIPELINE_CACHE_KEYS = [
  'visualContract',
  'visualPackageAuthority',
] as const;

/**
 * Ordinary cache state that becomes delivery-frozen once an Order is ready. The canonical child anchor is evidence
 * authority for per-page resemblance; a late stale cache save must never replace it after readiness/outbox commit.
 */
export const READY_FROZEN_PIPELINE_CACHE_KEYS = [
  'characterAnchorStore',
] as const;

type Db = Pick<PrismaClient, '$executeRaw'>;

/**
 * Persist an ordinary (non-barrier) pipeline-cache snapshot. Replacement
 * semantics for every ordinary key — keys the caller removed stay removed —
 * while every barrier-owned key is copied from the EXISTING row (old-row
 * values are visible inside SET), never from the caller: a key present on the
 * row survives with its exact stored value (even an explicit JSON `null`),
 * and a key absent from the row cannot be introduced. UPDATE-only: this can
 * never create a job row.
 *
 * The overlay arms are written literally (one `CASE`/`jsonb_build_object` pair
 * per key) so the statement stays a plain tagged template; the store spec pins
 * that every BARRIER_OWNED_PIPELINE_CACHE_KEYS entry has its arm, and the
 * real-Postgres spec (pipeline-cache-store.pg.spec.ts) executes this exact
 * statement to prove value-verbatim preservation.
 */
export async function persistOrdinaryPipelineCache(
  db: Db,
  orderId: string,
  cache: PipelineCache,
): Promise<number> {
  const payload = JSON.stringify(
    withoutBarrierOwnedPipelineCacheKeys(cache),
  );
  return db.$executeRaw`
    WITH incoming AS MATERIALIZED (
      SELECT ${payload}::jsonb AS value
    ), locked_order AS MATERIALIZED (
      SELECT "id", "status"::text AS status
        FROM "Order"
       WHERE "id" = ${orderId}
       FOR UPDATE
    )
    UPDATE "GenerationJob"
    SET "pipelineCache" =
      (CASE WHEN locked_order.status = 'ready'
        THEN (incoming.value - 'characterAnchorStore') ||
          (CASE WHEN "pipelineCache" ? 'characterAnchorStore'
            THEN jsonb_build_object('characterAnchorStore', "pipelineCache" -> 'characterAnchorStore')
            ELSE '{}'::jsonb END)
        ELSE incoming.value
      END) ||
      (CASE WHEN "pipelineCache" ? 'visualContract'
        THEN jsonb_build_object('visualContract', "pipelineCache" -> 'visualContract')
        ELSE '{}'::jsonb END) ||
      (CASE WHEN "pipelineCache" ? 'visualPackageAuthority'
        THEN jsonb_build_object('visualPackageAuthority', "pipelineCache" -> 'visualPackageAuthority')
        ELSE '{}'::jsonb END) ||
      (CASE WHEN "pipelineCache" ? 'setIdentityBoards'
        THEN jsonb_build_object('setIdentityBoards', "pipelineCache" -> 'setIdentityBoards')
        ELSE '{}'::jsonb END)
    FROM incoming, locked_order
    WHERE "orderId" = locked_order."id"`;
}

/**
 * Strip the barrier-owned keys from a caller-supplied cache snapshot (creation
 * seeding: a job that does not exist yet has no barrier-written state, and a
 * seed must not be able to smuggle any in — neither producing provenance nor a
 * Board binding).
 */
export function withoutBarrierOwnedPipelineCacheKeys(
  cache: PipelineCache,
): Prisma.InputJsonValue {
  const snapshot: Record<string, unknown> = {
    ...(cache as unknown as Record<string, unknown>),
  };
  for (const key of BARRIER_OWNED_PIPELINE_CACHE_KEYS) {
    delete snapshot[key];
  }
  return snapshot as Prisma.InputJsonValue;
}
