import { describe, expect, it, vi } from 'vitest';
import { prepareCurrentPersonalStoryboard, compilePersonalStoryboard, personalStoryboardFrame, storyboardReviewDisposition, storyboardInstructions,
  OWNED_STORYBOARD_INSTRUCTION } from '../storyboard';
import { KIND_STORYBOARD_ADDENDUM } from '../storyboard-landmark-kind';
import { PRESERVATION_STORYBOARD_ADDENDUM, STORYBOARD_PRESERVATION_VERSION, storyboardPreservationDiff } from '../storyboard-preservation';
import { runSimpleStoryboardDiagnostic, type SimpleStoryboardDiagnosticCall } from '../simple-storyboard-diagnostic';
import { landmarkFeatureCatalogue, auditionPageChecks, auditionSheetDesigns } from '../simple-book-reviewed-audition';
import { previewPagePrompt, selectedDraftQaContext } from '../../local-story-preview';
import { replanFixture, withKind } from './storyboard-replan-fixture';

const reviewFor = (review: any, book: { sourceDigest: string; storyboardDigest: string }) =>
  ({ ...structuredClone(review), sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest });

describe('storyboard preservation: opt-in re-plan of an approved parent', () => {
  it('absent: the kind-only source, instruction and input carry no prior and no preservation text', async () => {
    const r = await replanFixture();
    const kindOnly = prepareCurrentPersonalStoryboard(r.request, r.writerResult, r.options, true, undefined, true);
    expect('priorApprovedStoryboard' in kindOnly.planningInput).toBe(false);
    expect('preservation' in kindOnly).toBe(false);
    expect(storyboardInstructions(kindOnly)).toBe(`${OWNED_STORYBOARD_INSTRUCTION}\n${KIND_STORYBOARD_ADDENDUM}`);
  });

  it('policy: needs the kind contract, excludes moments, and refuses a malformed preservation', async () => {
    const r = await replanFixture(), p = { parentStoryboardDigest: r.book.storyboardDigest, draft: r.draft };
    const prep = (moments?: true, kind?: true, preservation: any = p) =>
      () => prepareCurrentPersonalStoryboard(r.request, r.writerResult, r.options, true, moments, kind, preservation);
    expect(prep(undefined, undefined)).toThrow('personal_storyboard_preservation_policy');
    expect(prep(true, true)).toThrow('personal_storyboard_preservation_policy');
    for (const bad of [{ ...p, parentStoryboardDigest: 'x' }, { ...p, extra: 1 }, { ...p, draft: [r.draft] }, { parentStoryboardDigest: p.parentStoryboardDigest }, null, 'p'])
      expect(prep(undefined, true, bad)).toThrow('personal_storyboard_preservation_policy');
  });

  it('binds the EXACT approved parent: a wrong digest or a changed prior draft is refused', async () => {
    const r = await replanFixture();
    const prep = (digest: string, draft: unknown) => () =>
      prepareCurrentPersonalStoryboard(r.request, r.writerResult, r.options, true, undefined, true, { parentStoryboardDigest: digest, draft });
    expect(prep('a'.repeat(64), r.draft)).toThrow('personal_storyboard_preservation_binding');
    const seam = structuredClone(r.draft) as any; seam.plan.recurringProps[0].design = 'two red cotton ribbons';
    expect(prep(r.book.storyboardDigest, seam)).toThrow('personal_storyboard_preservation_binding');
    // The parent of a re-plan is the plain parent: a kind-bearing draft does not compile to the plain parent digest.
    expect(prep(r.book.storyboardDigest, withKind(r.draft))).toThrow('personal_storyboard_preservation_binding');
    expect(prep(r.book.storyboardDigest, r.draft)).not.toThrow();
  });

  it('on: the prior is bound planning input with its addendum last; it is not interchangeable with a kind-only re-plan', async () => {
    const r = await replanFixture(), p = { parentStoryboardDigest: r.book.storyboardDigest, draft: r.draft };
    const kept = prepareCurrentPersonalStoryboard(r.request, r.writerResult, r.options, true, undefined, true, p);
    const kindOnly = prepareCurrentPersonalStoryboard(r.request, r.writerResult, r.options, true, undefined, true);
    expect(kept.planningInput.priorApprovedStoryboard).toEqual({ version: STORYBOARD_PRESERVATION_VERSION, parentStoryboardDigest: r.book.storyboardDigest,
      storyboard: r.draft });
    expect(storyboardInstructions(kept)).toBe(`${OWNED_STORYBOARD_INSTRUCTION}\n${KIND_STORYBOARD_ADDENDUM}\n${PRESERVATION_STORYBOARD_ADDENDUM}`);
    expect(kept.sourceDigest).not.toBe(kindOnly.sourceDigest);
    // The supplied draft is copied: a later edit of the caller's object changes nothing already prepared.
    (p.draft as any).plan.visualLanguage = 'edited after preparation';
    expect((kept.planningInput.priorApprovedStoryboard as any).storyboard.plan.visualLanguage).not.toBe('edited after preparation');
    const r2 = await replanFixture();
    const book = compilePersonalStoryboard(prepareCurrentPersonalStoryboard(r2.request, r2.writerResult, r2.options, true, undefined, true,
      { parentStoryboardDigest: r2.book.storyboardDigest, draft: r2.draft }), withKind(r2.draft));
    const plainKind = compilePersonalStoryboard(prepareCurrentPersonalStoryboard(r2.request, r2.writerResult, r2.options, true, undefined, true), withKind(r2.draft));
    expect(book.storyboardDigest).not.toBe(plainKind.storyboardDigest);
    expect(() => storyboardReviewDisposition(book, reviewFor(r2.review, plainKind))).toThrow('review_binding');
    // Packets rebuild the source with the same preservation; they stay current for this book only.
    const current = { request: r2.request, writerResult: r2.writerResult, options: r2.options };
    const packet = personalStoryboardFrame(book, reviewFor(r2.review, book), 1, current);
    expect(packet.context.storyboardDigest).toBe(book.storyboardDigest);
    expect(packet.packetDigest).not.toBe(personalStoryboardFrame(plainKind, reviewFor(r2.review, plainKind), 1, current).packetDigest);
  });

  it('driver: the prior reaches only the storyboard call; the review judges the new storyboard alone', async () => {
    const r = await replanFixture(), p = { parentStoryboardDigest: r.book.storyboardDigest, draft: r.draft };
    const book = compilePersonalStoryboard(prepareCurrentPersonalStoryboard(r.request, r.writerResult, r.options, true, undefined, true, p), withKind(r.draft));
    const generate = vi.fn(async (call: SimpleStoryboardDiagnosticCall) => structuredClone(call.stage === 'storyboard' ? withKind(r.draft) : reviewFor(r.review, book)));
    const result = await runSimpleStoryboardDiagnostic({ request: r.request, writerResult: r.writerResult, options: r.options, signal: new AbortController().signal,
      generate, actorOwnedAppearance: true, landmarkKindContract: true, preservation: p });
    const [storyboardCall, reviewCall] = generate.mock.calls.map(c => c[0]);
    expect(JSON.parse(storyboardCall.input).priorApprovedStoryboard.storyboard).toEqual(r.draft);
    expect(storyboardCall.instructions.endsWith(PRESERVATION_STORYBOARD_ADDENDUM)).toBe(true);
    expect(reviewCall.input.includes('priorApprovedStoryboard')).toBe(false);
    expect(reviewCall.instructions.includes('PRESERVATION')).toBe(false);
    expect(result).toMatchObject({ status: 'review_supported', storyboardDigest: book.storyboardDigest });
    expect(result.framePackets).toHaveLength(book.narrativeSpreads + 1);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Comparability (QA F1): exact equality except the added kinds; the real Goni landmark wording.
// ---------------------------------------------------------------------------------------------------------------
const LANDMARKS: Record<string, string> = {
  tree_landmark: 'Broad rounded green canopy, forked warm-gray trunk, standing on the left lawn.',
  bench_landmark: 'Three wooden seat slats, three back slats and two dark iron supports; behind the tree.',
  swing_landmark: 'Single rectangular wooden seat on two cream ropes, supported by a separate wooden frame on the right lawn.',
  thorn_landmark: 'Low dusty-green thorn bush beside the path before the rock, with a forked outward-facing twig.',
  rock_landmark: 'Large pale-gray rounded rock with one diagonal ochre seam and a low burrow opening beneath its front lip; rear right of garden.',
};
const KINDS: Record<string, string> = { tree_landmark: 'tree', bench_landmark: 'bench', swing_landmark: 'swing', thorn_landmark: 'thorn bush', rock_landmark: 'rock' };
const parentDraft = () => ({
  plan: {
    visualLanguage: 'soft gouache picture book', recurringProps: [{ id: 'pocket', design: 'roomy right patch pocket' }],
    locations: [{ id: 'garden', design: 'garden lawn with a curving path' }, { id: 'burrow', design: 'low burrow under the rock' }],
    pages: Array.from({ length: 9 }, (_, n) => ({ locationId: 'garden', shot: 'wide', angle: 'low', composition: `staging ${n}`, childAction: `act ${n}`,
      childExpression: 'calm', childGaze: 'ahead', companionAction: 'follows', scene: `scene ${n}`, props: [], pageNumber: n })),
    continuity: { companionStandingHeightInChildHeights: 0.75,
      entities: [...Object.entries(LANDMARKS).map(([id, value]) => ({ id, kind: 'landmark', invariants: [{ attribute: 'design', value }] })),
        { id: 'garden_cat', kind: 'supporting_character', invariants: [{ attribute: 'design', value: 'small ginger cat with a white chest' }] }],
      pages: Array.from({ length: 9 }, (_, n) => ({ visibleLocationIds: ['garden'], visibleEntityIds: n === 4 ? ['rock_landmark'] : [], changes: [],
        childHeightFraction: 0.25, environmentAreaFraction: 0.7, pageNumber: n })) },
    actorAppearance: { child: { role: 'child', clothing: ['Teal short-sleeved shirt, unchanged throughout.', 'White socks.'] },
      companion: { role: 'companion', authority: 'companionVisualAuthority' } },
  },
  sequence: { premise: 'a trail to the burrow', mutableAttributes: [], initialStates: [{ entityId: 'rock_landmark', value: { relation: 'at', targetId: 'garden' } }],
    pages: Array.from({ length: 8 }, (_, i) => ({ sceneId: 'garden_visit_1', beat: `beat ${i + 1}`, sceneChangeEvidence: null, visibleCastIds: ['child', 'companion'],
      transitions: [], pageNumber: i + 1 })) },
});
const replanned = (change: (d: any) => void = () => {}) => {
  const d = parentDraft() as any;
  for (const e of d.plan.continuity.entities) if (KINDS[e.id]) e.invariants.push({ attribute: 'kind', value: KINDS[e.id] });
  change(d);
  return d;
};
const entity = (d: any, id: string) => d.plan.continuity.entities.find((e: any) => e.id === id);
const decisive = (value: string) => landmarkFeatureCatalogue([{ attribute: 'design', value }]).filter(f => f.decisive).map(f => `${f.aspect}:${f.text}`);

describe('comparability: exact equality except the added kinds (QA F1)', () => {
  it('the same design plus exactly one kind per landmark is COMPARABLE; the kinds are recorded', () => {
    const diff = storyboardPreservationDiff(parentDraft(), replanned(), [4]);
    expect(diff).toMatchObject({ verdict: 'COMPARABLE', drift: [], viewpointOutsidePair: [] });
    expect(diff.kindAdded).toEqual(Object.entries(KINDS).map(([entityId, kind]) => ({ entityId, kind })));
    // The kind may sit anywhere among that landmark's invariants; it is removed, never matched by wording.
    expect(storyboardPreservationDiff(parentDraft(), replanned(d => entity(d, 'rock_landmark').invariants.reverse()), [4]).verdict).toBe('COMPARABLE');
  });

  it('decisive-cue equality is NOT enough: one seam -> two seams and three slats -> six slats keep every decisive cue but are NOT_COMPARABLE', () => {
    const seam = (v: string) => v.replace('one diagonal ochre seam', 'two diagonal ochre seams'), slats = (v: string) => v.replace('Three wooden seat slats', 'Six wooden seat slats');
    expect(decisive(seam(LANDMARKS.rock_landmark))).toEqual(decisive(LANDMARKS.rock_landmark));
    expect(decisive(slats(LANDMARKS.bench_landmark))).toEqual(decisive(LANDMARKS.bench_landmark));
    for (const [id, edit] of [['rock_landmark', seam], ['bench_landmark', slats]] as const) {
      const diff = storyboardPreservationDiff(parentDraft(), replanned(d => { const inv = entity(d, id).invariants[0]; inv.value = edit(inv.value); }), [4]);
      expect(diff.verdict).toBe('NOT_COMPARABLE');
      expect(diff.drift).toEqual([expect.objectContaining({ category: 'entity_design', path: expect.stringMatching(/^plan\.continuity\.entities\.\d\.invariants\.0\.value$/) })]);
    }
  });

  it('every other render authority drifts by category: wardrobe, companion, scale, cast, props, locations, topology, page 4 and the sequence', () => {
    const cases: [string, (d: any) => void][] = [
      ['child_wardrobe', d => { d.plan.actorAppearance.child.clothing[1] = 'Striped socks.'; }],
      ['companion_authority', d => { d.plan.actorAppearance.companion.authority = 'a new costume'; }],
      ['scale', d => { d.plan.continuity.companionStandingHeightInChildHeights = 0.8; }],
      ['entity_design', d => { entity(d, 'garden_cat').invariants[0].value = 'small black cat'; }],
      ['entity_design', d => { entity(d, 'rock_landmark').invariants[0].value = entity(d, 'rock_landmark').invariants[0].value.replace('rear right', 'rear left'); }],
      ['entity_design', d => { d.plan.continuity.entities.push({ id: 'pond_landmark', kind: 'prop', invariants: [{ attribute: 'design', value: 'pond' }] }); }],
      ['prop_design', d => { d.plan.recurringProps[0].design = 'left patch pocket'; }],
      ['location_design', d => { d.plan.locations[0].design = 'garden lawn with a straight path'; }],
      ['visual_language', d => { d.plan.visualLanguage = 'crayon'; }],
      ['pair_page_state', d => { d.plan.continuity.pages[4].visibleEntityIds.push('garden_cat'); }],
      ['pair_page_plan', d => { d.plan.pages[4].childAction = 'stands up'; }],
      ['pair_camera', d => { d.plan.pages[4].shot = 'close'; }],
      ['pair_camera', d => { d.plan.pages[4].composition = 'seen from above'; }],
      ['page_plan', d => { d.plan.pages[6].composition = 'restaged'; }],
      // A field only the re-plan has (or only the parent has) is drift too, not an ignored extra.
      ['page_plan', d => { d.plan.pages[6].extraDirection = 'added by the re-plan'; }],
      ['page_plan', d => { delete d.plan.pages[6].childGaze; }],
      ['page_state', d => { d.plan.continuity.pages[2].visibleEntityIds.push('garden_cat'); }],
      ['sequence', d => { d.sequence.pages[2].transitions.push({ entityId: 'rock_landmark', from: { relation: 'at', targetId: 'garden' }, to: { relation: 'at', targetId: 'burrow' }, evidence: 'x' }); }],
    ];
    for (const [category, change] of cases) {
      const diff = storyboardPreservationDiff(parentDraft(), replanned(change), [4]);
      expect(diff.verdict, category).toBe('NOT_COMPARABLE');
      expect(diff.drift.map(d => d.category), category).toEqual([category]);
    }
  });

  it('camera: a pure shot/angle change OUTSIDE the pair is permitted and reported; composition stays staging authority', () => {
    const diff = storyboardPreservationDiff(parentDraft(), replanned(d => { d.plan.pages[7].shot = 'close'; d.plan.pages[7].angle = 'high'; }), [4]);
    expect(diff.verdict).toBe('COMPARABLE');
    expect(diff.viewpointOutsidePair).toEqual([{ path: 'plan.pages.7.shot', before: 'wide', after: 'close' }, { path: 'plan.pages.7.angle', before: 'low', after: 'high' }]);
    expect(storyboardPreservationDiff(parentDraft(), replanned(d => { d.plan.pages[4].angle = 'high'; }), [4]).drift)
      .toEqual([expect.objectContaining({ category: 'pair_camera', path: 'plan.pages.4.angle' })]);
    expect(() => storyboardPreservationDiff(parentDraft(), replanned(), [])).toThrow('preservation_pair');
  });

  it('a page prompt, QA context, audition checks and reference sheets use only their own camera', async () => {
    const r = await replanFixture(), texts = r.writerResult.manuscript.pages.map((p: { text: string }) => p.text);
    const moved = structuredClone(r.draft) as any; moved.plan.pages[6].shot = 'wide'; moved.plan.pages[6].angle = 'high';
    expect(storyboardPreservationDiff(r.draft, withKind(moved), [4])).toMatchObject({ verdict: 'COMPARABLE', viewpointOutsidePair: [{}, {}] });
    const a = r.book, b = compilePersonalStoryboard(prepareCurrentPersonalStoryboard(r.request, r.writerResult, r.options, true), moved);
    expect(b.plan.pages[6].shot).toBe('wide');
    const prompt = (book: typeof a) => previewPagePrompt(book.plan, 4, texts[3], 5, 'girl', 'dragon');
    expect(prompt(b)).toBe(prompt(a));
    expect(selectedDraftQaContext(b.plan, 4)).toEqual(selectedDraftQaContext(a.plan, 4));
    expect(auditionPageChecks(b, 4, 'dragon')).toEqual(auditionPageChecks(a, 4, 'dragon'));
    expect(auditionSheetDesigns(b, texts)).toEqual(auditionSheetDesigns(a, texts));
  });

  it('kind bookkeeping: missing, duplicate, already in the parent, or on a non-landmark is drift', () => {
    const one = (change: (d: any) => void, parent = parentDraft()) => storyboardPreservationDiff(parent, replanned(change), [4]).drift.map(d => d.category);
    expect(one(d => { entity(d, 'thorn_landmark').invariants.pop(); })).toEqual(['kind_missing']);
    expect(one(d => { entity(d, 'rock_landmark').invariants.push({ attribute: 'kind', value: 'boulder' }); })).toEqual(['kind_duplicate', 'entity_design']);
    const kindParent = parentDraft() as any; entity(kindParent, 'tree_landmark').invariants.push({ attribute: 'kind', value: 'tree' });
    // The re-plan repeats the parent's own kind: nothing was ADDED, so the contract's single change cannot be identified.
    expect(one(() => {}, kindParent)).toEqual(['kind_not_added']);
    expect(one(d => { entity(d, 'garden_cat').invariants.push({ attribute: 'kind', value: 'cat' }); })).toEqual(['entity_design']);
  });
});
