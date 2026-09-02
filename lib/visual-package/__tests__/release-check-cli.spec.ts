import path from 'path';
import { spawnSync } from 'child_process';

import { describe, expect, it } from 'vitest';

const REPO = process.cwd();
const TSX = path.join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const SHIM = path.join(REPO, 'scripts', 'shims', 'register-server-only.cjs');
const RELEASE_CHECK = path.join(REPO, 'scripts', 'release-check.ts');

function runReleaseCheck(
  args: readonly string[] = [],
  v3Flag = 'true',
) {
  return spawnSync(
    process.execPath,
    [TSX, '--require', SHIM, RELEASE_CHECK, ...args],
    {
      cwd: REPO,
      encoding: 'utf8',
      env: {
        ...process.env,
        ENABLE_V3_APPROVED_BANK: v3Flag,
        ENABLE_WIZARD_QA_RENDER_CATALOG: 'false',
        SKIP_DB_SCHEMA_CHECK: 'true',
        DATABASE_URL: '',
      },
    },
  );
}

describe('release-check render qualification mode (actual CLI)', () => {
  it('ordinary mode stays compatible and explicitly disclaims render readiness', () => {
    const result = runReleaseCheck();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('render-qualified slots: 1/18');
    expect(result.stdout).toContain('not a render-readiness claim');
  });

  it('explicit strict mode still exits non-zero while 17 catalog slots remain unqualified', () => {
    const result = runReleaseCheck(['--require-render-qualified']);
    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      'strict render qualification was explicitly required',
    );
  });

  it('explicit all-nominal mode exits non-zero with its distinct release claim', () => {
    const result = runReleaseCheck(['--require-all-render-ready']);
    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      'all nominal Wizard slots were explicitly required to be render-ready',
    );
  });

  it.each(['1', 'TRUE', ' true '])(
    'rejects ENABLE_V3_APPROVED_BANK=%j because runtime accepts only raw exact true',
    (v3Flag) => {
      const result = runReleaseCheck([], v3Flag);
      expect(result.status).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).toContain(
        'Set ENABLE_V3_APPROVED_BANK=true',
      );
    },
  );
});
