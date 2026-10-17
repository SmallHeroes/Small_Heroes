import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { buildStage0DescriptionTemplatePrompt, buildStage0MethodBPrompt } from '../../generation-pipeline/stage0-method-b';
import { STYLE_01_AVOIDANCE_NEGATIVE } from '../../style01-gptimage';
import { STYLE01_ANCHOR_STYLE_QA_PROMPT } from '../../anchor-style-qa';
import { STYLE_REFERENCE_PREFIX } from '../../generate-image';
import { QUALITY_CATEGORIES, qualityDisposition } from '../../local-preview-quality';
import { CHILD_ANCHOR_TECHNIQUE_MANIFEST, CHILD_ANCHOR_TEMPLATE_SENTENCE, resolveChildAnchorTechnique, childAnchorDescriptionRequest, childAnchorPhotoRequest,
  assertChildAnchorRenderPlan, childAnchorRecipeSchema, childAnchorRecipeSha, childAnchorStylePayload, childAnchorDesignPayload, childAnchorStyleDisposition,
  childAnchorDesignDisposition, childAnchorDisposition, childAnchorControlBinding, childAnchorCorrectionPrompt, assertChildAnchorAccepted,
  CHILD_ANCHOR_MANIFEST_SHA256, CHILD_ANCHOR_STYLE_VERSION } from '../child-anchor-style';
import { auditionReviewRule } from '../../../scripts/personal-simple-book-reviewed-audition';
import { planChildAnchorProbe, runChildAnchorProbe, CHILD_ANCHOR_PROBE_STEPS, type ChildAnchorProbeConfig } from '../../../scripts/personal-child-anchor-style-probe';

const sha = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
const child = { age: 6, gender: 'girl' as const, design: 'A new fictional six-year-old girl with long straight black hair, dark brown eyes and olive skin.', wardrobe: 'a mustard sweater, blue jeans and red sneakers' };
const recipe = (over: Record<string, unknown> = {}) => childAnchorRecipeSchema.parse({ version: CHILD_ANCHOR_STYLE_VERSION, identitySource: 'description',
  manifestSha256: CHILD_ANCHOR_MANIFEST_SHA256, step: 'reference_child', referenceMode: 'style',
  references: CHILD_ANCHOR_TECHNIQUE_MANIFEST.map(e => ({ role: e.label, sha256: e.sha256 })), promptSha256: 'c'.repeat(64), requestedAge: 6, ...over });
const A = 'a'.repeat(64), B = 'b'.repeat(64), CTX = 'd'.repeat(64);
const styleAnswer = (r: ReturnType<typeof recipe>, over: Record<string, unknown> = {}, candidateSha = A) => ({ candidateSha, contextSha: CTX, recipeSha: childAnchorRecipeSha(r),
  assessable: true, style01Match: true, looksPhotoreal: false, looksPortrait: false, notes: 'hand-painted watercolor child', ...over });
const designAnswer = (r: ReturnType<typeof recipe>, age: Record<string, unknown> = {}, defect?: string, candidateSha = A) => ({ candidateSha, contextSha: CTX,
  checks: QUALITY_CATEGORIES.map(category => category === defect ? { category, verdict: 'defect', observation: 'seen', correction: `fix ${category}` }
    : { category, verdict: 'pass', observation: 'ok', correction: '' }),
  recipeSha: childAnchorRecipeSha(r), apparentAge: { requestedAge: r.requestedAge, verdict: 'compatible', observation: 'reads about six', correction: '', ...age } });
const roots: string[] = [];
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }); });

