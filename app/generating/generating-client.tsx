'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BookOnTheWay } from '@/app/components/BookOnTheWay';
import { ROUTES } from '@/lib/routes';
import styles from './generating.module.css';

type StatusResponse = {
  status?: string;
  childName?: string;
  readUrl?: string;
  failedStage?: string | null;
};

export function GeneratingClient({
  statusEndpoint = '/api/generate/status',
}: {
  statusEndpoint?: string;
}) {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId') || '';
  const accessKey = searchParams.get('accessKey') || '';

  const [childName, setChildName] = useState('');
  const [ready, setReady] = useState(false);
  const [readerHref, setReaderHref] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [heldReview, setHeldReview] = useState(false);
  const redirectingRef = useRef(false);

  const fallbackReadyHref = useMemo(() => {
    if (!orderId) return null;
    const keyPart = accessKey ? `&accessKey=${encodeURIComponent(accessKey)}` : '';
    return `${ROUTES.ready}?orderId=${encodeURIComponent(orderId)}${keyPart}`;
  }, [orderId, accessKey]);

  useEffect(() => {
    if (!orderId) {
      setError('פרטי ההזמנה חסרים.');
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;
    const NORMAL_MS = 2500;
    const HELD_MS = 15000; // human-QA hold: poll slowly, no overlap

    const schedule = (delay: number) => {
      if (cancelled) return;
      timer = setTimeout(poll, delay);
    };

    const poll = async () => {
      // In-flight guard: a slow response never overlaps the next tick.
      if (inFlight) {
        schedule(NORMAL_MS);
        return;
      }
      inFlight = true;
      try {
        const res = await fetch(
          `${statusEndpoint}?orderId=${encodeURIComponent(orderId)}&accessKey=${encodeURIComponent(accessKey)}`,
          { credentials: 'include' },
        );
        if (!res.ok) {
          if (res.status === 404 && !cancelled) setError('לא מצאנו את ההזמנה שלכם.');
          schedule(NORMAL_MS);
          return;
        }
        const data = (await res.json()) as StatusResponse;
        if (cancelled) return;

        if (data.childName) setChildName(data.childName);

        if (data.status === 'ready' || data.status === 'partial') {
          const href = data.readUrl || fallbackReadyHref;
          if (href) setReaderHref(href);
          setHeldReview(false);
          setReady(true);

          if (!redirectingRef.current && href && !href.includes('/read-v2')) {
            redirectingRef.current = true;
            window.setTimeout(() => {
              window.location.href = href;
            }, 1200);
          }
          return; // stop polling — book is ready
        }

        if (data.status === 'under_review') {
          // Human-QA hold: calm held message, keep polling slowly in case it releases to ready.
          setHeldReview(true);
          schedule(HELD_MS);
          return;
        }

        if (data.status === 'failed') {
          setError('לא הצלחנו לסיים את הספר.');
          return; // stop polling
        }

        schedule(NORMAL_MS);
      } catch {
        schedule(NORMAL_MS); // retry on next tick
      } finally {
        inFlight = false;
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderId, accessKey, fallbackReadyHref, statusEndpoint]);

  if (error) {
    return (
      <div className={styles.errorWrap} dir="rtl">
        <div className={styles.errorIcon} aria-hidden="true">
          😔
        </div>
        <h1 className={styles.errorTitle}>משהו השתבש בדרך</h1>
        <p className={styles.errorMsg}>{error}</p>
        <a href={ROUTES.home} className={styles.errorBack}>
          חזרה לדף הבית
        </a>
      </div>
    );
  }

  if (heldReview && !ready) {
    return (
      <div className={styles.errorWrap} dir="rtl">
        <div className={styles.errorIcon} aria-hidden="true">
          💛
        </div>
        <h1 className={styles.errorTitle}>הספר שלך בבדיקה אישית</h1>
        <p className={styles.errorMsg}>הספר שלך בבדיקה אישית — נעדכן במייל בקרוב</p>
      </div>
    );
  }

  return (
    <div className={styles.main}>
      <BookOnTheWay childName={childName} ready={ready} readerHref={readerHref ?? undefined} />
    </div>
  );
}
