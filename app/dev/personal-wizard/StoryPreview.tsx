'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReviewedPersonalBookRequest } from '@/lib/personal-wizard/contract';
import { personalStoryResultSchema, type PersonalStoryResult } from '@/lib/personal-wizard/story-contract';
import styles from './personal-wizard.module.css';

type Props = { request: ReviewedPersonalBookRequest; requestId: string; stale: boolean; onEdit: () => void };
export function StoryPreview({ request, requestId, stale, onEdit }: Props) {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PersonalStoryResult | null>(null);
  const [message, setMessage] = useState('');
  const active = useRef<AbortController | null>(null);
  const epoch = useRef(0);
  // Guard the render itself, not just the post-render effect, when request identity changes.
  const currentResult = result?.requestId === requestId ? result : null;
  useEffect(() => {
    let live = true;
    void fetch('/api/dev/personal-wizard/story', { cache: 'no-store' }).then(async (response) => response.ok && (await response.json()).available === true).then((value) => { if (live) setAvailable(Boolean(value)); }).catch(() => undefined);
    return () => { live = false; };
  }, []);
  useEffect(() => {
    epoch.current += 1;
    active.current?.abort(); active.current = null;
    setBusy(false); setResult(null); setMessage('');
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
    setBusy(true); setMessage(''); setResult(null);
    const jobId = `s_${crypto.randomUUID().replace(/-/g, '')}`;
    try {
      const response = await fetch('/api/dev/personal-wizard/story', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId, request }), signal: controller.signal, cache: 'no-store' });
      const body = await response.json();
      if (token !== epoch.current || controller.signal.aborted) return;
      if (!response.ok) {
        const limit = ['budget_exhausted', 'job_limit', 'user_busy', 'duplicate_job'].includes(body.error);
        setMessage(limit ? 'הכתיבה אינה זמינה כרגע במסגרת הניסוי. הפרטים שלכם עדיין בחלון הזה.' : 'הטיוטה לא הושלמה. הפרטים שלכם עדיין כאן. ניסיון נוסף מתחיל עבודה חדשה ועלול להיות בתשלום.');
      } else {
        const parsed = personalStoryResultSchema.safeParse(body);
        if (parsed.success && parsed.data.requestId === requestId) setResult(parsed.data);
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
    <p className={styles.summaryText}>מהפרטים שאישרתם נמציא הרפתקה עם הומור, דמיון ורגעים שבהם {request.child.name} בוחר איך להמשיך. אם בחרתם נושא להתמודדות, הוא יקבל מקום בפעולות ובבחירות. בשלב הזה נכתבת טיוטת טקסט בלבד, לפני איורים וקריינות.</p>
    {!available ? <p className={styles.hint}>הכתיבה החיה זמינה רק בניסוי מקומי למשתמש מורשה. לא נשלחה בקשה לכותב.</p> : null}
    {available ? <p className={styles.hint}>כתיבה בניסוי צורכת תקציב API ועלולה להיות מחויבת גם אם הטיוטה לא תושלם. זו אינה רכישה של ספר.</p> : null}
    {!request.bookOptions.lengthId ? <p className={styles.warn}>בחרו אורך ספר לפני שמתחילים לכתוב.</p> : null}
    <div role="status" aria-live="polite">
      {busy ? <p>כותבים את ההרפתקה של {request.child.name}. תחילה מתכננים את הסיפור כולו, ואז כותבים את העמודים.</p> : null}
      {message ? <p className={styles.warn}>{message}</p> : null}
    </div>
    {busy ? <button type="button" className={styles.btnBack} onClick={() => { cancel(); onEdit(); }}>לבטל ולחזור לפרטים</button> : <button type="button" className={styles.btnContinue} disabled={!available || !request.bookOptions.lengthId} onClick={() => void write()}>{currentResult ? 'לכתוב גרסה חדשה' : `לכתוב את הטיוטה של ${request.child.name}`}</button>}
    <button type="button" className={styles.linkButton} onClick={() => { cancel(); onEdit(); }}>לתקן את הפרטים</button>
    {currentResult ? <article className={styles.manuscript}>
      <p className={styles.hint}>סיפור ראשון לקריאה · לפני איורים וקריינות · ממתין לבדיקת תוכן</p>
      <h3>{currentResult.manuscript.title}</h3>
      {currentResult.manuscript.pages.map((page) => <section key={page.pageNumber}><h4>כפולה {page.pageNumber}</h4><p>{page.text}</p></section>)}
      <p className={styles.hint}>עלות כתיבה משוערת לפי שימוש: {currentResult.accounting.estimatedUsd === null ? 'לא התקבלו נתוני שימוש מלאים' : `$${currentResult.accounting.estimatedUsd.toFixed(4)}`}. שמורת תקציב: ${currentResult.accounting.reservedUsd.toFixed(4)}. זו אינה חשבונית ולא מחיר הספר.</p>
      <p className={styles.hint}>גרסה חדשה יכולה לשנות גם את העלילה. הטיוטה אינה מאושרת לרינדור.</p>
    </article> : null}
  </section>;
}
