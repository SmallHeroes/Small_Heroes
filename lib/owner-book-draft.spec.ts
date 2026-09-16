import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { draftManifest, draftOutputRoot, loadOwnerDraft, ownerDraftSchema, ownerDraftPagePrompt, ownerDraftPropBoardPrompt, runGatedDraftPages, runOwnerBookDraft } from '../scripts/run-owner-book-draft';
import { QUALITY_CATEGORIES } from './local-preview-quality';
import sharp from 'sharp';
import { generateGPTImage } from './generate-image';
import { judgePreviewCandidate } from '../scripts/lib/local-preview-judge';
vi.mock('./generate-image', () => ({ generateGPTImage: vi.fn() }));
vi.mock('../scripts/lib/local-preview-judge', () => ({ judgePreviewCandidate: vi.fn() }));
import { previewCheckpoint, previewSha, bindPreviewRun } from './local-story-preview';

const roots: string[] = [];
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); for (const r of roots.splice(0)) fs.rmSync(r, { recursive: true, force: true }); });
function fixture() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'owner-draft-test-')); roots.push(repo);
  fs.mkdirSync(path.join(repo, 'outputs'));
  const source = '---\ntitle: Test\npages: 2\n---\n--- Page 1 ---\nFirst.\n--- Page 2 ---\nSecond.';
  const plan = { wardrobe: 'blue', visualLanguage: 'watercolor', recurringProps: [], locations: [{ id: 'garden', design: 'garden' }],
    pages: [0, 1, 2].map(pageNumber => ({ pageNumber, locationId: 'garden', shot: 'wide', angle: 'eye_level', composition: 'wide garden', childAction: 'walk', childExpression: 'curious', childGaze: 'path', companionAction: 'walk', scene: 'garden', props: [] })),
    continuity: { companionStandingHeightInChildHeights: 0.75, entities: [], pages: [0, 1, 2].map(pageNumber => ({ pageNumber, visibleLocationIds: ['garden'], visibleEntityIds: [], changes: [], childHeightFraction: 0.33, environmentAreaFraction: 0.65 })) } };
  const put = (file: string, value: string) => { fs.writeFileSync(path.join(repo, file), value); return { file, sha: previewSha(value) }; };
  const config = { intent: 'owner_requested_unaccepted_draft', story: put('story.md', source), plan: put('plan.json', JSON.stringify(plan)),
    childAnchor: put('child.png', 'input'), companionAnchor: put('companion.png', 'input'), childName: 'Bar', childAge: 5, gender: 'boy', companionDescription: 'panda',
    outputDir: 'outputs/test-book', imageBudgetUsd: 10, qaBudgetUsd: 10 };
  return { repo, config };
}
describe('explicit local editorial draft boundary', () => {
  it('makes a generic prop board without predecessor-story instructions', () => {
    const { repo, config } = fixture(); const { plan } = loadOwnerDraft(repo, config);
    plan.recurringProps = [{ id: 'chair', design: 'four wooden legs, one blue seat' }];
    const prompt = ownerDraftPropBoardPrompt(plan);
    expect(prompt).toContain('chair: four wooden legs, one blue seat');
    expect(prompt).not.toMatch(/living path|blue flower|ochre carpet/i);
  });
  it.each([[2, 1], [1, 1], [3], []])('rejects invalid sample selection %j', (...samplePages) => {
    const { repo, config } = fixture();
    expect(() => loadOwnerDraft(repo, { ...config, samplePages })).toThrow();
  });
  it('reserves only selected pages but still requires a complete plan', () => {
    const { repo, config } = fixture();
    expect(loadOwnerDraft(repo, { ...config, samplePages: [1], imageBudgetUsd: 0.5 }).plan.pages).toHaveLength(3);
    expect(() => loadOwnerDraft(repo, { ...config, samplePages: [1], qaBudgetUsd: 1 })).toThrow('draft_sample_qa_reservation_limit');
  });
  it('uses exact per-page framing rather than generic 35-50 percent framing', () => {
    const { repo, config } = fixture(); const { plan } = loadOwnerDraft(repo, config);
    const prompt = ownerDraftPagePrompt(plan, 1, 'First.', 5, 'boy', 'panda');
    expect(prompt).toContain('target 33% of TOTAL IMAGE HEIGHT');
    expect(prompt).not.toContain('Characters fill NO MORE than 35-50%');
    expect(prompt).toContain('Step camera BACK');
  });
  it('loads pinned source and complete continuity without granting acceptance', () => {
    const { repo, config } = fixture(); const { story } = loadOwnerDraft(repo, config);
    expect(story.pages).toHaveLength(2);
    expect(draftManifest(story, config.plan.sha, [])).toMatchObject({ productionReady: false, productAcceptance: 'pending', automaticRepair: 'disabled_uncalibrated' });
  });
  it.each(['accepted', 'pending', '', undefined])('rejects other intent %s', intent => { const { config } = fixture(); expect(() => ownerDraftSchema.parse({ ...config, intent })).toThrow(); });
  it.each(['VERCEL', 'VERCEL_ENV', 'NODE_ENV'])('rejects hosted/production %s', name => {
    const { repo, config } = fixture(); vi.stubEnv(name, name === 'NODE_ENV' ? 'production' : '1'); expect(() => loadOwnerDraft(repo, config)).toThrow('local_draft_only');
  });
  it.each(['outputs', 'outputs/../../escape', 'outputs/foo/bar', 'app/test-book'])('contains destination %s', destination => {
    const { repo } = fixture(); expect(() => draftOutputRoot(repo, destination)).toThrow('draft_output_scope');
  });
  it('rejects changed source and plan before live work', () => {
    const { repo, config } = fixture(); fs.appendFileSync(path.join(repo, 'story.md'), '\nchanged'); expect(() => loadOwnerDraft(repo, config)).toThrow('draft_input_changed');
  });
  it('rejects absent continuity', () => {
    const { repo, config } = fixture(); const plan = JSON.parse(fs.readFileSync(path.join(repo, 'plan.json'), 'utf8')); delete plan.continuity;
    const text = JSON.stringify(plan); fs.writeFileSync(path.join(repo, 'plan.json'), text); config.plan.sha = previewSha(text);
    expect(() => loadOwnerDraft(repo, config)).toThrow();
  });
  it('rejects insufficient initial image allowance', () => { const { repo, config } = fixture(); expect(() => loadOwnerDraft(repo, { ...config, imageBudgetUsd: 1 })).toThrow('draft_initial_reservation_limit'); });
  it('cannot adopt a nonempty root or rebind an existing run', () => {
    const { repo } = fixture(); const root = path.join(repo, 'outputs/test-book'); bindPreviewRun(root, { source: 'one' });
    expect(() => bindPreviewRun(root, { source: 'two' })).toThrow('preview_input_changed_new_run_required');
    expect(() => bindPreviewRun(path.join(repo, 'outputs'), {})).toThrow('preview_root_not_empty');
  });
  it('replays known steps without dispatch and refuses unknown paid retries', async () => {
    const { repo } = fixture(); let calls = 0;
    const args = { root: path.join(repo, 'outputs/test-book'), step: 'page-00', input: { source: 'one' }, reserveUsd: 0.5, budgetUsd: 10,
      produce: async () => { calls++; return { value: { sha: 'saved' }, usage: { input_tokens: 100, output_tokens: 100 } }; } };
    await previewCheckpoint(args); await previewCheckpoint(args); expect(calls).toBe(1);
    const failed = { ...args, step: 'page-01', produce: async () => { calls++; throw Error('unknown'); } };
    await expect(previewCheckpoint(failed)).rejects.toThrow('unknown');
    await expect(previewCheckpoint(failed)).rejects.toThrow('paid_step_outcome_unknown_no_automatic_retry'); expect(calls).toBe(2);
  });
});

