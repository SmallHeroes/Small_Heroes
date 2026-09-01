import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildWorldQaPrompt,
  evaluatePageWorldQa,
  evaluateWorldQaFromRaw,
  resolvePageWorldQaTimeoutMs,
} from '../generation-pipeline/page-world-qa';

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.OPENAI_API_KEY;
  delete process.env.PAGE_WORLD_QA_TIMEOUT_MS;
});

describe('page world QA (deterministic evaluator)', () => {
  const objects = [
    { label: 'the color gate', identity: 'a stone arch with a shifting rainbow center' },
    { label: 'the small blue button', identity: 'a small blue button from the old sweater' },
  ];

  it('passes when setting matches, visible objects consistent, no forbidden scene', () => {
    const r = evaluateWorldQaFromRaw({
      objects,
      raw: {
        settingMatchesZone: true,
        objects: [
          { label: 'the color gate', visible: true, consistentWithIdentity: true },
          { label: 'the small blue button', visible: false, consistentWithIdentity: true },
        ],
        forbiddenScenePresent: false,
        notes: 'ok',
      },
    });
    expect(r.status).toBe('pass');
    expect(r.passed).toBe(true);
    expect(r.hardFailures).toEqual([]);
  });

  it('does NOT fail when an object is simply out of frame', () => {
    const r = evaluateWorldQaFromRaw({
      objects,
      raw: {
        settingMatchesZone: true,
        objects: [{ label: 'the color gate', visible: false, consistentWithIdentity: false }],
        forbiddenScenePresent: false,
      },
    });
    expect(r.status).toBe('pass');
    expect(r.driftObjects).toEqual([]);
  });

  it('hard-fails wrong_zone', () => {
    const r = evaluateWorldQaFromRaw({
      objects,
      raw: { settingMatchesZone: false, objects: [], forbiddenScenePresent: false },
    });
    expect(r.status).toBe('fail');
    expect(r.hardFailures).toContain('wrong_zone');
  });

  it('hard-fails object_state_drift only when a VISIBLE object is redesigned', () => {
    const r = evaluateWorldQaFromRaw({
      objects,
      raw: {
        settingMatchesZone: true,
        objects: [{ label: 'the color gate', visible: true, consistentWithIdentity: false }],
        forbiddenScenePresent: false,
      },
    });
    expect(r.hardFailures).toContain('object_state_drift');
    expect(r.driftObjects).toEqual(['the color gate']);
  });

  it('hard-fails forbidden_scene', () => {
    const r = evaluateWorldQaFromRaw({
      objects,
      raw: { settingMatchesZone: true, objects: [], forbiddenScenePresent: true },
    });
    expect(r.hardFailures).toContain('forbidden_scene');
  });

  it('fail-closed: incomplete vision JSON → error, never pass', () => {
    const r = evaluateWorldQaFromRaw({ objects, raw: { notes: 'partial' } });
    expect(r.status).toBe('error');
    expect(r.passed).toBe(false);
  });

  it('prompt includes the zone, each object label, and forbidden settings', () => {
    const p = buildWorldQaPrompt({
      zoneDescription: 'outdoor gate threshold on the kindergarten path',
      objects,
      forbiddenScenes: ['indoor room', 'clinic'],
    });
    expect(p).toMatch(/outdoor gate threshold/);
    expect(p).toMatch(/the color gate/);
    expect(p).toMatch(/indoor room/);
    expect(p).toMatch(/wrong_zone/);
  });

  it('fails closed before Vision when any future field reintroduces an internal marker', () => {
    expect(() =>
      buildWorldQaPrompt({
        zoneDescription: 'room [spatial:floor]',
        objects,
        forbiddenScenes: [],
      }),
    ).toThrow('unresolved internal spatial reference marker');
    expect(() =>
      buildWorldQaPrompt({
        zoneDescription: 'spatial: awareness room',
        objects,
        forbiddenScenes: [],
      }),
    ).not.toThrow();
  });

  it('bounds world Vision with a per-call timeout and fails closed when it expires', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.PAGE_WORLD_QA_TIMEOUT_MS = '5';
    expect(resolvePageWorldQaTimeoutMs()).toBe(5);
    vi.spyOn(globalThis, 'fetch').mockImplementation((_, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        expect(signal).toBeInstanceOf(AbortSignal);
        signal?.addEventListener('abort', () => reject(signal.reason), {
          once: true,
        });
      }),
    );

    const result = await evaluatePageWorldQa({
      imageUrl: 'data:image/png;base64,AA==',
      zoneDescription: 'a quiet bedroom',
      objects: [],
      forbiddenScenes: [],
    });

    expect(result.status).toBe('error');
    expect(result.passed).toBe(false);
  });
});
