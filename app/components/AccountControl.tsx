'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ROUTES } from '@/lib/routes';
import styles from './account-control.module.css';

export type AuthUser = {
  email: string;
};

type AccountControlProps = {
  user: AuthUser | null;
  onAuthChange?: (user: AuthUser | null) => void;
};

const MOBILE_MAX = 640;

function PersonOutlineIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
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

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX}px)`);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

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

  const initial = user?.email?.trim().charAt(0).toUpperCase() || '?';

  const menuItems = (
    <>
      <Link href={ROUTES.myBooks} className={styles.menuItem} onClick={close}>
        הספרים שלי
      </Link>
      {/* TODO: dedicated account settings page */}
      <Link href={ROUTES.myBooks} className={styles.menuItem} onClick={close}>
        החשבון שלי
      </Link>
      <button type="button" className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={onLogout}>
        יציאה
      </button>
    </>
  );

  if (!user) {
    return (
      <div className={styles.wrap}>
        <Link href={ROUTES.login} className={styles.loginLink} aria-label="התחברות">
          <PersonOutlineIcon />
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.avatarBtn}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        {initial}
      </button>

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
