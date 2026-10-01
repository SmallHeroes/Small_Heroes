import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { main, trialFailureDiagnostic } from '../../../scripts/personal-story-editor-trial';
afterEach(() => vi.restoreAllMocks());
describe('synthetic story trial is one-shot and dry by default', () => {
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
    expect(result.reservedUsd).toBeCloseTo(2.838, 10);
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
