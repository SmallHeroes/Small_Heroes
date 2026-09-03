import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const REPO = process.cwd();
const TSX = path.join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const SHIM = path.join(REPO, 'scripts', 'shims', 'register-server-only.cjs');
const CLI = path.join(REPO, 'scripts', 'audit-render-qualification.ts');

function runAudit(args: readonly string[], v3Enabled: boolean) {
  return spawnSync(
    process.execPath,
    [TSX, '--require', SHIM, CLI, ...args],
    {
      cwd: REPO,
      encoding: 'utf8',
      env: {
        ...process.env,
        ENABLE_V3_APPROVED_BANK: v3Enabled ? 'true' : 'false',
        ENABLE_WIZARD_QA_RENDER_CATALOG: 'false',
      },
    },
  );
}

describe('render-qualification audit actual CLI', () => {
  it('preserves the legacy sellable-only strict scope when V3 fallback is disabled', () => {
    const result = runAudit(['--require-render-qualified'], false);
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      nominalSlotCount: 18,
      productSellableCount: 1,
      renderQualifiedCount: 1,
    });
  });

  it('fails the new all-nominal scope even when rejected slots are no longer sellable', () => {
    const result = runAudit(['--require-all-render-ready'], false);
    expect(result.status, result.stderr).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      nominalSlotCount: 18,
      productSellableCount: 1,
      renderQualifiedCount: 1,
    });
  });

  it('fails both strict scopes with 17 sellable products and 17 unqualified nominal slots', () => {
    const sellableOnly = runAudit(['--require-render-qualified'], true);
    const allNominal = runAudit(['--require-all-render-ready'], true);
    expect(sellableOnly.status, sellableOnly.stderr).toBe(1);
    expect(allNominal.status, allNominal.stderr).toBe(1);
    expect(JSON.parse(allNominal.stdout)).toMatchObject({
      nominalSlotCount: 18,
      productSellableCount: 17,
      renderQualifiedCount: 1,
    });
  });
});
