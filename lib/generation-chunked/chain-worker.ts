/**
 * Best-effort accelerator — correctness does NOT depend on this succeeding.
 */
export async function chainGenerationWorker(orderId: string): Promise<void> {
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
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, secret }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.warn('[chunked-gen] chain worker non-OK', orderId, res.status);
    }
  } catch (err) {
    console.warn('[chunked-gen] chain worker failed (non-fatal)', orderId, err);
  }
}
