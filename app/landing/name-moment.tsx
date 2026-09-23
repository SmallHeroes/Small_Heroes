'use client';

import { useId } from 'react';

export type HeroChild = { name: string; gender: 'boy' | 'girl' };

const MAX_NAME = 16;

/**
 * The Name Moment: one warm field in the hero. The instant a parent types
 * their child's name, the page starts speaking it (headline, sample page,
 * CTA), inflected for the gender they chose. This is product truth, not
 * theatre: the book really is written in the child's name and gender.
 */
export function NameMoment({
  child,
  onChange,
}: {
  child: HeroChild;
  onChange: (next: HeroChild) => void;
}) {
  const inputId = useId();

  return (
    <div className="name-moment" data-reveal="hero" data-reveal-delay="150">
      <label className="name-moment-label" htmlFor={inputId}>
        איך קוראים לגיבור או לגיבורה?
      </label>
      <div className="name-moment-row">
        <input
          id={inputId}
          className="name-moment-input"
          type="text"
          inputMode="text"
          autoComplete="off"
          maxLength={MAX_NAME}
          placeholder="השם של הילד או הילדה"
          value={child.name}
          onChange={(e) => onChange({ ...child, name: e.target.value.slice(0, MAX_NAME) })}
        />
        <div className="name-moment-chips" role="radiogroup" aria-label="ילד או ילדה">
          {(
            [
              ['boy', 'ילד'],
              ['girl', 'ילדה'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={child.gender === value}
              className={'name-moment-chip' + (child.gender === value ? ' is-on' : '')}
              onClick={() => onChange({ ...child, gender: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="name-moment-hint" aria-live="polite">
        {child.name.trim()
          ? 'הדף כבר מדבר בשם הזה. ככה גם הספר.'
          : 'תכתבו שם, ותראו את הדף משתנה.'}
      </p>
    </div>
  );
}
