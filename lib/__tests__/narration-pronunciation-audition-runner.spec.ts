import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { getVoiceById } from '@/backend/config/voices';
import { resolveVoiceSettings } from '@/backend/providers/audio';
import {
  AUDITION_LANGUAGE_CODE,
  AUDITION_MODEL_ID,
  AUDITION_OUTPUT_FORMAT,
  parseAuditionArgs,
  resolveAuditionVoiceSettings,
  runAudition,
  type AuditionRunOptions,
} from '@/scripts/narration-pronunciation-audition';

const temporaryDirectories: string[] = [];

function temporaryOutputRoot(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'narration-audition-test-'));
  temporaryDirectories.push(directory);
  return directory;
}

function options(outputRoot: string, runId: string, live: boolean, apiKey?: string): AuditionRunOptions {
  return { live, runId, outputRoot, apiKey, gitHead: 'test-head' };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('narration pronunciation audition runner', () => {
  it('parses only the bounded CLI flags and rejects unsafe run ids', () => {
    expect(parseAuditionArgs(['--run-id', 'approved-a', '--live'], { cwd: 'C:\\repo', gitHead: 'abc' }))
      .toMatchObject({ live: true, runId: 'approved-a', gitHead: 'abc' });
    expect(() => parseAuditionArgs(['--unknown'])).toThrow('Unknown argument');
    expect(() => parseAuditionArgs(['--run-id', '..\\escape'])).toThrow('Invalid --run-id');
    expect(() => parseAuditionArgs(['--live', '--live'])).toThrow('Duplicate argument');
  });

  it('keeps the audition Fairy settings equal to the production resolver', () => {
    const voice = getVoiceById('fairy');
    expect(resolveAuditionVoiceSettings(voice)).toEqual(resolveVoiceSettings(voice, false));
  });

  it('performs a no-spend dry-run without reading a key or touching fetch', async () => {
    const outputRoot = temporaryOutputRoot();
    let fetchCalls = 0;
    const summary = await runAudition(options(outputRoot, 'dry-only', false), {
      fetchFn: (async () => {
        fetchCalls += 1;
        throw new Error('fetch must not be called');
      }) as typeof fetch,
      now: () => new Date('2026-09-02T10:00:00.000Z'),
      log: () => undefined,
    });

    expect(summary.mode).toBe('dry-run');
    expect(summary.preflight.requestCount).toBe(24);
    expect(summary.generatedClips).toBe(0);
    expect(fetchCalls).toBe(0);
    expect(fs.existsSync(path.join(summary.runDirectory, 'preflight.json'))).toBe(true);
    expect(fs.existsSync(path.join(summary.runDirectory, 'clips'))).toBe(false);
  });

  it('fails live without a key before fetch or live-state mutation', async () => {
    const outputRoot = temporaryOutputRoot();
    const base = options(outputRoot, 'missing-key', false);
    await runAudition(base, { log: () => undefined });
    let fetchCalls = 0;

    await expect(runAudition({ ...base, live: true }, {
      fetchFn: (async () => {
        fetchCalls += 1;
        throw new Error('fetch must not be called');
      }) as typeof fetch,
      log: () => undefined,
    })).rejects.toThrow('ELEVENLABS_API_KEY');

    expect(fetchCalls).toBe(0);
    expect(fs.existsSync(path.join(outputRoot, 'missing-key', 'live-state.json'))).toBe(false);
  });

  it('makes exactly 24 controlled live requests after the matching dry-run and writes 24 MP3s', async () => {
    const outputRoot = temporaryOutputRoot();
    const dryOptions = options(outputRoot, 'mock-live', false);
    await runAudition(dryOptions, { log: () => undefined });
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchFn: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(new Uint8Array([0x49, 0x44, 0x33, calls.length]), {
        status: 200,
        headers: {
          'content-type': 'audio/mpeg',
          'character-cost': '7',
          'request-id': `request-${calls.length}`,
          'x-trace-id': `trace-${calls.length}`,
        },
      });
    };

    const summary = await runAudition({ ...dryOptions, live: true, apiKey: 'test-key' }, {
      fetchFn,
      now: () => new Date('2026-09-02T10:00:00.000Z'),
      log: () => undefined,
    });

    expect(calls).toHaveLength(24);
    expect(summary.generatedClips).toBe(24);
    expect(summary.providerCharacterCost).toBe(168);
    expect(summary.entries.every((entry) => entry.status === 'generated')).toBe(true);
    expect(fs.readdirSync(path.join(summary.runDirectory, 'clips')).filter((name) => name.endsWith('.mp3'))).toHaveLength(24);
    for (const call of calls) {
      expect(call.url).toContain(`output_format=${AUDITION_OUTPUT_FORMAT}`);
      const body = JSON.parse(String(call.init?.body)) as Record<string, unknown>;
      expect(body.model_id).toBe(AUDITION_MODEL_ID);
      expect(body.language_code).toBe(AUDITION_LANGUAGE_CODE);
      expect(body.voice_settings).toEqual(resolveAuditionVoiceSettings(getVoiceById('fairy')));
      expect(typeof body.seed).toBe('number');
    }

    let retryFetchCalls = 0;
    await expect(runAudition({ ...dryOptions, live: true, apiKey: 'test-key' }, {
      fetchFn: (async () => {
        retryFetchCalls += 1;
        return new Response();
      }) as typeof fetch,
      log: () => undefined,
    })).rejects.toThrow('already started live generation');
    expect(retryFetchCalls).toBe(0);
  });

  it('stops after the first bad provider response and records the failed checkpoint', async () => {
    const outputRoot = temporaryOutputRoot();
    const dryOptions = options(outputRoot, 'provider-failure', false);
    await runAudition(dryOptions, { log: () => undefined });
    let fetchCalls = 0;

    await expect(runAudition({ ...dryOptions, live: true, apiKey: 'test-key' }, {
      fetchFn: (async () => {
        fetchCalls += 1;
        return new Response(new Uint8Array(), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
      }) as typeof fetch,
      log: () => undefined,
    })).rejects.toThrow('Audition stopped after 0 successful clip');

    expect(fetchCalls).toBe(1);
    const state = JSON.parse(fs.readFileSync(path.join(outputRoot, 'provider-failure', 'live-state.json'), 'utf8')) as {
      status: string;
      completedClips: number;
    };
    expect(state).toMatchObject({ status: 'failed', completedClips: 0 });
  });
});
