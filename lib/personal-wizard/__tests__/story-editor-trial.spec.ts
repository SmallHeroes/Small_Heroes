import { afterEach, describe, expect, it, vi } from 'vitest';
import fs, { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { main, trialFailureDiagnostic } from '../../../scripts/personal-story-editor-trial';
const sdk = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('openai', () => ({ default: class { responses = { create: sdk.create }; } }));
const tempRoots: string[] = [];
afterEach(() => {
  vi.restoreAllMocks(); sdk.create.mockReset();
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function isolatedTrial(claimed = false) {
  const temporary = mkdtempSync(path.join(tmpdir(), 'personal-editor-spec-')); tempRoots.push(temporary);
  const outputs = path.join(temporary, 'outputs'); mkdirSync(outputs);
  const root = path.join(outputs, 'personal-story-editor-trial-20261001'); if (claimed) mkdirSync(root);
  const keyFile = path.join(temporary, 'fake-key.env');
  writeFileSync(keyFile, 'OPENAI_API_KEY=FAKE_SPEC_KEY_NEVER_SENT\n', { flag: 'wx' });
  const resolve = path.resolve.bind(path);
  vi.spyOn(path, 'resolve').mockImplementation((...parts) => parts.length === 1 && parts[0] === 'outputs' ? outputs : resolve(...parts));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  return { root, keyFile };
}
describe('synthetic story trial is one-shot and dry by default', () => {
  it('refuses a claimed root before reading even a nonexistent key path or invoking a provider', async () => {
    const f = isolatedTrial(true); const reads = vi.spyOn(fs, 'readFileSync');
    const keyFile = f.keyFile + '.missing';
    await expect(main(['--execute', '--env-file', keyFile])).rejects.toThrow('trial_already_claimed');
    expect(reads.mock.calls.some(([file]) => String(file) === keyFile)).toBe(false);
    expect(sdk.create).not.toHaveBeenCalled();
  });
  it.each(['providerUsage', 'status', 'message', 'code'] as const)('records failed/unknown despite a throwing %s accessor in a provider error', async getter => {
    const f = isolatedTrial();
    sdk.create.mockRejectedValue({ get [getter]() { throw Error('PRIVATE_GETTER_SENTINEL'); } });
    await expect(main(['--execute', '--env-file', f.keyFile])).rejects.toThrow('story_provider_failed');
    const raw = readFileSync(path.join(f.root, 'accounting.json'), 'utf8'); const ledger = JSON.parse(raw);
    expect(ledger.providerAttempts).toBe(1); expect(ledger.estimatedUsd).toBeNull();
    expect(ledger.rows).toEqual([{ stage: '1/plan', usage: null, status: 'failed', failure: { kind: 'unknown' } }]);
    expect(raw).not.toMatch(/PRIVATE_GETTER_SENTINEL|FAKE_SPEC_KEY_NEVER_SENT/);
    expect(sdk.create).toHaveBeenCalledTimes(1);
  });
  it.each([400, 401, 429, 500])('retains only reported HTTP status %i, not private error contents', status => {
    const result = trialFailureDiagnostic({ status, message: 'SECRET_MESSAGE', body: { key: 'SECRET_KEY' } });
    expect(result).toEqual({ kind: 'reported_http_status', status }); expect(JSON.stringify(result)).not.toContain('SECRET');
  });
  it('records allowlisted adapter codes or deadline without accepting arbitrary strings', () => {
    expect(trialFailureDiagnostic({ code: 'story_provider_schema', message: 'SECRET' })).toEqual({ kind: 'reported_adapter_code', code: 'story_provider_schema' });
    expect(trialFailureDiagnostic(Error('trial_deadline'))).toEqual({ kind: 'deadline_or_cancel' });
    expect(trialFailureDiagnostic({ code: 'SECRET', status: 42, message: 'SECRET' })).toEqual({ kind: 'unknown' });
    expect(trialFailureDiagnostic({ get code() { throw Error('SECRET'); } })).toEqual({ kind: 'unknown' });
  });
  it('plans all three lengths and comparison within $3, with no writes or key read', async () => {
    const before = existsSync('outputs/personal-story-editor-trial-20261001');
    const output = vi.spyOn(console, 'log').mockImplementation(() => {}); await main([]);
    const result = JSON.parse(output.mock.calls[0][0]);
    expect(result).toMatchObject({ dryRun: true, model: 'gpt-6.1-sol', reasoning: 'medium', syntheticOnly: true,
      spreads: [8, 12, 16], providerAttempts: 0, keyReads: 0, writes: 0, maxProviderAttempts: 10, budgetUsd: 3 });
    // Current dry policy changed; historical claimed-root accounting remains untouched.
    expect(result.reservedUsd).toBeCloseTo(2.97, 10);
    expect(existsSync('outputs/personal-story-editor-trial-20261001')).toBe(before);
  });
  it.each([{ argv: ['--execute'] }, { argv: ['--output', '../other-root'] }, { argv: ['--execute', '--key', 'SENTINEL'] }])('refuses ambiguous command $argv before any key read', async ({ argv }) => {
    await expect(main(argv)).rejects.toThrow('trial_arguments');
  });
  it('actual CLI defaults to dry-run and exposes no inherited secret', () => {
    const answer = spawnSync(process.execPath, [require.resolve('tsx/cli'), '--require', './scripts/shims/register-server-only.cjs', 'scripts/personal-story-editor-trial.ts'], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 20_000, env: { ...process.env, OPENAI_API_KEY: 'PRIVATE_TRIAL_SENTINEL' }, windowsHide: true,
    });
    expect(answer.status).toBe(0); expect(answer.stderr).not.toContain('PRIVATE_TRIAL_SENTINEL');
    expect(JSON.parse(answer.stdout)).toMatchObject({ dryRun: true, providerAttempts: 0, keyReads: 0, writes: 0 });
    expect(answer.stdout).not.toContain('PRIVATE_TRIAL_SENTINEL');
  }, 25_000);
});
