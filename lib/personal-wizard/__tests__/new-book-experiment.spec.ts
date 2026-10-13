import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
const sdk = vi.hoisted(() => ({ create: vi.fn(), clients: [] as Record<string, unknown>[] }));
vi.mock('openai', () => ({ default: class { responses = { create: sdk.create }; constructor(options: Record<string, unknown> = {}) { sdk.clients.push(options); } } }));
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { providerStoryboard, providerReview, withKind } from './storyboard-replan-fixture';
import { STORYBOARD_MOMENTS_VERSION } from '../storyboard-moments';
import type { SimpleStoryDraft } from '../simple-story-engine';
import { QUALITY_CATEGORIES } from '../../local-preview-quality';
import * as frozen from '../../../scripts/personal-source-git';
import * as images from '../../generate-image';
import * as causalAdapters from '../../../scripts/personal-causal-trial-adapters';
import * as flow from '../simple-book-flow';
import { REFERENCE_REPAIR_EDIT_INSTRUCTION, simpleReferenceDesignContext } from '../simple-book-illustrations';
import { createSimpleBookPixelJudge } from '../../../scripts/personal-simple-book-illustrator';
import { readAuditionGrant, loadReviewedBook, loadReviewedStoryboard, dryRun, readReviewedBookLayout, auditionGrantSchema, runReviewedAudition, savedMomentContract, AuditionMeter, auditionAdapters }
  from '../../../scripts/personal-simple-book-reviewed-audition';
import { NEW_BOOK_EXPERIMENT, newBookConfig, newBookExperimentCLI, runNewBookText, runNewBookChild, runNewBookAudition, writeNewBookGrant, experimentDir, experimentClaimFile, assertExperimentClaim,
  experimentLayout, earliestSameScenePair, stageLedger, NEW_BOOK_CONTINUATION, experimentContinuationFile, type NewBookConfig, type TextTransports, type ChildAdapters }
  from '../../../scripts/personal-new-book-experiment';

const sha = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
const json = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const roots: string[] = [];
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
afterEach(() => {
  vi.restoreAllMocks(); vi.unstubAllGlobals();
  for (const directory of roots.splice(0)) {
    if (path.dirname(directory) !== tmpdir() || !path.basename(directory).startsWith('sh_new_book_test_')) throw Error('cleanup_boundary');
    rmSync(directory, { recursive: true, force: true });
  }
});

/** The experiment's real storyboard contracts in provider shape: declared landmark kind and a (trivial) drawn-instant record per frame. */
const contractedStoryboard = (owned: any) => ({ ...providerStoryboard(withKind(owned)),
  moments: { version: STORYBOARD_MOMENTS_VERSION, frames: owned.plan.pages.map(() => ({ requirements: [], depicted: null })) } });
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
  const reader = vi.fn(async (_wire: any, call: any) => ({ output: { packetDigest: JSON.parse(call.input).packetDigest,
    summary: 'Synthetic complete reading, no product acceptance.', findings: opts.readerFindings ?? [] },
    usage: { inputTokens: 1000, outputTokens: 500 }, estimatedMicroUsd: 7000, metadata: {}, raw: {} }));
  const responses = vi.fn(async (payload: any) => ({ model: opts.model ?? payload.model, service_tier: 'default', status: 'completed',
    usage: { input_tokens: 10000, output_tokens: 5000 },
    output_text: JSON.stringify(payload.model === 'gpt-6-astra' ? (opts.storyboardOutput ?? contractedStoryboard)(owned) : providerReview(review)) }) as any);
  return { opus, reader, responses } satisfies TextTransports;
}
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

    const grant = writeNewBookGrant(newBookConfig(file));
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
    expect(() => writeNewBookGrant(newBookConfig(file))).toThrow();
    await run();
    await expect(run()).rejects.toThrow('new_book_slot_used');
    expect(() => writeNewBookGrant(newBookConfig(file))).toThrow('new_book_stage_not_passed');
    await runNewBookChild({ config: newBookConfig(file), signal: new AbortController().signal, log: () => {}, adapters: childAdapters() });
    await expect(runNewBookChild({ config: newBookConfig(file), signal: new AbortController().signal, log: () => {}, adapters: childAdapters() }))
      .rejects.toThrow('new_book_child_used');
    writeNewBookGrant(newBookConfig(file));
    expect(() => writeNewBookGrant(newBookConfig(file))).toThrow();
  });

  it('a storyboard answer from another model is refused, kept as evidence, and stops the stage', async () => {
    const t = textTransports({ model: 'gpt-6-astra-mini' });
    await expect(run(t)).rejects.toThrow();
    const textDir = path.join(experimentDir(config), 'text');
    expect(json(path.join(textDir, 'paid-stages', 'storyboard.failure.json'))).toMatchObject({ code: 'new_book_provider_invalid',
      receipt: { model: 'gpt-6-astra-mini' } });
    expect(json(path.join(textDir, 'sealed.json'))).toMatchObject({ status: 'failed', code: 'new_book_provider_invalid' });
    expect(existsSync(path.join(textDir, 'visual_simple_book_result.json'))).toBe(false);
  });
});

