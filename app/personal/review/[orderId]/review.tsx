'use client';
import { useEffect, useState } from 'react';
type PaymentCase={caseId:string;noticeSha256:string;code:string;createdAt:string};
export function PaymentNoticeList({cases,dismiss,disabled}:{cases:PaymentCase[];dismiss:(item:PaymentCase)=>void;disabled:boolean}){
 return cases.length?<section aria-label="התראות אימות תשלום"><h2>התראות אימות תשלום</h2><p>סגירת התראה מתעדת טיפול בלבד; היא אינה מאשרת תשלום או מסירת ספר.</p>
  <ul>{cases.map(item=><li key={item.caseId}>{item.createdAt} · {item.code} <button disabled={disabled} onClick={()=>dismiss(item)}>סגירת ההתראה עם הסיבה שנכתבה</button></li>)}</ul></section>:null;
}
type BookReview = { kind?: 'book'; paymentCases?:PaymentCase[]; bookSha256: string; previousDecisionSha256: string | null; policySha256: string;
  policy: { mode: 'required' | 'off' }; readiness: string; holdReason: string | null; previewUrl: string; pdfUrl: string;
  history: { actorId: string; decidedAt: string; decision: string; bookSha256: string; reason: string }[] };
type InfrastructureReview={kind:'infrastructure';paymentCases?:PaymentCase[];holdSha256:string;canResume:boolean;resumeBlockedReason?:string|null;holdReason:string;code:string;caseId:string|null;
  actions:{result:{value:{actorId:string;decidedAt:string;action:string;reason:string}}}[]};
type PaymentProofReview={kind:'payment_proof';orderId:string;cases:PaymentCase[]};
type Review=BookReview|InfrastructureReview|PaymentProofReview;
export function PersonalBookReview({ orderId }: { orderId: string }) {
  const [data, setData] = useState<Review | null>(null), [reason, setReason] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  async function dismiss(item:PaymentCase){if(!reason.trim()||busy)return;setBusy(true);setMessage('');try{
   const res=await fetch(`/api/engine-site/v1/review/${encodeURIComponent(orderId)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'dismiss_payment_notice',caseId:item.caseId,expectedNoticeSha256:item.noticeSha256,idempotencyKey:crypto.randomUUID(),reason})});
   if(!res.ok)throw Error('changed');setMessage('סגירת ההתראה תועדה. מצב התשלום והספר לא השתנה.');
   const fresh=await fetch(`/api/engine-site/v1/review/${encodeURIComponent(orderId)}`,{cache:'no-store'});setData(fresh.ok?await fresh.json():null);
  }catch{setMessage('אי אפשר לאשר את תוצאת סגירת ההתראה. יש לרענן ולקרוא את המצב השמור.');}finally{setBusy(false);}}
  const notices=<PaymentNoticeList cases={data?.kind==='payment_proof'?data.cases:data?.paymentCases??[]} dismiss={dismiss} disabled={busy||!reason.trim()}/>;
  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/engine-site/v1/review/${encodeURIComponent(orderId)}`, { cache: 'no-store', signal: abort.signal })
      .then(async r => { if (!r.ok) throw Error('denied'); setData(await r.json()); }).catch(() => { if (!abort.signal.aborted) setMessage('אין גישה לבדיקה, או שהספר טרם מוכן.'); });
    return () => abort.abort();
  }, [orderId]);
  async function act(decision: 'approve' | 'reject' | 'off' | 'required' | 'resume' | 'fail') {
    if (!data || data.kind==='payment_proof' || !reason.trim() || busy) return; setBusy(true); setMessage('');
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
  if(data?.kind==='payment_proof')return <main dir="rtl" style={{maxWidth:850,margin:'3rem auto',padding:24}}>
    <h1>אימות התשלום דורש בדיקה</h1><p>הספק או ההודעה החתומה לא עברו את בדיקת ההתאמה להזמנה. אין כאן אישור תשלום או הרשאה ליצירת ספר.</p>
    <p>יש לבדוק את הגדרות ערוץ התשלום ואת הרשומה המאומתת של הספק. הוכחה תקינה במסלול הרגיל תסגור התראות על ניסיון התשלום; התראה על חיוב נוסף דורשת טיפול מתועד נפרד.</p>
    <label>סיבה מתועדת לסגירת ההתראה <input value={reason} onChange={event=>setReason(event.target.value)}/></label>{notices}<p role="status">{message}</p><a href="/personal/review">חזרה לתור המפעיל</a>
  </main>;
  if(data?.kind==='infrastructure')return <main dir="rtl" style={{maxWidth:850,margin:'3rem auto',padding:24}}>
    <h1>הזמנה שממתינה לטיפול בתקלת תשתית</h1>{notices}<p role="status">{message}</p><p>הספר נשמר ללא מסירה. סיבת העצירה: {data.code}</p>
    <p>{data.canResume?'אפשר להמשיך לאחר שהתשתית חזרה לפעול.':data.resumeBlockedReason==='engine_operator_absolute_deadline'?
      'עבר גבול 24 השעות מתחילת העבודה. אי אפשר לחדש את ההרצה; ניתן לבחור עצירה במסלול המתועד.':
      'המשך חסום: יש קריאה שלא הוסדרה, סמכות שאינה תואמת או פעולה שאינה בטוחה לחידוש.'}</p>
    <label>סיבת הפעולה <textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={500} rows={3}/></label>
    <p><button disabled={busy||!reason.trim()||!data.canResume} onClick={()=>void act('resume')}>המשך במסלול הרגיל</button>{' '}
      <button disabled={busy||!reason.trim()} onClick={()=>void act('fail')}>עצירה והעברה להחזר</button></p>
    <h2>פעולות מתועדות</h2><ol>{data.actions.map((r,n)=><li key={n}>{r.result.value.action} · {r.result.value.actorId} · {r.result.value.decidedAt} · {r.result.value.reason}</li>)}</ol>
  </main>;
  return <main dir="rtl" style={{ maxWidth: 850, margin: '3rem auto', padding: 24 }}><h1>בדיקת ספר לפני מסירה</h1>
    <p role="status">{message}</p>{notices}{data && <>
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
