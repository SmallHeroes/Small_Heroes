'use client';

import { useState } from 'react';

import { COMMON, SOURCE_BADGE, factLabel, storyPlaceLabel, tellCopy } from '@/lib/personal-wizard/copy';
import type { Fact, PersonalBookDraft } from '@/lib/personal-wizard/contract';
import {
  FACT_GROUP_OF_KIND,
  activeFacts,
  commitStoryPlace,
  editFactValue,
  removeFact,
  type EditOutcome,
  type FactGroupId,
} from '@/lib/personal-wizard/draft';

import styles from './personal-wizard.module.css';

type Props = {
  draft: PersonalBookDraft;
  update: (change: (draft: PersonalBookDraft) => PersonalBookDraft) => void;
  copy: ReturnType<typeof tellCopy>;
  /** Which groups to list, in order. The adventure place is listed with 'places'. */
  groups: readonly FactGroupId[];
  /** Group titles; the must-have blocks carry their own title. */
  showTitles?: boolean;
  onEditPlace?: () => void;
};

const EDIT_MESSAGE: Partial<Record<EditOutcome, keyof ReturnType<typeof tellCopy>['factOutcome']>> = {
  empty: 'empty',
  too_long: 'too_long',
  duplicate: 'duplicate',
};

/** Details rows inside the card: every entry path lands here, each row editable and removable. */
export function FactsList({ draft, update, copy, groups, showTitles = true, onEditPlace }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const facts = activeFacts(draft);
  const place = draft.storyPlace;

  const startEdit = (fact: Fact) => {
    setEditingId(fact.id);
    setEditValue(fact.value);
    setEditError(null);
  };

  const saveEdit = (factId: string) => {
    let outcome = 'missing' as EditOutcome;
    update((current) => {
      const result = editFactValue(current, factId, editValue);
      outcome = result.outcome;
      return result.draft;
    });
    const messageKey = EDIT_MESSAGE[outcome];
    if (messageKey) {
      setEditError(copy.factOutcome[messageKey]);
      return;
    }
    setEditingId(null);
    setEditError(null);
  };

  const badge = (source: Fact['source']) =>
    source === 'fixture' || source === 'transcript' ? (
      <span className={styles.sourceBadge} data-source={source}>
        {SOURCE_BADGE[source]}
      </span>
    ) : null;

  return (
    <>
      {groups.map((group) => {
        const groupFacts = facts.filter((fact) => FACT_GROUP_OF_KIND[fact.kind] === group);
        const showPlace = group === 'places' && place && onEditPlace;
        if (groupFacts.length === 0 && !showPlace) return null;
        return (
          <div key={group} className={styles.factGroup}>
            {showTitles ? <h3 className={styles.factGroupTitle}>{copy.groupTitle[group]}</h3> : null}
            <ul className={styles.factRows}>
              {showPlace && place ? (
                <li className={styles.factRow} data-status={place.status}>
                  <span className={styles.factText}>
                    {storyPlaceLabel(place.value)}
                    {badge(place.source)}
                  </span>
                  <span className={styles.factActions}>
                    <button type="button" className={styles.linkButton} onClick={onEditPlace}>
                      {COMMON.edit}
                      <span className="sr-only">: {storyPlaceLabel(place.value)}</span>
                    </button>
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={() => update((current) => commitStoryPlace(current, ''))}
                    >
                      {COMMON.remove}
                      <span className="sr-only">: {storyPlaceLabel(place.value)}</span>
                    </button>
                  </span>
                </li>
              ) : null}
              {groupFacts.map((fact) =>
                editingId === fact.id ? (
                  <li key={fact.id} className={styles.factRow} data-editing="true">
                    <form
                      className={styles.inlineForm}
                      onSubmit={(event) => {
                        event.preventDefault();
                        saveEdit(fact.id);
                      }}
                    >
                      <label className="sr-only" htmlFor={`pw-edit-${fact.id}`}>
                        {`${COMMON.edit}: ${factLabel(fact.kind, fact.value)}`}
                      </label>
                      <input
                        id={`pw-edit-${fact.id}`}
                        className={styles.input}
                        value={editValue}
                        maxLength={80}
                        autoFocus
                        onChange={(event) => setEditValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            setEditingId(null);
                            setEditError(null);
                          }
                        }}
                        aria-invalid={editError ? true : undefined}
                        aria-describedby={editError ? `pw-edit-error-${fact.id}` : undefined}
                      />
                      <button type="submit" className={styles.btnPrimarySmall}>
                        {COMMON.save}
                      </button>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={() => {
                          setEditingId(null);
                          setEditError(null);
                        }}
                      >
                        {COMMON.cancel}
                      </button>
                    </form>
                    {editError ? (
                      <p id={`pw-edit-error-${fact.id}`} className={styles.error}>
                        {editError}
                      </p>
                    ) : null}
                  </li>
                ) : (
                  <li key={fact.id} className={styles.factRow} data-status={fact.status}>
                    <span className={styles.factText}>
                      {factLabel(fact.kind, fact.value)}
                      {badge(fact.source)}
                    </span>
                    <span className={styles.factActions}>
                      <button type="button" className={styles.linkButton} onClick={() => startEdit(fact)}>
                        {COMMON.edit}
                        <span className="sr-only">: {factLabel(fact.kind, fact.value)}</span>
                      </button>
                      <button
                        type="button"
                        className={styles.linkButton}
                        onClick={() => update((current) => removeFact(current, fact.id))}
                      >
                        {COMMON.remove}
                        <span className="sr-only">: {factLabel(fact.kind, fact.value)}</span>
                      </button>
                    </span>
                  </li>
                ),
              )}
            </ul>
          </div>
        );
      })}
    </>
  );
}
