/** DB lease duration — worker must finish or release before this expires. */
export const GENERATION_LEASE_MS = 4 * 60 * 1000;

/** Stop chunk work before Vercel 300s hard limit (env override for tests). */
export function getWorkerBudgetMs(): number {
  const raw = process.env.GENERATION_WORKER_BUDGET_MS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 5_000) return n;
  }
  return 230_000;
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
