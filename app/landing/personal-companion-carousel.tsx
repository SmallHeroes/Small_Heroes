'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { PERSONAL_COMPANION_CAROUSEL } from '@/content/personal-landing';
import { driftOffset, driftTimeForScroll, stillScrollLeft } from '@/lib/web/companion-carousel';

/** `paper` is the colour the card art is painted on; the picture well takes it so the art has no side bands. */
export type PersonalFriendCard = { id: string; name: string; line: string; image: string; paper?: string };

/**
 * The friends row on the personal landing (Guy 2026-10-05: show them all). Every companion the wizard offers
 * drifts by slowly in one seamless loop: the row is rendered twice and travels exactly one copy's width, so the
 * loop never jumps. A mouse over the row holds it, and it rests while off screen.
 *
 * Every card the parent can see is a working link to the wizard with that friend chosen. The loop's second copy
 * is only hidden from assistive technology and left out of the tab order (aria-hidden, tabIndex -1), so a reader
 * meets each friend once while a pointer can still choose any card in view.
 *
 * The button or keyboard focus stops the row: it becomes a still scroller of the same cards, opened exactly
 * where the drift stood. Keyboard focus keeps the focused friend in view, for Tab and Shift+Tab alike; the row
 * drifts again only on play, from wherever it was left. Reduced motion shows the still row from the start.
 */
export function PersonalCompanionCarousel({ friends, startHref }: { friends: PersonalFriendCard[]; startHref: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const [paused, setPaused] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  // Applied right after a mode switch renders and before it paints, so the change of mode never shows a jump.
  const openStillAt = useRef<number | null>(null);
  const revealOnStop = useRef<HTMLElement | null>(null);
  const resumeFrom = useRef<number | null>(null);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setOnScreen(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { rootMargin: '160px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // One copy's width: from the first friend to the same friend in the loop copy.
  const copyWidth = () => {
    const items = trackRef.current?.children;
    if (!items || items.length < friends.length * 2) return 0;
    return Math.abs(items[friends.length].getBoundingClientRect().left - items[0].getBoundingClientRect().left);
  };

  function stop(reveal?: HTMLElement) {
    if (paused) {
      reveal?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      return;
    }
    const track = trackRef.current;
    // Only a drifting row has a place to keep; a still (reduced-motion) row is already where the parent left it.
    openStillAt.current = track && track.getAnimations().length > 0
      ? driftOffset(new DOMMatrix(getComputedStyle(track).transform).m41, copyWidth())
      : null;
    revealOnStop.current = reveal ?? null;
    setPaused(true);
  }

  function play() {
    resumeFrom.current = viewportRef.current ? viewportRef.current.scrollLeft : 0;
    setPaused(false);
  }

  useLayoutEffect(() => {
    const viewport = viewportRef.current, track = trackRef.current;
    if (!viewport || !track) return;
    if (paused) {
      if (openStillAt.current !== null) viewport.scrollLeft = stillScrollLeft(openStillAt.current);
      revealOnStop.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      openStillAt.current = null;
      revealOnStop.current = null;
    } else if (resumeFrom.current !== null) {
      const drift = track.getAnimations()[0];
      const loopMs = Number(drift?.effect?.getTiming().duration);
      if (drift) drift.currentTime = driftTimeForScroll(resumeFrom.current, copyWidth(), loopMs);
      resumeFrom.current = null;
    }
    // copyWidth reads the live layout; only the mode switch should run this
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  if (!friends.length) return null;

  const card = (friend: PersonalFriendCard, copy: 'main' | 'loop') => (
    <li key={`${copy}-${friend.id}`} className="pcc-item" aria-hidden={copy === 'loop' || undefined}>
      <a
        className="mvp-challenge-card pcc-card"
        href={`${startHref}?companion=${encodeURIComponent(friend.id)}`}
        tabIndex={copy === 'loop' ? -1 : undefined}
        data-event="landing_companion_start"
        data-companion={friend.id}
      >
        <div className="mvp-challenge-card-img-wrap" style={friend.paper ? ({ '--pcc-paper': friend.paper } as CSSProperties) : undefined}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mvp-challenge-card-img" src={friend.image} alt="" loading="lazy" decoding="async" />
        </div>
        <div className="mvp-challenge-card-text">
          <span className="mvp-challenge-card-label">{friend.name}</span>
          {friend.line ? <span className="mvp-challenge-card-lead">{friend.line}</span> : null}
        </div>
      </a>
    </li>
  );

  return (
    <div
      ref={rootRef}
      className="pcc"
      role="region"
      aria-label={PERSONAL_COMPANION_CAROUSEL.label}
      data-paused={paused || undefined}
      data-onscreen={onScreen || undefined}
      style={{ '--pcc-count': friends.length } as CSSProperties}
    >
      <div
        ref={viewportRef}
        className="pcc-viewport"
        // Keyboard focus stops the drift for good (W3C carousel pattern) and keeps the focused friend in view.
        onFocus={(event) => {
          if (event.target instanceof HTMLElement && event.target.matches(':focus-visible')) stop(event.target);
        }}
      >
        <ul ref={trackRef} className="pcc-track">
          {friends.map((friend) => card(friend, 'main'))}
          {friends.map((friend) => card(friend, 'loop'))}
        </ul>
      </div>
      {/* the label names the action (W3C rotation control), so no aria-pressed on top of it */}
      <button type="button" className="pcc-toggle" onClick={() => (paused ? play() : stop())}>
        <span className="pcc-toggle-icon" aria-hidden="true">{paused ? '▶' : '❚❚'}</span>
        {paused ? PERSONAL_COMPANION_CAROUSEL.play : PERSONAL_COMPANION_CAROUSEL.pause}
      </button>
    </div>
  );
}
