import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import * as adapters from '../../scripts/personal-causal-trial-adapters';
import { causalTrialCohort } from '../../scripts/personal-causal-cohort';
import { createCausalTrialHost, readCausalReviewFile, causalOutputCap, type CausalHostPolicy, type CausalHostTransport } from '../../scripts/personal-causal-trial-host';
import { CausalFamilyJournal, CausalHostError, exclusiveJson, realDirectory } from '../../scripts/personal-causal-trial-journal';
import { prepareCausalWire, wireReservation, CAUSAL_MODELS, CausalTransportError, createAstraCausalTransport, type WirePolicy } from '../../scripts/personal-causal-trial-adapters';
import { CAUSAL_EXPERIMENT_VERSION } from '../personal-wizard/story-causal-experiment';
import { canonicalJson } from '../personal-wizard/request-acceptance';
import type { CausalDispatch } from '../personal-wizard/story-causal-experiment-runner';
import { fixtureAdventureSelection } from '../personal-wizard/__tests__/story-planning-fixture';
import { fixtureEditorOutput } from '../personal-wizard/__tests__/personal-storyboard-fixture';
import { preparePersonalStory } from '../personal-wizard/story-writer';
import { resolvePersonalWizardOptions } from '../personal-wizard/options';
import { citationTokens } from '../personal-wizard/story-source-citations';

const dirs: string[] = [];
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function temporary() { const d = mkdtempSync(path.join(tmpdir(), 'causal-host-test-')); dirs.push(d); return d; }
function policy(root: string): CausalHostPolicy {
  return { version: 'causal-trial-host/v2', reviewMode: 'normal', family: 'synthetic-offline-family', sourceHead: 'a'.repeat(40), maximumMicroUsd: 100_000_000,
    maxWireBytes: 104_000, executable: path.join(root, 'unused.exe'), executableSha256: 'b'.repeat(64), mode: 'offline_injected', approval: null,
    pricing: { source: 'Synthetic test rates, NOT provider prices.', checkedAt: '2026-10-03T00:00:00Z',
      rates: { opus: { inputMicroUsdPerToken: 1, outputMicroUsdPerToken: 1 }, astra: { inputMicroUsdPerToken: 1, outputMicroUsdPerToken: 1 } } } };
}
function output(call: CausalDispatch): any {
  const input = JSON.parse(call.input), brief = input.brief;
  if (call.stage === 'plan' || call.stage === 'replan') {
    const interest = brief.facts.find((f: any) => f.kind === 'interest').id;
    return { version: CAUSAL_EXPERIMENT_VERSION, requestId: brief.requestId, disposition: 'selected',
      selection: fixtureAdventureSelection(brief.beats, interest),
      synopsis: 'Synthetic adventure through discovery and partnership to a prepared payoff. Not literary proof.',
      plan: { title: 'ההרפתקה החדשה', childGoal: 'למצוא דרך מעניינת', companionWant: 'לנסות וגם לעזור', comicPromise: 'הרעיון מסתבך באופן מצחיק',
        resilience: { mode: brief.resilienceMode, moments: [{ pageNumber: 2, childChoice: 'בוחרת דרך אחרת', whatHelps: 'החבר מקשיב' }] },
        beats: Array.from({ length: brief.beats }, () => ({ location: 'בגינה', transitionReason: 'הגילוי משנה את הדרך', childAction: 'מציעה דרך אחרת',
          companionAction: 'מקשיב ומנסה', consequence: 'מגלים משהו חדש', factIds: [interest], continuity: 'החפץ בידי הילדה' })), ending: 'מוצאים יחד דרך חדשה' } };
  }
  if (call.stage === 'author') return { requestId: brief.requestId, planDigest: input.planDigest, title: 'ההרפתקה החדשה',
    pages: Array.from({ length: brief.beats }, (_, i) => ({ text: `${brief.child.name} מציעה דרך חדשה והחבר מנסה איתה. הם מגלים משהו מצחיק ומשנים את התוכנית. פרט מקורי ${i + 1}` })) };
  if (call.stage === 'editor') {
    const revision = fixtureEditorOutput({ ...call, stage: 'editor' });
    const feedback = input.draftCritique;
    return { version: CAUSAL_EXPERIMENT_VERSION,
      ...(feedback ? { draftCritiqueResponse: { projectionDigest: feedback.projectionDigest,
        responses: feedback.findings.map((f: any) => ({ findingId: f.id, decision: 'kept', reason: 'Synthetic unchanged passage supports keeping this choice.' })) } } : {}),
      revision: { ...revision,
      plan: { ...revision.plan, beats: revision.plan.beats.map(({ pageNumber: _n, ...beat }) => beat) },
      manuscript: { ...revision.manuscript, pages: revision.manuscript.pages.map(({ pageNumber: _n, ...page }) => page) } } };
  }
  return { packetDigest: input.packetDigest, summary: 'Synthetic critic reading, not literary approval.', findings: [] };
}
function harness(count = 1, change?: CausalHostTransport, reviewMode: 'normal' | 'benchmark' = 'normal', synopsisRepair = false, draftCritique = false, maxWireBytes = 104_000) {
  const root = temporary(), controller = new AbortController(), p = policy(root), cases = causalTrialCohort().slice(0, count);
  p.reviewMode = reviewMode;
  if (synopsisRepair) p.synopsisRepair = true;
  if (draftCritique) p.draftCritique = true;
  p.maxWireBytes = maxWireBytes;
  const transport = vi.fn<CausalHostTransport>(change ?? (async (_wire, call) => ({ output: output(call), estimatedMicroUsd: 1,
    usage: { inputTokens: 1, outputTokens: 1 }, metadata: { synthetic: true }, raw: { synthetic: true } })));
  const assertSource = vi.fn();
  const args = { workspace: root, outputRoot: path.join(root, 'output'), policy: p, cases, signal: controller.signal,
    injected: { commonDir: root, assertSource, transport } };
  const host = createCausalTrialHost(args);
  const review = (bundle: Awaited<ReturnType<typeof host.plan>>, decision: 'write' | 'hold' = 'write') => ({ sourceDigest: bundle.sourceDigest,
    decisions: bundle.plans.map(row => ({ caseId: row.caseId, decision, reason: 'Synthetic editorial test decision, not product acceptance.' })) });
  return { root, controller, p, cases, args, host, transport, assertSource, review };
}
const criticCall = (): CausalDispatch => ({ role: 'astra', stage: 'final_review', conversationKey: 'synthetic:case1:final_review',
  instructions: 'Synthetic critic instructions.', input: '{"synthetic":true}', schema: z.object({ value: z.string() }).strict(), maxOutputTokens: 12_000 });
const wirePolicy = (root: string): WirePolicy => ({ ...policy(root), workspace: root, rates: policy(root).pricing.rates });

