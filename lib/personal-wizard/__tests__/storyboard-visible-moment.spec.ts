import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { replanFixture } from './storyboard-replan-fixture';
import { resolvePersonalWizardOptions } from '../options';
import { preparePersonalStoryboard, prepareCurrentPersonalStoryboard, compilePersonalStoryboard, personalStoryboardFrame, personalStoryboardReviewInput,
  storyboardInstructions, storyboardDraftSchema, storyboardReviewDisposition, PERSONAL_STORYBOARD_INSTRUCTION } from '../storyboard';
import { MOMENT_STORYBOARD_ADDENDUM, MOMENT_REVIEW_ADDENDUM, STORYBOARD_MOMENTS_VERSION } from '../storyboard-moments';
import { DRAWN_INSTANT_CONTRACT_VERSION, DRAWN_INSTANT_STORYBOARD_ADDENDUM, DRAWN_INSTANT_REVIEW_ADDENDUM } from '../storyboard-drawn-instant';
import { VISIBLE_MOMENT_CONTRACT_VERSION, VISIBLE_MOMENT_STORYBOARD_ADDENDUM } from '../storyboard-visible-moment';
import { STORYBOARD_REPAIR_VERSION, REPAIR_STORYBOARD_ADDENDUM, REPAIR_ADDABLE_CONTRACTS } from '../storyboard-repair';
import { PERSONAL_BOOK_REVIEW_INSTRUCTION } from '../book-runner';
import { runSimpleStoryboardDiagnostic, type SimpleStoryboardDiagnosticCall } from '../simple-storyboard-diagnostic';
import { savedVisibleMomentContract } from '../../../scripts/personal-simple-book-reviewed-audition';

const options = resolvePersonalWizardOptions();
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
type Fixture = Awaited<ReturnType<typeof personalStoryboardFixture>>;
/** prepare...(request, writerResult, options, appearance, moments ON, kind, preservation, sceneLocation, compilerRules, repair, drawnInstant, visibleMoment). */
const prepare = (f: Fixture, c: { drawnInstant?: true; visibleMoment?: true; repair?: unknown } = {}) =>
  preparePersonalStoryboard(f.request, f.result, options, undefined, true, undefined, undefined, undefined, undefined, c.repair as never, c.drawnInstant, c.visibleMoment);
/** The fixture draft with a moments plan for every page and the cover (no depicted instant, so valid with or without the drawn-instant contract). */
const momentDraft = (f: Fixture) => ({ ...structuredClone(f.draft), moments: { version: STORYBOARD_MOMENTS_VERSION,
  frames: Array.from({ length: f.result.manuscript.pages.length + 1 }, () => ({ requirements: [], depicted: null })) } });
const supported = (f: Fixture, book: { sourceDigest: string; storyboardDigest: string }) =>
  ({ ...structuredClone(f.review), sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest });
/** Held as the real book's review held it: a book-level state carried forward (uncertain) and a page whose required sky is only implied. */
const held = (review: any) => {
  const r = structuredClone(review);
  r.bookChecks[1] = { ...r.bookChecks[1], verdict: 'uncertain', observation: 'a finished process is carried forward as still ongoing' };
  r.frames[7].checks[0] = { ...r.frames[7].checks[0], verdict: 'contradiction', observation: 'page 7: the sky the text names is only implied' };
  return r;
};

