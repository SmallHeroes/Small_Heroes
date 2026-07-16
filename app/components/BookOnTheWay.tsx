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

const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

// One icon per craft stage, index-aligned with ROTATING_MSGS.
const STAGE_ICONS = [
  <svg key="i0" {...iconProps} aria-hidden="true">
    <path d="M4 20c0-6 4-12 11-15-1 8-5 13-11 15Z" />
    <path d="M6.5 17.5 3 21" />
    <path d="M13 9c2 .3 3.4 1.5 4 3" />
  </svg>,
  <svg key="i1" {...iconProps} aria-hidden="true">
    <path d="M14 3 21 10l-8.5 8.5a3.5 3.5 0 0 1-5-5L14 3Z" />
    <path d="M6 14c-2 1-3 3-3 6 3 0 5-1 6-3" />
  </svg>,
  <svg key="i2" {...iconProps} aria-hidden="true">
    <path d="M12 3a9 9 0 1 0 0 18 2 2 0 0 0 1.6-3.2 2 2 0 0 1 1.6-3.2H18a3 3 0 0 0 3-3A9 9 0 0 0 12 3Z" />
    <circle cx="7.5" cy="10.5" r="1" />
    <circle cx="12" cy="7.5" r="1" />
    <circle cx="16.5" cy="10.5" r="1" />
  </svg>,
  <svg key="i3" {...iconProps} aria-hidden="true">
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M6 11a6 6 0 0 0 12 0" />
    <path d="M12 17v4" />
  </svg>,
  <svg key="i4" {...iconProps} aria-hidden="true">
    <path d="M12 6S10 4.5 6.5 4.5 3 6 3 6v12s2-1.5 5-1.5S12 18 12 18" />
    <path d="M12 6s2-1.5 5.5-1.5S21 6 21 6v12s-2-1.5-5-1.5S12 18 12 18" />
  </svg>,
];

type StarPos = { top: string; left?: string; right?: string; size: number; delay: string };

const STAR_POSITIONS: StarPos[] = [
  { top: '9%', left: '13%', size: 3, delay: '0s' },
  { top: '15%', right: '17%', size: 2, delay: '0.7s' },
  { top: '29%', left: '7%', size: 4, delay: '1.3s' },
  { top: '23%', right: '9%', size: 3, delay: '0.4s' },
  { top: '43%', right: '5%', size: 2, delay: '1.9s' },
  { top: '39%', left: '11%', size: 3, delay: '1.1s' },
  { top: '57%', left: '6%', size: 2, delay: '0.9s' },
  { top: '61%', right: '8%', size: 3, delay: '1.6s' },
  { top: '11%', left: '44%', size: 2, delay: '2.2s' },
  { top: '71%', left: '19%', size: 2, delay: '0.3s' },
  { top: '69%', right: '21%', size: 3, delay: '1.4s' },
  { top: '50%', left: '52%', size: 2, delay: '2.6s' },
];

const RISE_POSITIONS = [
  { left: '30%', delay: '0s' },
  { left: '46%', delay: '1.4s' },
  { left: '60%', delay: '2.6s' },
  { left: '38%', delay: '3.4s' },
  { left: '54%', delay: '0.8s' },
];

function StarField() {
  return (
    <div className={styles.stars} aria-hidden="true">
      <span className={styles.moon} />
      {STAR_POSITIONS.map((pos, i) => (
        <span
          key={`star-${i}`}
          className={styles.star}
          style={{
            top: pos.top,
            left: pos.left,
            right: pos.right,
            width: `${pos.size}px`,
            height: `${pos.size}px`,
            animationDelay: pos.delay,
          }}
        />
      ))}
    </div>
  );
}

