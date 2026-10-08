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
import { prepareSimpleStory, writeSimpleStory, type SimpleStoryDraft, type SimpleStoryCall } from '../simple-story-engine';
import { runSimpleWizardBook } from '../simple-book-flow';
import { emptySimpleBookView, readSimpleBookView, newerSimpleBookView } from '../simple-book-view';
import { SimpleBookBudget, simpleBookExternalCosts } from '../simple-book-budget';
import { enqueueSimpleBook, simpleBookQueueDirectory, claimSimpleBookWorker, simpleBookConfig, type SimpleBookConfig } from '../simple-book-bridge';
import * as frozen from '../../../scripts/personal-source-git';
import * as journal from '../../../scripts/personal-causal-trial-journal';
import { GET, POST } from '@/app/api/dev/personal-wizard/simple-book/route';
import { simpleWizardVisualPayload, simpleWizardWorkerCLI } from '../../../scripts/personal-simple-wizard-worker';
import * as adapters from '../../../scripts/personal-causal-trial-adapters';
import { personalBookProviderPayload } from '../book-openai';
import { citationTokens } from '../story-source-citations';
import { illustrateSimpleBook, illustratedBookHTML, illustratedAuditionApprovalSchema } from '../simple-book-illustrations';
import { auditionUsageCost, readAuditionImage } from '../../../scripts/personal-simple-book-illustrator';
import * as images from '../../generate-image';
import { QUALITY_CATEGORIES } from '../../local-preview-quality';
import sharp from 'sharp';
import type { PageChildResemblanceVisionResult } from '../../generation-pipeline/page-child-resemblance-vision';
import { inlineLocalJsonSchemaReferences } from '../../../scripts/personal-inline-json-schema';
import { prepareSimpleBookContinuation } from '../simple-book-continuation';
import { simpleBookContinuationCLI } from '../../../scripts/personal-simple-book-continuation';
import { runSimpleBookWorkerPipeline } from '../../../scripts/personal-simple-wizard-worker';
import { prepareSimpleBookRepair } from '../simple-book-repair';
import { simpleBookRepairCLI } from '../../../scripts/personal-simple-book-repair';

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
  mkdirSync(path.join(root, 'git-common'));
  const engineeringReceipts = [1, 2].map(n => {
    const file = path.join(root, `SYNTHETIC-engineering-${n}.json`);
    writeFileSync(file, JSON.stringify({ terminationConfirmed: true, stopped: false, code: 0, signal: null,
      reportedCostUsd: 0, isError: false, resultSubtype: 'success', synthetic: true }));
    return { file, sha256: sha(readFileSync(file)) };
  });
  config = { version: 'local-simple-wizard-config/v1', workspace: process.cwd(), outputParent: root, sourceHead: 'a'.repeat(40),
    approvalReference: 'SYNTHETIC offline allowance, not real paid authorization.', maximumMicroUsd: 12000000, fictionalProfile: true,
    seed: 'test-book-seed', executable: path.join(root, 'NEVER.exe'), executableSha256: 'b'.repeat(64), existingKeyEnvFile: path.join(root, 'NEVER.env'), engineeringReceipts };
  file = path.join(root, 'config.json'); writeFileSync(file, JSON.stringify(config));
  vi.spyOn(frozen, 'gitAt').mockImplementation((_repo, args) => Buffer.from(args.join(' ') === 'rev-parse HEAD' ? 'a'.repeat(40)
    : args.join(' ') === 'status --porcelain' ? '' : path.join(root, 'git-common')));
  vi.stubEnv('PERSONAL_WIZARD_PREVIEW', 'true'); vi.stubEnv('PERSONAL_WIZARD_SIMPLE_BOOK_RUNNER', 'true');
  vi.stubEnv('PERSONAL_WIZARD_SIMPLE_BOOK_CONFIG', file); vi.stubEnv('PERSONAL_WIZARD_SIMPLE_BOOK_OPERATORS', 'owner@example.com');
});
afterEach(() => {
  vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals();
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
  it.each(['meaningful_issue', 'blocking_preference', 'blocking_improvement'])('holds a source-bound %s final finding before storyboard money', async mode => {
    const f = await fixture();
    f.args.reader.mockImplementation(async (call, _signal) => {
      const input = JSON.parse(call.input), final = call.stage === 'final_review';
      const unit = final ? input.packet.manuscript.pages[0].units[0] : input.packet.revised.pages[0].units[0];
      const ref = (u: any) => ({ startId: u.id, endId: u.id, anchor: citationTokens(u.text).slice(0, 2).join(' ') });
      return { packetDigest: input.packetDigest, summary: 'Synthetic material issue only.', findings: (mode === 'blocking_improvement' ? !final : final) ? [{ severity: mode.startsWith('blocking') ? 'blocking' : 'meaningful',
        kind: mode === 'blocking_preference' ? 'preference' : mode === 'blocking_improvement' ? 'improvement' : 'issue',
        criterion: 'Synthetic readable issue criterion.', explanation: 'Synthetic meaningful reader impact.',
        original: final ? [] : [ref(input.packet.original.pages[0].units[0])], revised: [ref(unit)] }] : [] } as any;
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
      const model = adapters.CAUSAL_MODELS.astra;
      expect(simpleWizardVisualPayload(call)).toEqual(personalBookProviderPayload(call, model));
      expect(call.maxOutputTokens).toBe(call.stage === 'storyboard' ? 32000 : 39000);
    }
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
  it('counts known terminated billed engineering failures as well as success; refuses unknown or changed receipts', () => {
    const receiptFile = path.join(root, 'engineering.json'), receipt = { terminationConfirmed: true, stopped: false, code: 0, signal: null,
      reportedCostUsd: .3229724, isError: false, resultSubtype: 'success' };
    writeFileSync(receiptFile, JSON.stringify(receipt)); const bound = { file: receiptFile, sha256: sha(readFileSync(receiptFile)) };
    expect(simpleBookExternalCosts([bound])).toBe(322973);
    expect(() => simpleBookExternalCosts([bound, bound])).toThrow('duplicate');
    writeFileSync(receiptFile, JSON.stringify({ ...receipt, code: 1, isError: true, stopped: true, resultSubtype: 'error' }));
    expect(simpleBookExternalCosts([{ file: receiptFile, sha256: sha(readFileSync(receiptFile)) }])).toBe(322973);
    writeFileSync(receiptFile, JSON.stringify({ ...receipt, terminationConfirmed: false }));
    expect(() => simpleBookExternalCosts([{ file: receiptFile, sha256: sha(readFileSync(receiptFile)) }])).toThrow();
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
    if (kind === 'dirty') vi.mocked(frozen.gitAt).mockImplementation((_repo, args) => Buffer.from(args.join(' ') === 'rev-parse HEAD' ? 'a'.repeat(40)
      : args.join(' ') === 'status --porcelain' ? ' M tracked.ts' : root));
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
  it('a renamed reference/output parent cannot mint another allowance or worker in the same repository', async () => {
    const f = await fixture(), requestId = prepareSimpleStory(f.request, options).accepted.requestId;
    enqueueSimpleBook(config, { request: f.request, requestId, userId: 'owner' });
    const initial = simpleBookQueueDirectory(config), another = path.join(root, 'different-output'); mkdirSync(another);
    const changed = { ...config, outputParent: another, approvalReference: config.approvalReference + ' renamed' };
    expect(simpleBookQueueDirectory(changed)).toBe(initial);
    expect(() => enqueueSimpleBook(changed, { request: f.request, requestId, userId: 'owner' })).toThrow('simple_request_binding');
    expect(() => claimSimpleBookWorker(changed)).toThrow('simple_request_binding');
    expect(existsSync(path.join(another, 'worker-claimed.json'))).toBe(false);
  });
  it('requires explicit engineering receipts, and a missing listed receipt blocks the worker before claim or paid call', async () => {
    const f = await fixture();
    writeFileSync(file, JSON.stringify({ ...config, engineeringReceipts: [] })); expect(() => simpleBookConfig(file)).toThrow();
    writeFileSync(file, JSON.stringify({ ...config, engineeringReceipts: [{ file: path.join(root, 'missing.json'), sha256: 'a'.repeat(64) }, ...config.engineeringReceipts] }));
    writeFileSync(config.executable, 'SYNTHETIC'); config.executableSha256 = sha(readFileSync(config.executable));
    const parsed = JSON.parse(readFileSync(file, 'utf8')); parsed.executableSha256 = config.executableSha256; writeFileSync(file, JSON.stringify(parsed));
    config = simpleBookConfig(file);
    enqueueSimpleBook(config, { request: f.request, requestId: prepareSimpleStory(f.request, options).accepted.requestId, userId: 'owner' });
    await expect(simpleWizardWorkerCLI(['--config', file, '--execute'])).rejects.toThrow('ENOENT'); expect(sdk.create).not.toHaveBeenCalled();
    expect(existsSync(path.join(simpleBookQueueDirectory(config), 'worker-claimed.json'))).toBe(false);
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
    const readingWire = JSON.parse(readFileSync(path.join(f.directory, 'paid-stages/final_review.wire.json'), 'utf8'));
    expect(readingWire.payload.model).toBe(adapters.CAUSAL_MODELS.astra); expect(readingWire.payload.store).toBe(false);
    expect(readingWire.payload.max_output_tokens).toBe(16000);
    expect(sdk.options.every(o => o.maxRetries === 0 && o.baseURL === 'https://api.openai.com/v1')).toBe(true);
    expect(JSON.parse(readFileSync(path.join(f.directory, 'sealed.json'), 'utf8'))).toMatchObject({ status: 'review_supported', imageCalls: 0, runtimeEligible: false });
    const result = JSON.parse(readFileSync(path.join(f.directory, 'simple-book-result.json'), 'utf8'));
    expect(result.storyboard.framePackets).toHaveLength(9); expect(result.storyboard.framePackets.every((p: any) => p.runtimeEligible === false)).toBe(true);
    await expect(simpleWizardWorkerCLI(['--config', file, '--execute'])).rejects.toThrow(); expect(sdk.create).toHaveBeenCalledTimes(4);
  });
  it('refuses source/common-directory output locations and an occupied CLI workspace before claiming the only slot', async () => {
    const f = await workerFixture();
    for (const outputParent of [config.workspace, path.join(root, 'git-common')]) {
      writeFileSync(file, JSON.stringify({ ...config, outputParent }));
      expect(() => simpleBookConfig(file)).toThrow('simple_cli_workspace_inside_source');
    }
    writeFileSync(file, JSON.stringify(config)); mkdirSync(path.join(config.outputParent, 'simple-book-cli-workspace'));
    await expect(simpleWizardWorkerCLI(['--config', file, '--execute'])).rejects.toThrow('EEXIST');
    expect(existsSync(path.join(f.directory, 'worker-claimed.json'))).toBe(false);
    expect(sdk.create).not.toHaveBeenCalled(); expect(f.args.opus).not.toHaveBeenCalled();
  });
  it('records and stops an incomplete paid reader before comparison, planner or replay', async () => {
    const f = await workerFixture(); sdk.create.mockResolvedValue({ model: 'gpt-6-astra', service_tier: 'default', status: 'incomplete', output_text: '',
      usage: { input_tokens: 100, output_tokens: 100 } });
    expect(await simpleWizardWorkerCLI(['--config', file, '--execute'])).toBe(1); expect(sdk.create).toHaveBeenCalledTimes(1);
    const seal = JSON.parse(readFileSync(path.join(f.directory, 'sealed.json'), 'utf8'));
    expect(seal.status).toBe('failed'); expect(seal.code).toBe('incomplete');
    expect(seal.snapshot.stopped).toBe(true); expect(seal.snapshot.unknownAttemptCosts).toBe(0);
    expect(existsSync(path.join(f.directory, 'paid-stages/final_review.failure.json'))).toBe(true);
  });
  it('reserves each existing USD2 CLI slot, not a per-request token estimate, for cumulative reported Opus cost', async () => {
    const f = await workerFixture(), normal = f.args.opus.getMockImplementation()!;
    f.args.opus.mockImplementation(async (call, signal) => {
      const r = await normal(call, signal), native = JSON.parse(r.raw.stdout);
      native.total_cost_usd = 1.1; r.raw.stdout = JSON.stringify(native); r.estimatedMicroUsd = 1100000;
      return r;
    });
    expect(await simpleWizardWorkerCLI(['--config', file, '--execute'])).toBe(0);
    for (const stage of ['author', 'editor']) {
      const claim = JSON.parse(readFileSync(path.join(f.directory, `paid-stages/${stage}.claim.json`), 'utf8'));
      const wire = JSON.parse(readFileSync(path.join(f.directory, `paid-stages/${stage}.wire.json`), 'utf8'));
      expect(claim.maximumMicroUsd).toBe(2000000); expect(wire.reservedMicroUsd).toBeLessThan(1100000);
      expect(wire.args[wire.args.indexOf('--max-budget-usd') + 1]).toBe('2');
    }
    expect(JSON.parse(readFileSync(path.join(f.directory, 'sealed.json'), 'utf8')).snapshot.knownEstimateMicroUsd).toBeGreaterThan(2200000);
  });
  it('runs the actual opt-in worker adapter through 3 references, 9 images, pixel QA, numeric identity and owned private serving with synthetic transports', async () => {
    const f = await workerFixture(), approvalFile = path.join(root, 'visual-approval.json');
    writeFileSync(approvalFile, JSON.stringify(syntheticVisualApproval()));
    config.illustratedAudition = { approvalFile, approvalSha256: sha(readFileSync(approvalFile)), childDesign: 'A fictional child with short brown hair and brown eyes.' };
    // Queue binding is strict: use a separate fresh test repository namespace, not a replay of an old real slot.
    const oldCommon = path.join(root, 'git-common'), newCommon = path.join(root, 'illustrated-common'); mkdirSync(newCommon);
    vi.mocked(frozen.gitAt).mockImplementation((_repo, args) => Buffer.from(args.join(' ') === 'rev-parse HEAD' ? config.sourceHead
      : args.join(' ') === 'status --porcelain' ? '' : newCommon));
    writeFileSync(file, JSON.stringify(config));
    const requestId = prepareSimpleStory(f.request, options).accepted.requestId;
    enqueueSimpleBook(config, { request: f.request, requestId, userId: 'owner' });
    const directory = simpleBookQueueDirectory(config), priorSDK = sdk.create.getMockImplementation()!;
    sdk.create.mockImplementation(async payload => {
      if (!Array.isArray(payload.input)) return priorSDK(payload);
      const context = JSON.parse(payload.input[0].content[0].text);
      return { model: payload.model, service_tier: 'default', status: 'completed', output_text: JSON.stringify(cleanPixelReview(context.candidateSha, context.contextSha)),
        usage: { input_tokens: 100, output_tokens: 100 } };
    });
    let generated = 0;
    const render = vi.spyOn(images, 'generateGPTImage').mockImplementation(async input => {
      const buffer = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: ++generated, g: 60, b: 90 } } }).png().toBuffer();
      const usage = { input_tokens: 100, output_tokens: 100 }, raw = { data: [{ b64_json: buffer.toString('base64') }], usage };
      input.observeProviderResponse?.(raw);
      return { buffer, usage, model: 'gpt-image-2', finalPrompt: input.finalPrompt, hasReferencePhoto: !!input.referenceImages?.length,
        apiMode: input.referenceImages?.length ? 'images.edit' : 'images.generate', referenceCountRequested: input.referenceImages?.length ?? 0,
        referenceCountPassed: input.referenceImages?.length ?? 0, durationMs: 1, fallbackUsed: false };
    });
    const fetch = vi.fn(async () => new Response(JSON.stringify({ model: 'gpt-4o-2024-08-06', usage: { prompt_tokens: 100, completion_tokens: 100 },
      choices: [{ message: { content: JSON.stringify({ referenceChildVisible: true, candidateChildVisible: true, candidateChildCount: 1, comparisonUsable: true,
        sameChildDecision: 'same', faceStructure: 'match', eyesBrows: 'match', noseMouth: 'match', hairIdentity: 'match', distinctiveFeatures: 'match' }) } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    expect(await simpleWizardWorkerCLI(['--config', file, '--execute'])).toBe(0);
    expect(render).toHaveBeenCalledTimes(12); expect(fetch).toHaveBeenCalledTimes(9); expect(sdk.create).toHaveBeenCalledTimes(16);
    for (const [input] of render.mock.calls.slice(3)) {
      expect(input.referenceMode).toBe('book_identity'); expect(input.referenceImages).toHaveLength(4); expect(input.exactReferenceBytes).toHaveLength(4);
      expect(input.modelOverride).toBe('gpt-image-2'); expect(input.quality).toBe('low'); expect(input.signal).toBeDefined();
    }
    const status = await GET(req('GET', undefined, `${url}?requestId=${requestId}`)), view = await status.json();
    expect(view.phase).toBe('illustrated_audition'); expect(view.images).toHaveLength(9); expect(view.runtimeEligible).toBe(false);
    expect(view.accounting.logicalAttempts).toBe(39); expect(view.accounting.unknownAttemptCosts).toBe(0);
    expect(JSON.parse(readFileSync(path.join(directory, 'sealed.json'), 'utf8'))).toMatchObject({ status: 'illustrated_audition', imageCalls: 12, runtimeEligible: false });
    const page = await GET(req('GET', undefined, `${url}?requestId=${requestId}&page=3`));
    expect(page.status).toBe(200); expect(page.headers.get('content-type')).toBe('image/png');
    expect(sha(Buffer.from(await page.arrayBuffer()))).toBe(view.images[3].imageSha);
    expect(readFileSync(path.join(directory, 'book.html'), 'utf8')).toContain('לא אישור לייצור');
    expect((await GET(req('GET', undefined, `${url}?requestId=${requestId}&page=3&page=4`))).status).toBe(404);
    deps.user = { id: 'intruder', email: 'owner@example.com' }; expect((await GET(req('GET', undefined, `${url}?requestId=${requestId}&page=3`))).status).toBe(403);
    deps.user = { id: 'owner', email: 'owner@example.com' };
    writeFileSync(path.join(directory, 'illustrations', view.images[3].imageName), 'corrupted');
    expect((await GET(req('GET', undefined, `${url}?requestId=${requestId}&page=3`))).status).toBe(503);
    expect(existsSync(path.join(oldCommon, 'codex-simple-wizard-book/one-approved-book-20261008/worker-claimed.json'))).toBe(false);
  }, 30000); // 39 durable, fsynced synthetic stages + PNG crops; not a transport timeout increase.
  it('runs the real CJS/tsx/server-only bootstrap with invalid arguments and no provider/key', () => {
    const result = spawnSync(process.execPath, ['scripts/personal-simple-wizard-worker.cjs', '--invalid'], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 20000, windowsHide: true,
      env: { ...process.env, OPENAI_API_KEY: undefined, PERSONAL_WIZARD_SIMPLE_BOOK_RUNNER: 'false' } });
    expect(result.status).toBe(1); expect(result.stderr).toContain('simple_worker_setup_failed'); expect(result.stdout).toBe('');
  });
});

function syntheticVisualApproval() { return { version: 'local-book-night-approval/v1', maximumMicroUsd: 12000000, bookCount: 1, narrativePages: 8, cover: true,
  publicRelease: false, customerCharge: false, gateChanges: false, oneBookDiagnosticVisualException: { approved: true, permanentlyRuntimeIneligible: true, identityThreshold: .7 } }; }
function cleanPixelReview(candidateSha: string, contextSha: string) { return { candidateSha, contextSha,
  checks: QUALITY_CATEGORIES.map(category => ({ category, verdict: 'pass', observation: 'Synthetic test verdict, no visual acceptance.', correction: '' })) }; }
function syntheticIdentity(): PageChildResemblanceVisionResult { return { evaluatorVersion: 'page-child-resemblance-vision/v1', status: 'passed', threshold: .7,
  resemblanceScore: 1, subjectVisible: true, sameChild: true, reasonCode: 'same_child', attempts: 1, model: 'gpt-4o',
  featureAssessments: { faceStructure: 'match', eyesBrows: 'match', noseMouth: 'match', hairIdentity: 'match', distinctiveFeatures: 'match' } }; }

describe('injected illustrated audition admission, failure boundaries and state continuity', () => {
  async function illustrationFixture() {
    const f = await fixture(), result = await runSimpleWizardBook(f.args); let made = 0;
    const args = { result, request: f.args.request, options: f.args.options, seed: f.args.seed,
      approval: syntheticVisualApproval(), childDesign: 'Synthetic fictional identity only, never a real person.', companion: { imageSha: 'c'.repeat(64), imageName: 'companion.png' },
      signal: f.args.signal, render: vi.fn(async (step: string) => ({ imageName: `${step}.png`, imageSha: sha(String(++made)) })),
      judge: vi.fn(async (_step: string, candidate: { imageSha: string }, _context: unknown, contextSha: string) => cleanPixelReview(candidate.imageSha, contextSha)),
      identity: vi.fn(async () => syntheticIdentity()), save: vi.fn(), progress: vi.fn() };
    return { ...f, args };
  }
  it('uses identical canonical references on all frames, passes current-world-state to QA and exports only exact escaped prose', async () => {
    const f = await illustrationFixture(), result = await illustrateSimpleBook(f.args);
    expect(result.pages).toHaveLength(9); expect(result.runtimeEligible).toBe(false); expect(result.productionQualified).toBe(false);
    expect(f.args.render).toHaveBeenCalledTimes(12); expect(f.args.identity).toHaveBeenCalledTimes(9);
    const firstRefs = (f.args.render.mock.calls[3] as any)[2];
    for (const row of f.args.render.mock.calls.slice(3) as any[]) expect(row[2]).toEqual(firstRefs);
    for (const [, , context] of f.args.judge.mock.calls.slice(3)) expect(context).toHaveProperty('packet.sequence');
    const html = illustratedBookHTML(result, () => 'data:image/png;base64,TESTONLY');
    expect(html.match(/<img /g)).toHaveLength(9); expect(html).not.toContain('<script'); expect(result.manuscript).toEqual(f.args.result.source.manuscript);
    expect(() => illustratedBookHTML({ ...result, pages: result.pages.slice(1) }, () => '')).toThrow('simple_book_incomplete');
  });
  it.each(['approval', 'production', 'threshold', 'cancel', 'unreviewed'])('rejects %s before any reference dispatch', async kind => {
    const f = await illustrationFixture();
    if (kind === 'approval') f.args.approval.oneBookDiagnosticVisualException.approved = false;
    if (kind === 'production') f.args.approval.oneBookDiagnosticVisualException.permanentlyRuntimeIneligible = false;
    if (kind === 'threshold') f.args.approval.oneBookDiagnosticVisualException.identityThreshold = .69;
    if (kind === 'cancel') { const c = new AbortController(); c.abort(); f.args.signal = c.signal; }
    if (kind === 'unreviewed') (f.args.result as any).status = 'story_held';
    await expect(illustrateSimpleBook(f.args)).rejects.toThrow(); expect(f.args.render).not.toHaveBeenCalled();
  });
  it.each(['uncertain', 'wrong_binding', 'missing_category'])('holds %s reference QA with no scene spending', async mode => {
    const f = await illustrationFixture(); f.args.judge.mockImplementation(async (_s, c, _ctx, hash) => {
      const r: any = cleanPixelReview(c.imageSha, hash); if (mode === 'uncertain') r.checks[0].verdict = 'uncertain';
      if (mode === 'wrong_binding') r.candidateSha = '0'.repeat(64); if (mode === 'missing_category') r.checks.pop(); return r;
    });
    await expect(illustrateSimpleBook(f.args)).rejects.toThrow(); expect(f.args.render).toHaveBeenCalledTimes(1); expect(f.args.identity).not.toHaveBeenCalled();
  });
  it.each(['uncertain', 'two_defects', 'identity_unknown', 'identity_below', 'source_changed'])('stops %s without a new book or a later frame', async mode => {
    const f = await illustrationFixture();
    if (mode.startsWith('identity')) f.args.identity.mockResolvedValue({ ...syntheticIdentity(), status: mode === 'identity_unknown' ? 'evidence_unknown' : 'failed', resemblanceScore: mode === 'identity_below' ? .69 : null });
    const normal = f.args.judge.getMockImplementation()!;
    f.args.judge.mockImplementation(async (step, candidate, context, hash) => {
      const r = await normal(step, candidate, context, hash);
      if (step.startsWith('page_0') && ['uncertain', 'two_defects'].includes(mode)) {
        (r.checks[0] as any).verdict = mode === 'uncertain' ? 'uncertain' : 'defect'; r.checks[0].correction = 'Synthetic evidenced defect correction.';
      }
      if (step.startsWith('page_0') && mode === 'source_changed') f.args.request.child.name = 'changed';
      return r;
    });
    await expect(illustrateSimpleBook(f.args)).rejects.toThrow();
    expect(f.args.render.mock.calls.map(row => row[0])).not.toContain('page_1_0');
    expect(f.args.render).toHaveBeenCalledTimes(mode === 'two_defects' ? 5 : 4);
  });
  it('counts digit-bearing scene claims in the same budget and halts unknown/overslot costs', async () => {
    const budget = new SimpleBookBudget(path.join(root, 'numbered'), 10);
    await budget.run('page_0_0', {}, 100, async () => ({ value: 'synthetic', estimatedMicroUsd: 20, receipt: {} }));
    expect(budget.snapshot()).toMatchObject({ knownEstimateMicroUsd: 30, logicalAttempts: 1 });
    await expect(budget.run('page_1_0', {}, 100, async () => ({ value: 1, estimatedMicroUsd: null, receipt: {} }))).rejects.toThrow('simple_cost_unknown');
    expect(budget.snapshot()).toMatchObject({ unknownAttemptCosts: 1, logicalAttempts: 2, stopped: true });
  });
  it.each([null, {}, { input_tokens: -1, output_tokens: 1 }, { input_tokens: 1, output_tokens: null }, { input_tokens: 0, output_tokens: 0 }])('never treats unavailable/invalid usage as zero', value => {
    expect(auditionUsageCost(value, 'image')).toBeNull(); expect(auditionUsageCost(value, 'astra')).toBeNull();
  });
  it('prices known image usage conservatively and never infers visual authority from cost', () => {
    expect(auditionUsageCost({ input_tokens: 100, output_tokens: 100 }, 'image')).toBe(3800);
    expect(auditionUsageCost({ input_tokens: 100, output_tokens: 100 }, 'astra')).toBe(6000);
    expect(() => illustratedAuditionApprovalSchema.parse({ ...syntheticVisualApproval(), customerCharge: true })).toThrow();
    expect(() => readAuditionImage(root, { imageName: '../file.png', imageSha: 'a'.repeat(64) })).toThrow('simple_image_path');
    expect(readSimpleBookView({ ...emptySimpleBookView('a'.repeat(64)), phase: 'illustrated_audition' }, 'a'.repeat(64))).toBeNull();
  });
});

describe('explicit same-book continuation, no provider in fixtures', () => {
  async function failedOriginal() {
    const f = await fixture();
    writeFileSync(config.executable, 'SYNTHETIC executable bytes, never run'); config.executableSha256 = sha(readFileSync(config.executable));
    writeFileSync(file, JSON.stringify(config));
    writeFileSync(config.existingKeyEnvFile, 'OPENAI_API_KEY=sk-SYNTHETIC_ONLY_NEVER_A_REAL_CREDENTIAL_123456789');
    mkdirSync(path.join(config.outputParent, 'simple-book-cli-workspace'));
    enqueueSimpleBook(config, { request: f.request, requestId: prepareSimpleStory(f.request, options, config.seed).accepted.requestId, userId: 'owner' });
    const old = claimSimpleBookWorker(config), paid = path.join(old.directory, 'paid-stages');
    const budget = new SimpleBookBudget(paid, 0);
    const policy = { executable: config.executable, executableSha256: config.executableSha256, workspace: root, maxWireBytes: 104000,
      rates: { opus: { inputMicroUsdPerToken: 4, outputMicroUsdPerToken: 20 }, astra: { inputMicroUsdPerToken: 10, outputMicroUsdPerToken: 50 } } };
    await writeSimpleStory(prepareSimpleStory(f.request, options, config.seed), async call => {
      const instructions = path.join(old.directory, `${call.stage}-instructions.txt`); writeFileSync(instructions, call.instructions);
      const dispatch = { ...call, role: 'opus' as const, conversationKey: `test:${call.stage}` };
      const wire = adapters.prepareCausalWire(dispatch, policy, 2000000, instructions);
      return budget.run(call.stage, wire, 2000000, async () => {
        const reply = await f.args.opus(call, f.args.signal);
        return { value: { output: reply.output, usage: reply.usage, estimatedUsd: reply.estimatedMicroUsd / 1e6 }, estimatedMicroUsd: reply.estimatedMicroUsd, receipt: reply };
      });
    }, { model: adapters.CAUSAL_MODELS.opus, reservedUsd: 4 });
    const failure = { raw: { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, model: adapters.CAUSAL_MODELS.astra,
      service_tier: 'default', usage: { input_tokens: 100, output_tokens: 100 } }, usage: { inputTokens: 100, outputTokens: 100 }, estimatedMicroUsd: 6000 };
    await expect(budget.run('final_review', { synthetic: true }, 10000, async () => {
      throw Object.assign(Error('incomplete'), { code: 'incomplete', receipt: failure });
    })).rejects.toThrow('incomplete');
    writeFileSync(path.join(old.directory, 'sealed.json'), JSON.stringify({ status: 'failed', code: 'incomplete', snapshot: budget.snapshot(), imageCalls: 0, runtimeEligible: false }));
    const terminal = path.join(root, 'SYNTHETIC-termination.json'); writeFileSync(terminal, JSON.stringify({ code: 1, signal: null, terminationConfirmed: true }));
    const extra = path.join(root, 'SYNTHETIC-extra-engineering.json'); writeFileSync(extra, JSON.stringify({ terminationConfirmed: true, reportedCostUsd: .2 }));
    const names = ['request.json', 'worker-claimed.json', 'sealed.json', 'author-instructions.txt', 'editor-instructions.txt',
      ...require('node:fs').readdirSync(paid).map((n: string) => `paid-stages/${n}`)];
    const data = { version: 'controlled-simple-book-continuation/v1', originalConfig: { file, sha256: sha(readFileSync(file)) },
      sourceHead: config.sourceHead, approvalReference: 'SYNTHETIC explicit same-book continuation; NOT live authority.', maximumMicroUsd: 12000000,
      terminationReceipt: { file: terminal, sha256: sha(readFileSync(terminal)) },
      artifacts: names.map(relative => ({ relative, sha256: sha(readFileSync(path.join(old.directory, relative))) })),
      extraEngineeringReceipts: [{ file: extra, sha256: sha(readFileSync(extra)) }] };
    const recoveryFile = path.join(root, 'continuation.json'); writeFileSync(recoveryFile, JSON.stringify(data));
    return { f, old, budget, paid, data, recoveryFile, originalHashes: names.map(n => [n, sha(readFileSync(path.join(old.directory, n)))]) };
  }
  async function heldContinuation() {
    const x = await failedOriginal(), parent = prepareSimpleBookContinuation(x.recoveryFile), claimed = parent.claim();
    const nativeWriter = vi.fn(); vi.spyOn(adapters, 'createOpusCausalTransport').mockReturnValue(nativeWriter);
    sdk.create.mockImplementation(async (payload: any) => {
      const packet = JSON.parse(payload.input), unit = packet.packet.manuscript?.pages[0].units[0];
      return { model: adapters.CAUSAL_MODELS.astra, service_tier: 'default', status: 'completed', usage: { input_tokens: 100, output_tokens: 100 },
        output_text: JSON.stringify({ packetDigest: packet.packetDigest, summary: 'SYNTHETIC complete boundary review.', findings: unit ? [{ severity: 'meaningful', kind: 'issue',
          criterion: 'SYNTHETIC material issue', original: [], revised: [{ startId: unit.id, endId: unit.id, anchor: citationTokens(unit.text).slice(0, 2).join(' ') }],
          explanation: 'SYNTHETIC source-bound hold; no literary judgement.' }] : [] }) };
    });
    expect(await runSimpleBookWorkerPipeline({ config: parent.original, configFile: x.recoveryFile, cliWorkspace: path.join(root, 'simple-book-cli-workspace'),
      worker: claimed.worker, continuation: { budget: claimed.budget, inheritedAttempts: 3, assertCurrent: parent.verify, reuseWriting: parent.reuseWriting } })).toBe(2);
    expect(nativeWriter).not.toHaveBeenCalled(); sdk.create.mockClear();
    const terminal = path.join(root, 'SYNTHETIC-held-terminal.json'); writeFileSync(terminal, JSON.stringify({ code: 2, signal: null, terminationConfirmed: true }));
    const extra = path.join(root, 'SYNTHETIC-reconciled-max.json'); writeFileSync(extra, JSON.stringify({ terminationConfirmed: true,
      reportedCostUsd: .05, maximumMicroUsd: 40000, code: 1, resultSubtype: 'error_max_budget_usd', isError: true }));
    const names = ['continuation-simple-book-result.json', 'continuation-sealed.json', 'continuation-story.md',
      ...require('node:fs').readdirSync(x.old.directory).filter((n: string) => /^view-\d{4}\.json$/.test(n)),
      ...require('node:fs').readdirSync(parent.directory).flatMap((n: string) => n === 'paid-stages'
        ? require('node:fs').readdirSync(path.join(parent.directory, n)).map((f: string) => `controlled-continuation-20261008/${n}/${f}`)
        : [`controlled-continuation-20261008/${n}`])];
    const record = { file: extra, sha256: sha(readFileSync(extra)) };
    const data = { version: 'controlled-simple-book-editor-repair/v1', continuationConfig: { file: x.recoveryFile, sha256: sha(readFileSync(x.recoveryFile)) },
      terminationReceipt: { file: terminal, sha256: sha(readFileSync(terminal)) }, sourceHead: config.sourceHead, maximumMicroUsd: 12000000,
      approvalReference: 'SYNTHETIC explicit one repair and known internal cost reconciliation, NOT paid authority.',
      artifacts: names.map(relative => ({ relative, sha256: sha(readFileSync(path.join(x.old.directory, relative))) })),
      extraEngineeringReceipts: [record], reconciledEngineeringReceipt: record };
    const repairFile = path.join(root, 'repair.json'); writeFileSync(repairFile, JSON.stringify(data));
    return { ...x, parent, data, repairFile, heldHashes: names.map(n => [n, sha(readFileSync(path.join(x.old.directory, n)))]) };
  }
  it('previews one editor repair without keys, keeps the known failed Max cost and claims only one sibling slot', async () => {
    const x = await heldContinuation(), disk = vi.spyOn(journal, 'fencedText');
    expect(await simpleBookRepairCLI(['--config', x.repairFile])).toBe(0);
    expect(disk.mock.calls.some(([p]) => p === config.existingKeyEnvFile)).toBe(false); expect(sdk.create).not.toHaveBeenCalled();
    const ready = await prepareSimpleBookRepair(x.repairFile), claimed = ready.claim();
    expect(ready.externalMicroUsd).toBe(468000);
    expect(claimed.budget.snapshot()).toMatchObject({ knownEstimateMicroUsd: 468000, logicalAttempts: 0, stopped: false });
    expect(() => ready.claim()).toThrow();
    expect(JSON.parse(readFileSync(path.join(ready.directory, 'editor-guidance.json'), 'utf8')).guidance.findings).toHaveLength(1);
    for (const [n, digest] of [...x.originalHashes, ...x.heldHashes]) expect(sha(readFileSync(path.join(x.old.directory, n)))).toBe(digest);
  });
  it('successful repair uses one new editor, blind final then prior-edit comparison, and the same nine current frame packets', async () => {
    const x = await heldContinuation(), ready = await prepareSimpleBookRepair(x.repairFile);
    const editor = vi.fn(async (call: SimpleStoryCall, signal: AbortSignal) => {
      expect(call.stage).toBe('editor'); expect(signal).toBe(x.f.args.signal);
      const receipt = await x.f.args.opus(call, signal), native = JSON.parse(receipt.raw.stdout);
      receipt.output = { ...structuredClone(ready.repair.priorEvidence.edited), editorChanges: ready.repair.guidance.findings.map(f => `${f.id} kept: Synthetic reader judgement follows.`) };
      native.session_id = '33333333-3333-4333-8333-333333333333'; native.structured_output = receipt.output;
      receipt.raw.stdout = JSON.stringify(native); return receipt;
    });
    x.f.args.reader.mockClear(); x.f.args.visual.mockClear();
    const result = await runSimpleWizardBook({ ...x.f.args, seed: config.seed, opus: editor,
      repair: { prior: ready.repair.prior, readings: ready.repair.readings } });
    expect(result.status).toBe('review_supported'); expect(result.source.accounting.providerCalls).toBe(3);
    expect(editor).toHaveBeenCalledTimes(1); expect(result.storyboard?.framePackets).toHaveLength(9);
    expect(x.f.args.reader.mock.calls.map(([c]) => c.stage)).toEqual(['final_review', 'comparison']);
    const final = JSON.parse(x.f.args.reader.mock.calls[0][0].input), comparison = JSON.parse(x.f.args.reader.mock.calls[1][0].input);
    expect(JSON.stringify(final)).not.toContain('readerObservations'); expect(JSON.stringify(final)).not.toContain('editorChanges');
    expect(final.packet.original).toBeUndefined();
    expect(comparison.packet.original.pages.map((p: any) => p.units.map((u: any) => u.text).join(''))).toEqual(ready.repair.prior.manuscript.pages.map(p => p.text));
    const last = x.f.args.publish.mock.calls[x.f.args.publish.mock.calls.length - 1][0]; expect(last.baseline).toBe('previous_edit');
    expect(last.original).toEqual({ title: ready.repair.prior.manuscript.title, pages: ready.repair.prior.manuscript.pages });
  });
  it('rejects invalid repair CLI arguments at the real bootstrap without opening any book or credential', () => {
    const result = spawnSync(process.execPath, ['scripts/personal-simple-book-repair.cjs', '--execute'],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 15000, windowsHide: true });
    expect(result.status).toBe(1); expect(result.signal).toBeNull(); expect(result.error).toBeUndefined();
    expect(result.stderr.trim()).toBe(JSON.stringify({ error: 'repair_failed', runtimeEligible: false }));
    expect(result.stdout).toBe('');
  }, 20000);
  it.each(['source', 'hash', 'inventory', 'termination', 'duplicate_cost', 'reconciliation', 'unknown', 'stopped', 'reading', 'parent_claim', 'budget'])(
    'refuses repair %s before allocating a slot or reading credentials', async kind => {
      const x = await heldContinuation(), disk = vi.spyOn(journal, 'fencedText');
      const rewrite = (relative: string, change: (v: any) => void) => {
        const file = path.join(x.old.directory, relative), value = JSON.parse(readFileSync(file, 'utf8')); change(value);
        writeFileSync(file, JSON.stringify(value)); x.data.artifacts.find(f => f.relative === relative)!.sha256 = sha(readFileSync(file));
      };
      if (kind === 'source') x.data.sourceHead = 'b'.repeat(40);
      if (kind === 'hash') x.data.artifacts[0].sha256 = 'b'.repeat(64);
      if (kind === 'inventory') x.data.artifacts = x.data.artifacts.filter(f => f.relative !== 'controlled-continuation-20261008/writing-reuse.json');
      if (kind === 'termination') { writeFileSync(x.data.terminationReceipt.file, JSON.stringify({ code: 2, signal: null, terminationConfirmed: false })); x.data.terminationReceipt.sha256 = sha(readFileSync(x.data.terminationReceipt.file)); }
      if (kind === 'duplicate_cost') x.data.extraEngineeringReceipts.push(config.engineeringReceipts[0]);
      if (kind === 'reconciliation') x.data.reconciledEngineeringReceipt = config.engineeringReceipts[0];
      if (kind === 'parent_claim') rewrite('controlled-continuation-20261008/claim.json', v => { v.sourceHead = 'b'.repeat(40); });
      if (kind === 'reading') rewrite('continuation-simple-book-result.json', v => { v.readings[0].findings[0].revised[0].quote += ' forgery'; });
      if (kind === 'budget') x.data.maximumMicroUsd = 25000000;
      if (kind === 'unknown' || kind === 'stopped') {
        rewrite('controlled-continuation-20261008/paid-stages/final_review.result.json', v => {
          if (kind === 'unknown') v.estimatedMicroUsd = null; else v.completed = false;
        });
        rewrite('continuation-sealed.json', v => { v.snapshot = new SimpleBookBudget(path.join(x.parent.directory, 'paid-stages'), x.parent.externalMicroUsd).snapshot(); });
      }
      writeFileSync(x.repairFile, JSON.stringify(x.data));
      await expect(prepareSimpleBookRepair(x.repairFile)).rejects.toThrow();
      expect(existsSync(path.join(x.old.directory, 'controlled-editor-repair-20261008'))).toBe(false);
      expect(sdk.create).not.toHaveBeenCalled(); expect(disk.mock.calls.some(([p]) => p === config.existingKeyEnvFile)).toBe(false);
    });
  it.each(['held_again', 'invalid_reading', 'unknown_editor_cost', 'cancelled', 'source_drift'])(
    'one actual fresh editor then %s stops without a second repair, author or image', async kind => {
      const x = await heldContinuation(), ready = await prepareSimpleBookRepair(x.repairFile), claimed = ready.claim();
      const author = vi.fn();
      const editor = vi.fn(async (_wire: any, call: any, signal: AbortSignal) => {
        if (call.stage === 'author') { author(); throw Error('No new author allowed.'); }
        expect(signal.aborted).toBe(false);
        const receipt = await x.f.args.opus(call, signal), native = JSON.parse(receipt.raw.stdout);
        receipt.output = { ...structuredClone(ready.repair.priorEvidence.edited), editorChanges: ready.repair.guidance.findings.map(f => `${f.id} kept: Synthetic reason, reviewer will judge.`) };
        native.session_id = '33333333-3333-4333-8333-333333333333'; native.structured_output = receipt.output;
        receipt.raw.stdout = JSON.stringify(native);
        if (kind === 'unknown_editor_cost') receipt.estimatedMicroUsd = null as any;
        if (kind === 'cancelled') process.emit('SIGINT');
        if (kind === 'source_drift') writeFileSync(x.repairFile, readFileSync(x.repairFile, 'utf8') + ' ');
        return receipt;
      });
      vi.mocked(adapters.createOpusCausalTransport).mockReturnValue(editor);
      if (kind === 'invalid_reading') sdk.create.mockImplementation(async () => ({ model: adapters.CAUSAL_MODELS.astra, service_tier: 'default', status: 'completed',
        usage: { input_tokens: 100, output_tokens: 100 }, output_text: JSON.stringify({ packetDigest: '0'.repeat(64), summary: 'SYNTHETIC stale packet', findings: [] }) }));
      const code = await runSimpleBookWorkerPipeline({ config: ready.parent.original, configFile: x.repairFile,
        cliWorkspace: path.join(root, 'simple-book-cli-workspace'), worker: claimed.worker,
        repair: { budget: claimed.budget, inheritedAttempts: 5, assertCurrent: ready.verify, prior: ready.repair.prior, readings: ready.repair.readings } });
      expect(code).toBe(kind === 'held_again' ? 2 : 1); expect(editor).toHaveBeenCalledTimes(1); expect(author).not.toHaveBeenCalled();
      expect(sdk.create).toHaveBeenCalledTimes(kind === 'held_again' ? 2 : kind === 'invalid_reading' ? 1 : 0);
      const seal = JSON.parse(readFileSync(path.join(x.old.directory, 'repair-sealed.json'), 'utf8'));
      expect(seal.imageCalls).toBe(0); expect(seal.inheritedLogicalAttempts).toBe(5);
      expect(claimed.budget.snapshot().logicalAttempts).toBe(kind === 'held_again' ? 3 : kind === 'invalid_reading' ? 2 : 1);
      if (kind === 'unknown_editor_cost') expect(claimed.budget.snapshot()).toMatchObject({ unknownAttemptCosts: 1, stopped: true });
      for (const [n, digest] of [...x.originalHashes, ...x.heldHashes]) expect(sha(readFileSync(path.join(x.old.directory, n)))).toBe(digest);
    });
  it('expands references without losing constraints or legitimate properties named definitions', () => {
    const item = { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string', pattern: '^r-', maxLength: 100 } } };
    const schema = { type: 'object', additionalProperties: false, required: ['original', 'revised', 'definitions'],
      properties: { original: { type: 'array', maxItems: 2, items: { $ref: '#/definitions/citation' } },
        revised: { type: 'array', minItems: 0, maxItems: 2, items: { $ref: '#/definitions/citation' } }, definitions: { type: 'string' } }, definitions: { citation: item } };
    expect(inlineLocalJsonSchemaReferences(schema)).toEqual({ ...schema, definitions: undefined,
      properties: { ...schema.properties, original: { type: 'array', maxItems: 2, items: item }, revised: { type: 'array', minItems: 0, maxItems: 2, items: item } } });
    expect(schema.properties.original.items).toEqual({ $ref: '#/definitions/citation' });
  });
  it.each(['missing', 'external', 'cycle', 'siblings'])('rejects %s references instead of silently weakening a schema', kind => {
    const schema: any = { type: 'object', properties: { x: { $ref: kind === 'external' ? 'https://invalid.test/schema' : '#/definitions/x' } },
      definitions: kind === 'missing' ? {} : { x: kind === 'cycle' ? { $ref: '#/definitions/x' } : { type: 'string' } } };
    if (kind === 'siblings') schema.properties.x.maxLength = 1;
    expect(() => inlineLocalJsonSchemaReferences(schema)).toThrow('inline_schema_invalid');
  });
  it('leaves default wires unchanged, binds the opt-in before key read and types a whitespace limit failure', async () => {
    const f = await fixture(); await runSimpleWizardBook(f.args);
    const call = { ...f.args.reader.mock.calls[0][0], role: 'astra' as const, conversationKey: 'synthetic:reader' };
    const policy = { executable: config.executable, executableSha256: config.executableSha256, workspace: root, maxWireBytes: 104000,
      rates: { opus: { inputMicroUsdPerToken: 4, outputMicroUsdPerToken: 20 }, astra: { inputMicroUsdPerToken: 10, outputMicroUsdPerToken: 50 } } };
    const old = adapters.prepareCausalWire(call, policy, 2000000), wire = adapters.prepareCausalWire(call, { ...policy, astraInlineReferences: true }, 2000000);
    expect(old.json).toContain('$ref'); expect(wire.json).not.toContain('$ref');
    expect(wire.payload).toMatchObject({ model: adapters.CAUSAL_MODELS.astra, max_output_tokens: 16000, reasoning: { effort: 'medium' } });
    const key = vi.fn(() => 'SYNTHETIC_ONLY'), transport = adapters.createAstraCausalTransport({ key, rates: policy.rates.astra, inlineReferences: true });
    await expect(transport(old, call, f.args.signal)).rejects.toThrow('wire_contract'); expect(key).not.toHaveBeenCalled(); expect(sdk.create).not.toHaveBeenCalled();
    sdk.create.mockResolvedValue({ model: adapters.CAUSAL_MODELS.astra, service_tier: 'default', status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' },
      output_text: '{"incomplete":' + ' '.repeat(300), usage: { input_tokens: 100, output_tokens: 100 } });
    await expect(transport(wire, call, f.args.signal)).rejects.toMatchObject({ code: 'astra_output_limit_whitespace', receipt: { estimatedMicroUsd: 6000 } });
  });
  it('previews without keys, imports two bound native records and cannot claim a second continuation', async () => {
    const x = await failedOriginal(), disk = vi.spyOn(journal, 'fencedText');
    expect(await simpleBookContinuationCLI(['--config', x.recoveryFile])).toBe(0);
    expect(disk.mock.calls.some(([p]) => p === config.existingKeyEnvFile)).toBe(false); expect(sdk.create).not.toHaveBeenCalled();
    const ready = prepareSimpleBookContinuation(x.recoveryFile), claimed = ready.claim();
    expect(claimed.budget.snapshot()).toMatchObject({ knownEstimateMicroUsd: 406000, logicalAttempts: 0, stopped: false });
    const calls = x.f.args.opus.mock.calls.map(([call]) => call);
    for (let i = 0; i < calls.length; i++) {
      expect(await ready.reuseWriting(calls[i])).toEqual(await x.f.args.opus.mock.results[i].value);
      await expect(ready.reuseWriting({ ...calls[i], input: calls[i].input + ' changed' })).rejects.toThrow('continuation_writer_binding');
      await expect(ready.reuseWriting({ ...calls[i], instructions: calls[i].instructions + ' changed' })).rejects.toThrow('continuation_writer_binding');
      await expect(ready.reuseWriting({ ...calls[i], schema: calls[i].schema.describe('SYNTHETIC changed schema; same output still parses') })).rejects.toThrow('continuation_writer_binding');
    }
    expect(() => prepareSimpleBookContinuation(x.recoveryFile).claim()).toThrow();
    for (const [n, digest] of x.originalHashes) expect(sha(readFileSync(path.join(x.old.directory, n)))).toBe(digest);
    expect(x.budget.snapshot()).toMatchObject({ knownEstimateMicroUsd: 206000, stopped: true });
  });
  it.each(['source', 'hash', 'inventory', 'unknown', 'overslot', 'reviewer_model', 'termination', 'duplicate', 'budget'])('refuses %s before continuation claim or provider work', async kind => {
    const x = await failedOriginal();
    if (kind === 'source') x.data.sourceHead = 'b'.repeat(40);
    if (kind === 'hash') x.data.artifacts[0].sha256 = 'c'.repeat(64);
    if (kind === 'inventory') x.data.artifacts = x.data.artifacts.filter(a => a.relative !== 'paid-stages/final_review.failure.json');
    if (kind === 'unknown') {
      const target = path.join(x.paid, 'final_review.result.json'), changed = { ...JSON.parse(readFileSync(target, 'utf8')), estimatedMicroUsd: null };
      writeFileSync(target, JSON.stringify(changed)); x.data.artifacts.find(a => a.relative === 'paid-stages/final_review.result.json')!.sha256 = sha(readFileSync(target));
      const sealedFile = path.join(x.old.directory, 'sealed.json'), sealed = JSON.parse(readFileSync(sealedFile, 'utf8'));
      sealed.snapshot = x.budget.snapshot(); writeFileSync(sealedFile, JSON.stringify(sealed));
      x.data.artifacts.find(a => a.relative === 'sealed.json')!.sha256 = sha(readFileSync(sealedFile));
    }
    if (kind === 'overslot') {
      const target = path.join(x.paid, 'author.claim.json'), changed = { ...JSON.parse(readFileSync(target, 'utf8')), maximumMicroUsd: 99999 };
      writeFileSync(target, JSON.stringify(changed)); x.data.artifacts.find(a => a.relative === 'paid-stages/author.claim.json')!.sha256 = sha(readFileSync(target));
      const sealedFile = path.join(x.old.directory, 'sealed.json'), sealed = JSON.parse(readFileSync(sealedFile, 'utf8'));
      sealed.snapshot = x.budget.snapshot(); writeFileSync(sealedFile, JSON.stringify(sealed));
      x.data.artifacts.find(a => a.relative === 'sealed.json')!.sha256 = sha(readFileSync(sealedFile));
    }
    if (kind === 'reviewer_model') {
      const target = path.join(x.paid, 'final_review.failure.json'), changed = JSON.parse(readFileSync(target, 'utf8'));
      changed.receipt.raw.model = 'SYNTHETIC_WRONG_MODEL'; writeFileSync(target, JSON.stringify(changed));
      x.data.artifacts.find(a => a.relative === 'paid-stages/final_review.failure.json')!.sha256 = sha(readFileSync(target));
    }
    if (kind === 'termination') { writeFileSync(x.data.terminationReceipt.file, JSON.stringify({ code: 1, signal: null, terminationConfirmed: false })); x.data.terminationReceipt.sha256 = sha(readFileSync(x.data.terminationReceipt.file)); }
    if (kind === 'duplicate') x.data.extraEngineeringReceipts = [config.engineeringReceipts[0]];
    if (kind === 'budget') x.data.maximumMicroUsd = 25000000;
    writeFileSync(x.recoveryFile, JSON.stringify(x.data)); expect(() => prepareSimpleBookContinuation(x.recoveryFile)).toThrow();
    expect(sdk.create).not.toHaveBeenCalled(); expect(existsSync(path.join(x.old.directory, 'controlled-continuation-20261008'))).toBe(false);
  });
  it('uses the shared pipeline with zero new writers and stops at a valid story HOLD, preserving the failed seal', async () => {
    const x = await failedOriginal(), ready = prepareSimpleBookContinuation(x.recoveryFile), claimed = ready.claim();
    const forbiddenWriter = vi.fn(); vi.spyOn(adapters, 'createOpusCausalTransport').mockReturnValue(forbiddenWriter);
    sdk.create.mockImplementation(async (payload: any) => {
      const packet = JSON.parse(payload.input), unit = packet.packet.manuscript?.pages[0].units[0];
      return { model: adapters.CAUSAL_MODELS.astra, service_tier: 'default', status: 'completed', usage: { input_tokens: 100, output_tokens: 100 },
        output_text: JSON.stringify({ packetDigest: packet.packetDigest, summary: 'SYNTHETIC complete boundary review.', findings: unit ? [{ severity: 'meaningful', kind: 'issue',
          criterion: 'SYNTHETIC material issue', original: [], revised: [{ startId: unit.id, endId: unit.id, anchor: citationTokens(unit.text).slice(0, 2).join(' ') }],
          explanation: 'SYNTHETIC source-bound hold; no literary judgement.' }] : [] }) };
    });
    expect(await runSimpleBookWorkerPipeline({ config: ready.original, configFile: x.recoveryFile, cliWorkspace: path.join(root, 'simple-book-cli-workspace'),
      worker: claimed.worker, continuation: { budget: claimed.budget, inheritedAttempts: 3, assertCurrent: ready.verify, reuseWriting: ready.reuseWriting } })).toBe(2);
    expect(forbiddenWriter).not.toHaveBeenCalled(); expect(sdk.create).toHaveBeenCalledTimes(2);
    expect(claimed.budget.snapshot()).toMatchObject({ knownEstimateMicroUsd: 418000, logicalAttempts: 2, stopped: false });
    expect(JSON.parse(readFileSync(path.join(x.old.directory, 'continuation-sealed.json'), 'utf8'))).toMatchObject({ status: 'story_held', imageCalls: 0 });
    for (const [n, digest] of x.originalHashes) expect(sha(readFileSync(path.join(x.old.directory, n)))).toBe(digest);
  });
  it('names new visual provider evidence as continuation without changing the original failed evidence', async () => {
    const x = await failedOriginal(), ready = prepareSimpleBookContinuation(x.recoveryFile), claimed = ready.claim();
    const forbiddenWriter = vi.fn(); vi.spyOn(adapters, 'createOpusCausalTransport').mockReturnValue(forbiddenWriter);
    sdk.create.mockImplementation(async (payload: any) => {
      if (sdk.create.mock.calls.length > 2) return { model: 'SYNTHETIC_WRONG_MODEL', service_tier: 'default', status: 'completed',
        usage: { input_tokens: 100, output_tokens: 100 }, output_text: '{}' };
      const packet = JSON.parse(payload.input);
      return { model: adapters.CAUSAL_MODELS.astra, service_tier: 'default', status: 'completed', usage: { input_tokens: 100, output_tokens: 100 },
        output_text: JSON.stringify({ packetDigest: packet.packetDigest, summary: 'SYNTHETIC source-bound reading, no literary claim.', findings: [] }) };
    });
    expect(await runSimpleBookWorkerPipeline({ config: ready.original, configFile: x.recoveryFile, cliWorkspace: path.join(root, 'simple-book-cli-workspace'),
      worker: claimed.worker, continuation: { budget: claimed.budget, inheritedAttempts: 3, assertCurrent: ready.verify, reuseWriting: ready.reuseWriting } })).toBe(1);
    expect(forbiddenWriter).not.toHaveBeenCalled(); expect(sdk.create).toHaveBeenCalledTimes(3);
    const responses = require('node:fs').readdirSync(x.old.directory).filter((n: string) => n.endsWith('-provider-response.json'));
    expect(responses).toHaveLength(1); expect(responses[0]).toMatch(/^continuation-/);
    for (const [n, digest] of x.originalHashes) expect(sha(readFileSync(path.join(x.old.directory, n)))).toBe(digest);
  });
});
