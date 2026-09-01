import Link from 'next/link';
import type { ReactNode } from 'react';
import { SiteHeader } from './SiteHeader';

/** The one shared footer strip: landing footer + legal pages + 404. */
export function LegalLinks({ light = false }: { light?: boolean }) {
  return (
    <nav className={'legal-strip' + (light ? ' legal-strip--light' : '')} aria-label="קישורים משפטיים">
      <span>© {new Date().getFullYear()} גיבורים קטנים</span>
      <Link href="/terms">תנאי שימוש</Link>
      <Link href="/privacy">מדיניות פרטיות</Link>
      <Link href="/accessibility">הצהרת נגישות</Link>
      <a href="mailto:hello@smallheroes.co.il">צרו קשר</a>
    </nav>
  );
}

/** Quiet readable shell for the legal pages - compact header, article, strip. */
export function LegalShell({ title, updated, children }: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="landing-body">
      <a href="#main" className="skip-link">
        דילוג לתוכן
      </a>
      <SiteHeader variant="compact" />
      <main id="main" className="legal-main">
        <h1>{title}</h1>
        <p className="legal-updated">עודכן לאחרונה: {updated}</p>
        {children}
        <LegalLinks light />
      </main>
    </div>
  );
}
