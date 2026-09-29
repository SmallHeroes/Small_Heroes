import { describe, expect, it } from 'vitest';

import type { AudioMeasurement } from '../audio-probe';
import { intakeResultSchema } from '../contract';
import { IntakeLedger } from '../intake-ledger';
import { runAudioIntake, runTextIntake, type IntakeProvider, type IntakeServiceDeps } from '../intake-service';

const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(2000, 7)]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(2000, 3)]);
const OGG = Buffer.concat([Buffer.from('OggS'), Buffer.alloc(2000, 1)]);

const TOPICS = [
  { id: 'transitions', label: 'מעברים ושינויים' },
  { id: 'night', label: 'פחדים בלילה' },
];

const GOOD_EXTRACTION = {
  understood: true,
  facts: [
    { kind: 'interest', value: 'בניית מגדלים' },
    { kind: 'favorite_place', value: 'הים' },
  ],
  storyPlace: null,
  mentionedName: null,
  mentionedAge: 6,
  explicitTopicId: 'transitions',
};

type Calls = { transcribe: number; extract: number; userTexts: string[]; instructions: string[] };

function fakeProvider(
  overrides: Partial<{
    transcript: string;
    extraction: unknown;
    status: string;
    transcribeError: Error;
    extractError: Error;
    hang: boolean;
  }> = {},
): { provider: IntakeProvider; calls: Calls } {
  const calls: Calls = { transcribe: 0, extract: 0, userTexts: [], instructions: [] };
  const provider: IntakeProvider = {
    async transcribe({ signal }) {
      calls.transcribe += 1;
      if (overrides.hang) {
        await new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
      }
      if (overrides.transcribeError) throw overrides.transcribeError;
      return { text: overrides.transcript ?? 'הוא אוהב לבנות מגדלים ומתלהב מהים. הוא בן שש.' };
    },
    async extract({ userText, instructions }) {
      calls.extract += 1;
      calls.userTexts.push(userText);
      calls.instructions.push(instructions);
      if (overrides.extractError) throw overrides.extractError;
      return { status: overrides.status ?? 'completed', outputText: JSON.stringify(overrides.extraction ?? GOOD_EXTRACTION) };
    },
  };
  return { provider, calls };
}

function deps(
  provider: IntakeProvider,
  options: { ledger?: IntakeLedger; measurement?: AudioMeasurement; budgetUsd?: number; maxJobs?: number; timeoutMs?: number } = {},
): IntakeServiceDeps & { probes: Array<{ bytes: number; maxDurationMs: number }>; constructed: () => number } {
  const probes: Array<{ bytes: number; maxDurationMs: number }> = [];
  let constructed = 0;
  return {
    createProvider: () => {
      constructed += 1;
      return provider;
    },
    constructed: () => constructed,
    ledger: options.ledger ?? new IntakeLedger(),
    config: {
      transcribeModel: 'gpt-transcribe',
      extractModel: 'gpt-6-sol',
      budgetUsd: options.budgetUsd ?? 1,
      maxJobs: options.maxJobs ?? 5,
    },
    measureAudio: async (bytes, _container, maxDurationMs) => {
      probes.push({ bytes: bytes.length, maxDurationMs });
      return options.measurement ?? { ok: true, durationMs: 20_000, decodedMs: 20_000, timelineMs: 20_010 };
    },
    topics: TOPICS,
    timeoutMs: options.timeoutMs,
    probes,
  };
}

const audio = (overrides: Partial<{ userId: string; jobId: string; draftId: string; declaredType: string; bytes: Buffer }> = {}) => ({
  userId: 'user_a',
  jobId: 'j_000000000001',
  draftId: 'd_000000000001',
  declaredType: 'audio/webm;codecs=opus',
  bytes: WEBM,
  ...overrides,
});

