/**
 * The living-story hero's motion that outlives a render: the fade from one family to the next, and the
 * stickers in flight. Both are owned here, so the latest choice always wins and nothing keeps running
 * after pause, reduced motion, a family change or unmount. Pure: the stage passes in its timers and
 * animation handles, which keeps every rule testable without a browser.
 */

/** The browser timing the stage uses (window timers and animation frames). */
export type StageScheduler = {
  setTimeout(run: () => void, ms: number): number;
  clearTimeout(id: number): void;
  requestAnimationFrame(run: () => void): number;
  cancelAnimationFrame(id: number): void;
};

/** What the stage does at each point of a family change. */
export type FamilySwitch = {
  /** Start fading the stage out. */
  leave(): void;
  /** While hidden: put `family` on stage from its beginning, with transitions off. */
  swap(family: number): void;
  /** Reduced motion: put `family` on stage from its beginning, at once. */
  jump(family: number): void;
  /** Fade the stage back in. */
  settle(): void;
};

export type FamilyTransition = {
  /** The family on stage. */
  readonly shown: number;
  /** Where a fade in progress is heading, or null. */
  readonly pending: number | null;
  /** A dot press or the end of a story. During a fade the latest request wins. */
  request(family: number, motionAllowed: boolean): void;
  /** Reduced motion came on: finish any change at once, without motion. */
  stillness(): void;
  /** Unmount: cancel the fade and its frames; later calls do nothing. */
  dispose(): void;
};

export const FAMILY_FADE_MS = 600;

/**
 * One owned fade: out, swap unseen, two frames for the reset to paint, back in. A request during the
 * fade replaces its target (even the family on stage, which then starts again), so the latest choice
 * wins; a request after the swap but before the fade-in swaps again at once.
 */
export function createFamilyTransition(
  scheduler: StageScheduler,
  stage: FamilySwitch,
  initial = 0,
  fadeMs = FAMILY_FADE_MS,
): FamilyTransition {
  let shown = initial;
  let target: number | null = null;
  let fade: number | null = null;
  let frame: number | null = null;
  let disposed = false;

  const stop = () => {
    if (fade !== null) scheduler.clearTimeout(fade);
    if (frame !== null) scheduler.cancelAnimationFrame(frame);
    fade = null;
    frame = null;
    target = null;
  };
  const settleAfterPaint = () => {
    frame = scheduler.requestAnimationFrame(() => {
      if (disposed) return;
      frame = scheduler.requestAnimationFrame(() => {
        if (disposed) return;
        frame = null;
        stage.settle();
      });
    });
  };
  const swapTo = (family: number) => {
    shown = family;
    stage.swap(family);
    settleAfterPaint();
  };

  return {
    get shown() { return shown; },
    get pending() { return target; },
    request(family, motionAllowed) {
      if (disposed) return;
      if (!motionAllowed) {
        const moving = fade !== null || frame !== null;
        stop();
        if (family !== shown) {
          shown = family;
          stage.jump(family);
        }
        if (moving) stage.settle();
        return;
      }
      if (fade !== null) {
        target = family;
        return;
      }
      if (frame !== null) {
        if (family === shown) return;
        scheduler.cancelAnimationFrame(frame);
        frame = null;
        swapTo(family);
        return;
      }
      if (family === shown) return;
      target = family;
      stage.leave();
      fade = scheduler.setTimeout(() => {
        if (disposed) return;
        const next = target ?? shown;
        fade = null;
        target = null;
        swapTo(next);
      }, fadeMs);
    },
    stillness() {
      if (disposed || (fade === null && frame === null)) return;
      const next = target;
      stop();
      if (next !== null) {
        shown = next;
        stage.jump(next);
      }
      stage.settle();
    },
    dispose() {
      disposed = true;
      stop();
    },
  };
}

/** The part of a Web Animation a sticker flight needs. */
export type FlightHandle = {
  readonly playState: string;
  play(): void;
  pause(): void;
  cancel(): void;
  onfinish: ((...args: never[]) => unknown) | null;
};

export type StickerFlights = {
  /** Own a flight that has just started; `land` runs once when it finishes, unless it was superseded. */
  start(tag: number, flight: FlightHandle, land: (tag: number) => void): void;
  /** Pause or resume every flight with the stage (pause, off screen, hidden tab, a fade). */
  run(running: boolean): void;
  /** Reduced motion: stop every flight and let its sticker land where it belongs. */
  settle(): void;
  /** A family change or unmount: stop every flight; nothing lands. */
  clear(): void;
  readonly size: number;
};

export function createStickerFlights(): StickerFlights {
  const flights = new Map<number, { flight: FlightHandle; land: (tag: number) => void }>();
  let running = true;

  const drop = (tag: number) => {
    const entry = flights.get(tag);
    if (!entry) return null;
    flights.delete(tag);
    entry.flight.onfinish = null;
    entry.flight.cancel();
    return entry;
  };

  return {
    start(tag, flight, land) {
      drop(tag);
      const entry = { flight, land };
      flights.set(tag, entry);
      // A late finish from a flight that was replaced or cleared must never land a sticker.
      flight.onfinish = () => {
        if (flights.get(tag) !== entry) return;
        flights.delete(tag);
        land(tag);
      };
      if (!running) flight.pause();
    },
    run(next) {
      running = next;
      for (const { flight } of flights.values()) {
        if (next && flight.playState === 'paused') flight.play();
        else if (!next && flight.playState === 'running') flight.pause();
      }
    },
    settle() {
      for (const tag of [...flights.keys()]) drop(tag)?.land(tag);
    },
    clear() {
      for (const tag of [...flights.keys()]) drop(tag);
    },
    get size() { return flights.size; },
  };
}
