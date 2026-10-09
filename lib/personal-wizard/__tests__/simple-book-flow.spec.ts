import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
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
import { emptySimpleBookView, readSimpleBookView, newerSimpleBookView, simpleBookViewSchema } from '../simple-book-view';
import { SimpleBookBudget, simpleBookExternalCosts } from '../simple-book-budget';
import { enqueueSimpleBook, simpleBookQueueDirectory, claimSimpleBookWorker, simpleBookConfig, type SimpleBookConfig } from '../simple-book-bridge';
import * as frozen from '../../../scripts/personal-source-git';
import * as journal from '../../../scripts/personal-causal-trial-journal';
import { GET, POST } from '@/app/api/dev/personal-wizard/simple-book/route';
import { simpleWizardVisualPayload, simpleWizardWorkerCLI } from '../../../scripts/personal-simple-wizard-worker';
import * as adapters from '../../../scripts/personal-causal-trial-adapters';
import { personalBookProviderPayload } from '../book-openai';
import { citationTokens } from '../story-source-citations';
import { illustrateSimpleBook, illustratedBookHTML, illustratedAuditionApprovalSchema, REFERENCE_DESIGN_JUDGE_INSTRUCTION, referenceRoleContextSchema } from '../simple-book-illustrations';
import { auditionUsageCost, readAuditionImage } from '../../../scripts/personal-simple-book-illustrator';
import * as images from '../../generate-image';
import { QUALITY_CATEGORIES, PREVIEW_JUDGE_INSTRUCTION } from '../../local-preview-quality';
import sharp from 'sharp';
import type { PageChildResemblanceVisionResult } from '../../generation-pipeline/page-child-resemblance-vision';
import { inlineLocalJsonSchemaReferences } from '../../../scripts/personal-inline-json-schema';
import { prepareSimpleBookContinuation } from '../simple-book-continuation';
import { simpleBookContinuationCLI } from '../../../scripts/personal-simple-book-continuation';
import { runSimpleBookWorkerPipeline } from '../../../scripts/personal-simple-wizard-worker';
import { prepareSimpleBookRepair } from '../simple-book-repair';
import { simpleBookRepairCLI } from '../../../scripts/personal-simple-book-repair';
import { prepareSimpleBookVisualContinuation, visualEvidenceFiles } from '../simple-book-visual-continuation';
import { simpleBookVisualContinuationCLI } from '../../../scripts/personal-simple-book-visual-continuation';
import { prepareSimpleBookReferenceRecovery, referenceRecoveryConfigSchema } from '../simple-book-reference-recovery';
import { prepareEntityAuthorityContinuation } from '../simple-book-entity-authority';
import { prepareEntityRepairContinuation, prepareReferenceStateContinuation, prepareReferenceRoleContinuation } from '../simple-book-entity-repair';
import { simpleReferenceEntityDesign, simpleReferenceDesigns, REFERENCE_STATE_JUDGE_ADDITION } from '../simple-reference-designs';
import { simpleBookReferenceRecoveryCLI } from '../../../scripts/personal-simple-book-reference-recovery';
import { simpleStoryReadingPackets } from '../simple-story-source';
import { canonicalJson } from '../request-acceptance';

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
  it('keeps inherited plus current attempts within80 before a new claim or dispatch', async () => {
    const budget = new SimpleBookBudget(path.join(root, 'attempt-floor'), 0, 20000000, 79), dispatch = vi.fn(async () => ({ value: true, estimatedMicroUsd: 1, receipt: {} }));
    expect(await budget.run('last_allowed', {}, 1, dispatch)).toBe(true);
    expect(budget.previousLogicalAttempts + budget.snapshot().logicalAttempts).toBe(80);
    await expect(budget.run('over_limit', {}, 1, dispatch)).rejects.toThrow('simple_budget_policy');
    expect(dispatch).toHaveBeenCalledTimes(1); expect(existsSync(path.join(budget.root, 'over_limit.claim.json'))).toBe(false);
    for (const previous of [-1, 80, NaN, 1.5]) expect(() => new SimpleBookBudget(path.join(root, 'bad-floor'), 0, 20000000, previous)).toThrow('simple_budget_policy');
  });
  it('keeps default12m, explicitly meters14m, rejects other ceilings and stops14m before an over-budget claim', async () => {
    expect(new SimpleBookBudget(path.join(root, 'default'), 0).maximumMicroUsd).toBe(12000000);
    for (const maximum of [0, 13000000, 14000001, 25000000]) expect(() => new SimpleBookBudget(path.join(root, 'invalid'), 0, maximum)).toThrow('simple_budget_policy');
    const budget = new SimpleBookBudget(path.join(root, 'extended'), 13999999, 14000000), dispatch = vi.fn();
    await expect(budget.run('page_8_0', {}, 2, dispatch)).rejects.toThrow('simple_budget_exhausted');
    expect(dispatch).not.toHaveBeenCalled(); expect(existsSync(path.join(root, 'extended/page_8_0.claim.json'))).toBe(false);
    const sixteen = new SimpleBookBudget(path.join(root, 'sixteen'), 15999999, 16000000);
    await expect(sixteen.run('page_8_0', {}, 2, dispatch)).rejects.toThrow('simple_budget_exhausted');
    expect(dispatch).not.toHaveBeenCalled(); expect(existsSync(path.join(root, 'sixteen/page_8_0.claim.json'))).toBe(false);
    expect(readSimpleBookView({ ...emptySimpleBookView('a'.repeat(64)), accounting: { ...emptySimpleBookView('a'.repeat(64)).accounting, allowanceMicroUsd: 14000000 } }, 'a'.repeat(64))).toBeNull();
  });
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
  async function workerFixture(reviewModel?: 'gpt-6.1-sol') {
    if (reviewModel) { config.reviewModel = reviewModel; config.actorOwnedAppearance = true; }
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
    if (reviewModel) {
      delete (draft.plan as any).wardrobe;
      (draft.plan as any).actorAppearance = { child: { role: 'child', clothing: ['red shirt', 'blue shorts', 'teal shoes'] }, companion: { role: 'companion', authority: 'companionVisualAuthority' } };
    }
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
  it('routes all three future text/board reviews to exact Sol, retains Opus writing and Astra planning, and prices actual receipts', async () => {
    const f = await workerFixture('gpt-6.1-sol');
    expect(await simpleWizardWorkerCLI(['--config', file, '--execute'])).toBe(0);
    expect(sdk.create.mock.calls.map(([p]) => p.model)).toEqual(['gpt-6.1-sol', 'gpt-6.1-sol', 'gpt-6-astra', 'gpt-6.1-sol']);
    expect(f.args.opus.mock.calls.map(([call]) => call.stage)).toEqual(['author', 'editor']);
    for (const step of ['final_review', 'comparison', 'storyboard_review']) {
      const result = JSON.parse(readFileSync(path.join(f.directory, `paid-stages/${step}.result.json`), 'utf8'));
      expect(result.estimatedMicroUsd).toBe(1200); expect(result.completed).toBe(true);
    }
    const result = JSON.parse(readFileSync(path.join(f.directory, 'simple-book-result.json'), 'utf8'));
    expect(result.storyboard.storyboard.plan.actorAppearance.child.role).toBe('child');
  });
  it('a different reported reviewer model holds with unknown pricing instead of a silent Astra fallback', async () => {
    const f = await workerFixture('gpt-6.1-sol'), normal = sdk.create.getMockImplementation()!;
    sdk.create.mockImplementation(async p => ({ ...await normal(p), model: 'gpt-6-astra' }));
    expect(await simpleWizardWorkerCLI(['--config', file, '--execute'])).toBe(1);
    expect(sdk.create).toHaveBeenCalledTimes(1);
    const sealed = JSON.parse(readFileSync(path.join(f.directory, 'sealed.json'), 'utf8'));
    expect(sealed.snapshot).toMatchObject({ stopped: true, unknownAttemptCosts: 1 });
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
  it.each([undefined, 'gpt-6.1-sol'] as const)('runs the actual %s opt-in worker through 3 references, 9 images, pixel QA, numeric identity and owned private serving with synthetic transports', async reviewer => {
    const f = await workerFixture(reviewer), approvalFile = path.join(root, 'visual-approval.json');
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
      const buffer = await sharp({ create: { width: reviewer ? 1024 : 64, height: reviewer ? 1024 : 64, channels: 3, background: { r: ++generated, g: 60, b: 90 } } }).png().toBuffer();
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
    if (reviewer) {
      const pixelCalls = sdk.create.mock.calls.filter(([p]) => Array.isArray(p.input));
      expect(pixelCalls).toHaveLength(12);
      for (const [p] of pixelCalls) {
        expect(p.model).toBe('gpt-6.1-sol'); expect(p.reasoning.effort).toBe('medium'); expect(p.max_output_tokens).toBe(12000);
        expect(p.input[0].content.slice(1).every((image: any) => image.type === 'input_image' && image.image_url.startsWith('data:image/png;base64,'))).toBe(true);
      }
      expect(JSON.parse(readFileSync(path.join(directory, 'paid-stages/reference_child_qa.result.json'), 'utf8')).estimatedMicroUsd).toBe(1200);
      expect(JSON.parse(readFileSync(path.join(directory, 'paid-stages/reference_child_qa.claim.json'), 'utf8')).maximumMicroUsd).toBe(600000);
    }
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
  it('requires an owned storyboard before a child reference is generated when the new policy is selected', async () => {
    const f = await illustrationFixture();
    await expect(illustrateSimpleBook({ ...f.args, actorOwnedAppearance: true })).rejects.toThrow('simple_visual_ownership_required');
    expect(f.args.render).not.toHaveBeenCalled(); expect(f.args.judge).not.toHaveBeenCalled();
  });
  it('requires an explicit fresh rebuild before a subset can influence generation', async () => {
    const f = await illustrationFixture();
    await expect(illustrateSimpleBook({ ...f.args, entityDesignAuthority: { candidate: f.args.companion, context: {}, review: {} } }))
      .rejects.toThrow('simple_entity_authority_scope');
    expect(f.args.render).not.toHaveBeenCalled(); expect(f.args.judge).not.toHaveBeenCalled();
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
    expect(auditionUsageCost({ input_tokens: 100, output_tokens: 100 }, 'sol')).toBe(1200);
    expect(auditionUsageCost({ input_tokens: 272001, output_tokens: 100 }, 'sol')).toBe(272001 * 4 + 1500);
    expect(() => illustratedAuditionApprovalSchema.parse({ ...syntheticVisualApproval(), customerCharge: true })).toThrow();
    expect(() => readAuditionImage(root, { imageName: '../file.png', imageSha: 'a'.repeat(64) })).toThrow('simple_image_path');
    expect(readSimpleBookView({ ...emptySimpleBookView('a'.repeat(64)), phase: 'illustrated_audition' }, 'a'.repeat(64))).toBeNull();
  });
});

describe('explicit same-book continuation, no provider in fixtures', () => {
  async function failedOriginal(illustrated = false) {
    const f = await fixture();
    if (illustrated) {
      const approvalFile = path.join(root, 'visual-approval.json'); writeFileSync(approvalFile, JSON.stringify(syntheticVisualApproval()));
      config.illustratedAudition = { approvalFile, approvalSha256: sha(readFileSync(approvalFile)), childDesign: 'Synthetic fictional child, short brown hair, brown eyes.' };
    }
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
  async function heldContinuation(illustrated = false) {
    const x = await failedOriginal(illustrated), parent = prepareSimpleBookContinuation(x.recoveryFile), claimed = parent.claim();
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
    const projected = simpleStoryReadingPackets(x.f.request, result.source, options);
    expect(projected.comparison.original!.pages.map(p => p.text)).toEqual(ready.repair.prior.manuscript.pages.map(p => p.text));
  });
  async function failedVisualParent() {
    const x = await heldContinuation(true), ready = await prepareSimpleBookRepair(x.repairFile), claimed = ready.claim();
    const editor = vi.fn(async (_wire: any, call: any, signal: AbortSignal) => {
      const r = await x.f.args.opus(call, signal), native = JSON.parse(r.raw.stdout);
      r.output = { ...structuredClone(ready.repair.priorEvidence.edited), editorChanges: ready.repair.guidance.findings.map(f => `${f.id} kept: Synthetic fixture, not literary judgment.`) };
      native.session_id = '33333333-3333-4333-8333-333333333333'; native.structured_output = r.output; r.raw.stdout = JSON.stringify(native); return r;
    });
    vi.mocked(adapters.createOpusCausalTransport).mockReturnValue(editor);
    const strip = ({ pageNumber: _n, ...row }: any) => row, d = structuredClone(x.f.storyboardDraft);
    const draft = { ...d, plan: { ...d.plan, pages: d.plan.pages.map(strip), continuity: { ...d.plan.continuity, pages: d.plan.continuity.pages.map(strip) } }, sequence: { ...d.sequence, pages: d.sequence.pages.map(strip) } };
    const group = (checks: any[]) => Object.fromEntries(checks.map(({ category, ...row }) => [category, row]));
    const review = { bookChecks: group(x.f.review.bookChecks), frames: x.f.review.frames.map(f => group(f.checks)) };
    sdk.create.mockImplementation(async p => {
      if (Array.isArray(p.input)) {
        const c = JSON.parse(p.input[0].content[0].text), r = cleanPixelReview(c.candidateSha, c.contextSha);
        r.checks.find(c => c.category === 'identity')!.verdict = 'defect' as any;
        r.checks.find(c => c.category === 'identity')!.correction = 'SYNTHETIC identity defect; fixture not an actual artwork diagnosis.';
        return { model: p.model, service_tier: 'default', status: 'completed', usage: { input_tokens: 100, output_tokens: 100 }, output_text: JSON.stringify(r) };
      }
      const name = p.text.format.name, output = name === 'personal_book_storyboard' ? draft : name === 'personal_book_review' ? review
        : { packetDigest: JSON.parse(p.input).packetDigest, summary: 'Synthetic complete reading, no literary acceptance.', findings: [] };
      return { model: p.model, service_tier: 'default', status: 'completed', usage: { input_tokens: 100, output_tokens: 100 }, output_text: JSON.stringify(output) };
    });
    let imagesMade = 0;
    const render = vi.spyOn(images, 'generateGPTImage').mockImplementation(async input => {
      const buffer = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: { r: ++imagesMade, g: 60, b: 90 } } }).png().toBuffer();
      const usage = { input_tokens: 100, output_tokens: 100 }, raw = { data: [{ b64_json: buffer.toString('base64') }], usage };
      input.observeProviderResponse?.(raw);
      return { buffer, usage, model: 'gpt-image-2', finalPrompt: input.finalPrompt, hasReferencePhoto: !!input.referenceImages?.length,
        apiMode: input.referenceImages?.length ? 'images.edit' : 'images.generate', referenceCountRequested: input.referenceImages?.length ?? 0,
        referenceCountPassed: input.referenceImages?.length ?? 0, durationMs: 1, fallbackUsed: false };
    });
    expect(await runSimpleBookWorkerPipeline({ config: ready.parent.original, configFile: x.repairFile,
      cliWorkspace: path.join(root, 'simple-book-cli-workspace'), worker: claimed.worker,
      repair: { budget: claimed.budget, inheritedAttempts: 5, assertCurrent: ready.verify, prior: ready.repair.prior, readings: ready.repair.readings } })).toBe(1);
    expect(editor).toHaveBeenCalledTimes(1); expect(render).toHaveBeenCalledTimes(1);
    const terminal = path.join(root, 'SYNTHETIC-visual-parent-terminal.json');
    writeFileSync(terminal, JSON.stringify({ head: config.sourceHead, status: '', code: 1, signal: null, terminationConfirmed: true, stopped: false, referenceCap: 4 }));
    const technical = path.join(root, 'SYNTHETIC-visual-technical-qa.json');
    writeFileSync(technical, JSON.stringify({ head: config.sourceHead, status: '', code: 0, signal: null, terminationConfirmed: true, stopped: false,
      isError: false, resultSubtype: 'success', maximumMicroUsd: 900000, reportedCostUsd: .001, models: ['claude-opus-5-5'],
      qaVerdict: 'PASS', qaReviewHead: config.sourceHead, qaBase: '7fece1230a0a9c523d53e3decbe7357f12ed576d', qaMode: 'read_only_code' }));
    const names = ['repair-simple-book-result.json', 'repair-sealed.json', 'repair-story.md',
      ...visualEvidenceFiles(ready.directory).map(n => `controlled-editor-repair-20261008/${n}`),
      ...visualEvidenceFiles(path.join(x.old.directory, 'illustrations')).map(n => `illustrations/${n}`),
      ...require('node:fs').readdirSync(x.old.directory).filter((n: string) => /^view-\d{4}\.json$/.test(n) || /^(?:reference_|page_|audition_|illustrated_)/.test(n))];
    const technicalRef = { file: technical, sha256: sha(readFileSync(technical)) };
    const visualData = { version: 'controlled-simple-book-visual-continuation/v1', repairConfig: { file: x.repairFile, sha256: sha(readFileSync(x.repairFile)) },
      terminationReceipt: { file: terminal, sha256: sha(readFileSync(terminal)) }, sourceHead: config.sourceHead, approvalReference: 'SYNTHETIC scoped visual continuation, NOT live approval.',
      maximumMicroUsd: 12000000, reviewModel: 'gpt-6.1-sol', actorOwnedAppearance: true,
      artifacts: names.map(relative => ({ relative, sha256: sha(readFileSync(path.join(x.old.directory, relative))) })), extraEngineeringReceipts: [technicalRef], technicalReviewReceipt: technicalRef };
    const visualFile = path.join(root, 'visual.json'); writeFileSync(visualFile, JSON.stringify(visualData));
    sdk.create.mockClear(); editor.mockClear(); render.mockClear();
    return { ...x, ready, visualData, visualFile, names, oldHashes: names.map(n => [n, sha(readFileSync(path.join(x.old.directory, n)))]) as [string, string][], render, editor, review };
  }
  it('previews a visual-only continuation without keys or model calls and admits exactly one fixed sibling', async () => {
    const x = await failedVisualParent(), disk = vi.spyOn(journal, 'fencedText');
    expect(await simpleBookVisualContinuationCLI(['--config', x.visualFile])).toBe(0);
    expect(sdk.create).not.toHaveBeenCalled(); expect(x.editor).not.toHaveBeenCalled(); expect(x.render).not.toHaveBeenCalled();
    expect(disk.mock.calls.some(([p]) => p === config.existingKeyEnvFile)).toBe(false);
    const ready = await prepareSimpleBookVisualContinuation(x.visualFile), claimed = ready.claim();
    expect(claimed.budget.snapshot()).toMatchObject({ unknownAttemptCosts: 0, logicalAttempts: 0 });
    expect(() => ready.claim()).toThrow();
    for (const [n, hash] of x.oldHashes) expect(sha(readFileSync(path.join(x.old.directory, n)))).toBe(hash);
  }, 30000);
  it.each(['source', 'artifact', 'inventory', 'termination', 'technical_head', 'technical_hold', 'unknown', 'wrong_reader_model', 'different_reference_hold'])(
    'refuses visual %s before any claim, key or provider', async kind => {
      const x = await failedVisualParent();
      const change = (relative: string, action: (v: any) => void) => {
        const p = path.join(x.old.directory, relative), value = JSON.parse(readFileSync(p, 'utf8')); action(value); writeFileSync(p, JSON.stringify(value));
        x.visualData.artifacts.find(f => f.relative === relative)!.sha256 = sha(readFileSync(p));
      };
      if (kind === 'source') x.visualData.sourceHead = 'b'.repeat(40);
      if (kind === 'artifact') x.visualData.artifacts[0].sha256 = 'b'.repeat(64);
      if (kind === 'inventory') x.visualData.artifacts = x.visualData.artifacts.filter(f => f.relative !== 'controlled-editor-repair-20261008/paid-stages/reference_child_qa.wire.json');
      if (kind === 'termination') { writeFileSync(x.visualData.terminationReceipt.file, JSON.stringify({ code: 1, signal: null, terminationConfirmed: false })); x.visualData.terminationReceipt.sha256 = sha(readFileSync(x.visualData.terminationReceipt.file)); }
      if (kind === 'technical_head' || kind === 'technical_hold') { const p = x.visualData.technicalReviewReceipt.file, v = JSON.parse(readFileSync(p, 'utf8'));
        if (kind === 'technical_head') v.head = 'b'.repeat(40); else v.qaVerdict = 'HOLD';
        writeFileSync(p, JSON.stringify(v)); x.visualData.technicalReviewReceipt.sha256 = sha(readFileSync(p)); x.visualData.extraEngineeringReceipts[0] = x.visualData.technicalReviewReceipt; }
      if (kind === 'unknown') change('controlled-editor-repair-20261008/paid-stages/reference_child_qa.result.json', v => { v.estimatedMicroUsd = null; });
      if (kind === 'wrong_reader_model') change('controlled-editor-repair-20261008/paid-stages/final_review.receipt.json', v => { v.raw.model = 'wrong'; });
      if (kind === 'different_reference_hold') change('repair-sealed.json', v => { v.code = 'different_hold'; });
      writeFileSync(x.visualFile, JSON.stringify(x.visualData));
      await expect(prepareSimpleBookVisualContinuation(x.visualFile)).rejects.toThrow();
      expect(existsSync(path.join(x.old.directory, 'controlled-visual-continuation-20261008'))).toBe(false);
      expect(sdk.create).not.toHaveBeenCalled(); expect(x.editor).not.toHaveBeenCalled(); expect(x.render).not.toHaveBeenCalled();
    }, 30000);
  async function visualTransportFixture() {
    const x = await failedVisualParent(), bad = JSON.parse(readFileSync(path.join(x.old.directory, 'controlled-editor-repair-20261008/paid-stages/reference_child.receipt.json'), 'utf8')).candidate;
    const ownership = { child: { role: 'child', clothing: ['red shirt', 'blue shorts', 'teal shoes'] }, companion: { role: 'companion', authority: 'companionVisualAuthority' } };
    sdk.create.mockImplementation(async p => {
      let out: any;
      if (Array.isArray(p.input)) {
        const c = JSON.parse(p.input[0].content[0].text); out = cleanPixelReview(c.candidateSha, c.contextSha);
        if (c.candidateSha === bad.imageSha) { out.checks[1].verdict = 'defect'; out.checks[1].correction = 'SYNTHETIC known old identity defect; not a real artwork claim.'; }
      } else if (p.text.format.name === 'owned_actor_appearance') out = { disposition: 'owned', actorAppearance: ownership, observation: 'Synthetic owner assignment only.' };
      else out = x.review;
      return { model: p.model, service_tier: 'default', status: 'completed', usage: { input_tokens: 100, output_tokens: 100 }, output_text: JSON.stringify(out) };
    });
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ model: 'gpt-4o-2024-08-06', usage: { prompt_tokens: 100, completion_tokens: 100 },
      choices: [{ message: { content: JSON.stringify({ referenceChildVisible: true, candidateChildVisible: true, candidateChildCount: 1, comparisonUsable: true,
        sameChildDecision: 'same', faceStructure: 'match', eyesBrows: 'match', noseMouth: 'match', hairIdentity: 'match', distinctiveFeatures: 'match' }) } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher); vi.stubEnv('GPT_IMAGE_EDIT_MAX_REFERENCES', '4');
    return { ...x, fetcher, bad, ownership };
  }
  async function referenceRecoveryFixture() {
    const x = await visualTransportFixture(), normal = sdk.create.getMockImplementation()!;
    sdk.create.mockImplementation(async p => {
      const r = await normal(p);
      if (Array.isArray(p.input)) { const c = JSON.parse(p.input[0].content[0].text), out = JSON.parse(r.output_text);
        if (c.candidateSha !== x.bad.imageSha) { out.checks[1].verdict = 'defect'; out.checks[1].correction = 'Synthetic target correction; not an artwork verdict.'; }
        r.output_text = JSON.stringify(out);
      }
      return r;
    });
    expect(await simpleBookVisualContinuationCLI(['--config', x.visualFile, '--execute'])).toBe(1);
    const visualDir = path.join(x.old.directory, 'controlled-visual-continuation-20261008');
    const terminal = path.join(root, 'SYNTHETIC-reference-parent-terminal.json');
    writeFileSync(terminal, JSON.stringify({ head: config.sourceHead, status: '', code: 1, signal: null, terminationConfirmed: true, stopped: false, referenceCap: 4 }));
    const technical = path.join(root, 'SYNTHETIC-reference-technical.json');
    writeFileSync(technical, JSON.stringify({ head: config.sourceHead, status: '', code: 0, signal: null, terminationConfirmed: true, stopped: false,
      isError: false, resultSubtype: 'success', maximumMicroUsd: 300000, reportedCostUsd: .001, models: [adapters.CAUSAL_MODELS.opus],
      qaVerdict: 'PASS', qaReviewHead: config.sourceHead, qaBase: 'd9ae20dc29195004f1fed6d246daefbe42610953', qaMode: 'read_only_code' }));
    const ref = (file: string) => ({ file, sha256: sha(readFileSync(file)) });
    const names = [...visualEvidenceFiles(visualDir).map(n => `controlled-visual-continuation-20261008/${n}`),
      ...require('node:fs').readdirSync(x.old.directory).filter((n: string) => /^view-\d{4}\.json$/.test(n))];
    const recoveryData = { version: 'controlled-simple-reference-recovery/v1', visualConfig: ref(x.visualFile), terminationReceipt: ref(terminal),
      sourceHead: config.sourceHead, approvalReference: 'SYNTHETIC one reference correction, NOT live permission.', maximumMicroUsd: 12000000,
      artifacts: names.map(relative => ({ relative, sha256: sha(readFileSync(path.join(x.old.directory, relative))) })),
      extraEngineeringReceipts: [ref(technical)], technicalReviewReceipt: ref(technical) };
    const recoveryFile = path.join(root, 'reference-recovery.json'); writeFileSync(recoveryFile, JSON.stringify(recoveryData));
    sdk.create.mockImplementation(normal); sdk.create.mockClear(); x.render.mockClear(); x.editor.mockClear(); x.fetcher.mockClear();
    return { ...x, visualDir, recoveryData, recoveryFile, heldHashes: names.map(n => [n, sha(readFileSync(path.join(x.old.directory, n)))]) as [string, string][] };
  }
  async function extendedRecoveryFixture() {
    const x = await referenceRecoveryFixture(), ref = (file: string) => ({ file, sha256: sha(readFileSync(file)) });
    const prior = { head: config.sourceHead, status: '', signal: null, terminationConfirmed: true, stopped: false,
      sessionId: '44444444-4444-4444-8444-444444444444', models: [adapters.CAUSAL_MODELS.opus] };
    const costs = [.01, .03, .041];
    const lineage = costs.map((reportedCostUsd, i) => { const f = path.join(root, `SYNTHETIC-prior-session-${i}.json`);
      writeFileSync(f, JSON.stringify({ ...prior, reportedCostUsd, maximumMicroUsd: 40000,
        ...(i < 2 ? { code: 1, isError: true, resultSubtype: 'error_max_budget_usd' } : { code: 0, isError: false, resultSubtype: 'success',
          qaVerdict: 'PASS', qaReviewHead: config.sourceHead, qaBase: 'd9ae20dc29195004f1fed6d246daefbe42610953', qaMode: 'read_only_code',
          previousCumulativeReportedCostUsd: .03, includesPreviousKnownFailedCalls: true, costKind: 'cumulative_same_cli_session_list_estimate_not_invoice' }) })); return ref(f); });
    const p = x.recoveryData.technicalReviewReceipt.file, technical = JSON.parse(readFileSync(p, 'utf8'));
    Object.assign(technical, { qaBase: 'b973b17fba433c4dc70df18ff847a7e7f7e33d94', sessionId: '55555555-5555-4555-8555-555555555555',
      reportedCostUsd: .002, maximumMicroUsd: 1000 }); // known completed native soft-slot overshoot, not failed QA
    writeFileSync(p, JSON.stringify(technical));
    const seal = JSON.parse(readFileSync(path.join(x.visualDir, 'sealed.json'), 'utf8'));
    const grantFile = path.join(root, 'SYNTHETIC-allowance.json'), grant = { version: 'local-simple-book-allowance-extension/v1',
      requestId: x.old.queued.requestId, parentVisualConfigSha256: x.recoveryData.visualConfig.sha256, inheritedKnownMicroUsd: seal.snapshot.knownEstimateMicroUsd,
      previousMaximumMicroUsd: 12000000, maximumMicroUsd: 14000000, ownerApprovalReference: 'SYNTHETIC same-book14 allowance, not live authorization.',
      sameBookOnly: true, publicRelease: false, customerCharge: false, gateChanges: false, acceptKnownCompletedNativeSoftCapOvershoot: true,
      reconciledSessionReceipts: lineage, reconciledMicroUsd: 41000 };
    writeFileSync(grantFile, JSON.stringify(grant));
    const data: any = { ...x.recoveryData, version: 'controlled-simple-reference-recovery/v2', maximumMicroUsd: 14000000,
      allowanceGrant: ref(grantFile), extraEngineeringReceipts: [lineage[2], ref(p)], technicalReviewReceipt: ref(p) };
    writeFileSync(x.recoveryFile, JSON.stringify(data));
    return { ...x, data, grant, grantFile, lineage, ref };
  }
  async function roleCheckpointFixture() {
    const x = await extendedRecoveryFixture(), normal = sdk.create.getMockImplementation()!;
    sdk.create.mockImplementation(async p => {
      const raw = await normal(p);
      if (Array.isArray(p.input)) {
        const data = JSON.parse(p.input[0].content[0].text);
        if (data.context.design?.entities) {
          const out = JSON.parse(raw.output_text);
          out.checks[0].verdict = 'uncertain'; out.checks[0].correction = 'Synthetic out-of-scope absent actor; not a real pixel verdict.';
          out.checks[3].verdict = 'defect'; out.checks[3].correction = 'Synthetic missing required slat.';
          raw.output_text = JSON.stringify(out);
        }
      }
      return raw;
    });
    expect(await simpleBookReferenceRecoveryCLI(['--config', x.recoveryFile, '--execute'])).toBe(1);
    const checkpointDir = path.join(x.old.directory, 'controlled-reference-recovery-20261008');
    const priorConfig = path.join(root, 'SYNTHETIC-checkpoint-config.json'); writeFileSync(priorConfig, readFileSync(x.recoveryFile));
    const seal = path.join(checkpointDir, 'sealed.json'), termination = path.join(root, 'SYNTHETIC-checkpoint-terminal.json');
    writeFileSync(termination, JSON.stringify({ head: config.sourceHead, status: '', code: 1, signal: null, terminationConfirmed: true,
      referenceCap: 4, sealSha256: sha(readFileSync(seal)) }));
    const technical = path.join(root, 'SYNTHETIC-role-technical.json');
    writeFileSync(technical, JSON.stringify({ head: config.sourceHead, status: '', code: 0, signal: null, terminationConfirmed: true,
      isError: false, resultSubtype: 'success', maximumMicroUsd: 20000, reportedCostUsd: .003, models: [adapters.CAUSAL_MODELS.opus],
      sessionId: '77777777-7777-4777-8777-777777777777', qaVerdict: 'PASS', qaReviewHead: config.sourceHead,
      qaBase: '337971e0f767e2bbdf964bdf5700ad12b1698354', qaMode: 'read_only_code' }));
    const checkpointNames = visualEvidenceFiles(checkpointDir);
    const data: any = { ...x.data, version: 'controlled-simple-reference-recovery/v3', approvalReference: 'SYNTHETIC explicit role fix and same-book checkpoint, not live permission.',
      extraEngineeringReceipts: [...x.data.extraEngineeringReceipts, x.ref(technical)], technicalReviewReceipt: x.ref(technical),
      checkpoint: { config: x.ref(priorConfig), terminationReceipt: x.ref(termination),
        artifacts: checkpointNames.map(relative => ({ relative, sha256: sha(readFileSync(path.join(checkpointDir, relative))) })) } };
    writeFileSync(x.recoveryFile, JSON.stringify(data));
    const atlasSha = JSON.parse(readFileSync(path.join(checkpointDir, 'reference_entities_review.json'), 'utf8')).review.candidateSha;
    sdk.create.mockImplementation(normal); sdk.create.mockClear(); x.render.mockClear(); x.editor.mockClear(); x.fetcher.mockClear();
    return { ...x, data, checkpointDir, checkpointNames, normal, atlasSha,
      checkpointHashes: checkpointNames.map(n => [n, sha(readFileSync(path.join(checkpointDir, n)))]) as [string, string][] };
  }
  async function roleSixteenFixture() {
    const x = await roleCheckpointFixture(), failedFile = path.join(root, 'SYNTHETIC-failed-role-review.json');
    const failed = { ...JSON.parse(readFileSync(x.data.technicalReviewReceipt.file, 'utf8')),
      sessionId: '88888888-8888-4888-8888-888888888888', code: 1, isError: true, resultSubtype: 'error_max_budget_usd',
      sourceBundleUnchanged: true, reportedCostUsd: .004, maximumMicroUsd: 2000 };
    writeFileSync(failedFile, JSON.stringify(failed));
    const extensionFile = path.join(root, 'SYNTHETIC-sixteen.json');
    const extension = { version: 'local-simple-book-reference-ceiling/v1', requestId: x.old.queued.requestId,
      priorAllowanceGrantSha256: x.data.allowanceGrant.sha256, checkpointConfigSha256: x.data.checkpoint.config.sha256,
      previousMaximumMicroUsd: 14000000, maximumMicroUsd: 16000000,
      knownBeforeFreshReviewMicroUsd: JSON.parse(readFileSync(path.join(x.checkpointDir, 'sealed.json'), 'utf8')).snapshot.accountedMicroUsd + 4000,
      failedReviewReceipt: x.ref(failedFile), ownerApprovalReference: 'SYNTHETIC owner16 accumulated same book only, not real permission.',
      sameBookOnly: true, publicRelease: false, customerCharge: false, gateChanges: false };
    writeFileSync(extensionFile, JSON.stringify(extension));
    x.data.maximumMicroUsd = 16000000; x.data.ceilingExtension = x.ref(extensionFile);
    x.data.extraEngineeringReceipts = [...x.data.extraEngineeringReceipts.slice(0, 2), x.ref(failedFile), x.data.technicalReviewReceipt];
    writeFileSync(x.recoveryFile, JSON.stringify(x.data));
    return { ...x, extension, extensionFile, failedFile, failed };
  }
  async function transportContinuationFixture() {
    const x = await roleSixteenFixture();
    sdk.create.mockImplementation(async p => {
      const raw = await x.normal(p), d = JSON.parse(p.input[0].content[0].text);
      if (d.context.role === 'entities') {
        const out = JSON.parse(raw.output_text); out.checks[4].verdict = 'defect';
        out.checks[4].correction = 'Synthetic remaining required geometry defect.'; raw.output_text = JSON.stringify(out);
      }
      return raw;
    });
    expect(await simpleBookReferenceRecoveryCLI(['--config', x.recoveryFile, '--execute'])).toBe(1);
    const priorDir = path.join(x.old.directory, 'role-scoped-reference-continuation-20261008');
    const priorFile = path.join(root, 'SYNTHETIC-ended-role-config.json'); writeFileSync(priorFile, readFileSync(x.recoveryFile));
    const priorSeal = JSON.parse(readFileSync(path.join(priorDir, 'sealed.json'), 'utf8'));
    expect(priorSeal.snapshot.logicalAttempts).toBe(3);
    const terminal = path.join(root, 'SYNTHETIC-ended-role-terminal.json');
    writeFileSync(terminal, JSON.stringify({ head: config.sourceHead, status: '', code: 1, signal: null,
      terminationConfirmed: true, referenceCap: 4, sealSha256: sha(readFileSync(path.join(priorDir, 'sealed.json'))) }));
    const technical = path.join(root, 'SYNTHETIC-transport-technical.json');
    writeFileSync(technical, JSON.stringify({ head: config.sourceHead, status: '', code: 0, signal: null, terminationConfirmed: true,
      isError: false, resultSubtype: 'success', maximumMicroUsd: 20000, reportedCostUsd: .005, models: [adapters.CAUSAL_MODELS.opus],
      sessionId: '99999999-9999-4999-8999-999999999999', qaVerdict: 'PASS', qaReviewHead: config.sourceHead,
      qaBase: '08a51c91fb02d57547bc52ef9682e3b223d5d7fa', qaMode: 'read_only_code' }));
    const names = visualEvidenceFiles(priorDir);
    x.data.extraEngineeringReceipts.push(x.ref(technical)); x.data.technicalReviewReceipt = x.ref(technical);
    x.data.transportContinuation = { config: x.ref(priorFile), terminationReceipt: x.ref(terminal),
      artifacts: names.map(relative => ({ relative, sha256: sha(readFileSync(path.join(priorDir, relative))) })),
      knownBeforeCurrentReviewMicroUsd: priorSeal.snapshot.knownEstimateMicroUsd,
      ownerApprovalReference: 'SYNTHETIC approved same-book explicit transport continuation only.',
      sameBookOnly: true, publicRelease: false, customerCharge: false, gateChanges: false };
    writeFileSync(x.recoveryFile, JSON.stringify(x.data));
    sdk.create.mockImplementation(x.normal); sdk.create.mockClear(); x.render.mockClear(); x.editor.mockClear(); x.fetcher.mockClear();
    const repairedSha = JSON.parse(readFileSync(path.join(priorDir, 'reference_entities_review.json'), 'utf8')).review.candidateSha;
    return { ...x, priorDir, priorFile, priorSeal, terminal, names, repairedSha,
      priorHashes: names.map(n => [n, sha(readFileSync(path.join(priorDir, n)))]) as [string, string][] };
  }
  it('transport continuation binds every ended expense and sends exact roles through the real prepared wire to all9 frames', async () => {
    const x = await transportContinuationFixture(), ready = await prepareSimpleBookReferenceRecovery(x.recoveryFile);
    expect(ready.externalMicroUsd).toBe(x.priorSeal.snapshot.knownEstimateMicroUsd + 5000);
    expect(ready.extra).toBe(55000); expect(ready.inheritedLogicalAttempts).toBe(24); expect(ready.explicitReferenceTransport).toBe(true);
    expect(ready.checkpoint!.entities.imageSha).toBe(x.repairedSha);
    expect(await simpleBookReferenceRecoveryCLI(['--config', x.recoveryFile])).toBe(0);
    expect(sdk.create).not.toHaveBeenCalled(); expect(x.render).not.toHaveBeenCalled();
    sdk.create.mockImplementation(async p => {
      const raw = await x.normal(p), d = JSON.parse(p.input[0].content[0].text);
      if (d.context.role === 'entities' && d.candidateSha === x.repairedSha) {
        const out = JSON.parse(raw.output_text); out.checks[4].verdict = 'defect'; out.checks[4].correction = 'Synthetic needed repair.';
        raw.output_text = JSON.stringify(out);
      }
      return raw;
    });
    expect(await simpleBookReferenceRecoveryCLI(['--config', x.recoveryFile, '--execute'])).toBe(0);
    const dir = path.join(x.old.directory, 'reference-transport-continuation-20261008');
    expect(x.render).toHaveBeenCalledTimes(11); expect(x.fetcher).toHaveBeenCalledTimes(9); expect(x.editor).not.toHaveBeenCalled();
    const roleLists = [['rejected_edit_target', 'child_design_authority', 'companion_design_authority'],
      ['child_design_authority', 'companion_design_authority', 'entity_design_authority']];
    ['reference_entities_repair', 'reference_locations'].forEach((stage, i) => {
      const wire = JSON.parse(readFileSync(path.join(dir, `paid-stages/${stage}.wire.json`), 'utf8'));
      expect(wire.referenceRoles).toEqual(roleLists[i]); expect(x.render.mock.calls[i][0].referenceRoles).toEqual(roleLists[i]);
      expect(x.render.mock.calls[i][0].referenceMode).toBe('book_design');
      expect(wire.body.prompt).toContain('[BOOK DESIGN REFERENCES - EXPLICIT ROLES]');
      expect(wire.body.prompt).not.toMatch(/Bolly|REAL child|FIRST image.*child/i);
      expect(wire.references.map((r: any) => r.imageSha)).toEqual(x.render.mock.calls[i][0].exactReferenceBytes!.map(b => sha(b)));
      expect(wire.body).toEqual(images.planGPTImageRequest(x.render.mock.calls[i][0],
        { defaultModel: 'gpt-image-2', defaultQuality: 'low', maxReferences: 4 }).bodyWithoutBinaryImage);
    });
    for (const [input] of x.render.mock.calls.slice(2)) {
      expect(input.referenceMode).toBe('book_identity'); expect(input.referenceRoles).toBeUndefined();
    }
    expect(JSON.parse(readFileSync(path.join(dir, 'sealed.json'), 'utf8'))).toMatchObject({ status: 'illustrated_audition', bookPages: 9,
      inheritedLogicalAttempts: 24, snapshot: { unknownAttemptCosts: 0 } });
    expect(readFileSync(path.join(dir, 'book.html'), 'utf8').match(/<img /g)).toHaveLength(9);
    const requestId = ready.parent.job.queued.requestId;
    expect(await (await GET(req('GET', undefined, `${url}?requestId=${requestId}`))).json()).toMatchObject({ imageScope: 'reference_transport_continuation',
      phase: 'illustrated_audition', accounting: { allowanceMicroUsd: 16000000 } });
    const page = await GET(req('GET', undefined, `${url}?requestId=${requestId}&page=8`));
    const manifest = JSON.parse(readFileSync(path.join(dir, 'illustrated_book.json'), 'utf8'));
    expect(page.status).toBe(200); expect(page.headers.get('cache-control')).toBe('private, no-store');
    expect(sha(Buffer.from(await page.arrayBuffer()))).toBe(manifest.pages[8].candidate.imageSha);
    deps.user = { id: 'other', email: 'owner@example.com' };
    expect((await GET(req('GET', undefined, `${url}?requestId=${requestId}&page=8`))).status).toBe(403);
    for (const [n, h] of x.priorHashes) expect(sha(readFileSync(path.join(x.priorDir, n)))).toBe(h);
    for (const [n, h] of x.checkpointHashes) expect(sha(readFileSync(path.join(x.checkpointDir, n)))).toBe(h);
    expect(existsSync(path.join(dir, 'paid-stages/reference_child.claim.json'))).toBe(false);
    await expect(prepareSimpleBookReferenceRecovery(x.recoveryFile).then(r => r.claim())).rejects.toThrow();
  }, 180000);
  async function transportTwentyFixture() {
    const x = await transportContinuationFixture(), technicalFile = x.data.technicalReviewReceipt.file;
    const t = JSON.parse(readFileSync(technicalFile, 'utf8'));
    const failedFile = path.join(root, 'SYNTHETIC-transport-budget-error.json');
    writeFileSync(failedFile, JSON.stringify({ ...t, code: 1, isError: true, resultSubtype: 'error_max_budget_usd',
      qaVerdict: null, sourceBundleUnchanged: true }));
    writeFileSync(technicalFile, JSON.stringify({ ...t, reportedCostUsd: .008,
      previousCumulativeReportedCostUsd: .005, includesPreviousKnownFailedCalls: true,
      costKind: 'cumulative_same_cli_session_list_estimate_not_invoice' }));
    const g = { version: 'local-simple-book-transport-allowance/v1', requestId: x.extension.requestId,
      priorCeilingExtensionSha256: x.data.ceilingExtension.sha256, endedTransportConfigSha256: x.data.transportContinuation.config.sha256,
      previousMaximumMicroUsd: 16000000, maximumMicroUsd: 20000000,
      knownBeforeAdditionalReviewMicroUsd: x.priorSeal.snapshot.knownEstimateMicroUsd + 5000, failedReviewReceipt: x.ref(failedFile),
      ownerApprovalReference: 'SYNTHETIC explicit owner approval accumulatedUSD20 for this same book only.',
      sameBookOnly: true, publicRelease: false, customerCharge: false, gateChanges: false };
    const grantFile = path.join(root, 'SYNTHETIC-transport-twenty-grant.json'); writeFileSync(grantFile, JSON.stringify(g));
    x.data.maximumMicroUsd = 20000000; x.data.transportAllowanceExtension = x.ref(grantFile);
    x.data.technicalReviewReceipt = x.ref(technicalFile); x.data.extraEngineeringReceipts[4] = x.data.technicalReviewReceipt;
    writeFileSync(x.recoveryFile, JSON.stringify(x.data));
    return { ...x, grantFile, twentyGrant: g, transportFailedFile: failedFile };
  }
  it('transport twenty counts resumed QA cumulatively once and completes all9 private frames under the explicit same-book grant', async () => {
    const x = await transportTwentyFixture(), ready = await prepareSimpleBookReferenceRecovery(x.recoveryFile);
    expect(ready.externalMicroUsd).toBe(x.priorSeal.snapshot.knownEstimateMicroUsd + 8000);
    expect(ready.extra).toBe(58000); expect(ready.config.maximumMicroUsd).toBe(20000000);
    expect(await simpleBookReferenceRecoveryCLI(['--config', x.recoveryFile, '--execute'])).toBe(0);
    const dir = path.join(x.old.directory, 'reference-transport-continuation-20261008');
    expect(JSON.parse(readFileSync(path.join(dir, 'claim.json'), 'utf8')).transportAllowanceExtension).toEqual(x.ref(x.grantFile));
    expect(JSON.parse(readFileSync(path.join(dir, 'sealed.json'), 'utf8'))).toMatchObject({ status: 'illustrated_audition',
      snapshot: { unknownAttemptCosts: 0 } });
    expect(x.render).toHaveBeenCalledTimes(10); expect(x.fetcher).toHaveBeenCalledTimes(9); expect(x.editor).not.toHaveBeenCalled();
    expect(await (await GET(req('GET', undefined, `${url}?requestId=${ready.parent.job.queued.requestId}`))).json()).toMatchObject({
      imageScope: 'reference_transport_continuation', phase: 'illustrated_audition', accounting: { allowanceMicroUsd: 20000000 } });
    for (const [n, h] of x.priorHashes) expect(sha(readFileSync(path.join(x.priorDir, n)))).toBe(h);
  }, 180000);
  it('transport twenty rejects missing, rebound, downgraded or double-counted resumed QA evidence before money and claim', async () => {
    const x = await transportTwentyFixture(), baseline = readFileSync(x.recoveryFile);
    const grantBytes = readFileSync(x.grantFile), technicalBytes = readFileSync(x.data.technicalReviewReceipt.file), failedBytes = readFileSync(x.transportFailedFile);
    const disk = vi.spyOn(journal, 'fencedText'); disk.mockClear();
    for (const kind of ['missing', 'wrong_scope', 'request', 'prior_ceiling', 'ended_config', 'prior_cost', 'gate',
      'failed_was_success', 'lost_previous_fee', 'lost_cumulative_flag', 'wrong_session', 'current_failed', 'duplicate_failed_fee']) {
      const d = JSON.parse(baseline.toString()), g = JSON.parse(grantBytes.toString()), t = JSON.parse(technicalBytes.toString()), f = JSON.parse(failedBytes.toString());
      if (kind === 'missing') delete d.transportAllowanceExtension;
      if (kind === 'wrong_scope') d.maximumMicroUsd = 16000000;
      if (kind === 'request') g.requestId = 'b'.repeat(64);
      if (kind === 'prior_ceiling') g.priorCeilingExtensionSha256 = 'b'.repeat(64);
      if (kind === 'ended_config') g.endedTransportConfigSha256 = 'b'.repeat(64);
      if (kind === 'prior_cost') g.knownBeforeAdditionalReviewMicroUsd--;
      if (kind === 'gate') g.gateChanges = true;
      if (kind === 'failed_was_success') { f.code = 0; f.isError = false; f.resultSubtype = 'success'; }
      if (kind === 'lost_previous_fee') t.reportedCostUsd = .002;
      if (kind === 'lost_cumulative_flag') t.includesPreviousKnownFailedCalls = false;
      if (kind === 'wrong_session') t.sessionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      if (kind === 'current_failed') { t.code = 1; t.isError = true; t.resultSubtype = 'error_max_budget_usd'; }
      writeFileSync(x.transportFailedFile, JSON.stringify(f)); g.failedReviewReceipt = x.ref(x.transportFailedFile);
      writeFileSync(x.grantFile, JSON.stringify(g)); if (kind !== 'missing') d.transportAllowanceExtension = x.ref(x.grantFile);
      writeFileSync(d.technicalReviewReceipt.file, JSON.stringify(t)); d.technicalReviewReceipt = x.ref(d.technicalReviewReceipt.file); d.extraEngineeringReceipts[4] = d.technicalReviewReceipt;
      if (kind === 'duplicate_failed_fee') d.extraEngineeringReceipts.push(g.failedReviewReceipt);
      writeFileSync(x.recoveryFile, JSON.stringify(d));
      await expect(prepareSimpleBookReferenceRecovery(x.recoveryFile), kind).rejects.toThrow();
      expect(sdk.create).not.toHaveBeenCalled(); expect(x.render).not.toHaveBeenCalled(); expect(x.editor).not.toHaveBeenCalled();
      expect(disk.mock.calls.some(([p]) => p === config.existingKeyEnvFile)).toBe(false);
      expect(existsSync(path.join(x.old.directory, 'reference-transport-continuation-20261008'))).toBe(false);
    }
    const v = { ...emptySimpleBookView(x.twentyGrant.requestId), accounting: { ...emptySimpleBookView(x.twentyGrant.requestId).accounting, allowanceMicroUsd: 20000000 } };
    expect(simpleBookViewSchema.safeParse(v).success).toBe(false);
    expect(simpleBookViewSchema.safeParse({ ...v, imageScope: 'role_scoped_reference_continuation' }).success).toBe(false);
    expect(simpleBookViewSchema.safeParse({ ...v, imageScope: 'reference_transport_continuation' }).success).toBe(true);
  }, 90000);
  async function referenceRebuildFixture() {
    const x = await transportTwentyFixture();
    sdk.create.mockImplementation(async p => {
      const raw = await x.normal(p), d = JSON.parse(p.input[0].content[0].text);
      if (d.context.role === 'entities') { const out = JSON.parse(raw.output_text); out.checks[4].verdict = 'defect';
        out.checks[4].correction = 'Synthetic edit retained a real design defect.'; raw.output_text = JSON.stringify(out); }
      return raw;
    });
    expect(await simpleBookReferenceRecoveryCLI(['--config', x.recoveryFile, '--execute'])).toBe(1);
    const endedDir = path.join(x.old.directory, 'reference-transport-continuation-20261008');
    const endedFile = path.join(root, 'SYNTHETIC-ended-explicit-transport.json'); writeFileSync(endedFile, readFileSync(x.recoveryFile));
    const endedSeal = JSON.parse(readFileSync(path.join(endedDir, 'sealed.json'), 'utf8')); expect(endedSeal.snapshot.logicalAttempts).toBe(3);
    const terminal = path.join(root, 'SYNTHETIC-ended-explicit-transport-terminal.json');
    writeFileSync(terminal, JSON.stringify({ head: config.sourceHead, status: '', code: 1, signal: null, terminationConfirmed: true,
      referenceCap: 4, sealSha256: sha(readFileSync(path.join(endedDir, 'sealed.json'))) }));
    const technical = path.join(root, 'SYNTHETIC-new-rebuild-QA.json');
    writeFileSync(technical, JSON.stringify({ head: config.sourceHead, status: '', code: 0, signal: null, terminationConfirmed: true,
      isError: false, resultSubtype: 'success', maximumMicroUsd: 20000, reportedCostUsd: .004, models: [adapters.CAUSAL_MODELS.opus],
      sessionId: '66666666-6666-4666-8666-666666666666', qaVerdict: 'PASS', qaReviewHead: config.sourceHead, qaBase: config.sourceHead, qaMode: 'read_only_code' }));
    const names = visualEvidenceFiles(endedDir);
    x.data.extraEngineeringReceipts.push(x.ref(technical)); x.data.technicalReviewReceipt = x.ref(technical);
    x.data.rebuildContinuation = { config: x.ref(endedFile), terminationReceipt: x.ref(terminal),
      artifacts: names.map(relative => ({ relative, sha256: sha(readFileSync(path.join(endedDir, relative))) })),
      ownerApprovalReference: 'SYNTHETIC approved one same-book fresh entity atlas within unchanged20m.',
      sameBookOnly: true, publicRelease: false, customerCharge: false, gateChanges: false };
    writeFileSync(x.recoveryFile, JSON.stringify(x.data));
    sdk.create.mockImplementation(x.normal); sdk.create.mockClear(); x.render.mockClear(); x.editor.mockClear(); x.fetcher.mockClear();
    return { ...x, endedDir, endedFile, endedSeal, endedTerminal: terminal, endedNames: names,
      endedHashes: names.map(n => [n, sha(readFileSync(path.join(endedDir, n)))]) as [string, string][] };
  }
  it('reference design rebuild preserves all ended costs and uses only approved actor authorities for ONE fresh atlas and9 private frames', async () => {
    const x = await referenceRebuildFixture(), ready = await prepareSimpleBookReferenceRecovery(x.recoveryFile);
    expect(ready.externalMicroUsd).toBe(x.endedSeal.snapshot.knownEstimateMicroUsd + 4000);
    expect(ready.rebuildEntitiesFromDesign).toBe(true); expect(ready.inheritedLogicalAttempts).toBe(27);
    expect(await simpleBookReferenceRecoveryCLI(['--config', x.recoveryFile])).toBe(0);
    expect(x.render).not.toHaveBeenCalled(); expect(sdk.create).not.toHaveBeenCalled();
    expect(await simpleBookReferenceRecoveryCLI(['--config', x.recoveryFile, '--execute'])).toBe(0);
    const dir = path.join(x.old.directory, 'reference-design-rebuild-continuation-20261008');
    expect(x.render).toHaveBeenCalledTimes(11); expect(x.fetcher).toHaveBeenCalledTimes(9); expect(x.editor).not.toHaveBeenCalled();
    const first = x.render.mock.calls[0][0], discarded = ready.checkpoint!.entities.imageSha;
    expect(first.referenceMode).toBe('book_design'); expect(first.referenceRoles).toEqual(['child_design_authority', 'companion_design_authority']);
    expect(first.exactReferenceBytes).toHaveLength(2); expect(first.exactReferenceBytes!.map(b => sha(b))).not.toContain(discarded);
    expect(sha(first.exactReferenceBytes![0])).toBe(ready.checkpoint!.child.imageSha);
    expect(first.finalPrompt).not.toContain('TARGETED CORRECTIONS');
    expect(JSON.parse(readFileSync(path.join(dir, 'discarded_entity_reference.json'), 'utf8'))).toMatchObject({ authority: 'failed_history_only_not_generation_input_or_canonical' });
    const wire = JSON.parse(readFileSync(path.join(dir, 'paid-stages/reference_entities.wire.json'), 'utf8'));
    expect(wire.references).toHaveLength(2); expect(wire.referenceRoles).toEqual(first.referenceRoles);
    expect(wire.body).toEqual(images.planGPTImageRequest(first, { defaultModel: 'gpt-image-2', defaultQuality: 'low', maxReferences: 4 }).bodyWithoutBinaryImage);
    expect(existsSync(path.join(dir, 'paid-stages/reference_entities_repair.claim.json'))).toBe(false);
    expect(existsSync(path.join(dir, 'paid-stages/reference_child.claim.json'))).toBe(false);
    expect(JSON.parse(readFileSync(path.join(dir, 'sealed.json'), 'utf8'))).toMatchObject({ status: 'illustrated_audition', bookPages: 9, inheritedLogicalAttempts: 27 });
    const id = ready.parent.job.queued.requestId;
    expect(await (await GET(req('GET', undefined, `${url}?requestId=${id}`))).json()).toMatchObject({ imageScope: 'reference_rebuild_continuation', accounting: { allowanceMicroUsd: 20000000 } });
    const p = await GET(req('GET', undefined, `${url}?requestId=${id}&page=8`)); expect(p.status).toBe(200); expect(p.headers.get('cache-control')).toBe('private, no-store');
    const manifest = JSON.parse(readFileSync(path.join(dir, 'illustrated_book.json'), 'utf8')); expect(sha(Buffer.from(await p.arrayBuffer()))).toBe(manifest.pages[8].candidate.imageSha);
    deps.user = { id: 'other', email: 'owner@example.com' }; expect((await GET(req('GET', undefined, `${url}?requestId=${id}&page=8`))).status).toBe(403);
    for (const [n, h] of x.endedHashes) expect(sha(readFileSync(path.join(x.endedDir, n)))).toBe(h);
    await expect(prepareSimpleBookReferenceRecovery(x.recoveryFile).then(r => r.claim())).rejects.toThrow();
  }, 180000);
  async function entityAuthorityFixture() {
    const x = await referenceRebuildFixture();
    sdk.create.mockImplementation(async p => { const raw = await x.normal(p), d = JSON.parse(p.input[0].content[0].text);
      if (d.context.role === 'entities') { const out = JSON.parse(raw.output_text); out.checks[3].verdict = 'defect'; out.checks[3].correction = 'Synthetic full-atlas defect.'; raw.output_text = JSON.stringify(out); } return raw; });
    expect(await simpleBookReferenceRecoveryCLI(['--config', x.recoveryFile, '--execute'])).toBe(1);
    const priorFile = path.join(root, 'SYNTHETIC-ended-rebuild-config.json'); writeFileSync(priorFile, readFileSync(x.recoveryFile));
    const ready = await prepareSimpleBookReferenceRecovery(priorFile), dir = ready.directory;
    const seal = JSON.parse(readFileSync(path.join(dir, 'sealed.json'), 'utf8'));
    const terminal = path.join(root, 'SYNTHETIC-ended-rebuild-host.json');
    writeFileSync(terminal, JSON.stringify({ head: config.sourceHead, status: '', code: 1, signal: null, terminationConfirmed: true, referenceCap: 4,
      sealSha256: sha(readFileSync(path.join(dir, 'sealed.json'))) }));
    const book = ready.result.storyboard!.storyboard, full = { props: book.plan.recurringProps, entities: book.plan.continuity!.entities,
      childClothingAuthority: book.plan.actorAppearance?.child.clothing ?? book.plan.wardrobe };
    const selected = full.entities[0], design = { ...full, entities: [selected], props: full.props.filter((p: { id: string }) => p.id === selected.id) };
    const context = { version: 'simple-reference-role-context/v1', scope: 'noncommercial_reference_design_only', role: 'entities', design };
    const contextSha = sha(JSON.stringify(context));
    const consultFile = path.join(root, 'SYNTHETIC-projection-consultation.json'), qaFile = path.join(root, 'SYNTHETIC-authority-code-QA.json');
    const control = async (name: string, before: number, passed: boolean) => {
      const directory = path.join(root, name); mkdirSync(directory); const images = path.join(directory, 'illustrations'); mkdirSync(images);
      const pixels = await sharp({ create: { width: 32, height: 32, channels: 3, background: passed ? '#abcdef' : '#fedcba' } }).png().toBuffer();
      const candidate = { imageName: 'medium_entities.png', imageSha: sha(pixels) }; writeFileSync(path.join(images, candidate.imageName), pixels);
      const budget = new SimpleBookBudget(path.join(directory, 'paid-stages'), before, 20000000);
      await budget.run('medium_entities', { body: { model: 'gpt-image-2', quality: 'low', size: '1024x1024', n: 1 } }, 100000, async () => ({ value: candidate, estimatedMicroUsd: 380,
        receipt: { candidate, model: 'gpt-image-2', estimatedMicroUsd: 380, raw: { usage: { input_tokens: 10, output_tokens: 10 }, data: [{ b64_json: pixels.toString('base64') }] } } }));
      const data = { candidateSha: candidate.imageSha, contextSha, context, imageRoles: ['candidate_complete', 'candidate_crop_top_left', 'candidate_crop_top_right',
        'candidate_crop_bottom_left', 'candidate_crop_bottom_right', 'canonical_child', 'canonical_companion'] };
      const cropBytes = await Promise.all([[0, 0], [9, 0], [0, 9], [9, 9]].map(([left, top]) => sharp(pixels).extract({ left, top, width: 23, height: 23 }).png().toBuffer()));
      const child = readFileSync(path.join(dir, 'illustrations/reference_child_checkpoint.png')), companion = readFileSync(path.join(dir, 'illustrations/companion_reference.png'));
      const quality = cleanPixelReview(candidate.imageSha, contextSha); if (!passed) { (quality.checks[3] as any).verdict = 'defect'; quality.checks[3].correction = 'Synthetic contradictory second view.'; }
      const wire = { model: 'gpt-6.1-sol', store: false, instructions: REFERENCE_DESIGN_JUDGE_INSTRUCTION, max_output_tokens: 12000,
        input: [{ content: [{ type: 'input_text', text: JSON.stringify(data) }, ...[pixels, ...cropBytes, child, companion].map(b => ({ type: 'input_image', image_url: `data:image/png;base64,${b.toString('base64')}` }))] }] };
      await budget.run('medium_entities_qa', wire, 100000, async () => ({ value: quality, estimatedMicroUsd: 120,
        receipt: { estimatedMicroUsd: 120, raw: { model: 'gpt-6.1-sol', status: 'completed', service_tier: 'default', output_text: JSON.stringify(quality), usage: { input_tokens: 10, output_tokens: 10 } } } }));
      const review = { review: quality, disposition: passed ? 'passed' : 'repair' };
      writeFileSync(path.join(directory, 'reference_review.json'), JSON.stringify(review));
      writeFileSync(path.join(directory, 'receipt.json'), JSON.stringify({ code: 0, signal: null, terminationConfirmed: true, sourceUnchanged: true,
        completeBook: false, productionQualified: false, maximumMicroUsd: 20000000, knownBeforeMicroUsd: before, snapshot: budget.snapshot(), incrementalKnownMicroUsd: 500, disposition: review.disposition }));
      return { directory, artifacts: visualEvidenceFiles(directory).map(relative => ({ relative, sha256: sha(readFileSync(path.join(directory, relative))) })) };
    };
    const first = await control('SYNTHETIC-supported-subset', seal.snapshot.knownEstimateMicroUsd, true);
    const consultBefore = seal.snapshot.knownEstimateMicroUsd + 500;
    writeFileSync(consultFile, JSON.stringify({ head: config.sourceHead, models: [adapters.CAUSAL_MODELS.opus], code: 0, signal: null, terminationConfirmed: true, stopped: false, isError: false, resultSubtype: 'success',
      reportedCostUsd: .002, sessionId: 'abcdef01-2345-4678-9234-0123456789ab', validConsultation: true, notTechnicalPASS: true, sourceUnchanged: true,
      unknownAttemptCosts: 0, knownBeforeMicroUsd: consultBefore, knownAfterMicroUsd: consultBefore + 2000 }));
    const second = await control('SYNTHETIC-unsupported-subset', consultBefore + 2000, false);
    writeFileSync(qaFile, JSON.stringify({ head: config.sourceHead, status: '', code: 0, signal: null, terminationConfirmed: true, stopped: false, isError: false,
      resultSubtype: 'success', sourceBundleUnchanged: true, reportedCostUsd: .003, maximumMicroUsd: 20000, models: [adapters.CAUSAL_MODELS.opus], sessionId: 'fedcba10-4321-4768-9234-0123456789ab',
      qaVerdict: 'PASS', qaReviewHead: config.sourceHead, qaBase: config.sourceHead, qaMode: 'read_only_code', knownBeforeMicroUsd: consultBefore + 2500 }));
    const data: any = { version: 'controlled-simple-entity-authority/v1', sourceHead: config.sourceHead, sourceBase: config.sourceHead,
      parentConfig: x.ref(priorFile), parentTermination: x.ref(terminal), parentArtifacts: visualEvidenceFiles(dir).map(relative => ({ relative, sha256: sha(readFileSync(path.join(dir, relative))) })),
      maximumMicroUsd: 20000000, ownerApprovalReference: 'SYNTHETIC same-book supported subset, no real spending permission.', sameBookOnly: true, publicRelease: false, customerCharge: false, gateChanges: false,
      extraEngineeringReceipts: [x.ref(consultFile), x.ref(qaFile)], technicalReviewReceipt: x.ref(qaFile), settledControls: [first, second], authorityControlIndex: 0 };
    const authorityFile = path.join(root, 'SYNTHETIC-entity-authority-config.json'); writeFileSync(authorityFile, JSON.stringify(data));
    const originalFiles = [...visualEvidenceFiles(dir).map(n => path.join(dir, n)), ...[first, second].flatMap(c => visualEvidenceFiles(c.directory).map(n => path.join(c.directory, n))), consultFile, qaFile, terminal, priorFile];
    const originals = originalFiles.map(p => [p, readFileSync(p)] as const);
    sdk.create.mockImplementation(x.normal); sdk.create.mockClear(); x.render.mockClear(); x.fetcher.mockClear(); x.editor.mockClear();
    return { ...x, data, authorityFile, dir, seal, originals, consultFile, qaFile, first, second };
  }
  it('entity authority retains every failed-control cost, seeds only a supported exact subset and produces9 gated private frames', async () => {
    const x = await entityAuthorityFixture(), ready = await prepareEntityAuthorityContinuation(x.authorityFile);
    expect(ready.externalMicroUsd).toBe(x.seal.snapshot.knownEstimateMicroUsd + 6000);
    expect(ready.inheritedLogicalAttempts).toBe(33);
    expect(await simpleBookReferenceRecoveryCLI(['--config', x.authorityFile])).toBe(0); expect(x.render).not.toHaveBeenCalled();
    expect(await simpleBookReferenceRecoveryCLI(['--config', x.authorityFile, '--execute'])).toBe(0);
    const first = x.render.mock.calls[0][0]; expect(first.referenceRoles).toEqual(['child_design_authority', 'companion_design_authority', 'entity_design_authority']);
    expect(first.exactReferenceBytes!.map(b => sha(b))).toEqual([ready.checkpoint.child.imageSha, sha(readFileSync(path.join(x.dir, 'illustrations/companion_reference.png'))), ready.entityDesignAuthority.imageSha]);
    expect(x.render).toHaveBeenCalledTimes(11); expect(x.fetcher).toHaveBeenCalledTimes(9); expect(x.editor).not.toHaveBeenCalled();
    expect(first.finalPrompt).toContain('SUBSET'); expect(first.finalPrompt).not.toContain('TARGETED CORRECTIONS');
    const pixelsWire = JSON.parse(readFileSync(path.join(ready.directory, 'paid-stages/reference_entities_qa.wire.json'), 'utf8'));
    const inspected = JSON.parse(pixelsWire.input[0].content[0].text);
    expect(inspected.imageRoles).toEqual(['candidate_complete', 'candidate_crop_top_left', 'candidate_crop_top_right', 'candidate_crop_bottom_left', 'candidate_crop_bottom_right', 'canonical_child', 'canonical_companion']);
    expect(pixelsWire.input[0].content).toHaveLength(8);
    expect(inspected.context.design.entities).toEqual(ready.result.storyboard!.storyboard.plan.continuity!.entities);
    for (const call of x.render.mock.calls.slice(2)) expect(call[0].referenceMode).toBe('book_identity');
    const manifest = JSON.parse(readFileSync(path.join(ready.directory, 'illustrated_book.json'), 'utf8'));
    expect(manifest.pages).toHaveLength(9); expect(manifest.pages.every((p: any) => p.identity.threshold === .7 && p.identity.status === 'passed')).toBe(true);
    const page = await GET(req('GET', undefined, `${url}?requestId=${ready.parent.job.queued.requestId}&page=8`));
    expect(page.status).toBe(200); expect(page.headers.get('cache-control')).toBe('private, no-store'); expect(sha(Buffer.from(await page.arrayBuffer()))).toBe(manifest.pages[8].candidate.imageSha);
    deps.user = { id: 'other', email: 'owner@example.com' }; expect((await GET(req('GET', undefined, `${url}?requestId=${ready.parent.job.queued.requestId}&page=8`))).status).toBe(403);
    for (const [p, b] of x.originals) expect(readFileSync(p).equals(b)).toBe(true);
    await expect(prepareEntityAuthorityContinuation(x.authorityFile).then(r => r.claim())).rejects.toThrow();
  }, 180000);
  it('entity authority rejects rehashed source, cost, pixel, termination and review failures before any key or fresh claim', async () => {
    const x = await entityAuthorityFixture(), original = readFileSync(x.authorityFile);
    await expect(prepareEntityAuthorityContinuation(x.authorityFile)).resolves.toHaveProperty('entityDesignAuthority');
    const disk = vi.spyOn(journal, 'fencedText');
    for (const kind of ['failed_authority', 'missing_control', 'duplicate_control', 'unknown', 'changed_source', 'wrong_actor', 'wrong_crop', 'failed_qa', 'old_qa', 'termination', 'missing_paid_root']) {
      x.originals.forEach(([p, b]) => writeFileSync(p, b)); const d = JSON.parse(original.toString()); disk.mockClear();
      const change = (p: string, fn: (v: any) => void) => { const v = JSON.parse(readFileSync(p, 'utf8')); fn(v); writeFileSync(p, JSON.stringify(v)); };
      const dir = x.first.directory;
      if (kind === 'failed_authority') d.authorityControlIndex = 1;
      if (kind === 'missing_control') d.settledControls.pop();
      if (kind === 'duplicate_control') d.settledControls.push(d.settledControls[0]);
      if (kind === 'unknown') change(path.join(dir, 'paid-stages/medium_entities.result.json'), v => { v.estimatedMicroUsd = null; });
      if (['changed_source', 'wrong_actor', 'wrong_crop'].includes(kind)) {
        change(path.join(dir, 'paid-stages/medium_entities_qa.wire.json'), w => {
          if (kind === 'wrong_actor') w.input[0].content[6].image_url = w.input[0].content[7].image_url;
          if (kind === 'wrong_crop') w.input[0].content[2].image_url = w.input[0].content[1].image_url;
          if (kind === 'changed_source') { const c = JSON.parse(w.input[0].content[0].text); c.context.design.entities[0].invariants[0].value += ' CHANGED'; c.contextSha = sha(JSON.stringify(c.context));
            w.input[0].content[0].text = JSON.stringify(c);
            change(path.join(dir, 'paid-stages/medium_entities_qa.receipt.json'), r => { const q = JSON.parse(r.raw.output_text); q.contextSha = c.contextSha; r.raw.output_text = JSON.stringify(q); });
            change(path.join(dir, 'reference_review.json'), r => { r.review.contextSha = c.contextSha; }); }
        });
        const digest = sha(canonicalJson(JSON.parse(readFileSync(path.join(dir, 'paid-stages/medium_entities_qa.wire.json'), 'utf8'))));
        for (const n of ['claim', 'result']) change(path.join(dir, `paid-stages/medium_entities_qa.${n}.json`), v => { v.wireDigest = digest; });
      }
      if (kind === 'failed_qa') change(x.qaFile, v => { v.code = 1; v.isError = true; });
      if (kind === 'old_qa') d.technicalReviewReceipt = JSON.parse(readFileSync(d.parentConfig.file, 'utf8')).technicalReviewReceipt;
      if (kind === 'termination') change(d.parentTermination.file, v => { v.terminationConfirmed = false; });
      if (kind === 'missing_paid_root') renameSync(path.join(dir, 'paid-stages'), path.join(root, 'SYNTHETIC-authority-paid-away'));
      d.parentTermination = x.ref(d.parentTermination.file); d.technicalReviewReceipt = x.ref(d.technicalReviewReceipt.file); d.extraEngineeringReceipts[1] = d.technicalReviewReceipt;
      d.settledControls = d.settledControls.map((c: any) => ({ ...c, artifacts: visualEvidenceFiles(c.directory).map(relative => ({ relative, sha256: sha(readFileSync(path.join(c.directory, relative))) })) }));
      writeFileSync(x.authorityFile, JSON.stringify(d)); await expect(prepareEntityAuthorityContinuation(x.authorityFile), kind).rejects.toThrow(
        kind === 'failed_authority' ? 'entity_authority_not_passed' : kind === 'changed_source' ? 'entity_authority_wrong_source' :
        kind === 'wrong_actor' ? 'entity_authority_actor_binding' : kind === 'wrong_crop' ? 'entity_authority_crop_binding' : undefined);
      expect(x.render).not.toHaveBeenCalled(); expect(sdk.create).not.toHaveBeenCalled(); expect(x.editor).not.toHaveBeenCalled();
      expect(disk.mock.calls.some(([p]) => p === config.existingKeyEnvFile)).toBe(false);
      expect(existsSync(path.join(x.old.directory, 'reference-entity-authority-continuation-20261008'))).toBe(false);
      if (kind === 'missing_paid_root') { expect(existsSync(path.join(dir, 'paid-stages'))).toBe(false); renameSync(path.join(root, 'SYNTHETIC-authority-paid-away'), path.join(dir, 'paid-stages')); }
    }
  }, 180000);
  it('entity authority stops at a full-atlas defect despite a passed subset, with no retry or later scene spending', async () => {
    const x = await entityAuthorityFixture(); sdk.create.mockImplementation(async p => { const raw = await x.normal(p), d = JSON.parse(p.input[0].content[0].text);
      if (d.context.role === 'entities') { const out = JSON.parse(raw.output_text); out.checks[3].verdict = 'uncertain'; out.checks[3].correction = 'Synthetic unreadable full atlas.'; raw.output_text = JSON.stringify(out); } return raw; });
    expect(await simpleBookReferenceRecoveryCLI(['--config', x.authorityFile, '--execute'])).toBe(1);
    expect(x.render).toHaveBeenCalledTimes(1); expect(x.fetcher).not.toHaveBeenCalled(); expect(x.editor).not.toHaveBeenCalled();
    const dir = path.join(x.old.directory, 'reference-entity-authority-continuation-20261008');
    expect(JSON.parse(readFileSync(path.join(dir, 'sealed.json'), 'utf8'))).toMatchObject({ status: 'failed', code: 'simple_reference_held', snapshot: { logicalAttempts: 2 } });
    expect(existsSync(path.join(dir, 'book.html'))).toBe(false); expect(existsSync(path.join(dir, 'paid-stages/reference_child.claim.json'))).toBe(false);
  }, 180000);
  it('entity authority22 requires the explicit same-book grant and cumulative failed-QA fee exactly once, only in its private scope', async () => {
    const x = await entityAuthorityFixture(), oldQA = JSON.parse(readFileSync(x.qaFile, 'utf8'));
    const failedFile = path.join(root, 'SYNTHETIC-failed-authority-code-QA.json');
    const failed = { ...oldQA, code: 1, isError: true, resultSubtype: 'error_max_budget_usd', qaVerdict: null, maximumMicroUsd: 2000 };
    writeFileSync(failedFile, JSON.stringify(failed));
    const grantFile = path.join(root, 'SYNTHETIC-authority22-grant.json'), grant = { version: 'local-simple-entity-authority-ceiling/v1',
      requestId: x.old.queued.requestId, parentConfigSha256: x.data.parentConfig.sha256, previousMaximumMicroUsd: 20000000, maximumMicroUsd: 22000000,
      failedReviewReceipt: x.ref(failedFile), knownBeforeContinuationMicroUsd: failed.knownBeforeMicroUsd + 3000,
      ownerApprovalReference: 'SYNTHETIC explicit22 accumulated same book, not real spending permission.', sameBookOnly: true, publicRelease: false, customerCharge: false, gateChanges: false };
    writeFileSync(grantFile, JSON.stringify(grant));
    const cumulative = { ...oldQA, reportedCostUsd: .005, includesPreviousKnownFailedCalls: true, previousCumulativeReportedCostUsd: .003,
      costKind: 'cumulative_same_cli_session_list_estimate_not_invoice' };
    writeFileSync(x.qaFile, JSON.stringify(cumulative)); x.data.maximumMicroUsd = 22000000; x.data.ceilingExtension = x.ref(grantFile);
    x.data.technicalReviewReceipt = x.ref(x.qaFile); x.data.extraEngineeringReceipts[1] = x.data.technicalReviewReceipt;
    writeFileSync(x.authorityFile, JSON.stringify(x.data));
    const ready = await prepareEntityAuthorityContinuation(x.authorityFile); expect(ready.externalMicroUsd).toBe(x.seal.snapshot.knownEstimateMicroUsd + 8000);
    expect(ready.claim().budget.maximumMicroUsd).toBe(22000000);
    const view = { ...emptySimpleBookView(x.old.queued.requestId), accounting: { ...emptySimpleBookView(x.old.queued.requestId).accounting, allowanceMicroUsd: 22000000 } };
    expect(simpleBookViewSchema.safeParse(view).success).toBe(false);
    expect(simpleBookViewSchema.safeParse({ ...view, imageScope: 'reference_entity_authority_continuation' }).success).toBe(true);
    for (const scope of ['reference_rebuild_continuation', 'reference_transport_continuation', 'role_scoped_reference_continuation'])
      expect(simpleBookViewSchema.safeParse({ ...view, imageScope: scope }).success).toBe(false);
    const baseline = readFileSync(x.authorityFile);
    for (const kind of ['missing', 'wrong_request', 'foreign_parent', 'amount', 'gate', 'lost_failed_fee', 'duplicate_failed_fee', 'wrong_session']) {
      writeFileSync(x.qaFile, JSON.stringify(cumulative)); const d = JSON.parse(baseline.toString()), g = structuredClone(grant);
      if (kind === 'missing') delete d.ceilingExtension;
      if (kind === 'wrong_request') g.requestId = 'b'.repeat(64);
      if (kind === 'foreign_parent') g.parentConfigSha256 = 'b'.repeat(64);
      if (kind === 'amount') g.knownBeforeContinuationMicroUsd++;
      if (kind === 'gate') g.gateChanges = true;
      if (kind === 'duplicate_failed_fee') d.extraEngineeringReceipts.push(x.ref(failedFile));
      if (kind === 'lost_failed_fee') writeFileSync(x.qaFile, JSON.stringify({ ...cumulative, reportedCostUsd: .002 }));
      if (kind === 'wrong_session') writeFileSync(x.qaFile, JSON.stringify({ ...cumulative, sessionId: 'ab123456-1234-4234-8234-123456789012' }));
      writeFileSync(grantFile, JSON.stringify(g)); if (kind !== 'missing') d.ceilingExtension = x.ref(grantFile);
      d.technicalReviewReceipt = x.ref(x.qaFile); d.extraEngineeringReceipts[1] = d.technicalReviewReceipt;
      writeFileSync(x.authorityFile, JSON.stringify(d)); await expect(prepareEntityAuthorityContinuation(x.authorityFile), kind).rejects.toThrow();
      expect(sdk.create).not.toHaveBeenCalled(); expect(x.render).not.toHaveBeenCalled(); expect(x.fetcher).not.toHaveBeenCalled();
    }
  }, 180000);
  async function entityRepairFixture() {
    const x = await entityAuthorityFixture(), oldQA = JSON.parse(readFileSync(x.qaFile, 'utf8'));
    const failedFile = path.join(root, 'SYNTHETIC-failed-repair-parent-QA.json');
    writeFileSync(failedFile, JSON.stringify({ ...oldQA, code: 1, isError: true, resultSubtype: 'error_max_budget_usd', qaVerdict: null, maximumMicroUsd: 2000 }));
    const grantFile = path.join(root, 'SYNTHETIC-repair-parent22.json');
    writeFileSync(grantFile, JSON.stringify({ version: 'local-simple-entity-authority-ceiling/v1', requestId: x.old.queued.requestId,
      parentConfigSha256: x.data.parentConfig.sha256, previousMaximumMicroUsd: 20000000, maximumMicroUsd: 22000000,
      failedReviewReceipt: x.ref(failedFile), knownBeforeContinuationMicroUsd: oldQA.knownBeforeMicroUsd + 3000,
      ownerApprovalReference: 'SYNTHETIC approved22 same-book, never real authority.', sameBookOnly: true, publicRelease: false, customerCharge: false, gateChanges: false }));
    const cumulative = { ...oldQA, reportedCostUsd: .005, includesPreviousKnownFailedCalls: true, previousCumulativeReportedCostUsd: .003,
      costKind: 'cumulative_same_cli_session_list_estimate_not_invoice' };
    writeFileSync(x.qaFile, JSON.stringify(cumulative)); x.data.maximumMicroUsd = 22000000; x.data.ceilingExtension = x.ref(grantFile);
    x.data.technicalReviewReceipt = x.ref(x.qaFile); x.data.extraEngineeringReceipts[1] = x.data.technicalReviewReceipt; writeFileSync(x.authorityFile, JSON.stringify(x.data));
    sdk.create.mockImplementation(async p => { const raw = await x.normal(p), d = JSON.parse(p.input[0].content[0].text);
      if (d.context.role === 'entities') { const q = JSON.parse(raw.output_text); q.checks[0].verdict = 'uncertain'; q.checks[0].correction = 'Synthetic unreadable silhouette.';
        q.checks[3].verdict = 'defect'; q.checks[3].correction = 'Synthetic wrong fixed design.'; raw.output_text = JSON.stringify(q); } return raw; });
    expect(await simpleBookReferenceRecoveryCLI(['--config', x.authorityFile, '--execute'])).toBe(1);
    const parent = await prepareEntityAuthorityContinuation(x.authorityFile), seal = JSON.parse(readFileSync(path.join(parent.directory, 'sealed.json'), 'utf8'));
    const hostFile = path.join(root, 'SYNTHETIC-ended-entity-authority-host.json');
    writeFileSync(hostFile, JSON.stringify({ head: config.sourceHead, status: '', code: 1, signal: null, terminationConfirmed: true, referenceCap: 4,
      sealSha256: sha(readFileSync(path.join(parent.directory, 'sealed.json'))) }));
    const qaFile = path.join(root, 'SYNTHETIC-entity-repair-QA.json');
    writeFileSync(qaFile, JSON.stringify({ ...cumulative, reportedCostUsd: .007, previousCumulativeReportedCostUsd: .005,
      knownBeforeMicroUsd: seal.snapshot.knownEstimateMicroUsd }));
    const data = { version: 'controlled-simple-entity-repair/v1', sourceHead: config.sourceHead, sourceBase: config.sourceHead,
      parentConfig: x.ref(x.authorityFile), parentTermination: x.ref(hostFile), parentArtifacts: visualEvidenceFiles(parent.directory).map(relative => ({ relative, sha256: sha(readFileSync(path.join(parent.directory, relative))) })),
      technicalReviewReceipt: x.ref(qaFile), maximumMicroUsd: 22000000, correctionCount: 1,
      ownerApprovalReference: 'SYNTHETIC approved one same-book atlas correction; never real spending permission.', sameBookOnly: true, publicRelease: false, customerCharge: false, gateChanges: false };
    const repairFile = path.join(root, 'SYNTHETIC-entity-repair-config.json'); writeFileSync(repairFile, JSON.stringify(data));
    const originals = [...x.originals.map(([p]) => p), failedFile, grantFile, x.authorityFile, hostFile, ...visualEvidenceFiles(parent.directory).map(n => path.join(parent.directory, n))].map(p => [p, readFileSync(p)] as const);
    sdk.create.mockImplementation(x.normal); sdk.create.mockClear(); x.render.mockClear(); x.fetcher.mockClear(); x.editor.mockClear();
    return { ...x, repairFile, repairData: data, parent, parentSeal: seal, repairQA: qaFile, repairOriginals: originals };
  }
  async function referenceStateFixture(twentyFive = false) {
    const x = await entityRepairFixture();
    sdk.create.mockImplementation(async p => { const raw = await x.normal(p), d = JSON.parse(p.input[0].content[0].text);
      if (d.context.role === 'entities') { const q = JSON.parse(raw.output_text); q.checks[3].verdict = 'defect';
        q.checks[3].correction = 'Synthetic fixed design still defective after consumed repair.'; raw.output_text = JSON.stringify(q); } return raw; });
    expect(await simpleBookReferenceRecoveryCLI(['--config', x.repairFile, '--execute'])).toBe(1);
    const parent = await prepareEntityRepairContinuation(x.repairFile), seal = JSON.parse(readFileSync(path.join(parent.directory, 'sealed.json'), 'utf8'));
    const host = path.join(root, 'SYNTHETIC-ended-repair-host.json');
    writeFileSync(host, JSON.stringify({ head: config.sourceHead, status: '', code: 1, signal: null, terminationConfirmed: true, referenceCap: 4,
      sealSha256: sha(readFileSync(path.join(parent.directory, 'sealed.json'))) }));
    const qa = path.join(root, 'SYNTHETIC-state-code-QA.json');
    writeFileSync(qa, JSON.stringify({ ...JSON.parse(readFileSync(x.repairQA, 'utf8')), reportedCostUsd: .002,
      costKind: 'cli_reported_list_estimate_not_invoice', sessionId: '012345ab-6789-4234-9123-abcdef012345',
      knownBeforeMicroUsd: seal.snapshot.knownEstimateMicroUsd }));
    const data: any = { version: 'controlled-simple-reference-state/v1', sourceHead: config.sourceHead, sourceBase: config.sourceHead,
      parentConfig: x.ref(x.repairFile), parentTermination: x.ref(host),
      parentArtifacts: visualEvidenceFiles(parent.directory).map(relative => ({ relative, sha256: sha(readFileSync(path.join(parent.directory, relative))) })),
      technicalReviewReceipt: x.ref(qa), maximumMicroUsd: 22000000, generationCount: 1, stateAwareReferences: true,
      ownerApprovalReference: 'SYNTHETIC approved one data-corrected same-book proof, never real spending authority.',
      sameBookOnly: true, publicRelease: false, customerCharge: false, gateChanges: false };
    const grant = path.join(root, 'SYNTHETIC-state25-grant.json');
    if (twentyFive) {
      writeFileSync(grant, JSON.stringify({ version: 'local-simple-reference-state-ceiling/v1', requestId: x.old.queued.requestId,
        parentConfigSha256: data.parentConfig.sha256, previousMaximumMicroUsd: 22000000, maximumMicroUsd: 25000000,
        knownBeforeContinuationMicroUsd: seal.snapshot.knownEstimateMicroUsd,
        ownerApprovalReference: 'SYNTHETIC direct up to3more, same25 total; never real spending authority.',
        sameBookOnly: true, publicRelease: false, customerCharge: false, gateChanges: false }));
      data.maximumMicroUsd = 25000000; data.ceilingExtension = x.ref(grant);
    }
    const stateFile = path.join(root, 'SYNTHETIC-reference-state-config.json'); writeFileSync(stateFile, JSON.stringify(data));
    const originals = [...x.repairOriginals.map(([p]) => p), x.repairFile, x.repairQA, host, qa, ...(twentyFive ? [grant] : []),
      ...visualEvidenceFiles(parent.directory).map(n => path.join(parent.directory, n))].map(p => [p, readFileSync(p)] as const);
    sdk.create.mockImplementation(x.normal); sdk.create.mockClear(); x.render.mockClear(); x.fetcher.mockClear(); x.editor.mockClear();
    return { ...x, stateFile, stateData: data, stateQA: qa, stateParent: parent, stateSeal: seal, stateOriginals: originals };
  }
  it('reference state shares source-bound metadata with generator, full judge and admission, then produces9 private gated frames with all old fees once', async () => {
    const x = await referenceStateFixture(true), ready = await prepareReferenceStateContinuation(x.stateFile);
    expect(ready.externalMicroUsd).toBe(x.stateSeal.snapshot.knownEstimateMicroUsd + 2000);
    expect(ready.inheritedLogicalAttempts).toBe(x.stateParent.inheritedLogicalAttempts + 2);
    expect(ready.config.maximumMicroUsd).toBe(25000000);
    expect(ready.entityRepairReview).toBeUndefined(); expect(ready.stateAwareReferences).toBe(true);
    expect(await simpleBookReferenceRecoveryCLI(['--config', x.stateFile])).toBe(0); expect(x.render).not.toHaveBeenCalled();
    expect(await simpleBookReferenceRecoveryCLI(['--config', x.stateFile, '--execute'])).toBe(0);
    const first = x.render.mock.calls[0][0], wire = JSON.parse(readFileSync(path.join(ready.directory, 'paid-stages/reference_entities_qa.wire.json'), 'utf8'));
    const data = JSON.parse(wire.input[0].content[0].text), expected = simpleReferenceEntityDesign(ready.result.storyboard!.storyboard, true, true,
      ready.result.source.manuscript.pages.map((p: { text: string }) => p.text));
    expect(data.context.design).toEqual(expected);
    expect(first.finalPrompt).toContain(canonicalJson(expected)); expect(first.finalPrompt).not.toContain('preserve all invariants');
    expect(first.finalPrompt).not.toContain('TARGETED CORRECTIONS');
    expect(first.referenceRoles).toEqual(['child_design_authority', 'companion_design_authority', 'entity_design_authority']);
    expect(wire.instructions).toBe(REFERENCE_DESIGN_JUDGE_INSTRUCTION + '\n' + REFERENCE_STATE_JUDGE_ADDITION);
    expect(wire.input[0].content).toHaveLength(8);
    const claim = JSON.parse(readFileSync(path.join(ready.directory, 'claim.json'), 'utf8'));
    expect(claim.referenceContextSha256).toBe(data.contextSha); expect(claim.generationCount).toBe(1);
    for (const call of x.render.mock.calls.slice(2)) {
      expect(call[0].referenceMode).toBe('book_identity'); expect(call[0].exactReferenceBytes).toHaveLength(4);
    }
    expect(x.render).toHaveBeenCalledTimes(11); expect(x.fetcher).toHaveBeenCalledTimes(9); expect(x.editor).not.toHaveBeenCalled();
    const manifest = JSON.parse(readFileSync(path.join(ready.directory, 'illustrated_book.json'), 'utf8'));
    expect(manifest.pages).toHaveLength(9); expect(manifest.pages.every((p: any) => p.status === 'passed' && p.identity.threshold === .7 && p.identity.status === 'passed')).toBe(true);
    const page = await GET(req('GET', undefined, `${url}?requestId=${ready.parent.job.queued.requestId}&page=8`));
    expect(page.status).toBe(200); expect(sha(Buffer.from(await page.arrayBuffer()))).toBe(manifest.pages[8].candidate.imageSha);
    deps.user = { id: 'other', email: 'owner@example.com' }; expect((await GET(req('GET', undefined, `${url}?requestId=${ready.parent.job.queued.requestId}&page=8`))).status).toBe(403);
    for (const [p, b] of x.stateOriginals) expect(readFileSync(p).equals(b)).toBe(true);
    await expect(prepareReferenceStateContinuation(x.stateFile).then(r => r.claim())).rejects.toThrow();
  // Deep historical admission +9 real mock frame checks can exceed3min on Windows.
  // Harness only; no production deadline, assertion or QC gate is changed.
  }, 420000);
  it('reference state rejects rehashed wrong-parent, old-session, failed QA, raw evidence and policy tampering before claim or key', async () => {
    const x = await referenceStateFixture(true), baseline = readFileSync(x.stateFile), disk = vi.spyOn(journal, 'fencedText');
    for (const kind of ['termination', 'unknown', 'passed', 'actor', 'crop', 'context', 'old_session', 'old_qa', 'cost', 'failed_qa', 'two_generations', 'disabled',
      'missing_grant', 'wrong_request', 'wrong_parent', 'lost_grant_cost']) {
      x.stateOriginals.forEach(([p, b]) => writeFileSync(p, b)); const d = JSON.parse(baseline.toString()); disk.mockClear();
      const change = (p: string, fn: (v: any) => void) => { const v = JSON.parse(readFileSync(p, 'utf8')); fn(v); writeFileSync(p, JSON.stringify(v)); };
      if (kind === 'termination') change(d.parentTermination.file, v => { v.terminationConfirmed = false; });
      if (kind === 'unknown') change(path.join(x.stateParent.directory, 'paid-stages/reference_entities_repair.result.json'), v => { v.estimatedMicroUsd = null; });
      if (kind === 'passed') {
        change(path.join(x.stateParent.directory, 'paid-stages/reference_entities_repair_qa.receipt.json'), r => { const q = JSON.parse(r.raw.output_text); q.checks.forEach((c: any) => { c.verdict = 'pass'; }); r.raw.output_text = JSON.stringify(q); });
        change(path.join(x.stateParent.directory, 'reference_entities_review.json'), r => { r.review.checks.forEach((c: any) => { c.verdict = 'pass'; }); r.disposition = 'passed'; });
      }
      if (['actor', 'crop', 'context'].includes(kind)) {
        const wf = path.join(x.stateParent.directory, 'paid-stages/reference_entities_repair_qa.wire.json');
        change(wf, w => { if (kind === 'actor') w.input[0].content[6].image_url = w.input[0].content[7].image_url;
          if (kind === 'crop') w.input[0].content[2].image_url = w.input[0].content[1].image_url;
          if (kind === 'context') { const q = JSON.parse(w.input[0].content[0].text); q.context.design.entities[0].invariants[0].value += ' WRONG'; q.contextSha = sha(JSON.stringify(q.context)); w.input[0].content[0].text = JSON.stringify(q); } });
        const digest = sha(canonicalJson(JSON.parse(readFileSync(wf, 'utf8'))));
        for (const n of ['claim', 'result']) change(path.join(x.stateParent.directory, `paid-stages/reference_entities_repair_qa.${n}.json`), v => { v.wireDigest = digest; });
      }
      if (kind === 'old_session') change(x.stateQA, v => { v.sessionId = JSON.parse(readFileSync(x.repairQA, 'utf8')).sessionId; });
      if (kind === 'old_qa') change(x.stateQA, v => { v.qaReviewHead = 'b'.repeat(40); });
      if (kind === 'cost') change(x.stateQA, v => { v.knownBeforeMicroUsd--; });
      if (kind === 'failed_qa') change(x.stateQA, v => { v.code = 1; v.qaVerdict = null; });
      if (kind === 'two_generations') d.generationCount = 2;
      if (kind === 'disabled') d.stateAwareReferences = false;
      if (kind === 'missing_grant') delete d.ceilingExtension;
      if (kind === 'wrong_request') change(d.ceilingExtension.file, v => { v.requestId = 'b'.repeat(64); });
      if (kind === 'wrong_parent') change(d.ceilingExtension.file, v => { v.parentConfigSha256 = 'b'.repeat(64); });
      if (kind === 'lost_grant_cost') change(d.ceilingExtension.file, v => { v.knownBeforeContinuationMicroUsd--; });
      d.parentTermination = x.ref(d.parentTermination.file); d.technicalReviewReceipt = x.ref(x.stateQA);
      if (d.ceilingExtension) d.ceilingExtension = x.ref(d.ceilingExtension.file);
      d.parentArtifacts = visualEvidenceFiles(x.stateParent.directory).map(relative => ({ relative, sha256: sha(readFileSync(path.join(x.stateParent.directory, relative))) }));
      writeFileSync(x.stateFile, JSON.stringify(d)); await expect(prepareReferenceStateContinuation(x.stateFile), kind).rejects.toThrow();
      expect(x.render).not.toHaveBeenCalled(); expect(sdk.create).not.toHaveBeenCalled(); expect(x.fetcher).not.toHaveBeenCalled(); expect(x.editor).not.toHaveBeenCalled();
      expect(disk.mock.calls.some(([p]) => p === config.existingKeyEnvFile)).toBe(false);
      expect(existsSync(path.join(x.old.directory, 'reference-source-state-continuation-20261009'))).toBe(false);
    }
  }, 360000);
  it('reference state stops a defective fresh atlas after2 paid slots, with no second generation or location/page spending', async () => {
    const x = await referenceStateFixture(true); sdk.create.mockImplementation(async p => { const raw = await x.normal(p), d = JSON.parse(p.input[0].content[0].text);
      if (d.context.role === 'entities') { const q = JSON.parse(raw.output_text); q.checks[3].verdict = 'uncertain'; raw.output_text = JSON.stringify(q); } return raw; });
    expect(await simpleBookReferenceRecoveryCLI(['--config', x.stateFile, '--execute'])).toBe(1);
    expect(x.render).toHaveBeenCalledTimes(1); expect(x.fetcher).not.toHaveBeenCalled(); expect(x.editor).not.toHaveBeenCalled();
    const dir = path.join(x.old.directory, 'reference-source-state-continuation-20261009');
    expect(JSON.parse(readFileSync(path.join(dir, 'sealed.json'), 'utf8'))).toMatchObject({ status: 'failed', code: 'simple_reference_held', snapshot: { logicalAttempts: 2 } });
    expect(existsSync(path.join(dir, 'book.html'))).toBe(false); expect(existsSync(path.join(dir, 'paid-stages/reference_entities_repair.claim.json'))).toBe(false);
  }, 180000);
  it('reference state refuses a missing historical paid journal without recreating it or reading a key', async () => {
    const x = await referenceStateFixture(true), paid = path.join(x.stateParent.directory, 'paid-stages'),
      moved = path.join(root, 'SYNTHETIC-state-paid-away'), unexpected = path.join(root, 'SYNTHETIC-unexpected-recreated-paid');
    for (const p of [paid, moved, unexpected]) if (!path.resolve(p).startsWith(path.resolve(root) + path.sep)) throw Error('fixture_boundary');
    renameSync(paid, moved);
    const d = JSON.parse(readFileSync(x.stateFile, 'utf8'));
    d.parentArtifacts = visualEvidenceFiles(x.stateParent.directory).map(relative => ({ relative, sha256: sha(readFileSync(path.join(x.stateParent.directory, relative))) }));
    writeFileSync(x.stateFile, JSON.stringify(d)); const disk = vi.spyOn(journal, 'fencedText'); disk.mockClear();
    try {
      await expect(prepareReferenceStateContinuation(x.stateFile)).rejects.toThrow();
      expect(existsSync(paid)).toBe(false); expect(sdk.create).not.toHaveBeenCalled(); expect(x.render).not.toHaveBeenCalled();
      expect(disk.mock.calls.some(([p]) => p === config.existingKeyEnvFile)).toBe(false);
      expect(existsSync(path.join(x.old.directory, 'reference-source-state-continuation-20261009'))).toBe(false);
    } finally {
      if (existsSync(paid)) renameSync(paid, unexpected); // Preserve even a mutant's empty directory until fixture cleanup.
      renameSync(moved, paid);
    }
  }, 180000);
  async function referenceRolesFixture() {
    const x = await referenceStateFixture(true);
    sdk.create.mockImplementation(async p => { const raw = await x.normal(p), d = JSON.parse(p.input[0].content[0].text);
      if (d.context.role === 'entities') { const q = JSON.parse(raw.output_text); q.checks[3].verdict = 'defect';
        q.checks[3].correction = 'Synthetic full state-aware atlas still defective.'; raw.output_text = JSON.stringify(q); } return raw; });
    expect(await simpleBookReferenceRecoveryCLI(['--config', x.stateFile, '--execute'])).toBe(1);
    const parent = await prepareReferenceStateContinuation(x.stateFile), seal = JSON.parse(readFileSync(path.join(parent.directory, 'sealed.json'), 'utf8'));
    const host = path.join(root, 'SYNTHETIC-ended-state-host.json');
    writeFileSync(host, JSON.stringify({ head: config.sourceHead, status: '', code: 1, signal: null, terminationConfirmed: true, referenceCap: 4,
      sealSha256: sha(readFileSync(path.join(parent.directory, 'sealed.json'))) }));
    const consult = path.join(root, 'SYNTHETIC-role-consult.json'), oldQA = JSON.parse(readFileSync(x.stateQA, 'utf8'));
    writeFileSync(consult, JSON.stringify({ head: config.sourceHead, status: '', code: 0, signal: null, terminationConfirmed: true, stopped: false,
      reportedCostUsd: .003, previousCumulativeReportedCostUsd: .002, sessionId: oldQA.sessionId, incrementalKnownMicroUsd: 1000,
      knownBeforeMicroUsd: seal.snapshot.knownEstimateMicroUsd, knownAfterMicroUsd: seal.snapshot.knownEstimateMicroUsd + 1000,
      models: ['claude-opus-5-5'], maximumNewMicroUsd: 250000, isError: false, resultSubtype: 'success', sourceUnchanged: true,
      validConsultation: true, notTechnicalPASS: true, costKind: 'cumulative_same_cli_session_list_estimate_not_invoice', previousReceipt: x.ref(x.stateQA) }));
    const qa = path.join(root, 'SYNTHETIC-role-QA.json');
    writeFileSync(qa, JSON.stringify({ ...oldQA, reportedCostUsd: .005, previousCumulativeReportedCostUsd: .003,
      costKind: 'cumulative_same_cli_session_list_estimate_not_invoice', knownBeforeMicroUsd: seal.snapshot.knownEstimateMicroUsd + 1000,
      previousReceipt: x.ref(consult) }));
    const data: any = { ...x.stateData, version: 'controlled-simple-reference-roles/v1', splitReferenceRoles: true,
      parentConfig: x.ref(x.stateFile), parentTermination: x.ref(host), consultationReceipt: x.ref(consult), technicalReviewReceipt: x.ref(qa),
      parentArtifacts: visualEvidenceFiles(parent.directory).map(relative => ({ relative, sha256: sha(readFileSync(path.join(parent.directory, relative))) })) };
    delete data.ceilingExtension;
    const rolesFile = path.join(root, 'SYNTHETIC-reference-roles-config.json'); writeFileSync(rolesFile, JSON.stringify(data));
    const originals = [...x.stateOriginals.map(([p]) => p), x.stateFile, x.stateQA, host, consult, qa,
      ...visualEvidenceFiles(parent.directory).map(n => path.join(parent.directory, n))].map(p => [p, readFileSync(p)] as const);
    sdk.create.mockImplementation(x.normal); sdk.create.mockClear(); x.render.mockClear(); x.fetcher.mockClear(); x.editor.mockClear();
    return { ...x, rolesFile, rolesData: data, rolesParent: parent, rolesSeal: seal, consult, rolesQA: qa, rolesOriginals: originals };
  }
  it('reference roles reject rehashed admission defects, then retain disjoint full coverage, honest subset roles and9 private gated frames with all costs once', async () => {
    const x = await referenceRolesFixture(), baseline = readFileSync(x.rolesFile), disk = vi.spyOn(journal, 'fencedText');
    for (const kind of ['termination', 'unknown', 'actor', 'crop', 'context', 'consult_delta', 'consult_session', 'consult_source',
      'cost', 'failed_qa', 'previous_receipt', 'two_generations', 'disabled', 'ceiling', 'wrong_parent']) {
      x.rolesOriginals.forEach(([p, b]) => writeFileSync(p, b)); const d = JSON.parse(baseline.toString()); disk.mockClear();
      const change = (p: string, fn: (v: any) => void) => { const v = JSON.parse(readFileSync(p, 'utf8')); fn(v); writeFileSync(p, JSON.stringify(v)); };
      if (kind === 'termination') change(d.parentTermination.file, v => { v.terminationConfirmed = false; });
      if (kind === 'unknown') change(path.join(x.rolesParent.directory, 'paid-stages/reference_entities.result.json'), v => { v.estimatedMicroUsd = null; });
      if (['actor', 'crop', 'context'].includes(kind)) {
        const wf = path.join(x.rolesParent.directory, 'paid-stages/reference_entities_qa.wire.json');
        change(wf, w => { if (kind === 'actor') w.input[0].content[6].image_url = w.input[0].content[7].image_url;
          if (kind === 'crop') w.input[0].content[2].image_url = w.input[0].content[1].image_url;
          if (kind === 'context') { const q = JSON.parse(w.input[0].content[0].text); q.context.design.referenceState.presentation = 'anything_goes';
            q.contextSha = sha(JSON.stringify(q.context)); w.input[0].content[0].text = JSON.stringify(q); } });
        const digest = sha(canonicalJson(JSON.parse(readFileSync(wf, 'utf8'))));
        for (const n of ['claim', 'result']) change(path.join(x.rolesParent.directory, `paid-stages/reference_entities_qa.${n}.json`), v => { v.wireDigest = digest; });
      }
      if (kind === 'consult_delta') change(x.consult, v => { v.incrementalKnownMicroUsd--; });
      if (kind === 'consult_session') change(x.consult, v => { v.sessionId = 'ffffffff-ffff-4fff-8fff-ffffffffffff'; });
      if (kind === 'consult_source') change(x.consult, v => { v.head = 'b'.repeat(40); });
      if (kind === 'cost') change(x.rolesQA, v => { v.knownBeforeMicroUsd--; });
      if (kind === 'failed_qa') change(x.rolesQA, v => { v.code = 1; v.qaVerdict = null; });
      if (kind === 'previous_receipt') change(x.rolesQA, v => { v.previousReceipt.sha256 = 'b'.repeat(64); });
      if (kind === 'two_generations') d.generationCount = 2; if (kind === 'disabled') d.splitReferenceRoles = false;
      if (kind === 'ceiling') d.maximumMicroUsd = 22000000;
      if (kind === 'wrong_parent') d.parentConfig = x.ref(x.repairFile);
      d.parentTermination = x.ref(d.parentTermination.file); d.consultationReceipt = x.ref(x.consult); d.technicalReviewReceipt = x.ref(x.rolesQA);
      if (['consult_delta', 'consult_session', 'consult_source'].includes(kind)) {
        change(x.rolesQA, v => { v.previousReceipt = d.consultationReceipt; }); d.technicalReviewReceipt = x.ref(x.rolesQA);
      }
      d.parentArtifacts = visualEvidenceFiles(x.rolesParent.directory).map(relative => ({ relative, sha256: sha(readFileSync(path.join(x.rolesParent.directory, relative))) }));
      writeFileSync(x.rolesFile, JSON.stringify(d)); await expect(prepareReferenceRoleContinuation(x.rolesFile), kind).rejects.toThrow();
      expect(x.render).not.toHaveBeenCalled(); expect(sdk.create).not.toHaveBeenCalled(); expect(x.fetcher).not.toHaveBeenCalled(); expect(x.editor).not.toHaveBeenCalled();
      expect(disk.mock.calls.some(([p]) => p === config.existingKeyEnvFile)).toBe(false);
      expect(existsSync(path.join(x.old.directory, 'reference-role-split-continuation-20261009'))).toBe(false);
    }
    x.rolesOriginals.forEach(([p, b]) => writeFileSync(p, b)); writeFileSync(x.rolesFile, baseline);
    const ready = await prepareReferenceRoleContinuation(x.rolesFile);
    expect(ready.externalMicroUsd).toBe(x.rolesSeal.snapshot.knownEstimateMicroUsd + 3000);
    expect(ready.engineeringReceipts.filter(f => f.file === x.rolesQA)).toHaveLength(1);
    expect(ready.engineeringReceipts.some(f => f.file === x.stateQA || f.file === x.consult)).toBe(false);
    expect(ready.inheritedLogicalAttempts).toBe(x.rolesParent.inheritedLogicalAttempts + 2);
    expect(await simpleBookReferenceRecoveryCLI(['--config', x.rolesFile])).toBe(0); expect(x.render).not.toHaveBeenCalled();
    expect(await simpleBookReferenceRecoveryCLI(['--config', x.rolesFile, '--execute'])).toBe(0);
    const e = JSON.parse(readFileSync(path.join(ready.directory, 'paid-stages/reference_entities_qa.wire.json'), 'utf8')),
      l = JSON.parse(readFileSync(path.join(ready.directory, 'paid-stages/reference_locations_qa.wire.json'), 'utf8')),
      de = JSON.parse(e.input[0].content[0].text), dl = JSON.parse(l.input[0].content[0].text),
      expected = simpleReferenceDesigns(ready.result.storyboard!.storyboard, true, true, ready.result.source.manuscript.pages.map((p: { text: string }) => p.text), true);
    expect(de.context.design).toEqual(expected.entities); expect(dl.context.design).toEqual(expected.locations);
    expect(x.render.mock.calls[0][0].referenceRoles).toEqual(['child_design_authority', 'companion_design_authority']);
    expect(x.render.mock.calls[1][0].referenceRoles).toEqual(['child_design_authority', 'companion_design_authority', 'entity_design_authority', 'landmark_subset_design_authority']);
    const locationReferenceHashes = x.render.mock.calls[1][0].exactReferenceBytes!.map(b => sha(b));
    expect(locationReferenceHashes[locationReferenceHashes.length - 1]).toBe(ready.entityDesignAuthority.imageSha);
    expect(dl.imageRoles.at(-1)).toBe('supported_landmark_subset_not_complete_locations');
    expect(dl.imageRoles).not.toContain('canonical_locations'); expect(l.input[0].content).toHaveLength(10);
    expect(x.render).toHaveBeenCalledTimes(11); expect(x.fetcher).toHaveBeenCalledTimes(9); expect(x.editor).not.toHaveBeenCalled();
    for (const call of x.render.mock.calls.slice(2)) { expect(call[0].referenceMode).toBe('book_identity'); expect(call[0].exactReferenceBytes).toHaveLength(4); }
    const claim = JSON.parse(readFileSync(path.join(ready.directory, 'claim.json'), 'utf8'));
    expect(claim.referenceDesignSha256).toBe(sha(canonicalJson(expected))); expect(claim.generationCount).toBe(1);
    const manifest = JSON.parse(readFileSync(path.join(ready.directory, 'illustrated_book.json'), 'utf8'));
    expect(manifest.pages).toHaveLength(9); expect(manifest.pages.every((p: any) => p.status === 'passed' && p.identity.threshold === .7 && p.identity.status === 'passed')).toBe(true);
    const page = await GET(req('GET', undefined, `${url}?requestId=${ready.parent.job.queued.requestId}&page=8`));
    expect(page.status).toBe(200); expect(sha(Buffer.from(await page.arrayBuffer()))).toBe(manifest.pages[8].candidate.imageSha);
    deps.user = { id: 'other', email: 'owner@example.com' }; expect((await GET(req('GET', undefined, `${url}?requestId=${ready.parent.job.queued.requestId}&page=8`))).status).toBe(403);
    for (const [p, b] of x.rolesOriginals) expect(readFileSync(p).equals(b)).toBe(true);
    await expect(prepareReferenceRoleContinuation(x.rolesFile).then(r => r.claim())).rejects.toThrow();
  }, 600000);
  it('reference roles stop after one uncertain atlas, no locations, pages or reference retry', async () => {
    const x = await referenceRolesFixture(); sdk.create.mockImplementation(async p => { const raw = await x.normal(p), d = JSON.parse(p.input[0].content[0].text);
      if (d.context.role === 'entities') { const q = JSON.parse(raw.output_text); q.checks[3].verdict = 'uncertain'; raw.output_text = JSON.stringify(q); } return raw; });
    expect(await simpleBookReferenceRecoveryCLI(['--config', x.rolesFile, '--execute'])).toBe(1);
    expect(x.render).toHaveBeenCalledTimes(1); expect(x.fetcher).not.toHaveBeenCalled(); expect(x.editor).not.toHaveBeenCalled();
    const dir = path.join(x.old.directory, 'reference-role-split-continuation-20261009');
    expect(JSON.parse(readFileSync(path.join(dir, 'sealed.json'), 'utf8'))).toMatchObject({ status: 'failed', code: 'simple_reference_held', snapshot: { logicalAttempts: 2 } });
    expect(existsSync(path.join(dir, 'book.html'))).toBe(false); expect(existsSync(path.join(dir, 'paid-stages/reference_entities_repair.claim.json'))).toBe(false);
  }, 240000);
  it('entity repair uses ONE rejected target with three typed authorities, a fresh full review and9 gated private frames while keeping cumulative fees once', async () => {
    const x = await entityRepairFixture(), ready = await prepareEntityRepairContinuation(x.repairFile);
    expect(ready.externalMicroUsd).toBe(x.parentSeal.snapshot.knownEstimateMicroUsd + 2000);
    expect(ready.inheritedLogicalAttempts).toBe(x.parent.inheritedLogicalAttempts + 2);
    expect(await simpleBookReferenceRecoveryCLI(['--config', x.repairFile])).toBe(0); expect(x.render).not.toHaveBeenCalled();
    expect(await simpleBookReferenceRecoveryCLI(['--config', x.repairFile, '--execute'])).toBe(0);
    const first = x.render.mock.calls[0][0]; expect(first.referenceRoles).toEqual(['rejected_edit_target', 'child_design_authority', 'companion_design_authority', 'entity_design_authority']);
    expect(first.exactReferenceBytes!.map(b => sha(b))).toEqual([ready.checkpoint.entities.imageSha, ready.checkpoint.child.imageSha,
      sha(readFileSync(path.join(x.parent.directory, 'illustrations/companion_reference.png'))), ready.entityDesignAuthority.imageSha]);
    expect(first.finalPrompt).toContain('Synthetic wrong fixed design'); expect(first.finalPrompt).toContain('Synthetic unreadable silhouette');
    expect(x.render).toHaveBeenCalledTimes(11); expect(x.fetcher).toHaveBeenCalledTimes(9); expect(x.editor).not.toHaveBeenCalled();
    const wire = JSON.parse(readFileSync(path.join(ready.directory, 'paid-stages/reference_entities_repair_qa.wire.json'), 'utf8')), data = JSON.parse(wire.input[0].content[0].text);
    expect(data.imageRoles).toEqual(['candidate_complete', 'candidate_crop_top_left', 'candidate_crop_top_right', 'candidate_crop_bottom_left', 'candidate_crop_bottom_right', 'canonical_child', 'canonical_companion']);
    expect(wire.input[0].content).toHaveLength(8); expect(data.context.design.entities).toEqual(ready.result.storyboard!.storyboard.plan.continuity!.entities);
    const manifest = JSON.parse(readFileSync(path.join(ready.directory, 'illustrated_book.json'), 'utf8')); expect(manifest.pages).toHaveLength(9);
    expect(manifest.pages.every((p: any) => p.status === 'passed' && p.identity.threshold === .7 && p.identity.status === 'passed')).toBe(true);
    const served = await GET(req('GET', undefined, `${url}?requestId=${ready.parent.job.queued.requestId}&page=8`)); expect(served.status).toBe(200);
    expect(served.headers.get('cache-control')).toBe('private, no-store');
    deps.user = { id: 'other', email: 'owner@example.com' }; expect((await GET(req('GET', undefined, `${url}?requestId=${ready.parent.job.queued.requestId}&page=8`))).status).toBe(403);
    for (const [p, b] of x.repairOriginals) expect(readFileSync(p).equals(b)).toBe(true);
    await expect(prepareEntityRepairContinuation(x.repairFile).then(r => r.claim())).rejects.toThrow();
  }, 420000);
  it('entity repair rejects rehashed failed-parent, raw pixel/crop/context, cumulative fee and current-QA tampering before claim or key', async () => {
    const x = await entityRepairFixture(), baseline = readFileSync(x.repairFile), technicalBytes = readFileSync(x.repairQA);
    const disk = vi.spyOn(journal, 'fencedText');
    for (const kind of ['termination', 'unknown', 'passed', 'context', 'actor', 'crop', 'lost_fee', 'wrong_session', 'wrong_qa_head', 'second_correction']) {
      x.repairOriginals.forEach(([p, b]) => writeFileSync(p, b)); writeFileSync(x.repairQA, technicalBytes); const d = JSON.parse(baseline.toString()); disk.mockClear();
      const change = (p: string, fn: (v: any) => void) => { const v = JSON.parse(readFileSync(p, 'utf8')); fn(v); writeFileSync(p, JSON.stringify(v)); };
      if (kind === 'termination') change(d.parentTermination.file, v => { v.terminationConfirmed = false; });
      if (kind === 'unknown') change(path.join(x.parent.directory, 'paid-stages/reference_entities.result.json'), v => { v.estimatedMicroUsd = null; });
      if (kind === 'passed') { change(path.join(x.parent.directory, 'paid-stages/reference_entities_qa.receipt.json'), r => { const q = JSON.parse(r.raw.output_text); q.checks.forEach((c: any) => { c.verdict = 'pass'; }); r.raw.output_text = JSON.stringify(q); });
        change(path.join(x.parent.directory, 'reference_entities_review.json'), r => { r.review.checks.forEach((c: any) => { c.verdict = 'pass'; }); r.disposition = 'passed'; }); }
      if (['context', 'actor', 'crop'].includes(kind)) {
        const wireFile = path.join(x.parent.directory, 'paid-stages/reference_entities_qa.wire.json');
        change(wireFile, w => { if (kind === 'actor') w.input[0].content[6].image_url = w.input[0].content[7].image_url;
          if (kind === 'crop') w.input[0].content[2].image_url = w.input[0].content[1].image_url;
          if (kind === 'context') { const q = JSON.parse(w.input[0].content[0].text); q.context.design.entities[0].invariants[0].value += ' WRONG'; q.contextSha = sha(JSON.stringify(q.context)); w.input[0].content[0].text = JSON.stringify(q); } });
        const digest = sha(canonicalJson(JSON.parse(readFileSync(wireFile, 'utf8'))));
        for (const n of ['claim', 'result']) change(path.join(x.parent.directory, `paid-stages/reference_entities_qa.${n}.json`), v => { v.wireDigest = digest; });
      }
      if (kind === 'lost_fee') change(x.repairQA, v => { v.reportedCostUsd = .004; });
      if (kind === 'wrong_session') change(x.repairQA, v => { v.sessionId = 'ab123456-1234-4234-8234-123456789012'; });
      if (kind === 'wrong_qa_head') change(x.repairQA, v => { v.qaReviewHead = 'b'.repeat(40); });
      if (kind === 'second_correction') d.correctionCount = 2;
      d.parentTermination = x.ref(d.parentTermination.file); d.technicalReviewReceipt = x.ref(d.technicalReviewReceipt.file);
      d.parentArtifacts = visualEvidenceFiles(x.parent.directory).map(relative => ({ relative, sha256: sha(readFileSync(path.join(x.parent.directory, relative))) }));
      writeFileSync(x.repairFile, JSON.stringify(d)); await expect(prepareEntityRepairContinuation(x.repairFile), kind).rejects.toThrow();
      expect(x.render).not.toHaveBeenCalled(); expect(sdk.create).not.toHaveBeenCalled(); expect(x.fetcher).not.toHaveBeenCalled();
      expect(disk.mock.calls.some(([p]) => p === config.existingKeyEnvFile)).toBe(false);
      expect(existsSync(path.join(x.old.directory, 'reference-entity-repair-continuation-20261009'))).toBe(false);
    }
  }, 180000);
  it('entity repair still holds after ONE corrected atlas fails fresh QC, without a second correction or downstream spending', async () => {
    const x = await entityRepairFixture(); sdk.create.mockImplementation(async p => { const raw = await x.normal(p), d = JSON.parse(p.input[0].content[0].text);
      if (d.context.role === 'entities') { const q = JSON.parse(raw.output_text); q.checks[3].verdict = 'uncertain'; raw.output_text = JSON.stringify(q); } return raw; });
    expect(await simpleBookReferenceRecoveryCLI(['--config', x.repairFile, '--execute'])).toBe(1); expect(x.render).toHaveBeenCalledTimes(1);
    expect(x.fetcher).not.toHaveBeenCalled(); expect(x.editor).not.toHaveBeenCalled();
    const dir = path.join(x.old.directory, 'reference-entity-repair-continuation-20261009');
    expect(JSON.parse(readFileSync(path.join(dir, 'sealed.json'), 'utf8'))).toMatchObject({ status: 'failed', code: 'simple_reference_held', snapshot: { logicalAttempts: 2 } });
    expect(existsSync(path.join(dir, 'book.html'))).toBe(false); expect(existsSync(path.join(dir, 'paid-stages/reference_entities_repair_2.claim.json'))).toBe(false);
  }, 180000);
  it('reference design rebuild rejects rebound evidence, omitted costs, old or failed QA before key and fresh claim', async () => {
    const x = await referenceRebuildFixture(), baseline = readFileSync(x.recoveryFile), terminal = readFileSync(x.endedTerminal);
    const prior = readFileSync(x.endedFile), tech = readFileSync(x.data.technicalReviewReceipt.file);
    const originals = x.endedNames.map(n => [n, readFileSync(path.join(x.endedDir, n))] as const);
    const disk = vi.spyOn(journal, 'fencedText'); disk.mockClear();
    for (const kind of ['inventory', 'termination', 'parent_fee', 'current_failed', 'old_qa', 'unknown', 'role_order', 'gate', 'wrong_seal', 'missing_paid_root']) {
      originals.forEach(([n, b]) => writeFileSync(path.join(x.endedDir, n), b)); writeFileSync(x.endedTerminal, terminal); writeFileSync(x.endedFile, prior); writeFileSync(x.data.technicalReviewReceipt.file, tech);
      const d = JSON.parse(baseline.toString()), c = d.rebuildContinuation;
      const change = (n: string, f: (v: any) => void) => { const p = path.join(x.endedDir, n), v = JSON.parse(readFileSync(p, 'utf8')); f(v); writeFileSync(p, JSON.stringify(v)); };
      if (kind === 'inventory') c.artifacts.pop();
      if (kind === 'termination') { const h = JSON.parse(terminal.toString()); h.terminationConfirmed = false; writeFileSync(x.endedTerminal, JSON.stringify(h)); }
      if (kind === 'parent_fee') { const p = JSON.parse(prior.toString()); p.extraEngineeringReceipts.pop(); writeFileSync(x.endedFile, JSON.stringify(p)); }
      if (kind === 'current_failed') { const t = JSON.parse(tech.toString()); t.code = 1; t.isError = true; t.resultSubtype = 'error_max_budget_usd'; writeFileSync(d.technicalReviewReceipt.file, JSON.stringify(t)); }
      if (kind === 'old_qa') d.technicalReviewReceipt = d.extraEngineeringReceipts[4];
      if (kind === 'unknown') change('paid-stages/reference_entities_repair_qa.result.json', v => { v.estimatedMicroUsd = null; });
      if (kind === 'role_order') { change('paid-stages/reference_entities_repair.wire.json', v => { v.referenceRoles.reverse(); });
        const w = JSON.parse(readFileSync(path.join(x.endedDir, 'paid-stages/reference_entities_repair.wire.json'), 'utf8')), digest = sha(canonicalJson(w));
        change('paid-stages/reference_entities_repair.claim.json', v => { v.wireDigest = digest; }); change('paid-stages/reference_entities_repair.result.json', v => { v.wireDigest = digest; }); }
      if (kind === 'gate') c.gateChanges = true;
      if (kind === 'wrong_seal') change('sealed.json', v => { v.status = 'illustrated_audition'; });
      if (kind === 'missing_paid_root') { const paid = path.join(x.endedDir, 'paid-stages'); if (!x.endedDir.startsWith(root + path.sep)) throw Error('fixture_boundary');
        renameSync(paid, path.join(root, 'SYNTHETIC-rebuild-paid-away')); c.artifacts = c.artifacts.filter((f: any) => !f.relative.startsWith('paid-stages/')); }
      c.config = x.ref(x.endedFile); c.terminationReceipt = x.ref(x.endedTerminal);
      c.artifacts = c.artifacts.map((f: any) => ({ ...f, sha256: sha(readFileSync(path.join(x.endedDir, f.relative))) }));
      d.technicalReviewReceipt = x.ref(d.technicalReviewReceipt.file); d.extraEngineeringReceipts[5] = d.technicalReviewReceipt;
      writeFileSync(x.recoveryFile, JSON.stringify(d)); await expect(prepareSimpleBookReferenceRecovery(x.recoveryFile), kind).rejects.toThrow();
      expect(sdk.create).not.toHaveBeenCalled(); expect(x.render).not.toHaveBeenCalled(); expect(x.editor).not.toHaveBeenCalled();
      expect(disk.mock.calls.some(([p]) => p === config.existingKeyEnvFile)).toBe(false); expect(existsSync(path.join(x.old.directory, 'reference-design-rebuild-continuation-20261008'))).toBe(false);
      if (kind === 'missing_paid_root') { expect(existsSync(path.join(x.endedDir, 'paid-stages'))).toBe(false); renameSync(path.join(root, 'SYNTHETIC-rebuild-paid-away'), path.join(x.endedDir, 'paid-stages')); }
    }
  }, 180000);
  it('reference design rebuild stops a failed fresh sheet without editing it, regenerating child, locations or pages', async () => {
    const x = await referenceRebuildFixture();
    sdk.create.mockImplementation(async p => { const raw = await x.normal(p), d = JSON.parse(p.input[0].content[0].text);
      if (d.context.role === 'entities') { const out = JSON.parse(raw.output_text); out.checks[4].verdict = 'defect'; out.checks[4].correction = 'Synthetic fresh design defect.'; raw.output_text = JSON.stringify(out); } return raw; });
    expect(await simpleBookReferenceRecoveryCLI(['--config', x.recoveryFile, '--execute'])).toBe(1);
    expect(x.render).toHaveBeenCalledTimes(1); expect(x.fetcher).not.toHaveBeenCalled(); expect(x.editor).not.toHaveBeenCalled();
    const dir = path.join(x.old.directory, 'reference-design-rebuild-continuation-20261008');
    expect(JSON.parse(readFileSync(path.join(dir, 'sealed.json'), 'utf8'))).toMatchObject({ status: 'failed', code: 'simple_reference_held', snapshot: { logicalAttempts: 2 } });
    expect(existsSync(path.join(dir, 'paid-stages/reference_entities_repair.claim.json'))).toBe(false);
    expect(existsSync(path.join(dir, 'paid-stages/reference_child.claim.json'))).toBe(false); expect(existsSync(path.join(dir, 'book.html'))).toBe(false);
  }, 180000);
  it('transport continuation rejects altered outcomes, old charges and mapping evidence before claim, key or dispatch', async () => {
    const x = await transportContinuationFixture(), baseline = readFileSync(x.recoveryFile), terminal = readFileSync(x.terminal);
    const priorConfig = readFileSync(x.priorFile), tech = readFileSync(x.data.technicalReviewReceipt.file);
    const originals = x.names.map(n => [n, readFileSync(path.join(x.priorDir, n))] as const);
    const disk = vi.spyOn(journal, 'fencedText'); disk.mockClear();
    await expect(prepareSimpleBookReferenceRecovery(x.recoveryFile)).resolves.toMatchObject({ explicitReferenceTransport: true });
    for (const kind of ['inventory', 'parent', 'prior_fee', 'technical_base', 'session_alias', 'termination', 'cost', 'gate', 'unknown',
      'journal', 'replaced_child', 'wrong_roles', 'altered_reference', 'wrong_pixel_verdict', 'output_pages', 'seal', 'missing_paid_root']) {
      originals.forEach(([n, b]) => writeFileSync(path.join(x.priorDir, n), b));
      writeFileSync(x.terminal, terminal); writeFileSync(x.priorFile, priorConfig); writeFileSync(x.data.technicalReviewReceipt.file, tech);
      const d = JSON.parse(baseline.toString()), tc = d.transportContinuation;
      const change = (n: string, f: (v: any) => void) => { const p = path.join(x.priorDir, n), v = JSON.parse(readFileSync(p, 'utf8')); f(v); writeFileSync(p, JSON.stringify(v)); };
      if (kind === 'inventory') tc.artifacts.pop();
      if (kind === 'parent' || kind === 'prior_fee') { const p = JSON.parse(priorConfig.toString());
        if (kind === 'parent') p.checkpoint.config.sha256 = 'b'.repeat(64); else p.extraEngineeringReceipts.pop(); writeFileSync(x.priorFile, JSON.stringify(p)); }
      if (kind === 'technical_base' || kind === 'session_alias') { const t = JSON.parse(tech.toString());
        if (kind === 'technical_base') t.qaBase = 'b'.repeat(40); else t.sessionId = '77777777-7777-4777-8777-777777777777'; writeFileSync(d.technicalReviewReceipt.file, JSON.stringify(t)); }
      if (kind === 'termination') { const h = JSON.parse(terminal.toString()); h.terminationConfirmed = false; writeFileSync(x.terminal, JSON.stringify(h)); }
      if (kind === 'cost') tc.knownBeforeCurrentReviewMicroUsd--;
      if (kind === 'gate') tc.gateChanges = true;
      if (kind === 'unknown') change('paid-stages/reference_entities_repair_qa.result.json', v => { v.estimatedMicroUsd = null; });
      if (kind === 'journal') change('paid-stages/reference_entities_recheck.claim.json', v => { v.step = 'other'; });
      if (kind === 'replaced_child') change('reference_child_adoption.json', v => { v.candidate.imageSha = 'b'.repeat(64); });
      if (kind === 'wrong_roles') change('paid-stages/reference_entities_recheck.wire.json', v => { const t = JSON.parse(v.input[0].content[0].text); t.imageRoles[5] = 'candidate_complete'; v.input[0].content[0].text = JSON.stringify(t); });
      if (kind === 'altered_reference') change('paid-stages/reference_entities_repair.wire.json', v => { v.references[1].imageSha = 'b'.repeat(64); });
      // Rebind the altered wire so rejection cannot hide behind a stale digest.
      if (kind === 'wrong_roles' || kind === 'altered_reference') {
        const name = kind === 'wrong_roles' ? 'reference_entities_recheck' : 'reference_entities_repair';
        const wire = JSON.parse(readFileSync(path.join(x.priorDir, `paid-stages/${name}.wire.json`), 'utf8'));
        const bound = sha(canonicalJson(wire));
        change(`paid-stages/${name}.claim.json`, v => { v.wireDigest = bound; });
        change(`paid-stages/${name}.result.json`, v => { v.wireDigest = bound; });
      }
      if (kind === 'wrong_pixel_verdict') change('reference_entities_review.json', v => { v.disposition = 'passed'; });
      if (kind === 'output_pages') writeFileSync(path.join(x.priorDir, 'book.html.json'), '{}');
      if (kind === 'seal') change('sealed.json', v => { v.status = 'illustrated_audition'; });
      if (kind === 'missing_paid_root') {
        const paid = path.join(x.priorDir, 'paid-stages'); if (!x.priorDir.startsWith(root + path.sep)) throw Error('fixture_boundary');
        renameSync(paid, path.join(root, 'SYNTHETIC-ended-paid-moved')); tc.artifacts = tc.artifacts.filter((f: any) => !f.relative.startsWith('paid-stages/'));
      }
      tc.config = x.ref(x.priorFile); tc.terminationReceipt = x.ref(x.terminal);
      tc.artifacts = tc.artifacts.map((f: any) => ({ ...f, sha256: sha(readFileSync(path.join(x.priorDir, f.relative))) }));
      if (kind === 'output_pages') tc.artifacts.push({ relative: 'book.html.json', sha256: sha(readFileSync(path.join(x.priorDir, 'book.html.json'))) });
      d.technicalReviewReceipt = x.ref(d.technicalReviewReceipt.file); d.extraEngineeringReceipts[4] = d.technicalReviewReceipt;
      writeFileSync(x.recoveryFile, JSON.stringify(d));
      await expect(prepareSimpleBookReferenceRecovery(x.recoveryFile), kind).rejects.toThrow();
      expect(sdk.create).not.toHaveBeenCalled(); expect(x.render).not.toHaveBeenCalled(); expect(x.editor).not.toHaveBeenCalled();
      expect(disk.mock.calls.some(([p]) => p === config.existingKeyEnvFile)).toBe(false);
      expect(existsSync(path.join(x.old.directory, 'reference-transport-continuation-20261008'))).toBe(false);
      if (kind === 'output_pages') { const p = path.join(x.priorDir, 'book.html.json'); if (!p.startsWith(root + path.sep)) throw Error('fixture_boundary'); rmSync(p); }
      if (kind === 'missing_paid_root') expect(existsSync(path.join(x.priorDir, 'paid-stages'))).toBe(false);
    }
  }, 90000);
  it('role sixteen grant retains failed review cost once and completes the same private9 images without a new writer', async () => {
    const x = await roleSixteenFixture(), ready = await prepareSimpleBookReferenceRecovery(x.recoveryFile);
    expect(ready.externalMicroUsd).toBe(x.extension.knownBeforeFreshReviewMicroUsd + 3000);
    expect(ready.extra).toBe(50000); expect(ready.config.maximumMicroUsd).toBe(16000000);
    expect(sdk.create).not.toHaveBeenCalled(); expect(x.render).not.toHaveBeenCalled();
    const failedBefore = readFileSync(x.failedFile), originalGrantBefore = readFileSync(x.grantFile);
    expect(await simpleBookReferenceRecoveryCLI(['--config', x.recoveryFile, '--execute'])).toBe(0);
    expect(x.editor).not.toHaveBeenCalled(); expect(x.render).toHaveBeenCalledTimes(10); expect(x.fetcher).toHaveBeenCalledTimes(9);
    const dir = path.join(x.old.directory, 'role-scoped-reference-continuation-20261008');
    expect(JSON.parse(readFileSync(path.join(dir, 'claim.json'), 'utf8'))).toMatchObject({ maximumMicroUsd: 16000000, extra: 50000, ceilingExtension: x.data.ceilingExtension });
    const response = await GET(req('GET', undefined, `${url}?requestId=${ready.parent.job.queued.requestId}`));
    expect(await response.json()).toMatchObject({ phase: 'illustrated_audition', imageScope: 'role_scoped_reference_continuation', accounting: { allowanceMicroUsd: 16000000, unknownAttemptCosts: 0 } });
    expect(readFileSync(x.failedFile)).toEqual(failedBefore); expect(readFileSync(x.grantFile)).toEqual(originalGrantBefore);
    for (const [n, h] of x.checkpointHashes) expect(sha(readFileSync(path.join(x.checkpointDir, n)))).toBe(h);
    const base = emptySimpleBookView('a'.repeat(64));
    expect(readSimpleBookView({ ...base, imageScope: 'owned_reference_recovery', accounting: { ...base.accounting, allowanceMicroUsd: 16000000 } }, base.requestId)).toBeNull();
  }, 180000);
  it('role sixteen rejects missing, foreign, stale, duplicate or falsely successful fee grants before claim/key/provider', async () => {
    const x = await roleSixteenFixture(), baseline = readFileSync(x.recoveryFile), technical = readFileSync(x.data.technicalReviewReceipt.file);
    const disk = vi.spyOn(journal, 'fencedText'); disk.mockClear();
    const git = vi.mocked(frozen.gitAt), normalGit = git.getMockImplementation()!;
    for (const kind of ['missing', 'hash', 'request', 'previous', 'maximum', 'prior_grant', 'checkpoint', 'known_cost', 'unknown_fee', 'failed_not_terminated',
      'failed_success', 'failed_source_dirty', 'failed_session_alias', 'failed_foreign_head', 'duplicate_fee', 'failed_as_technical', 'fourteen_with_extension', 'v2_sixteen']) {
      const d = JSON.parse(baseline.toString()), g = structuredClone(x.extension), failed: any = structuredClone(x.failed);
      git.mockImplementation(normalGit);
      writeFileSync(d.technicalReviewReceipt.file, technical);
      if (kind === 'missing') delete d.ceilingExtension;
      if (kind === 'request') g.requestId = 'b'.repeat(64);
      if (kind === 'previous') g.previousMaximumMicroUsd = 12000000;
      if (kind === 'maximum') g.maximumMicroUsd = 18000000;
      if (kind === 'prior_grant') g.priorAllowanceGrantSha256 = 'b'.repeat(64);
      if (kind === 'checkpoint') g.checkpointConfigSha256 = 'b'.repeat(64);
      if (kind === 'known_cost') g.knownBeforeFreshReviewMicroUsd--;
      if (kind === 'unknown_fee') failed.reportedCostUsd = null;
      if (kind === 'failed_not_terminated') failed.terminationConfirmed = false;
      if (kind === 'failed_success') { failed.code = 0; failed.isError = false; failed.resultSubtype = 'success'; }
      if (kind === 'failed_source_dirty') failed.sourceBundleUnchanged = false;
      if (kind === 'failed_session_alias') failed.sessionId = JSON.parse(technical.toString()).sessionId;
      if (kind === 'failed_foreign_head') {
        failed.head = 'b'.repeat(40);
        git.mockImplementation((repo, args) => {
          if (args[0] === 'merge-base' && args[2] === failed.head) throw Error('SYNTHETIC no ancestor');
          return normalGit(repo, args);
        });
      }
      writeFileSync(x.failedFile, JSON.stringify(failed)); g.failedReviewReceipt = x.ref(x.failedFile); d.extraEngineeringReceipts[2] = g.failedReviewReceipt;
      writeFileSync(x.extensionFile, JSON.stringify(g)); if (d.ceilingExtension) d.ceilingExtension = x.ref(x.extensionFile);
      if (kind === 'hash') d.ceilingExtension.sha256 = 'b'.repeat(64);
      if (kind === 'duplicate_fee') d.extraEngineeringReceipts[3] = d.extraEngineeringReceipts[2];
      if (kind === 'failed_as_technical') d.technicalReviewReceipt = d.extraEngineeringReceipts[2];
      if (kind === 'fourteen_with_extension') d.maximumMicroUsd = 14000000;
      if (kind === 'v2_sixteen') d.version = 'controlled-simple-reference-recovery/v2';
      writeFileSync(x.recoveryFile, JSON.stringify(d));
      await expect(prepareSimpleBookReferenceRecovery(x.recoveryFile), kind).rejects.toThrow();
      expect(sdk.create).not.toHaveBeenCalled(); expect(x.render).not.toHaveBeenCalled(); expect(x.editor).not.toHaveBeenCalled();
      expect(disk.mock.calls.some(([p]) => p === config.existingKeyEnvFile)).toBe(false);
      expect(existsSync(path.join(x.old.directory, 'role-scoped-reference-continuation-20261008'))).toBe(false);
    }
  }, 90000);
  it('role checkpoint reuses supported child, rechecks real atlas evidence, makes one edit and the same9 gated frames', async () => {
    const x = await roleCheckpointFixture(), ready = await prepareSimpleBookReferenceRecovery(x.recoveryFile);
    expect(ready.checkpoint).toBeDefined(); expect(ready.seed).toBeUndefined(); expect(ready.inheritedLogicalAttempts).toBe(21);
    const priorSnapshot = JSON.parse(readFileSync(path.join(x.checkpointDir, 'sealed.json'), 'utf8')).snapshot;
    expect(ready.externalMicroUsd).toBe(priorSnapshot.accountedMicroUsd + 3000);
    expect(await simpleBookReferenceRecoveryCLI(['--config', x.recoveryFile])).toBe(0);
    expect(sdk.create).not.toHaveBeenCalled(); expect(x.render).not.toHaveBeenCalled();
    sdk.create.mockImplementation(async p => {
      const raw = await x.normal(p), d = JSON.parse(p.input[0].content[0].text);
      if (d.context.role === 'entities' && d.candidateSha === x.atlasSha) {
        const out = JSON.parse(raw.output_text); out.checks[4].verdict = 'defect'; out.checks[4].correction = 'Synthetic missing required slat.';
        raw.output_text = JSON.stringify(out);
      }
      return raw;
    });
    expect(await simpleBookReferenceRecoveryCLI(['--config', x.recoveryFile, '--execute'])).toBe(0);
    expect(x.editor).not.toHaveBeenCalled(); expect(x.render).toHaveBeenCalledTimes(11); expect(x.fetcher).toHaveBeenCalledTimes(9);
    expect(x.render.mock.calls[0][0].referenceImages).toHaveLength(3);
    const calls = sdk.create.mock.calls.map(([p]) => p), contexts = calls.map(p => JSON.parse(p.input[0].content[0].text));
    expect(contexts.slice(0, 3).map(c => c.context.role)).toEqual(['entities', 'entities', 'locations']);
    expect(calls.slice(0, 3).every(p => p.instructions === REFERENCE_DESIGN_JUDGE_INSTRUCTION)).toBe(true);
    expect(calls.slice(3).every(p => p.instructions === PREVIEW_JUDGE_INSTRUCTION)).toBe(true);
    expect(contexts[0].imageRoles.slice(5)).toEqual(['canonical_child', 'canonical_companion']);
    expect(contexts[2].context.design.landmarks).toBeDefined();
    expect(referenceRoleContextSchema.safeParse({ ...contexts[0].context, role: 'skip_everything' }).success).toBe(false);
    const dir = path.join(x.old.directory, 'role-scoped-reference-continuation-20261008');
    expect(JSON.parse(readFileSync(path.join(dir, 'sealed.json'), 'utf8'))).toMatchObject({ status: 'illustrated_audition', inheritedLogicalAttempts: 21, bookPages: 9 });
    expect(existsSync(path.join(dir, 'paid-stages/reference_child.claim.json'))).toBe(false);
    expect(existsSync(path.join(dir, 'paid-stages/reference_child_repair.claim.json'))).toBe(false);
    expect(readFileSync(path.join(dir, 'book.html'), 'utf8').match(/<img /g)).toHaveLength(9);
    const requestId = ready.parent.job.queued.requestId;
    expect(await (await GET(req('GET', undefined, `${url}?requestId=${requestId}`))).json()).toMatchObject({ phase: 'illustrated_audition', imageScope: 'role_scoped_reference_continuation' });
    const response = await GET(req('GET', undefined, `${url}?requestId=${requestId}&page=8`));
    const manifest = JSON.parse(readFileSync(path.join(dir, 'illustrated_book.json'), 'utf8'));
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(sha(Buffer.from(await response.arrayBuffer()))).toBe(manifest.pages[8].candidate.imageSha);
    deps.user = { id: 'another-owner', email: 'owner@example.com' };
    expect((await GET(req('GET', undefined, `${url}?requestId=${requestId}&page=8`))).status).toBe(403);
    deps.user = { id: 'owner', email: 'owner@example.com' };
    for (const [n, h] of x.checkpointHashes) expect(sha(readFileSync(path.join(x.checkpointDir, n)))).toBe(h);
    for (const [n, h] of x.heldHashes) expect(sha(readFileSync(path.join(x.old.directory, n)))).toBe(h);
    await expect(prepareSimpleBookReferenceRecovery(x.recoveryFile).then(r => r.claim())).rejects.toThrow();
  }, 180000);
  it.each(['uncertain', 'repeated_defect', 'cancel_after_recheck', 'cancel_after_edit'])(
    'role checkpoint stops %s without another child, unbounded edits or book pages', async kind => {
      const x = await roleCheckpointFixture(); let queries = 0;
      sdk.create.mockImplementation(async p => {
        const raw = await x.normal(p), d = JSON.parse(p.input[0].content[0].text);
        if (d.context.role === 'entities') {
          queries++; const out = JSON.parse(raw.output_text); out.checks[3].verdict = kind === 'uncertain' ? 'uncertain' : 'defect';
          out.checks[3].correction = 'Synthetic required prop flaw.'; raw.output_text = JSON.stringify(out);
          if (kind === 'cancel_after_recheck') process.emit('SIGINT');
        }
        return raw;
      });
      if (kind === 'cancel_after_edit') { const normal = x.render.getMockImplementation()!; x.render.mockImplementation(async p => {
        const result = await normal(p); process.emit('SIGINT'); return result;
      }); }
      expect(await simpleBookReferenceRecoveryCLI(['--config', x.recoveryFile, '--execute'])).toBe(1);
      expect(x.editor).not.toHaveBeenCalled(); expect(x.fetcher).not.toHaveBeenCalled();
      expect(x.render).toHaveBeenCalledTimes(kind === 'uncertain' || kind === 'cancel_after_recheck' ? 0 : 1);
      expect(queries).toBe(kind === 'repeated_defect' ? 2 : 1);
      const dir = path.join(x.old.directory, 'role-scoped-reference-continuation-20261008');
      expect(existsSync(path.join(dir, 'book.html'))).toBe(false); expect(existsSync(path.join(dir, 'audition_references.json'))).toBe(false);
      expect(JSON.parse(readFileSync(path.join(dir, 'sealed.json'), 'utf8')).status).toBe('failed');
      for (const [n, h] of x.checkpointHashes) expect(sha(readFileSync(path.join(x.checkpointDir, n)))).toBe(h);
    }, 90000);
  it('role checkpoint rejects tampered pixels, journals, cost, inventory or permission before claim/key/provider', async () => {
    const x = await roleCheckpointFixture(), disk = vi.spyOn(journal, 'fencedText');
    const originals = x.checkpointNames.map(n => [n, readFileSync(path.join(x.checkpointDir, n))] as const);
    const baseline = readFileSync(x.recoveryFile), prior = readFileSync(x.data.checkpoint.config.file), terminal = readFileSync(x.data.checkpoint.terminationReceipt.file);
    const tech = readFileSync(x.data.technicalReviewReceipt.file);
    for (const kind of ['inventory', 'pixel', 'journal', 'unknown_cost', 'seal', 'termination', 'same_session', 'qa_base', 'parent', 'duplicate_fee', 'ceiling', 'missing_paid_root']) {
      originals.forEach(([n, b]) => writeFileSync(path.join(x.checkpointDir, n), b));
      writeFileSync(x.data.checkpoint.config.file, prior); writeFileSync(x.data.checkpoint.terminationReceipt.file, terminal); writeFileSync(x.data.technicalReviewReceipt.file, tech);
      const d = JSON.parse(baseline.toString()), change = (n: string, f: (v: any) => void) => { const p = path.join(x.checkpointDir, n), v = JSON.parse(readFileSync(p, 'utf8')); f(v); writeFileSync(p, JSON.stringify(v)); };
      if (kind === 'inventory') d.checkpoint.artifacts.pop();
      if (kind === 'pixel') writeFileSync(path.join(x.checkpointDir, 'illustrations/reference_child_repair.png'), 'SYNTHETIC invalid pixels');
      if (kind === 'journal') change('paid-stages/reference_child_qa.claim.json', v => { v.step = 'other'; });
      if (kind === 'unknown_cost') change('paid-stages/reference_entities_qa.result.json', v => { v.estimatedMicroUsd = null; });
      if (kind === 'seal') change('sealed.json', v => { v.code = 'other'; });
      if (kind === 'termination') { const v = JSON.parse(terminal.toString()); v.terminationConfirmed = false; writeFileSync(d.checkpoint.terminationReceipt.file, JSON.stringify(v)); }
      if (kind === 'same_session' || kind === 'qa_base') { const v = JSON.parse(tech.toString());
        if (kind === 'same_session') v.sessionId = '55555555-5555-4555-8555-555555555555'; else v.qaBase = 'b'.repeat(40); writeFileSync(d.technicalReviewReceipt.file, JSON.stringify(v)); }
      if (kind === 'parent') { const v = JSON.parse(prior.toString()); v.sourceHead = 'b'.repeat(40); writeFileSync(d.checkpoint.config.file, JSON.stringify(v)); }
      if (kind === 'duplicate_fee') d.extraEngineeringReceipts[1] = d.extraEngineeringReceipts[0];
      if (kind === 'ceiling') d.maximumMicroUsd = 15000000;
      if (kind === 'missing_paid_root') {
        const paidRoot = path.join(x.checkpointDir, 'paid-stages');
        if (!x.checkpointDir.startsWith(root + path.sep)) throw Error('fixture_boundary');
        renameSync(paidRoot, path.join(root, 'SYNTHETIC-moved-paid-journal'));
        d.checkpoint.artifacts = d.checkpoint.artifacts.filter((f: any) => !f.relative.startsWith('paid-stages/'));
      }
      d.checkpoint.artifacts = d.checkpoint.artifacts.map((f: any) => ({ ...f, sha256: sha(readFileSync(path.join(x.checkpointDir, f.relative))) }));
      d.checkpoint.config = x.ref(d.checkpoint.config.file); d.checkpoint.terminationReceipt = x.ref(d.checkpoint.terminationReceipt.file);
      d.technicalReviewReceipt = x.ref(d.technicalReviewReceipt.file); d.extraEngineeringReceipts[2] = d.technicalReviewReceipt;
      writeFileSync(x.recoveryFile, JSON.stringify(d));
      await expect(prepareSimpleBookReferenceRecovery(x.recoveryFile), kind).rejects.toThrow();
      expect(sdk.create).not.toHaveBeenCalled(); expect(x.render).not.toHaveBeenCalled(); expect(x.editor).not.toHaveBeenCalled();
      expect(disk.mock.calls.some(([p]) => p === config.existingKeyEnvFile)).toBe(false);
      expect(existsSync(path.join(x.old.directory, 'role-scoped-reference-continuation-20261008'))).toBe(false);
      if (kind === 'missing_paid_root') expect(existsSync(path.join(x.checkpointDir, 'paid-stages'))).toBe(false);
    }
  }, 90000);
  it('v2 same-book grant counts the cumulative native session once, publishes14 and completes9 without a new writer', async () => {
    const x = await extendedRecoveryFixture(), ready = await prepareSimpleBookReferenceRecovery(x.recoveryFile);
    expect(ready.extra).toBe(43000); expect(ready.externalMicroUsd).toBe(ready.inherited.knownEstimateMicroUsd + 43000);
    expect(ready.config.maximumMicroUsd).toBe(14000000); expect(sdk.create).not.toHaveBeenCalled();
    const receiptBefore = readFileSync(x.data.technicalReviewReceipt.file), grantBefore = readFileSync(x.grantFile);
    expect(await simpleBookReferenceRecoveryCLI(['--config', x.recoveryFile, '--execute'])).toBe(0);
    expect(x.editor).not.toHaveBeenCalled(); expect(x.render).toHaveBeenCalledTimes(12); expect(x.fetcher).toHaveBeenCalledTimes(9);
    const dir = path.join(x.old.directory, 'controlled-reference-recovery-20261008');
    expect(JSON.parse(readFileSync(path.join(dir, 'claim.json'), 'utf8'))).toMatchObject({ maximumMicroUsd: 14000000, extra: 43000, referenceCorrectionLimit: 1 });
    const requestId = ready.parent.job.queued.requestId, response = await GET(req('GET', undefined, `${url}?requestId=${requestId}`));
    expect(await response.json()).toMatchObject({ phase: 'illustrated_audition', accounting: { allowanceMicroUsd: 14000000, unknownAttemptCosts: 0 } });
    expect(readFileSync(x.data.technicalReviewReceipt.file)).toEqual(receiptBefore); expect(readFileSync(x.grantFile)).toEqual(grantBefore);
    for (const [n, hash] of x.heldHashes) expect(sha(readFileSync(path.join(x.old.directory, n)))).toBe(hash);
  }, 180000);
  it('v2 refuses every stale/foreign/missing/cost-confused grant before claim/key/dispatch; v1 never grants14', async () => {
    const x = await extendedRecoveryFixture(), disk = vi.spyOn(journal, 'fencedText');
    const baseline = readFileSync(x.recoveryFile), baselineGrant = readFileSync(x.grantFile), paths = [...x.lineage, x.data.technicalReviewReceipt].map(f => f.file);
    const priorBytes = paths.map(p => readFileSync(p));
    const sync = () => { x.data.allowanceGrant = x.ref(x.grantFile); x.data.technicalReviewReceipt = x.ref(paths[3]);
      x.data.extraEngineeringReceipts = [x.ref(paths[2]), x.data.technicalReviewReceipt]; writeFileSync(x.recoveryFile, JSON.stringify(x.data)); };
    for (const kind of ['request', 'parent', 'inherited', 'grant_cost', 'missing_lineage', 'foreign_session', 'unknown_cost', 'unterminated',
      'failed_final', 'qa_hold', 'wrong_base', 'same_session', 'duplicate_cumulative', 'wrong_ceiling', 'missing_grant', 'v1_14']) {
      x.data = JSON.parse(baseline.toString()); const g = JSON.parse(baselineGrant.toString()); paths.forEach((p, i) => writeFileSync(p, priorBytes[i]));
      if (kind === 'request') g.requestId = 'b'.repeat(64); if (kind === 'parent') g.parentVisualConfigSha256 = 'b'.repeat(64);
      if (kind === 'inherited') g.inheritedKnownMicroUsd++; if (kind === 'grant_cost') g.reconciledMicroUsd++;
      if (kind === 'missing_lineage') g.reconciledSessionReceipts.pop();
      if (['foreign_session', 'unknown_cost', 'unterminated', 'failed_final'].includes(kind)) {
        const r = JSON.parse(priorBytes[2].toString()); if (kind === 'foreign_session') r.sessionId = '66666666-6666-4666-8666-666666666666';
        if (kind === 'unknown_cost') r.reportedCostUsd = null; if (kind === 'unterminated') r.terminationConfirmed = false; if (kind === 'failed_final') r.code = 1;
        writeFileSync(paths[2], JSON.stringify(r)); g.reconciledSessionReceipts[2] = x.ref(paths[2]);
      }
      if (['qa_hold', 'wrong_base', 'same_session'].includes(kind)) { const r = JSON.parse(priorBytes[3].toString());
        if (kind === 'qa_hold') r.qaVerdict = 'HOLD'; if (kind === 'wrong_base') r.qaBase = 'b'.repeat(40); if (kind === 'same_session') r.sessionId = JSON.parse(priorBytes[2].toString()).sessionId;
        writeFileSync(paths[3], JSON.stringify(r)); }
      writeFileSync(x.grantFile, JSON.stringify(g)); sync();
      if (kind === 'duplicate_cumulative') x.data.extraEngineeringReceipts = [x.ref(paths[0]), x.ref(paths[2]), x.data.technicalReviewReceipt];
      if (kind === 'wrong_ceiling') x.data.maximumMicroUsd = 25000000;
      if (kind === 'missing_grant') delete x.data.allowanceGrant;
      if (kind === 'v1_14') { x.data.version = 'controlled-simple-reference-recovery/v1'; delete x.data.allowanceGrant; }
      writeFileSync(x.recoveryFile, JSON.stringify(x.data));
      await expect(prepareSimpleBookReferenceRecovery(x.recoveryFile), kind).rejects.toThrow();
      expect(existsSync(path.join(x.old.directory, 'controlled-reference-recovery-20261008')), kind).toBe(false);
    }
    expect(sdk.create).not.toHaveBeenCalled(); expect(x.render).not.toHaveBeenCalled(); expect(x.editor).not.toHaveBeenCalled();
    expect(disk.mock.calls.some(([p]) => p === config.existingKeyEnvFile)).toBe(false);
    expect(referenceRecoveryConfigSchema.safeParse({ ...x.recoveryData, maximumMicroUsd: 14000000 }).success).toBe(false);
  }, 180000);
  it('reference recovery previews without keys and performs exactly one edit then the same9 private frames, no planning/writing', async () => {
    const x = await referenceRecoveryFixture(), disk = vi.spyOn(journal, 'fencedText');
    expect(await simpleBookReferenceRecoveryCLI(['--config', x.recoveryFile])).toBe(0);
    expect(sdk.create).not.toHaveBeenCalled(); expect(x.render).not.toHaveBeenCalled();
    expect(disk.mock.calls.some(([p]) => p === config.existingKeyEnvFile)).toBe(false);
    const ready = await prepareSimpleBookReferenceRecovery(x.recoveryFile);
    expect(ready.inherited.logicalAttempts).toBe(5); expect(ready.externalMicroUsd).toBe(ready.inherited.knownEstimateMicroUsd + 1000);
    expect(await simpleBookReferenceRecoveryCLI(['--config', x.recoveryFile, '--execute'])).toBe(0);
    expect(x.editor).not.toHaveBeenCalled(); expect(x.render).toHaveBeenCalledTimes(12); expect(x.fetcher).toHaveBeenCalledTimes(9);
    expect(sdk.create).toHaveBeenCalledTimes(12); expect(sdk.create.mock.calls.every(([p]) => p.model === 'gpt-6.1-sol' && Array.isArray(p.input))).toBe(true);
    const first = x.render.mock.calls[0][0]; expect(first.requireReferenceEdit).toBe(true); expect(first.exactReferenceBytes).toHaveLength(1);
    expect(sha(first.exactReferenceBytes![0])).toBe(ready.seed!.imageSha); expect(first.finalPrompt).toContain('REJECTED edit target');
    expect(first.finalPrompt).toContain('Do not mirror');
    const dir = path.join(x.old.directory, 'controlled-reference-recovery-20261008'), manifest = JSON.parse(readFileSync(path.join(dir, 'illustrated_book.json'), 'utf8'));
    expect(manifest.manuscript).toEqual(ready.result.source.manuscript);
    const refs = JSON.parse(readFileSync(path.join(dir, 'audition_references.json'), 'utf8')).canonical;
    expect(refs[0].imageName).toBe('reference_child_repair.png'); expect(refs[0].imageSha).not.toBe(ready.seed!.imageSha);
    expect(refs.some((r: any) => r.imageSha === ready.seed!.imageSha)).toBe(false);
    expect(readFileSync(path.join(dir, 'book.html'), 'utf8').match(/<img /g)).toHaveLength(9);
    const requestId = ready.parent.job.queued.requestId;
    expect(await (await GET(req('GET', undefined, `${url}?requestId=${requestId}`))).json()).toMatchObject({ phase: 'illustrated_audition', imageScope: 'owned_reference_recovery' });
    const img = await GET(req('GET', undefined, `${url}?requestId=${requestId}&page=8`)); expect(img.status).toBe(200);
    expect(sha(Buffer.from(await img.arrayBuffer()))).toBe(manifest.pages[8].candidate.imageSha);
    await expect(simpleBookReferenceRecoveryCLI(['--config', x.recoveryFile, '--execute'])).rejects.toThrow();
    for (const [n, hash] of [...x.oldHashes, ...x.heldHashes]) expect(sha(readFileSync(path.join(x.old.directory, n)))).toBe(hash);
  }, 180000); // Two durable historical fixtures plus all nine PNG/QA/identity stages; no network.
  it.each(['source', 'hash', 'inventory', 'termination', 'technical_hold', 'unknown', 'false_hold', 'seed', 'board', 'budget'])(
    'reference recovery refuses %s before a claim, key or paid call', async kind => {
      const x = await referenceRecoveryFixture(), disk = vi.spyOn(journal, 'fencedText');
      const rewrite = (relative: string, change: (v: any) => void) => { const p = path.join(x.old.directory, relative), v = JSON.parse(readFileSync(p, 'utf8'));
        change(v); writeFileSync(p, JSON.stringify(v)); x.recoveryData.artifacts.find(a => a.relative === relative)!.sha256 = sha(readFileSync(p)); };
      if (kind === 'source') x.recoveryData.sourceHead = 'b'.repeat(40);
      if (kind === 'hash') x.recoveryData.artifacts[0].sha256 = 'b'.repeat(64);
      if (kind === 'inventory') x.recoveryData.artifacts = x.recoveryData.artifacts.filter(a => !a.relative.endsWith('reference_child_qa.wire.json'));
      if (kind === 'termination') { const p = x.recoveryData.terminationReceipt.file; writeFileSync(p, JSON.stringify({ terminationConfirmed: false })); x.recoveryData.terminationReceipt.sha256 = sha(readFileSync(p)); }
      if (kind === 'technical_hold') { const p = x.recoveryData.technicalReviewReceipt.file, v = JSON.parse(readFileSync(p, 'utf8')); v.qaVerdict = 'HOLD'; writeFileSync(p, JSON.stringify(v));
        x.recoveryData.technicalReviewReceipt.sha256 = sha(readFileSync(p)); x.recoveryData.extraEngineeringReceipts[0] = x.recoveryData.technicalReviewReceipt; }
      if (kind === 'unknown') rewrite('controlled-visual-continuation-20261008/paid-stages/reference_child_qa.result.json', v => { v.estimatedMicroUsd = null; });
      if (kind === 'false_hold') rewrite('controlled-visual-continuation-20261008/sealed.json', v => { v.code = 'wrong_hold'; });
      if (kind === 'seed') rewrite('controlled-visual-continuation-20261008/reference_child_review.json', v => { v.review.candidateSha = 'b'.repeat(64); });
      if (kind === 'board') rewrite('controlled-visual-continuation-20261008/visual_simple_book_result.json', v => { v.source.manuscript.pages[0].text += ' forgery'; });
      if (kind === 'budget') x.recoveryData.maximumMicroUsd = 25000000;
      writeFileSync(x.recoveryFile, JSON.stringify(x.recoveryData));
      await expect(prepareSimpleBookReferenceRecovery(x.recoveryFile)).rejects.toThrow();
      expect(existsSync(path.join(x.old.directory, 'controlled-reference-recovery-20261008'))).toBe(false);
      expect(sdk.create).not.toHaveBeenCalled(); expect(x.render).not.toHaveBeenCalled(); expect(x.editor).not.toHaveBeenCalled();
      expect(disk.mock.calls.some(([p]) => p === config.existingKeyEnvFile)).toBe(false);
    }, 60000);
  it.each(['repeat_defect', 'uncertain', 'unknown', 'cancelled', 'unchanged'])(
    'one reference edit then %s stops, with no second edit, atlas or page', async kind => {
      const x = await referenceRecoveryFixture(), normal = sdk.create.getMockImplementation()!;
      sdk.create.mockImplementation(async p => { const r = await normal(p), v = JSON.parse(r.output_text);
        if (kind === 'repeat_defect' || kind === 'uncertain') { v.checks[1].verdict = kind === 'uncertain' ? 'uncertain' : 'defect'; v.checks[1].correction = 'Synthetic repeated finding.'; }
        if (kind === 'unknown') delete (r as any).usage; if (kind === 'cancelled') process.emit('SIGINT');
        return { ...r, output_text: JSON.stringify(v) }; });
      if (kind === 'unchanged') x.render.mockImplementation(async input => { const ready = await prepareSimpleBookReferenceRecovery(x.recoveryFile);
        const usage = { input_tokens: 100, output_tokens: 100 }, raw = { data: [{ b64_json: ready.seed!.bytes.toString('base64') }], usage }; input.observeProviderResponse?.(raw);
        return { buffer: ready.seed!.bytes, usage, model: 'gpt-image-2', finalPrompt: input.finalPrompt, hasReferencePhoto: true,
          apiMode: 'images.edit', referenceCountRequested: 1, referenceCountPassed: 1, durationMs: 1, fallbackUsed: false }; });
      expect(await simpleBookReferenceRecoveryCLI(['--config', x.recoveryFile, '--execute'])).toBe(1);
      expect(x.render).toHaveBeenCalledTimes(1); expect(x.fetcher).not.toHaveBeenCalled(); expect(x.editor).not.toHaveBeenCalled();
      expect(sdk.create).toHaveBeenCalledTimes(kind === 'unchanged' ? 0 : 1);
      const dir = path.join(x.old.directory, 'controlled-reference-recovery-20261008'); expect(existsSync(path.join(dir, 'book.html'))).toBe(false);
      expect(existsSync(path.join(dir, 'audition_references.json'))).toBe(false);
      const seal = JSON.parse(readFileSync(path.join(dir, 'sealed.json'), 'utf8')); expect(seal.status).toBe('failed');
      if (kind === 'unknown') expect(seal.snapshot).toMatchObject({ unknownAttemptCosts: 1, stopped: true });
      if (kind === 'cancelled') expect(seal.code).toBe('reference_recovery_cancelled');
      if (kind === 'unchanged') expect(seal.code).toBe('simple_reference_recovery_unchanged');
      for (const [n, hash] of x.heldHashes) expect(sha(readFileSync(path.join(x.old.directory, n)))).toBe(hash);
    }, 60000);
  it('runs the actual visual-only path through Sol control and all9 images without a writer, preserving geometry/evidence and private serving', async () => {
    const x = await visualTransportFixture();
    expect(await simpleBookVisualContinuationCLI(['--config', x.visualFile, '--execute'])).toBe(0);
    expect(x.editor).not.toHaveBeenCalled(); expect(x.render).toHaveBeenCalledTimes(12); expect(x.fetcher).toHaveBeenCalledTimes(9);
    expect(sdk.create).toHaveBeenCalledTimes(15); // appearance +whole-board review +control +12 reference/page pixel calls
    expect(sdk.create.mock.calls[0][0].model).toBe('gpt-6-astra');
    expect(sdk.create.mock.calls.slice(1).every(([p]) => p.model === 'gpt-6.1-sol')).toBe(true);
    const dir = path.join(x.old.directory, 'controlled-visual-continuation-20261008');
    const oldResult = JSON.parse(readFileSync(path.join(x.old.directory, 'repair-simple-book-result.json'), 'utf8'));
    const next = JSON.parse(readFileSync(path.join(dir, 'visual_simple_book_result.json'), 'utf8'));
    expect(next.source).toEqual(oldResult.source); expect(next.readings).toEqual(oldResult.readings);
    expect(next.storyboard.storyboard.sourceDigest).not.toBe(oldResult.storyboard.storyboard.sourceDigest);
    for (const field of ['locations', 'recurringProps', 'pages', 'continuity']) expect(next.storyboard.storyboard.plan[field]).toEqual(oldResult.storyboard.storyboard.plan[field]);
    expect(next.storyboard.storyboard.sequence.pages).toEqual(oldResult.storyboard.storyboard.sequence.pages);
    expect(next.storyboard.storyboard.plan.actorAppearance).toEqual(x.ownership);
    expect(next.storyboard.calls).toHaveLength(1);
    expect(next.storyboard.calls[0]).toMatchObject({ stage: 'review', input: sdk.create.mock.calls[1][0].input,
      context: { sourceDigest: next.storyboard.sourceDigest, storyboardDigest: next.storyboard.storyboardDigest, actorOwnedAppearance: true } });
    expect(JSON.parse(readFileSync(path.join(dir, 'sealed.json'), 'utf8'))).toMatchObject({ status: 'illustrated_audition', bookPages: 9, inheritedLogicalAttempts: 12, runtimeEligible: false });
    const imageWire = JSON.parse(readFileSync(path.join(dir, 'paid-stages/page_8_0.wire.json'), 'utf8'));
    expect(imageWire).toMatchObject({ outputReservationTokens: 8192, body: { model: 'gpt-image-2', quality: 'low', size: '1024x1024', n: 1 } });
    expect(JSON.parse(readFileSync(path.join(dir, 'paid-stages/page_8_0.claim.json'), 'utf8')).maximumMicroUsd)
      .toBe(Buffer.byteLength(imageWire.body.prompt, 'utf8') * 8 + imageWire.references.length * 8192 * 8 + 8192 * 30);
    expect(readFileSync(path.join(dir, 'book.html'), 'utf8').match(/<img /g)).toHaveLength(9);
    const requestId = oldResult.source.requestId, view = await GET(req('GET', undefined, `${url}?requestId=${requestId}`));
    expect(view.status).toBe(200); expect(await view.json()).toMatchObject({ phase: 'illustrated_audition', imageScope: 'owned_visual_continuation', visualReviewModel: 'gpt-6.1-sol' });
    const image = await GET(req('GET', undefined, `${url}?requestId=${requestId}&page=8`)); expect(image.status).toBe(200); expect(image.headers.get('content-type')).toBe('image/png');
    await expect(simpleBookVisualContinuationCLI(['--config', x.visualFile, '--execute'])).rejects.toThrow();
    for (const [n, hash] of x.oldHashes) expect(sha(readFileSync(path.join(x.old.directory, n)))).toBe(hash);
  }, 60000);
  it.each(['uncertain_appearance', 'board_hold', 'control_miss', 'unknown_cost', 'wrong_model', 'cancelled'])(
    'visual-only %s stops before new images, never falls back or rewrites source', async kind => {
      const x = await visualTransportFixture(), normal = sdk.create.getMockImplementation()!;
      sdk.create.mockImplementation(async p => {
        const raw = await normal(p), out = JSON.parse(raw.output_text);
        if (kind === 'uncertain_appearance' && p.text.format.name === 'owned_actor_appearance') { out.disposition = 'uncertain'; out.actorAppearance = null; }
        if (kind === 'board_hold' && p.text.format.name === 'personal_book_review') out.bookChecks.approved_facts.verdict = 'uncertain';
        if (kind === 'control_miss' && Array.isArray(p.input)) out.checks[1] = { ...out.checks[1], verdict: 'pass', correction: '' };
        if (kind === 'unknown_cost') delete (raw as any).usage;
        if (kind === 'wrong_model') raw.model = 'gpt-6-astra-unapproved';
        if (kind === 'cancelled') process.emit('SIGINT');
        return { ...raw, output_text: JSON.stringify(out) };
      });
      expect(await simpleBookVisualContinuationCLI(['--config', x.visualFile, '--execute'])).toBe(1);
      expect(x.editor).not.toHaveBeenCalled(); expect(x.render).not.toHaveBeenCalled(); expect(x.fetcher).not.toHaveBeenCalled();
      const seal = JSON.parse(readFileSync(path.join(x.old.directory, 'controlled-visual-continuation-20261008/sealed.json'), 'utf8'));
      expect(seal.status).toBe('failed'); if (kind === 'unknown_cost' || kind === 'wrong_model') expect(seal.snapshot).toMatchObject({ unknownAttemptCosts: 1, stopped: true });
      if (kind === 'cancelled') expect(seal.code).toBe('visual_cancelled');
      for (const [n, hash] of x.oldHashes) expect(sha(readFileSync(path.join(x.old.directory, n)))).toBe(hash);
    }, 60000);
  it.each(['dimensions', 'model'])('an unexpected owned image %s is not adopted and prevents later frames', async kind => {
    const x = await visualTransportFixture(), normal = x.render.getMockImplementation()!;
    x.render.mockImplementation(async input => {
      const out = await normal(input);
      if (kind === 'model') return { ...out, model: 'gpt-image-1', fallbackUsed: true };
      return { ...out, buffer: await sharp({ create: { width: 64, height: 64, channels: 3, background: 'white' } }).png().toBuffer() };
    });
    expect(await simpleBookVisualContinuationCLI(['--config', x.visualFile, '--execute'])).toBe(1);
    expect(x.editor).not.toHaveBeenCalled(); expect(x.render).toHaveBeenCalledTimes(1); expect(x.fetcher).not.toHaveBeenCalled();
    const dir = path.join(x.old.directory, 'controlled-visual-continuation-20261008');
    expect(existsSync(path.join(dir, 'illustrations/reference_child.png'))).toBe(false);
    expect(existsSync(path.join(dir, 'book.html'))).toBe(false);
    const seal = JSON.parse(readFileSync(path.join(dir, 'sealed.json'), 'utf8'));
    expect(seal.snapshot.stopped).toBe(true); expect(seal.snapshot.unknownAttemptCosts).toBe(kind === 'model' ? 1 : 0);
  }, 60000);
  it.each(['continuation', 'repair'] as const)('does not change QA policy through historical %s worker entry', async kind => {
    const x = await fixture(), forbidden = vi.fn();
    await expect(runSimpleBookWorkerPipeline({ config: { ...config, reviewModel: 'gpt-6.1-sol' }, configFile: file, cliWorkspace: root,
      worker: {} as any, [kind]: { budget: {} as any, inheritedAttempts: 0, assertCurrent: forbidden, reuseWriting: forbidden, prior: {}, readings: [] } } as any))
      .rejects.toThrow('simple_historical_resumption_policy');
    expect(forbidden).not.toHaveBeenCalled(); expect(x.args.opus).not.toHaveBeenCalled(); expect(sdk.create).not.toHaveBeenCalled();
  });
  it('rejects invalid repair CLI arguments at the real bootstrap without opening any book or credential', () => {
    const result = spawnSync(process.execPath, ['scripts/personal-simple-book-repair.cjs', '--execute'],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 15000, windowsHide: true });
    expect(result.status).toBe(1); expect(result.signal).toBeNull(); expect(result.error).toBeUndefined();
    expect(result.stderr.trim()).toBe(JSON.stringify({ error: 'repair_failed', runtimeEligible: false }));
    expect(result.stdout).toBe('');
  }, 20000);
  it('rejects invalid visual CLI arguments at its real bootstrap without a book, key or provider', () => {
    const result = spawnSync(process.execPath, ['scripts/personal-simple-book-visual-continuation.cjs', '--execute'],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 15000, windowsHide: true });
    expect(result.status).toBe(1); expect(result.signal).toBeNull(); expect(result.error).toBeUndefined();
    expect(result.stderr.trim()).toBe(JSON.stringify({ error: 'visual_arguments', runtimeEligible: false }));
    expect(result.stdout).toBe(''); expect(sdk.create).not.toHaveBeenCalled();
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
