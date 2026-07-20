import type { Metadata } from 'next';
import ReviewDetailClient from './ReviewDetailClient';
import '../../../landing/main.css';

type PageProps = {
  params: Promise<{ orderId: string }>;
};

export const metadata: Metadata = {
  title: 'פרטי ביקורת Human QA | גיבורים קטנים',
  robots: { index: false, follow: false },
};

export default async function AdminReviewDetailPage({ params }: PageProps) {
  const { orderId } = await params;
  return <ReviewDetailClient orderId={orderId} />;
}
