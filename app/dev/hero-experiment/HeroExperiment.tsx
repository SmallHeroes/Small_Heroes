'use client';

/**
 * EXPERIMENT v2 — hero: a REAL SmallHeroes spread (Book.webp — actual rendered
 * sample book: illustration left, Hebrew story right) presented in gentle 3D
 * perspective. One settle-in motion, quiet ambient light, small pointer depth.
 * Personalization moment: a bookmark ribbon over the book carries
 * "הסיפור של {name}" and rewrites live as the parent types (mirrors the
 * product's real name→title behavior; the printed page itself is the sample).
 *
 * Static fallback: without JS / reduced-motion the book renders settled and
 * complete; CTA is a plain link and never waits for animation.
 */

import { useEffect, useRef, useState } from 'react';
import styles from './hero-experiment.module.css';

const DEFAULT_NAME = 'נועה';

export function HeroExperiment() {
  const [name, setName] = useState(DEFAULT_NAME);
  const [settled, setSettled] = useState(false);
  const [reduced, setReduced] = useState(false);
  const bookRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const shownName = name.trim() || DEFAULT_NAME;

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (reduced) {
      setSettled(true);
      return;
    }
    const t = window.setTimeout(() => setSettled(true), 120);
    return () => window.clearTimeout(t);
  }, [reduced]);

  /* Gentle pointer depth (fine pointers, ±2.2deg, rAF-throttled) */
  useEffect(() => {
    if (reduced) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    const onMove = (e: PointerEvent) => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const book = bookRef.current;
        if (!book) return;
        const r = book.getBoundingClientRect();
        const cx = (e.clientX - (r.left + r.width / 2)) / r.width;
        const cy = (e.clientY - (r.top + r.height / 2)) / r.height;
        if (Math.abs(cx) > 1.4 || Math.abs(cy) > 1.4) {
          book.style.setProperty('--px', '0deg');
          book.style.setProperty('--py', '0deg');
          return;
        }
        book.style.setProperty('--py', `${(cx * 2.2).toFixed(2)}deg`);
        book.style.setProperty('--px', `${(-cy * 1.6).toFixed(2)}deg`);
      });
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [reduced]);

  return (
    <section className={styles.hero} data-settled={settled ? 'yes' : 'no'}>
      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.badge}>חבילה אחת לילד שלכם — ספר דיגיטלי מאויר עם קריינות מלאה</p>
          <h1 className={styles.h1}>משהו קשה לילד שלכם עכשיו?</h1>
          <p className={styles.sub}>
            אתם מספרים מה הוא עובר — ואנחנו בונים ספר אישי בעברית: דמות בהשראתו,
            חבר מלווה, וסיפור שמדבר אליו.
          </p>

          <label className={styles.nameLab} htmlFor="heroName">
            איך קוראים לילד/ה? <span className={styles.nameHint}>הספר מתעדכן ↓</span>
          </label>
          <input
            id="heroName"
            className={styles.nameInput}
            type="text"
            maxLength={16}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={DEFAULT_NAME}
          />

          <div className={styles.ctaRow}>
            <a className={styles.ctaPrimary} href="/start">ליצור ספר לילד שלי</a>
            <a className={styles.ctaLight} href="/#sample">לראות דוגמה</a>
          </div>
          <p className={styles.ctaNote}>דקה שאלון · ספר דיגיטלי · קריינות · בעברית</p>
        </div>

        {/* ── The real spread, in perspective ── */}
        <div className={styles.stage}>
          <div className={styles.glow} aria-hidden />
          <div ref={bookRef} className={styles.book} aria-hidden>
            <img
              className={styles.spreadPhoto}
              src="/Images/Book.webp"
              alt=""
              width={2739}
              height={1670}
              draggable={false}
              fetchPriority="high"
            />
            {/* personalization ribbon — updates live as the parent types */}
            <div className={styles.ribbon}>
              <span className={styles.ribbonKicker}>ספר אישי</span>
              <span className={styles.ribbonName}>הסיפור של {shownName}</span>
            </div>
            <span className={styles.tableShadow} aria-hidden />
          </div>
        </div>
      </div>
    </section>
  );
}