// Whole synthetic auditions (two sheets, nine frames, guard checks before every call) take several seconds each.
describe('the reviewed audition on the new book (synthetic providers through the real runner, meter and sample gate)', { timeout: 60_000 }, () => {
  const ANSWER = { referenceChildVisible: true, candidateChildVisible: true, candidateChildCount: 1, comparisonUsable: true, sameChildDecision: 'same',
    faceStructure: 'match', eyesBrows: 'match', noseMouth: 'match', hairIdentity: 'match', distinctiveFeatures: 'match' };
  async function prepared(opts: { continued?: true } = {}) {
    if (opts.continued) await continued(); else await run();
    await runNewBookChild({ config: newBookConfig(file), signal: new AbortController().signal, log: () => {}, adapters: childAdapters() });
    const grant = writeNewBookGrant(newBookConfig(file)), dir = experimentDir(config);
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
    expect(() => writeNewBookGrant(newBookConfig(file))).toThrow('new_book_stage_not_passed');
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
    expect(() => writeNewBookGrant(newBookConfig(file))).toThrow('new_book_layout');
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
    expect(stageLedger(childDir, 4, text.api.newKnownApiMicroUsd).knownMicroUsd).toBeGreaterThan(0);
    expect(() => stageLedger(childDir, 4)).toThrow('new_book_ledger_record');
    // The grant's prior spend is the verified sum of both stages.
    const grant = writeNewBookGrant(newBookConfig(file));
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
    expect(() => writeNewBookGrant(newBookConfig(file))).toThrow('new_book_claim');
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
    expect(() => stageLedger(textDir, 4)).toThrow('new_book_ledger_record');
    writeFileSync(path.join(textDir, 'spend.json'), JSON.stringify(spend));
    writeFileSync(path.join(textDir, 'paid-stages', 'extra.claim.json'), JSON.stringify({ step: 'extra', seq: 9, wireDigest: 'a'.repeat(64), maximumMicroUsd: 5 }));
    expect(() => stageLedger(textDir, 4)).toThrow('new_book_ledger_unknown');
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
    const grant = writeNewBookGrant(newBookConfig(file));
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
      for (const execute of [false, true]) await expect(continuation(t, execute)).rejects.toThrow('new_book_continuation_replay');
      writeFileSync(recordFile, bytes);
    }
    // A saved reply is the one whose cost settled its call.
    for (const record of ['paid-stages/comparison.receipt.json', 'claude-max-stages/author.receipt.json']) {
      const recordFile = path.join(textDirOf(), ...record.split('/')), bytes = readFileSync(recordFile), saved = JSON.parse(bytes.toString('utf8'));
      writeFileSync(recordFile, JSON.stringify({ ...saved, estimatedMicroUsd: saved.estimatedMicroUsd + 1 }));
      for (const execute of [false, true]) await expect(continuation(t, execute)).rejects.toThrow('new_book_continuation_replay');
      writeFileSync(recordFile, bytes);
    }
    // The one retry must send exactly the storyboard request that timed out (the digest its claim recorded before that call).
    const storyboardClaim = path.join(textDirOf(), 'paid-stages', 'storyboard.claim.json'), claimBytes = readFileSync(storyboardClaim);
    writeFileSync(storyboardClaim, JSON.stringify({ ...JSON.parse(claimBytes.toString('utf8')), wireDigest: 'e'.repeat(64) }));
    for (const execute of [false, true]) await expect(continuation(t, execute)).rejects.toThrow('new_book_continuation_request');
    writeFileSync(storyboardClaim, claimBytes);
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
    type Event = 'head' | 'dirty' | 'request' | 'receipt';
    const resetSlot = () => { for (const d of [experimentDir(config), path.dirname(experimentClaimFile(config))]) {
      if (!path.resolve(d).startsWith(path.resolve(root))) throw Error('reset_boundary'); rmSync(d, { recursive: true, force: true }); } };
    async function boundaryRun(event: Event | null, at: number) {
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
      request: /^new_book_continuation_(request_record|evidence)$/, receipt: /^new_book_continuation_evidence$/ };
    // Read 1 is the capture itself (a run started at another HEAD is simply that HEAD). Read 2 is the admission's own source check, after
    // which it hashes the records: a record changed there is what is admitted (and replayed), so record changes count from read 3.
    // A corrupt request record is refused at any read.
    const first: Record<Event, number> = { head: 2, dirty: 2, request: 2, receipt: 3 };
    for (const event of ['head', 'dirty', 'request', 'receipt'] as Event[]) for (let at = first[event]; at <= beforeWrite + 1; at++) {
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
