'use client';

import { useEffect, useRef, useState } from 'react';

import { COMMON, HERO, SOURCE_BADGE } from '@/lib/personal-wizard/copy';
import { PROTOTYPE_AGES, normalizeText, type CoreValueSource, type PersonalBookDraft } from '@/lib/personal-wizard/contract';
import { setChildAddress, setChildAge, setChildName, type RequestIssue } from '@/lib/personal-wizard/draft';

import styles from './personal-wizard.module.css';

type Props = {
  draft: PersonalBookDraft;
  update: (change: (draft: PersonalBookDraft) => PersonalBookDraft) => void;
  issues: RequestIssue[];
  showErrors: boolean;
};

/**
 * The child's name, age and grammatical address inside the details card. A value heard in a
 * recording (or the labelled example) is shown as a value with "edit"; a missing or typed value is
 * a field. Only what is still missing is asked. The address is never heard: it is always the
 * parent's explicit choice.
 */
export function ChildBasics({ draft, update, issues, showErrors }: Props) {
  const name = normalizeText(draft.child.name);
  const [editingName, setEditingName] = useState(false);
  const [editingAge, setEditingAge] = useState(false);
  // "Edit" replaces the age row with the choices: focus moves to the chosen age, not to the page.
  const ageFieldRef = useRef<HTMLFieldSetElement | null>(null);
  useEffect(() => {
    if (!editingAge) return;
    const field = ageFieldRef.current;
    (field?.querySelector<HTMLInputElement>('input:checked') ?? field?.querySelector<HTMLInputElement>('input'))?.focus();
  }, [editingAge]);
  const nameIssue = showErrors ? issues.find((issue) => issue.code.startsWith('child_name')) : undefined;
  const ageIssue = showErrors ? issues.find((issue) => issue.code === 'child_age_missing') : undefined;
  const addressIssue = showErrors ? issues.find((issue) => issue.code === 'child_address_missing') : undefined;

  const heard = (source: CoreValueSource) => source === 'transcript' || source === 'fixture';
  const showNameField = !name || !heard(draft.child.nameSource) || editingName || Boolean(nameIssue);
  const showAgeField = draft.child.age === null || !heard(draft.child.ageSource) || editingAge;
  const badge = (source: CoreValueSource) =>
    source === 'transcript' || source === 'fixture' ? (
      <span className={styles.sourceBadge} data-source={source}>
        {SOURCE_BADGE[source]}
      </span>
    ) : null;

  return (
    <div className={styles.basics}>
      {showNameField ? (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="pw-child-name">
            {HERO.nameLabel}
          </label>
          <input
            id="pw-child-name"
            className={styles.input}
            type="text"
            autoComplete="off"
            maxLength={20}
            placeholder={HERO.namePlaceholder}
            value={draft.child.name}
            autoFocus={editingName}
            aria-invalid={nameIssue ? true : undefined}
            aria-describedby={nameIssue ? 'pw-child-name-error' : undefined}
            onChange={(event) => update((current) => setChildName(current, event.target.value))}
          />
          {nameIssue ? (
            <p id="pw-child-name-error" className={styles.error}>
              {HERO.errors[nameIssue.code as 'child_name_missing' | 'child_name_invalid']}
            </p>
          ) : null}
        </div>
      ) : (
        <div className={styles.basicRow}>
          <span className={styles.factText}>
            {HERO.nameRow(name)}
            {badge(draft.child.nameSource)}
          </span>
          <button type="button" className={styles.linkButton} onClick={() => setEditingName(true)}>
            {COMMON.edit}
            <span className="sr-only">: {HERO.nameRow(name)}</span>
          </button>
        </div>
      )}

      {showAgeField ? (
        <fieldset ref={ageFieldRef} className={styles.fieldset} aria-describedby={ageIssue ? 'pw-age-error' : 'pw-age-hint'}>
          <legend className={styles.label}>{HERO.ageLabel}</legend>
          <div className={styles.segmented}>
            {PROTOTYPE_AGES.map((age) => (
              <label key={age} className={styles.segment} data-selected={draft.child.age === age || undefined}>
                <input
                  className={styles.radioInput}
                  type="radio"
                  name="pw-age"
                  value={age}
                  checked={draft.child.age === age}
                  onChange={() => update((current) => setChildAge(current, age))}
                />
                <span>{age}</span>
              </label>
            ))}
          </div>
          {ageIssue ? (
            <p id="pw-age-error" className={styles.error}>
              {HERO.errors.child_age_missing}
            </p>
          ) : (
            <p id="pw-age-hint" className={styles.hint}>
              {HERO.ageHint}
            </p>
          )}
        </fieldset>
      ) : (
        <div className={styles.basicRow}>
          <span className={styles.factText}>
            {HERO.ageRow(draft.child.age ?? 0)}
            {badge(draft.child.ageSource)}
          </span>
          <button type="button" className={styles.linkButton} onClick={() => setEditingAge(true)}>
            {COMMON.edit}
            <span className="sr-only">: {HERO.ageRow(draft.child.age ?? 0)}</span>
          </button>
        </div>
      )}

      <fieldset className={styles.fieldset} aria-describedby={addressIssue ? 'pw-address-error' : 'pw-address-hint'}>
        <legend className={styles.label}>{HERO.addressLabel(name)}</legend>
        <div className={styles.choiceRow}>
          {(
            [
              ['boy', HERO.addressBoy],
              ['girl', HERO.addressGirl],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className={styles.choice} data-selected={draft.child.address === value || undefined}>
              <input
                className={styles.radioInput}
                type="radio"
                name="pw-address"
                value={value}
                checked={draft.child.address === value}
                onChange={() => update((current) => setChildAddress(current, value))}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        {addressIssue ? (
          <p id="pw-address-error" className={styles.error}>
            {HERO.errors.child_address_missing}
          </p>
        ) : (
          <p id="pw-address-hint" className={styles.hint}>
            {HERO.addressHint}
          </p>
        )}
      </fieldset>
    </div>
  );
}
