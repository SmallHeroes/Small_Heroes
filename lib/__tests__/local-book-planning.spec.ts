import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { wholeBookDraftSchema, compileWholeBookDraft, wholeBookPlanningInput } from '../local-book-planning';
import { previewPagePrompt, previewSha, previewStory } from '../local-story-preview';
import { QUALITY_CATEGORIES, PREVIEW_QUALITY_VERSION, PREVIEW_JUDGE_MODEL, PREVIEW_JUDGE_EFFORT, PREVIEW_JUDGE_INSTRUCTION, ANATOMY_INSPECTION_INSTRUCTION } from '../local-preview-quality';
import { runLocalStoryPreview } from '../../scripts/run-local-story-preview';
import { generateGPTImage } from '../generate-image';
import { judgePreviewCandidate } from '../../scripts/lib/local-preview-judge';
import { localPlannerCapacity, localRepairPrompt, buildLocalRepairPrompt, preflightLocalBookPrompts, assertLocalImagePrompt } from '../local-preview-capacity';
import { sequencePageState } from '../local-book-sequence';
import { STYLE_01_SHARED, STYLE_01_RENDERING_CORRECTION, STYLE_01_CANONICAL_CHILD_ANCHOR_RULE, STYLE_01_FRAMING_RULE, STYLE_01_FRAMING_RULE_CLOSE_UP, buildStyle01ChildAnatomicalLock } from '../style01-gptimage';
import { buildStyle01AnatomyIntegrityLock } from '../style01-visual-polish';

const provider = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('openai', () => ({ default: class { responses = { create: provider.create }; } }));
vi.mock('../generate-image', async importOriginal => ({ ...await importOriginal<typeof import('../generate-image')>(), generateGPTImage: vi.fn() }));
vi.mock('../../scripts/lib/local-preview-judge', () => ({ judgePreviewCandidate: vi.fn() }));

export function planningFixture(count = 2) {
  const raw = `---\ntitle: Test\npages: ${count}\n---\n` + Array.from({ length: count }, (_, i) => `--- Page ${i + 1} ---\nThe child waits inside. Beat ${i + 1}.`).join('\n');
  const story = previewStory(raw, 'Bar', 'boy');
  const plan = { wardrobe: 'blue shirt', visualLanguage: 'watercolor', recurringProps: [], locations: [{ id: 'room', design: 'one wooden room' }],
    pages: Array.from({ length: count + 1 }, (_, pageNumber) => ({ pageNumber, locationId: 'room',
      shot: (['wide', 'medium', 'close'] as const)[Math.max(0, pageNumber - 1) % 3], angle: (['low', 'high', 'eye_level'] as const)[pageNumber % 3],
      composition: `Composition ${pageNumber}`, childAction: 'waits', childExpression: `feeling ${pageNumber}`, childGaze: 'companion', companionAction: 'sits', scene: 'room', props: [] })),
    continuity: { companionStandingHeightInChildHeights: .75, entities: [],
      pages: Array.from({ length: count + 1 }, (_, pageNumber) => ({ pageNumber, visibleLocationIds: ['room'], visibleEntityIds: [], changes: [], childHeightFraction: .3, environmentAreaFraction: .7 })) } };
  const draft = wholeBookDraftSchema.parse({ plan, sequence: { premise: 'A child learns to wait with a friend', mutableAttributes: [],
    initialStates: ['child', 'companion'].map(entityId => ({ entityId, value: { relation: 'inside', targetId: 'room' } })),
    pages: story.pages.map(p => ({ pageNumber: p.pageNumber, sceneId: 'room_visit', beat: `Beat ${p.pageNumber}`, sceneChangeEvidence: null, visibleCastIds: ['child', 'companion'], transitions: [] })) } });
  return { raw, story, draft };
}