describe('single-book synopsis repair at the durable host boundary (no providers)', () => {
  const repairRequest = (h: ReturnType<typeof harness>, bundle: Awaited<ReturnType<typeof h.host.plan>>) => {
    const chosen = bundle.plans[0].attempts[0];
    if (!('planningDigest' in chosen)) throw Error('selected fixture required');
    return { review: h.review(bundle, 'hold'), caseId: 'case1', planningDigest: chosen.planningDigest,
      defects: ['The payoff contradicts the earlier condition in this synthetic plan.'] };
  };
  it('rejects enabled multi-case admission without a reservation or transport', () => {
    const root = temporary(), p = policy(root); p.synopsisRepair = true;
    const transport = vi.fn<CausalHostTransport>();
    expect(() => createCausalTrialHost({ workspace: root, outputRoot: path.join(root, 'output'), policy: p,
      cases: causalTrialCohort().slice(0, 2), signal: new AbortController().signal,
      injected: { commonDir: root, assertSource: vi.fn(), transport } })).toThrow('repair_single_case');
    expect(transport).not.toHaveBeenCalled(); expect(readdirSync(root)).toEqual([]);
  });
  it('uses the existing cap and journals the defects before the one replan dispatch', async () => {
    const h = harness(1, undefined, 'normal', true), first = await h.host.plan();
    const request = repairRequest(h, first);
    h.transport.mockImplementation(async (wire, call) => {
      expect(call.stage).toBe('replan');
      expect(JSON.parse(readFileSync(path.join(h.args.outputRoot, 'synopsis-repair-request.json'), 'utf8'))).toEqual(request);
      const manifest = JSON.parse(readFileSync(path.join(h.args.outputRoot, 'manifest.json'), 'utf8'));
      const slot = manifest.slots.find((s: any) => s.id === 'case1:replan');
      expect(call.maxOutputTokens).toBe(slot.maxOutputTokens); expect(wire.reservedMicroUsd).toBeLessThanOrEqual(slot.capMicroUsd);
      return { output: output(call), estimatedMicroUsd: 1, usage: null, metadata: {}, raw: {} };
    });
    const repaired = await h.host.repair(request);
    expect(repaired.sourceDigest).not.toBe(first.sourceDigest); expect(h.transport).toHaveBeenCalledTimes(2);
    expect(h.host.snapshot().coordinator.plans[0].attempts).toHaveLength(2);
    const result = await h.host.write(h.review(repaired, 'hold'));
    expect(result.books).toEqual([]); expect(h.transport).toHaveBeenCalledTimes(2);
    expect(h.host.snapshot().host.closed).toBe(true);
  });
  it.each(['junction', 'hard', 'over-limit', 'invalid-json', 'extra-field'])(
    'rejects a %s repair file before replan', async mode => {
      const h = harness(1, undefined, 'normal', true), first = await h.host.plan();
      const file = path.join(h.args.outputRoot, 'repair-request.json'), request = repairRequest(h, first);
      if (mode === 'junction') {
        const other = path.join(h.root, 'other-directory'); mkdirSync(other); symlinkSync(other, file, 'junction');
      } else if (mode === 'hard') {
        const other = path.join(h.root, 'other.json'); writeFileSync(other, JSON.stringify(request));
        linkSync(other, file);
      } else writeFileSync(file, mode === 'over-limit' ? ' '.repeat(10_001) : mode === 'invalid-json' ? '{' : JSON.stringify({ ...request, solutions: ['prescribed fix'] }));
      await expect(h.host.repairFromRequestFile()).rejects.toThrow('review_file');
      expect(h.transport).toHaveBeenCalledTimes(1); expect(h.host.snapshot().host.closed).toBe(true);
      expect(existsSync(path.join(h.args.outputRoot, 'synopsis-repair-request.json'))).toBe(false);
    });
  it('accepts exactly one leading BOM on an otherwise valid repair file', async () => {
    const h = harness(1, undefined, 'normal', true), first = await h.host.plan();
    writeFileSync(path.join(h.args.outputRoot, 'repair-request.json'), '\uFEFF' + JSON.stringify(repairRequest(h, first)));
    const repaired = await h.host.repairFromRequestFile();
    expect(repaired.plans[0].attempts).toHaveLength(2); expect(h.transport).toHaveBeenCalledTimes(2); h.host.stop();
  });
  it('the unchanged wire preparer rejects over-limit prior-plan plus defects input', async () => {
    const h = harness(1, undefined, 'normal', true), first = await h.host.plan();
    const request = repairRequest(h, first);
    // Direct wire-fence probe; host terminal behavior is covered by the injected driver failure tests.
    const call: CausalDispatch = { role: 'opus', stage: 'replan', conversationKey: 'synthetic:case1:replan',
      instructions: 'Synthetic repair instructions.', input: JSON.stringify({ priorPlan: first.plans[0], defects: request.defects }),
      schema: z.object({ value: z.string() }).strict(), maxOutputTokens: causalOutputCap(8, 'replan') };
    expect(() => prepareCausalWire(call, { ...wirePolicy(h.root), maxWireBytes: 100 }, 100_000_000, path.join(h.root, 'instructions.txt'))).toThrow();
    expect(h.transport).toHaveBeenCalledTimes(1); h.host.stop();
  });
});

// A real, clean TEMP Git source makes each removed admission clause observable:
// a negative cannot pass just because it falls through to an unrelated source error.
function constructionFixture() {
  const root = temporary(), p = policy(root), key = vi.fn(() => 'SYNTHETIC UNUSED KEY');
  writeFileSync(p.executable, 'SYNTHETIC NOT EXECUTABLE');
  p.executableSha256 = createHash('sha256').update(readFileSync(p.executable)).digest('hex');
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_/i.test(k))) as NodeJS.ProcessEnv;
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, env, encoding: 'utf8', windowsHide: true }).trim();
  git('init', '-q'); git('add', '--', path.basename(p.executable));
  git('-c', 'user.name=Synthetic Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-q', '-m', 'Synthetic clean source');
  p.sourceHead = git('rev-parse', 'HEAD'); p.mode = 'live_explicit';
  p.pricing.checkedAt = new Date().toISOString();
  p.approval = { reference: 'Synthetic TEST approval, NOT Guy live consent.', maximumMicroUsd: p.maximumMicroUsd, acknowledgesCliEstimateLimits: true };
  const transport = vi.fn<CausalHostTransport>(), assertSource = vi.fn();
  const injected = { commonDir: root, transport, assertSource };
  const args: Parameters<typeof createCausalTrialHost>[0] = { workspace: root, outputRoot: path.join(root, 'output'), policy: p,
    cases: causalTrialCohort().slice(0, 1), signal: new AbortController().signal, existingOpenAIKey: key };
  return { root, p, args, key, injected, transport };
}

