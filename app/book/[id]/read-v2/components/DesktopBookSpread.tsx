'use client';

import type { ReactNode } from 'react';

import type { DesktopSpread } from '@/lib/book-layout';
import {
  getDirectionTemplate,
  MASK_ON_BOOK_ASSET,
  OPEN_BOOK_ASSET,
  openBookLayoutCssVars,
  splitTextByRhythm,
  templateCssVars,
  tokensToCssVars,
} from '@/lib/book-layout';
import styles from '../reader-v2.module.css';
import { SceneIllustration } from './SceneIllustration';
import { DesktopBookPageSurface } from './DesktopBookPageSurface';
import { StickerSlots } from './StickerSlots';

type Props = {
  spread: DesktopSpread;
  isCurrent: boolean;
  pageTurnOverlay?: ReactNode;
};

/**
 * Desktop composite spread: warm-dark stage + OpenBook.png + HTML overlays.
 * Top decorative layer: MaskOnBook.png torn-paper frame.
 * Motifs disabled for composite revision; direction templates kept for typography/colors.
 */
export function DesktopBookSpread({ spread, isCurrent, pageTurnOverlay }: Props) {
  const template = getDirectionTemplate(spread.direction);
  const cssVars = { ...tokensToCssVars(), ...templateCssVars(template), ...openBookLayoutCssVars() };
  const lines = splitTextByRhythm(spread.text);
  const isWide = spread.isWide;

  if (isWide) {
    return (
      <article
        className={styles.openBookFrame}
        style={cssVars as React.CSSProperties}
        data-direction={spread.direction}
      >
        <img
          className={styles.openBookImage}
          src={OPEN_BOOK_ASSET.src}
          width={OPEN_BOOK_ASSET.width}
          height={OPEN_BOOK_ASSET.height}
          alt=""
          aria-hidden
          draggable={false}
        />
        <div className={styles.openPageSpread}>
          <SceneIllustration
            url={spread.illustrationUrl}
            alt="איור רחב"
            isCurrent={isCurrent}
            className={styles.openPageIllustration}
            wide
          />
          {spread.showText && spread.textTreatment === 'overlay' ? (
            <div className={styles.wideTextOverlay}>
              {lines.map((line, i) => (
                <p key={i} className={styles.proseLine}>
                  {line}
                </p>
              ))}
            </div>
          ) : null}
          <StickerSlots variant="desktop" />
        </div>
        {pageTurnOverlay}
        {/* One decorative frame stays above static and moving page content. */}
        <img
          className={styles.maskOnBookImage}
          src={MASK_ON_BOOK_ASSET.src}
          width={MASK_ON_BOOK_ASSET.width}
          height={MASK_ON_BOOK_ASSET.height}
          alt=""
          aria-hidden
          draggable={false}
        />
      </article>
    );
  }

  return (
    <article
      className={styles.openBookFrame}
      style={cssVars as React.CSSProperties}
      data-direction={spread.direction}
      data-motifs="off"
    >
      <img
        className={styles.openBookImage}
        src={OPEN_BOOK_ASSET.src}
        width={OPEN_BOOK_ASSET.width}
        height={OPEN_BOOK_ASSET.height}
        alt=""
        aria-hidden
        draggable={false}
      />
      <DesktopBookPageSurface spread={spread} isCurrent={isCurrent} />
      {pageTurnOverlay}
      {/* One torn-paper frame masks both the static base and the moving sheet. */}
      <img
        className={styles.maskOnBookImage}
        src={MASK_ON_BOOK_ASSET.src}
        width={MASK_ON_BOOK_ASSET.width}
        height={MASK_ON_BOOK_ASSET.height}
        alt=""
        aria-hidden
        draggable={false}
      />
    </article>
  );
}