describe('complete story planning before images', () => {
  it.each([8, 12, 16])('compiles all %i pages without rewriting any presentation field or input', count => {
    const { story, draft } = planningFixture(count); const before = JSON.stringify(draft);
    const out = compileWholeBookDraft(draft, story);
    expect(JSON.stringify(draft)).toBe(before); expect(out.plan).toEqual(draft.plan);
    expect(out.sequence.pages).toHaveLength(count);
    expect(out.sequence.planSha).toBe(previewSha(JSON.stringify(out.plan, null, 2) + '\n'));
    for (let n = 1; n <= count; n++) {
      expect(out.sequence.pages[n - 1].states).toEqual(draft.sequence.initialStates);
      const prompt = previewPagePrompt(out.plan, n, story.pages[n - 1].text, 5, 'boy', 'panda');
      const p = draft.plan.pages[n];
      expect(prompt).toContain(`CAMERA: ${p.shot}, ${p.angle}. COMPOSITION: ${p.composition}`);
      expect(prompt).toContain(`EXPRESSION: ${p.childExpression}. GAZE: ${p.childGaze}.`);
    }
  });
  it.each(['missing_last_page', 'duplicate_initial', 'unknown_transition', 'bad_from', 'unsupported_evidence', 'duplicate_transition', 'model_hash', 'reset', 'no_sequence'])('rejects whole-book defect: %s', kind => {
    const { story, draft } = planningFixture(); const last = draft.sequence.pages[1];
    const t = { entityId: 'child', from: { relation: 'inside' as const, targetId: 'room' }, to: { relation: 'beside' as const, targetId: 'room' }, evidence: 'The child waits inside.' };
    if (kind === 'missing_last_page') draft.sequence.pages.pop();
    if (kind === 'duplicate_initial') draft.sequence.initialStates.push(draft.sequence.initialStates[0]);
    if (kind === 'unknown_transition') last.transitions.push({ ...t, entityId: 'invented' });
    if (kind === 'bad_from') last.transitions.push({ ...t, from: { relation: 'at', targetId: 'room' } });
    if (kind === 'unsupported_evidence') last.transitions.push({ ...t, evidence: 'They leave.' });
    if (kind === 'duplicate_transition') last.transitions.push(t, t);
    if (kind === 'model_hash') Object.assign(draft.sequence, { sourceSha: 'f'.repeat(64) });
    if (kind === 'reset') last.transitions.push({ ...t, to: { relation: 'unestablished', targetId: null } });
    expect(() => compileWholeBookDraft(kind === 'no_sequence' ? { plan: draft.plan } : draft, story)).toThrow();
  });
  it('applies a source-linked transition once and inherits it on following pages', () => {
    const { draft, story } = planningFixture(3);
    story.pages[1].text = 'The child leaves the room.';
    draft.sequence.pages[1].transitions.push({ entityId: 'child', from: { relation: 'inside', targetId: 'room' }, to: { relation: 'beside', targetId: 'room' }, evidence: story.pages[1].text });
    const out = compileWholeBookDraft(draft, story);
    expect(out.sequence.pages.map(p => p.states[0].value.relation)).toEqual(['inside', 'beside', 'beside']);
  });
  it.each(['angle', 'expression', 'wide_quota', 'occupancy'])('retains the existing presentation gate: %s', defect => {
    const { draft, story } = planningFixture(12);
    if (defect === 'angle') draft.plan.pages.forEach(p => { p.angle = 'low'; });
    if (defect === 'expression') draft.plan.pages.forEach(p => { p.childExpression = 'generic smile'; });
    if (defect === 'wide_quota') draft.plan.pages.slice(4).forEach(p => { p.shot = 'medium'; });
    if (defect === 'occupancy') draft.plan.continuity.pages[1].childHeightFraction = .8;
    expect(() => compileWholeBookDraft(draft, story)).toThrow();
  });
  it('passes all18 reviewed intake stories and all216 pages to the planner, in BOTH genders, without mutating prose', () => {
    const repo = path.resolve(__dirname, '../..');
    const manifest = JSON.parse(fs.readFileSync(path.join(repo, 'story-pipeline/06_editorial_refresh/2026-09-16/intake/manifest.json'), 'utf8'));
    expect(manifest.records).toHaveLength(18); let pages = 0;
    for (const record of manifest.records) {
      const raw = fs.readFileSync(path.join(repo, record.path), 'utf8'); expect(previewSha(raw)).toBe(record.sha256);
      for (const gender of ['boy', 'girl'] as const) {
        const story = previewStory(raw, gender === 'boy' ? 'בר' : 'נועה', gender);
        const input = wholeBookPlanningInput(story, 5, gender, 'bound companion design');
        expect(input.story).toEqual(story); expect(input.story).not.toBe(story);
        expect(input.story.pages.map(p => p.pageNumber)).toEqual(Array.from({ length: record.pages }, (_, i) => i + 1));
        expect(JSON.stringify(input.story)).not.toMatch(/\{\{|\{[^{}]+\|[^{}]+\}/);
        pages += input.story.pages.length;
      }
      expect(previewSha(fs.readFileSync(path.join(repo, record.path)))).toBe(record.sha256);
    }
    expect(pages).toBe(432); // 216 pages ×2 personalizations; NOT18 generated/approved visual plans.
  });
});

const testRoots: string[] = [];
afterEach(() => {
  vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals();
  for (const root of testRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

async function realEntryFixture(count = 2) {
  const repo = path.resolve(__dirname, '../..');
  const input = fs.mkdtempSync(path.join(repo, 'outputs', 'whole-book-entry-test-')); testRoots.push(input);
  const root = path.join(input, 'run'); const { raw, story, draft } = planningFixture(count);
  const source = path.join(input, 'story.md'); fs.writeFileSync(source, raw);
  // Only source acceptance is stubbed. Compiler, schema, checkpoint, image gate and
  // actual runner are real; no synthetic source is published or called accepted in artifacts.
  const lifecycle = createRequire(path.join(repo, 'package.json'))('./scripts/story-source-creative-replacement-lifecycle.cjs');
  vi.spyOn(lifecycle, 'loadAcceptedCreativeReplacement').mockReturnValue({ storyPath: path.relative(repo, source), storySha256: previewSha(raw), revisionDigest: 'a'.repeat(64) });
  const bytes = await sharp({ create: { width: 16, height: 16, channels: 3, background: 'blue' } }).png().toBuffer();
  const anchor = path.join(input, 'anchor.png'); fs.writeFileSync(anchor, bytes);
  const calibration = path.join(input, 'test-only-calibration.json');
  const cases = [['anatomy', 'defect'], ['anatomy', 'pass'], ['props', 'defect'], ['environment', 'defect']];
  fs.writeFileSync(calibration, JSON.stringify({ version: PREVIEW_QUALITY_VERSION, model: PREVIEW_JUDGE_MODEL, effort: PREVIEW_JUDGE_EFFORT,
    instructionSha: previewSha(PREVIEW_JUDGE_INSTRUCTION), anatomyInstructionSha: previewSha(ANATOMY_INSPECTION_INSTRUCTION), status: 'calibration_cases_matched',
    results: cases.map(([category, verdict]) => ({ matched: true, expected: [{ category, verdict }], review: {
      candidateSha: 'a'.repeat(64), contextSha: 'b'.repeat(64), checks: QUALITY_CATEGORIES.map(c => ({ category: c, verdict: c === category ? verdict : 'pass', observation: 'test fixture only', correction: c === category && verdict === 'defect' ? 'fix' : '' })) } })) }));
  const config = { acceptedManifest: 'test-only', childName: 'Bar', childAge: 5, gender: 'boy', childAnchor: anchor, companionAnchor: anchor,
    companionDescription: 'panda', outputDir: path.relative(repo, root), budgetUsd: 10, qualityCalibrationFile: calibration };
  const file = path.join(input, 'config.json'); fs.writeFileSync(file, JSON.stringify(config));
  vi.stubEnv('OPENAI_API_KEY', 'fake-never-network');
  vi.stubGlobal('fetch', vi.fn(() => { throw Error('network_forbidden_in_test'); }));
  provider.create.mockImplementation(async () => ({ status: 'completed', output_text: JSON.stringify(draft), usage: { input_tokens: 100, output_tokens: 100 } }));
  vi.mocked(generateGPTImage).mockImplementation(async args => ({ buffer: bytes, finalPrompt: args.finalPrompt, model: 'gpt-image-2', durationMs: 1, hasReferencePhoto: true,
    apiMode: 'images.edit', fallbackUsed: false, referenceCountRequested: args.referenceImages?.length ?? 0, referenceCountPassed: args.referenceImages?.length ?? 0,
    usage: { input_tokens: 100, output_tokens: 100 } }));
  vi.mocked(judgePreviewCandidate).mockImplementation(async args => ({ candidateSha: args.candidateSha, contextSha: args.contextSha,
    checks: QUALITY_CATEGORIES.map(category => ({ category, verdict: 'pass', observation: 'test pixels only', correction: '' })) }));
  return { repo, file, root, story, draft, config };
}

describe('actual local preview entry: mandatory whole-book pre-render boundary', () => {
  it.each([8, 12, 16])('sends and binds scaled capacity for ALL %i pages through the actual provider seam', async count => {
    const { file, root } = await realEntryFixture(count);
    await runLocalStoryPreview(file, true);
    const request = provider.create.mock.calls[0][0];
    const capacity = localPlannerCapacity(count, { instructions: request.instructions, input: request.input, text: request.text });
    expect(request.max_output_tokens).toBe(16000 + 1000 * count);
    expect(request.reasoning).toEqual({ effort: 'medium' });
    expect(request.model).toBe('gpt-5.4');
    const identity = JSON.parse(fs.readFileSync(path.join(root, 'identity.json'), 'utf8'));
    expect(identity.capacity).toEqual(capacity);
    expect(JSON.parse(fs.readFileSync(path.join(root, 'steps/plan.claim.json'), 'utf8')).reserveUsd).toBe(capacity.reserveUsd);
    expect(capacity.reserveUsd).toBeGreaterThanOrEqual((capacity.inputTokenUpperBound + request.max_output_tokens) * .00003);
    expect(JSON.parse(fs.readFileSync(path.join(root, 'prompt-capacity.json'), 'utf8')).rows).toHaveLength(count + 1);
    expect(generateGPTImage).toHaveBeenCalledTimes(count + 1);
    await runLocalStoryPreview(file, true);
    expect(provider.create).toHaveBeenCalledTimes(1);
  });
  it('checks the last-page envelope before the first board or image', async () => {
    const { file, root, draft } = await realEntryFixture(16);
    const last = draft.plan.pages[16];
    for (const key of ['composition', 'childAction', 'childExpression', 'childGaze', 'companionAction', 'scene'] as const) last[key] = key.repeat(300).slice(0, 1800);
    for (let i = 0; i < 8; i++) {
      const id = `prop_${i}`;
      draft.plan.recurringProps.push({ id, design: 'D'.repeat(1800) });
      last.props.push({ id, state: 'intact' });
      draft.plan.continuity.entities.push({ id, kind: 'prop', invariants: [{ attribute: 'material', value: 'wood' }] });
      draft.plan.continuity.pages[16].visibleEntityIds.push(id);
      draft.sequence.initialStates.push({ entityId: id, value: { relation: 'at', targetId: 'room' } });
    }
    await expect(runLocalStoryPreview(file, true)).rejects.toThrow('preview_image_input_limit');
    expect(provider.create).toHaveBeenCalledTimes(1); expect(generateGPTImage).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(root, 'steps/prop-board.claim.json'))).toBe(false);
  });
  it('retains terminal incomplete details and never rebills that root', async () => {
    const { file, root } = await realEntryFixture(16);
    provider.create.mockResolvedValue({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output_text: '', usage: { input_tokens: 2000, output_tokens: 32000 } });
    for (let i = 0; i < 2; i++) await expect(runLocalStoryPreview(file, true)).rejects.toThrow('planner_incomplete_new_run_required');
    expect(provider.create).toHaveBeenCalledTimes(1); expect(generateGPTImage).not.toHaveBeenCalled();
    expect(JSON.parse(fs.readFileSync(path.join(root, 'steps/plan.result.json'), 'utf8')).value.incompleteDetails).toEqual({ reason: 'max_output_tokens' });
  });
  it.each(['missing_last', 'bad_last', 'legacy_plan_only', 'incomplete'])('blocks the FIRST image on %s anywhere in the book, and never repurchases the failed plan', async defect => {
    const { file, root, draft } = await realEntryFixture();
    if (defect === 'missing_last') draft.sequence.pages.pop();
    if (defect === 'bad_last') draft.sequence.pages[1].transitions.push({ entityId: 'child', from: { relation: 'beside', targetId: 'room' }, to: { relation: 'inside', targetId: 'room' }, evidence: 'The child waits inside.' });
    if (defect === 'legacy_plan_only') provider.create.mockResolvedValue({ status: 'completed', output_text: JSON.stringify(draft.plan), usage: { input_tokens: 100, output_tokens: 100 } });
    if (defect === 'incomplete') provider.create.mockResolvedValue({ status: 'incomplete', output_text: JSON.stringify(draft), usage: { input_tokens: 100, output_tokens: 100 } });
    await expect(runLocalStoryPreview(file, true)).rejects.toThrow();
    await expect(runLocalStoryPreview(file, true)).rejects.toThrow();
    expect(provider.create).toHaveBeenCalledTimes(1); expect(generateGPTImage).not.toHaveBeenCalled(); expect(judgePreviewCandidate).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(root, 'run.lock'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'steps/plan.result.json'))).toBe(true);
  });
  it.each([false, true])('plans ALL pages once before images, shares state with QA and preserves camera (prop board=%s)', async props => {
    const { file, root, story, draft } = await realEntryFixture();
    draft.sequence.pages[1].beat = 'FUTURE_BEAT_SENTINEL';
    if (props) {
      draft.plan.recurringProps.push({ id: 'chair', design: 'one wooden chair' });
      draft.plan.continuity.entities.push({ id: 'chair', kind: 'prop', invariants: [{ attribute: 'material', value: 'wood' }] });
      draft.plan.pages.forEach(p => p.props.push({ id: 'chair', state: 'unchanged' }));
      draft.plan.continuity.pages.forEach(p => p.visibleEntityIds.push('chair'));
      draft.sequence.initialStates.push({ entityId: 'chair', value: { relation: 'at', targetId: 'room' } });
    }
    const imageImpl = vi.mocked(generateGPTImage).getMockImplementation()!;
    vi.mocked(generateGPTImage).mockImplementation(async args => {
      expect(fs.existsSync(path.join(root, 'whole-book-plan.json'))).toBe(true);
      expect(JSON.parse(fs.readFileSync(path.join(root, 'book-sequence.json'), 'utf8')).pages).toHaveLength(2);
      return imageImpl(args);
    });
    await runLocalStoryPreview(file, true);
    expect(JSON.parse(provider.create.mock.calls[0][0].input).story).toEqual(story);
    expect(provider.create.mock.calls[0][0].text.format.schema.required).toContain('sequence');
    const offset = props ? 1 : 0;
    expect(vi.mocked(generateGPTImage).mock.calls.map(([a]) => a.referenceImages?.length)).toEqual(props ? [0, 3, 3, 4] : [2, 2, 3]);
    expect(vi.mocked(generateGPTImage).mock.calls[2 + offset][0].referenceImages?.[2 + offset]).toBe(path.join(root, 'page-01.png'));
    for (const [n, call] of vi.mocked(judgePreviewCandidate).mock.calls.entries()) {
      const context = call[0].context as { sequence?: unknown }; expect(context).not.toHaveProperty('plan');
      expect(context).toHaveProperty('selectedPlan');
      if (n < 2) expect(JSON.stringify(context)).not.toContain('FUTURE_BEAT_SENTINEL');
      if (n) expect(vi.mocked(generateGPTImage).mock.calls[n + offset][0].finalPrompt).toContain(JSON.stringify(context.sequence));
      const p = draft.plan.pages[n]; expect(vi.mocked(generateGPTImage).mock.calls[n + offset][0].finalPrompt).toContain(`CAMERA: ${p.shot}, ${p.angle}. COMPOSITION: ${p.composition}`);
    }
    await runLocalStoryPreview(file, true);
    expect(provider.create).toHaveBeenCalledTimes(1); expect(generateGPTImage).toHaveBeenCalledTimes(3 + offset);
  });
  it('does not inherit a cover or previous scene pixels on a source-linked scene cut', async () => {
    const { file, draft } = await realEntryFixture();
    Object.assign(draft.sequence.pages[1], { sceneId: 'next_visit', sceneChangeEvidence: 'Beat 2.' });
    await runLocalStoryPreview(file, true);
    expect(vi.mocked(generateGPTImage).mock.calls.map(([a]) => a.referenceImages?.length)).toEqual([2, 2, 2]);
  });
  it('rejects changed prior pixels before the next image call', async () => {
    const { file } = await realEntryFixture(); const judgeImpl = vi.mocked(judgePreviewCandidate).getMockImplementation()!;
    vi.mocked(judgePreviewCandidate).mockImplementation(async args => {
      const review = await judgeImpl(args);
      if (args.step === 'qa-01-attempt-0') fs.writeFileSync(args.candidatePath, await sharp({ create: { width: 16, height: 16, channels: 3, background: 'red' } }).png().toBuffer());
      return review;
    });
    await expect(runLocalStoryPreview(file, true)).rejects.toThrow('preview_scene_reference_changed');
    expect(generateGPTImage).toHaveBeenCalledTimes(2);
  });
  it('repairs its own candidate with the same state, not a fourth/fifth duplicate reference', async () => {
    const { file, root } = await realEntryFixture(); const imageImpl = vi.mocked(generateGPTImage).getMockImplementation()!;
    vi.mocked(generateGPTImage).mockImplementation(async args => {
      const out = await imageImpl(args);
      return args.finalPrompt.includes('CORRECT THESE VERIFIED DEFECTS') ? { ...out, buffer: await sharp({ create: { width: 16, height: 16, channels: 3, background: 'red' } }).png().toBuffer() } : out;
    });
    const judgeImpl = vi.mocked(judgePreviewCandidate).getMockImplementation()!;
    vi.mocked(judgePreviewCandidate).mockImplementation(async args => {
      const review = await judgeImpl(args);
      if (args.step === 'qa-02-attempt-0') review.checks.forEach(c => Object.assign(c,
        { verdict: 'defect', observation: 'O'.repeat(1800), correction: c.category + 'X'.repeat(1800 - c.category.length) }));
      return review;
    });
    await runLocalStoryPreview(file, true);
    const calls = vi.mocked(generateGPTImage).mock.calls;
    expect(calls.map(([a]) => a.referenceImages?.length)).toEqual([2, 2, 3, 3]);
    expect(calls[3][0].referenceImages?.[2]).toBe(path.join(root, 'page-02.png'));
    expect(calls[3][0].finalPrompt).toContain('image 3 = failed candidate EDIT TARGET ONLY');
    for (const category of QUALITY_CATEGORIES) expect(calls[3][0].finalPrompt).toContain(category + 'X'.repeat(1800 - category.length));
    expect(calls[3][0].finalPrompt).not.toContain('O'.repeat(1800));
    expect(calls[3][0].finalPrompt.length).toBeLessThanOrEqual(31000);
    expect(vi.mocked(judgePreviewCandidate).mock.calls[3][0].context).toEqual(vi.mocked(judgePreviewCandidate).mock.calls[2][0].context);
  });
  it('refuses silent reuse of an old plan-only identity before any model dispatch', async () => {
    const { file, root } = await realEntryFixture(); await runLocalStoryPreview(file, true);
    const identityPath = path.join(root, 'identity.json'), old = JSON.parse(fs.readFileSync(identityPath, 'utf8')); delete old.planningVersion;
    fs.writeFileSync(identityPath, JSON.stringify(old));
    await expect(runLocalStoryPreview(file, true)).rejects.toThrow('preview_input_changed_new_run_required');
    expect(provider.create).toHaveBeenCalledTimes(1); expect(generateGPTImage).toHaveBeenCalledTimes(3);
  });
  it('blocks changed persisted sequence and does not regenerate it behind the scenes', async () => {
    const { file, root } = await realEntryFixture(); await runLocalStoryPreview(file, true);
    const sequencePath = path.join(root, 'book-sequence.json'), changed = JSON.parse(fs.readFileSync(sequencePath, 'utf8'));
    changed.pages[1].states[0].value.relation = 'beside'; fs.writeFileSync(sequencePath, JSON.stringify(changed));
    await expect(runLocalStoryPreview(file, true)).rejects.toThrow('preview_evidence_changed');
    expect(provider.create).toHaveBeenCalledTimes(1); expect(generateGPTImage).toHaveBeenCalledTimes(3);
  });
  it('keeps the existing upfront budget gate before any provider dispatch', async () => {
    const { file, root, config } = await realEntryFixture(); config.budgetUsd = .5; fs.writeFileSync(file, JSON.stringify(config));
    await expect(runLocalStoryPreview(file, true)).rejects.toThrow('insufficient_preview_budget');
    expect(provider.create).not.toHaveBeenCalled(); expect(generateGPTImage).not.toHaveBeenCalled(); expect(fs.existsSync(root)).toBe(false);
  });
});

describe('capacity policy boundaries', () => {
  it.each([3, 4])('actually crosses all repair lock tiers with %i references without losing authority', refs => {
    const { draft, story } = planningFixture(); const { plan, sequence } = compileWholeBookDraft(draft, story);
    const details = { childAge: 5, gender: 'boy', companionDescription: 'panda' };
    const packet = { ...sequencePageState(sequence, plan, 2), predecessor: null };
    const checks = QUALITY_CATEGORIES.map(category => ({ category, correction: `${category}: repair ONLY this defect.` }));
    const seen = new Set<string>(); let authority: string | undefined;
    for (let length = 18000; length <= 31000; length += 250) {
      const text = 'T'.repeat(length);
      const result = buildLocalRepairPrompt(plan, 2, text, details, packet, refs, checks);
      if (result.lockTier === 'none' && result.prompt.length > 31000) {
        expect(() => assertLocalImagePrompt(result.prompt, refs, true)).toThrow('preview_image_input_limit');
        break;
      }
      expect(() => assertLocalImagePrompt(result.prompt, refs, true)).not.toThrow();
      seen.add(result.lockTier);
      const current = result.prompt.split('\n').find(line => line.startsWith('CURRENT PAGE AUTHORITY: '));
      authority ??= current; expect(current).toBe(authority);
      expect(result.prompt).toContain(JSON.stringify(packet));
      expect(result.prompt).toContain(`PAGE TEXT (evidence, not text to paint): ${text}`);
      expect(result.prompt).toContain(`image ${refs} = failed candidate EDIT TARGET ONLY`);
      let previous = -1;
      for (const c of checks) { const at = result.prompt.indexOf(`${c.category}: ${c.correction}`); expect(at).toBeGreaterThan(previous); previous = at; }
      expect(result.prompt.includes(buildStyle01AnatomyIntegrityLock())).toBe(result.lockTier !== 'none');
      expect(result.prompt.includes(STYLE_01_CANONICAL_CHILD_ANCHOR_RULE)).toBe(result.lockTier === 'full');
    }
    expect([...seen]).toEqual(['full', 'anatomy', 'none']);
  });
  it.each([3, 9])('keeps the exact close-up and age-%i anatomy rules, not wide-shot substitutes', age => {
    const { draft, story } = planningFixture(3); const { plan, sequence } = compileWholeBookDraft(draft, story);
    const packet = { ...sequencePageState(sequence, plan, 3), predecessor: null };
    const result = buildLocalRepairPrompt(plan, 3, story.pages[2].text,
      { childAge: age, gender: 'girl', companionDescription: 'panda' }, packet, 3, [{ category: 'anatomy', correction: 'Repair the hand.' }]);
    expect(result.lockTier).toBe('full');
    expect(result.prompt).toContain(STYLE_01_FRAMING_RULE_CLOSE_UP);
    expect(result.prompt).not.toContain(STYLE_01_FRAMING_RULE);
    expect(result.prompt).toContain(buildStyle01ChildAnatomicalLock({ childAge: age, allowDistinctSupportingChildren: true }));
  });
  it('selects a smaller tier when only multipart newline expansion exhausts transport capacity', () => {
    const { draft, story } = planningFixture(); const { plan, sequence } = compileWholeBookDraft(draft, story);
    const details = { childAge: 5, gender: 'boy', companionDescription: 'panda' };
    const packet = { ...sequencePageState(sequence, plan, 2), predecessor: null };
    const checks = [{ category: 'anatomy' as const, correction: 'Repair the hand.' }];
    const flat = buildLocalRepairPrompt(plan, 2, 'x'.repeat(14500), details, packet, 4, checks);
    const multiline = buildLocalRepairPrompt(plan, 2, '\n'.repeat(14500), details, packet, 4, checks);
    expect(flat.lockTier).toBe('full'); expect(multiline.lockTier).toBe('none');
    expect(multiline.prompt.length).toBeLessThan(31000);
    expect(() => assertLocalImagePrompt(multiline.prompt, 4, true)).not.toThrow();
    const fullMultiline = flat.prompt.replace('x'.repeat(14500), '\n'.repeat(14500));
    expect(fullMultiline.length).toBeLessThan(31000);
    expect(() => assertLocalImagePrompt(fullMultiline, 4, true)).toThrow('exceeds the provider character limit');
  });
  it('reserves UTF8 input plus output using the same upper rate, rejecting oversized input', () => {
    const ascii = localPlannerCapacity(16, 'a'.repeat(100));
    const hebrew = localPlannerCapacity(16, 'א'.repeat(100));
    expect(hebrew.inputTokenUpperBound - ascii.inputTokenUpperBound).toBe(100);
    expect(() => localPlannerCapacity(16, 'x'.repeat(90000))).toThrow('planner_input_capacity');
    for (const n of [0, 1, 25, 1.5]) expect(() => localPlannerCapacity(n, {})).toThrow('planner_page_count');
  });
  it('keeps every effective invariant, frame, acting and sequence field in compact repair', () => {
    const { draft, story } = planningFixture();
    draft.plan.recurringProps.push({ id: 'crate', design: 'one blue wooden crate' });
    draft.plan.continuity.entities.push({ id: 'crate', kind: 'prop', invariants: [{ attribute: 'color', value: 'blue' }, { attribute: 'material', value: 'wood' }] });
    draft.plan.pages.forEach(p => p.props.push({ id: 'crate', state: p.pageNumber === 2 ? 'painted red' : 'blue' }));
    draft.plan.continuity.pages.forEach(p => p.visibleEntityIds.push('crate'));
    draft.plan.continuity.pages[2].changes.push({ entityId: 'crate', attribute: 'color', value: 'red', storyEvidence: 'Beat 2.' });
    draft.sequence.mutableAttributes.push({ entityId: 'crate', attribute: 'color' });
    draft.sequence.initialStates.push({ entityId: 'crate', value: { relation: 'at', targetId: 'room' } });
    const { plan, sequence } = compileWholeBookDraft(draft, story);
    const packet = { ...sequencePageState(sequence, plan, 2), predecessor: null };
    const prompt = localRepairPrompt(plan, 2, story.pages[1].text, { childAge: 5, gender: 'boy', companionDescription: 'panda' }, packet, 4,
      [{ category: 'scene', correction: 'One\r\n\tcomplete correction.' }]);
    expect(prompt).toContain(JSON.stringify(plan.pages[2])); expect(prompt).toContain(JSON.stringify(packet));
    expect(prompt).toContain('scene: One complete correction.'); expect(prompt).toContain('image 4 = failed candidate');
    const effective = JSON.parse(prompt.split('\n').find(line => line.startsWith('CURRENT PAGE AUTHORITY: '))!.slice('CURRENT PAGE AUTHORITY: '.length));
    expect(effective.continuity.entities[0]).toEqual({ id: 'crate', kind: 'prop', currentState: { color: 'red', material: 'wood' } });
    expect(plan.continuity!.entities[0].invariants[0].value).toBe('blue'); // original evidence untouched
    expect(preflightLocalBookPrompts(plan, sequence, [story.title, ...story.pages.map(p => p.text)], { childAge: 5, gender: 'boy', companionDescription: 'panda' }).rows).toHaveLength(3);
  });
  it('carries the SAME STYLE_01 identity/anatomy/framing locks the initial prompt uses', () => {
    const { draft, story } = planningFixture(); const { plan, sequence } = compileWholeBookDraft(draft, story);
    const details = { childAge: 5, gender: 'boy', companionDescription: 'panda' };
    const packet = { ...sequencePageState(sequence, plan, 2), predecessor: null };
    const { prompt, lockTier } = buildLocalRepairPrompt(plan, 2, story.pages[1].text, details, packet, 4,
      [{ category: 'anatomy', correction: 'redraw the detached forearm' }]);
    expect(lockTier).toBe('full');
    const initial = previewPagePrompt(plan, 2, story.pages[1].text, 5, 'boy', 'panda');
    for (const block of [STYLE_01_SHARED, STYLE_01_RENDERING_CORRECTION, STYLE_01_CANONICAL_CHILD_ANCHOR_RULE,
      STYLE_01_FRAMING_RULE, buildStyle01ChildAnatomicalLock({ childAge: 5, allowDistinctSupportingChildren: true }),
      buildStyle01AnatomyIntegrityLock()]) {
      expect(initial).toContain(block); // the block really is part of the initial prompt
      expect(prompt).toContain(block);  // and the repair now carries the identical text
    }
  });
  it.each([0, 600, 1200, 1800])('degrades lock tiers by real transport fit at %i correction chars, never truncating', per => {
    const { draft, story } = planningFixture(); const { plan, sequence } = compileWholeBookDraft(draft, story);
    const details = { childAge: 5, gender: 'boy', companionDescription: 'panda' };
    const packet = { ...sequencePageState(sequence, plan, 2), predecessor: null };
    const checks = QUALITY_CATEGORIES.map(category => ({ category, correction: `${category} `.repeat(per).slice(0, per) }));
    const { prompt, lockTier } = buildLocalRepairPrompt(plan, 2, story.pages[1].text, details, packet, 4, checks);
    expect(['full', 'anatomy', 'none']).toContain(lockTier);
    // Whatever the tier, the prompt is sendable and every correction survives in full.
    expect(() => assertLocalImagePrompt(prompt, 4, true)).not.toThrow();
    for (const c of checks) if (c.correction) expect(prompt).toContain(`${c.category}: ${c.correction.replace(/\s+/gu, ' ').trim()}`);
    // A narrower tier never smuggles lock text back in.
    if (lockTier === 'none') expect(prompt).not.toContain(buildStyle01AnatomyIntegrityLock());
    if (lockTier !== 'full') expect(prompt).not.toContain(STYLE_01_CANONICAL_CHILD_ANCHOR_RULE);
  });
  it('reports an exact full-lock threshold and never exceeds the pre-existing worst case', () => {
    const { draft, story } = planningFixture(); const { plan, sequence } = compileWholeBookDraft(draft, story);
    const details = { childAge: 5, gender: 'boy', companionDescription: 'panda' };
    const texts = [story.title, ...story.pages.map(p => p.text)];
    const rows = preflightLocalBookPrompts(plan, sequence, texts, details).rows;
    for (const row of rows) {
      const packet = row.pageNumber ? { ...sequencePageState(sequence, plan, row.pageNumber), predecessor: null } : null;
      const margin = row.pageNumber ? 512 : 0;
      const at = (per: number) => buildLocalRepairPrompt(plan, row.pageNumber, texts[row.pageNumber], details, packet, 4,
        QUALITY_CATEGORIES.map(category => ({ category, correction: 'X'.repeat(per) })), margin).lockTier;
      const threshold = row.fullLockCorrectionCharsPerCategory;
      expect(threshold).not.toBeNull(); // this fixture is small enough for full locks
      expect(at(threshold!)).toBe('full');
      if (threshold! < 1800) expect(at(threshold! + 1)).not.toBe('full');
      // The schema-maximum worst case stays sendable, which is the guarantee locks must not cost.
      expect(row.maxRepairCharsWithMargin).toBeLessThanOrEqual(31000);
      expect(at(1800)).toBe(row.lockTierAtMaxCorrections);
    }
  });
  it('checks the actual transport prefix and multipart newline expansion, not JS length alone', () => {
    expect(() => assertLocalImagePrompt('\n'.repeat(17000), 3, true)).toThrow('exceeds the provider character limit');
    expect(() => assertLocalImagePrompt('x'.repeat(31001), 3, true)).toThrow('preview_image_input_limit');
  });
  it('reserves enough room for the maximum permitted predecessor metadata', () => {
    const { draft, story } = planningFixture(); const { plan, sequence } = compileWholeBookDraft(draft, story);
    const details = { childAge: 5, gender: 'boy', companionDescription: 'panda' };
    const packet = { ...sequencePageState(sequence, plan, 2), predecessor: {
      pageNumber: 24, imageName: 'page-24-repair-2.png', imageSha: 'f'.repeat(64), authority: 'comparison_only_not_canonical' as const } };
    const checks = QUALITY_CATEGORIES.map(category => ({ category, correction: '界'.repeat(1800) }));
    const actual = assertLocalImagePrompt(localRepairPrompt(plan, 2, story.pages[1].text, details, packet, 4, checks), 4, true);
    const reserved = preflightLocalBookPrompts(plan, sequence, [story.title, ...story.pages.map(p => p.text)], details).rows[2];
    expect(actual.finalPrompt.replace(/\r\n|\r|\n/g, '\r\n').length).toBeLessThan(reserved.maxRepairMultipartCharsWithMargin);
  });
});
