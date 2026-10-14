import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
const sdk = vi.hoisted(() => ({ create: vi.fn(), clients: [] as Record<string, unknown>[] }));
vi.mock('openai', () => ({ default: class { responses = { create: sdk.create }; constructor(options: Record<string, unknown> = {}) { sdk.clients.push(options); } } }));
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { providerStoryboard, providerReview, withKind } from './storyboard-replan-fixture';
import { STORYBOARD_MOMENTS_VERSION } from '../storyboard-moments';
import { SCENE_LOCATION_CONTRACT_VERSION, SCENE_LOCATION_STORYBOARD_ADDENDUM } from '../storyboard-scene-location';
import { COMPILER_RULES_CONTRACT_VERSION, COMPILER_RULES_STORYBOARD_ADDENDUM } from '../storyboard-compiler-rules';
import type { SimpleStoryDraft } from '../simple-story-engine';
import { QUALITY_CATEGORIES } from '../../local-preview-quality';
import { canonicalJson } from '../request-acceptance';
import { z } from 'zod';
import * as frozen from '../../../scripts/personal-source-git';
import * as images from '../../generate-image';
import * as causalAdapters from '../../../scripts/personal-causal-trial-adapters';
import * as flow from '../simple-book-flow';
import * as worker from '../../../scripts/personal-simple-wizard-worker';
import * as storyboardModule from '../storyboard';
import { REFERENCE_REPAIR_EDIT_INSTRUCTION, simpleReferenceDesignContext } from '../simple-book-illustrations';
import { createSimpleBookPixelJudge } from '../../../scripts/personal-simple-book-illustrator';
import { readAuditionGrant, loadReviewedBook, loadReviewedStoryboard, dryRun, readReviewedBookLayout, auditionGrantSchema, runReviewedAudition, savedMomentContract, AuditionMeter, auditionAdapters }
  from '../../../scripts/personal-simple-book-reviewed-audition';
import { NEW_BOOK_EXPERIMENT, newBookConfig, newBookExperimentCLI, runNewBookText, runNewBookChild, runNewBookAudition, writeNewBookGrant, experimentDir, experimentClaimFile, assertExperimentClaim,
  experimentLayout, earliestSameScenePair, stageLedger, NEW_BOOK_CONTINUATION, experimentContinuationFile, NEW_BOOK_CONTINUATION_2, experimentContinuation2File,
  NEW_BOOK_CONTINUATION_3, experimentContinuation3File, stageRules, replaySettlement, experimentAuditionStart,
  type NewBookConfig, type TextTransports, type ChildAdapters }
  from '../../../scripts/personal-new-book-experiment';

const sha = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
const json = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const roots: string[] = [];
/**
 * One real event-loop turn. These rehearsals use synchronous files and instantly-resolving synthetic providers, so a long sequence never lets
 * the worker read vitest's own progress replies: past its 60 s RPC timeout that surfaces as an unhandled 'Timeout calling onTaskUpdate'
 * (measured: one 76 s stretch without a timer turn). It changes no assertion.
 */
const eventLoopTurn = () => new Promise<void>(resolve => setImmediate(resolve));
let root: string, config: NewBookConfig, file: string, f: Awaited<ReturnType<typeof personalStoryboardFixture>>;
beforeEach(async () => {
  sdk.create.mockReset(); sdk.clients.length = 0;
  // No real network: any global fetch fails the test.
  vi.stubGlobal('fetch', vi.fn(() => { throw Error('no network in the experiment rehearsal'); }));
  root = mkdtempSync(path.join(tmpdir(), 'sh_new_book_test_')); roots.push(root);
  mkdirSync(path.join(root, 'git-common')); mkdirSync(path.join(root, 'renders'));
  const executable = path.join(root, 'SYNTHETIC-claude.exe'); writeFileSync(executable, 'synthetic executable, never spawned');
  const keyEnvFile = path.join(root, 'SYNTHETIC.env'); writeFileSync(keyEnvFile, 'OPENAI_API_KEY=sk-synthetic-test-value-not-a-credential-000\n');
  f = await personalStoryboardFixture();
  config = { version: 'new-book-experiment-config/v1', experiment: NEW_BOOK_EXPERIMENT.slot, workspace: process.cwd(), parent: path.join(root, 'renders'),
    sourceHead: 'a'.repeat(40), executable, executableSha256: sha(readFileSync(executable)), keyEnvFile, seed: 'test-book-seed',
    childDesign: 'A new fictional five-year-old boy with short dark-brown hair and dark brown eyes. Match the exact wardrobe specified by the whole-book plan.',
    // The approved experiment excludes Dini: the fixture book runs with another registry companion, as the real config does.
    request: { ...structuredClone(f.request), companion: { id: 'fox_uri' } } };
  file = path.join(root, 'config.json'); writeFileSync(file, JSON.stringify(config));
  vi.spyOn(frozen, 'gitAt').mockImplementation((_repo, args) => Buffer.from(args.join(' ') === 'rev-parse HEAD' ? 'a'.repeat(40)
    : args.join(' ') === 'status --porcelain' ? '' : path.join(root, 'git-common')));
});
afterEach(async () => {
  await eventLoopTurn();
  vi.restoreAllMocks(); vi.unstubAllGlobals();
  for (const directory of roots.splice(0)) {
    if (path.dirname(directory) !== tmpdir() || !path.basename(directory).startsWith('sh_new_book_test_')) throw Error('cleanup_boundary');
    rmSync(directory, { recursive: true, force: true });
  }
});

/** The experiment's real storyboard contracts in provider shape: declared landmark kind and a (trivial) drawn-instant record per frame. */
const contractedStoryboard = (owned: any) => ({ ...providerStoryboard(withKind(owned)),
  moments: { version: STORYBOARD_MOMENTS_VERSION, frames: owned.plan.pages.map(() => ({ requirements: [], depicted: null })) } });
/** The fixture plans page 4 in the lane (every other page in the garden): keeping page 3's scene on page 4 is the real run's refusal. */
const driftingStoryboard = (owned: any) => { const s = contractedStoryboard(owned) as any;
  s.sequence.pages[3] = { ...s.sequence.pages[3], sceneId: s.sequence.pages[2].sceneId, sceneChangeEvidence: null, transitions: [] }; return s; };
/** The second attempt's real refusal: page 7 lists a prop (enclosure_gate) that was never declared among the recurring props. */
const undeclaredPropStoryboard = (owned: any) => { const s = contractedStoryboard(owned) as any;
  s.plan.pages[7].props = [...s.plan.pages[7].props, { id: 'enclosure_gate', state: 'closed' }]; return s; };
/** A refusal by another sequence check: page 4's scene-change evidence is not in its text. */
const otherRefusalStoryboard = (owned: any) => { const s = contractedStoryboard(owned) as any;
  s.sequence.pages[3] = { ...s.sequence.pages[3], sceneChangeEvidence: 'words that are not on this page' }; return s; };
/** Synthetic transports at the provider boundary: the experiment's own meters, receipts, decoding and files run for real. */
function textTransports(opts: { storyboardOutput?: (draft: any) => unknown; readerFindings?: unknown[]; model?: string } = {}) {
  // The fixture book's companion is Dini; this experiment excludes Dini, so the same synthetic book is told with the fox Uri throughout
  // (text, storyboard and review, so every quoted evidence string still matches).
  const fox = <T>(value: T): T => JSON.parse(JSON.stringify(value).replace(/דיני/g, 'אורי'));
  const plan = fox(f.result.plan), review = fox(f.review);
  const story: SimpleStoryDraft = { title: plan.title, childGoal: plan.childGoal, companionWant: plan.companionWant, comicPromise: plan.comicPromise,
    ending: plan.ending, pages: fox(f.result.manuscript.pages).map(p => ({ text: p.text + ' נועה ואורי משחקים בציור.' })),
    pageMap: plan.beats.map(({ pageNumber: _n, ...b }) => b),
    resilienceMoments: plan.resilience.moments.map(({ pageNumber, ...m }) => ({ page: pageNumber, ...m })) };
  const owned = fox(structuredClone(f.draft)) as any;
  delete owned.plan.wardrobe;
  owned.plan.actorAppearance = { child: { role: 'child', clothing: ['red shirt', 'blue shorts', 'teal shoes'] }, companion: { role: 'companion', authority: 'companionVisualAuthority' } };
  const opus = vi.fn(async (_wire: any, call: any) => {
    const output = call.stage === 'author' ? structuredClone(story) : { ...structuredClone(story), editorChanges: ['Synthetic only.'] };
    const usage = { inputTokens: 100, outputTokens: 100 }, termination = { code: 0, signal: null };
    return { output, usage, estimatedMicroUsd: 230000, metadata: { kind: 'cli_reported_estimate_not_invoice', reportedModels: ['claude-opus-5-5'], termination },
      raw: { termination, killConfirmed: true, stopped: false, stdout: JSON.stringify({ type: 'result', subtype: 'success', is_error: false,
        session_id: call.stage === 'author' ? '11111111-1111-4111-8111-111111111111' : '22222222-2222-4222-8222-222222222222',
        total_cost_usd: .23, modelUsage: { 'claude-opus-5-5': usage }, structured_output: output }) } };
  });
  const reader = vi.fn(async (wire: any, call: any) => {
    const output = { packetDigest: JSON.parse(call.input).packetDigest, summary: 'Synthetic complete reading, no product acceptance.', findings: opts.readerFindings ?? [] };
    // A provider-shaped answer, which the reader transport's rule settles to the recorded cost (Sol: 1,000 x 2 + 500 x 10).
    const raw = { model: wire.model, service_tier: 'default', status: 'completed', output_text: JSON.stringify(output), usage: { input_tokens: 1000, output_tokens: 500 } };
    return { output, usage: { inputTokens: 1000, outputTokens: 500 }, estimatedMicroUsd: 7000, metadata: {}, raw };
  });
  const responses = vi.fn(async (payload: any) => ({ model: opts.model ?? payload.model, service_tier: 'default', status: 'completed',
    usage: { input_tokens: 10000, output_tokens: 5000 },
    output_text: JSON.stringify(payload.model === 'gpt-6-astra' ? (opts.storyboardOutput ?? contractedStoryboard)(owned) : providerReview(review)) }) as any);
  return { opus, reader, responses } satisfies TextTransports;
}
/** Rewrites a paid call's saved request together with its claim's and result's digests, so the record still binds itself; returns a restore. */
function rewire(root: string, step: string, change: (wire: any) => any) {
  const at = (k: string) => path.join(root, `${step}.${k}.json`), saved = ['wire', 'claim', 'result'].map(k => readFileSync(at(k)));
  const wire = change(json(at('wire'))), wireDigest = sha(canonicalJson(wire));
  writeFileSync(at('wire'), JSON.stringify(wire));
  for (const k of ['claim', 'result']) writeFileSync(at(k), JSON.stringify({ ...json(at(k)), wireDigest }));
  return () => ['wire', 'claim', 'result'].forEach((k, i) => writeFileSync(at(k), saved[i]));
}
/** One same-length edit (so a request's byte count, and so its reservation, is unchanged). */
const swapOne = (text: string) => { if (!text.includes('a')) throw Error('swap_source'); return text.replace('a', 'b'); };
const png = (shade: number, size = 64) => sharp({ create: { width: size, height: size, channels: 3, background: { r: shade, g: 60, b: 90 } } }).png().toBuffer();
const passing = (candidateSha: string, contextSha: string, defect?: { category: string; verdict: 'defect' | 'uncertain' }) => ({ candidateSha, contextSha,
  checks: QUALITY_CATEGORIES.map(category => category === defect?.category
    ? { category, verdict: defect.verdict, observation: `${category} observed`, correction: defect.verdict === 'defect' ? `fix ${category}` : '' }
    : { category, verdict: 'pass', observation: `${category} ok`, correction: '' }) });
/** Synthetic child adapters that write real image files; `verdicts` decides each judgment in order. */
function childAdapters(verdicts: (undefined | { category: string; verdict: 'defect' | 'uncertain' })[] = [undefined]) {
  let shade = 10, judged = 0;
  const dir = path.join(experimentDir(config), 'child', 'illustrations');
  const render = vi.fn(async (step: string, _prompt: string, _refs: unknown[], _mode: string) => {
    const bytes = await png(shade++); writeFileSync(path.join(dir, `${step}.png`), bytes, { flag: 'wx' });
    return { imageName: `${step}.png`, imageSha: sha(bytes) };
  });
  const judge = vi.fn(async (_step: string, candidate: { imageSha: string }, _context: unknown, contextSha: string) =>
    passing(candidate.imageSha, contextSha, verdicts[judged++]));
  return { render, judge } satisfies ChildAdapters;
}
/** The real text stage (the experiment's own contracts), over synthetic provider transports. */
const run = (transports: TextTransports = textTransports()) => newBookExperimentCLI(['--config', file, 'text', '--execute'], { text: transports, log: () => {} })
  .then(r => r as Extract<typeof r, { mode: 'text' }>);
const claims = (dir: string) => readdirSync(dir).filter(n => n.endsWith('.claim.json')).map(n => n.replace('.claim.json', '')).sort();
const headAt = (head: string, status = '') => vi.mocked(frozen.gitAt).mockImplementation((_repo, args) => Buffer.from(args.join(' ') === 'rev-parse HEAD' ? head
  : args.join(' ') === 'status --porcelain' ? status : path.join(root, 'git-common')));
/** The SDK's own deadline error: it keeps the generic name "Error"; its class is the label. */
class APIConnectionTimeoutError extends Error { constructor() { super('Request timed out.'); } }
/** The real first text stage, whose storyboard call times out as the paid run's did: the story is paid and kept, the storyboard's cost unknown. */
async function timedOut() {
  const t = textTransports();
  t.responses.mockImplementationOnce((async (_p: unknown, _s: unknown, _t: unknown, observe?: (failure: unknown) => void) => {
    observe?.({ code: 'long_call_aborted', phase: 'headers', elapsedMs: 306000, causeName: 'TimeoutError', causeCode: null });
    throw new APIConnectionTimeoutError();
  }) as never);
  await expect(run(t)).rejects.toThrow();
  return t;
}
/** Guy's one continuation through the CLI: a read-only preview without --execute. */
const continuation = (transports = textTransports(), execute = true) =>
  newBookExperimentCLI(['--config', file, 'storyboard-continuation', ...(execute ? ['--execute'] : [])], { text: transports, log: () => {} });
/** The timed-out first run, then the one continuation at a new reviewed HEAD. */
async function continued() { await timedOut(); headAt('c'.repeat(40)); return continuation(); }
/** Every file under a folder (relative path, forward slashes) and its hash. */
const tree = (dir: string): Record<string, string> => Object.fromEntries(readdirSync(dir, { recursive: true, withFileTypes: true }).filter(e => e.isFile())
  .map(e => { const full = path.join(e.parentPath, e.name); return [path.relative(dir, full).split(path.sep).join('/'), sha(readFileSync(full))]; }));
/** One settled call's cost lowered to 1 in its result and its receipt together (Codex's 490000 -> 1 shape); its raw answer is left as it was. */
function lowerToOne(paid: string, step: string) {
  const at = (k: string) => path.join(paid, `${step}.${k}.json`), result = json(at('result'));
  writeFileSync(at('result'), JSON.stringify({ ...result, estimatedMicroUsd: 1 }));
  if (result.completed) writeFileSync(at('receipt'), JSON.stringify({ ...json(at('receipt')), estimatedMicroUsd: 1 }));
  else { const failure = json(at('failure')); writeFileSync(at('failure'), JSON.stringify({ ...failure, receipt: { ...failure.receipt, estimatedMicroUsd: 1 } })); }
}
/**
 * Between two calls of a running stage: at the experiment's own guard check before the next claim (every claim runs it), the first call that
 * has settled in `paid` gets its cost lowered, once. Returns a reader of that call's step (null until then).
 */
function lowerFirstSettled(paid: string) {
  const current = vi.mocked(frozen.gitAt).getMockImplementation()!;
  let lowered: string | null = null;
  vi.mocked(frozen.gitAt).mockImplementation((repo, args) => {
    const settled = !lowered && existsSync(paid) ? readdirSync(paid).find(n => n.endsWith('.result.json')) : undefined;
    if (settled) { lowered = settled.slice(0, -'.result.json'.length); lowerToOne(paid, lowered); }
    return current(repo, args);
  });
  return () => lowered;
}

describe('a new book from scratch, staged, offline rehearsal (synthetic providers; no key, no network, no spend)', () => {
  it('text -> child -> grant: each stage journals its own calls and the reviewed-audition loader admits the whole book', async () => {
    const t = textTransports(), text = await run(t);
    const dir = experimentDir(config), textDir = path.join(dir, 'text');
    expect(text.status).toBe('review_supported');
    expect(t.opus).toHaveBeenCalledTimes(2); expect(t.reader).toHaveBeenCalledTimes(2); expect(t.responses).toHaveBeenCalledTimes(2);
    // API calls are metered against the one $7 cap; the Opus author/editor are journaled separately as Claude Max.
    expect(claims(path.join(textDir, 'paid-stages'))).toEqual(['comparison', 'final_review', 'storyboard', 'storyboard_review']);
    expect(claims(path.join(textDir, 'claude-max-stages'))).toEqual(['author', 'editor']);
    expect(json(path.join(textDir, 'paid-stages', 'storyboard.wire.json')).model).toBe('gpt-6-astra');
    expect(json(path.join(textDir, 'paid-stages', 'storyboard_review.wire.json')).model).toBe('gpt-6.1-sol');
    expect(text.api).toMatchObject({ capMicroUsd: 7000000, unknownCost: 0, unknownOutcome: 0 });
    expect(json(path.join(textDir, 'sealed.json'))).toEqual({ status: 'review_supported', runtimeEligible: false });
    expect(json(path.join(dir, 'request.json'))).toMatchObject({ version: 'local-simple-wizard-request/v1', experiment: NEW_BOOK_EXPERIMENT.slot });
    expect(readFileSync(path.join(textDir, 'story.md'), 'utf8')).toContain('## עמוד 8');
    // The saved result and the planner's own draft recompile to the same reviewed storyboard.
    const board = loadReviewedStoryboard(dir, process.cwd(), experimentLayout(config));
    expect(board.book.plan.actorAppearance).toBeTruthy();
    // The saved book carries both contracts, and the loader re-derives them from it (a stripped marker would break every digest).
    expect(board.book.moments?.version).toBe(STORYBOARD_MOMENTS_VERSION);
    expect(board.book.landmarkKind).toBeTruthy();

    const c = childAdapters(), child = await runNewBookChild({ config: newBookConfig(file), signal: new AbortController().signal, log: () => {}, adapters: c });
    expect(child).toMatchObject({ status: 'child_reference_passed', candidate: { imageName: 'reference_child.png' } });
    expect(c.render).toHaveBeenCalledTimes(1);
    expect(c.render.mock.calls[0][1]).toContain('One NEW fictional child character anchor, not a real photograph. ');
    expect(c.render.mock.calls[0][1]).toContain(config.childDesign);
    expect(c.render.mock.calls[0][2]).toEqual([]);
    const layout = readReviewedBookLayout(path.join(dir, 'book-layout.json'));
    expect(layout).toEqual(experimentLayout(config, 'reference_child.png'));
    // The adopted reference was judged against this experiment's own written design (never the old book's).
    expect(json(path.join(dir, 'child', 'reference_child_adoption.json')).context.design.fictionalDesign).toBe(config.childDesign);
    // A layout naming another seed is another book: the saved story's own seed must match.
    expect(() => loadReviewedStoryboard(dir, process.cwd(), { ...layout, seed: 'another-seed' })).toThrow('audition_request_binding');
    const loaded = loadReviewedBook(dir, process.cwd(), undefined, layout);
    expect(sha(loaded.childBytes)).toBe(child.candidate!.imageSha);

    const grant = await writeNewBookGrant(newBookConfig(file));
    expect(auditionGrantSchema.parse(grant)).toEqual(grant);
    expect(grant).toMatchObject({ approvalReference: NEW_BOOK_EXPERIMENT.approval, capMicroUsd: 7000000,
      ledger: { priorKnownApiMicroUsd: text.api.newKnownApiMicroUsd }, scope: { mode: 'render', pages: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        sample: earliestSameScenePair(loaded.book) } });
    expect(readAuditionGrant(path.join(dir, 'audition.grant.json'), { requestId: loaded.queued.requestId, storyboardDigest: loaded.book.storyboardDigest }).grant).toEqual(grant);
    // The audition's own zero-provider preview admits the new book through its layout.
    expect(dryRun(dir, undefined, layout)).toMatchObject({ requestId: loaded.queued.requestId, storyboardDigest: loaded.book.storyboardDigest });
    expect(sdk.create).not.toHaveBeenCalled();
  });

  it('the real experiment passes the moments and landmark-kind contracts (and owned appearance) to the storyboard calls', async () => {
    const t = textTransports();
    t.responses.mockImplementation(async () => { throw Object.assign(Error('stop after inspecting the call'), { code: 'synthetic_stop' }); });
    await expect(newBookExperimentCLI(['--config', file, 'text', '--execute'], { text: t, log: () => {} })).rejects.toThrow();
    const wire = json(path.join(experimentDir(config), 'text', 'paid-stages', 'storyboard.wire.json'));
    expect(wire.instructions).toContain('DRAWN INSTANT AND PAGE MEANING');
    expect(wire.instructions).toContain('Actor-owned appearance is mandatory');
    expect(JSON.stringify(wire)).toMatch(/kind/i);
    expect(NEW_BOOK_EXPERIMENT.contracts).toEqual({ actorOwnedAppearance: true, momentContract: true, landmarkKindContract: true });
    // A failed paid call seals the stage as failed with its code and keeps every artifact.
    expect(json(path.join(experimentDir(config), 'text', 'sealed.json'))).toMatchObject({ status: 'failed', runtimeEligible: false });
    expect(json(path.join(experimentDir(config), 'text', 'paid-stages', 'storyboard.result.json'))).toMatchObject({ completed: false });
  });

  it('a story the readers hold stops before any storyboard call; the child stage then refuses', async () => {
    const t = textTransports({ readerFindings: [{ severity: 'material', category: 'causality', pageNumbers: [3], quote: 'x', problem: 'synthetic', fix: 'synthetic' }] });
    const text = await run(t).catch(e => e);
    const textDir = path.join(experimentDir(config), 'text');
    if (text instanceof Error) {
      // An unparseable synthetic finding is a reader failure, still sealed and still no storyboard call.
      expect(json(path.join(textDir, 'sealed.json')).status).toBe('failed');
    } else expect(text.status).toBe('story_held');
    expect(t.responses).not.toHaveBeenCalled();
    await expect(runNewBookChild({ config: newBookConfig(file), signal: new AbortController().signal, log: () => {}, adapters: childAdapters() }))
      .rejects.toThrow('new_book_text_not_supported');
  });

  it('single use: the slot, the child stage and the grant are each written once; a stage needs its predecessor', async () => {
    await expect(runNewBookChild({ config: newBookConfig(file), signal: new AbortController().signal, log: () => {}, adapters: childAdapters() })).rejects.toThrow();
    await expect(writeNewBookGrant(newBookConfig(file))).rejects.toThrow();
    await run();
    await expect(run()).rejects.toThrow('new_book_slot_used');
    await expect(writeNewBookGrant(newBookConfig(file))).rejects.toThrow('new_book_stage_not_passed');
    await runNewBookChild({ config: newBookConfig(file), signal: new AbortController().signal, log: () => {}, adapters: childAdapters() });
    await expect(runNewBookChild({ config: newBookConfig(file), signal: new AbortController().signal, log: () => {}, adapters: childAdapters() }))
      .rejects.toThrow('new_book_child_used');
    await writeNewBookGrant(newBookConfig(file));
    await expect(writeNewBookGrant(newBookConfig(file))).rejects.toThrow();
  });

  it('a storyboard answer from another model is refused, kept as evidence, and stops the stage', async () => {
    const t = textTransports({ model: 'gpt-6-astra-mini' });
    await expect(run(t)).rejects.toThrow();
    const textDir = path.join(experimentDir(config), 'text');
    // Another model's answer has no known cost (never priced at the requested model's rate): its reservation stays counted.
    expect(json(path.join(textDir, 'paid-stages', 'storyboard.failure.json'))).toMatchObject({ code: 'new_book_provider_invalid',
      receipt: { model: 'gpt-6-astra-mini', estimatedMicroUsd: null } });
    expect(json(path.join(textDir, 'sealed.json'))).toMatchObject({ status: 'failed', code: 'new_book_provider_invalid' });
    expect(existsSync(path.join(textDir, 'visual_simple_book_result.json'))).toBe(false);
  });
  it('a storyboard answer at another service tier is refused as invalid with no known cost, and stops the stage', async () => {
    const t = textTransports(), real = t.responses.getMockImplementation()!;
    t.responses.mockImplementation((async (payload: any, ...rest: unknown[]) => ({ ...(await (real as any)(payload, ...rest)), service_tier: 'flex' })) as never);
    await expect(run(t)).rejects.toThrow();
    const textDir = path.join(experimentDir(config), 'text');
    expect(json(path.join(textDir, 'paid-stages', 'storyboard.failure.json'))).toMatchObject({ code: 'new_book_provider_invalid',
      receipt: { estimatedMicroUsd: null, raw: { service_tier: 'flex' } } });
    expect(json(path.join(textDir, 'sealed.json'))).toMatchObject({ status: 'failed', code: 'new_book_provider_invalid' });
  });
});

