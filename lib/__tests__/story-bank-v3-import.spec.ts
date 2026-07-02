import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';

import {
  assertApprovalReadyForImport,
  assertNotV3ApprovedWrite,
  readApprovalJson,
  resolveImportGateModeFromSelfCheck,
  stageGoldenImportRun,
  stripGoldenSourceHeader,
  validateStoryForV3Import,
} from '../story-bank-v3-import';
import { verifyV3BankImportSafeguards } from '../story-bank-v3-import-safeguards';

const FOX_BEDTIME = path.join(
  process.cwd(),
  'story-bank/v5-fixed-v2/fox_uri_bedtime.md'
);
const KOKO_CALIBRATION = path.join(
  process.cwd(),
  'story-bank/calibration-sources/chameleon_koko_adventure.md'
);

describe('story-bank-v3-import', () => {
  it('stripGoldenSourceHeader removes v5 comment block and keeps YAML+pages', () => {
    const raw = fs.readFileSync(FOX_BEDTIME, 'utf8');
    const stripped = stripGoldenSourceHeader(raw);
    expect(stripped.startsWith('---\ntitle:')).toBe(true);
    expect(stripped).toContain('--- Page 1 ---');
    expect(stripped).not.toMatch(/^# Story:/m);
  });

  it('validateStoryForV3Import passes fox_uri_bedtime (strict gate)', () => {
    const md = stripGoldenSourceHeader(fs.readFileSync(FOX_BEDTIME, 'utf8'));
    const result = validateStoryForV3Import(md);
    expect(result.errors).toEqual([]);
    expect(result.companionId).toBe('fox_uri');
    expect(result.direction).toBe('bedtime');
    expect(result.pageCount).toBe(8);
  });

  it('chameleon calibration: strict gate fails; warn mode records warnings only', () => {
    const md = stripGoldenSourceHeader(fs.readFileSync(KOKO_CALIBRATION, 'utf8'));
    const strict = validateStoryForV3Import(md);
    expect(strict.errors.some((e) => e.includes('איתי'))).toBe(true);

    const warn = validateStoryForV3Import(md, { personalizationGate: 'warn' });
    expect(warn.errors).toEqual([]);
    expect(warn.personalizationWarnings.length).toBeGreaterThan(0);
  });

  it('legacy promote-phase1-v3-approved.ts must not exist (non-portable bypass removed)', () => {
    expect(
      fs.existsSync(path.join(process.cwd(), 'scripts/promote-phase1-v3-approved.ts'))
    ).toBe(false);
  });

  it('resolveImportGateModeFromSelfCheck follows staged warnings', () => {
    expect(resolveImportGateModeFromSelfCheck({ gatePassAutomated: true })).toBe('strict');
    expect(
      resolveImportGateModeFromSelfCheck({
        gatePassAutomated: true,
        personalizationGateWarnings: ['personalization gate (girl): leftover'],
      })
    ).toBe('warn');
  });

  it('assertApprovalReadyForImport refuses missing approval and gate-exception without note', () => {
    expect(() => assertApprovalReadyForImport(null, { gatePassAutomated: true })).toThrow(
      /approval.json/
    );
    expect(() =>
      assertApprovalReadyForImport(
        { approvedBy: 'Guy', approvedAt: '2026-07-02T12:00:00+03:00' },
        {
          gatePassAutomated: true,
          personalizationGateWarnings: ['personalization gate (girl): leftover'],
        }
      )
    ).toThrow(/note required/);
    expect(() =>
      assertApprovalReadyForImport(
        {
          approvedBy: 'Guy',
          approvedAt: '2026-07-02T12:00:00+03:00',
          note: 'Guy-approved איתי register',
        },
        {
          gatePassAutomated: true,
          personalizationGateWarnings: ['personalization gate (girl): leftover'],
        }
      )
    ).not.toThrow();
  });

  it('stageGoldenImportRun writes only under runs root (never v3-approved)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sh-v3-stage-'));
    const runsRoot = path.join(tmp, 'runs');
    const repoRoot = process.cwd();

    const result = stageGoldenImportRun({
      repoRoot,
      runsRoot,
      sourceRel: 'story-bank/v5-fixed-v2/fox_uri_bedtime.md',
      runIdOverride: 'test-fox_uri_bedtime',
    });

    expect(result.runDir).toContain(path.join('runs', 'test-fox_uri_bedtime'));
    expect(fs.existsSync(path.join(result.runDir, 'story.md'))).toBe(true);
    expect(fs.existsSync(path.join(result.runDir, 'self-check.json'))).toBe(true);
    expect(fs.existsSync(path.join(result.runDir, 'approval.json'))).toBe(false);
    expect(() => assertNotV3ApprovedWrite(repoRoot, result.runDir)).not.toThrow();
    expect(() =>
      assertNotV3ApprovedWrite(repoRoot, path.join(repoRoot, 'story-bank/v3-approved/x.md'))
    ).toThrow(/refusing to write/);

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('readApprovalJson parses owner-written approval.json', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sh-v3-approval-'));
    const runDir = path.join(tmp, 'run');
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(
      path.join(runDir, 'approval.json'),
      JSON.stringify({
        approvedBy: 'Guy',
        approvedAt: '2026-07-02T12:00:00+03:00',
        note: 'ok',
      }),
      'utf8'
    );
    expect(readApprovalJson(runDir)).toMatchObject({ approvedBy: 'Guy', note: 'ok' });
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('verifyV3BankImportSafeguards passes on repo (Codex stop-time audit)', () => {
    const report = verifyV3BankImportSafeguards(process.cwd());
    for (const check of report.checks) {
      expect(check.pass, `${check.id}: ${check.detail}`).toBe(true);
    }
    expect(report.pass).toBe(true);
  });
});
