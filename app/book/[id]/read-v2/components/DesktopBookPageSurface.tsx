'use client';

import { splitIntoSentences, type DesktopSpread } from '@/lib/book-layout';
import styles from '../reader-v2.module.css';
import { SceneIllustration } from './SceneIllustration';
import { StickerSlots } from './StickerSlots';

type Props = {
  spread: DesktopSpread;
  isCurrent: boolean;
  textureOnly?: boolean;
};

function LoadedIllustrationTexture({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div
        className={`${styles.illustrationPlaceholder} ${styles.leftPageMaskedIllustration}`}
      >
        <p className={styles.illustrationPlaceholderMsg}>האיור עדיין נטען...</p>
      </div>
    );
  }

  return (
    <div className={`${styles.illustrationFrame} ${styles.leftPageMaskedIllustration}`}>
      <img
        src={url}
        alt=""
        className={`${styles.illustrationImg} ${styles.illustrationImgLoaded}`}
        draggable={false}
      />
    </div>
  );
}

/**
 * The single visual source of truth for a normal desktop spread.
 *
 * The static book mounts it directly. The physical-turn engine projects this
 * exact full-spread surface into each moving page before slicing it. The
 * texture-only mode avoids creating image-loading hooks in every mesh slice,
 * while retaining the same loaded DOM classes and geometry.
 */
export function DesktopBookPageSurface({
  spread,
  isCurrent,
  textureOnly = false,
}: Props) {
  return (
    <div className={styles.desktopBookPageSurface} data-desktop-book-page-surface>
      <div className={styles.leftPageMaskLayer}>
        {textureOnly ? (
          <LoadedIllustrationTexture url={spread.illustrationUrl} />
        ) : (
          <SceneIllustration
            url={spread.illustrationUrl}
            alt="איור סצנה"
            isCurrent={isCurrent}
            className={styles.leftPageMaskedIllustration}
          />
        )}
        <span className={styles.leftPageGrain} aria-hidden />
        <span className={styles.leftPageWarmEdge} aria-hidden />
      </div>

      <div className={styles.openPageLeft}>
        <StickerSlots variant="desktop" />
      </div>

      <div className={styles.openPageRight}>
        {spread.showText ? (
          <div className={styles.openTextSafe}>
            <div className={`${styles.proseBody} ${styles.storyText}`}>
              {splitIntoSentences(spread.text).map((sentence, index) => (
                <p key={index} className={styles.sentence}>
                  {sentence}
                </p>
              ))}
            </div>
          </div>
        ) : null}
        <StickerSlots variant="desktop" />
      </div>
    </div>
  );
}
