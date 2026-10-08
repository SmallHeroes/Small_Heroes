'use client';
import { useEffect, useRef, useState } from 'react';
import type { ReviewedPersonalBookRequest } from '@/lib/personal-wizard/contract';
import { readSimpleBookView, newerSimpleBookView, type SimpleBookView } from '@/lib/personal-wizard/simple-book-view';
import styles from './personal-wizard.module.css';

const endpoint = '/api/dev/personal-wizard/simple-book';
const phases: Record<SimpleBookView['phase'], string> = {
  queued: 'הבקשה שמורה. מחכים להפעלת המנוע המקומי.', author: 'Opus כותב עכשיו סיפור חדש.',
  editor: 'Opus עורך את הטיוטה בשיחה חדשה.', story_review: 'Astra קורא את הסיפור ובודק גם מה השתנה בעריכה.',
  storyboard: 'מתכננים את הכריכה ואת כל הסצנות יחד.', storyboard_review: 'בודקים את המיקומים, הדמויות והחפצים לאורך הספר.',
  references_required: 'הסיפור והסטוריבורד מוכנים לבחינת רפרנסים. איורי הספר עדיין לא נוצרו.',
  references: 'יוצרים ובודקים רפרנסים קבועים לדמויות, לחפצים ולמקומות.',
  illustrating: 'מאיירים את הספר ובודקים כל עמוד מול זהות הדמויות והמשכיות הסצנות.',
  illustrated_audition: 'ספר הניסוי המאויר מוכן לקריאה. זו אינה הרשאת ייצור או פרסום.',
  held: 'הניסוי נעצר לבחינה. זו אינה תוצאה מאושרת לאיור.', failed: 'הניסוי נעצר בגלל כשל. לא מתחילים מחדש אוטומטית.',
};
export function SimpleBookPreview({ request, requestId, stale, onEdit }: {
  request: ReviewedPersonalBookRequest; requestId: string; stale: boolean; onEdit: () => void;
}) {
  const [available, setAvailable] = useState(false), [view, setView] = useState<SimpleBookView | null>(null);
  const [imagesEnabled, setImagesEnabled] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [statusRevision, setStatusRevision] = useState(0), refreshRequested = useRef(false);
  const identity = useRef({ requestId, stale }); identity.current = { requestId, stale };
  const current = view?.requestId === requestId ? view : null;
  useEffect(() => {
    const controller = new AbortController(); setAvailable(false); setImagesEnabled(false); setError(null);
    fetch(endpoint, { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) return; const data = await response.json();
      if (!controller.signal.aborted) { setAvailable(data.configured === true && data.engine === 'simple-opus-fresh-editor-astra'); setImagesEnabled(data.imagesAvailable === true); }
    }).catch(() => {});
    return () => controller.abort();
  }, [requestId]);
  useEffect(() => {
    const terminal = !!current && (['illustrated_audition', 'held', 'failed'].includes(current.phase) || current.phase === 'references_required' && !imagesEnabled);
    if (!available || stale || terminal && !refreshRequested.current) return;
    refreshRequested.current = false;
    const controller = new AbortController();
    const poll = async () => {
      try {
        const response = await fetch(`${endpoint}?requestId=${requestId}`, { cache: 'no-store', signal: controller.signal });
        if ([401, 403, 404].includes(response.status)) {
          if (!controller.signal.aborted) { setAvailable(false); setView(null); }
          return;
        }
        if (!response.ok) return;
        const next = readSimpleBookView(await response.json(), requestId);
        if (next && !controller.signal.aborted) setView(previous => newerSimpleBookView(previous, next));
      } catch { /* No implicit replay or fallback on a poll failure. */ }
    };
    void poll();
    if (terminal) return () => controller.abort(); // Manual GET only; never restarts a paid worker.
    const timer = setInterval(() => void poll(), 10000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [available, imagesEnabled, requestId, stale, current?.phase, statusRevision]);
  async function start() {
    if (!available || stale || busy || current) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request, requestId, consent: 'reviewed_text_to_simple_book_diagnostic' }) });
      const data = await response.json(), next = readSimpleBookView(data, requestId);
      if (identity.current.requestId !== requestId || identity.current.stale) return;
      if (!response.ok || !next) setError(typeof data.error === 'string' ? data.error : 'simple_unavailable');
      else setView(previous => newerSimpleBookView(previous, next));
    } catch { setError('simple_network'); } finally { setBusy(false); }
  }
  return <section className={styles.card} aria-labelledby="simple-book-title">
    <h2 id="simple-book-title">ניסוי המנוע החדש</h2>
    <p>סיפור חדש ש־Opus כותב ועורך בשיחות נפרדות, ביקורת Astra וסטוריבורד מלא. ניסוי מקומי לחשבון מורשה בלבד.</p>
    <p className={styles.hint}>8 עמודי סיפור ועוד כריכה. ללא חיוב לקוח. {imagesEnabled ? 'איורי ניסוי בלבד, לאחר בדיקת הרפרנסים וההמשכיות.' : 'איורים עדיין ממתינים לאישור הרפרנסים.'}</p>
    {stale ? <p>הפרטים השתנו. צריך לאשר שוב את הבקשה.</p> : null}
    {!available ? <p className={styles.hint}>הניסוי אינו מופעל לחשבון הזה כרגע.</p> : null}
    <button type="button" className={styles.primaryButton} disabled={!available || stale || busy || !!current || request.bookOptions.lengthId !== 'short'} onClick={() => void start()}>
      {busy ? 'שומרים בקשה…' : 'להפעיל את ניסוי הספר החדש'}
    </button>
    <button type="button" className={styles.linkButton} onClick={onEdit}>לערוך את הפרטים</button>
    {current ? <button type="button" className={styles.linkButton} disabled={!available || stale || busy}
      onClick={() => { refreshRequested.current = true; setStatusRevision(v => v + 1); }}>רענון מצב הספר</button> : null}
    <div role="status" aria-live="polite">{current ? <p>{phases[current.phase]}</p> : null}</div>
    {error ? <p className={styles.error}>לא ניתן להתחיל: {error}</p> : null}
    {current ? <p className={styles.hint}>אומדן שימוש כולל: ${(current.accounting.knownEstimateMicroUsd / 1e6).toFixed(4)} מתוך $12.
      {current.accounting.unknownAttemptCosts ? ' יש ניסיון שעלותו אינה ידועה. לא ממשיכים בתשלום.' : ''}</p> : null}
    {current?.edited ? <article dir="rtl"><h3>{current.edited.title}</h3>
      {current.phase === 'illustrated_audition' ? <img src={`${endpoint}?requestId=${requestId}&page=0`} alt={`כריכת ${current.edited.title}`} style={{ width: '100%', height: 'auto', borderRadius: 16 }} /> : null}
      {current.edited.pages.map(page => <section key={page.pageNumber}><h4>עמוד {page.pageNumber}</h4>
        {current.phase === 'illustrated_audition' ? <img src={`${endpoint}?requestId=${requestId}&page=${page.pageNumber}`} alt={`איור לעמוד ${page.pageNumber}`} loading="lazy" style={{ width: '100%', height: 'auto', borderRadius: 16 }} /> : null}
        <p style={{ whiteSpace: 'pre-line', lineHeight: 1.8 }}>{page.text}</p></section>)}</article> : null}
    {current?.original ? <details><summary>הטיוטה המקורית לפני העריכה</summary>{current.original.pages.map(page => <p key={page.pageNumber}>{page.text}</p>)}</details> : null}
    {current?.readings.map(reading => <details key={reading.stage}><summary>{reading.stage === 'final_review' ? 'קריאת הסיפור הסופי' : 'השוואת העריכה למקור'}</summary>
      <p>{reading.summary}</p>{reading.findings.map((finding, i) => <div key={i}><p>{finding.severity}: {finding.explanation}</p>
        {[...finding.original, ...finding.revised].map((quote, n) => <blockquote key={n}>עמוד {quote.pageNumber}: {quote.quote}</blockquote>)}</div>)}</details>)}
  </section>;
}
