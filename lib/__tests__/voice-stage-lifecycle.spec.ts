import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import * as lifecycle from '../web/voice-stage-lifecycle';
import { createFamilyTransition, createStickerFlights, FAMILY_FADE_MS, type FlightHandle, type StageScheduler } from '../web/voice-stage-lifecycle';

/** A clock moved by hand: window timers plus animation frames (one frame = 16 ms). */
function fakeClock() {
  let now = 0;
  let id = 0;
  const tasks = new Map<number, { at: number; run: () => void; frame: boolean }>();
  const scheduler: StageScheduler = {
    setTimeout: (run, ms) => { tasks.set(++id, { at: now + ms, run, frame: false }); return id; },
    clearTimeout: (key) => { tasks.delete(key); },
    requestAnimationFrame: (run) => { tasks.set(++id, { at: now + 16, run, frame: true }); return id; },
    cancelAnimationFrame: (key) => { tasks.delete(key); },
  };
  const advance = (ms: number, afterEach?: () => void) => {
    const end = now + ms;
    for (let guard = 0; ; guard += 1) {
      if (guard > 10_000) throw new Error('clock did not settle');
      const next = [...tasks].filter(([, task]) => task.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) break;
      tasks.delete(next[0]);
      now = next[1].at;
      next[1].run();
      afterEach?.();
    }
    now = end;
  };
  return {
    scheduler,
    advance,
    pending: () => tasks.size,
    frames: () => [...tasks.values()].filter((task) => task.frame).length,
  };
}

function recordingStage() {
  const calls: string[] = [];
  return {
    calls,
    stage: {
      leave: () => { calls.push('leave'); },
      swap: (family: number) => { calls.push(`swap:${family}`); },
      jump: (family: number) => { calls.push(`jump:${family}`); },
      settle: () => { calls.push('settle'); },
    },
  };
}

/** The part of a Web Animation the stage touches, with its state visible to the test. */
class FakeFlight implements FlightHandle {
  playState = 'running';
  plays = 0;
  onfinish: (() => unknown) | null = null;
  play() { this.plays += 1; this.playState = 'running'; }
  pause() { if (this.playState === 'running') this.playState = 'paused'; }
  cancel() { this.playState = 'idle'; }
  finish() { this.playState = 'finished'; this.onfinish?.(); }
}

