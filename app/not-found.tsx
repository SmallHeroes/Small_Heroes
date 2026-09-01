import Link from 'next/link';
import { SiteHeader } from './components/SiteHeader';
import { LegalLinks } from './components/LegalShell';
import './legal/legal.css';

/* Branded 404 - the page equivalent of a missing storybook page. */
export default function NotFound() {
  return (
    <div className="landing-body">
      <SiteHeader variant="compact" />
      <main className="notfound-main">
        <svg className="notfound-mark" viewBox="0 0 44 44" aria-hidden="true" focusable="false">
          <rect x="7.5" y="7.5" width="29" height="29" rx="7" transform="rotate(45 22 22)" fill="#9349e5" />
          <path
            d="M22 13.5 L24.3 19.7 L30.5 22 L24.3 24.3 L22 30.5 L19.7 24.3 L13.5 22 L19.7 19.7 Z"
            fill="#ffd745"
          />
        </svg>
        <h1>הדף הזה עוד לא נכתב</h1>
        <p>העמוד שחיפשתם לא נמצא. אולי הגיבור שלנו לקח אותו להרפתקה.</p>
        <Link href="/" className="btn-primary">
          חזרה לעמוד הבית
        </Link>
        <LegalLinks light />
      </main>
    </div>
  );
}
