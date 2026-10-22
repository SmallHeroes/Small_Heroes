/** Prospective, opt-in lifecycle of ONE Responses background job. Never an authorization to generate or retry. */
import path from 'node:path';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { z } from 'zod';
import { canonicalJson } from '../lib/personal-wizard/request-acceptance';
import { previewSha } from '../lib/local-story-preview';
import { exclusiveJson, fencedText, realDirectory } from './personal-causal-trial-journal';

export const DURABLE_REVIEW_VERSION = 'durable-review-job/v1' as const;
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const bindingSchema = z.object({ version: z.literal(DURABLE_REVIEW_VERSION), wireDigest: hash, claimSha256: hash, bodySha256: hash, semanticRequestSha256: hash,
  model: z.string().regex(/^[a-z0-9._-]{1,100}$/), retention: z.literal('background-store-false-temporary') }).strict();
export type DurableReviewBinding = z.infer<typeof bindingSchema>;
type ResponseJob = { id: string; model: string; status?: string; metadata?: Record<string, string> | null };
type ValidatedJob = ResponseJob & { status: string };
const idSchema = z.string().regex(/^resp_[A-Za-z0-9_-]{1,200}$/);
const terminalSchema = z.object({ raw: z.unknown(), bindingSha256: hash }).strict();
const statuses = ['queued', 'in_progress', 'completed', 'failed', 'cancelled', 'incomplete'];
const ongoing = (s: string) => s === 'queued' || s === 'in_progress';
const fail = (code: string): never => { throw Object.assign(new Error(code), { code }); };

/**
 * An additive fsynced journal beside, not inside, the meter. Its immutable binding names the exact claimed request. An entered submission
 * without an ID is deliberately NOT retried: it could have reached the provider. `submitted.json` records the ID as soon as create returns;
 * `terminal.json` records raw output/usage BEFORE application parsing or meter settlement. Existing entries are verified, never replaced.
 * store=false jobs are retrievable only during the provider's temporary retention window; an ID is not a permanent availability guarantee.
 */
export class DurableReviewJournal {
  readonly binding: DurableReviewBinding;
  constructor(readonly directory: string, binding: DurableReviewBinding) {
    this.binding = bindingSchema.parse(binding);
    if (!existsSync(directory)) mkdirSync(directory);
    realDirectory(directory);
    const file = this.at('binding');
    if (!existsSync(file)) exclusiveJson(file, this.binding);
    if (canonicalJson(this.read('binding')) !== canonicalJson(this.binding)) fail('durable_review_binding');
    if (readdirSync(directory).some(n => !['binding.json', 'submission-entered.json', 'submitted.json', 'terminal.json', 'terminal-recovered.json'].includes(n)))
      fail('durable_review_journal');
    if (existsSync(this.at('submitted')) && !existsSync(this.at('submission-entered')) ||
        (existsSync(this.at('terminal')) || existsSync(this.at('terminal-recovered'))) && !existsSync(this.at('submitted')) ||
        existsSync(this.at('terminal-recovered')) && !existsSync(this.at('terminal'))) fail('durable_review_journal');
  }
  private at(name: string) { return path.join(this.directory, `${name}.json`); }
  private read(name: string) { return JSON.parse(fencedText(this.at(name), 4_000_000)); }
  private validate(raw: unknown, id?: string): ValidatedJob {
    if (!raw || typeof raw !== 'object') return fail('durable_review_response');
    const job = raw as ResponseJob;
    if (!idSchema.safeParse(job.id).success || id !== undefined && job.id !== id || job.model !== this.binding.model ||
        !statuses.includes(job.status ?? '') || job.metadata?.semantic_request_sha256 !== this.binding.semanticRequestSha256) fail('durable_review_response');
    return job as ValidatedJob;
  }
  /** Call immediately before the ONE create. If already entered with no ID, the original result is UNKNOWN, not permission to re-POST. */
  enterSubmission() {
    if (existsSync(this.at('submission-entered'))) fail('durable_review_submission_unknown');
    exclusiveJson(this.at('submission-entered'), { bindingSha256: previewSha(canonicalJson(this.binding)) });
  }
  submitted(raw: unknown) {
    const job = this.validate(raw);
    if (!existsSync(this.at('submission-entered'))) fail('durable_review_journal');
    exclusiveJson(this.at('submitted'), { id: job.id, bindingSha256: previewSha(canonicalJson(this.binding)) });
    if (!ongoing(job.status)) this.terminal(job);
    return job;
  }
  terminal(raw: unknown) {
    const prior = this.saved();
    if (!prior.id) fail('durable_review_journal');
    if (prior.terminal) fail('durable_review_terminal_exists');
    const job = this.validate(raw, prior.id!);
    if (ongoing(job.status)) fail('durable_review_not_terminal');
    // If a crash truncated the first terminal write, retrieve the SAME ID again and add one bounded recovery record. Keep damaged bytes.
    exclusiveJson(this.at(existsSync(this.at('terminal')) ? 'terminal-recovered' : 'terminal'),
      { raw: job, bindingSha256: previewSha(canonicalJson(this.binding)) });
    return job;
  }
  saved(): { id: string | null; terminal: ValidatedJob | null; entered: boolean } {
    const digest = previewSha(canonicalJson(this.binding)), entered = existsSync(this.at('submission-entered'));
    if (entered && this.read('submission-entered')?.bindingSha256 !== digest) fail('durable_review_binding');
    const record = existsSync(this.at('submitted')) ? this.read('submitted') : null;
    if (record && (!entered || record.bindingSha256 !== digest || !idSchema.safeParse(record.id).success)) fail('durable_review_binding');
    let terminal: any = null;
    if (existsSync(this.at('terminal'))) {
      try { terminal = terminalSchema.parse(this.read('terminal')); }
      catch (e) { if (!(e instanceof SyntaxError)) throw e; /* truncated raw is not a verdict; ID may still be retrieved */ }
    }
    if (existsSync(this.at('terminal-recovered'))) {
      const recovered = terminalSchema.parse(this.read('terminal-recovered'));
      if (terminal && canonicalJson(terminal) !== canonicalJson(recovered)) fail('durable_review_binding');
      terminal = recovered;
    }
    if (terminal && (!record || terminal.bindingSha256 !== digest)) fail('durable_review_binding');
    const raw = terminal ? this.validate(terminal.raw, record.id) : null;
    if (raw && ongoing(raw.status)) fail('durable_review_not_terminal');
    return { id: record?.id ?? null, terminal: raw, entered };
  }
  /** Retrieved status is validated even if still queued: no response from another model/request can later acquire this journal. */
  observed(raw: unknown) {
    const id = this.saved().id;
    if (!id) fail('durable_review_journal');
    const job = this.validate(raw, id!);
    if (!ongoing(job.status)) return this.terminal(job);
    return job;
  }
}

