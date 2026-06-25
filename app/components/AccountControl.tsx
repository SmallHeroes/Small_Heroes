'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ROUTES } from '@/lib/routes';
import styles from './account-control.module.css';

export type AuthUser = {
  email: string;
  hasBooks: boolean;
};

type AccountControlProps = {
  user: AuthUser | null;
  onAuthChange?: (user: AuthUser | null) => void;
};

const MOBILE_MAX = 640;
const SITE_SHARE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://smallheroes.co.il';

function PersonOutlineIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fff"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
    </svg>
  );
}

export function AccountControl({ user, onAuthChange }: AccountControlProps) {
  const menuId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX}px)`);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open || isMobile) return;
    const onPointer = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open, isMobile, close]);

  useEffect(() => {
    if (!open || !isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, isMobile]);

  const onLogout = async () => {
    close();
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => null);
    onAuthChange?.(null);
    window.location.href = ROUTES.home;
  };

  const onShare = async () => {
    close();
    const url = window.location.origin || SITE_SHARE_URL;
    const title = 'גיבורים קטנים';
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* user cancelled or unsupported */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setToast('הקישור הועתק');
    } catch {
      setToast('לא הצלחנו להעתיק את הקישור');
    }
  };

  const onSubscribe = () => {
    close();
    // TODO(Guy): subscription destination TBD — route/modal not built yet
    setToast('מנוי — בקרוב');
  };

  const initial = user?.email?.trim().charAt(0).toUpperCase() || '?';

  const menuItems = (
    <>
      {user?.hasBooks && isMobile ? (
        <Link href={ROUTES.myBooks} className={styles.menuItem} onClick={close}>
          הספרים שלי
        </Link>
      ) : null}
      <button type="button" className={styles.menuItem} onClick={onShare}>
        שיתוף
      </button>
      <button type="button" className={styles.menuItem} onClick={onSubscribe}>
        סאבסקרייב
      </button>
      <button type="button" className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={onLogout}>
        התנתקות
      </button>
    </>
  );

  if (!user) {
    return (
      <div className={styles.wrap}>
        <Link href={ROUTES.login} className={styles.circleBtn} aria-label="התחברות">
          <PersonOutlineIcon />
        </Link>
        {toast ? (
          <span className={styles.toast} role="status">
            {toast}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.circleBtn}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        {initial}
      </button>

      {toast ? (
        <span className={styles.toast} role="status">
          {toast}
        </span>
      ) : null}

      {open && !isMobile ? (
        <div id={menuId} className={styles.menu} role="menu">
          {menuItems}
        </div>
      ) : null}

      {open && isMobile ? (
        <>
          <button type="button" className={styles.sheetBackdrop} aria-label="סגירת תפריט" onClick={close} />
          <div className={styles.sheet} role="menu" aria-labelledby={`${menuId}-title`}>
            <div className={styles.sheetHandle} aria-hidden="true" />
            <p id={`${menuId}-title`} className={styles.sheetTitle}>
              {user.email}
            </p>
            {menuItems}
          </div>
        </>
      ) : null}
    </div>
  );
}
