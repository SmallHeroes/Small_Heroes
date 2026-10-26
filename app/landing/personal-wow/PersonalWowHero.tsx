import { HeroDoodles } from '@/app/landing/hero-doodles';
import { PERSONAL_VOICE_STORIES } from '@/content/personal-landing';

import { VoiceStoryStage } from './VoiceStoryStage';

type HeroCopy = {
  badge: string;
  h1Line1: string;
  h1Line2: string;
  sub: string;
  ctaPrimary: string;
  ctaSecondary: string;
  /** Verified facts in a row under the actions (ages, how to tell us, who decides). */
  ctaNotes?: readonly string[];
};

function Sparkle() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 1.5l2.6 7.9 7.9 2.6-7.9 2.6L12 22.5l-2.6-7.9L1.5 12l7.9-2.6z" fill="currentColor" />
    </svg>
  );
}

function Mic() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5V21" />
    </svg>
  );
}

/**
 * The preview's hero: the same words, beside a child's story coming up picture by picture as a parent tells it.
 * Copy on the start side; on phones the story moves up between the headline and the text.
 */
export function PersonalWowHero({ hero, startHref, secondaryHref = '#how' }: { hero: HeroCopy; startHref: string; secondaryHref?: string }) {
  return (
    <section className="hero pw-hero">
      <HeroDoodles />
      <div className="wrap pw-hero-wrap">
        <div className="pw-copy">
          <p className="pw-badge">
            <Sparkle />
            {hero.badge}
          </p>
          <h1 className="pw-h1">
            <span className="pw-h1-a">{hero.h1Line1}</span>{' '}
            <span className="pw-h1-b">
              <span className="pw-ink">{hero.h1Line2}</span>
            </span>
          </h1>
          <p className="pw-sub">{hero.sub}</p>
          <div className="pw-ctas">
            <a href={startHref} className="btn-primary pw-cta" data-event="landing_start_click">
              <span className="pw-cta-mic">
                <Mic />
              </span>
              {hero.ctaPrimary}
            </a>
            <a href={secondaryHref} className="btn-light pw-cta-2">
              {hero.ctaSecondary}
            </a>
          </div>
          {hero.ctaNotes?.length ? (
            <ul className="pw-facts">
              {hero.ctaNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <VoiceStoryStage demo={PERSONAL_VOICE_STORIES} />
      </div>
    </section>
  );
}
