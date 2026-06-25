'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { COMMON } from '@/content';
import { ROUTES } from '@/lib/routes';
import { AccountControl, type AuthUser } from './AccountControl';
import styles from './site-header.module.css';

export type SiteHeaderProps = {
  variant?: 'full' | 'compact';
  /** Logo click asks before leaving (wizard). */
  confirmLeave?: boolean;
};

export function SiteHeader({ variant = 'full', confirmLeave = false }: SiteHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (data?.user?.email && !cancelled) {
          setUser({
            email: data.user.email,
            hasBooks: Boolean(data.hasBooks),
          });
        }
      } catch {
        /* auth optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onScroll = () => {
      if (rafRef.current != null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        setScrolled(window.scrollY > 8);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const onLogoClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (!confirmLeave) return;
      const ok = window.confirm('לשמור ולצאת?');
      if (!ok) event.preventDefault();
      // TODO: styled leave modal + wizard state persistence
    },
    [confirmLeave],
  );

  const onAuthChange = useCallback((next: AuthUser | null) => {
    setUser(next);
  }, []);

  const headerClass = [
    styles.header,
    scrolled ? styles.headerScrolled : '',
    variant === 'compact' ? styles.compact : '',
  ]
    .filter(Boolean)
    .join(' ');

  const logoClass = [styles.logo, scrolled ? styles.logoScaled : ''].filter(Boolean).join(' ');

  const showMyBooksNav = Boolean(user?.hasBooks);

  return (
    <header className={headerClass}>
      <div className={styles.inner}>
        <div className={styles.startCluster}>
          <Link href={ROUTES.home} className={logoClass} aria-label={COMMON.brand} onClick={onLogoClick}>
            <div className={styles.logoIcon}>
              <div className={styles.logoIconSq} />
              <div className={styles.logoIconDot} />
            </div>
            <div className={styles.logoText}>
              <span className={styles.logoBrand}>{COMMON.brand}</span>
              <span className={styles.logoTagline}>{COMMON.tagline}</span>
            </div>
          </Link>

          {variant === 'full' ? (
            <nav className={styles.navLinks} aria-label="ניווט ראשי">
              <a href="/#how" className={styles.navLinkDesktop}>
                איך זה עובד
              </a>
              <a href="/#pricing" className={styles.navLinkDesktop}>
                מחירים
              </a>
              {showMyBooksNav ? (
                <Link href={ROUTES.myBooks} className={styles.navLinkMyBooks}>
                  הספרים שלי
                </Link>
              ) : null}
            </nav>
          ) : null}
        </div>

        <div className={styles.endCluster}>
          <AccountControl user={user} onAuthChange={onAuthChange} />
        </div>
      </div>
    </header>
  );
}
