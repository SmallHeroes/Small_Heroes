import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import type { PersonalBookProvider } from '../book-runner';
import { personalBookReservationUsd } from '../book-config';

const deps = vi.hoisted(() => ({ user: { id: 'operator', email: 'operator@example.com' } as { id: string; email: string } | null,
  production: false, sessionFails: false, keyReads: 0, hasKey: true, provider: null as PersonalBookProvider | null, factory: 0 }));
vi.mock('@/lib/auth-session', () => ({ resolveUserFromRequest: async () => {
  if (deps.sessionFails) throw Error('private-session'); return deps.user ? { user: deps.user } : null;
} }));
vi.mock('@/lib/dev-only-guard', () => ({ isDevEnvironment: () => !deps.production }));
vi.mock('@/lib/personal-wizard/intake-config', () => ({ readIntakeApiKey: () => { deps.keyReads++; return deps.hasKey ? 'private-key' : null; } }));
vi.mock('@/lib/personal-wizard/book-openai', () => ({ createPersonalBookProvider: () => { deps.factory++; return deps.provider; } }));
import { GET, POST } from '@/app/api/dev/personal-wizard/book/route';

const env = { PERSONAL_WIZARD_PREVIEW: 'true', PERSONAL_WIZARD_BOOK_RUNNER: 'true', PERSONAL_WIZARD_BOOK_MODEL: 'gpt-6-sol',
  PERSONAL_WIZARD_BOOK_OPERATORS: 'operator@example.com', PERSONAL_WIZARD_BOOK_BUDGET_USD: '5', PERSONAL_WIZARD_BOOK_MAX_JOBS: '2' };
const saved = new Map<string, string | undefined>();
let index = 0;
const url = 'http://127.0.0.1:3461/api/dev/personal-wizard/book';
const req = (body: unknown, override: Record<string, string> = {}, signal?: AbortSignal, target = url) => new NextRequest(target, {
  method: 'POST', signal, headers: { host: new URL(target).host, origin: new URL(target).origin, 'content-type': 'application/json',
    'x-forwarded-for': `10.98.0.${++index}`, ...override }, body: JSON.stringify(body),
});
let fixture: Awaited<ReturnType<typeof personalStoryboardFixture>>;
const job = (jobId = 'b_routejob0000001') => ({ jobId, request: fixture.request });
const attempts = () => vi.mocked(deps.provider!.story.generate).mock.calls.length + vi.mocked(deps.provider!.visual.generate).mock.calls.length;
beforeEach(async () => {
  Object.entries(env).forEach(([key, value]) => { saved.set(key, process.env[key]); process.env[key] = value; });
  deps.user = { id: 'operator', email: 'operator@example.com' }; deps.production = false; deps.sessionFails = false;
  deps.keyReads = 0; deps.factory = 0; deps.hasKey = true;
  delete (globalThis as typeof globalThis & { __personalBookPilotLedger?: unknown }).__personalBookPilotLedger;
  fixture = await personalStoryboardFixture();
  deps.provider = { story: { generate: vi.fn(async call => ({ output: structuredClone(call.stage === 'plan' ? fixture.result.plan : fixture.result.manuscript), usage: { inputTokens: 100, outputTokens: 200 } })) },
    visual: { generate: vi.fn(async call => ({ output: structuredClone(call.stage === 'storyboard' ? fixture.draft : fixture.review), usage: { inputTokens: 300, outputTokens: 400 } })) } };
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); for (const [key, value] of saved) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });

