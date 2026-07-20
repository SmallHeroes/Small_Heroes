/**
 * (cutover Track 2, deliverable 1) build-bridge core — assemble the idempotent Reconciliation Bridge SQL that brings a
 * production clone (17 tables, no `_prisma_migrations`) up to the canonical target (30 tables). The additive SCHEMA
 * delta (tables/columns/enums/indexes/FKs/checks) is raw material from `prisma migrate diff --from-url <clone>
 * --to-url <target> --script`; this module (a) makes that raw DDL IDEMPOTENT (re-applying it is a no-op — the point of
 * the two rehearsals), and (b) appends the three dimensions migrate diff MISSES: RLS state, grants, and seed rows.
 *
 * HARD RULE: NO automatic backfill of BookReadiness / DeliveryOutbox for the 244 historical orders — the Track-1.3
 * quarantine owns the backlog and runs AFTER the bridge. The bridge is DDL + RLS/grants + the one seeded config row.
 *
 * Testable in isolation (lib/cutover/__tests__/bridge-build.spec.ts) and end-to-end via a real-PG round-trip that
 * proves idempotency + equality against the deliverable-2 checker (bridge-roundtrip.pg.spec.ts).
 */

// ── Curated appendix (dims 7–9), extracted from the canonical migration chain; a drift test asserts it stays in sync ─
/** Tables the canonical chain puts under RLS (ENABLE, no policy — deny non-bypass roles). These ARE the 14 new tables. */
export const RLS_ENABLED_TABLES: readonly string[] = [
  'ExceptionCase', 'ExceptionCaseAudit', 'ReissueBudget', 'RefundAttempt', 'BookReadinessManifest',
  'BookReadiness', 'DeliveryOutbox', 'AtomicOperationReceipt', 'QualityEvidence', 'Coupon',
  'CouponRedemption', 'HumanQaReviewCase', 'OperatorNotificationOutbox', 'HumanQaOperatorAction',
];
/** Explicit grant REVOKEs in the canonical chain (20260702_atomic_receipt_revoke_grants). */
export const REVOKE_GRANTS: ReadonlyArray<{ table: string; from: readonly string[] }> = [
  { table: 'AtomicOperationReceipt', from: ['PUBLIC', 'anon', 'authenticated'] },
];
/** The ONLY migration-seeded config rows: 20260707 seeds FIRST100 INACTIVE at 25%, 20260721 corrects to 50%. */
export const SEED_STATEMENTS: readonly string[] = [
  `INSERT INTO "Coupon" ("id","code","discountPercent","maxRedemptions","confirmedCount","active","updatedAt")\n` +
    `VALUES ('coupon_first100','FIRST100',25,100,0,false,CURRENT_TIMESTAMP)\nON CONFLICT ("code") DO NOTHING;`,
  `UPDATE "Coupon" SET "discountPercent" = 50, "updatedAt" = CURRENT_TIMESTAMP WHERE "code" = 'FIRST100';`,
];