describe('child-anchor-style/v1 request construction (production builders reused, no template)', () => {
  it('the description prompt is production\'s, line for line, minus only the template sentence, then [AVOID]', () => {
    const production = buildStage0DescriptionTemplatePrompt({ order: { childAge: 6, childGender: 'girl' }, lockedChildDescription: child.design,
      wardrobeLock: `WARDROBE LOCK: ${child.wardrobe}` }).split('\n\n');
    const r = childAnchorDescriptionRequest(child);
    expect(production).toContain(CHILD_ANCHOR_TEMPLATE_SENTENCE);
    expect(r.core.split('\n\n')).toEqual(production.filter(l => l !== CHILD_ANCHOR_TEMPLATE_SENTENCE));
    expect(r.prompt).toBe(`${r.core}\n\n[AVOID]\n${STYLE_01_AVOIDANCE_NEGATIVE}`);
    expect(r.prompt).not.toContain('SYSTEM TEMPLATE');
    expect(r.prompt).toContain('ANCHOR STYLE FIDELITY'); expect(r.prompt).toContain('ANTI-TODDLER'); expect(r.prompt).toContain('6-year-old');
    expect(r.referenceMode).toBe('style');
  });
  it('the photo request is Method B photo_only_no_template exactly (built, not wired), identity at 0.70', () => {
    const r = childAnchorPhotoRequest({ age: 7, gender: 'boy' });
    expect(r.prompt).toBe(`${buildStage0MethodBPrompt({ order: { childAge: 7, childGender: 'boy' }, lockedChildDescription:
      'A 7-year-old boy. Hair, skin tone, eyes and face come only from reference image 1 (the photo).', childPhotoDescription: null,
      referenceLayout: 'photo_only_no_template' })}\n\n[AVOID]\n${STYLE_01_AVOIDANCE_NEGATIVE}`);
    expect(r).toMatchObject({ referenceMode: 'anchor_photo_style_only', references: ['raw_child_photo', 'style01_ref_1', 'style01_ref_2'], identityThreshold: 0.7 });
  });
  it('a changed production prompt (no template sentence to remove) refuses', async () => {
    const stage0 = await import('../../generation-pipeline/stage0-method-b');
    vi.spyOn(stage0, 'buildStage0DescriptionTemplatePrompt').mockReturnValue('one\n\ntwo');
    expect(() => childAnchorDescriptionRequest(child)).toThrow('child_anchor_production_prompt');
  });
});

describe('the pinned technique references (explicit manifest; cwd/environment never self-authorize)', () => {
  it('the manifest names the committed character-free files by their bytes, resolved where production resolves them', () => {
    const t = resolveChildAnchorTechnique(process.cwd());
    expect(t.map(x => [x.label, sha(x.bytes)])).toEqual(CHILD_ANCHOR_TECHNIQUE_MANIFEST.map(e => [e.label, e.sha256]));
    expect(CHILD_ANCHOR_TECHNIQUE_MANIFEST.map(e => e.file)).toEqual(['style-references/01/style01-texture-night-window.png', 'style-references/01/style01-texture-porch-lavender.png']);
  });
  it('another workspace, an environment override of the subset, or changed bytes is refused', () => {
    const other = mkdtempSync(path.join(tmpdir(), 'sh_anchor_ws_')); roots.push(other);
    expect(() => resolveChildAnchorTechnique(other)).toThrow('child_anchor_reference_mismatch');
    vi.stubEnv('PHASE2_STYLE01_REF_CONFIG', 'B');
    expect(() => resolveChildAnchorTechnique(process.cwd())).toThrow('child_anchor_reference_mismatch');
    vi.unstubAllEnvs();
    expect(() => resolveChildAnchorTechnique(process.cwd(), f => Buffer.concat([readFileSync(f), Buffer.from([0])]))).toThrow('child_anchor_reference_changed');
  });
  it('the real request-planning seam: style prefix, both references passed; a lower reference cap refuses instead of truncating', () => {
    const r = childAnchorDescriptionRequest(child), plan = assertChildAnchorRenderPlan(r.prompt, 2, 'style');
    expect(plan.finalPrompt.startsWith(STYLE_REFERENCE_PREFIX)).toBe(true);
    expect(plan).toMatchObject({ referenceCountPassed: 2, apiMode: 'images.edit', model: 'gpt-image-2', quality: 'low', size: '1024x1024' });
    vi.stubEnv('GPT_IMAGE_EDIT_MAX_REFERENCES', '1');
    expect(() => assertChildAnchorRenderPlan(r.prompt, 2, 'style')).toThrow('child_anchor_reference_truncated');
  });
  it('a recipe binds the manifest: other first-render references are refused', () => {
    expect(() => recipe({ references: [{ role: 'style01_ref_1', sha256: B }, { role: 'style01_ref_2', sha256: CHILD_ANCHOR_TECHNIQUE_MANIFEST[1].sha256 }] })).toThrow();
    expect(() => recipe({ referenceMode: 'book_design' })).toThrow();
    expect(() => recipe({ step: 'reference_child_repair', referenceMode: 'book_design', references: [{ role: 'rejected_edit_target', sha256: A }] })).not.toThrow();
  });
});

