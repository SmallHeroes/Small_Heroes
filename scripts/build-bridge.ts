/**
 * (cutover Track 2, deliverable 1) build-bridge CLI — generate the idempotent Reconciliation Bridge SQL from a
 * production CLONE's actual state to the FRESH canonical target. Core + tests: lib/cutover/bridge-build.ts.
 *
 * The additive schema delta is raw material from `prisma migrate diff` (which does NOT cover RLS/grants/seed — those
 * are appended explicitly by assembleBridge). NEVER runs against production — Guy provisions the clone + target.
 *
 *   # dry-run: derive the diff, print a summary of what the bridge WOULD contain (writes nothing)
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/build-bridge.ts \
 *     --from-url='postgresql://…/prod_clone' --to-url='postgresql://…/fresh_target' --dry-run
 *   # generate: write the bridge SQL
 *   npx tsx … scripts/build-bridge.ts --from-url=… --to-url=… --out=backend/cutover/bridge.generated.sql
 *
 * The reference (--to-url) MUST be a FRESH `prisma migrate deploy`-from-empty DB — never staging.
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import { assembleBridge, makeIdempotent, buildAppendixSql, splitSql } from '../lib/cutover/bridge-build';

const argv = process.argv.slice(2);
const has = (f: string): boolean => argv.includes(f);
const val = (f: string): string | undefined => {
  const a = argv.find((x) => x.startsWith(`${f}=`));
  return a ? a.slice(f.length + 1) : undefined;
};

/** Raw additive schema DDL: `prisma migrate diff --from-url <clone> --to-url <target> --script`. */
function migrateDiffScript(fromUrl: string, toUrl: string): string {
  return execFileSync('npx', ['prisma', 'migrate', 'diff', '--from-url', fromUrl, '--to-url', toUrl, '--script'], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
}

function main(): void {
  const fromUrl = val('--from-url');
  const toUrl = val('--to-url');
  const out = val('--out');
  const dryRun = has('--dry-run');
  if (!fromUrl || !toUrl) {
    console.error('usage: --from-url=<prod clone> --to-url=<fresh target> [--out=backend/cutover/bridge.generated.sql | --dry-run]');
    process.exit(2);
  }

  const schemaDdl = migrateDiffScript(fromUrl, toUrl);
  const schemaStmts = splitSql(schemaDdl);

  if (dryRun) {
    const kind = (re: RegExp) => schemaStmts.filter((s) => re.test(s.replace(/\s+/g, ' ').toUpperCase())).length;
    console.log('[build-bridge] DRY-RUN — the bridge WOULD contain:');
    console.log(`  schema (from migrate diff): ${schemaStmts.length} statement(s)`);
    console.log(`    CREATE TABLE:      ${kind(/^CREATE TABLE /)}`);
    console.log(`    ALTER TABLE:       ${kind(/^ALTER TABLE /)}  (ADD COLUMN: ${schemaStmts.filter((s) => /ADD COLUMN/i.test(s)).length}, ADD CONSTRAINT: ${schemaStmts.filter((s) => /ADD CONSTRAINT/i.test(s)).length})`);
    console.log(`    CREATE TYPE (enum):${kind(/^CREATE TYPE /)}`);
    console.log(`    CREATE INDEX:      ${kind(/^CREATE (UNIQUE )?INDEX /)}`);
    console.log(`  appendix (explicit, NOT from migrate diff): RLS + grants + seed`);
    console.log(`\n--- appendix preview (dims 7–9) ---\n${buildAppendixSql()}`);
    console.log('\n[build-bridge] DRY-RUN complete — nothing written. Re-run with --out=... to generate.');
    // sanity: assembling must not throw
    void makeIdempotent(schemaDdl);
    return;
  }

  const bridge = assembleBridge({ schemaDdl, provenance: `migrate diff --from-url <clone> --to-url <target> (${new Date().toISOString().slice(0, 10)})` });
  if (!out) { console.error('[build-bridge] refusing to print the bridge to stdout — pass --out=<path> or --dry-run'); process.exit(2); }
  fs.writeFileSync(out, bridge, 'utf8');
  console.log(`[build-bridge] wrote ${bridge.split('\n').length} lines → ${out}. Apply on the CLONE, then run assert-schema-equality (see BRIDGE-RUNBOOK.md).`);
}

main();
