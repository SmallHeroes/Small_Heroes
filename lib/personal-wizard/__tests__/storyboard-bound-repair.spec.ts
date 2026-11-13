/** storyboard-bound-repair/v1: one focused repair of a held BOUND board, with the admitted child pinned and a TYPED target scope. Synthetic only. */
import { describe, expect, it } from 'vitest';
import { QUALITY_CATEGORIES } from '../../local-preview-quality';
import { previewSha, previewStoryEvidence } from '../../local-story-preview';
import { CHILD_ANCHOR_TECHNIQUE_MANIFEST, CHILD_ANCHOR_MANIFEST_SHA256, CHILD_ANCHOR_STYLE_VERSION, CHILD_ANCHOR_INSPECTION_VERSION,
  CHILD_ANCHOR_REQUIRED_VISIBLE, childAnchorRecipeSchema, childAnchorDescriptionRequest, childAnchorInspectionContext, childAnchorInspectionContextSha,
  childAnchorRecipeSha, childAnchorInspectedAdoptionRecord } from '../child-anchor-style';
import { deriveExistingChildAppearance, existingChildAppearanceData } from '../existing-child-appearance';
import { prepareCurrentPersonalStoryboard, compilePersonalStoryboard, storyboardDraftSchema, storyboardInstructions } from '../storyboard';
import { STORYBOARD_BOUND_REPAIR_VERSION, REPAIR_STORYBOARD_ADDENDUM, BOUND_REPAIR_SCOPE_ADDENDUM, assertStoryboardRepair } from '../storyboard-repair';
import { BOUND_REPAIR_TARGET_VERSION, boundRepairScope, boundRepairChangeScope } from '../storyboard-bound-repair-scope';
import { STORYBOARD_MOMENTS_VERSION } from '../storyboard-moments';
import { changedSections } from '../storyboard-diagnosis';
import { runSimpleStoryboardDiagnostic } from '../simple-storyboard-diagnostic';
import { fullSelfCheck } from './storyboard-self-check-fixture';
import { replanFixture } from './storyboard-replan-fixture';

const clothing = ['red shirt', 'blue shorts', 'teal shoes'];
const LATER = 'the ribbon stays with נועה';
/** The fixture's frame 6 transition quote (the run4 shape: an actor's offscreen custody change the review held as unsupported). */
const HELD = 'They climb inside the hut again, and the ribbon stays with נועה.';
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
/**
 * prepareCurrent...(request, writerResult, options, appearance=true, moments, ..., repair, ..., selfCheck, typed review impact, ..., existing appearance);
 * `instance` adds the landmark-kind and instance-distinction contracts (each location then declares its population).
 */