describe('visible-moment contract (opt-in instruction contract; extends the moments contract)', () => {
  it('absent: every existing identity, instruction and schema is byte-identical; the addendum text is pinned', async () => {
    const f = await personalStoryboardFixture();
    expect(preparePersonalStoryboard(f.request, f.result, options).sourceDigest).toBe('f1ad9a28816945b860324527a4050018ecd43cbb4eae2bd01b60975dfc4344f5');
    expect(preparePersonalStoryboard(f.request, f.result, options, true).sourceDigest).toBe('a72da5d557dba2e097c190febd3c0940ed1ac6a9b292f2b4e12aebb4ef379edb');
    expect(f.book.storyboardDigest).toBe('cb09f0812bafb902f1a7c27de12cc0593636b42b2e33498ac9501c20402c8c1f');
    expect(personalStoryboardFrame(f.book, f.review, 1, f.current).packetDigest).toBe('d737d76dc01ff5f9311247ec78c78a79cdf09b4579802a0b3a7160e8454514a1');
    expect(sha(VISIBLE_MOMENT_STORYBOARD_ADDENDUM)).toBe('5765d811c66bcd60ffa68ae06b69e78ac2ee748ac3a49836a760f0fba107536f');
    const plain = prepare(f, { drawnInstant: true });
    expect('visibleMomentContract' in plain).toBe(false);
    expect(storyboardInstructions(plain)).toBe(`${PERSONAL_STORYBOARD_INSTRUCTION}\n${MOMENT_STORYBOARD_ADDENDUM}\n${DRAWN_INSTANT_STORYBOARD_ADDENDUM}`);
    const book = compilePersonalStoryboard(plain, momentDraft(f));
    expect('visibleMoment' in book).toBe(false);
    expect(savedVisibleMomentContract(book)).toBeUndefined();
  });

  it('on: needs the moments contract; adds its addendum (after the drawn instant, before a repair), its marker and a new source; no schema or compiler change', async () => {
    const f = await personalStoryboardFixture();
    expect(() => preparePersonalStoryboard(f.request, f.result, options, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, true))
      .toThrow('personal_storyboard_visible_moment_policy');
    expect(() => prepare(f, { visibleMoment: 'yes' as never })).toThrow('personal_storyboard_visible_moment_policy');
    const plain = prepare(f, { drawnInstant: true }), on = prepare(f, { drawnInstant: true, visibleMoment: true });
    expect(on.sourceDigest).not.toBe(plain.sourceDigest);
    expect(storyboardInstructions(on)).toBe(`${storyboardInstructions(plain)}\n${VISIBLE_MOMENT_STORYBOARD_ADDENDUM}`);
    const all = { actorOwnedAppearance: true, momentContract: true, landmarkKindContract: true, sceneLocationContract: true, compilerRulesContract: true,
      drawnInstantContract: true } as const;
    expect(storyboardInstructions({ ...all, visibleMomentContract: true, repair: {} }))
      .toBe(`${storyboardInstructions(all)}\n${VISIBLE_MOMENT_STORYBOARD_ADDENDUM}\n${REPAIR_STORYBOARD_ADDENDUM}`);
    expect(storyboardDraftSchema(on)).toBe(storyboardDraftSchema(plain));
    expect(on.planningInput).toEqual({ ...plain.planningInput, personalSourceDigest: on.sourceDigest });
    const base = compilePersonalStoryboard(plain, momentDraft(f)), book = compilePersonalStoryboard(on, momentDraft(f));
    expect([book.visibleMoment, book.drawnInstant]).toEqual([VISIBLE_MOMENT_CONTRACT_VERSION, DRAWN_INSTANT_CONTRACT_VERSION]);
    expect([book.plan, book.sequence, book.moments]).toEqual([base.plan, base.sequence, base.moments]);
    expect(book.storyboardDigest).not.toBe(base.storyboardDigest);
    // The review never sees the contract (its instructions and criteria are unchanged; the diagnostic test below pins the call).
    expect(Object.keys(personalStoryboardReviewInput(book)).sort()).toEqual(Object.keys(personalStoryboardReviewInput(base)).sort());
    expect(JSON.stringify(personalStoryboardReviewInput(book))).not.toContain(VISIBLE_MOMENT_CONTRACT_VERSION);
    // A supported review of this book; frames and a current re-admission re-derive the same source; the saved marker is the only flag a loader reads.
    const review = supported(f, book);
    expect(storyboardReviewDisposition(book, review).disposition).toBe('review_supported');
    expect(personalStoryboardFrame(book, review, 1, f.current).context.sourceDigest).toBe(book.sourceDigest);
    expect(prepareCurrentPersonalStoryboard(f.request, f.result, options, undefined, true, undefined, undefined, undefined, undefined, undefined, true, true).sourceDigest)
      .toBe(on.sourceDigest);
    expect(savedVisibleMomentContract(book)).toBe(true);
    expect(() => savedVisibleMomentContract({ visibleMoment: 'storyboard-visible-moment/v0' })).toThrow('audition_board_binding');
    // The other book's review never approves this one.
    expect(() => storyboardReviewDisposition(book, supported(f, base))).toThrow('personal_storyboard_review_binding');
  });

  it('a repair may add it: the held parent recompiles WITHOUT it to its digest; every finding reaches the planner; any other shape refuses', async () => {
    const f = await personalStoryboardFixture(), draft = momentDraft(f);
    expect(REPAIR_ADDABLE_CONTRACTS).toEqual(['drawnInstantContract', 'visibleMomentContract', 'selfCheckContract', 'reviewImpactPolicy', 'claimBasisContract',
      'calibrationContract']);
    const parent = compilePersonalStoryboard(prepare(f, { drawnInstant: true }), draft), review = held(supported(f, parent));
    expect(storyboardReviewDisposition(parent, review).disposition).toBe('held_uncertain');
    const repair = { parentStoryboardDigest: parent.storyboardDigest, draft, review, addedContracts: ['visibleMomentContract'] };
    const source = prepare(f, { drawnInstant: true, visibleMoment: true, repair });
    expect(source.repair).toEqual(repair);
    expect(storyboardInstructions(source))
      .toBe(`${PERSONAL_STORYBOARD_INSTRUCTION}\n${MOMENT_STORYBOARD_ADDENDUM}\n${DRAWN_INSTANT_STORYBOARD_ADDENDUM}\n${VISIBLE_MOMENT_STORYBOARD_ADDENDUM}\n${REPAIR_STORYBOARD_ADDENDUM}`);
    const prior = (source.planningInput as any).priorReviewedStoryboard;
    expect(prior).toEqual({ version: STORYBOARD_REPAIR_VERSION, parentStoryboardDigest: parent.storyboardDigest, storyboard: draft, reviewFindings: [
      { scope: 'book', category: review.bookChecks[1].category, verdict: 'uncertain', observation: 'a finished process is carried forward as still ongoing' },
      { scope: 'page', pageNumber: 7, category: review.frames[7].checks[0].category, verdict: 'contradiction', observation: 'page 7: the sky the text names is only implied' }] });
    // An instruction contract derives no compiler findings of its own (only the drawn-instant contract does).
    expect(prior).not.toHaveProperty('contractFindings');
    const book = compilePersonalStoryboard(source, draft);
    expect([book.repair, book.visibleMoment, book.drawnInstant])
      .toEqual([{ version: STORYBOARD_REPAIR_VERSION, parentStoryboardDigest: parent.storyboardDigest }, VISIBLE_MOMENT_CONTRACT_VERSION, DRAWN_INSTANT_CONTRACT_VERSION]);
    expect(prepareCurrentPersonalStoryboard(f.request, f.result, options, undefined, true, undefined, undefined, undefined, undefined, repair as never, true, true).sourceDigest)
      .toBe(source.sourceDigest);
    // Added without the contract on: refused. Not declared added: the parent is recompiled WITH it, so it is not that parent.
    expect(() => prepare(f, { drawnInstant: true, repair })).toThrow('personal_storyboard_repair_policy');
    const { addedContracts: _added, ...undeclared } = repair;
    expect(() => prepare(f, { drawnInstant: true, visibleMoment: true, repair: undeclared })).toThrow('personal_storyboard_repair_binding');
    // Added on top of a parent that already had it: that parent recompiles without it, so it is not that parent either.
    const visibleParent = compilePersonalStoryboard(prepare(f, { drawnInstant: true, visibleMoment: true }), draft);
    expect(() => prepare(f, { drawnInstant: true, visibleMoment: true, repair: { parentStoryboardDigest: visibleParent.storyboardDigest, draft,
      review: held(supported(f, visibleParent)), addedContracts: ['visibleMomentContract'] } })).toThrow('personal_storyboard_repair_binding');
    for (const shape of [['visibleMomentContract', 'visibleMomentContract'], ['momentContract'], []])
      expect(() => prepare(f, { drawnInstant: true, visibleMoment: true, repair: { ...repair, addedContracts: shape } })).toThrow('personal_storyboard_repair_policy');
    // A review that supports the parent is nothing to repair; the review binds the source (one reworded observation is another source).
    expect(() => prepare(f, { drawnInstant: true, visibleMoment: true, repair: { ...repair, review: supported(f, parent) } }))
      .toThrow('personal_storyboard_repair_not_held');
    const reworded = structuredClone(review); reworded.frames[7].checks[0].observation += ' (reworded)';
    expect(prepare(f, { drawnInstant: true, visibleMoment: true, repair: { ...repair, review: reworded } }).sourceDigest).not.toBe(source.sourceDigest);
    // Both opt-in contracts added at once: the parent recompiles without either.
    const plainParent = compilePersonalStoryboard(prepare(f), draft);
    expect(prepare(f, { drawnInstant: true, visibleMoment: true, repair: { parentStoryboardDigest: plainParent.storyboardDigest, draft,
      review: held(supported(f, plainParent)), addedContracts: ['drawnInstantContract', 'visibleMomentContract'] } }).repair).toBeTruthy();
  });

  it('the diagnostic: the storyboard call carries the addendum; the review call is unchanged; absent, both calls are byte-identical', async () => {
    const r = await replanFixture();
    async function run(visibleMoment?: true) {
      const calls: SimpleStoryboardDiagnosticCall[] = [];
      const generate = vi.fn(async (call: SimpleStoryboardDiagnosticCall) => {
        calls.push(call);
        if (call.stage === 'storyboard') return { ...structuredClone(r.draft), moments: { version: STORYBOARD_MOMENTS_VERSION,
          frames: Array.from({ length: r.writerResult.manuscript.pages.length + 1 }, () => ({ requirements: [], depicted: null })) } };
        return { ...structuredClone(r.review), sourceDigest: call.context.sourceDigest, storyboardDigest: call.context.storyboardDigest };
      });
      const result = await runSimpleStoryboardDiagnostic({ request: r.request, writerResult: r.writerResult, options: r.options, signal: new AbortController().signal,
        generate, actorOwnedAppearance: true, momentContract: true, drawnInstantContract: true, ...(visibleMoment ? { visibleMomentContract: true as const } : {}) });
      return { calls, result };
    }
    const base = await run(), on = await run(true);
    expect(on.calls[0].instructions).toBe(`${base.calls[0].instructions}\n${VISIBLE_MOMENT_STORYBOARD_ADDENDUM}`);
    expect(on.calls[0].context).toEqual({ ...base.calls[0].context, sourceDigest: on.result.sourceDigest });
    expect(on.calls[0].input).toBe(base.calls[0].input.replace(base.result.sourceDigest, on.result.sourceDigest));
    expect(base.calls[1].instructions).toBe(`${PERSONAL_BOOK_REVIEW_INSTRUCTION}\n${MOMENT_REVIEW_ADDENDUM}\n${DRAWN_INSTANT_REVIEW_ADDENDUM}`);
    expect(on.calls[1].instructions).toBe(base.calls[1].instructions);
    expect(on.calls[1].context).toEqual({ ...base.calls[1].context, sourceDigest: on.result.sourceDigest, storyboardDigest: on.result.storyboardDigest });
    expect(on.result.storyboard.visibleMoment).toBe(VISIBLE_MOMENT_CONTRACT_VERSION);
    expect(base.result.storyboard).not.toHaveProperty('visibleMoment');
  });
});
