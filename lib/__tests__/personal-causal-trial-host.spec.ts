import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { causalTrialCohort } from '../../scripts/personal-causal-cohort';
import { createCausalTrialHost, readCausalReviewFile, causalOutputCap, type CausalHostPolicy, type CausalHostTransport } from '../../scripts/personal-causal-trial-host';
import { CausalFamilyJournal, exclusiveJson, realDirectory } from '../../scripts/personal-causal-trial-journal';
import { prepareCausalWire, CAUSAL_MODELS, CausalTransportError, createAstraCausalTransport, type WirePolicy } from '../../scripts/personal-causal-trial-adapters';
import { BACKWARD_DEPENDENCIES, CAUSAL_EXPERIMENT_VERSION } from '../personal-wizard/story-causal-experiment';
import type { CausalDispatch } from '../personal-wizard/story-causal-experiment-runner';
import { fixtureAdventureSelection } from '../personal-wizard/__tests__/story-planning-fixture';
import { fixtureEditorOutput } from '../personal-wizard/__tests__/personal-storyboard-fixture';

const dirs: string[] = [];
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function temporary() { const d = mkdtempSync(path.join(tmpdir(), 'causal-host-test-')); dirs.push(d); return d; }
function policy(root: string): CausalHostPolicy {
  return { version: 'causal-trial-host/v1', family: 'synthetic-offline-family', sourceHead: 'a'.repeat(40), maximumMicroUsd: 100_000_000,
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
      backwardDependencies: Object.fromEntries(BACKWARD_DEPENDENCIES.map(key => [key, { claim: 'Synthetic causal claim, not an entailment proof.',
        evidence: [{ pageNumber: key === 'earnedPayoff' ? brief.beats : 1, field: 'childAction', quote: 'מציעה דרך אחרת' }] }])),
      plan: { title: 'ההרפתקה החדשה', childGoal: 'למצוא דרך מעניינת', companionWant: 'לנסות וגם לעזור', comicPromise: 'הרעיון מסתבך באופן מצחיק',
        resilience: { mode: brief.resilienceMode, moments: [{ pageNumber: 2, childChoice: 'בוחרת דרך אחרת', whatHelps: 'החבר מקשיב' }] },
        beats: Array.from({ length: brief.beats }, () => ({ location: 'בגינה', transitionReason: 'הגילוי משנה את הדרך', childAction: 'מציעה דרך אחרת',
          companionAction: 'מקשיב ומנסה', consequence: 'מגלים משהו חדש', factIds: [interest], continuity: 'החפץ בידי הילדה' })), ending: 'מוצאים יחד דרך חדשה' } };
  }
  if (call.stage === 'author') return { requestId: brief.requestId, planDigest: input.planDigest, title: 'ההרפתקה החדשה',
    pages: Array.from({ length: brief.beats }, (_, i) => ({ text: `${brief.child.name} מציעה דרך חדשה והחבר מנסה איתה. הם מגלים משהו מצחיק ומשנים את התוכנית. פרט מקורי ${i + 1}` })) };
  if (call.stage === 'editor') {
    const revision = fixtureEditorOutput({ ...call, stage: 'editor' });
    return { version: CAUSAL_EXPERIMENT_VERSION, diagnosis: [], strengths: [], revision: { ...revision,
      plan: { ...revision.plan, beats: revision.plan.beats.map(({ pageNumber: _n, ...beat }) => beat) },
      manuscript: { ...revision.manuscript, pages: revision.manuscript.pages.map(({ pageNumber: _n, ...page }) => page) } } };
  }
  return { packetDigest: input.packetDigest, summary: 'Synthetic critic reading, not literary approval.', findings: [] };
}
function harness(count = 1, change?: CausalHostTransport) {
  const root = temporary(), controller = new AbortController(), p = policy(root), cases = causalTrialCohort().slice(0, count);
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
  it('otherwise valid live admission constructs without reserving or opening a client', () => {
    const h = constructionFixture(), inventory = readdirSync(h.root, { recursive: true });
    const host = createCausalTrialHost(h.args);
    expect(host.snapshot().host.mode).toBe('live_explicit'); expect(host.snapshot().coordinator.phase).toBe('new');
    expect(h.key).not.toHaveBeenCalled(); expect(h.transport).not.toHaveBeenCalled();
    expect(readdirSync(h.root, { recursive: true })).toEqual(inventory); host.stop();
  }, 15_000);
});

describe('one-shot causal trial connection (zero live providers)', () => {
  it('reserves all42slots and crosses the real coordinator in36isolated logical dispatches', async () => {
    const h = harness(6), bundle = await h.host.plan().catch(error => { throw new Error(`${error.message} host=${h.host.snapshot().host.failureCode}`); });
    expect(h.transport).toHaveBeenCalledTimes(6);
    const manifest = JSON.parse(readFileSync(path.join(h.args.outputRoot, 'manifest.json'), 'utf8'));
    expect(manifest.slots).toHaveLength(42); expect(manifest.runtimeEligible).toBe(false);
    expect(existsSync(path.join(h.args.outputRoot, 'synopses.json'))).toBe(true);
    const result = await h.host.write(h.review(bundle));
    expect(result.books).toHaveLength(6); expect(h.transport).toHaveBeenCalledTimes(36);
    expect(new Set(h.transport.mock.calls.map(([, c]) => c.conversationKey)).size).toBe(36);
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
    expect(accounting).toEqual({ reservedMicroUsd: manifest.reservedMicroUsd, logicalAttempts: 36, knownEstimateMicroUsd: 36,
      unknownAttemptCosts: 0, kind: 'estimate_not_invoice', runtimeEligible: false });
    const sealed = JSON.parse(readFileSync(path.join(h.root, 'codex-causal-text-trials', h.p.family, 'sealed.json'), 'utf8'));
    expect(sealed.reason).toBe('completed_diagnostic'); expect(sealed.runtimeEligible).toBe(false);
    expect(sealed.claims).toEqual(h.transport.mock.calls.map(([, c]) => c.conversationKey.split(':').slice(-2).join(':')));
    expect(sealed.settled).toEqual(sealed.claims);
  // This performs36durable filesystem dispatches, not a production latency SLA.
  }, 30_000);
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
    expect(h.transport).toHaveBeenCalledTimes(6); expect(h.host.snapshot().host.closed).toBe(true);
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