describe('runAudioIntake', () => {
  it('transcribes and extracts once, returning a contract-valid result and a bounded reservation', async () => {
    const { provider, calls } = fakeProvider();
    const service = deps(provider);
    const outcome = await runAudioIntake(service, audio());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(intakeResultSchema.parse(outcome.result)).toEqual(outcome.result);
    expect(outcome.result).toMatchObject({ jobId: 'j_000000000001', source: 'transcript' });
    expect(outcome.result.extraction.facts).toHaveLength(2);
    expect(calls).toMatchObject({ transcribe: 1, extract: 1 });
    expect(calls.userTexts[0]).toContain('<transcript>');
    expect(calls.instructions[0]).not.toContain('מגדלים');
    expect(outcome.reservedUsd).toBeGreaterThan(0);
    expect(outcome.reservedUsd).toBeLessThan(0.2);
    expect(service.ledger.snapshot()).toMatchObject({ jobs: 1, inFlight: 0 });
  });

  it('accepts mp4 too, and never trusts the declared type over the bytes', async () => {
    const mp4 = await runAudioIntake(deps(fakeProvider().provider), audio({ declaredType: 'audio/mp4', bytes: MP4 }));
    expect(mp4.ok).toBe(true);
    for (const [label, input, code, status] of [
      ['declared ogg', audio({ declaredType: 'audio/ogg', bytes: OGG }), 'unsupported_format', 415],
      ['declared webm, bytes ogg', audio({ bytes: OGG }), 'format_mismatch', 415],
      ['declared webm, bytes mp4', audio({ bytes: MP4 }), 'format_mismatch', 415],
      ['declared wav', audio({ declaredType: 'audio/wav' }), 'unsupported_format', 415],
      ['too large', audio({ bytes: Buffer.concat([WEBM, Buffer.alloc(3 * 1024 * 1024)]) }), 'too_large', 413],
      ['too small', audio({ bytes: WEBM.subarray(0, 100) }), 'too_short', 422],
      ['bad job id', audio({ jobId: '../../etc' }), 'bad_request', 400],
      ['bad draft id', audio({ draftId: 'x' }), 'bad_request', 400],
    ] as const) {
      const { provider, calls } = fakeProvider();
      const outcome = await runAudioIntake(deps(provider), input);
      expect(outcome, label).toMatchObject({ ok: false, code, status });
      expect(calls.transcribe, label).toBe(0);
    }
  });

  it('trusts only its own measurement: every refusal lands before the ledger and the provider', async () => {
    const ok = (durationMs: number): AudioMeasurement => ({ ok: true, durationMs, decodedMs: durationMs, timelineMs: durationMs });
    for (const [measurement, code, status] of [
      [{ ok: false, reason: 'unreadable' }, 'duration_unreadable', 422],
      [{ ok: false, reason: 'timeline_invalid' }, 'timeline_invalid', 422],
      [{ ok: false, reason: 'timeline_mismatch' }, 'timeline_mismatch', 422],
      [{ ok: false, reason: 'too_long' }, 'too_long', 413],
      [ok(400), 'too_short', 422],
      [ok(120_000), 'too_long', 413],
    ] as const) {
      const { provider, calls } = fakeProvider();
      const service = deps(provider, { measurement: measurement as AudioMeasurement });
      const outcome = await runAudioIntake(service, audio());
      expect(outcome, code).toMatchObject({ ok: false, code, status });
      expect(calls.transcribe).toBe(0);
      expect(service.constructed()).toBe(0);
      expect(service.ledger.snapshot()).toMatchObject({ jobs: 0, reservedTotalUsd: 0 });
    }
  });

  it('asks the measurement to stop at the recording ceiling plus rounding tolerance', async () => {
    const service = deps(fakeProvider().provider);
    await runAudioIntake(service, audio());
    expect(service.probes).toEqual([{ bytes: WEBM.length, maxDurationMs: 91_500 }]);
  });

  it('reserves on the measured duration, not on anything the client claims', async () => {
    const short = await runAudioIntake(deps(fakeProvider().provider, { measurement: { ok: true, durationMs: 5_000, decodedMs: 5_000, timelineMs: 5_000 } }), audio());
    const long = await runAudioIntake(deps(fakeProvider().provider, { measurement: { ok: true, durationMs: 90_000, decodedMs: 90_000, timelineMs: 89_990 } }), audio());
    expect(short.ok && long.ok).toBe(true);
    if (!short.ok || !long.ok) return;
    expect(long.reservedUsd - short.reservedUsd).toBeCloseTo(((90 - 5) / 60) * 0.0045 * 1.1, 10);
  });

  it('runs a (user, job) pair at most once; another user with the same id is independent', async () => {
    const ledger = new IntakeLedger();
    const { provider, calls } = fakeProvider();
    const first = await runAudioIntake(deps(provider, { ledger }), audio());
    const repeat = await runAudioIntake(deps(provider, { ledger }), audio());
    expect(first.ok).toBe(true);
    expect(repeat).toMatchObject({ ok: false, code: 'duplicate_job', status: 409 });
    expect(calls.transcribe).toBe(1);
    const otherUser = await runAudioIntake(deps(provider, { ledger }), audio({ userId: 'user_b' }));
    expect(otherUser.ok).toBe(true);
    expect(calls.transcribe).toBe(2);
  });

  it('allows one job in flight per user', async () => {
    const ledger = new IntakeLedger();
    const slow = fakeProvider({ hang: true });
    const controller = new AbortController();
    const running = runAudioIntake(deps(slow.provider, { ledger }), { ...audio(), signal: controller.signal });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = await runAudioIntake(deps(fakeProvider().provider, { ledger }), audio({ jobId: 'j_000000000002' }));
    expect(second).toMatchObject({ ok: false, code: 'user_busy', status: 409 });
    controller.abort();
    expect(await running).toMatchObject({ ok: false, code: 'client_aborted' });
  });

  it('enforces the budget and the job ceiling before calling the provider', async () => {
    const { provider, calls } = fakeProvider();
    const brokeService = deps(provider, { budgetUsd: 0.0001 });
    const broke = await runAudioIntake(brokeService, audio());
    expect(broke).toMatchObject({ ok: false, code: 'budget_exhausted', status: 402 });
    expect(brokeService.constructed()).toBe(0);
    const ledger = new IntakeLedger();
    await runAudioIntake(deps(provider, { ledger, maxJobs: 1 }), audio());
    const capped = await runAudioIntake(deps(provider, { ledger, maxJobs: 1 }), audio({ jobId: 'j_000000000009' }));
    expect(capped).toMatchObject({ ok: false, code: 'job_limit', status: 429 });
    expect(calls.transcribe).toBe(1);
  });

  it('never retries: a provider failure or timeout is reported once and the reservation stays spent', async () => {
    const failing = fakeProvider({ transcribeError: new Error('boom') });
    const service = deps(failing.provider);
    expect(await runAudioIntake(service, audio())).toMatchObject({ ok: false, code: 'provider_failed', status: 502 });
    expect(failing.calls.transcribe).toBe(1);
    expect(service.ledger.snapshot().reservedTotalUsd).toBeGreaterThan(0);

    const hanging = fakeProvider({ hang: true });
    expect(await runAudioIntake(deps(hanging.provider, { timeoutMs: 20 }), audio())).toMatchObject({
      ok: false,
      code: 'provider_timeout',
      status: 504,
    });
  });

  it('an empty or unclear transcript is "not understood" without paying for extraction', async () => {
    const { provider, calls } = fakeProvider({ transcript: '  אה... ' });
    const outcome = await runAudioIntake(deps(provider), audio());
    expect(outcome.ok && outcome.result.extraction.understood).toBe(false);
    expect(calls.extract).toBe(0);
  });

  it('an incomplete or malformed model answer is an error, not a partial profile', async () => {
    for (const provider of [
      fakeProvider({ status: 'incomplete' }).provider,
      fakeProvider({ extraction: { facts: 'nope' } }).provider,
    ]) {
      expect(await runAudioIntake(deps(provider), audio())).toMatchObject({ ok: false, code: 'extraction_malformed' });
    }
  });

  it('drops topics outside the offered set even if the model returns one', async () => {
    const { provider } = fakeProvider({ extraction: { ...GOOD_EXTRACTION, explicitTopicId: 'medical' } });
    const outcome = await runAudioIntake(deps(provider), audio());
    expect(outcome.ok && outcome.result.extraction.explicitTopicId).toBeNull();
  });
});

