import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { isLocalUiOnlyBootstrap } from '../local-preview-bootstrap';

const probes = vi.hoisted(() => ({ validate: vi.fn(), authLoads: 0, envLoads: 0 }));
vi.mock('../env', () => { probes.envLoads++; return { validateEnv: probes.validate }; });
vi.mock('../auth-session', () => { probes.authLoads++; throw Error('AUTH_MODULE_MUST_STAY_LAZY'); });
const local = { NODE_ENV: 'development', PERSONAL_WIZARD_PREVIEW: 'true', PERSONAL_WIZARD_LOCAL_UI_ONLY: 'true',
  APP_URL: 'http://127.0.0.1:3481', NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3481' };

describe('explicit local UI bootstrap and unchanged service authority', () => {
  beforeEach(() => { probes.validate.mockReset(); probes.authLoads = 0; probes.envLoads = 0; });
  afterEach(() => vi.unstubAllEnvs());
  it('accepts only an explicitly enabled development loopback preview', () => {
    expect(isLocalUiOnlyBootstrap(local)).toBe(true);
    for (const host of ['localhost', '127.0.0.1', '[::1]']) expect(isLocalUiOnlyBootstrap({ ...local, APP_URL: `http://${host}:3481`, NEXT_PUBLIC_APP_URL: `http://${host}:3481` })).toBe(true);
  });
  it.each([
    ['default flags', {}], ['no explicit mode', { ...local, PERSONAL_WIZARD_LOCAL_UI_ONLY: undefined }],
    ['preview off', { ...local, PERSONAL_WIZARD_PREVIEW: 'false' }], ['production', { ...local, NODE_ENV: 'production' }],
    ['test', { ...local, NODE_ENV: 'test' }], ['cloud marker', { ...local, VERCEL: '1' }],
    ['production marker', { ...local, VERCEL_ENV: 'production' }], ['preview marker', { ...local, VERCEL_ENV: 'preview' }],
    ['development cloud marker', { ...local, VERCEL_ENV: 'development' }], ['cloud URL', { ...local, VERCEL_URL: 'preview.example' }],
    ['cloud project', { ...local, VERCEL_PROJECT_ID: 'prj_fake' }], ['live intake', { ...local, PERSONAL_WIZARD_LIVE_INTAKE: 'true' }],
    ['native worker', { ...local, PERSONAL_WIZARD_NATIVE_BOOK_RUNNER: 'true' }], ['simple worker', { ...local, PERSONAL_WIZARD_SIMPLE_BOOK_RUNNER: 'true' }],
    ['no origin', { ...local, APP_URL: undefined, NEXT_PUBLIC_APP_URL: undefined }], ['remote origin', { ...local, APP_URL: 'https://example.com' }],
    ['spoofed loopback', { ...local, APP_URL: 'http://localhost.evil.example:3481' }], ['URL credentials', { ...local, APP_URL: 'http://user@127.0.0.1:3481' }],
    ['invalid URL', { ...local, APP_URL: 'invalid' }], ['path', { ...local, APP_URL: 'http://127.0.0.1:3481/path' }],
    ['query', { ...local, APP_URL: 'http://127.0.0.1:3481/?x=1' }], ['different origins', { ...local, APP_URL: 'http://localhost:3481' }],
  ])('keeps strict startup for %s', (_name, env) => { expect(isLocalUiOnlyBootstrap(env)).toBe(false); });
  it('actual register avoids global service loading only in the approved local mode; default/cloud still validate and propagate errors', async () => {
    const { register } = await import('../../instrumentation');
    for (const [k, v] of Object.entries(local)) vi.stubEnv(k, v);
    for (const k of ['VERCEL', 'VERCEL_ENV', 'VERCEL_URL', 'VERCEL_PROJECT_ID', 'PERSONAL_WIZARD_LIVE_INTAKE', 'PERSONAL_WIZARD_NATIVE_BOOK_RUNNER', 'PERSONAL_WIZARD_SIMPLE_BOOK_RUNNER']) vi.stubEnv(k, undefined);
    probes.validate.mockImplementation(() => { throw Error('normal_strict_environment_validation'); });
    await register(); expect(probes.validate).not.toHaveBeenCalled(); expect(probes.envLoads).toBe(0);
    vi.stubEnv('PERSONAL_WIZARD_LOCAL_UI_ONLY', 'false'); await expect(register()).rejects.toThrow('normal_strict_environment_validation');
    vi.stubEnv('PERSONAL_WIZARD_LOCAL_UI_ONLY', 'true'); vi.stubEnv('VERCEL_ENV', 'production');
    await expect(register()).rejects.toThrow('normal_strict_environment_validation'); expect(probes.validate).toHaveBeenCalledTimes(2);
  });
  it('actual disabled intake status/gate do not import auth or request a credential; enabling it still invokes the real session boundary', async () => {
    const { liveIntakeStatus, gateLiveIntake } = await import('../personal-wizard/intake-gate');
    const req = new NextRequest('http://127.0.0.1:3481/api/dev/personal-wizard/intake/status');
    const off = { PERSONAL_WIZARD_PREVIEW: 'true', PERSONAL_WIZARD_LIVE_INTAKE: 'false' };
    expect(await liveIntakeStatus(req, undefined, off)).toEqual({ live: false, reason: 'live_flag_off' });
    const denied = await gateLiveIntake(req, undefined, off); expect(denied.ok).toBe(false); expect(probes.authLoads).toBe(0);
    const on = { ...off, PERSONAL_WIZARD_LIVE_INTAKE: 'true', PERSONAL_WIZARD_INTAKE_OPERATORS: 'operator@example.test',
      PERSONAL_WIZARD_TRANSCRIBE_MODEL: 'gpt-transcribe', PERSONAL_WIZARD_EXTRACT_MODEL: 'gpt-6-luna', PERSONAL_WIZARD_INTAKE_BUDGET_USD: '1', PERSONAL_WIZARD_INTAKE_MAX_JOBS: '1' };
    expect(await liveIntakeStatus(req, undefined, on)).toEqual({ live: false, reason: 'session_unavailable' }); expect(probes.authLoads).toBe(1);
  });
  it('importing the real service environment still rejects missing credentials even in local UI mode', async () => {
    for (const [k, v] of Object.entries(local)) vi.stubEnv(k, v);
    for (const k of ['DATABASE_URL', 'GENERATION_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'REPLICATE_API_TOKEN', 'NEXT_PHASE', 'VERCEL_ENV']) vi.stubEnv(k, undefined);
    await expect(vi.importActual('../env')).rejects.toThrow('DATABASE_URL is required');
  });
});
