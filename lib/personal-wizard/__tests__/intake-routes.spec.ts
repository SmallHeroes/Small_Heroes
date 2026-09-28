import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The real routes and gate, with the session lookup, provider factory and duration probe replaced:
 * no database, no network, no provider key and no spend.
 */
const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string } }, throws: false }));
const providerCalls = vi.hoisted(() => ({ transcribe: 0, extract: 0, factoryConfigs: [] as unknown[] }));

vi.mock('@/lib/auth-session', () => ({
  resolveUserFromRequest: vi.fn(async () => {
    if (session.throws) throw new Error('db down');
    return session.current;
  }),
}));

vi.mock('@/lib/personal-wizard/intake-openai', () => ({
  createOpenAiIntakeProvider: (config: unknown) => {
    providerCalls.factoryConfigs.push(config);
    return {
      async transcribe() {
        providerCalls.transcribe += 1;
        return { text: 'הוא אוהב לבנות מגדלים מקוביות.' };
      },
      async extract() {
        providerCalls.extract += 1;
        return {
          status: 'completed',
          outputText: JSON.stringify({
            understood: true,
            facts: [{ kind: 'interest', value: 'בניית מגדלים' }],
            storyPlace: null,
            mentionedName: null,
            mentionedAge: null,
            explicitTopicId: null,
          }),
        };
      },
    };
  },
}));

vi.mock('@/lib/personal-wizard/audio-probe', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../audio-probe')>()),
  probeAudioDurationMs: vi.fn(async () => 12_000),
}));

const { POST: audioPost } = await import('@/app/api/dev/personal-wizard/intake/audio/route');
const { POST: textPost } = await import('@/app/api/dev/personal-wizard/intake/text/route');
const { GET: statusGet } = await import('@/app/api/dev/personal-wizard/intake/status/route');

const LIVE_ENV: Record<string, string> = {
  PERSONAL_WIZARD_PREVIEW: 'true',
  PERSONAL_WIZARD_LIVE_INTAKE: 'true',
  PERSONAL_WIZARD_INTAKE_OPERATORS: 'operator@example.com',
  PERSONAL_WIZARD_TRANSCRIBE_MODEL: 'gpt-transcribe',
  PERSONAL_WIZARD_EXTRACT_MODEL: 'gpt-6-luna',
  PERSONAL_WIZARD_INTAKE_BUDGET_USD: '1',
  PERSONAL_WIZARD_INTAKE_MAX_JOBS: '20',
  OPENAI_API_KEY: 'test-value-not-a-key',
};
const saved: Record<string, string | undefined> = {};

