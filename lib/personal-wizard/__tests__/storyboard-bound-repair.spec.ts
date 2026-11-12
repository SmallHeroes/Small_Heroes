/** storyboard-bound-repair/v1: one focused repair of a held BOUND board, with the admitted child pinned and a typed change scope. Synthetic only. */
import { describe, expect, it } from 'vitest';
import { QUALITY_CATEGORIES } from '../../local-preview-quality';
import { previewSha, previewStoryEvidence } from '../../local-story-preview';
import { CHILD_ANCHOR_TECHNIQUE_MANIFEST, CHILD_ANCHOR_MANIFEST_SHA256, CHILD_ANCHOR_STYLE_VERSION, CHILD_ANCHOR_INSPECTION_VERSION,
  CHILD_ANCHOR_REQUIRED_VISIBLE, childAnchorRecipeSchema, childAnchorDescriptionRequest, childAnchorInspectionContext, childAnchorInspectionContextSha,
  childAnchorRecipeSha, childAnchorInspectedAdoptionRecord } from '../child-anchor-style';
import { deriveExistingChildAppearance, existingChildAppearanceData } from '../existing-child-appearance';
import { prepareCurrentPersonalStoryboard, compilePersonalStoryboard, storyboardDraftSchema, storyboardInstructions } from '../storyboard';
import { STORYBOARD_BOUND_REPAIR_VERSION, REPAIR_STORYBOARD_ADDENDUM, BOUND_REPAIR_SCOPE_ADDENDUM, assertStoryboardRepair, boundRepairSections } from '../storyboard-repair';
import { STORYBOARD_MOMENTS_VERSION } from '../storyboard-moments';
import { fullSelfCheck } from './storyboard-self-check-fixture';
import { replanFixture } from './storyboard-replan-fixture';

const clothing = ['red shirt', 'blue shorts', 'teal shoes'];
const LATER = 'the ribbon stays with נועה';
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
type F = Awaited<ReturnType<typeof replanFixture>>;
/** prepareCurrent...(request, writerResult, options, appearance=true, moments, ..., repair, ..., selfCheck, typed review impact, ..., existing appearance). */
const prepare = (f: F, existing?: ReturnType<typeof appearance>, repair?: unknown) => {
  const rest: unknown[] = Array(17).fill(undefined); rest[0] = true; rest[5] = repair; rest[8] = true; rest[9] = true; rest[16] = existing;
  return prepareCurrentPersonalStoryboard(...([f.request, f.writerResult, f.options, true, ...rest] as unknown as Parameters<typeof prepareCurrentPersonalStoryboard>));
};
const texts = (source: ReturnType<typeof prepare>) => previewStoryEvidence(source.story).texts;
/** The fixture draft with moments (page 6 carries one requirement) and its full self-check; `change` edits the plan before the self-check. */
function draftOf(f: F, source: ReturnType<typeof prepare>, change?: (d: any) => void) {
  const frames: any[] = Array.from({ length: 9 }, () => ({ requirements: [], depicted: null }));
  frames[6] = { requirements: [{ kind: 'show', subject: 'the red ribbon still in the child\'s hand', evidence: LATER }], depicted: null };
  const plain: any = { ...structuredClone(f.draft), moments: { version: STORYBOARD_MOMENTS_VERSION, frames } };
  plain.plan.actorAppearance.child.clothing = [...clothing];
  change?.(plain);
  return { ...plain, selfCheck: fullSelfCheck(plain, texts(source)) };
}
/** A typed review of `book`: every check supported with no issues, then `change`. */
const reviewOf = (f: F, book: { sourceDigest: string; storyboardDigest: string }, change?: (r: any) => void) => {
  const r: any = { ...structuredClone(f.f.review), sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest };
  for (const c of [...r.bookChecks, ...r.frames.flatMap((x: any) => x.checks)]) c.issues = [];
  change?.(r); return r;
};
const hold = (issues: unknown[]) => (r: any) => Object.assign(r.frames[6].checks[0], { verdict: 'contradiction', observation: 'bound observation', issues });
async function setup(issues: unknown[] = [{ impact: 'continuity', ref: 'p6:requirement:0', note: 'the ribbon state is not carried', whyNotMaterial: '' }]) {
  const f = await replanFixture(), plain = prepare(f), accepted = compilePersonalStoryboard(plain, draftOf(f, plain));
  const existing = appearance({ requestId: accepted.requestId, sourceDigest: accepted.sourceDigest, storyboardDigest: accepted.storyboardDigest });
  const boundSource = prepare(f, existing), draft = draftOf(f, boundSource), bound = compilePersonalStoryboard(boundSource, draft);
  const boundReview = reviewOf(f, bound, hold(issues));
  const repair = { parentStoryboardDigest: bound.storyboardDigest, draft: structuredClone(draft), review: boundReview, binding: STORYBOARD_BOUND_REPAIR_VERSION };
  return { f, existing, bound, boundSource, draft, boundReview, repair };
}

