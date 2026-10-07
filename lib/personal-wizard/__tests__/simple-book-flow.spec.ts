import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
const sdk = vi.hoisted(() => ({ create: vi.fn(), options: [] as any[] }));
vi.mock('openai', () => ({ default: class {
  responses = { create: sdk.create }; constructor(options: unknown) { sdk.options.push(options); }
} }));
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { resolvePersonalWizardOptions } from '../options';
import { prepareSimpleStory, type SimpleStoryDraft, type SimpleStoryCall } from '../simple-story-engine';
import { runSimpleWizardBook } from '../simple-book-flow';
import { emptySimpleBookView, readSimpleBookView, newerSimpleBookView } from '../simple-book-view';
import { SimpleBookBudget, simpleBookExternalCosts } from '../simple-book-budget';
import { enqueueSimpleBook, simpleBookQueueDirectory, claimSimpleBookWorker, simpleBookConfig, type SimpleBookConfig } from '../simple-book-bridge';
import * as frozen from '../../../scripts/personal-source-git';
import * as journal from '../../../scripts/personal-causal-trial-journal';
import { GET, POST } from '@/app/api/dev/personal-wizard/simple-book/route';
import { simpleWizardReadingPayload, simpleWizardVisualPayload, simpleWizardWorkerCLI } from '../../../scripts/personal-simple-wizard-worker';
import * as adapters from '../../../scripts/personal-causal-trial-adapters';
import { personalBookProviderPayload } from '../book-openai';
import { citationTokens } from '../story-source-citations';

const deps = vi.hoisted(() => ({ production: false, user: { id: 'owner', email: 'owner@example.com' } as { id: string; email: string } | null }));
vi.mock('@/lib/auth-session', () => ({ resolveUserFromRequest: async () => deps.user ? { user: deps.user } : null }));
vi.mock('@/lib/dev-only-guard', () => ({ isDevEnvironment: () => !deps.production }));
const roots: string[] = [], options = resolvePersonalWizardOptions();
const sha = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
let config: SimpleBookConfig, file: string, root: string, ip = 100;
const url = 'http://127.0.0.1:3462/api/dev/personal-wizard/simple-book';
const req = (method: 'GET' | 'POST', body?: unknown, target = url, origin = 'http://127.0.0.1:3462') => new NextRequest(target, {
  method, headers: { host: new URL(target).host, origin, 'content-type': 'application/json', 'x-forwarded-for': `203.0.113.${++ip}` },
  ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) });
