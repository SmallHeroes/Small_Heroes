import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { canUseFakePayments } from '@/lib/env';
import FakePaymentActions from './FakePaymentActions';

export const metadata: Metadata = {
  title: 'Fake Payment (Dev Only)',
  robots: {
    index: false,
    follow: false,
  },
};
export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<{ orderId?: string; paymentId?: string }>;
};

export default async function FakePaymentPage({ searchParams }: PageProps) {
  if (!canUseFakePayments()) {
    notFound();
  }

  const params = await searchParams;
  const orderId = typeof params.orderId === 'string' ? params.orderId : '';
  const paymentId = typeof params.paymentId === 'string' ? params.paymentId : '';
  if (!orderId || !paymentId) {
    return <main style={{ padding: 24 }}>Missing orderId or paymentId.</main>;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      paymentId: true,
      paymentProvider: true,
      totalPrice: true,
      childName: true,
    },
  });

  if (!order) return <main style={{ padding: 24 }}>Order not found.</main>;

  const amount = (order.totalPrice / 100).toFixed(2);
  const isSessionValid =
    order.paymentProvider === 'fake' &&
    order.paymentId === paymentId &&
    ['pending_payment', 'draft'].includes(order.status);

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 640 }}>
      <h1 style={{ marginTop: 0 }}>Fake payment mode - dev only</h1>
      <p style={{ background: '#fff3cd', padding: 10, border: '1px solid #ffe69c' }}>
        Warning: this page is for local/staging testing only. Never enable fake payments in production.
      </p>

      <p><strong>orderId:</strong> {order.id}</p>
      <p><strong>paymentId:</strong> {paymentId}</p>
      <p><strong>status:</strong> {order.status}</p>
      <p><strong>amount:</strong> ₪{amount}</p>
      <p><strong>child:</strong> {order.childName}</p>

      {!isSessionValid ? (
        <p style={{ color: '#b91c1c' }}>
          This fake payment session is not valid for confirmation. Check order status and payment id.
        </p>
      ) : (
        <FakePaymentActions orderId={order.id} paymentId={paymentId} />
      )}
    </main>
  );
}

