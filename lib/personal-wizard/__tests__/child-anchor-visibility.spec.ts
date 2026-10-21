import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { QUALITY_CATEGORIES } from '../../local-preview-quality';
import { STAGE0_ANCHOR_NEUTRAL_EXPRESSION } from '../../generation-pipeline/stage0-method-b';
import { CHILD_ANCHOR_TECHNIQUE_MANIFEST, CHILD_ANCHOR_REQUIRED_VISIBLE, CHILD_ANCHOR_MATERIALITY_VERSION, CHILD_ANCHOR_INSPECTION_VERSION,
  CHILD_ANCHOR_POSE_VERSION, CHILD_ANCHOR_POSE_CLAUSE, CHILD_ANCHOR_POSE_CLAUSE_SHA256, CHILD_ANCHOR_PRODUCTION_POSE_LINE, CHILD_ANCHOR_VISIBLE_PHRASES,
  CHILD_ANCHOR_VISIBILITY_RECOVERY_VERSION, CHILD_ANCHOR_VISIBILITY_RECOVERABLE, CHILD_ANCHOR_CORRECTION_INSTRUCTION, CHILD_ANCHOR_POSE_CORRECTION_INSTRUCTION,
  CHILD_ANCHOR_CORRECTION_ROLES, childAnchorDescriptionRequest, childAnchorPoseDescriptionRequest, childAnchorPoseCorrectionPrompt, childAnchorCorrectionPrompt,
  childAnchorInspectionView, childAnchorInspectionContext, childAnchorInspectionContextSha, childAnchorAttemptRecipe, childAnchorRecipeSha,
  childAnchorStyleDisposition, childAnchorInspectedDesignDisposition, childAnchorDisposition, childAnchorVisibilityRecovery, childAnchorVisibilityCorrection,
  childAnchorInspectedDesignPayload, childAnchorInspectedAdoptionRecord, assertChildAnchorInspectedAccepted, assertChildAnchorRenderPlan,
  CHILD_ANCHOR_POSE_V2, CHILD_ANCHOR_POSE_CLAUSE_V2, CHILD_ANCHOR_EYE_SCALE_CLAUSE, CHILD_ANCHOR_OCCLUSION_CONDITION, CHILD_ANCHOR_EXCLUDED_CONDITIONS_V2,
  CHILD_ANCHOR_VIEW_V2_INSTRUCTION, childAnchorInspectedDesignSchemaFor, childAnchorMaterialityDesignReviewSchema,
  childAnchorMaterialityDesignReviewSchemaV2 } from '../child-anchor-style';
import { reviewedBookLayoutSchema } from '../../../scripts/personal-simple-book-reviewed-audition';

const sha = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
const json = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
/** The fresh book's fictional child, verbatim: its frozen profile's design and its admitted storyboard's wardrobe. */
const DESIGN = 'A fictional 5-year-old boy invented for this experiment, not a real child. Light tan skin with a scatter of freckles across the nose, a round face, large dark-brown eyes and thick straight dark eyebrows. Straight black hair cut in a short bowl shape with a cowlick that sticks up at the crown. Round red-framed glasses. Proportions of a 5-year-old: head large relative to the body, short limbs, small hands.';
const WARDROBE = 'Light blue short-sleeved t-shirt; Khaki shorts with two big front patch pockets; White floppy sun hat; Brown strap sandals';
const child = { age: 5, gender: 'boy' as const, design: DESIGN, wardrobe: WARDROBE };
const request = childAnchorDescriptionRequest(child), pose = childAnchorPoseDescriptionRequest(child);
const technique = CHILD_ANCHOR_TECHNIQUE_MANIFEST.map(e => ({ role: e.label, sha256: e.sha256 }));
const recipe = childAnchorAttemptRecipe('reference_child', 'style', technique, request.prompt, 5), RSHA = childAnchorRecipeSha(recipe);
const context = childAnchorInspectionContext(child, request.prompt, CHILD_ANCHOR_MATERIALITY_VERSION), CTX = childAnchorInspectionContextSha(context);
const poseContext = childAnchorInspectionContext(child, pose.prompt, CHILD_ANCHOR_MATERIALITY_VERSION, CHILD_ANCHOR_POSE_VERSION), PCTX = childAnchorInspectionContextSha(poseContext);
const A = 'a'.repeat(64);
const IMAGES = Array(5).fill('data:image/png;base64,AA==');
/** The judge's own identity correction text: a recovery may never carry it. */
const JUDGE_IDENTITY_TEXT = 'JUDGE TEXT: pull both hands out of the pockets';

type Verdict = 'pass' | 'defect' | 'uncertain';
type Aspect = (typeof CHILD_ANCHOR_REQUIRED_VISIBLE)[number];
type Evidence = { verdict?: 'matched' | 'mismatch' | 'unreadable'; materiality?: string; deviation?: string };
/** A materiality design + age answer for this child, bound to `contextSha` (the held context by default). */
const answer = (over: { checks?: Partial<Record<(typeof QUALITY_CATEGORIES)[number], Verdict>>; evidence?: Partial<Record<Aspect, Evidence>>; character?: string;
  age?: 'compatible' | 'defect' | 'uncertain'; contextSha?: string; recipeSha?: string } = {}) => ({
  candidateSha: A, contextSha: over.contextSha ?? CTX, recipeSha: over.recipeSha ?? RSHA, acceptanceVersion: CHILD_ANCHOR_MATERIALITY_VERSION,
  checks: QUALITY_CATEGORIES.map(category => { const verdict = over.checks?.[category] ?? 'pass';
    return { category, verdict, observation: `${category} seen`, correction: verdict === 'defect' ? `fix the ${category}` : category === 'identity' && verdict === 'uncertain' ? JUDGE_IDENTITY_TEXT : '' }; }),
  apparentAge: { requestedAge: 5, verdict: over.age ?? 'compatible', observation: 'reads five', correction: over.age === 'defect' ? 'a slightly younger build' : '' },
  visibleEvidence: CHILD_ANCHOR_REQUIRED_VISIBLE.map(aspect => { const e = over.evidence?.[aspect], verdict = e?.verdict ?? 'matched';
    return { aspect, verdict, observation: `${aspect} seen`, materiality: e?.materiality ?? (verdict === 'mismatch' ? 'cosmetic' : 'not_applicable'),
      deviation: e?.deviation ?? (verdict === 'mismatch' && e?.materiality !== 'uncertain' ? 'drawn a little differently from the written design' : '') }; }),
  unobservedConditional: [], recognizableCharacter: { verdict: over.character ?? 'same_character', observation: 'the same written boy' } });