describe('the reviews: Sol 6.1, the $0.60 slot, strict schemas, three dimensions, fail-closed', () => {
  it('the style request carries production\'s imported criterion and prices at the review rule\'s slot', () => {
    const p = childAnchorStylePayload({ candidateSha: A, contextSha: CTX, recipeSha: childAnchorRecipeSha(recipe()), candidateURL: 'data:image/png;base64,AA==' });
    expect(p).toMatchObject({ model: 'gpt-6.1-sol', service_tier: 'default', max_output_tokens: 12000, store: false });
    expect(p.instructions.startsWith(STYLE01_ANCHOR_STYLE_QA_PROMPT)).toBe(true);
    expect((p.text.format as any).strict).toBe(true);
    expect(auditionReviewRule.reserve(p)).toBe(600000);
    const d = childAnchorDesignPayload({ candidateSha: A, contextSha: CTX, context: {}, recipe: recipe(), imageURLs: Array(5).fill('data:image/png;base64,AA==') });
    expect(auditionReviewRule.reserve(d)).toBe(600000);
    expect(JSON.parse((d.input[0].content[0] as { text: string }).text).apparentAge).toEqual({ requestedAge: 6 });
  });
  it('style: unassessable holds, photoreal or no match is a defect, a mis-bound or malformed answer refuses', () => {
    const r = recipe(), rs = childAnchorRecipeSha(r);
    expect(childAnchorStyleDisposition(styleAnswer(r), A, CTX, rs).disposition).toBe('passed');
    expect(childAnchorStyleDisposition(styleAnswer(r, { assessable: false }), A, CTX, rs).disposition).toBe('held_uncertain');
    expect(childAnchorStyleDisposition(styleAnswer(r, { looksPhotoreal: true }), A, CTX, rs).disposition).toBe('defect');
    expect(childAnchorStyleDisposition(styleAnswer(r, { style01Match: false }), A, CTX, rs).disposition).toBe('defect');
    expect(() => childAnchorStyleDisposition(styleAnswer(r), B, CTX, rs)).toThrow('child_anchor_evidence_binding');
    expect(() => childAnchorStyleDisposition(styleAnswer(r), A, CTX, childAnchorRecipeSha(recipe({ requestedAge: 7 })))).toThrow('child_anchor_evidence_binding');
    expect(() => childAnchorStyleDisposition({ ...styleAnswer(r), extra: 1 }, A, CTX, rs)).toThrow();
    expect(() => childAnchorStyleDisposition({ candidateSha: A }, A, CTX, rs)).toThrow();
  });
  it('apparent age is its own gate: uncertain holds, a defect needs a correction, the requested age must match', () => {
    const r = recipe(), style = childAnchorStyleDisposition(styleAnswer(r), A, CTX, childAnchorRecipeSha(r));
    const design = (age: Record<string, unknown>, defect?: string) => childAnchorDesignDisposition(designAnswer(r, age, defect), A, CTX, r);
    expect(childAnchorDisposition(style, design({})).disposition).toBe('passed');
    expect(childAnchorDisposition(style, design({ verdict: 'uncertain' })).disposition).toBe('held_uncertain');
    const old = childAnchorDisposition(style, design({ verdict: 'defect', correction: 'make her read six, not three' }));
    expect(old).toEqual({ disposition: 'repair', corrections: ['apparent_age (requested 6): make her read six, not three'] });
    expect(() => design({ verdict: 'defect' })).toThrow('child_anchor_missing_correction');
    expect(() => childAnchorDesignDisposition(designAnswer(r, { requestedAge: 9 }), A, CTX, r)).toThrow('child_anchor_evidence_binding');
    // The stripped design record is the legacy eight-category review the reviewed-book loader re-checks.
    expect(qualityDisposition(design({}).review, A, CTX).disposition).toBe('passed');
  });
  it('separate dimensions: a style pass with a design defect, or a design pass with a style defect, is not a pass; missing evidence holds', () => {
    const r = recipe(), rs = childAnchorRecipeSha(r);
    const pass = childAnchorStyleDisposition(styleAnswer(r), A, CTX, rs), bad = childAnchorStyleDisposition(styleAnswer(r, { style01Match: false }), A, CTX, rs);
    expect(childAnchorDisposition(pass, childAnchorDesignDisposition(designAnswer(r, {}, 'anatomy'), A, CTX, r)).disposition).toBe('repair');
    expect(childAnchorDisposition(bad, childAnchorDesignDisposition(designAnswer(r), A, CTX, r)).disposition).toBe('repair');
    expect(childAnchorDisposition(pass, null).disposition).toBe('held_uncertain');
    expect(childAnchorDisposition(null, childAnchorDesignDisposition(designAnswer(r), A, CTX, r)).disposition).toBe('held_uncertain');
  });
  it('acceptance re-derives every dimension for the adopted candidate: an earlier image\'s style PASS never carries', () => {
    const r = recipe(), rs = childAnchorRecipeSha(r);
    const record = (styleFor: string) => ({ version: CHILD_ANCHOR_STYLE_VERSION, recipe: r, recipeSha: rs, style: styleAnswer(r, {}, styleFor), design: designAnswer(r, {}, undefined, B) });
    expect(() => assertChildAnchorAccepted(record(A), B, CTX)).toThrow('child_anchor_evidence_binding');
    expect(assertChildAnchorAccepted(record(B), B, CTX)).toEqual(r);
    expect(() => assertChildAnchorAccepted({ ...record(B), recipeSha: A }, B, CTX)).toThrow('child_anchor_evidence_binding');
  });
  it('the negative control\'s binding is never an anchor recipe; a correction needs evidenced corrections', () => {
    const bound = childAnchorControlBinding(A);
    expect(bound.recipeSha).not.toBe(childAnchorRecipeSha(recipe()));
    expect(() => childAnchorCorrectionPrompt('core', [])).toThrow('child_anchor_correction_scope');
    expect(childAnchorCorrectionPrompt('core', ['anatomy: fix'])).toMatch(/^core\n\nImage 1 is the REJECTED edit target[\s\S]*TARGETED CORRECTIONS:\nanatomy: fix\n\n\[AVOID\]/);
  });
});

