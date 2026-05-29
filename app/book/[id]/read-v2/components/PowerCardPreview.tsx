import type { CSSProperties } from 'react';
import { resolveStoryBankPlaceholders } from '@/lib/story-bank-personalization';
import { paletteCssVars } from '@/lib/power-cards/palettes';
import type { PowerCardRenderInput } from '@/lib/power-cards/types';
import styles from './PowerCardPreview.module.css';

type Props = {
  input: PowerCardRenderInput;
  className?: string;
};

function renderGenderForPersonalization(
  gender: PowerCardRenderInput['childGender']
): 'boy' | 'girl' {
  return gender === 'female' ? 'girl' : 'boy';
}

function personalizeInput(input: PowerCardRenderInput) {
  const ctx = {
    childName: input.childName,
    childGender: renderGenderForPersonalization(input.childGender),
    companionName: input.companionName,
  };

  return {
    title: resolveStoryBankPlaceholders(input.spec.title, ctx),
    subtitle: resolveStoryBankPlaceholders(input.spec.subtitle, ctx),
    steps: input.spec.steps.map((step) => resolveStoryBankPlaceholders(step, ctx)),
    companionReminder: resolveStoryBankPlaceholders(input.spec.companionReminder, ctx),
  };
}

export default function PowerCardPreview({ input, className }: Props) {
  const copy = personalizeInput(input);
  const paletteStyle = paletteCssVars(input.palette) as CSSProperties;

  return (
    <article
      className={[styles.card, className].filter(Boolean).join(' ')}
      style={paletteStyle}
      dir="rtl"
      lang="he"
      aria-label={`כרטיס כוח: ${copy.title}`}
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.brandMark}>גיבורים קטנים</span>
          {input.bookTitle ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{input.bookTitle}</span>
            </>
          ) : null}
        </header>

        <section className={styles.titleSection}>
          <div className={styles.avatarWrap}>
            <img
              src={input.companionAvatarUrl}
              alt=""
              className={styles.avatar}
              width={88}
              height={88}
            />
          </div>
          <h2 className={styles.cardTitle}>{copy.title}</h2>
          <p className={styles.cardSubtitle}>{copy.subtitle}</p>
        </section>

        <ol className={styles.steps} aria-label="ארבעה צעדים">
          {copy.steps.map((step, index) => (
            <li key={step} className={styles.stepRow}>
              <span className={styles.stepNumber} aria-hidden="true">
                {index + 1}.
              </span>
              <span className={styles.stepText}>{step}</span>
            </li>
          ))}
        </ol>

        <section className={styles.reminderSection}>
          <p className={styles.reminderQuote}>&ldquo;{copy.companionReminder}&rdquo;</p>
          <p className={styles.companionAttribution}>— {input.companionName}</p>
          <div className={styles.bottomDivider} aria-hidden="true" />
        </section>
      </div>
    </article>
  );
}