const HANDS: Partial<Record<Aspect, Evidence>> = { hands: { verdict: 'unreadable' } };
/** The held shape: the hands unreadable, identity therefore uncertain, every visible difference cosmetic, the same character. */
const heldAnswer = (over: Parameters<typeof answer>[0] = {}) => answer({ ...over, checks: { identity: 'uncertain', ...over.checks }, evidence: { ...HANDS, ...over.evidence } });
const styleAnswer = (over: Record<string, unknown> = {}) => ({ candidateSha: A, contextSha: CTX, recipeSha: RSHA, assessable: true, style01Match: true,
  looksPhotoreal: false, looksPortrait: false, notes: 'watercolor', ...over });
const style = (over: Record<string, unknown> = {}) => childAnchorStyleDisposition(styleAnswer(over), A, CTX, RSHA);
const design = (v: unknown) => childAnchorInspectedDesignDisposition(v, A, context, recipe);
const STYLE_TAIL = 'Refined semi-naturalistic Style 01 watercolor, natural eye scale, no mascot, chibi, flat-cartoon or photographic treatment.';

describe('child-anchor-visible-pose/v1: one pose source for the request, the correction and the inspection view', () => {
  it('absent: production\'s request, view, context and recipe are byte-identical (the held child\'s own prompt, recipe and context digests)', () => {
    expect(sha(request.prompt)).toBe('5125fcd48bbd6655bca37b1f7c64b65e98765f0aaf319801f5e6766930260b68');
    expect(RSHA).toBe('136220810ed689b55a17615320de92203184334d471e8237715f2dbd2d25028b');
    expect(CTX).toBe('542a4c4a23d1ece4303541fcd489264ded4f17d4650c1613f053b0de04e4eb55');
    expect('poseContract' in context.view).toBe(false);
    expect(request.prompt.split(CHILD_ANCHOR_PRODUCTION_POSE_LINE)).toHaveLength(2);
    expect(childAnchorInspectionView(request.prompt)).toEqual(context.view);
  });
  it('under the contract: production\'s pose line is replaced once by the clause built from the required-visible list; nothing else changes', () => {
    expect([pose.prompt.split(CHILD_ANCHOR_POSE_CLAUSE).length, pose.prompt.includes(CHILD_ANCHOR_PRODUCTION_POSE_LINE), pose.pose]).toEqual([2, false, CHILD_ANCHOR_POSE_VERSION]);
    expect(pose.prompt.replace(CHILD_ANCHOR_POSE_CLAUSE, CHILD_ANCHOR_PRODUCTION_POSE_LINE)).toBe(request.prompt);
    expect(pose.core.replace(CHILD_ANCHOR_POSE_CLAUSE, CHILD_ANCHOR_PRODUCTION_POSE_LINE)).toBe(request.core);
    expect([pose.identitySource, pose.referenceMode]).toEqual([request.identitySource, request.referenceMode]);
    // One phrase per required aspect, in the view's own order: the render and the judge read the same definition.
    expect(CHILD_ANCHOR_POSE_CLAUSE.split('Visible in the picture: ')[1].replace(/\.$/, '').split('; ')).toEqual(CHILD_ANCHOR_REQUIRED_VISIBLE.map(a => CHILD_ANCHOR_VISIBLE_PHRASES[a]));
    expect(Object.keys(CHILD_ANCHOR_VISIBLE_PHRASES).sort()).toEqual([...CHILD_ANCHOR_REQUIRED_VISIBLE].sort());
    expect([CHILD_ANCHOR_VISIBLE_PHRASES.hands, CHILD_ANCHOR_POSE_CLAUSE]).toEqual([expect.stringContaining('outside any pocket'), expect.stringContaining('the FULL body inside the frame')]);
    expect(CHILD_ANCHOR_POSE_CLAUSE).not.toMatch(/half/i);
    expect(pose.prompt.split(STAGE0_ANCHOR_NEUTRAL_EXPRESSION)).toHaveLength(2);
    // A second production pose line, or the clause already present (a drifted text or a design quoting either), refuses as the view would.
    for (const quoted of [CHILD_ANCHOR_PRODUCTION_POSE_LINE, CHILD_ANCHOR_POSE_CLAUSE])
      expect(() => childAnchorPoseDescriptionRequest({ ...child, design: `${DESIGN} ${quoted}` }), quoted).toThrow('child_anchor_production_prompt');
  });
  it('the view binds the pose clause its prompt carries; a request and a view that disagree refuse; the pose context is its own digest', () => {
    expect(poseContext.view.poseContract).toEqual({ version: CHILD_ANCHOR_POSE_VERSION, clause: CHILD_ANCHOR_POSE_CLAUSE, clauseSha256: CHILD_ANCHOR_POSE_CLAUSE_SHA256 });
    expect(CHILD_ANCHOR_POSE_CLAUSE_SHA256).toBe(sha(CHILD_ANCHOR_POSE_CLAUSE));
    expect(PCTX).toBe('f40bc1a50764ee58ba83323f884cb85716955d40c1054d5e5492a1c271c2b88c');
    const { poseContract: _p, ...view } = poseContext.view;
    expect({ ...poseContext, view }).toEqual(context);
    expect(() => childAnchorInspectionView(pose.prompt)).toThrow('child_anchor_inspection_view');
    expect(() => childAnchorInspectionView(request.prompt, CHILD_ANCHOR_POSE_VERSION)).toThrow('child_anchor_inspection_view');
    expect(() => childAnchorInspectionView(`${pose.prompt}\n${CHILD_ANCHOR_POSE_CLAUSE}`, CHILD_ANCHOR_POSE_VERSION)).toThrow('child_anchor_inspection_view');
    expect(() => childAnchorInspectionView(`${pose.prompt}\n${CHILD_ANCHOR_PRODUCTION_POSE_LINE}`, CHILD_ANCHOR_POSE_VERSION)).toThrow('child_anchor_inspection_view');
    expect(() => childAnchorInspectionView(pose.prompt, 'child-anchor-visible-pose/v2' as never)).toThrow('child_anchor_inspection_view');
    expect(() => childAnchorInspectionContext(child, pose.prompt, CHILD_ANCHOR_MATERIALITY_VERSION)).toThrow('child_anchor_inspection_view');
    // The judge reads the clause in its context; its instruction is the materiality one, unchanged.
    const p = childAnchorInspectedDesignPayload({ candidateSha: A, context: poseContext, recipe, imageURLs: IMAGES });
    const text = JSON.parse((p.input[0].content[0] as { text: string }).text);
    expect([text.contextSha, text.context.view.poseContract.clause]).toEqual([PCTX, CHILD_ANCHOR_POSE_CLAUSE]);
    expect(p.instructions).toBe(childAnchorInspectedDesignPayload({ candidateSha: A, context, recipe, imageURLs: IMAGES }).instructions);
  });
  it('the pose correction: only on a pose core, with the pose-aware instruction; the existing correction is unchanged; it plans as ONE rejected edit target', () => {
    const c = childAnchorPoseCorrectionPrompt(pose.core, ['scene: relax the mouth']);
    expect(c.startsWith(`${pose.core}\n\n${CHILD_ANCHOR_POSE_CORRECTION_INSTRUCTION}\nTARGETED CORRECTIONS:\nscene: relax the mouth\n\n[AVOID]\n`)).toBe(true);
    for (const [core, corrections] of [[request.core, ['x']], [pose.core, []], [pose.core, [' ']], [`${pose.core}\n\n${CHILD_ANCHOR_POSE_CLAUSE}`, ['x']]] as const)
      expect(() => childAnchorPoseCorrectionPrompt(core, corrections)).toThrow('child_anchor_correction_scope');
    expect(childAnchorCorrectionPrompt(request.core, ['x']).startsWith(`${request.core}\n\n${CHILD_ANCHOR_CORRECTION_INSTRUCTION}\nTARGETED CORRECTIONS:\nx`)).toBe(true);
    expect(CHILD_ANCHOR_POSE_CORRECTION_INSTRUCTION).toContain('keep the pose except where a named correction changes it');
    expect(assertChildAnchorRenderPlan(c, 1, 'book_design', CHILD_ANCHOR_CORRECTION_ROLES)).toMatchObject({ apiMode: 'images.edit', referenceCountPassed: 1,
      referenceRoles: ['rejected_edit_target'], bodyWithoutBinaryImage: { model: 'gpt-image-2', quality: 'low', size: '1024x1024' } });
  });
  it('the reviewed-book layout opts in only beside a child acceptance contract', () => {
    const layout = { version: 'reviewed-book-layout/v1', seed: 'fresh-book-seed', childDesign: DESIGN, storyboardDir: 'storyboard-presence', childDir: 'child-recovery',
      childImage: 'reference_child_repair.png', savedCompanion: null, childAnchor: CHILD_ANCHOR_MATERIALITY_VERSION };
    expect(reviewedBookLayoutSchema.parse({ ...layout, childAnchorPose: CHILD_ANCHOR_POSE_VERSION }).childAnchorPose).toBe(CHILD_ANCHOR_POSE_VERSION);
    expect(reviewedBookLayoutSchema.parse(layout)).toEqual(layout);
    const { childAnchor: _c, ...legacy } = layout;
    expect(() => reviewedBookLayoutSchema.parse({ ...legacy, childAnchorPose: CHILD_ANCHOR_POSE_VERSION })).toThrow();
    // v2 is a known opt-in version (child-anchor-visible-pose/v2); an unknown version refuses.
    expect(reviewedBookLayoutSchema.parse({ ...layout, childAnchorPose: CHILD_ANCHOR_POSE_V2 }).childAnchorPose).toBe(CHILD_ANCHOR_POSE_V2);
    expect(() => reviewedBookLayoutSchema.parse({ ...layout, childAnchorPose: 'child-anchor-visible-pose/v3' })).toThrow();
    expect(() => reviewedBookLayoutSchema.parse({ ...legacy, childAnchorPose: CHILD_ANCHOR_POSE_V2 })).toThrow();
    // v2 only beside the materiality acceptance (its occlusion record rests on the typed character judgment); v1 beside either.
    expect(() => reviewedBookLayoutSchema.parse({ ...layout, childAnchor: CHILD_ANCHOR_INSPECTION_VERSION, childAnchorPose: CHILD_ANCHOR_POSE_V2 })).toThrow();
    expect(reviewedBookLayoutSchema.parse({ ...layout, childAnchor: CHILD_ANCHOR_INSPECTION_VERSION, childAnchorPose: CHILD_ANCHOR_POSE_VERSION }).childAnchorPose)
      .toBe(CHILD_ANCHOR_POSE_VERSION);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// child-anchor-visible-pose/v2: the covered-by-declared-wardrobe condition and the eye-scale precedence clause, opt-in, materiality only.
// ---------------------------------------------------------------------------------------------------------------
const pose2 = childAnchorPoseDescriptionRequest(child, CHILD_ANCHOR_POSE_V2);
const context2 = childAnchorInspectionContext(child, pose2.prompt, CHILD_ANCHOR_MATERIALITY_VERSION, CHILD_ANCHOR_POSE_V2), CTX2 = childAnchorInspectionContextSha(context2);
const recipe2 = childAnchorAttemptRecipe('reference_child', 'style', technique, pose2.prompt, 5), RSHA2 = childAnchorRecipeSha(recipe2);
/** A v2 materiality answer (its unobserved entries carry coveredBy), bound to the v2 context and recipe. */
const answer2 = (over: Parameters<typeof answer>[0] & { unobserved?: { trait: string; condition: string; coveredBy: string }[] } = {}) => {
  const { unobserved, ...rest } = over;
  return { ...answer({ contextSha: CTX2, recipeSha: RSHA2, ...rest }),
    unobservedConditional: (unobserved ?? []).map(u => ({ ...u, observation: `${u.trait} not seen: ${u.coveredBy || 'smile'}` })) };
};
const design2 = (v: unknown) => childAnchorInspectedDesignDisposition(v, A, context2, recipe2);
const COWLICK = 'a cowlick that sticks up at the crown', HAT = 'White floppy sun hat';

describe('child-anchor-visible-pose/v2: covered-by-declared-wardrobe and the eye-scale precedence clause (opt-in)', () => {
  it('absent and v1 stay byte-identical (the same prompt, recipe, context and correction digests as before v2)', () => {
    expect([sha(request.prompt), RSHA, CTX, PCTX]).toEqual(['5125fcd48bbd6655bca37b1f7c64b65e98765f0aaf319801f5e6766930260b68',
      '136220810ed689b55a17615320de92203184334d471e8237715f2dbd2d25028b', '542a4c4a23d1ece4303541fcd489264ded4f17d4650c1613f053b0de04e4eb55',
      'f40bc1a50764ee58ba83323f884cb85716955d40c1054d5e5492a1c271c2b88c']);
    expect(childAnchorPoseDescriptionRequest(child, CHILD_ANCHOR_POSE_VERSION)).toEqual(pose);
    expect([context.view.excludedConditions, poseContext.view.excludedConditions]).toEqual([['open_mouth_or_smile'], ['open_mouth_or_smile']]);
    expect([request.prompt, pose.prompt].some(p => p.includes(CHILD_ANCHOR_EYE_SCALE_CLAUSE) || p.includes(CHILD_ANCHOR_POSE_CLAUSE_V2))).toBe(false);
    // The payload of a non-v2 context keeps its instruction, schema and format name (no v2 rule, no coveredBy).
    const p1 = childAnchorInspectedDesignPayload({ candidateSha: A, context: poseContext, recipe, imageURLs: IMAGES });
    expect([p1.instructions.includes(CHILD_ANCHOR_VIEW_V2_INSTRUCTION), (p1.text as any).format.name]).toEqual([false, 'child_anchor_design_materiality_v1']);
    expect(childAnchorInspectedDesignSchemaFor(poseContext)).toBe(childAnchorMaterialityDesignReviewSchema);
  });
  it('the v2 request: v1\'s pose line replacement with the v2 clause, and ONE eye-scale clause right after the child\'s visual lock; nothing else changes', () => {
    expect(pose2.pose).toBe(CHILD_ANCHOR_POSE_V2);
    expect([pose2.prompt.split(CHILD_ANCHOR_POSE_CLAUSE_V2).length, pose2.prompt.split(CHILD_ANCHOR_EYE_SCALE_CLAUSE).length,
      pose2.prompt.includes(CHILD_ANCHOR_POSE_CLAUSE), pose2.prompt.includes(CHILD_ANCHOR_PRODUCTION_POSE_LINE)]).toEqual([2, 2, false, false]);
    const blocks = pose2.core.split('\n\n'), lock = blocks.findIndex(b => b.startsWith('CHILD VISUAL LOCK: '));
    expect([blocks[lock].includes(DESIGN), blocks[lock + 1]]).toEqual([true, CHILD_ANCHOR_EYE_SCALE_CLAUSE]);
    // Removing the eye-scale block and restoring the pose line gives production's request byte for byte.
    expect(pose2.core.replace(`\n\n${CHILD_ANCHOR_EYE_SCALE_CLAUSE}`, '').replace(CHILD_ANCHOR_POSE_CLAUSE_V2, CHILD_ANCHOR_PRODUCTION_POSE_LINE)).toBe(request.core);
    expect(pose2.prompt.replace(`\n\n${CHILD_ANCHOR_EYE_SCALE_CLAUSE}`, '').replace(CHILD_ANCHOR_POSE_CLAUSE_V2, CHILD_ANCHOR_PRODUCTION_POSE_LINE)).toBe(request.prompt);
    expect(CHILD_ANCHOR_POSE_CLAUSE_V2).toBe(CHILD_ANCHOR_POSE_CLAUSE.replace(CHILD_ANCHOR_POSE_VERSION, CHILD_ANCHOR_POSE_V2));
    expect(CHILD_ANCHOR_EYE_SCALE_CLAUSE).toMatch(/natural eye scale governs the size of the eyes/);
    expect(CHILD_ANCHOR_EYE_SCALE_CLAUSE).toMatch(/colour and shape the design names stay exact/);
    // A design quoting any contract clause refuses, as does an unknown version.
    for (const quoted of [CHILD_ANCHOR_EYE_SCALE_CLAUSE, CHILD_ANCHOR_POSE_CLAUSE_V2, CHILD_ANCHOR_POSE_CLAUSE, CHILD_ANCHOR_PRODUCTION_POSE_LINE])
      expect(() => childAnchorPoseDescriptionRequest({ ...child, design: `${DESIGN} ${quoted}` }, CHILD_ANCHOR_POSE_V2), quoted.slice(0, 20)).toThrow('child_anchor_production_prompt');
    expect(() => childAnchorPoseDescriptionRequest(child, 'child-anchor-visible-pose/v3' as never)).toThrow('child_anchor_production_prompt');
    expect(assertChildAnchorRenderPlan(pose2.prompt, CHILD_ANCHOR_TECHNIQUE_MANIFEST.length, pose2.referenceMode)).toMatchObject({ bodyWithoutBinaryImage: { model: 'gpt-image-2', quality: 'low' } });
  });
  it('the v2 view binds both clauses and v2\'s excluded conditions; only under materiality; requests and views that disagree refuse', () => {
    expect(context2.view.poseContract).toEqual({ version: CHILD_ANCHOR_POSE_V2, clause: CHILD_ANCHOR_POSE_CLAUSE_V2, clauseSha256: sha(CHILD_ANCHOR_POSE_CLAUSE_V2),
      eyeScaleClause: CHILD_ANCHOR_EYE_SCALE_CLAUSE, eyeScaleClauseSha256: sha(CHILD_ANCHOR_EYE_SCALE_CLAUSE) });
    expect(context2.view.excludedConditions).toEqual(['open_mouth_or_smile', CHILD_ANCHOR_OCCLUSION_CONDITION]);
    expect([...CHILD_ANCHOR_EXCLUDED_CONDITIONS_V2]).toEqual(['open_mouth_or_smile', 'covered_by_declared_wardrobe']);
    expect(new Set([CTX, PCTX, CTX2]).size).toBe(3);
    // Materiality only.
    expect(() => childAnchorInspectionContext(child, pose2.prompt, CHILD_ANCHOR_INSPECTION_VERSION, CHILD_ANCHOR_POSE_V2)).toThrow('child_anchor_inspection_view');
    expect(() => childAnchorInspectionContext(child, pose2.prompt)).toThrow('child_anchor_inspection_view');
    // A v2 prompt under another view, a v1 prompt under v2, a doubled or missing clause: refused.
    expect(() => childAnchorInspectionView(pose2.prompt)).toThrow('child_anchor_inspection_view');
    expect(() => childAnchorInspectionView(pose2.prompt, CHILD_ANCHOR_POSE_VERSION)).toThrow('child_anchor_inspection_view');
    expect(() => childAnchorInspectionView(pose.prompt, CHILD_ANCHOR_POSE_V2)).toThrow('child_anchor_inspection_view');
    expect(() => childAnchorInspectionView(`${pose2.prompt}\n${CHILD_ANCHOR_EYE_SCALE_CLAUSE}`, CHILD_ANCHOR_POSE_V2)).toThrow('child_anchor_inspection_view');
    expect(() => childAnchorInspectionView(pose2.prompt.replace(CHILD_ANCHOR_EYE_SCALE_CLAUSE, ''), CHILD_ANCHOR_POSE_V2)).toThrow('child_anchor_inspection_view');
    expect(() => childAnchorInspectionView(`${pose2.prompt}\n${CHILD_ANCHOR_POSE_CLAUSE}`, CHILD_ANCHOR_POSE_V2)).toThrow('child_anchor_inspection_view');
    expect(() => childAnchorInspectionView(`${pose.prompt}\n${CHILD_ANCHOR_EYE_SCALE_CLAUSE}`, CHILD_ANCHOR_POSE_VERSION)).toThrow('child_anchor_inspection_view');
    // A context whose view carries the occlusion condition without v2, or v2 without it, is not a valid context.
    expect(() => childAnchorInspectionContextSha({ ...poseContext, view: { ...poseContext.view, excludedConditions: [...CHILD_ANCHOR_EXCLUDED_CONDITIONS_V2] } } as never)).toThrow();
    expect(() => childAnchorInspectionContextSha({ ...context2, view: { ...context2.view, excludedConditions: ['open_mouth_or_smile'] } } as never)).toThrow();
  });
  it('the v2 payload: the materiality instruction plus the v2 view rules, the v2 schema and format name; the view reaches the judge in its context', () => {
    const p = childAnchorInspectedDesignPayload({ candidateSha: A, context: context2, recipe: recipe2, imageURLs: IMAGES });
    const base = childAnchorInspectedDesignPayload({ candidateSha: A, context: poseContext, recipe, imageURLs: IMAGES });
    expect(p.instructions).toBe(`${base.instructions}\n${CHILD_ANCHOR_VIEW_V2_INSTRUCTION}`);
    expect((p.text as any).format.name).toBe('child_anchor_design_materiality_pose_v2');
    const text = JSON.parse((p.input[0].content[0] as { text: string }).text);
    expect([text.contextSha, text.recipeSha, text.context.view.poseContract.eyeScaleClause]).toEqual([CTX2, RSHA2, CHILD_ANCHOR_EYE_SCALE_CLAUSE]);
    expect(childAnchorInspectedDesignSchemaFor(context2)).toBe(childAnchorMaterialityDesignReviewSchemaV2);
    expect(CHILD_ANCHOR_VIEW_V2_INSTRUCTION).toContain(`condition ${CHILD_ANCHOR_OCCLUSION_CONDITION}`);
    expect(CHILD_ANCHOR_VIEW_V2_INSTRUCTION).toContain('A required aspect that is not visible at all stays unreadable');
  });
  it('a crown trait under the declared hat is recorded unobserved (verbatim trait and item), never a defect: the visible hair matched passes', () => {
    const d = design2(answer2({ unobserved: [{ trait: COWLICK, condition: CHILD_ANCHOR_OCCLUSION_CONDITION, coveredBy: HAT }] }));
    expect([d.design, d.unobservedConditional]).toEqual(['passed', [{ trait: COWLICK, condition: CHILD_ANCHOR_OCCLUSION_CONDITION, coveredBy: HAT,
      observation: `${COWLICK} not seen: ${HAT}` }]]);
    expect(childAnchorDisposition(childAnchorStyleDisposition(styleAnswer({ contextSha: CTX2, recipeSha: RSHA2 }), A, CTX2, RSHA2), d).disposition).toBe('passed');
    // Case and spacing of the quoted item follow the wardrobe's own text loosely (normalized), as the trait does.
    expect(design2(answer2({ unobserved: [{ trait: COWLICK, condition: CHILD_ANCHOR_OCCLUSION_CONDITION, coveredBy: 'white  floppy sun hat' }] })).design).toBe('passed');
    // The smile condition still works under v2, with an empty coveredBy.
    expect(design2(answer2({ unobserved: [{ trait: 'large dark-brown eyes', condition: 'open_mouth_or_smile', coveredBy: '' }] })).design).toBe('passed');
    // The hidden aspect itself stays required: a crown under the hat does not excuse unreadable hair.
    const hidden = design2(answer2({ checks: { identity: 'uncertain' }, evidence: { hair: { verdict: 'unreadable' } },
      unobserved: [{ trait: COWLICK, condition: CHILD_ANCHOR_OCCLUSION_CONDITION, coveredBy: HAT }] }));
    expect(hidden.design).toBe('held_uncertain');
  });
  it('an occlusion record that is not a verbatim declared item, names no item, is a sentence, or rides another condition refuses; v1 views never accept it', () => {
    const bad: [string, { trait: string; condition: string; coveredBy: string }][] = [
      ['an item not in the wardrobe', { trait: COWLICK, condition: CHILD_ANCHOR_OCCLUSION_CONDITION, coveredBy: 'a red baseball cap' }],
      ['no item', { trait: COWLICK, condition: CHILD_ANCHOR_OCCLUSION_CONDITION, coveredBy: ' ' }],
      ['a sentence', { trait: COWLICK, condition: CHILD_ANCHOR_OCCLUSION_CONDITION, coveredBy: 'White floppy sun hat. Brown strap sandals' }],
      ['an item on the smile condition', { trait: COWLICK, condition: 'open_mouth_or_smile', coveredBy: HAT }],
      ['a trait not in the design', { trait: 'a scar above the left eyebrow', condition: CHILD_ANCHOR_OCCLUSION_CONDITION, coveredBy: HAT }],
      ['an unknown condition', { trait: COWLICK, condition: 'behind_an_object', coveredBy: HAT }],
    ];
    for (const [name, u] of bad) expect(() => design2(answer2({ unobserved: [u] })), name).toThrow();
    // Under the v1 pose context the occlusion condition does not exist (the v1 schema has no coveredBy and v1's conditions only).
    const v1Answer = { ...answer({ contextSha: PCTX }), unobservedConditional: [{ trait: COWLICK, condition: CHILD_ANCHOR_OCCLUSION_CONDITION, observation: 'under the hat' }] };
    expect(() => childAnchorInspectedDesignDisposition(v1Answer, A, poseContext, recipe)).toThrow();
    // A v2 answer is bound to the v2 context: the v1 pose context's digest never judges it, nor the reverse.
    expect(() => childAnchorInspectedDesignDisposition(answer2(), A, poseContext, recipe)).toThrow();
    expect(() => design2(answer({ contextSha: PCTX, recipeSha: RSHA2 }))).toThrow();
    expect(design2(answer({ contextSha: CTX2, recipeSha: RSHA2 })).design).toBe('passed');
  });
  it('the general child stage under v2: the typed visibility recovery and the pose-aware correction work on the v2 core; the v2 context binds the repair', () => {
    const s = childAnchorStyleDisposition(styleAnswer({ contextSha: CTX2, recipeSha: RSHA2 }), A, CTX2, RSHA2);
    const d = design2(answer2({ checks: { identity: 'uncertain' }, evidence: HANDS }));
    const r = childAnchorVisibilityRecovery(s, d, CHILD_ANCHOR_POSE_V2)!;
    expect([r.pose, r.aspects, r.corrections]).toEqual([CHILD_ANCHOR_POSE_V2, ['hands'], [childAnchorVisibilityCorrection('hands')]]);
    // The same answers under the default (the child recovery's v1) name v1: the pose is the correction's contract, the derivation is the same.
    expect(childAnchorVisibilityRecovery(s, d)).toEqual({ ...r, pose: CHILD_ANCHOR_POSE_VERSION });
    expect(() => childAnchorVisibilityRecovery(s, d, 'child-anchor-visible-pose/v3' as never)).toThrow('child_anchor_correction_scope');
    const c = childAnchorPoseCorrectionPrompt(pose2.core, r.corrections);
    expect(c.startsWith(`${pose2.core}\n\n${CHILD_ANCHOR_POSE_CORRECTION_INSTRUCTION}\nTARGETED CORRECTIONS:\n${childAnchorVisibilityCorrection('hands')}\n\n[AVOID]\n`)).toBe(true);
    expect([c.split(CHILD_ANCHOR_EYE_SCALE_CLAUSE).length, c.split(CHILD_ANCHOR_POSE_CLAUSE_V2).length]).toEqual([2, 2]);
    // A core carrying both pose clauses is out of scope.
    expect(() => childAnchorPoseCorrectionPrompt(`${pose2.core}\n\n${CHILD_ANCHOR_POSE_CLAUSE}`, ['x'])).toThrow('child_anchor_correction_scope');
    expect(assertChildAnchorRenderPlan(c, 1, 'book_design', CHILD_ANCHOR_CORRECTION_ROLES)).toMatchObject({ apiMode: 'images.edit', referenceRoles: ['rejected_edit_target'] });
    // The corrected candidate is judged under the SAME v2 context: a pass admits, its record binds that context only.
    const repair = childAnchorAttemptRecipe('reference_child_repair', 'book_design', [{ role: 'rejected_edit_target', sha256: 'b'.repeat(64) }], c, 5);
    const repairSha = childAnchorRecipeSha(repair);
    const posedStyle = childAnchorStyleDisposition(styleAnswer({ contextSha: CTX2, recipeSha: repairSha }), A, CTX2, repairSha);
    const ok = childAnchorInspectedAdoptionRecord(context2, repair, posedStyle.review, answer2({ recipeSha: repairSha,
      unobserved: [{ trait: COWLICK, condition: CHILD_ANCHOR_OCCLUSION_CONDITION, coveredBy: HAT }] }));
    expect(assertChildAnchorInspectedAccepted(ok, A, context2).acceptedDeviations).toEqual([]);
    expect(() => assertChildAnchorInspectedAccepted(ok, A, poseContext)).toThrow('child_anchor_evidence_binding');
  });
});

describe('child-anchor-visibility-recovery/v1: a typed, visibility-only recovery into the one correction', () => {
  it('the actual held shape (both hands in the pockets, a slight smile, a style defect, cosmetic eyebrows and hair): the unchanged disposition holds; the recovery repairs with the known corrections and the engine\'s visibility text', () => {
    const s = style({ style01Match: false, notes: 'oversized eyes.' });
    const d = design(heldAnswer({ checks: { scene: 'defect' }, evidence: { face: { verdict: 'mismatch' }, hair: { verdict: 'mismatch' } } }));
    expect([s.disposition, d.design]).toEqual(['defect', 'held_uncertain']);
    expect(childAnchorDisposition(s, d)).toEqual({ disposition: 'held_uncertain', corrections: [] });
    const r = childAnchorVisibilityRecovery(s, d);
    expect(r).toEqual({ version: CHILD_ANCHOR_VISIBILITY_RECOVERY_VERSION, pose: CHILD_ANCHOR_POSE_VERSION, aspects: ['hands'],
      corrections: ['scene: fix the scene', `style: oversized eyes. ${STYLE_TAIL}`, childAnchorVisibilityCorrection('hands')] });
    expect(childAnchorVisibilityCorrection('hands')).toBe(`visibility (hands): show ${CHILD_ANCHOR_VISIBLE_PHRASES.hands}, as the ANCHOR POSE clause requires; change the pose only as far as that needs.`);
    expect(r!.corrections.join('\n')).not.toContain(JUDGE_IDENTITY_TEXT);
    // Pure: the same answers give the same recovery.
    expect(childAnchorVisibilityRecovery(s, d)).toEqual(r);
  });
  it('wardrobe and whole-body visibility recover too, each with its own engine text, in the view\'s order; an age defect joins as a known correction', () => {
    expect(childAnchorVisibilityRecovery(style(), design(heldAnswer()))!.corrections).toEqual([childAnchorVisibilityCorrection('hands')]);
    const all = childAnchorVisibilityRecovery(style(), design(heldAnswer({ evidence: { wardrobe: { verdict: 'unreadable' }, body_proportions: { verdict: 'unreadable' } } })))!;
    expect([all.aspects, all.corrections]).toEqual([['body_proportions', 'hands', 'wardrobe'],
      ['body_proportions', 'hands', 'wardrobe'].map(a => childAnchorVisibilityCorrection(a as never))]);
    expect(childAnchorVisibilityRecovery(style(), design(answer({ checks: { identity: 'uncertain' }, evidence: { wardrobe: { verdict: 'unreadable' } } })))!.aspects).toEqual(['wardrobe']);
    expect(childAnchorVisibilityRecovery(style(), design(heldAnswer({ age: 'defect' })))!.corrections).toEqual([
      'apparent_age (requested 5): a slightly younger build', childAnchorVisibilityCorrection('hands')]);
    expect([...CHILD_ANCHOR_VISIBILITY_RECOVERABLE]).toEqual(['hands', 'wardrobe', 'body_proportions']);
  });
  it('anything but a visibility-only hold stays held: missing evidence, unassessable style, uncertain age, identity-core unreadable, uncertain or material difference, another character, anatomy or safety findings, another uncertain category, nothing unreadable', () => {
    const cases: [string, ReturnType<typeof style> | null, ReturnType<typeof design> | null][] = [
      ['no style answer', null, design(heldAnswer())], ['no design answer (style unassessable)', style({ assessable: false }), null],
      ['style unassessable', style({ assessable: false }), design(heldAnswer())],
      ['age uncertain', style(), design(heldAnswer({ age: 'uncertain' }))],
      ...(['face', 'eyes', 'hair', 'skin_tone'] as const).map(aspect => [`${aspect} unreadable`, style(), design(heldAnswer({ evidence: { [aspect]: { verdict: 'unreadable' } } }))] as [string, ReturnType<typeof style>, ReturnType<typeof design>]),
      ['uncertain materiality', style(), design(heldAnswer({ evidence: { hair: { verdict: 'mismatch', materiality: 'uncertain' } } }))],
      ['a material difference', style(), design(heldAnswer({ checks: { identity: 'defect' }, evidence: { hair: { verdict: 'mismatch', materiality: 'material' } } }))],
      ['character uncertain', style(), design(heldAnswer({ character: 'uncertain' }))],
      ['another character', style(), design(heldAnswer({ checks: { identity: 'defect' }, character: 'different_character' }))],
      ['anatomy defect', style(), design(heldAnswer({ checks: { anatomy: 'defect' } }))], ['anatomy uncertain', style(), design(heldAnswer({ checks: { anatomy: 'uncertain' } }))],
      ['safety defect', style(), design(heldAnswer({ checks: { safety: 'defect' } }))], ['safety uncertain', style(), design(heldAnswer({ checks: { safety: 'uncertain' } }))],
      ['framing uncertain', style(), design(heldAnswer({ checks: { framing: 'uncertain' } }))],
      ['identity uncertain with nothing unreadable', style(), design(answer({ checks: { identity: 'uncertain' } }))],
      ['a passed anchor', style(), design(answer())], ['a known-defect repair', style(), design(answer({ checks: { scene: 'defect' } }))],
    ];
    for (const [name, s, d] of cases) expect(childAnchorVisibilityRecovery(s, d), name).toBeNull();
    // The inspection/v1 contract (no materiality, no character) has no recovery.
    const v1 = childAnchorInspectionContext(child, request.prompt), v1Sha = childAnchorInspectionContextSha(v1);
    const inspected = { candidateSha: A, contextSha: v1Sha, recipeSha: RSHA, inspectionVersion: CHILD_ANCHOR_INSPECTION_VERSION,
      checks: QUALITY_CATEGORIES.map(category => ({ category, verdict: category === 'identity' ? 'uncertain' : 'pass', observation: 'seen', correction: '' })),
      apparentAge: { requestedAge: 5, verdict: 'compatible', observation: 'five', correction: '' },
      visibleEvidence: CHILD_ANCHOR_REQUIRED_VISIBLE.map(aspect => ({ aspect, verdict: aspect === 'hands' ? 'unreadable' : 'matched', observation: 'seen' })), unobservedConditional: [] };
    const d1 = childAnchorInspectedDesignDisposition(inspected, A, v1, recipe);
    expect([d1.design, childAnchorVisibilityRecovery(childAnchorStyleDisposition(styleAnswer({ contextSha: v1Sha }), A, v1Sha, RSHA), d1)]).toEqual(['held_uncertain', null]);
  });
  it('the corrected candidate is judged by the unchanged disposition under the pose context: still hidden holds, a pass admits only under THAT context', () => {
    const repair = childAnchorAttemptRecipe('reference_child_repair', 'book_design', [{ role: 'rejected_edit_target', sha256: 'b'.repeat(64) }],
      childAnchorPoseCorrectionPrompt(pose.core, [childAnchorVisibilityCorrection('hands')]), 5), repairSha = childAnchorRecipeSha(repair);
    const posed = (over: Parameters<typeof answer>[0] = {}) => answer({ ...over, contextSha: PCTX, recipeSha: repairSha });
    const posedStyle = childAnchorStyleDisposition(styleAnswer({ contextSha: PCTX, recipeSha: repairSha }), A, PCTX, repairSha);
    const stillHidden = childAnchorInspectedDesignDisposition(posed({ checks: { identity: 'uncertain' }, evidence: HANDS }), A, poseContext, repair);
    expect(childAnchorDisposition(posedStyle, stillHidden).disposition).toBe('held_uncertain');
    const heldRecord = childAnchorInspectedAdoptionRecord(poseContext, repair, posedStyle.review, posed({ checks: { identity: 'uncertain' }, evidence: HANDS }));
    expect(() => assertChildAnchorInspectedAccepted(heldRecord, A, poseContext)).toThrow('child_anchor_not_accepted');
    const ok = childAnchorInspectedAdoptionRecord(poseContext, repair, posedStyle.review, posed({ evidence: { face: { verdict: 'mismatch' } } }));
    expect(assertChildAnchorInspectedAccepted(ok, A, poseContext).acceptedDeviations).toHaveLength(1);
    expect(() => assertChildAnchorInspectedAccepted(ok, A, context)).toThrow('child_anchor_evidence_binding');
    // An answer bound to the held (non-pose) context never judges the corrected candidate.
    expect(() => childAnchorInspectedDesignDisposition(answer({ recipeSha: repairSha }), A, poseContext, repair)).toThrow();
  });
});

const HELD = 'C:/GNart/Work/book-renders/fresh-book-usd7-20261018/child';
describe.skipIf(!existsSync(path.join(HELD, 'reference_child_design_review.json')))('the actual held child (read only)', () => {
  it('its saved answers re-judge to held_uncertain and recover to exactly the three corrections the recovery grant plans', () => {
    const styleRecord = json(path.join(HELD, 'reference_child_style_review.json')), designRecord = json(path.join(HELD, 'reference_child_design_review.json'));
    const candidate = '90331690f8bb9b7412d31bcf9a9a6cefa75c4995cb2f3286af99ee4f91c2da1d';
    expect([styleRecord.recipeSha, designRecord.recipeSha, designRecord.review.contextSha]).toEqual([RSHA, RSHA, CTX]);
    const s = childAnchorStyleDisposition(styleRecord.review, candidate, CTX, RSHA), d = childAnchorInspectedDesignDisposition(designRecord.review, candidate, context, recipe);
    expect([s.disposition, d.design, childAnchorDisposition(s, d).disposition]).toEqual(['defect', 'held_uncertain', 'held_uncertain']);
    const identity = designRecord.review.checks.find((c: { category: string }) => c.category === 'identity');
    const r = childAnchorVisibilityRecovery(s, d)!;
    expect(r.aspects).toEqual(['hands']);
    expect(r.corrections).toEqual([`scene: ${designRecord.review.checks.find((c: { category: string }) => c.category === 'scene').correction}`,
      `style: ${styleRecord.review.notes} ${STYLE_TAIL}`, childAnchorVisibilityCorrection('hands')]);
    expect(r.corrections.join('\n')).not.toContain(identity.correction);
    expect(sha(childAnchorPoseCorrectionPrompt(pose.core, r.corrections))).toBe('f456a11c5e3dc2a34e3acaf6deaa395ff3dc3a23215f522ea684357d85a53b90');
  });
});
