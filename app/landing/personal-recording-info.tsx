import type { ReactNode } from 'react';
import { PERSONAL_RECORDING_INFO as R } from '@/content/personal-landing';

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

/* Order matches R.steps: talk · check the card · answer only what is missing */
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
      <path d="M4.5 5h15a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3.5V16h-3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
      <path d="M10 9.2a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.3" />
      <path d="M12 14.2v.01" />
    </LineIcon>
  ),
];

/* Order matches R.notes: the microphone · writing instead · where the recording goes */
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

/** How parents tell us about the child: a short recording, a card to check, a question only for what is missing. */
export function PersonalRecordingInfo({ startHref }: { startHref: string }) {
  return (
    <section id="personal-recording" className="personal-recording" aria-labelledby="personal-recording-title">
      <div className="wrap">
        <p className="personal-example-kicker">{R.kicker}</p>
        <h2 id="personal-recording-title" className="section-h2">
          {/* one sentence per line; the space keeps the heading's accessible name readable */}
          <span className="personal-recording-line">{R.title[0]}</span>{' '}
          <span className="personal-recording-line">{R.title[1]}</span>
        </h2>
        <p className="section-lede">{R.lede}</p>
        <ol className="personal-recording-steps">
          {R.steps.map((step, index) => (
            <li key={step.title} className="personal-recording-step">
              <span className="value-card-mark" aria-hidden="true">{STEP_ICONS[index]}</span>
              <h3 className="value-card-title">{step.title}</h3>
              <p className="value-card-body">{step.body}</p>
            </li>
          ))}
        </ol>
        <ul className="personal-recording-notes">
          {R.notes.map((note, index) => (
            <li key={note}>
              {NOTE_ICONS[index]}
              {note}
            </li>
          ))}
        </ul>
        <div className="personal-recording-foot">
          <a href={startHref} className="btn-primary" data-event="landing_start_click">
            {R.cta}
          </a>
          <p className="personal-recording-preview">{R.previewNote}</p>
        </div>
      </div>
    </section>
  );
}
