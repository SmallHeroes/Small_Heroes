'use client';

import type { CSSProperties } from 'react';

import styles from './personal-wizard.module.css';

/**
 * One line icon per must-have cue, in MUST_HAVE_CUES order: name, age, where they live, what they
 * love, what is hard. Decorative only; the word beside it carries the meaning.
 */
const CUE_PATHS: readonly string[] = [
  'M4 12.6V5.5A1.5 1.5 0 0 1 5.5 4h7.1a1.5 1.5 0 0 1 1.06.44l6.4 6.4a1.5 1.5 0 0 1 0 2.12l-7.1 7.1a1.5 1.5 0 0 1-2.12 0l-6.4-6.4A1.5 1.5 0 0 1 4 12.6ZM8.5 8.5h.01',
  'M5 20h14v-6.5a1.5 1.5 0 0 0-1.5-1.5h-11A1.5 1.5 0 0 0 5 13.5V20ZM5 16.2c1.17.8 2.33.8 3.5 0s2.33-.8 3.5 0 2.33.8 3.5 0 2.33-.8 3.5 0M12 12V9.2M12 7c-.83 0-1.3-.55-1.3-1.2 0-.75 1.3-2.3 1.3-2.3s1.3 1.55 1.3 2.3c0 .65-.47 1.2-1.3 1.2Z',
  'M4 10.6 12 4l8 6.6V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1v-8.4Z',
  'M12 19.5s-7.5-4.35-7.5-10A4.15 4.15 0 0 1 12 7.1a4.15 4.15 0 0 1 7.5 2.4c0 5.65-7.5 10-7.5 10Z',
  'M7.6 18.5a3.9 3.9 0 0 1-.6-7.76 5.4 5.4 0 0 1 10.5-1.4 4.6 4.6 0 0 1-.4 9.16H7.6Z',
];

/** A slight, fixed tilt per tag, so the arc reads as hand-placed stickers rather than a menu. */
const TILTS = [-3, 2, -1.5, 2.5, -2.5];

/**
 * Where cue `index` of `count` sits on the arc over the microphone. The first cue sits at the
 * reading start (right, in Hebrew) and the arc runs over the top to the left.
 */
function arcPosition(index: number, count: number): CSSProperties {
  const angle = count > 1 ? (Math.PI * index) / (count - 1) : Math.PI / 2;
  return {
    '--cue-x': Math.cos(angle).toFixed(4),
    '--cue-y': Math.sin(angle).toFixed(4),
    '--cue-tilt': `${TILTS[index % TILTS.length]}deg`,
    '--cue-i': index,
  } as CSSProperties;
}

type Props = {
  cues: readonly string[];
  /** Read before the list ("worth telling"); the list itself is the visible content. */
  label: string;
  /** arc = around the microphone; row = a wrapped line, e.g. above the writing box. */
  layout: 'arc' | 'row';
  id?: string;
};

/** The five things worth telling, shown as static prompts. They never light up: nothing is heard live. */
export function CueTags({ cues, label, layout, id }: Props) {
  return (
    <ul id={id} className={layout === 'arc' ? styles.cueArc : styles.cueRow} aria-label={label}>
      {cues.map((cue, index) => (
        <li key={cue} className={styles.cueTag} style={layout === 'arc' ? arcPosition(index, cues.length) : undefined}>
          {CUE_PATHS[index] ? (
            <svg className={styles.cueIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d={CUE_PATHS[index]}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
          <span>{cue}</span>
        </li>
      ))}
    </ul>
  );
}
