import { describe, it, expect } from 'vitest';
import { canAccessStagingQa } from '@/lib/runtime-env';
import { assertEnvSeparation } from '@/lib/generation-chunked/env-separation-guard';
import { enqueueDelivery } from '@/lib/generation-chunked/delivery-outbox';
import type { DeliveryOutbox, PrismaClient } from '@prisma/client';

/**
 * REAL-DB proof (B6) that the Outbox claim is atomic under Supavisor TRANSACTION pooling (pgbouncer=true):
 * two concurrent claimers never claim the same row (FOR UPDATE SKIP LOCKED). Hardened over the first cut:
 *   - assertEnvSeparation() FIRST, so the test physically cannot run against the prod DB;
 *   - the claim is SCOPED to this run's seed rows (a unique marker), never touching other staging rows — it
 *     mirrors claimDueDeliveries' exact predicate (scheduled + due, ORDER BY createdAt, FOR UPDATE SKIP LOCKED)
 *     with an added `orderId LIKE marker` so the blast radius is exactly the 4 rows we created;
 *   - it asserts the SEED rows specifically: the union of the two claimers' seed-claims is EXACTLY 4 (all seeds
 *     were claimed) AND their intersection is empty (no seed row claimed twice) — so a no-op (0 seeds claimed)
 *     can no longer pass.
 * Runs ONLY on isolated staging behind the env-separation guard AND an explicit opt-in; cleans up its own rows.
 * Skipped by default (and always in production) so `npm run check` stays green without a database.
 *
 *   VERCEL_ENV=preview ALLOW_STAGING_QA=true RUN_OUTBOX_DB_TEST=true \
 *     DATABASE_URL='postgresql://...pooler...:6543/postgres?pgbouncer=true' npx vitest run <thisfile>
 */
const RUN = process.env.RUN_OUTBOX_DB_TEST === 'true' && canAccessStagingQa();
const payload = { to: 'x', customerName: 'x', childName: 'x', readUrl: 'x' };

/** Marker-scoped equivalent of claimDueDeliveries — identical SKIP-LOCKED predicate, bounded to seed rows. */
async function claimSeedRows(prisma: PrismaClient, marker: string, limit: number): Promise<DeliveryOutbox[]> {
  const lease = new Date(Date.now() + 60_000);
  const now = new Date();
  return prisma.$queryRaw<DeliveryOutbox[]>`
    UPDATE "DeliveryOutbox" SET "status" = 'processing', "leaseExpiresAt" = ${lease}, "attempts" = "attempts" + 1
    WHERE "id" IN (
      SELECT "id" FROM "DeliveryOutbox"
      WHERE "orderId" LIKE ${marker + '%'}
        AND "status" = 'scheduled'
        AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= ${now})
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *`;
}

describe.skipIf(!RUN)('delivery-outbox SKIP LOCKED — staging real DB (Supavisor txn pooling)', () => {
  it('two concurrent claimers split the seed rows exactly: union == 4, intersection == ∅', async () => {
    assertEnvSeparation(); // refuses to proceed if any prod resource is configured
    const { prisma } = await import('@/lib/prisma'); // import lazily so normal (skipped) runs never connect
    const marker = `skiplocked-test-${process.env.RUN_OUTBOX_DB_TEST_NONCE ?? 'a'}-${Date.now()}`;
    try {
      const now = new Date();
      for (let i = 0; i < 4; i++) {
        await enqueueDelivery(prisma, { orderId: `${marker}-${i}`, scope: 'base_book', fulfillmentVersion: 1, payload, now });
      }
      const seeded = await prisma.deliveryOutbox.findMany({ where: { orderId: { startsWith: marker } }, select: { id: true } });
      const seededIds = new Set(seeded.map((r) => r.id));
      expect(seededIds.size).toBe(4);

      const [a, b] = await Promise.all([
        claimSeedRows(prisma, marker, 4),
        claimSeedRows(prisma, marker, 4),
      ]);
      const aSeed = a.map((r) => r.id).filter((id) => seededIds.has(id));
      const bSeed = b.map((r) => r.id).filter((id) => seededIds.has(id));

      // No seed row claimed by BOTH workers (SKIP LOCKED prevented the double-claim).
      const intersection = aSeed.filter((id) => bSeed.includes(id));
      expect(intersection).toEqual([]);
      // Every seed row was claimed by EXACTLY one worker (no row silently skipped → a no-op can't pass).
      const union = new Set([...aSeed, ...bSeed]);
      expect(union.size).toBe(4);
      expect([...union].every((id) => seededIds.has(id))).toBe(true);
    } finally {
      await prisma.deliveryOutbox.deleteMany({ where: { orderId: { startsWith: marker } } });
    }
  }, 30_000);
});
