/** storyboard-bound-repair/v1: one focused repair of a held BOUND board, with the admitted child pinned. Synthetic structure only. */
import { describe, expect, it } from 'vitest';
import { QUALITY_CATEGORIES } from '../../local-preview-quality';
import { previewSha } from '../../local-story-preview';
import { CHILD_ANCHOR_TECHNIQUE_MANIFEST, CHILD_ANCHOR_MANIFEST_SHA256, CHILD_ANCHOR_STYLE_VERSION, CHILD_ANCHOR_INSPECTION_VERSION,
  CHILD_ANCHOR_REQUIRED_VISIBLE, childAnchorRecipeSchema, childAnchorDescriptionRequest, childAnchorInspectionContext, childAnchorInspectionContextSha,
  childAnchorRecipeSha, childAnchorInspectedAdoptionRecord } from '../child-anchor-style';
import { deriveExistingChildAppearance, existingChildAppearanceData } from '../existing-child-appearance';
import { prepareCurrentPersonalStoryboard, compilePersonalStoryboard, storyboardDraftSchema, storyboardInstructions } from '../storyboard';
import { STORYBOARD_BOUND_REPAIR_VERSION, REPAIR_STORYBOARD_ADDENDUM, assertStoryboardRepair } from '../storyboard-repair';
import { replanFixture } from './storyboard-replan-fixture';

const clothing = ['red shirt', 'blue shorts', 'teal shoes'];
function appearance(origin: { requestId: string; sourceDigest: string; storyboardDigest: string }) {
  const child = { age: 5, gender: 'girl' as const, design: 'An entirely fictional five-year-old girl with short curly dark hair, brown eyes and ordinary child proportions.',
    wardrobe: clothing.join('; ') };
  const request = childAnchorDescriptionRequest(child), context = childAnchorInspectionContext(child, request.prompt), contextSha = childAnchorInspectionContextSha(context);
  const candidateSha = previewSha('SYNTHETIC child bytes, not an image outcome');
  const recipe = childAnchorRecipeSchema.parse({ version: CHILD_ANCHOR_STYLE_VERSION, identitySource: 'description', manifestSha256: CHILD_ANCHOR_MANIFEST_SHA256,
    step: 'reference_child', referenceMode: 'style', references: CHILD_ANCHOR_TECHNIQUE_MANIFEST.map(e => ({ role: e.label, sha256: e.sha256 })),
    promptSha256: previewSha(request.prompt), requestedAge: 5 });
  const recipeSha = childAnchorRecipeSha(recipe);
  const style = { candidateSha, contextSha, recipeSha, assessable: true, style01Match: true, looksPhotoreal: false, looksPortrait: false, notes: 'Synthetic structural answer only' };
  const design = { candidateSha, contextSha, recipeSha, inspectionVersion: CHILD_ANCHOR_INSPECTION_VERSION,
    checks: QUALITY_CATEGORIES.map(category => ({ category, verdict: 'pass', observation: 'Synthetic structural answer only', correction: '' })),
    apparentAge: { requestedAge: 5, verdict: 'compatible', observation: 'Synthetic age answer', correction: '' },
    visibleEvidence: CHILD_ANCHOR_REQUIRED_VISIBLE.map(aspect => ({ aspect, verdict: 'matched', observation: 'Synthetic aspect' })), unobservedConditional: [] };
  const adoption = { name: 'child', context, candidate: { imageName: 'synthetic.png', imageSha: candidateSha }, anchor: childAnchorInspectedAdoptionRecord(context, recipe, style, design) };
  return deriveExistingChildAppearance({ ...origin, clothing }, { age: 5, gender: 'girl', design: child.design, acceptance: CHILD_ANCHOR_INSPECTION_VERSION }, adoption, candidateSha);
}
/** prepareCurrent...(request, writerResult, options, appearance=true, 16 contracts absent, existing appearance), optional repair. */
const prepare = (f: Awaited<ReturnType<typeof replanFixture>>, existing?: ReturnType<typeof appearance>, repair?: unknown) => {
  const rest: unknown[] = Array(17).fill(undefined); rest[5] = repair; rest[16] = existing;
  return prepareCurrentPersonalStoryboard(...([f.request, f.writerResult, f.options, true, ...rest] as unknown as Parameters<typeof prepareCurrentPersonalStoryboard>));
};
/** One book check contradicted: the bound review held the bound board. */
const held = (review: any) => { const r = structuredClone(review); r.bookChecks[1] = { ...r.bookChecks[1], verdict: 'contradiction', observation: 'bound observation' }; return r; };
async function setup() {
  const f = await replanFixture(), existing = appearance({ requestId: f.book.requestId, sourceDigest: f.book.sourceDigest, storyboardDigest: f.book.storyboardDigest });
  const bound = compilePersonalStoryboard(prepare(f, existing), f.draft);
  const boundReview = held({ ...structuredClone(f.review), sourceDigest: bound.sourceDigest, storyboardDigest: bound.storyboardDigest });
  const repair = { parentStoryboardDigest: bound.storyboardDigest, draft: structuredClone(f.draft), review: boundReview, binding: STORYBOARD_BOUND_REPAIR_VERSION };
  return { f, existing, bound, boundReview, repair };
}