describe('independent live admission clauses without providers', () => {
  const cases: { name: string; code: string; mutate: (h: ReturnType<typeof constructionFixture>) => void }[] = [
    { name: 'offline without injection or key', code: 'authorization', mutate: h => { h.p.mode = 'offline_injected'; h.p.approval = null; delete h.args.existingOpenAIKey; } },
    { name: 'offline without injection but with key', code: 'authorization', mutate: h => { h.p.mode = 'offline_injected'; h.p.approval = null; } },
    { name: 'offline with approval', code: 'authorization', mutate: h => { h.p.mode = 'offline_injected'; h.args.injected = h.injected; } },
    { name: 'live with injection', code: 'authorization', mutate: h => { h.args.injected = h.injected; } },
    { name: 'live without approval', code: 'authorization', mutate: h => { h.p.approval = null; } },
    { name: 'live approved maximum differs from policy', code: 'authorization', mutate: h => { h.p.approval!.maximumMicroUsd -= 1; } },
    { name: 'live without key callback', code: 'authorization', mutate: h => { delete h.args.existingOpenAIKey; } },
    { name: 'stale pricing', code: 'pricing_stale', mutate: h => { h.p.pricing.checkedAt = new Date(Date.now() - 172_800_000).toISOString(); } },
    { name: 'future pricing', code: 'pricing_stale', mutate: h => { h.p.pricing.checkedAt = new Date(Date.now() + 3_600_000).toISOString(); } },
    { name: 'non-fictional child including story place', code: 'fictional_only', mutate: h => {
      const request = h.args.cases[0].request as ReturnType<typeof causalTrialCohort>[number]['request'];
      for (const field of ['nameSource', 'ageSource', 'addressSource', 'residenceSource'] as const) request.child[field] = 'typed';
      for (const fact of request.facts) fact.source = 'typed';
      if (request.storyPlace) request.storyPlace.source = 'typed';
      if (request.intent?.kind === 'topic') delete request.intent.suggestedBy;
    } },
  ];
  it.each(cases)('$name fails its own admission clause before key/transport and without new artifacts', ({ code, mutate }) => {
    const h = constructionFixture(), inventory = readdirSync(h.root, { recursive: true });
    const fetcher = vi.fn<typeof fetch>(() => { throw Error('Unexpected network'); }); vi.stubGlobal('fetch', fetcher);
    mutate(h); expect(() => createCausalTrialHost(h.args)).toThrow(`causal_host_${code}`);
    expect(h.key).not.toHaveBeenCalled(); expect(h.transport).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    expect(readdirSync(h.root, { recursive: true })).toEqual(inventory);
    expect(existsSync(h.args.outputRoot)).toBe(false); expect(existsSync(path.join(h.root, 'codex-causal-text-trials'))).toBe(false);
  }, 15_000);
  it.each([1, 2, 3, 4, 5])('non-fictional later cohort member at index %i fails before key/transport and without new artifacts', index => {
    const h = constructionFixture(); h.args.cases = causalTrialCohort();
    const inventory = readdirSync(h.root, { recursive: true });
    const fetcher = vi.fn<typeof fetch>(() => { throw Error('Unexpected network'); }); vi.stubGlobal('fetch', fetcher);
    expect(h.args.cases).toHaveLength(6);
    // The all-fictional cohort is a positive control for all other admission clauses.
    const admitted = createCausalTrialHost(h.args);
    expect(admitted.snapshot().coordinator.phase).toBe('new'); admitted.stop();
    const request = h.args.cases[index].request as ReturnType<typeof causalTrialCohort>[number]['request'];
    for (const field of ['nameSource', 'ageSource', 'addressSource', 'residenceSource'] as const) request.child[field] = 'typed';
    for (const fact of request.facts) fact.source = 'typed';
    if (request.storyPlace) request.storyPlace.source = 'typed';
    if (request.intent?.kind === 'topic') delete request.intent.suggestedBy;
    expect(() => createCausalTrialHost(h.args)).toThrow('causal_host_fictional_only');
    expect(h.key).not.toHaveBeenCalled(); expect(h.transport).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    expect(readdirSync(h.root, { recursive: true })).toEqual(inventory);
    expect(existsSync(h.args.outputRoot)).toBe(false); expect(existsSync(path.join(h.root, 'codex-causal-text-trials'))).toBe(false);
  }, 15_000);
  it('otherwise valid live admission constructs without reserving or opening a client', () => {
    const h = constructionFixture(), inventory = readdirSync(h.root, { recursive: true });
    const host = createCausalTrialHost(h.args);
    expect(host.snapshot().host.mode).toBe('live_explicit'); expect(host.snapshot().coordinator.phase).toBe('new');
    expect(h.key).not.toHaveBeenCalled(); expect(h.transport).not.toHaveBeenCalled();
    expect(readdirSync(h.root, { recursive: true })).toEqual(inventory); host.stop();
  }, 15_000);
});

