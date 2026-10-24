'use client';

import type { MobilePage } from '@/lib/book-layout';
import { getDirectionTemplate, templateCssVars, tokensToCssVars, splitIntoSentences, splitTextByRhythm } from '@/lib/book-layout';
import styles from '../reader-v2.module.css';
import { SceneIllustration } from './SceneIllustration';
import { StickerSlots } from './StickerSlots';

type Props = {
  page: MobilePage;
  isCurrent: boolean;
  immersive?: boolean;
};

export function MobileBookPage({ page, isCurrent, immersive = false }: Props) {
  const template = getDirectionTemplate(page.direction);
  const cssVars = { ...tokensToCssVars(), ...templateCssVars(template) };
  const paperPanel = page.textPresentation === 'paper_panel';

  if (immersive) {
    return (
      <article
        className={styles.mobileScene}
        style={cssVars as React.CSSProperties}
        data-direction={page.direction}
        data-mobile-immersive
      >
        <SceneIllustration
          url={page.illustrationUrl}
          alt="איור סצנה"
          isCurrent={isCurrent}
          className={styles.mobileIllustration}
        />
        {page.showText && page.textPresentation !== 'captionless' ? (
          <div className={styles.mobileImmersiveText}>
            <div key={page.sceneId} className={styles.mobileOverlayProse} dir="rtl" data-reader-prose
              role="region" aria-label="טקסט הסיפור" tabIndex={isCurrent ? 0 : -1}>
              {splitTextByRhythm(page.text).map((paragraph, i) => (
                <p key={i} className={styles.sentence}>{paragraph}</p>
              ))}
            </div>
          </div>
        ) : null}
        <StickerSlots variant="mobile" />
      </article>
    );
  }

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
        <div key={page.sceneId} className={styles.mobilePaperPanel} dir="rtl" data-reader-prose
          role="region" aria-label="טקסט הסיפור" tabIndex={isCurrent ? 0 : -1}>
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