describe('storyboard-bound-repair/v1 (one repair of a held bound board, the child pinned)', () => {
  it('shape: only the outermost repair carries the marker, never with a parent repair, added contracts, an extension or another value', () => {
    const base = { parentStoryboardDigest: 'a'.repeat(64), draft: {}, review: {} };
    expect(() => assertStoryboardRepair({ ...base, binding: STORYBOARD_BOUND_REPAIR_VERSION })).not.toThrow();
    expect(() => assertStoryboardRepair({ ...base, binding: 'storyboard-bound-repair/v2' })).toThrow('personal_storyboard_repair_policy');
    expect(() => assertStoryboardRepair({ ...base, binding: STORYBOARD_BOUND_REPAIR_VERSION, parentRepair: base })).toThrow('personal_storyboard_repair_policy');
    expect(() => assertStoryboardRepair({ ...base, binding: STORYBOARD_BOUND_REPAIR_VERSION, addedContracts: ['selfCheckContract'] })).toThrow('personal_storyboard_repair_policy');
    expect(() => assertStoryboardRepair({ ...base, binding: STORYBOARD_BOUND_REPAIR_VERSION,
      extension: { version: 'storyboard-attempt-extension/v1', maxAttempts: 4, approvalSha256: 'b'.repeat(64) } })).toThrow('personal_storyboard_repair_policy');
    expect(() => assertStoryboardRepair({ ...base, parentRepair: { ...base, binding: STORYBOARD_BOUND_REPAIR_VERSION } })).toThrow('personal_storyboard_repair_policy');
  });
  it('an existing appearance still refuses every ordinary repair; a bound repair needs that appearance', async () => {
    const s = await setup(), { binding: _binding, ...plain } = s.repair;
    expect(() => prepare(s.f, s.existing, plain)).toThrow('personal_storyboard_existing_child_appearance_scope');
    expect(() => prepare(s.f, undefined, s.repair)).toThrow('personal_storyboard_existing_child_appearance_scope');
  });
  it('binds the held bound board: its parent is the accepted draft recompiled WITH the same appearance, and the review must hold it', async () => {
    const s = await setup(), source = prepare(s.f, s.existing, s.repair);
    expect(source.repair).toMatchObject({ parentStoryboardDigest: s.bound.storyboardDigest, binding: STORYBOARD_BOUND_REPAIR_VERSION });
    expect(source.sourceDigest).not.toBe(prepare(s.f, s.existing).sourceDigest);
    // The unbound parent's digest is not this parent.
    expect(() => prepare(s.f, s.existing, { ...s.repair, parentStoryboardDigest: s.f.book.storyboardDigest })).toThrow('personal_storyboard_repair_binding');
    // A review that supports the bound board is not a repair target.
    expect(() => prepare(s.f, s.existing, { ...s.repair, review: { ...structuredClone(s.f.review), sourceDigest: s.bound.sourceDigest,
      storyboardDigest: s.bound.storyboardDigest } })).toThrow('personal_storyboard_repair_not_held');
    // Another appearance is another bound board.
    const other = appearance({ requestId: s.f.book.requestId, sourceDigest: s.f.book.sourceDigest, storyboardDigest: previewSha('another storyboard') });
    expect(() => prepare(s.f, other, s.repair)).toThrow('personal_storyboard_repair_binding');
  });
  it('the planner gets the repair addendum, the bound review findings and the existing appearance; the schema keeps the clothing pinned', async () => {
    const s = await setup(), source = prepare(s.f, s.existing, s.repair) as any;
    expect(storyboardInstructions(source).endsWith(`\n${REPAIR_STORYBOARD_ADDENDUM}`)).toBe(true);
    expect(source.planningInput.existingChildAppearance).toEqual(existingChildAppearanceData(s.existing));
    expect(source.planningInput.priorReviewedStoryboard.reviewFindings).toEqual([{ scope: 'book', category: s.boundReview.bookChecks[1].category,
      verdict: 'contradiction', observation: 'bound observation' }]);
    const schema: any = storyboardDraftSchema(source);
    expect(schema.shape.plan.shape.actorAppearance.shape.child.shape.clothing.element.options).toEqual(clothing);
  });
  it('a repaired draft compiles with the child unchanged; any other clothing is refused', async () => {
    const s = await setup(), source = prepare(s.f, s.existing, s.repair), repaired = structuredClone(s.f.draft) as any;
    repaired.plan.pages[3].composition = 'a repaired framing for the bound finding';
    const book = compilePersonalStoryboard(source, repaired);
    expect(book.existingChildAppearance).toEqual(existingChildAppearanceData(s.existing));
    expect(book.repair).toEqual({ version: 'storyboard-repair/v1', parentStoryboardDigest: s.bound.storyboardDigest });
    const changed = structuredClone(repaired); changed.plan.actorAppearance.child.clothing = ['green dress', 'blue shorts', 'teal shoes'];
    expect(() => compilePersonalStoryboard(source, changed)).toThrow();
  });
});