describe('one-shot causal trial connection (zero live providers)', () => {
  it('reserves all36slots and crosses the real coordinator in30isolated logical dispatches', async () => {
    const h = harness(6), bundle = await h.host.plan().catch(error => { throw new Error(`${error.message} host=${h.host.snapshot().host.failureCode}`); });
    expect(h.transport).toHaveBeenCalledTimes(6);
    const manifest = JSON.parse(readFileSync(path.join(h.args.outputRoot, 'manifest.json'), 'utf8'));
    expect(manifest.slots).toHaveLength(36); expect(manifest.policy.reviewMode).toBe('normal'); expect(manifest.runtimeEligible).toBe(false);
    expect(existsSync(path.join(h.args.outputRoot, 'synopses.json'))).toBe(true);
    const result = await h.host.write(h.review(bundle));
    expect(result.books).toHaveLength(6); expect(h.transport).toHaveBeenCalledTimes(30);
    expect(new Set(h.transport.mock.calls.map(([, c]) => c.conversationKey)).size).toBe(30);
    expect(result.runtimeEligible).toBe(false); expect(h.host.snapshot().host.closed).toBe(true);
    expect(h.transport.mock.calls.map(([, c]) => c.maxOutputTokens).slice(0, 6)).toEqual([18000, 20000, 22000, 18000, 20000, 22000]);
    for (const [wire, call] of h.transport.mock.calls) {
      expect(wire.outputCap).toBe(call.maxOutputTokens); expect(wire.bytes).toBe(Buffer.byteLength(wire.json));
      expect(call.role === 'opus' ? wire.args?.includes('--no-session-persistence') : wire.payload.store === false).toBe(true);
      const slot = call.conversationKey.split(':').slice(-2).join(':');
      const receipt = JSON.parse(readFileSync(path.join(h.root, 'codex-causal-text-trials', h.p.family, `receipt-${slot.replace(':', '-')}.json`), 'utf8'));
      expect(receipt).toMatchObject({ slot, attempted: true, receipt: { estimatedMicroUsd: 1, usage: { inputTokens: 1, outputTokens: 1 }, metadata: { synthetic: true } } });
      expect(receipt.receipt.output).toEqual(output(call));
    }
    const accounting = JSON.parse(readFileSync(path.join(h.args.outputRoot, 'host-accounting.json'), 'utf8'));
    expect(accounting).toEqual({ reservedMicroUsd: manifest.reservedMicroUsd, logicalAttempts: 30, knownEstimateMicroUsd: 30,
      unknownAttemptCosts: 0, kind: 'estimate_not_invoice', runtimeEligible: false });
    const sealed = JSON.parse(readFileSync(path.join(h.root, 'codex-causal-text-trials', h.p.family, 'sealed.json'), 'utf8'));
    expect(sealed.reason).toBe('completed_diagnostic'); expect(sealed.runtimeEligible).toBe(false);
    expect(sealed.claims).toEqual(h.transport.mock.calls.map(([, c]) => c.conversationKey.split(':').slice(-2).join(':')));
    expect(sealed.settled).toEqual(sealed.claims);
  // This performs30durable filesystem dispatches, not a production latency SLA.
  }, 30_000);
  it('explicit benchmark reserves the original review, cannot mutate a normal recipe or replay its family', async () => {
    const normal = harness(), benchmark = harness(1, undefined, 'benchmark');
    normal.p.reviewMode = 'benchmark'; // host captured the approved normal policy already
    const n = await normal.host.plan(), b = await benchmark.host.plan();
    const nr = await normal.host.write(normal.review(n)), br = await benchmark.host.write(benchmark.review(b));
    expect(nr.evidence.manifest.reviewMode).toBe('normal'); expect(br.evidence.manifest.reviewMode).toBe('benchmark');
    expect(nr.evidence.manifest.slots).toHaveLength(6); expect(br.evidence.manifest.slots).toHaveLength(7);
    expect(nr.books[0].readings.map(row => row.stage)).toEqual(['final_review', 'comparison']);
    expect(br.books[0].readings.map(row => row.stage)).toEqual(['original_review', 'final_review', 'comparison']);
    expect(normal.transport).toHaveBeenCalledTimes(5); expect(benchmark.transport).toHaveBeenCalledTimes(6);
    expect(br.evidence.accounting.maximumMicroUsd - nr.evidence.accounting.maximumMicroUsd).toBe(
      wireReservation(normal.p.maxWireBytes, causalOutputCap(8, 'original_review'), normal.p.pricing.rates.astra));
    const other = createCausalTrialHost({ ...normal.args, outputRoot: path.join(normal.root, 'other-root') });
    await expect(other.plan()).rejects.toThrow('provider_or_contract_failed'); expect(other.snapshot().host.failureCode).toBe('family_consumed');
    expect(normal.transport).toHaveBeenCalledTimes(5);
  });
  it.each(['legacy', 'unknown_mode'])('rejects %s policy before artifacts or transport', kind => {
    const h = harness(), invalid: any = structuredClone(h.p);
    if (kind === 'legacy') invalid.version = 'causal-trial-host/v1'; else invalid.reviewMode = 'skip_qa';
    expect(() => createCausalTrialHost({ ...h.args, policy: invalid })).toThrow('policy');
    expect(h.transport).not.toHaveBeenCalled(); expect(existsSync(h.args.outputRoot)).toBe(false);
  });
  it('has no key/transport access at construction and rejects implicit live mode and undersized budget', () => {
    const h = harness(), key = vi.fn(() => 'fake');
    expect(h.transport).not.toHaveBeenCalled(); expect(existsSync(h.args.outputRoot)).toBe(false);
    for (const change of [{ mode: 'live_explicit' }, { maximumMicroUsd: 1 }, { version: 'other' }, { unknown: true }]) {
      expect(() => createCausalTrialHost({ ...h.args, policy: { ...h.p, ...change }, existingOpenAIKey: key })).toThrow('causal_host_');
    }
    expect(key).not.toHaveBeenCalled(); expect(h.transport).not.toHaveBeenCalled();
  });
  it('claim and full outgoing payload are durable before injected transport invocation', async () => {
    const h = harness(); h.transport.mockImplementation(async (wire, call) => {
      const name = call.conversationKey.split(':').slice(-2).join('-'), family = path.join(h.root, 'codex-causal-text-trials', h.p.family);
      expect(existsSync(path.join(family, `claim-${name}.json`))).toBe(true);
      const saved = JSON.parse(readFileSync(path.join(family, `dispatch-${name}.json`), 'utf8'));
      expect(saved.wire.json).toBe(wire.json); expect(saved.wire.digest).toBe(wire.digest);
      return { output: output(call), estimatedMicroUsd: 1, usage: null, raw: null, metadata: {} };
    }); await h.host.plan();
  });
  it('same family cannot replay from another root or new host, including identical request', async () => {
    const h = harness(); await h.host.plan(); h.host.stop();
    const again = createCausalTrialHost({ ...h.args, outputRoot: path.join(h.root, 'other-output') });
    await expect(again.plan()).rejects.toThrow('provider_or_contract_failed'); expect(again.snapshot().host.failureCode).toBe('family_consumed'); expect(h.transport).toHaveBeenCalledTimes(1);
  });
  it('concurrent instances have exactly one family winner', async () => {
    const h = harness(), other = createCausalTrialHost({ ...h.args, outputRoot: path.join(h.root, 'other') });
    const results = await Promise.allSettled([h.host.plan(), other.plan()]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect(h.transport).toHaveBeenCalledTimes(1);
    h.host.stop(); other.stop();
  });
  it('two real processes racing one common family have exactly one winner across output roots', async () => {
    const root = temporary(), script = `const guard = require(${JSON.stringify(path.join(process.cwd(), 'scripts/personal-causal-trial-journal.ts'))});
      try { guard.CausalFamilyJournal.reserve(JSON.parse(process.argv[1])); console.log('WIN'); } catch { console.log('LOSE'); }`;
    const args = { commonDir: root, family: 'process-race-family', coordinatorDigest: 'a'.repeat(64), maximumMicroUsd: 1,
      slots: [{ id: 'case1:plan', capMicroUsd: 1 }], manifest: { synthetic: true } };
    const run = (name: string) => new Promise<string>((resolve, reject) => {
      const child = spawn(process.execPath, ['--require', require.resolve('tsx/cjs'), '--require', './scripts/shims/register-server-only.cjs',
        '-e', script, JSON.stringify({ ...args, outputRoot: path.join(root, name) })], { cwd: process.cwd(), windowsHide: true });
      let out = '', err = ''; child.stdout.on('data', b => { out += b; }); child.stderr.on('data', b => { err += b; });
      child.once('error', reject); child.once('close', code => code === 0 ? resolve(out.trim()) : reject(Error(err)));
    });
    expect((await Promise.all([run('one'), run('two')])).sort()).toEqual(['LOSE', 'WIN']);
  }, 30_000);
  it.each(['empty', 'partial'])('preexisting %s family stays consumed', async kind => {
    const h = harness(), family = path.join(h.root, 'codex-causal-text-trials', h.p.family);
    mkdirSync(family, { recursive: true }); if (kind === 'partial') writeFileSync(path.join(family, 'reservation.json'), '{');
    await expect(h.host.plan()).rejects.toThrow('provider_or_contract_failed'); expect(h.host.snapshot().host.failureCode).toBe('family_consumed'); expect(h.transport).not.toHaveBeenCalled();
    if (kind === 'partial') expect(readFileSync(path.join(family, 'reservation.json'), 'utf8')).toBe('{');
  });
  it('historical family in the old shared namespace cannot be reused by this new driver', async () => {
    const h = harness(); mkdirSync(path.join(h.root, 'codex-text-trials', h.p.family), { recursive: true });
    await expect(h.host.plan()).rejects.toThrow('provider_or_contract_failed');
    expect(h.host.snapshot().host.failureCode).toBe('family_consumed'); expect(h.transport).not.toHaveBeenCalled();
  });
  it.each([null, NaN, Infinity, -1, 0.5, 999_999_999])('unknown/invalid/overrun cost %s seals before another stage', async cost => {
    const h = harness(2, async (_w, c) => ({ output: output(c), estimatedMicroUsd: cost, usage: null, raw: null, metadata: {} }));
    await expect(h.host.plan()).rejects.toThrow(); expect(h.transport).toHaveBeenCalledTimes(1); expect(h.host.snapshot().host.closed).toBe(true);
    await expect(h.host.plan()).rejects.toThrow('terminal');
  });
  it.each([0, 1])('cumulative Opus usage at the slot USD cap + %i keeps the monetary boundary and receipt', async extra => {
    let planCost = 0;
    const h = harness(2, async (_wire, call) => ({ output: output(call), estimatedMicroUsd: planCost + extra,
      usage: { inputTokens: 4, outputTokens: call.maxOutputTokens + 1000 }, metadata: { usageScope: 'cli_cumulative' }, raw: { synthetic: true } }));
    const spreads = h.cases.map(row => preparePersonalStory(row.request, resolvePersonalWizardOptions()).brief.beats);
    planCost = wireReservation(h.p.maxWireBytes, Math.max(...spreads.map(count => causalOutputCap(count, 'plan'))), h.p.pricing.rates.opus);
    if (extra === 0) {
      expect((await h.host.plan()).plans).toHaveLength(2); expect(h.transport).toHaveBeenCalledTimes(2);
      expect(h.host.snapshot().host.closed).toBe(false);
    } else {
      await expect(h.host.plan()).rejects.toThrow('provider_or_contract_failed');
      expect(h.host.snapshot().host.failureCode).toBe('cost'); expect(h.host.snapshot().host.closed).toBe(true);
      expect(h.transport).toHaveBeenCalledTimes(1);
      await expect(h.host.plan()).rejects.toThrow('terminal');
    }
    const receipt = JSON.parse(readFileSync(path.join(h.root, 'codex-causal-text-trials', h.p.family, 'receipt-case1-plan.json'), 'utf8'));
    expect(receipt.receipt.estimatedMicroUsd).toBe(planCost + extra);
    expect(receipt.receipt.usage.outputTokens).toBeGreaterThan(causalOutputCap(spreads[0], 'plan'));
    expect(receipt.receipt.metadata.usageScope).toBe('cli_cumulative');
  });
  it('billed transport failure preserves host usage even though coordinator failure cost stays unknown', async () => {
    const h = harness(1, async () => { throw new CausalTransportError('incomplete', { estimatedMicroUsd: 3,
      usage: { inputTokens: 1, outputTokens: 2 }, metadata: {}, raw: { status: 'incomplete' } }); });
    await expect(h.host.plan()).rejects.toThrow('provider_or_contract_failed');
    const saved = JSON.parse(readFileSync(path.join(h.root, 'codex-causal-text-trials', h.p.family, 'receipt-case1-plan.json'), 'utf8'));
    expect(saved.receipt.estimatedMicroUsd).toBe(3); expect(h.host.snapshot().coordinator.receipts[0].estimatedMicroUsd).toBeNull();
  });
  it('schema-valid but semantically unbound plan seals in host lifecycle after successful transport', async () => {
    const h = harness(1, async (_w, c) => { const raw = output(c); raw.plan.beats[0].factIds = ['foreign'];
      return { output: raw, estimatedMicroUsd: 1, usage: null, metadata: {}, raw: null }; });
    await expect(h.host.plan()).rejects.toThrow('plan_binding'); expect(h.transport).toHaveBeenCalledTimes(1);
    expect(h.host.snapshot().host.closed).toBe(true);
  });
  it('HOLD synopses skip prose; stale/duplicate review fails closed', async () => {
    const h = harness(), bundle = await h.host.plan(); const result = await h.host.write(h.review(bundle, 'hold'));
    expect(result.books).toHaveLength(0); expect(h.transport).toHaveBeenCalledTimes(1);
    const bad = harness(), b = await bad.host.plan();
    await expect(bad.host.write({ ...bad.review(b), sourceDigest: 'f'.repeat(64) })).rejects.toThrow('cohort_binding');
    expect(bad.transport).toHaveBeenCalledTimes(1); expect(bad.host.snapshot().host.closed).toBe(true);
  });
  it('file barrier stays in this instance and refuses hardlinked review files', async () => {
    const h = harness(), b = await h.host.plan(), file = path.join(h.args.outputRoot, 'review.json');
    exclusiveJson(file, h.review(b)); const result = await h.host.writeFromReviewFile(); expect(result.books).toHaveLength(1);
    const other = temporary(), original = path.join(other, 'review.json'); exclusiveJson(original, h.review(b));
    linkSync(original, path.join(other, 'alias.json')); expect(() => readCausalReviewFile(original)).toThrow('review_file');
  });
  it.each(['', '\uFEFF'])('normal or single-BOM review %j parses without modifying its bytes', prefix => {
    const root = temporary(), file = path.join(root, 'review.json');
    const review = { sourceDigest: 'a'.repeat(64), decisions: [{ caseId: 'case1', decision: 'hold', reason: 'Synthetic explicit hold reason.' }] };
    const bytes = Buffer.from(prefix + JSON.stringify(review)); writeFileSync(file, bytes);
    expect(readCausalReviewFile(file)).toEqual(review); expect(readFileSync(file)).toEqual(bytes);
  });
  it.each(['double', 'space-before', 'inside-object', 'trailing'])('does not normalize %s BOM outside JSON strings', kind => {
    const root = temporary(), file = path.join(root, 'review.json');
    const text = JSON.stringify({ sourceDigest: 'a'.repeat(64), decisions: [{ caseId: 'case1', decision: 'hold', reason: 'Synthetic explicit hold reason.' }] });
    const invalid = kind === 'double' ? '\uFEFF\uFEFF' + text : kind === 'space-before' ? ' \uFEFF' + text :
      kind === 'inside-object' ? '{\uFEFF' + text.slice(1) : text + '\uFEFF';
    writeFileSync(file, invalid); expect(() => readCausalReviewFile(file)).toThrow('causal_host_review_file');
    expect(readFileSync(file, 'utf8')).toBe(invalid);
  });
  it('preserves a BOM inside a reason string instead of globally stripping it', () => {
    const root = temporary(), file = path.join(root, 'review.json');
    const reason = 'Synthetic explicit \uFEFF hold reason.';
    writeFileSync(file, '\uFEFF' + JSON.stringify({ sourceDigest: 'a'.repeat(64), decisions: [{ caseId: 'case1', decision: 'hold', reason }] }));
    expect(readCausalReviewFile(file).decisions[0].reason).toBe(reason);
  });
  it.each([10_000, 10_001])('single-BOM review byte limit %d includes the original three prefix bytes', bytes => {
    const root = temporary(), file = path.join(root, 'review.json');
    const text = '\uFEFF' + JSON.stringify({ sourceDigest: 'a'.repeat(64), decisions: [{ caseId: 'case1', decision: 'hold', reason: 'Synthetic explicit hold reason.' }] });
    const padded = Buffer.from(text + ' '.repeat(bytes - Buffer.byteLength(text))); expect(padded.byteLength).toBe(bytes);
    writeFileSync(file, padded);
    if (bytes === 10_000) expect(readCausalReviewFile(file).decisions[0].decision).toBe('hold');
    else expect(() => readCausalReviewFile(file)).toThrow('causal_host_review_file');
    expect(readFileSync(file)).toEqual(padded);
  });
  it('single BOM cannot bypass the hardlink fence', () => {
    const root = temporary(), file = path.join(root, 'review.json');
    writeFileSync(file, '\uFEFF' + JSON.stringify({ sourceDigest: 'a'.repeat(64), decisions: [{ caseId: 'case1', decision: 'hold', reason: 'Synthetic explicit hold reason.' }] }));
    linkSync(file, path.join(root, 'alias.json')); expect(() => readCausalReviewFile(file)).toThrow('causal_host_review_file');
  });
  it.each(['matching', 'stale'])('single-BOM %s decision crosses the real digest-bound host barrier', async kind => {
    const h = harness(), bundle = await h.host.plan(), file = path.join(h.args.outputRoot, 'review.json');
    const review = h.review(bundle, 'hold'); if (kind === 'stale') review.sourceDigest = 'f'.repeat(64);
    const bytes = Buffer.from('\uFEFF' + JSON.stringify(review)); writeFileSync(file, bytes);
    if (kind === 'matching') {
      const result = await h.host.writeFromReviewFile(); expect(result.books).toHaveLength(0);
      expect(JSON.parse(readFileSync(path.join(h.args.outputRoot, 'synopsis-review.json'), 'utf8'))).toEqual(review);
    } else {
      await expect(h.host.writeFromReviewFile()).rejects.toThrow('cohort_binding');
      expect(existsSync(path.join(h.args.outputRoot, 'synopsis-review.json'))).toBe(false);
      expect(existsSync(path.join(h.args.outputRoot, 'books.json'))).toBe(false);
    }
    expect(h.transport).toHaveBeenCalledTimes(1); expect(readFileSync(file)).toEqual(bytes);
    expect(h.host.snapshot().host.closed).toBe(true);
  });
  it('abort during transport seals before late output, which cannot settle or write a story', async () => {
    let release!: (value: any) => void;
    const h = harness(1, async () => new Promise(resolve => { release = resolve; }));
    const planning = h.host.plan(); await vi.waitFor(() => expect(h.transport).toHaveBeenCalledTimes(1));
    h.controller.abort(); await expect(planning).rejects.toThrow('cancelled'); const before = h.host.snapshot();
    const call = h.transport.mock.calls[0][1]; release({ output: output(call), estimatedMicroUsd: 1, usage: null, raw: null, metadata: {} });
    await Promise.resolve(); await Promise.resolve(); expect(h.host.snapshot()).toEqual(before);
    expect(existsSync(path.join(h.root, 'codex-causal-text-trials', h.p.family, 'receipt-case1-plan.json'))).toBe(false);
  });
  it('stage-only deadline seals the host with root signal still live; late rejection remains observed', async () => {
    vi.useFakeTimers(); let reject!: (value: unknown) => void;
    const h = harness(1, async () => new Promise((_r, fail) => { reject = fail; }));
    const planning = h.host.plan(), rejected = expect(planning).rejects.toThrow('timeout');
    await vi.advanceTimersByTimeAsync(1); expect(h.transport).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(780_001); await rejected;
    expect(h.controller.signal.aborted).toBe(false); const before = h.host.snapshot();
    reject(Error('private late detail')); await vi.advanceTimersByTimeAsync(1); expect(h.host.snapshot()).toEqual(before);
  });
  it('directory substitution between phases fails before another transport', async () => {
    const h = harness(), b = await h.host.plan(), family = path.join(h.root, 'codex-causal-text-trials', h.p.family);
    renameSync(family, family + '-original'); mkdirSync(family);
    await expect(h.host.write(h.review(b))).rejects.toThrow('directory_changed'); expect(h.transport).toHaveBeenCalledTimes(1);
  });
  it('changed immutable reservation or hardlinked dispatch stops before more transport calls', async () => {
    for (const tamper of ['bytes', 'hardlink']) {
      const h = harness(), b = await h.host.plan(), file = path.join(h.root, 'codex-causal-text-trials', h.p.family, 'reservation.json');
      if (tamper === 'bytes') writeFileSync(file, '{}'); else linkSync(file, path.join(h.root, 'alias.json'));
      await expect(h.host.write(h.review(b))).rejects.toThrow('causal_host_'); expect(h.transport).toHaveBeenCalledTimes(1);
    }
  });
  it('pinning source changes stops before reserve/key/transport', async () => {
    const h = harness(); h.assertSource.mockImplementation(() => { throw Error('private source detail'); });
    await expect(h.host.plan()).rejects.toThrow('causal_host_failed'); expect(h.transport).not.toHaveBeenCalled();
  });
  it('completion audits earlier receipts after later stages, not only manifest authority', async () => {
    const h = harness(), bundle = await h.host.plan();
    writeFileSync(path.join(h.root, 'codex-causal-text-trials', h.p.family, 'receipt-case1-plan.json'), '{}');
    await expect(h.host.write(h.review(bundle))).rejects.toThrow('record_changed');
    expect(h.transport).toHaveBeenCalledTimes(5); expect(h.host.snapshot().host.closed).toBe(true);
  });
  it('dispatch rechecks the durable claim before creating dispatch evidence', () => {
    const root = temporary(), family = 'direct-journal-family', digest = 'a'.repeat(64);
    const journal = CausalFamilyJournal.reserve({ commonDir: root, outputRoot: path.join(root, 'output'), family, coordinatorDigest: digest,
      maximumMicroUsd: 1, slots: [{ id: 'case1:plan', capMicroUsd: 1 }], manifest: { synthetic: true } });
    journal.claim(family, digest, 'case1:plan'); writeFileSync(path.join(journal.directory, 'claim-case1-plan.json'), '{}');
    expect(() => journal.dispatch('case1:plan', { synthetic: true })).toThrow('record_changed');
    expect(existsSync(path.join(journal.directory, 'dispatch-case1-plan.json'))).toBe(false); journal.seal('test_stopped');
  });
  it('a junction parent cannot confer authority through an ordinary nested directory', () => {
    const root = temporary(), target = path.join(root, 'target'), alias = path.join(root, 'alias');
    mkdirSync(path.join(target, 'nested'), { recursive: true }); symlinkSync(target, alias, 'junction');
    expect(() => realDirectory(path.join(alias, 'nested'))).toThrow('causal_host_directory');
    expect(() => realDirectory(path.join(target, 'nested'))).not.toThrow();
  });
  it.each([10_000, 10_001])('review file boundary%d is tested with otherwise valid JSON', bytes => {
    const root = temporary(), file = path.join(root, 'review.json');
    const text = JSON.stringify({ sourceDigest: 'a'.repeat(64), decisions: [{ caseId: 'case1', decision: 'hold', reason: 'Synthetic explicit hold reason.' }] });
    writeFileSync(file, text + ' '.repeat(bytes - Buffer.byteLength(text)));
    if (bytes === 10_000) expect(readCausalReviewFile(file).decisions[0].decision).toBe('hold');
    else expect(() => readCausalReviewFile(file)).toThrow('causal_host_review_file');
  });
});

describe('actual outgoing SDK wire and diagnostic CLI arguments', () => {
  it.each(['original_review', 'final_review', 'comparison'] as const)('Astra %s HTTP body is byte-identical to preflight, no history/tools/retry', async stage => {
    const root = temporary(), c = { ...criticCall(), stage }, wire = prepareCausalWire(c, wirePolicy(root), 1_000_000), bodies: string[] = [];
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => { bodies.push(String(init?.body)); return new Response(JSON.stringify({ object: 'response', id: 'resp_synthetic',
      model: CAUSAL_MODELS.astra, status: 'completed', service_tier: 'default', usage: { input_tokens: 2, output_tokens: 3 },
      output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '{"value":"ok"}', annotations: [] }] }] }),
      { status: 200, headers: { 'content-type': 'application/json' } }); });
    const key = vi.fn(() => 'synthetic-unused-key'), run = createAstraCausalTransport({ key, rates: wirePolicy(root).rates.astra, fetch: fetcher });
    const reply = await run(wire, c, new AbortController().signal);
    expect(reply.output).toEqual({ value: 'ok' }); expect(reply.estimatedMicroUsd).toBe(5); expect(bodies).toEqual([wire.json]);
    expect(fetcher.mock.calls[0][0].toString()).toBe('https://api.openai.com/v1/responses');
    for (const forbidden of ['previous_response_id', 'conversation', 'tools']) expect(wire.payload).not.toHaveProperty(forbidden);
  });
  it.each([429, 500])('HTTP%s causes exactly one request, fixed safe error, no raw provider leak', async status => {
    const root = temporary(), c = criticCall(), wire = prepareCausalWire(c, wirePolicy(root), 1_000_000);
    const fetcher = vi.fn<typeof fetch>(async () => new Response('{"error":{"message":"PRIVATE_ERROR","type":"server_error"}}', { status }));
    const run = createAstraCausalTransport({ key: () => 'fake', rates: wirePolicy(root).rates.astra, fetch: fetcher });
    await expect(run(wire, c, new AbortController().signal)).rejects.toThrow('causal_host_provider_or_schema'); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(['missing_usage', 'incomplete', 'schema', 'model', 'tier'])('billed %s is held with safe known usage where available', async kind => {
    const root = temporary(), c = criticCall(), wire = prepareCausalWire(c, wirePolicy(root), 1_000_000);
    const reply: any = { object: 'response', id: 'resp_synthetic', model: CAUSAL_MODELS.astra, status: 'completed', service_tier: 'default',
      usage: { input_tokens: 2, output_tokens: 3 }, output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '{"value":"ok"}' }] }] };
    if (kind === 'missing_usage') delete reply.usage; if (kind === 'incomplete') reply.status = 'incomplete';
    if (kind === 'schema') reply.output[0].content[0].text = '{}'; if (kind === 'model') reply.model = 'unapproved'; if (kind === 'tier') reply.service_tier = 'flex';
    const run = createAstraCausalTransport({ key: () => 'fake', rates: wirePolicy(root).rates.astra,
      fetch: async () => new Response(JSON.stringify(reply), { status: 200, headers: { 'content-type': 'application/json' } }) });
    try { await run(wire, c, new AbortController().signal); throw Error('accepted'); }
    catch (error) { expect(error).toBeInstanceOf(CausalTransportError); expect((error as CausalTransportError).receipt.estimatedMicroUsd).toBe(kind === 'missing_usage' ? null : 5); }
  });
  it('full schema/instruction expansion is rejected before key access, not just input text', () => {
    const root = temporary(), p = wirePolicy(root), c = criticCall();
    expect(() => prepareCausalWire({ ...c, schema: z.object({ value: z.string().describe('x'.repeat(104_000)) }) }, p, 1_000_000)).toThrow('wire_limit');
    expect(() => prepareCausalWire({ ...c, instructions: 'x'.repeat(104_000) }, p, 1_000_000)).toThrow('wire_limit');
    expect(() => prepareCausalWire({ ...c, role: 'opus' }, p, 1_000_000)).toThrow('wire_contract');
  });
  it('Astra aggregate output above the cap preserves measured usage but rejects completion', async () => {
    const root = temporary(), c = criticCall(), wire = prepareCausalWire(c, wirePolicy(root), 1_000_000);
    const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ object: 'response', id: 'resp_synthetic',
      model: CAUSAL_MODELS.astra, status: 'completed', service_tier: 'default', usage: { input_tokens: 2, output_tokens: c.maxOutputTokens + 1 },
      output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '{"value":"ok"}' }] }] }),
      { status: 200, headers: { 'content-type': 'application/json' } }));
    const run = createAstraCausalTransport({ key: () => 'fake', rates: wirePolicy(root).rates.astra, fetch: fetcher });
    const error = await run(wire, c, new AbortController().signal).then(() => null, e => e);
    expect(error).toBeInstanceOf(CausalTransportError); expect(error.code).toBe('usage');
    expect(error.receipt.usage.outputTokens).toBe(c.maxOutputTokens + 1); expect(error.receipt.estimatedMicroUsd).toBe(c.maxOutputTokens + 3);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(['input', 'instructions', 'schema'] as const)('self-consistent Astra wire from another%s is refused before key/fetch', field => {
    const root = temporary(), c = criticCall(), other = { ...c };
    if (field === 'input') other.input = '{"synthetic":"different"}';
    if (field === 'instructions') other.instructions += ' Different instructions.';
    if (field === 'schema') other.schema = z.object({ other: z.string() }).strict();
    const wire = prepareCausalWire(other, wirePolicy(root), 1_000_000), key = vi.fn(() => 'fake');
    const fetcher = vi.fn<typeof fetch>(async () => new Response('{}'));
    const run = createAstraCausalTransport({ key, rates: wirePolicy(root).rates.astra, fetch: fetcher });
    return expect(run(wire, c, new AbortController().signal)).rejects.toThrow('wire_contract').then(() => {
      expect(key).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
    });
  });
  it.each([8, 12, 16])('Opus%d stages use exact per-request cap, fresh CLI and no resume/fallback', spreads => {
    const root = temporary(), p = wirePolicy(root);
    for (const stage of ['plan', 'replan', 'author', 'editor'] as const) {
      const c = { ...criticCall(), stage, role: 'opus' as const, maxOutputTokens: causalOutputCap(spreads, stage) };
      const wire = prepareCausalWire(c, p, 1_000_000, path.join(root, `${stage}.txt`));
      expect(wire.stdin).toBe(c.input); expect(wire.args).toContain(CAUSAL_MODELS.opus);
      expect(wire.args).toEqual(['-p', '--safe-mode', '--model', CAUSAL_MODELS.opus, '--effort', 'medium', '--tools', '',
        '--no-session-persistence', '--output-format', 'json', '--max-budget-usd', '1', '--system-prompt-file', path.join(root, `${stage}.txt`),
        '--json-schema', JSON.stringify(zodTextFormat(c.schema, `causal_${stage}`).schema)]);
      expect(wire.payload.environmentOverride).toEqual({ CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(c.maxOutputTokens) });
      for (const forbidden of ['--bare', '--resume', '--continue', '--fallback-model', '--dangerously-skip-permissions']) expect(wire.args).not.toContain(forbidden);
    }
  });
});