describe('shared quality before next draft sample page', () => {
  const imageSha = 'a'.repeat(64);
  const review = (contextSha: string, verdict: 'pass' | 'defect' | 'uncertain') => ({ candidateSha: imageSha, contextSha,
    checks: QUALITY_CATEGORIES.map(category => ({ category, verdict, observation: 'observed', correction: verdict === 'defect' ? 'fix connection' : '' })) });
  const setup = (verdict: 'pass' | 'defect' | 'uncertain') => {
    const events: string[] = [];
    const args = { pages: [1, 2], context: (page: number) => ({ page }),
      render: vi.fn(async (page: number) => { events.push(`render${page}`); return { imageSha, imageName: `page-${page}.png` }; }),
      judge: vi.fn(async (page: number, _candidate: unknown, _context: unknown, contextSha: string) => { events.push(`judge${page}`); return review(contextSha, verdict); }),
      persist: vi.fn((row: { pageNumber: number }) => { events.push(`persist${row.pageNumber}`); }) };
    return { args, events };
  };
  it('judges and persists each page before rendering the next without granting acceptance', async () => {
    const { args, events } = setup('pass'); const result = await runGatedDraftPages(args);
    expect(events).toEqual(['render1', 'judge1', 'persist1', 'render2', 'judge2', 'persist2']);
    expect(result).toMatchObject({ productionReady: false, productAcceptance: 'pending', automaticRepair: false, unassessed: [] });
  });
  it.each(['defect', 'uncertain'] as const)('stops after %s, preserves evidence, never repairs or renders next', async verdict => {
    const { args, events } = setup(verdict); const result = await runGatedDraftPages(args);
    expect(events).toEqual(['render1', 'judge1', 'persist1']);
    expect(result).toMatchObject({ status: 'sample_held', unassessed: [2] });
    expect(result.results[0].history?.[0].review.checks[0].verdict).toBe(verdict);
  });
  it('holds transport failure with candidate retained, no second page', async () => {
    const { args } = setup('pass'); args.judge.mockRejectedValue(Error('transport_unknown'));
    const result = await runGatedDraftPages(args);
    expect(result.results[0]).toMatchObject({ status: 'held_error', error: 'transport_unknown', candidate: { imageSha } });
    expect(args.render).toHaveBeenCalledTimes(1);
  });
  it('rejects mismatched evidence before next image', async () => {
    const { args } = setup('pass'); args.judge.mockImplementation(async () => review('b'.repeat(64), 'pass'));
    const result = await runGatedDraftPages(args);
    expect(result.results[0].error).toBe('quality_evidence_binding'); expect(args.render).toHaveBeenCalledTimes(1);
  });
  it('holds render failure without a QA call or leaked error details', async () => {
    const { args } = setup('pass'); args.render.mockRejectedValue(Error('Secret data: sentinel'));
    const result = await runGatedDraftPages(args);
    expect(result.results[0]).toMatchObject({ status: 'held_error', error: 'draft_sample_unresolved' });
    expect(args.judge).not.toHaveBeenCalled(); expect(JSON.stringify(result)).not.toContain('sentinel');
  });
  it('propagates evidence-write failure and stops before another render', async () => {
    const { args } = setup('pass'); args.persist.mockImplementation(() => { throw Error('write_failed'); });
    await expect(runGatedDraftPages(args)).rejects.toThrow('write_failed'); expect(args.render).toHaveBeenCalledTimes(1);
  });
  it.each([[], [1, 1], [2, 1], [-1], [25], [1, 2, 3, 4]])('rejects invalid selection before callbacks %j', async (...pages) => {
    const { args } = setup('pass'); await expect(runGatedDraftPages({ ...args, pages })).rejects.toThrow('draft_sample_selection');
    expect(args.render).not.toHaveBeenCalled();
  });
});