function OpenBookIllustration() {
  return (
    <svg width="220" height="214" viewBox="0 0 212 206" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="botwCover" x1="0" y1="60" x2="0" y2="164" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5a49a6" />
          <stop offset="1" stopColor="#302760" />
        </linearGradient>
        <linearGradient id="botwPageL" x1="30" y1="66" x2="104" y2="156" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fffdf8" />
          <stop offset="1" stopColor="#e9ddff" />
        </linearGradient>
        <linearGradient id="botwPageR" x1="108" y1="66" x2="182" y2="156" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fffefb" />
          <stop offset="1" stopColor="#ffe7d2" />
        </linearGradient>
        <linearGradient id="botwSpine" x1="100" y1="58" x2="112" y2="164" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a98cff" />
          <stop offset="0.5" stopColor="#7a5cf0" />
          <stop offset="1" stopColor="#5a44a0" />
        </linearGradient>
        <linearGradient id="botwGild" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#ffe6a8" />
          <stop offset="1" stopColor="#d89b3d" />
        </linearGradient>
        <radialGradient id="botwSun" cx="0.5" cy="0.5" r="0.5">
          <stop stopColor="#ffe79a" />
          <stop offset="1" stopColor="#ffc861" />
        </radialGradient>
      </defs>

      {/* hardcover backing */}
      <path
        d="M106 60 C82 52 50 54 24 64 C18 66 16 69 16 75 L16 156 C16 162 18 164 24 163 C50 154 82 154 106 162 Z"
        fill="url(#botwCover)"
        stroke="#6f57b8"
        strokeWidth="1.4"
      />
      <path
        d="M106 60 C130 52 162 54 188 64 C194 66 196 69 196 75 L196 156 C196 162 194 164 188 163 C162 154 130 154 106 162 Z"
        fill="url(#botwCover)"
        stroke="#6f57b8"
        strokeWidth="1.4"
      />

      {/* gilded page-block edges (thickness) */}
      <path d="M30 152 C56 145 82 145 102 151 L102 158 C82 152 56 152 30 159 Z" fill="url(#botwGild)" />
      <path d="M110 151 C130 145 156 145 182 152 L182 159 C156 152 130 152 110 158 Z" fill="url(#botwGild)" />

      {/* pages */}
      <path d="M104 66 C82 60 54 62 30 70 C26 71 24 73 24 77 L24 150 C24 154 26 155.5 30 154.5 C54 148 82 148 104 154 Z" fill="url(#botwPageL)" />
      <path d="M108 66 C130 60 158 62 182 70 C186 71 188 73 188 77 L188 150 C188 154 186 155.5 182 154.5 C158 148 130 148 108 154 Z" fill="url(#botwPageR)" />

      {/* gutter shadow */}
      <path d="M104 66 L104 154 C101 153 99 152 97 151 L97 69 C99 68 101 67 104 66 Z" fill="#0d0730" opacity="0.1" />
      <path d="M108 66 L108 154 C111 153 113 152 115 151 L115 69 C113 68 111 67 108 66 Z" fill="#0d0730" opacity="0.07" />

      {/* spine */}
      <path d="M100 60 L112 60 L112 166 L106 160 L100 166 Z" fill="url(#botwSpine)" />
      <path d="M106 62 L106 158" stroke="#c9b6ff" strokeWidth="1" opacity="0.5" strokeLinecap="round" />

      {/* left page — the story being written */}
      <g stroke="#c1aee4" strokeWidth="2.6" strokeLinecap="round" opacity="0.6">
        <path d="M40 86 C55 83 72 82 92 84" />
        <path d="M38 101 C55 98 74 97 96 99" />
        <path d="M40 116 C54 113 70 112 88 114" />
        <path d="M40 131 C53 129 66 128 82 130" />
      </g>

      {/* right page — a little illustrated scene coming to life */}
      <circle cx="168" cy="96" r="8.5" fill="url(#botwSun)" />
      <path d="M116 134 C138 118 162 118 186 126 L186 150 C160 145 138 145 116 151 Z" fill="#c4ead0" />
      <path d="M116 144 C140 132 166 132 186 140 L186 150 C160 146 138 146 116 151 Z" fill="#9ad7ae" />
      <path d="M136 144 C136 134 141 129 144 128 C147 129 152 134 152 144 Z" fill="#6fbf93" />
      <rect x="142.6" y="143" width="3" height="8" rx="1.2" fill="#8a6a4e" />

      {/* magic sparks lifting off the story */}
      <g transform="translate(134,42) scale(1.25)">
        <path className={styles.bloom} style={{ animationDelay: '0.2s' }} d="M0 -6 C0.8 -1.6 1.6 -0.8 6 0 C1.6 0.8 0.8 1.6 0 6 C-0.8 1.6 -1.6 0.8 -6 0 C-1.6 -0.8 -0.8 -1.6 0 -6 Z" fill="#ffe7ac" />
      </g>
      <g transform="translate(108,32) scale(0.8)">
        <path className={styles.bloom} style={{ animationDelay: '1.1s' }} d="M0 -6 C0.8 -1.6 1.6 -0.8 6 0 C1.6 0.8 0.8 1.6 0 6 C-0.8 1.6 -1.6 0.8 -6 0 C-1.6 -0.8 -0.8 -1.6 0 -6 Z" fill="#ffffff" />
      </g>
      <g transform="translate(170,50) scale(0.68)">
        <path className={styles.bloom} style={{ animationDelay: '1.9s' }} d="M0 -6 C0.8 -1.6 1.6 -0.8 6 0 C1.6 0.8 0.8 1.6 0 6 C-0.8 1.6 -1.6 0.8 -6 0 C-1.6 -0.8 -0.8 -1.6 0 -6 Z" fill="#ffd68a" />
      </g>
      <g transform="translate(152,24) scale(0.72)">
        <path className={styles.bloom} style={{ animationDelay: '2.6s' }} d="M0 -6 C0.8 -1.6 1.6 -0.8 6 0 C1.6 0.8 0.8 1.6 0 6 C-0.8 1.6 -1.6 0.8 -6 0 C-1.6 -0.8 -0.8 -1.6 0 -6 Z" fill="#ffffff" />
      </g>
    </svg>
  );
}

function EnvelopeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffcf7a" strokeWidth="1.6" aria-hidden="true">
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
      }, 320);
    }, 2800);
    return () => window.clearInterval(interval);
  }, [ready]);

  if (ready) {
    return (
      <div className={styles.wrap} dir="rtl">
        <StarField />
        <div className={styles.scene}>
          <div className={styles.glow} />
          <div className={styles.book}>
            <OpenBookIllustration />
          </div>
          <div className={styles.badge} aria-hidden="true">
            <span className={styles.badgeRing} />
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L19 7" />
            </svg>
          </div>
        </div>
        <h1 className={styles.readyTitle}>
          הספר של <span className={styles.titleAccent}>{displayName}</span> מוכן! ✨
        </h1>
        <p className={styles.sub}>הרגע שחיכיתם לו הגיע — בואו נפתח אותו יחד.</p>
        {readerHref ? (
          <Link href={readerHref} className={styles.readyBtn}>
            לפתיחת הספר
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.wrap} dir="rtl">
      <StarField />

      {RISE_POSITIONS.map((pos, i) => (
        <span
          key={`rise-${i}`}
          className={styles.rise}
          style={{ left: pos.left, animationDelay: pos.delay }}
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
      </div>

      <h1 className={styles.title}>
        קיבלנו! הספר של <span className={styles.titleAccent}>{displayName}</span> יוצא לדרך
      </h1>
      <p className={styles.sub}>אנחנו יוצרים אותו עכשיו, באהבה ובקצב שלו 🎨</p>

      <div className={styles.progress}>
        <div className={[styles.progressRow, msgFade ? styles.progressRowFade : ''].filter(Boolean).join(' ')}>
          <span className={styles.progressIcon}>{STAGE_ICONS[msgIndex]}</span>
          <span className={styles.progressMsg}>{ROTATING_MSGS[msgIndex]}</span>
        </div>
        <div className={styles.progressTrack} aria-hidden="true">
          <div className={styles.progressBar} />
        </div>
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
