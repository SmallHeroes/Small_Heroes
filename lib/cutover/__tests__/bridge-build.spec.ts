import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'fs';
import path from 'path';
import {
  splitSql, idempotentStatement, makeIdempotent, assembleBridge, buildAppendixSql,
  RLS_ENABLED_TABLES, REVOKE_GRANTS,
} from '@/lib/cutover/bridge-build';

describe('splitSql', () => {
  it('splits on ; but respects $$ dollar-quoting and string literals', () => {
    const sql = `CREATE TABLE "a" ("id" text);\nDO $$ BEGIN PERFORM 1; END $$;\nUPDATE "a" SET x = 'a;b';`;
    expect(splitSql(sql)).toHaveLength(3);
    expect(splitSql(sql)[1]).toContain('DO $$');
    expect(splitSql(sql)[2]).toContain("'a;b'");
  });
});

describe('idempotentStatement (the migrate-diff → idempotent transform)', () => {
  it('CREATE TABLE → CREATE TABLE IF NOT EXISTS', () => {
    expect(idempotentStatement('CREATE TABLE "Book" ("id" TEXT)')).toBe('CREATE TABLE IF NOT EXISTS "Book" ("id" TEXT)');
  });
  it('ADD COLUMN → ADD COLUMN IF NOT EXISTS (all columns in the statement)', () => {
    expect(idempotentStatement('ALTER TABLE "Order" ADD COLUMN "a" INT, ADD COLUMN "b" TEXT')).toBe('ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "a" INT, ADD COLUMN IF NOT EXISTS "b" TEXT');
  });
  it('CREATE INDEX / CREATE UNIQUE INDEX → … IF NOT EXISTS', () => {
    expect(idempotentStatement('CREATE INDEX "i" ON "t" ("c")')).toBe('CREATE INDEX IF NOT EXISTS "i" ON "t" ("c")');
    expect(idempotentStatement('CREATE UNIQUE INDEX "u" ON "t" ("c")')).toBe('CREATE UNIQUE INDEX IF NOT EXISTS "u" ON "t" ("c")');
  });
  it('CREATE TYPE (enum) → guarded DO block (no IF NOT EXISTS for types)', () => {
    const out = idempotentStatement(`CREATE TYPE "Mood" AS ENUM ('a','b')`);
    expect(out).toMatch(/^DO \$\$ BEGIN/);
    expect(out).toContain('duplicate_object');
  });
  it('ADD CONSTRAINT (FK/CHECK) → guarded DO block', () => {
    expect(idempotentStatement('ALTER TABLE "c" ADD CONSTRAINT "fk" FOREIGN KEY ("p") REFERENCES "a"("id")')).toMatch(/^DO \$\$ BEGIN/);
  });
  it('ALTER TYPE … ADD VALUE → ADD VALUE IF NOT EXISTS', () => {
    expect(idempotentStatement(`ALTER TYPE "Mood" ADD VALUE 'c'`)).toBe(`ALTER TYPE "Mood" ADD VALUE IF NOT EXISTS 'c'`);
  });
  it('is a fixpoint — an already-idempotent statement is unchanged', () => {
    const s = 'CREATE TABLE IF NOT EXISTS "Book" ("id" TEXT)';
    expect(idempotentStatement(s)).toBe(s);
    expect(makeIdempotent(makeIdempotent(s))).toBe(makeIdempotent(s));
  });
});

describe('assembleBridge', () => {
  const bridge = assembleBridge({ schemaDdl: 'CREATE TABLE "BookReadiness" ("id" TEXT);\nALTER TABLE "Order" ADD COLUMN "deliveryFenceVersion" INTEGER NOT NULL DEFAULT 0;' });
  it('makes the schema idempotent and appends RLS + grants + seed', () => {
    expect(bridge).toContain('CREATE TABLE IF NOT EXISTS "BookReadiness"');
    expect(bridge).toContain('ADD COLUMN IF NOT EXISTS "deliveryFenceVersion"');
    expect(bridge).toContain('ENABLE ROW LEVEL SECURITY');
    expect(bridge).toContain('REVOKE ALL ON TABLE "AtomicOperationReceipt"');
    expect(bridge).toContain(`'FIRST100'`);
  });
  it('states NO BACKFILL and contains no historical-row INSERT/UPDATE beyond the coupon seed', () => {
    expect(bridge).toContain('NO BACKFILL');
    // the only INSERT/UPDATE are the Coupon seed; nothing touches BookReadiness/DeliveryOutbox/Order rows
    expect(bridge).not.toMatch(/INSERT INTO "(BookReadiness|DeliveryOutbox|Order|GenerationJob)"/);
    expect(bridge).not.toMatch(/UPDATE "(Order|GenerationJob|BookReadiness|DeliveryOutbox)"/);
  });
});

describe('appendix drift guard — the curated appendix must match the canonical migration chain', () => {
  const migDir = path.join(process.cwd(), 'backend', 'migrations');
  const allSql = readdirSync(migDir)
    .map((d) => path.join(migDir, d, 'migration.sql'))
    .filter((f) => existsSync(f))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');

  it('RLS_ENABLED_TABLES == every ALTER TABLE … ENABLE ROW LEVEL SECURITY in the chain', () => {
    const inChain = new Set<string>();
    for (const m of allSql.matchAll(/ALTER TABLE\s+"([^"]+)"\s+ENABLE ROW LEVEL SECURITY/gi)) inChain.add(m[1]);
    expect(new Set(RLS_ENABLED_TABLES)).toEqual(inChain);
  });
  it('REVOKE_GRANTS covers every REVOKE … ON TABLE … in the chain', () => {
    const inChain = new Set<string>();
    for (const m of allSql.matchAll(/REVOKE\s+ALL\s+ON\s+TABLE\s+"([^"]+)"\s+FROM\s+(\w+)/gi)) inChain.add(`${m[1]}|${m[2]}`);
    const curated = new Set(REVOKE_GRANTS.flatMap((g) => g.from.map((r) => `${g.table}|${r}`)));
    expect(curated).toEqual(inChain);
  });
  it('the appendix references FIRST100 exactly as the coupon migrations do', () => {
    expect(buildAppendixSql()).toContain(`'FIRST100'`);
    expect(buildAppendixSql()).toContain('discountPercent" = 50'); // the 20260721 corrective end-state
  });
});
