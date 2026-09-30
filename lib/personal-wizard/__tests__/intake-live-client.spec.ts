import { describe, expect, it } from 'vitest';

import { PERSONAL_INTAKE_EXTRACTION_VERSION } from '../contract';
import {
  fetchLiveIntakeStatus,
  fetchLiveIntakeAvailability,
  mapIntakeError,
  submitAudioIntake,
  submitTextIntake,
} from '../intake-live-client';

const RESULT = {
  jobId: 'j_000000000001',
  source: 'transcript',
  transcript: 'היא אוהבת לצייר',
  extraction: {
    version: PERSONAL_INTAKE_EXTRACTION_VERSION,
    understood: true,
    facts: [{ kind: 'interest', value: 'ציור' }],
    storyPlace: null,
    mentionedName: null,
    mentionedAge: null,
    mentionedAddress: 'girl',
    residence: null,
    explicitTopicId: null,
    hardTopicId: null,
  },
};

type Call = { url: string; init: RequestInit };
const fakeFetch = (status: number, body: unknown, calls: Call[] = []) =>
  (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as (input: string, init: RequestInit) => Promise<Response>;

describe('live intake client', () => {
  it('sends the raw clip with its real type and the job headers, and validates the answer', async () => {
    const calls: Call[] = [];
    const audio = new Blob([new Uint8Array(1234)], { type: 'audio/webm;codecs=opus' });
    const response = await submitAudioIntake({
      jobId: 'j_000000000001',
      draftId: 'd_000000000001',
      audio,
      mimeType: 'audio/webm;codecs=opus',
      signal: new AbortController().signal,
      fetchImpl: fakeFetch(200, RESULT, calls),
    });
    expect(response.ok).toBe(true);
    expect(calls[0].url).toBe('/api/dev/personal-wizard/intake/audio');
    expect(calls[0].init.body).toBe(audio);
    expect(calls[0].init.headers).toMatchObject({
      'Content-Type': 'audio/webm;codecs=opus',
      'x-pw-job-id': 'j_000000000001',
      'x-pw-draft-id': 'd_000000000001',
    });
  });

  it('rejects an answer for another job, a fixture-labelled answer, or a malformed body', async () => {
    const base = { jobId: 'j_000000000001', draftId: 'd_000000000001', text: 'טקסט', signal: new AbortController().signal };
    for (const body of [{ ...RESULT, jobId: 'j_000000000002' }, { ...RESULT, source: 'fixture' }, { ok: true }]) {
      expect(await submitTextIntake({ ...base, fetchImpl: fakeFetch(200, body) })).toEqual({ ok: false, error: 'malformed_response' });
    }
  });

  it('maps server refusals to parent-facing states', () => {
    expect(mapIntakeError(401, 'not_signed_in')).toBe('not_signed_in');
    expect(mapIntakeError(403, 'not_operator')).toBe('not_operator');
    expect(mapIntakeError(404, 'not_found')).toBe('disabled');
    expect(mapIntakeError(402, 'budget_exhausted')).toBe('budget');
    expect(mapIntakeError(429, 'job_limit')).toBe('budget');
    expect(mapIntakeError(429, undefined)).toBe('rate_limited');
    expect(mapIntakeError(409, 'duplicate_job')).toBe('busy');
    expect(mapIntakeError(415, 'format_mismatch')).toBe('rejected_audio');
    expect(mapIntakeError(413, 'too_long')).toBe('rejected_audio');
    expect(mapIntakeError(422, 'unexpected_streams')).toBe('rejected_audio');
    expect(mapIntakeError(422, 'timeline_invalid')).toBe('rejected_audio');
    expect(mapIntakeError(422, 'timeline_mismatch')).toBe('rejected_audio');
    expect(mapIntakeError(502, 'provider_failed')).toBe('failed');
  });

  it('distinguishes an aborted request from a network failure', async () => {
    const controller = new AbortController();
    controller.abort();
    const throwing = (async () => {
      throw new Error('fetch failed');
    }) as (input: string, init: RequestInit) => Promise<Response>;
    const base = { jobId: 'j_000000000001', draftId: 'd_000000000001', text: 'טקסט' };
    expect(await submitTextIntake({ ...base, signal: controller.signal, fetchImpl: throwing })).toEqual({ ok: false, error: 'aborted' });
    expect(await submitTextIntake({ ...base, signal: new AbortController().signal, fetchImpl: throwing })).toEqual({
      ok: false,
      error: 'network',
    });
  });

  it('treats anything but an explicit live=true as not live', async () => {
    expect(await fetchLiveIntakeStatus(fakeFetch(200, { live: true }))).toBe(true);
    expect(await fetchLiveIntakeStatus(fakeFetch(200, { live: 'yes' }))).toBe(false);
    expect(await fetchLiveIntakeStatus(fakeFetch(404, { error: 'not_found' }))).toBe(false);
  });

  it('offers sign-in only for an explicit signed-out status, never as access authority', async () => {
    expect(await fetchLiveIntakeAvailability(fakeFetch(200, { live: false, reason: 'not_signed_in' })))
      .toEqual({ live: false, signInRequired: true });
    for (const body of [null, {}, { live: false, reason: 'not_operator' }, { live: 'false', reason: 'not_signed_in' }]) {
      expect(await fetchLiveIntakeAvailability(fakeFetch(200, body))).toEqual({ live: false, signInRequired: false });
    }
    expect(await fetchLiveIntakeAvailability(fakeFetch(401, { live: false, reason: 'not_signed_in' })))
      .toEqual({ live: false, signInRequired: false });
    expect(await fetchLiveIntakeAvailability(fakeFetch(200, { live: true, reason: 'not_signed_in' })))
      .toEqual({ live: true, signInRequired: false });
  });
});
