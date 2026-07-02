/**
 * v3→Wizard bridge importer — converts an OWNER-APPROVED Generator-v3 run into a
 * bank-compatible entry under story-bank/v3-approved/{companionId}_{direction}.md.
 *
 * HARD RULES (owner-locked brief):
 * - REFUSES to import without an owner-written approval.json in the run dir.
 *   This tool NEVER writes or flips approval itself.
 * - Hard validation: frontmatter, page count vs direction, imageDirection on every
 *   page, chip safety (suffix/artifact/slash), personalization dry-run both genders.
 * - Serving the imported entry requires ENABLE_V3_APPROVED_BANK=true (off by default).
 *
 * Usage:
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/import-v3-approved-story.ts \
 *     --run=outputs/story-gen-v3-runs/<run-dir> [--dry-run]
 *
 * Staging (no bank write): scripts/stage-golden-v3-import-run.ts
 *
 * approval.json contract (written BY GUY, by hand):
 *   { "approvedBy": "Guy", "approvedAt": "2026-06-09T21:00:00+03:00", "note": "optional" }
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import {
  assertApprovalReadyForImport,
  readApprovalJson,
  resolveImportGateModeFromSelfCheck,
  type V3ImportSelfCheck,
  validateStoryForV3Import,
} from '../lib/story-bank-v3-import';

const V3_APPROVED_DIR = path.join(process.cwd(), 'story-bank', 'v3-approved');

function fail(msg: string): never {
  console.error(`[v3-import] FAIL: ${msg}`);
  process.exit(2);
}

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
}

function injectTraceabilityFrontmatter(
  md: string,
  fields: Record<string, string>
): string {
  const fmMatch = md.match(/^([\s\S]*?\n---\n[\s\S]*?)(\n---\n)/);
  if (!fmMatch) fail('story.md has no YAML frontmatter block to extend');
  const lines = Object.entries(fields)
    .map(([k, v]) => `${k}: "${v}"`)
    .join('\n');
  return md.replace(fmMatch[2], `\n${lines}\n---\n`);
}

function main(): void {
  const runDirArg = arg('run');
  if (!runDirArg) fail('--run=<v3 run dir> is required');
  const runDir = path.resolve(runDirArg);
  const dryRun = process.argv.includes('--dry-run');

  const storyPath = path.join(runDir, 'story.md');
  if (!fs.existsSync(storyPath)) fail(`no story.md in ${runDir}`);

  const selfCheckPath = path.join(runDir, 'self-check.json');
  if (!fs.existsSync(selfCheckPath)) fail(`no self-check.json in ${runDir}`);
  const selfCheck = JSON.parse(fs.readFileSync(selfCheckPath, 'utf8')) as V3ImportSelfCheck;
  if (selfCheck.gatePassAutomated !== true) {
    fail('self-check.json gatePassAutomated !== true — fix gates before import');
  }

  const md = fs.readFileSync(storyPath, 'utf8');
  const gateMode = resolveImportGateModeFromSelfCheck(selfCheck);
  const { companionId, direction, pageCount, errors, personalizationWarnings } =
    validateStoryForV3Import(md, { personalizationGate: gateMode });

  if (errors.length) {
    console.error(`[v3-import] validation FAILED (${errors.length}):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(2);
  }
  if (personalizationWarnings.length) {
    console.warn(`[v3-import] personalization gate WARN (${personalizationWarnings.length}):`);
    for (const w of personalizationWarnings) console.warn(`  - ${w}`);
  }
  console.log(
    `[v3-import] validation PASS — ${companionId}_${direction}, ${pageCount} pages`
  );

  if (dryRun) {
    console.log('[v3-import] --dry-run: validation only, NOT an import, NOT an approval.');
    return;
  }

  let approval: ReturnType<typeof readApprovalJson>;
  try {
    approval = readApprovalJson(runDir);
    assertApprovalReadyForImport(approval, selfCheck);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }

  const storyId = path.basename(runDir);
  const importedAt = new Date().toISOString();
  const outMd = injectTraceabilityFrontmatter(md, {
    generator: 'v3',
    storyId,
    sourceRunDir: path.relative(process.cwd(), runDir).split(path.sep).join('/'),
    approvedBy: approval.approvedBy,
    approvedAt: approval.approvedAt,
    importedAt,
  });

  fs.mkdirSync(V3_APPROVED_DIR, { recursive: true });
  const base = `${companionId}_${direction}`;
  const outPath = path.join(V3_APPROVED_DIR, `${base}.md`);
  fs.writeFileSync(outPath, outMd, 'utf8');

  const sidecar = {
    storyId,
    sourceRunDir: path.relative(process.cwd(), runDir).split(path.sep).join('/'),
    companionId,
    direction,
    pageCount,
    approvedBy: approval.approvedBy,
    approvedAt: approval.approvedAt,
    approvalNote: approval.note ?? null,
    importedAt,
    servedOnlyWhen: 'ENABLE_V3_APPROVED_BANK=true',
  };
  fs.writeFileSync(
    path.join(V3_APPROVED_DIR, `${base}.import.json`),
    JSON.stringify(sidecar, null, 2),
    'utf8'
  );

  console.log(`[v3-import] imported → ${outPath}`);
  console.log(`[v3-import] traceability → ${base}.import.json`);
  console.log('[v3-import] serving requires ENABLE_V3_APPROVED_BANK=true (flag is OFF by default)');
}

main();
