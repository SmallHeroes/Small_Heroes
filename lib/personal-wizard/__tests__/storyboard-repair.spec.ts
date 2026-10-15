import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { replanFixture } from './storyboard-replan-fixture';
import { resolvePersonalWizardOptions } from '../options';
import { canonicalJson } from '../request-acceptance';
import { preparePersonalStoryboard, prepareCurrentPersonalStoryboard, compilePersonalStoryboard, personalStoryboardFrame, personalStoryboardReviewInput,
  storyboardInstructions, storyboardDraftSchema, storyboardReviewDisposition, PERSONAL_STORYBOARD_INSTRUCTION, OWNED_STORYBOARD_INSTRUCTION } from '../storyboard';
import { STORYBOARD_REPAIR_VERSION, REPAIR_STORYBOARD_ADDENDUM, storyboardRepairFindings, storyboardRepairChanges } from '../storyboard-repair';
import { COMPILER_RULES_STORYBOARD_ADDENDUM } from '../storyboard-compiler-rules';
import { SCENE_LOCATION_STORYBOARD_ADDENDUM } from '../storyboard-scene-location';
import { MOMENT_STORYBOARD_ADDENDUM } from '../storyboard-moments';
import { KIND_STORYBOARD_ADDENDUM } from '../storyboard-landmark-kind';
import { PERSONAL_BOOK_REVIEW_INSTRUCTION } from '../book-runner';
import { personalBookOutputLimits } from '../book-config';
import { runSimpleStoryboardDiagnostic, type SimpleStoryboardDiagnosticCall } from '../simple-storyboard-diagnostic';

const options = resolvePersonalWizardOptions();
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
type Review = Awaited<ReturnType<typeof personalStoryboardFixture>>['review'];
/** The fixture's supported review, held: one book check contradicted, page 3's first check contradicted, page 5's third check uncertain. */
const held = (review: Review) => {
  const r = structuredClone(review) as any;
  r.bookChecks[1] = { ...r.bookChecks[1], verdict: 'contradiction', observation: 'book-level observation' };
  r.frames[3].checks[0] = { ...r.frames[3].checks[0], verdict: 'contradiction', observation: 'page 3 observation' };
  r.frames[5].checks[2] = { ...r.frames[5].checks[2], verdict: 'uncertain', observation: 'page 5 observation' };
  return r as Review;
};
/** prepare...(request, writerResult, options, appearance, moments, kind, preservation, sceneLocation, compilerRules, repair). */
const prepare = (f: { request: unknown; result: unknown }, repair?: unknown, contracts: { compilerRules?: true } = {}) =>
  preparePersonalStoryboard(f.request, f.result, options, undefined, undefined, undefined, undefined, undefined, contracts.compilerRules, repair as never);

