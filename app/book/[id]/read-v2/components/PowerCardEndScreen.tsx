'use client';

import PowerCardPreview from './PowerCardPreview';
import type { PowerCardRenderInput } from '@/lib/power-cards/types';
import styles from '../reader-v2.module.css';

type Props = {
  orderId: string;
  accessKey: string;
  childName: string;
  powerCard: PowerCardRenderInput;
  onContinue: () => void;
};

export function PowerCardEndScreen({
  orderId,
  accessKey,
  childName,
  powerCard,
  onContinue,
}: Props) {
  const pdfUrl = `/api/orders/${encodeURIComponent(orderId)}/power-card?format=pdf&accessKey=${encodeURIComponent(accessKey)}`;
  const pngUrl = `/api/orders/${encodeURIComponent(orderId)}/power-card?format=png&accessKey=${encodeURIComponent(accessKey)}`;

  return (
    <section className={styles.powerCardEndScreen} aria-labelledby="power-card-end-title">
      <h2 id="power-card-end-title" className={styles.powerCardEndTitle}>
        הכרטיס של {childName}
      </h2>
      <p className={styles.powerCardEndSubtext}>
        הנה כלי קטן שאפשר לחזור אליו גם אחרי שהסיפור נגמר.
      </p>

      <div className={styles.powerCardEndPreviewWrap}>
        <PowerCardPreview input={powerCard} className={styles.powerCardEndPreview} />
      </div>

      <div className={styles.powerCardEndActions}>
        <a href={pdfUrl} className={styles.powerCardDownloadBtn} download>
          הורד PDF
        </a>
        <a href={pngUrl} className={styles.powerCardViewBtn} target="_blank" rel="noopener noreferrer">
          הצג כתמונה
        </a>
        <button type="button" className={styles.controlBtn} onClick={onContinue}>
          המשך
        </button>
      </div>
    </section>
  );
}
