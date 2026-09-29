'use client';

import { useState } from 'react';

import { COMMON, LOVES_CHIPS, SOURCE_BADGE, companionCopy, hardChipId, tellCopy } from '@/lib/personal-wizard/copy';
import { LIMITS, normalizeText, type PersonalBookDraft } from '@/lib/personal-wizard/contract';
import {
  activeFacts,
  addTypedFact,
  chipIsSelected,
  dismissIntentSuggestion,
  randomId,
  setIntent,
  setNoDifficulty,
  toggleChip,
  toggleHardChip,
  type FactOutcome,
  type RequestIssue,
} from '@/lib/personal-wizard/draft';

import { FactsList } from './FactsList';
import styles from './personal-wizard.module.css';

type Update = (change: (draft: PersonalBookDraft) => PersonalBookDraft) => void;

type Props = {
  draft: PersonalBookDraft;
  update: Update;
  copy: ReturnType<typeof tellCopy>;
  issues: RequestIssue[];
  showErrors: boolean;
  topics: ReadonlyArray<{ id: string; label: string }>;
};

/**
 * The two must-have lists (what the child loves, what is hard for them) and the direction that
 * what is hard suggests. A heard list is shown as rows; an empty one is asked right here with chips
 * or the parent's own words. A picked chip becomes a row (and leaves the chips), so nothing is shown
 * twice; removing the row brings the chip back.
 */
export function MustHaves({ draft, update, copy, issues, showErrors, topics }: Props) {
  const lovesIssue = showErrors && issues.some((issue) => issue.code === 'loves_missing');
  const hardIssue = showErrors && issues.some((issue) => issue.code === 'hard_missing');
  return (
    <>
      <LovesBlock draft={draft} update={update} copy={copy} showIssue={lovesIssue} />
      <HardBlock draft={draft} update={update} copy={copy} showIssue={hardIssue} topics={topics} />
      <DirectionBlock draft={draft} update={update} copy={copy} topics={topics} />
    </>
  );
}

function outcomeText(copy: ReturnType<typeof tellCopy>, outcome: FactOutcome | 'removed'): string | null {
  if (outcome === 'limit' || outcome === 'duplicate' || outcome === 'too_long' || outcome === 'empty') {
    return copy.factOutcome[outcome];
  }
  return null;
}

type BlockProps = { draft: PersonalBookDraft; update: Update; copy: ReturnType<typeof tellCopy>; showIssue: boolean };

