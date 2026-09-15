import { notFound } from 'next/navigation';
import ReaderV2 from '@/app/book/[id]/read-v2/reader-v2';
import shellStyles from '@/app/book/[id]/read-v2/read-v2-shell.module.css';
import { loadLocalBookReview } from '@/lib/local-book-review';
import '../../landing/main.css';

export const dynamic = 'force-dynamic';

export default async function LocalBookReviewPage() {
  const review = await loadLocalBookReview().catch(() => null);
  if (!review) notFound();
  const accepted = review.owner?.pages.map(page => page.pageNumber).join(', ');
  const unscored = review.automated.filter(page => page.score === null).map(page => page.pageNumber).join(', ');
  const narratedPages = review.payload.book?.pages.filter(page => page.audioUrl).length ?? 0;
  return (
    <div className={shellStyles.shell} data-reader-authority="local-book-review/v1">
      <div className={shellStyles.headerSlot} style={{ padding: '8px 16px', textAlign: 'center', background: '#fff8e8', fontSize: 14 }}>
        טיוטה מקומית לבדיקה — לא ספר ששוחרר ללקוח.
        {' '}{narratedPages ? `קריינות לבדיקה זמינה ב־${narratedPages} עמודים.` : 'ללא קריינות.'}
        {' '}בעמודים ארוכים אפשר לגלול בתוך הטקסט.
        {accepted && <> אישור חזותי של גיא לעמודים: {accepted}; תוצאות השופט המקוריות נשמרו.</>}
        {unscored && <> בדיקה מספרית טרם הושלמה לעמודים: {unscored}.</>}
      </div>
      <ReaderV2 source={{ kind: 'qa_fixture', payload: review.payload, exitHref: '/dev/local-book', exitLabel: 'חזרה לכריכה' }} />
    </div>
  );
}
