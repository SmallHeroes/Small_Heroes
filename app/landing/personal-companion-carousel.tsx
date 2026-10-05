'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { PERSONAL_COMPANION_CAROUSEL } from '@/content/personal-landing';

export type PersonalFriendCard = { id: string; name: string; line: string; image: string };

/**
 * The friends row on the personal landing (Guy 2026-10-05: show them all). Every companion the wizard offers
 * drifts by slowly in one seamless loop: the row is rendered twice and travels exactly one copy's width, so the
 * loop never jumps. A mouse over the row holds it; keyboard focus or the button stops it until the parent
 * presses play again; it rests while off screen. Reduced motion shows a still row that scrolls by hand.
 * Each friend is ONE real link into the wizard with that friend chosen; the loop's second copy is inert.
 */
export function PersonalCompanionCarousel({ friends, startHref }: { friends: PersonalFriendCard[]; startHref: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [onScreen, setOnScreen] = useState(false);

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

  if (!friends.length) return null;

  const card = (friend: PersonalFriendCard, copy: 'main' | 'loop') => (
    <li key={`${copy}-${friend.id}`} className="pcc-item" aria-hidden={copy === 'loop' || undefined} inert={copy === 'loop' || undefined}>
      <a
        className="mvp-challenge-card pcc-card"
        href={`${startHref}?companion=${encodeURIComponent(friend.id)}`}
        data-event={copy === 'main' ? 'landing_companion_start' : undefined}
        data-companion={friend.id}
      >
        <div className="mvp-challenge-card-img-wrap">
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
        className="pcc-viewport"
        // Keyboard focus stops the drift for good (W3C carousel pattern): it resumes only on the play button.
        onFocus={(event) => {
          if (event.target instanceof HTMLElement && event.target.matches(':focus-visible')) setPaused(true);
        }}
      >
        <ul className="pcc-track">
          {friends.map((friend) => card(friend, 'main'))}
          {friends.map((friend) => card(friend, 'loop'))}
        </ul>
      </div>
      {/* the label names the action (W3C rotation control), so no aria-pressed on top of it */}
      <button type="button" className="pcc-toggle" onClick={() => setPaused((current) => !current)}>
        <span className="pcc-toggle-icon" aria-hidden="true">{paused ? '▶' : '❚❚'}</span>
        {paused ? PERSONAL_COMPANION_CAROUSEL.play : PERSONAL_COMPANION_CAROUSEL.pause}
      </button>
    </div>
  );
}
