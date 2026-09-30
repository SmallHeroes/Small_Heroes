'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Segment = { readonly text: string; readonly sticker?: string };
type Example = {
  readonly name: string;
  readonly companion: string;
  readonly companionImage: string;
  readonly art: string;
  readonly speech: readonly Segment[];
};
export type VoiceDemo = {
  readonly label: string;
  readonly description: string;
  readonly titlePrefix: string;
  readonly pause: string;
  readonly play: string;
  readonly show: string;
  readonly examples: readonly Example[];
};

/** Tokens in speaking order; spaces stay attached, so the bubble lays out like the whole sentence. */
function tokensOf(example: Example) {
  const tokens: Array<{ segment: number; text: string }> = [];
  example.speech.forEach((segment, index) => {
    for (const text of segment.text.match(/\S+\s*|\s+/g) ?? []) tokens.push({ segment: index, text });
  });
  return tokens;
}

/** Index of the last token of each segment (a sticker flies when its phrase is fully said). */
function segmentEnds(tokens: Array<{ segment: number }>) {
  const ends = new Map<number, number>();
  tokens.forEach((token, index) => ends.set(token.segment, index));
  return ends;
}

// Sticker resting tilt per slot, degrees (also used as the landing keyframe).
const SLOT_TILT = [-4, 3, -2];

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5V21" />
    </svg>
  );
}

function Spark({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 1.5l2.6 7.9 7.9 2.6-7.9 2.6L12 22.5l-2.6-7.9L1.5 12l7.9-2.6z" fill="currentColor" />
    </svg>
  );
}

/**
 * The hero's living demo. A parent's sentence types itself into a speech bubble; each highlighted
 * phrase peels off as a sticker onto the book's first page; then the adventure page colours itself in
 * and the child's name is written on the title. Three invented families take turns.
 *
 * Runs only while on screen, in a visible tab and with motion allowed; the pause control holds it.
 * Under reduced motion the first example is shown complete and the dots switch examples instantly.
 */
