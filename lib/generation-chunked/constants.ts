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
 * Time one Stage-0 anchor attempt needs to complete generate + persist + QA. The anchor loop will
 * not START a new attempt unless at least this much of the worker budget remains, so a single
 * attempt's GPT + Supabase I/O always fits inside one invocation rather than being killed mid-persist
 * (which loses the buffer and re-GPTs on the next worker). Env-overridable for tests/calibration.
 */
export function getAnchorAttemptBudgetMs(): number {
  const raw = process.env.ANCHOR_ATTEMPT_BUDGET_MS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 5_000) return n;
  }
  return 150_000;
}

/** Max new page images per worker invocation (worst-case ~120s each). */
export const PAGE_IMAGES_PER_CHUNK = 2;

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