describe('storyboard repair contract (opt-in, bound to a held parent of the same source)', () => {
  it('absent: every existing identity and instruction is byte-identical (the pins the earlier contracts were held to)', async () => {
    const f = await personalStoryboardFixture();
    expect(preparePersonalStoryboard(f.request, f.result, options).sourceDigest).toBe('f1ad9a28816945b860324527a4050018ecd43cbb4eae2bd01b60975dfc4344f5');
    expect(preparePersonalStoryboard(f.request, f.result, options, true).sourceDigest).toBe('a72da5d557dba2e097c190febd3c0940ed1ac6a9b292f2b4e12aebb4ef379edb');
    expect(f.book.storyboardDigest).toBe('cb09f0812bafb902f1a7c27de12cc0593636b42b2e33498ac9501c20402c8c1f');
    expect(personalStoryboardFrame(f.book, f.review, 1, f.current).packetDigest).toBe('d737d76dc01ff5f9311247ec78c78a79cdf09b4579802a0b3a7160e8454514a1');
    expect(sha(PERSONAL_STORYBOARD_INSTRUCTION)).toBe('858f442ec1fde66c0ae79382fa961a50b1fd88803599570799264527edcc04bd');
    expect(sha(OWNED_STORYBOARD_INSTRUCTION)).toBe('a2286e4848e970b8ccef0917b0580801dbd64ab664b873f5774c3d3cc29fc8e7');
    const all = { actorOwnedAppearance: true, momentContract: true, landmarkKindContract: true, sceneLocationContract: true, compilerRulesContract: true } as const;
    expect(storyboardInstructions(all)).toBe(`${OWNED_STORYBOARD_INSTRUCTION}\n${MOMENT_STORYBOARD_ADDENDUM}\n${KIND_STORYBOARD_ADDENDUM}\n${SCENE_LOCATION_STORYBOARD_ADDENDUM}\n${COMPILER_RULES_STORYBOARD_ADDENDUM}`);
    expect('repair' in f.book).toBe(false);
    expect('repair' in prepare(f)).toBe(false);
    expect('priorReviewedStoryboard' in prepare(f).planningInput).toBe(false);
  });

  it('on: exactly the addendum (last), the held storyboard and its own unsupported checks in the planning input; no schema change', async () => {
    const f = await personalStoryboardFixture(), review = held(f.review);
    const plain = prepare(f), source = prepare(f, { parentStoryboardDigest: f.book.storyboardDigest, draft: f.draft, review });
    expect(source.sourceDigest).not.toBe(plain.sourceDigest);
    expect(storyboardInstructions(source)).toBe(`${PERSONAL_STORYBOARD_INSTRUCTION}\n${REPAIR_STORYBOARD_ADDENDUM}`);
    const all = { actorOwnedAppearance: true, momentContract: true, landmarkKindContract: true, sceneLocationContract: true, compilerRulesContract: true } as const;
    expect(storyboardInstructions({ ...all, repair: {} })).toBe(`${storyboardInstructions(all)}\n${REPAIR_STORYBOARD_ADDENDUM}`);
    expect(storyboardDraftSchema(source)).toBe(storyboardDraftSchema(plain));
    const { priorReviewedStoryboard, ...rest } = source.planningInput as typeof source.planningInput & { priorReviewedStoryboard: unknown };
    // Everything else is the plain input, but for the source digest that records the repair.
    expect(rest).toEqual({ ...plain.planningInput, personalSourceDigest: source.sourceDigest });
    expect(plain.planningInput.personalSourceDigest).toBe(plain.sourceDigest);
    expect(priorReviewedStoryboard).toEqual({ version: STORYBOARD_REPAIR_VERSION, parentStoryboardDigest: f.book.storyboardDigest, storyboard: f.draft,
      reviewFindings: [
        { scope: 'book', category: review.bookChecks[1].category, verdict: 'contradiction', observation: 'book-level observation' },
        { scope: 'page', pageNumber: 3, category: review.frames[3].checks[0].category, verdict: 'contradiction', observation: 'page 3 observation' },
        { scope: 'page', pageNumber: 5, category: review.frames[5].checks[2].category, verdict: 'uncertain', observation: 'page 5 observation' }] });
    // The source keeps the repair input (so a current re-admission and every frame packet re-derive it).
    expect(source.repair).toEqual({ parentStoryboardDigest: f.book.storyboardDigest, draft: f.draft, review });
    // The source identity binds the whole review: another holding review of the same parent (one observation reworded) is another source.
    const reworded = structuredClone(review) as any; reworded.frames[3].checks[0].observation = 'page 3 observation, reworded';
    expect(prepare(f, { parentStoryboardDigest: f.book.storyboardDigest, draft: f.draft, review: reworded }).sourceDigest).not.toBe(source.sourceDigest);
  });

  it('on: the compiled book names its parent (marker in the book and its digest); the review input never sees the repair', async () => {
    const f = await personalStoryboardFixture(), review = held(f.review);
    const source = prepare(f, { parentStoryboardDigest: f.book.storyboardDigest, draft: f.draft, review });
    const book = compilePersonalStoryboard(source, f.draft);
    expect(book.repair).toEqual({ version: STORYBOARD_REPAIR_VERSION, parentStoryboardDigest: f.book.storyboardDigest });
    expect([book.plan, book.sequence]).toEqual([f.book.plan, f.book.sequence]);
    expect(book.storyboardDigest).not.toBe(f.book.storyboardDigest);
    const input = personalStoryboardReviewInput(book), plainInput = personalStoryboardReviewInput(f.book);
    expect(Object.keys(input).sort()).toEqual(Object.keys(plainInput).sort());
    expect(JSON.stringify(input)).not.toContain('priorReviewedStoryboard');
    expect(JSON.stringify(input)).not.toContain(STORYBOARD_REPAIR_VERSION);
    // A fresh review of the repaired book: its own digests; frames re-derive the same repaired source from the current inputs.
    const fresh = { ...structuredClone(f.review), sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest };
    expect(storyboardReviewDisposition(book, fresh).disposition).toBe('review_supported');
    expect(personalStoryboardFrame(book, fresh, 1, f.current).context.sourceDigest).toBe(book.sourceDigest);
    expect(prepareCurrentPersonalStoryboard(f.request, f.result, options, undefined, undefined, undefined, undefined, undefined, undefined,
      { parentStoryboardDigest: f.book.storyboardDigest, draft: f.draft, review }).sourceDigest).toBe(source.sourceDigest);
    // The parent's own review never approves the repaired book.
    expect(() => storyboardReviewDisposition(book, review)).toThrow('personal_storyboard_review_binding');
  });

  it('binding: the parent must recompile, under the SAME contracts, to its digest, and its own review must hold it', async () => {
    const f = await personalStoryboardFixture(), review = held(f.review);
    const repair = (change: (r: any) => void) => { const r = { parentStoryboardDigest: f.book.storyboardDigest, draft: structuredClone(f.draft), review: structuredClone(review) }; change(r); return r; };
    expect(() => prepare(f, repair(r => { r.parentStoryboardDigest = 'f'.repeat(64); }))).toThrow('personal_storyboard_repair_binding');
    expect(() => prepare(f, repair(r => { r.draft.plan.pages[2].composition += ' changed'; }))).toThrow('personal_storyboard_repair_binding');
    // The same parent under another contract set is another parent.
    expect(() => prepare(f, repair(() => {}), { compilerRules: true })).toThrow('personal_storyboard_repair_binding');
    // A review that supports the parent is nothing to repair; a review of another storyboard is not its review; an incomplete one is refused.
    expect(() => prepare(f, repair(r => { r.review = structuredClone(f.review); }))).toThrow('personal_storyboard_repair_not_held');
    expect(() => prepare(f, repair(r => { r.review.storyboardDigest = 'e'.repeat(64); }))).toThrow('personal_storyboard_review_binding');
    expect(() => prepare(f, repair(r => { r.review.frames[2].checks[1].category = r.review.frames[2].checks[0].category; })))
      .toThrow('personal_storyboard_review_coverage');
    for (const malformed of [(r: any) => { r.review.frames.pop(); }, (r: any) => { r.review.frames[2].checks[0].verdict = 'maybe'; }])
      expect(() => prepare(f, repair(malformed))).toThrow();
    // A held review of the right parent is accepted; uncertain alone holds it too.
    const uncertain = structuredClone(f.review) as any; uncertain.frames[1].checks[1].verdict = 'uncertain';
    expect(prepare(f, repair(r => { r.review = uncertain; })).repair).toBeTruthy();
  });

  it('policy: the repair input has exactly its shape, and a repair never rides on a preservation re-plan', async () => {
    const f = await personalStoryboardFixture(), review = held(f.review), ok = { parentStoryboardDigest: f.book.storyboardDigest, draft: f.draft, review };
    for (const bad of [null, 'repair', [], { ...ok, extra: 1 }, { parentStoryboardDigest: ok.parentStoryboardDigest, draft: f.draft },
      { ...ok, parentStoryboardDigest: 'ABC' }, { ...ok, parentStoryboardDigest: ok.parentStoryboardDigest.toUpperCase() }, { ...ok, draft: [] },
      { ...ok, draft: null }, { ...ok, review: [] }, { ...ok, review: 'held' }])
      expect(() => prepare(f, bad)).toThrow('personal_storyboard_repair_policy');
    const r = await replanFixture(), p = { parentStoryboardDigest: r.book.storyboardDigest, draft: r.draft };
    const heldReplan = { parentStoryboardDigest: r.book.storyboardDigest, draft: r.draft, review: held(r.review as Review) };
    expect(() => prepareCurrentPersonalStoryboard(r.request, r.writerResult, r.options, true, undefined, true, p, undefined, undefined, heldReplan))
      .toThrow('personal_storyboard_repair_policy');
  });

  it('findings are every unsupported check of the validated review, verbatim, book checks first then pages in order', async () => {
    const f = await personalStoryboardFixture();
    expect(storyboardRepairFindings(f.review)).toEqual([]);
    const r = held(f.review) as any;
    r.frames[0].checks[1] = { ...r.frames[0].checks[1], verdict: 'uncertain', observation: 'cover observation' };
    expect(storyboardRepairFindings(r).map((x: any) => [x.scope, x.pageNumber ?? null, x.verdict, x.observation])).toEqual([
      ['book', null, 'contradiction', 'book-level observation'], ['page', 0, 'uncertain', 'cover observation'],
      ['page', 3, 'contradiction', 'page 3 observation'], ['page', 5, 'uncertain', 'page 5 observation']]);
  });

  it('the changes report (review only, never a gate) lists every changed leaf path', async () => {
    const f = await personalStoryboardFixture(), d = structuredClone(f.draft) as any;
    expect(storyboardRepairChanges(f.draft, structuredClone(f.draft))).toEqual([]);
    d.plan.pages[2].composition = 'another framing'; d.sequence.pages[4].beat = 'another beat';
    expect(storyboardRepairChanges(f.draft, d)).toEqual(['plan.pages[2].composition', 'sequence.pages[4].beat']);
    d.plan.recurringProps.push({ id: 'stone', design: 'a round stone' });
    expect(storyboardRepairChanges(f.draft, d)).toContain('plan.recurringProps');
  });
});

