/**
 * Text-only diagnostic runner for the simple story engine. Import is inert; live spend needs --live.
 *
 * Failure policy. A book failure is contained when the engine rejects the text, or when the native
 * process provably exited with code 0 and reported a cost; the run then continues with the next case.
 * Any other transport failure (unconfirmed termination, a non-zero or unknown exit, an unknown cost, a
 * pre-dispatch contract error) is run-fatal: no further call is admitted, in-flight calls are aborted,
 * and the uncertainty is kept in the run summary. There are no automatic retries.
 *
 * Exit codes: 0 every case produced a book; 1 at least one contained book failure; 2 the run stopped
 * before finishing (uncertain transport, budget ceiling or cancellation); 3 arguments or setup.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { resolvePersonalWizardOptions, type PersonalWizardOptions } from '../lib/personal-wizard/options';
import { PERSONAL_CHARACTER_IDS, resolvePersonalCompanionCharacter } from '../lib/personal-wizard/companion-character';
import { prepareSimpleStory, simpleAuthorCall, writeSimpleStory, SimpleStoryError, SIMPLE_STORY_ENGINE_VERSION,
  type PreparedSimpleStory, type SimpleStoryCall } from '../lib/personal-wizard/simple-story-engine';
import type { CausalDispatch } from '../lib/personal-wizard/story-causal-experiment-runner';
import { CAUSAL_MODELS, CausalTransportError, createOpusCausalTransport, prepareCausalWire, wireReservation,
  type CausalWire, type TransportReply, type WirePolicy } from './personal-causal-trial-adapters';

const sha = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
/** List rates pinned by the 2026-10-06 premise admission (Opus 4/20, Astra 10/50 per M tokens); reservations, not invoices. Astra is never dispatched here. */
export const SIMPLE_RATES = { opus: { inputMicroUsdPerToken: 4, outputMicroUsdPerToken: 20 }, astra: { inputMicroUsdPerToken: 10, outputMicroUsdPerToken: 50 } };
const MAX_WIRE_BYTES = 104_000;
const capFor = (call: SimpleStoryCall) => wireReservation(MAX_WIRE_BYTES, call.maxOutputTokens, SIMPLE_RATES.opus);

/** Synthetic text-only roster of all fifteen literary identities. NOT wizard availability, card art or render admission. */
export function textCanonOptions(base: PersonalWizardOptions): PersonalWizardOptions {
  const companions = PERSONAL_CHARACTER_IDS.map(id => ({ id, name: resolvePersonalCompanionCharacter(id)!.name, image: '/text-only-trial-unused.png' }));
  return { ...base, companions, unavailableCompanionIds: [],
    fingerprint: sha(JSON.stringify({ schema: 'personal-text-canon-options/v1', base: base.fingerprint, companions })) };
}
const casesSchema = z.array(z.object({ id: z.string().regex(/^[a-z0-9][a-z0-9_-]{1,60}$/), seed: z.string().max(80), request: z.unknown() }).strict()).min(1).max(40);
export type TrialCase = z.infer<typeof casesSchema>[number];
export type TrialTransport = (wire: CausalWire, call: CausalDispatch, signal: AbortSignal) => Promise<TransportReply>;
export type TrialStatus = 'complete' | 'partial' | 'failed' | 'stopped';
export const TRIAL_EXIT_CODES = { complete: 0, partial: 1, failed: 1, stopped: 2, setup: 3 } as const;
export type TrialStop = { reason: 'uncertain_transport' | 'budget' | 'cancelled'; caseId: string | null; stage: string | null; code: string;
  killConfirmed: boolean | null; exitCode: number | null; estimatedMicroUsd: number | null };
export type TrialRow = { id: string; ok: boolean; shape: string; code: string | null; dispatched: number; usd: number; title?: string;
  soft?: string[]; draftHard?: string[]; draftSoft?: string[]; words?: unknown };

