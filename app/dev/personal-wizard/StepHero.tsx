'use client';

import type { RefObject } from 'react';

import { HERO } from '@/lib/personal-wizard/copy';
import { PROTOTYPE_AGES, type PersonalBookDraft } from '@/lib/personal-wizard/contract';
import { setChildAddress, setChildAge, setChildName, type RequestIssue } from '@/lib/personal-wizard/draft';

import styles from './personal-wizard.module.css';

type Props = {
  draft: PersonalBookDraft;
  update: (change: (draft: PersonalBookDraft) => PersonalBookDraft) => void;
  issues: RequestIssue[];
  showErrors: boolean;
  titleRef: RefObject<HTMLHeadingElement | null>;
};

export function StepHero({ draft, update, issues, showErrors, titleRef }: Props) {
  const nameIssue = showErrors ? issues.find((issue) => issue.code.startsWith('child_name')) : undefined;
  const ageIssue = showErrors ? issues.find((issue) => issue.code === 'child_age_missing') : undefined;
  const addressIssue = showErrors ? issues.find((issue) => issue.code === 'child_address_missing') : undefined;

  return (
    <section className={styles.step} aria-labelledby="pw-step-title">
      <h1 id="pw-step-title" className={styles.stepTitle} tabIndex={-1} ref={titleRef}>
        {HERO.title}
      </h1>
      <p className={styles.stepSub}>{HERO.sub}</p>

      <div className={styles.card}>
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

        <fieldset className={styles.fieldset} aria-describedby={ageIssue ? 'pw-age-error' : 'pw-age-hint'}>
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

        <fieldset className={styles.fieldset} aria-describedby={addressIssue ? 'pw-address-error' : 'pw-address-hint'}>
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
          ) : (
            <p id="pw-address-hint" className={styles.hint}>
              {HERO.addressHint}
            </p>
          )}
        </fieldset>
      </div>
    </section>
  );
}