beforeEach(() => {
  sdk.create.mockReset(); sdk.options = [];
  deps.production = false; deps.user = { id: 'owner', email: 'owner@example.com' };
  root = mkdtempSync(path.join(tmpdir(), 'sh_simple_book_test_')); roots.push(root);
  config = { version: 'local-simple-wizard-config/v1', workspace: process.cwd(), outputParent: root, sourceHead: 'a'.repeat(40),
    approvalReference: 'SYNTHETIC offline allowance, not real paid authorization.', maximumMicroUsd: 12000000, fictionalProfile: true,
    seed: 'test-book-seed', executable: path.join(root, 'NEVER.exe'), executableSha256: 'b'.repeat(64), existingKeyEnvFile: path.join(root, 'NEVER.env'), engineeringReceipts: [] };
  file = path.join(root, 'config.json'); writeFileSync(file, JSON.stringify(config));
  vi.spyOn(frozen, 'gitAt').mockImplementation((_repo, args) => Buffer.from(args.join(' ') === 'rev-parse HEAD' ? 'a'.repeat(40) : ''));
  vi.stubEnv('PERSONAL_WIZARD_PREVIEW', 'true'); vi.stubEnv('PERSONAL_WIZARD_SIMPLE_BOOK_RUNNER', 'true');
  vi.stubEnv('PERSONAL_WIZARD_SIMPLE_BOOK_CONFIG', file); vi.stubEnv('PERSONAL_WIZARD_SIMPLE_BOOK_OPERATORS', 'owner@example.com');
});
afterEach(() => {
  vi.restoreAllMocks(); vi.unstubAllEnvs();
  for (const directory of roots.splice(0)) {
    if (path.dirname(directory) !== tmpdir() || !path.basename(directory).startsWith('sh_simple_book_test_')) throw Error('cleanup_boundary');
    rmSync(directory, { recursive: true, force: true });
  }
});
async function fixture() {
  const f = await personalStoryboardFixture(), plan = f.result.plan;
  const draft: SimpleStoryDraft = { title: plan.title, childGoal: plan.childGoal, companionWant: plan.companionWant,
    comicPromise: plan.comicPromise, ending: plan.ending,
    pages: f.result.manuscript.pages.map(p => ({ text: p.text + ' נועה ודיני משחקות בציור.' })),
    pageMap: plan.beats.map(({ pageNumber: _n, ...b }) => b),
    resilienceMoments: plan.resilience.moments.map(({ pageNumber, ...m }) => ({ page: pageNumber, ...m })) };
  const opus = vi.fn(async (call: SimpleStoryCall, _signal: AbortSignal) => {
    const output = call.stage === 'author' ? structuredClone(draft) : { ...structuredClone(draft), editorChanges: ['Synthetic only.'] };
    const usage = { inputTokens: 100, outputTokens: 100 }, termination = { code: 0, signal: null };
    return { output, usage, estimatedMicroUsd: 100000, metadata: { kind: 'cli_reported_estimate_not_invoice', reportedModels: ['claude-opus-5-5'], termination },
      raw: { termination, killConfirmed: true, stopped: false, stdout: JSON.stringify({ type: 'result', subtype: 'success', is_error: false,
        session_id: call.stage === 'author' ? '11111111-1111-4111-8111-111111111111' : '22222222-2222-4222-8222-222222222222',
        total_cost_usd: .1, modelUsage: { 'claude-opus-5-5': usage }, structured_output: output }) } };
  });
  const reader = vi.fn(async (call: any, _signal: AbortSignal) => ({ packetDigest: JSON.parse(call.input).packetDigest,
    summary: 'Synthetic complete reading, no product acceptance.', findings: [] }));
  const visual = vi.fn(async (call: any, _signal: AbortSignal) => call.stage === 'storyboard' ? structuredClone(f.draft)
    : { ...structuredClone(f.review), sourceDigest: call.context.sourceDigest, storyboardDigest: call.context.storyboardDigest });
  return { ...f, storyboardDraft: f.draft, draft, args: { request: structuredClone(f.request), options: structuredClone(options), seed: 'test-book-seed',
    signal: new AbortController().signal, opus, reader, visual, publish: vi.fn(), reservedWritingUsd: 2 } };
}