function args(argv: string[]) {
  const get = (name: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
  const cases = get('cases'), out = get('out'), executable = get('executable'), executableSha256 = get('executable-sha256');
  const budgetUsd = Number(get('budget-usd') ?? '0'), concurrency = Number(get('concurrency') ?? '2');
  if (!cases || !out || !path.isAbsolute(out) || !Number.isFinite(budgetUsd) || budgetUsd <= 0 || budgetUsd > 40 ||
    !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) throw Error('trial_arguments');
  const live = argv.includes('--live');
  if (live && (!executable || !path.isAbsolute(executable) || !/^[a-f0-9]{64}$/.test(executableSha256 ?? ''))) throw Error('trial_executable');
  return { cases, out, budgetMicroUsd: Math.round(budgetUsd * 1e6), concurrency, live, executable: executable ?? '', executableSha256: executableSha256 ?? '' };
}

const page = (n: number) => `עמוד ${n}`;
export function renderStoryMarkdown(prepared: PreparedSimpleStory, title: string, pages: readonly { text: string }[], note: string) {
  const { brief, book } = prepared;
  const theme = brief.topic ? `נושא: ${brief.topic}` : 'בלי נושא, סתם בשביל הכיף';
  return [`# ${title}`, '', `_${brief.child.name}, ${brief.child.address === 'girl' ? 'בת' : 'בן'} ${brief.child.age} · ${book.companion.shortName} · ${book.pages} עמודים · ${theme} · ${note}_`, '',
    ...pages.flatMap((p, i) => [`**${page(i + 1)}**`, '', p.text, ''])].join('\n');
}

/** Run-level ceiling on CLI-reported list-price estimates; an unknown cost counts as its full reservation and makes the total uncertain. */
class Budget {
  spent = 0; inflight = 0; uncertain = false;
  constructor(readonly limit: number) {}
  reserve(n: number) { if (this.spent + this.inflight + n > this.limit) throw Error('trial_budget_exhausted'); this.inflight += n; }
  settle(reserved: number, reported: number | null) { this.inflight -= reserved; this.spent += reported ?? reserved; if (reported === null) this.uncertain = true; }
}

/** Contained only when the native process provably exited with code 0 and reported a cost. Anything else is run-fatal. */
export function containedTransportFailure(error: unknown): boolean {
  if (!(error instanceof CausalTransportError)) return false;
  const raw = error.receipt.raw as { killConfirmed?: unknown; termination?: { code?: unknown; signal?: unknown; spawnError?: unknown } } | null;
  return raw?.killConfirmed === true && raw.termination?.code === 0 && !raw.termination.signal && !raw.termination.spawnError &&
    error.receipt.estimatedMicroUsd !== null;
}
class TrialHalt extends Error { constructor(readonly code: string) { super(code); } }

/** Runs prepared fictional cases with an injected transport. Never retries; stops admission on any uncertainty. */
export async function runSimpleStoryTrial(args: { cases: TrialCase[]; options: PersonalWizardOptions; out: string;
  budgetMicroUsd: number; concurrency: number; policy: WirePolicy; transport: TrialTransport; signal?: AbortSignal }) {
  if (new Set(args.cases.map(c => c.id)).size !== args.cases.length) throw Error('trial_duplicate_case');
  const prepared = args.cases.map(c => ({ c, p: prepareSimpleStory(structuredClone(c.request), args.options, c.seed) }));
  if (prepared.some(({ p }) => !p.accepted.containsFixtureData)) throw Error('trial_fictional_only');
  if (args.policy.workspace !== path.join(args.out, '_cli-workspace')) throw Error('trial_workspace');
  if (existsSync(args.out)) throw Error('trial_output_exists');
  mkdirSync(args.out); mkdirSync(args.policy.workspace);
  const save = (file: string, data: unknown) => writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data, null, 2), { flag: 'wx' });
  const budget = new Budget(args.budgetMicroUsd), controller = new AbortController();
  let stop: TrialStop | null = null;
  const halt = (record: TrialStop) => { stop ??= record; controller.abort(); };
  const cancelled = () => halt({ reason: 'cancelled', caseId: null, stage: null, code: 'cancelled', killConfirmed: null, exitCode: null, estimatedMicroUsd: null });
  if (args.signal?.aborted) cancelled(); else args.signal?.addEventListener('abort', cancelled, { once: true });
  save(path.join(args.out, 'run-plan.json'), { engine: SIMPLE_STORY_ENGINE_VERSION, startedAt: new Date().toISOString(), policy: args.policy,
    budgetUsd: args.budgetMicroUsd / 1e6, concurrency: args.concurrency, costKind: 'cli_reported_list_estimate_not_invoice',
    cases: prepared.map(({ c, p }) => ({ id: c.id, seed: c.seed, shape: p.shape.id, pages: p.book.pages, capPerCallUsd: capFor(simpleAuthorCall(p)) / 1e6 })) });
  const rows = new Map<string, TrialRow>();

  const runCase = async ({ c, p }: { c: TrialCase; p: PreparedSimpleStory }) => {
    const dir = path.join(args.out, c.id); mkdirSync(dir);
    save(path.join(dir, 'prepared.json'), { engine: SIMPLE_STORY_ENGINE_VERSION, caseId: c.id, seed: c.seed, shape: p.shape, requestId: p.accepted.requestId, book: p.book });
    let spentMicro = 0, dispatched = 0;
    const generate = async (call: SimpleStoryCall) => {
      // Nothing below awaits before the transport call, so this one check guards the dispatch.
      if (stop) throw new TrialHalt('trial_halted');
      const file = path.join(dir, `${call.stage}-instructions.txt`); save(file, call.instructions);
      const dispatch: CausalDispatch = { role: 'opus', stage: call.stage, conversationKey: `simple:${c.id}:${call.stage}`,
        input: call.input, instructions: call.instructions, schema: call.schema, maxOutputTokens: call.maxOutputTokens };
      const wire = prepareCausalWire(dispatch, args.policy, capFor(call), file);
      try { budget.reserve(wire.reservedMicroUsd); } catch {
        halt({ reason: 'budget', caseId: c.id, stage: call.stage, code: 'budget_exhausted', killConfirmed: null, exitCode: null, estimatedMicroUsd: null });
        throw new TrialHalt('trial_budget_exhausted');
      }
      save(path.join(dir, `${call.stage}-wire.json`), { digest: wire.digest, bytes: wire.bytes, reservedMicroUsd: wire.reservedMicroUsd, model: wire.model, outputCap: wire.outputCap, input: call.input });
      const started = Date.now(); dispatched += 1;
      try {
        const reply = await args.transport(wire, dispatch, controller.signal);
        budget.settle(wire.reservedMicroUsd, reply.estimatedMicroUsd); spentMicro += reply.estimatedMicroUsd ?? wire.reservedMicroUsd;
        save(path.join(dir, `${call.stage}-receipt.json`), { seconds: (Date.now() - started) / 1000, estimatedMicroUsd: reply.estimatedMicroUsd, usage: reply.usage, metadata: reply.metadata, output: reply.output, raw: reply.raw });
        return { output: reply.output, usage: reply.usage, estimatedUsd: reply.estimatedMicroUsd === null ? null : reply.estimatedMicroUsd / 1e6 };
      } catch (error) {
        const receipt = error instanceof CausalTransportError ? error.receipt : null;
        budget.settle(wire.reservedMicroUsd, receipt?.estimatedMicroUsd ?? null); spentMicro += receipt?.estimatedMicroUsd ?? wire.reservedMicroUsd;
        const code = error instanceof CausalTransportError ? error.code : String((error as Error)?.message ?? 'failed').slice(0, 200);
        const contained = containedTransportFailure(error);
        save(path.join(dir, `${call.stage}-failure.json`), { seconds: (Date.now() - started) / 1000, code, contained, receipt });
        if (!contained) {
          const raw = receipt?.raw as { killConfirmed?: unknown; termination?: { code?: unknown } } | null | undefined;
          halt({ reason: 'uncertain_transport', caseId: c.id, stage: call.stage, code,
            killConfirmed: typeof raw?.killConfirmed === 'boolean' ? raw.killConfirmed : null,
            exitCode: typeof raw?.termination?.code === 'number' ? raw.termination.code : null, estimatedMicroUsd: receipt?.estimatedMicroUsd ?? null });
        }
        throw error;
      }
    };
    try {
      const reservedUsd = 2 * capFor(simpleAuthorCall(p)) / 1e6;
      const { result, evidence } = await writeSimpleStory(p, generate, { model: CAUSAL_MODELS.opus, reservedUsd });
      save(path.join(dir, 'result.json'), result); save(path.join(dir, 'evidence.json'), evidence);
      save(path.join(dir, 'story.md'), renderStoryMarkdown(p, result.manuscript.title, result.manuscript.pages, `מבנה: ${p.shape.id} · אחרי עריכה`));
      save(path.join(dir, 'draft.md'), renderStoryMarkdown(p, evidence.draft.title, evidence.draft.pages, `מבנה: ${p.shape.id} · טיוטה לפני עריכה`));
      rows.set(c.id, { id: c.id, ok: true, shape: p.shape.id, code: null, dispatched, usd: spentMicro / 1e6, title: result.manuscript.title,
        soft: evidence.finalCheck.soft, draftHard: evidence.draftCheck.hard, draftSoft: evidence.draftCheck.soft, words: evidence.finalCheck.words });
    } catch (error) {
      const code = error instanceof SimpleStoryError || error instanceof TrialHalt ? error.code
        : error instanceof CausalTransportError ? `transport_${error.code}` : String((error as Error)?.message ?? 'failed').slice(0, 120);
      save(path.join(dir, 'failure.json'), { code, evidence: error instanceof SimpleStoryError ? error.evidence : null });
      rows.set(c.id, { id: c.id, ok: false, shape: p.shape.id, code, dispatched, usd: spentMicro / 1e6 });
    }
  };
  let next = 0;
  try {
    await Promise.all(Array.from({ length: Math.min(args.concurrency, prepared.length) }, async () => {
      while (!stop && next < prepared.length) await runCase(prepared[next++]);
    }));
  } finally { args.signal?.removeEventListener('abort', cancelled); }
  for (const { c, p } of prepared) if (!rows.has(c.id)) rows.set(c.id, { id: c.id, ok: false, shape: p.shape.id, code: 'not_dispatched', dispatched: 0, usd: 0 });
  const list = prepared.map(({ c }) => rows.get(c.id)!);
  const finalStop = stop as TrialStop | null;
  const status: TrialStatus = finalStop ? 'stopped' : list.every(r => r.ok) ? 'complete' : list.some(r => r.ok) ? 'partial' : 'failed';
  const summary = { engine: SIMPLE_STORY_ENGINE_VERSION, finishedAt: new Date().toISOString(), status, exitCode: TRIAL_EXIT_CODES[status],
    stop: finalStop, costCertain: !budget.uncertain, spentUsd: budget.spent / 1e6, costKind: 'cli_reported_list_estimate_not_invoice', rows: list };
  save(path.join(args.out, 'run-summary.json'), summary);
  return summary;
}