// Whole synthetic auditions (two sheets, nine frames, guard checks before every call) take several seconds each.
describe('the reviewed audition on the new book (synthetic providers through the real runner, meter and sample gate)', { timeout: 60_000 }, () => {
  const ANSWER = { referenceChildVisible: true, candidateChildVisible: true, candidateChildCount: 1, comparisonUsable: true, sameChildDecision: 'same',
    faceStructure: 'match', eyesBrows: 'match', noseMouth: 'match', hairIdentity: 'match', distinctiveFeatures: 'match' };
  async function prepared(opts: { continued?: true; second?: true; third?: true } = {}) {
    if (opts.third) {
      await timedOut(); headAt('c'.repeat(40));
      await expect(continuation(textTransports({ storyboardOutput: driftingStoryboard }))).rejects.toThrow('book_sequence_scene_location_drift');
      headAt('e'.repeat(40));
      await expect(newBookExperimentCLI(['--config', file, 'storyboard-continuation-2', '--execute'],
        { text: textTransports({ storyboardOutput: undeclaredPropStoryboard }), log: () => {} })).rejects.toThrow('unknown_or_duplicate_prop');
      headAt('1'.repeat(40));
      await newBookExperimentCLI(['--config', file, 'storyboard-continuation-3', '--execute'], { text: textTransports(), log: () => {} });
    } else if (opts.second) {
      await timedOut(); headAt('c'.repeat(40));
      await expect(continuation(textTransports({ storyboardOutput: driftingStoryboard }))).rejects.toThrow('book_sequence_scene_location_drift');
      headAt('e'.repeat(40));
      await newBookExperimentCLI(['--config', file, 'storyboard-continuation-2', '--execute'], { text: textTransports(), log: () => {} });
    } else if (opts.continued) await continued(); else await run();
    await runNewBookChild({ config: newBookConfig(file), signal: new AbortController().signal, log: () => {}, adapters: childAdapters() });
    const grant = await writeNewBookGrant(newBookConfig(file)), dir = experimentDir(config);
    let shade = 40;
    vi.spyOn(images, 'generateGPTImage').mockImplementation(async input => {
      const buffer = await png(shade++ % 250, 1024), usage = { input_tokens: 100, output_tokens: 300 };
      input.observeProviderResponse?.({ data: [{ b64_json: buffer.toString('base64') }], usage });
      return { buffer, usage, model: 'gpt-image-2', finalPrompt: input.finalPrompt, hasReferencePhoto: !!input.referenceImages?.length,
        apiMode: input.referenceImages?.length ? 'images.edit' : 'images.generate', referenceCountRequested: input.referenceImages?.length ?? 0,
        referenceCountPassed: input.referenceImages?.length ?? 0, durationMs: 1, fallbackUsed: false } as never;
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ model: 'gpt-4o-2024-08-06', choices: [{ message: { content: JSON.stringify(ANSWER) } }],
      usage: { prompt_tokens: 1500, completion_tokens: 120 } }), { status: 200 })));
    return { grant, dir };
  }
  /** Page reviews: every check passes and each landmark is one matching object, unless `defect` names the page. */
  const judgeWith = (defectPage: number | null) => sdk.create.mockImplementation(async (payload: any) => {
    const text = JSON.parse(payload.input[0].content[0].text), context = text.context, page = payload.text.format.name === 'personal_audition_pixels_v4';
    const checks = QUALITY_CATEGORIES.map(category => ({ category, verdict: 'pass', observation: `${category} ok`, correction: '', issues: [] as unknown[] }));
    if (page && context.packet?.pageNumber === defectPage) Object.assign(checks.find(c => c.category === 'environment')!, { verdict: 'defect', correction: 'Repair it.',
      issues: [{ impact: 'continuity', requirement: context.requirementIds.find((id: string) => id !== 'safety'), note: 'a bound continuity defect' }] });
    const landmarks = context.checks?.uniqueLandmarks ?? [];
    const inventory = { objects: landmarks.map((l: any, i: number) => ({ objectId: `o${i + 1}`, region: `${l.id} place`, description: l.id })),
      landmarks: landmarks.map((l: any, i: number) => ({ landmarkId: l.id, candidates: [{ objectId: `o${i + 1}`, association: 'this_landmark', evidence: 'seen',
        featureChecks: l.features.map((f: any) => ({ featureId: f.id, observed: 'matches' })) }] })) };
    return { model: 'gpt-6.1-sol', service_tier: 'default', status: 'completed', usage: { input_tokens: 5000, output_tokens: 800 },
      output_text: JSON.stringify({ candidateSha: text.candidateSha, contextSha: text.contextSha, checks, ...(page ? { landmarkInventory: inventory } : {}) }) };
  });
  /** The experiment's guarded fourth stage (the only way its grant can be used). */
  const audition = (opts: { resume?: true; signal?: AbortSignal } = {}) => runNewBookAudition({ config: newBookConfig(file),
    signal: opts.signal ?? new AbortController().signal, log: () => {}, ...(opts.resume ? { resume: true as const } : {}) });
  const renders = () => vi.mocked(images.generateGPTImage).mock.calls.length;
  const moveHead = (head: string) => vi.mocked(frozen.gitAt).mockImplementation((_repo, args) => Buffer.from(args.join(' ') === 'rev-parse HEAD' ? head
    : args.join(' ') === 'status --porcelain' ? '' : path.join(root, 'git-common')));

  it('supported sample: sheets, the sample pages, then the rest of the book, all under the one cap with the earlier stages as prior spend', async () => {
    const { grant, dir } = await prepared(); judgeWith(null);
    const result = await audition();
    if (result.mode !== 'render') throw Error('render expected');
    const [a, b] = grant.scope.mode === 'render' ? grant.scope.sample! : [];
    expect(result.manifest).toMatchObject({ status: 'qa_supported_audition', scope: { complete: true, sample: [a, b] } });
    const steps = claims(path.join(dir, 'audition', 'paid-stages')).filter(s => /^page_\d_0$/.test(s));
    expect(steps).toHaveLength(9);
    const order = JSON.parse(readFileSync(path.join(dir, 'audition', 'paid-stages', `page_${a}_0.claim.json`), 'utf8')).seq;
    expect(order).toBeLessThan(JSON.parse(readFileSync(path.join(dir, 'audition', 'paid-stages', 'page_0_0.claim.json'), 'utf8')).seq);
    expect(result.spend).toMatchObject({ priorKnownApiMicroUsd: grant.ledger.priorKnownApiMicroUsd, capMicroUsd: 7000000, unknownCost: 0, unknownOutcome: 0 });
    // F1: drawn sample-first, but the book reads cover, then pages 1-8 (manifest and HTML).
    expect(result.manifest.pages.map(p => p.pageNumber)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(result.manifest.scope).toMatchObject({ drawnOrder: [a, b, ...[0, 1, 2, 3, 4, 5, 6, 7, 8].filter(n => n !== a && n !== b)] });
    const html = readFileSync(path.join(dir, 'audition', 'book.html'), 'utf8');
    expect([...html.matchAll(/<img alt="(כריכה|איור לעמוד (\d))"/g)].map(m => m[2] ? Number(m[2]) : 0)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(html).toContain('מצב: <b>נתמך בבדיקה האוטומטית בלבד</b>.');
  });
  it('a held sample page stops the paid run before any other page is drawn, and the book says so', async () => {
    const { grant, dir } = await prepared();
    const [a, b] = grant.scope.mode === 'render' ? grant.scope.sample! : [];
    judgeWith(b);
    const result = await audition();
    if (result.mode !== 'render') throw Error('render expected');
    expect(result.manifest).toMatchObject({ status: 'held_sample', scope: { frames: [a, b], complete: false, stoppedAfterSample: true } });
    // Two sheets, one sample page, then three attempts of the held page; nothing else.
    expect(renders()).toBe(2 + 1 + 3);
    expect(claims(path.join(dir, 'audition', 'paid-stages')).filter(s => /^page_/.test(s)).every(s => new RegExp(`^page_[${a}${b}]_`).test(s))).toBe(true);
    // F2: a held, partial book is presented as held and partial, never as supported.
    const html = readFileSync(path.join(dir, 'audition', 'book.html'), 'utf8');
    expect(html).toContain('מוחזק — הדגימה המוקדמת לא עברה, ושאר הספר לא צויר');
    expect(html).toContain(`ספר חלקי: צוירו עמוד ${a}, עמוד ${b}.`);
    expect(html).not.toContain('נתמך בבדיקה האוטומטית בלבד');
  });
  it('after the storyboard continuation: the audition ledger carries the timed-out call in full, separate from known spend, under the one cap', async () => {
    const { grant, dir } = await prepared({ continued: true }); judgeWith(null);
    const carried = json(path.join(dir, 'text', 'paid-stages', 'storyboard.claim.json')).maximumMicroUsd;
    expect(grant.ledger).toMatchObject({ carriedUnresolvedMicroUsd: carried });
    const result = await audition();
    if (result.mode !== 'render') throw Error('render expected');
    expect(result.manifest).toMatchObject({ status: 'qa_supported_audition', scope: { complete: true } });
    expect(result.spend).toMatchObject({ priorKnownApiMicroUsd: grant.ledger.priorKnownApiMicroUsd, carriedUnresolvedMicroUsd: carried, capMicroUsd: 7000000,
      reservedUnsettledMicroUsd: 0, unknownCost: 0, unknownOutcome: 0 });
    expect(result.spend.cumulativeAccountedMicroUsd).toBe(grant.ledger.priorKnownApiMicroUsd + carried + result.spend.newKnownApiMicroUsd);
  });

  it('after the second storyboard attempt: the loader admits its scene-location book and the audition carries every ledger line', async () => {
    const { grant, dir } = await prepared({ second: true }); judgeWith(null);
    const carried = json(path.join(dir, 'text', 'paid-stages', 'storyboard.claim.json')).maximumMicroUsd;
    expect(grant.ledger).toMatchObject({ carriedUnresolvedMicroUsd: carried });
    expect(loadReviewedStoryboard(dir, process.cwd(), readReviewedBookLayout(path.join(dir, 'book-layout.json'))).book.sceneLocation).toBe(SCENE_LOCATION_CONTRACT_VERSION);
    const result = await audition();
    if (result.mode !== 'render') throw Error('render expected');
    expect(result.manifest).toMatchObject({ status: 'qa_supported_audition', scope: { complete: true } });
    expect(result.spend).toMatchObject({ priorKnownApiMicroUsd: grant.ledger.priorKnownApiMicroUsd, carriedUnresolvedMicroUsd: carried, unknownCost: 0, unknownOutcome: 0 });
  });

  it('after the third storyboard attempt: the loader admits its compiler-rules book and the audition carries every ledger line', async () => {
    const { grant, dir } = await prepared({ third: true }); judgeWith(null);
    const carried = json(path.join(dir, 'text', 'paid-stages', 'storyboard.claim.json')).maximumMicroUsd;
    expect(grant.ledger).toMatchObject({ carriedUnresolvedMicroUsd: carried });
    expect(grant.ledger.evidence).toHaveLength(8);
    const book = loadReviewedStoryboard(dir, process.cwd(), readReviewedBookLayout(path.join(dir, 'book-layout.json'))).book;
    expect([book.sceneLocation, book.compilerRules]).toEqual([SCENE_LOCATION_CONTRACT_VERSION, COMPILER_RULES_CONTRACT_VERSION]);
    const result = await audition();
    if (result.mode !== 'render') throw Error('render expected');
    expect(result.manifest).toMatchObject({ status: 'qa_supported_audition', scope: { complete: true } });
    expect(result.spend).toMatchObject({ priorKnownApiMicroUsd: grant.ledger.priorKnownApiMicroUsd, carriedUnresolvedMicroUsd: carried, unknownCost: 0, unknownOutcome: 0 });
  });

  it('a grant file rewritten after it was written (a lower prior, a higher cap) is refused before the start record or any image', async () => {
    const { dir } = await prepared(); judgeWith(null);
    const g = path.join(dir, 'audition.grant.json'), bytes = readFileSync(g), grant = JSON.parse(bytes.toString('utf8'));
    for (const changed of [{ ...grant, ledger: { ...grant.ledger, priorKnownApiMicroUsd: grant.ledger.priorKnownApiMicroUsd - 1 } }, { ...grant, capMicroUsd: 8000000 }]) {
      writeFileSync(g, JSON.stringify(changed));
      await expect(audition()).rejects.toThrow(/^new_book_grant_ledger$/);
      expect([renders(), existsSync(experimentAuditionStart(config)), existsSync(path.join(dir, 'audition'))]).toEqual([0, false, false]);
    }
    writeFileSync(g, bytes);
    const result = await audition();
    expect(result.mode === 'render' && result.manifest.status).toBe('qa_supported_audition');
  });

  it('F3: one fresh audition per approval; a second start, another output folder or the grant on a bare runner is refused before any image', async () => {
    const { dir } = await prepared(); judgeWith(null);
    await audition();
    const drawn = renders();
    await expect(audition()).rejects.toThrow('new_book_audition_used');
    // The grant itself (or a copy of it) cannot buy a fresh output folder through the generic runner.
    const copy = path.join(root, 'copied.grant.json'); writeFileSync(copy, readFileSync(path.join(dir, 'audition.grant.json')));
    for (const grantFile of [path.join(dir, 'audition.grant.json'), copy]) {
      const out = path.join(root, `audition-again-${path.basename(grantFile)}`);
      await expect(runReviewedAudition({ bookDir: dir, out, keyFile: config.keyEnvFile, grantFile, signal: new AbortController().signal, log: () => {},
        layout: readReviewedBookLayout(path.join(dir, 'book-layout.json')) })).rejects.toThrow('audition_experiment_guard');
      expect(existsSync(out)).toBe(false);
    }
    // Nor with a guard that names another claim.
    await expect(runReviewedAudition({ bookDir: dir, out: path.join(root, 'audition-forged'), keyFile: config.keyEnvFile, grantFile: copy,
      signal: new AbortController().signal, log: () => {}, layout: readReviewedBookLayout(path.join(dir, 'book-layout.json')),
      experiment: { slot: NEW_BOOK_EXPERIMENT.slot, claimSha256: 'f'.repeat(64), guard: () => {} } })).rejects.toThrow('audition_experiment_guard');
    expect(renders()).toBe(drawn);
  });
  it('F3: an interrupted audition continues only by resume, in the same folder and ledger, carrying every earlier cost', async () => {
    const { grant, dir } = await prepared(); judgeWith(null);
    // Interrupted between calls: the third judgment completes and is recorded, then the next claim is cancelled.
    const controller = new AbortController(), realJudge = sdk.create.getMockImplementation()!;
    let judged = 0;
    sdk.create.mockImplementation(async (payload: any) => { const r = await realJudge(payload); if (++judged === 3) controller.abort(); return r; });
    await expect(audition({ signal: controller.signal })).rejects.toThrow('audition_cancelled');
    sdk.create.mockImplementation(realJudge);
    const before = new AuditionMeter(path.join(dir, 'audition', 'paid-stages'), 7000000, 89, grant.ledger.priorKnownApiMicroUsd).snapshot();
    expect(before).toMatchObject({ unknownCost: 0, unknownOutcome: 0 });
    expect(before.calls).toBeGreaterThan(0);
    const resumed = await audition({ resume: true });
    if (resumed.mode !== 'render') throw Error('render expected');
    expect(resumed.manifest).toMatchObject({ status: 'qa_supported_audition', scope: { complete: true } });
    // One ledger: the resumed run's spend includes the interrupted part (nothing reset by the continuation).
    expect(resumed.spend.calls).toBeGreaterThan(before.calls);
    expect(resumed.spend.newKnownApiMicroUsd).toBeGreaterThan(before.newKnownApiMicroUsd);
    expect(resumed.spend.priorKnownApiMicroUsd).toBe(grant.ledger.priorKnownApiMicroUsd);
    // A resume is refused without a started audition, and a fresh start is refused after one.
    await expect(audition()).rejects.toThrow('new_book_audition_used');
  });
  it('F4: a moved HEAD after the grant refuses before any claim or image; a move during a call records that call and stops the next', async () => {
    const { dir } = await prepared(); judgeWith(null);
    moveHead('b'.repeat(40));
    await expect(audition()).rejects.toThrow('new_book_source_changed');
    expect(renders()).toBe(0);
    expect(existsSync(path.join(dir, 'audition'))).toBe(false);
    moveHead('a'.repeat(40));
    const real = vi.mocked(images.generateGPTImage).getMockImplementation()!;
    vi.mocked(images.generateGPTImage).mockImplementation(async input => { const r = await real(input); moveHead('b'.repeat(40)); return r; });
    await expect(audition({ resume: true })).rejects.toThrow('new_book_audition_binding');
    await expect(audition()).rejects.toThrow();
    // The call in flight is fully recorded with its known cost; nothing after it was claimed.
    const meter = new AuditionMeter(path.join(dir, 'audition', 'paid-stages'), 7000000, 89).snapshot();
    expect(meter).toMatchObject({ calls: 1, unknownCost: 0, unknownOutcome: 0, failed: 0 });
    expect(renders()).toBe(1);
  });
  it('F4: the runner runs the experiment guard first, before it reads, writes or claims anything', async () => {
    const { dir } = await prepared(); judgeWith(null);
    const claimSha256 = createHash('sha256').update(readFileSync(experimentClaimFile(newBookConfig(file)))).digest('hex');
    moveHead('b'.repeat(40));
    const out = path.join(root, 'audition-direct');
    await expect(runReviewedAudition({ bookDir: dir, out, keyFile: config.keyEnvFile, grantFile: path.join(dir, 'audition.grant.json'),
      signal: new AbortController().signal, log: () => {}, layout: readReviewedBookLayout(path.join(dir, 'book-layout.json')),
      experiment: { slot: NEW_BOOK_EXPERIMENT.slot, claimSha256, guard: () => { assertExperimentClaim(newBookConfig(file)); } } })).rejects.toThrow('new_book_source_changed');
    expect(existsSync(out)).toBe(false);
    expect(renders()).toBe(0);
  });

  // Own-stage meter integrity (approved offline milestone): the audition's meter re-derives its own calls before each claim and every resume.
  const identities = () => vi.mocked(globalThis.fetch).mock.calls.length;
  /** Interrupted between calls, as in F3: the third judgment completes and is recorded, then the next claim is cancelled. */
  async function interrupted() {
    const controller = new AbortController(), realJudge = sdk.create.getMockImplementation()!;
    let judged = 0;
    sdk.create.mockImplementation(async (payload: any) => { const r = await realJudge(payload); if (++judged === 3) controller.abort(); return r; });
    await expect(audition({ signal: controller.signal })).rejects.toThrow('audition_cancelled');
    sdk.create.mockImplementation(realJudge);
  }
  it('own meter at a start (through the guarded runner): a render cost lowered between calls refuses its review claim before the call', async () => {
    const { dir } = await prepared(); judgeWith(null);
    const paid = path.join(dir, 'audition', 'paid-stages'), lowered = lowerFirstSettled(paid);
    await expect(audition()).rejects.toThrow(/^audition_meter_cost$/);
    expect([lowered(), claims(paid), renders(), sdk.create.mock.calls.length, identities()]).toEqual(['sheet_entities_0', ['sheet_entities_0'], 1, 0, 0]);
  });
  it("own meter on a resume: Codex's shape (a settled cost lowered in result and receipt, the raw answer unchanged) refuses before the marker, any claim or call", async () => {
    const { grant, dir } = await prepared(); judgeWith(null);
    await interrupted();
    const out = path.join(dir, 'audition'), paid = path.join(out, 'paid-stages'), prior = grant.ledger.priorKnownApiMicroUsd;
    const genuine = new AuditionMeter(paid, 7000000, 89, prior).snapshot();
    lowerToOne(paid, 'sheet_entities_0');
    // The plain sum (every caller without the opt-in) would carry the lowered cost into the resumed run.
    expect(new AuditionMeter(paid, 7000000, 89, prior).snapshot().newKnownApiMicroUsd).toBe(genuine.newKnownApiMicroUsd - (100 * 8 + 300 * 30) + 1);
    const files = tree(out), drawn = [renders(), sdk.create.mock.calls.length, identities()];
    await expect(audition({ resume: true })).rejects.toThrow(/^audition_meter_cost$/);
    expect([tree(out), [renders(), sdk.create.mock.calls.length, identities()]]).toEqual([files, drawn]);
    expect(existsSync(path.join(out, 'resume-1.json'))).toBe(false);
  });
  it('a genuine resume under the opt-in continues with the exact spend, call count, r1_ prefix, same folder and remaining cap', async () => {
    const { grant, dir } = await prepared(); judgeWith(null);
    await interrupted();
    const out = path.join(dir, 'audition'), paid = path.join(out, 'paid-stages'), prior = grant.ledger.priorKnownApiMicroUsd;
    const before = new AuditionMeter(paid, 7000000, 89, prior).snapshot(), first = claims(paid);
    const resumed = await audition({ resume: true });
    if (resumed.mode !== 'render') throw Error('render expected');
    expect(resumed.manifest).toMatchObject({ status: 'qa_supported_audition', scope: { complete: true } });
    // The resume marker records the interrupted spend: exactly the plain sum of the same records.
    expect(json(path.join(out, 'resume-1.json')).spendBefore).toEqual(before);
    const all = claims(paid), added = all.filter(s => !first.includes(s));
    expect(added.length).toBeGreaterThan(0);
    expect(added.every(s => s.startsWith('r1_'))).toBe(true);
    // Every call costs its raw answer's price (render 100 x 8 + 300 x 30; review 5,000 x 2 + 800 x 10; identity 1,500 x 2.5 + 120 x 10), each counted once.
    const price = (s: string) => s.endsWith('_qa') ? 18000 : s.endsWith('_identity') ? 4950 : 9800, known = all.reduce((sum, s) => sum + price(s), 0);
    expect(all.map(s => json(path.join(paid, `${s}.result.json`)).estimatedMicroUsd)).toEqual(all.map(price));
    expect(resumed.spend).toMatchObject({ priorKnownApiMicroUsd: prior, calls: before.calls + added.length, newKnownApiMicroUsd: known,
      cumulativeAccountedMicroUsd: prior + known, capMicroUsd: 7000000, reservedUnsettledMicroUsd: 0, unknownCost: 0, unknownOutcome: 0 });
    expect(json(path.join(out, 'spend-r1.json'))).toEqual(resumed.spend);
    expect(existsSync(path.join(out, 'book-r1.html'))).toBe(true);
  });
  it('the opt-in cannot be dropped on a resume: the bare runner, or the grant without its experiment, is refused before any marker, claim or call', async () => {
    const { dir } = await prepared(); judgeWith(null);
    await interrupted();
    const out = path.join(dir, 'audition'), grantFile = path.join(dir, 'audition.grant.json'), layout = readReviewedBookLayout(path.join(dir, 'book-layout.json'));
    const bare = (grant: string) => runReviewedAudition({ bookDir: dir, out, keyFile: config.keyEnvFile, grantFile: grant, signal: new AbortController().signal,
      log: () => {}, layout, resume: true });
    const files = tree(out), drawn = [renders(), sdk.create.mock.calls.length, identities()];
    // The experiment's own grant on the bare runner (no guard, so no opt-in): refused by the grant's experiment binding.
    await expect(bare(grantFile)).rejects.toThrow('audition_experiment_guard');
    // The grant without its experiment (so the bare runner's binding passes): the started run's admission names the grant itself.
    const bytes = readFileSync(grantFile), plain = json(grantFile); delete plain.experiment;
    const copy = path.join(root, 'plain.grant.json'); writeFileSync(copy, JSON.stringify(plain));
    await expect(bare(copy)).rejects.toThrow('audition_resume_admission');
    // The same rewrite in place: the experiment's stage refuses its binding, the bare runner the admission.
    writeFileSync(grantFile, JSON.stringify(plain));
    await expect(audition({ resume: true })).rejects.toThrow('new_book_grant_binding');
    await expect(bare(grantFile)).rejects.toThrow('audition_resume_admission');
    writeFileSync(grantFile, bytes);
    expect([tree(out), [renders(), sdk.create.mock.calls.length, identities()]]).toEqual([files, drawn]);
  });
  it('a charged review failure from the real adapter verifies under the opt-in and stays counted at its raw price; the run halts as before', async () => {
    const { dir } = await prepared(); judgeWith(null);
    const real = sdk.create.getMockImplementation()!;
    sdk.create.mockImplementationOnce(async (payload: any) => ({ ...(await real(payload)), status: 'incomplete' }));
    await expect(audition()).rejects.toThrow(/^audition_review_unusable$/);
    const paid = path.join(dir, 'audition', 'paid-stages');
    expect(json(path.join(paid, 'sheet_entities_0_qa.result.json'))).toMatchObject({ estimatedMicroUsd: 5000 * 2 + 800 * 10, completed: false });
    expect(json(path.join(paid, 'sheet_entities_0_qa.failure.json'))).toMatchObject({ code: 'audition_pixel_provider_invalid' });
  });
  it('a charged identity failure (HTTP 500 with usage) from the real adapter verifies under the opt-in and stays counted; the run halts as before', async () => {
    const { dir } = await prepared(); judgeWith(null);
    vi.mocked(globalThis.fetch).mockImplementationOnce(async () => new Response(JSON.stringify({ model: 'gpt-4o-2024-08-06', error: { message: 'synthetic' },
      usage: { prompt_tokens: 1500, completion_tokens: 120 } }), { status: 500 }));
    await expect(audition()).rejects.toThrow(/^audition_identity_unusable$/);
    const paid = path.join(dir, 'audition', 'paid-stages'), step = claims(paid).find(s => s.endsWith('_identity'))!;
    expect(json(path.join(paid, `${step}.result.json`))).toMatchObject({ estimatedMicroUsd: 1500 * 2.5 + 120 * 10, completed: false });
    expect(json(path.join(paid, `${step}.failure.json`))).toMatchObject({ code: 'audition_identity_provider_failed', receipt: { status: 500 } });
  });
});

