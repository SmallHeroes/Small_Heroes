import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = process.cwd();
const TSX_CLI = path.join(
  REPO_ROOT,
  'node_modules',
  'tsx',
  'dist',
  'cli.mjs',
);
const SERVER_ONLY_SHIM = path.join(
  REPO_ROOT,
  'scripts',
  'shims',
  'register-server-only.cjs',
);
const EXTERNAL_BOUNDARY_SENTINEL = path.join(
  REPO_ROOT,
  'lib',
  'visual-package',
  '__tests__',
  'fixtures',
  'deny-live-request-materialization-external-boundaries.cjs',
);
const HARNESS = path.join(
  REPO_ROOT,
  'lib',
  'visual-package',
  '__tests__',
  'fixtures',
  'run-blueprint-authoring-production-scale-f1-harness.ts',
);

describe('production-scale Blueprint F1 offline harness', () => {
  it('proves decreasing nonzero exhaustion across both repairs without claiming model convergence', () => {
    const child = spawnSync(
      process.execPath,
      [
        TSX_CLI,
        '--require',
        SERVER_ONLY_SHIM,
        '--require',
        EXTERNAL_BOUNDARY_SENTINEL,
        HARNESS,
      ],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        timeout: 120_000,
        env: {
          ...process.env,
          OPENAI_API_KEY: 'offline-harness-must-never-read-this-value',
        },
      },
    );

    expect(child.status, child.stderr || child.stdout).toBe(0);
    expect(child.stderr).toBe('');
    expect(JSON.parse(child.stdout)).toMatchObject({
      packageRevision:
        '2b488f2db44702106f49ad80c257b88269972ffb8ebbc92cced95f81c13d98a6',
      contextDigest:
        '0cc212ea805e53395d9757c04b436ac55527aecc2f434c5a35c5c91dbee80d0c',
      pageCount: 8,
      firstDraftDiagnostics: 86,
      diagnosticTrajectory: [86, 7, 6],
      repairEstimatedBytes: 77_995,
      exactRepairInputTokens: [50_000, null],
      countCalls: 1,
      generationCalls: 3,
      generationBudget: { maxCalls: 3, maxRepairCount: 2 },
      hardCostCeilingVerified: true,
      status: 'failed',
      receiptVersion: 'production-blueprint-authoring-receipt/v8',
      captureVersion: 'blueprint-authoring-sanitized-failure-capture/v4',
    });
  });
});
