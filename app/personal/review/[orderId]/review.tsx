'use client';
import { useEffect, useState } from 'react';
type BookReview = { kind?: 'book'; bookSha256: string; previousDecisionSha256: string | null; policySha256: string;
  policy: { mode: 'required' | 'off' }; readiness: string; holdReason: string | null; previewUrl: string; pdfUrl: string;
  history: { actorId: string; decidedAt: string; decision: string; bookSha256: string; reason: string }[] };
type InfrastructureReview={kind:'infrastructure';holdSha256:string;canResume:boolean;holdReason:string;code:string;caseId:string|null;
  actions:{result:{value:{actorId:string;decidedAt:string;action:string;reason:string}}}[]};
type Review=BookReview|InfrastructureReview;
export function PersonalBookReview({ orderId }: { orderId: string }) {
  const [data, setData] = useState<Review | null>(null), [reason, setReason] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/engine-site/v1/review/${encodeURIComponent(orderId)}`, { cache: 'no-store', signal: abort.signal })
      .then(async r => { if (!r.ok) throw Error('denied'); setData(await r.json()); }).catch(() => { if (!abort.signal.aborted) setMessage('אין גישה לבדיקה, או שהספר טרם מוכן.'); });
    return () => abort.abort();
  }, [orderId]);
  async function act(decision: 'approve' | 'reject' | 'off' | 'required' | 'resume' | 'fail') {
    if (!data || !reason.trim() || busy) return; setBusy(true); setMessage('');
    const policy = decision === 'off' || decision === 'required';
    try {
      const res = await fetch(policy ? '/api/engine-site/v1/review-policy' : `/api/engine-site/v1/review/${encodeURIComponent(orderId)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), reason,
          ...(data.kind==='infrastructure'?{action:decision,expectedHoldSha256:data.holdSha256}:
            {expectedPolicySha256:data.policySha256,...(policy ? { mode: decision } : { decision, expectedBookSha256: data.bookSha256,
            expectedPreviousDecisionSha256: data.previousDecisionSha256 })}) }) });
      if (!res.ok) { setMessage('הפעולה נעצרה. יש לרענן ולבדוק את מצב הספר וההחלטות לפני ניסיון נוסף.'); return; }
      setMessage(decision==='resume'?'המשך העבודה תועד. ההזמנה חזרה לתור הרגיל ללא שינוי במונה או באישורי ההוצאה.':decision==='fail'?
        'העצירה תועדה וההזמנה הועברה למסלול ההחזר.':policy ? 'מדיניות בדיקת המפעיל עודכנה ותועדה. ההזמנות יעובדו במסלול האוטומטי הרגיל.' : decision === 'approve' ? 'האישור תועד. הספר יעבור שוב את שער הקבלה והמסירה.' : 'הדחייה תועדה והספר הועבר למסלול עצירה והחזר.');
      const fresh = await fetch(`/api/engine-site/v1/review/${encodeURIComponent(orderId)}`, { cache: 'no-store' });
      if (fresh.ok) setData(await fresh.json()); else if(decision==='resume'||decision==='fail')setData(null);
    } catch { setMessage('תוצאת הפעולה אינה ידועה. רעננו כדי לקרוא את הרשומה השמורה לפני פעולה נוספת.'); }
    finally { setBusy(false); }
  }
  if(data?.kind==='infrastructure')return <main dir="rtl" style={{maxWidth:850,margin:'3rem auto',padding:24}}>
    <h1>הזמנה שממתינה לטיפול בתקלת תשתית</h1><p role="status">{message}</p><p>הספר נשמר ללא מסירה. סיבת העצירה: {data.code}</p>
    <p>{data.canResume?'אפשר להמשיך לאחר שהתשתית חזרה לפעול.':'המשך חסום: יש קריאה שלא הוסדרה, סמכות שאינה תואמת או פעולה שאינה בטוחה לחידוש.'}</p>
    <label>סיבת הפעולה <textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={500} rows={3}/></label>
    <p><button disabled={busy||!reason.trim()||!data.canResume} onClick={()=>void act('resume')}>המשך במסלול הרגיל</button>{' '}
      <button disabled={busy||!reason.trim()} onClick={()=>void act('fail')}>עצירה והעברה להחזר</button></p>
    <h2>פעולות מתועדות</h2><ol>{data.actions.map((r,n)=><li key={n}>{r.result.value.action} · {r.result.value.actorId} · {r.result.value.decidedAt} · {r.result.value.reason}</li>)}</ol>
  </main>;
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
