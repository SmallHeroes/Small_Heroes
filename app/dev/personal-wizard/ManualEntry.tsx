'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

import { CHIPS, COMMON, SOURCE_BADGE, tellCopy } from '@/lib/personal-wizard/copy';
import { LIMITS, normalizeText, type PersonalBookDraft } from '@/lib/personal-wizard/contract';
import { addTypedFact, chipIsSelected, commitStoryPlace, randomId, toggleChip, type FactOutcome } from '@/lib/personal-wizard/draft';

import styles from './personal-wizard.module.css';

type Props = {
  draft: PersonalBookDraft;
  update: (change: (draft: PersonalBookDraft) => PersonalBookDraft) => void;
  copy: ReturnType<typeof tellCopy>;
  placeInputRef: RefObject<HTMLInputElement | null>;
};

/** The manual path: the same chips and fields, feeding the same list as the recording. */
export function ManualEntry({ draft, update, copy, placeInputRef }: Props) {
  const [showOther, setShowOther] = useState(false);
  const [otherValue, setOtherValue] = useState('');
  const [extraValue, setExtraValue] = useState('');
  const [factMessage, setFactMessage] = useState<{ field: 'chips' | 'other' | 'extra'; text: string } | null>(null);

  const [placeValue, setPlaceValue] = useState(draft.storyPlace?.value ?? '');
  const placeFocused = useRef(false);
  const draftPlace = draft.storyPlace?.value ?? '';
  useEffect(() => {
    // Sync external changes (a proposal, an accepted conflict, a removal) unless the parent is typing.
    if (!placeFocused.current) setPlaceValue(draftPlace);
  }, [draftPlace]);

  const outcomeText = (outcome: FactOutcome | 'removed'): string | null => {
    if (outcome === 'limit' || outcome === 'duplicate' || outcome === 'too_long' || outcome === 'empty') {
      return copy.factOutcome[outcome];
    }
    return null;
  };

  const addFact = (field: 'other' | 'extra', value: string, onDone: () => void) => {
    let outcome = 'empty' as FactOutcome;
    update((current) => {
      const result = addTypedFact(current, field === 'other' ? 'interest' : 'habit', value, randomId);
      outcome = result.outcome;
      return result.draft;
    });
    const text = outcomeText(outcome);
    setFactMessage(text ? { field, text } : null);
    if (!text) onDone();
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
      <div className={styles.chips} role="group" aria-label={copy.chipsLabel}>
        {CHIPS.map((chip) => {
          const selected = chipIsSelected(draft, chip.id);
          return (
            <button
              key={chip.id}
              type="button"
              className={styles.chip}
              aria-pressed={selected}
              data-selected={selected || undefined}
              onClick={() => {
                let outcome = 'empty' as FactOutcome | 'removed';
                update((current) => {
                  const result = toggleChip(current, { id: chip.id, label: chip.label, kind: 'interest' }, randomId);
                  outcome = result.outcome;
                  return result.draft;
                });
                const text = outcomeText(outcome);
                setFactMessage(text ? { field: 'chips', text } : null);
              }}
            >
              {chip.label}
            </button>
          );
        })}
        <button
          type="button"
          className={styles.chip}
          aria-expanded={showOther}
          aria-controls="pw-other-field"
          onClick={() => setShowOther((open) => !open)}
        >
          {copy.otherChip}
        </button>
      </div>
      {factMessage?.field === 'chips' ? <p className={styles.error}>{factMessage.text}</p> : null}

      {showOther ? (
        <form
          id="pw-other-field"
          className={styles.field}
          onSubmit={(event) => {
            event.preventDefault();
            addFact('other', otherValue, () => setOtherValue(''));
          }}
        >
          <label className={styles.label} htmlFor="pw-other-input">
            {copy.otherLabel}
          </label>
          <div className={styles.inlineForm}>
            <input
              id="pw-other-input"
              className={styles.input}
              value={otherValue}
              maxLength={LIMITS.factValueMax}
              onChange={(event) => setOtherValue(event.target.value)}
            />
            <button type="submit" className={styles.btnSecondary}>
              {COMMON.add}
            </button>
          </div>
          {factMessage?.field === 'other' ? <p className={styles.error}>{factMessage.text}</p> : null}
        </form>
      ) : null}

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
          addFact('extra', extraValue, () => setExtraValue(''));
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
        {factMessage?.field === 'extra' ? <p className={styles.error}>{factMessage.text}</p> : null}
      </form>
    </div>
  );
}
