import type { ReactNode } from 'react';
import { PERSONAL_HOW_IT_WORKS as H } from '@/content/personal-landing';

function LineIcon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

const MIC = (
  <LineIcon>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
    <path d="M12 17.5V21" />
  </LineIcon>
);

/* Order matches H.steps: talk · check and complete the card · choose a friend for the journey */
const STEP_ICONS = [
  MIC,
  (
    <LineIcon>
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <path d="M7.5 10h9" />
      <path d="M7.5 14h5.5" />
    </LineIcon>
  ),
  (
    <LineIcon>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c.6-3.3 2.8-5.2 5.5-5.2s4.9 1.9 5.5 5.2" />
      <circle cx="16.8" cy="9.2" r="2.5" />
      <path d="M15.6 14.5c2.5-.2 4.4 1.4 5 4.5" />
    </LineIcon>
  ),
];

/* Order matches H.notes: the microphone · writing instead · where the recording goes */
const NOTE_ICONS = [
  MIC,
  (
    <LineIcon>
      <path d="M4 20l4.2-1L19 8.2 15.8 5 5 15.8z" />
      <path d="M14 6.8l3.2 3.2" />
    </LineIcon>
  ),
  (
    <LineIcon>
      <path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3z" />
      <path d="M8.8 12.2l2.1 2.1 4.3-4.3" />
    </LineIcon>
  ),
];

/** The preview's "how it works", right after the hero: tell us by voice, check and complete, choose a friend. */
export function PersonalHowItWorks({ startHref }: { startHref: string }) {
  return (
    <section id="how" className="personal-how" aria-labelledby="personal-how-title">
      <div className="wrap">
        <p className="personal-kicker">{H.kicker}</p>
        <h2 id="personal-how-title" className="section-h2">
          {/* one sentence per line; the space keeps the heading's accessible name readable */}
          <span className="personal-how-line">{H.title[0]}</span>{' '}
          <span className="personal-how-line">{H.title[1]}</span>
        </h2>
        <p className="section-lede">{H.lede}</p>
        <ol className="personal-how-steps">
          {H.steps.map((step, index) => (
            <li key={step.title} className="personal-how-step">
              <span className="value-card-mark" aria-hidden="true">{STEP_ICONS[index]}</span>
              <h3 className="value-card-title">{step.title}</h3>
              <p className="value-card-body">{step.body}</p>
            </li>
          ))}
        </ol>
        <ul className="personal-how-notes">
          {H.notes.map((note, index) => (
            <li key={note}>
              {NOTE_ICONS[index]}
              {note}
            </li>
          ))}
        </ul>
        <div className="personal-how-foot">
          <a href={startHref} className="btn-primary" data-event="landing_start_click">
            {H.cta}
          </a>
          <p className="personal-how-preview">{H.previewNote}</p>
        </div>
      </div>
    </section>
  );
}
