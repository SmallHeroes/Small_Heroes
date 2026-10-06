import { afterEach, describe, expect, it, vi } from 'vitest';
import { citationTokens } from '../personal-wizard/story-source-citations';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import * as readline from 'node:readline';
import * as adapters from '../../scripts/personal-causal-trial-adapters';
import * as frozen from '../../scripts/personal-source-git';
import { createSingleBookCalibration, prepareSingleBookCalibration, renderSingleBookText, singleBookOutcome, singleBookCalibrationCLI } from '../../scripts/personal-single-book-calibration';
import { CausalFamilyJournal, CausalHostError } from '../../scripts/personal-causal-trial-journal';
import { CausalTransportError, type TransportReply } from '../../scripts/personal-causal-trial-adapters';
import { causalTrialCohort } from '../../scripts/personal-causal-cohort';
import { CAUSAL_EXPERIMENT_VERSION } from '../personal-wizard/story-causal-experiment';
import { type CausalDispatch } from '../personal-wizard/story-causal-experiment-runner';
import { fixtureAdventureSelection } from '../personal-wizard/__tests__/story-planning-fixture';
import { fixtureEditorOutput } from '../personal-wizard/__tests__/personal-storyboard-fixture';
import { type CausalHostTransport } from '../../scripts/personal-causal-trial-host';
import { resolvePersonalWizardOptions } from '../personal-wizard/options';

vi.mock('node:readline', async importOriginal => ({
  ...await importOriginal<typeof import('node:readline')>(), createInterface: vi.fn(),
}));

const dirs: string[] = [];
const unitReference = (unit: { id: string; text: string }) => ({ startId: unit.id, endId: unit.id,
  anchor: citationTokens(unit.text).slice(0, 2).join(' ') });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
