import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const deps = vi.hoisted(() => ({ user: { id: 'operator', email: 'operator@example.com' } as { id: string; email: string } | null, production: false, calls: 0, keyReads: 0, mode: 'ok', factory: 0 }));
vi.mock('@/lib/auth-session', () => ({ resolveUserFromRequest: async () => deps.user ? { user: deps.user } : null }));
vi.mock('@/lib/dev-only-guard', () => ({ isDevEnvironment: () => !deps.production }));
vi.mock('@/lib/personal-wizard/intake-config', () => ({ readIntakeApiKey: () => { deps.keyReads += 1; return 'test-sentinel-not-real'; } }));
vi.mock('@/lib/personal-wizard/story-openai', () => ({ createPersonalStoryProvider: () => {
  deps.factory += 1;
  return { generate: async (call: { stage: string; input: string }) => {
    deps.calls += 1;
    if (deps.mode === 'fail') throw new Error('private-provider-sentinel');
    const input = JSON.parse(call.input); const brief = input.brief;
    const base = { requestId: brief.requestId, title: 'נועה והמכתב המעופף' };
    return { usage: { inputTokens: 100, outputTokens: 200 }, output: call.stage === 'plan' ? {
      ...base, childGoal: 'למצוא את המכתב', companionWant: 'לשלוח ציור', comicPromise: 'עלים שמדגדגים', ending: 'שלחו את הציור',
      resilience: { mode: brief.resilienceMode, moments: [{ pageNumber: 2, childChoice: 'להציע רעיון אחר', whatHelps: 'החברה מקשיבה' }] },
      beats: Array.from({ length: brief.beats }, (_, index) => ({ pageNumber: index + 1, location: 'הגינה', transitionReason: 'בעקבות המכתב', childAction: 'מחפשת', companionAction: 'מתבוננת', consequence: 'המכתב מתגלה', factIds: ['f_interest0001'], continuity: 'הציור בידי נועה' })),
    } : { ...base, planDigest: input.planDigest, pages: Array.from({ length: brief.beats }, (_, index) => ({ pageNumber: index + 1, text: 'נועה וחברתה הלכו בעקבות המכתב. נועה הציעה רעיון, והחברה עצרה להקשיב. לפתע צחק עלה קטן והן צחקו איתו.' })) } };
  } };
} }));

import { GET, POST } from '@/app/api/dev/personal-wizard/story/route';
const env = { PERSONAL_WIZARD_PREVIEW: 'true', PERSONAL_WIZARD_STORY_WRITER: 'true', PERSONAL_WIZARD_STORY_MODEL: 'gpt-6-sol', PERSONAL_WIZARD_STORY_OPERATORS: 'operator@example.com', PERSONAL_WIZARD_STORY_BUDGET_USD: '1', PERSONAL_WIZARD_STORY_MAX_JOBS: '2' };
const saved = new Map<string, string | undefined>();
const payload = () => ({ kind: 'personal_book_request', version: 'reviewed-personal-book-request/v3', draftId: 'd_routetest0001', draftRevision: 1, child: { name: 'נועה', age: 5, address: 'girl', residence: 'חיפה', nameSource: 'typed', ageSource: 'typed', addressSource: 'typed', residenceSource: 'typed' }, facts: [{ id: 'f_interest0001', kind: 'interest', value: 'ציור', source: 'typed' }], noDifficulty: true, storyPlace: null, companion: { id: 'dragon_dini' }, intent: null, avoid: [], appearance: { photo: 'none' }, bookOptions: { lengthId: 'short', voiceId: null } });
let index = 0;
const request = (body: unknown, url = 'http://127.0.0.1:3461/api/dev/personal-wizard/story', origin = 'http://127.0.0.1:3461') => new NextRequest(url, { method: 'POST', headers: { host: new URL(url).host, origin, 'content-type': 'application/json', 'x-forwarded-for': `10.99.0.${++index}` }, body: JSON.stringify(body) });
const job = (id = 's_routejob0000001') => ({ jobId: id, request: payload() });
beforeEach(() => {
  Object.entries(env).forEach(([key, value]) => { saved.set(key, process.env[key]); process.env[key] = value; });
  deps.user = { id: 'operator', email: 'operator@example.com' }; deps.production = false; deps.calls = 0; deps.factory = 0; deps.keyReads = 0; deps.mode = 'ok';
  delete (globalThis as any).__personalStoryPilotLedger;
});
afterEach(() => { for (const [key, value] of saved) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });

describe('actual local manuscript route', () => {
  it('executes the reviewed request through both stages with no render authority or public cache', async () => {
    const response = await POST(request(job())); const body = await response.json();
    expect(response.status).toBe(200); expect(deps.calls).toBe(2); expect(deps.factory).toBe(1);
    expect(body.runtimeEligible).toBe(false); expect(body.status).toBe('manuscript_preview'); expect(body.manuscript.pages).toHaveLength(8);
    expect(response.headers.get('cache-control')).toBe('no-store'); expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(JSON.stringify(body)).not.toContain('test-sentinel-not-real');
  });
  it.each(['production', 'disabled', 'unpriced', 'budget', 'no_session', 'wrong_operator', 'remote', 'origin'])('blocks %s before credential or provider access', async (mode) => {
    if (mode === 'production') deps.production = true;
    if (mode === 'disabled') delete process.env.PERSONAL_WIZARD_STORY_WRITER;
    if (mode === 'unpriced') process.env.PERSONAL_WIZARD_STORY_MODEL = 'unknown';
    if (mode === 'budget') process.env.PERSONAL_WIZARD_STORY_BUDGET_USD = '6';
    if (mode === 'no_session') deps.user = null;
    if (mode === 'wrong_operator') deps.user = { id: 'other', email: 'other@example.com' };
    const url = mode === 'remote' ? 'https://qa.example.com/api/dev/personal-wizard/story' : undefined;
    const response = await POST(request(job(), url, mode === 'origin' ? 'https://foreign.example.com' : undefined));
    expect(response.status).toBeGreaterThanOrEqual(400); expect(deps.keyReads).toBe(0); expect(deps.calls).toBe(0);
  });
  it.each(['unknown_field', 'removed_length', 'missing_interest', 'unknown_companion'])('invalid %s cannot read key or dispatch', async (mode) => {
    const input = job();
    if (mode === 'unknown_field') Object.assign(input.request, { providerKey: 'not-allowed' });
    if (mode === 'removed_length') input.request.bookOptions.lengthId = 'retired';
    if (mode === 'missing_interest') input.request.facts = [];
    if (mode === 'unknown_companion') input.request.companion.id = 'foreign';
    expect((await POST(request(input))).status).toBe(422); expect(deps.keyReads).toBe(0); expect(deps.calls).toBe(0);
  });
  it('rejects duplicated jobs and preserves failed reservation', async () => {
    deps.mode = 'fail';
    const first = await POST(request(job()));
    expect(first.status).toBe(502); expect(JSON.stringify(await first.json())).not.toContain('private-provider-sentinel');
    expect((await POST(request(job()))).status).toBe(409); expect(deps.calls).toBe(1);
    expect(deps.keyReads).toBe(1);
  });
  it('limits jobs/budget across requests, not separately per manuscript stage', async () => {
    expect((await POST(request(job()))).status).toBe(200);
    expect((await POST(request(job('s_routejob0000002')))).status).toBe(200);
    expect((await POST(request(job('s_routejob0000003')))).status).toBe(409); expect(deps.calls).toBe(4);
    expect(deps.keyReads).toBe(2);
  });
  it('status route also enforces signed-in operator authority', async () => {
    deps.user = null;
    expect((await GET(new NextRequest('http://127.0.0.1:3461/api/dev/personal-wizard/story'))).status).toBe(401);
    expect(deps.keyReads).toBe(0);
  });
  it('rejects oversized or malformed envelopes', async () => {
    expect((await POST(request({ ...job(), unexpected: true }))).status).toBe(422);
    expect((await POST(request({ data: 'x'.repeat(33000) }))).status).toBe(413);
    expect(deps.calls).toBe(0);
  });
});