/** CLI entry. Returns the process exit code; dependencies are injectable for boundary tests. */
export async function main(argv: string[], deps: { createTransport?: (policy: WirePolicy) => TrialTransport; log?: (line: string) => void } = {}): Promise<number> {
  const log = deps.log ?? ((line: string) => console.log(line));
  const a = args(argv);
  const cases = casesSchema.parse(JSON.parse(readFileSync(a.cases, 'utf8').replace(/^﻿/, '')));
  const options = textCanonOptions(resolvePersonalWizardOptions());
  const plan = cases.map(c => { const p = prepareSimpleStory(structuredClone(c.request), options, c.seed);
    return { id: c.id, seed: c.seed, shape: p.shape.id, child: p.brief.child.name, age: p.brief.child.age, companion: p.book.companion.shortName,
      pages: p.book.pages, theme: p.brief.topic ?? null, fictional: p.accepted.containsFixtureData, capPerCallUsd: capFor(simpleAuthorCall(p)) / 1e6 }; });
  log(JSON.stringify({ engine: SIMPLE_STORY_ENGINE_VERSION, live: a.live, cases: plan, worstCaseUsd: plan.reduce((n, row) => n + 2 * row.capPerCallUsd, 0), budgetUsd: a.budgetMicroUsd / 1e6 }, null, 2));
  if (!a.live) return TRIAL_EXIT_CODES.complete;
  const policy: WirePolicy = { executable: a.executable, executableSha256: a.executableSha256, workspace: path.join(a.out, '_cli-workspace'),
    maxWireBytes: MAX_WIRE_BYTES, rates: SIMPLE_RATES };
  if (sha(readFileSync(policy.executable)) !== policy.executableSha256) throw Error('trial_executable_hash');
  const transport = (deps.createTransport ?? createOpusCausalTransport)(policy);
  const controller = new AbortController(), interrupt = () => controller.abort();
  process.on('SIGINT', interrupt);
  try {
    const run = await runSimpleStoryTrial({ cases, options, out: a.out, budgetMicroUsd: a.budgetMicroUsd, concurrency: a.concurrency, policy, transport, signal: controller.signal });
    log(JSON.stringify({ status: run.status, exitCode: run.exitCode, stop: run.stop, costCertain: run.costCertain, spentUsd: run.spentUsd,
      rows: run.rows.map(r => ({ id: r.id, ok: r.ok, code: r.code, dispatched: r.dispatched, usd: r.usd })) }, null, 2));
    return run.exitCode;
  } finally { process.off('SIGINT', interrupt); }
}

if (require.main === module) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; },
    error => { console.error(String(error?.message ?? 'trial_failed').slice(0, 200)); process.exitCode = TRIAL_EXIT_CODES.setup; });
}
