import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import FakePaymentActions from '@/app/dev/fake-payment/FakePaymentActions';
import { canUseFakePayments } from '@/lib/env';
import {
  RELEASE_V1_ORDER_AUTHORITY_SELECT,
  requireReleaseV1OrderPackage,
} from '@/lib/generation-pipeline/release-v1-continuity';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = {
  title: 'Release v1 QA Payment',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<{ orderId?: string; paymentId?: string }>;
};

export default async function ReleaseV1FakePaymentPage({
  searchParams,
}: PageProps) {
  if (!canUseFakePayments()) notFound();
  const params = await searchParams;
  const orderId = typeof params.orderId === 'string' ? params.orderId : '';
  const paymentId =
    typeof params.paymentId === 'string' ? params.paymentId : '';
  if (!orderId || !paymentId) {
    return <main style={{ padding: 24 }}>Missing orderId or paymentId.</main>;
  }
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      ...RELEASE_V1_ORDER_AUTHORITY_SELECT,
      status: true,
      paymentId: true,
      paymentProvider: true,
      totalPrice: true,
      childName: true,
    },
  });
  if (!order) notFound();
  try {
    requireReleaseV1OrderPackage(order);
  } catch {
    notFound();
  }
  const amount = (order.totalPrice / 100).toFixed(2);
  const isSessionValid =
    order.paymentProvider === 'fake' &&
    order.paymentId === paymentId &&
    ['pending_payment', 'draft'].includes(order.status);

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 640 }}>
      <h1 style={{ marginTop: 0 }}>Release v1 QA payment</h1>
      <p style={{ background: '#fff3cd', padding: 10, border: '1px solid #ffe69c' }}>
        QA only. The immutable Visual Package and Story Source were verified by this deployment.
      </p>
      <p><strong>orderId:</strong> {order.id}</p>
      <p><strong>paymentId:</strong> {paymentId}</p>
      <p><strong>status:</strong> {order.status}</p>
      <p><strong>amount:</strong> ₪{amount}</p>
      <p><strong>child:</strong> {order.childName}</p>
      {!isSessionValid ? (
        <p style={{ color: '#b91c1c' }}>
          This QA payment session is not valid for confirmation.
        </p>
      ) : (
        <FakePaymentActions
          orderId={order.id}
          paymentId={paymentId}
          confirmEndpoint="/api/release/v1/fake-payment/confirm"
        />
      )}
    </main>
  );
}
