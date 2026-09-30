'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Segment = { readonly text: string; readonly sticker?: string };
type Beat = { readonly image: string; readonly portrait?: boolean };
type Story = {
  readonly name: string;
  readonly lines: readonly (readonly Segment[])[];
  readonly beats: readonly Beat[];
};
export type VoiceStories = {
  readonly label: string;
  readonly description: string;
  readonly pause: string;
  readonly play: string;
  readonly show: string;
  readonly stories: readonly Story[];
};

type Token = { segment: number; text: string };
type Event =
  | { kind: 'rest'; after: number }
  | { kind: 'line'; line: number; after: number }
  | { kind: 'rise'; beat: number; after: number }
  | { kind: 'type'; token: number; after: number }
  | { kind: 'color'; beat: number; after: number }
  | { kind: 'hold'; after: number }
  | { kind: 'end'; after: number };

type View = { line: number; typed: number; risen: number; colored: number };

/** Tokens in speaking order; spaces stay attached, so the bubble lays out like the whole sentence. */
function tokensOf(line: readonly Segment[]): Token[] {
  const tokens: Token[] = [];
  line.forEach((segment, index) => {
    for (const text of segment.text.match(/\S+\s*|\s+/g) ?? []) tokens.push({ segment: index, text });
  });
  return tokens;
}

/** Index of the last token of each segment: a tag flies when its phrase has been said. */
function segmentEnds(tokens: Token[]) {
  const ends = new Map<number, number>();
  tokens.forEach((token, index) => ends.set(token.segment, index));
  return ends;
}

/**
 * One story as a timeline. Per spoken line: its moment comes up as a pencil sketch, the line is said,
 * each highlighted phrase flies onto the moment as a tag, and the moment fills with colour. Then a
 * hold on the finished story, and the next family.
 */
function buildTimeline(story: Story): Event[] {
  const events: Event[] = [{ kind: 'rest', after: 600 }];
  story.lines.forEach((line, lineIndex) => {
    const tokens = tokensOf(line);
    const ends = segmentEnds(tokens);
    events.push({ kind: 'line', line: lineIndex, after: 120 });
    events.push({ kind: 'rise', beat: lineIndex, after: 750 });
    tokens.forEach((token, tokenIndex) => {
      const endsTag = [...ends.entries()].some(([segment, end]) => end === tokenIndex && line[segment].sticker);
      events.push({ kind: 'type', token: tokenIndex, after: endsTag ? 700 : /^\s+$/.test(token.text) ? 0 : 115 });
    });
    events.push({ kind: 'color', beat: lineIndex, after: 1250 });
  });
  events.push({ kind: 'hold', after: 3800 });
  events.push({ kind: 'end', after: 0 });
  return events;
}

function viewAt(events: Event[], step: number): View {
  const view: View = { line: -1, typed: 0, risen: 0, colored: 0 };
  for (let index = 0; index <= step && index < events.length; index += 1) {
    const event = events[index];
    if (event.kind === 'line') {
      view.line = event.line;
      view.typed = 0;
    } else if (event.kind === 'type') view.typed = event.token + 1;
    else if (event.kind === 'rise') view.risen = Math.max(view.risen, event.beat + 1);
    else if (event.kind === 'color') view.colored = Math.max(view.colored, event.beat + 1);
  }
  return view;
}

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
 * The hero's living stories. Runs only while on screen, in a visible tab and with motion allowed; the
 * pause control holds it and the dots choose a family. Under reduced motion a finished story is shown
 * (its opening line in the bubble, every moment in colour and tagged) and the dots switch families instantly.
 */
