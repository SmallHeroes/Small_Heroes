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

  return (
    <header className={headerClass}>
      <div className={styles.inner}>
        <div className={styles.startCluster}>
          <Link href={ROUTES.home} className={logoClass} aria-label={COMMON.brand} onClick={onLogoClick}>
            {/* the rounded diamond + yellow spark (per Guy) */}
            <svg className={styles.logoMark} viewBox="0 0 44 44" aria-hidden="true" focusable="false">
              <rect
                className={styles.logoMarkDiamond}
                x="7.5"
                y="7.5"
                width="29"
                height="29"
                rx="7"
                transform="rotate(45 22 22)"
              />
              <path
                className={styles.logoMarkSpark}
                d="M22 13.5 L24.3 19.7 L30.5 22 L24.3 24.3 L22 30.5 L19.7 24.3 L13.5 22 L19.7 19.7 Z"
              />
            </svg>
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
              {/* "הספרים שלי" moved into the account dropdown (AccountControl); "קצת עלינו" → the About section. */}
              <a href="/#about" className={styles.navLinkDesktop}>
                קצת עלינו
              </a>
            </nav>
          ) : null}
        </div>

        <div className={styles.endCluster}>
          {variant === 'full' ? (
            <a href={ROUTES.start} className={styles.navCta} data-event="nav_start_click">
              ליצור ספר
            </a>
          ) : null}
          <AccountControl user={user} onAuthChange={onAuthChange} />
        </div>
      </div>
    </header>
  );
}
