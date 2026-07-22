import path from 'path';
import { spawnSync } from 'child_process';

import { describe, expect, it } from 'vitest';

const REPO = process.cwd();
const TSX = path.join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const SHIM = path.join(REPO, 'scripts', 'shims', 'register-server-only.cjs');
const RELEASE_CHECK = path.join(REPO, 'scripts', 'release-check.ts');

function runReleaseCheck(strict: boolean) {
  return spawnSync(
    process.execPath,
    [TSX, '--require', SHIM, RELEASE_CHECK, ...(strict ? ['--require-render-qualified'] : [])],
    {
      cwd: REPO,
      encoding: 'utf8',
      env: {
        ...process.env,
        ENABLE_V3_APPROVED_BANK: 'true',
        SKIP_DB_SCHEMA_CHECK: 'true',
        DATABASE_URL: '',
      },
    },
  );
}

describe('release-check render qualification mode (actual CLI)', () => {
  it('ordinary mode stays compatible and explicitly disclaims render readiness', () => {
    const result = runReleaseCheck(false);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('render-qualified slots: 0/18');
    expect(result.stdout).toContain('not a render-readiness claim');
  });

  it('explicit strict mode exits non-zero on the same zero-qualified catalog', () => {
    const result = runReleaseCheck(true);
    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      'strict render qualification was explicitly required',
    );
  });
});