describe('storyboard-bound-repair/v1 (one repair of a held bound board, the child pinned)', { timeout: 120_000 }, () => {
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
  it('the change scope comes from the typed refs only: page claims, frames, entities, locations, the companion and the book; the child or an untyped finding allow nothing', () => {
    const f = (refs: string[], reason?: string) => ({ ...(reason ? { reason } : {}), issues: refs.map(ref => ({ ref })) });
    expect(boundRepairSections([f(['p8:transition:companion'])], 9)).toEqual(['p7:continuity', 'p7:moment', 'p7:plan', 'p7:sequence', 'p8:continuity', 'p8:moment', 'p8:plan', 'p8:sequence']);
    expect(boundRepairSections([f(['p3:composition'])], 9)).toEqual(['p3:moment', 'p3:plan']);
    expect(boundRepairSections([f(['p6:relation:hut#2'])], 9)).toEqual(['p6', 'p7', 'p8'].flatMap(p => [`${p}:continuity`, `${p}:moment`, `${p}:plan`, `${p}:sequence`]).sort());
    expect(boundRepairSections([f(['location:grandma_garden']), f(['cast:companion', 'cast:child'])], 9)).toEqual(['book:plan.actorAppearance', 'book:plan.locations']);
    expect(boundRepairSections([f(['entity:ribbon'])], 9)).toEqual(['book:continuity.entities', 'book:plan.recurringProps']);
    expect(boundRepairSections([f(['book'])], 9)).toEqual(['book:*']);
    for (const bad of [[f(['cast:child'])], [f([])], [f(['p9:instant'])], [f(['unknown:thing'])], [f(['p2:instant'], 'unbound_reference')]])
      expect(() => boundRepairSections(bad, 9)).toThrow('personal_storyboard_repair_unbound_finding');
  });
  it('an existing appearance still refuses every ordinary repair; a bound repair needs that appearance', async () => {
    const s = await setup(), { binding: _binding, ...plain } = s.repair;
    expect(() => prepare(s.f, s.existing, plain)).toThrow('personal_storyboard_existing_child_appearance_scope');
    expect(() => prepare(s.f, undefined, s.repair)).toThrow('personal_storyboard_existing_child_appearance_scope');
  });
  it('binds the held bound board: its parent is the accepted draft recompiled WITH the same appearance, and the review must hold it', async () => {
    const s = await setup(), source = prepare(s.f, s.existing, s.repair);
    expect(source.repair).toMatchObject({ parentStoryboardDigest: s.bound.storyboardDigest, binding: STORYBOARD_BOUND_REPAIR_VERSION });
    expect(source.sourceDigest).not.toBe(s.boundSource.sourceDigest);
    // The unbound parent's digest is not this parent.
    const plainBoard = compilePersonalStoryboard(prepare(s.f), draftOf(s.f, prepare(s.f)));
    expect(() => prepare(s.f, s.existing, { ...s.repair, parentStoryboardDigest: plainBoard.storyboardDigest })).toThrow('personal_storyboard_repair_binding');
    // A review that supports the bound board is not a repair target.
    expect(() => prepare(s.f, s.existing, { ...s.repair, review: reviewOf(s.f, s.bound) })).toThrow('personal_storyboard_repair_not_held');
    // Another appearance is another bound board.
    const other = appearance({ requestId: s.bound.requestId, sourceDigest: s.bound.sourceDigest, storyboardDigest: previewSha('another storyboard') });
    expect(() => prepare(s.f, other, s.repair)).toThrow('personal_storyboard_repair_binding');
  });
  it('a held finding about the child only, or one without typed issues, refuses before the planner is called', async () => {
    for (const issues of [[{ impact: 'identity', ref: 'cast:child', note: 'the child', whyNotMaterial: '' }], []]) {
      const s = await setup(issues);
      expect(() => prepare(s.f, s.existing, s.repair)).toThrow('personal_storyboard_repair_unbound_finding');
    }
  });
  it('the planner gets the repair addendum, its change scope, the bound review findings and the existing appearance; the schema keeps the clothing pinned', async () => {
    const s = await setup(), source = prepare(s.f, s.existing, s.repair) as any;
    expect(storyboardInstructions(source).endsWith(`\n${REPAIR_STORYBOARD_ADDENDUM}\n${BOUND_REPAIR_SCOPE_ADDENDUM}`)).toBe(true);
    expect(source.planningInput.existingChildAppearance).toEqual(existingChildAppearanceData(s.existing));
    expect(source.planningInput.priorReviewedStoryboard.changeScope).toEqual(['p6:continuity', 'p6:moment', 'p6:plan', 'p6:sequence']);
    expect(source.planningInput.priorReviewedStoryboard.reviewFindings).toEqual([{ scope: 'page', pageNumber: 6, category: s.boundReview.frames[6].checks[0].category,
      verdict: 'contradiction', observation: 'bound observation' }]);
    const schema: any = storyboardDraftSchema(source);
    expect(JSON.stringify(schema.shape.plan.shape.actorAppearance.shape.child.shape.clothing.element.options)).toBe(JSON.stringify(clothing));
  });
  it('a repaired draft inside the scope compiles with the child unchanged; a change outside it or other clothing is refused', async () => {
    const s = await setup(), source = prepare(s.f, s.existing, s.repair);
    const repaired = draftOf(s.f, source, d => { d.plan.pages[6].composition = 'a repaired framing for the bound finding'; });
    const book = compilePersonalStoryboard(source, repaired);
    expect(book.existingChildAppearance).toEqual(existingChildAppearanceData(s.existing));
    expect(book.repair).toEqual({ version: 'storyboard-repair/v1', parentStoryboardDigest: s.bound.storyboardDigest });
    const outside = draftOf(s.f, source, d => { d.plan.pages[6].composition = 'a repaired framing'; d.plan.pages[3].composition = 'an unrelated change'; });
    expect(() => compilePersonalStoryboard(source, outside)).toThrow('personal_storyboard_bound_repair_scope');
    const changed: any = structuredClone(repaired); changed.plan.actorAppearance.child.clothing = ['green dress', 'blue shorts', 'teal shoes'];
    expect(() => compilePersonalStoryboard(source, changed)).toThrow();
  });
});
