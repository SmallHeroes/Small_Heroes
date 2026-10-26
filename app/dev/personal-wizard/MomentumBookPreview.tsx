'use client';
import { useEffect, useRef, useState } from 'react';
import type { ReviewedPersonalBookRequest } from '@/lib/personal-wizard/contract';
import { readMomentumBookView, type MomentumBookView } from '@/lib/personal-wizard/momentum-book-view';
import styles from './personal-wizard.module.css';

const endpoint = '/api/dev/personal-wizard/momentum-book';
const phases: Record<MomentumBookView['phase'], string> = {
  received: 'הבקשה התקבלה ונשמרה לספר הניסוי. ההרצה בתשלום מתחילה רק אחרי בדיקה עצמאית של הבקשה הזו.',
  running: 'המנוע כותב, עורך, מתכנן ומאייר את הספר. זה לוקח זמן.',
  ready: 'הספר מוכן לקריאה בקורא המקומי.',
  held: 'הספר נעצר בבדיקת איכות. התוצאה והסיבה נשמרו; לא מתחילים מחדש אוטומטית.',
  stopped: 'ההרצה נעצרה. העדויות נשמרו; לא מתחילים מחדש אוטומטית.',
};
const issues: Record<string, string> = {
  momentum_companion_used: 'החבר המלווה הזה כבר הופיע בספר קודם. לניסוי הזה בוחרים חבר מלווה חדש.',
  momentum_voice: 'לספר הניסוי הזה בוחרים קריינות של אבא.', momentum_length: 'ספר הניסוי הוא באורך הקצר (8 עמודים).',
  momentum_photo: 'ספר הניסוי נוצר בלי תמונה של ילד.', momentum_slot_consumed: 'כבר נשמרה בקשה אחרת לספר הניסוי היחיד.',
  momentum_age: 'גיל הילד בניסוי הוא בין 3 ל־8.',
};
const event = (value: string | null) => !value ? null : value.startsWith('narration') ? 'מקליטים את קריינות אבא.' : /^page |sheet|reference|child/.test(value)
  ? 'מאיירים ובודקים עמודים.' : /storyboard/.test(value) ? 'מתכננים את הסצנות.' : /author|editor|story_review|source_impact/.test(value) ? 'כותבים ובודקים את הסיפור.' : null;
export function MomentumBookPreview({ request, requestId, stale, onEdit }: {
  request: ReviewedPersonalBookRequest; requestId: string; stale: boolean; onEdit: () => void;
}) {
  const [available, setAvailable] = useState(false), [view, setView] = useState<MomentumBookView | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const identity = useRef({ requestId, stale }); identity.current = { requestId, stale };
  const current = view?.requestId === requestId ? view : null;
  useEffect(() => {
    const controller = new AbortController(); setAvailable(false); setError(null);
    fetch(endpoint, { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) return; const data = await response.json();
      if (!controller.signal.aborted) setAvailable(data.configured === true && data.engine === 'momentum-v4-roles');
    }).catch(() => {});
    return () => controller.abort();
  }, [requestId]);
  useEffect(() => {
    if (!available || stale || !current || ['ready', 'held', 'stopped'].includes(current.phase)) return;
    const controller = new AbortController();
    const poll = async () => {
      try {
        const response = await fetch(`${endpoint}?requestId=${requestId}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) return;
        const next = readMomentumBookView(await response.json(), requestId);
        if (next && !controller.signal.aborted) setView(next);
      } catch { /* A failed poll never restarts or replays anything. */ }
    };
    const timer = setInterval(() => void poll(), 15000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [available, requestId, stale, current?.phase]);
  async function start() {
    if (!available || stale || busy || current) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request, requestId, consent: 'reviewed_text_to_momentum_book_trial' }) });
      const data = await response.json(), next = readMomentumBookView(data, requestId);
      if (identity.current.requestId !== requestId || identity.current.stale) return;
      if (!response.ok || !next) setError(typeof data.error === 'string' ? data.error : 'momentum_unavailable');
      else setView(next);
    } catch { setError('momentum_network'); } finally { setBusy(false); }
  }
  const dollars = (micro: number | null | undefined) => micro == null ? '—' : `$${(micro / 1e6).toFixed(2)}`;
  return <section className={styles.card} aria-labelledby="momentum-book-title">
    <h2 id="momentum-book-title">ספר ניסוי עם המנוע המעודכן</h2>
    <p>סיפור חדש שנכתב במיוחד, עריכה, סטוריבורד, איורים לכריכה ולשמונה עמודים, וקריינות של אבא. ניסוי מקומי עם ילד בדוי בלבד, בלי חיוב לקוח.</p>
    {stale ? <p>הפרטים השתנו. צריך לאשר שוב את הבקשה.</p> : null}
    {!available ? <p className={styles.hint}>ספר הניסוי אינו מופעל כאן כרגע.</p> : null}
    <button type="button" className={styles.primaryButton} disabled={!available || stale || busy || !!current} onClick={() => void start()}>
      {busy ? 'שומרים בקשה…' : 'ליצור את הספר'}
    </button>
    <button type="button" className={styles.linkButton} onClick={onEdit}>לערוך את הפרטים</button>
    <div role="status" aria-live="polite">{current ? <><p>{phases[current.phase]}</p>{current.phase === 'running' && event(current.event) ? <p className={styles.hint}>{event(current.event)}</p> : null}</> : null}</div>
    {error ? <p className={styles.error}>{issues[error] ?? `לא ניתן להתחיל: ${error}`}</p> : null}
    {current?.phase === 'ready' && current.readerUrl ? <p><a className={styles.primaryButton} href={current.readerUrl}>לפתוח את הספר בקורא</a>
      {current.narration === 'narrated' ? null : <span className={styles.hint}> הספר מוצג בלי קריינות: הקריינות לא הושלמה, והסיבה נשמרה.</span>}</p> : null}
    {current?.accounting ? <p className={styles.hint}>עלות מצטברת ידועה ב־API: {dollars(current.accounting.apiCumulativeMicroUsd)} מתוך $7 (כולל ניסויים קודמים) · Claude Max בנפרד: {dollars(current.accounting.claudeMaxMicroUsd)}</p> : null}
  </section>;
}
