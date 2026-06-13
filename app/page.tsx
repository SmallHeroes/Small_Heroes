import type { Metadata } from 'next';
import Link from 'next/link';
import { buildMvpMatrixResponse } from '@/lib/web/mvp-matrix-response';
import styles from './landing.module.css';

export const metadata: Metadata = {
  title: 'גיבורים קטנים — ספר אישי לילד שלכם',
  description:
    'ספר ילדים מותאם אישית שעוזר להתמודד עם אתגר רגשי — עם דמות שדומה לילד/ה וחבר סיפור מלווה.',
};

const PREVIEW_FRAMES = [
  { src: '/marketing/fox-uri-preview/cover.png', alt: 'כריכת ספר לדוגמה' },
  { src: '/marketing/fox-uri-preview/p5.png', alt: 'עמוד מהספר — רגע בדרך' },
  { src: '/marketing/fox-uri-preview/p10.png', alt: 'עמוד מהספר — משחק' },
  { src: '/marketing/fox-uri-preview/p12.png', alt: 'עמוד מהספר — סיום' },
] as const;

const PRICING = [
  { name: 'לילה טוב', pages: 16, price: 59 },
  { name: 'הרפתקה', pages: 24, price: 79 },
  { name: 'פנטזיה', pages: 32, price: 99 },
] as const;

const STEPS = [
  'בוחרים אתגר',
  'מקבלים ספר אישי עם חבר סיפור',
  'קוראים יחד',
] as const;

export default function HomePage() {
  const matrix = buildMvpMatrixResponse();

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          גיבורים קטנים
        </Link>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>
            ספר אישי שעוזר לילד/ה להתמודד עם אתגר רגשי — עם דמות שדומה לו/לה וחבר סיפור
            שמלווה אותו/ה
          </h1>
          <p className={styles.heroSub}>
            אתם בוחרים את האתגר, מספרים קצת על הילד/ה — ואנחנו בונים ספר בעברית שנכתב סביב מה
            שהוא/היא עובר/ת עכשיו.
          </p>
          <Link
            href="/wizard"
            className={styles.ctaPrimary}
            data-event="landing_start_click"
          >
            להתחיל ספר
          </Link>
        </section>

        <section className={styles.section} aria-labelledby="steps-heading">
          <h2 id="steps-heading" className={styles.sectionTitle}>
            איך זה עובד
          </h2>
          <ol className={styles.steps}>
            {STEPS.map((text, index) => (
              <li key={text} className={styles.step}>
                <span className={styles.stepNum} aria-hidden="true">
                  {index + 1}
                </span>
                <p className={styles.stepText}>{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.section} aria-labelledby="challenges-heading">
          <h2 id="challenges-heading" className={styles.sectionTitle}>
            אתגרים שאפשר לבחור
          </h2>
          <div className={styles.challengeGrid}>
            {matrix.categories.map((slot) => (
              <article
                key={slot.category}
                className={styles.challengeCard}
                data-category={slot.category}
              >
                <span className={styles.challengeEmoji} aria-hidden="true">
                  {slot.emoji}
                </span>
                {slot.companion.image ? (
                  <img
                    className={styles.challengeImg}
                    src={slot.companion.image}
                    alt=""
                    width={88}
                    height={88}
                  />
                ) : null}
                <h3 className={styles.challengeLabel}>{slot.label}</h3>
                <p className={styles.challengeCompanion}>{slot.companionLine}</p>
                <p className={styles.challengeOneLiner}>{slot.oneLiner}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="preview-heading">
          <h2 id="preview-heading" className={styles.sectionTitle}>
            הצצה מספר לדוגמה
          </h2>
          <p className={styles.previewLabel}>
            כך נראה ספר אחד שיצרנו — כל ספר נבנה מחדש לפי הילד/ה שלכם.
          </p>
          <div className={styles.previewGrid}>
            {PREVIEW_FRAMES.map((frame) => (
              <div key={frame.src} className={styles.previewFrame}>
                <img className={styles.previewImg} src={frame.src} alt={frame.alt} loading="lazy" />
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="pricing-heading">
          <h2 id="pricing-heading" className={styles.sectionTitle}>
            מחירים
          </h2>
          <ul className={styles.pricingList}>
            {PRICING.map((tier) => (
              <li key={tier.name} className={styles.pricingItem}>
                <p className={styles.pricingName}>{tier.name}</p>
                <p className={styles.pricingMeta}>
                  {tier.pages} עמ&apos; · ₪{tier.price}
                </p>
              </li>
            ))}
          </ul>
          <p className={styles.pricingNote}>
            המחיר נקבע לפי סוג החוויה ואורך הספר.
          </p>
          <div className={styles.footerCta}>
            <Link
              href="/wizard"
              className={styles.ctaPrimary}
              data-event="landing_start_click"
            >
              להתחיל ספר
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
