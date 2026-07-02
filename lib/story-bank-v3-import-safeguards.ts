/**
 * Deterministic safeguards audit for v3-approved bank import path.
 * Used by scripts/verify-v3-bank-import-safeguards.ts (Codex stop-time / CI).
 */
import fs from 'fs';
import path from 'path';

import { V3_APPROVED_REL } from './story-bank-v3-import';

export interface SafeguardCheck {
  id: string;
  pass: boolean;
  detail: string;
}

export interface SafeguardReport {
  pass: boolean;
  checks: SafeguardCheck[];
}

const LEGACY_DIRECT_BANK_SOURCES = ['story-bank/v5-fixed-v2/', 'story-bank/calibration-sources/'];
const LEGACY_BYPASS_SCRIPT = 'scripts/promote-phase1-v3-approved.ts';
const ALLOWED_V3_WRITERS = new Set(['scripts/import-v3-approved-story.ts']);

function relPosix(repoRoot: string, abs: string): string {
  return path.relative(repoRoot, abs).split(path.sep).join('/');
}

function listTsScripts(scriptsDir: string): string[] {
  return fs
    .readdirSync(scriptsDir)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => path.join(scriptsDir, name));
}

/** True when source appears to write bank story/sidecar files under v3-approved (not read-only dev scripts). */
function scriptWritesToV3Approved(src: string): boolean {
  if (/writeFileSync\s*\(\s*outPath/.test(src) && /V3_APPROVED_DIR/.test(src)) return true;
  if (/writeFileSync\s*\([^)]*V3_APPROVED_DIR/.test(src)) return true;
  if (/writeFileSync\s*\(\s*path\.join\([^)]*['"]v3-approved['"]/.test(src)) return true;
  return false;
}

/** Scripts that write under story-bank/v3-approved must be approval-gated import only. */
export function findUnauthorizedV3ApprovedWriters(repoRoot: string): string[] {
  const scriptsDir = path.join(repoRoot, 'scripts');
  const offenders: string[] = [];
  for (const scriptPath of listTsScripts(scriptsDir)) {
    const rel = relPosix(repoRoot, scriptPath);
    const src = fs.readFileSync(scriptPath, 'utf8');
    if (scriptWritesToV3Approved(src) && !ALLOWED_V3_WRITERS.has(rel)) {
      offenders.push(rel);
    }
  }
  return offenders;
}

export function listLegacySourceRunDirs(repoRoot: string): string[] {
  const v3Dir = path.join(repoRoot, V3_APPROVED_REL);
  if (!fs.existsSync(v3Dir)) return [];
  const legacy: string[] = [];
  for (const name of fs.readdirSync(v3Dir)) {
    if (!name.endsWith('.import.json')) continue;
    const sidecar = JSON.parse(
      fs.readFileSync(path.join(v3Dir, name), 'utf8')
    ) as { sourceRunDir?: string };
    const src = sidecar.sourceRunDir ?? '';
    if (LEGACY_DIRECT_BANK_SOURCES.some((prefix) => src.startsWith(prefix))) {
      legacy.push(`${name}: ${src}`);
    }
  }
  return legacy.sort();
}

export function verifyV3BankImportSafeguards(repoRoot: string): SafeguardReport {
  const checks: SafeguardCheck[] = [];

  const bypassPath = path.join(repoRoot, LEGACY_BYPASS_SCRIPT);
  checks.push({
    id: 'no-promote-phase1-bypass-script',
    pass: !fs.existsSync(bypassPath),
    detail: fs.existsSync(bypassPath)
      ? `${LEGACY_BYPASS_SCRIPT} still exists (non-portable approval bypass)`
      : `${LEGACY_BYPASS_SCRIPT} absent`,
  });

  const stageScript = path.join(repoRoot, 'scripts/stage-golden-v3-import-run.ts');
  checks.push({
    id: 'stage-script-present',
    pass: fs.existsSync(stageScript),
    detail: fs.existsSync(stageScript)
      ? 'scripts/stage-golden-v3-import-run.ts present'
      : 'missing staging script',
  });

  const importScript = path.join(repoRoot, 'scripts/import-v3-approved-story.ts');
  const importSrc = fs.existsSync(importScript)
    ? fs.readFileSync(importScript, 'utf8')
    : '';
  checks.push({
    id: 'import-requires-approval-json',
    pass:
      fs.existsSync(importScript) &&
      importSrc.includes('readApprovalJson') &&
      importSrc.includes('assertApprovalReadyForImport'),
    detail: 'import-v3-approved-story.ts gates on owner approval.json',
  });

  const libPath = path.join(repoRoot, 'lib/story-bank-v3-import.ts');
  const libSrc = fs.existsSync(libPath) ? fs.readFileSync(libPath, 'utf8') : '';
  checks.push({
    id: 'staging-guard-assertNotV3ApprovedWrite',
    pass: libSrc.includes('assertNotV3ApprovedWrite') && libSrc.includes('stageGoldenImportRun'),
    detail: 'shared lib blocks staging writes under v3-approved/',
  });

  const offenders = findUnauthorizedV3ApprovedWriters(repoRoot);
  checks.push({
    id: 'only-import-writes-v3-approved',
    pass: offenders.length === 0,
    detail:
      offenders.length === 0
        ? 'only scripts/import-v3-approved-story.ts may write v3-approved'
        : `unauthorized v3-approved writers: ${offenders.join(', ')}`,
  });

  const legacy = listLegacySourceRunDirs(repoRoot);
  checks.push({
    id: 'sourceRunDir-no-direct-bank-bypass',
    pass: legacy.length === 0,
    detail:
      legacy.length === 0
        ? 'no sidecar points sourceRunDir at v5/calibration bypass paths'
        : `direct bank sourceRunDir (bypass metadata): ${legacy.join('; ')}`,
  });

  const hardFail = checks.filter(
    (c) => !c.pass && c.id !== 'sourceRunDir-no-direct-bank-bypass'
  );
  return { pass: hardFail.length === 0, checks };
}
