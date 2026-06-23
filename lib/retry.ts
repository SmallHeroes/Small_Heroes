/**
 * Generic async retry with exponential backoff, jitter, and an optional per-attempt
 * timeout. Used to harden transient network failures against external services
 * (Supabase storage uploads, image CDN fetches) so a single blip does not discard a
 * long-running render.
 *
 * The wrapped fn receives an `AbortSignal` that fires when a per-attempt `timeoutMs`
 * elapses; fetch-based callers should forward it so the in-flight request is actually
 * cancelled. For callers that cannot accept a signal (e.g. the supabase-js storage
 * client), the attempt still rejects on timeout via Promise.race and is retried —
 * uploads use `upsert: true`, so a retried attempt is idempotent.
 */

export interface WithRetryOptions {
  /** Total attempts including the first (default 3). */
  attempts?: number;
  /** Backoff for the wait AFTER the first failure (default 300ms). */
  baseDelayMs?: number;
  /** Backoff multiplier per attempt (default 3 → 300, 900, 2700, …). */
  factor?: number;
  /** Cap on a single backoff wait (default 8000ms). */
  maxDelayMs?: number;
  /** Per-attempt timeout; when set, the fn's AbortSignal fires and the attempt rejects. */
  timeoutMs?: number;
  /** Short label for log lines, e.g. "fetchImageBuffer" or "supabase-upload". */
  label?: string;
  /** Return false to stop retrying a given error (e.g. a 4xx). Default: retry all. */
  shouldRetry?: (error: unknown) => boolean;
}

export class TimeoutError extends Error {
  constructor(ms: number, label?: string) {
    super(`${label ? `${label}: ` : ''}operation timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

function backoffDelay(attempt: number, opts: Required<Pick<WithRetryOptions, 'baseDelayMs' | 'factor' | 'maxDelayMs'>>): number {
  const raw = opts.baseDelayMs * Math.pow(opts.factor, attempt - 1);
  const capped = Math.min(opts.maxDelayMs, raw);
  // ±20% jitter to avoid synchronized retry storms across concurrent renders.
  const jitter = capped * 0.2 * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(capped + jitter));
}

/** Run `fn` with retry + exponential backoff + optional per-attempt timeout. */
export async function withRetry<T>(
  fn: (signal: AbortSignal | undefined) => Promise<T>,
  options: WithRetryOptions = {}
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const baseDelayMs = options.baseDelayMs ?? 300;
  const factor = options.factor ?? 3;
  const maxDelayMs = options.maxDelayMs ?? 8000;
  const { timeoutMs, label, shouldRetry } = options;

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let controller: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (timeoutMs && timeoutMs > 0) {
        controller = new AbortController();
        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller?.abort();
            reject(new TimeoutError(timeoutMs, label));
          }, timeoutMs);
        });
        return await Promise.race([fn(controller.signal), timeoutPromise]);
      }
      return await fn(undefined);
    } catch (err) {
      lastError = err;
      const retryable = shouldRetry ? shouldRetry(err) : true;
      if (!retryable || attempt === attempts) break;
      const delayMs = backoffDelay(attempt, { baseDelayMs, factor, maxDelayMs });
      console.warn(
        `[withRetry${label ? `:${label}` : ''}] attempt ${attempt}/${attempts} failed ` +
          `(${(err as Error)?.message ?? 'unknown'}); retrying in ${delayMs}ms`
      );
      await new Promise((r) => setTimeout(r, delayMs));
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  throw lastError;
}
