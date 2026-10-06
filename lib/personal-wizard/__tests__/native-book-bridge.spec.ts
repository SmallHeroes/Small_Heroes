import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import * as readline from 'node:readline';
import * as frozen from '../../../scripts/personal-source-git';
import { build } from 'esbuild';
import * as adapters from '../../../scripts/personal-causal-trial-adapters';
import { causalTrialCohort } from '../../../scripts/personal-causal-cohort';
import { nativeBridgeConfig, enqueueNativeBook, nativeQueueDirectory, readNativeStatus, queuedNativeRequest, claimNativeWorker, emptyNativeView,
  resolveNativeBookSettings, type NativeBridgeConfig } from '../native-book-bridge';
import { assertReviewedTextAuthorization, reviewedTextDigest } from '../reviewed-text-authorization';
import { readNativeBookView, newerNativeBookView } from '../native-book-preview';
import { preparePersonalStory } from '../story-writer';
import { resolvePersonalWizardOptions } from '../options';
import { prepareSingleBookCalibration } from '../../../scripts/personal-single-book-calibration';
import { nativeWizardWorkerCLI } from '../../../scripts/personal-native-wizard-worker';
import { fixtureAdventureSelection } from './story-planning-fixture';
import { fixtureEditorOutput } from './personal-storyboard-fixture';
import { CAUSAL_EXPERIMENT_VERSION } from '../story-causal-experiment';
import type { CausalDispatch } from '../story-causal-experiment-runner';
import { citationTokens } from '../story-source-citations';