describe('the standalone four-call diagnostic (dry by default; injected providers only here)', () => {
  async function setup() {
    const root = mkdtempSync(path.join(tmpdir(), 'sh_anchor_probe_')); roots.push(root);
    const control = path.join(root, 'control.png'), bytes = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#a33' } }).png().toBuffer();
    writeFileSync(control, bytes);
    const config: ChildAnchorProbeConfig = { version: 'child-anchor-style-probe-config/v1', label: 'test-r1', child,
      negativeControl: { file: control, sha256: sha(bytes) }, outputParent: root, keyEnvFile: path.join(root, 'none.env'), capMicroUsd: 1000000 };
    return { root, config };
  }
  it('the dry plan: R1 request, pinned references, reservations and honest admission; no key, no write', async () => {
    const { root, config } = await setup(), before = readdirSync(root);
    const plan = planChildAnchorProbe(config);
    expect(readdirSync(root)).toEqual(before);
    expect(plan.calls.map(c => c.step)).toEqual([...CHILD_ANCHOR_PROBE_STEPS]);
    expect(plan.anchor.prompt.startsWith(STYLE_REFERENCE_PREFIX)).toBe(true);
    expect(plan.admissionAtAssumedActuals.every(a => a.fits)).toBe(true);
    // At worst case the $0.60 control review leaves too little for the render: reported, never hidden by a raised cap.
    expect(plan.admissionIfEachSettlesAtItsReservation.find(a => a.step === 'reference_child')!.fits).toBe(false);
    expect(plan).toMatchObject({ providerCalls: 0, keyRead: false });
    expect(() => planChildAnchorProbe({ ...config, negativeControl: { ...config.negativeControl, sha256: 'e'.repeat(64) } })).toThrow('child_anchor_probe_control');
  });
  const adapters = (controlStyle: Record<string, unknown>, log: string[]) => (directory: string) => {
    const bytesOf = (img: { imageName: string }) => readFileSync(path.join(directory, img.imageName));
    const writeImage = async (name: string, bytes: Buffer) => { writeFileSync(path.join(directory, name), bytes, { flag: 'wx' }); return { imageName: name, imageSha: sha(bytes) }; };
    return { writeImage, bytesOf,
      render: vi.fn(async (step: string) => { log.push(step); return writeImage(`${step}.png`, await sharp({ create: { width: 64, height: 64, channels: 3, background: '#3a3' } }).png().toBuffer()); }),
      style: vi.fn(async (step: string, c: { imageSha: string }, contextSha: string, recipeSha: string) => { log.push(step);
        return { candidateSha: c.imageSha, contextSha, recipeSha, assessable: true, style01Match: true, looksPhotoreal: false, looksPortrait: false, notes: 'n',
          ...(step === 'control_style_qa' ? controlStyle : {}) }; }),
      design: vi.fn(async (step: string, c: { imageSha: string }, _ctx: unknown, contextSha: string, r: any) => { log.push(step);
        return { candidateSha: c.imageSha, contextSha, checks: QUALITY_CATEGORIES.map(category => ({ category, verdict: 'pass', observation: 'ok', correction: '' })),
          recipeSha: childAnchorRecipeSha(r), apparentAge: { requestedAge: r.requestedAge, verdict: 'compatible', observation: 'six', correction: '' } }; }) };
  };
  it.each([
    ['the control passes style: the criterion does not discriminate, stop before any render', {}, 'stopped_criterion_not_discriminating'],
    ['the control is not assessable: no signal, stop', { assessable: false }, 'stopped_control_not_assessable'],
  ])('%s', async (_n, controlStyle, status) => {
    const { config } = await setup(), log: string[] = [];
    const r = await runChildAnchorProbe({ config, signal: new AbortController().signal, log: () => {}, adapters: adapters(controlStyle, log) as never });
    expect(r.status).toBe(status); expect(log).toEqual(['control_style_qa']);
  });
  it('a rejected control continues: the R1 anchor, its style and its design + age reviews, in order, once each, then the owner page', async () => {
    const { config } = await setup(), log: string[] = [];
    const r = await runChildAnchorProbe({ config, signal: new AbortController().signal, log: () => {}, adapters: adapters({ style01Match: false }, log) as never });
    expect(r).toMatchObject({ status: 'complete', judgeOutcome: 'passed' });
    expect(log).toEqual([...CHILD_ANCHOR_PROBE_STEPS]);
    expect(existsSync(path.join(config.outputParent, 'child-anchor-probe-test-r1', 'probe.html'))).toBe(true);
    await expect(runChildAnchorProbe({ config, signal: new AbortController().signal, log: () => {}, adapters: adapters({ style01Match: false }, []) as never }))
      .rejects.toThrow('child_anchor_probe_used');
  });
});