describe('the storyboard diagnostic with a repair: the same calls at the normal caps, the repair only in the storyboard request', () => {
  async function run(repair?: unknown) {
    const r = await replanFixture(), calls: SimpleStoryboardDiagnosticCall[] = [];
    const generate = vi.fn(async (call: SimpleStoryboardDiagnosticCall) => {
      calls.push(call);
      if (call.stage === 'storyboard') return structuredClone(r.draft);
      return { ...structuredClone(r.review), sourceDigest: call.context.sourceDigest, storyboardDigest: call.context.storyboardDigest };
    });
    const result = await runSimpleStoryboardDiagnostic({ request: r.request, writerResult: r.writerResult, options: r.options, signal: new AbortController().signal,
      generate, actorOwnedAppearance: true, ...(repair ? { repair: repair as never } : {}) });
    return { r, calls, result };
  }
  it('the storyboard call gains the addendum and the prior storyboard at the same cap; the review call is unchanged', async () => {
    const base = await run(), r = base.r;
    const repaired = await run({ parentStoryboardDigest: r.book.storyboardDigest, draft: r.draft, review: held(r.review as Review) });
    const caps = personalBookOutputLimits(r.writerResult.manuscript.pages.length);
    expect(repaired.calls.map(c => [c.stage, c.maxOutputTokens])).toEqual([['storyboard', caps.storyboardOutputTokens], ['review', caps.reviewOutputTokens]]);
    expect(base.calls.map(c => [c.stage, c.maxOutputTokens])).toEqual(repaired.calls.map(c => [c.stage, c.maxOutputTokens]));
    expect(repaired.calls[0].instructions).toBe(`${base.calls[0].instructions}\n${REPAIR_STORYBOARD_ADDENDUM}`);
    const { priorReviewedStoryboard, ...input } = JSON.parse(repaired.calls[0].input);
    expect(priorReviewedStoryboard).toMatchObject({ version: STORYBOARD_REPAIR_VERSION, parentStoryboardDigest: r.book.storyboardDigest, storyboard: r.draft });
    expect(canonicalJson(input)).toBe(canonicalJson({ ...JSON.parse(base.calls[0].input), personalSourceDigest: repaired.result.sourceDigest }));
    expect(repaired.calls[1].instructions).toBe(PERSONAL_BOOK_REVIEW_INSTRUCTION);
    expect(repaired.calls[1].instructions).toBe(base.calls[1].instructions);
    expect(JSON.stringify(JSON.parse(repaired.calls[1].input))).not.toContain('priorReviewedStoryboard');
    expect(repaired.result).toMatchObject({ status: 'review_supported' });
    expect(repaired.result.storyboard.repair).toEqual({ version: STORYBOARD_REPAIR_VERSION, parentStoryboardDigest: r.book.storyboardDigest });
    expect(base.result.storyboard).not.toHaveProperty('repair');
  });
  it('a repair that does not bind (another parent) refuses before any call', async () => {
    const r = await replanFixture(), generate = vi.fn();
    await expect(runSimpleStoryboardDiagnostic({ request: r.request, writerResult: r.writerResult, options: r.options, signal: new AbortController().signal,
      generate, actorOwnedAppearance: true, repair: { parentStoryboardDigest: 'f'.repeat(64), draft: r.draft, review: held(r.review as Review) } }))
      .rejects.toThrow('personal_storyboard_repair_binding');
    expect(generate).not.toHaveBeenCalled();
  });
});
