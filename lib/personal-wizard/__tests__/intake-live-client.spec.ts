import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { watchAvailability } from '../availability-client';

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

  it('distinguishes an indeterminate refresh from an authoritative disabled state', async () => {
    for (const body of [null, {}, { live: 'false' }]) {
      expect(await fetchLiveIntakeAvailability(fakeFetch(200, body))).toBeUndefined();
    }
    expect(await fetchLiveIntakeAvailability(fakeFetch(503, { error: 'temporary' }))).toBeUndefined();
    expect(await fetchLiveIntakeAvailability(async () => { throw Error('network'); })).toBeUndefined();
    expect(await fetchLiveIntakeAvailability(fakeFetch(200, { live: false })))
      .toEqual({ live: false, signInRequired: false });
  });

  it('offers sign-in only for an explicit signed-out status, never as access authority', async () => {
    expect(await fetchLiveIntakeAvailability(fakeFetch(200, { live: false, reason: 'not_signed_in' })))
      .toEqual({ live: false, signInRequired: true });
    expect(await fetchLiveIntakeAvailability(fakeFetch(200, { live: false, reason: 'not_operator' })))
      .toEqual({ live: false, signInRequired: false });
    for (const body of [null, {}, { live: 'false', reason: 'not_signed_in' }]) {
      expect(await fetchLiveIntakeAvailability(fakeFetch(200, body))).toBeUndefined();
    }
    expect(await fetchLiveIntakeAvailability(fakeFetch(401, { live: false, reason: 'not_signed_in' })))
      .toEqual({ live: false, signInRequired: false });
    expect(await fetchLiveIntakeAvailability(fakeFetch(200, { live: true, reason: 'not_signed_in' })))
      .toEqual({ live: true, signInRequired: false });
  });
});

const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
describe('shared availability focus lifecycle', () => {
  it('keeps the known live state through a failed focus refresh; explicit false still revokes it', async () => {
    const target = new EventTarget(), calls: Call[] = [];
    let body: unknown = { live: true }, status = 200;
    let current = { live: false, signInRequired: false };
    const publish = vi.fn(value => { current = value; });
    const stop = watchAvailability(target, () => fetchLiveIntakeAvailability(async (url, init) => fakeFetch(status, body, calls)(url, init)), publish);
    await settle(); expect(current.live).toBe(true);
    status = 503; target.dispatchEvent(new Event('focus')); await settle();
    expect(current.live).toBe(true); expect(publish).toHaveBeenCalledTimes(1);
    status = 200; body = { live: false, reason: 'not_signed_in' };
    target.dispatchEvent(new Event('focus')); await settle();
    expect(current).toEqual({ live: false, signInRequired: true });
    expect(calls).toHaveLength(3);
    for (const { url, init } of calls) {
      expect(url).toBe('/api/dev/personal-wizard/intake/status');
      expect(init).toEqual({ cache: 'no-store' });
    }
    stop();
  });
  it.each([401, 403, 404])('treats HTTP %i as explicit unavailability, irrespective of the body', async status => {
    expect(await fetchLiveIntakeAvailability(fakeFetch(status, { live: true })))
      .toEqual({ live: false, signInRequired: false });
  });
  it('keeps the initial state closed on a throwing read and retries only on focus', async () => {
    const target = new EventTarget(), publish = vi.fn();
    const read = vi.fn().mockRejectedValueOnce(Error('temporary')).mockResolvedValueOnce(true);
    const stop = watchAvailability(target, read, publish);
    await settle(); expect(publish).not.toHaveBeenCalled(); expect(read).toHaveBeenCalledTimes(1);
    target.dispatchEvent(new Event('focus')); await settle();
    expect(publish).toHaveBeenCalledWith(true); expect(read).toHaveBeenCalledTimes(2); stop();
  });
  it.each([false, true, undefined])('ignores an old live=true response after a newer %s result', async newest => {
    const target = new EventTarget(), publish = vi.fn();
    const old = deferred<boolean | undefined>(), next = deferred<boolean | undefined>();
    const read = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    const stop = watchAvailability(target, read, publish);
    target.dispatchEvent(new Event('focus')); next.resolve(newest); await settle();
    old.resolve(true); await settle();
    expect(publish.mock.calls).toEqual(newest === undefined ? [] : [[newest]]); stop();
  });
  it('does not let an older refusal override a newer available result', async () => {
    const target = new EventTarget(), publish = vi.fn();
    const old = deferred<boolean>(), next = deferred<boolean>();
    const stop = watchAvailability(target, vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise), publish);
    target.dispatchEvent(new Event('focus')); next.resolve(true); await settle();
    old.resolve(false); await settle(); expect(publish.mock.calls).toEqual([[true]]); stop();
  });
  it('removes the listener and ignores a pending result or rejection after unmount', async () => {
    for (const rejects of [false, true]) {
      const target = new EventTarget(), publish = vi.fn(), pending = deferred<boolean>();
      const read = vi.fn(() => pending.promise);
      const stop = watchAvailability(target, read, publish); stop();
      target.dispatchEvent(new Event('focus'));
      if (rejects) pending.reject(Error('late')); else pending.resolve(true);
      await settle(); expect(publish).not.toHaveBeenCalled(); expect(read).toHaveBeenCalledTimes(1);
    }
  });
  it('wires both actual UI effects to the guarded focus watcher', () => {
    const wizard = readFileSync('app/dev/personal-wizard/PersonalWizard.tsx', 'utf8');
    const book = readFileSync('app/dev/personal-wizard/StoryPreview.tsx', 'utf8');
    expect(wizard).toContain('useEffect(() => watchAvailability(window, fetchLiveIntakeAvailability');
    expect(book).toContain('useEffect(() => watchAvailability(window, fetchTextBookAvailability, setAvailability), [])');
    // Retain withdrawal on a real revocation; do not "fix" availability by bypassing it.
    expect(wizard).toContain('!liveIntake && sendRequested');
    expect(wizard).toContain('withdrawSendRequest()');
  });
});