describe('real owner-draft entry point with mocked providers', () => {
  async function inputs() {
    const { repo: temp, config } = fixture();
    const repo = path.resolve(__dirname, '..');
    const input = fs.mkdtempSync(path.join(repo, 'outputs', 'gated-sample-fixture-')); roots.push(input);
    const root = path.join(repo, 'outputs', `gated-sample-result-${path.basename(input).toLowerCase()}`); roots.push(root);
    const bytes = await sharp({ create: { width: 16, height: 16, channels: 3, background: 'white' } }).png().toBuffer();
    for (const file of ['story.md', 'plan.json']) fs.copyFileSync(path.join(temp, file), path.join(input, file));
    for (const file of ['child.png', 'companion.png']) fs.writeFileSync(path.join(input, file), bytes);
    const asset = (file: string) => ({ file: path.relative(repo, path.join(input, file)), sha: previewSha(fs.readFileSync(path.join(input, file))) });
    const actual = { ...config, story: asset('story.md'), plan: asset('plan.json'), childAnchor: asset('child.png'), companionAnchor: asset('companion.png'),
      outputDir: path.relative(repo, root), samplePages: [1, 2] };
    const file = path.join(input, 'config.json'); fs.writeFileSync(file, JSON.stringify(actual));
    vi.stubEnv('OPENAI_API_KEY', 'test-only-no-network');
    vi.mocked(generateGPTImage).mockImplementation(async args => ({ buffer: bytes, finalPrompt: args.finalPrompt, model: 'gpt-image-2',
      durationMs: 1, hasReferencePhoto: true, apiMode: 'images.edit', fallbackUsed: false,
      referenceCountRequested: args.referenceImages?.length ?? 0, referenceCountPassed: args.referenceImages?.length ?? 0,
      usage: { input_tokens: 100, output_tokens: 100 } }));
    return { file, root };
  }
  it('persists usage and held manifest; no second image after real shared verdict; checkpoint replay does not regenerate', async () => {
    const { file, root } = await inputs();
    vi.mocked(judgePreviewCandidate).mockImplementation(async args => ({ candidateSha: args.candidateSha, contextSha: args.contextSha,
      checks: QUALITY_CATEGORIES.map(category => ({ category, verdict: category === 'anatomy' ? 'defect' : 'pass', observation: 'extra hand', correction: category === 'anatomy' ? 'remove extra hand' : '' })) }));
    const first = await runOwnerBookDraft(file, 'sample');
    expect(first?.status).toBe('sample_held'); expect(generateGPTImage).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(path.join(root, 'page-02.png'))).toBe(false);
    expect(JSON.parse(fs.readFileSync(path.join(root, 'steps/page-01.result.json'), 'utf8')).usage).toEqual({ input_tokens: 100, output_tokens: 100 });
    expect(JSON.parse(fs.readFileSync(path.join(root, 'sample-manifest.json'), 'utf8'))).toMatchObject({ productionReady: false, samplePages: [1, 2], unassessed: [2] });
    await runOwnerBookDraft(file, 'sample'); expect(generateGPTImage).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(path.join(root, 'run.lock'))).toBe(false);
  });
  it.each(['render', 'qa'] as const)('cannot bypass configured sample QA with %s mode', async mode => {
    const { file } = await inputs(); await expect(runOwnerBookDraft(file, mode)).rejects.toThrow('draft_sample_mode_required');
    expect(generateGPTImage).not.toHaveBeenCalled(); expect(judgePreviewCandidate).not.toHaveBeenCalled();
  });
  it('rejects through-page override on sample before providers', async () => {
    const { file } = await inputs(); await expect(runOwnerBookDraft(file, 'sample', undefined, 1)).rejects.toThrow('draft_sample_mode_required');
    expect(generateGPTImage).not.toHaveBeenCalled();
  });
});
