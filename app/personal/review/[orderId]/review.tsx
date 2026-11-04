'use client';
import { useEffect, useState } from 'react';
type Review = { bookSha256: string; previousDecisionSha256: string | null; policySha256: string;
  policy: { mode: 'required' | 'off' }; readiness: string; holdReason: string | null; previewUrl: string; pdfUrl: string;
  history: { actorId: string; decidedAt: string; decision: string; bookSha256: string; reason: string }[] };
export function PersonalBookReview({ orderId }: { orderId: string }) {
  const [data, setData] = useState<Review | null>(null), [reason, setReason] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/engine-site/v1/review/${encodeURIComponent(orderId)}`, { cache: 'no-store', signal: abort.signal })
      .then(async r => { if (!r.ok) throw Error('denied'); setData(await r.json()); }).catch(() => { if (!abort.signal.aborted) setMessage('אין גישה לבדיקה, או שהספר טרם מוכן.'); });
    return () => abort.abort();
  }, [orderId]);
  async function act(decision: 'approve' | 'reject' | 'off' | 'required') {
    if (!data || !reason.trim() || busy) return; setBusy(true); setMessage('');
    const policy = decision === 'off' || decision === 'required';
    try {
      const res = await fetch(policy ? '/api/engine-site/v1/review-policy' : `/api/engine-site/v1/review/${encodeURIComponent(orderId)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), reason,
          expectedPolicySha256: data.policySha256, ...(policy ? { mode: decision } : { decision, expectedBookSha256: data.bookSha256,
            expectedPreviousDecisionSha256: data.previousDecisionSha256 }) }) });
      if (!res.ok) { setMessage('הפעולה נעצרה. יש לרענן ולבדוק את מצב הספר וההחלטות לפני ניסיון נוסף.'); return; }
      setMessage(policy ? 'מדיניות בדיקת המפעיל עודכנה ותועדה. ההזמנות יעובדו במסלול האוטומטי הרגיל.' : decision === 'approve' ? 'האישור תועד. הספר יעבור שוב את שער הקבלה והמסירה.' : 'הדחייה תועדה והספר הועבר למסלול עצירה והחזר.');
      const fresh = await fetch(`/api/engine-site/v1/review/${encodeURIComponent(orderId)}`, { cache: 'no-store' });
      if (fresh.ok) setData(await fresh.json());
    } catch { setMessage('תוצאת הפעולה אינה ידועה. רעננו כדי לקרוא את הרשומה השמורה לפני פעולה נוספת.'); }
    finally { setBusy(false); }
  }
  return <main dir="rtl" style={{ maxWidth: 850, margin: '3rem auto', padding: 24 }}><h1>בדיקת ספר לפני מסירה</h1>
    <p role="status">{message}</p>{data && <>
      <p>מצב קבלה: {data.readiness}. מצב אישור המפעיל: {data.policy.mode === 'required' ? 'נדרש' : 'כבוי'}. {data.holdReason}</p>
      <p><a href={data.previewUrl} target="_blank" rel="noreferrer">לקריאה ולהאזנה בתצוגת מפעיל</a>{' · '}<a href={data.pdfUrl} target="_blank" rel="noreferrer">לבדיקת ה־PDF</a></p>
      <p>האישור נקשר לבתים של גרסת הספר: <code>{data.bookSha256}</code></p>
      <label>סיבת ההחלטה <textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500} rows={3} /></label>
      <p><button disabled={busy || !reason.trim()} onClick={() => void act('approve')}>אישור למסירה בכפוף לקבלה האוטומטית</button>{' '}
        <button disabled={busy || !reason.trim()} onClick={() => void act('reject')}>דחייה והעברה להחזר</button></p>
      <h2>מדיניות ההשקה לכל ההזמנות</h2><p>השינוי הבא מתועד ומשפיע על כל הספרים. שערי הקבלה האוטומטיים נשארים בתוקף.</p>
      <button disabled={busy || !reason.trim()} onClick={() => void act(data.policy.mode === 'required' ? 'off' : 'required')}>
        {data.policy.mode === 'required' ? 'מעבר למסירה אוטומטית ללא בדיקת מפעיל' : 'החזרת בדיקת מפעיל לפני מסירה'}</button>
      <h2>החלטות שמורות</h2><ol>{data.history.map((d, n) => <li key={n}>{d.decision} · {d.actorId} · {d.decidedAt} · {d.reason} · <code>{d.bookSha256}</code></li>)}</ol>
    </>}</main>;
}
