'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminSecretGate } from '../AdminSecretGate';
import styles from '../review.module.css';
import type { ReviewCaseDetail } from '@/lib/admin/human-qa-review-types';
import { kindLabelHe, relativeTimeHe } from '@/lib/admin/human-qa-review-helpers';

function kindChipClass(kind: ReviewCaseDetail['kind']): string {
  switch (kind) {
    case 'safety':
      return styles.chipSafety;
    case 'contract_world':
      return styles.chipContract;
    case 'anchor':
      return styles.chipAnchor;
    case 'payment_integrity':
      return styles.chipPayment;
    default:
      return styles.chipUnknown;
  }
}

function DetailInner({ secret, orderId }: { secret: string; orderId: string }) {
  const [detail, setDetail] = useState<ReviewCaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const demoParam =
      typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1'
        ? '?demo=1'
        : '';
    try {
      const res = await fetch(`/api/admin/review/cases/${encodeURIComponent(orderId)}${demoParam}`, {
        headers: { 'x-generation-secret': secret },
        cache: 'no-store',
      });
      if (res.status === 401) {
        setError('מפתח לא תקין — נסו שוב.');
        setDetail(null);
        return;
      }
      if (res.status === 404) {
        setError('לא נמצא מקרה פתוח להזמנה זו.');
        setDetail(null);
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error || `שגיאה ${res.status}`);
        setDetail(null);
        return;
      }
      const body = (await res.json()) as { case: ReviewCaseDetail; demo?: boolean };
      setDetail(body.case);
      setDemo(Boolean(body.demo));
    } catch {
      setError('טעינת פרטי ההזמנה נכשלה.');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [orderId, secret]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link href={`/admin/review${demo ? '?demo=1' : ''}`} className={styles.linkBtn}>
            ← חזרה לרשימה
          </Link>
          <h1 className={styles.title} style={{ marginTop: 12 }}>
            {detail ? `ביקורת · ${detail.childName}` : 'ביקורת הזמנה'}
          </h1>
          <p className={styles.subtitle}>
            <span className={styles.mono}>{orderId}</span>
            {demo ? ' · מצב הדגמה' : ''}
          </p>
        </div>
        <div className={styles.toolbar}>
          <button type="button" className={styles.refreshBtn} onClick={() => void load()}>
            רענון
          </button>
        </div>
      </header>

      {error ? <div className={styles.errorBox}>{error}</div> : null}
      {loading && !detail ? <div className={styles.loading}>טוען פרטים…</div> : null}

      {detail ? (
        <>
          <div className={styles.cardTop} style={{ marginBottom: 8 }}>
            <span className={`${styles.chip} ${kindChipClass(detail.kind)}`}>
              {kindLabelHe(detail.kind)}
            </span>
            <span className={styles.subtitle}>{relativeTimeHe(detail.heldAt)}</span>
          </div>
          <p className={styles.reason}>{detail.humanReason}</p>
          <p className={styles.subtitle} style={{ marginTop: 6 }}>
            סיבה גולמית: <span className={styles.mono}>{detail.rawReason}</span>
          </p>

          <div className={styles.metaGrid}>
            <div className={styles.metaCell}>
              <span className={styles.metaLabel}>סטטוס הזמנה</span>
              <span className={styles.metaValue}>{detail.orderStatus}</span>
            </div>
            <div className={styles.metaCell}>
              <span className={styles.metaLabel}>עמודים מסומנים</span>
              <span className={styles.metaValue}>
                {detail.flaggedPageNumbers.length
                  ? detail.flaggedPageNumbers.join(', ')
                  : 'אין'}
              </span>
            </div>
            <div className={styles.metaCell}>
              <span className={styles.metaLabel}>inputVersion</span>
              <span className={`${styles.metaValue} ${styles.mono}`}>{detail.inputVersion}</span>
            </div>
            <div className={styles.metaCell}>
              <span className={styles.metaLabel}>contract hash</span>
              <span className={`${styles.metaValue} ${styles.mono}`}>
                {detail.contractHash ?? '—'}
              </span>
            </div>
            <div className={styles.metaCell}>
              <span className={styles.metaLabel}>fingerprint</span>
              <span className={`${styles.metaValue} ${styles.mono}`}>{detail.holdFingerprint}</span>
            </div>
            <div className={styles.metaCell}>
              <span className={styles.metaLabel}>כיוון סיפור</span>
              <span className={styles.metaValue}>{detail.storyDirection ?? '—'}</span>
            </div>
          </div>

          {/* Slice 4 placeholders — intentionally disabled, not wired. */}
          <div className={styles.actionsPlaceholder} data-testid="slice4-placeholders">
            <button type="button" className={styles.actionDisabled} disabled>
              רינדור מחדש עם הערה
            </button>
            <button type="button" className={styles.actionDisabled} disabled>
              שחרור
            </button>
            <button type="button" className={styles.actionDisabled} disabled>
              ביטול + החזר
            </button>
            <p className={styles.actionsNote}>
              פעולות ההחלטה יגיעו ב־Slice 4 — כרגע תצוגה בלבד, ללא שינוי במערכת.
            </p>
          </div>

          <h2 className={styles.title} style={{ fontSize: '1.15rem', marginBottom: 12 }}>
            עמודי הספר
          </h2>
          <div className={styles.grid} data-testid="review-pages">
            {detail.pages.map((p) => (
              <article
                key={p.pageNumber}
                className={`${styles.pageCard} ${p.flagged ? styles.pageCardFlagged : ''}`}
                data-flagged={p.flagged ? 'true' : 'false'}
              >
                <div className={styles.pageImgWrap}>
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={`עמוד ${p.pageNumber}`} className={styles.pageImg} />
                  ) : (
                    <span className={styles.pageImgMissing}>אין תמונה</span>
                  )}
                </div>
                <div className={styles.pageBody}>
                  <div className={styles.pageHead}>
                    <span className={styles.pageNum}>עמוד {p.pageNumber}</span>
                    {p.flagged ? (
                      <span className={styles.flagTag}>מוחזק</span>
                    ) : (
                      <span className={styles.okTag}>נקי</span>
                    )}
                  </div>
                  <p className={styles.pageText}>{p.text || '—'}</p>
                  {(p.safetyHazards.length > 0 || p.evidence) && (
                    <div className={styles.evidenceBlock}>
                      <strong>ראיות</strong>
                      {p.evidence ? (
                        <div>
                          verdict: <span className={styles.mono}>{p.evidence.verdict}</span>
                          {p.evidence.reason ? (
                            <>
                              {' '}
                              · <span className={styles.mono}>{p.evidence.reason}</span>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                      {p.evidence?.anchorConfidence != null ? (
                        <div>
                          דמיון:{' '}
                          <span className={styles.mono}>
                            {p.evidence.anchorConfidence.toFixed(3)}
                          </span>
                        </div>
                      ) : null}
                      {p.safetyHazards.length > 0 || (p.evidence?.safetyHazards.length ?? 0) > 0 ? (
                        <ul className={styles.hazardList}>
                          {[...new Set([...p.safetyHazards, ...(p.evidence?.safetyHazards ?? [])])].map(
                            (h) => (
                              <li key={h} className={styles.hazardPill}>
                                {h}
                              </li>
                            ),
                          )}
                        </ul>
                      ) : null}
                      {p.evidence?.notes?.length ? (
                        <ul style={{ margin: '6px 0 0', paddingInlineStart: 16 }}>
                          {p.evidence.notes.map((n) => (
                            <li key={n}>{n}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function ReviewDetailClient({ orderId }: { orderId: string }) {
  return (
    <AdminSecretGate>{(secret) => <DetailInner secret={secret} orderId={orderId} />}</AdminSecretGate>
  );
}
