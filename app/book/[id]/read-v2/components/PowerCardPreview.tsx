import type { CSSProperties } from 'react';
import { paletteCssVars } from '@/lib/power-cards/palettes';
import { personalizePowerCardCopy } from '@/lib/power-cards/personalize';
import type { PowerCardRenderInput } from '@/lib/power-cards/types';
import styles from './PowerCardPreview.module.css';

type Props = {
  input: PowerCardRenderInput;
  className?: string;
};

export default function PowerCardPreview({ input, className }: Props) {
  const copy = personalizePowerCardCopy(input);
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
        <header className={styles.brand}>
          <span className={styles.brandMark}>גיבורים קטנים</span>
          {input.bookTitle ? <span> · {input.bookTitle}</span> : null}
        </header>

        <section className={styles.hero}>
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.heroFrame}>
            {/* Full-body companion hero — the child's ACTUAL companion, per order. */}
            <img src={input.companionHeroUrl} alt="" className={styles.heroImg} />
          </div>
          <span className={styles.nameplate}>{input.companionName}</span>
        </section>

        <section className={styles.titles}>
          <h2 className={styles.cardTitle}>{copy.title}</h2>
          <p className={styles.cardSubtitle}>{copy.subtitle}</p>
        </section>

        <section className={styles.ritual}>
          <div className={styles.ritualLabel}>הריטואל · ארבעה צעדים</div>
          <ol className={styles.steps} aria-label="ארבעה צעדים">
            {copy.steps.map((step, index) => (
              <li key={step} className={styles.stepRow}>
                <span className={styles.stepNum} aria-hidden="true">
                  {index + 1}
                </span>
                <span className={styles.stepText}>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.reminder}>
          <p className={styles.reminderQuote}>&ldquo;{copy.companionReminder}&rdquo;</p>
          <p className={styles.reminderBy}>— {input.companionName}</p>
        </section>
      </div>
    </article>
  );
}
