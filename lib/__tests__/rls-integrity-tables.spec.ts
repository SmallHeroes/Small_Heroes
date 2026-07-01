import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * #7-a-fix ITEM 2 — the 3 legacy integrity tables must have RLS enabled with NO client policies (service-role
 * only). This asserts the additive migration; the LIVE check (the Prisma runtime role can still read/write all
 * three under RLS) is a #7 staging verification, noted in the migration.
 */
function migration(dir: string): string {
  return readFileSync(join(process.cwd(), 'backend', 'migrations', dir, 'migration.sql'), 'utf8');
}

describe('RLS on the 3 legacy integrity tables (20260701_rls_integrity_tables)', () => {
  const sql = migration('20260701_rls_integrity_tables');
  for (const table of ['BookReadinessManifest', 'BookReadiness', 'DeliveryOutbox']) {
    it(`enables RLS on ${table}`, () => {
      expect(sql).toMatch(new RegExp(`ALTER TABLE "${table}"\\s+ENABLE ROW LEVEL SECURITY`));
    });
  }
  it('creates NO client policies (service-role only)', () => {
    expect(/CREATE POLICY/i.test(sql)).toBe(false);
  });
});

describe('RLS on QualityEvidence (20260701_quality_evidence)', () => {
  const sql = migration('20260701_quality_evidence');
  it('enables RLS with no client policy', () => {
    expect(sql).toMatch(/ALTER TABLE "QualityEvidence"\s+ENABLE ROW LEVEL SECURITY/);
    expect(/CREATE POLICY/i.test(sql)).toBe(false);
  });
});
