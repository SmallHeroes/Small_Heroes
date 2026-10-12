import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
const sdk = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('openai', () => ({ default: class { responses = { create: sdk.create }; } }));
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { providerStoryboard, providerReview, withKind } from './storyboard-replan-fixture';
import { STORYBOARD_MOMENTS_VERSION } from '../storyboard-moments';
import type { SimpleStoryDraft } from '../simple-story-engine';
import { QUALITY_CATEGORIES } from '../../local-preview-quality';
import * as frozen from '../../../scripts/personal-source-git';
import * as images from '../../generate-image';
import { REFERENCE_REPAIR_EDIT_INSTRUCTION } from '../simple-book-illustrations';
import { readAuditionGrant, loadReviewedBook, loadReviewedStoryboard, dryRun, readReviewedBookLayout, auditionGrantSchema, runReviewedAudition, savedMomentContract }
  from '../../../scripts/personal-simple-book-reviewed-audition';
import { NEW_BOOK_EXPERIMENT, newBookConfig, newBookExperimentCLI, runNewBookText, runNewBookChild, writeNewBookGrant, experimentDir,
  experimentLayout, earliestSameScenePair, stageLedger, type NewBookConfig, type TextTransports, type ChildAdapters } from '../../../scripts/personal-new-book-experiment';

const sha = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
const json = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const roots: string[] = [];
let root: string, config: NewBookConfig, file: string, f: Awaited<ReturnType<typeof personalStoryboardFixture>>;
beforeEach(async () => {
  sdk.create.mockReset();
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
    request: structuredClone(f.request) };
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
  const plan = f.result.plan;
  const story: SimpleStoryDraft = { title: plan.title, childGoal: plan.childGoal, companionWant: plan.companionWant, comicPromise: plan.comicPromise,
    ending: plan.ending, pages: f.result.manuscript.pages.map(p => ({ text: p.text + ' נועה ודיני משחקות בציור.' })),
    pageMap: plan.beats.map(({ pageNumber: _n, ...b }) => b),
    resilienceMoments: plan.resilience.moments.map(({ pageNumber, ...m }) => ({ page: pageNumber, ...m })) };
  const owned = structuredClone(f.draft) as any;
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
    output_text: JSON.stringify(payload.model === 'gpt-6-astra' ? (opts.storyboardOutput ?? contractedStoryboard)(owned) : providerReview(f.review)) }) as any);
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
const run = (transports = textTransports()) => newBookExperimentCLI(['--config', file, 'text', '--execute'], { text: transports, log: () => {} })
  .then(r => r as Extract<typeof r, { mode: 'text' }>);
const claims = (dir: string) => readdirSync(dir).filter(n => n.endsWith('.claim.json')).map(n => n.replace('.claim.json', '')).sort();

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

describe('the reviewed audition on the new book (synthetic providers through the real runner, meter and sample gate)', () => {
  const ANSWER = { referenceChildVisible: true, candidateChildVisible: true, candidateChildCount: 1, comparisonUsable: true, sameChildDecision: 'same',
    faceStructure: 'match', eyesBrows: 'match', noseMouth: 'match', hairIdentity: 'match', distinctiveFeatures: 'match' };
  async function prepared() {
    await run();
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
  const audition = (dir: string) => runReviewedAudition({ bookDir: dir, out: path.join(dir, 'audition'), keyFile: config.keyEnvFile,
    grantFile: path.join(dir, 'audition.grant.json'), signal: new AbortController().signal, log: () => {},
    layout: readReviewedBookLayout(path.join(dir, 'book-layout.json')) });
  const renders = () => vi.mocked(images.generateGPTImage).mock.calls.length;

  it('supported sample: sheets, the sample pages, then the rest of the book, all under the one cap with the earlier stages as prior spend', async () => {
    const { grant, dir } = await prepared(); judgeWith(null);
    const result = await audition(dir);
    if (result.mode !== 'render') throw Error('render expected');
    const [a, b] = grant.scope.mode === 'render' ? grant.scope.sample! : [];
    expect(result.manifest).toMatchObject({ status: 'qa_supported_audition', scope: { complete: true, sample: [a, b] } });
    const steps = claims(path.join(dir, 'audition', 'paid-stages')).filter(s => /^page_\d_0$/.test(s));
    expect(steps).toHaveLength(9);
    const order = JSON.parse(readFileSync(path.join(dir, 'audition', 'paid-stages', `page_${a}_0.claim.json`), 'utf8')).seq;
    expect(order).toBeLessThan(JSON.parse(readFileSync(path.join(dir, 'audition', 'paid-stages', 'page_0_0.claim.json'), 'utf8')).seq);
    expect(result.spend).toMatchObject({ priorKnownApiMicroUsd: grant.ledger.priorKnownApiMicroUsd, capMicroUsd: 7000000, unknownCost: 0, unknownOutcome: 0 });
    expect(existsSync(path.join(dir, 'audition', 'book.html'))).toBe(true);
  });
  it('a held sample page stops the paid run before any other page is drawn', async () => {
    const { grant, dir } = await prepared();
    const [a, b] = grant.scope.mode === 'render' ? grant.scope.sample! : [];
    judgeWith(b);
    const result = await audition(dir);
    if (result.mode !== 'render') throw Error('render expected');
    expect(result.manifest).toMatchObject({ status: 'held_sample', scope: { frames: [a, b], complete: false, stoppedAfterSample: true } });
    // Two sheets, one sample page, then three attempts of the held page; nothing else.
    expect(renders()).toBe(2 + 1 + 3);
    expect(claims(path.join(dir, 'audition', 'paid-stages')).filter(s => /^page_/.test(s)).every(s => new RegExp(`^page_[${a}${b}]_`).test(s))).toBe(true);
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
