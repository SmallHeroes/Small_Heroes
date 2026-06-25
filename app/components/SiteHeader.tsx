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
          setUser({ email: data.user.email });
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

  const headerClass = [
    styles.header,
    scrolled ? styles.headerScrolled : '',
    variant === 'compact' ? styles.compact : '',
  ]
    .filter(Boolean)
    .join(' ');

  const logoClass = [styles.logo, scrolled ? styles.logoScaled : ''].filter(Boolean).join(' ');

  return (
    <header className={headerClass}>
      <div className={styles.inner}>
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

        <div className={styles.rightCluster}>
          {variant === 'full' ? (
            <nav className={styles.navLinks} aria-label="ניווט ראשי">
              <a href="/#how">איך זה עובד</a>
              <a href="/#pricing">מחירים</a>
              <Link href={ROUTES.myBooks}>הספרים שלי</Link>
            </nav>
          ) : null}

          {!user && variant === 'full' ? (
            <Link href={ROUTES.start} className={`${styles.navCta} ${styles.navCtaVisible}`} data-event="landing_start_click">
              {COMMON.navCta}
            </Link>
          ) : null}

          <AccountControl user={user} onAuthChange={setUser} />
        </div>
      </div>
    </header>
  );
}