describe('the fictional child reference: one targeted edit only for an evidenced defect', () => {
  const child = (adapters: ChildAdapters) => runNewBookChild({ config: newBookConfig(file), signal: new AbortController().signal, log: () => {}, adapters });
  it('a defect gets exactly one edit of the rejected image with its corrections; the passed edit is adopted', async () => {
    await run();
    const c = childAdapters([{ category: 'anatomy', verdict: 'defect' }, undefined]), result = await child(c);
    expect(result).toMatchObject({ status: 'child_reference_passed', candidate: { imageName: 'reference_child_repair.png' } });
    expect(c.render.mock.calls[1][1]).toContain(REFERENCE_REPAIR_EDIT_INSTRUCTION);
    expect(c.render.mock.calls[1][1]).toContain('TARGETED CORRECTIONS:\nanatomy: fix anatomy');
    expect(c.render.mock.calls[1][2]).toEqual([expect.objectContaining({ imageName: 'reference_child.png' })]);
    const layout = readReviewedBookLayout(path.join(experimentDir(config), 'book-layout.json'));
    expect(layout.childImage).toBe('reference_child_repair.png');
    expect(() => loadReviewedBook(experimentDir(config), process.cwd(), undefined, layout)).not.toThrow();
  });
  it.each([
    ['uncertain first judgment (never redrawn)', [{ category: 'identity', verdict: 'uncertain' as const }], 1],
    ['the edit is still defective', [{ category: 'anatomy', verdict: 'defect' as const }, { category: 'anatomy', verdict: 'defect' as const }], 2],
  ])('%s: held, nothing adopted, no layout, and the grant is refused', async (_name, verdicts, renders) => {
    await run();
    const c = childAdapters(verdicts), result = await child(c);
    expect(result.status).toBe('child_reference_held');
    expect(c.render).toHaveBeenCalledTimes(renders);
    const dir = experimentDir(config);
    expect(existsSync(path.join(dir, 'child', 'reference_child_adoption.json'))).toBe(false);
    expect(existsSync(path.join(dir, 'book-layout.json'))).toBe(false);
    await expect(writeNewBookGrant(newBookConfig(file))).rejects.toThrow('new_book_stage_not_passed');
  });
  it('an edit that returns the rejected image unchanged is a failure, not a pass', async () => {
    await run();
    const c = childAdapters([{ category: 'anatomy', verdict: 'defect' }, undefined]), original = c.render.getMockImplementation()!;
    let first: { imageName: string; imageSha: string } | undefined;
    c.render.mockImplementation(async (step, prompt, refs, mode) => step === 'reference_child' ? (first = await original(step, prompt, refs, mode)) : first!);
    await expect(child(c)).rejects.toThrow('new_book_child_repair_unchanged');
    expect(json(path.join(experimentDir(config), 'child', 'sealed.json'))).toMatchObject({ status: 'failed', code: 'new_book_child_repair_unchanged' });
  });
  it('the grant refuses a layout file that is not this experiment\'s', async () => {
    await run(); await child(childAdapters());
    const file2 = path.join(experimentDir(config), 'book-layout.json'), layout = json(file2);
    writeFileSync(file2, JSON.stringify({ ...layout, childDesign: `${layout.childDesign} With glasses.` }));
    await expect(writeNewBookGrant(newBookConfig(file))).rejects.toThrow('new_book_layout');
  });

  it('through the real adapters: the render and the Sol judgment are journaled against the cap with the text stage as prior spend', async () => {
    const text = await run();
    vi.spyOn(images, 'generateGPTImage').mockImplementation(async input => {
      const buffer = await png(30, 1024), usage = { input_tokens: 100, output_tokens: 300 };
      input.observeProviderResponse?.({ data: [{ b64_json: buffer.toString('base64') }], usage });
      return { buffer, usage, model: 'gpt-image-2', finalPrompt: input.finalPrompt, hasReferencePhoto: false, apiMode: 'images.generate',
        referenceCountRequested: 0, referenceCountPassed: 0, durationMs: 1, fallbackUsed: false } as never;
    });
    sdk.create.mockImplementation(async (payload: any) => {
      const text = JSON.parse(payload.input[0].content[0].text);
      return { model: 'gpt-6.1-sol', service_tier: 'default', status: 'completed', usage: { input_tokens: 5000, output_tokens: 800 },
        output_text: JSON.stringify(passing(text.candidateSha, text.contextSha)) };
    });
    const result = await runNewBookChild({ config: newBookConfig(file), signal: new AbortController().signal, log: () => {} });
    expect(result.status).toBe('child_reference_passed');
    const childDir = path.join(experimentDir(config), 'child');
    expect(claims(path.join(childDir, 'paid-stages'))).toEqual(['reference_child', 'reference_child_qa']);
    expect(json(path.join(childDir, 'paid-stages', 'reference_child.wire.json')).body).toMatchObject({ model: 'gpt-image-2', quality: 'low', size: '1024x1024', n: 1 });
    expect(json(path.join(childDir, 'paid-stages', 'reference_child_qa.wire.json'))).toMatchObject({ model: 'gpt-6.1-sol' });
    expect(json(path.join(childDir, 'spend.json'))).toMatchObject({ priorKnownApiMicroUsd: text.api.newKnownApiMicroUsd, capMicroUsd: 7000000, calls: 2, unknownCost: 0 });
    expect(stageLedger(childDir, 4, text.api.newKnownApiMicroUsd, 0, stageRules.child).knownMicroUsd).toBeGreaterThan(0);
    expect(() => stageLedger(childDir, 4, 0, 0, stageRules.child)).toThrow('new_book_ledger_record');
    // Every child call is re-derived from its raw provider answer at the grant: a coherently lowered render or judgment cost is refused.
    const childPaid = path.join(childDir, 'paid-stages'), childSpend = path.join(childDir, 'spend.json'), spendBytes = readFileSync(childSpend);
    expect(['reference_child', 'reference_child_qa'].map(step => json(path.join(childPaid, `${step}.result.json`)).estimatedMicroUsd))
      .toEqual([100 * 8 + 300 * 30, 5000 * 2 + 800 * 10]);
    for (const step of ['reference_child', 'reference_child_qa']) {
      const at = (k: string) => path.join(childPaid, `${step}.${k}.json`), saved = ['receipt', 'result'].map(k => readFileSync(at(k)));
      for (const k of ['receipt', 'result']) writeFileSync(at(k), JSON.stringify({ ...json(at(k)), estimatedMicroUsd: 1 }));
      writeFileSync(childSpend, JSON.stringify(new AuditionMeter(childPaid, 7000000, 4, text.api.newKnownApiMicroUsd).snapshot()));
      await expect(writeNewBookGrant(newBookConfig(file)), step).rejects.toThrow(/^new_book_ledger_cost$/);
      ['receipt', 'result'].forEach((k, i) => writeFileSync(at(k), saved[i])); writeFileSync(childSpend, spendBytes);
    }
    for (const [step, label, change] of [
      ['reference_child', 'a render under another image model', (receipt: any) => { receipt.model = 'gpt-image-1'; }],
      ['reference_child_qa', 'a judgment by another model', (receipt: any) => { receipt.raw.model = 'gpt-6-astra'; }],
      ['reference_child_qa', 'an incomplete judgment', (receipt: any) => { receipt.raw.status = 'incomplete'; }],
    ] as const) {
      const f = path.join(childPaid, `${step}.receipt.json`), bytes = readFileSync(f), receipt = json(f);
      change(receipt); writeFileSync(f, JSON.stringify(receipt));
      await expect(writeNewBookGrant(newBookConfig(file)), label).rejects.toThrow(/^new_book_ledger_cost$/);
      writeFileSync(f, bytes);
    }
    expect(existsSync(path.join(experimentDir(config), 'audition.grant.json'))).toBe(false);
    // The grant's prior spend is the verified sum of both stages.
    const grant = await writeNewBookGrant(newBookConfig(file));
    expect(grant.ledger.priorKnownApiMicroUsd).toBe(text.api.newKnownApiMicroUsd + json(path.join(childDir, 'spend.json')).newKnownApiMicroUsd);
  });
});

describe('F3: one durable claim per approval (outside every configurable path), one ledger, the approved scope', () => {
  it('another parent folder cannot reopen the slot: refused before any author or API call, and nothing is created there', async () => {
    await run();
    const claim = json(experimentClaimFile(newBookConfig(file)));
    expect(claim).toMatchObject({ slot: NEW_BOOK_EXPERIMENT.slot, approval: NEW_BOOK_EXPERIMENT.approval, sourceHead: 'a'.repeat(40) });
    expect(experimentClaimFile(newBookConfig(file)).startsWith(path.join(root, 'git-common'))).toBe(true);
    mkdirSync(path.join(root, 'other-parent'));
    writeFileSync(file, JSON.stringify({ ...config, parent: path.join(root, 'other-parent') }));
    const t = textTransports();
    await expect(run(t)).rejects.toThrow('new_book_slot_used');
    expect([t.opus, t.reader, t.responses].map(f => f.mock.calls.length)).toEqual([0, 0, 0]);
    expect(readdirSync(path.join(root, 'other-parent'))).toEqual([]);
    // Every later stage under the moved configuration is refused too.
    await expect(runNewBookChild({ config: newBookConfig(file), signal: new AbortController().signal, log: () => {}, adapters: childAdapters() })).rejects.toThrow('new_book_claim');
    await expect(writeNewBookGrant(newBookConfig(file))).rejects.toThrow('new_book_claim');
  });
  it('a configuration edited after the claim (design, request, pin) cannot continue the experiment', async () => {
    await run();
    for (const edit of [{ childDesign: `${config.childDesign} With round glasses.` }, { seed: 'another-seed' }, { sourceHead: 'b'.repeat(40) }]) {
      writeFileSync(file, JSON.stringify({ ...config, ...edit }));
      await expect(runNewBookChild({ config: newBookConfig(file), signal: new AbortController().signal, log: () => {}, adapters: childAdapters() }),
        JSON.stringify(edit)).rejects.toThrow('new_book_claim');
    }
    expect(existsSync(path.join(experimentDir(config), 'child'))).toBe(false);
  });
  it('the approval excludes Dini: refused in plan and before any claim or call; other registry companions are allowed', async () => {
    writeFileSync(file, JSON.stringify({ ...config, request: { ...config.request as object, companion: { id: 'dragon_dini' } } }));
    await expect(newBookExperimentCLI(['--config', file, 'plan'])).rejects.toThrow('new_book_companion_scope');
    const t = textTransports();
    await expect(run(t)).rejects.toThrow('new_book_companion_scope');
    expect(existsSync(experimentClaimFile(newBookConfig(file)))).toBe(false);
    expect(t.opus).not.toHaveBeenCalled();
    writeFileSync(file, JSON.stringify({ ...config, request: { ...config.request as object, companion: { id: 'fox_uri' } } }));
    expect(await newBookExperimentCLI(['--config', file, 'plan'])).toMatchObject({ plan: { companion: 'fox_uri', claimed: false } });
  });
  it('a slot folder that already exists is refused before the claim, so it never consumes the approval', async () => {
    mkdirSync(experimentDir(config));
    const t = textTransports();
    await expect(run(t)).rejects.toThrow('new_book_slot_used');
    expect(existsSync(experimentClaimFile(newBookConfig(file)))).toBe(false);
    expect(t.opus).not.toHaveBeenCalled();
  });
  it('the CLI accepts --resume only for an executed audition', async () => {
    for (const argv of [['plan', '--resume'], ['text', '--execute', '--resume'], ['audition', '--resume'], ['audition', '--execute', '--execute']])
      await expect(newBookExperimentCLI(['--config', file, ...argv]), argv.join(' ')).rejects.toThrow('new_book_arguments');
  });
});

