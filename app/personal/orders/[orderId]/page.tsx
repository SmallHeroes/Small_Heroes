import { notFound } from 'next/navigation';
import { engineReaderEnabled } from '@/lib/engine-site/reader';
import { PersonalOrderStatus } from './status';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'ההזמנה שלי | גיבורים קטנים', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default async function PersonalOrderPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ preview?: string }> }) {
  if (!engineReaderEnabled()) notFound();
  return <PersonalOrderStatus orderId={(await params).orderId} preview={(await searchParams).preview === '1'} />;
}