/** Split SQL into statements, honoring `$$…$$` dollar-quoting and '…' string literals (so `;` inside them is safe). */
export function splitSql(sql: string): string[] {
  const noLineComments = sql.replace(/^\s*--.*$/gm, '');
  const out: string[] = [];
  let buf = '';
  let inDollar = false;
  let inStr = false;
  for (let i = 0; i < noLineComments.length; i++) {
    const c = noLineComments[i];
    if (!inStr && c === '$' && noLineComments[i + 1] === '$') { inDollar = !inDollar; buf += '$$'; i++; continue; }
    if (!inDollar && c === "'") { inStr = !inStr; buf += c; continue; }
    if (c === ';' && !inDollar && !inStr) { if (buf.trim()) out.push(buf.trim()); buf = ''; continue; }
    buf += c;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/** Wrap a statement that has no IF-NOT-EXISTS form (CREATE TYPE, ADD CONSTRAINT) so a re-run swallows the duplicate. */
function guardDuplicate(stmt: string): string {
  return `DO $$ BEGIN\n  ${stmt};\nEXCEPTION WHEN duplicate_object THEN null; WHEN duplicate_table THEN null; END $$;`;
}

/**
 * Rewrite one migrate-diff statement into an idempotent form. Handles the shapes `migrate diff --script` emits for an
 * ADDITIVE delta: CREATE TABLE, ADD COLUMN, CREATE [UNIQUE] INDEX, CREATE TYPE … AS ENUM, ADD VALUE, ADD CONSTRAINT.
 */
export function idempotentStatement(stmt: string): string {
  const s = stmt.trim();
  const head = s.replace(/\s+/g, ' ').toUpperCase();

  if (head.startsWith('CREATE TABLE ') && !head.startsWith('CREATE TABLE IF NOT EXISTS')) {
    return s.replace(/^CREATE TABLE\s+/i, 'CREATE TABLE IF NOT EXISTS ');
  }
  if (/^CREATE (UNIQUE )?INDEX /i.test(s) && !/IF NOT EXISTS/i.test(s)) {
    return s.replace(/^CREATE (UNIQUE )?INDEX\s+/i, (m) => `${m.trimEnd()} IF NOT EXISTS `.replace(/\s+IF/, ' IF'));
  }
  if (head.startsWith('CREATE TYPE ')) return guardDuplicate(s); // enums: no IF NOT EXISTS
  if (head.startsWith('CREATE SEQUENCE ') && !head.includes('IF NOT EXISTS')) {
    return s.replace(/^CREATE SEQUENCE\s+/i, 'CREATE SEQUENCE IF NOT EXISTS ');
  }
  if (head.startsWith('ALTER TABLE ')) {
    // ADD CONSTRAINT has no IF NOT EXISTS → guard the whole statement; ADD COLUMN does → inline it.
    if (/\bADD CONSTRAINT\b/i.test(s)) return guardDuplicate(s);
    if (/\bADD COLUMN\b/i.test(s) && !/ADD COLUMN IF NOT EXISTS/i.test(s)) {
      return s.replace(/\bADD COLUMN\s+/gi, 'ADD COLUMN IF NOT EXISTS ');
    }
    return s;
  }
  if (head.startsWith('ALTER TYPE ') && /\bADD VALUE\b/i.test(s) && !/ADD VALUE IF NOT EXISTS/i.test(s)) {
    return s.replace(/\bADD VALUE\s+/i, 'ADD VALUE IF NOT EXISTS ');
  }
  return s; // already idempotent, or a shape we pass through unchanged
}

/** Make a whole migrate-diff script idempotent, statement by statement. */
export function makeIdempotent(sql: string): string {
  return splitSql(sql).map(idempotentStatement).map((s) => `${s};`).join('\n\n');
}

/** The RLS/grants/seed appendix (dims 7–9) as idempotent SQL. Runs AFTER the schema DDL (its tables now exist). */
export function buildAppendixSql(): string {
  const rls = RLS_ENABLED_TABLES.map((t) => `ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY;`).join('\n');
  const grants = REVOKE_GRANTS.flatMap((g) => g.from.map((r) => `REVOKE ALL ON TABLE "${g.table}" FROM ${r};`)).join('\n');
  return [
    '-- ── dim 7: RLS (ENABLE, no policy — deny non-bypass roles). Idempotent: ENABLE RLS twice is a no-op. ─────',
    rls,
    '',
    '-- ── dim 8: grants (explicit REVOKEs from the canonical chain). Idempotent. ───────────────────────────────',
    grants,
    '',
    '-- ── dim 9: seed rows (the ONE seeded config row). Idempotent (ON CONFLICT DO NOTHING + a fixed UPDATE). ───',
    ...SEED_STATEMENTS,
  ].join('\n');
}

export interface AssembleOptions {
  /** Raw additive schema DDL from `prisma migrate diff --from-url <clone> --to-url <target> --script`. */
  schemaDdl: string;
  /** Provenance line for the header (e.g. the clone + target identifiers). */
  provenance?: string;
}

/** Assemble the full idempotent bridge: header → idempotent schema DDL → RLS/grants/seed appendix → NO-BACKFILL note. */
export function assembleBridge(opts: AssembleOptions): string {
  return [
    '-- ============================================================================================================',
    '-- PRODUCTION RECONCILIATION BRIDGE (cutover Track 2, deliverable 1) — GENERATED. Do not hand-edit.',
    `-- Provenance: ${opts.provenance ?? 'prisma migrate diff --from-url <prod-clone> --to-url <fresh-target> --script'}`,
    '-- IDEMPOTENT: re-applying this whole script is a no-op (proven by the round-trip rehearsal).',
    '-- NO BACKFILL: this creates SCHEMA + RLS/grants + the one seeded config row ONLY. It inserts ZERO BookReadiness',
    '--   / DeliveryOutbox rows for the 244 historical orders — the Track-1.3 quarantine owns the backlog, AFTER this.',
    '-- ============================================================================================================',
    '',
    '-- ── dims 1–6: additive schema (tables/columns/enums/indexes/FKs/checks), made idempotent ─────────────────',
    makeIdempotent(opts.schemaDdl),
    '',
    buildAppendixSql(),
    '',
    '-- (No INSERT/UPDATE/DELETE on Order, GenerationJob, GeneratedBook, BookReadiness, DeliveryOutbox, or any',
    '--  historical row appears above. Verify with the equality checker, then baseline — see BRIDGE-RUNBOOK.md.)',
    '',
  ].join('\n');
}