describe('fences, ledger and sample selection', () => {
  it('refuses a configuration for another slot, a relative path, or an output inside the source tree or git metadata', () => {
    const write = (c: unknown) => { writeFileSync(file, JSON.stringify(c)); return file; };
    expect(() => newBookConfig(write({ ...config, experiment: 'new-book-20261013' }))).toThrow();
    expect(() => newBookConfig(write({ ...config, keyEnvFile: 'relative.env' }))).toThrow('new_book_config');
    expect(() => newBookConfig(write({ ...config, parent: path.join(process.cwd(), 'scripts') }))).toThrow('new_book_inside_source');
    expect(() => newBookConfig(write({ ...config, parent: path.join(root, 'git-common') }))).toThrow('new_book_inside_source');
    expect(() => newBookConfig(write({ ...config, extra: 1 }))).toThrow();
  });
  it('a changed or dirty source, or a changed executable, stops before any slot is created', async () => {
    vi.mocked(frozen.gitAt).mockImplementation((_repo, args) => Buffer.from(args.join(' ') === 'rev-parse HEAD' ? 'b'.repeat(40)
      : args.join(' ') === 'status --porcelain' ? '' : path.join(root, 'git-common')));
    await expect(run()).rejects.toThrow('new_book_source_changed');
    expect(existsSync(experimentDir(config))).toBe(false);
    vi.mocked(frozen.gitAt).mockImplementation((_repo, args) => Buffer.from(args.join(' ') === 'rev-parse HEAD' ? 'a'.repeat(40)
      : args.join(' ') === 'status --porcelain' ? '' : path.join(root, 'git-common')));
    writeFileSync(config.executable, 'changed');
    await expect(runNewBookText({ config: newBookConfig(file), signal: new AbortController().signal, log: () => {}, contracts: {},
      transports: { reader: textTransports().reader } })).rejects.toThrow('new_book_executable_changed');
    expect(existsSync(experimentDir(config))).toBe(false);
  });
  it('a stage ledger with an unknown outcome, or a spend record that does not match its journal, is refused', async () => {
    await run();
    const textDir = path.join(experimentDir(config), 'text');
    const spend = json(path.join(textDir, 'spend.json'));
    writeFileSync(path.join(textDir, 'spend.json'), JSON.stringify({ ...spend, newKnownApiMicroUsd: 1 }));
    expect(() => stageLedger(textDir, 4, 0, 0, stageRules.text)).toThrow('new_book_ledger_record');
    writeFileSync(path.join(textDir, 'spend.json'), JSON.stringify(spend));
    writeFileSync(path.join(textDir, 'paid-stages', 'extra.claim.json'), JSON.stringify({ step: 'extra', seq: 9, wireDigest: 'a'.repeat(64), maximumMicroUsd: 5 }));
    expect(() => stageLedger(textDir, 4, 0, 0, stageRules.text)).toThrow('new_book_ledger_unknown');
    // A settled call of a step with no pricing rule here is refused, never skipped (its cost could not be re-derived).
    const wire = { step: 'extra' }, wireDigest = sha(canonicalJson(wire)), paidDir = path.join(textDir, 'paid-stages');
    writeFileSync(path.join(paidDir, 'extra.wire.json'), JSON.stringify(wire));
    writeFileSync(path.join(paidDir, 'extra.claim.json'), JSON.stringify({ step: 'extra', seq: 9, wireDigest, maximumMicroUsd: 5 }));
    writeFileSync(path.join(paidDir, 'extra.receipt.json'), JSON.stringify({ estimatedMicroUsd: 3 }));
    writeFileSync(path.join(paidDir, 'extra.result.json'), JSON.stringify({ wireDigest, estimatedMicroUsd: 3, completed: true }));
    writeFileSync(path.join(textDir, 'spend.json'), JSON.stringify(new AuditionMeter(paidDir, 7000000, 4).snapshot()));
    expect(() => stageLedger(textDir, 4, 0, 0, stageRules.text)).toThrow(/^new_book_ledger_rule$/);
  });
  it('the sample is the earliest same-scene pair of narrative pages; without one, pages 1 and 2', () => {
    const book = (scenes: string[]) => ({ narrativeSpreads: scenes.length, sequence: { pages: scenes.map((sceneId, i) => ({ pageNumber: i + 1, sceneId })) } }) as any;
    expect(earliestSameScenePair(book(['a', 'a', 'b', 'b', 'c', 'c', 'd', 'd']))).toEqual([1, 2]);
    expect(earliestSameScenePair(book(['a', 'b', 'c', 'c', 'd', 'e', 'f', 'g']))).toEqual([3, 4]);
    expect(earliestSameScenePair(book(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']))).toEqual([1, 2]);
  });
  it('plan is provider-free and writes nothing', async () => {
    const out = await newBookExperimentCLI(['--config', file, 'plan']);
    expect(out).toMatchObject({ mode: 'plan', plan: { experiment: NEW_BOOK_EXPERIMENT.slot, pages: 8, providerCalls: 0, keyRead: false,
      contracts: NEW_BOOK_EXPERIMENT.contracts, apiCapMicroUsd: 7000000, stages: { text: null, child: null, grant: false } } });
    expect(existsSync(experimentDir(config))).toBe(false);
    // Without --execute a paid stage only plans.
    expect(await newBookExperimentCLI(['--config', file, 'text'])).toMatchObject({ mode: 'plan' });
    expect(existsSync(experimentDir(config))).toBe(false);
  });
  it('a changed source stops the child stage before its folder exists', async () => {
    await run();
    vi.mocked(frozen.gitAt).mockImplementation((_repo, args) => Buffer.from(args.join(' ') === 'rev-parse HEAD' ? 'b'.repeat(40)
      : args.join(' ') === 'status --porcelain' ? '' : path.join(root, 'git-common')));
    await expect(runNewBookChild({ config: newBookConfig(file), signal: new AbortController().signal, log: () => {}, adapters: childAdapters() }))
      .rejects.toThrow('new_book_source_changed');
    expect(existsSync(path.join(experimentDir(config), 'child'))).toBe(false);
  });
});

describe('the reviewed-audition loader on a book layout (routing only; every binding recomputed)', () => {
  it('the saved moments marker must be the current contract version', () => {
    expect(savedMomentContract(undefined)).toBeUndefined();
    expect(savedMomentContract({})).toBeUndefined();
    expect(savedMomentContract({ moments: { version: STORYBOARD_MOMENTS_VERSION } })).toBe(true);
    expect(() => savedMomentContract({ moments: { version: 'storyboard-moments/v0' } })).toThrow('audition_board_binding');
    expect(() => savedMomentContract({ moments: {} })).toThrow('audition_board_binding');
  });
  it('a layout file is refused when relative, extended, escaping its book or naming an unsafe image', () => {
    const write = (value: unknown) => { const target = path.join(root, 'layout.json'); writeFileSync(target, JSON.stringify(value)); return target; };
    const good = experimentLayout(config, 'reference_child.png');
    expect(readReviewedBookLayout(write(good))).toEqual(good);
    expect(() => readReviewedBookLayout('layout.json')).toThrow('audition_layout');
    for (const bad of [{ ...good, extra: 1 }, { ...good, storyboardDir: '..' }, { ...good, childDir: '../other' }, { ...good, childImage: '../x.png' },
      { ...good, childDesign: 'short' }, { ...good, savedCompanion: '../illustrations/x.png' }, { ...good, version: 'reviewed-book-layout/v2' }])
      expect(() => readReviewedBookLayout(write(bad)), JSON.stringify(bad)).toThrow('audition_layout');
  });
  it('a saved companion copy that differs from the registry card is refused', async () => {
    await run(); await runNewBookChild({ config: newBookConfig(file), signal: new AbortController().signal, log: () => {}, adapters: childAdapters() });
    const dir = experimentDir(config), layout = readReviewedBookLayout(path.join(dir, 'book-layout.json'));
    expect(() => loadReviewedBook(dir, process.cwd(), undefined, layout)).not.toThrow();
    expect(() => loadReviewedBook(dir, process.cwd(), undefined, { ...layout, savedCompanion: 'child/illustrations/reference_child.png' }))
      .toThrow('audition_companion_reference');
  });
});

describe('F4 residual: the guard is re-checked right before every claim (asynchronous preparation, in-flight calls, the repair edit)', () => {
  /** A source that becomes invalid at a chosen moment; key reads counted. Synthetic only: no provider, no real key. */
  async function bench() {
    const dir = mkdtempSync(path.join(root, 'guard-')), images = path.join(dir, 'illustrations'); mkdirSync(images);
    const write = async (name: string, shade: number) => { const bytes = await png(shade); writeFileSync(path.join(images, name), bytes);
      return { imageName: name, imageSha: createHash('sha256').update(bytes).digest('hex') }; };
    const candidate = await write('candidate.png', 10), refs = [await write('ref_a.png', 20), await write('ref_b.png', 30)];
    const state = { invalid: false, armMetadata: false, keyReads: 0 };
    const guard = () => { if (state.invalid) throw Object.assign(new Error('new_book_source_changed'), { code: 'new_book_source_changed' }); };
    const key = () => { state.keyReads++; return 'sk-synthetic-test-value-not-a-credential-000'; };
    // The moment Codex used: the source changes while the judge's image metadata is being read (crop preparation, before any claim).
    const metadata = sharp.prototype.metadata;
    vi.spyOn(sharp.prototype, 'metadata').mockImplementation(async function (this: unknown, ...a: unknown[]) {
      const result = await (metadata as (...x: unknown[]) => Promise<unknown>).apply(this, a); if (state.armMetadata) state.invalid = true; return result; } as never);
    const meter = new AuditionMeter(path.join(dir, 'paid-stages'), 7000000, 10);
    return { dir, images, candidate, refs, state, guard, key, meter };
  }
  const reviewFor = (payload: any, withIssues: boolean) => {
    const text = JSON.parse(payload.input[0].content[0].text);
    return { model: 'gpt-6.1-sol', service_tier: 'default', status: 'completed', usage: { input_tokens: 5000, output_tokens: 800 },
      output_text: JSON.stringify({ candidateSha: text.candidateSha, contextSha: text.contextSha,
        checks: QUALITY_CATEGORIES.map(category => ({ category, verdict: 'pass', observation: `${category} ok`, correction: '', ...(withIssues ? { issues: [] } : {}) })) }) };
  };
  const claimsIn = (dir: string) => existsSync(path.join(dir, 'paid-stages')) ? claims(path.join(dir, 'paid-stages')) : [];

  describe('reviewed-audition judge', () => {
    const judgeOnce = (b: Awaited<ReturnType<typeof bench>>, step: string) => auditionAdapters({ directory: b.images, meter: b.meter, key: b.key,
      signal: new AbortController().signal, guard: b.guard }).judge(step, b.candidate, { role: 'entities' }, 'c'.repeat(64), b.refs, null, 'sheet');
    beforeEach(() => { sdk.create.mockImplementation(async (payload: any) => reviewFor(payload, true)); });
    it('1) unchanged source: one review, completed with its known cost', async () => {
      const b = await bench();
      await judgeOnce(b, 'sheet_entities_0_qa');
      expect(claimsIn(b.dir)).toEqual(['sheet_entities_0_qa']);
      expect(json(path.join(b.dir, 'paid-stages', 'sheet_entities_0_qa.result.json'))).toMatchObject({ completed: true, estimatedMicroUsd: expect.any(Number) });
      expect([sdk.create.mock.calls.length, b.state.keyReads]).toEqual([1, 1]);
    });
    it('2) source invalid at entry: no claim, no key read, no call', async () => {
      const b = await bench(); b.state.invalid = true;
      await expect(judgeOnce(b, 'sheet_entities_0_qa')).rejects.toThrow('new_book_source_changed');
      expect([claimsIn(b.dir).length, b.state.keyReads, sdk.create.mock.calls.length]).toEqual([0, 0, 0]);
    });
    it('3) source changes during crop preparation: no claim, no key read, no call', async () => {
      const b = await bench(); b.state.armMetadata = true;
      await expect(judgeOnce(b, 'sheet_entities_0_qa')).rejects.toThrow('new_book_source_changed');
      expect(b.state.invalid).toBe(true);
      expect([claimsIn(b.dir).length, b.state.keyReads, sdk.create.mock.calls.length]).toEqual([0, 0, 0]);
    });
    it('4) source changes during a dispatched call: that response and its cost are kept; the next call is refused before its claim', async () => {
      const b = await bench();
      sdk.create.mockImplementation(async (payload: any) => { b.state.invalid = true; return reviewFor(payload, true); });
      await judgeOnce(b, 'sheet_entities_0_qa');
      expect(json(path.join(b.dir, 'paid-stages', 'sheet_entities_0_qa.result.json'))).toMatchObject({ completed: true, estimatedMicroUsd: expect.any(Number) });
      await expect(judgeOnce(b, 'sheet_entities_1_qa')).rejects.toThrow('new_book_source_changed');
      expect(claimsIn(b.dir)).toEqual(['sheet_entities_0_qa']);
      expect(new AuditionMeter(path.join(b.dir, 'paid-stages'), 7000000, 10).snapshot()).toMatchObject({ calls: 1, unknownCost: 0, unknownOutcome: 0, failed: 0 });
    });
    it('without a guard (legacy route) the same review is unchanged', async () => {
      const b = await bench();
      await auditionAdapters({ directory: b.images, meter: b.meter, key: b.key, signal: new AbortController().signal })
        .judge('sheet_entities_0_qa', b.candidate, { role: 'entities' }, 'c'.repeat(64), b.refs, null, 'sheet');
      expect(claimsIn(b.dir)).toEqual(['sheet_entities_0_qa']);
    });
  });

  it('the child-reference judge: a change during its image preparation claims nothing', async () => {
    const b = await bench(); b.state.armMetadata = true;
    sdk.create.mockImplementation(async (payload: any) => reviewFor(payload, false));
    const judge = createSimpleBookPixelJudge({ config: { reviewModel: 'gpt-6.1-sol' }, directory: b.images, budget: b.meter, key: b.key,
      assertCurrent: b.guard, signal: new AbortController().signal, save: () => {} });
    const context = simpleReferenceDesignContext({ fictionalDesign: 'synthetic' });
    await expect(judge('reference_child_qa', b.candidate, context, createHash('sha256').update(JSON.stringify(context)).digest('hex'), [], null))
      .rejects.toThrow('new_book_source_changed');
    expect([claimsIn(b.dir).length, b.state.keyReads, sdk.create.mock.calls.length]).toEqual([0, 0, 0]);
  });

  it('the child repair edit is guarded: a source change during the first judgment keeps its cost, names the cause and refuses the repair before its claim', async () => {
    await run();
    vi.spyOn(images, 'generateGPTImage').mockImplementation(async input => {
      const buffer = await png(30, 1024), usage = { input_tokens: 100, output_tokens: 300 };
      input.observeProviderResponse?.({ data: [{ b64_json: buffer.toString('base64') }], usage });
      return { buffer, usage, model: 'gpt-image-2', finalPrompt: input.finalPrompt, hasReferencePhoto: false, apiMode: 'images.generate',
        referenceCountRequested: 0, referenceCountPassed: 0, durationMs: 1, fallbackUsed: false } as never;
    });
    sdk.create.mockImplementation(async (payload: any) => {
      const text = JSON.parse(payload.input[0].content[0].text);
      // An evidenced defect asks for the repair edit, while the source moves during this judgment.
      vi.mocked(frozen.gitAt).mockImplementation((_repo, args) => Buffer.from(args.join(' ') === 'rev-parse HEAD' ? 'b'.repeat(40)
        : args.join(' ') === 'status --porcelain' ? '' : path.join(root, 'git-common')));
      return { model: 'gpt-6.1-sol', service_tier: 'default', status: 'completed', usage: { input_tokens: 5000, output_tokens: 800 },
        output_text: JSON.stringify(passing(text.candidateSha, text.contextSha, { category: 'anatomy', verdict: 'defect' })) };
    });
    await expect(runNewBookChild({ config: newBookConfig(file), signal: new AbortController().signal, log: () => {} })).rejects.toThrow('new_book_source_changed');
    const childDir = path.join(experimentDir(config), 'child');
    expect(claims(path.join(childDir, 'paid-stages'))).toEqual(['reference_child', 'reference_child_qa']);
    // The shared reference judge does not use a judgment once the source changed during it (unchanged rule); its cost is kept, its cause named.
    expect(json(path.join(childDir, 'paid-stages', 'reference_child_qa.result.json'))).toMatchObject({ completed: false, estimatedMicroUsd: expect.any(Number) });
    expect(json(path.join(childDir, 'paid-stages', 'reference_child_qa.failure.json'))).toMatchObject({ code: 'new_book_source_changed' });
    expect(vi.mocked(images.generateGPTImage)).toHaveBeenCalledTimes(1);
    expect(json(path.join(childDir, 'sealed.json'))).toMatchObject({ status: 'failed', code: 'new_book_source_changed' });
  });
});

describe('F4 residual: the repair edit after a settled judgment', () => {
  it('a source change after the first judgment settles refuses the repair edit before its claim; the judgment stays completed', async () => {
    await run();
    vi.spyOn(images, 'generateGPTImage').mockImplementation(async input => {
      const buffer = await png(30, 1024), usage = { input_tokens: 100, output_tokens: 300 };
      input.observeProviderResponse?.({ data: [{ b64_json: buffer.toString('base64') }], usage });
      return { buffer, usage, model: 'gpt-image-2', finalPrompt: input.finalPrompt, hasReferencePhoto: false, apiMode: 'images.generate',
        referenceCountRequested: 0, referenceCountPassed: 0, durationMs: 1, fallbackUsed: false } as never;
    });
    sdk.create.mockImplementation(async (payload: any) => {
      const text = JSON.parse(payload.input[0].content[0].text);
      return { model: 'gpt-6.1-sol', service_tier: 'default', status: 'completed', usage: { input_tokens: 5000, output_tokens: 800 },
        output_text: JSON.stringify(passing(text.candidateSha, text.contextSha, { category: 'anatomy', verdict: 'defect' })) };
    });
    // The stage logs the settled judgment, then orders the repair edit: the source moves exactly between the two.
    const log = (line: string) => { if (line === 'child reference: repair') vi.mocked(frozen.gitAt).mockImplementation((_repo, args) =>
      Buffer.from(args.join(' ') === 'rev-parse HEAD' ? 'b'.repeat(40) : args.join(' ') === 'status --porcelain' ? '' : path.join(root, 'git-common'))); };
    await expect(runNewBookChild({ config: newBookConfig(file), signal: new AbortController().signal, log })).rejects.toThrow('new_book_source_changed');
    const childDir = path.join(experimentDir(config), 'child');
    expect(claims(path.join(childDir, 'paid-stages'))).toEqual(['reference_child', 'reference_child_qa']);
    expect(json(path.join(childDir, 'paid-stages', 'reference_child_qa.result.json'))).toMatchObject({ completed: true, estimatedMicroUsd: expect.any(Number) });
    expect(vi.mocked(images.generateGPTImage)).toHaveBeenCalledTimes(1);
    expect(json(path.join(childDir, 'sealed.json'))).toMatchObject({ status: 'failed', code: 'new_book_source_changed' });
  });
});

describe("Guy's one storyboard continuation: the paid story replayed from its bound records, only the storyboard and its review called again", { timeout: 60_000 }, () => {
  const textDirOf = () => path.join(experimentDir(config), 'text'), outOf = () => path.join(experimentDir(config), NEW_BOOK_CONTINUATION.outDir);
  const reservation = () => json(path.join(textDirOf(), 'paid-stages', 'storyboard.claim.json')).maximumMicroUsd as number;
  const child = () => runNewBookChild({ config: newBookConfig(file), signal: new AbortController().signal, log: () => {}, adapters: childAdapters() });

  it('a timed-out storyboard seals the stage failed with its own cause; its cost stays unknown and its whole reservation stays counted', async () => {
    await timedOut();
    expect(json(path.join(textDirOf(), 'sealed.json'))).toEqual({ status: 'failed', code: 'new_book_provider_timeout', runtimeEligible: false });
    expect(json(path.join(textDirOf(), 'paid-stages', 'storyboard.failure.json'))).toMatchObject({ code: 'new_book_provider_timeout',
      receipt: { estimatedMicroUsd: null, failure: { sdkError: 'APIConnectionTimeoutError', status: null, message: 'Request timed out.', transport: null },
        observed: [{ code: 'long_call_aborted', phase: 'headers', elapsedMs: 306000 }] } });
    expect(json(path.join(textDirOf(), 'spend.json'))).toMatchObject({ newKnownApiMicroUsd: 14000, reservedUnsettledMicroUsd: reservation(),
      cumulativeAccountedMicroUsd: 14000 + reservation(), calls: 3, unknownCost: 1, unknownOutcome: 0 });
    expect(json(path.join(textDirOf(), 'spend.json'))).not.toHaveProperty('carriedUnresolvedMicroUsd');
  });

  it('the preview is read-only: admissible, the paid story replays exactly to the storyboard, and nothing is written or called', async () => {
    await timedOut();
    const dir = experimentDir(config), before = tree(dir), t = textTransports();
    expect(await continuation(t, false)).toMatchObject({ mode: 'plan', plan: { continuation: false, stages: { text: 'failed', continuation: null } },
      continuation: { admissible: true, amended: false, outDirExists: false, storyReplayed: true, sameStoryboardRequest: true, priorKnownApiMicroUsd: 14000,
        carriedUnresolvedMicroUsd: reservation(), remainingUnderCapMicroUsd: 7000000 - 14000 - reservation(), providerCalls: 0, keyRead: false } });
    expect(tree(dir)).toEqual(before);
    expect(existsSync(experimentContinuationFile(config))).toBe(false);
    expect([t.opus, t.reader, t.responses, sdk.create].map(m => m.mock.calls.length)).toEqual([0, 0, 0, 0]);
  });

  it('one continuation at the reviewed HEAD: no writer, editor or reader call; the same storyboard request once, its review once; the reservation carried', async () => {
    await timedOut();
    const textDir = textDirOf(), out = outOf(), before = tree(textDir), carried = reservation();
    const request = sha(readFileSync(path.join(experimentDir(config), 'request.json')));
    headAt('c'.repeat(40));
    const t = textTransports();
    expect(await continuation(t)).toMatchObject({ mode: 'storyboard-continuation', status: 'review_supported' });
    expect([t.opus, t.reader].map(m => m.mock.calls.length)).toEqual([0, 0]);
    expect(t.responses.mock.calls.map(c => c[0].model)).toEqual(['gpt-6-astra', 'gpt-6.1-sol']);
    expect(claims(path.join(out, 'paid-stages'))).toEqual(['storyboard', 'storyboard_review']);
    // The replayed story yields exactly the request that timed out (same story, same contracts, same seed).
    expect(json(path.join(out, 'paid-stages', 'storyboard.wire.json'))).toEqual(json(path.join(textDir, 'paid-stages', 'storyboard.wire.json')));
    // Storyboard 10000 in x 10 + 5000 out x 50; review 10000 x 2 + 5000 x 10 (synthetic usage).
    expect(json(path.join(out, 'spend.json'))).toMatchObject({ priorKnownApiMicroUsd: 14000, carriedUnresolvedMicroUsd: carried, newKnownApiMicroUsd: 420000,
      reservedUnsettledMicroUsd: 0, cumulativeAccountedMicroUsd: 14000 + carried + 420000, calls: 2, maxCalls: 2, unknownCost: 0, unknownOutcome: 0 });
    expect(json(path.join(out, 'sealed.json'))).toEqual({ status: 'review_supported', continuation: NEW_BOOK_CONTINUATION.id, runtimeEligible: false });
    expect(existsSync(path.join(out, 'claude-max-spend.json'))).toBe(false);
    // The amendment binds the unchanged claim and config, both HEADs, the ledger and every original record.
    const amendment = json(experimentContinuationFile(config));
    expect(amendment).toMatchObject({ version: 'new-book-continuation/v1', id: NEW_BOOK_CONTINUATION.id, slot: NEW_BOOK_EXPERIMENT.slot,
      approval: NEW_BOOK_CONTINUATION.approval, claimSha256: sha(readFileSync(experimentClaimFile(config))), originalSourceHead: 'a'.repeat(40),
      sourceHead: 'c'.repeat(40), failedStep: 'storyboard', priorKnownApiMicroUsd: 14000, carriedUnresolvedMicroUsd: carried });
    expect(Object.fromEntries(amendment.evidence.map((e: { file: string; sha256: string }) => [e.file, e.sha256])))
      .toEqual({ 'request.json': request, ...Object.fromEntries(Object.entries(before).map(([k, v]) => [`text/${k}`, v])) });
    expect(json(experimentClaimFile(config))).toMatchObject({ sourceHead: 'a'.repeat(40) });
    expect(tree(textDir)).toEqual(before);

    // The continued text feeds the child stage and the grant, which carry the reservation as its own ledger line.
    expect(await child()).toMatchObject({ status: 'child_reference_passed' });
    const dir = experimentDir(config);
    expect(readReviewedBookLayout(path.join(dir, 'book-layout.json'))).toEqual(experimentLayout(config, 'reference_child.png', NEW_BOOK_CONTINUATION.outDir));
    const childSpend = json(path.join(dir, 'child', 'spend.json'));
    expect(childSpend).toMatchObject({ priorKnownApiMicroUsd: 434000, carriedUnresolvedMicroUsd: carried, unknownCost: 0 });
    expect(json(path.join(dir, 'child', 'sealed.json'))).toMatchObject({ status: 'child_reference_passed', priorTextApiMicroUsd: 434000, carriedUnresolvedMicroUsd: carried });
    const grant = await writeNewBookGrant(newBookConfig(file));
    expect(auditionGrantSchema.parse(grant)).toEqual(grant);
    expect(grant.ledger).toMatchObject({ priorKnownApiMicroUsd: 434000 + childSpend.newKnownApiMicroUsd, carriedUnresolvedMicroUsd: carried });
    expect(grant.ledger.evidence.map(e => e.file)).toEqual([path.join(textDir, 'spend.json'), experimentContinuationFile(config), path.join(out, 'spend.json'),
      path.join(dir, 'child', 'spend.json')]);
    expect(grant.ledger.note).toContain('unresolved reservation');
    // The grant's cap must stay above known spend plus the carried reservation; a carried line is positive or absent.
    for (const carriedUnresolvedMicroUsd of [7000000 - grant.ledger.priorKnownApiMicroUsd, 0])
      expect(auditionGrantSchema.safeParse({ ...grant, ledger: { ...grant.ledger, carriedUnresolvedMicroUsd } }).success).toBe(false);
    // The pin is now the reviewed HEAD the amendment names: the original HEAD, or any other, refuses.
    for (const head of ['a'.repeat(40), 'd'.repeat(40)]) { headAt(head); expect(() => assertExperimentClaim(newBookConfig(file))).toThrow('new_book_source_changed'); }
  });

  it('one attempt only: a continuation whose storyboard fails again is sealed failed; nothing can retry or build on it', async () => {
    await timedOut(); headAt('c'.repeat(40));
    const t = textTransports();
    t.responses.mockImplementationOnce((async () => { throw new APIConnectionTimeoutError(); }) as never);
    await expect(continuation(t)).rejects.toThrow();
    expect(json(path.join(outOf(), 'sealed.json'))).toEqual({ status: 'failed', code: 'new_book_provider_timeout', continuation: NEW_BOOK_CONTINUATION.id,
      runtimeEligible: false });
    expect(json(path.join(outOf(), 'spend.json'))).toMatchObject({ calls: 1, unknownCost: 1, carriedUnresolvedMicroUsd: reservation(),
      cumulativeAccountedMicroUsd: 14000 + 2 * reservation() });
    const again = textTransports();
    await expect(continuation(again)).rejects.toThrow('new_book_continuation_used');
    await expect(child()).rejects.toThrow('new_book_text_not_supported');
    expect([again.opus, again.reader, again.responses].map(m => m.mock.calls.length)).toEqual([0, 0, 0]);
  });

  it('only after a storyboard that never answered: a supported text stage has nothing to continue', async () => {
    await run();
    for (const execute of [false, true]) await expect(continuation(textTransports(), execute)).rejects.toThrow('new_book_continuation_scope');
    expect([existsSync(experimentContinuationFile(config)), existsSync(outOf())]).toEqual([false, false]);
  });

  it('a story record that no longer replays exactly refuses before the amendment, the folder or any call', async () => {
    await timedOut(); headAt('c'.repeat(40));
    const t = textTransports();
    for (const record of ['paid-stages/final_review.claim.json', 'paid-stages/comparison.result.json', 'claude-max-stages/author.claim.json',
      'claude-max-stages/editor.result.json']) {
      const recordFile = path.join(textDirOf(), ...record.split('/')), bytes = readFileSync(recordFile);
      writeFileSync(recordFile, JSON.stringify({ ...JSON.parse(bytes.toString('utf8')), wireDigest: 'e'.repeat(64) }));
      // A paid call's record that no longer binds its own request is refused by the ledger first (every read re-derives it); a Claude Max one at the replay.
      for (const execute of [false, true]) await expect(continuation(t, execute), record).rejects.toThrow(record.startsWith('paid-stages/')
        ? /^new_book_ledger_record$/ : /^new_book_continuation_replay$/);
      writeFileSync(recordFile, bytes);
    }
    // A saved reply is the one whose cost settled its call (a paid reply's cost is re-derived from its raw answer first).
    for (const [record, code] of [['paid-stages/comparison.receipt.json', /^new_book_ledger_cost$/],
      ['claude-max-stages/author.receipt.json', /^new_book_continuation_replay$/]] as const) {
      const recordFile = path.join(textDirOf(), ...record.split('/')), bytes = readFileSync(recordFile), saved = JSON.parse(bytes.toString('utf8'));
      writeFileSync(recordFile, JSON.stringify({ ...saved, estimatedMicroUsd: saved.estimatedMicroUsd + 1 }));
      for (const execute of [false, true]) await expect(continuation(t, execute), record).rejects.toThrow(code);
      writeFileSync(recordFile, bytes);
    }
    // A paid reader request rewritten WITH matching claim and result digests still binds itself in the ledger, but no longer replays exactly.
    const restoreReader = rewire(path.join(textDirOf(), 'paid-stages'), 'comparison', w => ({ ...w, json: swapOne(w.json) }));
    for (const execute of [false, true]) await expect(continuation(t, execute)).rejects.toThrow(/^new_book_continuation_replay$/);
    restoreReader();
    // The one retry must send exactly the storyboard request that timed out (the digest its claim recorded before that call).
    const storyboardClaim = path.join(textDirOf(), 'paid-stages', 'storyboard.claim.json'), claimBytes = readFileSync(storyboardClaim);
    writeFileSync(storyboardClaim, JSON.stringify({ ...JSON.parse(claimBytes.toString('utf8')), wireDigest: 'e'.repeat(64) }));
    for (const execute of [false, true]) await expect(continuation(t, execute)).rejects.toThrow(/^new_book_ledger_record$/);
    writeFileSync(storyboardClaim, claimBytes);
    // That request rewritten with matching digests (same length, so its carried reservation is unchanged) binds itself, but is not the one that timed out.
    const restoreStoryboard = rewire(path.join(textDirOf(), 'paid-stages'), 'storyboard', w => ({ ...w, instructions: swapOne(w.instructions) }));
    for (const execute of [false, true]) await expect(continuation(t, execute)).rejects.toThrow(/^new_book_continuation_request$/);
    restoreStoryboard();
    expect([existsSync(experimentContinuationFile(config)), existsSync(outOf())]).toEqual([false, false]);
    expect([t.opus, t.reader, t.responses].map(m => m.mock.calls.length)).toEqual([0, 0, 0]);
    // Restored exactly, the same records replay.
    expect(await continuation(t, false)).toMatchObject({ continuation: { admissible: true } });
  });

  it('an edited Opus instruction file refuses the replay (the saved reply belongs to the exact instructions)', async () => {
    await timedOut(); headAt('c'.repeat(40));
    const instructions = path.join(textDirOf(), 'editor-instructions.txt');
    writeFileSync(instructions, readFileSync(instructions, 'utf8') + ' ');
    await expect(continuation(textTransports(), false)).rejects.toThrow('new_book_continuation_replay');
  });

  it('after the amendment, a changed original record, a dirty tree, an edited config or a disagreeing ledger refuses every later stage', async () => {
    await continued();
    const receipt = path.join(textDirOf(), 'paid-stages', 'comparison.receipt.json'), bytes = readFileSync(receipt);
    writeFileSync(receipt, Buffer.concat([bytes, Buffer.from(' ')]));
    await expect(child()).rejects.toThrow('new_book_continuation_evidence');
    writeFileSync(receipt, bytes);
    headAt('c'.repeat(40), ' M scripts/personal-new-book-experiment.ts');
    await expect(child()).rejects.toThrow('new_book_source_changed');
    headAt('c'.repeat(40));
    writeFileSync(file, JSON.stringify({ ...config, seed: 'another-seed' }));
    await expect(child()).rejects.toThrow('new_book_claim');
    writeFileSync(file, JSON.stringify(config));
    // The amendment's own record of the ledger must still match the original stage.
    const amendmentFile = experimentContinuationFile(config), amendment = readFileSync(amendmentFile);
    writeFileSync(amendmentFile, JSON.stringify({ ...JSON.parse(amendment.toString('utf8')), carriedUnresolvedMicroUsd: 1 }));
    await expect(child()).rejects.toThrow('new_book_continuation_ledger');
    writeFileSync(amendmentFile, amendment);
    expect(await child()).toMatchObject({ status: 'child_reference_passed' });
  });

  it('a dirty tree or an edited config refuses before the amendment is written', async () => {
    await timedOut();
    headAt('c'.repeat(40), ' M scripts/personal-new-book-experiment.ts');
    for (const execute of [false, true]) await expect(continuation(textTransports(), execute)).rejects.toThrow('new_book_source_changed');
    headAt('c'.repeat(40));
    writeFileSync(file, JSON.stringify({ ...config, seed: 'another-seed' }));
    await expect(continuation()).rejects.toThrow('new_book_claim');
    expect([existsSync(experimentContinuationFile(config)), existsSync(outOf())]).toEqual([false, false]);
  });

  it('the record the paid run actually wrote (before the transport fix) is admitted exactly as it is', async () => {
    await timedOut();
    // The real first run: the SDK's generic failure with its timeout message and no answer; the stage sealed with the transport code.
    const failure = path.join(textDirOf(), 'paid-stages', 'storyboard.failure.json'), sealed = path.join(textDirOf(), 'sealed.json');
    writeFileSync(failure, JSON.stringify({ code: 'audition_stage_failed', message: 'Request timed out.', receipt: null }, null, 2));
    writeFileSync(sealed, JSON.stringify({ status: 'failed', code: 'new_book_provider_transport', runtimeEligible: false }, null, 2));
    expect(await continuation(textTransports(), false)).toMatchObject({ continuation: { admissible: true, storyReplayed: true } });
    headAt('c'.repeat(40));
    expect(await continuation()).toMatchObject({ status: 'review_supported' });
    expect(json(experimentContinuationFile(config)).evidence).toEqual(expect.arrayContaining([{ file: 'text/paid-stages/storyboard.failure.json',
      sha256: sha(readFileSync(failure)) }, { file: 'text/sealed.json', sha256: sha(readFileSync(sealed)) }]));
  });

  it('only the timed-out storyboard: an answer from another model, another failure of that record or a reader failure has nothing to continue', async () => {
    await expect(run(textTransports({ model: 'gpt-6-astra-mini' }))).rejects.toThrow();
    expect(json(path.join(textDirOf(), 'sealed.json'))).toMatchObject({ status: 'failed' });
    for (const execute of [false, true]) await expect(continuation(textTransports(), execute)).rejects.toThrow('new_book_continuation_scope');
    // The legacy record qualifies only with its timeout message and no answer.
    const failure = path.join(textDirOf(), 'paid-stages', 'storyboard.failure.json');
    for (const record of [{ code: 'audition_stage_failed', message: 'Connection error.', receipt: null },
      { code: 'audition_stage_failed', message: 'Request timed out.', receipt: { raw: {} } }, { code: 'new_book_provider_transport', message: 'x', receipt: null }]) {
      writeFileSync(failure, JSON.stringify(record));
      await expect(continuation(textTransports(), false)).rejects.toThrow('new_book_continuation_scope');
    }
    expect([existsSync(experimentContinuationFile(config)), existsSync(outOf())]).toEqual([false, false]);
  });
  it('a reader failure (no storyboard call at all) has nothing to continue', async () => {
    const t = textTransports();
    t.reader.mockImplementationOnce(async () => { throw Object.assign(Error('synthetic reader failure'), { code: 'synthetic_reader' }); });
    await expect(run(t)).rejects.toThrow();
    for (const execute of [false, true]) await expect(continuation(textTransports(), execute)).rejects.toThrow('new_book_continuation_scope');
    expect([existsSync(experimentContinuationFile(config)), existsSync(outOf())]).toEqual([false, false]);
  });

  it('a spend record that disagrees with its journal, or a rewritten claim, refuses', async () => {
    await timedOut();
    const spend = path.join(textDirOf(), 'spend.json'), bytes = readFileSync(spend);
    writeFileSync(spend, JSON.stringify({ ...JSON.parse(bytes.toString('utf8')), reservedUnsettledMicroUsd: 1 }));
    await expect(continuation(textTransports(), false)).rejects.toThrow('new_book_ledger_record');
    writeFileSync(spend, bytes);
    headAt('c'.repeat(40));
    await continuation();
    // A claim rewritten for the same configuration is not the claim the amendment bound.
    const claim = experimentClaimFile(config);
    writeFileSync(claim, JSON.stringify({ ...json(claim), requestId: 'f'.repeat(64) }, null, 2));
    await expect(child()).rejects.toThrow('new_book_continuation');
  });

  it('the meter carries an unresolved reservation by policy: never negative, never at the cap with known spend, counted before every claim', async () => {
    const meterDir = path.join(root, 'meter');
    expect(() => new AuditionMeter(meterDir, 7000000, 2, 1000, -1)).toThrow('audition_meter_policy');
    expect(() => new AuditionMeter(meterDir, 7000000, 2, 5000000, 2000000)).toThrow('audition_meter_policy');
    expect(new AuditionMeter(meterDir, 7000000, 2).snapshot()).not.toHaveProperty('carriedUnresolvedMicroUsd');
    const meter = new AuditionMeter(meterDir, 7000000, 2, 5000000, 1500000);
    expect(meter.snapshot()).toMatchObject({ carriedUnresolvedMicroUsd: 1500000, cumulativeAccountedMicroUsd: 6500000 });
    const dispatch = vi.fn(async () => ({ value: 1, estimatedMicroUsd: 1, receipt: {} }));
    await expect(meter.run('over', {}, 500001, dispatch)).rejects.toThrow('audition_budget_exhausted');
    expect([dispatch.mock.calls.length, readdirSync(meterDir).length]).toEqual([0, 0]);
    await meter.run('within', {}, 500000, dispatch);
    expect(meter.snapshot()).toMatchObject({ newKnownApiMicroUsd: 1, cumulativeAccountedMicroUsd: 6500001 });
  });

  it('the provider clients use the long-call transport (never the 300 s default header wait) with no SDK retry', async () => {
    const t = textTransports();
    let readerOptions: { fetch?: typeof fetch } | null = null;
    vi.spyOn(causalAdapters, 'createAstraCausalTransport').mockImplementation(options => { readerOptions = options; return t.reader as never; });
    sdk.create.mockImplementation(t.responses);
    // Only the Opus transport is synthetic here: the readers' and the storyboard's own clients are built by the stage.
    expect(await run({ opus: t.opus })).toMatchObject({ status: 'review_supported' });
    expect(sdk.create).toHaveBeenCalledTimes(2);
    expect(sdk.create.mock.calls.map(c => c[1])).toEqual([0, 1].map(() => ({ signal: expect.any(AbortSignal), timeout: expect.any(Number) })));
    expect(sdk.clients).toHaveLength(2);
    // Each fetch is the long-call transport, not the global fetch: it refuses a plain-http provider address before any network.
    for (const client of sdk.clients) {
      expect(client).toMatchObject({ baseURL: 'https://api.openai.com/v1', maxRetries: 0 });
      await expect((client.fetch as typeof fetch)('http://api.openai.com/v1/responses')).rejects.toThrow('long_call_url');
    }
    await expect(readerOptions!.fetch!('http://api.openai.com/v1/responses')).rejects.toThrow('long_call_url');
  });
});

describe('HOLD F1/F2 correction: one pinned HEAD and the complete request record, checked before anything is consumed', { timeout: 120_000 }, () => {
  const outOf = () => path.join(experimentDir(config), NEW_BOOK_CONTINUATION.outDir);
  const receiptFile = () => path.join(experimentDir(config), 'text', 'paid-stages', 'comparison.receipt.json');
  const nothingConsumed = () => expect([existsSync(experimentContinuationFile(config)), existsSync(outOf())]).toEqual([false, false]);
  /** HEAD for the n-th HEAD read, and the tree status for the n-th status read (both counted from 1). */
  const sequence = (head: (n: number) => string, status: (n: number) => string = () => '') => {
    let heads = 0, statuses = 0;
    vi.mocked(frozen.gitAt).mockImplementation((_repo, args) => Buffer.from(args.join(' ') === 'rev-parse HEAD' ? head(++heads)
      : args.join(' ') === 'status --porcelain' ? status(++statuses) : path.join(root, 'git-common')));
  };

  it("Codex's counterexample: the HEAD the replay was admitted at is the only authority; a later clean HEAD refuses before anything is consumed", async () => {
    await timedOut();
    sequence(n => n <= 2 ? 'c'.repeat(40) : 'd'.repeat(40));
    const t = textTransports();
    await expect(continuation(t)).rejects.toThrow('new_book_source_changed');
    nothingConsumed();
    expect([t.opus, t.reader, t.responses, sdk.create].map(m => m.mock.calls.length)).toEqual([0, 0, 0, 0]);
  });

  it('every source or record change after admission, up to and just past the amendment, refuses: before it, nothing is consumed; after it, no call', async () => {
    type Event = 'head' | 'dirty' | 'request' | 'receipt' | 'claim';
    const resetSlot = () => { for (const d of [experimentDir(config), path.dirname(experimentClaimFile(config))]) {
      if (!path.resolve(d).startsWith(path.resolve(root))) throw Error('reset_boundary'); rmSync(d, { recursive: true, force: true }); } };
    async function boundaryRun(event: Event | null, at: number) {
      await eventLoopTurn();
      resetSlot(); headAt('a'.repeat(40)); await timedOut();
      const dir = experimentDir(config), amendmentFile = experimentContinuationFile(config);
      const before = { 'request.json': sha(readFileSync(path.join(dir, 'request.json'))),
        ...Object.fromEntries(Object.entries(tree(path.join(dir, 'text'))).map(([k, v]) => [`text/${k}`, v])) };
      let reads = 0, fired = false;
      const amendedAtRead: boolean[] = [];
      const fire = () => {
        fired = true;
        if (event === 'request') { const f = path.join(dir, 'request.json'); writeFileSync(f, JSON.stringify({ ...json(f), requestId: 'f'.repeat(64) })); }
        if (event === 'receipt') writeFileSync(receiptFile(), readFileSync(receiptFile(), 'utf8') + ' ');
        // The same claim re-serialized: its meaning is unchanged, but it is no longer the claim the replay was admitted under.
        if (event === 'claim') writeFileSync(experimentClaimFile(config), JSON.stringify(json(experimentClaimFile(config)), null, 4));
      };
      vi.mocked(frozen.gitAt).mockImplementation((_repo, args) => {
        const a = args.join(' ');
        if (a === 'rev-parse HEAD') {
          reads++; amendedAtRead.push(existsSync(amendmentFile));
          if (event && reads === at) fire();
          return Buffer.from(fired && event === 'head' ? 'd'.repeat(40) : 'c'.repeat(40));
        }
        return Buffer.from(a === 'status --porcelain' ? (fired && event === 'dirty' ? ' M scripts/personal-new-book-experiment.ts' : '') : path.join(root, 'git-common'));
      });
      const t = textTransports(), real = t.responses.getMockImplementation()!, afterEvent: string[] = [];
      t.responses.mockImplementation((async (payload: any, ...rest: unknown[]) => { if (fired) afterEvent.push(payload.model); return (real as any)(payload, ...rest); }) as never);
      const outcome = await continuation(t).then(() => 'ok', (error: Error) => error.message);
      return { outcome, reads, amendedAtRead, afterEvent, before, opusOrReader: t.opus.mock.calls.length + t.reader.mock.calls.length,
        amendment: existsSync(amendmentFile) ? json(amendmentFile) : null, folder: existsSync(outOf()) };
    }
    // Calibration: an unchanged run succeeds; count the HEAD reads made before the amendment is written.
    const calm = await boundaryRun(null, 0);
    expect(calm.outcome).toBe('ok');
    const beforeWrite = calm.amendedAtRead.indexOf(true);
    // At least: the run's one capture, the admission, the check after the asynchronous replay, and the amendment's own re-check.
    expect(beforeWrite).toBeGreaterThanOrEqual(4);
    const codes: Record<Event, RegExp> = { head: /^new_book_source_changed$/, dirty: /^new_book_source_changed$/,
      request: /^new_book_continuation_(request_record|evidence)$/, receipt: /^new_book_continuation_evidence$/, claim: /^new_book_continuation(_evidence)?$/ };
    // Read 1 is the capture itself (a run started at another HEAD is simply that HEAD). Read 2 opens the admission (its source check comes
    // first, then it reads the claim and hashes the records): a record changed there is what is admitted and replayed, so record changes
    // count from read 3. Every baseline checks the source first, so a change at a baseline's opening read is caught by that same baseline.
    // A corrupt request record is refused at any read.
    const first: Record<Event, number> = { head: 2, dirty: 2, request: 2, receipt: 3, claim: 3 };
    for (const event of ['head', 'dirty', 'request', 'receipt', 'claim'] as Event[]) for (let at = first[event]; at <= beforeWrite + 1; at++) {
      const r = await boundaryRun(event, at), label = `${event}@${at}`;
      expect(`${label}: ${r.outcome}`).toMatch(new RegExp(`^${label}: ${codes[event].source.slice(1, -1)}$`));
      expect(`${label}: ${r.afterEvent.length} calls after the change, ${r.opusOrReader} story calls`).toBe(`${label}: 0 calls after the change, 0 story calls`);
      if (at <= beforeWrite) {
        expect(`${label}: amendment ${!!r.amendment}, folder ${r.folder}`).toBe(`${label}: amendment false, folder false`);
        continue;
      }
      // After the amendment the one attempt may already be spent, but nothing is claimed or called: the folder, if made, is sealed failed.
      if (r.folder) expect([label, json(path.join(outOf(), 'sealed.json')).status, json(path.join(outOf(), 'sealed.json')).code, claims(path.join(outOf(), 'paid-stages'))])
        .toEqual([label, 'failed', r.outcome, []]);
      // An amendment written before the change binds the admitted HEAD and exactly the records the replay used.
      expect([label, r.amendment?.sourceHead, Object.fromEntries(r.amendment.evidence.map((e: { file: string; sha256: string }) => [e.file, e.sha256]))])
        .toEqual([label, 'c'.repeat(40), r.before]);
    }
  });

  it('the complete saved request record (and the claim that names it) is checked before anything is consumed', async () => {
    await timedOut(); headAt('c'.repeat(40));
    const dir = experimentDir(config), file = path.join(dir, 'request.json'), bytes = readFileSync(file), record = JSON.parse(bytes.toString('utf8'));
    const { optionsFingerprint: _dropped, ...withoutFingerprint } = record;
    const variants: (string | null)[] = [
      { ...record, request: { ...record.request, child: { ...record.request.child, name: 'מישהו אחר' } } },
      { ...record, requestId: 'f'.repeat(64) }, { ...record, optionsFingerprint: 'f'.repeat(64) },
      { ...record, consent: 'another_consent' }, { ...record, experiment: 'another-slot' }, { ...record, version: 'local-simple-wizard-request/v2' },
      { ...record, extra: true }, withoutFingerprint,
    ].map(v => JSON.stringify(v));
    variants.push('{ not json', null);
    const slot = tree(dir), t = textTransports();
    for (const variant of variants) {
      if (variant === null) rmSync(file); else writeFileSync(file, variant);
      for (const execute of [false, true]) await expect(continuation(t, execute)).rejects.toThrow('new_book_continuation_request_record');
      nothingConsumed();
      writeFileSync(file, bytes);
    }
    // The claim names the accepted request too.
    const claim = experimentClaimFile(config), claimBytes = readFileSync(claim);
    writeFileSync(claim, JSON.stringify({ ...JSON.parse(claimBytes.toString('utf8')), requestId: 'f'.repeat(64) }, null, 2));
    for (const execute of [false, true]) await expect(continuation(t, execute)).rejects.toThrow('new_book_continuation_request_record');
    nothingConsumed();
    writeFileSync(claim, claimBytes);
    expect([t.opus, t.reader, t.responses, sdk.create].map(m => m.mock.calls.length)).toEqual([0, 0, 0, 0]);
    expect(tree(dir)).toEqual(slot);
    // Unchanged, the same baseline is admitted and runs: only the storyboard and its review.
    expect(await continuation(t)).toMatchObject({ status: 'review_supported' });
    expect(t.responses.mock.calls.map(c => c[0].model)).toEqual(['gpt-6-astra', 'gpt-6.1-sol']);
  });

  it('the preview re-checks after its asynchronous replay: a HEAD or record change while it ran refuses, and nothing is written', async () => {
    await timedOut(); headAt('c'.repeat(40));
    const real = flow.runSimpleWizardBook, receipt = readFileSync(receiptFile());
    for (const [change, code, restore] of [
      [() => headAt('d'.repeat(40)), 'new_book_source_changed', () => headAt('c'.repeat(40))],
      [() => headAt('c'.repeat(40), ' M scripts/personal-new-book-experiment.ts'), 'new_book_source_changed', () => headAt('c'.repeat(40))],
      [() => writeFileSync(receiptFile(), receipt.toString('utf8') + ' '), 'new_book_continuation_evidence', () => writeFileSync(receiptFile(), receipt)],
    ] as const) {
      vi.spyOn(flow, 'runSimpleWizardBook').mockImplementationOnce(async a => { try { return await real(a); } finally { change(); } });
      await expect(continuation(textTransports(), false)).rejects.toThrow(code);
      nothingConsumed();
      restore();
    }
    expect(await continuation(textTransports(), false)).toMatchObject({ continuation: { admissible: true } });
  });

  it('once amended, its HEAD is the pin: a preview or a run at any other HEAD refuses (compared, never adopted)', async () => {
    await continued();
    headAt('d'.repeat(40));
    for (const execute of [false, true]) await expect(continuation(textTransports(), execute)).rejects.toThrow('new_book_source_changed');
    headAt('c'.repeat(40));
    expect(await continuation(textTransports(), false)).toMatchObject({ continuation: { admissible: true, amended: true, outDirExists: true } });
    await expect(continuation(textTransports())).rejects.toThrow('new_book_continuation_used');
  });
});

describe("Guy's second storyboard attempt: the same request plus the scene-location rule, after the first continuation's answer was refused", { timeout: 120_000 }, () => {
  const dir = () => experimentDir(config), out1 = () => path.join(dir(), NEW_BOOK_CONTINUATION.outDir), out2 = () => path.join(dir(), NEW_BOOK_CONTINUATION_2.outDir);
  const reservation = () => json(path.join(dir(), 'text', 'paid-stages', 'storyboard.claim.json')).maximumMicroUsd as number;
  const child = () => runNewBookChild({ config: newBookConfig(file), signal: new AbortController().signal, log: () => {}, adapters: childAdapters() });
  const nothingConsumed = () => expect([existsSync(experimentContinuation2File(config)), existsSync(out2())]).toEqual([false, false]);
  const second = (transports = textTransports(), execute = true) =>
    newBookExperimentCLI(['--config', file, 'storyboard-continuation-2', ...(execute ? ['--execute'] : [])], { text: transports, log: () => {} });
  /** The real first continuation (at HEAD c), whose storyboard answer keeps page 3's scene on page 4 while the planned place changes. */
  async function refusedOnce(storyboardOutput = driftingStoryboard) {
    await timedOut(); headAt('c'.repeat(40));
    await expect(continuation(textTransports({ storyboardOutput }))).rejects.toThrow();
    headAt('e'.repeat(40));
  }

  it('the refused first continuation: sealed failed with the check\'s own code; its one storyboard call settled at a known cost; no review', async () => {
    await refusedOnce();
    expect(json(path.join(out1(), 'sealed.json'))).toEqual({ status: 'failed', code: 'book_sequence_scene_location_drift',
      continuation: NEW_BOOK_CONTINUATION.id, runtimeEligible: false });
    expect(claims(path.join(out1(), 'paid-stages'))).toEqual(['storyboard']);
    expect(json(path.join(out1(), 'spend.json'))).toMatchObject({ newKnownApiMicroUsd: 350000, calls: 1, unknownCost: 0, unknownOutcome: 0 });
  });

  it('the preview is read-only: admissible; the first answer replays to that exact refusal; the new request differs only by the rule', async () => {
    await refusedOnce();
    const before = tree(dir()), t = textTransports();
    expect(await second(t, false)).toMatchObject({ mode: 'plan', plan: { continuation2: false, stages: { continuation: 'failed', continuation2: null } },
      continuation2: { admissible: true, amended: false, outDirExists: false, storyReplayed: true, previousRefusedAtSceneLocation: true,
        requestChangedOnlyByTheRule: true, priorKnownApiMicroUsd: 14000 + 350000, carriedUnresolvedMicroUsd: reservation(),
        remainingUnderCapMicroUsd: 7000000 - 364000 - reservation(), providerCalls: 0, keyRead: false } });
    expect(tree(dir())).toEqual(before);
    nothingConsumed();
    expect([t.opus, t.reader, t.responses, sdk.create].map(m => m.mock.calls.length)).toEqual([0, 0, 0, 0]);
  });

  it('one second attempt at its own reviewed HEAD: only the storyboard (with the rule) and its review; ledgers carried; later stages read it', async () => {
    await refusedOnce();
    const carried = reservation(), first = tree(out1()), amendment1 = readFileSync(experimentContinuationFile(config));
    const t = textTransports();
    expect(await second(t)).toMatchObject({ mode: 'storyboard-continuation-2', status: 'review_supported' });
    expect([t.opus, t.reader].map(m => m.mock.calls.length)).toEqual([0, 0]);
    expect(t.responses.mock.calls.map(c => c[0].model)).toEqual(['gpt-6-astra', 'gpt-6.1-sol']);
    expect(claims(path.join(out2(), 'paid-stages'))).toEqual(['storyboard', 'storyboard_review']);
    // The storyboard request is the first continuation's, plus the rule (and the source digest that records the contract).
    const [w1, w2] = [out1(), out2()].map(o => json(path.join(o, 'paid-stages', 'storyboard.wire.json')));
    // The rule is the only addition, placed right before the provider's own trailing note.
    expect(w2.instructions.replace(`\n${SCENE_LOCATION_STORYBOARD_ADDENDUM}`, '')).toBe(w1.instructions);
    expect(w2.instructions).toContain(`\n${SCENE_LOCATION_STORYBOARD_ADDENDUM}\nProvider output:`);
    expect(w2.max_output_tokens).toBe(w1.max_output_tokens);
    expect(json(path.join(out2(), 'spend.json'))).toMatchObject({ priorKnownApiMicroUsd: 364000, carriedUnresolvedMicroUsd: carried, newKnownApiMicroUsd: 420000,
      reservedUnsettledMicroUsd: 0, cumulativeAccountedMicroUsd: 364000 + carried + 420000, calls: 2, maxCalls: 2, unknownCost: 0, unknownOutcome: 0 });
    expect(json(path.join(out2(), 'sealed.json'))).toEqual({ status: 'review_supported', continuation: NEW_BOOK_CONTINUATION_2.id, runtimeEligible: false });
    expect(json(path.join(out2(), 'visual_simple_book_result.json')).storyboard.storyboard.sceneLocation).toBe(SCENE_LOCATION_CONTRACT_VERSION);
    const amendment2 = json(experimentContinuation2File(config));
    expect(amendment2).toMatchObject({ id: NEW_BOOK_CONTINUATION_2.id, approval: NEW_BOOK_CONTINUATION_2.approval, claimSha256: sha(readFileSync(experimentClaimFile(config))),
      previousSha256: sha(amendment1), originalSourceHead: 'a'.repeat(40), previousSourceHead: 'c'.repeat(40), sourceHead: 'e'.repeat(40),
      failedStep: 'storyboard_scene_location', priorKnownApiMicroUsd: 364000, carriedUnresolvedMicroUsd: carried });
    expect(Object.fromEntries(amendment2.evidence.map((e: { file: string; sha256: string }) => [e.file, e.sha256])))
      .toEqual(Object.fromEntries(Object.entries(first).map(([k, v]) => [`${NEW_BOOK_CONTINUATION.outDir}/${k}`, v])));
    expect([tree(out1()), readFileSync(experimentContinuationFile(config))]).toEqual([first, amendment1]);

    // The child stage and the grant read the second attempt's text and carry every ledger line.
    expect(await child()).toMatchObject({ status: 'child_reference_passed' });
    expect(readReviewedBookLayout(path.join(dir(), 'book-layout.json'))).toEqual(experimentLayout(config, 'reference_child.png', NEW_BOOK_CONTINUATION_2.outDir));
    const childSpend = json(path.join(dir(), 'child', 'spend.json'));
    expect(childSpend).toMatchObject({ priorKnownApiMicroUsd: 784000, carriedUnresolvedMicroUsd: carried });
    const grant = await writeNewBookGrant(newBookConfig(file));
    expect(grant.ledger).toMatchObject({ priorKnownApiMicroUsd: 784000 + childSpend.newKnownApiMicroUsd, carriedUnresolvedMicroUsd: carried });
    expect(grant.ledger.evidence.map(e => e.file)).toEqual([path.join(dir(), 'text', 'spend.json'), experimentContinuationFile(config), path.join(out1(), 'spend.json'),
      experimentContinuation2File(config), path.join(out2(), 'spend.json'), path.join(dir(), 'child', 'spend.json')]);
    // The pin is now the second amendment's HEAD.
    for (const head of ['a'.repeat(40), 'c'.repeat(40)]) { headAt(head); expect(() => assertExperimentClaim(newBookConfig(file))).toThrow('new_book_source_changed'); }
  });

  it('only after a first continuation refused exactly at the scene/location check', async () => {
    // No first continuation yet.
    await timedOut(); headAt('e'.repeat(40));
    for (const execute of [false, true]) await expect(second(textTransports(), execute)).rejects.toThrow('new_book_continuation_scope');
    nothingConsumed();
  });
  it('not after a first continuation that succeeded, timed out again, or was refused by another check', async () => {
    for (const [label, setup] of [
      ['succeeded', async () => { await continued(); }],
      ['timed out again', async () => { await timedOut(); headAt('c'.repeat(40)); const t = textTransports();
        t.responses.mockImplementationOnce((async () => { throw new APIConnectionTimeoutError(); }) as never); await expect(continuation(t)).rejects.toThrow(); }],
      ['another check', async () => { await refusedOnce(otherRefusalStoryboard); }],
    ] as const) {
      rmSync(experimentDir(config), { recursive: true, force: true }); rmSync(path.dirname(experimentClaimFile(config)), { recursive: true, force: true });
      headAt('a'.repeat(40)); await setup(); headAt('e'.repeat(40));
      for (const execute of [false, true]) await expect(second(textTransports(), execute), label).rejects.toThrow('new_book_continuation_scope');
      nothingConsumed();
    }
  });

  it('a changed record of the first continuation refuses before anything is consumed', async () => {
    await refusedOnce();
    const t = textTransports(), root1 = () => path.join(out1(), 'paid-stages');
    for (const [name, change, code] of [
      // The ledger re-derives every record from its own evidence first (Codex HOLD at a3578efb).
      ['storyboard.claim.json', (r: any) => ({ ...r, wireDigest: 'e'.repeat(64) }), /^new_book_ledger_record$/],
      ['storyboard.receipt.json', (r: any) => ({ ...r, estimatedMicroUsd: r.estimatedMicroUsd + 1 }), /^new_book_ledger_cost$/],
      // The saved answer itself, corrected so it no longer drifts: then it is not the refusal this attempt was approved for.
      ['storyboard.receipt.json', (r: any) => { const o = JSON.parse(r.raw.output_text); o.sequence.pages[3] = { ...o.sequence.pages[3],
        sceneId: 'lane_visit', sceneChangeEvidence: o.sequence.pages[3].beat }; return { ...r, raw: { ...r.raw, output_text: JSON.stringify(o) } }; },
        /new_book_continuation_scope|book_sequence/],
    ] as const) {
      const f = path.join(root1(), name), bytes = readFileSync(f);
      writeFileSync(f, JSON.stringify((change as (r: unknown) => unknown)(JSON.parse(bytes.toString('utf8')))));
      for (const execute of [false, true]) await expect(second(t, execute), name).rejects.toThrow(code);
      nothingConsumed();
      writeFileSync(f, bytes);
    }
    // The first continuation's request rewritten with matching digests (same length) binds itself in the ledger; only the admission's exact
    // reconstruction refuses it.
    const restore = rewire(root1(), 'storyboard', w => ({ ...w, instructions: swapOne(w.instructions) }));
    for (const execute of [false, true]) await expect(second(t, execute)).rejects.toThrow(/^new_book_continuation_replay$/);
    nothingConsumed(); restore();
    expect([t.opus, t.reader, t.responses].map(m => m.mock.calls.length)).toEqual([0, 0, 0]);
    expect(await second(t, false)).toMatchObject({ continuation2: { admissible: true } });
  });

  it('a new request that differs by anything but the rule (or lacks it) is refused before anything is consumed', async () => {
    await refusedOnce();
    const realFlow = flow.runSimpleWizardBook, realPayload = worker.simpleWizardVisualPayload;
    for (const alter of [
      // The storyboard call itself without the rule (the contract not applied).
      () => vi.spyOn(flow, 'runSimpleWizardBook').mockImplementation(a => realFlow({ ...a, sceneLocationContract: undefined })),
      // The provider request with something besides the rule.
      () => vi.spyOn(worker, 'simpleWizardVisualPayload').mockImplementation((call, model) => {
        const p = realPayload(call, model);
        return call.instructions.includes(SCENE_LOCATION_STORYBOARD_ADDENDUM) ? { ...p, instructions: `${p.instructions}\nOne more sentence.` } : p;
      }),
    ]) {
      const spy = alter();
      for (const execute of [false, true]) await expect(second(textTransports(), execute)).rejects.toThrow('new_book_continuation_request');
      nothingConsumed();
      spy.mockRestore();
    }
    expect(await second(textTransports(), false)).toMatchObject({ continuation2: { requestChangedOnlyByTheRule: true } });
  });

  it('every source or record change after admission, up to and just past the second amendment, refuses: before it nothing is consumed; after it no call', async () => {
    type Event = 'head' | 'dirty' | 'request' | 'receipt' | 'previous';
    const resetSlot = () => { for (const d of [experimentDir(config), path.dirname(experimentClaimFile(config))]) {
      if (!path.resolve(d).startsWith(path.resolve(root))) throw Error('reset_boundary'); rmSync(d, { recursive: true, force: true }); } };
    const receiptFile = () => path.join(out1(), 'paid-stages', 'storyboard.receipt.json');
    async function boundaryRun(event: Event | null, at: number) {
      await eventLoopTurn();
      resetSlot(); headAt('a'.repeat(40)); await refusedOnce();
      const amendmentFile = experimentContinuation2File(config);
      const before = Object.fromEntries(Object.entries(tree(out1())).map(([k, v]) => [`${NEW_BOOK_CONTINUATION.outDir}/${k}`, v]));
      let reads = 0, fired = false;
      const amendedAtRead: boolean[] = [];
      const fire = () => {
        fired = true;
        if (event === 'request') { const f = path.join(dir(), 'request.json'); writeFileSync(f, JSON.stringify({ ...json(f), requestId: 'f'.repeat(64) })); }
        if (event === 'receipt') writeFileSync(receiptFile(), readFileSync(receiptFile(), 'utf8') + ' ');
        // The first amendment re-serialized: same meaning, but no longer the bytes the second attempt was admitted under.
        if (event === 'previous') writeFileSync(experimentContinuationFile(config), JSON.stringify(json(experimentContinuationFile(config)), null, 4));
      };
      vi.mocked(frozen.gitAt).mockImplementation((_repo, args) => {
        const a = args.join(' ');
        if (a === 'rev-parse HEAD') {
          reads++; amendedAtRead.push(existsSync(amendmentFile));
          if (event && reads === at) fire();
          return Buffer.from(fired && event === 'head' ? 'f'.repeat(40) : 'e'.repeat(40));
        }
        return Buffer.from(a === 'status --porcelain' ? (fired && event === 'dirty' ? ' M scripts/personal-new-book-experiment.ts' : '') : path.join(root, 'git-common'));
      });
      const t = textTransports(), real = t.responses.getMockImplementation()!, afterEvent: string[] = [];
      t.responses.mockImplementation((async (payload: any, ...rest: unknown[]) => { if (fired) afterEvent.push(payload.model); return (real as any)(payload, ...rest); }) as never);
      const outcome = await second(t).then(() => 'ok', (error: Error) => error.message);
      return { outcome, amendedAtRead, afterEvent, before, opusOrReader: t.opus.mock.calls.length + t.reader.mock.calls.length,
        amendment: existsSync(amendmentFile) ? json(amendmentFile) : null, folder: existsSync(out2()) };
    }
    // Calibration: an unchanged run succeeds; count the HEAD reads made before the second amendment is written.
    const calm = await boundaryRun(null, 0);
    expect(calm.outcome).toBe('ok');
    const beforeWrite = calm.amendedAtRead.indexOf(true);
    // The capture, the admission, the check after the asynchronous replays and the amendment's own re-check.
    expect(beforeWrite).toBeGreaterThanOrEqual(4);
    const codes: Record<Event, RegExp> = { head: /^new_book_source_changed$/, dirty: /^new_book_source_changed$/,
      // After the first amendment the saved request is bound by its evidence, checked first.
      request: /^new_book_continuation_evidence$/, receipt: /^new_book_continuation_evidence$/, previous: /^new_book_continuation(_evidence)?$/ };
    // Read 1 is the capture; read 2 opens the admission (source first, then the records it binds): record changes count from read 3.
    // The request record is already bound by the first amendment, so its change is refused at any read.
    const first: Record<Event, number> = { head: 2, dirty: 2, request: 2, receipt: 3, previous: 3 };
    for (const event of ['head', 'dirty', 'request', 'receipt', 'previous'] as Event[]) for (let at = first[event]; at <= beforeWrite + 1; at++) {
      const r = await boundaryRun(event, at), label = `${event}@${at}`;
      expect(`${label}: ${r.outcome}`).toMatch(new RegExp(`^${label}: ${codes[event].source.slice(1, -1)}$`));
      expect(`${label}: ${r.afterEvent.length} calls after the change, ${r.opusOrReader} story calls`).toBe(`${label}: 0 calls after the change, 0 story calls`);
      if (at <= beforeWrite) {
        expect(`${label}: amendment ${!!r.amendment}, folder ${r.folder}`).toBe(`${label}: amendment false, folder false`);
        continue;
      }
      // After the second amendment the attempt may already be spent, but nothing is claimed or called: a folder, if made, is sealed failed.
      if (r.folder) expect([label, json(path.join(out2(), 'sealed.json')).status, json(path.join(out2(), 'sealed.json')).code, claims(path.join(out2(), 'paid-stages'))])
        .toEqual([label, 'failed', r.outcome, []]);
      expect([label, r.amendment?.sourceHead, Object.fromEntries(r.amendment.evidence.map((e: { file: string; sha256: string }) => [e.file, e.sha256]))])
        .toEqual([label, 'e'.repeat(40), r.before]);
    }
  });

  it('the preview re-checks after its asynchronous replays: a HEAD, tree or record change while they ran refuses, and nothing is written', async () => {
    await refusedOnce();
    const realFlow = flow.runSimpleWizardBook, receipt = path.join(out1(), 'paid-stages', 'storyboard.receipt.json'), bytes = readFileSync(receipt);
    for (const [change, code, restore] of [
      [() => headAt('f'.repeat(40)), 'new_book_source_changed', () => headAt('e'.repeat(40))],
      [() => headAt('e'.repeat(40), ' M scripts/personal-new-book-experiment.ts'), 'new_book_source_changed', () => headAt('e'.repeat(40))],
      [() => writeFileSync(receipt, bytes.toString('utf8') + ' '), 'new_book_continuation_evidence', () => writeFileSync(receipt, bytes)],
    ] as const) {
      // The admission replays twice (the first answer, then the new request): the change lands after the second replay.
      let replays = 0;
      const spy = vi.spyOn(flow, 'runSimpleWizardBook').mockImplementation(async a => { try { return await realFlow(a); } finally { if (++replays === 2) change(); } });
      await expect(second(textTransports(), false)).rejects.toThrow(code);
      nothingConsumed();
      spy.mockRestore(); restore();
    }
    expect(await second(textTransports(), false)).toMatchObject({ continuation2: { admissible: true } });
  });

  it('a contract recorded in the source whose rule never reaches the storyboard call is refused (the call itself must carry the rule)', async () => {
    await refusedOnce();
    const realAuthor = storyboardModule.authorPersonalStoryboard;
    // The source (and so the request's digest) records the contract, but the call's instructions arrive without its rule.
    const spy = vi.spyOn(storyboardModule, 'authorPersonalStoryboard').mockImplementation(((source: any, author: any, signal: AbortSignal) =>
      realAuthor(source, (call: any) => author({ ...call, instructions: call.instructions.replace(`\n${SCENE_LOCATION_STORYBOARD_ADDENDUM}`, '') }), signal)) as never);
    for (const execute of [false, true]) await expect(second(textTransports(), execute)).rejects.toThrow('new_book_continuation_request');
    nothingConsumed();
    spy.mockRestore();
    expect(await second(textTransports(), false)).toMatchObject({ continuation2: { requestChangedOnlyByTheRule: true } });
  });

  // ---- Codex HOLD at 75df2822 (P1): the first continuation's settled cost is re-derived from its raw answer, not taken from summaries. ----
  /**
   * Rewrites the first continuation's saved storyboard answer (receipt, result) and regenerates its spend record with the real meter, so the
   * three summaries agree with each other: only the raw answer can contradict them.
   */
  function rewriteFirstAnswer(change: (receipt: any, result: any, wire: any) => void) {
    const root1 = path.join(out1(), 'paid-stages'), files = ['storyboard.receipt.json', 'storyboard.result.json', '../spend.json'].map(f => path.join(root1, f));
    const saved = files.map(f => readFileSync(f));
    const receipt = json(files[0]), result = json(files[1]), wire = json(path.join(root1, 'storyboard.wire.json'));
    change(receipt, result, wire);
    writeFileSync(files[0], JSON.stringify(receipt, null, 2)); writeFileSync(files[1], JSON.stringify(result, null, 2));
    writeFileSync(files[2], JSON.stringify(new AuditionMeter(root1, 7000000, 2, 14000, reservation()).snapshot(), null, 2));
    return () => files.forEach((f, i) => writeFileSync(f, saved[i]));
  }
  const settle = (usage: { input_tokens: number; output_tokens: number }) => usage.input_tokens * 10 + usage.output_tokens * 50;

  it("Codex's counterexample: a cheaper cost on which receipt, result and spend all agree, but the raw answer contradicts, is refused", async () => {
    await refusedOnce();
    const restore = rewriteFirstAnswer((receipt, result) => { receipt.estimatedMicroUsd = 1; result.estimatedMicroUsd = 1; });
    // The summaries are coherent with each other (the old check alone would admit a prior of 14001).
    expect(json(path.join(out1(), 'spend.json'))).toMatchObject({ newKnownApiMicroUsd: 1, unknownCost: 0 });
    const t = textTransports();
    for (const execute of [false, true]) await expect(second(t, execute)).rejects.toThrow(/^new_book_ledger_cost$/);
    nothingConsumed();
    expect([t.opus, t.reader, t.responses, sdk.create].map(m => m.mock.calls.length)).toEqual([0, 0, 0, 0]);
    restore();
    expect(await second(t, false)).toMatchObject({ continuation2: { admissible: true, previousStoryboardSettledMicroUsd: 350000, priorKnownApiMicroUsd: 364000 } });
  });

  it('every invalid or incoherent saved answer fails closed before anything is consumed (each with agreeing summaries)', async () => {
    await refusedOnce();
    const t = textTransports();
    const cases: [string, (receipt: any, result: any, wire: any) => void, RegExp][] = [
      ['another model', (receipt) => { receipt.raw.model = 'gpt-6-astra-mini'; receipt.model = 'gpt-6-astra-mini'; }, /^new_book_ledger_cost$/],
      ['another tier', (receipt) => { receipt.raw.service_tier = 'flex'; }, /^new_book_ledger_cost$/],
      ['not completed', (receipt) => { receipt.raw.status = 'incomplete'; }, /^new_book_ledger_cost$/],
      ['no output', (receipt) => { receipt.raw.output_text = ''; }, /^new_book_ledger_cost$/],
      ['no usage', (receipt) => { receipt.raw.usage = null; receipt.usage = null; }, /^new_book_ledger_cost$/],
      ['malformed usage', (receipt) => { receipt.raw.usage = { ...receipt.raw.usage, input_tokens: -1 }; }, /^new_book_ledger_cost$/],
      ['fractional usage', (receipt) => { receipt.raw.usage = { ...receipt.raw.usage, output_tokens: 4999.5 }; }, /^new_book_ledger_cost$/],
      // Coherent cost for the larger usage, but beyond the call's output cap: only the cap check refuses it.
      ['beyond the output cap', (receipt, result, wire) => {
        receipt.raw.usage = { ...receipt.raw.usage, output_tokens: wire.max_output_tokens + 1 };
        receipt.usage = { inputTokens: receipt.raw.usage.input_tokens, outputTokens: wire.max_output_tokens + 1 };
        receipt.estimatedMicroUsd = result.estimatedMicroUsd = settle(receipt.raw.usage); }, /^new_book_ledger_cost$/],
      // The raw answer is unchanged; only its normalized copy disagrees.
      ['normalized usage disagrees', (receipt) => { receipt.usage = { inputTokens: 1, outputTokens: 1 }; }, /^new_book_ledger_cost$/],
      ['receipt model label disagrees', (receipt) => { receipt.model = 'gpt-6-astra-mini'; }, /^new_book_ledger_cost$/],
      ['receipt step label disagrees', (receipt) => { receipt.stage = 'storyboard_review'; }, /^new_book_ledger_cost$/],
      ['negative cost', (receipt, result) => { receipt.estimatedMicroUsd = -5; result.estimatedMicroUsd = -5; }, /^new_book_ledger_cost$/],
      ['unknown cost', (receipt, result) => { receipt.estimatedMicroUsd = null; result.estimatedMicroUsd = null; }, /^new_book_ledger_unknown$/],
    ];
    for (const [label, change, code] of cases) {
      const restore = rewriteFirstAnswer(change);
      for (const execute of [false, true]) await expect(second(t, execute), label).rejects.toThrow(code);
      expect([label, existsSync(experimentContinuation2File(config)), existsSync(out2())]).toEqual([label, false, false]);
      restore();
    }
    expect([t.opus, t.reader, t.responses, sdk.create].map(m => m.mock.calls.length)).toEqual([0, 0, 0, 0]);
    expect(await second(t, false)).toMatchObject({ continuation2: { admissible: true, previousStoryboardSettledMicroUsd: 350000 } });
  });

  it("the preview reports the settled prior cost and the new request's own reservation, which the run then claims", async () => {
    await refusedOnce();
    const first = json(path.join(out1(), 'paid-stages', 'storyboard.claim.json')).maximumMicroUsd;
    const preview = (await second(textTransports(), false)) as any;
    const newReservation = preview.continuation2.newStoryboardReservationMicroUsd;
    expect(preview.continuation2).toMatchObject({ previousStoryboardSettledMicroUsd: 350000, priorKnownApiMicroUsd: 364000 });
    // The rule adds bytes, so the new request reserves more than the first one did (the old carried reserve is unchanged).
    expect(newReservation).toBeGreaterThan(first);
    expect(preview.continuation2.carriedUnresolvedMicroUsd).toBe(reservation());
    await second();
    expect(json(path.join(out2(), 'paid-stages', 'storyboard.claim.json')).maximumMicroUsd).toBe(newReservation);
    // The live reservation rule at the storyboard's own (Astra) rate: wire bytes in, the output cap out, plus 10%.
    const wire2 = json(path.join(out2(), 'paid-stages', 'storyboard.wire.json'));
    expect(newReservation).toBe(Math.ceil((Buffer.byteLength(JSON.stringify(wire2), 'utf8') * 10 + wire2.max_output_tokens * 50) * 1.1));
  });

  it('one pinned HEAD and the complete request record, as for the first continuation', async () => {
    await refusedOnce();
    let heads = 0;
    vi.mocked(frozen.gitAt).mockImplementation((_repo, args) => Buffer.from(args.join(' ') === 'rev-parse HEAD' ? (++heads <= 2 ? 'e' : 'f').repeat(40)
      : args.join(' ') === 'status --porcelain' ? '' : path.join(root, 'git-common')));
    await expect(second()).rejects.toThrow('new_book_source_changed');
    nothingConsumed();
    headAt('e'.repeat(40), ' M scripts/personal-new-book-experiment.ts');
    await expect(second()).rejects.toThrow('new_book_source_changed');
    headAt('e'.repeat(40));
    const request = path.join(dir(), 'request.json'), bytes = readFileSync(request);
    // After the first amendment the saved request is already bound by its evidence, which refuses first (the complete-record check is behind it).
    writeFileSync(request, JSON.stringify({ ...JSON.parse(bytes.toString('utf8')), requestId: 'f'.repeat(64) }));
    for (const execute of [false, true]) await expect(second(textTransports(), execute)).rejects.toThrow('new_book_continuation_evidence');
    nothingConsumed();
    writeFileSync(request, bytes);
    expect(await second()).toMatchObject({ status: 'review_supported' });
    // Once amended, its HEAD is compared, never adopted; and it is single-use.
    headAt('f'.repeat(40));
    for (const execute of [false, true]) await expect(second(textTransports(), execute)).rejects.toThrow('new_book_source_changed');
    headAt('e'.repeat(40));
    await expect(second()).rejects.toThrow('new_book_continuation_used');
  });

  it('one attempt only: a second attempt whose storyboard is refused again is sealed failed; nothing can retry or build on it', async () => {
    await refusedOnce();
    await expect(second(textTransports({ storyboardOutput: driftingStoryboard }))).rejects.toThrow('book_sequence_scene_location_drift');
    expect(json(path.join(out2(), 'sealed.json'))).toEqual({ status: 'failed', code: 'book_sequence_scene_location_drift',
      continuation: NEW_BOOK_CONTINUATION_2.id, runtimeEligible: false });
    const again = textTransports();
    await expect(second(again)).rejects.toThrow('new_book_continuation_used');
    await expect(child()).rejects.toThrow('new_book_text_not_supported');
    expect([again.opus, again.reader, again.responses].map(m => m.mock.calls.length)).toEqual([0, 0, 0]);
  });

  it('after the second amendment, a changed first-continuation record or a rewritten first amendment refuses every later stage', async () => {
    await refusedOnce(); await second();
    const receipt = path.join(out1(), 'paid-stages', 'storyboard.receipt.json'), bytes = readFileSync(receipt);
    writeFileSync(receipt, Buffer.concat([bytes, Buffer.from(' ')]));
    await expect(child()).rejects.toThrow('new_book_continuation_evidence');
    writeFileSync(receipt, bytes);
    const a1 = experimentContinuationFile(config), a1Bytes = readFileSync(a1);
    writeFileSync(a1, JSON.stringify(JSON.parse(a1Bytes.toString('utf8')), null, 4));
    await expect(child()).rejects.toThrow('new_book_continuation');
    writeFileSync(a1, a1Bytes);
    // The second amendment's own ledger must still match the first continuation's.
    const a2 = experimentContinuation2File(config), a2Bytes = readFileSync(a2);
    writeFileSync(a2, JSON.stringify({ ...JSON.parse(a2Bytes.toString('utf8')), carriedUnresolvedMicroUsd: 1 }));
    await expect(child()).rejects.toThrow('new_book_continuation_ledger');
    writeFileSync(a2, a2Bytes);
    expect(await child()).toMatchObject({ status: 'child_reference_passed' });
  });
});

describe("Guy's third storyboard attempt: the second request plus the compiler-rules contract, after the second answer was refused at an undeclared prop", { timeout: 180_000 }, () => {
  const dir = () => experimentDir(config);
  const outN = (n: 1 | 2 | 3) => path.join(dir(), [NEW_BOOK_CONTINUATION, NEW_BOOK_CONTINUATION_2, NEW_BOOK_CONTINUATION_3][n - 1].outDir);
  const reservation = () => json(path.join(dir(), 'text', 'paid-stages', 'storyboard.claim.json')).maximumMicroUsd as number;
  const child = () => runNewBookChild({ config: newBookConfig(file), signal: new AbortController().signal, log: () => {}, adapters: childAdapters() });
  const nothingConsumed = () => expect([existsSync(experimentContinuation3File(config)), existsSync(outN(3))]).toEqual([false, false]);
  const attempt = (n: 2 | 3, transports = textTransports(), execute = true) =>
    newBookExperimentCLI(['--config', file, `storyboard-continuation-${n}`, ...(execute ? ['--execute'] : [])], { text: transports, log: () => {} });
  /** The real history, synthetically: the first continuation refused at scene/location (HEAD c), the second at an undeclared prop (HEAD e). */
  async function refusedTwice(secondOutput: (owned: any) => unknown = undeclaredPropStoryboard) {
    await timedOut(); headAt('c'.repeat(40));
    await expect(continuation(textTransports({ storyboardOutput: driftingStoryboard }))).rejects.toThrow('book_sequence_scene_location_drift');
    headAt('e'.repeat(40));
    await expect(attempt(2, textTransports({ storyboardOutput: secondOutput }))).rejects.toThrow();
    headAt('1'.repeat(40));
  }

  it('the refused second attempt: sealed failed with the prop check\'s own code; its one storyboard call settled at a known cost; no review', async () => {
    await refusedTwice();
    expect(json(path.join(outN(2), 'sealed.json'))).toEqual({ status: 'failed', code: 'unknown_or_duplicate_prop',
      continuation: NEW_BOOK_CONTINUATION_2.id, runtimeEligible: false });
    expect(claims(path.join(outN(2), 'paid-stages'))).toEqual(['storyboard']);
    expect(json(path.join(outN(2), 'spend.json'))).toMatchObject({ priorKnownApiMicroUsd: 364000, newKnownApiMicroUsd: 350000, calls: 1, unknownCost: 0 });
  });

  it('the preview is read-only: admissible; the second answer replays to that exact refusal with its raw-answer cost; only the rules are added', async () => {
    await refusedTwice();
    const before = tree(dir()), t = textTransports();
    const preview = (await attempt(3, t, false)) as any;
    expect(preview).toMatchObject({ mode: 'plan', plan: { continuation3: false, stages: { continuation2: 'failed', continuation3: null } },
      continuation3: { admissible: true, amended: false, outDirExists: false, storyReplayed: true, previousRefusal: 'unknown_or_duplicate_prop',
        requestChangedOnlyByTheRule: true, previousStoryboardSettledMicroUsd: 350000, priorKnownApiMicroUsd: 714000,
        carriedUnresolvedMicroUsd: reservation(), remainingUnderCapMicroUsd: 7000000 - 714000 - reservation(), providerCalls: 0, keyRead: false } });
    expect(preview.continuation3).not.toHaveProperty('previousRefusedAtSceneLocation');
    expect(preview.continuation3.newStoryboardReservationMicroUsd).toBeGreaterThan(json(path.join(outN(2), 'paid-stages', 'storyboard.claim.json')).maximumMicroUsd);
    expect(tree(dir())).toEqual(before);
    nothingConsumed();
    expect([t.opus, t.reader, t.responses, sdk.create].map(m => m.mock.calls.length)).toEqual([0, 0, 0, 0]);
  });

  it('one third attempt at its own reviewed HEAD: only the storyboard (with every rule) and its review; ledgers carried; later stages read it', async () => {
    await refusedTwice();
    const carried = reservation(), second = tree(outN(2)), earlier = [tree(outN(1)), tree(path.join(dir(), 'text'))];
    const amendment2 = readFileSync(experimentContinuation2File(config));
    const t = textTransports();
    expect(await attempt(3, t)).toMatchObject({ mode: 'storyboard-continuation-3', status: 'review_supported' });
    expect([t.opus, t.reader].map(m => m.mock.calls.length)).toEqual([0, 0]);
    expect(t.responses.mock.calls.map(c => c[0].model)).toEqual(['gpt-6-astra', 'gpt-6.1-sol']);
    expect(claims(path.join(outN(3), 'paid-stages'))).toEqual(['storyboard', 'storyboard_review']);
    // The request is the second one plus the compiler rules (right before the provider's own note).
    const [w2, w3] = [outN(2), outN(3)].map(o => json(path.join(o, 'paid-stages', 'storyboard.wire.json')));
    expect(w3.instructions.replace(`\n${COMPILER_RULES_STORYBOARD_ADDENDUM}`, '')).toBe(w2.instructions);
    expect(w3.instructions).toContain(`${SCENE_LOCATION_STORYBOARD_ADDENDUM}\n${COMPILER_RULES_STORYBOARD_ADDENDUM}\nProvider output:`);
    expect(json(path.join(outN(3), 'spend.json'))).toMatchObject({ priorKnownApiMicroUsd: 714000, carriedUnresolvedMicroUsd: carried, newKnownApiMicroUsd: 420000,
      reservedUnsettledMicroUsd: 0, calls: 2, maxCalls: 2, unknownCost: 0, unknownOutcome: 0 });
    expect(json(path.join(outN(3), 'sealed.json'))).toEqual({ status: 'review_supported', continuation: NEW_BOOK_CONTINUATION_3.id, runtimeEligible: false });
    expect(json(path.join(outN(3), 'visual_simple_book_result.json')).storyboard.storyboard).toMatchObject({
      sceneLocation: 'storyboard-scene-location/v1', compilerRules: COMPILER_RULES_CONTRACT_VERSION });
    // The amendments keep the real chain's names beside the claim (the consumed first and second are continuation-1 and continuation-2).
    expect([experimentContinuationFile(config), experimentContinuation2File(config), experimentContinuation3File(config)].map(a => path.basename(a)))
      .toEqual([1, 2, 3].map(n => `${NEW_BOOK_EXPERIMENT.slot}.continuation-${n}.json`));
    const amendment3 = json(experimentContinuation3File(config));
    expect(amendment3).toMatchObject({ id: NEW_BOOK_CONTINUATION_3.id, approval: NEW_BOOK_CONTINUATION_3.approval, claimSha256: sha(readFileSync(experimentClaimFile(config))),
      previousSha256: sha(amendment2), originalSourceHead: 'a'.repeat(40), previousSourceHead: 'e'.repeat(40), sourceHead: '1'.repeat(40),
      failedStep: 'storyboard_undeclared_prop', priorKnownApiMicroUsd: 714000, carriedUnresolvedMicroUsd: carried });
    expect(Object.fromEntries(amendment3.evidence.map((e: { file: string; sha256: string }) => [e.file, e.sha256])))
      .toEqual(Object.fromEntries(Object.entries(second).map(([k, v]) => [`${NEW_BOOK_CONTINUATION_2.outDir}/${k}`, v])));
    expect([tree(outN(2)), tree(outN(1)), tree(path.join(dir(), 'text')), readFileSync(experimentContinuation2File(config))]).toEqual([second, ...earlier, amendment2]);

    expect(await child()).toMatchObject({ status: 'child_reference_passed' });
    expect(readReviewedBookLayout(path.join(dir(), 'book-layout.json'))).toEqual(experimentLayout(config, 'reference_child.png', NEW_BOOK_CONTINUATION_3.outDir));
    const childSpend = json(path.join(dir(), 'child', 'spend.json'));
    expect(childSpend).toMatchObject({ priorKnownApiMicroUsd: 714000 + 420000, carriedUnresolvedMicroUsd: carried });
    const grant = await writeNewBookGrant(newBookConfig(file));
    expect(grant.ledger).toMatchObject({ priorKnownApiMicroUsd: 1134000 + childSpend.newKnownApiMicroUsd, carriedUnresolvedMicroUsd: carried });
    expect(grant.ledger.evidence.map(e => e.file)).toEqual([path.join(dir(), 'text', 'spend.json'), experimentContinuationFile(config), path.join(outN(1), 'spend.json'),
      experimentContinuation2File(config), path.join(outN(2), 'spend.json'), experimentContinuation3File(config), path.join(outN(3), 'spend.json'),
      path.join(dir(), 'child', 'spend.json')]);
    for (const head of ['a', 'c', 'e'].map(x => x.repeat(40))) { headAt(head); expect(() => assertExperimentClaim(newBookConfig(file))).toThrow('new_book_source_changed'); }
  });

  it('only after a second attempt refused exactly at the prop check', async () => {
    // No second attempt yet.
    await timedOut(); headAt('c'.repeat(40));
    await expect(continuation(textTransports({ storyboardOutput: driftingStoryboard }))).rejects.toThrow();
    headAt('1'.repeat(40));
    for (const execute of [false, true]) await expect(attempt(3, textTransports(), execute)).rejects.toThrow('new_book_continuation_scope');
    nothingConsumed();
  });
  it('not after a second attempt that succeeded, or that was refused by another check', async () => {
    for (const [label, secondOutput] of [['succeeded', contractedStoryboard], ['another check', otherRefusalStoryboard]] as const) {
      rmSync(experimentDir(config), { recursive: true, force: true }); rmSync(path.dirname(experimentClaimFile(config)), { recursive: true, force: true });
      headAt('a'.repeat(40));
      if (label === 'succeeded') {
        await timedOut(); headAt('c'.repeat(40));
        await expect(continuation(textTransports({ storyboardOutput: driftingStoryboard }))).rejects.toThrow();
        headAt('e'.repeat(40)); await attempt(2, textTransports({ storyboardOutput: secondOutput })); headAt('1'.repeat(40));
      } else await refusedTwice(secondOutput);
      for (const execute of [false, true]) await expect(attempt(3, textTransports(), execute), label).rejects.toThrow('new_book_continuation_scope');
      nothingConsumed();
    }
  });

  it('a cheaper settled cost for the second answer that its raw answer contradicts is refused', async () => {
    await refusedTwice();
    const root2 = path.join(outN(2), 'paid-stages'), files = ['storyboard.receipt.json', 'storyboard.result.json', '../spend.json'].map(f => path.join(root2, f));
    const saved = files.map(f => readFileSync(f)), receipt = json(files[0]), result = json(files[1]);
    receipt.estimatedMicroUsd = 1; result.estimatedMicroUsd = 1;
    writeFileSync(files[0], JSON.stringify(receipt)); writeFileSync(files[1], JSON.stringify(result));
    writeFileSync(files[2], JSON.stringify(new AuditionMeter(root2, 7000000, 2, 364000, reservation()).snapshot()));
    const t = textTransports();
    for (const execute of [false, true]) await expect(attempt(3, t, execute)).rejects.toThrow(/^new_book_ledger_cost$/);
    nothingConsumed();
    files.forEach((f, i) => writeFileSync(f, saved[i]));
    expect(await attempt(3, t, false)).toMatchObject({ continuation3: { admissible: true, previousStoryboardSettledMicroUsd: 350000 } });
    expect([t.opus, t.reader, t.responses].map(m => m.mock.calls.length)).toEqual([0, 0, 0]);
  });

  it('a new request that differs by anything but the rules (or lacks them) is refused before anything is consumed', async () => {
    await refusedTwice();
    const realFlow = flow.runSimpleWizardBook, realPayload = worker.simpleWizardVisualPayload, realAuthor = storyboardModule.authorPersonalStoryboard;
    for (const [label, alter] of [
      // The storyboard call itself without the contract.
      ['contract not applied', () => vi.spyOn(flow, 'runSimpleWizardBook').mockImplementation(a => realFlow({ ...a, compilerRulesContract: undefined }))],
      // The source (and so the request's digest) records the contract, but the call's instructions arrive without its rules.
      ['rules dropped from the call', () => vi.spyOn(storyboardModule, 'authorPersonalStoryboard').mockImplementation(((source: any, author: any, signal: AbortSignal) =>
        realAuthor(source, (call: any) => author({ ...call, instructions: call.instructions.replace(`\n${COMPILER_RULES_STORYBOARD_ADDENDUM}`, '') }), signal)) as never)],
      // The provider request with something besides the rules.
      ['one more sentence', () => vi.spyOn(worker, 'simpleWizardVisualPayload').mockImplementation((call, model) => {
        const p = realPayload(call, model);
        return call.instructions.includes(COMPILER_RULES_STORYBOARD_ADDENDUM) ? { ...p, instructions: `${p.instructions}\nOne more sentence.` } : p;
      })],
    ] as const) {
      const spy = alter();
      for (const execute of [false, true]) await expect(attempt(3, textTransports(), execute), label).rejects.toThrow(/^new_book_continuation_request$/);
      nothingConsumed();
      spy.mockRestore();
    }
    expect(await attempt(3, textTransports(), false)).toMatchObject({ continuation3: { requestChangedOnlyByTheRule: true } });
  });

  it('a changed record of either earlier attempt, or a rewritten earlier amendment, refuses before anything is consumed', async () => {
    await refusedTwice();
    const t = textTransports(), p = (n: 1 | 2, f: string) => path.join(outN(n), 'paid-stages', f);
    const viaJson = (f: (r: any) => unknown) => (text: string) => JSON.stringify(f(JSON.parse(text)));
    const cases: [string, () => string, (text: string) => string, RegExp][] = [
      // The ledger re-derives every record from its own evidence first (Codex HOLD at a3578efb).
      ['second claim', () => p(2, 'storyboard.claim.json'), viaJson(r => ({ ...r, wireDigest: 'e'.repeat(64) })), /^new_book_ledger_record$/],
      ['second receipt cost', () => p(2, 'storyboard.receipt.json'), viaJson(r => ({ ...r, estimatedMicroUsd: r.estimatedMicroUsd + 1 })), /^new_book_ledger_cost$/],
      // The saved request changed alone (its claim's and result's digests untouched) no longer binds: the claim is its authority.
      ['second request alone', () => p(2, 'storyboard.wire.json'), viaJson(w => ({ ...w, instructions: swapOne(w.instructions) })), /^new_book_ledger_record$/],
      // The second answer itself, corrected so it lists no undeclared prop: then it is not the refusal this attempt was approved for.
      ['second answer corrected', () => p(2, 'storyboard.receipt.json'), viaJson(r => { const o = JSON.parse(r.raw.output_text);
        o.plan.pages[7].props = o.plan.pages[7].props.filter((x: { id: string }) => x.id !== 'enclosure_gate');
        return { ...r, raw: { ...r.raw, output_text: JSON.stringify(o) } }; }), /^new_book_continuation_scope$/],
      // The first continuation's records and amendment are bound by the second amendment.
      ['first receipt bytes', () => p(1, 'storyboard.receipt.json'), text => `${text} `, /^new_book_continuation_evidence$/],
      ['first amendment rewritten', () => experimentContinuationFile(config), text => JSON.stringify(JSON.parse(text), null, 4), /^new_book_continuation$/],
      // The second amendment's own ledger lines must be exactly the first continuation's (nothing else binds them before this attempt).
      ['second amendment carried', () => experimentContinuation2File(config), viaJson(r => ({ ...r, carriedUnresolvedMicroUsd: 1 })), /^new_book_continuation_ledger$/],
      ['second amendment prior', () => experimentContinuation2File(config), viaJson(r => ({ ...r, priorKnownApiMicroUsd: r.priorKnownApiMicroUsd + 1 })),
        /^new_book_continuation_ledger$/],
    ];
    for (const [label, fileOf, change, code] of cases) {
      const f = fileOf(), bytes = readFileSync(f);
      writeFileSync(f, change(bytes.toString('utf8')));
      for (const execute of [false, true]) await expect(attempt(3, t, execute), label).rejects.toThrow(code);
      nothingConsumed();
      writeFileSync(f, bytes);
    }
    // The second attempt's request rewritten with matching digests (same length) binds itself in the ledger; only the exact reconstruction refuses it.
    const restore = rewire(path.join(outN(2), 'paid-stages'), 'storyboard', w => ({ ...w, instructions: swapOne(w.instructions) }));
    for (const execute of [false, true]) await expect(attempt(3, t, execute)).rejects.toThrow(/^new_book_continuation_replay$/);
    nothingConsumed(); restore();
    expect([t.opus, t.reader, t.responses, sdk.create].map(m => m.mock.calls.length)).toEqual([0, 0, 0, 0]);
    expect(await attempt(3, t, false)).toMatchObject({ continuation3: { admissible: true } });
  });

  /** Rewrites the second attempt's saved answer (receipt, result) and regenerates its spend record, so the three summaries agree. */
  function rewriteSecondAnswer(change: (receipt: any, result: any) => void) {
    const root2 = path.join(outN(2), 'paid-stages'), files = ['storyboard.receipt.json', 'storyboard.result.json', '../spend.json'].map(f => path.join(root2, f));
    const saved = files.map(f => readFileSync(f)), receipt = json(files[0]), result = json(files[1]);
    change(receipt, result);
    writeFileSync(files[0], JSON.stringify(receipt, null, 2)); writeFileSync(files[1], JSON.stringify(result, null, 2));
    writeFileSync(files[2], JSON.stringify(new AuditionMeter(root2, 7000000, 2, 364000, reservation()).snapshot(), null, 2));
    return () => files.forEach((f, i) => writeFileSync(f, saved[i]));
  }

  it('an invalid or incoherent saved second answer fails closed before anything is consumed (each with agreeing summaries)', async () => {
    await refusedTwice();
    const t = textTransports();
    const cases: [string, (receipt: any, result: any) => void, RegExp][] = [
      ['another model', receipt => { receipt.raw.model = 'gpt-6-astra-mini'; receipt.model = 'gpt-6-astra-mini'; }, /^new_book_ledger_cost$/],
      ['not completed', receipt => { receipt.raw.status = 'incomplete'; }, /^new_book_ledger_cost$/],
      ['no usage', receipt => { receipt.raw.usage = null; receipt.usage = null; }, /^new_book_ledger_cost$/],
      ['normalized usage disagrees', receipt => { receipt.usage = { inputTokens: 1, outputTokens: 1 }; }, /^new_book_ledger_cost$/],
      ['unknown cost', (receipt, result) => { receipt.estimatedMicroUsd = null; result.estimatedMicroUsd = null; }, /^new_book_ledger_unknown$/],
    ];
    for (const [label, change, code] of cases) {
      const restore = rewriteSecondAnswer(change);
      for (const execute of [false, true]) await expect(attempt(3, t, execute), label).rejects.toThrow(code);
      expect([label, existsSync(experimentContinuation3File(config)), existsSync(outN(3))]).toEqual([label, false, false]);
      restore();
    }
    expect([t.opus, t.reader, t.responses, sdk.create].map(m => m.mock.calls.length)).toEqual([0, 0, 0, 0]);
    expect(await attempt(3, t, false)).toMatchObject({ continuation3: { admissible: true, previousStoryboardSettledMicroUsd: 350000 } });
  });

  it("the preview reports the new request's own reservation, which the run then claims (the live rule, at the storyboard's rate)", async () => {
    await refusedTwice();
    const preview = (await attempt(3, textTransports(), false)) as any, newReservation = preview.continuation3.newStoryboardReservationMicroUsd;
    await attempt(3);
    expect(json(path.join(outN(3), 'paid-stages', 'storyboard.claim.json')).maximumMicroUsd).toBe(newReservation);
    const wire3 = json(path.join(outN(3), 'paid-stages', 'storyboard.wire.json')), wire2 = json(path.join(outN(2), 'paid-stages', 'storyboard.wire.json'));
    expect(newReservation).toBe(Math.ceil((Buffer.byteLength(JSON.stringify(wire3), 'utf8') * 10 + wire3.max_output_tokens * 50) * 1.1));
    expect(wire3.max_output_tokens).toBe(wire2.max_output_tokens);
  });

  it('the preview re-checks after its asynchronous replays: a HEAD, tree or record change while they ran refuses, and nothing is written', async () => {
    await refusedTwice();
    const realFlow = flow.runSimpleWizardBook;
    const files = [path.join(outN(1), 'paid-stages', 'storyboard.receipt.json'), path.join(outN(2), 'paid-stages', 'storyboard.receipt.json'),
      experimentContinuation2File(config)];
    const saved = files.map(f => readFileSync(f));
    for (const [label, change, code] of [
      ['head', () => headAt('2'.repeat(40)), /^new_book_source_changed$/],
      ['dirty', () => headAt('1'.repeat(40), ' M scripts/personal-new-book-experiment.ts'), /^new_book_source_changed$/],
      ['first record', () => writeFileSync(files[0], `${saved[0].toString('utf8')} `), /^new_book_continuation_evidence$/],
      ['second record', () => writeFileSync(files[1], `${saved[1].toString('utf8')} `), /^new_book_continuation_evidence$/],
      ['second amendment', () => writeFileSync(files[2], JSON.stringify(JSON.parse(saved[2].toString('utf8')), null, 4)), /^new_book_continuation_evidence$/],
    ] as const) {
      // The admission replays twice (the second answer, then the new request): the change lands after the second replay.
      let replays = 0;
      const spy = vi.spyOn(flow, 'runSimpleWizardBook').mockImplementation(async a => { try { return await realFlow(a); } finally { if (++replays === 2) change(); } });
      await expect(attempt(3, textTransports(), false), label).rejects.toThrow(code);
      nothingConsumed();
      spy.mockRestore(); files.forEach((f, i) => writeFileSync(f, saved[i])); headAt('1'.repeat(40));
    }
    expect(await attempt(3, textTransports(), false)).toMatchObject({ continuation3: { admissible: true } });
  });

  it('every source or record change after admission, up to and just past the third amendment, refuses: before it nothing is consumed; after it no call', { timeout: 900_000 }, async () => {
    type Event = 'head' | 'dirty' | 'request' | 'firstRecord' | 'firstAmendment' | 'receipt' | 'previous';
    const resetSlot = () => { for (const d of [experimentDir(config), path.dirname(experimentClaimFile(config))]) {
      if (!path.resolve(d).startsWith(path.resolve(root))) throw Error('reset_boundary'); rmSync(d, { recursive: true, force: true }); } };
    const receiptOf = (n: 1 | 2) => path.join(outN(n), 'paid-stages', 'storyboard.receipt.json');
    async function boundaryRun(event: Event | null, at: number) {
      await eventLoopTurn();
      resetSlot(); headAt('a'.repeat(40)); await refusedTwice();
      const amendmentFile = experimentContinuation3File(config);
      const before = Object.fromEntries(Object.entries(tree(outN(2))).map(([k, v]) => [`${NEW_BOOK_CONTINUATION_2.outDir}/${k}`, v]));
      let reads = 0, fired = false;
      const amendedAtRead: boolean[] = [];
      const fire = () => {
        fired = true;
        if (event === 'request') { const f = path.join(dir(), 'request.json'); writeFileSync(f, JSON.stringify({ ...json(f), requestId: 'f'.repeat(64) })); }
        if (event === 'firstRecord') writeFileSync(receiptOf(1), `${readFileSync(receiptOf(1), 'utf8')} `);
        if (event === 'firstAmendment') writeFileSync(experimentContinuationFile(config), JSON.stringify(json(experimentContinuationFile(config)), null, 4));
        if (event === 'receipt') writeFileSync(receiptOf(2), `${readFileSync(receiptOf(2), 'utf8')} `);
        // The second amendment re-serialized: same meaning, but no longer the bytes the third attempt was admitted under.
        if (event === 'previous') writeFileSync(experimentContinuation2File(config), JSON.stringify(json(experimentContinuation2File(config)), null, 4));
      };
      vi.mocked(frozen.gitAt).mockImplementation((_repo, args) => {
        const a = args.join(' ');
        if (a === 'rev-parse HEAD') {
          reads++; amendedAtRead.push(existsSync(amendmentFile));
          if (event && reads === at) fire();
          return Buffer.from(fired && event === 'head' ? '2'.repeat(40) : '1'.repeat(40));
        }
        return Buffer.from(a === 'status --porcelain' ? (fired && event === 'dirty' ? ' M scripts/personal-new-book-experiment.ts' : '') : path.join(root, 'git-common'));
      });
      const t = textTransports(), real = t.responses.getMockImplementation()!, afterEvent: string[] = [];
      t.responses.mockImplementation((async (payload: any, ...rest: unknown[]) => { if (fired) afterEvent.push(payload.model); return (real as any)(payload, ...rest); }) as never);
      const outcome = await attempt(3, t).then(() => 'ok', (error: Error) => error.message);
      return { outcome, amendedAtRead, afterEvent, before, opusOrReader: t.opus.mock.calls.length + t.reader.mock.calls.length,
        amendment: existsSync(amendmentFile) ? json(amendmentFile) : null, folder: existsSync(outN(3)) };
    }
    // Calibration: an unchanged run succeeds; count the HEAD reads made before the third amendment is written.
    const calm = await boundaryRun(null, 0);
    expect(calm.outcome).toBe('ok');
    const beforeWrite = calm.amendedAtRead.indexOf(true);
    // The capture, the admission, the check after the asynchronous replays and the amendment's own re-check.
    expect(beforeWrite).toBeGreaterThanOrEqual(4);
    const codes: Record<Event, RegExp> = { head: /^new_book_source_changed$/, dirty: /^new_book_source_changed$/,
      // Already bound before this attempt: the request and the first continuation's records (by the first and second amendments).
      request: /^new_book_continuation_evidence$/, firstRecord: /^new_book_continuation_evidence$/, firstAmendment: /^new_book_continuation$/,
      receipt: /^new_book_continuation_evidence$/, previous: /^new_book_continuation(_evidence)?$/ };
    // Read 1 is the capture; read 2 opens the admission (source first, then the records it binds). Records first bound by THIS admission (the
    // second attempt's, and the second amendment's bytes) count from read 3; records an earlier amendment already binds are refused at any read.
    const first: Record<Event, number> = { head: 2, dirty: 2, request: 2, firstRecord: 2, firstAmendment: 2, receipt: 3, previous: 3 };
    for (const event of Object.keys(first) as Event[]) for (let at = first[event]; at <= beforeWrite + 1; at++) {
      const r = await boundaryRun(event, at), label = `${event}@${at}`;
      expect(`${label}: ${r.outcome}`).toMatch(new RegExp(`^${label}: ${codes[event].source.slice(1, -1)}$`));
      expect(`${label}: ${r.afterEvent.length} calls after the change, ${r.opusOrReader} story calls`).toBe(`${label}: 0 calls after the change, 0 story calls`);
      if (at <= beforeWrite) {
        expect(`${label}: amendment ${!!r.amendment}, folder ${r.folder}`).toBe(`${label}: amendment false, folder false`);
        continue;
      }
      // After the third amendment the attempt may already be spent, but nothing is claimed or called: a folder, if made, is sealed failed.
      if (r.folder) expect([label, json(path.join(outN(3), 'sealed.json')).status, json(path.join(outN(3), 'sealed.json')).code, claims(path.join(outN(3), 'paid-stages'))])
        .toEqual([label, 'failed', r.outcome, []]);
      expect([label, r.amendment?.sourceHead, Object.fromEntries(r.amendment.evidence.map((e: { file: string; sha256: string }) => [e.file, e.sha256]))])
        .toEqual([label, '1'.repeat(40), r.before]);
    }
  });

  it('one pinned HEAD and the complete request record: a change refuses; once amended its HEAD is compared; single use', async () => {
    await refusedTwice();
    let heads = 0;
    vi.mocked(frozen.gitAt).mockImplementation((_repo, args) => Buffer.from(args.join(' ') === 'rev-parse HEAD' ? (++heads <= 2 ? '1' : '2').repeat(40)
      : args.join(' ') === 'status --porcelain' ? '' : path.join(root, 'git-common')));
    await expect(attempt(3)).rejects.toThrow(/^new_book_source_changed$/);
    nothingConsumed();
    headAt('1'.repeat(40), ' M scripts/personal-new-book-experiment.ts');
    await expect(attempt(3)).rejects.toThrow(/^new_book_source_changed$/);
    nothingConsumed();
    headAt('1'.repeat(40));
    const request = path.join(dir(), 'request.json'), bytes = readFileSync(request);
    // The saved request is already bound by the first amendment's evidence, which refuses first.
    writeFileSync(request, JSON.stringify({ ...JSON.parse(bytes.toString('utf8')), requestId: 'f'.repeat(64) }));
    for (const execute of [false, true]) await expect(attempt(3, textTransports(), execute)).rejects.toThrow(/^new_book_continuation_evidence$/);
    nothingConsumed();
    writeFileSync(request, bytes);
    expect(await attempt(3)).toMatchObject({ status: 'review_supported' });
    headAt('2'.repeat(40));
    for (const execute of [false, true]) await expect(attempt(3, textTransports(), execute)).rejects.toThrow('new_book_source_changed');
    headAt('1'.repeat(40));
    await expect(attempt(3)).rejects.toThrow('new_book_continuation_used');
  });

  it('one attempt only: a third attempt refused again is sealed failed; nothing can retry or build on it', async () => {
    await refusedTwice();
    await expect(attempt(3, textTransports({ storyboardOutput: undeclaredPropStoryboard }))).rejects.toThrow('unknown_or_duplicate_prop');
    expect(json(path.join(outN(3), 'sealed.json'))).toEqual({ status: 'failed', code: 'unknown_or_duplicate_prop', continuation: NEW_BOOK_CONTINUATION_3.id,
      runtimeEligible: false });
    const again = textTransports();
    await expect(attempt(3, again)).rejects.toThrow('new_book_continuation_used');
    // Nor can an earlier attempt be re-entered once a later one exists.
    for (const execute of [false, true]) await expect(attempt(2, again, execute)).rejects.toThrow(/^new_book_continuation_scope$/);
    await expect(child()).rejects.toThrow('new_book_text_not_supported');
    expect([again.opus, again.reader, again.responses].map(m => m.mock.calls.length)).toEqual([0, 0, 0]);
  });

  it('after the third amendment, a changed second-attempt record, a rewritten second amendment or a disagreeing ledger refuses every later stage', async () => {
    await refusedTwice(); await attempt(3);
    const receipt = path.join(outN(2), 'paid-stages', 'storyboard.receipt.json'), bytes = readFileSync(receipt);
    writeFileSync(receipt, Buffer.concat([bytes, Buffer.from(' ')]));
    await expect(child()).rejects.toThrow('new_book_continuation_evidence');
    writeFileSync(receipt, bytes);
    const a2 = experimentContinuation2File(config), a2Bytes = readFileSync(a2);
    writeFileSync(a2, JSON.stringify(JSON.parse(a2Bytes.toString('utf8')), null, 4));
    await expect(child()).rejects.toThrow(/^new_book_continuation$/);
    writeFileSync(a2, a2Bytes);
    const a3 = experimentContinuation3File(config), a3Bytes = readFileSync(a3);
    writeFileSync(a3, JSON.stringify({ ...JSON.parse(a3Bytes.toString('utf8')), carriedUnresolvedMicroUsd: 1 }));
    await expect(child()).rejects.toThrow('new_book_continuation_ledger');
    writeFileSync(a3, a3Bytes);
    expect(await child()).toMatchObject({ status: 'child_reference_passed' });
  });

  // ---- Codex HOLD at a3578efb (P1): every carried amount is re-derived from its own evidence, not only the latest answer's ----
  const paid = (folder: string) => path.join(dir(), folder, 'paid-stages');
  /** A stage's saved answer rewritten (receipt and result); its raw evidence stays as it was unless `change` alters it. */
  function rewriteAnswer(folder: string, step: string, change: (receipt: any, result: any, wire: any) => void) {
    const at = (k: string) => path.join(paid(folder), `${step}.${k}.json`), receipt = json(at('receipt')), result = json(at('result'));
    change(receipt, result, json(at('wire')));
    writeFileSync(at('receipt'), JSON.stringify(receipt)); writeFileSync(at('result'), JSON.stringify(result));
  }
  /**
   * The strongest coherent rewrite before the third amendment exists (Codex's reproduction, generalized): every stage's spend record is
   * regenerated with the real meter, both earlier amendments' ledger lines and evidence are re-derived from the rewritten records, and the
   * second amendment is rebound to the first's new bytes. Then only the raw evidence can still contradict the rewritten summaries.
   */
  function rebindChain() {
    const d = dir(), rehash = (a: any) => ({ ...a, evidence: a.evidence.map((e: { file: string }) => ({ ...e, sha256: sha(readFileSync(path.join(d, ...e.file.split('/')))) })) });
    const snap = (folder: string, maxCalls: number, prior = 0, carried = 0) => {
      const snapshot = new AuditionMeter(path.join(d, folder, 'paid-stages'), 7000000, maxCalls, prior, carried).snapshot();
      writeFileSync(path.join(d, folder, 'spend.json'), JSON.stringify(snapshot)); return snapshot;
    };
    const text = snap('text', 4), known = text.newKnownApiMicroUsd, carried = text.reservedUnsettledMicroUsd;
    const a1 = experimentContinuationFile(config);
    writeFileSync(a1, JSON.stringify(rehash({ ...json(a1), priorKnownApiMicroUsd: known, carriedUnresolvedMicroUsd: carried })));
    const prior2 = known + snap(NEW_BOOK_CONTINUATION.outDir, 2, known, carried).newKnownApiMicroUsd;
    const a2 = experimentContinuation2File(config);
    writeFileSync(a2, JSON.stringify(rehash({ ...json(a2), previousSha256: sha(readFileSync(a1)), priorKnownApiMicroUsd: prior2, carriedUnresolvedMicroUsd: carried })));
    const prior3 = prior2 + snap(NEW_BOOK_CONTINUATION_2.outDir, 2, prior2, carried).newKnownApiMicroUsd, a3 = experimentContinuation3File(config);
    if (existsSync(a3)) {
      writeFileSync(a3, JSON.stringify(rehash({ ...json(a3), previousSha256: sha(readFileSync(a2)), priorKnownApiMicroUsd: prior3, carriedUnresolvedMicroUsd: carried })));
      snap(NEW_BOOK_CONTINUATION_3.outDir, 2, prior3, carried);
    }
    return { known, carried, prior3 };
  }
  /**
   * A saved storyboard request rewritten with a lower output cap, its claim's and result's digests and its claim's maximum re-derived by the
   * live reservation rule, so the record is self-consistent (Codex's reproduction at 7af52722). Returns the lowered maximum.
   */
  function lowerRequestCap(folder: string, by = 1000) {
    const at = (k: string) => path.join(paid(folder), `storyboard.${k}.json`), wire = json(at('wire'));
    wire.max_output_tokens -= by;
    const wireDigest = sha(canonicalJson(wire));
    const maximumMicroUsd = Math.ceil((Buffer.byteLength(JSON.stringify(wire), 'utf8') * 10 + wire.max_output_tokens * 50) * 1.1);
    writeFileSync(at('wire'), JSON.stringify(wire));
    writeFileSync(at('claim'), JSON.stringify({ ...json(at('claim')), wireDigest, maximumMicroUsd }));
    writeFileSync(at('result'), JSON.stringify({ ...json(at('result')), wireDigest }));
    return maximumMicroUsd;
  }
  const fresh = async () => {
    for (const d of [experimentDir(config), path.dirname(experimentClaimFile(config))]) {
      if (!path.resolve(d).startsWith(path.resolve(root))) throw Error('reset_boundary'); rmSync(d, { recursive: true, force: true }); }
    headAt('a'.repeat(40)); await refusedTwice();
  };

  it('control: the coherent rewrite of an UNCHANGED chain keeps the genuine admission and numbers (the refusals below come from evidence only)', async () => {
    await refusedTwice();
    const before = (await attempt(3, textTransports(), false)) as any;
    expect(rebindChain()).toMatchObject({ known: 14000, prior3: 714000, carried: before.continuation3.carriedUnresolvedMicroUsd });
    expect(await attempt(3, textTransports(), false)).toMatchObject({ continuation3: { admissible: true, priorKnownApiMicroUsd: 714000,
      carriedUnresolvedMicroUsd: before.continuation3.carriedUnresolvedMicroUsd, previousStoryboardSettledMicroUsd: 350000 } });
  });

  it("Codex's reproduction: an OLDER answer's cost lowered coherently (summaries, spend, rebound second amendment, later ledger) is refused", async () => {
    await refusedTwice();
    const raw = json(path.join(paid(NEW_BOOK_CONTINUATION.outDir), 'storyboard.receipt.json')).raw;
    rewriteAnswer(NEW_BOOK_CONTINUATION.outDir, 'storyboard', (receipt, result) => { receipt.estimatedMicroUsd = 1; result.estimatedMicroUsd = 1; });
    // At a3578efb this chain was admitted with a prior of 364,001 instead of 714,000.
    expect(rebindChain().prior3).toBe(14000 + 1 + 350000);
    expect(json(path.join(paid(NEW_BOOK_CONTINUATION.outDir), 'storyboard.receipt.json')).raw).toEqual(raw);
    const t = textTransports();
    for (const execute of [false, true]) await expect(attempt(3, t, execute)).rejects.toThrow(/^new_book_ledger_cost$/);
    nothingConsumed();
    expect([t.opus, t.reader, t.responses, sdk.create].map(m => m.mock.calls.length)).toEqual([0, 0, 0, 0]);
  });

  it('every invalid or incoherent OLDER answer, with the whole chain rebound to it, fails closed before anything is consumed', { timeout: 600_000 }, async () => {
    const settleAstra = (u: { input_tokens: number; output_tokens: number }) => u.input_tokens * 10 + u.output_tokens * 50;
    const cases: [string, (receipt: any, result: any, wire: any) => void, RegExp][] = [
      ['another model', receipt => { receipt.raw.model = 'gpt-6-astra-mini'; receipt.model = 'gpt-6-astra-mini'; }, /^new_book_ledger_cost$/],
      ['another tier', receipt => { receipt.raw.service_tier = 'flex'; }, /^new_book_ledger_cost$/],
      ['not completed', receipt => { receipt.raw.status = 'incomplete'; }, /^new_book_ledger_cost$/],
      ['malformed usage', receipt => { receipt.raw.usage = { ...receipt.raw.usage, input_tokens: -1 }; }, /^new_book_ledger_cost$/],
      // A coherent cost for a larger usage, beyond the call's output cap: only the cap refuses it.
      ['beyond the output cap', (receipt, result, wire) => {
        receipt.raw.usage = { ...receipt.raw.usage, output_tokens: wire.max_output_tokens + 1 };
        receipt.usage = { inputTokens: receipt.raw.usage.input_tokens, outputTokens: wire.max_output_tokens + 1 };
        receipt.estimatedMicroUsd = result.estimatedMicroUsd = settleAstra(receipt.raw.usage); }, /^new_book_ledger_cost$/],
      ['normalized usage disagrees', receipt => { receipt.usage = { inputTokens: 1, outputTokens: 1 }; }, /^new_book_ledger_cost$/],
      ['receipt labels disagree', receipt => { receipt.stage = 'storyboard_review'; }, /^new_book_ledger_cost$/],
      ['negative cost', (receipt, result) => { receipt.estimatedMicroUsd = -5; result.estimatedMicroUsd = -5; }, /^new_book_ledger_cost$/],
      ['unknown cost', (receipt, result) => { receipt.estimatedMicroUsd = null; result.estimatedMicroUsd = null; }, /^new_book_ledger_unknown$/],
    ];
    for (const [label, change, code] of cases) {
      await fresh();
      rewriteAnswer(NEW_BOOK_CONTINUATION.outDir, 'storyboard', change); rebindChain();
      const t = textTransports();
      for (const execute of [false, true]) await expect(attempt(3, t, execute), label).rejects.toThrow(code);
      expect([label, existsSync(experimentContinuation3File(config)), existsSync(outN(3)), t.responses.mock.calls.length]).toEqual([label, false, false, 0]);
    }
  });

  it("an older READER's cost lowered coherently is refused: the text stage's readers are re-derived from their raw answers too", async () => {
    await refusedTwice();
    rewriteAnswer('text', 'comparison', (receipt, result) => { receipt.estimatedMicroUsd = 1; result.estimatedMicroUsd = 1; });
    expect(rebindChain().known).toBe(7001);
    const t = textTransports();
    for (const execute of [false, true]) await expect(attempt(3, t, execute)).rejects.toThrow(/^new_book_ledger_cost$/);
    nothingConsumed();
    // The cost unchanged, but the reader's normalized usage contradicting its raw answer, or its raw answer not a valid one: refused as well.
    for (const [label, change] of [['normalized usage', (receipt: any) => { receipt.usage = { inputTokens: 1, outputTokens: 1 }; }],
      ['not completed', (receipt: any) => { receipt.raw.status = 'incomplete'; }]] as const) {
      await fresh();
      rewriteAnswer('text', 'final_review', change); rebindChain();
      for (const execute of [false, true]) await expect(attempt(3, t, execute), label).rejects.toThrow(/^new_book_ledger_cost$/);
      nothingConsumed();
    }
  });

  it("the CARRIED reservation lowered coherently is refused: it is re-derived from the timed-out call's own bound request", async () => {
    await refusedTwice();
    const claimFile = path.join(paid('text'), 'storyboard.claim.json');
    writeFileSync(claimFile, JSON.stringify({ ...json(claimFile), maximumMicroUsd: 1000000 }));
    expect(rebindChain().carried).toBe(1000000);
    const t = textTransports();
    for (const execute of [false, true]) await expect(attempt(3, t, execute)).rejects.toThrow(/^new_book_ledger_cost$/);
    nothingConsumed();
  });

  it("after the third attempt, its own storyboard's or review's cost lowered coherently refuses the child stage (every later read re-derives it)", async () => {
    await refusedTwice(); await attempt(3);
    const spend3 = path.join(outN(3), 'spend.json'), a3 = json(experimentContinuation3File(config));
    for (const step of ['storyboard', 'storyboard_review']) {
      const at = (k: string) => path.join(paid(NEW_BOOK_CONTINUATION_3.outDir), `${step}.${k}.json`);
      const saved = ['receipt', 'result'].map(k => readFileSync(at(k))), savedSpend = readFileSync(spend3);
      rewriteAnswer(NEW_BOOK_CONTINUATION_3.outDir, step, (receipt, result) => { receipt.estimatedMicroUsd = 1; result.estimatedMicroUsd = 1; });
      writeFileSync(spend3, JSON.stringify(new AuditionMeter(paid(NEW_BOOK_CONTINUATION_3.outDir), 7000000, 2, a3.priorKnownApiMicroUsd,
        a3.carriedUnresolvedMicroUsd).snapshot()));
      await expect(child(), step).rejects.toThrow(/^new_book_ledger_cost$/);
      expect(existsSync(path.join(dir(), 'child'))).toBe(false);
      ['receipt', 'result'].forEach((k, i) => writeFileSync(at(k), saved[i])); writeFileSync(spend3, savedSpend);
    }
    expect(await child()).toMatchObject({ status: 'child_reference_passed' });
  });

  // ---- Codex HOLD at 7af52722 (P1): the ORIGINAL timed-out request is reconstructed from the roots before its reservation is admitted ----
  it("Codex's reproduction: the ORIGINAL request rewritten with a lower cap (digests, maximum and every ledger above it rebound) is refused", async () => {
    await refusedTwice();
    const before = (await attempt(3, textTransports(), false)) as any, first = readFileSync(path.join(paid(NEW_BOOK_CONTINUATION.outDir), 'storyboard.wire.json'));
    const lowered = lowerRequestCap('text');
    expect(rebindChain().carried).toBe(lowered);
    expect(lowered).toBe(before.continuation3.carriedUnresolvedMicroUsd - 1000 * 50 * 1.1);
    const t = textTransports();
    for (const execute of [false, true]) await expect(attempt(3, t, execute)).rejects.toThrow(/^new_book_original_request$/);
    nothingConsumed();
    expect([t.opus, t.reader, t.responses, sdk.create].map(m => m.mock.calls.length)).toEqual([0, 0, 0, 0]);
    // The first continuation's request (which re-sent the original) was untouched: the reference is the reconstruction, not that file.
    expect(readFileSync(path.join(paid(NEW_BOOK_CONTINUATION.outDir), 'storyboard.wire.json'))).toEqual(first);
  });

  it('the original AND the first continuation requests rewritten together, with matching digests and ledgers, are refused all the same', async () => {
    await refusedTwice();
    const lowered = lowerRequestCap('text');
    // The first continuation re-sent exactly the original request: lowered the same way, its own maximum and settled cost stay coherent.
    expect(lowerRequestCap(NEW_BOOK_CONTINUATION.outDir)).toBe(lowered);
    expect(rebindChain().carried).toBe(lowered);
    expect(readFileSync(path.join(paid('text'), 'storyboard.wire.json'), 'utf8')).toBe(readFileSync(path.join(paid(NEW_BOOK_CONTINUATION.outDir), 'storyboard.wire.json'), 'utf8'));
    const t = textTransports();
    for (const execute of [false, true]) await expect(attempt(3, t, execute)).rejects.toThrow(/^new_book_original_request$/);
    nothingConsumed();
    expect(t.responses.mock.calls.length).toBe(0);
  });

  it('after the third attempt completed, no later consumer re-admits a rewritten original reservation: the child, the grant, the audition', { timeout: 600_000 }, async () => {
    const rewriteAfter = () => { lowerRequestCap('text'); return rebindChain().carried; };
    // The child stage (its meter would carry the lowered reservation).
    await refusedTwice(); await attempt(3);
    rewriteAfter();
    await expect(child()).rejects.toThrow(/^new_book_original_request$/);
    expect(existsSync(path.join(dir(), 'child'))).toBe(false);
    // The grant, after a genuine child stage.
    await fresh(); await attempt(3); expect(await child()).toMatchObject({ status: 'child_reference_passed' });
    rewriteAfter();
    await expect(writeNewBookGrant(newBookConfig(file))).rejects.toThrow(/^new_book_original_request$/);
    expect(existsSync(path.join(dir(), 'audition.grant.json'))).toBe(false);
    // The audition, after a genuine grant (its own comparison comes after this check).
    await fresh(); await attempt(3); await child(); await writeNewBookGrant(newBookConfig(file));
    // Fully coherent: the child's spend and the grant file rewritten to the lowered reservation too, so only this check can refuse it.
    const lowered = rewriteAfter(), a3 = json(experimentContinuation3File(config)), c3 = json(path.join(outN(3), 'spend.json')).newKnownApiMicroUsd;
    writeFileSync(path.join(dir(), 'child', 'spend.json'), JSON.stringify(new AuditionMeter(path.join(dir(), 'child', 'paid-stages'), 7000000, 4,
      a3.priorKnownApiMicroUsd + c3, lowered).snapshot()));
    const g = path.join(dir(), 'audition.grant.json'), grant = json(g);
    writeFileSync(g, JSON.stringify({ ...grant, ledger: { ...grant.ledger, carriedUnresolvedMicroUsd: lowered,
      evidence: grant.ledger.evidence.map((e: { file: string }) => ({ ...e, sha256: sha(readFileSync(e.file)) })) } }));
    await expect(runNewBookAudition({ config: newBookConfig(file), signal: new AbortController().signal, log: () => {} })).rejects.toThrow(/^new_book_original_request$/);
    expect([existsSync(experimentAuditionStart(config)), existsSync(path.join(dir(), 'audition'))]).toEqual([false, false]);
  });

  it('the amendment chain is ordered: a second amendment without the first is refused', async () => {
    await refusedTwice();
    const a1 = experimentContinuationFile(config);
    renameSync(a1, `${a1}.aside`);
    expect(() => assertExperimentClaim(newBookConfig(file))).toThrow(/^new_book_continuation$/);
    for (const n of [2, 3] as const) await expect(attempt(n, textTransports(), false)).rejects.toThrow(/^new_book_continuation(_scope)?$/);
    nothingConsumed();
  });
  it('the amendment chain is ordered: a third amendment without a second is refused everywhere', async () => {
    await timedOut(); headAt('c'.repeat(40));
    await expect(continuation(textTransports({ storyboardOutput: driftingStoryboard }))).rejects.toThrow();
    writeFileSync(experimentContinuation3File(config), '{}');
    expect(() => assertExperimentClaim(newBookConfig(file))).toThrow(/^new_book_continuation$/);
    for (const n of [2, 3] as const) await expect(attempt(n, textTransports(), false)).rejects.toThrow(/^new_book_continuation$/);
  });
});

describe("the readers' re-derivation is the reader transport's own rule", () => {
  it('for a valid answer and every invalid one: the same cost, normalized usage and validity as the live transport', async () => {
    const policy = { executable: config.executable, executableSha256: config.executableSha256, workspace: root, maxWireBytes: 104000,
      rates: { opus: { inputMicroUsdPerToken: 4, outputMicroUsdPerToken: 20 }, astra: replaySettlement.rates.sol }, openAIReviewModel: 'gpt-6.1-sol' as const };
    const call = { role: 'astra', stage: 'comparison', instructions: 'Read the packet.', input: '{}', maxOutputTokens: 16000,
      schema: z.object({ ok: z.boolean() }).strict(), conversationKey: 'new-book:test:comparison' } as any;
    const wire = causalAdapters.prepareCausalWire(call, policy, 2000000);
    const transport = causalAdapters.createAstraCausalTransport({ key: () => 'sk-synthetic', rates: replaySettlement.rates.sol, model: 'gpt-6.1-sol' });
    const base = { model: 'gpt-6.1-sol', service_tier: 'default', status: 'completed', output_text: '{"ok":true}', usage: { input_tokens: 5177, output_tokens: 1231 } };
    const raws = [base, { ...base, service_tier: 'flex' }, { ...base, model: 'gpt-6-astra' }, { ...base, usage: null }, { ...base, status: 'incomplete' },
      { ...base, output_text: '' }, { ...base, usage: { input_tokens: 5177, output_tokens: 16001 } }, { ...base, usage: { input_tokens: -1, output_tokens: 3 } }];
    for (const raw of raws) {
      sdk.create.mockResolvedValueOnce(raw);
      const live = await transport(wire, call, new AbortController().signal).then(r => ({ valid: true, receipt: r as any }), (e: any) => ({ valid: false, receipt: e.receipt }));
      const replay = replaySettlement.answer(replaySettlement.rates.sol, wire.outputCap, wire.model, raw);
      expect([JSON.stringify(raw), live.receipt.estimatedMicroUsd, live.receipt.usage, live.valid])
        .toEqual([JSON.stringify(raw), replay.estimatedMicroUsd, replay.usage, replay.valid]);
    }
    // The real book's comparison reading: 5,177 x 2 + 1,231 x 10.
    expect(replaySettlement.answer(replaySettlement.rates.sol, 16000, 'gpt-6.1-sol', base).estimatedMicroUsd).toBe(22664);
  });
});

describe('own-stage meter integrity (approved offline milestone): every experiment meter re-derives its own calls before each of its claims', { timeout: 600_000 }, () => {
  it('text stage: a reader cost lowered between calls refuses the next claim before its call; no ledger or seal is written from contradicted records', async () => {
    const t = textTransports(), textDir = path.join(experimentDir(config), 'text'), paid = path.join(textDir, 'paid-stages'), lowered = lowerFirstSettled(paid);
    await expect(run(t)).rejects.toThrow(/^audition_meter_cost$/);
    expect(['comparison', 'final_review']).toContain(lowered());
    expect([claims(paid), t.reader.mock.calls.length, t.responses.mock.calls.length]).toEqual([[lowered()], 1, 0]);
    expect(['spend.json', 'sealed.json'].map(f => existsSync(path.join(textDir, f)))).toEqual([false, false]);
  });
  it('first continuation: its storyboard cost lowered between calls refuses the review claim before its call', async () => {
    await timedOut(); headAt('c'.repeat(40));
    const t = textTransports(), paid = path.join(experimentDir(config), NEW_BOOK_CONTINUATION.outDir, 'paid-stages'), lowered = lowerFirstSettled(paid);
    await expect(continuation(t)).rejects.toThrow(/^audition_meter_cost$/);
    expect([lowered(), claims(paid), t.responses.mock.calls.length]).toEqual(['storyboard', ['storyboard'], 1]);
  });
  it('second attempt: its storyboard cost lowered between calls refuses the review claim before its call', async () => {
    await timedOut(); headAt('c'.repeat(40));
    await expect(continuation(textTransports({ storyboardOutput: driftingStoryboard }))).rejects.toThrow('book_sequence_scene_location_drift');
    headAt('e'.repeat(40));
    const t = textTransports(), paid = path.join(experimentDir(config), NEW_BOOK_CONTINUATION_2.outDir, 'paid-stages'), lowered = lowerFirstSettled(paid);
    await expect(newBookExperimentCLI(['--config', file, 'storyboard-continuation-2', '--execute'], { text: t, log: () => {} })).rejects.toThrow(/^audition_meter_cost$/);
    expect([lowered(), claims(paid), t.responses.mock.calls.length]).toEqual(['storyboard', ['storyboard'], 1]);
  });
  it('third attempt (the one still approved): its storyboard cost lowered between calls refuses the review claim before its call', async () => {
    await timedOut(); headAt('c'.repeat(40));
    await expect(continuation(textTransports({ storyboardOutput: driftingStoryboard }))).rejects.toThrow('book_sequence_scene_location_drift');
    headAt('e'.repeat(40));
    await expect(newBookExperimentCLI(['--config', file, 'storyboard-continuation-2', '--execute'],
      { text: textTransports({ storyboardOutput: undeclaredPropStoryboard }), log: () => {} })).rejects.toThrow('unknown_or_duplicate_prop');
    headAt('1'.repeat(40));
    const t = textTransports(), paid = path.join(experimentDir(config), NEW_BOOK_CONTINUATION_3.outDir, 'paid-stages'), lowered = lowerFirstSettled(paid);
    await expect(newBookExperimentCLI(['--config', file, 'storyboard-continuation-3', '--execute'], { text: t, log: () => {} })).rejects.toThrow(/^audition_meter_cost$/);
    expect([lowered(), claims(paid), t.responses.mock.calls.length]).toEqual(['storyboard', ['storyboard'], 1]);
  });
  it('child reference (real adapters, synthetic answers): the render cost lowered between calls refuses the judgment claim before its call', async () => {
    await run();
    vi.spyOn(images, 'generateGPTImage').mockImplementation(async input => {
      const buffer = await png(30, 1024), usage = { input_tokens: 100, output_tokens: 300 };
      input.observeProviderResponse?.({ data: [{ b64_json: buffer.toString('base64') }], usage });
      return { buffer, usage, model: 'gpt-image-2', finalPrompt: input.finalPrompt, hasReferencePhoto: false, apiMode: 'images.generate',
        referenceCountRequested: 0, referenceCountPassed: 0, durationMs: 1, fallbackUsed: false } as never;
    });
    sdk.create.mockImplementation(async (payload: any) => {
      const text = JSON.parse(payload.input[0].content[0].text);
      return { model: 'gpt-6.1-sol', service_tier: 'default', status: 'completed', usage: { input_tokens: 5000, output_tokens: 800 },
        output_text: JSON.stringify(passing(text.candidateSha, text.contextSha)) };
    });
    const childDir = path.join(experimentDir(config), 'child'), paid = path.join(childDir, 'paid-stages'), lowered = lowerFirstSettled(paid);
    await expect(runNewBookChild({ config: newBookConfig(file), signal: new AbortController().signal, log: () => {} })).rejects.toThrow(/^audition_meter_cost$/);
    expect([lowered(), claims(paid), vi.mocked(images.generateGPTImage).mock.calls.length, sdk.create.mock.calls.length])
      .toEqual(['reference_child', ['reference_child'], 1, 0]);
    expect(['spend.json', 'sealed.json'].map(f => existsSync(path.join(childDir, f)))).toEqual([false, false]);
  });
  it('a storyboard record renamed as its review (summaries, labels, reservations and spend rewritten to match) is refused: each stage keeps its own model', async () => {
    const t = textTransports(), real = t.responses.getMockImplementation()! as (...a: unknown[]) => Promise<any>;
    // A long storyboard answer and a short review: trading their rates would lower the stage's cost.
    t.responses.mockImplementation((async (payload: any, ...rest: unknown[]) => ({ ...await real(payload, ...rest),
      usage: payload.model === 'gpt-6-astra' ? { input_tokens: 30000, output_tokens: 15000 } : { input_tokens: 1000, output_tokens: 500 } })) as never);
    expect((await run(t)).status).toBe('review_supported');
    const textDir = path.join(experimentDir(config), 'text'), paid = path.join(textDir, 'paid-stages'), at = (s: string, k: string) => path.join(paid, `${s}.${k}.json`);
    const genuine = stageLedger(textDir, 4, 0, 0, stageRules.text).knownMicroUsd, kinds = ['wire', 'claim', 'result', 'receipt'];
    for (const k of kinds) renameSync(at('storyboard', k), at('swapped', k));
    for (const k of kinds) renameSync(at('storyboard_review', k), at('storyboard', k));
    for (const k of kinds) renameSync(at('swapped', k), at('storyboard_review', k));
    for (const [step, rate] of [['storyboard', replaySettlement.rates.astra], ['storyboard_review', replaySettlement.rates.sol]] as const) {
      const wire = json(at(step, 'wire')), receipt = json(at(step, 'receipt')), usage = receipt.raw.usage;
      const cost = Math.ceil(usage.input_tokens * rate.inputMicroUsdPerToken + usage.output_tokens * rate.outputMicroUsdPerToken);
      writeFileSync(at(step, 'claim'), JSON.stringify({ ...json(at(step, 'claim')), step,
        maximumMicroUsd: causalAdapters.wireReservation(Buffer.byteLength(JSON.stringify(wire), 'utf8'), wire.max_output_tokens, rate) }));
      writeFileSync(at(step, 'result'), JSON.stringify({ ...json(at(step, 'result')), estimatedMicroUsd: cost }));
      writeFileSync(at(step, 'receipt'), JSON.stringify({ ...receipt, estimatedMicroUsd: cost, stage: step }));
    }
    writeFileSync(path.join(textDir, 'spend.json'), JSON.stringify(new AuditionMeter(paid, 7000000, 4).snapshot()));
    expect(json(path.join(textDir, 'spend.json')).newKnownApiMicroUsd).toBeLessThan(genuine);
    expect(() => stageLedger(textDir, 4, 0, 0, stageRules.text)).toThrow(/^new_book_ledger_cost$/);
    await expect(runNewBookChild({ config: newBookConfig(file), signal: new AbortController().signal, log: () => {}, adapters: childAdapters() }))
      .rejects.toThrow(/^new_book_ledger_cost$/);
    expect(existsSync(path.join(experimentDir(config), 'child'))).toBe(false);
  });
  it("a stage folder's call of a step outside the stage's own rules is refused (its own steps only, never an inherited name)", async () => {
    await run();
    const textDir = path.join(experimentDir(config), 'text'), paid = path.join(textDir, 'paid-stages');
    for (const step of ['notes', 'toString']) {
      for (const k of ['wire', 'claim', 'result', 'receipt']) writeFileSync(path.join(paid, `${step}.${k}.json`), readFileSync(path.join(paid, `comparison.${k}.json`)));
      writeFileSync(path.join(paid, `${step}.claim.json`), JSON.stringify({ ...json(path.join(paid, `${step}.claim.json`)), step, seq: 4 }));
      const spend = path.join(textDir, 'spend.json'), bytes = readFileSync(spend);
      writeFileSync(spend, JSON.stringify(new AuditionMeter(paid, 7000000, 4).snapshot()));
      expect(() => stageLedger(textDir, 4, 0, 0, stageRules.text), step).toThrow(/^new_book_ledger_rule$/);
      for (const k of ['wire', 'claim', 'result', 'receipt']) rmSync(path.join(paid, `${step}.${k}.json`));
      writeFileSync(spend, bytes);
    }
    expect(stageLedger(textDir, 4, 0, 0, stageRules.text).knownMicroUsd).toBeGreaterThan(0);
  });
  it("a reader's claim maximum is its own request's reservation: lowered together with the wire's own figure (digests rebound), it is refused", async () => {
    await run();
    const textDir = path.join(experimentDir(config), 'text'), paid = path.join(textDir, 'paid-stages'), claim = path.join(paid, 'comparison.claim.json');
    rewire(paid, 'comparison', w => ({ ...w, reservedMicroUsd: w.reservedMicroUsd - 1 }));
    writeFileSync(claim, JSON.stringify({ ...json(claim), maximumMicroUsd: json(path.join(paid, 'comparison.wire.json')).reservedMicroUsd }));
    expect(() => stageLedger(textDir, 4, 0, 0, stageRules.text)).toThrow(/^new_book_ledger_cost$/);
  });
});
