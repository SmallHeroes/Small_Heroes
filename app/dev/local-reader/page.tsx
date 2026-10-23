import { notFound } from 'next/navigation';
import ReaderV2 from '@/app/book/[id]/read-v2/reader-v2';
import shellStyles from '@/app/book/[id]/read-v2/read-v2-shell.module.css';
import { localReaderPayload } from '@/lib/local-reader-preview';
import { loadLocalReaderPreview } from '@/lib/local-reader-preview-store';
import '../../landing/main.css';

export default async function LocalNarratedReader({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const query = await searchParams;
  const id = typeof query.book === 'string' ? query.book : '';
  const preview = await loadLocalReaderPreview(id).catch(() => null);
  if (!preview) notFound();
  return <div className={shellStyles.shell} data-reader-authority="local-narrated-reader/v1" dir="rtl">
    <aside style={{ padding: '8px 16px', background: '#fff4cc', color: '#433b21', fontSize: 14, textAlign: 'center' }}>
      ספר ניסוי מקומי · קריינות {preview.voice.label} · בדיקות איכות האיורים טרם הושלמו · לא אישור מוצר או ייצור
    </aside>
    <ReaderV2 source={{ kind: 'qa_fixture', payload: localReaderPayload(preview),
      exitHref: `/dev/local-reader?book=${encodeURIComponent(preview.id)}`, exitLabel: 'חזרה לתחילת ספר הניסוי' }} />
  </div>;
}
