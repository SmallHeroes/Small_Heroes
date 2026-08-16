'use client';

/**
 * CompanionSpotlight — the companion steps out of their card to meet the
 * parent (R1D-2027 WOW flow deepening).
 *
 * Home cards open this dialog instead of navigating. The card springs from
 * the clicked card's position (FLIP-lite via CSS vars), the companion pops
 * in with a sparkle burst, then idles ALIVE — breath + sway + an occasional
 * little hop — all transform-only on the real contract-locked art (no AI
 * re-render of the character: identity is canon; see milestone notes).
 * The purple CTA hands off to the same proven /start flow:
 * /wizard?category=X — the wizard skips category+companion (already chosen).
 *
 * Desktop/tablet: centered card. Mobile: bottom sheet.
 * Esc / backdrop / X close. Focus moves in on open and returns on close.
 * prefers-reduced-motion: fades only, no idle loop.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MvpMatrixCategoryPayload } from '@/lib/web/mvp-matrix-response';
import { companionIdleVideoSrc } from '@/lib/web/companion-idle-video';
import styles from './companion-spotlight.module.css';

type CompanionSpotlightProps = {
  slot: MvpMatrixCategoryPayload;
  /** Viewport rect of the clicked card — the spring-from origin. */
  originRect: { x: number; y: number; width: number; height: number } | null;
  onClose: () => void;
};

export function CompanionSpotlight({ slot, originRect, onClose }: CompanionSpotlightProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const startedClosingRef = useRef(false);

  const companion = slot.companion;
  /* Prefer the deterministic transparent cutout (same approved art, background
     flood-filled away offline — never an AI re-render); fall back to the
     original if a cutout is missing. Cutouts live under /Images/spotlight —
     a marketing asset path. They must NOT sit inside public/companions:
     next.config bundles every style01-sheet PNG onto the render functions'
     disk, and these pushed api/debug/replicate-image past Vercel's 250MB cap. */
  const companionSlug = companion.image.split('/')[2] ?? '';
  const cutoutSrc = `/Images/spotlight/${companionSlug}.png`;

  /* Idle VIDEO (per Guy): once it actually plays, it crossfades in over the
     cutout — the cutout stays underneath as the instant placeholder and the
     no-video fallback, so the stage never jumps size. Reduced motion keeps
     the still art (no autoplaying footage). */
  const idleVideoSrc = companionIdleVideoSrc(companion.image);
  const [videoLive, setVideoLive] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);
  const showVideo = Boolean(idleVideoSrc) && !videoFailed && !reducedMotion;

  const requestClose = useCallback(() => {
    if (startedClosingRef.current) return;
    startedClosingRef.current = true;
    const el = dialogRef.current;
    if (!el) {
      onClose();
      return;
    }
    el.dataset.state = 'closing';
    // matches --spotlight-close-ms; fallback timer in case transitionend is lost
    window.setTimeout(onClose, 240);
  }, [onClose]);

  /* Esc closes; focus is pulled into the dialog on open. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKey);
    closeBtnRef.current?.focus();
    // lock page scroll behind the veil
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [requestClose]);

  /* Spring-from-origin: hand the clicked card's center to CSS. */
  const originStyle: Record<string, string> = {};
  if (originRect) {
    const cx = originRect.x + originRect.width / 2;
    const cy = originRect.y + originRect.height / 2;
    originStyle['--from-x'] = `${cx - window.innerWidth / 2}px`;
    originStyle['--from-y'] = `${cy - window.innerHeight / 2}px`;
  }

  return (
    <div
      className={styles.veil}
      data-state="open"
      ref={dialogRef}
      style={originStyle as React.CSSProperties}
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="companion-spotlight-name"
      >
        <button
          ref={closeBtnRef}
          type="button"
          className={styles.close}
          onClick={requestClose}
          aria-label="סגירה"
        >
          ✕
        </button>

        <div className={styles.stage} aria-hidden="true">
          <img
            className={styles.art}
            data-hidden={videoLive ? '1' : '0'}
            src={cutoutSrc}
            alt=""
            draggable={false}
            onError={(e) => {
              const img = e.currentTarget;
              if (img.dataset.fallback !== '1') {
                img.dataset.fallback = '1';
                img.src = companion.image;
              } else {
                img.style.visibility = 'hidden';
              }
            }}
          />
          {showVideo ? (
            <div className={styles.videoBox} data-live={videoLive ? '1' : '0'}>
              <video
                src={idleVideoSrc ?? undefined}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                disablePictureInPicture
                onPlaying={() => setVideoLive(true)}
                onError={() => {
                  setVideoFailed(true);
                  setVideoLive(false);
                }}
              />
            </div>
          ) : null}
          <span className={`${styles.spark} ${styles.spark1}`} />
          <span className={`${styles.spark} ${styles.spark2}`} />
          <span className={`${styles.spark} ${styles.spark3}`} />
          <span className={`${styles.spark} ${styles.spark4}`} />
        </div>

        <div className={styles.body}>
          <h2 id="companion-spotlight-name" className={styles.name}>
            {companion.name}
          </h2>
          {companion.tagline ? <p className={styles.tagline}>{companion.tagline}</p> : null}
          <p className={styles.context}>
            {slot.companionLine} · {slot.oneLiner}
          </p>

          <a
            className={styles.cta}
            href={`/wizard?category=${encodeURIComponent(slot.category)}`}
            data-event="landing_companion_spotlight_start"
            data-category={slot.category}
          >
            מתחילים סיפור עם {companion.name} ←
          </a>
        </div>
      </div>
    </div>
  );
}
