import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createSingleBookCalibration, prepareSingleBookCalibration, renderSingleBookText, singleBookOutcome, singleBookCalibrationCLI } from '../../scripts/personal-single-book-calibration';
import { CausalFamilyJournal, CausalHostError } from '../../scripts/personal-causal-trial-journal';
import { CausalTransportError, type TransportReply } from '../../scripts/personal-causal-trial-adapters';
import { causalTrialCohort } from '../../scripts/personal-causal-cohort';
import { BACKWARD_DEPENDENCIES, CAUSAL_EXPERIMENT_VERSION } from '../personal-wizard/story-causal-experiment';
import { type CausalDispatch } from '../personal-wizard/story-causal-experiment-runner';
import { fixtureAdventureSelection } from '../personal-wizard/__tests__/story-planning-fixture';
import { fixtureEditorOutput } from '../personal-wizard/__tests__/personal-storyboard-fixture';
import { type CausalHostTransport } from '../../scripts/personal-causal-trial-host';
import { resolvePersonalWizardOptions } from '../personal-wizard/options';

const dirs: string[] = [];
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
function temp() { const d = mkdtempSync(path.join(tmpdir(), 'single-book-offline-')); dirs.push(d); return d; }
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
function answer(call: CausalDispatch): unknown {
  const input = JSON.parse(call.input), brief = input.brief;
  if (call.stage === 'plan' || call.stage === 'replan') {
    const interest = brief.facts.find((f: any) => f.kind === 'interest').id;
    return { version: CAUSAL_EXPERIMENT_VERSION, requestId: brief.requestId, disposition: 'selected',
      selection: fixtureAdventureSelection(brief.beats, interest),
      synopsis: 'Synthetic adventure through discovery and partnership to a prepared payoff. Not literary proof.',
      backwardDependencies: Object.fromEntries(BACKWARD_DEPENDENCIES.map(key => [key, { claim: 'Synthetic claim, not an entailment proof.',
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
  return { packetDigest: input.packetDigest, summary: 'Synthetic critic output, NOT literary approval.', findings: [] };
}
function reply(call: CausalDispatch): TransportReply {
  return { output: answer(call), estimatedMicroUsd: 1, usage: { inputTokens: 1, outputTokens: 1 },
    metadata: { reportedModel: 'gpt-6-astra', serviceTier: 'default', status: 'completed', synthetic: true }, raw: { synthetic: true } };
}
function harness() {
  const root = temp(), controller = new AbortController(), executable = path.join(root, 'synthetic.exe');
  writeFileSync(executable, 'SYNTHETIC NOT EXECUTABLE');
  const policy = { version: 'personal-single-book-calibration/v1' as const, sourceHead: 'a'.repeat(40), executable,
    executableSha256: sha('SYNTHETIC NOT EXECUTABLE'), mode: 'offline_injected' as 'offline_injected' | 'live_explicit',
    pricing: { source: 'Synthetic test declaration using recipe rates, NOT current price evidence.', checkedAt: new Date().toISOString(),
      rates: { opus: { inputMicroUsdPerToken: 8, outputMicroUsdPerToken: 20 }, astra: { inputMicroUsdPerToken: 12.5, outputMicroUsdPerToken: 50 } } },
    approval: { reference: 'Synthetic TEST-only approval reference; not Guy consent.', maximumMicroUsd: 12000000 as const, acknowledgesCliEstimateLimits: true as const },
    standardConfiguration: { attested: true as const, reference: 'Synthetic operator assertion, not live configuration evidence.' } };
  const transport = vi.fn<CausalHostTransport>(async (_w, c) => reply(c)), key = vi.fn(() => 'NEVER READ');
  const args = { workspace: root, outputParent: root, policy, request: causalTrialCohort()[0].request, signal: controller.signal,
    existingOpenAIKey: key, injected: { commonDir: root, assertSource: vi.fn(), transport } };
  const spec = prepareSingleBookCalibration(args);
  const review = (digest: string, decision: 'write' | 'hold' = 'write') => writeFileSync(path.join(spec.bookRoot, 'review.json'), JSON.stringify({ sourceDigest: digest,
    decisions: [{ caseId: 'case1', decision, reason: 'Synthetic editorial decision, NOT acceptance of real prose.' }] }));
  return { root, controller, policy, args, spec, transport, key, review };
}

describe('one fictional book over the existing causal host, not public rollout', () => {
  it('budget preview performs no reservation/key call and pins the complete recipe', () => {
    const h = harness(), before = readdirSync(h.root);
    const prepared = prepareSingleBookCalibration(h.args);
    expect(prepared.preview).toMatchObject({ spreads: 8, probeReservedMicroUsd: 225281,
      bookReservedMicroUsd: 11338803, combinedAllowancesMicroUsd: 11590000, maximumLogicalAttempts: 8, providerCalls: 0, runtimeEligible: false });
    expect(h.key).not.toHaveBeenCalled(); expect(h.transport).not.toHaveBeenCalled(); expect(readdirSync(h.root)).toEqual(before);
  });
  it('constructor is inert and fingerprints the executable before any family acquisition', () => {
    const h = harness(), reserve = vi.spyOn(CausalFamilyJournal, 'reserve'), before = readdirSync(h.root);
    const driver = createSingleBookCalibration(h.args); expect(driver.snapshot().phase).toBe('ready'); driver.stop();
    h.policy.executableSha256 = 'b'.repeat(64);
    expect(() => createSingleBookCalibration(h.args)).toThrow('causal_host_executable');
    expect(reserve).not.toHaveBeenCalled(); expect(h.key).not.toHaveBeenCalled(); expect(h.transport).not.toHaveBeenCalled();
    expect(readdirSync(h.root)).toEqual(before);
  });
  it.each(['medium', 'long'])('rejects %s length before reservation and key', length => {
    const h = harness(), before = readdirSync(h.root);
    h.args.request.bookOptions.lengthId = length;
    expect(() => createSingleBookCalibration(h.args)).toThrow('fictional_eight_spreads');
    expect(h.key).not.toHaveBeenCalled(); expect(h.transport).not.toHaveBeenCalled(); expect(readdirSync(h.root)).toEqual(before);
  });
  it('rejects non-fixture data before reservation and key', () => {
    const h = harness(), request = h.args.request;
    for (const field of ['nameSource', 'ageSource', 'addressSource', 'residenceSource'] as const) request.child[field] = 'typed';
    for (const fact of request.facts) fact.source = 'typed';
    if (request.storyPlace) request.storyPlace.source = 'typed';
    if (request.intent?.kind === 'topic') delete request.intent.suggestedBy;
    const before = readdirSync(h.root);
    expect(() => createSingleBookCalibration(h.args)).toThrow('fictional_eight_spreads');
    expect(h.key).not.toHaveBeenCalled(); expect(readdirSync(h.root)).toEqual(before);
  });
  it.each(['name', 'age', 'address', 'residence', 'later-fact', 'place', 'direction', 'avoid', 'photo', 'voice'])('rejects mixed or unlabelled %s even when other fixture fields remain', kind => {
    const h = harness(), r = h.args.request, before = readdirSync(h.root), reserve = vi.spyOn(CausalFamilyJournal, 'reserve');
    if (kind === 'name') r.child.nameSource = 'typed';
    if (kind === 'age') r.child.ageSource = 'transcript';
    if (kind === 'address') r.child.addressSource = 'typed';
    if (kind === 'residence') r.child.residenceSource = 'transcript';
    if (kind === 'later-fact') r.facts[r.facts.length - 1].source = 'typed';
    if (kind === 'place') r.storyPlace!.source = 'chip';
    if (kind === 'direction' && r.intent?.kind === 'topic') delete r.intent.suggestedBy;
    if (kind === 'avoid') r.avoid.push('פרט שאין לו סימון דוגמה');
    if (kind === 'photo') r.appearance.photo = 'local_preview_not_sent';
    if (kind === 'voice') r.bookOptions.voiceId = resolvePersonalWizardOptions().voices[0].id;
    expect(() => createSingleBookCalibration(h.args)).toThrow('fixture_only');
    expect(reserve).not.toHaveBeenCalled(); expect(h.key).not.toHaveBeenCalled(); expect(h.transport).not.toHaveBeenCalled();
    expect(readdirSync(h.root)).toEqual(before);
  });
  it.each(['stale', 'future', 'rates', 'injected-live', 'no-injection', 'budget', 'configuration', 'extra'])('rejects %s policy without writing or key use', kind => {
    const h = harness(), args: any = { ...h.args, policy: structuredClone(h.policy) }, before = readdirSync(h.root);
    if (kind === 'stale' || kind === 'future') { args.policy.mode = 'live_explicit'; delete args.injected;
      args.policy.pricing.checkedAt = new Date(Date.now() + (kind === 'future' ? 3600000 : -172800000)).toISOString(); }
    if (kind === 'rates') args.policy.pricing.rates.opus.inputMicroUsdPerToken = 4;
    if (kind === 'injected-live') args.policy.mode = 'live_explicit';
    if (kind === 'no-injection') delete args.injected;
    if (kind === 'budget') args.policy.approval.maximumMicroUsd = 13000000;
    if (kind === 'configuration') args.policy.standardConfiguration.attested = false;
    if (kind === 'extra') args.policy.family = 'another-family';
    const code = ['stale', 'future'].includes(kind) ? 'pricing_stale' : kind === 'rates' ? 'calibration_rates' :
      ['injected-live', 'no-injection'].includes(kind) ? 'authorization' : 'calibration_policy';
    expect(() => createSingleBookCalibration(args)).toThrow(`causal_host_${code}`);
    expect(h.key).not.toHaveBeenCalled(); expect(h.transport).not.toHaveBeenCalled(); expect(readdirSync(h.root)).toEqual(before);
  });
  it('rejects an otherwise valid live policy pointing to a repo other than the loaded module', () => {
    const h = harness(); h.policy.mode = 'live_explicit';
    expect(() => createSingleBookCalibration({ ...h.args, injected: undefined })).toThrow('loaded_source_workspace');
    expect(h.key).not.toHaveBeenCalled(); expect(existsSync(h.spec.probeRoot)).toBe(false);
  });
  it('records probe claim and wire before transport; book is not reserved until probe succeeds', async () => {
    const h = harness(), reserves = vi.spyOn(CausalFamilyJournal, 'reserve');
    h.transport.mockImplementation(async (wire, call) => {
      if (call.conversationKey.startsWith(h.spec.probeFamily)) {
        expect(reserves).toHaveBeenCalledTimes(1);
        const root = path.join(h.root, 'codex-causal-text-trials', h.spec.probeFamily);
        expect(existsSync(path.join(root, 'claim-case1-final_review.json'))).toBe(true);
        expect(JSON.parse(readFileSync(path.join(root, 'dispatch-case1-final_review.json'), 'utf8')).wire.json).toBe(wire.json);
        expect(existsSync(h.spec.bookRoot)).toBe(false);
      }
      return reply(call);
    });
    const driver = createSingleBookCalibration(h.args); await driver.plan();
    expect(reserves).toHaveBeenCalledTimes(2); expect(h.transport).toHaveBeenCalledTimes(2);
    expect(h.key).not.toHaveBeenCalled(); driver.stop();
  });
  it.each(['digest', 'findings', 'model', 'tier', 'status', 'missing-usage', 'output-overrun', 'unknown-cost', 'cost-overrun', 'schema'])('preserves %s probe failure and never reserves a book', async kind => {
    const h = harness(), reserve = vi.spyOn(CausalFamilyJournal, 'reserve');
    h.transport.mockImplementation(async (_w, c) => {
      const r: any = reply(c);
      if (kind === 'digest') r.output.packetDigest = 'f'.repeat(64);
      if (kind === 'findings') r.output.findings = [{ severity: 'blocking', kind: 'issue', criterion: 'Synthetic probe issue',
        original: [{ pageNumber: 1, quote: 'A fictional child' }], revised: [], explanation: 'A probe must not return literary findings.' }];
      if (kind === 'model') r.metadata.reportedModel = 'gpt-6-astra-other';
      if (kind === 'tier') r.metadata.serviceTier = 'priority';
      if (kind === 'status') r.metadata.status = 'incomplete';
      if (kind === 'missing-usage') r.usage = null;
      if (kind === 'output-overrun') r.usage.outputTokens = 2049;
      if (kind === 'unknown-cost') r.estimatedMicroUsd = null;
      if (kind === 'cost-overrun') r.estimatedMicroUsd = 225282;
      if (kind === 'schema') r.output = {};
      return r;
    });
    const driver = createSingleBookCalibration(h.args);
    await expect(driver.plan()).rejects.toThrow(['schema'].includes(kind) ? 'driver_failed' : 'probe_invalid');
    expect(reserve).toHaveBeenCalledTimes(1); expect(h.transport).toHaveBeenCalledTimes(1); expect(driver.snapshot().phase).toBe('failed');
    expect(existsSync(h.spec.bookRoot)).toBe(false); expect(driver.snapshot().probe.receipt).not.toBeNull();
    expect(existsSync(path.join(h.root, 'codex-causal-text-trials', h.spec.probeFamily, 'sealed.json'))).toBe(true);
    await expect(driver.plan()).rejects.toThrow('phase');
  });
  it.each([null, 73])('retains a thrown transport receipt with cost %s, not just successful replies', async cost => {
    const h = harness(); h.transport.mockImplementation(async () => { throw new CausalTransportError('incomplete',
      { usage: cost === null ? null : { inputTokens: 1, outputTokens: 1 }, estimatedMicroUsd: cost, metadata: { status: 'incomplete' }, raw: { observed: 'partial' } }); });
    const driver = createSingleBookCalibration(h.args); await expect(driver.plan()).rejects.toThrow('incomplete');
    const receipt = JSON.parse(readFileSync(path.join(h.root, 'codex-causal-text-trials', h.spec.probeFamily, 'receipt-case1-final_review.json'), 'utf8'));
    expect(receipt.receipt.raw.observed).toBe('partial'); expect(receipt.receipt.estimatedMicroUsd).toBe(cost);
    expect(driver.snapshot().probe.receipt?.estimatedMicroUsd).toBe(cost); expect(existsSync(h.spec.bookRoot)).toBe(false);
  });
  it('one approval cannot replay with another output parent or another fictional child', async () => {
    const h = harness(), driver = createSingleBookCalibration(h.args); await driver.plan(); driver.stop();
    const otherParent = path.join(h.root, 'another'); mkdirSync(otherParent);
    const request = causalTrialCohort()[3].request;
    expect(() => createSingleBookCalibration({ ...h.args, outputParent: otherParent, request })).toThrow('family_consumed');
    expect(readdirSync(otherParent)).toEqual([]); expect(h.transport).toHaveBeenCalledTimes(2);
  });
  it('two constructed instances race for exactly one probe allowance', async () => {
    const h = harness(), otherParent = path.join(h.root, 'another'); mkdirSync(otherParent);
    const a = createSingleBookCalibration(h.args), b = createSingleBookCalibration({ ...h.args, outputParent: otherParent });
    const results = await Promise.allSettled([a.plan(), b.plan()]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect(h.transport).toHaveBeenCalledTimes(2);
    a.stop(); b.stop();
  });
  it.each(['resolve', 'reject'])('cancelled probe ignores late %s and leaves unknown cost explicit', async kind => {
    const h = harness(); let resolve!: (r: TransportReply) => void, reject!: (e: Error) => void;
    h.transport.mockImplementation(() => new Promise((a, b) => { resolve = a; reject = b; }));
    const driver = createSingleBookCalibration(h.args), pending = driver.plan();
    const rejection = expect(pending).rejects.toThrow();
    await vi.waitFor(() => expect(h.transport).toHaveBeenCalledTimes(1)); h.controller.abort(); await rejection;
    const before = JSON.stringify(driver.snapshot()), call = h.transport.mock.calls[0][1];
    if (kind === 'resolve') resolve(reply(call)); else reject(Error('PRIVATE LATE TEST'));
    await new Promise(r => setImmediate(r)); expect(JSON.stringify(driver.snapshot())).toBe(before);
    expect(driver.snapshot().probe).toMatchObject({ attempted: true, receipt: null }); expect(existsSync(h.spec.bookRoot)).toBe(false);
  });
  it('a timed-out non-cooperative probe is terminal with explicit unknown cost and no book', async () => {
    const h = harness(); vi.useFakeTimers(); let resolve!: (r: TransportReply) => void;
    h.transport.mockImplementation(() => new Promise(r => { resolve = r; }));
    const driver = createSingleBookCalibration(h.args), pending = driver.plan();
    const rejected = expect(pending).rejects.toThrow('probe_timeout');
    await vi.advanceTimersByTimeAsync(0); expect(h.transport).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(142001); await rejected;
    const before = JSON.stringify(driver.snapshot()); resolve(reply(h.transport.mock.calls[0][1]));
    await vi.advanceTimersByTimeAsync(0); expect(JSON.stringify(driver.snapshot())).toBe(before);
    expect(driver.snapshot().probe).toMatchObject({ attempted: true, receipt: null, failureCode: 'probe_timeout' });
    expect(existsSync(h.spec.bookRoot)).toBe(false);
    expect(existsSync(path.join(h.root, 'codex-causal-text-trials', h.spec.probeFamily, 'sealed.json'))).toBe(true);
  });
  it.each(['source', 'executable'])('retains the timely probe receipt when %s drift blocks the book', async kind => {
    const h = harness(); h.transport.mockImplementation(async (_w, c) => {
      if (kind === 'source') h.args.injected.assertSource.mockImplementation(() => { throw new CausalHostError('source_changed'); });
      else writeFileSync(h.policy.executable, 'CHANGED EXECUTABLE');
      return reply(c);
    });
    const driver = createSingleBookCalibration(h.args);
    await expect(driver.plan()).rejects.toThrow(kind === 'source' ? 'source_changed' : 'executable');
    expect(h.transport).toHaveBeenCalledTimes(1); expect(existsSync(h.spec.bookRoot)).toBe(false);
    expect(driver.snapshot().probe.receipt?.estimatedMicroUsd).toBe(1);
    const receipt = JSON.parse(readFileSync(path.join(h.root, 'codex-causal-text-trials', h.spec.probeFamily, 'receipt-case1-final_review.json'), 'utf8'));
    expect(receipt.receipt.estimatedMicroUsd).toBe(1);
  });
  it('stale synopsis review stops after probe and plan, without authoring', async () => {
    const h = harness(), driver = createSingleBookCalibration(h.args); await driver.plan(); h.review('f'.repeat(64));
    await expect(driver.writeFromReviewFile()).rejects.toThrow('cohort_binding'); expect(h.transport).toHaveBeenCalledTimes(2);
    expect(existsSync(path.join(h.spec.bookRoot, 'index.html'))).toBe(false);
  });
  it('synopsis HOLD writes an honest diagnostic, not a claimed complete book', async () => {
    const h = harness(), driver = createSingleBookCalibration(h.args), b = await driver.plan(); h.review(b.sourceDigest, 'hold');
    const result = await driver.writeFromReviewFile(); expect(result.books).toHaveLength(0);
    expect(h.transport).toHaveBeenCalledTimes(2); expect(singleBookOutcome(result)).toBe('synopsis_held');
    const html = readFileSync(path.join(h.spec.bookRoot, 'index.html'), 'utf8');
    expect(html).toContain('לא נכתבה פרוזה ולא נוצר ספר'); expect(html).not.toContain('Opus כתב מאפס');
    expect(driver.snapshot().phase).toBe('complete'); // completed diagnostic, not completed book
  });
  it('uses fresh author/editor processes then isolated original/final/comparison Astra calls', async () => {
    const h = harness(), driver = createSingleBookCalibration(h.args), b = await driver.plan(); h.review(b.sourceDigest);
    const result = await driver.writeFromReviewFile(); expect(result.books).toHaveLength(1); expect(driver.snapshot().phase).toBe('complete');
    const calls = h.transport.mock.calls.map(([w, c]) => ({ w, c }));
    expect(calls.map(({ c }) => c.stage)).toEqual(['final_review', 'plan', 'author', 'editor', 'original_review', 'final_review', 'comparison']);
    expect(calls.map(({ c }) => c.role)).toEqual(['astra', 'opus', 'opus', 'opus', 'astra', 'astra', 'astra']);
    expect(new Set(calls.map(({ c }) => c.conversationKey)).size).toBe(7);
    for (const { w, c } of calls.filter(({ c }) => c.role === 'opus')) {
      expect(w.args).toContain('--no-session-persistence'); expect(w.args).toContain('--safe-mode');
      expect(w.payload.freshProcess).toBe(true); expect(w.outputCap).toBe(c.maxOutputTokens);
    }
    for (const { c } of calls.filter(({ c }) => c.stage === 'original_review' || c.stage === 'final_review')) {
      expect(c.input).not.toContain('diagnosis'); expect(c.input).not.toContain('checks');
    }
    expect(driver.snapshot().allowanceMicroUsd).toBe(11590000); expect(driver.snapshot().knownEstimateMicroUsd).toBe(7);
    expect(singleBookOutcome(result)).toBe('text_ready_for_human_review');
    const held = structuredClone(result); held.books[0].edit.disposition = 'held';
    expect(singleBookOutcome(held)).toBe('text_held_by_model');
    const criticised = structuredClone(result); criticised.books[0].readings[1].findings.push({ severity: 'blocking', kind: 'issue',
      criterion: 'Synthetic story defect', original: [], revised: [{ pageNumber: 1, quote: 'Synthetic example' }], explanation: 'Synthetic defect for presentation test.' });
    expect(singleBookOutcome(criticised)).toBe('text_held_by_model');
    criticised.books[0].readings[1].findings[0].kind = 'preference';
    expect(singleBookOutcome(criticised)).toBe('text_ready_for_human_review');
    const repaired = structuredClone(result); repaired.books[0].readings[0].findings = structuredClone(criticised.books[0].readings[1].findings);
    repaired.books[0].readings[0].findings[0].kind = 'issue';
    expect(singleBookOutcome(repaired)).toBe('text_ready_for_human_review');
    const html = readFileSync(path.join(h.spec.bookRoot, 'index.html'), 'utf8'); expect(html).toContain('לא נוצרו איורים');
    expect(html).toContain('הטיוטה המקורית'); expect(html).toContain('הסיפור הערוך');
    const hostile = structuredClone(result); hostile.books[0].original.manuscript.title = '<script>alert(1)</script>';
    expect(renderSingleBookText(hostile)).not.toContain('<script>'); expect(renderSingleBookText(hostile)).toContain('&lt;script&gt;');
    expect(h.key).not.toHaveBeenCalled();
  }, 15000);
  it('constructor failure removes the CLI cancellation handlers and never reads credentials', async () => {
    const h = harness(); h.policy.mode = 'live_explicit'; const file = path.join(h.root, 'config.json');
    writeFileSync(file, JSON.stringify({ workspace: h.root, outputParent: h.root, policy: h.policy,
      request: h.args.request, existingKeyEnvFile: path.join(h.root, 'ABSENT-KEY.env') }));
    const before = ['SIGINT', 'SIGTERM'].map(s => process.listenerCount(s));
    await expect(singleBookCalibrationCLI(['--config', file, '--execute'])).rejects.toThrow('loaded_source_workspace');
    expect(['SIGINT', 'SIGTERM'].map(s => process.listenerCount(s))).toEqual(before);
    expect(existsSync(h.spec.probeRoot)).toBe(false);
  });
  it('real launcher defaults to a data-only preview and never reads the missing credential file', () => {
    const h = harness(); h.policy.mode = 'live_explicit'; const file = path.join(h.root, 'config.json');
    writeFileSync(file, JSON.stringify({ workspace: h.root, outputParent: h.root, policy: h.policy,
      request: h.args.request, existingKeyEnvFile: path.join(h.root, 'ABSENT-KEY.env') }));
    const out = execFileSync(process.execPath, ['scripts/personal-single-book-calibration.cjs', '--config', file],
      { cwd: process.cwd(), windowsHide: true, encoding: 'utf8', timeout: 15000 });
    expect(JSON.parse(out)).toMatchObject({ mode: 'budget_preview_only_no_reservation', providerCalls: 0 });
    expect(existsSync(h.spec.probeRoot)).toBe(false); expect(existsSync(h.spec.bookRoot)).toBe(false);
    expect(existsSync(path.join(h.root, 'codex-causal-text-trials'))).toBe(false);
  }, 20000);
});
