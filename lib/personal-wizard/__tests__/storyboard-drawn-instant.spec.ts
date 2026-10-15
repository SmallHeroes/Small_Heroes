import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { resolvePersonalWizardOptions } from '../options';
import { preparePersonalStoryboard, prepareCurrentPersonalStoryboard, compilePersonalStoryboard, personalStoryboardFrame, personalStoryboardReviewInput,
  storyboardInstructions, storyboardDraftSchema, storyboardReviewDisposition, PERSONAL_STORYBOARD_INSTRUCTION, OWNED_STORYBOARD_INSTRUCTION } from '../storyboard';
import { MOMENT_STORYBOARD_ADDENDUM, MOMENT_REVIEW_ADDENDUM, STORYBOARD_MOMENTS_VERSION, momentWholeBookDraftSchema, ownedMomentWholeBookDraftSchema,
  drawnInstantWholeBookDraftSchema, ownedDrawnInstantWholeBookDraftSchema, validateStoryboardMoments } from '../storyboard-moments';
import { DRAWN_INSTANT_CONTRACT_VERSION, DRAWN_INSTANT_STORYBOARD_ADDENDUM, DRAWN_INSTANT_REVIEW_ADDENDUM, drawnInstantGaps, drawnInstantFinding } from '../storyboard-drawn-instant';
import { STORYBOARD_REPAIR_VERSION, REPAIR_STORYBOARD_ADDENDUM } from '../storyboard-repair';
import { COMPILER_RULES_STORYBOARD_ADDENDUM } from '../storyboard-compiler-rules';
import { SCENE_LOCATION_STORYBOARD_ADDENDUM } from '../storyboard-scene-location';
import { KIND_STORYBOARD_ADDENDUM, KIND_REVIEW_ADDENDUM } from '../storyboard-landmark-kind';
import { personalBookProviderSchema } from '../book-openai';
import { PERSONAL_BOOK_REVIEW_INSTRUCTION } from '../book-runner';
import { previewStoryEvidence } from '../../local-story-preview';
import { runSimpleStoryboardDiagnostic, type SimpleStoryboardDiagnosticCall } from '../simple-storyboard-diagnostic';
import { replanFixture } from './storyboard-replan-fixture';

const options = resolvePersonalWizardOptions();
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
type Fixture = Awaited<ReturnType<typeof personalStoryboardFixture>>;
// Page 6: 'They climb inside the hut again, and the ribbon stays with נועה.' The drawn instant is its first clause; the second clause is later.
const DRAWN = 'They climb inside the hut again', LATER = 'the ribbon stays with נועה';
/** prepare...(request, writerResult, options, appearance, moments, kind, preservation, sceneLocation, compilerRules, repair, drawnInstant). */
const prepare = (f: Fixture, drawnInstant?: true, repair?: unknown) =>
  preparePersonalStoryboard(f.request, f.result, options, undefined, true, undefined, undefined, undefined, undefined, repair as never, drawnInstant);
/** The fixture draft with moments: page 6 drawn at its first clause, both actors still beside the hut; `actorStates` only with the contract. */
function momentDraft(f: Fixture, opts: { drawnInstant?: true; change?: (draft: any) => void } = {}) {
  const count = f.result.manuscript.pages.length;
  const frames: any[] = Array.from({ length: count + 1 }, () => ({ requirements: [], depicted: null }));
  frames[6] = { requirements: [{ kind: 'show', subject: 'the red ribbon still in the child\'s hand', evidence: LATER }],
    depicted: { evidence: DRAWN, attributes: [], relations: ['child', 'companion'].map(entityId =>
      ({ entityId, value: { relation: 'beside', targetId: 'hut' }, evidence: DRAWN })), ...(opts.drawnInstant ? { actorStates: [] } : {}) } };
  const draft: any = { ...structuredClone(f.draft), moments: { version: STORYBOARD_MOMENTS_VERSION, frames } };
  opts.change?.(draft);
  return draft;
}
/** A mutable hut door, opened on page 6 by its later clause. */
const doorOpensLater = (draft: any) => {
  draft.plan.continuity.entities[0].invariants.push({ attribute: 'door', value: 'closed' });
  draft.sequence.mutableAttributes = [{ entityId: 'hut', attribute: 'door' }];
  draft.plan.continuity.pages[6].changes = [{ entityId: 'hut', attribute: 'door', value: 'open', storyEvidence: LATER }];
};
/** The companion's page-6 move is quoted from the later clause. */
const companionMovesLater = (draft: any) => { draft.sequence.pages[5].transitions[1].evidence = LATER; };
const supported = (f: Fixture, book: { sourceDigest: string; storyboardDigest: string }) =>
  ({ ...structuredClone(f.review), sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest });
const held = (review: any) => { const r = structuredClone(review); r.frames[6].checks[2] = { ...r.frames[6].checks[2], verdict: 'contradiction', observation: 'page 6 state' }; return r; };

describe('drawn-instant contract (opt-in; completes the moments contract\'s drawn instant)', () => {
  it('absent: every existing identity, instruction, schema and validation is byte-identical', async () => {
    const f = await personalStoryboardFixture();
    expect(preparePersonalStoryboard(f.request, f.result, options).sourceDigest).toBe('f1ad9a28816945b860324527a4050018ecd43cbb4eae2bd01b60975dfc4344f5');
    expect(preparePersonalStoryboard(f.request, f.result, options, true).sourceDigest).toBe('a72da5d557dba2e097c190febd3c0940ed1ac6a9b292f2b4e12aebb4ef379edb');
    expect(f.book.storyboardDigest).toBe('cb09f0812bafb902f1a7c27de12cc0593636b42b2e33498ac9501c20402c8c1f');
    expect(personalStoryboardFrame(f.book, f.review, 1, f.current).packetDigest).toBe('d737d76dc01ff5f9311247ec78c78a79cdf09b4579802a0b3a7160e8454514a1');
    expect(sha(PERSONAL_STORYBOARD_INSTRUCTION)).toBe('858f442ec1fde66c0ae79382fa961a50b1fd88803599570799264527edcc04bd');
    const all = { actorOwnedAppearance: true, momentContract: true, landmarkKindContract: true, sceneLocationContract: true, compilerRulesContract: true } as const;
    expect(storyboardInstructions(all)).toBe(`${OWNED_STORYBOARD_INSTRUCTION}\n${MOMENT_STORYBOARD_ADDENDUM}\n${KIND_STORYBOARD_ADDENDUM}\n${SCENE_LOCATION_STORYBOARD_ADDENDUM}\n${COMPILER_RULES_STORYBOARD_ADDENDUM}`);
    expect([storyboardDraftSchema({ momentContract: true }), storyboardDraftSchema({ momentContract: true, actorOwnedAppearance: true })])
      .toEqual([momentWholeBookDraftSchema, ownedMomentWholeBookDraftSchema]);
    const plain = prepare(f), book = compilePersonalStoryboard(plain, momentDraft(f));
    expect('drawnInstant' in book).toBe(false);
    expect('drawnInstantContract' in plain).toBe(false);
    // Without the contract, actorStates are not part of the moments shape at all.
    expect(() => compilePersonalStoryboard(prepare(f), momentDraft(f, { drawnInstant: true }))).toThrow();
    const provider = personalBookProviderSchema({ stage: 'storyboard', instructions: '', input: '', maxOutputTokens: 1,
      context: { narrativeSpreads: 8, sourceDigest: 'a'.repeat(64), momentContract: true } }) as any;
    expect(JSON.stringify(provider.shape.moments.shape.frames.element.shape.depicted.unwrap().shape)).not.toContain('actorStates');
    expect(Object.keys(provider.shape.moments.shape.frames.element.shape.depicted.unwrap().shape).sort()).toEqual(['attributes', 'evidence', 'relations']);
  });

  it('on: needs the moments contract; adds its addendum (before a repair\'s), its schema, its marker and a new source', async () => {
    const f = await personalStoryboardFixture();
    expect(() => preparePersonalStoryboard(f.request, f.result, options, undefined, undefined, undefined, undefined, undefined, undefined, undefined, true))
      .toThrow('personal_storyboard_drawn_instant_policy');
    expect(() => prepare(f, 'yes' as never)).toThrow('personal_storyboard_drawn_instant_policy');
    const plain = prepare(f), on = prepare(f, true);
    expect(on.sourceDigest).not.toBe(plain.sourceDigest);
    expect(storyboardInstructions(on)).toBe(`${PERSONAL_STORYBOARD_INSTRUCTION}\n${MOMENT_STORYBOARD_ADDENDUM}\n${DRAWN_INSTANT_STORYBOARD_ADDENDUM}`);
    const all = { actorOwnedAppearance: true, momentContract: true, landmarkKindContract: true, sceneLocationContract: true, compilerRulesContract: true } as const;
    expect(storyboardInstructions({ ...all, drawnInstantContract: true, repair: {} }))
      .toBe(`${storyboardInstructions(all)}\n${DRAWN_INSTANT_STORYBOARD_ADDENDUM}\n${REPAIR_STORYBOARD_ADDENDUM}`);
    expect([storyboardDraftSchema(on), storyboardDraftSchema({ ...on, actorOwnedAppearance: true })])
      .toEqual([drawnInstantWholeBookDraftSchema, ownedDrawnInstantWholeBookDraftSchema]);
    expect(on.planningInput).toEqual({ ...plain.planningInput, personalSourceDigest: on.sourceDigest });
    const book = compilePersonalStoryboard(on, momentDraft(f, { drawnInstant: true }));
    expect(book.drawnInstant).toBe(DRAWN_INSTANT_CONTRACT_VERSION);
    expect([book.plan, book.sequence]).toEqual([f.book.plan, f.book.sequence]);
    // The provider schema carries actorStates exactly when the contract is on (and refuses the flag without moments).
    const ctx = { narrativeSpreads: 8, sourceDigest: 'a'.repeat(64), momentContract: true as const, drawnInstantContract: true as const };
    const provider = personalBookProviderSchema({ stage: 'storyboard', instructions: '', input: '', maxOutputTokens: 1, context: ctx }) as any;
    expect(Object.keys(provider.shape.moments.shape.frames.element.shape.depicted.unwrap().shape).sort()).toEqual(['actorStates', 'attributes', 'evidence', 'relations']);
    expect(() => personalBookProviderSchema({ stage: 'storyboard', instructions: '', input: '', maxOutputTokens: 1,
      context: { narrativeSpreads: 8, sourceDigest: 'a'.repeat(64), drawnInstantContract: true } })).toThrow('book_provider_context');
  });

  it('actorStates: a temporary look of a visible child or companion, quoted on its page; an instant may be that alone', async () => {
    const f = await personalStoryboardFixture(), on = prepare(f, true);
    const look = (change: (d: any) => void) => momentDraft(f, { drawnInstant: true, change: draft => change(draft.moments.frames[6].depicted) });
    // An instant of only a look: no relation or attribute differs, the companion's look does.
    const onlyLook = look(d => { d.relations = []; d.actorStates = [{ actorId: 'companion', state: 'tail squashed flat', evidence: DRAWN }]; });
    const book = compilePersonalStoryboard(on, onlyLook);
    expect(book.moments!.frames[6].depicted).toMatchObject({ relations: [], actorStates: [{ actorId: 'companion', state: 'tail squashed flat' }] });
    // Without the contract the same instant has nothing declared.
    const { actorStates: _, ...bare } = onlyLook.moments.frames[6].depicted;
    expect(() => compilePersonalStoryboard(prepare(f), { ...onlyLook, moments: { ...onlyLook.moments, frames: onlyLook.moments.frames.map((fr: any, i: number) =>
      i === 6 ? { ...fr, depicted: bare } : fr) } })).toThrow('storyboard_moments_depicted_empty');
    // Every depicted lists actorStates under the contract; an empty instant is still refused.
    expect(() => compilePersonalStoryboard(on, look(d => { delete d.actorStates; }))).toThrow();
    expect(() => compilePersonalStoryboard(on, look(d => { d.relations = []; }))).toThrow('storyboard_moments_depicted_empty');
    for (const [code, change] of [
      ['depicted_evidence', (d: any) => { d.actorStates = [{ actorId: 'child', state: 'soaked hair', evidence: 'not on this page' }]; }],
      ['duplicate_actor_state', (d: any) => { d.actorStates = [{ actorId: 'child', state: 'soaked hair', evidence: DRAWN }, { actorId: 'child', state: 'tangled scarf', evidence: DRAWN }]; }],
    ] as const) expect(() => compilePersonalStoryboard(on, look(change))).toThrow(`storyboard_moments_${code}`);
    // Only the two actor roles, never another entity's state.
    expect(() => compilePersonalStoryboard(on, look(d => { d.actorStates = [{ actorId: 'hut', state: 'door ajar', evidence: DRAWN }]; }))).toThrow();
    // Only an actor visible on that page (page 2 shows the child alone).
    const page2 = momentDraft(f, { drawnInstant: true, change: draft => { draft.moments.frames[2].depicted = { evidence: 'They look out from inside the hut',
      relations: [], attributes: [], actorStates: [{ actorId: 'companion', state: 'ears flattened', evidence: 'They look out from inside the hut' }] }; } });
    expect(() => compilePersonalStoryboard(on, page2)).toThrow('storyboard_moments_actor_state_not_visible');
    // The renderer, the judge and the review all see the declared look.
    const review = supported(f, book), frame = personalStoryboardFrame(book, review, 6, f.current);
    expect(frame.render.prompt).toContain(`AT THIS INSTANT ONLY (temporary look, not the end of the page):\n- companion: tail squashed flat (text: "${DRAWN}")`);
    expect((frame.context.sequence as any).drawnInstant.actorStates).toEqual([{ actorId: 'companion', state: 'tail squashed flat', evidence: DRAWN }]);
    expect(personalStoryboardReviewInput(book)).toMatchObject({ moments: { frames: expect.arrayContaining([expect.objectContaining({
      depicted: expect.objectContaining({ actorStates: [expect.objectContaining({ actorId: 'companion' })] }) })]) } });
    // An instant with no look keeps the old render text (the key is there, the line is not).
    const plainFrame = personalStoryboardFrame(compilePersonalStoryboard(on, momentDraft(f, { drawnInstant: true })), supported(f,
      compilePersonalStoryboard(on, momentDraft(f, { drawnInstant: true }))), 6, f.current);
    expect(plainFrame.render.prompt).not.toContain('AT THIS INSTANT ONLY');
  });

  it('completeness: a change the page makes after the drawn instant must be overridden - offscreen too; earlier changes need nothing', async () => {
    const f = await personalStoryboardFixture(), on = prepare(f, true), off = prepare(f);
    // The fixture's page-6 moves quote the whole page (they start at its first word): nothing after the instant, nothing to override.
    const childOnly = (draft: any) => { draft.moments.frames[6].depicted.relations = draft.moments.frames[6].depicted.relations.slice(0, 1); };
    expect(compilePersonalStoryboard(on, momentDraft(f, { drawnInstant: true, change: childOnly })).drawnInstant).toBe(DRAWN_INSTANT_CONTRACT_VERSION);
    // The companion's move quoted from the later clause has not happened at the instant.
    const later = (draft: any) => { companionMovesLater(draft); childOnly(draft); };
    expect(() => compilePersonalStoryboard(on, momentDraft(f, { drawnInstant: true, change: later }))).toThrow('storyboard_moments_drawn_instant_relation');
    expect(compilePersonalStoryboard(on, momentDraft(f, { drawnInstant: true, change: companionMovesLater }))).toBeTruthy();
    // Offscreen still counts: the companion off the page's cast changes nothing.
    const offscreen = (draft: any) => { later(draft); draft.sequence.pages[5].visibleCastIds = ['child']; };
    expect(() => compilePersonalStoryboard(on, momentDraft(f, { drawnInstant: true, change: offscreen }))).toThrow('storyboard_moments_drawn_instant_relation');
    // An attribute the page changes later (the door) must be given its value at the instant.
    expect(() => compilePersonalStoryboard(on, momentDraft(f, { drawnInstant: true, change: doorOpensLater }))).toThrow('storyboard_moments_drawn_instant_attribute');
    const declared = (draft: any) => { doorOpensLater(draft); draft.moments.frames[6].depicted.attributes = [{ entityId: 'hut', attribute: 'door', value: 'closed', evidence: DRAWN }]; };
    expect(compilePersonalStoryboard(on, momentDraft(f, { drawnInstant: true, change: declared })).moments!.frames[6].depicted!.attributes).toHaveLength(1);
    // A change quoted at or before the instant has happened: no override needed.
    const doorAtInstant = (draft: any) => { doorOpensLater(draft); draft.plan.continuity.pages[6].changes[0].storyEvidence = DRAWN; };
    expect(compilePersonalStoryboard(on, momentDraft(f, { drawnInstant: true, change: doorAtInstant }))).toBeTruthy();
    // Without the contract the same gaps compile as before (the check is the contract's).
    expect(compilePersonalStoryboard(off, momentDraft(f, { change: later }))).toBeTruthy();
    expect(compilePersonalStoryboard(off, momentDraft(f, { change: doorOpensLater }))).toBeTruthy();
    // The gaps themselves (what a repair of such a storyboard is told), in page order: moves first, then attributes.
    const gapBook = compilePersonalStoryboard(off, momentDraft(f, { change: d => { later(d); doorOpensLater(d); } }));
    const gaps = drawnInstantGaps(gapBook.moments!, gapBook.plan, gapBook.sequence, previewStoryEvidence(off.story).texts);
    expect(gaps).toEqual([
      { pageNumber: 6, drawnEvidence: DRAWN, changeEvidence: LATER, kind: 'relation', entityId: 'companion', to: { relation: 'inside', targetId: 'hut' } },
      { pageNumber: 6, drawnEvidence: DRAWN, changeEvidence: LATER, kind: 'attribute', entityId: 'hut', attribute: 'door', value: 'open' }]);
    expect(drawnInstantFinding(gaps[1])).toEqual({ scope: 'page', pageNumber: 6, category: 'drawn_instant_completeness', verdict: 'contradiction',
      observation: `The drawn instant ("${DRAWN}") comes before this page's later change ("${LATER}"): hut.door is not yet "open" at that instant, and depicted does not declare its state then.` });
    expect(() => validateStoryboardMoments(gapBook.moments, gapBook.plan, gapBook.sequence, previewStoryEvidence(off.story).texts, 'yes' as never)).toThrow('drawn_instant_policy');
  });

  it('the diagnostic: the storyboard call carries the addendum and its schema, the review call its own line; absent, both calls are unchanged', async () => {
    const r = await replanFixture();
    async function run(drawnInstant?: true) {
      const calls: SimpleStoryboardDiagnosticCall[] = [];
      const generate = vi.fn(async (call: SimpleStoryboardDiagnosticCall) => {
        calls.push(call);
        if (call.stage === 'storyboard') {
          const count = r.writerResult.manuscript.pages.length;
          return { ...structuredClone(r.draft), moments: { version: STORYBOARD_MOMENTS_VERSION,
            frames: Array.from({ length: count + 1 }, () => ({ requirements: [], depicted: null })) } };
        }
        return { ...structuredClone(r.review), sourceDigest: call.context.sourceDigest, storyboardDigest: call.context.storyboardDigest };
      });
      const result = await runSimpleStoryboardDiagnostic({ request: r.request, writerResult: r.writerResult, options: r.options, signal: new AbortController().signal,
        generate, actorOwnedAppearance: true, momentContract: true, ...(drawnInstant ? { drawnInstantContract: true as const } : {}) });
      return { calls, result };
    }
    const base = await run(), on = await run(true);
    expect(on.calls[0].instructions).toBe(`${base.calls[0].instructions}\n${DRAWN_INSTANT_STORYBOARD_ADDENDUM}`);
    expect(on.calls[0].context).toEqual({ ...base.calls[0].context, sourceDigest: on.result.sourceDigest, drawnInstantContract: true });
    expect(base.calls[1].instructions).toBe(`${PERSONAL_BOOK_REVIEW_INSTRUCTION}\n${MOMENT_REVIEW_ADDENDUM}`);
    expect(on.calls[1].instructions).toBe(`${base.calls[1].instructions}\n${DRAWN_INSTANT_REVIEW_ADDENDUM}`);
    expect(on.result.storyboard.drawnInstant).toBe(DRAWN_INSTANT_CONTRACT_VERSION);
    expect(base.result.storyboard).not.toHaveProperty('drawnInstant');
    expect(KIND_REVIEW_ADDENDUM).toBeTruthy();
  });
});

