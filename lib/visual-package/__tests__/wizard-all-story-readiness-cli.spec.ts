import path from 'path';
import { spawnSync } from 'child_process';

import { describe, expect, it } from 'vitest';

const REPO = process.cwd();
const TSX = path.join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const SHIM = path.join(REPO, 'scripts', 'shims', 'register-server-only.cjs');
const CLI = path.join(
  REPO,
  'scripts',
  'audit-wizard-all-story-readiness.ts',
);

function runReadinessCli(
  args: readonly string[] = [],
  v3Flag: string | undefined = 'true',
) {
  const env = { ...process.env };
  if (v3Flag === undefined) delete env.ENABLE_V3_APPROVED_BANK;
  else env.ENABLE_V3_APPROVED_BANK = v3Flag;
  env.ENABLE_WIZARD_QA_RENDER_CATALOG = 'false';
  env.DATABASE_URL = '';

  return spawnSync(
    process.execPath,
    [TSX, '--require', SHIM, CLI, ...args],
    {
      cwd: REPO,
      encoding: 'utf8',
      env,
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30_000,
    },
  );
}

describe('Wizard all-story readiness actual CLI', () => {
  it('documents the supported foreign-cwd invocation without claiming raw-script portability', () => {
    const result = runReadinessCli(['--help']);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('Run from the repository root.');
    expect(result.stdout).toContain('npm --prefix <repo-root> run');
  });

  it('emits the complete read-only report as JSON by default', () => {
    const result = runReadinessCli();
    expect(result.status, result.stderr).toBe(0);
    const report = JSON.parse(result.stdout) as {
      version: string;
      records: Array<{ storyKey: string }>;
      summary: {
        nominalSlotCount: number;
        renderQualifiedCount: number;
        supportedNarrationAutomatedPreflightReadyCount: number;
      };
      effects: Record<string, unknown>;
    };
    expect(report.version).toBe('wizard-all-story-render-readiness/v1');
    expect(report.summary.nominalSlotCount).toBe(18);
    expect(report.records).toHaveLength(18);
    expect(new Set(report.records.map((record) => record.storyKey)).size).toBe(
      18,
    );
    expect(report.summary.renderQualifiedCount).toBe(1);
    expect(report.effects).toEqual({
      filesWritten: 0,
      directoriesCreated: 0,
      filesDeleted: 0,
      databaseReads: 0,
      databaseWrites: 0,
      storageReads: 0,
      networkCalls: 0,
      providerCalls: 0,
      imagesGenerated: 0,
      audioGenerated: 0,
      ordersCreatedOrModified: 0,
    });
  });

  it.each([
    ['V3 enabled', 'true'],
    ['V3 disabled', undefined],
  ])(
    '--require-all-render-ready exits 1 while the full matrix is not ready (%s)',
    (_label, v3Flag) => {
      const result = runReadinessCli(
        ['--require-all-render-ready'],
        v3Flag,
      );
      expect(result.status, result.stderr).toBe(1);
      expect(() => JSON.parse(result.stdout)).not.toThrow();
    },
  );

  it('fails the all-story narration automated-preflight gate while source authority is incomplete', () => {
    const result = runReadinessCli([
      '--require-all-narration-automated-preflight-ready',
    ]);
    expect(result.status, result.stderr).toBe(1);
    const report = JSON.parse(result.stdout) as {
      summary: {
        nominalSlotCount: number;
        supportedNarrationAutomatedPreflightReadyCount: number;
      };
    };
    expect(
      report.summary.supportedNarrationAutomatedPreflightReadyCount,
    ).toBe(1);
    expect(report.summary.nominalSlotCount).toBe(18);
  });

  it('table output exposes earliest blocker and next canonical action as distinct columns', () => {
    const result = runReadinessCli(['--format', 'table']);
    expect(result.status, result.stderr).toBe(0);
    const lines = result.stdout.split(/\r?\n/);
    const headings = lines[0]!.split(' | ').map((cell) => cell.trim());
    expect(headings.slice(-2)).toEqual([
      'earliestBlocker',
      'nextCanonicalAction',
    ]);
    expect(headings).not.toContain('next');

    const foxRow = lines.find((line) => line.startsWith('fox_uri_bedtime'));
    expect(foxRow).toBeDefined();
    const cells = foxRow!.split(' | ').map((cell) => cell.trim());
    expect(cells.slice(-2)).toEqual([
      'product_source_text_not_ready',
      'restore_or_repair_product_source_text',
    ]);
  });

  it('rejects unknown arguments with usage error exit 2', () => {
    const result = runReadinessCli(['--definitely-unknown']);
    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('unknown argument: --definitely-unknown');
  });
});
