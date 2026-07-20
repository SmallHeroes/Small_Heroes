'use client';

import type { DesktopSpread } from '@/lib/book-layout';
import {
  getDirectionTemplate,
  MASK_ON_BOOK_ASSET,
  OPEN_BOOK_ASSET,
  openBookLayoutCssVars,
  splitIntoSentences,
  splitTextByRhythm,
  templateCssVars,
  tokensToCssVars,
} from '@/lib/book-layout';
import styles from '../reader-v2.module.css';
import { SceneIllustration } from './SceneIllustration';
import { StickerSlots } from './StickerSlots';

type Props = {
  spread: DesktopSpread;
  isCurrent: boolean;
};

/**
 * Desktop composite spread: warm-dark stage + OpenBook.png + HTML overlays.
 * Top decorative layer: MaskOnBook.png torn-paper frame.
 * Motifs disabled for composite revision; direction templates kept for typography/colors.
 */
export function DesktopBookSpread({ spread, isCurrent }: Props) {
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
        {/* Torn-paper decorative overlay - sits above all page content */}
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
      {/* Left-page illustration — a FULL-FRAME layer clipped to the true page shape by BookImageBottomMask.png
          as a CSS mask (layers 2+3 of Guy's stack: מסכה + תמונה). It spans the whole page width and overflows
          top/bottom; the mask cuts the overflow at the real page edge. Loading/error states live inside it. */}
      <div className={styles.leftPageMaskLayer}>
        <SceneIllustration
          url={spread.illustrationUrl}
          alt="איור סצנה"
          isCurrent={isCurrent}
          className={styles.leftPageMaskedIllustration}
        />
        <span className={styles.leftPageGrain} aria-hidden />
        <span className={styles.leftPageWarmEdge} aria-hidden />
      </div>
      {/* Left page — stickers only; the illustration moved to the masked layer above. */}
      <div className={styles.openPageLeft}>
        <StickerSlots variant="desktop" />
      </div>
      {/* Right page - prose (RTL); paper comes from OpenBook.png */}
      <div className={styles.openPageRight}>
        <div className={styles.openTextSafe}>
          <div className={`${styles.proseBody} ${styles.storyText}`}>
            {splitIntoSentences(spread.text).map((sentence, i) => (
              <p key={i} className={styles.sentence}>
                {sentence}
              </p>
            ))}
          </div>
        </div>
        <StickerSlots variant="desktop" />
      </div>
      {/* Torn-paper decorative overlay - sits above all page content, masks ragged edges */}
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
