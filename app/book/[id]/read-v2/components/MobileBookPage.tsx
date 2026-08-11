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
  const paperPanel = page.textPresentation === 'paper_panel';

  return (
    <article
      className={`${styles.mobileScene} ${paperPanel ? styles.mobileScenePaperPanel : ''}`}
      style={cssVars as React.CSSProperties}
      data-direction={page.direction}
      data-text-presentation={page.textPresentation}
    >
      <SceneIllustration
        url={page.illustrationUrl}
        alt={`איור סצנה`}
        isCurrent={isCurrent}
        className={styles.mobileIllustration}
      />
      {page.showText && page.textPresentation === 'overlay' ? (
        <div className={styles.mobileTextOverlay}>
          {splitIntoSentences(page.text).map((sentence, i) => (
            <p key={i} className={styles.sentence}>
              {sentence}
            </p>
          ))}
          <StickerSlots variant="mobile" />
        </div>
      ) : null}
      {page.showText && paperPanel ? (
        <div className={styles.mobilePaperPanel} dir="rtl">
          <div className={styles.mobilePaperProse}>
            {splitIntoSentences(page.text).map((sentence, i) => (
              <p key={i} className={styles.sentence}>
                {sentence}
              </p>
            ))}
          </div>
        </div>
      ) : null}
      {page.textPresentation !== 'overlay' ? <StickerSlots variant="mobile" /> : null}
    </article>
  );
}