describe('family fade: one owned transition where the latest choice wins', () => {
  const setup = () => {
    const clock = fakeClock();
    const record = recordingStage();
    return { clock, calls: record.calls, transition: createFamilyTransition(clock.scheduler, record.stage) };
  };
  const throughFade = FAMILY_FADE_MS + 2 * 16;

  it('a press back to the family on stage during the fade wins over the first press', () => {
    const { clock, calls, transition } = setup();
    transition.request(1, true);
    transition.request(0, true);
    clock.advance(throughFade);
    expect(calls).toEqual(['leave', 'swap:0', 'settle']);
    expect(transition.shown).toBe(0);
    expect(clock.pending()).toBe(0);
  });

  it('the last of several rapid presses is the family shown, after a single fade', () => {
    const { clock, calls, transition } = setup();
    for (const family of [1, 2, 1, 2]) transition.request(family, true);
    clock.advance(throughFade);
    expect(calls).toEqual(['leave', 'swap:2', 'settle']);
    expect(transition.shown).toBe(2);
  });

  it('a manual press during the end-of-story fade replaces the automatic next family', () => {
    const { clock, calls, transition } = setup();
    transition.request((transition.shown + 1) % 3, true);
    expect(transition.pending).toBe(1);
    transition.request(2, true);
    clock.advance(throughFade);
    expect(calls).toEqual(['leave', 'swap:2', 'settle']);
  });

  it('a press after the swap but before the fade-in swaps again at once and settles once', () => {
    const { clock, calls, transition } = setup();
    transition.request(1, true);
    clock.advance(FAMILY_FADE_MS);
    transition.request(2, true);
    transition.request(2, true);
    clock.advance(2 * 16);
    expect(calls).toEqual(['leave', 'swap:1', 'swap:2', 'settle']);
    expect(clock.pending()).toBe(0);
  });

  it('pressing the family on stage outside a fade does nothing', () => {
    const { clock, calls, transition } = setup();
    transition.request(0, true);
    clock.advance(throughFade);
    expect(calls).toEqual([]);
  });

  it('reduced motion during a fade finishes it at once, and a later still choice is not overridden', () => {
    const { clock, calls, transition } = setup();
    transition.request(1, true);
    transition.stillness();
    expect(calls).toEqual(['leave', 'jump:1', 'settle']);
    expect(clock.pending()).toBe(0);
    transition.request(2, false);
    clock.advance(throughFade * 2);
    expect(calls).toEqual(['leave', 'jump:1', 'settle', 'jump:2']);
    expect(transition.shown).toBe(2);
  });

  it('a still press during a fade replaces it without motion and leaves nothing scheduled', () => {
    const { clock, calls, transition } = setup();
    transition.request(1, true);
    transition.request(2, false);
    clock.advance(throughFade);
    expect(calls).toEqual(['leave', 'jump:2', 'settle']);
    expect(clock.pending()).toBe(0);
  });

  it('reduced motion after the swap only brings the stage back and cancels the pending frame', () => {
    const { clock, calls, transition } = setup();
    transition.request(1, true);
    clock.advance(FAMILY_FADE_MS);
    expect(clock.frames()).toBe(1);
    transition.stillness();
    expect(calls).toEqual(['leave', 'swap:1', 'settle']);
    expect(clock.pending()).toBe(0);
  });

  it.each(['fading', 'between the two frames'])('unmount while %s leaves nothing scheduled and nothing runs later', (moment) => {
    const { clock, calls, transition } = setup();
    transition.request(1, true);
    if (moment !== 'fading') clock.advance(FAMILY_FADE_MS + 16);
    const before = [...calls];
    transition.dispose();
    expect(clock.pending()).toBe(0);
    transition.request(2, true);
    transition.stillness();
    clock.advance(throughFade * 2);
    expect(calls).toEqual(before);
  });
});

describe('sticker flights: held, settled and dropped with the stage', () => {
  it('pause and resume every flight with the stage, and start new ones held while it is held', () => {
    const flights = createStickerFlights();
    const a = new FakeFlight();
    const b = new FakeFlight();
    flights.start(0, a, () => {});
    flights.start(1, b, () => {});
    flights.run(false);
    expect([a.playState, b.playState]).toEqual(['paused', 'paused']);
    const c = new FakeFlight();
    flights.start(2, c, () => {});
    expect(c.playState).toBe('paused');
    flights.run(true);
    expect([a.playState, b.playState, c.playState]).toEqual(['running', 'running', 'running']);
  });

  it('reduced motion stops every flight and lands its sticker', () => {
    const flights = createStickerFlights();
    const landed: number[] = [];
    const a = new FakeFlight();
    const b = new FakeFlight();
    flights.start(0, a, (tag) => landed.push(tag));
    flights.start(1, b, (tag) => landed.push(tag));
    flights.settle();
    expect([a.playState, b.playState]).toEqual(['idle', 'idle']);
    expect(landed).toEqual([0, 1]);
    expect(flights.size).toBe(0);
  });

  it('a family change drops flights without landing them, and a late finish from the old family is ignored', () => {
    const flights = createStickerFlights();
    const landed: number[] = [];
    const old = new FakeFlight();
    flights.start(0, old, (tag) => landed.push(tag));
    const lateFinish = old.onfinish;
    flights.clear();
    expect(old.playState).toBe('idle');
    lateFinish?.();
    const next = new FakeFlight();
    flights.start(0, next, (tag) => landed.push(tag));
    lateFinish?.();
    expect(landed).toEqual([]);
    next.finish();
    expect(landed).toEqual([0]);
  });

  it('a new flight for the same sticker replaces the old one, whose finish no longer counts', () => {
    const flights = createStickerFlights();
    const landed: number[] = [];
    const first = new FakeFlight();
    flights.start(3, first, (tag) => landed.push(tag));
    const lateFinish = first.onfinish;
    flights.start(3, new FakeFlight(), (tag) => landed.push(tag));
    expect(first.playState).toBe('idle');
    lateFinish?.();
    expect(landed).toEqual([]);
  });

  it('resuming never replays a flight that has already finished', () => {
    const flights = createStickerFlights();
    const done = new FakeFlight();
    flights.start(0, done, () => {});
    done.playState = 'finished';
    flights.run(false);
    flights.run(true);
    expect(done.plays).toBe(0);
    expect(done.playState).toBe('finished');
  });
});

