/** Text-only diagnostic runner for the simple story engine. Import is inert; live spend needs --live. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { resolvePersonalWizardOptions, type PersonalWizardOptions } from '../lib/personal-wizard/options';
import { PERSONAL_CHARACTER_IDS, resolvePersonalCompanionCharacter } from '../lib/personal-wizard/companion-character';
import { prepareSimpleStory, simpleAuthorCall, writeSimpleStory, SimpleStoryError, SIMPLE_STORY_ENGINE_VERSION,
  type PreparedSimpleStory, type SimpleStoryCall } from '../lib/personal-wizard/simple-story-engine';
import type { CausalDispatch } from '../lib/personal-wizard/story-causal-experiment-runner';
import type { PersonalStoryResult } from '../lib/personal-wizard/story-contract';
import { CAUSAL_MODELS, CausalTransportError, createOpusCausalTransport, prepareCausalWire, wireReservation, type WirePolicy } from './personal-causal-trial-adapters';

const sha = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
/** List rates pinned by the 2026-10-06 premise admission (Opus 4/20, Astra 10/50 per M tokens); reservations, not invoices. Astra is never dispatched here. */
export const SIMPLE_RATES = { opus: { inputMicroUsdPerToken: 4, outputMicroUsdPerToken: 20 }, astra: { inputMicroUsdPerToken: 10, outputMicroUsdPerToken: 50 } };
const MAX_WIRE_BYTES = 104_000;

/** Synthetic text-only roster of all fifteen literary identities. NOT wizard availability, card art or render admission. */
export function textCanonOptions(base: PersonalWizardOptions): PersonalWizardOptions {
  const companions = PERSONAL_CHARACTER_IDS.map(id => ({ id, name: resolvePersonalCompanionCharacter(id)!.name, image: '/text-only-trial-unused.png' }));
  return { ...base, companions, unavailableCompanionIds: [],
    fingerprint: sha(JSON.stringify({ schema: 'personal-text-canon-options/v1', base: base.fingerprint, companions })) };
}
const casesSchema = z.array(z.object({ id: z.string().regex(/^[a-z0-9][a-z0-9_-]{1,60}$/), seed: z.string().max(80), request: z.unknown() }).strict()).min(1).max(40);
type Case = z.infer<typeof casesSchema>[number];

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
  return [`# ${title}`, '', `_${brief.child.name}, בן/בת ${brief.child.age} · ${book.companion.shortName} · ${book.pages} עמודים · ${theme} · ${note}_`, '',
    ...pages.flatMap((p, i) => [`**${page(i + 1)}**`, '', p.text, ''])].join('\n');
}

/** Run-level ceiling on CLI-reported list-price estimates; unknown cost counts as its full reservation. */
class Budget {
  spent = 0; inflight = 0;
  constructor(readonly limit: number) {}
  reserve(n: number) { if (this.spent + this.inflight + n > this.limit) throw Error('trial_budget_exhausted'); this.inflight += n; }
  settle(reserved: number, reported: number | null) { this.inflight -= reserved; this.spent += reported ?? reserved; }
}

