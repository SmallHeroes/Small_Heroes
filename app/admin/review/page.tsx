import type { Metadata } from 'next';
import ReviewListClient from './ReviewListClient';
import '../../landing/main.css';

export const metadata: Metadata = {
  title: 'ביקורת Human QA | גיבורים קטנים',
  robots: { index: false, follow: false },
};

export default function AdminReviewListPage() {
  return <ReviewListClient />;
}
