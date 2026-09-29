'use client';

import { useState, type RefObject } from 'react';

import { COMMON, companionCopy } from '@/lib/personal-wizard/copy';
import { LIMITS, normalizeText, type PersonalBookDraft } from '@/lib/personal-wizard/contract';
import {
  addAvoid,
  dismissIntentSuggestion,
  removeAvoid,
  setCompanion,
  setIntent,
  type FactOutcome,
} from '@/lib/personal-wizard/draft';

import type { WizardOptionsView } from './PersonalWizard';
import styles from './personal-wizard.module.css';

type Props = {
  draft: PersonalBookDraft;
  update: (change: (draft: PersonalBookDraft) => PersonalBookDraft) => void;
  options: WizardOptionsView;
  showErrors: boolean;
  titleRef: RefObject<HTMLHeadingElement | null>;
};

export function StepCompanion({ draft, update, options, showErrors, titleRef }: Props) {
  const name = normalizeText(draft.child.name);
  const copy = companionCopy(name, draft.child.address);
  const [avoidValue, setAvoidValue] = useState('');
  const [avoidMessage, setAvoidMessage] = useState<string | null>(null);
  const [avoidOpen, setAvoidOpen] = useState(draft.avoid.length > 0);
  const missingCompanion = showErrors && !draft.companionId;
  const topicLabel = (topicId: string) => options.topics.find((topic) => topic.id === topicId)?.label ?? topicId;
  const selectedIntent = draft.intent?.kind === 'topic' ? draft.intent.topicId : draft.intent?.kind ?? null;

  return (
    <section className={styles.step} aria-labelledby="pw-step-title">
      <h1 id="pw-step-title" className={styles.stepTitle} tabIndex={-1} ref={titleRef}>
        {copy.title}
      </h1>
      <p className={styles.stepSub}>{copy.sub}</p>

      <fieldset
        className={styles.fieldset}
        aria-describedby={missingCompanion ? 'pw-companion-error' : 'pw-roster-note'}
      >
        <legend className="sr-only">{copy.title}</legend>
        <div className={styles.companionGrid}>
          {options.companions.map((companion) => {
            const selected = draft.companionId === companion.id;
            return (
              <label key={companion.id} className={styles.companionCard} data-selected={selected || undefined}>
                <input
                  className={styles.radioInput}
                  type="radio"
                  name="pw-companion"
                  value={companion.id}
                  checked={selected}
                  onChange={() => update((current) => setCompanion(current, companion.id))}
                />
                <span className={styles.companionImageWrap}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className={styles.companionImage} src={companion.image} alt="" loading="lazy" />
                </span>
                <span className={styles.companionName}>{companion.name}</span>
                <span className={styles.companionLine}>{companion.personality}</span>
              </label>
            );
          })}
        </div>
        {missingCompanion ? (
          <p id="pw-companion-error" className={styles.error}>
            {copy.missing}
          </p>
        ) : null}
        <p id="pw-roster-note" className={styles.hint}>
          {copy.rosterNote}
        </p>
      </fieldset>

      {draft.companionId ? (
        <div className={styles.card}>
          <fieldset className={styles.fieldset}>
            <legend className={styles.sectionTitle}>{copy.intentTitle}</legend>
            <p className={styles.hint}>{copy.intentSub}</p>

            {draft.intentSuggestions.map((suggestion) => (
              <div key={suggestion.topicId} className={styles.suggestion}>
                <p className={styles.suggestionText}>{copy.suggestion(topicLabel(suggestion.topicId), suggestion.source)}</p>
                <div className={styles.actionsRow}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() =>
                      update((current) =>
                        dismissIntentSuggestion(
                          setIntent(current, { kind: 'topic', topicId: suggestion.topicId, suggestedBy: suggestion.source }),
                          suggestion.topicId,
                        ),
                      )
                    }
                  >
                    {copy.suggestionAccept}
                  </button>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={() => update((current) => dismissIntentSuggestion(current, suggestion.topicId))}
                  >
                    {copy.suggestionDismiss}
                  </button>
                </div>
              </div>
            ))}

            <div className={styles.intentGrid}>
              <label className={styles.intentOption} data-selected={selectedIntent === 'just_for_fun' || undefined}>
                <input
                  className={styles.radioInput}
                  type="radio"
                  name="pw-intent"
                  value="just_for_fun"
                  checked={selectedIntent === 'just_for_fun'}
                  onChange={() => update((current) => setIntent(current, { kind: 'just_for_fun' }))}
                />
                <span>{copy.justForFun}</span>
              </label>
              {options.topics.map((topic) => (
                <label key={topic.id} className={styles.intentOption} data-selected={selectedIntent === topic.id || undefined}>
                  <input
                    className={styles.radioInput}
                    type="radio"
                    name="pw-intent"
                    value={topic.id}
                    checked={selectedIntent === topic.id}
                    onChange={() => update((current) => setIntent(current, { kind: 'topic', topicId: topic.id }))}
                  />
                  <span>{topic.label}</span>
                </label>
              ))}
            </div>
            {draft.intent ? (
              <button type="button" className={styles.linkButton} onClick={() => update((current) => setIntent(current, null))}>
                {copy.clearIntent}
              </button>
            ) : null}
          </fieldset>

          <div className={styles.avoid}>
            <button
              type="button"
              className={styles.disclosure}
              aria-expanded={avoidOpen}
              aria-controls="pw-avoid"
              onClick={() => setAvoidOpen((open) => !open)}
            >
              {copy.avoidTitle}
            </button>
            {avoidOpen ? (
              <div id="pw-avoid" className={styles.field}>
                <p className={styles.hint} id="pw-avoid-hint">
                  {copy.avoidHint}
                </p>
                <form
                  className={styles.inlineForm}
                  onSubmit={(event) => {
                    event.preventDefault();
                    let outcome = 'empty' as FactOutcome;
                    update((current) => {
                      const result = addAvoid(current, avoidValue);
                      outcome = result.outcome;
                      return result.draft;
                    });
                    if (outcome === 'added') {
                      setAvoidValue('');
                      setAvoidMessage(null);
                    } else if (outcome === 'limit') setAvoidMessage(copy.avoidLimit);
                    else if (outcome === 'duplicate') setAvoidMessage(copy.avoidDuplicate);
                    else if (outcome === 'too_long') setAvoidMessage(copy.avoidTooLong);
                  }}
                >
                  <label className="sr-only" htmlFor="pw-avoid-input">
                    {copy.avoidTitle}
                  </label>
                  <input
                    id="pw-avoid-input"
                    className={styles.input}
                    value={avoidValue}
                    maxLength={LIMITS.avoidItemMax}
                    aria-describedby="pw-avoid-hint"
                    onChange={(event) => setAvoidValue(event.target.value)}
                  />
                  <button type="submit" className={styles.btnSecondary}>
                    {COMMON.add}
                  </button>
                </form>
                {avoidMessage ? <p className={styles.error}>{avoidMessage}</p> : null}
                {draft.avoid.length > 0 ? (
                  <ul className={styles.factRows}>
                    {draft.avoid.map((item, index) => (
                      <li key={item} className={styles.factRow}>
                        <span className={styles.factText}>{item}</span>
                        <span className={styles.factActions}>
                          <button
                            type="button"
                            className={styles.linkButton}
                            onClick={() => update((current) => removeAvoid(current, index))}
                          >
                            {COMMON.remove}
                            <span className="sr-only">: {item}</span>
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
