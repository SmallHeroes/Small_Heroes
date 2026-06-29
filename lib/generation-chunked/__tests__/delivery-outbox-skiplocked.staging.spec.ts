import { describe, it, expect } from 'vitest';
import { canAccessStagingQa } from '@/lib/runtime-env';
import { claimDueDeliveries, enqueueDelivery } from '@/lib/generation-chunked/delivery-outbox';

/**
 * REAL-DB proof that the Outbox claim is atomic under Supavisor transaction pooling (pgbouncer=true): two
 * concurrent claimers never claim the same row (FOR UPDATE SKIP LOCKED). Runs ONLY on isolated staging behind
 * the env-separation guard AND an explicit opt-in, and it CLEANS UP its own rows. Skipped by default (and
 * always in production), so `npm run check` stays green without a database.
 *
 *   RUN_OUTBOX_DB_TEST=true ALLOW_STAGING_QA=true DATABASE_URL=<staging-pooled> npx vitest run <thisfile>
 */
const RUN = process.env.RUN_OUTBOX_DB_TEST === 'true' && canAccessStagingQa();
const payload = { to: 'x', customerName: 'x', childName: 'x', readUrl: 'x' };

describe.skipIf(!RUN)('delivery-outbox SKIP LOCKED — staging real DB', () => {
  it('two concurrent claimers never claim the same row', async () => {
    const { prisma } = await import('@/lib/prisma'); // import lazily so normal (skipped) runs never connect
    const tag = `skiplocked-test-${process.env.RUN_OUTBOX_DB_TEST_NONCE ?? 'a'}-${Date.now()}`;
    try {
      const now = new Date();
      for (let i = 0; i < 4; i++) {
        await enqueueDelivery(prisma, { orderId: `${tag}-${i}`, scope: 'base_book', fulfillmentVersion: 1, payload, now });
      }
      const seeded = await prisma.deliveryOutbox.findMany({ where: { orderId: { startsWith: tag } }, select: { id: true } });
      const seededIds = new Set(seeded.map((r) => r.id));
      expect(seededIds.size).toBe(4);

      const [a, b] = await Promise.all([
        claimDueDeliveries(prisma, new Date(), 4),
        claimDueDeliveries(prisma, new Date(), 4),
      ]);
      const claimedOurs = [...a, ...b].map((r) => r.id).filter((id) => seededIds.has(id));
      // each of our seeded rows is claimed by AT MOST one of the two concurrent workers
      expect(new Set(claimedOurs).size).toBe(claimedOurs.length);
    } finally {
      await prisma.deliveryOutbox.deleteMany({ where: { orderId: { startsWith: tag } } });
    }
  }, 30_000);
});