export function VoiceStoryStage({ demo }: { demo: VoiceStories }) {
  const total = demo.stories.length;
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
  const markRefs = useRef(new Map<string, HTMLElement>());
  const tagRefs = useRef<Array<HTMLElement | null>>([]);
  const flown = useRef(new Set<number>());

  const story = demo.stories[index];
  const events = useMemo(() => buildTimeline(story), [story]);
  const lineTokens = useMemo(() => story.lines.map((line) => tokensOf(line)), [story]);
  const lineEnds = useMemo(() => lineTokens.map((tokens) => segmentEnds(tokens)), [lineTokens]);
  // Every tag, in speaking order: which line (and so which moment) it belongs to, and its slot there.
  const tags = useMemo(
    () => story.lines.flatMap((line, lineIndex) => {
      let slot = 0;
      return line.flatMap((segment, segmentIndex) => (segment.sticker ? [{ line: lineIndex, segment: segmentIndex, text: segment.sticker, slot: slot++ }] : []));
    }),
    [story],
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
    ? { line: story.lines.length - 1, typed: Number.MAX_SAFE_INTEGER, risen: story.beats.length, colored: story.beats.length }
    : viewAt(events, step);
  const running = motionAllowed && !paused && onScreen && pageVisible && !leaving && !resetting;
  const talking = running && view.line >= 0 && view.typed < (lineTokens[view.line]?.length ?? 0);

  // Fade out, change family unseen (no transitions while hidden), fade back in.
  const leaveTo = useCallback((next: number) => {
    setLeaving(true);
    window.setTimeout(() => {
      for (const tag of tagRefs.current) tag?.getAnimations().forEach((animation) => animation.cancel());
      flown.current = new Set();
      setLanded([]);
      setResetting(true);
      setIndex(next);
      setStep(0);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setResetting(false);
        setLeaving(false);
      }));
    }, 600);
  }, []);

  useEffect(() => {
    if (!running) return;
    const event = events[step];
    if (!event) return;
    const timer = window.setTimeout(() => {
      if (event.kind === 'end') leaveTo((index + 1) % total);
      else setStep((current) => current + 1);
    }, event.after);
    return () => window.clearTimeout(timer);
  }, [running, step, events, leaveTo, index, total]);

  // A phrase that has just been said flies from the bubble onto its moment.
  useEffect(() => {
    if (complete || view.line < 0) return;
    const ends = lineEnds[view.line];
    tags.forEach((tag, tagIndex) => {
      if (tag.line !== view.line || flown.current.has(tagIndex)) return;
      const end = ends.get(tag.segment);
      if (end === undefined || end >= view.typed) return;
      flown.current.add(tagIndex);
      const mark = markRefs.current.get(`${tag.line}-${tag.segment}`);
      const target = tagRefs.current[tagIndex];
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
        { duration: 860, easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)', fill: 'forwards' },
      );
      flight.onfinish = () => setLanded((current) => (current.includes(tagIndex) ? current : [...current, tagIndex]));
    });
  }, [view.line, view.typed, complete, lineEnds, tags]);

  // The other families' pictures start loading once the first is under way, never before first paint.
  useEffect(() => {
    if (warm || !running) return;
    const timer = window.setTimeout(() => setWarm(true), 2000);
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

  // Still (reduced motion): the opening line only; the tags on the pictures carry the rest.
  const bubbleLines = complete ? [0] : view.line >= 0 ? [view.line] : [];

  return (
    <figure
      className="vs"
      ref={rootRef}
      aria-label={demo.description}
      data-talking={talking ? 'true' : 'false'}
      data-leaving={leaving ? 'true' : 'false'}
      data-resetting={resetting ? 'true' : 'false'}
      data-paused={!running ? 'true' : 'false'}
      data-complete={complete ? 'true' : 'false'}
    >
      <div className="vs-stage">
        <span className="vs-bokeh vs-bokeh--a" aria-hidden="true" />
        <span className="vs-bokeh vs-bokeh--b" aria-hidden="true" />

        {story.beats.map((beat, beatIndex) => (
          <span
            key={`${index}-${beat.image}`}
            className="vs-card"
            data-card={beatIndex}
            data-portrait={beat.portrait ? 'true' : 'false'}
            data-risen={beatIndex < view.risen ? 'true' : 'false'}
            data-colored={beatIndex < view.colored ? 'true' : 'false'}
            aria-hidden="true"
          >
            <span className="vs-card-frame">
              <span className="vs-card-art">
                <img className="vs-sketch" src={beat.image} alt="" draggable={false} />
                <img className="vs-color" src={beat.image} alt="" draggable={false} />
              </span>
            </span>
            <Spark className="vs-card-spark vs-card-spark--a" />
            <Spark className="vs-card-spark vs-card-spark--b" />
          </span>
        ))}

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

        {tags.map((tag, tagIndex) => (
          <span
            key={`${index}-${tag.line}-${tag.segment}`}
            className="vs-tag"
            data-beat={tag.line}
            data-slot={tag.slot}
            data-tilt={tag.slot === 0 ? [-5, 4, -4][tag.line] ?? 0 : 3}
            data-landed={complete || landed.includes(tagIndex) ? 'true' : 'false'}
            ref={(node) => { tagRefs.current[tagIndex] = node; }}
            aria-hidden="true"
          >
            {tag.text}
          </span>
        ))}

        {/* warm the other families' pictures so a change of story never flashes */}
        {warm ? (
          <span className="vs-warm" aria-hidden="true">
            {demo.stories.filter((_, storyIndex) => storyIndex !== index).flatMap((item) => item.beats).map((beat) => (
              <img key={beat.image} src={beat.image} alt="" decoding="async" />
            ))}
          </span>
        ) : null}
      </div>

      <figcaption className="vs-foot">
        <span className="vs-controls">
          {motionAllowed ? (
            <button type="button" className="vs-toggle" onClick={() => setPaused((was) => !was)}>
              {paused ? (
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" /></svg>
              )}
              <span className="vs-sr">{paused ? demo.play : demo.pause}</span>
            </button>
          ) : null}
          {demo.stories.map((item, storyIndex) => (
            <button
              key={item.name}
              type="button"
              className="vs-dot"
              aria-label={`${demo.show} ${item.name}`}
              aria-current={storyIndex === index ? 'true' : undefined}
              onClick={() => choose(storyIndex)}
            />
          ))}
        </span>
        <span className="vs-label">{demo.label}</span>
      </figcaption>
    </figure>
  );
}
