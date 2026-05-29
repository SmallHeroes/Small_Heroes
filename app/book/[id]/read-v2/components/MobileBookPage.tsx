'use client';

import type { MobilePage } from '@/lib/book-layout';
import { getDirectionTemplate, templateCssVars, tokensToCssVars, splitIntoSentences } from '@/lib/book-layout';
import styles from '../reader-v2.module.css';
import { SceneIllustration } from './SceneIllustration';
import { StickerSlots } from './StickerSlots';

type Props = {
  page: MobilePage;
  isCurrent: boolean;
};

export function MobileBookPage({ page, isCurrent }: Props) {
  const template = getDirectionTemplate(page.direction);
  const cssVars = { ...tokensToCssVars(), ...templateCssVars(template) };

  return (
    <article
      className={styles.mobileScene}
      style={cssVars as React.CSSProperties}
      data-direction={page.direction}
    >
      <SceneIllustration
        url={page.illustrationUrl}
        alt={`איור סצנה`}
        isCurrent={isCurrent}
        className={styles.mobileIllustration}
      />
      {page.showText ? (
        <div className={styles.mobileTextOverlay}>
          {splitIntoSentences(page.text).map((sentence, i) => (
            <p key={i} className={styles.sentence}>
              {sentence}
            </p>
          ))}
          <StickerSlots variant="mobile" />
        </div>
      ) : null}
      {!page.showText ? <StickerSlots variant="mobile" /> : null}
    </article>
  );
}
