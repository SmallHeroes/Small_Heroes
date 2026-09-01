'use client';

import { splitIntoSentences, type DesktopSpread } from '@/lib/book-layout';
import styles from '../reader-v2.module.css';
import { SceneIllustration } from './SceneIllustration';
import { StickerSlots } from './StickerSlots';

type Props = {
  spread: DesktopSpread;
  isCurrent: boolean;
};

export type DesktopBookPageSide = 'illustration' | 'prose';

type SideProps = Props & {
  side: DesktopBookPageSide;
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
 * The static book and physical-turn engine compose these exact side renderers.
 * Texture-only mode avoids image-loading hooks and empty future sticker slots
 * in every mesh slice while retaining the same visible DOM classes and geometry.
 */
export function DesktopBookPageSideSurface({
  spread,
  isCurrent,
  side,
  textureOnly = false,
}: SideProps) {
  if (side === 'illustration') {
    return (
      <>
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

        {textureOnly ? null : (
          <div className={styles.openPageLeft}>
            <StickerSlots variant="desktop" />
          </div>
        )}
      </>
    );
  }

  return (
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
      {textureOnly ? null : <StickerSlots variant="desktop" />}
    </div>
  );
}

/**
 * The single visual source of truth for a normal desktop spread. The physical
 * turn composes the same side renderers, but never mounts the invisible opposite
 * page inside every mesh strip.
 */
export function DesktopBookPageSurface({ spread, isCurrent }: Props) {
  return (
    <div className={styles.desktopBookPageSurface} data-desktop-book-page-surface>
      <DesktopBookPageSideSurface
        spread={spread}
        isCurrent={isCurrent}
        side="illustration"
      />
      <DesktopBookPageSideSurface spread={spread} isCurrent={isCurrent} side="prose" />
    </div>
  );
}
