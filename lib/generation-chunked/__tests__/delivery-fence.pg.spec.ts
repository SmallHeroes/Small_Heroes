import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { executeReadinessShipCas, casClaimSendSlot } from '@/lib/generation-pipeline/readiness-manifest';
import { writeOrderHoldFenced, executeAnchorReleaseCas } from '@/lib/generation-pipeline/order-authority';

/**
 * Split a raw migration.sql into executable statements, honoring `$$…$$` dollar-quoting (so the `DO $$ … END $$;`
 * block is ONE statement, not split on its inner semicolons). Prisma's extended protocol rejects multi-statement
 * strings, so we run each statement separately — but the statements are the REAL migration's, verbatim (no drift).
 */
function splitSqlStatements(sql: string): string[] {
  const stripped = sql.replace(/^\s*--.*$/gm, ''); // drop line comments
  const out: string[] = [];
  let buf = '';
  let inDollar = false;
  for (let i = 0; i < stripped.length; i++) {
    if (stripped[i] === '$' && stripped[i + 1] === '$') { inDollar = !inDollar; buf += '$$'; i++; continue; }
    if (stripped[i] === ';' && !inDollar) { if (buf.trim()) out.push(buf.trim()); buf = ''; continue; }
    buf += stripped[i];
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/**
 * (delivery fence — Codex round-4 P0) REAL-POSTGRES interleaving harness.
 *
 * WHY real PG: mocked tests cannot express PostgreSQL READ COMMITTED interleavings — the exact class of bug Codex
 * found (readiness reads clean → a park writes the hold WITHOUT bumping inputVersion → the old CAS still matched →
 * ship). These tests exercise the SHARED, EXPORTED `executeReadinessShipCas` — the SAME SQL production runs, so
 * there is NO drift between the guard and its proof — against a throwaway Postgres.
 *
 * HOW TO RUN (any throwaway PG — never staging/prod):
 *   # 1. bring up an ephemeral PG (local, CI service container, or testcontainers):
 *   docker run -d --name fence-pg -p 5433:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=fence postgres:16
 *   # 2. point the harness at it and run ONLY this file:
 *   RUN_DELIVERY_FENCE_PG=true DELIVERY_FENCE_PG_URL='postgresql://postgres:postgres@localhost:5433/fence' \
 *     node node_modules/vitest/vitest.mjs run lib/generation-chunked/__tests__/delivery-fence.pg.spec.ts
 *
 * The harness creates its OWN minimal DDL (the columns/enums the ship CAS touches) so it needs only an EMPTY DB —
 * no `prisma db push`, no app env. It is INERT (describe.skipIf) unless RUN_DELIVERY_FENCE_PG=true + a URL, so it
 * never runs in the normal unit suite. In CI: add a `postgres:16` service and set the two env vars for this file.
 */

const PG_URL = process.env.DELIVERY_FENCE_PG_URL;
const RUN = process.env.RUN_DELIVERY_FENCE_PG === 'true' && !!PG_URL;

// (P0-tooling — Codex round-5) FAIL-CLOSED harness safety. The prior harness unconditionally DROPped `public."Order"`
// — two wrong env vars would destroy staging. `assertEnvSeparation()` is NOT used (it self-disables on Vercel
// Production). Instead we DEMAND, independently, all of:
//   • a dedicated database NAME (allowlist: fence / delivery_fence / *_fence_test) — a staging/prod db name is refused;
//   • a LOCAL host (localhost/127.0.0.1) unless DELIVERY_FENCE_PG_ALLOW_REMOTE=true is set explicitly;
//   • all DDL confined to a DEDICATED SCHEMA (`delivery_fence_test`) that we CREATE and DROP — `public` is NEVER
//     touched, so even a misconfigured URL cannot drop an application table.
const SCHEMA = 'delivery_fence_test';
const DB_NAME_ALLOW = /^(fence|delivery_fence|.*_fence_test)$/;
function assertThrowawayTarget(rawUrl: string): void {
  const u = new URL(rawUrl);
  const dbName = decodeURIComponent(u.pathname.replace(/^\//, ''));
  if (!DB_NAME_ALLOW.test(dbName)) {
    throw new Error(`[delivery-fence harness] REFUSED: database "${dbName}" is not a dedicated throwaway name (allow: ${DB_NAME_ALLOW}). NEVER point this at a real DB.`);
  }
  const host = u.hostname;
  const localOk = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  if (!localOk && process.env.DELIVERY_FENCE_PG_ALLOW_REMOTE !== 'true') {
    throw new Error(`[delivery-fence harness] REFUSED: non-local host "${host}"; set DELIVERY_FENCE_PG_ALLOW_REMOTE=true only for a CI throwaway DB.`);
  }
}

describe.skipIf(!RUN)('delivery fence — real Postgres READ COMMITTED interleave', () => {
  let db: PrismaClient;
  let other: PrismaClient; // a SECOND connection, for the concurrent-park interleave

  beforeAll(async () => {
    assertThrowawayTarget(PG_URL!); // hard-refuse anything that is not a dedicated throwaway DB
    // Pin the search_path to our dedicated schema for EVERY pooled connection via the URL, so unqualified table
    // names resolve there — never to `public`.
    const scoped = new URL(PG_URL!);
    scoped.searchParams.set('schema', SCHEMA);
    const url = scoped.toString();
    db = new PrismaClient({ datasources: { db: { url } } });
    other = new PrismaClient({ datasources: { db: { url } } });
    // Create the dedicated schema fresh; all objects live inside it. DROP SCHEMA … CASCADE at teardown removes ONLY
    // our schema — public is untouched.
    await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await db.$executeRawUnsafe(`CREATE SCHEMA "${SCHEMA}"`);
    await db.$executeRawUnsafe(`SET search_path TO "${SCHEMA}"`);
    await db.$executeRawUnsafe(`DO $$ BEGIN CREATE TYPE "OrderStatus" AS ENUM ('draft','pending_payment','paid','generating','ready','partial','failed','needs_human_qa'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
    await db.$executeRawUnsafe(`DO $$ BEGIN CREATE TYPE "GenerationStatus" AS ENUM ('pending','running','done','failed'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
    await db.$executeRawUnsafe(`DO $$ BEGIN CREATE TYPE "HumanQaHoldKind" AS ENUM ('safety','contract_world','anchor','payment_integrity','legacy_unknown'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
    await db.$executeRawUnsafe(`DO $$ BEGIN CREATE TYPE "HumanQaReviewCaseStatus" AS ENUM ('open','superseded','resolved','cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
    await db.$executeRawUnsafe(`
      CREATE TABLE "Order" (
        "id" TEXT PRIMARY KEY,
        "status" "OrderStatus" NOT NULL DEFAULT 'generating',
        "packageStatus" "GenerationStatus" NOT NULL DEFAULT 'pending',
        "deliveryHoldReason" TEXT,
        "inputVersion" INTEGER NOT NULL DEFAULT 0,
        "deliveryFenceVersion" INTEGER NOT NULL DEFAULT 0,
        "manualReviewRequired" BOOLEAN NOT NULL DEFAULT false
      )`);
    await db.$executeRawUnsafe(`
      CREATE TABLE "HumanQaReviewCase" (
        "id" TEXT PRIMARY KEY,
        "activeKey" TEXT,
        "status" "HumanQaReviewCaseStatus" NOT NULL DEFAULT 'open',
        "kind" "HumanQaHoldKind" NOT NULL
      )`);
    // (round-6 Unit A) DeliveryOutbox + BookReadiness — so the REAL casClaimSendSlot runs (not a replicated EXISTS).
    await db.$executeRawUnsafe(`DO $$ BEGIN CREATE TYPE "DeliveryOutboxStatus" AS ENUM ('scheduled','processing','sent','failed','delivery_blocked','superseded_by_manifest','invalid_payload','delivery_revoked'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
    await db.$executeRawUnsafe(`DO $$ BEGIN CREATE TYPE "ReadinessStatus" AS ENUM ('pending','passed','blocked','stale'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
    await db.$executeRawUnsafe(`
      CREATE TABLE "DeliveryOutbox" (
        "id" TEXT PRIMARY KEY,
        "dedupeKey" TEXT UNIQUE,
        "orderId" TEXT NOT NULL,
        "scope" TEXT NOT NULL,
        "status" "DeliveryOutboxStatus" NOT NULL DEFAULT 'scheduled',
        "payloadHash" TEXT,
        "manifestId" TEXT,
        "inputVersion" INTEGER NOT NULL DEFAULT 0,
        "deliveryFenceVersion" INTEGER NOT NULL DEFAULT 0,
        "attempts" INTEGER NOT NULL DEFAULT 0,
        "sendAttempted" BOOLEAN NOT NULL DEFAULT false,
        "sendAttempts" INTEGER NOT NULL DEFAULT 0,
        "firstSendAttemptAt" TIMESTAMPTZ,
        "leaseExpiresAt" TIMESTAMPTZ
      )`);
    await db.$executeRawUnsafe(`
      CREATE TABLE "BookReadiness" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "orderId" TEXT NOT NULL,
        "scope" TEXT NOT NULL,
        "status" "ReadinessStatus" NOT NULL DEFAULT 'passed',
        "currentManifestId" TEXT,
        UNIQUE ("orderId","scope")
      )`);
  });

  afterAll(async () => {
    // Remove ONLY our dedicated schema — never public.
    try { await db?.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`); } catch { /* teardown best-effort */ }
    await db?.$disconnect();
    await other?.$disconnect();
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe(`TRUNCATE "HumanQaReviewCase", "Order", "DeliveryOutbox", "BookReadiness"`);
  });

  async function seedOrder(over: Partial<{ status: string; deliveryHoldReason: string | null; inputVersion: number; deliveryFenceVersion: number; manualReviewRequired: boolean }> = {}): Promise<void> {
    const o = { status: 'generating', deliveryHoldReason: null as string | null, inputVersion: 0, deliveryFenceVersion: 0, manualReviewRequired: false, ...over };
    await db.$executeRaw`
      INSERT INTO "Order" ("id","status","packageStatus","deliveryHoldReason","inputVersion","deliveryFenceVersion","manualReviewRequired")
      VALUES ('o1', ${o.status}::"OrderStatus", 'pending'::"GenerationStatus", ${o.deliveryHoldReason}, ${o.inputVersion}, ${o.deliveryFenceVersion}, ${o.manualReviewRequired})`;
  }
  async function seedCase(kind: string, scope = 'base_book', status = 'open'): Promise<void> {
    await db.$executeRaw`INSERT INTO "HumanQaReviewCase" ("id","activeKey","status","kind") VALUES (${'c-' + kind}, ${'o1:' + scope}, ${status}::"HumanQaReviewCaseStatus", ${kind}::"HumanQaHoldKind")`;
  }
  async function statusOf(): Promise<string> {
    const rows = await db.$queryRaw<Array<{ status: string }>>`SELECT "status" FROM "Order" WHERE "id" = 'o1'`;
    return rows[0].status;
  }
  const ship = (over: Partial<Parameters<typeof executeReadinessShipCas>[1]> = {}) =>
    executeReadinessShipCas(db, { orderId: 'o1', inputVersion: 0, deliveryFenceVersion: 0, deliveryHoldReason: null, ...over });
  async function seedReadiness(over: Partial<{ status: string; currentManifestId: string | null }> = {}): Promise<void> {
    const r = { status: 'passed', currentManifestId: 'm1' as string | null, ...over };
    await db.$executeRaw`INSERT INTO "BookReadiness" ("orderId","scope","status","currentManifestId") VALUES ('o1','base_book', ${r.status}::"ReadinessStatus", ${r.currentManifestId})`;
  }
  async function seedOutbox(over: Partial<{ status: string; attempts: number; payloadHash: string; manifestId: string; inputVersion: number; deliveryFenceVersion: number; sendAttempted: boolean }> = {}): Promise<void> {
    const o = { status: 'processing', attempts: 1, payloadHash: 'ph', manifestId: 'm1', inputVersion: 0, deliveryFenceVersion: 0, sendAttempted: false, ...over };
    await db.$executeRaw`
      INSERT INTO "DeliveryOutbox" ("id","dedupeKey","orderId","scope","status","payloadHash","manifestId","inputVersion","deliveryFenceVersion","attempts","sendAttempted","sendAttempts")
      VALUES ('ob1','book-ready/o1/base-book/1','o1','base_book', ${o.status}::"DeliveryOutboxStatus", ${o.payloadHash}, ${o.manifestId}, ${o.inputVersion}, ${o.deliveryFenceVersion}, ${o.attempts}, ${o.sendAttempted}, 0)`;
  }
  const casRow = (over: Partial<{ inputVersion: number; payloadHash: string; manifestId: string }> = {}) =>
    ({ id: 'ob1', orderId: 'o1', scope: 'base_book', manifestId: 'm1', inputVersion: 0, payloadHash: 'ph', ...over });

  // ── the ship CAS ships a clean order ────────────────────────────────────────────────────────────────────────
  it('a clean order (no hold, fence unchanged) → SHIPS (1 row, status→ready)', async () => {
    await seedOrder();
    expect(await ship()).toBe(1);
    expect(await statusOf()).toBe('ready');
  });

  // ── every hold form blocks the ship (0 rows, order unchanged) ───────────────────────────────────────────────
  it('a safety_hold marker present → 0 rows, NOT shipped', async () => {
    await seedOrder({ status: 'needs_human_qa', deliveryHoldReason: 'safety_hold:hazard:page:2' });
    expect(await ship()).toBe(0);
    expect(await statusOf()).toBe('needs_human_qa');
  });
  it('a contract_world_hold marker present → 0 rows', async () => {
    await seedOrder({ status: 'needs_human_qa', deliveryHoldReason: 'contract_world_hold:drift' });
    expect(await ship()).toBe(0);
  });
  it('(cutover 1.3) a quarantine_cutover marker present → 0 rows, NOT shipped', async () => {
    await seedOrder({ status: 'needs_human_qa', deliveryHoldReason: 'quarantine_cutover:generating' });
    expect(await ship()).toBe(0); // TERMINAL_HOLD_NOT_LIKE_SQL blocks the ship CAS
    expect(await statusOf()).toBe('needs_human_qa');
  });
  it('a payment fence (manualReviewRequired=true) → 0 rows', async () => {
    await seedOrder({ status: 'needs_human_qa', deliveryHoldReason: 'coupon_over_cap', manualReviewRequired: true });
    expect(await ship()).toBe(0);
  });
  it('an active strong Human-QA case (safety) present though marker reads anchor (skip_weaker) → 0 rows', async () => {
    await seedOrder({ status: 'needs_human_qa', deliveryHoldReason: 'anchor_low_confidence:soft_band' });
    await seedCase('safety');
    expect(await ship()).toBe(0);
    expect(await statusOf()).toBe('needs_human_qa');
  });
  it('an active PAYMENT_INTEGRITY case (payment scope) → 0 rows', async () => {
    await seedOrder({ status: 'needs_human_qa', deliveryHoldReason: 'anchor_low_confidence:soft_band' });
    await seedCase('payment_integrity', 'payment');
    expect(await ship()).toBe(0);
  });
  it('an active ANCHOR case does NOT block (anchor is releasable) → SHIPS', async () => {
    await seedOrder({ status: 'needs_human_qa', deliveryHoldReason: 'anchor_low_confidence:soft_band' });
    await seedCase('anchor');
    expect(await ship({ requireHoldReason: 'anchor_low_confidence:soft_band' })).toBe(1);
  });

  // ── the FENCE: the whole point — a hold that landed after readiness read its value blocks the ship ───────────
  it('THE INTERLEAVE — readiness reads fence=0, a safety park bumps it, the ship CAS bound to 0 → 0 rows (no ship)', async () => {
    await seedOrder({ status: 'generating', deliveryFenceVersion: 0 });
    const observedFence = 0; // what readiness read at load
    // a safety park lands (a SECOND connection commits it) — bumps the fence WITHOUT bumping inputVersion
    await other.$executeRaw`UPDATE "Order" SET "status"='needs_human_qa'::"OrderStatus", "deliveryHoldReason"='safety_hold:hazard', "deliveryFenceVersion"="deliveryFenceVersion"+1 WHERE "id"='o1'`;
    // readiness now runs the ship CAS bound to the fence it observed (0) → the moved fence (1) rejects the ship
    expect(await ship({ deliveryFenceVersion: observedFence })).toBe(0);
    expect(await statusOf()).toBe('needs_human_qa'); // the safety hold stands; nothing shipped
  });

  it('THE FENCE ISOLATED — a bare fence bump (no marker change) still blocks a ship bound to the old fence', async () => {
    await seedOrder({ status: 'generating', deliveryFenceVersion: 4 });
    await other.$executeRaw`UPDATE "Order" SET "deliveryFenceVersion"=5 WHERE "id"='o1'`; // fence moved, nothing else
    expect(await ship({ deliveryFenceVersion: 4 })).toBe(0); // bound to the stale fence → rejected
    expect(await ship({ deliveryFenceVersion: 5 })).toBe(1); // bound to the current fence → ships
  });

  // ── requireHold (admin) precondition, real SQL ──────────────────────────────────────────────────────────────
  it('requireHold ships a still-anchor-held order, but a marker drift to safety → 0 rows', async () => {
    await seedOrder({ status: 'needs_human_qa', deliveryHoldReason: 'anchor_low_confidence:soft_band' });
    // a safety park drifts the marker + bumps the fence
    await other.$executeRaw`UPDATE "Order" SET "deliveryHoldReason"='safety_hold:hazard', "deliveryFenceVersion"="deliveryFenceVersion"+1 WHERE "id"='o1'`;
    expect(await ship({ deliveryFenceVersion: 0, requireHoldReason: 'anchor_low_confidence:soft_band' })).toBe(0);
  });
  it('requireHold + inputVersion drift → 0 rows (a genuine input change also blocks, never ships)', async () => {
    await seedOrder({ status: 'needs_human_qa', deliveryHoldReason: 'anchor_low_confidence:soft_band', inputVersion: 0 });
    await other.$executeRaw`UPDATE "Order" SET "inputVersion"=1 WHERE "id"='o1'`;
    expect(await ship({ inputVersion: 0, requireHoldReason: 'anchor_low_confidence:soft_band' })).toBe(0);
  });

  // ── (Unit 5) HOLD vs HOLD — a weak marker can NEVER clobber a stronger one (marker precedence, real SQL) ───────
  it('writeOrderHoldFenced: a WEAK anchor/integrity hold over an existing SAFETY marker → superseded, safety survives', async () => {
    await seedOrder({ status: 'needs_human_qa', deliveryHoldReason: 'safety_hold:hazard' });
    const r = await writeOrderHoldFenced(db, { orderId: 'o1', newStatus: 'needs_human_qa', newHoldReason: 'base_book_integrity:missing_page' });
    expect(r).toBe('superseded');
    const row = await db.$queryRaw<Array<{ reason: string }>>`SELECT "deliveryHoldReason" AS reason FROM "Order" WHERE "id"='o1'`;
    expect(row[0].reason).toBe('safety_hold:hazard'); // the safety marker is intact → the case sync will see safety
  });
  it('writeOrderHoldFenced: a SAFETY hold over a weaker anchor marker → applied, fence bumped', async () => {
    await seedOrder({ status: 'needs_human_qa', deliveryHoldReason: 'anchor_low_confidence:soft_band', deliveryFenceVersion: 2 });
    const r = await writeOrderHoldFenced(db, { orderId: 'o1', newStatus: 'needs_human_qa', newHoldReason: 'safety_hold:hazard' });
    expect(r).toBe('applied');
    const row = await db.$queryRaw<Array<{ reason: string; fence: number }>>`SELECT "deliveryHoldReason" AS reason, "deliveryFenceVersion" AS fence FROM "Order" WHERE "id"='o1'`;
    expect(row[0].reason).toBe('safety_hold:hazard');
    expect(Number(row[0].fence)).toBe(3); // bumped 2 -> 3
  });
  it('writeOrderHoldFenced: requireNotDelivered refuses to retract a delivered book → superseded', async () => {
    await seedOrder({ status: 'ready', deliveryHoldReason: null });
    const r = await writeOrderHoldFenced(db, { orderId: 'o1', newStatus: 'needs_human_qa', newHoldReason: 'safety_hold:late', requireNotDelivered: true });
    expect(r).toBe('superseded');
    expect(await statusOf()).toBe('ready'); // a delivered book is never retracted here
  });

  // ── (Unit 5) anchor RELEASE CAS, real SQL ─────────────────────────────────────────────────────────────────────
  it('executeAnchorReleaseCas: releases a still-anchor-held order (1 row → ready, fence bumped)', async () => {
    await seedOrder({ status: 'needs_human_qa', deliveryHoldReason: 'anchor_low_confidence:soft_band', deliveryFenceVersion: 5 });
    expect(await executeAnchorReleaseCas(db, { orderId: 'o1', expectedHoldReason: 'anchor_low_confidence:soft_band', expectedInputVersion: 0, expectedDeliveryFenceVersion: 5 })).toBe(1);
    const row = await db.$queryRaw<Array<{ status: string; fence: number }>>`SELECT "status"::text AS status, "deliveryFenceVersion" AS fence FROM "Order" WHERE "id"='o1'`;
    expect(row[0].status).toBe('ready');
    expect(Number(row[0].fence)).toBe(6);
  });
  it('executeAnchorReleaseCas: blocked by an active SAFETY case even though the marker reads anchor (skip_weaker) → 0', async () => {
    await seedOrder({ status: 'needs_human_qa', deliveryHoldReason: 'anchor_low_confidence:soft_band' });
    await seedCase('safety');
    expect(await executeAnchorReleaseCas(db, { orderId: 'o1', expectedHoldReason: 'anchor_low_confidence:soft_band', expectedInputVersion: 0, expectedDeliveryFenceVersion: 0 })).toBe(0);
    expect(await statusOf()).toBe('needs_human_qa'); // never released while a strong case is active
  });
  it('(Codex round-4 MAJOR 5) executeAnchorReleaseCas: a stale evaluated snapshot (inputVersion or fence moved) → 0, never released', async () => {
    // A delivery-input mutation bumped inputVersion after the release evaluation captured 0 → CAS 0 rows.
    await seedOrder({ status: 'needs_human_qa', deliveryHoldReason: 'anchor_low_confidence:soft_band', inputVersion: 1 });
    expect(await executeAnchorReleaseCas(db, { orderId: 'o1', expectedHoldReason: 'anchor_low_confidence:soft_band', expectedInputVersion: 0, expectedDeliveryFenceVersion: 0 })).toBe(0);
    expect(await statusOf()).toBe('needs_human_qa');
    // A hold write bumped the fence after the evaluation captured 0 → CAS 0 rows.
    await db.$executeRaw`UPDATE "Order" SET "inputVersion" = 0, "deliveryFenceVersion" = 2 WHERE "id" = 'o1'`;
    expect(await executeAnchorReleaseCas(db, { orderId: 'o1', expectedHoldReason: 'anchor_low_confidence:soft_band', expectedInputVersion: 0, expectedDeliveryFenceVersion: 0 })).toBe(0);
    expect(await statusOf()).toBe('needs_human_qa');
  });

  // ── (Unit A / Codex round-6) the REAL send-time CAS (casClaimSendSlot) — not a replicated SELECT EXISTS ────────
  it('casClaimSendSlot: an Outbox row bound to the ORDER current fence CLAIMS the slot → ok', async () => {
    await seedOrder({ status: 'ready', inputVersion: 3, deliveryFenceVersion: 7 });
    await seedReadiness({ status: 'passed', currentManifestId: 'm1' });
    await seedOutbox({ status: 'processing', attempts: 2, payloadHash: 'ph', manifestId: 'm1', inputVersion: 3, deliveryFenceVersion: 7 });
    const now = new Date();
    const r = await casClaimSendSlot(db, casRow({ inputVersion: 3 }), 2, new Date(now.getTime() + 60_000), now);
    expect(r).toBe('ok'); // correctly threaded fence → claimable → sends
  });
  it('casClaimSendSlot: an Outbox row carrying a STALE fence (row=6, order=7) is BLOCKED, never sent (the Unit A stranding)', async () => {
    await seedOrder({ status: 'ready', inputVersion: 3, deliveryFenceVersion: 7 }); // fence advanced (a hold/release happened)
    await seedReadiness({ status: 'passed', currentManifestId: 'm1' });
    await seedOutbox({ status: 'processing', attempts: 2, payloadHash: 'ph', manifestId: 'm1', inputVersion: 3, deliveryFenceVersion: 6 }); // stale / defaulted fence
    const now = new Date();
    const r = await casClaimSendSlot(db, casRow({ inputVersion: 3 }), 2, new Date(now.getTime() + 60_000), now);
    expect(r).toBe('delivery_blocked'); // fence mismatch → 0-row CAS; a defaulted/un-threaded fence strands the book
    const sent = await db.$queryRaw<Array<{ n: number }>>`SELECT COUNT(*)::int AS n FROM "DeliveryOutbox" WHERE "id"='ob1' AND "sendAttempted"=true`;
    expect(sent[0].n).toBe(0); // never marked sendAttempted → the email cannot go out
  });

  // ── (Unit D / Codex round-6) the cutover reconciliation migration un-strands a defaulted-fence row ────────────
  it('Unit D reconcile migration: a stale-fence unsent row (defaulted 0) is realigned to the Order fence, then SENDS', async () => {
    await seedOrder({ status: 'ready', inputVersion: 3, deliveryFenceVersion: 7 }); // Order fence advanced past the DEFAULT-0 backfill
    await seedReadiness({ status: 'passed', currentManifestId: 'm1' });
    await seedOutbox({ status: 'scheduled', attempts: 0, sendAttempted: false, payloadHash: 'ph', manifestId: 'm1', inputVersion: 3, deliveryFenceVersion: 0 }); // enqueued before the column existed
    // sanity: as-is this row would be stranded — its fence (0) can never match the Order's (7)
    const before = await db.$queryRaw<Array<{ f: number }>>`SELECT "deliveryFenceVersion" AS f FROM "DeliveryOutbox" WHERE "id"='ob1'`;
    expect(Number(before[0].f)).toBe(0);
    // run the REAL migration SQL (reconcile UPDATE + fail-loud stranding check), verbatim from the migration file
    const migSql = readFileSync(path.join(process.cwd(), 'backend/migrations/20260720_outbox_fence_reconcile/migration.sql'), 'utf8');
    for (const stmt of splitSqlStatements(migSql)) await db.$executeRawUnsafe(stmt);
    const after = await db.$queryRaw<Array<{ f: number }>>`SELECT "deliveryFenceVersion" AS f FROM "DeliveryOutbox" WHERE "id"='ob1'`;
    expect(Number(after[0].f)).toBe(7); // realigned to the Order's current fence — no longer stranded
    // and it is now genuinely deliverable: flip to processing (as the claimer would) → the send CAS claims it
    await db.$executeRawUnsafe(`UPDATE "DeliveryOutbox" SET "status"='processing', "attempts"=1 WHERE "id"='ob1'`);
    const now = new Date();
    const r = await casClaimSendSlot(db, casRow({ inputVersion: 3 }), 1, new Date(now.getTime() + 60_000), now);
    expect(r).toBe('ok'); // the reconciled row sends; the cutover stranding is closed
  });
  it('Unit D reconcile migration: leaves a SENT row untouched (historical fence is not rewritten)', async () => {
    await seedOrder({ status: 'ready', inputVersion: 3, deliveryFenceVersion: 7 });
    await seedOutbox({ status: 'sent', attempts: 1, sendAttempted: true, payloadHash: 'ph', manifestId: 'm1', inputVersion: 3, deliveryFenceVersion: 0 });
    const migSql = readFileSync(path.join(process.cwd(), 'backend/migrations/20260720_outbox_fence_reconcile/migration.sql'), 'utf8');
    for (const stmt of splitSqlStatements(migSql)) await db.$executeRawUnsafe(stmt);
    const after = await db.$queryRaw<Array<{ f: number }>>`SELECT "deliveryFenceVersion" AS f FROM "DeliveryOutbox" WHERE "id"='ob1'`;
    expect(Number(after[0].f)).toBe(0); // a delivered row's fence is history — reconcile must not rewrite it
  });
});