vi.mock('node:readline', async original => ({ ...await original<typeof import('node:readline')>(), createInterface: vi.fn() }));
const roots: string[] = [];
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); roots.splice(0).forEach(d => rmSync(d, { recursive: true, force: true })); });
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
function setup() {
  const root = mkdtempSync(path.join(tmpdir(), 'native-wizard-test-')); roots.push(root);
  const common = path.join(root, 'common'), outputs = path.join(root, 'outputs'); mkdirSync(common); mkdirSync(outputs);
  const exe = path.join(root, 'synthetic.exe'); writeFileSync(exe, 'SYNTHETIC NOT A REAL EXECUTABLE');
  const config: NativeBridgeConfig = { version: 'local-native-wizard-config/v1', workspace: process.cwd(), outputParent: outputs,
    existingKeyEnvFile: path.join(root, 'NEVER-READ.env'), policy: {
      version: 'personal-single-book-calibration/v2', reviewMode: 'benchmark', synopsisRepair: true, draftCritique: true,
      sourceHead: 'a'.repeat(40), executable: exe, executableSha256: sha('SYNTHETIC NOT A REAL EXECUTABLE'), mode: 'live_explicit',
      approval: { reference: 'SYNTHETIC TEST authorization, not a paid human approval.', maximumMicroUsd: 12000000, acknowledgesCliEstimateLimits: true },
      standardConfiguration: { attested: true, reference: 'SYNTHETIC test-only configuration assertion.' },
      pricing: { source: 'SYNTHETIC recipe rates, not a current price verification.', checkedAt: new Date().toISOString(),
        rates: { opus: { inputMicroUsdPerToken: 8, outputMicroUsdPerToken: 20 }, astra: { inputMicroUsdPerToken: 12.5, outputMicroUsdPerToken: 50 } } },
    } };
  vi.spyOn(frozen, 'gitAt').mockImplementation((_repo, argv) => {
    if (argv.join(' ') === 'rev-parse HEAD') return Buffer.from('a'.repeat(40));
    if (argv.join(' ') === 'status --porcelain') return Buffer.from('');
    if (argv.join(' ') === 'rev-parse --path-format=absolute --git-common-dir') return Buffer.from(common);
    throw Error('UNEXPECTED TEST GIT COMMAND');
  });
  const request = structuredClone(causalTrialCohort()[0].request) as any;
  for (const key of ['nameSource', 'ageSource', 'addressSource', 'residenceSource']) request.child[key] = 'typed';
  request.facts.forEach((f: any) => { f.source = 'typed'; });
  if (request.storyPlace) request.storyPlace.source = 'typed';
  if (request.intent?.kind === 'topic') delete request.intent.suggestedBy;
  const prepared = preparePersonalStory(request, resolvePersonalWizardOptions()), file = path.join(root, 'config.json');
  writeFileSync(file, JSON.stringify(config));
  const input = { request, requestId: prepared.accepted.requestId, userId: 'synthetic-owner' };
  return { root, common, outputs, config, file, input, prepared };
}
function syntheticAnswer(call: CausalDispatch) {
  const input = JSON.parse(call.input), brief = input.brief;
  if (call.stage === 'plan' || call.stage === 'replan') {
    const factId = brief.facts.find((f: any) => f.kind === 'interest').id;
    return { version: CAUSAL_EXPERIMENT_VERSION, requestId: brief.requestId, disposition: 'selected',
      selection: fixtureAdventureSelection(8, factId), synopsis: 'Synthetic complete adventure with discovery, meaningful partnership and prepared resolution.',
      plan: { title: 'הרפתקת בדיקה', childGoal: 'למצוא דרך מעניינת', companionWant: 'לנסות וגם לעזור', comicPromise: 'הרעיון מסתבך באופן מצחיק',
        resilience: { mode: brief.resilienceMode, moments: [{ pageNumber: 2, childChoice: 'בוחרת דרך אחרת', whatHelps: 'החבר מקשיב' }] },
        beats: Array.from({ length: 8 }, () => ({ location: 'בגינה', transitionReason: 'הגילוי משנה את הדרך', childAction: 'מציעה דרך אחרת',
          companionAction: 'מקשיב ומנסה', consequence: 'מגלים משהו חדש', factIds: [factId], continuity: 'החפץ בידי הילדה' })), ending: 'מוצאים יחד דרך חדשה' } };
  }
  if (call.stage === 'author') return { requestId: brief.requestId, planDigest: input.planDigest, title: 'הרפתקת בדיקה',
    pages: Array.from({ length: 8 }, (_, i) => ({ text: `${brief.child.name} מציעה דרך חדשה והחבר מנסה איתה. הם מגלים משהו מצחיק ומשנים את התוכנית. פרט בדיקה ${i + 1}` })) };
  if (call.stage === 'editor') {
    const revision = fixtureEditorOutput({ ...call, stage: 'editor' });
    return { version: CAUSAL_EXPERIMENT_VERSION, draftCritiqueResponse: { projectionDigest: input.draftCritique.projectionDigest,
      responses: input.draftCritique.findings.map((f: any) => ({ findingId: f.id, decision: 'kept', reason: 'Synthetic text-based reason; not proof of a literary repair.' })) },
      revision: { ...revision, plan: { ...revision.plan, beats: revision.plan.beats.map(({ pageNumber: _n, ...b }) => b) },
        manuscript: { ...revision.manuscript, pages: revision.manuscript.pages.map(({ pageNumber: _n, ...p }) => p) } } };
  }
  return { packetDigest: input.packetDigest, summary: 'Synthetic model reading, never literary approval.', findings: [] };
}
async function execute(h: ReturnType<typeof setup>, mode: false | true | 'findings' | 'blocking' = false) {
  const calls: CausalDispatch[] = [], events = new EventEmitter();
  vi.spyOn(readline, 'createInterface').mockReturnValue(Object.assign(events, { close: () => events.emit('close') }) as any);
  const transport = vi.fn(async (_wire, call: CausalDispatch) => {
    calls.push(call); const input = JSON.parse(call.input); let output: any = syntheticAnswer(call);
    if (mode === true && call.stage === 'original_review') {
      output.findings = [{ severity: 'meaningful', kind: 'issue', criterion: 'Synthetic criterion with a bad citation.', explanation: 'Synthetic test defect, not a real reading.',
        original: [{ startId: 'o-p1-u1', endId: 'o-p1-u1', anchor: 'five invalid words not matching' }], revised: [] }];
    }
    if ((mode === 'findings' || mode === 'blocking') && input.packet?.citationVersion) {
      const ref = (unit: { id: string; text: string }) => ({ startId: unit.id, endId: unit.id, anchor: citationTokens(unit.text).slice(0, 2).join(' ') });
      const comparison = call.stage === 'comparison', original = call.stage === 'original_review';
      output.findings = [{ severity: mode === 'blocking' && comparison ? 'blocking' : 'meaningful',
        kind: comparison ? mode === 'blocking' ? 'new_regression' : 'remaining_problem' : 'issue',
        criterion: 'Synthetic source-supported scene note; not literary acceptance.',
        explanation: 'Synthetic retained finding must remain visible to the parent.',
        original: original || comparison ? [ref((comparison ? input.packet.original : input.packet.manuscript).pages[0].units[0])] : [],
        revised: !original ? [ref((comparison ? input.packet.revised : input.packet.manuscript).pages[0].units[0])] : [] }];
    }
    return { output, estimatedMicroUsd: 1, usage: { inputTokens: 1, outputTokens: 1 },
      metadata: { reportedModel: 'gpt-6-astra', serviceTier: 'default', status: 'completed', synthetic: true }, raw: { synthetic: true } };
  });
  vi.spyOn(adapters, 'createAstraCausalTransport').mockReturnValue(transport);
  vi.spyOn(adapters, 'createOpusCausalTransport').mockReturnValue(transport);
  const auth = queuedNativeRequest(h.config).queued.authorization;
  const spec = prepareSingleBookCalibration({ ...h.config, request: h.input.request, reviewedTextAuthorization: auth });
  vi.spyOn(console, 'log').mockImplementation(text => {
    const record = JSON.parse(String(text));
    if (record.status === 'synopsis_review_required') {
      writeFileSync(path.join(spec.bookRoot, 'review.json'), JSON.stringify({ sourceDigest: record.sourceDigest,
        decisions: [{ caseId: 'case1', decision: 'write', reason: 'Synthetic test gate, not approval of a real story.' }] }));
      queueMicrotask(() => events.emit('line', 'continue'));
    }
  });
  const old = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
  Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: true });
  try { return { code: await nativeWizardWorkerCLI(['--config', h.file, '--execute']), calls }; }
  catch (error) { return { error, calls }; }
  finally { if (old) Object.defineProperty(process.stdin, 'isTTY', old); else Reflect.deleteProperty(process.stdin, 'isTTY'); }
}
describe('one-approval local native wizard connector', () => {
  it('the actual API bundle excludes the offline source compiler and esbuild runtime', async () => {
    const bundled = await build({ entryPoints: [path.resolve('app/api/dev/personal-wizard/native-book/route.ts')],
      bundle: true, platform: 'node', packages: 'external', write: false, metafile: true });
    expect(Object.keys(bundled.metafile!.inputs).some(p => p.endsWith('personal-story-frozen-engine.ts'))).toBe(false);
    expect(Object.values(bundled.metafile!.outputs).flatMap(o => o.imports).some(i => i.path === 'esbuild')).toBe(false);
  });
  it('is default off and never lets a browser configure a key/model/worker', () => {
    expect(resolveNativeBookSettings({})).toBeNull();
    expect(resolveNativeBookSettings({ PERSONAL_WIZARD_PREVIEW: 'true', PERSONAL_WIZARD_NATIVE_BOOK_RUNNER: 'true' })).toBeNull();
  });
  it('display model names exactly match the existing native transport authority', () => {
    expect(emptyNativeView('a'.repeat(64)).models).toEqual({ author: adapters.CAUSAL_MODELS.opus,
      editor: adapters.CAUSAL_MODELS.opus, critic: adapters.CAUSAL_MODELS.astra });
  });
  it('preserves typed data; legacy fixture-only admission remains closed', () => {
    const h = setup(); expect(h.prepared.accepted.containsFixtureData).toBe(false);
    expect(() => prepareSingleBookCalibration({ ...h.config, request: h.input.request })).toThrow('fictional_eight_spreads');
    enqueueNativeBook(h.config, h.input); const q = queuedNativeRequest(h.config);
    expect(q.queued.request).toEqual(h.prepared.accepted.canonical);
    expect(() => prepareSingleBookCalibration({ ...h.config, request: q.queued.request, reviewedTextAuthorization: q.queued.authorization })).not.toThrow();
  });
  it.each(['requestId', 'requestDigest', 'optionsFingerprint', 'sourceHead', 'approvalReference'])('refuses altered authorization %s', field => {
    const h = setup(); enqueueNativeBook(h.config, h.input); const auth = queuedNativeRequest(h.config).queued.authorization;
    const altered = { ...auth, [field]: field === 'approvalReference' ? 'another synthetic authorization reference' : 'b'.repeat(field === 'sourceHead' ? 40 : 64) };
    expect(() => assertReviewedTextAuthorization(altered, h.prepared, h.config.policy.approval.reference, h.config.policy.sourceHead)).toThrow();
    expect(() => prepareSingleBookCalibration({ ...h.config, request: h.input.request, reviewedTextAuthorization: altered })).toThrow('reviewed_text_authorization');
  });
  it('identical POST is idempotent; owner/request/config/output-root substitution cannot mint spend', () => {
    const h = setup(); const first = enqueueNativeBook(h.config, h.input);
    expect(enqueueNativeBook(h.config, h.input)).toEqual(first);
    expect(() => enqueueNativeBook(h.config, { ...h.input, userId: 'other-owner' })).toThrow('native_approval_consumed');
    const changed = structuredClone(h.input.request); changed.child.name = 'אחר';
    const prepared = preparePersonalStory(changed, resolvePersonalWizardOptions());
    expect(() => enqueueNativeBook(h.config, { ...h.input, request: changed, requestId: prepared.accepted.requestId })).toThrow('native_approval_consumed');
    expect(() => enqueueNativeBook({ ...h.config, outputParent: h.root }, h.input)).toThrow('native_config_changed');
    expect(readdirSync(path.join(h.common, 'codex-native-wizard'))).toHaveLength(1);
  });
  it('rejects a detached browser identity, wrong owner and stale view', () => {
    const h = setup(); expect(() => enqueueNativeBook(h.config, { ...h.input, requestId: 'b'.repeat(64) })).toThrow('native_request_binding');
    expect(existsSync(nativeQueueDirectory(h.config))).toBe(false);
    enqueueNativeBook(h.config, h.input);
    expect(() => readNativeStatus(h.config, 'other-owner', h.input.requestId)).toThrow('native_owner');
    expect(readNativeBookView(emptyNativeView(h.input.requestId), 'b'.repeat(64))).toBeNull();
    expect(readNativeBookView({ ...emptyNativeView(h.input.requestId), phase: 'complete' }, h.input.requestId)).toBeNull();
  });
  it('worker claim is exclusive; reading and preview never claim or dispatch', async () => {
    const h = setup(); enqueueNativeBook(h.config, h.input); const transport = vi.spyOn(adapters, 'createAstraCausalTransport');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await nativeWizardWorkerCLI(['--config', h.file])).toBe(0);
    expect(readNativeStatus(h.config, h.input.userId, h.input.requestId).phase).toBe('queued');
    expect(transport).not.toHaveBeenCalled();
    claimNativeWorker(h.config); expect(() => claimNativeWorker(h.config)).toThrow();
    expect(readNativeStatus(h.config, h.input.userId, h.input.requestId).phase).toBe('queued');
  });
  it('late queue replies do not replace a later failure or another request', () => {
    const queued = emptyNativeView('a'.repeat(64)), failed = { ...queued, revision: 4, phase: 'failed' as const, error: 'critic_evidence' };
    expect(newerNativeBookView(failed, queued)).toBe(failed);
    expect(newerNativeBookView(failed, emptyNativeView('b'.repeat(64))).requestId).toBe('b'.repeat(64));
  });
  it('real queue -> native driver -> editor -> all readings -> status, with unmodified provenance', async () => {
    const h = setup(); enqueueNativeBook(nativeBridgeConfig(h.file), h.input);
    const result = await execute(h); expect(result.error).toBeUndefined(); expect(result.code).toBe(0);
    expect(result.calls.map(c => c.stage)).toEqual(['final_review', 'plan', 'author', 'original_review', 'editor', 'final_review', 'comparison']);
    expect(result.calls.filter(c => ['plan', 'author', 'editor'].includes(c.stage)).every(c => c.role === 'opus')).toBe(true);
    expect(new Set(result.calls.map(c => c.conversationKey)).size).toBe(7);
    const view = readNativeStatus(h.config, h.input.userId, h.input.requestId);
    expect(view).toMatchObject({ phase: 'complete', runtimeEligible: false, accounting: { logicalAttempts: 7, knownEstimateMicroUsd: 7 } });
    expect(view.original?.pages).toHaveLength(8); expect(view.edited?.pages).toHaveLength(8); expect(view.readings).toHaveLength(3);
    expect(queuedNativeRequest(h.config).queued.request).toEqual(h.prepared.accepted.canonical);
    expect(existsSync(h.config.existingKeyEnvFile)).toBe(false);
  });
  it('malformed original citation retains source-compiled draft, stops before editor, and never retries', async () => {
    const h = setup(); enqueueNativeBook(h.config, h.input); const result = await execute(h, true);
    expect(result.error).toBeDefined(); expect(result.calls.map(c => c.stage)).toEqual(['final_review', 'plan', 'author', 'original_review']);
    const view = readNativeStatus(h.config, h.input.userId, h.input.requestId);
    expect(view).toMatchObject({ phase: 'failed', error: 'critic_evidence', edited: null, readings: [], runtimeEligible: false,
      accounting: { logicalAttempts: 4, knownEstimateMicroUsd: 4 } });
    expect(view.original?.pages).toHaveLength(8); expect(enqueueNativeBook(h.config, h.input)).toEqual(view);
    expect(() => claimNativeWorker(h.config)).toThrow(); expect(result.calls).toHaveLength(4);
  });
  it.each(['findings', 'blocking'] as const)('nonempty source-bound notes survive the real editor/three-reading view (%s)', async mode => {
    const h = setup(); enqueueNativeBook(h.config, h.input); const result = await execute(h, mode);
    expect(result.error, JSON.stringify(result.calls.map(c => c.stage))).toBeUndefined(); expect(result.code).toBe(0); expect(result.calls).toHaveLength(7);
    const view = readNativeStatus(h.config, h.input.userId, h.input.requestId);
    expect(view.phase).toBe(mode === 'blocking' ? 'held' : 'complete');
    expect(view.readings.map(r => r.findings.length)).toEqual([1, 1, 1]);
    for (const reading of view.readings) for (const finding of reading.findings) {
      expect(finding.explanation).toContain('must remain visible');
      for (const q of finding.original) expect(view.original!.pages[q.pageNumber - 1].text).toContain(q.quote);
      for (const q of finding.revised) expect(view.edited!.pages[q.pageNumber - 1].text).toContain(q.quote);
    }
    const editor = JSON.parse(result.calls.find(c => c.stage === 'editor')!.input);
    expect(editor.draftCritique.findings).toHaveLength(1);
    if (mode === 'blocking') expect(view.readings[2].findings[0]).toMatchObject({ kind: 'new_regression', severity: 'blocking' });
    expect(view.runtimeEligible).toBe(false); expect(view.error).toBeNull();
  });
});
