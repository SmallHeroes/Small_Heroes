import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { draftManifest, draftOutputRoot, loadOwnerDraft, ownerDraftSchema, ownerDraftPagePrompt, ownerDraftPropBoardPrompt, ownerDraftRepairPrompt, runGatedDraftPages, runOwnerBookDraft, sampleComparisonPages, projectDraftPropReferences, selectedDraftQaContext } from '../scripts/run-owner-book-draft';
import { QUALITY_CATEGORIES } from './local-preview-quality';
import sharp from 'sharp';
import { generateGPTImage } from './generate-image';
import { judgePreviewCandidate } from '../scripts/lib/local-preview-judge';
vi.mock('./generate-image', () => ({ generateGPTImage: vi.fn(), resolveGPTImageEditMaxReferences: () => 4 }));
vi.mock('../scripts/lib/local-preview-judge', () => ({ judgePreviewCandidate: vi.fn() }));
import { previewCheckpoint, previewSha, bindPreviewRun } from './local-story-preview';
import * as storyPreview from './local-story-preview';
import * as previewQuality from './local-preview-quality';
import { VISUAL_PRIORITY_VERSION, visualPriorityDigest } from './local-visual-priority';

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
function sequenceFixture(plan: ReturnType<typeof loadOwnerDraft>['plan'], sourceSha: string, planSha: string) {
  return { version: 'local-book-sequence/v1', sourceSha, planSha, premise: 'A child learns to share an adventure', mutableAttributes: [],
    pages: plan.pages.slice(1).map(p => ({ pageNumber: p.pageNumber, sceneId: 'visit', beat: 'A new child response in the same scene', sceneChangeEvidence: null,
      visibleCastIds: ['child', 'companion'], transitions: [],
      states: ['child', 'companion', ...plan.continuity!.entities.map(e => e.id)].map(entityId => ({ entityId, value: { relation: 'at', targetId: p.locationId } })) })) };
}
function sourceBoundaryFixture(mode: string) {
  const { repo, config } = fixture();
  const plan = JSON.parse(fs.readFileSync(path.join(repo, config.plan.file), 'utf8'));
  const sequence = JSON.stringify(sequenceFixture(plan, config.story.sha, config.plan.sha));
  if (mode === 'sequence') fs.writeFileSync(path.join(repo, 'sequence.json'), sequence);
  return { repo, config: ownerDraftSchema.parse({ ...config,
    ...(mode === 'legacy' ? {} : { samplePages: [1], propBoard: config.childAnchor, propBoardRegions: {} }),
    ...(mode === 'sequence' ? { sequence: { file: 'sequence.json', sha: previewSha(sequence) } } : {}),
  }) };
}
describe('explicit local editorial draft boundary', () => {
  it('preserves the omitted model config while resolving the historical default', () => {
    const { repo, config } = fixture();
    const loaded = loadOwnerDraft(repo, config);
    expect(loaded.config).toEqual(config);
    expect(loaded.config).not.toHaveProperty('imageModel');
    expect(loaded.config).not.toHaveProperty('imageQuality');
    expect(loaded.imageModel).toBe('gpt-image-2');
    expect(loaded.imageQuality).toBe('low');
  });
  it.each(['low', 'medium'])('limits explicit quality %s to sample configurations', imageQuality => {
    const { repo, config } = fixture();
    expect(() => loadOwnerDraft(repo, { ...config, imageQuality })).toThrow('draft_image_quality_sample_only');
    expect(loadOwnerDraft(repo, { ...config, imageQuality, samplePages: [1] }).imageQuality).toBe(imageQuality);
  });
  it.each(['high', 'auto', 'MEDIUM', 'medium ', '', null])('rejects quality %s before reading inputs', imageQuality => {
    const { repo, config } = fixture(); fs.unlinkSync(path.join(repo, config.story.file));
    expect(() => loadOwnerDraft(repo, { ...config, imageQuality, samplePages: [1] })).toThrow(/imageQuality/);
  });
  it.each(['gpt-image-2', 'gpt-image-2.5-sunburst'])('limits explicit model %s to sample configurations', imageModel => {
    const { repo, config } = fixture();
    expect(() => loadOwnerDraft(repo, { ...config, imageModel })).toThrow('draft_image_model_sample_only');
    expect(loadOwnerDraft(repo, { ...config, imageModel, samplePages: [1] }).imageModel).toBe(imageModel);
  });
  it.each(['gpt-image-2.5-flare', 'gpt-6-astra', 'GPT-IMAGE-2', 'gpt-image-2.5-sunburst ', '', null])(
    'rejects unsupported or malformed model %s before reading inputs', imageModel => {
      const { repo, config } = fixture();
      fs.unlinkSync(path.join(repo, config.story.file));
      expect(() => loadOwnerDraft(repo, { ...config, imageModel, samplePages: [1] })).toThrow(/imageModel/);
    });
  it.each(['legacy', 'atlas', 'sequence'])('validates source evidence before plan/continuity and uses its exact texts; mode=%s', mode => {
    const { repo, config } = sourceBoundaryFixture(mode);
    const evidence = vi.spyOn(storyPreview, 'previewStoryEvidence');
    const plan = vi.spyOn(storyPreview, 'validatePreviewPlan');
    const continuity = vi.spyOn(previewQuality, 'validatePreviewContinuity');
    try {
      const loaded = loadOwnerDraft(repo, config);
      expect(evidence).toHaveBeenCalledWith(loaded.story);
      expect(evidence.mock.invocationCallOrder[0]).toBeLessThan(plan.mock.invocationCallOrder[0]);
      expect(evidence.mock.invocationCallOrder[0]).toBeLessThan(continuity.mock.invocationCallOrder[0]);
      const texts = evidence.mock.results[0].value.texts;
      expect(plan.mock.calls[0][1]).toBe(texts.length - 1);
      expect(continuity.mock.calls[0][2]).toBe(texts);
      expect(texts).toEqual(['Test', 'First.', 'Second.']);
      expect(fs.readdirSync(path.join(repo, 'outputs'))).toEqual([]);
    } finally { continuity.mockRestore(); plan.mockRestore(); evidence.mockRestore(); }
  });
  it.each(['legacy', 'atlas', 'sequence'].flatMap(mode => ['mutated', 'cloned'].map(kind => ({ mode, kind }))))(
    'rejects invalid parsed provenance before either validator; mode=$mode kind=$kind', ({ mode, kind }) => {
      const { repo, config } = sourceBoundaryFixture(mode);
      const originalParser = storyPreview.previewStory;
      const parser = vi.spyOn(storyPreview, 'previewStory').mockImplementation((...args) => {
        const story = originalParser(...args);
        if (kind === 'cloned') return structuredClone(story);
        story.pages.forEach(page => { page.text += ' extra'; });
        return story;
      });
      const plan = vi.spyOn(storyPreview, 'validatePreviewPlan');
      const continuity = vi.spyOn(previewQuality, 'validatePreviewContinuity');
      try {
        expect(() => loadOwnerDraft(repo, config)).toThrow('preview_story_source_binding');
        expect(plan).not.toHaveBeenCalled(); expect(continuity).not.toHaveBeenCalled();
        expect(generateGPTImage).not.toHaveBeenCalled(); expect(judgePreviewCandidate).not.toHaveBeenCalled();
        expect(fs.readdirSync(path.join(repo, 'outputs'))).toEqual([]);
      } finally { continuity.mockRestore(); plan.mockRestore(); parser.mockRestore(); }
    });
  it('binds the optional prop atlas to a supplied board, sample and complete prop inventory', () => {
    const { repo, config } = fixture();
    for (const patch of [{ propBoardRegions: {} }, { samplePages: [1], propBoardRegions: {} },
      { samplePages: [1], propBoard: config.childAnchor, propBoardRegions: { invented: { left: 0, top: 0, width: 1, height: 1 } } }])
      expect(() => loadOwnerDraft(repo, { ...config, ...patch })).toThrow('draft_prop_regions_binding');
  });
  it('projects only requested prop pixels and rejects a region beyond image bounds', async () => {
    const red = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#ff0000' } }).png().toBuffer();
    const blue = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#0000ff' } }).png().toBuffer();
    const board = await sharp({ create: { width: 32, height: 16, channels: 3, background: 'white' } }).composite([
      { input: red, left: 0, top: 0 }, { input: blue, left: 16, top: 0 }]).png().toBuffer();
    const regions = { first: { left: 0, top: 0, width: 16, height: 16 }, future: { left: 16, top: 0, width: 16, height: 16 } };
    const result = await projectDraftPropReferences(board, regions, [{ pageNumber: 1, props: [{ id: 'first' }] }, { pageNumber: 2, props: [] }]);
    expect(result.has(2)).toBe(false);
    const pixel = await sharp(result.get(1)!).extract({ left: 256, top: 256, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
    expect([...pixel]).toEqual([255, 0, 0]);
    await expect(projectDraftPropReferences(board, { first: { left: 17, top: 0, width: 16, height: 16 } }, [])).rejects.toThrow('draft_prop_region_outside_image');
    await expect(projectDraftPropReferences(board, regions, [{ pageNumber: 1, props: [{ id: 'missing' }] }])).rejects.toThrow('draft_prop_region_missing');
  });
  it('narrows QA to selected state without leaking future pages or dropping accumulated changes', () => {
    const { repo, config } = fixture(); const { plan } = loadOwnerDraft(repo, config);
    plan.recurringProps = [{ id: 'chair', design: 'wooden chair' }, { id: 'future', design: 'FUTURE_PROP_SENTINEL' }];
    plan.pages[1].props = [{ id: 'chair', state: 'on grass' }];
    plan.pages[2].scene = 'FUTURE_SCENE_SENTINEL';
    plan.continuity!.entities = [{ id: 'chair', kind: 'prop', invariants: [{ attribute: 'color', value: 'red' }] }];
    plan.continuity!.pages[1].visibleEntityIds = ['chair'];
    plan.continuity!.pages[1].changes = [{ entityId: 'chair', attribute: 'color', value: 'blue', storyEvidence: 'First.' }];
    const context = selectedDraftQaContext(plan, 1);
    expect(context.continuity.entities[0].currentState.color).toBe('blue');
    expect(context.page.pageNumber).toBe(1); expect(context.recurringProps.map(p => p.id)).toEqual(['chair']);
    expect(JSON.stringify(context)).not.toContain('FUTURE_');
    expect(plan.pages[2].scene).toBe('FUTURE_SCENE_SENTINEL');
  });
  it('requires explicit sample opt-in and unique selected imported candidates', () => {
    const { repo, config } = fixture();
    expect(() => loadOwnerDraft(repo, { ...config, sampleRepairOnce: true })).toThrow('draft_repair_sample_only');
    expect(() => loadOwnerDraft(repo, { ...config, samplePages: [1], sampleInitialImages: [{ pageNumber: 1, image: config.childAnchor }] })).toThrow('draft_repair_sample_only');
    for (const pages of [[1, 1], [2]]) expect(() => loadOwnerDraft(repo, { ...config, samplePages: [1], sampleRepairOnce: true,
      sampleInitialImages: pages.map(pageNumber => ({ pageNumber, image: config.childAnchor })) })).toThrow('draft_initial_image_selection');
  });
  it('reserves one run-wide repair, deducts only pinned imports and checks their hashes', () => {
    const { repo, config } = fixture();
    const next = { ...config, samplePages: [1, 2], sampleRepairOnce: true };
    expect(() => loadOwnerDraft(repo, { ...next, imageBudgetUsd: 1 })).toThrow('draft_initial_reservation_limit');
    expect(loadOwnerDraft(repo, { ...next, imageBudgetUsd: 1.5 }).initialImages).toEqual([]);
    const imported = { ...next, imageBudgetUsd: 1, sampleInitialImages: [{ pageNumber: 1, image: config.childAnchor }] };
    expect(loadOwnerDraft(repo, imported).initialImages).toHaveLength(1);
    fs.appendFileSync(path.join(repo, config.childAnchor.file), 'changed');
    expect(() => loadOwnerDraft(repo, imported)).toThrow('draft_input_changed');
  });
  it('makes a generic prop board without predecessor-story instructions', () => {
    const { repo, config } = fixture(); const { plan } = loadOwnerDraft(repo, config);
    plan.recurringProps = [{ id: 'chair', design: 'four wooden legs, one blue seat' }];
    const prompt = ownerDraftPropBoardPrompt(plan);
    expect(prompt).toContain('chair: four wooden legs, one blue seat');
    expect(prompt).toContain('No people or animals');
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
  it.each([false, true])('preserves legacy board reservation; supplied board=%s', supplied => {
    const { repo, config } = fixture();
    const plan = JSON.parse(fs.readFileSync(path.join(repo, 'plan.json'), 'utf8'));
    plan.recurringProps = [{ id: 'chair', design: 'wooden chair' }];
    plan.continuity.entities = [{ id: 'chair', kind: 'prop', invariants: [{ attribute: 'material', value: 'wood' }] }];
    const text = JSON.stringify(plan); fs.writeFileSync(path.join(repo, 'plan.json'), text); config.plan.sha = previewSha(text);
    const withBoard = { ...config, ...(supplied ? { propBoard: config.childAnchor } : {}) };
    expect(() => loadOwnerDraft(repo, { ...withBoard, imageBudgetUsd: 1.5 })).toThrow('draft_initial_reservation_limit');
    expect(loadOwnerDraft(repo, { ...withBoard, imageBudgetUsd: 2 }).plan.pages).toHaveLength(3);
    const required = supplied ? 0.5 : 1;
    expect(loadOwnerDraft(repo, { ...withBoard, samplePages: [1], imageBudgetUsd: required }).plan.pages).toHaveLength(3);
    expect(() => loadOwnerDraft(repo, { ...withBoard, samplePages: [1], imageBudgetUsd: required - 0.01 })).toThrow('draft_initial_reservation_limit');
  });
  it.each([['--sample', '--render'], ['--sample', '--qa'], ['--render', '--qa']])('sanitizes real CLI conflict %s %s before opening config or credentials', (first, second) => {
    const { repo } = fixture();
    const codeRoot = path.resolve(__dirname, '..');
    const result = spawnSync(process.execPath, ['--require', require.resolve('tsx/cjs'), '--require',
      path.join(codeRoot, 'scripts/shims/register-server-only.cjs'), path.join(codeRoot, 'scripts/run-owner-book-draft.ts'),
      path.join(repo, 'missing-config.json'), first, second, '--key-env-file', path.join(repo, 'missing-key.env')],
    { cwd: repo, encoding: 'utf8', timeout: 15000, env: { ...process.env, OPENAI_API_KEY: '', TSX_TSCONFIG_PATH: path.join(codeRoot, 'tsconfig.json') } });
    expect(result.error).toBeUndefined(); expect(result.status).toBe(1);
    expect(result.stdout).toBe(''); expect(result.stderr.trim()).toBe('draft_conflicting_modes');
    expect(fs.readdirSync(path.join(repo, 'outputs'))).toEqual([]);
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
  it('repairs once across the whole sample, carries bound feedback and preserves both verdicts', async () => {
    const { args } = setup('defect');
    const renders = vi.fn(async (page: number, attempt: number) => ({ imageSha: String(page + attempt).repeat(64), imageName: `p${page}-${attempt}.png` }));
    const result = await runGatedDraftPages({ ...args, maxTotalRepairs: 1, render: renders,
      judge: async (_p, candidate, _c, contextSha, _prior, attempt) => ({ ...review(contextSha, attempt ? 'pass' : 'defect'), candidateSha: candidate.imageSha }) });
    expect(renders.mock.calls.map(c => c.slice(0, 2))).toEqual([[1, 0], [1, 1], [2, 0]]);
    expect(result).toMatchObject({ repairsUsed: 1, automaticRepair: true, status: 'sample_held' });
    expect(result.results.map(r => r.status)).toEqual(['passed', 'held_repair_limit']);
    expect(result.results[0].history).toHaveLength(2);
    expect(renders.mock.calls[1]).toEqual([1, 1, expect.objectContaining({ imageSha: '1'.repeat(64) }),
      expect.objectContaining({ candidateSha: '1'.repeat(64) }), expect.any(String), []]);
  });
  it.each(['uncertain', 'malformed', 'mismatch', 'transport', 'mixed'] as const)('opt-in still cannot repair %s', async failure => {
    const { args } = setup('pass');
    const result = await runGatedDraftPages({ ...args, maxTotalRepairs: 1, judge: async (_p, _c, _ctx, contextSha) => {
      if (failure === 'transport') throw Error('transport_failed');
      if (failure === 'malformed') return {};
      const value = review(failure === 'mismatch' ? 'b'.repeat(64) : contextSha, failure === 'uncertain' ? 'uncertain' : 'defect');
      if (failure === 'mixed') value.checks[0].verdict = 'uncertain';
      return value;
    } });
    expect(result.status).toBe('sample_held'); expect(args.render).toHaveBeenCalledTimes(1); expect(result.repairsUsed).toBe(0);
  });
  it('one failed repair stops before the next page', async () => {
    const { args } = setup('defect');
    const render = vi.fn(async (_page: number, attempt: number) => ({ imageSha: attempt ? 'b'.repeat(64) : imageSha, imageName: `attempt${attempt}.png` }));
    const result = await runGatedDraftPages({ ...args, render, maxTotalRepairs: 1,
      judge: async (_p, c, _ctx, h) => ({ ...review(h, 'defect'), candidateSha: c.imageSha }) });
    expect(render).toHaveBeenCalledTimes(2); expect(result.results[0].history).toHaveLength(2); expect(result.unassessed).toEqual([2]);
  });
  it('repair prompt requires bound defects and distinguishes edit target from canonical design', () => {
    const candidate = { imageSha, imageName: 'page-01.png' }, ctx = 'b'.repeat(64);
    const base = 'image 3, when attached = recurring PROP design board ONLY.';
    for (const verdict of ['pass', 'uncertain'] as const) expect(() => ownerDraftRepairPrompt(base, candidate, review(ctx, verdict), ctx, 3)).toThrow('draft_repair_requires_bound_defect');
    expect(() => ownerDraftRepairPrompt(base, candidate, review(ctx, 'defect'), 'c'.repeat(64), 3)).toThrow('quality_evidence_binding');
    const prompt = ownerDraftRepairPrompt(base, candidate, review(ctx, 'defect'), ctx, 3);
    expect(prompt).toContain('previous candidate EDIT TARGET ONLY'); expect(prompt).not.toContain('recurring PROP design board ONLY');
    expect(prompt).toContain('fix connection'); expect(prompt).toContain('numeric targets remain authoritative');
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
  it('accepts five consecutive pages and persists QA before every next render', async () => {
    const { args, events } = setup('pass');
    const result = await runGatedDraftPages({ ...args, pages: [1, 2, 3, 4, 5] });
    expect(events).toEqual([1, 2, 3, 4, 5].flatMap(p => [`render${p}`, `judge${p}`, `persist${p}`]));
    expect(result.results).toHaveLength(5); expect(result.unassessed).toEqual([]);
    expect(result.productionReady).toBe(false);
  });
  it('holds a five-page run at the first uncertain page, leaving later pages unassessed', async () => {
    const { args } = setup('pass');
    const result = await runGatedDraftPages({ ...args, pages: [1, 2, 3, 4, 5],
      judge: async (p, _c, _ctx, sha) => review(sha, p === 4 ? 'uncertain' : 'pass') });
    expect(result.results.map(p => p.status)).toEqual(['passed', 'passed', 'passed', 'held_uncertain']);
    expect(result.unassessed).toEqual([5]); expect(args.render).toHaveBeenCalledTimes(4);
  });
  it('uses the last three comparisons without mutating or truncating the evidence', () => {
    const prior = [1, 2, 3, 4]; expect(sampleComparisonPages(prior)).toEqual([2, 3, 4]);
    expect(prior).toEqual([1, 2, 3, 4]); expect(sampleComparisonPages([1, 2])).toEqual([1, 2]);
  });
  it.each([[], [1, 1], [2, 1], [-1], [25], [1, 2, 3, 4, 5, 6]])('rejects invalid selection before callbacks %j', async (...pages) => {
    const { args } = setup('pass'); await expect(runGatedDraftPages({ ...args, pages })).rejects.toThrow('draft_sample_selection');
    expect(args.render).not.toHaveBeenCalled();
  });
});

describe('real owner-draft entry point with mocked providers', () => {
  async function priorityInputs() {
    const { file, root } = await inputs(), repo = path.resolve(__dirname, '..');
    const config = JSON.parse(fs.readFileSync(file, 'utf8'));
    const plan = JSON.parse(fs.readFileSync(path.resolve(repo, config.plan.file), 'utf8'));
    // A visible landmark, no extra prop-board generation or paid transport.
    plan.continuity.entities = [{ id: 'wall', kind: 'landmark', invariants: [{ attribute: 'material', value: 'stone' }] }];
    plan.continuity.pages.forEach((p: { visibleEntityIds: string[] }) => { p.visibleEntityIds = ['wall']; });
    const planBytes = JSON.stringify(plan); fs.writeFileSync(path.resolve(repo, config.plan.file), planBytes); config.plan.sha = previewSha(planBytes);
    const policy = { version: VISUAL_PRIORITY_VERSION, sourceSha: config.story.sha, planSha: config.plan.sha,
      decorativePreferences: [{ id: 'motif', entityId: 'wall', attribute: 'painted_motif', preference: 'tiny flowers', scope: 'nonfunctional_surface_detail', rationale: 'Background surface decoration only.' }] };
    const target = path.join(path.dirname(file), 'priority.json'), bytes = JSON.stringify(policy); fs.writeFileSync(target, bytes);
    config.visualPriority = { file: path.relative(repo, target), sha: previewSha(bytes) };
    fs.writeFileSync(file, JSON.stringify(config)); await addSequence(file);
    return { file, root, target, policy, repo };
  }
  it('carries prospective preferences through the real two-page sequence entry, persists variation and resumes without generation', async () => {
    const { file, root } = await priorityInputs();
    vi.mocked(judgePreviewCandidate).mockImplementation(async args => {
      expect(args.policy?.pageNumber).toBe((args.context as { pageNumber: number }).pageNumber);
      expect(args.contextSha).toBe(previewQuality.previewQualityContextSha(args.context, args.policy));
      return { candidateSha: args.candidateSha, contextSha: args.contextSha, policySha: visualPriorityDigest(args.policy!),
        checks: QUALITY_CATEGORIES.map(category => ({ category, verdict: 'pass', observation: 'observed', correction: '' })),
        decorativeChecks: [{ preferenceId: 'motif', verdict: 'variation', observation: 'painted dots not flowers; same stone wall' }] };
    });
    const result = await runOwnerBookDraft(file, 'sample');
    expect(result?.results.map(r => r.status)).toEqual(['passed', 'passed']);
    expect(generateGPTImage).toHaveBeenCalledTimes(2);
    for (const [args] of vi.mocked(generateGPTImage).mock.calls) {
      expect(args.finalPrompt).toContain('DECORATIVE PREFERENCE DATA');
      expect(args.finalPrompt).not.toContain('Return one decorativeCheck');
    }
    expect(vi.mocked(generateGPTImage).mock.calls[1][0].referenceImages?.slice(-1)[0]).toBe(path.join(root, 'page-01.png'));
    expect(JSON.parse(fs.readFileSync(path.join(root, 'identity.json'), 'utf8')).qualityVersion).toBe(previewQuality.PRIORITY_QUALITY_VERSION);
    const manifest = fs.readFileSync(path.join(root, 'sample-manifest.json'));
    expect(JSON.parse(manifest.toString()).results[0].history[0].review.decorativeChecks[0].verdict).toBe('variation');
    await runOwnerBookDraft(file, 'sample'); expect(generateGPTImage).toHaveBeenCalledTimes(2);
    expect(fs.readFileSync(path.join(root, 'sample-manifest.json'))).toEqual(manifest);
    const config = JSON.parse(fs.readFileSync(file, 'utf8')); delete config.visualPriority; fs.writeFileSync(file, JSON.stringify(config));
    await expect(runOwnerBookDraft(file, 'sample')).rejects.toThrow('preview_input_changed_new_run_required');
    expect(generateGPTImage).toHaveBeenCalledTimes(2);
  });
  it.each(['defect', 'uncertain'] as const)('does not continue the real sample on mandatory %s despite decorative variation', async verdict => {
    const { file, root } = await priorityInputs();
    vi.mocked(judgePreviewCandidate).mockImplementation(async args => ({ candidateSha: args.candidateSha, contextSha: args.contextSha, policySha: visualPriorityDigest(args.policy!),
      checks: QUALITY_CATEGORIES.map(category => ({ category, verdict: category === 'scene' ? verdict : 'pass', observation: 'child moved outside without a transition', correction: 'restore inside occupancy' })),
      decorativeChecks: [{ preferenceId: 'motif', verdict: 'variation', observation: 'dots' }] }));
    const result = await runOwnerBookDraft(file, 'sample');
    expect(result?.unassessed).toEqual([2]); expect(generateGPTImage).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(path.join(root, 'page-02.png'))).toBe(false);
  });
  it.each(['binding', 'collision', 'hash', 'legacy', 'import'])('rejects %s priority authority before key access or any paid output', async kind => {
    const { file, root, target, policy } = await priorityInputs();
    const config = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (kind === 'binding') policy.planSha = 'a'.repeat(64);
    if (kind === 'collision') policy.decorativePreferences[0].attribute = 'material';
    if (kind === 'legacy') delete config.samplePages;
    if (kind === 'import') { config.sampleRepairOnce = true; config.sampleInitialImages = [{ pageNumber: 1, image: config.childAnchor }]; }
    const bytes = JSON.stringify(policy); fs.writeFileSync(target, bytes); config.visualPriority.sha = kind === 'hash' ? 'a'.repeat(64) : previewSha(bytes);
    fs.writeFileSync(file, JSON.stringify(config)); vi.stubEnv('OPENAI_API_KEY', '');
    await expect(runOwnerBookDraft(file, 'sample', 'credential-must-not-be-opened')).rejects.toThrow(/visual_priority|input_changed/);
    expect(generateGPTImage).not.toHaveBeenCalled(); expect(judgePreviewCandidate).not.toHaveBeenCalled(); expect(fs.existsSync(root)).toBe(false);
  });
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
    vi.mocked(generateGPTImage).mockImplementation(async args => ({ buffer: bytes, finalPrompt: args.finalPrompt, model: args.modelOverride ?? 'gpt-image-2',
      durationMs: 1, hasReferencePhoto: true, apiMode: 'images.edit', fallbackUsed: false,
      referenceCountRequested: args.referenceImages?.length ?? 0, referenceCountPassed: args.referenceImages?.length ?? 0,
      usage: { input_tokens: 100, output_tokens: 100 } }));
    return { file, root };
  }
  it.each([
    [undefined, undefined], ['gpt-image-2', undefined], ['gpt-image-2.5-sunburst', undefined],
    ['gpt-image-2', 'low'], ['gpt-image-2', 'medium'], ['gpt-image-2.5-sunburst', 'medium'],
  ])('binds model %s / quality %s to real-entry dispatch, identity, checkpoint and replay', async (imageModel, imageQuality) => {
    const { file, root } = await inputs();
    const config = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (imageModel !== undefined) config.imageModel = imageModel;
    if (imageQuality !== undefined) config.imageQuality = imageQuality;
    fs.writeFileSync(file, JSON.stringify(config));
    vi.stubEnv('GPT_IMAGE_MODEL', 'unapproved-ambient-model');
    vi.mocked(judgePreviewCandidate).mockImplementation(async args => ({ candidateSha: args.candidateSha, contextSha: args.contextSha,
      checks: QUALITY_CATEGORIES.map(category => ({ category, verdict: 'pass', observation: 'observed', correction: '' })) }));
    const result = await runOwnerBookDraft(file, 'sample');
    expect(result?.status).toBe('sample_diagnostically_passed_not_accepted');
    const selected = imageModel ?? 'gpt-image-2';
    const quality = imageQuality ?? 'low';
    for (const [args] of vi.mocked(generateGPTImage).mock.calls) expect(args).toMatchObject({ modelOverride: selected, quality, size: '1024x1536' });
    const identity = JSON.parse(fs.readFileSync(path.join(root, 'identity.json'), 'utf8'));
    expect(identity).toMatchObject({ config, imageModel: selected, quality, judgeModel: 'gpt-5.5', judgeEffort: 'medium' });
    const request = JSON.parse(fs.readFileSync(path.join(root, 'page-01.request.json'), 'utf8'));
    const record = JSON.parse(fs.readFileSync(path.join(root, 'steps/page-01.result.json'), 'utf8'));
    expect(record.value.model).toBe(selected);
    expect(record.fingerprint).toBe(previewSha(JSON.stringify({ version: 'owner-book-draft/v1', model: selected,
      quality, size: '1024x1536', prompt: request.prompt, refs: request.references })));
    await runOwnerBookDraft(file, 'sample');
    expect(generateGPTImage).toHaveBeenCalledTimes(2);
    const savedIdentity = fs.readFileSync(path.join(root, 'identity.json'));
    config.imageQuality = quality === 'medium' ? 'low' : 'medium';
    fs.writeFileSync(file, JSON.stringify(config));
    await expect(runOwnerBookDraft(file, 'sample')).rejects.toThrow('preview_input_changed_new_run_required');
    expect(generateGPTImage).toHaveBeenCalledTimes(2);
    expect(fs.readFileSync(path.join(root, 'identity.json'))).toEqual(savedIdentity);
    if (imageQuality === undefined) delete config.imageQuality; else config.imageQuality = imageQuality;
    config.imageModel = selected === 'gpt-image-2' ? 'gpt-image-2.5-sunburst' : 'gpt-image-2';
    fs.writeFileSync(file, JSON.stringify(config));
    await expect(runOwnerBookDraft(file, 'sample')).rejects.toThrow('preview_input_changed_new_run_required');
    expect(generateGPTImage).toHaveBeenCalledTimes(2);
    expect(fs.readFileSync(path.join(root, 'identity.json'))).toEqual(savedIdentity);
  });
  it.each(['wrong_model', 'fallback'])('preserves paid evidence but blocks %s before QA or next image', async fault => {
    const { file, root } = await inputs();
    const config = JSON.parse(fs.readFileSync(file, 'utf8')); config.imageModel = 'gpt-image-2.5-sunburst';
    fs.writeFileSync(file, JSON.stringify(config));
    const original = vi.mocked(generateGPTImage).getMockImplementation()!;
    vi.mocked(generateGPTImage).mockImplementation(async args => ({ ...await original(args),
      ...(fault === 'wrong_model' ? { model: 'gpt-image-2' } : { fallbackUsed: true }) }));
    const result = await runOwnerBookDraft(file, 'sample');
    expect(result).toMatchObject({ status: 'sample_held', unassessed: [2] });
    expect(generateGPTImage).toHaveBeenCalledTimes(1); expect(judgePreviewCandidate).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(root, 'page-01.png'))).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(root, 'steps/page-01.result.json'), 'utf8')).usage).toEqual({ input_tokens: 100, output_tokens: 100 });
    expect(fs.existsSync(path.join(root, 'run.lock'))).toBe(false);
  });
  it.each(['legacy', 'atlas', 'sequence'])('runs five real-entry pages with bounded references/context; mode=%s', async mode => {
    const atlas = mode !== 'legacy';
    const { file, root } = await inputs();
    const repo = path.resolve(__dirname, '..'), config = JSON.parse(fs.readFileSync(file, 'utf8'));
    const storyFile = path.resolve(repo, config.story.file), planFile = path.resolve(repo, config.plan.file);
    const story = '---\ntitle: Test\npages: 5\n---\n' + [1, 2, 3, 4, 5].map(p => `--- Page ${p} ---\nPage ${p}.`).join('\n');
    const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
    plan.pages = [0, 1, 2, 3, 4, 5].map(pageNumber => ({ ...plan.pages[0], pageNumber }));
    plan.continuity.pages = [0, 1, 2, 3, 4, 5].map(pageNumber => ({ ...plan.continuity.pages[0], pageNumber }));
    plan.recurringProps = [{ id: 'chair', design: 'wooden chair' }];
    plan.continuity.entities = [{ id: 'chair', kind: 'prop', invariants: [{ attribute: 'material', value: 'wood' }] }];
    if (atlas) {
      for (const p of plan.pages) p.props = [{ id: 'chair', state: 'on grass' }];
      for (const p of plan.continuity.pages) p.visibleEntityIds = ['chair'];
      config.propBoardRegions = { chair: { left: 0, top: 0, width: 16, height: 16 } };
    }
    const planBytes = JSON.stringify(plan);
    fs.writeFileSync(storyFile, story); fs.writeFileSync(planFile, planBytes);
    config.story.sha = previewSha(story); config.plan.sha = previewSha(planBytes);
    if (mode === 'sequence') {
      const sequence = JSON.stringify(sequenceFixture(plan, config.story.sha, config.plan.sha));
      const target = path.join(path.dirname(file), 'sequence.json'); fs.writeFileSync(target, sequence);
      config.sequence = { file: path.relative(repo, target), sha: previewSha(sequence) };
    }
    config.samplePages = [1, 2, 3, 4, 5]; config.propBoard = config.childAnchor;
    expect(() => loadOwnerDraft(repo, { ...config, imageBudgetUsd: 2.49 })).toThrow('draft_initial_reservation_limit');
    expect(loadOwnerDraft(repo, { ...config, imageBudgetUsd: 2.5 }).config.samplePages).toHaveLength(5);
    expect(() => ownerDraftSchema.parse({ ...config, samplePages: [0, 1, 2, 3, 4, 5] })).toThrow();
    fs.writeFileSync(file, JSON.stringify(config));
    vi.mocked(judgePreviewCandidate).mockImplementation(async args => {
      expect('selectedPlan' in (args.context as object)).toBe(atlas);
      expect('plan' in (args.context as object)).toBe(!atlas);
      const context = args.context as { pageNumber: number; priorPages: { pageNumber: number }[] };
      const expected = [1, 2, 3, 4].filter(p => p < context.pageNumber).slice(-3);
      expect(context.priorPages.map(p => p.pageNumber)).toEqual(expected);
      expect(args.references).toHaveLength(3 + expected.length);
      expect(args.references.slice(3).map(r => Number(r.role.match(/page (\d+)/)![1]))).toEqual(expected);
      return { candidateSha: args.candidateSha, contextSha: args.contextSha,
        checks: QUALITY_CATEGORIES.map(category => ({ category, verdict: 'pass', observation: 'observed', correction: '' })) };
    });
    const result = await runOwnerBookDraft(file, 'sample');
    expect(result?.results).toHaveLength(5); expect(generateGPTImage).toHaveBeenCalledTimes(5);
    if (mode === 'sequence') {
      vi.mocked(generateGPTImage).mock.calls.forEach(([args], i) => {
        expect(args.referenceImages).toHaveLength(i ? 4 : 3);
        if (i) expect(args.referenceImages?.[3]).toBe(path.join(root, `page-0${i}.png`));
        const request = JSON.parse(fs.readFileSync(path.join(root, `page-0${i + 1}.request.json`), 'utf8'));
        expect((vi.mocked(judgePreviewCandidate).mock.calls[i][0].context as { sequence: unknown }).sequence).toEqual(request.sequence);
        expect(args.finalPrompt).toContain(JSON.stringify(request.sequence));
      });
    }
    expect(JSON.parse(fs.readFileSync(path.join(root, 'identity.json'), 'utf8')).samplePolicy).toBe(mode === 'sequence'
      ? 'shared-quality-before-next-page/v6-book-sequence' : atlas
      ? 'shared-quality-before-next-page/v5-selected-props-and-state' : 'shared-quality-before-next-page/v4-five-page-window');
  });
  async function addSequence(file: string, cut = false) {
    const repo = path.resolve(__dirname, '..'), config = JSON.parse(fs.readFileSync(file, 'utf8'));
    const plan = JSON.parse(fs.readFileSync(path.resolve(repo, config.plan.file), 'utf8'));
    const seq = sequenceFixture(plan, config.story.sha, config.plan.sha);
    if (cut) Object.assign(seq.pages[1], { sceneId: 'next_visit', sceneChangeEvidence: 'Second.' });
    const target = path.join(path.dirname(file), 'sequence.json'), bytes = JSON.stringify(seq); fs.writeFileSync(target, bytes);
    config.sequence = { file: path.relative(repo, target), sha: previewSha(bytes) }; fs.writeFileSync(file, JSON.stringify(config));
    return { config, seq, target, repo };
  }
  it('does not carry prior pixels across a source-evidenced scene visit cut', async () => {
    const { file } = await inputs(); await addSequence(file, true);
    vi.mocked(judgePreviewCandidate).mockImplementation(async args => {
      // No prop atlas exists in this fixture. Sequence mode must still avoid full future-plan context.
      expect(args.context).toHaveProperty('selectedPlan.scope', 'current_page_effective_state_only');
      expect(args.context).not.toHaveProperty('plan');
      return { candidateSha: args.candidateSha, contextSha: args.contextSha,
        checks: QUALITY_CATEGORIES.map(category => ({ category, verdict: 'pass', observation: 'observed', correction: '' })) };
    });
    expect((await runOwnerBookDraft(file, 'sample'))?.results).toHaveLength(2);
    expect(vi.mocked(generateGPTImage).mock.calls.map(([a]) => a.referenceImages?.length)).toEqual([2, 2]);
  });
  it('stops a tampered predecessor before the next provider dispatch', async () => {
    const { file, root } = await inputs(); await addSequence(file);
    vi.mocked(judgePreviewCandidate).mockImplementation(async args => {
      const review = { candidateSha: args.candidateSha, contextSha: args.contextSha,
        checks: QUALITY_CATEGORIES.map(category => ({ category, verdict: 'pass' as const, observation: 'observed', correction: '' })) };
      fs.writeFileSync(args.candidatePath, await sharp({ create: { width: 16, height: 16, channels: 3, background: 'red' } }).png().toBuffer()); return review;
    });
    const result = await runOwnerBookDraft(file, 'sample');
    expect(result?.results[1]).toMatchObject({ status: 'held_error', error: 'draft_scene_reference_changed' });
    expect(generateGPTImage).toHaveBeenCalledTimes(1); expect(judgePreviewCandidate).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(path.join(root, 'page-02.png'))).toBe(false);
  });
  it('rejects sequence drift before reading a credential or binding an output run', async () => {
    const { file, root } = await inputs(); const { config, seq, target } = await addSequence(file);
    seq.pages[1].states[0].value.targetId = 'companion'; const bytes = JSON.stringify(seq);
    fs.writeFileSync(target, bytes); config.sequence.sha = previewSha(bytes); fs.writeFileSync(file, JSON.stringify(config));
    vi.stubEnv('OPENAI_API_KEY', '');
    await expect(runOwnerBookDraft(file, 'sample', 'credential-must-not-be-opened')).rejects.toThrow('unexplained_change');
    expect(generateGPTImage).not.toHaveBeenCalled(); expect(judgePreviewCandidate).not.toHaveBeenCalled(); expect(fs.existsSync(root)).toBe(false);
  });
  it('keeps same sequence packet during repair without exceeding the four-reference transport cap', async () => {
    const { file, root } = await inputs(); const { config } = await addSequence(file);
    config.sampleRepairOnce = true; fs.writeFileSync(file, JSON.stringify(config));
    const originalImpl = vi.mocked(generateGPTImage).getMockImplementation()!;
    vi.mocked(generateGPTImage).mockImplementation(async args => {
      const out = await originalImpl(args);
      if (args.finalPrompt.includes('TARGETED CORRECTIVE EDIT')) return { ...out, buffer: await sharp({ create: { width: 16, height: 16, channels: 3, background: 'red' } }).png().toBuffer() };
      return out;
    });
    vi.mocked(judgePreviewCandidate).mockImplementation(async args => ({ candidateSha: args.candidateSha, contextSha: args.contextSha,
      checks: QUALITY_CATEGORIES.map(category => ({ category, verdict: args.step === 'qa-02' && category === 'scene' ? 'defect' : 'pass', observation: 'scene', correction: category === 'scene' ? 'restore position' : '' })) }));
    const result = await runOwnerBookDraft(file, 'sample'); expect(result?.status).toBe('sample_diagnostically_passed_not_accepted');
    expect(vi.mocked(generateGPTImage).mock.calls.map(([a]) => a.referenceImages?.length)).toEqual([2, 3, 3]);
    const first = JSON.parse(fs.readFileSync(path.join(root, 'page-02.request.json'), 'utf8'));
    const repaired = JSON.parse(fs.readFileSync(path.join(root, 'page-02-repair-01.request.json'), 'utf8'));
    expect(repaired.sequence).toEqual(first.sequence);
    expect(vi.mocked(generateGPTImage).mock.calls[2][0].referenceImages?.[2]).toBe(path.join(root, 'page-02.png'));
    expect(repaired.prompt).not.toContain('image 3 = prior same-scene');
    const before = vi.mocked(generateGPTImage).mock.calls.length;
    await runOwnerBookDraft(file, 'sample'); expect(generateGPTImage).toHaveBeenCalledTimes(before);
  });
  it('imports without generation, repairs to a new file, checkpoints both attempts and carries repaired prior context', async () => {
    const { file, root } = await inputs();
    const config = JSON.parse(fs.readFileSync(file, 'utf8'));
    config.sampleRepairOnce = true;
    config.sampleInitialImages = [{ pageNumber: 1, image: config.childAnchor }];
    fs.writeFileSync(file, JSON.stringify(config));
    const original = fs.readFileSync(path.resolve(__dirname, '..', config.childAnchor.file));
    const different = await sharp({ create: { width: 16, height: 16, channels: 3, background: 'blue' } }).png().toBuffer();
    const originalImpl = vi.mocked(generateGPTImage).getMockImplementation()!;
    vi.mocked(generateGPTImage).mockImplementation(async args => {
      expect(fs.existsSync(path.join(root, 'sample-page-01-attempt-0.json'))).toBe(true);
      return { ...await originalImpl(args), buffer: different };
    });
    vi.mocked(judgePreviewCandidate).mockImplementation(async args => ({ candidateSha: args.candidateSha, contextSha: args.contextSha,
      checks: QUALITY_CATEGORIES.map(category => ({ category, verdict: args.step === 'qa-01' && category === 'framing' ? 'defect' : 'pass',
        observation: 'too large in frame', correction: category === 'framing' ? 'step back' : '' })) }));
    const result = await runOwnerBookDraft(file, 'sample');
    expect(result).toMatchObject({ status: 'sample_diagnostically_passed_not_accepted', repairsUsed: 1, productionReady: false });
    expect(generateGPTImage).toHaveBeenCalledTimes(2);
    expect(vi.mocked(judgePreviewCandidate).mock.calls.map(c => c[0].step)).toEqual(['qa-01', 'qa-01-repair-01', 'qa-02']);
    expect(fs.readFileSync(path.join(root, 'page-01.png'))).toEqual(original);
    expect(fs.readFileSync(path.join(root, 'page-01-repair-01.png'))).toEqual(different);
    const request = JSON.parse(fs.readFileSync(path.join(root, 'page-01-repair-01.request.json'), 'utf8'));
    expect(request.references).toHaveLength(3); expect(request.repairOf.imageSha).toBe(previewSha(original));
    expect(request.prompt).toContain('step back'); expect(request.prompt).not.toContain('recurring PROP design board ONLY');
    expect(vi.mocked(judgePreviewCandidate).mock.calls[2][0].context).toMatchObject({ priorPages: [{ imageName: 'page-01-repair-01.png', imageSha: previewSha(different) }] });
    expect(fs.existsSync(path.join(root, 'steps/page-01.claim.json'))).toBe(false);
    const imageCalls = vi.mocked(generateGPTImage).mock.calls.length;
    await runOwnerBookDraft(file, 'sample'); expect(generateGPTImage).toHaveBeenCalledTimes(imageCalls);
    expect(fs.readFileSync(path.resolve(__dirname, '..', config.childAnchor.file))).toEqual(original);
  });
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
  it('binds second-page QA to prior text, image, unaccepted metadata and comparison reference', async () => {
    const { file, root } = await inputs();
    vi.mocked(judgePreviewCandidate).mockImplementation(async args => ({ candidateSha: args.candidateSha, contextSha: args.contextSha,
      checks: QUALITY_CATEGORIES.map(category => ({ category, verdict: 'pass', observation: 'observed', correction: '' })) }));
    const result = await runOwnerBookDraft(file, 'sample');
    expect(result?.status).toBe('sample_diagnostically_passed_not_accepted');
    expect(judgePreviewCandidate).toHaveBeenCalledTimes(2);
    const first = vi.mocked(judgePreviewCandidate).mock.calls[0][0];
    const second = vi.mocked(judgePreviewCandidate).mock.calls[1][0];
    expect(first.context).toMatchObject({ priorPages: [] });
    const prior = { pageNumber: 1, text: 'First.', imageName: 'page-01.png', imageSha: first.candidateSha,
      automatedPassed: false, score: null, reason: 'editorial_draft_visual_and_numerical_qa_not_accepted' };
    expect(second.context).toMatchObject({ pageNumber: 2, text: 'Second.', priorPages: [prior], purpose: 'diagnostic_only', calibrationStatus: 'not_established' });
    expect(second.references[second.references.length - 1]).toEqual({ file: path.join(root, prior.imageName), sha: prior.imageSha,
      role: 'previous diagnostic sample page 1; comparison only, not canonical design' });
    expect(previewSha(fs.readFileSync(path.join(root, prior.imageName)))).toBe(prior.imageSha);
    expect(second.contextSha).toBe(result?.results[1].contextSha);
    expect(result).toMatchObject({ productionReady: false, productAcceptance: 'pending' });
    // Exercise the legacy consumer too, not just the shared helper's shape.
    const legacy = await inputs();
    const legacyConfig = JSON.parse(fs.readFileSync(legacy.file, 'utf8')); delete legacyConfig.samplePages;
    fs.writeFileSync(legacy.file, JSON.stringify(legacyConfig));
    await runOwnerBookDraft(legacy.file, 'render');
    const manifest = JSON.parse(fs.readFileSync(path.join(legacy.root, 'manifest.json'), 'utf8'));
    expect(manifest.pages[1]).toEqual(prior);
    vi.mocked(judgePreviewCandidate).mockClear();
    await runOwnerBookDraft(legacy.file, 'qa');
    expect(vi.mocked(judgePreviewCandidate).mock.calls[2][0].context).toEqual(second.context);
  });
  it('rejects v1 sample identity before dispatch or modifying old evidence', async () => {
    const { file, root } = await inputs();
    vi.mocked(judgePreviewCandidate).mockImplementation(async args => ({ candidateSha: args.candidateSha, contextSha: args.contextSha,
      checks: QUALITY_CATEGORIES.map(category => ({ category, verdict: 'uncertain', observation: 'uncertain', correction: '' })) }));
    await runOwnerBookDraft(file, 'sample');
    const identityFile = path.join(root, 'identity.json');
    const identity = JSON.parse(fs.readFileSync(identityFile, 'utf8'));
    expect(identity.samplePolicy).toBe('shared-quality-before-next-page/v2');
    identity.samplePolicy = 'shared-quality-before-next-page/v1'; fs.writeFileSync(identityFile, JSON.stringify(identity));
    const original = fs.readFileSync(identityFile);
    vi.mocked(generateGPTImage).mockClear(); vi.mocked(judgePreviewCandidate).mockClear();
    await expect(runOwnerBookDraft(file, 'sample')).rejects.toThrow('preview_input_changed_new_run_required');
    expect(generateGPTImage).not.toHaveBeenCalled(); expect(judgePreviewCandidate).not.toHaveBeenCalled();
    expect(fs.readFileSync(identityFile)).toEqual(original);
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