function LovesBlock({ draft, update, copy, showIssue }: BlockProps) {
  const loves = activeFacts(draft).filter((fact) => fact.kind === 'interest');
  // Asking stays open once the parent starts picking, so the chips do not vanish after the first one.
  const [adding, setAdding] = useState(false);
  const [other, setOther] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const open = loves.length === 0 || adding;
  const chips = LOVES_CHIPS.filter((chip) => !chipIsSelected(draft, chip.id));

  const run = (change: (current: PersonalBookDraft) => { draft: PersonalBookDraft; outcome: FactOutcome | 'removed' }) => {
    let outcome = 'empty' as FactOutcome | 'removed';
    update((current) => {
      const result = change(current);
      outcome = result.outcome;
      return result.draft;
    });
    setMessage(outcomeText(copy, outcome));
    setAdding(true);
    return outcome;
  };

  return (
    <div id="pw-loves" className={styles.mustHave} role="group" aria-labelledby="pw-loves-title">
      <h3 id="pw-loves-title" className={styles.mustHaveTitle}>
        {copy.lovesTitle}
      </h3>
      {loves.length > 0 ? <FactsList draft={draft} update={update} copy={copy} groups={['loves']} showTitles={false} /> : null}
      {open ? (
        <>
          {loves.length === 0 ? <p className={styles.label}>{copy.lovesQuestion}</p> : null}
          {chips.length > 0 ? (
            <div className={styles.chips}>
              {chips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  className={styles.chip}
                  onClick={() => run((current) => toggleChip(current, { id: chip.id, label: chip.label, kind: 'interest' }, randomId))}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          ) : null}
          <form
            className={styles.inlineForm}
            onSubmit={(event) => {
              event.preventDefault();
              const outcome = run((current) => addTypedFact(current, 'interest', other, randomId));
              if (outcome === 'added' || outcome === 'adopted' || outcome === 'restored') setOther('');
            }}
          >
            <label className="sr-only" htmlFor="pw-loves-other">
              {copy.lovesOtherLabel}
            </label>
            <input
              id="pw-loves-other"
              className={styles.input}
              placeholder={copy.lovesOtherLabel}
              value={other}
              maxLength={LIMITS.factValueMax}
              onChange={(event) => setOther(event.target.value)}
            />
            <button type="submit" className={styles.btnSecondary} disabled={!normalizeText(other)}>
              {COMMON.add}
            </button>
          </form>
        </>
      ) : (
        <button type="button" className={styles.linkButton} onClick={() => setAdding(true)}>
          {`+ ${COMMON.add}`}
        </button>
      )}
      {message ? <p className={styles.error}>{message}</p> : null}
      {showIssue ? <p className={styles.error}>{copy.lovesError}</p> : null}
    </div>
  );
}

function HardBlock({ draft, update, copy, showIssue, topics }: BlockProps & { topics: Props['topics'] }) {
  const hard = activeFacts(draft).filter((fact) => fact.kind === 'difficulty');
  const [adding, setAdding] = useState(false);
  const [other, setOther] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const open = !draft.noDifficulty && (hard.length === 0 || adding);
  const chips = topics.filter((topic) => !chipIsSelected(draft, hardChipId(topic.id)));

  const run = (change: (current: PersonalBookDraft) => { draft: PersonalBookDraft; outcome: FactOutcome | 'removed' }) => {
    let outcome = 'empty' as FactOutcome | 'removed';
    update((current) => {
      const result = change(current);
      outcome = result.outcome;
      return result.draft;
    });
    setMessage(outcomeText(copy, outcome));
    setAdding(true);
    return outcome;
  };

  return (
    <div id="pw-hard" className={styles.mustHave} role="group" aria-labelledby="pw-hard-title">
      <h3 id="pw-hard-title" className={styles.mustHaveTitle}>
        {copy.hardTitle}
      </h3>
      {hard.length > 0 ? <FactsList draft={draft} update={update} copy={copy} groups={['hard']} showTitles={false} /> : null}
      {draft.noDifficulty ? (
        <div className={styles.basicRow}>
          <span className={styles.factText}>{copy.hardNoneRow}</span>
          <button type="button" className={styles.linkButton} onClick={() => update((current) => setNoDifficulty(current, false))}>
            {COMMON.edit}
            <span className="sr-only">: {copy.hardNoneRow}</span>
          </button>
        </div>
      ) : null}
      {open ? (
        <>
          {hard.length === 0 ? (
            <>
              <p className={styles.label}>{copy.hardQuestion}</p>
              <p className={styles.hint}>{copy.hardHint}</p>
            </>
          ) : null}
          <div className={styles.chips}>
            {chips.map((topic) => (
              <button
                key={topic.id}
                type="button"
                className={styles.chip}
                onClick={() =>
                  run((current) => toggleHardChip(current, { id: hardChipId(topic.id), label: topic.label, topicId: topic.id }, randomId))
                }
              >
                {topic.label}
              </button>
            ))}
            {hard.length === 0 ? (
              <button
                type="button"
                className={styles.chip}
                data-variant="none"
                onClick={() => {
                  update((current) => setNoDifficulty(current, true));
                  setMessage(null);
                  setAdding(false);
                }}
              >
                {copy.hardNone}
              </button>
            ) : null}
          </div>
          <form
            className={styles.inlineForm}
            onSubmit={(event) => {
              event.preventDefault();
              const outcome = run((current) => addTypedFact(current, 'difficulty', other, randomId));
              if (outcome === 'added' || outcome === 'adopted' || outcome === 'restored') setOther('');
            }}
          >
            <label className="sr-only" htmlFor="pw-hard-other">
              {copy.hardOtherLabel}
            </label>
            <input
              id="pw-hard-other"
              className={styles.input}
              placeholder={copy.hardOtherLabel}
              value={other}
              maxLength={LIMITS.factValueMax}
              onChange={(event) => setOther(event.target.value)}
            />
            <button type="submit" className={styles.btnSecondary} disabled={!normalizeText(other)}>
              {COMMON.add}
            </button>
          </form>
        </>
      ) : !draft.noDifficulty ? (
        <button type="button" className={styles.linkButton} onClick={() => setAdding(true)}>
          {`+ ${COMMON.add}`}
        </button>
      ) : null}
      {message ? <p className={styles.error}>{message}</p> : null}
      {showIssue ? <p className={styles.error}>{copy.hardError}</p> : null}
    </div>
  );
}

/**
 * The direction the story will take, as part of what was understood: a pending proposal (asked for,
 * or suggested by what is hard) or the direction already chosen. With a direction already chosen, a
 * different proposal is a question, never a second row that could read as chosen.
 */
function DirectionBlock({
  draft,
  update,
  copy,
  topics,
}: {
  draft: PersonalBookDraft;
  update: Update;
  copy: ReturnType<typeof tellCopy>;
  topics: Props['topics'];
}) {
  const name = normalizeText(draft.child.name);
  const topicLabel = (topicId: string) => topics.find((topic) => topic.id === topicId)?.label ?? topicId;
  const current = draft.intent;
  const rows = [
    ...(current?.kind === 'topic'
      ? [
          {
            key: `intent-${current.topicId}`,
            topicId: current.topicId,
            badge: current.suggestedBy ?? null,
            note: null as string | null,
            status: 'included' as const,
            remove: () => update((latest) => setIntent(latest, null)),
          },
        ]
      : []),
    ...(current === null
      ? draft.intentSuggestions.map((suggestion) => ({
          key: `suggestion-${suggestion.topicId}`,
          topicId: suggestion.topicId,
          badge: suggestion.source === 'chip' ? null : suggestion.source,
          note: suggestion.reason === 'hard' ? copy.directionFromHard : null,
          status: 'proposed' as const,
          remove: () => update((latest) => dismissIntentSuggestion(latest, suggestion.topicId)),
        }))
      : []),
  ];
  const currentLabel =
    current === null
      ? null
      : current.kind === 'just_for_fun'
        ? companionCopy(name, draft.child.address).justForFun
        : topicLabel(current.topicId);
  const questions = currentLabel !== null ? draft.intentSuggestions : [];
  if (rows.length === 0 && questions.length === 0) return null;

  return (
    <div className={styles.mustHave} role="group" aria-labelledby="pw-direction-title">
      <h3 id="pw-direction-title" className={styles.mustHaveTitle}>
        {copy.directionTitle}
      </h3>
      {rows.length > 0 ? (
        <ul className={styles.factRows}>
          {rows.map((row) => (
            <li key={row.key} className={styles.factRow} data-status={row.status}>
              <span className={styles.factText}>
                {topicLabel(row.topicId)}
                {row.badge ? (
                  <span className={styles.sourceBadge} data-source={row.badge}>
                    {SOURCE_BADGE[row.badge]}
                  </span>
                ) : null}
                {row.note ? <span className={styles.rowNote}>{row.note}</span> : null}
              </span>
              <span className={styles.factActions}>
                <button type="button" className={styles.linkButton} onClick={row.remove}>
                  {COMMON.remove}
                  <span className="sr-only">: {topicLabel(row.topicId)}</span>
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {currentLabel !== null
        ? questions.map((suggestion) => {
            const proposed = topicLabel(suggestion.topicId);
            const question = copy.directionChange(currentLabel, proposed, suggestion.source);
            return (
              <div key={`change-${suggestion.topicId}`} className={styles.conflict} role="group" aria-label={question}>
                <p className={styles.conflictQuestion}>{question}</p>
                <div className={styles.actionsRow}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => update((latest) => setIntent(latest, { kind: 'topic', topicId: suggestion.topicId }))}
                  >
                    {copy.directionReplace(proposed)}
                  </button>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => update((latest) => dismissIntentSuggestion(latest, suggestion.topicId))}
                  >
                    {copy.directionKeep(currentLabel)}
                  </button>
                </div>
                <p className={styles.hint}>{copy.directionKeepNote(currentLabel)}</p>
              </div>
            );
          })
        : null}
      {current === null && draft.intentSuggestions.length > 1 ? <p className={styles.hint}>{copy.directionPickLater}</p> : null}
      {rows.length > 0 ? <p className={styles.hint}>{copy.directionRemovedNote}</p> : null}
    </div>
  );
}
