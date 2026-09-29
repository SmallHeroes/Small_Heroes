'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

import { COMMON, SOURCE_BADGE, tellCopy } from '@/lib/personal-wizard/copy';
import { LIMITS, normalizeText, type PersonalBookDraft } from '@/lib/personal-wizard/contract';
import { addTypedFact, commitStoryPlace, randomId, type FactOutcome } from '@/lib/personal-wizard/draft';

import styles from './personal-wizard.module.css';

type Props = {
  draft: PersonalBookDraft;
  update: (change: (draft: PersonalBookDraft) => PersonalBookDraft) => void;
  copy: ReturnType<typeof tellCopy>;
  placeInputRef: RefObject<HTMLInputElement | null>;
};

/** Optional bonus details, by hand: where the adventure starts and a small habit or saying. */
export function ManualEntry({ draft, update, copy, placeInputRef }: Props) {
  const [extraValue, setExtraValue] = useState('');
  const [extraMessage, setExtraMessage] = useState<string | null>(null);

  const [placeValue, setPlaceValue] = useState(draft.storyPlace?.value ?? '');
  const placeFocused = useRef(false);
  const draftPlace = draft.storyPlace?.value ?? '';
  useEffect(() => {
    // Sync external changes (a proposal, an accepted conflict, a removal) unless the parent is typing.
    if (!placeFocused.current) setPlaceValue(draftPlace);
  }, [draftPlace]);

  const addExtra = () => {
    let outcome = 'empty' as FactOutcome;
    update((current) => {
      const result = addTypedFact(current, 'habit', extraValue, randomId);
      outcome = result.outcome;
      return result.draft;
    });
    if (outcome === 'limit' || outcome === 'duplicate' || outcome === 'too_long' || outcome === 'empty') {
      setExtraMessage(copy.factOutcome[outcome]);
      return;
    }
    setExtraMessage(null);
    setExtraValue('');
  };

  const commitPlace = () => {
    placeFocused.current = false;
    if (normalizeText(placeValue) !== normalizeText(draftPlace) || (!placeValue && draftPlace)) {
      update((current) => commitStoryPlace(current, placeValue));
    }
  };

  const placeSource = draft.storyPlace?.source;
  const placeBadge = placeSource === 'fixture' || placeSource === 'transcript' ? placeSource : null;

  return (
    <div id="pw-manual" className={styles.manualEntry}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="pw-place-input">
          {copy.placeLabel}
          {placeBadge ? (
            <span className={styles.sourceBadge} data-source={placeBadge}>
              {SOURCE_BADGE[placeBadge]}
            </span>
          ) : null}
        </label>
        <input
          id="pw-place-input"
          ref={placeInputRef}
          className={styles.input}
          value={placeValue}
          maxLength={LIMITS.placeMax}
          aria-describedby="pw-place-hint"
          onFocus={() => {
            placeFocused.current = true;
          }}
          onChange={(event) => setPlaceValue(event.target.value)}
          onBlur={commitPlace}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitPlace();
            }
          }}
        />
        <p id="pw-place-hint" className={styles.hint}>
          {copy.placeHint}
        </p>
      </div>

      <form
        className={styles.field}
        onSubmit={(event) => {
          event.preventDefault();
          addExtra();
        }}
      >
        <label className={styles.label} htmlFor="pw-extra-input">
          {copy.extraLabel}
        </label>
        <div className={styles.inlineForm}>
          <input
            id="pw-extra-input"
            className={styles.input}
            value={extraValue}
            maxLength={LIMITS.factValueMax}
            aria-describedby="pw-extra-hint"
            onChange={(event) => setExtraValue(event.target.value)}
          />
          <button type="submit" className={styles.btnSecondary}>
            {COMMON.add}
          </button>
        </div>
        <p id="pw-extra-hint" className={styles.hint}>
          {copy.extraHint}
        </p>
        {extraMessage ? <p className={styles.error}>{extraMessage}</p> : null}
      </form>
    </div>
  );
}