describe('actual simple writer to current whole-book driver, with no image authority', () => {
  it('writes twice, keeps separate actual session receipts, reads final before comparison, plans once, stops at references', async () => {
    const f = await fixture(), result = await runSimpleWizardBook(f.args);
    expect(result.status).toBe('review_supported'); expect(result.runtimeEligible).toBe(false);
    expect(f.args.opus.mock.calls.map(([call]) => call.stage)).toEqual(['author', 'editor']);
    expect(f.args.reader.mock.calls.map(([call]) => call.stage)).toEqual(['final_review', 'comparison']);
    expect(result.source.simpleSource.author.sessionId).not.toBe(result.source.simpleSource.editor.sessionId);
    expect(result.storyboard?.framePackets).toHaveLength(9);
    expect(f.args.publish.mock.calls[f.args.publish.mock.calls.length - 1]?.[0].phase).toBe('references_required');
    for (const [, signal] of [...f.args.opus.mock.calls, ...f.args.reader.mock.calls, ...f.args.visual.mock.calls]) expect(signal).toBe(f.args.signal);
    const finalInput = JSON.parse(f.args.reader.mock.calls[0][0].input);
    expect(JSON.stringify(finalInput)).not.toContain('editorChanges'); expect(finalInput.packet.original).toBeUndefined();
    expect(finalInput.packet.manuscript.pages).toHaveLength(8);
  });
  it.each(['fixture', 'long', 'photo'])('rejects %s before dispatch', async kind => {
    const f = await fixture();
    if (kind === 'fixture') f.args.request.child.nameSource = 'fixture';
    if (kind === 'long') f.args.request.bookOptions.lengthId = 'long';
    if (kind === 'photo') f.args.request.appearance.photo = 'local_preview_not_sent';
    await expect(runSimpleWizardBook(f.args)).rejects.toThrow(); expect(f.args.opus).not.toHaveBeenCalled();
  });
  it.each(['cancel', 'request_changed', 'reused_session', 'cost_unknown'])('halts on %s without a reader/planner fallback', async kind => {
    const f = await fixture(), controller = new AbortController(); f.args.signal = controller.signal;
    const original = f.args.opus.getMockImplementation()!;
    f.args.opus.mockImplementation(async (call, signal) => {
      const result = await original(call, signal);
      if (kind === 'cancel' && call.stage === 'author') controller.abort();
      if (kind === 'request_changed' && call.stage === 'author') f.args.request.child.name = 'אחר';
      if (kind === 'reused_session' && call.stage === 'editor') {
        const raw = JSON.parse(result.raw.stdout); raw.session_id = '11111111-1111-4111-8111-111111111111'; result.raw.stdout = JSON.stringify(raw);
      }
      if (kind === 'cost_unknown') result.estimatedMicroUsd = null as any;
      return result;
    });
    await expect(runSimpleWizardBook(f.args)).rejects.toThrow(); expect(f.args.reader).not.toHaveBeenCalled(); expect(f.args.visual).not.toHaveBeenCalled();
    if (kind !== 'reused_session') expect(f.args.opus).toHaveBeenCalledTimes(1);
  });
  it('holds a source-bound meaningful final finding before storyboard money', async () => {
    const f = await fixture();
    f.args.reader.mockImplementation(async (call, _signal) => {
      const input = JSON.parse(call.input), final = call.stage === 'final_review', unit = input.packet.manuscript?.pages[0].units[0];
      return { packetDigest: input.packetDigest, summary: 'Synthetic material issue only.', findings: final ? [{ severity: 'meaningful', kind: 'issue',
        criterion: 'Synthetic readable issue criterion.', explanation: 'Synthetic meaningful reader impact.', original: [],
        revised: [{ startId: unit.id, endId: unit.id, anchor: citationTokens(unit.text).slice(0, 2).join(' ') }] }] : [] } as any;
    });
    const result = await runSimpleWizardBook(f.args); expect(result.status).toBe('story_held');
    expect(f.args.visual).not.toHaveBeenCalled(); expect(f.args.publish.mock.calls[f.args.publish.mock.calls.length - 1]?.[0].phase).toBe('held');
  });
  it('refuses an invalid citation instead of dropping it or inventing a clean reading', async () => {
    const f = await fixture(); f.args.reader.mockResolvedValue({ packetDigest: '0'.repeat(64), summary: 'wrong source', findings: [] });
    await expect(runSimpleWizardBook(f.args)).rejects.toThrow(); expect(f.args.reader).toHaveBeenCalledTimes(1); expect(f.args.visual).not.toHaveBeenCalled();
  });
  it('uses the literal existing SDK visual payload, unchanged caps, and model-specific ordered decoding', async () => {
    const f = await fixture(); await runSimpleWizardBook(f.args);
    for (const [call] of f.args.visual.mock.calls) {
      const model = call.stage === 'storyboard' ? 'gpt-6-sol' : 'gpt-6-astra';
      expect(simpleWizardVisualPayload(call)).toEqual(personalBookProviderPayload(call, model));
      expect(call.maxOutputTokens).toBe(call.stage === 'storyboard' ? 32000 : 39000);
    }
    const payload = simpleWizardReadingPayload(f.args.reader.mock.calls[0][0]);
    expect(payload.model).toBe('gpt-6-astra'); expect(payload.store).toBe(false); expect(payload.max_output_tokens).toBe(16000);
  });
});

