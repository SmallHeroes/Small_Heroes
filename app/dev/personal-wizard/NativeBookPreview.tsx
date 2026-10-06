'use client';
import { useEffect, useRef, useState } from 'react';
import type { ReviewedPersonalBookRequest } from '@/lib/personal-wizard/contract';
import { readNativeBookView, newerNativeBookView, type NativeBookView } from '@/lib/personal-wizard/native-book-preview';
import styles from './personal-wizard.module.css';

const ENDPOINT = '/api/dev/personal-wizard/native-book';
const PHASE: Record<NativeBookView['phase'], string> = {
  queued: 'הבקשה נשמרה. ממתינים להפעלת המפעיל המקומי.', planning: 'Opus מתכנן את ההרפתקה כולה.',
  synopsis_review: 'המתווה ממתין לקריאת המפעיל לפני כתיבת הסיפור.', repairing: 'Opus מתקן את המתווה במסגרת הניסיון היחיד שהוקצה.',
  writing: 'כותבים את הסיפור, עורכים בשיחה חדשה ומעבירים לקריאות של Astra.',
  complete: 'הכתיבה, העריכה והקריאות הושלמו. עכשיו תורכם לקרוא; זה עדיין אינו אישור מוצר או רינדור.',
  held: 'התוצאה מוחזקת לבדיקה. אין אישור להמשיך לאיורים.',
  failed: 'הניסיון נעצר. לא מתחילים מחדש אוטומטית ולא עוברים לכותב אחר.',
};
export function NativeBookPreview({ request, requestId, stale, onEdit }: {
  request: ReviewedPersonalBookRequest; requestId: string; stale: boolean; onEdit: () => void;
}) {
  const [available, setAvailable] = useState(false), [consent, setConsent] = useState(false);
  const [view, setView] = useState<NativeBookView | null>(null), [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ requestId: string; text: string } | null>(null);
  const epoch = useRef(0);
  const current = !stale && view?.requestId === requestId ? view : null;
  useEffect(() => {
    const controller = new AbortController(), token = ++epoch.current;
    setAvailable(false); setView(null); setConsent(false); setSending(false); setNotice(null);
    if (stale) return () => { epoch.current++; controller.abort(); };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const response = await fetch(`${ENDPOINT}?requestId=${requestId}`, { cache: 'no-store', signal: controller.signal });
        if (response.ok) {
          const parsed = readNativeBookView(await response.json(), requestId);
          if (token !== epoch.current || controller.signal.aborted) return;
          if (parsed) setView(previous => newerNativeBookView(previous, parsed));
        }
      } catch { /* A read failure never starts a new request. */ }
      if (token === epoch.current && !controller.signal.aborted) timer = setTimeout(() => void poll(), 10000);
    };
    void fetch(ENDPOINT, { cache: 'no-store', signal: controller.signal }).then(async response => {
      const body = response.ok ? await response.json() : null;
      if (token !== epoch.current || controller.signal.aborted) return;
      setAvailable(body?.configured === true && body?.engine === 'opus-fresh-editor-astra');
      if (body?.configured) void poll();
    }).catch(() => {});
    return () => { epoch.current++; controller.abort(); if (timer) clearTimeout(timer); };
  }, [requestId, stale]);
  const start = async () => {
    if (!available || !consent || stale || sending || current || request.bookOptions.lengthId !== 'short') return;
    const token = epoch.current;
    setSending(true); setNotice(null);
    try {
      const response = await fetch(ENDPOINT, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request, requestId, consent: 'reviewed_text_to_opus_and_astra' }) });
      const body = await response.json();
      if (token !== epoch.current) return;
      const parsed = response.ok ? readNativeBookView(body, requestId) : null;
      if (parsed) setView(previous => newerNativeBookView(previous, parsed));
      else setNotice({ requestId, text: 'הבקשה לא התקבלה למסלול החדש. לא הופעל כותב חלופי; האישור עשוי להיות כבר בשימוש.' });
    } catch {
      if (token === epoch.current) setNotice({ requestId, text: 'לא קיבלנו תשובה. הבקשה עשויה להישמר; רענון מצב אינו מפעיל ניסיון נוסף.' });
    } finally { if (token === epoch.current) setSending(false); }
  };
  if (stale) return <p className={styles.hint}>הפרטים השתנו. תוצאת הבקשה הקודמת לא תוצג עבור הפרטים החדשים.</p>;
  const story = current?.edited ?? current?.original;
  return <section className={styles.card} aria-labelledby="native-story-title">
    <h2 id="native-story-title" className={styles.sectionTitle}>ההרפתקה של {request.child.name} · המנוע החדש</h2>
    <p className={styles.summaryText}>Opus כותב מאפס ועורך בשיחה חדשה. Astra קורא את המקור, את הסיפור הערוך בנפרד ואז משווה. בניסוי הזה בודקים טקסט בלבד — בלי איורים, קריינות או הזמנה בתשלום.</p>
    <p className={styles.hint}>ניסוי מקומי אחד, בספר הקצר בלבד. תקרת הרשאה $12 אינה המחיר הצפוי או חשבונית. נשלחים רק הפרטים שאישרתם; צילום והקלטה אינם מועברים לכותב.</p>
    {!available ? <p className={styles.warn}>המסלול המקומי אינו זמין למשתמש המחובר. אין מעבר אוטומטי למנוע הישן.</p> : null}
    {request.bookOptions.lengthId !== 'short' ? <p className={styles.warn}>בחרו את הספר הקצר כדי להשתמש בניסוי המאושר.</p> : null}
    {!current ? <>
      <label className={styles.hint}><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> מאשר/ת להעביר את הפרטים שבדקתי ל־Opus ול־Astra לצורך ספר הניסיון.</label>
      <button className={styles.btnContinue} type="button" disabled={!available || !consent || sending || request.bookOptions.lengthId !== 'short'} onClick={() => void start()}>{sending ? 'שומרים את הבקשה…' : 'ליצור ספר עם המנוע החדש'}</button>
    </> : null}
    <div role="status" aria-live="polite">
      {current ? <p className={current.phase === 'failed' || current.phase === 'held' ? styles.warn : styles.hint}>{PHASE[current.phase]}</p> : null}
      {notice?.requestId === requestId ? <p className={styles.warn}>{notice.text}</p> : null}
    </div>
    <p className={styles.hint}>יציאה מהמסך או עריכת פרטים אינה מבטלת הפעלה שכבר התחילה. אין ניסיון נוסף תחת אותו אישור. המפעיל המקומי יכול לעצור בטרמינל.</p>
    <button type="button" className={styles.linkButton} onClick={onEdit}>לתקן את הפרטים</button>
    {story ? <article className={styles.manuscript}>
      <p className={styles.warn}>{current?.edited ? 'הסיפור הערוך לקריאה ולדעה שלכם' : 'טיוטה בלבד — העריכה והבדיקות לא הושלמו'}</p>
      <h3>{story.title}</h3>{story.pages.map(page => <section key={page.pageNumber}><h4>כפולה {page.pageNumber}</h4><p>{page.text}</p></section>)}
      {current?.edited && current.original ? <details><summary>לקרוא את הטיוטה המקורית</summary><h4>{current.original.title}</h4>{current.original.pages.map(page => <section key={page.pageNumber}><h4>כפולה {page.pageNumber}</h4><p>{page.text}</p></section>)}</details> : null}
    </article> : null}
    {current?.readings.length ? <details><summary>קריאות Astra — כולל הערות שנותרו</summary>{current.readings.map(reading => <section key={reading.stage}>
      <h3>{{ original_review: 'המקור', final_review: 'העריכה — קריאה נפרדת', comparison: 'השוואה בין הגרסאות' }[reading.stage]}</h3>
      <p>{reading.summary}</p>{reading.findings.map((f, i) => <section key={i}><h4>{f.criterion} · {f.severity}</h4><p>{f.explanation}</p>{[...f.original, ...f.revised].map((q, j) => <blockquote key={j}>כפולה {q.pageNumber}: {q.quote}</blockquote>)}</section>)}
    </section>)}</details> : null}
    {current ? <p className={styles.hint}>הערכת שימוש ידועה: ${(current.accounting.knownEstimateMicroUsd / 1000000).toFixed(4)}. קריאות לוגיות: {current.accounting.logicalAttempts}. עלויות לא ידועות: {current.accounting.unknownAttemptCosts}. הערכת API/מנוי, לא חשבונית. {current.error ? `סיבת עצירה: ${current.error}` : ''}</p> : null}
  </section>;
}