describe('real local diagnostic book route', () => {
  it('executes all four stages and returns same-context packets without render authority', async () => {
    const response = await POST(req(job())); const body = await response.json();
    expect(response.status).toBe(200); expect(attempts()).toBe(4); expect(deps.keyReads).toBe(1); expect(deps.factory).toBe(1);
    expect(body.status).toBe('review_supported'); expect(body.runtimeEligible).toBe(false); expect(body.framePackets).toHaveLength(9);
    expect(body.writerResult.manuscript.pages).toHaveLength(8); expect(body.accounting.providerAttempts).toBe(4);
    expect(body.framePackets[1].render.contextSha).toBe(body.framePackets[1].qa.contextSha);
    expect(response.headers.get('cache-control')).toBe('no-store'); expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(JSON.stringify(body)).not.toContain('private-key');
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toMatch(/נועה|אודם|private-key|wooden hut/);
  });
  it.each(['production', 'disabled', 'preview_off', 'unpriced', 'budget', 'no_session', 'wrong_operator', 'session_failure', 'remote', 'host', 'origin', 'missing_origin'])('blocks %s before key/provider', async mode => {
    if (mode === 'production') deps.production = true;
    if (mode === 'disabled') delete process.env.PERSONAL_WIZARD_BOOK_RUNNER;
    if (mode === 'preview_off') delete process.env.PERSONAL_WIZARD_PREVIEW;
    if (mode === 'unpriced') process.env.PERSONAL_WIZARD_BOOK_MODEL = 'unknown';
    if (mode === 'budget') process.env.PERSONAL_WIZARD_BOOK_BUDGET_USD = '11';
    if (mode === 'no_session') deps.user = null;
    if (mode === 'wrong_operator') deps.user = { id: 'other', email: 'other@example.com' };
    if (mode === 'session_failure') deps.sessionFails = true;
    const headers: Record<string, string> = mode === 'host' ? { host: 'foreign.example.com' } : mode === 'origin' ? { origin: 'https://foreign.example.com' } : mode === 'missing_origin' ? { origin: '' } : {};
    const response = await POST(req(job(), headers, undefined, mode === 'remote' ? 'https://qa.example.com/api/dev/personal-wizard/book' : url));
    expect(response.status).toBeGreaterThanOrEqual(400); expect(deps.keyReads).toBe(0); expect(deps.factory).toBe(0); expect(attempts()).toBe(0);
    expect(JSON.stringify(await response.json())).not.toContain('private-session');
  });
  it.each(['unknown_field', 'removed_length', 'missing_interest', 'unknown_companion', 'envelope', 'oversize', 'jobId', 'type'])('blocks invalid %s before key', async mode => {
    const input = structuredClone(job());
    if (mode === 'unknown_field') Object.assign(input.request, { apiKey: 'SENTINEL' });
    if (mode === 'removed_length') input.request.bookOptions.lengthId = 'retired';
    if (mode === 'missing_interest') input.request.facts = [];
    if (mode === 'unknown_companion') input.request.companion.id = 'foreign';
    if (mode === 'envelope') Object.assign(input, { extra: true });
    if (mode === 'oversize') Object.assign(input, { extra: 'x'.repeat(33000) });
    if (mode === 'jobId') input.jobId = 'invalid';
    const response = await POST(req(input, mode === 'type' ? { 'content-type': 'text/plain' } : {}));
    expect(response.status).toBeGreaterThanOrEqual(400); expect(deps.keyReads).toBe(0); expect(attempts()).toBe(0);
  });
  it('rejects malformed JSON before key', async () => {
    const response = await POST(new NextRequest(url, { method: 'POST', headers: { host: '127.0.0.1:3461', origin: 'http://127.0.0.1:3461', 'content-type': 'application/json', 'x-forwarded-for': `10.98.0.${++index}` }, body: '{' }));
    expect(response.status).toBe(400); expect(deps.keyReads).toBe(0);
  });
  it('checks reservation, duplicate and job cap before additional key reads', async () => {
    process.env.PERSONAL_WIZARD_BOOK_BUDGET_USD = String(personalBookReservationUsd('gpt-6-sol') - .001);
    expect((await POST(req(job()))).status).toBe(409); expect(deps.keyReads).toBe(0);
    process.env.PERSONAL_WIZARD_BOOK_BUDGET_USD = '5';
    expect((await POST(req(job()))).status).toBe(200);
    expect((await POST(req(job()))).status).toBe(409);
    expect((await POST(req(job('b_routejob0000002')))).status).toBe(200);
    expect((await POST(req(job('b_routejob0000003')))).status).toBe(409);
    expect(deps.keyReads).toBe(2); expect(attempts()).toBe(8);
  });
  it('retains a failed paid reservation and does not leak provider messages', async () => {
    vi.mocked(deps.provider!.story.generate).mockRejectedValueOnce(Object.assign(Error('private-provider'), { providerUsage: { inputTokens: 100, outputTokens: 200 } }));
    const response = await POST(req(job())); const body = await response.json();
    expect(response.status).toBe(502); expect(body.accounting.providerAttempts).toBe(1); expect(body.accounting.estimatedUsd).toBeCloseTo(.0022);
    expect(JSON.stringify(body)).not.toContain('private-provider');
    expect((await POST(req(job()))).status).toBe(409); expect(deps.keyReads).toBe(1);
  });
  it('returns held diagnostic data with no packets, no fifth call', async () => {
    fixture.review.bookChecks[0].verdict = 'uncertain' as 'supported';
    const response = await POST(req(job())); const body = await response.json();
    expect(response.status).toBe(200); expect(body.status).toBe('held_uncertain'); expect(body.framePackets).toEqual([]); expect(attempts()).toBe(4);
  });
  it('pre-cancelled request never reads a key', async () => {
    const controller = new AbortController(); controller.abort(); const response = await POST(req(job(), {}, controller.signal));
    expect(response.status).toBe(408); expect(deps.keyReads).toBe(0); expect(attempts()).toBe(0);
  });
  it('missing credential returns unavailable, releases lock and consumes the failed job', async () => {
    deps.hasKey = false; const response = await POST(req(job())); const body = await response.json();
    expect(response.status).toBe(503); expect(body.accounting.providerAttempts).toBe(0); expect(body.accounting.estimatedUsd).toBe(0);
    expect(deps.factory).toBe(0); expect((await POST(req(job()))).status).toBe(409); expect(deps.keyReads).toBe(1);
  });
  it('GET is an operator configuration check, not key/provider availability attestation', async () => {
    const response = await GET(new NextRequest(url)); const body = await response.json();
    expect(body.liveAvailabilityUnverified).toBe(true); expect(body.maxProviderAttempts).toBe(4); expect(body.runtimeEligible).toBe(false); expect(deps.keyReads).toBe(0);
    deps.user = null; expect((await GET(new NextRequest(url))).status).toBe(401);
  });
});
