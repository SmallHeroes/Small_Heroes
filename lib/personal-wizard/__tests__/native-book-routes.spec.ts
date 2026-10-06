import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as frozen from '../../../scripts/personal-story-frozen-engine';
import * as journal from '../../../scripts/personal-causal-trial-journal';
import * as adapters from '../../../scripts/personal-causal-trial-adapters';
import { GET, POST } from '@/app/api/dev/personal-wizard/native-book/route';
import { causalTrialCohort } from '../../../scripts/personal-causal-cohort';
import { preparePersonalStory } from '../story-writer';
import { resolvePersonalWizardOptions } from '../options';
import { nativeQueueDirectory, type NativeBridgeConfig } from '../native-book-bridge';

const deps = vi.hoisted(() => ({ production: false, sessionError: false,
  user: { id: 'owner', email: 'owner@example.com' } as { id: string; email: string } | null }));
vi.mock('@/lib/auth-session', () => ({ resolveUserFromRequest: async () => {
  if (deps.sessionError) throw Error('private database detail'); return deps.user ? { user: deps.user } : null;
} }));
vi.mock('@/lib/dev-only-guard', () => ({ isDevEnvironment: () => !deps.production }));
let root: string, config: NativeBridgeConfig, file: string, input: any, ip = 0;
const base = 'http://127.0.0.1:3447';
const req = (method: 'GET' | 'POST', body?: unknown, opts: { url?: string; origin?: string; host?: string } = {}) =>
  new NextRequest(opts.url ?? `${base}/api/dev/personal-wizard/native-book`, { method,
    headers: { host: opts.host ?? '127.0.0.1:3447', origin: opts.origin ?? base, 'content-type': 'application/json', 'x-forwarded-for': `198.51.100.${++ip}` },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) });
