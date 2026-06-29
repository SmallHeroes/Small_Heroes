import { describe, it, expect } from 'vitest';
import { canAccessStagingQa } from '@/lib/runtime-env';
import { assertEnvSeparation } from '@/lib/generation-chunked/env-separation-guard';

/**
 * REAL-DB, TWO-CONNECTION proof (B4/B6) of the inputVersion optimistic-concurrency guard under Supavisor
 * transaction pooling (pgbouncer=true) — NOT a mock. It reproduces the exact race runReadinessTxn defends
 * against: a writer bumps Order.inputVersion BETWEEN the evaluation read and the conditional commit, and the
 * commit must abort (0 rows). Two genuinely separate connections are used (two PrismaClient instances, so the
 * writer can never be starved by the reader's open transaction regardless of the pool's connection_limit):
 *
 *   - connection A opens a transaction, reads inputVersion (the "evaluation"),
 *   - connection B (a separate client) bumps inputVersion and commits — the concurrent writer,
 *   - connection A runs the optimistic-concurrency commit `UPDATE … WHERE inputVersion = <evaluated>` and it
 *     matches 0 rows → abort (exactly runReadinessTxn's Order→ready write).
 *
 * A positive control then commits a conditional on the CURRENT version (matches 1 row). Runs ONLY on isolated
 * staging behind the env-separation guard + an explicit opt-in; seeds + deletes one throwaway Order. Skipped by
 * default (and always in production) so `npm run check` stays green without a database.
 *
 *   VERCEL_ENV=preview ALLOW_STAGING_QA=true RUN_OUTBOX_DB_TEST=true \
 *     DATABASE_URL='postgresql://...pooler...:6543/postgres?pgbouncer=true' npx vitest run <thisfile>
 */
const RUN = process.env.RUN_OUTBOX_DB_TEST === 'true' && canAccessStagingQa();

describe.skipIf(!RUN)('Order.inputVersion optimistic concurrency — staging real DB (2 connections)', () => {
  it('a writer bumping inputVersion between eval and commit makes the conditional commit abort (0 rows)', async () => {
    assertEnvSeparation(); // refuses to proceed if any prod resource is configured
    const { prisma } = await import('@/lib/prisma'); // connection A's client (lazy import: skipped runs never connect)
    const { PrismaClient } = await import('@prisma/client');
    const writer = new PrismaClient(); // connection B — a genuinely separate pool/connection
    const id = `inputversion-test-${process.env.RUN_OUTBOX_DB_TEST_NONCE ?? 'a'}-${Date.now()}`;
    try {
      await prisma.order.create({
        data: { id, status: 'ready', inputVersion: 0, customerEmail: 'iv-test@example.invalid', customerName: 'T', childName: 'T', topic: 'iv-test', basePrice: 0, addonsPrice: 0, totalPrice: 0 },
      });

      await prisma.$transaction(async (txA) => {
        // A: the "evaluation" reads the current inputVersion.
        const rows = await txA.$queryRaw<Array<{ inputVersion: number }>>`SELECT "inputVersion" FROM "Order" WHERE "id" = ${id}`;
        const evalVersion = Number(rows[0].inputVersion);
        expect(evalVersion).toBe(0);

        // B: a CONCURRENT writer (separate connection) bumps inputVersion and commits, mid-evaluation.
        const bumped = await writer.$executeRaw`UPDATE "Order" SET "inputVersion" = "inputVersion" + 1 WHERE "id" = ${id}`;
        expect(Number(bumped)).toBe(1);

        // A: the optimistic-concurrency commit, conditional on the version it evaluated → must match 0 rows.
        const committed = await txA.$executeRaw`UPDATE "Order" SET "status" = 'needs_human_qa' WHERE "id" = ${id} AND "inputVersion" = ${evalVersion}`;
        expect(Number(committed)).toBe(0); // aborted — B moved the version out from under A
      });

      // The order was NOT flipped (the abort held); status is still 'ready'.
      const after = await prisma.order.findUnique({ where: { id }, select: { status: true, inputVersion: true } });
      expect(after?.status).toBe('ready');
      expect(after?.inputVersion).toBe(1);

      // Positive control: a conditional commit on the CURRENT version succeeds (1 row).
      const ok = await prisma.$executeRaw`UPDATE "Order" SET "status" = 'needs_human_qa' WHERE "id" = ${id} AND "inputVersion" = 1`;
      expect(Number(ok)).toBe(1);
    } finally {
      await writer.$disconnect().catch(() => { /* ignore */ });
      await prisma.order.delete({ where: { id } }).catch(() => { /* ignore */ });
    }
  }, 30_000);
});
