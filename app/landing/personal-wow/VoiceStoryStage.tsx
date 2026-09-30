'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Segment = { readonly text: string; readonly sticker?: string };
export type VoiceStory = {
  readonly label: string;
  readonly description: string;
  readonly pause: string;
  readonly play: string;
  readonly title: string;
  readonly lines: readonly (readonly Segment[])[];
  readonly beats: readonly string[];
};

type Token = { segment: number; text: string };
type Event =
  | { kind: 'rest'; after: number }
  | { kind: 'line'; line: number; after: number }
  | { kind: 'rise'; beat: number; after: number }
  | { kind: 'type'; line: number; token: number; after: number }
  | { kind: 'color'; beat: number; after: number }
  | { kind: 'hush'; after: number }
  | { kind: 'title'; after: number }
  | { kind: 'end'; after: number };

type View = { line: number; typed: number; risen: number; colored: number; hushed: boolean; titled: boolean };

/** Tokens in speaking order; spaces stay attached, so the bubble lays out like the whole sentence. */
function tokensOf(line: readonly Segment[]): Token[] {
  const tokens: Token[] = [];
  line.forEach((segment, index) => {
    for (const text of segment.text.match(/\S+\s*|\s+/g) ?? []) tokens.push({ segment: index, text });
  });
  return tokens;
}

/** Index of the last token of each segment: a sticker flies when its phrase has been said. */
function segmentEnds(tokens: Token[]) {
  const ends = new Map<number, number>();
  tokens.forEach((token, index) => ends.set(token.segment, index));
  return ends;
}

/**
 * The whole story as one timeline. Per line: a moment rises out of the book (a pencil sketch), the
 * line is spoken, its phrases fly onto the moment, and the moment fills with colour. Then the voice
 * hushes, the last moment rises in colour and the book gets its title.
 */
function buildTimeline(story: VoiceStory): Event[] {
  const events: Event[] = [{ kind: 'rest', after: 700 }];
  story.lines.forEach((line, lineIndex) => {
    const tokens = tokensOf(line);
    const ends = segmentEnds(tokens);
    events.push({ kind: 'line', line: lineIndex, after: 150 });
    events.push({ kind: 'rise', beat: lineIndex, after: 850 });
    tokens.forEach((token, tokenIndex) => {
      const endsSticker = [...ends.entries()].some(([segment, end]) => end === tokenIndex && line[segment].sticker);
      events.push({ kind: 'type', line: lineIndex, token: tokenIndex, after: endsSticker ? 720 : /^\s+$/.test(token.text) ? 0 : 118 });
    });
    events.push({ kind: 'color', beat: lineIndex, after: 1500 });
  });
  const last = story.lines.length;
  events.push({ kind: 'hush', after: 350 });
  events.push({ kind: 'rise', beat: last, after: 650 });
  events.push({ kind: 'color', beat: last, after: 900 });
  events.push({ kind: 'title', after: 4200 });
  events.push({ kind: 'end', after: 0 });
  return events;
}

function viewAt(events: Event[], step: number): View {
  const view: View = { line: -1, typed: 0, risen: 0, colored: 0, hushed: false, titled: false };
  for (let index = 0; index <= step && index < events.length; index += 1) {
    const event = events[index];
    if (event.kind === 'line') {
      view.line = event.line;
      view.typed = 0;
    } else if (event.kind === 'type') view.typed = event.token + 1;
    else if (event.kind === 'rise') view.risen = Math.max(view.risen, event.beat + 1);
    else if (event.kind === 'color') view.colored = Math.max(view.colored, event.beat + 1);
    else if (event.kind === 'hush') view.hushed = true;
    else if (event.kind === 'title') view.titled = true;
  }
  return view;
}

// The voice's path, from the orb on the start side, round and down into the book's spine.
const RIBBON = 'M 905 110 C 1010 260, 900 420, 760 455 C 610 492, 560 560, 500 668';

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
 * The hero's living story. Runs only while on screen, in a visible tab and with motion allowed; the
 * pause control holds it. Under reduced motion the finished story is shown, both lines in the bubble.
 */
