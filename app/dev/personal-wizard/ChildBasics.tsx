'use client';

import { useEffect, useRef, useState } from 'react';

import { COMMON, HERO, SOURCE_BADGE } from '@/lib/personal-wizard/copy';
import { LIMITS, PROTOTYPE_AGES, normalizeText, type CoreValueSource, type PersonalBookDraft } from '@/lib/personal-wizard/contract';
import {
  commitChildResidence,
  setChildAddress,
  setChildAge,
  setChildName,
  setChildResidence,
  type RequestIssue,
} from '@/lib/personal-wizard/draft';

import styles from './personal-wizard.module.css';

type Props = {
  draft: PersonalBookDraft;
  update: (change: (draft: PersonalBookDraft) => PersonalBookDraft) => void;
  issues: RequestIssue[];
  showErrors: boolean;
};

const heard = (source: CoreValueSource) => source === 'transcript' || source === 'fixture';

/**
 * The child's name, age, grammatical address and residence inside the details card. A value heard
 * in what the parent told us (or in the labelled example) is shown as a value with "edit"; a missing
 * or typed value is a field. Only what is still missing is asked. The address is heard only from how
 * the parent speaks about the child, never from the name or the voice; otherwise it is asked.
 */
export function ChildBasics({ draft, update, issues, showErrors }: Props) {
  const name = normalizeText(draft.child.name);
  const residence = normalizeText(draft.child.residence);
  const [editingName, setEditingName] = useState(false);
  const [editingAge, setEditingAge] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [editingResidence, setEditingResidence] = useState(false);
  // "Edit" replaces a row with its choices: focus moves to the chosen option, not to the page.
  const ageFieldRef = useRef<HTMLFieldSetElement | null>(null);
  const addressFieldRef = useRef<HTMLFieldSetElement | null>(null);
  useEffect(() => {
    if (!editingAge) return;
    const field = ageFieldRef.current;
    (field?.querySelector<HTMLInputElement>('input:checked') ?? field?.querySelector<HTMLInputElement>('input'))?.focus();
  }, [editingAge]);
  useEffect(() => {
    if (!editingAddress) return;
    const field = addressFieldRef.current;
    (field?.querySelector<HTMLInputElement>('input:checked') ?? field?.querySelector<HTMLInputElement>('input'))?.focus();
  }, [editingAddress]);
  const nameIssue = showErrors ? issues.find((issue) => issue.code.startsWith('child_name')) : undefined;
  const ageIssue = showErrors ? issues.find((issue) => issue.code === 'child_age_missing') : undefined;
  const addressIssue = showErrors ? issues.find((issue) => issue.code === 'child_address_missing') : undefined;
  const residenceIssue = showErrors ? issues.find((issue) => issue.code === 'child_residence_missing') : undefined;

  const showNameField = !name || !heard(draft.child.nameSource) || editingName || Boolean(nameIssue);
  const showAgeField = draft.child.age === null || !heard(draft.child.ageSource) || editingAge;
  const showAddressField = draft.child.address === null || !heard(draft.child.addressSource) || editingAddress;
  const showResidenceField = !residence || !heard(draft.child.residenceSource) || editingResidence || Boolean(residenceIssue);
  const badge = (source: CoreValueSource) =>
    source === 'transcript' || source === 'fixture' ? (
      <span className={styles.sourceBadge} data-source={source}>
        {SOURCE_BADGE[source]}
      </span>
    ) : null;

  const valueRow = (text: string, source: CoreValueSource, onEdit: () => void) => (
    <div className={styles.basicRow}>
      <span className={styles.factText}>
        {text}
        {badge(source)}
      </span>
      <button type="button" className={styles.linkButton} onClick={onEdit}>
        {COMMON.edit}
        <span className="sr-only">: {text}</span>
      </button>
    </div>
  );

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
        valueRow(HERO.nameRow(name), draft.child.nameSource, () => setEditingName(true))
      )}

      {showAgeField ? (
        <fieldset ref={ageFieldRef} className={styles.fieldset} aria-describedby={ageIssue ? 'pw-age-error' : undefined}>
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
          ) : null}
        </fieldset>
      ) : (
        valueRow(HERO.ageRow(draft.child.age ?? 0), draft.child.ageSource, () => setEditingAge(true))
      )}

      {showAddressField ? (
        <fieldset
          ref={addressFieldRef}
          className={styles.fieldset}
          aria-describedby={addressIssue ? 'pw-address-error' : undefined}
        >
          <legend className={styles.label}>{HERO.addressLabel}</legend>
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
          ) : null}
        </fieldset>
      ) : draft.child.address ? (
        valueRow(HERO.addressRow(draft.child.address), draft.child.addressSource, () => setEditingAddress(true))
      ) : null}

      {showResidenceField ? (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="pw-residence">
            {HERO.residenceLabel}
          </label>
          <input
            id="pw-residence"
            className={styles.input}
            type="text"
            autoComplete="off"
            maxLength={LIMITS.placeMax}
            placeholder={HERO.residencePlaceholder}
            value={draft.child.residence}
            autoFocus={editingResidence}
            aria-invalid={residenceIssue ? true : undefined}
            aria-describedby={residenceIssue ? 'pw-residence-error' : 'pw-residence-hint'}
            onChange={(event) => update((current) => setChildResidence(current, event.target.value))}
            onBlur={() => update(commitChildResidence)}
          />
          {residenceIssue ? (
            <p id="pw-residence-error" className={styles.error}>
              {HERO.errors.child_residence_missing}
            </p>
          ) : (
            <p id="pw-residence-hint" className={styles.hint}>
              {HERO.residenceHint}
            </p>
          )}
        </div>
      ) : (
        valueRow(HERO.residenceRow(residence), draft.child.residenceSource, () => setEditingResidence(true))
      )}
    </div>
  );
}
