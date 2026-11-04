import { notFound } from 'next/navigation';
import ReaderV2 from '@/app/book/[id]/read-v2/reader-v2';
import { engineReaderEnabled } from '@/lib/engine-site/reader';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'הספר האישי | גיבורים קטנים', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default async function PersonalBookPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ preview?: string }> }) {
  if (!engineReaderEnabled()) notFound();
  return <ReaderV2 source={{ kind: 'engine_order', bookId: (await params).orderId, preview: (await searchParams).preview === '1' }} />;
}
