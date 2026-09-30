'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReviewedPersonalBookRequest } from '@/lib/personal-wizard/contract';
import { bookAvailabilitySchema, readBookPreview, readBookPartialPreview, type BookPreview, type BookPartialPreview } from '@/lib/personal-wizard/book-preview';
import styles from './personal-wizard.module.css';

type Props = { request: ReviewedPersonalBookRequest; requestId: string; stale: boolean; onEdit: () => void };
export function StoryPreview({ request, requestId, stale, onEdit }: Props) {
  const [availability, setAvailability] = useState<ReturnType<typeof bookAvailabilitySchema.parse> | null>(null);
  const quote = availability?.reservations.find(row => row.lengthId === request.bookOptions.lengthId);
  const available = quote?.fitsConfiguredTotalBudget === true;
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BookPreview | null>(null);
  const [partial, setPartial] = useState<BookPartialPreview | null>(null);
  const [message, setMessage] = useState('');
  const active = useRef<AbortController | null>(null);
  const epoch = useRef(0);
  // Guard the render itself, not just the post-render effect, when request identity changes.
  const currentResult = result?.writerResult.requestId === requestId ? result : null;
  const currentPartial = partial?.writerResult.requestId === requestId ? partial : null;
  const manuscriptResult = currentResult?.writerResult ?? currentPartial?.writerResult;
  const accounting = currentResult?.accounting ?? currentPartial?.accounting;
  useEffect(() => {
    let live = true;
    void fetch('/api/dev/personal-wizard/book', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) return;
      const parsed = bookAvailabilitySchema.safeParse(await response.json());
      if (live && parsed.success) setAvailability(parsed.data);
    }).catch(() => undefined);
    return () => { live = false; };
  }, []);
  useEffect(() => {
    epoch.current += 1;
    active.current?.abort(); active.current = null;
    setBusy(false); setResult(null); setPartial(null); setMessage('');
    return () => { epoch.current += 1; active.current?.abort(); };
  }, [requestId, stale]);
  const cancel = () => {
    epoch.current += 1;
    active.current?.abort(); active.current = null; setBusy(false);
    setMessage('חזרנו לפרטים שלכם. ביקשנו לבטל את הכתיבה; ייתכן שקריאה שכבר נשלחה עדיין תחויב.');
  };
  const write = async () => {
    if (active.current || stale || !available || !request.bookOptions.lengthId) return;
    const controller = new AbortController(); active.current = controller;
    const token = ++epoch.current;
    setBusy(true); setMessage(''); setResult(null); setPartial(null);
    const jobId = `b_${crypto.randomUUID().replace(/-/g, '')}`;
    try {
      const response = await fetch('/api/dev/personal-wizard/book', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId, request }), signal: controller.signal, cache: 'no-store' });
      const body = await response.json();
      if (token !== epoch.current || controller.signal.aborted) return;
      if (!response.ok) {
        setPartial(readBookPartialPreview(body, requestId));
        const limit = ['book_budget_exhausted', 'book_job_limit', 'book_user_busy', 'book_duplicate_job'].includes(body.error);
        setMessage(limit ? 'הכתיבה אינה זמינה כרגע במסגרת הניסוי. הפרטים שלכם עדיין בחלון הזה.' : 'הטיוטה לא הושלמה. הפרטים שלכם עדיין כאן. ניסיון נוסף מתחיל עבודה חדשה ועלול להיות בתשלום.');
      } else {
        const parsed = readBookPreview(body, requestId);
        if (parsed) setResult(parsed);
        else setMessage('לא התקבלה טיוטה שתואמת לפרטים שאישרתם. לא נתקדם עם התוצאה הזו.');
      }
    } catch {
      if (token === epoch.current && !controller.signal.aborted) setMessage('החיבור נקטע ולא קיבלנו תוצאה. לא מתחילים ניסיון נוסף אוטומטית; ייתכן שהבקשה הקודמת עדיין עובדת או תחויב.');
    } finally {
      if (token === epoch.current) { active.current = null; setBusy(false); }
    }
  };
  if (stale) return <p className={styles.hint}>הפרטים השתנו. בדקו שוב את הבקשה לפני כתיבת טיוטה חדשה.</p>;
  return <section className={styles.card} aria-labelledby="personal-story-preview-title">
    <h2 id="personal-story-preview-title" className={styles.sectionTitle}>ההרפתקה של {request.child.name}</h2>
    <p className={styles.summaryText}>מהפרטים שאישרתם נבנה את העלילה כולה, נכתוב את הסיפור לפי האורך שבחרתם, נתכנן את האיורים והרציפות ונבדוק את התכנון מול הטקסט. הרפתקה עם דמיון, הומור ובחירות של {request.child.name}. זה ניסוי בסיפור ובסטוריבורד, לפני איורים וקריינות.</p>
    {!available ? <p className={styles.hint}>הכתיבה החיה זמינה רק בניסוי מקומי למשתמש מורשה. לא נשלחה בקשה לכותב.</p> : null}
    {available ? <p className={styles.hint}>כתיבה בניסוי צורכת תקציב API ועלולה להיות מחויבת גם אם הטיוטה לא תושלם. זו אינה רכישה של ספר.</p> : null}
    {quote ? <p className={styles.hint}>שמורת תקציב לניסיון: ${quote.reservationUsd.toFixed(4)}. זו תקרה שמרנית ולא העלות בפועל או יתרת התקציב. מודל: {availability?.model}.</p> : null}
    {!request.bookOptions.lengthId ? <p className={styles.warn}>בחרו אורך ספר לפני שמתחילים לכתוב.</p> : null}
    <div role="status" aria-live="polite">
      {busy ? <p>המנוע עובד על ההרפתקה של {request.child.name}: תכנון עלילה, כתיבה, סטוריבורד ובדיקת רציפות. התהליך יכול לקחת כמה דקות. אין צורך ללחוץ שוב; השאירו את החלון פתוח.</p> : null}
      {message ? <p className={styles.warn}>{message}</p> : null}
    </div>
    {busy ? <button type="button" className={styles.btnBack} onClick={() => { cancel(); onEdit(); }}>לבטל ולחזור לפרטים</button> : <button type="button" className={styles.btnContinue} disabled={!available || !request.bookOptions.lengthId} onClick={() => void write()}>{currentResult ? 'ליצור ניסיון חדש בתשלום' : `ליצור סיפור וסטוריבורד עבור ${request.child.name}`}</button>}
    <button type="button" className={styles.linkButton} onClick={() => { cancel(); onEdit(); }}>לתקן את הפרטים</button>
    {manuscriptResult && accounting ? <article className={styles.manuscript}>
      <p className={styles.hint}>סיפור ראשון לקריאה · לפני איורים וקריינות · ממתין לבדיקת תוכן</p>
      <p className={currentResult?.status === 'review_supported' ? styles.hint : styles.warn}>{!currentResult ? 'הסיפור נכתב, אבל תכנון האיורים או בדיקתו לא הושלמו. הטקסט מוצג לקריאה בלבד ולא מאושר לרינדור.' : currentResult.status === 'review_supported' ? 'בדיקת התכנון לא סימנה סתירה. זו אינה קבלת איכות של הסיפור או אישור לרינדור.' : 'בדיקת התכנון מצאה סתירה או אי ודאות. אפשר לקרוא ולשפוט את הסיפור, אבל התכנון מוחזק ולא מאושר לרינדור.'}</p>
      <h3>{manuscriptResult.manuscript.title}</h3>
      {manuscriptResult.manuscript.pages.map((page) => <section key={page.pageNumber}><h4>כפולה {page.pageNumber}</h4><p>{page.text}</p></section>)}
      {currentResult ? <details><summary>לראות את הסטוריבורד ובדיקת הרציפות</summary>
        {currentResult.storyboard.plan.pages.map(page => <section key={page.pageNumber}>
          <h4>{page.pageNumber === 0 ? 'כריכה' : `כפולה ${page.pageNumber}`}</h4>
          <p>{page.scene}</p><p>{page.shot} · {page.angle} · {page.composition}</p>
          <p>{page.childAction} · {page.companionAction}</p>
        </section>)}
        {[...currentResult.review.review.bookChecks, ...currentResult.review.review.frames.flatMap(frame => frame.checks.map(check => ({ ...check, category: `${frame.pageNumber}: ${check.category}` })))].filter(check => check.verdict !== 'supported').map(check => <p className={styles.warn} key={check.category}>{check.category}: {check.observation}</p>)}
      </details> : null}
      <p className={styles.hint}>עלות כל שלבי הניסיון לפי שימוש: {accounting.estimatedUsd === null ? 'לא התקבלו נתוני שימוש מלאים' : `$${accounting.estimatedUsd.toFixed(4)}`}. שמורת תקציב: ${accounting.reservedUsd.toFixed(4)}. זו אינה חשבונית ולא מחיר הספר.</p>
      <p className={styles.hint}>גרסה חדשה יכולה לשנות גם את העלילה. הטיוטה אינה מאושרת לרינדור.</p>
    </article> : null}
  </section>;
}
