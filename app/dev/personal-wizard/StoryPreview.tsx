'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReviewedPersonalBookRequest } from '@/lib/personal-wizard/contract';
import { bookAvailabilitySchema, fetchBookAvailability, readBookPreview, readBookPartialPreview, readBookPlanningHoldPreview, type BookPreview, type BookPartialPreview, type BookPlanningHoldPreview } from '@/lib/personal-wizard/book-preview';
import { watchAvailability } from '@/lib/personal-wizard/availability-client';
import styles from './personal-wizard.module.css';

type Props = { request: ReviewedPersonalBookRequest; requestId: string; stale: boolean; onEdit: () => void };
export function StoryPreview({ request, requestId, stale, onEdit }: Props) {
  const [availability, setAvailability] = useState<ReturnType<typeof bookAvailabilitySchema.parse> | null>(null);
  const quote = availability?.reservations.find(row => row.lengthId === request.bookOptions.lengthId);
  const available = quote?.fitsConfiguredTotalBudget === true;
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BookPreview | null>(null);
  const [partial, setPartial] = useState<BookPartialPreview | null>(null);
  const [planningHold, setPlanningHold] = useState<BookPlanningHoldPreview | null>(null);
  const [notice, setNotice] = useState<{ requestId: string; text: string } | null>(null);
  const [attemptedRequest, setAttemptedRequest] = useState<string | null>(null);
  const setMessage = (text: string) => setNotice({ requestId, text });
  const message = notice?.requestId === requestId ? notice.text : '';
  const active = useRef<AbortController | null>(null);
  const epoch = useRef(0);
  // Guard the render itself, not just the post-render effect, when request identity changes.
  const currentResult = result?.writerResult.requestId === requestId ? result : null;
  const currentPartial = partial?.writerResult.requestId === requestId ? partial : null;
  const currentHold = planningHold?.planningResult.requestId === requestId ? planningHold : null;
  const attempted = attemptedRequest === requestId;
  const manuscriptResult = currentResult?.writerResult ?? currentPartial?.writerResult;
  const accounting = currentResult?.accounting ?? currentPartial?.accounting ?? currentHold?.accounting;
  useEffect(() => watchAvailability(window, fetchBookAvailability, setAvailability), []);
  useEffect(() => {
    epoch.current += 1;
    active.current?.abort(); active.current = null;
    setBusy(false); setResult(null); setPartial(null); setPlanningHold(null); setNotice(null); setAttemptedRequest(null);
    return () => { epoch.current += 1; active.current?.abort(); };
  }, [requestId, stale]);
  const cancel = () => {
    epoch.current += 1;
    active.current?.abort(); active.current = null; setBusy(false);
    setResult(null); setPartial(null); setPlanningHold(null);
    setMessage('חזרנו לפרטים שלכם. ביקשנו לבטל את הכתיבה; ייתכן שקריאה שכבר נשלחה עדיין תחויב.');
  };
  const write = async () => {
    if (active.current || stale || !available || !request.bookOptions.lengthId) return;
    const controller = new AbortController(); active.current = controller;
    const token = ++epoch.current;
    setBusy(true); setMessage(''); setResult(null); setPartial(null); setPlanningHold(null); setAttemptedRequest(requestId);
    const jobId = `b_${crypto.randomUUID().replace(/-/g, '')}`;
    try {
      const response = await fetch('/api/dev/personal-wizard/book', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId, request }), signal: controller.signal, cache: 'no-store' });
      const body = await response.json();
      if (token !== epoch.current || controller.signal.aborted) return;
      if (!response.ok) {
        const held = readBookPlanningHoldPreview(body, requestId);
        if (response.status === 422 && held) {
          setPlanningHold(held);
          setMessage('המתכנן מצא בעיה ברעיון ועצר לפני כתיבת הסיפור. התכנון והסיבות מוצגים למטה. לא מתחילים שוב אוטומטית.');
          return;
        }
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
    {!available ? <p className={styles.hint}>הכתיבה החיה זמינה רק בניסוי מקומי למשתמש מורשה. {attempted ? 'לא ניתן להתחיל כעת ניסיון נוסף.' : 'לא נשלחה בקשה לכותב בבקשה הנוכחית.'}</p> : null}
    {available ? <p className={styles.hint}>כתיבה בניסוי צורכת תקציב API ועלולה להיות מחויבת גם אם הטיוטה לא תושלם. זו אינה רכישה של ספר.</p> : null}
    {quote ? <p className={styles.hint}>שמורת תקציב לניסיון: ${quote.reservationUsd.toFixed(4)}. זו תקרה שמרנית ולא העלות בפועל או יתרת התקציב. מודל: {availability?.model}.</p> : null}
    {!request.bookOptions.lengthId ? <p className={styles.warn}>בחרו אורך ספר לפני שמתחילים לכתוב.</p> : null}
    <div role="status" aria-live="polite">
      {busy ? <p>המנוע עובד על ההרפתקה של {request.child.name}: תכנון עלילה, כתיבה, סטוריבורד ובדיקת רציפות. התהליך יכול לקחת כמה דקות. אין צורך ללחוץ שוב; השאירו את החלון פתוח.</p> : null}
      {message ? <p className={styles.warn}>{message}</p> : null}
    </div>
    {busy ? <button type="button" className={styles.btnBack} onClick={() => { cancel(); onEdit(); }}>לבטל ולחזור לפרטים</button> : <button type="button" className={styles.btnContinue} disabled={!available || !request.bookOptions.lengthId} onClick={() => void write()}>{attempted ? 'ליצור ניסיון חדש שעלול להיות בתשלום' : `ליצור סיפור וסטוריבורד עבור ${request.child.name}`}</button>}
    <button type="button" className={styles.linkButton} onClick={() => { cancel(); onEdit(); }}>לתקן את הפרטים</button>
    {currentHold ? <article className={styles.manuscript}>
      <h3>התכנון מוחזק לבדיקה</h3>
      <p className={styles.warn}>תכנון בלבד, לא סיפור לקריאה. אלה הערות המתכנן, לא אישור ספרותי עצמאי. לא נכתבו סיפור או סטוריבורד, ואין אישור לרינדור.</p>
      {currentHold.planningResult.planning.selection.candidates.map(candidate => <section key={candidate.id}>
        <h4>הצעה {candidate.id}{candidate.id === currentHold.planningResult.planning.selection.selectedId ? ' · נבחרה בידי המתכנן' : ''}</h4>
        <p>{candidate.curiosity}</p><p>רצון הילד: {candidate.childWant}</p><p>רצון החבר: {candidate.companionWant}</p>
        <p>הסתבכות: {candidate.complication}</p><p>גילוי: {candidate.discovery}</p>
        <p>תרומת הילד: {candidate.childContribution}</p><p>סיום מוצע: {candidate.payoff}</p>
      </section>)}
      <p>נימוק הבחירה: {currentHold.planningResult.planning.selection.reason}</p>
      {Object.entries(currentHold.planningResult.planning.selection.outlineChecks).map(([key, check]) => <p className={check.outcome === 'needs_work' ? styles.warn : styles.hint} key={key}>
        {{ curiosity_and_stakes: 'סקרנות ומשמעות', causal_child_choices: 'בחירות שמשנות את ההמשך', earned_payoff: 'סיום שנובע מהעלילה' }[key as 'curiosity_and_stakes' | 'causal_child_choices' | 'earned_payoff']}: {check.outcome === 'needs_work' ? 'דורש עבודה' : 'נתמך לדעת המתכנן'} · כפולות {check.evidenceSpreads.join(', ')} · {check.note}
      </p>)}
      <details><summary>לראות את התוכנית שלא הפכה לסיפור</summary>
        <p>{currentHold.planningResult.plan.title}</p>
        {currentHold.planningResult.plan.beats.map(beat => <section key={beat.pageNumber}>
          <h4>כפולה {beat.pageNumber}</h4><p>{beat.location} · {beat.transitionReason}</p>
          <p>{beat.childAction} · {beat.companionAction}</p><p>{beat.consequence}</p><p>{beat.continuity}</p>
        </section>)}
      </details>
    </article> : null}
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
      <p className={styles.hint}>גרסה חדשה יכולה לשנות גם את העלילה. הטיוטה אינה מאושרת לרינדור.</p>
    </article> : null}
    {accounting ? <p className={styles.hint}>עלות שלבי הניסיון לפי שימוש: {accounting.estimatedUsd === null ? 'לא התקבלו נתוני שימוש מלאים' : `$${accounting.estimatedUsd.toFixed(4)}`}. שמורת תקציב: ${accounting.reservedUsd.toFixed(4)}. זו אינה חשבונית ולא מחיר הספר.</p> : null}
  </section>;
}