describe('one USD12 journal across engine stages and engineering Max', () => {
  it('durably claims the exact wire before dispatch and counts engineering plus settled costs', async () => {
    const budget = new SimpleBookBudget(path.join(root, 'stages'), 322973);
    const result = await budget.run('author', { payload: 'one' }, 1000000, async () => {
      expect(existsSync(path.join(root, 'stages/author.claim.json'))).toBe(true);
      expect(JSON.parse(readFileSync(path.join(root, 'stages/author.wire.json'), 'utf8'))).toEqual({ payload: 'one' });
      return { value: 'done', estimatedMicroUsd: 200000, receipt: { known: true } };
    });
    expect(result).toBe('done'); expect(budget.snapshot()).toMatchObject({ accountedMicroUsd: 522973, unknownAttemptCosts: 0, stopped: false });
    const duplicate = vi.fn(); await expect(budget.run('author', {}, 1, duplicate)).rejects.toThrow(); expect(duplicate).not.toHaveBeenCalled();
  });
  it.each(['unknown', 'over_slot', 'failed_unknown', 'failed_known'])('stops after %s and keeps evidence without a later call', async kind => {
    const budget = new SimpleBookBudget(path.join(root, 'stages'), 0);
    await expect(budget.run('author', {}, 1000000, async () => {
      if (kind.startsWith('failed')) throw Object.assign(Error('fail'), { receipt: { estimatedMicroUsd: kind === 'failed_known' ? 10 : null } });
      return { value: 1, estimatedMicroUsd: kind === 'unknown' ? null : 1000001, receipt: {} };
    })).rejects.toThrow();
    expect(budget.snapshot().stopped).toBe(true); expect(budget.snapshot().unknownAttemptCosts).toBe(kind.includes('unknown') ? 1 : 0);
    const next = vi.fn(); await expect(budget.run('editor', {}, 1, next)).rejects.toThrow(); expect(next).not.toHaveBeenCalled();
  });
  it('refuses an admission over the aggregate cap before writing a claim or dispatching', async () => {
    const budget = new SimpleBookBudget(path.join(root, 'stages'), 11999999), dispatch = vi.fn();
    await expect(budget.run('author', {}, 2, dispatch)).rejects.toThrow('simple_budget_exhausted'); expect(dispatch).not.toHaveBeenCalled();
    expect(existsSync(path.join(root, 'stages/author.claim.json'))).toBe(false);
  });
  it('counts only hash-bound completed engineering receipts and refuses unknown or changed ones', () => {
    const receiptFile = path.join(root, 'engineering.json'), receipt = { terminationConfirmed: true, stopped: false, code: 0, signal: null,
      reportedCostUsd: .3229724, isError: false, resultSubtype: 'success' };
    writeFileSync(receiptFile, JSON.stringify(receipt)); const bound = { file: receiptFile, sha256: sha(readFileSync(receiptFile)) };
    expect(simpleBookExternalCosts([bound])).toBe(322973);
    expect(() => simpleBookExternalCosts([bound, bound])).toThrow('duplicate');
    writeFileSync(receiptFile, JSON.stringify({ ...receipt, reportedCostUsd: null }));
    expect(() => simpleBookExternalCosts([bound])).toThrow('changed');
    expect(() => simpleBookExternalCosts([{ file: receiptFile, sha256: sha(readFileSync(receiptFile)) }])).toThrow();
  });
});