// The actual component, transpiled from the branch and run with modelled hooks, timers and Web
// Animations. This checks control flow only: no browser, layout, CSS or hydration.
describe('VoiceStoryStage (real TSX): pause and reduced motion govern every change', () => {
  const compiled = ts.transpileModule(readFileSync(join(process.cwd(), 'app/landing/personal-wow/VoiceStoryStage.tsx'), 'utf8'), {
    fileName: 'VoiceStoryStage.tsx',
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const names = ['Yuval', 'Bar', 'Aviv'];
  const demo = {
    label: 'synthetic', description: 'synthetic', pause: 'pause', play: 'play', show: 'show',
    stories: names.map((name) => ({ name, lines: [[{ text: `${name} said`, sticker: `${name} tag` }]], beats: [{ image: `/${name}.png` }] })),
  };
  // Timeline of one synthetic family: rest 600, line 120, rise 750, two words (115, then 700 after the
  // sticker phrase), colour 1250, hold 3800. The sticker flies once its phrase is said, at 1585 ms.
  const FLIGHT_AT = 600 + 120 + 750 + 115;
  const STORY_END = FLIGHT_AT + 700 + 1250 + 3800;
  const FADE = FAMILY_FADE_MS + 2 * 16;

  type Element = { type: unknown; props: Record<string, any>; key?: unknown };
  type Slot = { value?: unknown; set?: (value: unknown) => void; current?: unknown; deps?: unknown[]; cleanup?: () => void; effect?: boolean };

  function mount() {
    const clock = fakeClock();
    const media = { matches: false, listeners: new Set<() => void>(),
      addEventListener: (_: string, run: () => void) => media.listeners.add(run),
      removeEventListener: (_: string, run: () => void) => media.listeners.delete(run) };
    let intersect: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null;
    class FakeObserver {
      constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) { intersect = callback; }
      observe() { intersect?.([{ isIntersecting: true }]); }
      disconnect() { intersect = null; }
    }
    const flights: FakeFlight[] = [];
    const slots: Slot[] = [];
    let cursor = 0;
    let dirty = true;
    let mounted = true;
    let updatesAfterUnmount = 0;
    let effects: Array<() => void> = [];
    const same = (a?: unknown[], b?: unknown[]) => !!a && !!b && a.length === b.length && a.every((item, i) => Object.is(item, b[i]));
    const hooks = {
      useState(initial: unknown) {
        const key = cursor++;
        if (!slots[key]) slots[key] = { value: typeof initial === 'function' ? (initial as () => unknown)() : initial };
        const slot = slots[key];
        slot.set ??= (value: unknown) => {
          if (!mounted) { updatesAfterUnmount += 1; return; }
          const next = typeof value === 'function' ? (value as (prior: unknown) => unknown)(slot.value) : value;
          if (!Object.is(next, slot.value)) { slot.value = next; dirty = true; }
        };
        return [slot.value, slot.set];
      },
      useRef(initial: unknown) {
        const key = cursor++;
        slots[key] ??= { current: initial };
        return slots[key];
      },
      useMemo(make: () => unknown, deps: unknown[]) {
        const key = cursor++;
        if (!slots[key] || !same(slots[key].deps, deps)) slots[key] = { value: make(), deps };
        return slots[key].value;
      },
      useCallback(callback: unknown, deps: unknown[]) {
        return hooks.useMemo(() => callback, deps);
      },
      useEffect(run: () => void | (() => void), deps: unknown[]) {
        const key = cursor++;
        const prior = slots[key];
        if (prior && same(prior.deps, deps)) return;
        slots[key] = { deps, cleanup: prior?.cleanup, effect: true };
        effects.push(() => {
          slots[key].cleanup?.();
          const cleanup = run();
          slots[key].cleanup = typeof cleanup === 'function' ? cleanup : undefined;
        });
      },
    };
    const jsx = (type: unknown, props: Record<string, any>, key?: unknown): Element => ({ type, props: props ?? {}, key });
    const module = { exports: {} as Record<string, any> };
    vm.runInNewContext(compiled, {
      module, exports: module.exports,
      require: (name: string) => {
        if (name === 'react') return hooks;
        if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
        if (name === '@/lib/web/voice-stage-lifecycle') return lifecycle;
        throw new Error(`unexpected import: ${name}`);
      },
      window: { matchMedia: () => media, setTimeout: clock.scheduler.setTimeout, clearTimeout: clock.scheduler.clearTimeout },
      document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} },
      IntersectionObserver: FakeObserver,
      requestAnimationFrame: clock.scheduler.requestAnimationFrame,
      cancelAnimationFrame: clock.scheduler.cancelAnimationFrame,
    }, { filename: 'VoiceStoryStage.tsx' });

    let tree: Element;
    const nodes = new Map<string, object>();
    const visit = (value: unknown, found: (element: Element) => void) => {
      if (Array.isArray(value)) { value.forEach((item) => visit(item, found)); return; }
      if (!value || typeof value !== 'object' || !('props' in value)) return;
      found(value as Element);
      visit((value as Element).props.children, found);
    };
    const attachRefs = () => visit(tree, (element) => {
      const ref = element.props.ref;
      if (!ref) return;
      const id = `${String(element.type)}|${String(element.key)}|${element.props.className ?? ''}`;
      if (!nodes.has(id)) {
        const own: FakeFlight[] = [];
        nodes.set(id, {
          dataset: { tilt: String(element.props['data-tilt'] ?? '0') },
          getBoundingClientRect: () => ({ left: 0, top: 0, width: 80, height: 30 }),
          getAnimations: () => own.filter((flight) => flight.playState !== 'idle'),
          animate: () => { const flight = new FakeFlight(); own.push(flight); flights.push(flight); return flight; },
        });
      }
      if (typeof ref === 'function') ref(nodes.get(id));
      else ref.current = nodes.get(id);
    });
    const all = (match: (element: Element) => boolean) => {
      const found: Element[] = [];
      visit(tree, (element) => { if (match(element)) found.push(element); });
      return found;
    };
    // The family on stage, read from its picture (each synthetic family's one moment is `/<name>.png`).
    const current = () => String(all((e) => e.type === 'img' && e.props.className === 'vs-color')[0]?.props.src).replace(/^\//, '').replace(/\.png$/, '');
    // Every family that reached the stage, in order, so a wrong family shown in between is caught too.
    const history: string[] = [];
    const render = () => {
      for (let loops = 0; dirty; loops += 1) {
        if (loops > 50) throw new Error('render did not settle');
        dirty = false;
        cursor = 0;
        effects = [];
        tree = module.exports.VoiceStoryStage({ demo });
        if (history[history.length - 1] !== current()) history.push(current());
        attachRefs();
        const queued = effects;
        queued.forEach((effect) => effect());
      }
    };
    const press = (element: Element | undefined) => {
      if (!element) throw new Error('control not rendered');
      element.props.onClick();
      render();
    };
    render();
    return {
      flights,
      current,
      shownSince: (mark: number) => history.slice(mark),
      mark: () => history.length,
      stage: () => all((e) => e.type === 'figure')[0].props,
      tagLanded: () => all((e) => e.props.className === 'vs-tag').map((e) => e.props['data-landed']),
      byClass: (name: string) => all((e) => e.props.className === name),
      togglePause: () => press(all((e) => e.props.className === 'vs-toggle')[0]),
      reducedMotion: (on: boolean) => { media.matches = on; media.listeners.forEach((run) => run()); render(); },
      onScreen: (visible: boolean) => { intersect?.([{ isIntersecting: visible }]); render(); },
      advance: (ms: number) => clock.advance(ms, render),
      flush: () => { dirty = true; render(); },
      pending: () => clock.pending(),
      unmount: () => { mounted = false; slots.forEach((slot) => { if (slot?.effect) slot.cleanup?.(); }); },
      updatesAfterUnmount: () => updatesAfterUnmount,
    };
  }

  it('nothing sits under the stage: no family dots, the illustration note for screen readers only', () => {
    const stage = mount();
    expect(stage.byClass('vs-dot')).toHaveLength(0);
    expect(stage.byClass('vs-label')).toHaveLength(0);
    expect(stage.byClass('vs-sr').map((e) => e.props.children)).toContain('synthetic');
    // the pause control moving content must keep is still rendered (shown on keyboard focus by CSS)
    expect(stage.byClass('vs-toggle')).toHaveLength(1);
  });

  it('the families follow one another on their own: Yuval, then Bar, then Aviv', () => {
    const stage = mount();
    const mark = stage.mark();
    stage.advance(STORY_END + 1);
    expect(stage.stage()['data-leaving']).toBe('true');
    expect(stage.current()).toBe('Yuval');
    stage.advance(FADE + 2);
    expect(stage.current()).toBe('Bar');
    expect(stage.stage()['data-leaving']).toBe('false');
    stage.advance(STORY_END + FADE + 2);
    expect(stage.current()).toBe('Aviv');
    // after Yuval (on stage when marked): Bar, then Aviv, and no other family in between
    expect(stage.shownSince(mark)).toEqual(['Bar', 'Aviv']);
  });

  it('reduced motion during the automatic fade settles at once, and nothing is left scheduled', () => {
    const stage = mount();
    stage.advance(STORY_END + 1);
    expect(stage.stage()['data-leaving']).toBe('true');
    stage.reducedMotion(true);
    expect(stage.stage()['data-leaving']).toBe('false');
    stage.advance(FADE * 2);
    expect(stage.pending()).toBe(0);
    // a still stage offers no pause control: there is nothing to pause
    expect(stage.byClass('vs-toggle')).toHaveLength(0);
  });

  it.each([['during the fade', 0], ['between the swap and the fade-in', FAMILY_FADE_MS + 1]])('unmount %s leaves no timer and no late update', (_, wait) => {
    const stage = mount();
    stage.advance(STORY_END + 1);
    stage.advance(wait);
    stage.unmount();
    expect(stage.pending()).toBe(0);
    stage.advance(FADE * 2);
    expect(stage.updatesAfterUnmount()).toBe(0);
  });

  it('pause holds a sticker in flight, play resumes it, and scrolling away holds it too', () => {
    const stage = mount();
    stage.advance(FLIGHT_AT + 1);
    expect(stage.flights).toHaveLength(1);
    const [flight] = stage.flights;
    stage.togglePause();
    expect(flight.playState).toBe('paused');
    stage.togglePause();
    expect(flight.playState).toBe('running');
    stage.onScreen(false);
    expect(flight.playState).toBe('paused');
    stage.onScreen(true);
    expect(flight.playState).toBe('running');
  });

  it('reduced motion mid-flight stops the flight and lands its sticker, which stays landed if motion returns', () => {
    const stage = mount();
    stage.advance(FLIGHT_AT + 1);
    const [flight] = stage.flights;
    expect(stage.tagLanded()).toEqual(['false']);
    stage.reducedMotion(true);
    expect(flight.playState).toBe('idle');
    stage.reducedMotion(false);
    expect(stage.tagLanded()).toEqual(['true']);
  });

  it('the next family starts with its stickers unlanded, whatever the last one left', () => {
    const stage = mount();
    stage.advance(FLIGHT_AT + 1);
    const [flight] = stage.flights;
    const lateFinish = flight.onfinish;
    stage.advance(STORY_END + FADE + 2);
    expect(stage.current()).toBe('Bar');
    lateFinish?.();
    stage.flush();
    expect(stage.tagLanded()).toEqual(['false']);
  });
});
