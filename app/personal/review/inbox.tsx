'use client';
import {useEffect,useState} from 'react';
type Notice={caseId:string;orderId:string;code:string;domain:string;createdAt:string};
export function OperatorCaseList({cases}:{cases:Notice[]}) {
  return cases.length?<ul>{cases.map(item=><li key={item.caseId}>
    <a href={`/personal/review/${encodeURIComponent(item.orderId)}`}>פתיחת ההזמנה</a> · {item.createdAt} · {item.domain} · {item.code}
  </li>)}</ul>:<p>אין התראות פתוחות.</p>;
}
export function OperatorInbox(){
 const [cases,setCases]=useState<Notice[]|null>(null),[error,setError]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{const abort=new AbortController();setError(false);
  fetch('/api/engine-site/v1/review',{cache:'no-store',signal:abort.signal}).then(async response=>{
   if(!response.ok)throw Error('denied');return response.json();
  }).then(data=>{if(!abort.signal.aborted)setCases(data.cases);}).catch(()=>{if(!abort.signal.aborted)setError(true);});
  return ()=>abort.abort();
 },[revision]);
 return <main dir="rtl" style={{maxWidth:900,margin:'3rem auto',padding:24}}><h1>התראות לטיפול המפעיל</h1>
  <p>תקלות תשתית ואימות תשלום ממתינים לבדיקה. הרשימה אינה מאשרת מסירה, חיוב או החזר.</p>
  <button onClick={()=>setRevision(value=>value+1)}>רענון הרשימה</button>
  {error?<p role="alert">אין גישה לרשימה או שאי אפשר לטעון אותה כרגע.</p>:cases===null?<p role="status">טוען התראות…</p>:<OperatorCaseList cases={cases}/>}
 </main>;
}
