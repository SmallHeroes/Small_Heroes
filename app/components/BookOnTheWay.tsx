'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import styles from './book-on-the-way.module.css';

const ROTATING_MSGS = [
  'כותבים את הסיפור…',
  'מציירים את האיורים…',
  'בוחרים את הצבעים…',
  'מקליטים את הקריינות…',
  'כורכים את הספר…',
];

const SPARKLE_POSITIONS = [
  { top: '8%', right: '12%', delay: '0s' },
  { top: '18%', left: '8%', delay: '0.8s' },
  { top: '42%', right: '4%', delay: '1.4s' },
  { bottom: '28%', left: '14%', delay: '0.4s' },
  { top: '6%', left: '38%', delay: '1.9s' },
];

const RISE_POSITIONS = [
  { left: '22%', delay: '0s' },
  { left: '48%', delay: '1.6s' },
  { left: '72%', delay: '3.1s' },
];

const BLOOM_DELAYS = ['0s', '0.6s', '1.2s', '1.8s', '2.4s', '3s'];

function OpenBookIllustration() {
  return (
    <svg width="160" height="130" viewBox="0 0 160 130" aria-hidden="true">
      <rect x="76" y="18" width="8" height="94" rx="2" fill="#6b4eff" />
      <path d="M76 24 C58 28 38 30 22 34 L22 100 C38 96 58 94 76 90 Z" fill="#fff9ee" stroke="#ece3d2" strokeWidth="1.2" />
      <path d="M84 24 C102 28 122 30 138 34 L138 100 C122 96 102 94 84 90 Z" fill="#fffdf8" stroke="#ece3d2" strokeWidth="1.2" />
      <circle className={styles.bloom} cx="48" cy="58" r="9" fill="#ffb8c9" style={{ animationDelay: BLOOM_DELAYS[0] }} />
      <circle className={styles.bloom} cx="68" cy="72" r="7" fill="#b3a7ff" style={{ animationDelay: BLOOM_DELAYS[1] }} />
      <circle className={styles.bloom} cx="92" cy="66" r="8" fill="#ffee6c" style={{ animationDelay: BLOOM_DELAYS[2] }} />
      <circle className={styles.bloom} cx="112" cy="54" r="9" fill="#9de8d8" style={{ animationDelay: BLOOM_DELAYS[3] }} />
      <circle className={styles.bloom} cx="54" cy="84" r="6" fill="#ffd4a8" style={{ animationDelay: BLOOM_DELAYS[4] }} />
      <circle className={styles.bloom} cx="104" cy="82" r="7" fill="#c9b6ff" style={{ animationDelay: BLOOM_DELAYS[5] }} />
    </svg>
  );
}

function EnvelopeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b4eff" strokeWidth="1.6" aria-hidden="true">
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 8l9 6 9-6" />
    </svg>
  );
}

export type BookOnTheWayProps = {
  childName: string;
  ready?: boolean;
  readerHref?: string;
};

export function BookOnTheWay({ childName, ready = false, readerHref }: BookOnTheWayProps) {
  const [msgIndex, setMsgIndex] = useState(0);
  const [msgFade, setMsgFade] = useState(false);
  const displayName = childName.trim() || 'הגיבור/ה';

  useEffect(() => {
    if (ready) return;
    const interval = window.setInterval(() => {
      setMsgFade(true);
      window.setTimeout(() => {
        setMsgIndex((i) => (i + 1) % ROTATING_MSGS.length);
        setMsgFade(false);
      }, 250);
    }, 2600);
    return () => window.clearInterval(interval);
  }, [ready]);

  if (ready) {
    return (
      <div className={styles.wrap} dir="rtl">
        <div className={styles.scene}>
          <div className={styles.glow} />
          <div className={styles.book}>
            <OpenBookIllustration />
          </div>
          <div className={styles.badge} aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
              <path d="M5 12l5 5L19 7" />
            </svg>
          </div>
        </div>
        <h1 className={styles.readyTitle}>הספר של {displayName} מוכן! ✨</h1>
        {readerHref ? (
          <Link href={readerHref} className={styles.readyBtn}>
            לצפייה בספר
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.wrap} dir="rtl">
      {SPARKLE_POSITIONS.map((pos, i) => (
        <span
          key={`spark-${i}`}
          className={styles.spark}
          style={{ ...pos, animationDelay: pos.delay }}
          aria-hidden="true"
        >
          ✨
        </span>
      ))}
      {RISE_POSITIONS.map((pos, i) => (
        <span
          key={`rise-${i}`}
          className={styles.rise}
          style={{ ...pos, animationDelay: pos.delay }}
          aria-hidden="true"
        >
          ✦
        </span>
      ))}

      <div className={styles.scene}>
        <div className={styles.glow} />
        <div className={styles.book}>
          <OpenBookIllustration />
        </div>
        <div className={styles.badge} aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
            <path d="M5 12l5 5L19 7" />
          </svg>
        </div>
      </div>

      <h1 className={styles.title}>
        קיבלנו! הספר של <span className={styles.titleAccent}>{displayName}</span> יוצא לדרך
      </h1>
      <p className={styles.sub}>אנחנו יוצרים אותו עכשיו, באהבה ובקצב שלו 🎨</p>

      <div className={styles.status}>
        <span className={styles.pdot} aria-hidden="true" />
        <span className={[styles.statusMsg, msgFade ? styles.statusMsgFade : ''].filter(Boolean).join(' ')}>
          {ROTATING_MSGS[msgIndex]}
        </span>
      </div>

      <div className={styles.mailChip}>
        <EnvelopeIcon />
        <span>נשלח לך מייל עם הספר ברגע שהוא מוכן</span>
      </div>

      <p className={styles.note}>
        אפשר לסגור את החלון בשקט — שום דבר לא יאבד. הקסם ממשיך לקרות גם כשאתם לא כאן ✨
      </p>
    </div>
  );
}
