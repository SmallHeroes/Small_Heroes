/**
 * Fire-and-forget worker kick — MUST NOT await the next worker finishing.
 * Correctness is DB state + sweeper/resume, not this request.
 */
export function chainGenerationWorker(orderId: string): void {
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '').replace(/\/$/, '');
  if (!base) {
    console.warn('[chunked-gen] chain skipped — no APP URL');
    return;
  }

  const secret = process.env.GENERATION_SECRET?.trim();
  if (!secret) {
    console.warn('[chunked-gen] chain skipped — GENERATION_SECRET missing');
    return;
  }

  const url = `${base}/api/generate/worker`;
  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, secret }),
    keepalive: true,
  })
    .then((res) => {
      if (!res.ok) {
        console.warn('[chunked-gen] chain worker non-OK', orderId, res.status);
      }
    })
    .catch((err) => {
      console.warn('[chunked-gen] chain worker failed (non-fatal)', orderId, err);
    });
}
