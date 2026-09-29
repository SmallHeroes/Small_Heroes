'use client';

import { useEffect, useState, type RefObject } from 'react';

import styles from './personal-wizard.module.css';

type Props = {
  title: string;
  /** What organising does, in order. Shown one after another; not a progress report. */
  steps: readonly string[];
  /** Announced once to screen readers instead of every rotating step. */
  status: string;
  cancelLabel: string;
  onCancel: () => void;
  titleRef: RefObject<HTMLHeadingElement | null>;
};

const STEP_MS = 2200;

/**
 * The processing screen: only a "decoding" animation (sound bars flowing into lines of text),
 * the title, the step being described and a cancel link. The steps advance on a timer and stop at
 * the last one; they describe the kind of work, never claim how far a real job has got.
 */
export function DecodingView({ title, steps, status, cancelLabel, onCancel, titleRef }: Props) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (index >= steps.length - 1) return;
    const timer = window.setTimeout(() => setIndex((current) => Math.min(current + 1, steps.length - 1)), STEP_MS);
    return () => window.clearTimeout(timer);
  }, [index, steps.length]);

  return (
    <section className={styles.processingView} aria-labelledby="pw-step-title" aria-busy="true">
      <div className={styles.decodeArt} aria-hidden="true">
        <span className={styles.decodeWave}>
          {[0, 1, 2, 3, 4, 5].map((bar) => (
            <span key={bar} />
          ))}
        </span>
        <span className={styles.decodeFlow}>
          <span />
          <span />
          <span />
        </span>
        <span className={styles.decodeLines}>
          <span />
          <span />
          <span />
        </span>
        <span className={styles.decodeSpark} data-spark="1" />
        <span className={styles.decodeSpark} data-spark="2" />
        <span className={styles.decodeSpark} data-spark="3" />
      </div>
      <h1 id="pw-step-title" className={styles.processingTitle} tabIndex={-1} ref={titleRef}>
        {title}
      </h1>
      <p key={index} className={styles.decodeStep} aria-hidden="true">
        {steps[index]}
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
      <button type="button" className={styles.linkButton} onClick={onCancel}>
        {cancelLabel}
      </button>
    </section>
  );
}