/**
 * The transport loop of ONE job. `resume` performs retrieval only, never create; missing/expired/malformed/aborted replies propagate, leave
 * the job unresolved and never become a zero-cost failed verdict. A terminal saved before a crash needs no network call at all. This does
 * not settle the meter: its normal adapter still validates raw/model/usage/schema and accounts for the original ONE generation claim.
 */
export async function durableReviewJob<T extends ResponseJob>(a: { journal: DurableReviewJournal; resume?: true; signal: AbortSignal;
  deadlineMs: number; pollMs?: number; create: (options: { signal: AbortSignal; timeoutMs: number }) => Promise<T>;
  retrieve: (id: string, options: { signal: AbortSignal; timeoutMs: number }) => Promise<T>;
  /** Local crash tests inject a failure after the fsynced ID, not an alternate provider path. */
  afterIdCheckpoint?: () => void }) {
  const pollMs = a.pollMs ?? 1500;
  if (!Number.isSafeInteger(a.deadlineMs) || a.deadlineMs < 1 || a.deadlineMs > 600_000 ||
      !Number.isSafeInteger(pollMs) || pollMs < 1 || pollMs > 5000) fail('durable_review_policy');
  const check = () => { if (a.signal.aborted) fail('durable_review_aborted'); if (Date.now() >= end) fail('durable_review_deadline'); };
  const end = Date.now() + a.deadlineMs, saved = a.journal.saved();
  const signal = AbortSignal.any([a.signal, AbortSignal.timeout(a.deadlineMs)]);
  const options = () => ({ signal, timeoutMs: Math.max(1, end - Date.now()) });
  check();
  if (a.resume && saved.terminal) return saved.terminal as T;
  if (!a.resume && (saved.entered || saved.id)) fail('durable_review_submission_unknown');
  if (a.resume && !saved.id) fail('durable_review_submission_unknown');
  let id = saved.id;
  if (!a.resume) {
    a.journal.enterSubmission(); check();
    const job = a.journal.submitted(await a.create(options())); id = job.id;
    a.afterIdCheckpoint?.();
    if (!ongoing(job.status)) return job as T;
  }
  while (true) {
    check();
    const job = a.journal.observed(await a.retrieve(id!, options()));
    if (!ongoing(job.status)) return job as T;
    check();
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort);
        reject(Object.assign(new Error('durable_review_aborted'), { code: 'durable_review_aborted' })); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, Math.min(pollMs, Math.max(1, end - Date.now())));
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
  }
}
