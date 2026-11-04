import Link from 'next/link';
import { SiteHeader } from '@/app/components/SiteHeader';
import { LegalLinks } from '@/app/components/LegalShell';
import { PersonalWowHero } from '@/app/landing/personal-wow/PersonalWowHero';
import { PersonalProof } from '@/app/landing/personal-proof';
import { PersonalCompanionCarousel } from '@/app/landing/personal-companion-carousel';
import { PERSONAL_COMPANION_ART, PERSONAL_COMPANION_LINES, PERSONAL_COMPANION_PAPER } from '@/content/personal-landing';
import { ENGINE_SITE_LAUNCH_OFFER, engineSitePriceIls } from '@/lib/engine-site/offer-definition';
import { resolveEngineWizardOptions } from '@/lib/engine-site/personal-orders';
import '@/app/dev/personal-product/personal-product.css';
import '@/app/dev/personal-product/personal-wow.css';

/** Activated together with the personal checkout cutover; legacy landing/bank prices remain untouched while off. */
export function EngineLaunchHome() {
  const offer = ENGINE_SITE_LAUNCH_OFFER, startHref = '/wizard/personal';
  const friends = resolveEngineWizardOptions().companions.map(({ id, name, image }) => ({ id, name,
    image: PERSONAL_COMPANION_ART[id] ?? image, line: PERSONAL_COMPANION_LINES[id] ?? '', paper: PERSONAL_COMPANION_PAPER[id] }));
  return <div className="landing-body personal-product" dir="rtl">
    <a href="#main" className="skip-link">דילוג לתוכן</a>
    <SiteHeader variant="full" startHref={startHref} startLabel="מתחילים את הספר" navigation={[
      { label: 'דוגמה', href: '#example' }, { label: 'החברים', href: '#helps' }, { label: 'מה כלול', href: '#pricing' }]} />
    <main id="main">
      <PersonalWowHero startHref={startHref} secondaryHref="#example" hero={{ badge: 'ספר ילדים אישי בעברית',
        h1Line1: 'ספר שנכתב במיוחד', h1Line2: 'לילד שלכם.',
        sub: 'הרפתקה חדשה סביב מה שתספרו עליו, עם הומור וחבר שתבחרו. אתם מאשרים את הפרטים, ואנחנו יוצרים סיפור אישי עם איורים וקריינות.',
        ctaPrimary: 'מתחילים את הספר', ctaSecondary: 'קוראים דוגמה', ctaNotes: ['אתם מאשרים את הפרטים', 'אתם בוחרים את החבר', 'הספר, הקריינות וה־PDF כלולים'] }} />
      <PersonalProof />
      <section className="section" id="helps"><div className="wrap"><h2 className="section-h2">מי יצטרף להרפתקה?</h2>
        <p className="section-sub">אתם בוחרים את החבר. התפקיד שלו נכתב כחלק מההרפתקה של הילד.</p>
        <PersonalCompanionCarousel friends={friends} startHref={startHref} /></div></section>
      <section className="section pricing-section" id="pricing"><div className="wrap">
        <h2 className="section-h2">ספר אישי אחד, כל מה שצריך</h2>
        <article className="price-card price-card--mid" style={{ maxWidth: 480, margin: '2rem auto' }}>
          <h3 className="price-name">ההרפתקה של הילד שלכם</h3><p className="price-pages">כריכה ו־{offer.narrativePages} עמודי סיפור</p>
          <ul className="price-features"><li>סיפור חדש שנכתב מהפרטים שאישרתם</li><li>איורים אישיים</li><li>קריינות בקול שתבחרו</li><li>קריאה והאזנה בדפדפן וקובץ PDF</li></ul>
          <p className="price-num"><span className="price-now">₪<span className="price-now-digits">{engineSitePriceIls()}</span></span></p>
          <p>מחיר אחד, הכול כלול.</p><Link className="btn-primary price-cta" href={startHref}>מתחילים את הספר</Link>
        </article>
        <p className="section-sub">אחרי התשלום נכין את הספר ונשלח קישור באימייל כשהוא מוכן. כדי לפתוח אותו, נכנסים עם כתובת האימייל של ההזמנה.</p>
      </div></section>
      <section className="section"><div className="wrap"><h2 className="section-h2">לפני שמתחילים</h2>
        <p>אפשר להעלות תמונה באופן פרטי או לתאר את המראה. אתם בודקים את פרטי הילד ובוחרים את החבר ואת כיוון הסיפור לפני ההזמנה.</p>
        <p>הסיפור והאיורים נוצרים בעזרת בינה מלאכותית. זהו ספר ילדים, והוא אינו טיפול או כלי אבחוני.</p>
      </div></section>
    </main><footer className="section"><div className="wrap"><LegalLinks /></div></footer>
  </div>;
}
