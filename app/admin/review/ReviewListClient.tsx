'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminSecretGate } from './AdminSecretGate';
import styles from './review.module.css';
import type { OpenReviewCaseSummary } from '@/lib/admin/human-qa-review-types';
import { kindLabelHe, relativeTimeHe } from '@/lib/admin/human-qa-review-helpers';

function kindChipClass(kind: OpenReviewCaseSummary['kind']): string {
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

function ReviewListInner({ secret }: { secret: string }) {
  const [cases, setCases] = useState<OpenReviewCaseSummary[] | null>(null);
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
      const res = await fetch(`/api/admin/review/cases${demoParam}`, {
        headers: { 'x-generation-secret': secret },
        cache: 'no-store',
      });
      if (res.status === 401) {
        setError('מפתח לא תקין — נסו שוב.');
        setCases(null);
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error || `שגיאה ${res.status}`);
        setCases(null);
        return;
      }
      const body = (await res.json()) as { cases: OpenReviewCaseSummary[]; demo?: boolean };
      setCases(body.cases);
      setDemo(Boolean(body.demo));
    } catch {
      setError('טעינת הרשימה נכשלה.');
      setCases(null);
    } finally {
      setLoading(false);
    }
  }, [secret]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>ביקורת Human QA</h1>
          <p className={styles.subtitle}>
            הזמנות ממתינות לבדיקה ידנית
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

      {loading && !cases ? <div className={styles.loading}>טוען מקרים פתוחים…</div> : null}

      {!loading && cases && cases.length === 0 ? (
        <div className={styles.empty} data-testid="review-empty">
          <h2 className={styles.emptyTitle}>אין ספרים ממתינים</h2>
          <p className={styles.emptyHint}>כרגע אין אף הזמנה בעצירה לבדיקה ידנית.</p>
        </div>
      ) : null}

      {cases && cases.length > 0 ? (
        <div className={styles.list} data-testid="review-list">
          {cases.map((c) => (
            <Link
              key={c.caseId}
              href={`/admin/review/${encodeURIComponent(c.orderId)}${demo ? '?demo=1' : ''}`}
              className={styles.card}
            >
              <div className={styles.cardTop}>
                <span className={styles.childName}>{c.childName || '—'}</span>
                <span className={`${styles.chip} ${kindChipClass(c.kind)}`}>{kindLabelHe(c.kind)}</span>
              </div>
              <div className={styles.metaRow}>
                <span>
                  הזמנה <span className={styles.mono}>{c.orderId}</span>
                </span>
                <span>{relativeTimeHe(c.heldAt)}</span>
                {c.pageNumbers.length > 0 ? (
                  <span>עמודים: {c.pageNumbers.join(', ')}</span>
                ) : (
                  <span>ללא עמוד מסומן</span>
                )}
                {c.storyDirection ? <span>{c.storyDirection}</span> : null}
              </div>
              <p className={styles.reason}>{c.humanReason}</p>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function ReviewListClient() {
  return <AdminSecretGate>{(secret) => <ReviewListInner secret={secret} />}</AdminSecretGate>;
}
