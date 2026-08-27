import type { Prisma, PrismaClient } from '@prisma/client';

import type { PipelineCache } from './types';

/**
 * Producing-provenance keys of `GenerationJob.pipelineCache`. They are the
 * durable record of WHAT production ran under — written exactly once, by the
 * freeze's delivery-input barrier mutation (single-key `jsonb_set`, atomic
 * with the `Order.visualContractHash` stamp) — and the delivery gates bind
 * every ship/enqueue/reissue/repair/release to them
 * (`requireProducingSnapshotBinding`). Ordinary cache persistence must
 * therefore be STRUCTURALLY unable to create, replace, or delete them: the
 * writer below overlays whatever the DATABASE row already holds for these
 * keys on top of the caller's snapshot, so an in-memory value for them never
 * reaches disk through this path. Combined with the barrier (whose writes
 * bump `Order.inputVersion`, which every ship/send CAS binds), the producing
 * keys are version-fenced across the whole eval→commit→send window.
 */
export const PRODUCING_PIPELINE_CACHE_KEYS = [
  'visualContract',
  'visualPackageAuthority',
] as const;

type Db = Pick<PrismaClient, '$executeRaw'>;

/**
 * Persist an ordinary (non-barrier) pipeline-cache snapshot. Replacement
 * semantics for every ordinary key — keys the caller removed stay removed —
 * while the two producing keys are copied from the EXISTING row (old-row
 * values are visible inside SET), never from the caller. UPDATE-only: this
 * can never create a job row.
 */
export async function persistOrdinaryPipelineCache(
  db: Db,
  orderId: string,
  cache: PipelineCache,
): Promise<number> {
  const snapshot: Record<string, unknown> = {
    ...(cache as unknown as Record<string, unknown>),
  };
  for (const key of PRODUCING_PIPELINE_CACHE_KEYS) {
    delete snapshot[key];
  }
  const payload = JSON.stringify(snapshot);
  return db.$executeRaw`
    UPDATE "GenerationJob"
    SET "pipelineCache" =
      ${payload}::jsonb ||
      COALESCE(
        jsonb_strip_nulls(
          jsonb_build_object(
            'visualContract', "pipelineCache" -> 'visualContract',
            'visualPackageAuthority', "pipelineCache" -> 'visualPackageAuthority'
          )
        ),
        '{}'::jsonb
      )
    WHERE "orderId" = ${orderId}`;
}

/**
 * Strip the producing keys from a caller-supplied cache snapshot (creation
 * seeding: a job that does not exist yet has no producing provenance, and a
 * seed must not be able to smuggle any in).
 */
export function withoutProducingPipelineCacheKeys(
  cache: PipelineCache,
): Prisma.InputJsonValue {
  const snapshot: Record<string, unknown> = {
    ...(cache as unknown as Record<string, unknown>),
  };
  for (const key of PRODUCING_PIPELINE_CACHE_KEYS) {
    delete snapshot[key];
  }
  return snapshot as Prisma.InputJsonValue;
}