export function VoiceStoryStage({ story }: { story: VoiceStory }) {
  const events = useMemo(() => buildTimeline(story), [story]);
  const lineTokens = useMemo(() => story.lines.map((line) => tokensOf(line)), [story]);
  const lineEnds = useMemo(() => lineTokens.map((tokens) => segmentEnds(tokens)), [lineTokens]);
  const stickers = useMemo(
    () => story.lines.flatMap((line, lineIndex) =>
      line.flatMap((segment, segmentIndex) => (segment.sticker ? [{ line: lineIndex, segment: segmentIndex, text: segment.sticker }] : [])),
    ),
    [story],
  );

  const [step, setStep] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [paused, setPaused] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [landed, setLanded] = useState<number[]>([]);
  const rootRef = useRef<HTMLElement | null>(null);
  const markRefs = useRef(new Map<string, HTMLElement>());
  const stickerRefs = useRef<Array<HTMLElement | null>>([]);
  const flown = useRef(new Set<number>());

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
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.25 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const sync = () => setPageVisible(document.visibilityState !== 'hidden');
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  const complete = !motionAllowed;
  const view: View = complete
    ? { line: story.lines.length - 1, typed: Number.MAX_SAFE_INTEGER, risen: story.beats.length, colored: story.beats.length, hushed: false, titled: true }
    : viewAt(events, step);
  const running = motionAllowed && !paused && onScreen && pageVisible && !leaving && !resetting;
  const currentTokens = view.line >= 0 ? lineTokens[view.line] : [];
  const talking = running && view.line >= 0 && !view.hushed && view.typed < currentTokens.length;

  const restart = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => {
      for (const sticker of stickerRefs.current) sticker?.getAnimations().forEach((animation) => animation.cancel());
      flown.current = new Set();
      setLanded([]);
      setResetting(true);
      setStep(0);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setResetting(false);
        setLeaving(false);
      }));
    }, 650);
  }, []);

  useEffect(() => {
    if (!running) return;
    const event = events[step];
    if (!event) return;
    const timer = window.setTimeout(() => {
      if (event.kind === 'end') restart();
      else setStep((current) => current + 1);
    }, event.after);
    return () => window.clearTimeout(timer);
  }, [running, step, events, restart]);

  // A phrase that has just been said flies from the bubble onto its moment.
  useEffect(() => {
    if (complete || view.line < 0) return;
    const ends = lineEnds[view.line];
    stickers.forEach((sticker, index) => {
      if (sticker.line !== view.line || flown.current.has(index)) return;
      const end = ends.get(sticker.segment);
      if (end === undefined || end >= view.typed) return;
      flown.current.add(index);
      const mark = markRefs.current.get(`${sticker.line}-${sticker.segment}`);
      const target = stickerRefs.current[index];
      if (!mark || !target) return;
      const from = mark.getBoundingClientRect();
      const to = target.getBoundingClientRect();
      const dx = from.left + from.width / 2 - (to.left + to.width / 2);
      const dy = from.top + from.height / 2 - (to.top + to.height / 2);
      const tilt = Number(target.dataset.tilt ?? 0);
      const flight = target.animate(
        [
          { translate: `${dx}px ${dy}px`, scale: '0.6', rotate: '0deg', opacity: 0 },
          { translate: `${dx}px ${dy}px`, scale: '0.95', rotate: '0deg', opacity: 1, offset: 0.14 },
          { translate: `${dx * 0.45}px ${dy * 0.45 - 48}px`, scale: '1.12', rotate: `${tilt - 10}deg`, opacity: 1, offset: 0.6 },
          { translate: '0px 0px', scale: '1', rotate: `${tilt}deg`, opacity: 1 },
        ],
        { duration: 880, easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)', fill: 'forwards' },
      );
      flight.onfinish = () => setLanded((current) => (current.includes(index) ? current : [...current, index]));
    });
  }, [view.line, view.typed, complete, lineEnds, stickers]);

  const bubbleLines = complete ? story.lines.map((_, index) => index) : view.line >= 0 && !view.hushed ? [view.line] : [];

  return (
    <figure
      className="vs"
      ref={rootRef}
      aria-label={story.description}
      data-talking={talking ? 'true' : 'false'}
      data-voice={view.line >= 0 ? 'true' : 'false'}
      data-titled={view.titled ? 'true' : 'false'}
      data-glow={view.risen > 0 ? 'true' : 'false'}
      data-leaving={leaving ? 'true' : 'false'}
      data-resetting={resetting ? 'true' : 'false'}
      data-paused={!running ? 'true' : 'false'}
    >
      <div className="vs-stage">
        <span className="vs-bokeh vs-bokeh--a" aria-hidden="true" />
        <span className="vs-bokeh vs-bokeh--b" aria-hidden="true" />
        <span className="vs-bokeh vs-bokeh--c" aria-hidden="true" />

        <svg className="vs-ribbon" viewBox="0 0 1000 960" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="vs-ribbon-ink" x1="1" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#9349e5" />
              <stop offset="0.55" stopColor="#ff8a65" />
              <stop offset="1" stopColor="#ffd745" />
            </linearGradient>
          </defs>
          <path className="vs-ribbon-glow" d={RIBBON} pathLength={1} />
          <path className="vs-ribbon-line" d={RIBBON} pathLength={1} />
          {talking ? (
            <g className="vs-motes">
              {[0, 0.7, 1.4].map((delay) => (
                <circle key={delay} r="7">
                  <animateMotion dur="2.1s" begin={`${delay}s`} repeatCount="indefinite" path={RIBBON} />
                </circle>
              ))}
            </g>
          ) : null}
        </svg>

        <div className="vs-book" aria-hidden="true">
          <svg viewBox="0 0 600 220">
            <defs>
              <linearGradient id="vs-page-r" x1="1" y1="0" x2="0" y2="0">
                <stop offset="0" stopColor="#fffaf1" />
                <stop offset="0.82" stopColor="#fff4e3" />
                <stop offset="1" stopColor="#e8d4b3" />
              </linearGradient>
              <linearGradient id="vs-page-l" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#fffaf1" />
                <stop offset="0.82" stopColor="#fff4e3" />
                <stop offset="1" stopColor="#e8d4b3" />
              </linearGradient>
            </defs>
            <path className="vs-book-cover" d="M14,74 Q150,42 300,70 Q450,42 586,74 L586,200 Q450,176 300,212 Q150,176 14,200 Z" />
            <path className="vs-book-edge" d="M26,64 Q160,32 300,60 Q440,32 574,64 L574,190 Q440,165 300,198 Q160,165 26,190 Z" />
            <path d="M30,56 Q165,22 300,52 L300,188 Q165,158 30,182 Z" fill="url(#vs-page-l)" />
            <path d="M570,56 Q435,22 300,52 L300,188 Q435,158 570,182 Z" fill="url(#vs-page-r)" />
            <path className="vs-book-gutter" d="M300,52 L300,188" />
          </svg>
        </div>

        <span className="vs-dust" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </span>

        {story.beats.map((beat, index) => (
          <span
            key={beat}
            className="vs-card"
            data-card={index}
            data-risen={index < view.risen ? 'true' : 'false'}
            data-colored={index < view.colored ? 'true' : 'false'}
            aria-hidden="true"
          >
            <span className="vs-card-frame">
              <span className="vs-card-art">
                <img className="vs-sketch" src={beat} alt="" draggable={false} loading={index === 0 ? 'eager' : 'lazy'} />
                <img className="vs-color" src={beat} alt="" draggable={false} loading={index === 0 ? 'eager' : 'lazy'} />
              </span>
            </span>
            <Spark className="vs-card-spark vs-card-spark--a" />
            <Spark className="vs-card-spark vs-card-spark--b" />
          </span>
        ))}

        <span className="vs-title" aria-hidden="true">
          <Spark className="vs-title-spark" />
          {story.title}
          <Spark className="vs-title-spark" />
        </span>

        <div className="vs-voice" aria-hidden="true">
          <span className="vs-orb">
            <span className="vs-orb-ring" />
            <span className="vs-orb-ring vs-orb-ring--late" />
            <MicIcon />
          </span>
          <p className="vs-bubble" data-empty={bubbleLines.length === 0 ? 'true' : 'false'}>
            {bubbleLines.map((lineIndex) => {
              const tokens = lineTokens[lineIndex];
              const ends = lineEnds[lineIndex];
              const typed = complete ? tokens.length : view.typed;
              return (
                <span key={lineIndex} className="vs-line">
                  {story.lines[lineIndex].map((segment, segmentIndex) => {
                    const words = tokens
                      .map((token, tokenIndex) => ({ ...token, tokenIndex }))
                      .filter((token) => token.segment === segmentIndex)
                      .map((token) => (
                        <span key={token.tokenIndex} className="vs-w" data-on={token.tokenIndex < typed ? 'true' : 'false'}>
                          {token.text}
                        </span>
                      ));
                    if (!segment.sticker) return <span key={segmentIndex}>{words}</span>;
                    const end = ends.get(segmentIndex) ?? 0;
                    return (
                      <mark
                        key={segmentIndex}
                        className="vs-mark"
                        data-lit={end < typed ? 'true' : 'false'}
                        ref={(node) => {
                          const key = `${lineIndex}-${segmentIndex}`;
                          if (node) markRefs.current.set(key, node);
                          else markRefs.current.delete(key);
                        }}
                      >
                        {words}
                      </mark>
                    );
                  })}{' '}
                </span>
              );
            })}
          </p>
        </div>

        {stickers.map((sticker, index) => (
          <span
            key={`${sticker.line}-${sticker.segment}`}
            className="vs-sticker"
            data-sticker={index}
            data-tilt={[-5, 4, -3][index] ?? 0}
            data-landed={complete || landed.includes(index) ? 'true' : 'false'}
            ref={(node) => { stickerRefs.current[index] = node; }}
            aria-hidden="true"
          >
            {sticker.text}
          </span>
        ))}
      </div>

      <figcaption className="vs-foot">
        {motionAllowed ? (
          <button type="button" className="vs-toggle" onClick={() => setPaused((was) => !was)}>
            {paused ? (
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" /></svg>
            )}
            <span className="vs-sr">{paused ? story.play : story.pause}</span>
          </button>
        ) : null}
        <span className="vs-label">{story.label}</span>
      </figcaption>
    </figure>
  );
}