describe('runTextIntake', () => {
  it('re-organises corrected text with extraction only', async () => {
    const { provider, calls } = fakeProvider();
    const service = deps(provider);
    const outcome = await runTextIntake(service, {
      userId: 'user_a',
      jobId: 'j_000000000003',
      draftId: 'd_000000000001',
      text: 'היא אוהבת לצייר ומתלהבת מהים.',
    });
    expect(outcome.ok && outcome.result.transcript).toBe('היא אוהבת לצייר ומתלהבת מהים.');
    expect(calls).toMatchObject({ transcribe: 0, extract: 1 });
    expect(service.probes).toEqual([]);
  });

  it('bounds and validates the text', async () => {
    const { provider, calls } = fakeProvider();
    const base = { userId: 'user_a', jobId: 'j_000000000004', draftId: 'd_000000000001' };
    expect(await runTextIntake(deps(provider), { ...base, text: 'א'.repeat(4001) })).toMatchObject({ code: 'too_long', status: 413 });
    expect(await runTextIntake(deps(provider), { ...base, text: '   ' })).toMatchObject({ code: 'too_short' });
    expect(await runTextIntake(deps(provider), { ...base, text: 42 })).toMatchObject({ code: 'bad_request' });
    expect(calls.extract).toBe(0);
  });
});