function temp() { const d = mkdtempSync(path.join(tmpdir(), 'single-book-offline-')); dirs.push(d); return d; }
function mockStdinTTY(value: boolean | undefined) {
  const original = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
  Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value });
  return () => { if (original) Object.defineProperty(process.stdin, 'isTTY', original); else Reflect.deleteProperty(process.stdin, 'isTTY'); };
}
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
function answer(call: CausalDispatch): unknown {
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
        responses: feedback.findings.map((f: any) => ({ findingId: f.id, decision: 'kept', reason: 'Synthetic passage-based reason, not product acceptance.' })) } } : {}),
      revision: { ...revision,
      plan: { ...revision.plan, beats: revision.plan.beats.map(({ pageNumber: _n, ...beat }) => beat) },
      manuscript: { ...revision.manuscript, pages: revision.manuscript.pages.map(({ pageNumber: _n, ...page }) => page) } } };
  }
  return { packetDigest: input.packetDigest, summary: 'Synthetic critic output, NOT literary approval.', findings: [] };
}
function reply(call: CausalDispatch): TransportReply {
  return { output: answer(call), estimatedMicroUsd: 1, usage: { inputTokens: 1, outputTokens: 1 },
    metadata: { reportedModel: 'gpt-6-astra', serviceTier: 'default', status: 'completed', synthetic: true }, raw: { synthetic: true } };
}
function harness(reviewMode: 'normal' | 'benchmark' = 'normal', synopsisRepair = false, draftCritique = false) {
  const root = temp(), controller = new AbortController(), executable = path.join(root, 'synthetic.exe');
  writeFileSync(executable, 'SYNTHETIC NOT EXECUTABLE');
  const policy = { version: 'personal-single-book-calibration/v2' as const, reviewMode, sourceHead: 'a'.repeat(40), executable,
    ...(synopsisRepair ? { synopsisRepair: true as const } : {}),
    ...(draftCritique ? { draftCritique: true as const } : {}),
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

// This exercises the real CLI/driver/host/journal with a mocked TTY and native
// transports. It is not an OS-PTY or provider test. Existing subprocess tests
// below independently exercise real piped/closed-stdin admission.
describe('two same-process review windows through the CLI (zero providers)', () => {
  function cliHarness() {
    const h = harness('normal', true), common = temp(), restoreTTY = mockStdinTTY(true);
    const events = new EventEmitter(); let closed = false;
    const reader = Object.assign(events, { close: vi.fn(() => { if (!closed) { closed = true; events.emit('close'); } }) });
    vi.spyOn(readline, 'createInterface').mockReturnValue(reader as unknown as ReturnType<typeof readline.createInterface>);
    vi.spyOn(frozen, 'gitAt').mockImplementation((_repo, args) => {
      if (args.join(' ') === 'rev-parse HEAD') return Buffer.from('a'.repeat(40));
      if (args.join(' ') === 'status --porcelain') return Buffer.from('');
      if (args.join(' ') === 'rev-parse --path-format=absolute --git-common-dir') return Buffer.from(common);
      throw Error('Unexpected synthetic Git command');
    });
    const transport = vi.fn<CausalHostTransport>(async (_wire, call) => reply(call));
    vi.spyOn(adapters, 'createOpusCausalTransport').mockReturnValue(transport);
    vi.spyOn(adapters, 'createAstraCausalTransport').mockReturnValue(transport);
    const network = vi.fn<typeof fetch>(() => { throw Error('No network permitted'); }); vi.stubGlobal('fetch', network);
    const messages: any[] = [];
    vi.spyOn(console, 'log').mockImplementation(value => { messages.push(JSON.parse(String(value))); });
    const timerSpy = vi.spyOn(globalThis, 'setTimeout');
    const livePolicy = { ...h.policy, mode: 'live_explicit' as const };
    const config = { workspace: process.cwd(), outputParent: h.root, policy: livePolicy, request: h.args.request,
      existingKeyEnvFile: path.join(h.root, 'deliberately-missing-key.env') };
    const file = path.join(h.root, 'cli-config.json'); writeFileSync(file, JSON.stringify(config));
    const spec = prepareSingleBookCalibration(config);
    const task = singleBookCalibrationCLI(['--config', file, '--execute']);
    // Attach rejection observation immediately; tests also assert the exact outcome.
    const outcome = task.then(code => ({ code }), error => ({ error }));
    const status = async (name: string) => { await vi.waitFor(() => expect(messages.some(m => m.status === name)).toBe(true));
      await vi.waitFor(() => expect(reader.listenerCount('line')).toBe(1)); return messages.find(m => m.status === name); };
    const requestRepair = (digest: string) => {
      const bundle = JSON.parse(readFileSync(path.join(spec.bookRoot, 'synopses.json'), 'utf8'));
      writeFileSync(path.join(spec.bookRoot, 'repair-request.json'), JSON.stringify({
        review: { sourceDigest: digest, decisions: [{ caseId: 'case1', decision: 'hold', reason: 'Synthetic HOLD naming a causal contradiction.' }] },
        caseId: 'case1', planningDigest: bundle.plans[0].attempts[0].planningDigest,
        defects: ['The resolution is unsupported by the earlier observation.'],
      }), { flag: 'wx' });
      reader.emit('line', 'repair');
    };
    const cleanup = () => { restoreTTY(); expect(network).not.toHaveBeenCalled();
      expect(reader.listenerCount('line')).toBe(0); expect(reader.listenerCount('close')).toBe(0); };
    return { h, spec, reader, transport, messages, timerSpy, outcome, status, requestRepair, cleanup };
  }
  it.each(['write', 'hold'] as const)('requires a fresh explicit second %s and opens a new 20-minute window', async decision => {
    const h = cliHarness();
    try {
      const first = await h.status('synopsis_review_required'); h.requestRepair(first.sourceDigest);
      const second = await h.status('repaired_synopsis_review_required');
      expect(second.sourceDigest).not.toBe(first.sourceDigest);
      expect(h.transport.mock.calls.map(([, c]) => c.stage)).toEqual(['final_review', 'plan', 'replan']);
      const reviewTimers = h.timerSpy.mock.calls.filter(([, delay]) => delay === 1200000);
      expect(reviewTimers).toHaveLength(2);
      writeFileSync(path.join(h.spec.bookRoot, 'review-repaired.json'), JSON.stringify({ sourceDigest: second.sourceDigest,
        decisions: [{ caseId: 'case1', decision, reason: 'Synthetic fresh whole-plan review, not product acceptance.' }] }), { flag: 'wx' });
      h.reader.emit('line', 'continue'); expect(await h.outcome).toEqual({ code: 0 });
      expect(h.transport.mock.calls.map(([, c]) => c.stage)).toEqual(decision === 'write'
        ? ['final_review', 'plan', 'replan', 'author', 'editor', 'final_review', 'comparison']
        : ['final_review', 'plan', 'replan']);
      expect(existsSync(path.join(h.spec.bookRoot, 'index.html'))).toBe(true);
    } finally { h.reader.close(); h.cleanup(); }
  }, 15_000);
  it.each([
    [1, 'stop'], [1, 'eof'], [1, 'signal'], [2, 'stop'], [2, 'eof'], [2, 'signal'], [2, 'repair'],
  ] as const)('window %i with %s terminates without an author or extra repair', async (window, command) => {
    const h = cliHarness();
    try {
      const first = await h.status('synopsis_review_required');
      if (window === 2) { h.requestRepair(first.sourceDigest); await h.status('repaired_synopsis_review_required'); }
      if (command === 'eof') h.reader.close(); else if (command === 'signal') process.emit('SIGINT'); else h.reader.emit('line', command);
      expect(await h.outcome).toEqual({ code: 2 });
      expect(h.transport.mock.calls.map(([, c]) => c.stage)).toEqual(window === 1 ? ['final_review', 'plan'] : ['final_review', 'plan', 'replan']);
      expect(existsSync(path.join(h.spec.bookRoot, 'index.html'))).toBe(false);
    } finally { h.reader.close(); h.cleanup(); }
  }, 15_000);
  it('EOF during the paid repair cancels immediately instead of losing close and waiting again', async () => {
    const h = cliHarness();
    try {
      const first = await h.status('synopsis_review_required');
      h.transport.mockImplementation(async (_wire, call, signal) => {
        if (call.stage !== 'replan') return reply(call);
        h.reader.close(); expect(signal.aborted).toBe(true);
        return reply(call); // Timely-looking late reply cannot revive authority.
      });
      h.requestRepair(first.sourceDigest);
      expect(await h.outcome).toMatchObject({ error: { code: expect.any(String) } });
      expect(h.messages.some(m => m.status === 'repaired_synopsis_review_required')).toBe(false);
      expect(h.timerSpy.mock.calls.filter(([, delay]) => delay === 1200000)).toHaveLength(1);
      expect(h.transport.mock.calls.map(([, c]) => c.stage)).toEqual(['final_review', 'plan', 'replan']);
    } finally { h.reader.close(); h.cleanup(); }
  }, 15_000);
  it('EOF during authoring cancels the opted-in run and a late reply cannot continue to editing', async () => {
    const h = cliHarness();
    try {
      const first = await h.status('synopsis_review_required');
      h.transport.mockImplementation(async (_wire, call, signal) => {
        if (call.stage === 'author') { h.reader.close(); expect(signal.aborted).toBe(true); }
        return reply(call);
      });
      writeFileSync(path.join(h.spec.bookRoot, 'review.json'), JSON.stringify({ sourceDigest: first.sourceDigest,
        decisions: [{ caseId: 'case1', decision: 'write', reason: 'Synthetic current full-plan decision, not literary approval.' }] }), { flag: 'wx' });
      h.reader.emit('line', 'continue'); expect(await h.outcome).toMatchObject({ error: { code: expect.any(String) } });
      expect(h.transport.mock.calls.map(([, c]) => c.stage)).toEqual(['final_review', 'plan', 'author']);
      expect(existsSync(path.join(h.spec.bookRoot, 'index.html'))).toBe(false);
    } finally { h.reader.close(); h.cleanup(); }
  }, 15_000);
});

describe('one fictional book over the existing causal host, not public rollout', () => {
  function repairFile(h: ReturnType<typeof harness>, bundle: Awaited<ReturnType<ReturnType<typeof createSingleBookCalibration>['plan']>>) {
    const attempts = bundle.plans[0].attempts, chosen = attempts[attempts.length - 1];
    if (!('planningDigest' in chosen)) throw Error('selected fixture required');
    const request = { review: { sourceDigest: bundle.sourceDigest, decisions: [{ caseId: 'case1', decision: 'hold' as const,
      reason: 'INITIAL_HOLD: SUGGESTED_FIX_MUST_NOT_BE_IN_WIRE.' }] }, caseId: 'case1', planningDigest: chosen.planningDigest,
      defects: ['The observation does not explain the decisive choice in the adventure.'] };
    writeFileSync(path.join(h.spec.bookRoot, 'repair-request.json'), JSON.stringify(request), { flag: 'wx' });
    return request;
  }
  function repairedReview(h: ReturnType<typeof harness>, digest: string, decision: 'write' | 'hold' = 'write') {
    writeFileSync(path.join(h.spec.bookRoot, 'review-repaired.json'), JSON.stringify({ sourceDigest: digest,
      decisions: [{ caseId: 'case1', decision, reason: 'FINAL_REVIEW of the whole new plan, synthetic and not product acceptance.' }] }), { flag: 'wx' });
  }
  it('positive repair opt-in changes binding only when present, not reservation or consumed family identity', () => {
    const h = harness(), base = prepareSingleBookCalibration(h.args);
    expect(base.policy).not.toHaveProperty('synopsisRepair'); expect(base.preview).not.toHaveProperty('synopsisRepair');
    h.policy.synopsisRepair = true; const enabled = prepareSingleBookCalibration(h.args);
    expect(enabled.digest).not.toBe(base.digest); expect(enabled.bookFamily).toBe(base.bookFamily);
    expect(enabled.bookReserved).toBe(base.bookReserved); expect(enabled.preview.maximumLogicalAttempts).toBe(7);
    expect(enabled.preview.synopsisRepair).toBe(true);
    (h.policy as any).synopsisRepair = false;
    expect(() => prepareSingleBookCalibration(h.args)).toThrow('calibration_policy');
  });
  it.each(['write', 'hold'] as const)('real injected driver preserves both plans/reviews and fresh %s after one repair', async decision => {
    const h = harness('normal', true), driver = createSingleBookCalibration(h.args), first = await driver.plan();
    const originalBytes = readFileSync(path.join(h.spec.bookRoot, 'synopses.json'));
    const request = repairFile(h, first);
    h.transport.mockImplementation(async (wire, call) => {
      if (call.stage === 'replan') {
        expect(JSON.parse(readFileSync(path.join(h.spec.bookRoot, 'synopsis-repair-request.json'), 'utf8'))).toEqual(request);
        expect(wire.json).not.toContain('SUGGESTED_FIX_MUST_NOT_BE_IN_WIRE');
        const r = reply(call), out: any = r.output;
        out.plan.ending = 'סיום אחר מוכן מתוך הבחירות שכבר התרחשו'; out.synopsis += ' REPAIRED_PLAN_MARKER';
        return r;
      }
      return reply(call);
    });
    delete h.policy.synopsisRepair; // captured by driver; caller cannot disable/broaden it after admission
    const repaired = await driver.repairFromRequestFile();
    expect(repaired.sourceDigest).not.toBe(first.sourceDigest);
    expect(h.transport.mock.calls.map(([, c]) => c.stage)).toEqual(['final_review', 'plan', 'replan']);
    expect(readFileSync(path.join(h.spec.bookRoot, 'synopses.json'))).toEqual(originalBytes);
    expect(JSON.parse(readFileSync(path.join(h.spec.bookRoot, 'synopses-repaired.json'), 'utf8'))).toEqual(repaired);
    expect(existsSync(path.join(h.spec.bookRoot, 'review-template-repaired.json'))).toBe(true);
    repairedReview(h, repaired.sourceDigest, decision);
    const result = await driver.writeFromReviewFile();
    expect(result.books).toHaveLength(decision === 'write' ? 1 : 0);
    const expected = decision === 'write' ? ['final_review', 'plan', 'replan', 'author', 'editor', 'final_review', 'comparison'] : ['final_review', 'plan', 'replan'];
    expect(h.transport.mock.calls.map(([, c]) => c.stage)).toEqual(expected);
    const snapshot = driver.snapshot(); expect(snapshot.phase).toBe('complete'); expect(snapshot.host!.host.reservedMicroUsd).toBe(9248802);
    const html = readFileSync(path.join(h.spec.bookRoot, 'index.html'), 'utf8');
    expect(html).toContain('המתווים והביקורות לפני הכתיבה'); expect(html).toContain('INITIAL_HOLD'); expect(html).toContain('FINAL_REVIEW');
    expect(html).toContain('REPAIRED_PLAN_MARKER'); expect(html).toContain('Synthetic adventure through discovery');
    expect(snapshot.host!.coordinator.plans[0].attempts).toHaveLength(2);
    if (decision === 'hold') expect(html).toContain('לא נכתבה פרוזה ולא נוצר ספר');
    if (decision === 'write') {
      const author = h.transport.mock.calls.find(([, c]) => c.stage === 'author')![1];
      expect(JSON.parse(author.input).planDigest).toBe((repaired.plans[0].attempts[1] as any).planDigest);
    }
    expect(h.key).not.toHaveBeenCalled();
  });
  it('first WRITE in enabled mode skips repair and leaves the five-book-call recipe', async () => {
    const h = harness('normal', true), driver = createSingleBookCalibration(h.args), first = await driver.plan(); h.review(first.sourceDigest);
    expect((await driver.writeFromReviewFile()).books).toHaveLength(1);
    expect(h.transport.mock.calls.map(([, c]) => c.stage)).toEqual(['final_review', 'plan', 'author', 'editor', 'final_review', 'comparison']);
    expect(existsSync(path.join(h.spec.bookRoot, 'synopsis-repair-request.json'))).toBe(false);
  });
  it('a fresh second-review filename does not make an old digest valid', async () => {
    const h = harness('normal', true), driver = createSingleBookCalibration(h.args), first = await driver.plan(); repairFile(h, first);
    await driver.repairFromRequestFile(); repairedReview(h, first.sourceDigest);
    await expect(driver.writeFromReviewFile()).rejects.toThrow('cohort_binding');
    expect(h.transport).toHaveBeenCalledTimes(3); expect(driver.snapshot().phase).toBe('failed');
  });
  it.each(['synopses.json', 'synopses-repaired.json', 'synopsis-repair-request.json'] as const)('tampered immutable %s stops before authoring', async file => {
    const h = harness('normal', true), driver = createSingleBookCalibration(h.args), first = await driver.plan(); repairFile(h, first);
    const repaired = await driver.repairFromRequestFile(); repairedReview(h, repaired.sourceDigest);
    writeFileSync(path.join(h.spec.bookRoot, file), 'tampered synthetic evidence');
    await expect(driver.writeFromReviewFile()).rejects.toThrow('record_changed');
    expect(h.transport).toHaveBeenCalledTimes(3); expect(driver.snapshot().phase).toBe('failed');
  });
  it('tampering with the first synopsis stops before the repair model call', async () => {
    const h = harness('normal', true), driver = createSingleBookCalibration(h.args), first = await driver.plan(); repairFile(h, first);
    writeFileSync(path.join(h.spec.bookRoot, 'synopses.json'), 'tampered synthetic plan');
    await expect(driver.repairFromRequestFile()).rejects.toThrow('record_changed'); expect(h.transport).toHaveBeenCalledTimes(2);
  });
  it('defect and plan strings are escaped in the zero-book held viewer', async () => {
    const h = harness('normal', true), driver = createSingleBookCalibration(h.args), first = await driver.plan();
    const req = repairFile(h, first); req.defects = ['<script>synthetic malicious narrative text</script>'];
    writeFileSync(path.join(h.spec.bookRoot, 'repair-request.json'), JSON.stringify(req));
    const repaired = await driver.repairFromRequestFile(); repairedReview(h, repaired.sourceDigest, 'hold');
    await driver.writeFromReviewFile(); const html = readFileSync(path.join(h.spec.bookRoot, 'index.html'), 'utf8');
    expect(html).not.toContain('<script>'); expect(html).toContain('&lt;script&gt;');
  });
  it('budget preview performs no reservation/key call and pins the complete recipe', () => {
    const h = harness(), before = readdirSync(h.root);
    const prepared = prepareSingleBookCalibration(h.args);
    expect(prepared.preview).toMatchObject({ spreads: 8, probeReservedMicroUsd: 225281,
      reviewMode: 'normal', bookReservedMicroUsd: 9248802, combinedAllowancesMicroUsd: 9498802, maximumLogicalAttempts: 7, providerCalls: 0, runtimeEligible: false });
    expect(h.key).not.toHaveBeenCalled(); expect(h.transport).not.toHaveBeenCalled(); expect(readdirSync(h.root)).toEqual(before);
  });
  it.each(['normal', 'benchmark'] as const)('%s actual book host ceiling equals its smaller active recipe reservation', async mode => {
    const h = harness(mode), driver = createSingleBookCalibration(h.args);
    try {
      await driver.plan();
      const manifest = JSON.parse(readFileSync(path.join(h.spec.bookRoot, 'manifest.json'), 'utf8'));
      const expected = mode === 'normal' ? 9248802 : 11338803;
      expect(manifest.policy.reviewMode).toBe(mode);
      expect(manifest.policy.maximumMicroUsd).toBe(expected);
      expect(manifest.policy.maximumMicroUsd).toBe(h.spec.bookReserved);
      expect(manifest.reservedMicroUsd).toBe(expected);
      expect(manifest.slots.reduce((sum: number, slot: { capMicroUsd: number }) => sum + slot.capMicroUsd, 0)).toBe(expected);
      expect(h.transport).toHaveBeenCalledTimes(2); expect(h.key).not.toHaveBeenCalled();
    } finally { driver.stop(); }
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
  it('persists verified probe result and seals it before the book family is reserved', async () => {
    const h = harness(), reserve = CausalFamilyJournal.reserve;
    let boundaryObserved = false;
    vi.spyOn(CausalFamilyJournal, 'reserve').mockImplementation(args => {
      if (args.family === h.spec.bookFamily) {
        boundaryObserved = true;
        const family = path.join(h.root, 'codex-causal-text-trials', h.spec.probeFamily);
        const probe = JSON.parse(readFileSync(path.join(h.spec.probeRoot, 'probe-result.json'), 'utf8'));
        expect(probe).toEqual({ output: answer(h.spec.probeCall), receipt: reply(h.spec.probeCall),
          providerReportedNotAttestation: true, runtimeEligible: false });
        expect(JSON.parse(readFileSync(path.join(family, 'sealed.json'), 'utf8'))).toEqual({ reason: 'probe_completed',
          claims: ['case1:final_review'], settled: ['case1:final_review'], runtimeEligible: false });
        expect(existsSync(h.spec.bookRoot)).toBe(false);
        expect(existsSync(path.join(h.root, 'codex-causal-text-trials', h.spec.bookFamily))).toBe(false);
      }
      return reserve(args);
    });
    const driver = createSingleBookCalibration(h.args);
    try { await driver.plan(); expect(boundaryObserved).toBe(true); expect(h.transport).toHaveBeenCalledTimes(2); }
    finally { driver.stop(); }
  });
  it('audits probe dispatch bytes at completion before any book reservation', async () => {
    const h = harness(), reserve = vi.spyOn(CausalFamilyJournal, 'reserve');
    h.transport.mockImplementation(async (_wire, call) => {
      writeFileSync(path.join(h.root, 'codex-causal-text-trials', h.spec.probeFamily, 'dispatch-case1-final_review.json'), '{}');
      return reply(call);
    });
    const driver = createSingleBookCalibration(h.args);
    await expect(driver.plan()).rejects.toThrow('causal_host_record_changed');
    expect(reserve).toHaveBeenCalledTimes(1); expect(h.transport).toHaveBeenCalledTimes(1);
    expect(driver.snapshot().probe.receipt).toEqual(reply(h.spec.probeCall));
    expect(existsSync(h.spec.bookRoot)).toBe(false);
    expect(existsSync(path.join(h.root, 'codex-causal-text-trials', h.spec.bookFamily))).toBe(false);
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
  it('normal uses fresh author/editor then isolated final/comparison, without a hidden original review', async () => {
    const h = harness(), driver = createSingleBookCalibration(h.args), b = await driver.plan(); h.review(b.sourceDigest);
    const result = await driver.writeFromReviewFile(); expect(result.books).toHaveLength(1); expect(driver.snapshot().phase).toBe('complete');
    const calls = h.transport.mock.calls.map(([w, c]) => ({ w, c }));
    expect(calls.map(({ c }) => c.stage)).toEqual(['final_review', 'plan', 'author', 'editor', 'final_review', 'comparison']);
    expect(calls.map(({ c }) => c.role)).toEqual(['astra', 'opus', 'opus', 'opus', 'astra', 'astra']);
    expect(new Set(calls.map(({ c }) => c.conversationKey)).size).toBe(6);
    for (const { w, c } of calls.filter(({ c }) => c.role === 'opus')) {
      expect(w.args).toContain('--no-session-persistence'); expect(w.args).toContain('--safe-mode');
      expect(w.payload.freshProcess).toBe(true); expect(w.outputCap).toBe(c.maxOutputTokens);
    }
    for (const { c } of calls.filter(({ c }) => c.stage === 'original_review' || c.stage === 'final_review')) {
      expect(c.input).not.toContain('diagnosis'); expect(c.input).not.toContain('checks');
    }
    expect(driver.snapshot().allowanceMicroUsd).toBe(9498802); expect(driver.snapshot().knownEstimateMicroUsd).toBe(6);
    expect(singleBookOutcome(result)).toBe('text_ready_for_human_review');
    const held = structuredClone(result); held.books[0].edit.disposition = 'held';
    expect(singleBookOutcome(held)).toBe('text_held_by_model');
    const criticised = structuredClone(result); criticised.books[0].readings[0].findings.push({ severity: 'blocking', kind: 'issue',
      criterion: 'Synthetic story defect', original: [], revised: [{ pageNumber: 1, quote: 'Synthetic example' }], explanation: 'Synthetic defect for presentation test.' });
    expect(singleBookOutcome(criticised)).toBe('text_held_by_model');
    criticised.books[0].readings[0].findings[0].kind = 'preference';
    expect(singleBookOutcome(criticised)).toBe('text_ready_for_human_review');
    criticised.books[0].readings.reverse(); // named admission is independent of array position
    criticised.books[0].readings.find(row => row.stage === 'final_review')!.findings[0].kind = 'issue';
    expect(singleBookOutcome(criticised)).toBe('text_held_by_model');
    for (const stages of [['final_review'], ['comparison']]) {
      const incomplete = structuredClone(result); incomplete.books[0].readings = incomplete.books[0].readings.filter(row => stages.includes(row.stage));
      expect(singleBookOutcome(incomplete)).toBe('text_held_by_model');
    }
    const html = readFileSync(path.join(h.spec.bookRoot, 'index.html'), 'utf8'); expect(html).toContain('לא נוצרו איורים');
    expect(html).toContain('הטיוטה המקורית'); expect(html).toContain('הסיפור הערוך');
    const hostile = structuredClone(result); hostile.books[0].original.manuscript.title = '<script>alert(1)</script>';
    expect(renderSingleBookText(hostile)).not.toContain('<script>'); expect(renderSingleBookText(hostile)).toContain('&lt;script&gt;');
    expect(h.key).not.toHaveBeenCalled();
  }, 15000);
  it('benchmark is explicit, costs only its own extra slot and supports read-only v1 archive display', async () => {
    const h = harness('benchmark'), normal = harness();
    expect(h.spec.preview).toMatchObject({ reviewMode: 'benchmark', bookReservedMicroUsd: 11338803,
      combinedAllowancesMicroUsd: 11588803, maximumLogicalAttempts: 8 });
    expect(h.spec.bookReserved - normal.spec.bookReserved).toBe(2090001);
    const driver = createSingleBookCalibration(h.args), b = await driver.plan(); h.review(b.sourceDigest);
    const result = await driver.writeFromReviewFile();
    expect(h.transport).toHaveBeenCalledTimes(7);
    expect(result.books[0].readings.map(row => row.stage)).toEqual(['original_review', 'final_review', 'comparison']);
    result.books[0].readings[0].findings.push({ severity: 'blocking', kind: 'issue', criterion: 'Repaired original defect',
      original: [{ pageNumber: 1, quote: 'Synthetic original' }], revised: [], explanation: 'Synthetic repaired defect must not hold final prose.' });
    expect(singleBookOutcome(result)).toBe('text_ready_for_human_review');
    const legacy = { ...result, evidence: { ...result.evidence, manifest: { ...result.evidence.manifest, version: 'personal-causal-experiment/diagnostic-v1' } },
      books: result.books.map(book => ({ ...book, readings: book.readings.map(({ stage: _stage, ...row }) => row) })) };
    const before = JSON.stringify(legacy);
    expect(singleBookOutcome(legacy)).toBe('text_ready_for_human_review');
    expect(renderSingleBookText(legacy)).toContain('original_review'); expect(JSON.stringify(legacy)).toBe(before);
    legacy.books[0].readings[1].findings = structuredClone(result.books[0].readings[0].findings);
    expect(singleBookOutcome(legacy)).toBe('text_held_by_model');
    legacy.evidence.manifest.version = CAUSAL_EXPERIMENT_VERSION;
    expect(singleBookOutcome(legacy)).toBe('text_held_by_model'); // no positional fallback for current records
  }, 15000);
  it.each(['final_review', 'comparison', 'original_review', 'unknown'] as const)('holds an otherwise clean completed book with duplicate or unknown %s reading', async kind => {
    const h = harness('benchmark'), driver = createSingleBookCalibration(h.args), bundle = await driver.plan(); h.review(bundle.sourceDigest);
    const result = await driver.writeFromReviewFile();
    expect(result.books[0].edit.disposition).toBe('model_supported');
    expect(result.books[0].readings.every(row => row.findings.length === 0)).toBe(true);
    expect(singleBookOutcome(result)).toBe('text_ready_for_human_review');
    const tampered = structuredClone(result), extra = structuredClone(result.books[0].readings.find(row =>
      row.stage === (kind === 'unknown' ? 'final_review' : kind))!);
    if (kind === 'unknown') extra.stage = 'future_review' as typeof extra.stage;
    tampered.books[0].readings.push(extra); // Required final/comparison records remain present and nonblocking.
    expect(singleBookOutcome(tampered)).toBe('text_held_by_model');
    expect(singleBookOutcome(result)).toBe('text_ready_for_human_review');
    expect(h.transport).toHaveBeenCalledTimes(7); expect(h.key).not.toHaveBeenCalled();
  }, 15000);
  it('current clean stage-less records cannot inherit the v1 positional display mapping', async () => {
    const h = harness('benchmark'), driver = createSingleBookCalibration(h.args), bundle = await driver.plan(); h.review(bundle.sourceDigest);
    const result = await driver.writeFromReviewFile();
    expect(singleBookOutcome(result)).toBe('text_ready_for_human_review');
    expect(result.books[0].readings.every(row => row.findings.length === 0)).toBe(true);
    const stageLess = { ...result, books: result.books.map(book => ({ ...book,
      readings: book.readings.map(({ stage: _stage, ...row }) => row) })) };
    const before = JSON.stringify(stageLess);
    expect(singleBookOutcome(stageLess)).toBe('text_held_by_model');
    const legacy = { ...stageLess, evidence: { ...stageLess.evidence,
      manifest: { ...stageLess.evidence.manifest, version: 'personal-causal-experiment/diagnostic-v1' } } };
    expect(singleBookOutcome(legacy)).toBe('text_ready_for_human_review');
    expect(renderSingleBookText(legacy)).toContain('original_review');
    expect(JSON.stringify(stageLess)).toBe(before);
    expect(h.transport).toHaveBeenCalledTimes(7); expect(h.key).not.toHaveBeenCalled();
  }, 15000);
  it('captures the selected mode, derives mode-bound digests, and cannot reuse consent under another mode/root', async () => {
    const h = harness(), driver = createSingleBookCalibration(h.args);
    const normalDigest = prepareSingleBookCalibration(h.args).digest;
    h.policy.reviewMode = 'benchmark'; const benchmark = prepareSingleBookCalibration(h.args);
    expect(benchmark.digest).not.toBe(normalDigest); expect(benchmark.bookFamily).toBe(h.spec.bookFamily);
    const b = await driver.plan(); h.review(b.sourceDigest); const result = await driver.writeFromReviewFile();
    expect(result.evidence.manifest.reviewMode).toBe('normal'); expect(h.transport).toHaveBeenCalledTimes(6);
    expect(() => createSingleBookCalibration({ ...h.args, outputParent: temp() })).toThrow('family_consumed');
    expect(h.transport).toHaveBeenCalledTimes(6);
  }, 15000);
  it.each(['legacy', 'unknown_mode'])('%s calibration policy is rejected before reservation', kind => {
    const h = harness(), invalid: any = structuredClone(h.policy);
    if (kind === 'legacy') invalid.version = 'personal-single-book-calibration/v1'; else invalid.reviewMode = 'skip_qa';
    expect(() => createSingleBookCalibration({ ...h.args, policy: invalid })).toThrow('calibration_policy');
    expect(h.transport).not.toHaveBeenCalled(); expect(h.key).not.toHaveBeenCalled(); expect(existsSync(h.spec.bookRoot)).toBe(false);
  });
  it.each(['remaining_problem', 'new_regression', 'preference', 'improvement'] as const)('admitted comparison %s has the intended text outcome', async kind => {
    const h = harness();
    h.transport.mockImplementation(async (_wire, call) => {
      const response = reply(call);
      if (call.stage === 'comparison') {
        const input = JSON.parse(call.input);
        response.output = { packetDigest: input.packetDigest, summary: 'Synthetic comparison, not a literary verdict.', findings: [{
          severity: 'blocking', kind, criterion: 'Synthetic comparison criterion',
          original: [unitReference(input.packet.original.pages[0].units[0])],
          revised: [unitReference(input.packet.revised.pages[0].units[0])],
          explanation: 'Synthetic comparison evidence for the admitted category.' }] };
      }
      return response;
    });
    const driver = createSingleBookCalibration(h.args), bundle = await driver.plan(); h.review(bundle.sourceDigest);
    const result = await driver.writeFromReviewFile();
    expect(result.books[0].readings.find(row => row.stage === 'comparison')!.findings[0].kind).toBe(kind);
    expect(singleBookOutcome(result)).toBe(['remaining_problem', 'new_regression'].includes(kind)
      ? 'text_held_by_model' : 'text_ready_for_human_review');
    expect(h.transport).toHaveBeenCalledTimes(6); expect(h.key).not.toHaveBeenCalled();
  }, 15000);
  it('a real admitted blocking final reading holds even when it is the first record', async () => {
    const h = harness(); h.transport.mockImplementation(async (_wire, call) => {
      const response = reply(call), input = JSON.parse(call.input);
      if (call.stage === 'final_review' && input.packet.manuscript) response.output = {
        packetDigest: input.packetDigest, summary: 'Synthetic final-only finding, not literary approval.', findings: [{
          severity: 'blocking', kind: 'issue', criterion: 'Unresolved world-rule contradiction', original: [],
          revised: [unitReference(input.packet.manuscript.pages[0].units[0])], explanation: 'A synthetic defect in final prose remains blocking.' }] };
      return response;
    });
    const driver = createSingleBookCalibration(h.args), b = await driver.plan(); h.review(b.sourceDigest);
    const result = await driver.writeFromReviewFile();
    expect(result.books[0].readings[0].stage).toBe('final_review');
    expect(singleBookOutcome(result)).toBe('text_held_by_model'); expect(h.transport).toHaveBeenCalledTimes(6);
    expect(readFileSync(path.join(h.spec.bookRoot, 'index.html'), 'utf8')).toContain('text_held_by_model');
  }, 15000);
  it('escapes original/revised page text and finding explanations in the diagnostic viewer', async () => {
    const h = harness(), driver = createSingleBookCalibration(h.args), bundle = await driver.plan(); h.review(bundle.sourceDigest);
    const result = await driver.writeFromReviewFile(), hostile = structuredClone(result);
    const pageText = '<img src=x onerror="PAGE_INJECTION"> & \'page\'';
    const explanation = '<script>QA_INJECTION</script> & "finding"';
    hostile.books[0].original.manuscript.pages[0].text = pageText;
    hostile.books[0].edit.revised.manuscript.pages[0].text = pageText;
    hostile.books[0].readings[0].findings.push({ severity: 'polish', kind: 'preference', criterion: 'Synthetic viewer evidence',
      original: [], revised: [{ pageNumber: 1, quote: pageText }], explanation });
    const html = renderSingleBookText(hostile);
    expect(html.split('<p>&lt;img src=x onerror=&quot;PAGE_INJECTION&quot;&gt; &amp; &#39;page&#39;</p>')).toHaveLength(3);
    expect(html).not.toContain(pageText);
    expect(html).toContain('&lt;script&gt;QA_INJECTION&lt;/script&gt; &amp; \\&quot;finding\\&quot;');
    expect(html).not.toContain(explanation); expect(html).not.toContain('<script>QA_INJECTION');
  }, 15000);
  it.each([false, undefined])('non-interactive stdin %s fails before construction, handlers, reservation or credentials', async tty => {
    const h = harness(); h.policy.mode = 'live_explicit'; const file = path.join(h.root, 'config.json');
    writeFileSync(file, JSON.stringify({ workspace: h.root, outputParent: h.root, policy: h.policy,
      request: h.args.request, existingKeyEnvFile: path.join(h.root, 'ABSENT-KEY.env') }));
    const restore = mockStdinTTY(tty), reserve = vi.spyOn(CausalFamilyJournal, 'reserve');
    const before = readdirSync(h.root, { recursive: true }), handlers = ['SIGINT', 'SIGTERM'].map(s => process.listeners(s));
    const fetcher = vi.fn<typeof fetch>(() => { throw Error('Unexpected network'); }); vi.stubGlobal('fetch', fetcher);
    try {
      await expect(singleBookCalibrationCLI(['--config', file, '--execute'])).rejects.toThrow('causal_host_interactive_stdin_required');
      expect(reserve).not.toHaveBeenCalled(); expect(h.key).not.toHaveBeenCalled(); expect(h.transport).not.toHaveBeenCalled();
      expect(fetcher).not.toHaveBeenCalled(); expect(readdirSync(h.root, { recursive: true })).toEqual(before);
      expect(['SIGINT', 'SIGTERM'].map(s => process.listeners(s))).toEqual(handlers);
    } finally { restore(); }
  });
  it('constructor failure removes the CLI cancellation handlers and never reads credentials', async () => {
    const h = harness(); h.policy.mode = 'live_explicit'; const file = path.join(h.root, 'config.json');
    writeFileSync(file, JSON.stringify({ workspace: h.root, outputParent: h.root, policy: h.policy,
      request: h.args.request, existingKeyEnvFile: path.join(h.root, 'ABSENT-KEY.env') }));
    const before = ['SIGINT', 'SIGTERM'].map(s => process.listenerCount(s));
    const restore = mockStdinTTY(true);
    try {
      await expect(singleBookCalibrationCLI(['--config', file, '--execute'])).rejects.toThrow('loaded_source_workspace');
      expect(['SIGINT', 'SIGTERM'].map(s => process.listenerCount(s))).toEqual(before);
      expect(existsSync(h.spec.probeRoot)).toBe(false);
    } finally { restore(); }
  });
  it('real launcher rejects closed or pre-piped stdin while help remains non-interactive', () => {
    const h = harness(); h.policy.mode = 'live_explicit'; const file = path.join(h.root, 'config.json');
    writeFileSync(file, JSON.stringify({ workspace: h.root, outputParent: h.root, policy: h.policy,
      request: h.args.request, existingKeyEnvFile: path.join(h.root, 'ABSENT-KEY.env') }));
    const before = readdirSync(h.root, { recursive: true });
    for (const input of ['', 'continue\n']) {
      const run = spawnSync(process.execPath, ['scripts/personal-single-book-calibration.cjs', '--config', file, '--execute'],
        { cwd: process.cwd(), input, windowsHide: true, encoding: 'utf8', timeout: 15000 });
      expect(run.error).toBeUndefined(); expect(run.status).toBe(1); expect(run.stdout).toBe('');
      expect(JSON.parse(run.stderr)).toEqual({ status: 'failed', code: 'interactive_stdin_required', runtimeEligible: false });
      expect(readdirSync(h.root, { recursive: true })).toEqual(before);
    }
    const help = execFileSync(process.execPath, ['scripts/personal-single-book-calibration.cjs', '--help'],
      { cwd: process.cwd(), windowsHide: true, encoding: 'utf8', timeout: 15000 });
    expect(help).toContain('[--execute]'); expect(readdirSync(h.root, { recursive: true })).toEqual(before);
  }, 50000);
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

describe('explicit single-book draft critique admission and evidence viewer', () => {
  async function completed(h: ReturnType<typeof harness>) {
    const driver = createSingleBookCalibration(h.args), b = await driver.plan();
    h.review(b.sourceDigest); return { driver, result: await driver.writeFromReviewFile() };
  }
  it('true-only benchmark admission occurs before probe reservation/key reads', () => {
    const h = harness(), reserve = vi.spyOn(CausalFamilyJournal, 'reserve');
    expect(() => prepareSingleBookCalibration({ ...h.args, policy: { ...h.policy, draftCritique: true } })).toThrow('draft_critique_policy');
    expect(() => createSingleBookCalibration({ ...h.args, policy: { ...h.policy, reviewMode: 'benchmark', draftCritique: false } })).toThrow('calibration_policy');
    expect(reserve).not.toHaveBeenCalled(); expect(h.key).not.toHaveBeenCalled(); expect(h.transport).not.toHaveBeenCalled();
  });
  it('opt-in is digest-bound without a new slot, reservation, model or cap', () => {
    const h = harness('benchmark'), base = prepareSingleBookCalibration(h.args);
    const yes = prepareSingleBookCalibration({ ...h.args, policy: { ...h.policy, draftCritique: true } });
    expect(base.preview).not.toHaveProperty('draftCritique');
    expect(yes.preview.draftCritique).toBe(true); expect(yes.digest).not.toBe(base.digest);
    expect(yes.bookReserved).toBe(base.bookReserved); expect(yes.bookReserved).toBe(11338803);
    expect(yes.preview.maximumLogicalAttempts).toBe(base.preview.maximumLogicalAttempts);
    expect(yes.preview.combinedAllowancesMicroUsd).toBe(11588803);
    expect(yes.preview.models).toEqual(base.preview.models);
  });
  it('real driver captures the policy and empty-feedback trial explicitly does not prove repair', async () => {
    const h = harness('benchmark', false, true), driver = createSingleBookCalibration(h.args);
    delete h.policy.draftCritique;
    const b = await driver.plan(); h.review(b.sourceDigest); const result = await driver.writeFromReviewFile();
    expect(result.evidence.manifest.draftCritique).toBe(true);
    expect(h.transport.mock.calls.map(([, c]) => c.stage)).toEqual(['final_review', 'plan', 'author', 'original_review', 'editor', 'final_review', 'comparison']);
    expect(result.books[0].draftCritique!.context.projection.eligibleFindings).toBe(0);
    const html = renderSingleBookText(result);
    expect(html).toContain('יכולת תיקון בעיה לא נבחנה');
    expect(html.indexOf('id="original"')).toBeLessThan(html.indexOf('id="draft-critique"'));
    expect(html.indexOf('id="draft-critique"')).toBeLessThan(html.indexOf('id="edited"'));
    expect(singleBookOutcome(result)).toBe('text_ready_for_human_review');
    expect(h.key).not.toHaveBeenCalled();
  });
  it('viewer escapes critique and response metadata and never changes held result classification', async () => {
    const h = harness('benchmark', false, true), { result } = await completed(h);
    const hostile = structuredClone(result);
    hostile.books[0].draftCritique!.context.projection.findings.push({ id: 'draft-finding-01', severity: 'meaningful',
      criterion: '<script>hostile</script>', original: [{ pageNumber: 1, quote: '<script>quote</script>' }], explanation: '<script>explain</script>' });
    hostile.books[0].edit.draftCritiqueResponse!.responses.push({ findingId: 'draft-finding-01', decision: 'kept', reason: '<script>response</script>' });
    const final = hostile.books[0].readings.find(r => r.stage === 'final_review')!;
    final.findings.push({ severity: 'blocking', kind: 'issue', criterion: 'Synthetic final blocker',
      original: [], revised: [{ pageNumber: 1, quote: 'Synthetic' }], explanation: 'A final blocker remains despite editor assertions.' });
    const html = renderSingleBookText(hostile);
    expect(html).not.toContain('<script>'); expect(html).toContain('&lt;script&gt;response');
    expect(singleBookOutcome(hostile)).toBe('text_held_by_model');
  });
  it('original-reader failure is sealed before the actual editor or any silent fallback', async () => {
    const h = harness('benchmark', false, true);
    h.transport.mockImplementation(async (_w, c) => {
      const r = reply(c);
      if (c.stage === 'original_review') r.output = { packetDigest: 'f'.repeat(64), summary: 'Synthetic wrong bound packet.', findings: [] };
      return r;
    });
    const driver = createSingleBookCalibration(h.args), b = await driver.plan(); h.review(b.sourceDigest);
    await expect(driver.writeFromReviewFile()).rejects.toThrow('critic_binding');
    expect(h.transport.mock.calls.map(([, c]) => c.stage)).toEqual(['final_review', 'plan', 'author', 'original_review']);
    expect(driver.snapshot().phase).toBe('failed'); expect(existsSync(path.join(h.spec.bookRoot, 'index.html'))).toBe(false);
    expect(h.key).not.toHaveBeenCalled();
  });
});