describe('real authenticated local simple-book route and one-use queue', () => {
  it('queues once, no providers/keys, binds owner, forbids a second request or worker', async () => {
    const f = await fixture(), requestId = prepareSimpleStory(f.request, options).accepted.requestId;
    const input = { request: f.request, requestId, consent: 'reviewed_text_to_simple_book_diagnostic' };
    const response = await POST(req('POST', input)); expect(response.status).toBe(202);
    expect(response.headers.get('cache-control')).toBe('no-store'); expect(JSON.stringify(await response.json())).not.toContain(root);
    expect((await POST(req('POST', input))).status).toBe(202);
    deps.user = { id: 'second', email: 'owner@example.com' };
    expect((await POST(req('POST', input))).status).toBe(409);
    expect((await GET(req('GET', undefined, `${url}?requestId=${requestId}`))).status).toBe(403);
    deps.user = { id: 'owner', email: 'owner@example.com' };
    const changed = structuredClone(f.request); changed.child.name = 'אחר';
    expect(() => enqueueSimpleBook(config, { request: changed, requestId: prepareSimpleStory(changed, options).accepted.requestId, userId: 'owner' })).toThrow('simple_approval_consumed');
    claimSimpleBookWorker(config); expect(() => claimSimpleBookWorker(config)).toThrow();
  });
  it.each(['disabled', 'production', 'anonymous', 'other', 'remote', 'origin'])('blocks %s before reading configuration or queue', async kind => {
    const f = await fixture(), input = { request: f.request, requestId: prepareSimpleStory(f.request, options).accepted.requestId, consent: 'reviewed_text_to_simple_book_diagnostic' };
    if (kind === 'disabled') vi.stubEnv('PERSONAL_WIZARD_SIMPLE_BOOK_RUNNER', 'false');
    if (kind === 'production') deps.production = true;
    if (kind === 'anonymous') deps.user = null;
    if (kind === 'other') deps.user = { id: 'other', email: 'other@example.com' };
    const disk = vi.spyOn(journal, 'fencedText');
    const response = await POST(req('POST', input, kind === 'remote' ? 'https://qa.smallheroes.co.il/api/dev/personal-wizard/simple-book' : url,
      kind === 'origin' ? 'https://foreign.invalid' : 'http://127.0.0.1:3462'));
    expect(response.status).toBeGreaterThanOrEqual(400); expect(disk).not.toHaveBeenCalled(); expect(existsSync(simpleBookQueueDirectory(config))).toBe(false);
  });
  it.each(['source', 'dirty', 'request_id', 'consent', 'browser_budget'])('refuses %s without acquiring approval', async kind => {
    const f = await fixture(), input: any = { request: f.request, requestId: prepareSimpleStory(f.request, options).accepted.requestId, consent: 'reviewed_text_to_simple_book_diagnostic' };
    if (kind === 'source') config.sourceHead = 'b'.repeat(40);
    if (kind === 'dirty') vi.mocked(frozen.gitAt).mockImplementation((_repo, args) => Buffer.from(args.join(' ') === 'rev-parse HEAD' ? 'a'.repeat(40) : ' M tracked.ts'));
    if (kind === 'request_id') input.requestId = 'c'.repeat(64);
    if (kind === 'consent') input.consent = 'reviewed_text_to_opus_and_astra';
    if (kind === 'browser_budget') input.budget = 100;
    writeFileSync(file, JSON.stringify(config)); expect((await POST(req('POST', input))).status).toBeGreaterThanOrEqual(400);
    expect(existsSync(simpleBookQueueDirectory(config))).toBe(false);
  });
  it('keeps config strict and prevents malformed or duplicate status identifiers', async () => {
    expect(simpleBookConfig(file)).toEqual(config);
    for (const query of ['bad', '../config.json', `${'a'.repeat(64)}&requestId=${'a'.repeat(64)}`]) expect((await GET(req('GET', undefined, `${url}?requestId=${query}`))).status).toBe(422);
    writeFileSync(file, JSON.stringify({ ...config, maximumMicroUsd: 25000000 })); expect(() => simpleBookConfig(file)).toThrow();
  });
  it('cannot describe a references-only result as complete, and delayed acknowledgements cannot replace a newer view', () => {
    const v = emptySimpleBookView('a'.repeat(64)); expect(readSimpleBookView({ ...v, phase: 'complete' }, v.requestId)).toBeNull();
    expect(readSimpleBookView({ ...v, phase: 'references_required' }, v.requestId)).toBeNull();
    expect(newerSimpleBookView({ ...v, revision: 4 }, v).revision).toBe(4);
    expect(readSimpleBookView({ ...v, runtimeEligible: true }, v.requestId)).toBeNull();
  });
});