export function VoiceBookStage({ demo }: { demo: VoiceDemo }) {
  const total = demo.examples.length;
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [paused, setPaused] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [landed, setLanded] = useState<number[]>([]);
  const [warm, setWarm] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);
  const markRefs = useRef<Array<HTMLElement | null>>([]);
  const stickerRefs = useRef<Array<HTMLElement | null>>([]);
  const flown = useRef(new Set<number>());

  const example = demo.examples[index];
  const tokens = useMemo(() => tokensOf(example), [example]);
  const ends = useMemo(() => segmentEnds(tokens), [tokens]);
  const count = tokens.length;
  const stickerSegments = useMemo(
    () => example.speech.map((segment, position) => (segment.sticker ? position : -1)).filter((position) => position >= 0),
    [example],
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setMotionAllowed(!query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.3 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const sync = () => setPageVisible(document.visibilityState !== 'hidden');
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  // The finished state is what reduced motion shows, and what a static render starts from.
  const complete = !motionAllowed;
  const typed = complete ? count : Math.min(step, count);
  const colored = complete || step > count;
  const titled = complete || step > count + 1;
  const running = motionAllowed && !paused && onScreen && pageVisible && !leaving && !resetting;

  // Clears flown stickers so the next example starts on an empty page (no transitions while hidden).
  const swapTo = useCallback((next: number) => {
    for (const sticker of stickerRefs.current) sticker?.getAnimations().forEach((animation) => animation.cancel());
    flown.current = new Set();
    setLanded([]);
    setResetting(true);
    setIndex(next);
    setStep(0);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setResetting(false);
      setLeaving(false);
    }));
  }, []);

  const leaveTo = useCallback((next: number) => {
    setLeaving(true);
    window.setTimeout(() => swapTo(next), 450);
  }, [swapTo]);

  // The timeline: one token at a time, a pause after each finished phrase (its sticker is flying),
  // then colour, then the name, then a hold before the next family.
  useEffect(() => {
    if (!running) return;
    let delay: number;
    let next: () => void;
    if (step < count) {
      const justFinished = step > 0 && [...ends.entries()].some(([segment, end]) => end === step - 1 && example.speech[segment].sticker);
      delay = step === 0 ? 500 : justFinished ? 620 : /^\s+$/.test(tokens[step].text) ? 0 : 135;
      next = () => setStep((current) => current + 1);
    } else if (step === count) {
      delay = 750;
      next = () => setStep(count + 1);
    } else if (step === count + 1) {
      delay = 1250;
      next = () => setStep(count + 2);
    } else {
      delay = 3200;
      next = () => leaveTo((index + 1) % total);
    }
    const timer = window.setTimeout(next, delay);
    return () => window.clearTimeout(timer);
  }, [running, step, count, ends, example, tokens, index, total, leaveTo]);

  // A phrase that has just been said flies from the bubble to its slot on the page.
  useEffect(() => {
    if (complete) return;
    stickerSegments.forEach((segment, slot) => {
      const end = ends.get(segment);
      if (end === undefined || end >= typed || flown.current.has(segment)) return;
      flown.current.add(segment);
      const mark = markRefs.current[segment];
      const sticker = stickerRefs.current[slot];
      if (!mark || !sticker) return;
      const from = mark.getBoundingClientRect();
      const to = sticker.getBoundingClientRect();
      const dx = from.left + from.width / 2 - (to.left + to.width / 2);
      const dy = from.top + from.height / 2 - (to.top + to.height / 2);
      const tilt = SLOT_TILT[slot] ?? 0;
      // Hidden until the flight shows it, so it never flashes at its slot first; landed once it arrives.
      const flight = sticker.animate(
        // Individual properties (translate is applied outside rotate), so the path is not bent by the tilt.
        [
          { translate: `${dx}px ${dy}px`, scale: '0.6', rotate: '0deg', opacity: 0 },
          { translate: `${dx}px ${dy}px`, scale: '0.92', rotate: '0deg', opacity: 1, offset: 0.14 },
          { translate: `${dx * 0.45}px ${dy * 0.45 - 42}px`, scale: '1.1', rotate: `${tilt - 9}deg`, opacity: 1, offset: 0.6 },
          { translate: '0px 0px', scale: '1', rotate: `${tilt}deg`, opacity: 1 },
        ],
        { duration: 860, easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)', fill: 'forwards' },
      );
      flight.onfinish = () => setLanded((current) => (current.includes(slot) ? current : [...current, slot]));
    });
  }, [typed, complete, ends, stickerSegments]);

  // The other families' art starts loading once the first one is under way, never before first paint.
  useEffect(() => {
    if (warm || !running) return;
    const timer = window.setTimeout(() => setWarm(true), 1500);
    return () => window.clearTimeout(timer);
  }, [warm, running]);

  const choose = (next: number) => {
    if (next === index) return;
    if (!motionAllowed) {
      setIndex(next);
      return;
    }
    leaveTo(next);
  };

  const landedFor = (slot: number) => complete || landed.includes(slot);

  return (
    <figure
      className="vb-stage"
      ref={rootRef}
      data-talking={running && step > 0 && step <= count ? 'true' : 'false'}
      data-colored={colored ? 'true' : 'false'}
      data-titled={titled ? 'true' : 'false'}
      data-leaving={leaving ? 'true' : 'false'}
      data-resetting={resetting ? 'true' : 'false'}
      data-paused={!running ? 'true' : 'false'}
      aria-label={demo.description}
    >
      <svg className="vb-blob vb-blob--sun" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
        <path d="M44.6,-58.4C56.9,-47.7,65.2,-33.2,70.1,-17C75,-0.8,76.5,17.1,69.3,30.9C62.1,44.7,46.2,54.4,29.6,61.9C13,69.4,-4.3,74.8,-21.6,71.7C-38.9,68.6,-56.2,57.1,-66.6,41.2C-77,25.3,-80.5,5.1,-75.4,-12.1C-70.3,-29.2,-56.6,-43.2,-41.8,-53.5C-27,-63.9,-11,-70.6,3.3,-74.6C17.6,-78.6,32.3,-69.1,44.6,-58.4Z" transform="translate(100 100)" />
      </svg>
      <svg className="vb-blob vb-blob--lilac" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
        <path d="M39.9,-51.4C52.6,-43.7,64.3,-32.4,68.9,-18.5C73.5,-4.6,71,11.9,63.4,25.2C55.8,38.5,43.1,48.6,28.8,56.4C14.5,64.2,-1.4,69.7,-17.6,67.4C-33.8,65.1,-50.3,55,-61.1,40.4C-71.9,25.8,-77,6.7,-72.9,-10C-68.8,-26.7,-55.5,-41,-40.8,-48.4C-26.1,-55.8,-10,-56.3,3.5,-60.5C17,-64.7,27.2,-59.1,39.9,-51.4Z" transform="translate(100 100)" />
      </svg>
      <svg className="vb-blob vb-blob--coral" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
        <path d="M47.1,-57.2C60.4,-45.4,70.1,-29.9,72.4,-13.6C74.7,2.8,69.5,20,59.9,33.7C50.3,47.4,36.3,57.6,20.5,63.6C4.6,69.6,-13.1,71.4,-28.4,65.4C-43.7,59.4,-56.6,45.6,-64.4,29.3C-72.2,13,-74.9,-5.8,-69.2,-21.4C-63.5,-37,-49.4,-49.4,-34.4,-60.7C-19.4,-72,-3.5,-82.2,11.3,-79.7C26.1,-77.2,33.8,-69,47.1,-57.2Z" transform="translate(100 100)" />
      </svg>
      <Spark className="vb-float-spark vb-float-spark--a" />
      <Spark className="vb-float-spark vb-float-spark--b" />

      <div className="vb-talk" aria-hidden="true">
        <span className="vb-orb">
          <span className="vb-orb-ring" />
          <span className="vb-orb-ring vb-orb-ring--late" />
          <MicIcon />
        </span>
        <p className="vb-bubble">
          {example.speech.map((segment, position) => {
            const words = tokens
              .map((token, tokenIndex) => ({ ...token, tokenIndex }))
              .filter((token) => token.segment === position)
              .map((token) => (
                <span key={token.tokenIndex} className="vb-w" data-on={token.tokenIndex < typed ? 'true' : 'false'}>
                  {token.text}
                </span>
              ));
            if (!segment.sticker) return <span key={position}>{words}</span>;
            const end = ends.get(position) ?? 0;
            return (
              <mark
                key={position}
                className="vb-mark"
                ref={(node) => { markRefs.current[position] = node; }}
                data-lit={end < typed ? 'true' : 'false'}
              >
                {words}
              </mark>
            );
          })}
        </p>
      </div>

      <div className="vb-book">
        {demo.examples.map((item, position) => (
          <img
            key={item.companionImage}
            className="vb-companion"
            src={item.companionImage}
            alt=""
            aria-hidden="true"
            data-active={position === index ? 'true' : 'false'}
            loading={position === 0 ? 'eager' : 'lazy'}
            decoding="async"
            draggable={false}
          />
        ))}
        <div className="vb-cover" aria-hidden="true">
          <div className="vb-pages">
            <div className="vb-page vb-page--words">
              <span className="vb-title-small">{demo.titlePrefix}</span>
              <span className="vb-name">{example.name}</span>
              <span className="vb-with">{example.companion}</span>
              <span className="vb-stickers">
                {stickerSegments.map((segment, slot) => (
                  <span
                    key={`${index}-${segment}`}
                    className="vb-sticker"
                    data-slot={slot}
                    data-landed={landedFor(slot) ? 'true' : 'false'}
                    ref={(node) => { stickerRefs.current[slot] = node; }}
                  >
                    {example.speech[segment].sticker}
                  </span>
                ))}
              </span>
              <span className="vb-folio">1</span>
            </div>
            <div className="vb-page vb-page--art">
              <span className="vb-art">
                <img className="vb-art-sketch" src={example.art} alt="" draggable={false} />
                <img className="vb-art-color" src={example.art} alt="" draggable={false} />
              </span>
              <Spark className="vb-spark vb-spark--a" />
              <Spark className="vb-spark vb-spark--b" />
              <Spark className="vb-spark vb-spark--c" />
              <span className="vb-folio">2</span>
            </div>
            <span className="vb-gutter" />
          </div>
        </div>
        {/* warm the other families' art so a page turn never flashes */}
        {warm ? (
          <span className="vb-warm" aria-hidden="true">
            {demo.examples.filter((_, position) => position !== index).map((item) => (
              <img key={item.art} src={item.art} alt="" decoding="async" />
            ))}
          </span>
        ) : null}
      </div>

      <figcaption className="vb-foot">
        <span className="vb-controls">
          {motionAllowed ? (
            <button type="button" className="vb-toggle" onClick={() => setPaused((was) => !was)}>
              {paused ? (
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" /></svg>
              )}
              <span className="vb-sr">{paused ? demo.play : demo.pause}</span>
            </button>
          ) : null}
          {demo.examples.map((item, position) => (
            <button
              key={item.name}
              type="button"
              className="vb-dot"
              aria-label={`${demo.show} ${item.name}`}
              aria-current={position === index ? 'true' : undefined}
              onClick={() => choose(position)}
            />
          ))}
        </span>
        <span className="vb-label">{demo.label}</span>
      </figcaption>
    </figure>
  );
}