async function main() {
  const a = args(process.argv.slice(2));
  const cases = casesSchema.parse(JSON.parse(readFileSync(a.cases, 'utf8').replace(/^﻿/, '')));
  if (new Set(cases.map(c => c.id)).size !== cases.length) throw Error('trial_duplicate_case');
  const options = textCanonOptions(resolvePersonalWizardOptions());
  const prepared = cases.map(c => ({ c, p: prepareSimpleStory(structuredClone(c.request), options, c.seed) }));
  if (prepared.some(({ p }) => !p.accepted.containsFixtureData)) throw Error('trial_fictional_only');
  const capFor = (call: SimpleStoryCall) => wireReservation(MAX_WIRE_BYTES, call.maxOutputTokens, SIMPLE_RATES.opus);
  const plan = prepared.map(({ c, p }) => ({ id: c.id, seed: c.seed, shape: p.shape.id, child: p.brief.child.name, age: p.brief.child.age,
    companion: p.book.companion.shortName, pages: p.book.pages, theme: p.brief.topic ?? null, capPerCallUsd: capFor(simpleAuthorCall(p)) / 1e6 }));
  const worst = plan.reduce((n, row) => n + 2 * row.capPerCallUsd, 0);
  console.log(JSON.stringify({ engine: SIMPLE_STORY_ENGINE_VERSION, live: a.live, cases: plan, worstCaseUsd: worst, budgetUsd: a.budgetMicroUsd / 1e6 }, null, 2));
  if (!a.live) return;

  if (existsSync(a.out)) throw Error('trial_output_exists');
  mkdirSync(a.out); const workspace = path.join(a.out, '_cli-workspace'); mkdirSync(workspace);
  const policy: WirePolicy = { executable: a.executable, executableSha256: a.executableSha256, workspace, maxWireBytes: MAX_WIRE_BYTES, rates: SIMPLE_RATES };
  if (sha(readFileSync(policy.executable)) !== policy.executableSha256) throw Error('trial_executable_hash');
  const transport = createOpusCausalTransport(policy), budget = new Budget(a.budgetMicroUsd), controller = new AbortController();
  process.once('SIGINT', () => controller.abort());
  const save = (file: string, data: unknown) => writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data, null, 2), { flag: 'wx' });
  save(path.join(a.out, 'run-plan.json'), { engine: SIMPLE_STORY_ENGINE_VERSION, startedAt: new Date().toISOString(), policy: { ...policy, rates: SIMPLE_RATES },
    budgetUsd: a.budgetMicroUsd / 1e6, cases: plan, costKind: 'cli_reported_list_estimate_not_invoice' });
  const rows: Record<string, unknown>[] = [];

  const runCase = async ({ c, p }: { c: Case; p: PreparedSimpleStory }) => {
    const dir = path.join(a.out, c.id); mkdirSync(dir);
    save(path.join(dir, 'prepared.json'), { engine: SIMPLE_STORY_ENGINE_VERSION, caseId: c.id, seed: c.seed, shape: p.shape, requestId: p.accepted.requestId, book: p.book });
    let spentMicro = 0;
    const generate = async (call: SimpleStoryCall) => {
      if (controller.signal.aborted) throw Error('trial_cancelled');
      const file = path.join(dir, `${call.stage}-instructions.txt`); save(file, call.instructions);
      const dispatch: CausalDispatch = { role: 'opus', stage: call.stage, conversationKey: `simple:${c.id}:${call.stage}`,
        input: call.input, instructions: call.instructions, schema: call.schema, maxOutputTokens: call.maxOutputTokens };
      const wire = prepareCausalWire(dispatch, policy, capFor(call), file);
      budget.reserve(wire.reservedMicroUsd);
      save(path.join(dir, `${call.stage}-wire.json`), { digest: wire.digest, bytes: wire.bytes, reservedMicroUsd: wire.reservedMicroUsd, model: wire.model, outputCap: wire.outputCap, input: call.input });
      const started = Date.now();
      try {
        const reply = await transport(wire, dispatch, controller.signal);
        budget.settle(wire.reservedMicroUsd, reply.estimatedMicroUsd); spentMicro += reply.estimatedMicroUsd ?? wire.reservedMicroUsd;
        save(path.join(dir, `${call.stage}-receipt.json`), { seconds: (Date.now() - started) / 1000, estimatedMicroUsd: reply.estimatedMicroUsd, usage: reply.usage, metadata: reply.metadata, output: reply.output, raw: reply.raw });
        return { output: reply.output, usage: reply.usage, estimatedUsd: reply.estimatedMicroUsd === null ? null : reply.estimatedMicroUsd / 1e6 };
      } catch (error) {
        const receipt = error instanceof CausalTransportError ? error.receipt : null;
        budget.settle(wire.reservedMicroUsd, receipt?.estimatedMicroUsd ?? null); spentMicro += receipt?.estimatedMicroUsd ?? wire.reservedMicroUsd;
        save(path.join(dir, `${call.stage}-failure.json`), { seconds: (Date.now() - started) / 1000, code: error instanceof CausalTransportError ? error.code : String((error as Error)?.message ?? 'failed').slice(0, 200), receipt });
        throw error;
      }
    };
    try {
      const reservedUsd = 2 * capFor(simpleAuthorCall(p)) / 1e6;
      const { result, evidence } = await writeSimpleStory(p, generate, { model: CAUSAL_MODELS.opus, reservedUsd });
      save(path.join(dir, 'result.json'), result); save(path.join(dir, 'evidence.json'), evidence);
      save(path.join(dir, 'story.md'), renderStoryMarkdown(p, result.manuscript.title, result.manuscript.pages, `מבנה: ${p.shape.id} · אחרי עריכה`));
      save(path.join(dir, 'draft.md'), renderStoryMarkdown(p, evidence.draft.title, evidence.draft.pages, `מבנה: ${p.shape.id} · טיוטה לפני עריכה`));
      rows.push({ id: c.id, ok: true, shape: p.shape.id, title: result.manuscript.title, usd: spentMicro / 1e6, soft: evidence.finalCheck.soft,
        draftHard: evidence.draftCheck.hard, draftSoft: evidence.draftCheck.soft, words: evidence.finalCheck.words, dashesFixed: evidence.draftDashes + evidence.finalDashes });
      return result as PersonalStoryResult;
    } catch (error) {
      const code = error instanceof SimpleStoryError ? error.code : error instanceof CausalTransportError ? `transport_${error.code}` : String((error as Error)?.message ?? 'failed').slice(0, 120);
      save(path.join(dir, 'failure.json'), { code, evidence: error instanceof SimpleStoryError ? error.evidence : null });
      rows.push({ id: c.id, ok: false, shape: p.shape.id, code, usd: spentMicro / 1e6 });
      return null;
    }
  };
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(a.concurrency, prepared.length) }, async () => {
    while (next < prepared.length && !controller.signal.aborted) {
      const item = prepared[next++];
      try { await runCase(item); } catch (error) { rows.push({ id: item.c.id, ok: false, code: String((error as Error)?.message ?? 'failed').slice(0, 120) }); }
    }
  }));
  const order = new Map(prepared.map(({ c }, i) => [c.id, i]));
  rows.sort((x, y) => (order.get(String(x.id)) ?? 0) - (order.get(String(y.id)) ?? 0));
  save(path.join(a.out, 'run-summary.json'), { engine: SIMPLE_STORY_ENGINE_VERSION, finishedAt: new Date().toISOString(),
    spentUsd: budget.spent / 1e6, costKind: 'cli_reported_list_estimate_not_invoice', rows });
  console.log(JSON.stringify({ spentUsd: budget.spent / 1e6, rows: rows.map(r => ({ id: r.id, ok: r.ok, code: r.code ?? null, usd: r.usd })) }, null, 2));
}

if (require.main === module) main().catch(error => { console.error(String(error?.message ?? 'trial_failed').slice(0, 200)); process.exitCode = 1; });
