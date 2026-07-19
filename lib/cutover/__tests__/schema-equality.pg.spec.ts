import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { compareSchemas, type CatalogSide, type Dimension, type SeedSpec } from '@/lib/cutover/schema-equality';

/**
 * (cutover Track 2) Self-test for the schema-equality checker. "A checker that cannot fail is worthless" — so this
 * builds TWO identical schemas (ref, cand) in a throwaway PG, proves they compare EQUAL, then introduces a deliberate
 * difference in EACH of the nine dimensions and proves the checker flags exactly that dimension. Env-gated + INERT
 * (describe.skipIf) unless RUN_SCHEMA_EQ_PG=true + a URL, so it never runs in the normal suite.
 *
 *   RUN_SCHEMA_EQ_PG=true SCHEMA_EQ_PG_URL='postgresql://postgres:postgres@localhost:55432/fence' \
 *     node node_modules/vitest/vitest.mjs run lib/cutover/__tests__/schema-equality.pg.spec.ts
 */
const PG_URL = process.env.SCHEMA_EQ_PG_URL ?? process.env.DELIVERY_FENCE_PG_URL;
const RUN = process.env.RUN_SCHEMA_EQ_PG === 'true' && !!PG_URL;

// Fail-closed: a dedicated throwaway DB name + a local host, exactly like the delivery-fence harness.
const DB_NAME_ALLOW = /^(fence|delivery_fence|schema_eq|.*_fence_test|.*_eq_test)$/;
function assertThrowaway(rawUrl: string): void {
  const u = new URL(rawUrl);
  const dbName = decodeURIComponent(u.pathname.replace(/^\//, ''));
  if (!DB_NAME_ALLOW.test(dbName)) throw new Error(`[schema-eq test] REFUSED: db "${dbName}" is not a throwaway name.`);
  const host = u.hostname;
  if (!(host === 'localhost' || host === '127.0.0.1' || host === '::1') && process.env.SCHEMA_EQ_PG_ALLOW_REMOTE !== 'true') {
    throw new Error(`[schema-eq test] REFUSED: non-local host "${host}".`);
  }
}

const REF = 'sqleq_ref';
const CAND = 'sqleq_cand';
const ROLE = 'sh_eq_test_role';
const SEEDS: SeedSpec[] = [{ table: 'Coupon', keyColumns: ['code'], valueColumns: ['discountPercent', 'maxRedemptions', 'active'], where: `"code" = 'FIRST100'` }];

/** The identical base schema exercising all nine dimensions (enum, columns+defaults, index, FK, check, RLS+policy, grant, seed). */
function baseDdl(s: string): string[] {
  return [
    `CREATE SCHEMA "${s}"`,
    `CREATE TYPE "${s}"."mood" AS ENUM ('happy','sad')`,
    `CREATE TABLE "${s}"."parent" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "score" INTEGER NOT NULL DEFAULT 5, "m" "${s}"."mood" NOT NULL DEFAULT 'happy')`,
    `CREATE TABLE "${s}"."child" ("id" TEXT PRIMARY KEY, "parentId" TEXT NOT NULL, "qty" INTEGER NOT NULL, CONSTRAINT "child_qty_check" CHECK ("qty" > 0), CONSTRAINT "child_parent_fk" FOREIGN KEY ("parentId") REFERENCES "${s}"."parent"("id") ON DELETE CASCADE)`,
    `CREATE INDEX "parent_name_idx" ON "${s}"."parent" ("name")`,
    `ALTER TABLE "${s}"."parent" ENABLE ROW LEVEL SECURITY`,
    `CREATE POLICY "parent_sel" ON "${s}"."parent" FOR SELECT USING (true)`,
    `GRANT SELECT ON "${s}"."child" TO ${ROLE}`,
    `CREATE TABLE "${s}"."Coupon" ("id" TEXT PRIMARY KEY, "code" TEXT UNIQUE NOT NULL, "discountPercent" INTEGER NOT NULL, "maxRedemptions" INTEGER NOT NULL, "active" BOOLEAN NOT NULL DEFAULT false)`,
    `INSERT INTO "${s}"."Coupon" ("id","code","discountPercent","maxRedemptions","active") VALUES ('c1','FIRST100',50,100,false)`,
  ];
}

describe.skipIf(!RUN)('schema-equality checker self-test (all nine dimensions)', () => {
  let db: PrismaClient;
  const sides = (): { a: CatalogSide; b: CatalogSide } => ({
    a: { schema: REF, label: 'ref', query: <T,>(sql: string) => db.$queryRawUnsafe<T[]>(sql) },
    b: { schema: CAND, label: 'cand', query: <T,>(sql: string) => db.$queryRawUnsafe<T[]>(sql) },
  });
  const apply = async (stmts: string[]): Promise<void> => { for (const s of stmts) await db.$executeRawUnsafe(s); };
  const compare = () => compareSchemas(sides().a, sides().b, { seeds: SEEDS });

  beforeAll(async () => {
    assertThrowaway(PG_URL!);
    db = new PrismaClient({ datasources: { db: { url: PG_URL! } } });
    await db.$executeRawUnsafe(`DO $$ BEGIN CREATE ROLE ${ROLE} NOLOGIN; EXCEPTION WHEN duplicate_object THEN null; END $$;`);
  });
  afterAll(async () => {
    for (const s of [REF, CAND]) await db?.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${s}" CASCADE`).catch(() => {});
    await db?.$executeRawUnsafe(`DROP ROLE IF EXISTS ${ROLE}`).catch(() => {});
    await db?.$disconnect();
  });
  beforeEach(async () => {
    for (const s of [REF, CAND]) await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${s}" CASCADE`);
    await apply(baseDdl(REF));
    await apply(baseDdl(CAND));
  });

  it('two identically-built schemas compare EQUAL (zero diffs)', async () => {
    expect(await compare()).toEqual([]);
  });

  // ── each mutation touches ONE dimension; the checker must flag exactly that dimension (and stay non-empty) ────────
  const cases: Array<{ dim: Dimension; label: string; mutate: string }> = [
    { dim: 'tables', label: 'an extra table', mutate: `CREATE TABLE "${CAND}"."orphan" ("id" TEXT PRIMARY KEY)` },
    { dim: 'columns', label: 'a changed default', mutate: `ALTER TABLE "${CAND}"."parent" ALTER COLUMN "score" SET DEFAULT 9` },
    { dim: 'enums', label: 'an added enum value', mutate: `ALTER TYPE "${CAND}"."mood" ADD VALUE 'angry'` },
    { dim: 'indexes', label: 'a dropped index', mutate: `DROP INDEX "${CAND}"."parent_name_idx"` },
    { dim: 'foreign_keys', label: 'a dropped FK', mutate: `ALTER TABLE "${CAND}"."child" DROP CONSTRAINT "child_parent_fk"` },
    { dim: 'check_constraints', label: 'a dropped check', mutate: `ALTER TABLE "${CAND}"."child" DROP CONSTRAINT "child_qty_check"` },
    { dim: 'rls', label: 'RLS disabled', mutate: `ALTER TABLE "${CAND}"."parent" DISABLE ROW LEVEL SECURITY` },
    { dim: 'grants', label: 'a revoked grant', mutate: `REVOKE SELECT ON "${CAND}"."child" FROM ${ROLE}` },
    { dim: 'seed_rows', label: 'a changed seed row', mutate: `UPDATE "${CAND}"."Coupon" SET "discountPercent"=99 WHERE "code"='FIRST100'` },
  ];

  for (const c of cases) {
    it(`detects a difference in [${c.dim}] — ${c.label}`, async () => {
      await db.$executeRawUnsafe(c.mutate);
      const diffs = await compare();
      expect(diffs.length).toBeGreaterThan(0); // exits non-zero
      expect(diffs.map((d) => d.dimension)).toContain(c.dim); // and it is THIS dimension
    });
  }

  it('a nulled/removed RLS policy is also caught (rls dimension covers policies, not just the enable flag)', async () => {
    await db.$executeRawUnsafe(`DROP POLICY "parent_sel" ON "${CAND}"."parent"`);
    const diffs = await compare();
    expect(diffs.some((d) => d.dimension === 'rls' && d.object.startsWith('policy:'))).toBe(true);
  });
});
