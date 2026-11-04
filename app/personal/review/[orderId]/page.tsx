import { notFound } from 'next/navigation';
import { engineFulfillmentEnabled } from '@/lib/engine-site/fulfillment';
import { PersonalBookReview } from './review';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'בדיקת ספר | גיבורים קטנים', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default async function PersonalReviewPage({ params }: { params: Promise<{ orderId: string }> }) {
  if (!engineFulfillmentEnabled()) notFound(); return <PersonalBookReview orderId={(await params).orderId} />;
}