const prepare = (f: F, existing?: ReturnType<typeof appearance>, repair?: unknown, instance?: true) => {
  const rest: unknown[] = Array(17).fill(undefined); rest[0] = true; rest[5] = repair; rest[8] = true; rest[9] = true; rest[16] = existing;
  if (instance) { rest[1] = true; rest[14] = true; }
  return prepareCurrentPersonalStoryboard(...([f.request, f.writerResult, f.options, true, ...rest] as unknown as Parameters<typeof prepareCurrentPersonalStoryboard>));
};
const texts = (source: ReturnType<typeof prepare>) => previewStoryEvidence(source.story).texts;
/** The fixture draft with moments (page 6 carries one requirement) and its full self-check; `change` edits the plan before the self-check. */
function draftOf(f: F, source: ReturnType<typeof prepare>, change?: (d: any) => void) {
  const frames: any[] = Array.from({ length: 9 }, () => ({ requirements: [], depicted: null }));
  frames[6] = { requirements: [{ kind: 'show', subject: 'the red ribbon still in the child\'s hand', evidence: LATER }], depicted: null };
  const plain: any = { ...structuredClone(f.draft), moments: { version: STORYBOARD_MOMENTS_VERSION, frames } };
  plain.plan.actorAppearance.child.clothing = [...clothing];
  if (source.instanceDistinctionContract) {
    // The run2 shape: the garden's design shows fruit its population omits.
    for (const l of plain.plan.locations) l.population = l.id === 'garden' ? ['plant'] : [];
    for (const e of plain.plan.continuity.entities) e.invariants.push({ attribute: 'kind', value: e.id });
  }
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
/** Both saved held shapes are book-level continuity checks whose typed issue names the exact target. */
const holdBook = (issues: unknown[]) => (r: any) => Object.assign(r.bookChecks[0], { verdict: 'uncertain', observation: 'bound book observation', issues });
const RUN4 = [{ impact: 'continuity', ref: 'p6:transition:companion', note: 'the quoted action alone does not establish that the companion went inside', whyNotMaterial: '' }];
const RUN2 = [{ impact: 'continuity', ref: 'location:garden', note: 'the location design omits the visible dressing', whyNotMaterial: '' }];
async function setup(issues: unknown[] = [{ impact: 'continuity', ref: 'p6:requirement:0', note: 'the ribbon state is not carried', whyNotMaterial: '' }], book = false, instance?: true) {
  const f = await replanFixture(), plain = prepare(f, undefined, undefined, instance), accepted = compilePersonalStoryboard(plain, draftOf(f, plain));
  const existing = appearance({ requestId: accepted.requestId, sourceDigest: accepted.sourceDigest, storyboardDigest: accepted.storyboardDigest });
  const boundSource = prepare(f, existing, undefined, instance), draft = draftOf(f, boundSource), bound = compilePersonalStoryboard(boundSource, draft);
  const boundReview = reviewOf(f, bound, (book ? holdBook : hold)(issues));
  const repair = { parentStoryboardDigest: bound.storyboardDigest, draft: structuredClone(draft), review: boundReview, binding: STORYBOARD_BOUND_REPAIR_VERSION };
  return { f, existing, bound, boundSource, draft, boundReview, repair, instance };
}
const companionAt6 = (d: any) => d.sequence.pages[5].transitions.find((t: any) => t.entityId === 'companion');
/** Fresh compile, then cached (JSON round trip of the stored repair input and draft, re-prepared) and raw (schema-decoded bytes) re-admission. */
function readmit(s: Awaited<ReturnType<typeof setup>>, source: ReturnType<typeof prepare>, repaired: unknown) {
  const fresh = compilePersonalStoryboard(source, repaired);
  const cachedSource = prepare(s.f, s.existing, JSON.parse(JSON.stringify(s.repair)), s.instance);
  const cached = compilePersonalStoryboard(cachedSource, JSON.parse(JSON.stringify(repaired)));
  const raw = compilePersonalStoryboard(cachedSource, storyboardDraftSchema(cachedSource).parse(JSON.parse(Buffer.from(JSON.stringify(repaired)).toString('utf8'))));
  return { fresh, cached, raw, cachedSource };
}
/** The repair seam the engine's bound repair runs: the planner's answer is compiled, and only an admitted repair reaches the (denied) review. */
async function seam(s: Awaited<ReturnType<typeof setup>>, candidate: unknown) {
  const stages: string[] = [];
  const stop = await runSimpleStoryboardDiagnostic({ request: s.f.request, writerResult: s.f.writerResult, options: s.f.options, signal: new AbortController().signal,
    actorOwnedAppearance: true, momentContract: true, selfCheckContract: true, reviewImpactPolicy: true,
    ...(s.instance ? { landmarkKindContract: true as const, instanceDistinctionContract: true as const } : {}), existingChildAppearance: s.existing, repair: s.repair as any,
    generate: async call => { stages.push(call.stage); if (call.stage === 'storyboard') return structuredClone(candidate); throw Error('synthetic_review_denied'); },
  }).then(() => 'unexpected_success', (e: Error) => e.message);
  return { stages, stop };
}

describe('storyboard-bound-repair/v1 (one repair of a held bound board, the child pinned)', { timeout: 180_000 }, () => {
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
  it('typed targets resolve each ref to its exact entry and the same entity\'s dependents only; generic, child, untyped or unresolvable refs refuse', async () => {
    const draft = (await setup()).draft, f = (refs: string[], reason?: string) => ({ ...(reason ? { reason } : {}), issues: refs.map(ref => ({ ref })) });
    const may = (refs: string[]) => boundRepairChangeScope(boundRepairScope([f(refs)], draft));
    const transition = may(['p6:transition:companion'])[0];
    expect(transition.kind).toBe('transition');
    expect(transition.may).toContain('sequence.pages[5].transitions[entityId=companion]');
    expect(transition.may).toContain('plan.pages[8].companionAction');
    // Nothing of frame 5 (the frame before), no camera or composition, no other entity's transition and no child action.
    expect(transition.may.some(p => /pages\[5\]\.(?!transitions)|plan\.pages\[5\]|shot|angle|composition|childAction|entityId=child/.test(p))).toBe(false);
    expect(may(['location:garden'])).toEqual([{ ref: 'location:garden', kind: 'location', may: ['plan.locations[id=garden].*'] }]);
    expect(may(['p3:composition'])[0].may).toEqual(['plan.pages[3].composition', 'plan.pages[3].shot', 'plan.pages[3].angle']);
    expect(may(['entity:ribbon'])[0].may.slice(0, 2)).toEqual(['plan.continuity.entities[id=ribbon].*', 'plan.recurringProps[id=ribbon].*']);
    expect(may(['cast:companion'])).toEqual([{ ref: 'cast:companion', kind: 'companion', may: ['plan.actorAppearance.companion'] }]);
    expect(boundRepairScope([f(['p6:requirement:0'])], draft).version).toBe(BOUND_REPAIR_TARGET_VERSION);
    for (const bad of [[f(['book'])], [f(['cast:child'])], [f(['location:garden', 'cast:child'])], [f([])], [f(['p9:instant'])], [f(['unknown:thing'])],
      [f(['p2:instant'], 'unbound_reference')], [f(['location:castle'])], [f(['p2:transition:companion'])], [f(['p6:requirement:3'])], [f(['entity:dragon'])]])
      expect(() => boundRepairScope(bad, draft)).toThrow('personal_storyboard_repair_unbound_finding');
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
    const plainBoard = compilePersonalStoryboard(prepare(s.f), draftOf(s.f, prepare(s.f)));
    expect(() => prepare(s.f, s.existing, { ...s.repair, parentStoryboardDigest: plainBoard.storyboardDigest })).toThrow('personal_storyboard_repair_binding');
    expect(() => prepare(s.f, s.existing, { ...s.repair, review: reviewOf(s.f, s.bound) })).toThrow('personal_storyboard_repair_not_held');
    const other = appearance({ requestId: s.bound.requestId, sourceDigest: s.bound.sourceDigest, storyboardDigest: previewSha('another storyboard') });
    expect(() => prepare(s.f, other, s.repair)).toThrow('personal_storyboard_repair_binding');
  });
  it('a held finding about the child only, an unlocalized book finding, or one without typed issues refuses before the planner is called', async () => {
    for (const [issues, book] of [[[{ impact: 'identity', ref: 'cast:child', note: 'the child', whyNotMaterial: '' }], false],
      [[{ impact: 'continuity', ref: 'book', note: 'something somewhere in the book', whyNotMaterial: '' }], true], [[], false]] as const) {
      const s = await setup([...issues], book);
      expect(() => prepare(s.f, s.existing, s.repair)).toThrow('personal_storyboard_repair_unbound_finding');
    }
  });
  it('the planner gets the repair addendum, the typed change scope, the bound review findings and the existing appearance; the schema keeps the clothing pinned', async () => {
    const s = await setup(), source = prepare(s.f, s.existing, s.repair) as any;
    expect(storyboardInstructions(source).endsWith(`\n${REPAIR_STORYBOARD_ADDENDUM}\n${BOUND_REPAIR_SCOPE_ADDENDUM}`)).toBe(true);
    expect(source.planningInput.existingChildAppearance).toEqual(existingChildAppearanceData(s.existing));
    expect(source.planningInput.priorReviewedStoryboard.changeScope).toEqual([{ ref: 'p6:requirement:0', kind: 'requirement', may: ['moments.frames[6].requirements[0]'] }]);
    expect(source.boundRepairScope.version).toBe(BOUND_REPAIR_TARGET_VERSION);
    expect(source.planningInput.priorReviewedStoryboard.reviewFindings).toEqual([{ scope: 'page', pageNumber: 6, category: s.boundReview.frames[6].checks[0].category,
      verdict: 'contradiction', observation: 'bound observation' }]);
    const schema: any = storyboardDraftSchema(source);
    expect(JSON.stringify(schema.shape.plan.shape.actorAppearance.shape.child.shape.clothing.element.options)).toBe(JSON.stringify(clothing));
  });
  it('a repair of the exact target compiles with the child unchanged; another field of the same frame, another frame or other clothing is refused', async () => {
    const s = await setup(), source = prepare(s.f, s.existing, s.repair);
    // A corrected claim cites a different (wider) span than the held quote; keeping the held quote with a new subject repairs nothing.
    const repaired = draftOf(s.f, source, d => { Object.assign(d.moments.frames[6].requirements[0], { subject: 'the red ribbon, carried, still in the child\'s hand', evidence: HELD }); });
    const book = compilePersonalStoryboard(source, repaired);
    expect(() => compilePersonalStoryboard(source, draftOf(s.f, source, d => { d.moments.frames[6].requirements[0].subject = 'the red ribbon, carried, still in the child\'s hand'; })))
      .toThrow('personal_storyboard_bound_repair_unproven_claim');
    expect(book.existingChildAppearance).toEqual(existingChildAppearanceData(s.existing));
    expect(book.repair).toEqual({ version: 'storyboard-repair/v1', parentStoryboardDigest: s.bound.storyboardDigest });
    // The old section scope admitted these; the typed target does not.
    for (const change of [(d: any) => { d.plan.pages[6].composition = 'a repaired framing'; }, (d: any) => { d.plan.pages[3].composition = 'an unrelated change'; }])
      expect(() => compilePersonalStoryboard(source, draftOf(s.f, source, d => { d.moments.frames[6].requirements[0].subject = 'the red ribbon, carried'; change(d); })))
        .toThrow('personal_storyboard_bound_repair_scope');
    const changed: any = structuredClone(repaired); changed.plan.actorAppearance.child.clothing = ['green dress', 'blue shorts', 'teal shoes'];
    expect(() => compilePersonalStoryboard(source, changed)).toThrow();
    // The held draft itself is no repair: its target is unchanged.
    expect(() => compilePersonalStoryboard(source, s.draft)).toThrow('personal_storyboard_bound_repair_target_unchanged');
  });
});

describe('the exact run4 shape: a held unsupported custody transition (p{n}:transition:companion), provider-free', { timeout: 180_000 }, () => {
  it('positive: withdrawing the unsupported transition, or correcting it with a quote that states more, compiles and re-admits fresh, cached and raw', async () => {
    const s = await setup(RUN4, true), source = prepare(s.f, s.existing, s.repair);
    expect(companionAt6(s.draft).evidence).toBe(HELD);
    const withdrawn = draftOf(s.f, source, d => { d.sequence.pages[5].transitions = d.sequence.pages[5].transitions.filter((t: any) => t.entityId !== 'companion'); });
    const corrected = draftOf(s.f, source, d => { const t = companionAt6(d); t.evidence = texts(source)[6].trim(); });
    expect(texts(source)[6].includes(HELD) && texts(source)[6].trim() !== HELD).toBe(true);
    for (const repaired of [withdrawn, corrected]) {
      const r = readmit(s, source, repaired);
      expect(r.fresh.existingChildAppearance).toEqual(existingChildAppearanceData(s.existing));
      expect(r.fresh.plan.actorAppearance).toEqual(s.bound.plan.actorAppearance);
      expect([r.cached.storyboardDigest, r.raw.storyboardDigest]).toEqual([r.fresh.storyboardDigest, r.fresh.storyboardDigest]);
      expect(r.cachedSource.sourceDigest).toBe(source.sourceDigest);
      // Re-admission in proportion to the change: everything but the companion's frame-6 transition is the held board's.
      expect(changedSections(s.draft, repaired)).toEqual(['p6:sequence']);
      expect(r.fresh.plan.pages).toEqual(s.bound.plan.pages);
      expect(r.fresh.sequence.pages[5].transitions.filter((t: any) => t.entityId === 'child')).toEqual(s.bound.sequence.pages[5].transitions.filter((t: any) => t.entityId === 'child'));
      // A cached draft tampered outside the target is refused on re-admission too.
      const tampered: any = JSON.parse(JSON.stringify(repaired)); tampered.plan.pages[7].composition += ' The viewpoint is slightly higher.';
      expect(() => compilePersonalStoryboard(r.cachedSource, tampered)).toThrow('personal_storyboard_bound_repair_scope');
    }
  });
  it('negative: a p7 camera edit, a frame-5 edit, another entity, the child, a re-cited quote, a new event, a new id or no repair are all refused', async () => {
    const s = await setup(RUN4, true), source = prepare(s.f, s.existing, s.repair);
    const withdraw = (d: any) => { d.sequence.pages[5].transitions = d.sequence.pages[5].transitions.filter((t: any) => t.entityId !== 'companion'); };
    const cases: [string, (d: any) => void, string][] = [
      ['p7 camera only (the saved diagnostic candidate)', d => { d.plan.pages[7].composition += ' The viewpoint is slightly higher.'; }, 'bound_repair_scope'],
      ['p7 camera with a valid withdrawal', d => { withdraw(d); d.plan.pages[7].shot = 'close'; d.plan.pages[7].angle = 'low'; }, 'bound_repair_scope'],
      ['the frame before (p5) with a valid withdrawal', d => { withdraw(d); d.plan.pages[5].companionAction = 'waits outside'; }, 'bound_repair_scope'],
      ['another entity on the same page', d => { withdraw(d); d.sequence.pages[5].transitions.find((t: any) => t.entityId === 'child').evidence = texts(source)[6].trim(); }, 'bound_repair_scope'],
      ['the child action on the same frame', d => { withdraw(d); d.plan.pages[6].childAction = 'climbs alone'; }, 'bound_repair_scope'],
      ['an unrelated location', d => { withdraw(d); d.plan.locations.find((l: any) => l.id === 'lane').design += ' with puddles'; }, 'bound_repair_scope'],
      ['the held quote re-cited for the same transition', d => { companionAt6(d).evidence = 'They climb inside the hut again'; }, 'bound_repair_unproven_claim'],
      ['a new companion event on a later frame', d => { withdraw(d); d.sequence.pages[6].transitions.push({ entityId: 'companion', from: { relation: 'beside', targetId: 'hut' },
        to: { relation: 'inside', targetId: 'hut' }, evidence: texts(source)[7].trim() }); }, 'bound_repair_new_event'],
      ['a second companion transition on the same frame', d => { d.sequence.pages[5].transitions.push({ ...structuredClone(companionAt6(d)), evidence: texts(source)[6].trim() }); }, 'bound_repair_new_event'],
      ['an invented destination', d => { companionAt6(d).to = { relation: 'inside', targetId: 'tower' }; }, 'bound_repair_new_id'],
      ['no repair of the target', () => {}, 'bound_repair_target_unchanged'],
    ];
    for (const [name, change, code] of cases) expect(() => compilePersonalStoryboard(source, draftOf(s.f, source, change)), name).toThrow(`personal_storyboard_${code}`);
    const childChanged = draftOf(s.f, source, withdraw); childChanged.plan.actorAppearance.child.clothing = ['green dress', 'blue shorts', 'teal shoes'];
    expect(() => compilePersonalStoryboard(source, childChanged)).toThrow();
  });
  it('negative: the held quote re-spaced is no change, and the held quote (or a part, re-spaced) is no evidence for another known target', async () => {
    const s = await setup(RUN4, true), source = prepare(s.f, s.existing, s.repair);
    const respaced = HELD.replace(' ', '  ').replace(', and', ',\nand');
    expect(respaced).not.toBe(HELD);
    const cases: [string, (d: any) => void, string][] = [
      ['the held quote with internal whitespace only', d => { companionAt6(d).evidence = respaced; }, 'bound_repair_target_unchanged'],
      ['the held quote with another known destination', d => { companionAt6(d).to = { relation: 'at', targetId: 'lane' }; }, 'bound_repair_unproven_claim'],
      ['the held quote re-spaced with another known destination', d => { Object.assign(companionAt6(d), { evidence: respaced, to: { relation: 'beside', targetId: 'hut' } }); }, 'bound_repair_unproven_claim'],
      ['a part of the held quote re-spaced with another known relation', d => { Object.assign(companionAt6(d), { evidence: ' and  the ribbon stays', to: { relation: 'at', targetId: 'garden' } }); },
        'bound_repair_unproven_claim'],
    ];
    for (const [name, change, code] of cases) expect(() => compilePersonalStoryboard(source, draftOf(s.f, source, change)), name).toThrow(`personal_storyboard_${code}`);
  });
  it('at the repair seam: a normalized no-op or the held quote with a known target stops before the review; a withdrawal or a wider span reaches it', async () => {
    const s = await setup(RUN4, true), source = prepare(s.f, s.existing, s.repair);
    const respaced = HELD.replace(' ', '  ');
    const refused: [string, (d: any) => void, string][] = [
      ['normalized no-op', d => { companionAt6(d).evidence = respaced; }, 'bound_repair_target_unchanged'],
      ['held quote, known destination', d => { companionAt6(d).to = { relation: 'at', targetId: 'lane' }; }, 'bound_repair_unproven_claim'],
    ];
    for (const [name, change, code] of refused) {
      const r = await seam(s, draftOf(s.f, source, change));
      expect(r, name).toEqual({ stages: ['storyboard'], stop: `personal_storyboard_${code}` });
    }
    const withdraw = (d: any) => { d.sequence.pages[5].transitions = d.sequence.pages[5].transitions.filter((t: any) => t.entityId !== 'companion'); };
    for (const change of [withdraw, (d: any) => { companionAt6(d).evidence = texts(source)[6].trim(); }])
      expect(await seam(s, draftOf(s.f, source, change))).toEqual({ stages: ['storyboard', 'review'], stop: 'simple_storyboard_diagnostic_review_callback_failed' });
  });
});

describe('the exact run2 shape: a held location finding (location:{id}), provider-free', { timeout: 180_000 }, () => {
  it('positive: only that location changes; the child and every other part re-admit unchanged, fresh, cached and raw', async () => {
    const s = await setup(RUN2, true), source = prepare(s.f, s.existing, s.repair);
    const repaired = draftOf(s.f, source, d => { d.plan.locations.find((l: any) => l.id === 'garden').design += '; lemons and tomatoes visible on their plants'; });
    const r = readmit(s, source, repaired);
    expect([r.cached.storyboardDigest, r.raw.storyboardDigest]).toEqual([r.fresh.storyboardDigest, r.fresh.storyboardDigest]);
    expect(r.fresh.existingChildAppearance).toEqual(existingChildAppearanceData(s.existing));
    expect(r.fresh.plan.locations.find((l: any) => l.id === 'lane')).toEqual(s.bound.plan.locations.find((l: any) => l.id === 'lane'));
    expect(changedSections(s.draft, repaired)).toEqual(['book:plan.locations']);
    expect(r.fresh.plan.pages).toEqual(s.bound.plan.pages);expect(r.fresh.sequence.pages).toEqual(s.bound.sequence.pages);
  });
  it('negative: another location, a frame edit, an entity, the companion, the child or no change are refused', async () => {
    const s = await setup(RUN2, true), source = prepare(s.f, s.existing, s.repair);
    const garden = (d: any) => { d.plan.locations.find((l: any) => l.id === 'garden').design += '; lemons visible'; };
    const cases: [string, (d: any) => void, string][] = [
      ['another location only', d => { d.plan.locations.find((l: any) => l.id === 'lane').design += ' with puddles'; }, 'bound_repair_scope'],
      ['another location with the right one', d => { garden(d); d.plan.locations.find((l: any) => l.id === 'lane').design += ' with puddles'; }, 'bound_repair_scope'],
      ['a frame composition', d => { garden(d); d.plan.pages[2].composition = 'reframed'; }, 'bound_repair_scope'],
      ['an entity invariant', d => { garden(d); d.plan.continuity.entities.find((e: any) => e.id === 'hut').invariants.push({ attribute: 'kind', value: 'hut' }); }, 'bound_repair_scope'],
      ['the location renamed', d => { d.plan.locations.find((l: any) => l.id === 'garden').id = 'orchard'; }, 'bound_repair_scope'],
      ['no change', () => {}, 'bound_repair_target_unchanged'],
    ];
    for (const [name, change, code] of cases) expect(() => compilePersonalStoryboard(source, draftOf(s.f, source, change)), name).toThrow(`personal_storyboard_${code}`);
    const childChanged = draftOf(s.f, source, garden); childChanged.plan.actorAppearance.child.clothing = ['green dress', 'blue shorts', 'teal shoes'];
    expect(() => compilePersonalStoryboard(source, childChanged)).toThrow();
  });
});

describe('the exact run2 shape under the instance contract: a held location finding binds that location\'s population, provider-free', { timeout: 180_000 }, () => {
  const garden = (d: any) => d.plan.locations.find((l: any) => l.id === 'garden');
  it('the generic location ref resolves to the population (must change) and the design (only with it)', async () => {
    const s = await setup(RUN2, true, true), source = prepare(s.f, s.existing, s.repair, true) as any;
    expect(source.planningInput.priorReviewedStoryboard.changeScope).toEqual([{ ref: 'location:garden', kind: 'location',
      may: ['plan.locations[id=garden].{population}', 'plan.locations[id=garden].{design}'] }]);
    // Without the contract (no population declared) the location's own fields stay the target, exactly as before.
    expect(boundRepairChangeScope(boundRepairScope([{ issues: [{ ref: 'location:garden' }] }], (await setup(RUN2, true)).draft))[0].may).toEqual(['plan.locations[id=garden].*']);
  });
  it('positive: a population correction (with or without a matching design change) compiles and re-admits fresh, cached and raw, the child unchanged', async () => {
    const s = await setup(RUN2, true, true), source = prepare(s.f, s.existing, s.repair, true);
    for (const repaired of [draftOf(s.f, source, d => { garden(d).population.push('fruit'); }),
      draftOf(s.f, source, d => { garden(d).population.push('fruit'); garden(d).design += '; lemons and tomatoes visible on their plants'; })]) {
      const r = readmit(s, source, repaired);
      expect([r.cached.storyboardDigest, r.raw.storyboardDigest]).toEqual([r.fresh.storyboardDigest, r.fresh.storyboardDigest]);
      expect(r.fresh.existingChildAppearance).toEqual(existingChildAppearanceData(s.existing));
      expect(changedSections(s.draft, repaired)).toEqual(['book:plan.locations']);
      expect(r.fresh.plan.pages).toEqual(s.bound.plan.pages);
    }
  });
  it('negative: a design-only change, a reordered or re-cased population, another location, a frame, an entity or the child are refused', async () => {
    const s = await setup(RUN2, true, true), source = prepare(s.f, s.existing, s.repair, true);
    const fix = (d: any) => { garden(d).population.push('fruit'); };
    const cases: [string, (d: any) => void, string][] = [
      ['design changed, population unchanged', d => { garden(d).design += ' Soft light across the scene.'; }, 'bound_repair_target_unchanged'],
      ['design names the fruit, population unchanged', d => { garden(d).design += '; lemons and tomatoes visible on their plants'; }, 'bound_repair_target_unchanged'],
      ['population re-cased only', d => { garden(d).population = [' Plant']; }, 'bound_repair_target_unchanged'],
      ['another location\'s population', d => { d.plan.locations.find((l: any) => l.id === 'lane').population.push('fruit'); }, 'bound_repair_scope'],
      ['another location with the right one', d => { fix(d); d.plan.locations.find((l: any) => l.id === 'lane').design += ' with puddles'; }, 'bound_repair_scope'],
      ['a frame composition', d => { fix(d); d.plan.pages[2].composition = 'reframed'; }, 'bound_repair_scope'],
      ['an entity invariant', d => { fix(d); d.plan.continuity.entities.find((e: any) => e.id === 'hut').invariants.push({ attribute: 'material', value: 'stone' }); }, 'bound_repair_scope'],
      ['the location renamed', d => { garden(d).id = 'orchard'; }, 'bound_repair_scope'],
      ['no change', () => {}, 'bound_repair_target_unchanged'],
    ];
    for (const [name, change, code] of cases) expect(() => compilePersonalStoryboard(source, draftOf(s.f, source, change)), name).toThrow(`personal_storyboard_${code}`);
    const childChanged = draftOf(s.f, source, fix); childChanged.plan.actorAppearance.child.clothing = ['green dress', 'blue shorts', 'teal shoes'];
    expect(() => compilePersonalStoryboard(source, childChanged)).toThrow();
  });
  it('at the repair seam: the design-only change stops before the review; the population correction reaches it', async () => {
    const s = await setup(RUN2, true, true), source = prepare(s.f, s.existing, s.repair, true);
    expect(await seam(s, draftOf(s.f, source, d => { garden(d).design += ' Soft light across the scene.'; })))
      .toEqual({ stages: ['storyboard'], stop: 'personal_storyboard_bound_repair_target_unchanged' });
    expect(await seam(s, draftOf(s.f, source, d => { garden(d).population.push('fruit'); })))
      .toEqual({ stages: ['storyboard', 'review'], stop: 'simple_storyboard_diagnostic_review_callback_failed' });
  });
});
