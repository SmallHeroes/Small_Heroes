import { setImmediate } from 'node:timers';
import { setTimeout } from 'node:timers/promises';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mode = process.env.SMALL_HEROES_COOPERATIVE_FIXTURE_MODE;

if (mode === 'positive') {
  let serviced = false;
  it('schedules real event-loop work while fake timers are active', () => {
    vi.useFakeTimers();
    setImmediate(() => { serviced = true; });
    expect(vi.isFakeTimers()).toBe(true);
  });
  it('services native work between completed tests despite fake clocks', () => {
    expect(serviced).toBe(true);
    expect(vi.isFakeTimers()).toBe(true);
    vi.useRealTimers();
  });
  afterAll(() => vi.useRealTimers());

  describe('base hook and snapshot lifecycle', () => {
    let entered = 0;
    let exited = 0;
    beforeEach(() => { entered += 1; });
    afterEach(() => { exited += 1; });
    it('retains hooks and inline snapshots', () => {
      expect(entered).toBe(1);
      expect({ safe: true }).toMatchInlineSnapshot(`
        {
          "safe": true,
        }
      `);
    });
    it('finishes the previous hook', () => {
      expect(entered).toBe(2);
      expect(exited).toBe(1);
    });
  });

  let arrived = 0;
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => { release = resolve; });
  it.concurrent.each([1, 2])('preserves concurrent task overlap %s', async () => {
    arrived += 1;
    if (arrived === 2) release();
    await barrier;
    expect(arrived).toBe(2);
  });
} else if (mode === 'assertion' || mode === 'bail') {
  it('intentional assertion failure', () => { expect('actual').toBe('expected'); });
  it('sentinel after failure', () => { expect(true).toBe(true); });
} else if (mode === 'timeout') {
  it('intentional default deadline failure', async () => { await setTimeout(5_500); });
} else if (mode === 'hook') {
  beforeEach(() => { throw new Error('intentional hook failure'); });
  it('cannot bypass failing hook', () => { expect(true).toBe(true); });
} else if (mode === 'unhandled') {
  it('intentional unhandled rejection', async () => {
    void Promise.reject(new Error('intentional unhandled failure'));
    await setTimeout(30);
    expect(true).toBe(true);
  });
} else {
  throw new Error('A closed fixture mode is required');
}
