/**
 * DB lease duration — must exceed the worker's hard kill (maxDuration=300s) with margin so a
 * worker that runs its full invocation NEVER has its lease expire mid-run (which would let a
 * sweeper double-claim and double-spend). The loop also heartbeats between stages; the lease
 * only expires when a worker is genuinely dead. 7min = 300s maxDuration + 120s margin.
 */
export const GENERATION_LEASE_MS = 7 * 60 * 1000;

/**
 * Anti-infinite-spend: max times the sweeper will reclaim a job that is NOT making progress
 * (same stage:completedCount fingerprint) before hard-failing it (retryable=false). A job that
 * advances resets the counter. Env-overridable for tests.
 */
export function getMaxStaleReclaims(): number {
  const raw = process.env.GENERATION_MAX_STALE_RECLAIMS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 8;
}

/** Stop chunk work before Vercel 300s hard limit (env override for tests). */
export function getWorkerBudgetMs(): number {
  const raw = process.env.GENERATION_WORKER_BUDGET_MS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 5_000) return n;
  }
  return 230_000;
}

/**
 * Max new page images per worker invocation. Env-configurable (`PAGE_IMAGES_PER_CHUNK`) with a safe
 * default of **1** for QA/staging/cloud — one durable page per invocation is the only size that
 * reliably fits the 300s worker on Vercel (a page is gpt-image + refs + upload + postprocess). Bump
 * to 2 only for local/LOW experiments. Clamped to [1, 4].
 */
export function getPageImagesPerChunk(): number {
  const raw = process.env.PAGE_IMAGES_PER_CHUNK?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 1) return Math.min(4, n);
  }
  return 1;
}

/**
 * Minimum worker budget that must remain before STARTING a page render. A page needs most of the
 * 300s envelope; if less than this is free, the chunk runner defers (stopChunk) and lets the
 * self-chain kick a FRESH worker with a full budget rather than start a paid render it cannot
 * finish (the page_images stall: a reclaimed render attempted inside a near-exhausted/60s runtime).
 */
export function getPageStartMinBudgetMs(): number {
  const raw = process.env.PAGE_START_MIN_BUDGET_MS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 5_000) return n;
  }
  return 200_000;
}

/**
 * Time reserved AFTER a page's gpt-image render for upload + presentation + DB persist, subtracted
 * from the remaining worker budget to derive the per-page soft timeout — so a render aborts by
 * soft-timeout (and the page is retried on a fresh worker) before the function is hard-killed.
 */
export function getPagePersistMarginMs(): number {
  const raw = process.env.PAGE_PERSIST_MARGIN_MS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 1_000) return n;
  }
  return 45_000;
}

/** Max narration pages per audio chunk. */
export const AUDIO_PAGES_PER_CHUNK = 3;

/** Bump when pipeline semantics change — part of artifact idempotency key. */
export const GENERATION_VERSION = 1;

export const CHUNK_STAGES = [
  'pending',
  'text',
  'dna',
  'cover',
  'page_images',
  'audio',
  'video',
  'package',
  'done',
  'failed',
] as const;

export type ChunkStage = (typeof CHUNK_STAGES)[number];

export const MAX_PAGE_GENERATION_ATTEMPTS = 3;