describe('explicit native worker boundary with fake transports only', () => {
  async function workerFixture() {
    const f = await fixture(); writeFileSync(config.executable, 'SYNTHETIC NEVER EXECUTED'); config.executableSha256 = sha(readFileSync(config.executable));
    writeFileSync(config.existingKeyEnvFile, 'OPENAI_API_KEY=sk-synthetic-test-only-not-a-provider-key');
    writeFileSync(file, JSON.stringify(config));
    const requestId = prepareSimpleStory(f.request, options).accepted.requestId;
    enqueueSimpleBook(config, { request: f.request, requestId, userId: 'owner' });
    vi.spyOn(adapters, 'createOpusCausalTransport').mockReturnValue(async (_wire, call, signal) => f.args.opus(call as SimpleStoryCall, signal));
    const { pages: cp, ...continuity } = f.storyboardDraft.plan.continuity;
    const { pages: pp, ...plan } = f.storyboardDraft.plan, { pages: sp, ...sequence } = f.storyboardDraft.sequence;
    const strip = ({ pageNumber: _n, ...row }: any) => row;
    const draft = { plan: { ...plan, pages: pp.map(strip), continuity: { ...continuity, pages: cp.map(strip) } }, sequence: { ...sequence, pages: sp.map(strip) } };
    const group = (rows: any[]) => Object.fromEntries(rows.map(({ category, ...row }) => [category, row]));
    const review = { bookChecks: group(f.review.bookChecks), frames: f.review.frames.map(frame => group(frame.checks)) };
    sdk.create.mockImplementation(async payload => {
      const input = JSON.parse(payload.input), name = payload.text.format.name;
      const output = name === 'personal_book_storyboard' ? draft : name === 'personal_book_review' ? review
        : { packetDigest: input.packetDigest, summary: 'Synthetic complete source reading, no acceptance.', findings: [] };
      return { id: 'resp_synthetic', model: payload.model, service_tier: 'default', status: 'completed', output_text: JSON.stringify(output),
        usage: { input_tokens: 100, output_tokens: 100 } };
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    return { ...f, directory: simpleBookQueueDirectory(config) };
  }
  it('preview is inert; execute traverses actual worker SDK/decode/journal into nine source-bound packets and seals with zero images', async () => {
    const f = await workerFixture(); expect(await simpleWizardWorkerCLI(['--config', file])).toBe(0);
    expect(sdk.create).not.toHaveBeenCalled(); expect(f.args.opus).not.toHaveBeenCalled();
    expect(await simpleWizardWorkerCLI(['--config', file, '--execute'])).toBe(0);
    expect(sdk.create).toHaveBeenCalledTimes(4); expect(f.args.opus).toHaveBeenCalledTimes(2);
    expect(sdk.options.every(o => o.maxRetries === 0 && o.baseURL === 'https://api.openai.com/v1')).toBe(true);
    expect(JSON.parse(readFileSync(path.join(f.directory, 'sealed.json'), 'utf8'))).toMatchObject({ status: 'review_supported', imageCalls: 0, runtimeEligible: false });
    const result = JSON.parse(readFileSync(path.join(f.directory, 'simple-book-result.json'), 'utf8'));
    expect(result.storyboard.framePackets).toHaveLength(9); expect(result.storyboard.framePackets.every((p: any) => p.runtimeEligible === false)).toBe(true);
    await expect(simpleWizardWorkerCLI(['--config', file, '--execute'])).rejects.toThrow(); expect(sdk.create).toHaveBeenCalledTimes(4);
  });
  it('records and stops an incomplete paid reader before comparison, planner or replay', async () => {
    const f = await workerFixture(); sdk.create.mockResolvedValue({ model: 'gpt-6-astra', service_tier: 'default', status: 'incomplete', output_text: '',
      usage: { input_tokens: 100, output_tokens: 100 } });
    expect(await simpleWizardWorkerCLI(['--config', file, '--execute'])).toBe(1); expect(sdk.create).toHaveBeenCalledTimes(1);
    const seal = JSON.parse(readFileSync(path.join(f.directory, 'sealed.json'), 'utf8'));
    expect(seal.status).toBe('failed'); expect(seal.snapshot.stopped).toBe(true); expect(seal.snapshot.unknownAttemptCosts).toBe(0);
    expect(existsSync(path.join(f.directory, 'paid-stages/final_review.failure.json'))).toBe(true);
  });
  it('runs the real CJS/tsx/server-only bootstrap with invalid arguments and no provider/key', () => {
    const result = spawnSync(process.execPath, ['scripts/personal-simple-wizard-worker.cjs', '--invalid'], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 20000, windowsHide: true,
      env: { ...process.env, OPENAI_API_KEY: undefined, PERSONAL_WIZARD_SIMPLE_BOOK_RUNNER: 'false' } });
    expect(result.status).toBe(1); expect(result.stderr).toContain('simple_worker_setup_failed'); expect(result.stdout).toBe('');
  });
});
