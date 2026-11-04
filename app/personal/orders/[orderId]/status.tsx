'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ROUTES } from '@/lib/routes';
type Status = { status: string; readerUrl: string | null; pdfUrl: string | null; bookSha256?: string };
export function PersonalOrderStatus({ orderId, preview }: { orderId: string; preview: boolean }) {
  const [value, setValue] = useState<Status | null>(null), [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/engine-site/v1/orders/${encodeURIComponent(orderId)}${preview ? '?preview=1' : ''}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw Error('unavailable');
        const data = await response.json() as Status; setValue(data); setError(false);
        if (data.status === 'preparing' && !controller.signal.aborted) timer = setTimeout(refresh, 10_000);
      } catch { if (!controller.signal.aborted) setError(true); }
    };
    void refresh(); return () => { controller.abort(); if (timer) clearTimeout(timer); };
  }, [orderId, preview]);
  return <main dir="rtl" style={{ maxWidth: 680, margin: '4rem auto', padding: 24 }}>
    <h1>{value?.status === 'ready' ? 'הספר שלכם מוכן' : 'הספר האישי שלכם'}</h1>
    {error ? <p>כדי לראות את ההזמנה, <a href={`${ROUTES.login}?returnTo=${encodeURIComponent(`/personal/orders/${orderId}`)}`}>היכנסו עם כתובת האימייל ששימשה להזמנה</a>. אם כבר נכנסתם, רעננו את העמוד.</p>
      : value?.status === 'ready' ? <p><Link href={value.readerUrl!}>לקריאה ולהאזנה</Link>{' · '}<a id="pdf" href={value.pdfUrl!}>להורדת הספר ב־PDF</a></p>
        : ['refunded', 'cancelled', 'failed'].includes(value?.status ?? '') ? <p>לא הצלחנו להשלים את הספר. פרטי הטיפול וההחזר יישלחו באימייל.</p>
          : <p role="status">אנחנו מכינים את הסיפור והאיורים שלכם. כשהספר יהיה מוכן, נשלח לכם קישור באימייל. אפשר לחזור לכאן בהמשך.</p>}
    {preview && value?.bookSha256 && <p>תצוגת מפעיל · גרסת הספר: <code>{value.bookSha256}</code></p>}
  </main>;
}
