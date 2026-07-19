/**
 * (cutover Track 2, deliverable 2) assert-schema-equality — prove prod-clone-after-bridge ≡ a FRESH canonical target
 * across all nine schema dimensions. Read-only. Exits NON-ZERO on any difference (30 tables is past eyeball review).
 * Core + self-test: lib/cutover/schema-equality.ts, lib/cutover/__tests__/schema-equality.pg.spec.ts.
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/assert-schema-equality.ts \
 *     --reference-url='postgresql://…/fresh_target' --candidate-url='postgresql://…/prod_clone' \
 *     [--reference-schema=public --candidate-schema=public --ignore-grantees=postgres,supabase_admin]
 *
 * NOTE: the reference MUST be a FRESH database with the canonical migration chain applied by `prisma migrate deploy`
 * from empty — NEVER staging (whose _prisma_migrations was hand-seeded). Nothing here targets production.
 */
import { PrismaClient } from '@prisma/client';
import { compareSchemas, formatDiffs, type CatalogSide, type SeedSpec } from '../lib/cutover/schema-equality';

// The ONLY migration-seeded config rows in the canonical chain (Track 1.2: 20260707 seeds FIRST100 INACTIVE at 25%,
// 20260721 corrective sets discountPercent=50). Seed-row equality compares these — never user data (244 orders).
const CUTOVER_SEEDS: SeedSpec[] = [
  { table: 'Coupon', keyColumns: ['code'], valueColumns: ['discountPercent', 'maxRedemptions', 'active'], where: `"code" = 'FIRST100'` },
];

const argv = process.argv.slice(2);
const arg = (f: string): string | undefined => {
  const a = argv.find((x) => x.startsWith(`${f}=`));
  return a ? a.slice(f.length + 1) : undefined;
};

async function main(): Promise<void> {
  const refUrl = arg('--reference-url');
  const candUrl = arg('--candidate-url');
  if (!refUrl || !candUrl) {
    console.error('usage: --reference-url=<fresh target> --candidate-url=<prod clone> [--reference-schema=public --candidate-schema=public --ignore-grantees=postgres,...]');
    process.exit(2);
  }
  const refSchema = arg('--reference-schema') ?? 'public';
  const candSchema = arg('--candidate-schema') ?? 'public';
  const ignoreGrantees = (arg('--ignore-grantees') ?? '').split(',').map((s) => s.trim()).filter(Boolean);

  const refClient = new PrismaClient({ datasources: { db: { url: refUrl } } });
  const candClient = new PrismaClient({ datasources: { db: { url: candUrl } } });
  const a: CatalogSide = { schema: refSchema, label: `reference(${refSchema})`, query: <T,>(sql: string) => refClient.$queryRawUnsafe<T[]>(sql) };
  const b: CatalogSide = { schema: candSchema, label: `candidate(${candSchema})`, query: <T,>(sql: string) => candClient.$queryRawUnsafe<T[]>(sql) };

  try {
    const diffs = await compareSchemas(a, b, { seeds: CUTOVER_SEEDS, ignoreGrantees });
    console.log(formatDiffs(diffs, a.label, b.label));
    process.exitCode = diffs.length === 0 ? 0 : 1;
  } finally {
    await refClient.$disconnect();
    await candClient.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
