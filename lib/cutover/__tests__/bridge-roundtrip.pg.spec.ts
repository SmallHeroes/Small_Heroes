import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { makeIdempotent, splitSql } from '@/lib/cutover/bridge-build';
import { compareSchemas, type CatalogSide, type SeedSpec } from '@/lib/cutover/schema-equality';

/**
 * (cutover Track 2) End-to-end proof for the bridge: build a "clone" schema that is an ADDITIVE subset of the target
 * (a missing table, column, enum value, index, RLS, seed row), run the idempotent bridge against it, and prove with
 * the deliverable-2 checker that clone-after-bridge ≡ target — then run the bridge AGAIN and prove it is STILL equal
 * (idempotency PROVEN, not asserted). Env-gated + INERT unless RUN_SCHEMA_EQ_PG=true + a URL.
 */
const RAW_URL = process.env.SCHEMA_EQ_PG_URL ?? process.env.DELIVERY_FENCE_PG_URL;
const RUN = process.env.RUN_SCHEMA_EQ_PG === 'true' && !!RAW_URL;
const DB_NAME_ALLOW = /^(fence|delivery_fence|schema_eq|.*_fence_test|.*_eq_test)$/;
function assertThrowaway(rawUrl: string): void {
  const u = new URL(rawUrl);
  if (!DB_NAME_ALLOW.test(decodeURIComponent(u.pathname.replace(/^\//, '')))) throw new Error('[bridge-roundtrip] REFUSED: not a throwaway db name');
  if (!['localhost', '127.0.0.1', '::1'].includes(u.hostname) && process.env.SCHEMA_EQ_PG_ALLOW_REMOTE !== 'true') throw new Error('[bridge-roundtrip] REFUSED: non-local host');
}
function scoped(schema: string): string { const u = new URL(RAW_URL!); u.searchParams.set('schema', schema); return u.toString(); }

const TARGET = 'bridge_target';
const CLONE = 'bridge_clone';
const SEEDS: SeedSpec[] = [{ table: 'cfg', keyColumns: ['k'], valueColumns: ['v'], where: `"k" = 'seed'` }];

// The full target schema (unqualified — applied via a ?schema-scoped client).
const TARGET_DDL = [
  `CREATE TYPE "e" AS ENUM ('a','b','c')`,
  `CREATE TABLE "t1" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "score" INTEGER NOT NULL DEFAULT 5, "m" "e" NOT NULL DEFAULT 'a')`,
  `CREATE TABLE "t2" ("id" TEXT PRIMARY KEY, "t1id" TEXT NOT NULL, "qty" INTEGER NOT NULL, CONSTRAINT "t2_qty_chk" CHECK ("qty" > 0), CONSTRAINT "t2_t1_fk" FOREIGN KEY ("t1id") REFERENCES "t1"("id") ON DELETE CASCADE)`,
  `CREATE INDEX "t1_name_idx" ON "t1" ("name")`,
  `CREATE TABLE "cfg" ("id" TEXT PRIMARY KEY, "k" TEXT UNIQUE NOT NULL, "v" INTEGER NOT NULL)`,
  `ALTER TABLE "t1" ENABLE ROW LEVEL SECURITY`,
  `INSERT INTO "cfg" ("id","k","v") VALUES ('c1','seed',50) ON CONFLICT ("k") DO NOTHING`,
];
// The clone: an additive SUBSET — missing enum value 'c', column "score", table t2, the index, RLS, and the seed row.
const CLONE_DDL = [
  `CREATE TYPE "e" AS ENUM ('a','b')`,
  `CREATE TABLE "t1" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "m" "e" NOT NULL DEFAULT 'a')`,
  `CREATE TABLE "cfg" ("id" TEXT PRIMARY KEY, "k" TEXT UNIQUE NOT NULL, "v" INTEGER NOT NULL)`,
];
// Raw additive schema DDL (what `prisma migrate diff --from clone --to target --script` would emit).
const RAW_ADDITIVE = [
  `ALTER TYPE "e" ADD VALUE 'c'`,
  `ALTER TABLE "t1" ADD COLUMN "score" INTEGER NOT NULL DEFAULT 5`,
  `CREATE TABLE "t2" ("id" TEXT PRIMARY KEY, "t1id" TEXT NOT NULL, "qty" INTEGER NOT NULL, CONSTRAINT "t2_qty_chk" CHECK ("qty" > 0), CONSTRAINT "t2_t1_fk" FOREIGN KEY ("t1id") REFERENCES "t1"("id") ON DELETE CASCADE)`,
  `CREATE INDEX "t1_name_idx" ON "t1" ("name")`,
].join(';\n') + ';';
// The RLS/grants/seed appendix for THIS fixture (the real bridge uses buildAppendixSql() over the canonical tables).
const TEST_APPENDIX = [
  `ALTER TABLE "t1" ENABLE ROW LEVEL SECURITY`,
  `INSERT INTO "cfg" ("id","k","v") VALUES ('c1','seed',50) ON CONFLICT ("k") DO NOTHING`,
].join(';\n') + ';';

describe.skipIf(!RUN)('bridge round-trip — clone → bridge → EQUAL → bridge again → EQUAL (idempotency)', () => {
  let admin: PrismaClient;
  let targetDb: PrismaClient;
  let cloneDb: PrismaClient;

  beforeAll(() => {
    assertThrowaway(RAW_URL!);
    admin = new PrismaClient({ datasources: { db: { url: RAW_URL! } } });
    targetDb = new PrismaClient({ datasources: { db: { url: scoped(TARGET) } } });
    cloneDb = new PrismaClient({ datasources: { db: { url: scoped(CLONE) } } });
  });
  afterAll(async () => {
    for (const s of [TARGET, CLONE]) await admin?.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${s}" CASCADE`).catch(() => {});
    await admin?.$disconnect(); await targetDb?.$disconnect(); await cloneDb?.$disconnect();
  });
  beforeEach(async () => {
    for (const s of [TARGET, CLONE]) { await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${s}" CASCADE`); await admin.$executeRawUnsafe(`CREATE SCHEMA "${s}"`); }
    for (const stmt of TARGET_DDL) await targetDb.$executeRawUnsafe(stmt);
    for (const stmt of CLONE_DDL) await cloneDb.$executeRawUnsafe(stmt);
  });

  const sides = (): { a: CatalogSide; b: CatalogSide } => ({
    a: { schema: TARGET, label: 'target', query: <T,>(sql: string) => admin.$queryRawUnsafe<T[]>(sql) },
    b: { schema: CLONE, label: 'clone', query: <T,>(sql: string) => admin.$queryRawUnsafe<T[]>(sql) },
  });
  const applyBridge = async (): Promise<void> => {
    const bridge = `${makeIdempotent(RAW_ADDITIVE)}\n${TEST_APPENDIX}`;
    for (const stmt of splitSql(bridge)) await cloneDb.$executeRawUnsafe(stmt);
  };

  it('before the bridge the clone is UNEQUAL to target (the fixture really is a subset)', async () => {
    const diffs = await compareSchemas(sides().a, sides().b, { seeds: SEEDS });
    const dims = new Set(diffs.map((d) => d.dimension));
    for (const d of ['tables', 'columns', 'enums', 'indexes', 'rls', 'seed_rows'] as const) expect(dims.has(d)).toBe(true);
  });

  it('after the bridge, clone ≡ target (all nine dimensions)', async () => {
    await applyBridge();
    expect(await compareSchemas(sides().a, sides().b, { seeds: SEEDS })).toEqual([]);
  });

  it('running the bridge a SECOND time is a no-op — clone is STILL ≡ target (idempotency proven)', async () => {
    await applyBridge();
    expect(await compareSchemas(sides().a, sides().b, { seeds: SEEDS })).toEqual([]); // first apply → equal
    await applyBridge(); // re-apply the whole idempotent bridge
    expect(await compareSchemas(sides().a, sides().b, { seeds: SEEDS })).toEqual([]); // still equal, nothing double-applied
  });
});