beforeEach(() => {
  deps.production = deps.sessionError = false; deps.user = { id: 'owner', email: 'owner@example.com' };
  root = mkdtempSync(path.join(tmpdir(), 'native-book-route-')); const common = path.join(root, 'common'); mkdirSync(common);
  config = { version: 'local-native-wizard-config/v1', workspace: process.cwd(), outputParent: root, existingKeyEnvFile: path.join(root, 'ABSENT.env'),
    policy: { version: 'personal-single-book-calibration/v2', reviewMode: 'benchmark', synopsisRepair: true, draftCritique: true,
      sourceHead: 'a'.repeat(40), executable: path.join(root, 'ABSENT.exe'), executableSha256: 'b'.repeat(64), mode: 'live_explicit',
      approval: { reference: 'SYNTHETIC route test allowance, not actual consent.', maximumMicroUsd: 12000000, acknowledgesCliEstimateLimits: true },
      standardConfiguration: { attested: true, reference: 'SYNTHETIC test configuration only.' },
      pricing: { source: 'SYNTHETIC test rates, not current price evidence.', checkedAt: new Date().toISOString(),
        rates: { opus: { inputMicroUsdPerToken: 8, outputMicroUsdPerToken: 20 }, astra: { inputMicroUsdPerToken: 12.5, outputMicroUsdPerToken: 50 } } } } };
  file = path.join(root, 'config.json'); writeFileSync(file, JSON.stringify(config));
  vi.spyOn(frozen, 'gitAt').mockImplementation((_repo, argv) => {
    if (argv.join(' ') === 'rev-parse HEAD') return Buffer.from('a'.repeat(40));
    if (argv.join(' ') === 'status --porcelain') return Buffer.from('');
    if (argv.join(' ') === 'rev-parse --path-format=absolute --git-common-dir') return Buffer.from(common);
    throw Error('unexpected test Git invocation');
  });
  vi.stubEnv('PERSONAL_WIZARD_PREVIEW', 'true'); vi.stubEnv('PERSONAL_WIZARD_NATIVE_BOOK_RUNNER', 'true');
  vi.stubEnv('PERSONAL_WIZARD_NATIVE_BOOK_CONFIG', file); vi.stubEnv('PERSONAL_WIZARD_NATIVE_BOOK_OPERATORS', 'owner@example.com');
  const request = causalTrialCohort()[0].request;
  input = { request, requestId: preparePersonalStory(request, resolvePersonalWizardOptions()).accepted.requestId,
    consent: 'reviewed_text_to_opus_and_astra' };
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); rmSync(root, { recursive: true, force: true }); });
describe('actual native wizard API boundaries; no provider/key access', () => {
  it('queues only reviewed structured text, exposes no local paths, and never invokes a provider', async () => {
    const astra = vi.spyOn(adapters, 'createAstraCausalTransport'), opus = vi.spyOn(adapters, 'createOpusCausalTransport');
    const quoted = await GET(req('GET')); expect(quoted.status).toBe(200);
    const response = await POST(req('POST', input)); const body = await response.json();
    expect(response.status).toBe(202); expect(body).toMatchObject({ requestId: input.requestId, phase: 'queued', runtimeEligible: false });
    expect(JSON.stringify(body)).not.toContain(root); expect(JSON.stringify(await quoted.json())).not.toContain(root);
    expect(response.headers.get('cache-control')).toBe('no-store'); expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(astra).not.toHaveBeenCalled(); expect(opus).not.toHaveBeenCalled();
    expect((await POST(req('POST', input))).status).toBe(202);
    expect((await GET(req('GET', undefined, { url: `${base}/api/dev/personal-wizard/native-book?requestId=${input.requestId}` }))).status).toBe(200);
  });
  it.each(['production', 'disabled', 'anonymous', 'other_operator', 'session_error', 'remote_host', 'forged_host', 'foreign_origin'])('rejects %s before disk configuration/queue', async kind => {
    if (kind === 'production') deps.production = true;
    if (kind === 'disabled') vi.stubEnv('PERSONAL_WIZARD_NATIVE_BOOK_RUNNER', 'false');
    if (kind === 'anonymous') deps.user = null;
    if (kind === 'other_operator') deps.user = { id: 'outsider', email: 'outsider@example.com' };
    if (kind === 'session_error') deps.sessionError = true;
    const disk = vi.spyOn(journal, 'fencedText');
    const response = await POST(req('POST', input, kind === 'remote_host' ? { url: 'https://qa.smallheroes.co.il/api/dev/personal-wizard/native-book' }
      : kind === 'forged_host' ? { host: 'attacker.invalid' } : kind === 'foreign_origin' ? { origin: 'https://attacker.invalid' } : {}));
    expect(response.status).toBeGreaterThanOrEqual(400); expect(disk).not.toHaveBeenCalled();
    expect(existsSync(nativeQueueDirectory(config))).toBe(false);
    expect(JSON.stringify(await response.json())).not.toContain('private database detail');
  });
  it.each(['policy', 'key', 'model', 'configFile', 'runtimeEligible'])('browser cannot supply %s', async field => {
    expect((await POST(req('POST', { ...input, [field]: 'injected' }))).status).toBe(422);
    expect(existsSync(nativeQueueDirectory(config))).toBe(false);
  });
  it('requires explicit text consent and the exact server-derived request identity', async () => {
    expect((await POST(req('POST', { ...input, consent: false }))).status).toBe(422);
    expect((await POST(req('POST', { ...input, requestId: 'b'.repeat(64) }))).status).toBe(422);
    expect(existsSync(nativeQueueDirectory(config))).toBe(false);
  });
  it('refuses unsupported longer books instead of spending under a short-book cap', async () => {
    const request = structuredClone(input.request); request.bookOptions.lengthId = 'medium';
    const requestId = preparePersonalStory(request, resolvePersonalWizardOptions()).accepted.requestId;
    expect((await POST(req('POST', { ...input, request, requestId }))).status).toBe(422);
    expect(existsSync(nativeQueueDirectory(config))).toBe(false);
  });
  it('owner isolation and changed content conflict, including after refresh', async () => {
    expect((await POST(req('POST', input))).status).toBe(202);
    deps.user = { id: 'second-owner', email: 'owner@example.com' };
    const url = `${base}/api/dev/personal-wizard/native-book?requestId=${input.requestId}`;
    expect((await GET(req('GET', undefined, { url }))).status).toBe(403);
    expect((await POST(req('POST', input))).status).toBe(409);
    deps.user = { id: 'owner', email: 'owner@example.com' };
    const request = structuredClone(input.request); request.child.name = 'אחר';
    const requestId = preparePersonalStory(request, resolvePersonalWizardOptions()).accepted.requestId;
    expect((await POST(req('POST', { ...input, request, requestId }))).status).toBe(409);
  });
  it('rejects malformed or duplicate GET identifiers without displaying another request', async () => {
    for (const query of ['../config.json', 'bad', `${input.requestId}&requestId=${input.requestId}`]) {
      expect((await GET(req('GET', undefined, { url: `${base}/api/dev/personal-wizard/native-book?requestId=${query}` }))).status).toBe(422);
    }
  });
});
