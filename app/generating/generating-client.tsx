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

export function GeneratingClient() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId') || '';
  const accessKey = searchParams.get('accessKey') || '';

  const [childName, setChildName] = useState('');
  const [ready, setReady] = useState(false);
  const [readerHref, setReaderHref] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    let timer: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      try {
        const res = await fetch(`/api/generate/status?orderId=${encodeURIComponent(orderId)}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          if (res.status === 404 && !cancelled) setError('לא מצאנו את ההזמנה שלכם.');
          return;
        }
        const data = (await res.json()) as StatusResponse;
        if (cancelled) return;

        if (data.childName) setChildName(data.childName);

        if (data.status === 'ready' || data.status === 'partial') {
          const href = data.readUrl || fallbackReadyHref;
          if (href) setReaderHref(href);
          setReady(true);
          if (timer) clearInterval(timer);

          if (!redirectingRef.current && href && !href.includes('/read-v2')) {
            redirectingRef.current = true;
            window.setTimeout(() => {
              window.location.href = href;
            }, 1200);
          }
          return;
        }

        if (data.status === 'failed') {
          setError('לא הצלחנו לסיים את הספר.');
          if (timer) clearInterval(timer);
        }
      } catch {
        /* retry on next tick */
      }
    };

    poll();
    timer = setInterval(poll, 2500);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [orderId, fallbackReadyHref]);

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

  return (
    <div className={styles.main}>
      <BookOnTheWay childName={childName} ready={ready} readerHref={readerHref ?? undefined} />
    </div>
  );
}
