# Hotfix — Allow failed orders to re-trigger generation

## Problem
Order `cmoies2v600024wso5m5gkgcw` failed mid-generation (OpenAI 502 at Prose-3C). The order status is now `failed`. The `/api/generate` endpoint only accepts orders with status `paid`, so the order is stuck — cannot retry.

The user sees "something went wrong" with only a "back to home" button. No retry option. This is unacceptable for a paying user.

## Tasks

### T1 — Allow `failed` orders to re-trigger generation

In `app/api/generate/route.ts`:

**API route handler** (the POST function, around line 1042):
Change the eligibility check from:
```typescript
if (order.status !== GENERATION_ELIGIBLE_STATUS) {
  return Response.json({ error: 'Order is not eligible for generation' }, { status: 409 });
}
```
To:
```typescript
const RETRYABLE_STATUSES = [GENERATION_ELIGIBLE_STATUS, 'failed'];
if (!RETRYABLE_STATUSES.includes(order.status)) {
  return Response.json({ error: 'Order is not eligible for generation' }, { status: 409 });
}
```

**triggerGeneration function** (around line 270):
Same change — allow `failed` orders through:
```typescript
const RETRYABLE_STATUSES = [GENERATION_ELIGIBLE_STATUS, 'failed'];
if (!RETRYABLE_STATUSES.includes(order.status)) {
```

**Claim update** (around line 299):
```typescript
const claimedOrder = await prisma.order.updateMany({
  where: { id: orderId, status: { in: [GENERATION_ELIGIBLE_STATUS, 'failed'] } },
  data: { status: 'generating' },
});
```

Also reset the generationJob status so the DB lock allows re-entry:
After the `claimedOrder` check, add:
```typescript
// Reset job status for retry
await prisma.generationJob.updateMany({
  where: { orderId, status: 'failed' },
  data: { status: 'running', startedAt: new Date(), attempts: { increment: 1 }, lastError: null, failedAt: null },
});
```

### T2 — Add "Try Again" button on the error/ready page

Find the page that shows the "משהו השתבש בדרך" error (likely in `app/book/[id]/` or `app/generating/` or similar — search for "משהו השתבש" or "חזרה לדף הבית").

Add a "Try Again" button that calls:
```typescript
async function retryGeneration(orderId: string) {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, secret: process.env.NEXT_PUBLIC_GENERATION_SECRET, reason: 'user_retry' }),
  });
  if (res.ok) {
    // Redirect to the generating/waiting page
    window.location.href = `/generating?orderId=${orderId}`;
  }
}
```

**Important:** The secret is server-side only (`GENERATION_SECRET`). For the client-side retry button, either:
- Option A: Create a new endpoint `/api/generate/retry` that doesn't need the secret but validates the order belongs to the current session/user
- Option B: Use a `NEXT_PUBLIC_GENERATION_SECRET` env var (less secure but OK for now since there's no real auth system yet)

Pick Option A if quick, otherwise Option B.

The button text should be: **"לנסות שוב"** (Try again)
Keep the existing "חזרה לדף הבית" as a secondary/link option below it.

### T3 — Add retry logic to `callLLM` in pipeline.ts

In `backend/providers/pipeline.ts`, the `callLLM` function (around line 506):

Add retry logic for transient errors:
```typescript
async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  temperature: number,
  stage: string,
  jsonMode: boolean = true,
): Promise<LLMResult> {
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [2000, 4000, 8000]; // exponential backoff
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callLLMOnce(systemPrompt, userPrompt, maxTokens, temperature, stage, jsonMode);
    } catch (error) {
      const isRetryable = isTransientError(error);
      if (!isRetryable || attempt === MAX_RETRIES) {
        throw error;
      }
      const delay = RETRY_DELAYS[attempt] ?? 8000;
      console.warn(
        `[Pipeline][${stage}] Transient error (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${delay}ms: ${error instanceof Error ? error.message.slice(0, 100) : String(error)}`
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error(`[Pipeline][${stage}] Should not reach here`);
}

function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  // OpenAI 5xx errors (502, 503, 500)
  if (/\b50[023]\b/.test(msg)) return true;
  // Rate limit
  if (/\b429\b/.test(msg)) return true;
  // Network errors
  if (/ECONNRESET|ETIMEDOUT|ENOTFOUND|fetch failed/i.test(msg)) return true;
  return false;
}
```

Rename the current `callLLM` implementation to `callLLMOnce` (keep all its existing logic intact, just rename).

## Safety
- Only `failed` and `paid` statuses can trigger generation — no risk of re-running `ready` orders
- Retry logic only retries transient errors (5xx, 429, network) — not auth/validation errors
- `npm run build` must pass

## Acceptance criteria
- `npm run build` passes
- A failed order can be re-triggered via the API (test with the existing failed order)
- The error page shows a "Try Again" button
- `callLLM` retries up to 3 times on 502 errors with backoff (visible in logs)

## Verification
1. Reset order `cmoies2v600024wso5m5gkgcw` to `failed` status if needed
2. Trigger retry via the new button or API
3. Confirm generation runs end-to-end
4. Check logs for `[prompt_compact]` and `[scene_translate]` to verify 3e.1+3e.2 are working

## Return format
- **GO / NO-GO**
- **Files changed**
- **How retry button works** (which endpoint, how does it validate)
- **callLLM retry logs** — paste sample showing retry behavior
- **Full generation result** — did the retried order complete? Paste `[prompt_compact]` and `[scene_translate]` logs for all pages
- **Risks / open questions**

## Git commit (after GO)
```
phase 3e.2-hotfix: retry failed orders + callLLM resilience

T1: failed orders can re-trigger generation (was blocked at 'paid' only)
T2: "Try Again" button on error page replaces dead-end
T3: callLLM retries up to 3x on transient errors (502/503/429) with exponential backoff
```

Stage:
```powershell
git add app/api/generate/route.ts backend/providers/pipeline.ts
git diff --cached --stat
```
(Add any additional files for the retry button UI)