describe('a repair of a repair (the parent is itself a repaired storyboard; a repair may add the drawn-instant contract)', () => {
  /**
   * P0: the moments storyboard with the companion's move quoted after the drawn instant and not overridden (legal without the contract), held
   * by its review. P1: its repair under the same contracts (same draft), held again. R2: a repair of P1 that adds the drawn-instant contract.
   */
  async function chain() {
    const f = await personalStoryboardFixture();
    const gapDraft = momentDraft(f, { change: d => { companionMovesLater(d); d.moments.frames[6].depicted.relations = d.moments.frames[6].depicted.relations.slice(0, 1); } });
    const p0 = compilePersonalStoryboard(prepare(f), gapDraft), p0Review = held(supported(f, p0));
    const r1 = { parentStoryboardDigest: p0.storyboardDigest, draft: gapDraft, review: p0Review };
    const p1 = compilePersonalStoryboard(prepare(f, undefined, r1), gapDraft), p1Review = held(supported(f, p1));
    const r2 = { parentStoryboardDigest: p1.storyboardDigest, draft: gapDraft, review: p1Review, parentRepair: r1, addedContracts: ['drawnInstantContract'] };
    return { f, gapDraft, p0, p1, r1, p1Review, r2 };
  }
  it('binds the parent with its own repair and without the added contract; the planner is told the review\'s and the compiler\'s findings', async () => {
    const { f, gapDraft, p1, r1, p1Review, r2 } = await chain();
    const source = prepare(f, true, r2);
    expect(source.repair).toEqual(r2);
    const prior = (source.planningInput as any).priorReviewedStoryboard;
    expect(prior).toEqual({ version: STORYBOARD_REPAIR_VERSION, parentStoryboardDigest: p1.storyboardDigest, storyboard: gapDraft,
      reviewFindings: [{ scope: 'page', pageNumber: 6, category: p1Review.frames[6].checks[2].category, verdict: 'contradiction', observation: 'page 6 state' }],
      contractFindings: [drawnInstantFinding({ pageNumber: 6, drawnEvidence: DRAWN, changeEvidence: LATER, kind: 'relation', entityId: 'companion',
        to: { relation: 'inside', targetId: 'hut' } })] });
    expect(storyboardInstructions(source)).toBe(`${PERSONAL_STORYBOARD_INSTRUCTION}\n${MOMENT_STORYBOARD_ADDENDUM}\n${DRAWN_INSTANT_STORYBOARD_ADDENDUM}\n${REPAIR_STORYBOARD_ADDENDUM}`);
    // The repaired storyboard declares the move and passes the contract; it names its parent and carries the contract's marker.
    const fixed = structuredClone(gapDraft); fixed.moments.frames[6].depicted.relations = momentDraft(f).moments.frames[6].depicted.relations;
    fixed.moments.frames.forEach((fr: any) => { if (fr.depicted) fr.depicted.actorStates = []; });
    const book = compilePersonalStoryboard(source, fixed);
    expect([book.repair, book.drawnInstant]).toEqual([{ version: STORYBOARD_REPAIR_VERSION, parentStoryboardDigest: p1.storyboardDigest }, DRAWN_INSTANT_CONTRACT_VERSION]);
    // Its frames re-derive the same nested source from the current inputs.
    const review = supported(f, book);
    expect(storyboardReviewDisposition(book, review).disposition).toBe('review_supported');
    expect(personalStoryboardFrame(book, review, 6, f.current).context.sourceDigest).toBe(book.sourceDigest);
    expect(prepareCurrentPersonalStoryboard(f.request, f.result, options, undefined, true, undefined, undefined, undefined, undefined, r2 as never, true).sourceDigest)
      .toBe(source.sourceDigest);
    // Still the same gap in the returned plan: the compiler refuses it under the contract.
    expect(() => compilePersonalStoryboard(source, { ...structuredClone(gapDraft), moments: { ...gapDraft.moments, frames: gapDraft.moments.frames.map((fr: any) =>
      fr.depicted ? { ...fr, depicted: { ...fr.depicted, actorStates: [] } } : fr) } })).toThrow('storyboard_moments_drawn_instant_relation');
    // The nested input binds: the parent's own repair, the parent's contracts, the review that holds it.
    const bad = (change: (r: any) => void) => { const r = structuredClone(r2) as any; change(r); return r; };
    expect(() => prepare(f, true, bad(r => { delete r.parentRepair; }))).toThrow('personal_storyboard_repair_binding');
    expect(() => prepare(f, true, bad(r => { r.parentRepair.review.frames[6].checks[2].observation = 'reworded'; }))).toThrow('personal_storyboard_repair_binding');
    expect(() => prepare(f, true, bad(r => { delete r.addedContracts; }))).toThrow('personal_storyboard_repair_binding');
    expect(() => prepare(f, undefined, r2)).toThrow('personal_storyboard_repair_policy');
    expect(() => prepare(f, true, bad(r => { r.review = supported(f, p1); }))).toThrow('personal_storyboard_repair_not_held');
    for (const shape of [(r: any) => { r.addedContracts = []; }, (r: any) => { r.addedContracts = ['compilerRulesContract']; },
      (r: any) => { r.addedContracts = ['drawnInstantContract', 'drawnInstantContract']; }, (r: any) => { r.parentRepair = 'r1'; },
      (r: any) => { r.parentRepair = { ...r.parentRepair, extra: 1 }; }, (r: any) => { r.extra = 1; }])
      expect(() => prepare(f, true, bad(shape))).toThrow('personal_storyboard_repair_policy');
    let deep: any = structuredClone(r1);
    for (let i = 0; i < 4; i++) deep = { ...structuredClone(r1), parentRepair: deep };
    expect(() => prepare(f, undefined, deep)).toThrow('personal_storyboard_repair_policy');
    // The source identity binds the nested input: another holding review of the grandparent is another source chain.
    expect(r1.review).toBeTruthy();
  });
  it('a repair under the same contracts as a drawn-instant parent adds nothing and is told no compiler findings', async () => {
    const f = await personalStoryboardFixture(), draft = momentDraft(f, { drawnInstant: true });
    const parent = compilePersonalStoryboard(prepare(f, true), draft), review = held(supported(f, parent));
    const source = prepare(f, true, { parentStoryboardDigest: parent.storyboardDigest, draft, review });
    expect((source.planningInput as any).priorReviewedStoryboard).not.toHaveProperty('contractFindings');
    // Added on top of a parent that already had it: that parent is recompiled without it, so it is not that parent.
    expect(() => prepare(f, true, { parentStoryboardDigest: parent.storyboardDigest, draft, review, addedContracts: ['drawnInstantContract'] })).toThrow();
  });
});
