import 'server-only';

/**
 * Per-process spend and idempotency ledger for live intake.
 *
 * - A job reserves its conservative upper-bound cost BEFORE any provider call; reservations are
 *   never refunded (a failed or cheaper call still counts), so the configured budget is a ceiling.
 * - A (user, job id) pair runs at most once: a repeat is refused, never re-processed or re-billed,
 *   and one user's job record is never visible to another user.
 * - One job in flight per user.
 *
 * Scope, stated honestly: this is process memory (like the existing rate limiter). It is exact for
 * a single local server; on a multi-instance deployment each instance has its own ledger. Durable
 * cross-instance idempotency and spend control are required before any public enablement.
 */
export type IntakeLedgerLimits = { budgetUsd: number; maxJobs: number };

export type LedgerRefusal = 'duplicate_job' | 'user_busy' | 'job_limit' | 'budget_exhausted';

type JobRecord = { userId: string; status: 'in_flight' | 'done' | 'failed'; reservedUsd: number };

export class IntakeLedger {
  private readonly jobs = new Map<string, JobRecord>();
  private reservedTotalUsd = 0;

  begin(userId: string, jobId: string, reservedUsd: number, limits: IntakeLedgerLimits): { ok: true } | { ok: false; code: LedgerRefusal } {
    const key = `${userId}\u0000${jobId}`;
    if (this.jobs.has(key)) return { ok: false, code: 'duplicate_job' };
    for (const job of this.jobs.values()) {
      if (job.userId === userId && job.status === 'in_flight') return { ok: false, code: 'user_busy' };
    }
    if (this.jobs.size >= limits.maxJobs) return { ok: false, code: 'job_limit' };
    if (!(reservedUsd >= 0) || this.reservedTotalUsd + reservedUsd > limits.budgetUsd + 1e-12) {
      return { ok: false, code: 'budget_exhausted' };
    }
    this.jobs.set(key, { userId, status: 'in_flight', reservedUsd });
    this.reservedTotalUsd += reservedUsd;
    return { ok: true };
  }

  finish(userId: string, jobId: string, status: 'done' | 'failed'): void {
    const job = this.jobs.get(`${userId}\u0000${jobId}`);
    if (job && job.status === 'in_flight') job.status = status;
  }

  snapshot(): { jobs: number; inFlight: number; reservedTotalUsd: number } {
    let inFlight = 0;
    for (const job of this.jobs.values()) if (job.status === 'in_flight') inFlight += 1;
    return { jobs: this.jobs.size, inFlight, reservedTotalUsd: this.reservedTotalUsd };
  }
}

const GLOBAL_KEY = '__smallHeroesPersonalIntakeLedger';

/** One ledger per server process (survives dev hot reloads, like the rate-limit store). */
export function getIntakeLedger(): IntakeLedger {
  const holder = globalThis as unknown as Record<string, IntakeLedger | undefined>;
  if (!holder[GLOBAL_KEY]) holder[GLOBAL_KEY] = new IntakeLedger();
  return holder[GLOBAL_KEY] as IntakeLedger;
}
