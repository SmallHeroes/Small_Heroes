'use client';

import { useState } from 'react';

type Props = {
  orderId: string;
  paymentId: string;
};

export default function FakePaymentActions({ orderId, paymentId }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm(result: 'success' | 'failed') {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/dev/fake-payment/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, paymentId, result }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.redirectUrl) {
        setError(typeof data?.error === 'string' ? data.error : 'Fake payment confirmation failed');
        setBusy(false);
        return;
      }
      window.location.href = data.redirectUrl;
    } catch {
      setError('Network error while confirming fake payment');
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" onClick={() => confirm('success')} disabled={busy} style={{ padding: 10 }}>
        Simulate successful payment
      </button>
      <button type="button" onClick={() => confirm('failed')} disabled={busy} style={{ padding: 10 }}>
        Simulate failed payment
      </button>
      {error ? <p style={{ color: '#b91c1c', margin: 0 }}>{error}</p> : null}
    </div>
  );
}