describe('draft critique at actual durable host and full serialized wire boundary', () => {
  function findings(call: CausalDispatch, count = 1) {
    const input = JSON.parse(call.input);
    const units = input.packet.manuscript.pages[0].units;
    const ref = (first: number, last: number) => ({ startId: units[first].id, endId: units[last].id,
      anchor: citationTokens(units[first].text).slice(0, 2).join(' ') });
    return Array.from({ length: count }, (_, i) => ({ severity: i === 0 ? 'blocking' : 'meaningful', kind: 'issue',
      criterion: ('א"\u0000\\').repeat(150),
      original: count === 20 ? [
        ref(0, 1), ref(1, 2),
      ] : [ref(0, 0)],
      revised: [], explanation: ('א"\u0000\\').repeat(150) }));
  }
  function materialTransport(count = 1): CausalHostTransport {
    return async (_wire, call) => {
      const out = output(call);
      if (count === 20 && call.stage === 'author') out.pages[0].text += ' טקסט סינתטי לבדיקת מקור הציטוט בלבד'.repeat(20);
      if (call.stage === 'original_review') out.findings = findings(call, count);
      return { output: out, estimatedMicroUsd: 1, usage: null, metadata: {}, raw: {} };
    };
  }
  async function run(h: ReturnType<typeof harness>) { const b = await h.host.plan(); return h.host.write(h.review(b)); }
  it('rejects outside-benchmark/false opt-in before reservation, files or transport', () => {
    const root = temporary(), p = policy(root), transport = vi.fn<CausalHostTransport>();
    expect(() => createCausalTrialHost({ workspace: root, outputRoot: path.join(root, 'output'), cases: causalTrialCohort().slice(0, 1),
      policy: { ...p, draftCritique: true }, signal: new AbortController().signal,
      injected: { commonDir: root, assertSource: vi.fn(), transport } })).toThrow('draft_critique_policy');
    expect(() => createCausalTrialHost({ workspace: root, outputRoot: path.join(root, 'output'), cases: causalTrialCohort().slice(0, 1),
      policy: { ...p, reviewMode: 'benchmark', draftCritique: false }, signal: new AbortController().signal,
      injected: { commonDir: root, assertSource: vi.fn(), transport } })).toThrow('policy');
    expect(transport).not.toHaveBeenCalled(); expect(readdirSync(root)).toEqual([]);
  });
  it('pins and journals exact transfer before editor claim, without increasing slots or caps', async () => {
    const h = harness(1, materialTransport(), 'benchmark', false, true);
    h.p.draftCritique = undefined; // caller cannot turn off the captured manifest
    h.transport.mockImplementation(async (wire, call) => {
      if (call.stage === 'editor') {
        const file = path.join(h.args.outputRoot, 'draft-critique-case1.json');
        expect(existsSync(file)).toBe(true);
        const record = JSON.parse(readFileSync(file, 'utf8'));
        expect(record.editorWireDigest).toBe(wire.digest);
        expect(record.forwardedJson).toBe(canonicalJson(JSON.parse(call.input).draftCritique));
        expect(call.input).toContain(record.forwardedJson);
        expect(JSON.parse(call.input).draftCritique.projectionDigest).toBe(record.context.projectionDigest);
        const manifest = JSON.parse(readFileSync(path.join(h.args.outputRoot, 'manifest.json'), 'utf8'));
        expect(manifest.slots).toHaveLength(7);
        expect(manifest.policy.draftCritique).toBe(true);
        expect(wire.reservedMicroUsd).toBeLessThanOrEqual(manifest.slots.find((s: any) => s.id === 'case1:editor').capMicroUsd);
      }
      return materialTransport()(wire, call, new AbortController().signal);
    });
    const out = await run(h);
    expect(h.transport.mock.calls.map(([, c]) => c.stage)).toEqual(['plan', 'author', 'original_review', 'editor', 'final_review', 'comparison']);
    expect(out.books[0].draftCritique!.context.projection.findings).toHaveLength(1);
    expect(out.books[0].edit.draftCritiqueResponse!.responses).toHaveLength(1);
    expect(h.host.snapshot().host.closed).toBe(true);
  });
  it('maximum escaped critique fits the exact full wire via complete-note omissions', async () => {
    const h = harness(1, materialTransport(20), 'benchmark', false, true), out = await run(h);
    const editor = h.transport.mock.calls.find(([, c]) => c.stage === 'editor')!;
    expect(editor[0].bytes).toBeLessThanOrEqual(104000);
    expect(editor[0].reservedMicroUsd).toBeLessThanOrEqual(h.host.snapshot().host.reservedMicroUsd);
    const p = out.books[0].draftCritique!.context.projection;
    expect(p.findings.length).toBeGreaterThan(0); expect(p.findings.length).toBeLessThan(6);
    expect(p.omitted.capacity).toBeGreaterThan(0); expect(p.omitted.findingLimit).toBe(14);
    expect(p.findings[0].explanation).toBe(('א"\u0000\\').repeat(150));
  });
  it('actual serialized wire shortage omits full notes, not just a character-count heuristic', async () => {
    const base = harness(1, materialTransport(20), 'benchmark', false, true), broad = await run(base);
    const baseWire = base.transport.mock.calls.find(([, c]) => c.stage === 'editor')![0];
    const h = harness(1, materialTransport(20), 'benchmark', false, true, baseWire.bytes - 1000);
    const out = await run(h), wire = h.transport.mock.calls.find(([, c]) => c.stage === 'editor')![0];
    expect(wire.bytes).toBeLessThanOrEqual(h.p.maxWireBytes);
    expect(out.books[0].draftCritique!.context.projection.findings.length).toBeLessThan(broad.books[0].draftCritique!.context.projection.findings.length);
    expect(out.books[0].draftCritique!.context.projection.omitted.capacity).toBeGreaterThan(0);
  });
  it('eligible notes with no full-wire capacity seal before an editor transport', async () => {
    const base = harness(1, undefined, 'benchmark', false, true); await run(base);
    const baseWire = base.transport.mock.calls.find(([, c]) => c.stage === 'editor')![0];
    const h = harness(1, materialTransport(), 'benchmark', false, true, baseWire.bytes + 50);
    await expect(run(h)).rejects.toThrow('draft_critique_editor_capacity');
    expect(h.transport.mock.calls.some(([, c]) => c.stage === 'editor')).toBe(false);
    expect(h.host.snapshot().host.closed).toBe(true);
    expect(existsSync(path.join(h.args.outputRoot, 'draft-critique-case1.json'))).toBe(false);
  });
  it('projection recording failure ends run before editor claim', async () => {
    const h = harness(1, materialTransport(), 'benchmark', false, true), save = CausalFamilyJournal.prototype.save;
    vi.spyOn(CausalFamilyJournal.prototype, 'save').mockImplementation(function(this: CausalFamilyJournal, name, data) {
      if (name === 'draft-critique-case1') throw Error('Private disk-failure text');
      return save.call(this, name, data);
    });
    await expect(run(h)).rejects.toThrow('provider_or_contract_failed');
    expect(h.transport).toHaveBeenCalledTimes(3);
    const journal = path.join(h.root, 'codex-causal-text-trials', h.p.family);
    expect(existsSync(path.join(journal, 'claim-case1-editor.json'))).toBe(false);
  });
  it('saved transfer tampering is detected even without synopsisRepair, before editor claim', async () => {
    const h = harness(1, materialTransport(), 'benchmark', false, true), save = CausalFamilyJournal.prototype.save;
    vi.spyOn(CausalFamilyJournal.prototype, 'save').mockImplementation(function(this: CausalFamilyJournal, name, data) {
      save.call(this, name, data);
      if (name === 'draft-critique-case1') writeFileSync(path.join(this.outputRoot, name + '.json'), '{"tampered":true}');
    });
    await expect(run(h)).rejects.toThrow('provider_or_contract_failed');
    expect(h.transport).toHaveBeenCalledTimes(3);
    expect(existsSync(path.join(h.root, 'codex-causal-text-trials', h.p.family, 'claim-case1-editor.json'))).toBe(false);
  });
  it('original reader receipt tampering fails before projection recording or editor claim', async () => {
    const h = harness(1, materialTransport(), 'benchmark', false, true), settle = CausalFamilyJournal.prototype.settle;
    vi.spyOn(CausalFamilyJournal.prototype, 'settle').mockImplementation(function(this: CausalFamilyJournal, id, receipt) {
      settle.call(this, id, receipt);
      if (id === 'case1:original_review') writeFileSync(path.join(this.directory, 'receipt-case1-original_review.json'), '{"tampered":true}');
    });
    await expect(run(h)).rejects.toThrow('provider_or_contract_failed');
    expect(h.transport).toHaveBeenCalledTimes(3);
    expect(existsSync(path.join(h.args.outputRoot, 'draft-critique-case1.json'))).toBe(false);
    expect(existsSync(path.join(h.root, 'codex-causal-text-trials', h.p.family, 'claim-case1-editor.json'))).toBe(false);
    expect(h.host.snapshot().host.closed).toBe(true);
  });
  it('unexpected fit errors are terminal, not mistaken for capacity or critique-free fallback', async () => {
    const h = harness(1, materialTransport(), 'benchmark', false, true), prepare = adapters.prepareCausalWire;
    vi.spyOn(adapters, 'prepareCausalWire').mockImplementation((call, ...rest) => {
      if (call.stage === 'editor') throw new CausalHostError('argv_limit');
      return prepare(call, ...rest);
    });
    await expect(run(h)).rejects.toThrow('provider_or_contract_failed');
    expect(h.transport).toHaveBeenCalledTimes(3); expect(h.host.snapshot().host.closed).toBe(true);
  });
  it('case-specific records support six fictional books without cross-case response leakage', async () => {
    const h = harness(6, materialTransport(), 'benchmark', false, true), out = await run(h);
    expect(out.books).toHaveLength(6);
    for (let i = 0; i < 6; i++) {
      expect(existsSync(path.join(h.args.outputRoot, 'draft-critique-case' + (i + 1) + '.json'))).toBe(true);
      expect(out.books[i].draftCritique!.caseId).toBe('case' + (i + 1));
      expect(out.books[i].draftCritique!.context.projection.originalDigest).not.toBe(out.books[(i + 1) % 6].draftCritique!.context.projection.originalDigest);
    }
    expect(h.transport).toHaveBeenCalledTimes(36);
  // Thirty-six real durable fake dispatches include fsync. This NEW integration
  // case gets a bounded budget; no existing/global/runtime timeout is changed.
  }, 15_000);
  it('full wire change after recording is rejected before native transport', async () => {
    const h = harness(1, materialTransport(), 'benchmark', false, true), prepare = adapters.prepareCausalWire;
    vi.spyOn(adapters, 'prepareCausalWire').mockImplementation((call, ...rest) => {
      if (call.stage === 'editor' && h.host.snapshot().host.rows.some(r => r.slot === 'case1:editor')) {
        call = { ...call, instructions: call.instructions + '\nMUTATED_AFTER_DURABLE_RECORD' };
      }
      return prepare(call, ...rest);
    });
    await expect(run(h)).rejects.toThrow('provider_or_contract_failed');
    expect(h.transport).toHaveBeenCalledTimes(3);
    expect(h.host.snapshot().host.failureCode).toBe('draft_critique_binding');
    expect(h.host.snapshot().host.rows.find(r => r.slot === 'case1:editor')!.attempted).toBe(false);
  });
});