const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(3000, 5)]);
let jobCounter = 0;
const nextJobId = () => `j_${String((jobCounter += 1)).padStart(12, '0')}`;
const ip = () => `10.1.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

function audioRequest(options: { origin?: string; body?: Buffer; jobId?: string; type?: string; length?: string } = {}) {
  const body = options.body ?? WEBM;
  const headers: Record<string, string> = {
    origin: options.origin ?? 'http://localhost:3000',
    'content-type': options.type ?? 'audio/webm;codecs=opus',
    'x-pw-job-id': options.jobId ?? nextJobId(),
    'x-pw-draft-id': 'd_000000000001',
    'x-forwarded-for': ip(),
  };
  if (options.length) headers['content-length'] = options.length;
  return new NextRequest('http://localhost:3000/api/dev/personal-wizard/intake/audio', {
    method: 'POST',
    body: new Uint8Array(body),
    headers,
  });
}

beforeEach(() => {
  for (const key of Object.keys(LIVE_ENV)) {
    saved[key] = process.env[key];
    process.env[key] = LIVE_ENV[key];
  }
  session.current = { user: { id: `user_${Math.random()}`, email: 'Operator@Example.com' } };
  session.throws = false;
  providerCalls.transcribe = 0;
  providerCalls.extract = 0;
  providerCalls.factoryConfigs.length = 0;
});

afterEach(() => {
  for (const key of Object.keys(LIVE_ENV)) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('live intake routes', () => {
  it('a signed-in operator gets a contract-valid result from the injected provider', async () => {
    const response = await audioPost(audioRequest());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.json();
    expect(body).toMatchObject({ source: 'transcript', extraction: { understood: true } });
    expect(providerCalls).toMatchObject({ transcribe: 1, extract: 1 });
  });

  it('is invisible unless the explicit flags and configuration are all present', async () => {
    for (const [key, value] of [
      ['PERSONAL_WIZARD_PREVIEW', 'false'],
      ['PERSONAL_WIZARD_LIVE_INTAKE', 'false'],
      ['PERSONAL_WIZARD_INTAKE_OPERATORS', ''],
      ['PERSONAL_WIZARD_EXTRACT_MODEL', 'gpt-4o'],
      ['OPENAI_API_KEY', ''],
    ] as const) {
      process.env[key] = value;
      const response = await audioPost(audioRequest());
      expect(response.status, key).toBe(404);
      process.env[key] = LIVE_ENV[key];
    }
    expect(providerCalls.factoryConfigs).toHaveLength(0);
  });

  it('requires a signed-in session on the operator allowlist, and same origin', async () => {
    session.current = null;
    expect((await audioPost(audioRequest())).status).toBe(401);
    session.current = { user: { id: 'user_x', email: 'parent@example.com' } };
    expect((await audioPost(audioRequest())).status).toBe(403);
    session.throws = true;
    expect((await audioPost(audioRequest())).status).toBe(503);
    session.throws = false;
    session.current = { user: { id: 'user_y', email: 'operator@example.com' } };
    expect((await audioPost(audioRequest({ origin: 'https://evil.example' }))).status).toBe(403);
    expect(providerCalls.transcribe).toBe(0);
  });

  it('refuses oversize bodies before reading them into the provider path', async () => {
    const declared = await audioPost(audioRequest({ length: String(5 * 1024 * 1024) }));
    expect(declared.status).toBe(413);
    const actual = await audioPost(audioRequest({ body: Buffer.concat([WEBM, Buffer.alloc(3 * 1024 * 1024 + 10)]) }));
    expect(actual.status).toBe(413);
    expect(providerCalls.transcribe).toBe(0);
  });

  it('never processes the same job twice for the same operator', async () => {
    const jobId = nextJobId();
    expect((await audioPost(audioRequest({ jobId }))).status).toBe(200);
    const repeat = await audioPost(audioRequest({ jobId }));
    expect(repeat.status).toBe(409);
    expect(await repeat.json()).toEqual({ error: 'duplicate_job' });
    expect(providerCalls.transcribe).toBe(1);
  });

  it('text re-organisation uses extraction only', async () => {
    const response = await textPost(
      new NextRequest('http://localhost:3000/api/dev/personal-wizard/intake/text', {
        method: 'POST',
        body: JSON.stringify({ jobId: nextJobId(), draftId: 'd_000000000001', text: 'הוא אוהב לבנות מגדלים מקוביות.' }),
        headers: { origin: 'http://localhost:3000', 'content-type': 'application/json', 'x-forwarded-for': ip() },
      }),
    );
    expect(response.status).toBe(200);
    expect(providerCalls).toMatchObject({ transcribe: 0, extract: 1 });
  });

  it('status tells the UI the truth and grants nothing', async () => {
    const status = (headers: Record<string, string> = {}) =>
      statusGet(new NextRequest('http://localhost:3000/api/dev/personal-wizard/intake/status', { headers: { 'x-forwarded-for': ip(), ...headers } }));
    expect(await (await status()).json()).toEqual({ live: true, reason: null });
    session.current = { user: { id: 'user_z', email: 'parent@example.com' } };
    expect(await (await status()).json()).toEqual({ live: false, reason: 'not_operator' });
    process.env.PERSONAL_WIZARD_LIVE_INTAKE = 'false';
    expect(await (await status()).json()).toEqual({ live: false, reason: 'live_flag_off' });
    process.env.PERSONAL_WIZARD_PREVIEW = 'false';
    expect((await status()).status).toBe(404);
  });
});
