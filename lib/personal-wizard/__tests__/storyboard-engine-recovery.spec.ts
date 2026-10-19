import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { fullSelfCheck } from './storyboard-self-check-fixture';
import { replanFixture } from './storyboard-replan-fixture';
import { resolvePersonalWizardOptions } from '../options';
import { preparePersonalStoryboard, prepareCurrentPersonalStoryboard, compilePersonalStoryboard, personalStoryboardFrame, personalStoryboardReviewInput, storyboardInstructions,
  storyboardDraftSchema, storyboardReviewDisposition, storyboardOwnerAcceptance, storyboardRecovery, personalStoryboardReviewSchema, impactStoryboardReviewSchema,
  PERSONAL_STORYBOARD_INSTRUCTION } from '../storyboard';
import { STORYBOARD_MOMENTS_VERSION, MOMENT_STORYBOARD_ADDENDUM, momentWholeBookDraftSchema } from '../storyboard-moments';
import { REPAIR_STORYBOARD_ADDENDUM } from '../storyboard-repair';
import { SELF_CHECK_STORYBOARD_ADDENDUM, SELF_CHECK_REVIEW_ADDENDUM, STORYBOARD_SELF_CHECK_VERSION, STORYBOARD_SELF_CHECK_NAMES_VERSION, resolveSelfCheckSections,
  validateStoryboardSelfCheck } from '../storyboard-self-check';
import { STORYBOARD_REVIEW_IMPACT_VERSION, STORYBOARD_REVIEW_IMPACT_ADDENDUM, storyboardReviewRefs } from '../storyboard-review-impact';
import { STORYBOARD_DIAGNOSIS_VERSION, STORYBOARD_MAX_ATTEMPTS, diagnosisDigest } from '../storyboard-diagnosis';
import { REVIEW_IMPACT_ORDER } from '../review-impact';
import { AUDITION_IMPACTS } from '../simple-book-reviewed-audition';
import { personalBookProviderSchema } from '../book-openai';
import { personalBookOutputLimits } from '../book-config';
import { previewStoryEvidence } from '../../local-story-preview';
import { runSimpleStoryboardDiagnostic, type SimpleStoryboardDiagnosticCall } from '../simple-storyboard-diagnostic';

const options = resolvePersonalWizardOptions();
type Fixture = Awaited<ReturnType<typeof personalStoryboardFixture>>;
// Page 6: 'They climb inside the hut again, and the ribbon stays with נועה.' The drawn instant is its first clause.
const DRAWN = 'They climb inside the hut again', LATER = 'the ribbon stays with נועה';
type Opts = { repair?: unknown; selfCheck?: true; impact?: true; drawn?: true };
/** prepare(request, writerResult, options, appearance, moments, kind, preservation, sceneLocation, compilerRules, repair, drawnInstant, visibleMoment, selfCheck, impact). */
const prepare = (f: Fixture, o: Opts = {}) => preparePersonalStoryboard(f.request, f.result, options, undefined, true, undefined, undefined, undefined, undefined,
  o.repair as never, o.drawn, undefined, o.selfCheck, o.impact);
/** The fixture draft with moments: page 6 drawn at its first clause (both actors beside the hut) and one requirement quoted from its later clause. */
function momentDraft(f: Fixture, change?: (draft: any) => void) {
  const frames: any[] = Array.from({ length: f.result.manuscript.pages.length + 1 }, () => ({ requirements: [], depicted: null }));
  frames[6] = { requirements: [{ kind: 'show', subject: 'the red ribbon still in the child\'s hand', evidence: LATER }],
    depicted: { evidence: DRAWN, attributes: [], relations: ['child', 'companion'].map(entityId => ({ entityId, value: { relation: 'beside', targetId: 'hut' }, evidence: DRAWN })) } };
  const draft: any = { ...structuredClone(f.draft), moments: { version: STORYBOARD_MOMENTS_VERSION, frames } };
  change?.(draft);
  return draft;
}
const textsOf = (source: ReturnType<typeof prepare>) => previewStoryEvidence(source.story).texts;
const withCheck = (draft: any, source: ReturnType<typeof prepare>, edit?: (s: any) => void, repair?: { diagnosis: any; parentDraft: unknown }) =>
  ({ ...draft, selfCheck: fullSelfCheck(draft, textsOf(source), repair, edit) });
/** A review of `book` from the fixture's supported one; under the typed policy every check also lists its issues (none when supported). */
const reviewOf = (f: Fixture, book: { sourceDigest: string; storyboardDigest: string }, typed = false, change?: (r: any) => void) => {
  const r: any = { ...structuredClone(f.review), sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest };
  if (typed) for (const c of [...r.bookChecks, ...r.frames.flatMap((x: any) => x.checks)]) c.issues = [];
  change?.(r);
  return r;
};
const set = (check: any, verdict: string, observation: string, issues?: unknown[]) => Object.assign(check, { verdict, observation, ...(issues ? { issues } : {}) });

describe('engine recovery: planner self-check, typed review materiality and the diagnosis after two held candidates (opt-in)', { timeout: 120_000 }, () => {
  it('absent: every existing identity, instruction, schema, review input and disposition is byte-identical', async () => {
    const f = await personalStoryboardFixture();
    expect(preparePersonalStoryboard(f.request, f.result, options).sourceDigest).toBe('f1ad9a28816945b860324527a4050018ecd43cbb4eae2bd01b60975dfc4344f5');
    expect(f.book.storyboardDigest).toBe('cb09f0812bafb902f1a7c27de12cc0593636b42b2e33498ac9501c20402c8c1f');
    expect(personalStoryboardFrame(f.book, f.review, 1, f.current).packetDigest).toBe('d737d76dc01ff5f9311247ec78c78a79cdf09b4579802a0b3a7160e8454514a1');
    const plain = prepare(f), book = compilePersonalStoryboard(plain, momentDraft(f));
    expect(storyboardInstructions(plain)).toBe(`${PERSONAL_STORYBOARD_INSTRUCTION}\n${MOMENT_STORYBOARD_ADDENDUM}`);
    expect(storyboardDraftSchema(plain)).toBe(momentWholeBookDraftSchema);
    expect(['selfCheck' in book, 'reviewImpact' in book]).toEqual([false, false]);
    const input = personalStoryboardReviewInput(book);
    expect(['selfCheck' in input, 'reviewImpact' in input]).toEqual([false, false]);
    // A self-check without its contract is not part of the draft (the strict draft schema refuses it); a typed review is not the legacy review.
    expect(() => compilePersonalStoryboard(plain, withCheck(momentDraft(f), plain))).toThrow();
    expect(() => storyboardReviewDisposition(book, reviewOf(f, book, true))).toThrow();
    // The legacy disposition stays all-or-nothing, and its decision carries no typed record.
    const decision = storyboardReviewDisposition(book, reviewOf(f, book, false, r => set(r.frames[6].checks[3], 'contradiction', 'a cosmetic shade')));
    expect([decision.disposition, 'impact' in decision]).toEqual(['held_contradiction', false]);
    // Provider schemas: no selfCheck and no issues without the contracts; the caps are unchanged.
    const ctx = { narrativeSpreads: 8, sourceDigest: 'a'.repeat(64), storyboardDigest: 'b'.repeat(64), momentContract: true as const };
    expect(JSON.stringify(personalBookProviderSchema({ stage: 'storyboard', context: ctx } as any).shape)).not.toContain('selfCheck');
    expect(JSON.stringify((personalBookProviderSchema({ stage: 'review', context: ctx } as any) as any).shape.bookChecks.shape)).not.toContain('issues');
    expect(personalBookOutputLimits(8)).toEqual({ storyboardOutputTokens: 32000, reviewOutputTokens: 39000 });
    expect(personalBookOutputLimits(8, { selfCheck: true })).toEqual({ storyboardOutputTokens: 50000, reviewOutputTokens: 39000 });
    expect(() => personalBookOutputLimits(8, { selfCheck: 'yes' } as never)).toThrow('book_limits_contract_invalid');
  });

  it('one shared impact vocabulary: the storyboard policy is the audition\'s order plus its required-evidence gate; policies carry no story data', () => {
    expect(AUDITION_IMPACTS).toBe(REVIEW_IMPACT_ORDER);
    expect([...REVIEW_IMPACT_ORDER]).toEqual(['safety', 'story', 'identity', 'continuity', 'detail']);
    // No names, objects, page numbers or this book's facts in the runtime policies (the general engine, not this story).
    for (const file of ['storyboard-self-check.ts', 'storyboard-review-impact.ts', 'storyboard-diagnosis.ts', 'stage-recovery.ts', 'review-impact.ts']) {
      const text = readFileSync(path.join(__dirname, '..', file), 'utf8');
      expect([file, /\b(ball|eyebrows?|ammonite|crater|lizard|grandma|dini|uri|itai|goni)\b/i.test(text), /\bpage ?[0-9]\b|\bp[0-9]:/i.test(text)]).toEqual([file, false, false]);
    }
  });

  it('self-check on: compiled, bound into the book and its digest, read by the review; the instruction and the provider shape name it', async () => {
    const f = await personalStoryboardFixture(), source = prepare(f, { selfCheck: true }), plain = prepare(f);
    expect(source.sourceDigest).not.toBe(plain.sourceDigest);
    expect(storyboardInstructions(source)).toBe(`${storyboardInstructions(plain)}\n${SELF_CHECK_STORYBOARD_ADDENDUM}`);
    expect(storyboardInstructions({ ...source, repair: {} })).toBe(`${storyboardInstructions(plain)}\n${SELF_CHECK_STORYBOARD_ADDENDUM}\n${REPAIR_STORYBOARD_ADDENDUM}`);
    const book = compilePersonalStoryboard(source, withCheck(momentDraft(f), source));
    expect(book.selfCheck).toMatchObject({ version: STORYBOARD_SELF_CHECK_VERSION, resolutions: [] });
    expect(book.selfCheck!.frames[6].claims.map(c => c.ref)).toEqual(['p6:requirement:0', 'p6:instant', 'p6:relation:child', 'p6:relation:companion',
      'p6:transition:child', 'p6:transition:companion', 'p6:scene']);
    expect(personalStoryboardReviewInput(book)).toMatchObject({ selfCheck: book.selfCheck });
    expect(() => compilePersonalStoryboard(source, momentDraft(f))).toThrow('personal_storyboard_self_check_required');
    // The self-check needs the moments contract (it binds requirements and drawn instants).
    expect(() => preparePersonalStoryboard(f.request, f.result, options, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, true)).toThrow('personal_storyboard_self_check_policy');
    const provider = personalBookProviderSchema({ stage: 'storyboard', context: { narrativeSpreads: 8, sourceDigest: 'a'.repeat(64), momentContract: true,
      selfCheckContract: true } } as any) as any;
    expect(provider.shape.selfCheck.shape.frames._def.exactLength.value).toBe(9);
    expect(() => personalBookProviderSchema({ stage: 'storyboard', context: { narrativeSpreads: 8, sourceDigest: 'a'.repeat(64), selfCheckContract: true } } as any))
      .toThrow('book_provider_context');
  });

  it('whole-claim evidence: every part needs its OWN same-page quote; coverage is exact; a claim binds by overlapping its declared quote', async () => {
    const f = await personalStoryboardFixture(), source = prepare(f, { selfCheck: true }), draft = momentDraft(f);
    const run = (edit: (s: any) => void) => () => compilePersonalStoryboard(source, withCheck(draft, source, edit));
    const req = (s: any) => s.frames[6].claims.find((c: any) => c.ref === 'p6:requirement:0');
    // A compound requirement: both parts quoted on page 6 compile; a part quoted only on ANOTHER page is refused, even though that page states it.
    expect(run(s => { req(s).parts = [{ assertion: 'the ribbon stays with the child', quote: LATER }, { assertion: 'they are inside again', quote: DRAWN }]; })).not.toThrow();
    expect(run(s => { req(s).parts.push({ assertion: 'the ribbon is red', quote: 'A red ribbon is in her hand.' }); })).toThrow('storyboard_self_check_claim_quote');
    // A covering span binds; a part list that never touches the declared quote does not.
    expect(run(s => { req(s).parts = [{ assertion: 'ribbon', quote: 'the ribbon stays' }]; })).not.toThrow();
    expect(run(s => { req(s).parts = [{ assertion: 'inside again', quote: DRAWN }]; })).toThrow('storyboard_self_check_claim_binding');
    // Exact coverage: a missing, unknown or duplicated claim refuses; frames are positional (reordering them refuses).
    expect(run(s => { s.frames[6].claims.pop(); })).toThrow('storyboard_self_check_claim_coverage');
    expect(run(s => { s.frames[6].claims.push({ ref: 'p6:requirement:5', parts: [{ assertion: 'x', quote: DRAWN }] }); })).toThrow('storyboard_self_check_claim_coverage');
    expect(run(s => { s.frames[6].claims[1] = structuredClone(s.frames[6].claims[0]); })).toThrow('storyboard_self_check_claim_coverage');
    expect(run(s => { [s.frames[3], s.frames[4]] = [s.frames[4], s.frames[3]]; })).toThrow(/storyboard_self_check_(claim_coverage|claim_quote|event)/);
    expect(run(s => { s.frames.pop(); })).toThrow('storyboard_self_check_coverage');
  });

  it('causal event vs epilogue: an aftermath never silently replaces a consequential action; a quiet ending, a reveal and a joke stay valid', async () => {
    const f = await personalStoryboardFixture(), source = prepare(f, { selfCheck: true }), draft = momentDraft(f);
    const run = (edit: (s: any) => void) => () => compilePersonalStoryboard(source, withCheck(draft, source, edit));
    // Page 3 has no declared instant, so its picture is the page's last event: the carrying aftermath after the consequential departure refuses.
    expect(run(s => { s.frames[3].events = [{ quote: 'They leave the hut for the garden', kind: 'action', consequential: true },
      { quote: 'carrying the ribbon', kind: 'aftermath', consequential: false }]; s.frames[3].keyEvent = 1; })).toThrow('storyboard_self_check_key_event_not_consequential');
    // The key event must BE the drawn instant (page 6 draws its first clause), not a convenient later one.
    expect(run(s => { s.frames[6].events = [{ quote: DRAWN, kind: 'action', consequential: true }, { quote: LATER, kind: 'aftermath', consequential: false }];
      s.frames[6].keyEvent = 1; })).toThrow('storyboard_self_check_key_event_instant');
    expect(run(s => { s.frames[6].events = [{ quote: DRAWN, kind: 'action', consequential: true }, { quote: LATER, kind: 'aftermath', consequential: false }];
      s.frames[6].keyEvent = 0; })).not.toThrow();
    // A genuine quiet conclusion is the page's meaning: consequential, drawn, valid.
    expect(run(s => { s.frames[8].events = [{ quote: 'plan their next drawing', kind: 'emotion', consequential: true }]; s.frames[8].keyEvent = 0; })).not.toThrow();
    // A reveal or joke at the page's end: the setup is not consequential, the reveal is, and it is drawn.
    expect(run(s => { s.frames[2].events = [{ quote: 'They look out from inside the hut', kind: 'action', consequential: false },
      { quote: 'considers another idea', kind: 'joke', consequential: true }]; s.frames[2].keyEvent = 1; })).not.toThrow();
    // Events are exact, unique quotes of their own page; the cover has none.
    expect(run(s => { s.frames[2].events[0].quote = 'They leave the hut for the garden'; })).toThrow('storyboard_self_check_event_quote');
    expect(run(s => { s.frames[2].events.push(structuredClone(s.frames[2].events[0])); s.frames[2].keyEvent = 1; })).toThrow('storyboard_self_check_event_quote');
    expect(run(s => { s.frames[2].events = []; s.frames[2].keyEvent = null; })).toThrow('storyboard_self_check_events');
    expect(run(s => { s.frames[0].events = [{ quote: 'הסרט האדום', kind: 'action', consequential: true }]; s.frames[0].keyEvent = 0; })).toThrow('storyboard_self_check_cover_events');
  });

  it('design/invariant consistency and grounded geography: two design authorities must agree; an unquoted place is never a quoted one', async () => {
    const f = await personalStoryboardFixture(), source = prepare(f, { selfCheck: true }), draft = momentDraft(f);
    const run = (edit: (s: any) => void, d = draft) => () => compilePersonalStoryboard(source, withCheck(d, source, edit));
    // The fixture's ribbon is both a continuity entity (color: red) and a recurring prop ('one red cotton ribbon').
    expect(withCheck(draft, source).selfCheck.designs).toEqual([{ id: 'ribbon', attributes: [{ attribute: 'color', designPhrase: 'red', agrees: true }] }]);
    expect(run(s => { s.designs[0].attributes[0].agrees = false; })).toThrow('storyboard_self_check_design_conflict');
    expect(run(s => { s.designs[0].attributes[0].designPhrase = 'blue'; })).toThrow('storyboard_self_check_design_phrase');
    expect(run(s => { s.designs = []; })).toThrow('storyboard_self_check_design_coverage');
    expect(run(s => { s.designs[0].attributes = [{ attribute: 'texture', designPhrase: null, agrees: true }]; })).toThrow('storyboard_self_check_design_attributes');
    // Grounding: a route quoted from nowhere on its page refuses; an unstated one is declared null (shown generically; the review judges it).
    expect(run(s => { s.frames[5].grounding = [{ assertion: 'the path back along the river', quote: 'along the river' }]; })).toThrow('storyboard_self_check_grounding_quote');
    expect(run(s => { s.frames[5].grounding = [{ assertion: 'back into the garden', quote: 'They turn back into the garden' },
      { assertion: 'the exact path taken', quote: null }]; })).not.toThrow();
    // Renamed entities: the same rules on other ids (no name in any rule).
    const renamed = JSON.parse(JSON.stringify(draft).replace(/"ribbon"/g, '"kite_string"').replace(/"hut"/g, '"shed"'));
    const renamedSource = prepare(f, { selfCheck: true });
    expect(withCheck(renamed, renamedSource).selfCheck.designs).toEqual([{ id: 'kite_string', attributes: [{ attribute: 'color', designPhrase: 'red', agrees: true }] }]);
    expect(() => compilePersonalStoryboard(renamedSource, withCheck(renamed, renamedSource, s => { s.designs[0].attributes[0].agrees = false; })))
      .toThrow('storyboard_self_check_design_conflict');
    expect(() => compilePersonalStoryboard(renamedSource, withCheck(renamed, renamedSource))).not.toThrow();
  });

  it('typed materiality: minor-only bound notes admit (with notes, carried in every packet); major, unknown, unbound or unjustified issues hold', async () => {
    const f = await personalStoryboardFixture(), source = prepare(f, { impact: true }), book = compilePersonalStoryboard(source, momentDraft(f));
    expect(book.reviewImpact).toBe(STORYBOARD_REVIEW_IMPACT_VERSION);
    const refs = storyboardReviewRefs(book);
    expect(refs).toEqual(expect.arrayContaining(['book', 'cast:child', 'entity:hut', 'prop:ribbon', 'location:garden', 'p6', 'p6:composition', 'p6:instant',
      'p6:requirement:0', 'p6:relation:child', 'p3:transition:child', 'p3:scene']));
    expect(personalStoryboardReviewInput(book)).toMatchObject({ reviewImpact: { version: STORYBOARD_REVIEW_IMPACT_VERSION, reviewRefs: refs } });
    const decide = (change: (r: any) => void) => storyboardReviewDisposition(book, reviewOf(f, book, true, change));
    const detail = (ref: string, why = 'the reader understands the same moment and the picture shows the same things') =>
      ({ impact: 'detail', ref, note: 'a shade differs from the plan wording', whyNotMaterial: why });
    expect(decide(() => {}).disposition).toBe('review_supported');
    // Minor-only: the raw verdict and observation stay in the review; the bound, justified detail is a note, not a hold.
    const minor = decide(r => set(r.frames[6].checks[2], 'uncertain', 'the ribbon is pink-red, not the planned red', [detail('p6:requirement:0')]));
    expect(minor.disposition).toBe('review_supported_with_notes');
    expect(minor.review.frames[6].checks[2]).toMatchObject({ verdict: 'uncertain', observation: 'the ribbon is pink-red, not the planned red' });
    expect(minor.impact).toMatchObject({ blocking: [], notes: [{ scope: 'page', pageNumber: 6, verdict: 'uncertain', issues: [detail('p6:requirement:0')] }] });
    const raw = reviewOf(f, book, true, r => set(r.frames[6].checks[2], 'uncertain', 'the ribbon is pink-red, not the planned red', [detail('p6:requirement:0')]));
    const packet = personalStoryboardFrame(book, raw, 6, f.current);
    expect(packet.context).toMatchObject({ reviewImpact: { version: STORYBOARD_REVIEW_IMPACT_VERSION, disposition: 'review_supported_with_notes', notes: minor.impact!.notes } });
    expect(personalStoryboardFrame(book, raw, 1, f.current).context).toHaveProperty('reviewImpact');
    // A supported-with-notes storyboard needs no owner acceptance (and cannot be "accepted" around its review).
    const acceptance = { version: 'storyboard-owner-acceptance/v1', storyboardDigest: book.storyboardDigest, reviewDigest: minor.reviewDigest,
      acceptedFindings: [{ scope: 'page', pageNumber: 6, category: raw.frames[6].checks[2].category, verdict: 'uncertain', observation: 'shade' }],
      acceptedBy: 'synthetic owner', approval: 'synthetic approval text, never an owner decision' };
    expect(() => storyboardOwnerAcceptance(book, raw, acceptance)).toThrow('personal_storyboard_owner_acceptance_not_needed');
    // Material impacts never pass: the omitted causal action (story), identity/age/style, safety/anatomy, required evidence, continuity.
    for (const impact of ['story', 'identity', 'safety', 'evidence', 'continuity'])
      expect([impact, decide(r => set(r.frames[6].checks[0], 'contradiction', 'the drawn instant omits the causal action',
        [{ impact, ref: 'p6:instant', note: 'omits the page\'s causal action', whyNotMaterial: '' }])).disposition]).toEqual([impact, 'held_contradiction']);
    expect(decide(r => set(r.frames[6].checks[0], 'uncertain', 'unclear', [{ impact: 'story', ref: 'p6:instant', note: 'unclear', whyNotMaterial: '' }])).disposition)
      .toBe('held_uncertain');
    // A material issue next to a detail on the same check still holds; a detail never lowers it.
    expect(decide(r => set(r.frames[6].checks[0], 'contradiction', 'two problems', [detail('p6:composition'),
      { impact: 'story', ref: 'p6:instant', note: 'the key action is missing', whyNotMaterial: '' }])).disposition).toBe('held_contradiction');
    // Unknown materiality, an unbound reference, an unjustified detail or issues on a supported check: the review does not bind, so it holds.
    const unbound = (change: (r: any) => void) => decide(change).impact!.blocking.map(b => b.reason);
    expect(unbound(r => set(r.frames[6].checks[0], 'contradiction', 'no issues listed', []))).toEqual(['unknown_materiality']);
    expect(unbound(r => set(r.frames[6].checks[0], 'contradiction', 'cites nothing known', [detail('p6:requirement:9')]))).toEqual(['unbound_reference']);
    expect(unbound(r => set(r.frames[6].checks[0], 'contradiction', 'says detail, no reason', [detail('p6:instant', '')]))).toEqual(['unjustified_detail']);
    expect(unbound(r => { r.frames[6].checks[0].issues = [detail('p6:instant')]; })).toEqual(['issues_on_supported']);
    expect(decide(r => set(r.frames[6].checks[0], 'contradiction', 'no issues listed', [])).disposition).toBe('held_uncertain');
    // Frames refuse a held typed review exactly as before.
    expect(() => personalStoryboardFrame(book, reviewOf(f, book, true, r => set(r.frames[6].checks[0], 'contradiction', 'x', [])), 6, f.current))
      .toThrow('personal_storyboard_held_uncertain');
  });

  /** A held review of the original (book check 1 and page 3) and of its repair (book check 1 in other words, and page 4). */
  async function heldChain(f: Fixture) {
    const original = prepare(f), d1 = momentDraft(f), b1 = compilePersonalStoryboard(original, d1);
    const r1 = reviewOf(f, b1, false, r => { set(r.bookChecks[1], 'contradiction', 'the causal action is omitted'); set(r.frames[3].checks[0], 'contradiction', 'page 3 route'); });
    const repair1 = { parentStoryboardDigest: b1.storyboardDigest, draft: d1, review: r1 };
    const s2 = prepare(f, { repair: repair1 }), d2 = momentDraft(f, d => { d.plan.pages[3].composition = 'the departure, framed from the garden gate'; });
    const b2 = compilePersonalStoryboard(s2, d2);
    const r2 = reviewOf(f, b2, false, r => { set(r.bookChecks[1], 'contradiction', 'the causal action is still omitted, now on another page');
      set(r.frames[4].checks[2], 'contradiction', 'page 4 state'); });
    const continuation = { parentStoryboardDigest: b2.storyboardDigest, draft: d2, review: r2, parentRepair: repair1, addedContracts: ['selfCheckContract', 'reviewImpactPolicy'] };
    return { b1, r1, repair1, b2, d2, r2, continuation };
  }

  it('two consecutive held candidates (imported from earlier contracts) force the bound diagnosis, consumed by the next request and protecting what was resolved', async () => {
    const f = await personalStoryboardFixture(), { b1, b2, d2, continuation } = await heldChain(f);
    const source = prepare(f, { repair: continuation, selfCheck: true, impact: true });
    const input = source.planningInput as any, diagnosis = input.priorReviewedStoryboard.diagnosis;
    const category = f.review.bookChecks[1].category, page4 = f.review.frames[4].checks[2].category, page3 = f.review.frames[3].checks[0].category;
    expect(diagnosis).toMatchObject({ version: STORYBOARD_DIAGNOSIS_VERSION, consecutiveFailures: 2,
      allowance: { nextAttempt: 3, maxAttempts: STORYBOARD_MAX_ATTEMPTS, remainingAfterNext: 0 },
      attempts: [{ attempt: 1, storyboardDigest: b1.storyboardDigest }, { attempt: 2, storyboardDigest: b2.storyboardDigest }],
      findings: [{ key: `book:${category}`, trajectory: 'repeated_check_new_detail', previousObservation: 'the causal action is omitted' },
        { key: `page:4:${page4}`, trajectory: 'new', changedInLatestAttempt: [] }],
      resolved: [{ key: `page:3:${page3}`, observation: 'page 3 route', changedInLatestAttempt: ['p3:plan'] }],
      protectedPages: [3], changedBetweenLastTwo: ['p3:plan'] });
    // The latest reviewer's words travel once, as the findings the diagnosis references by key.
    expect(input.priorReviewedStoryboard.reviewFindings.map((x: any) => x.observation)).toEqual(['the causal action is still omitted, now on another page', 'page 4 state']);
    // Bound: the source digest and the engine's own recovery record name it; the same input derives the same bytes (restart and repeat safe).
    const again = prepare(f, { repair: continuation, selfCheck: true, impact: true });
    expect(again.sourceDigest).toBe(source.sourceDigest);
    const rec = storyboardRecovery(source);
    expect(rec).toMatchObject({ diagnosisDigest: diagnosisDigest(diagnosis), contracts: expect.arrayContaining([STORYBOARD_SELF_CHECK_VERSION, STORYBOARD_REVIEW_IMPACT_VERSION]) });
    expect(rec.chain.map(a => [a.storyboardDigest, a.findings.length])).toEqual([[b1.storyboardDigest, 2], [b2.storyboardDigest, 2]]);
    expect(new Set(rec.chain.map(a => a.contextDigest)).size).toBe(2);
    expect(rec.chain.map(a => a.contextDigest)).not.toContain(rec.context);
    // The candidate answers every diagnosed finding with the sections it ACTUALLY changed; resolved pages stay protected.
    const d3 = momentDraft(f, d => { d.plan.pages[3].composition = d2.plan.pages[3].composition; d.plan.pages[4].composition = 'the lane, the pause made visible';
      d.plan.pages[2].composition = 'the idea forming, framed from inside'; });
    const repairCtx = { diagnosis, parentDraft: d2 };
    const book = compilePersonalStoryboard(source, withCheck(d3, source, undefined, repairCtx));
    expect(book.selfCheck!.resolutions.map(r => [r.finding, r.changed])).toEqual([[`book:${category}`, ['p2:plan']], [`page:4:${page4}`, ['p4:plan']]]);
    const run = (draft: any, edit?: (s: any) => void) => () => compilePersonalStoryboard(source, withCheck(draft, source, edit, repairCtx));
    expect(run(d3, s => { s.resolutions.pop(); })).toThrow('storyboard_self_check_resolution_coverage');
    expect(run(d3, s => { s.resolutions[1].changed = ['p5:plan']; })).toThrow('storyboard_self_check_resolution_changed');
    expect(run(d3, s => { s.resolutions[1].changed = []; })).toThrow('storyboard_self_check_resolution_basis');
    expect(run(d3, s => { s.resolutions[1] = { ...s.resolutions[1], cause: 'not_a_defect', changed: [], quotes: [] }; })).toThrow('storyboard_self_check_resolution_basis');
    expect(run(d3, s => { s.resolutions[1] = { ...s.resolutions[1], cause: 'not_a_defect', changed: [], quotes: ['They walk down the lane'] }; })).not.toThrow();
    // Changing the resolved (protected) page 3 without a resolution naming it refuses; naming it there is allowed.
    const d3b = momentDraft(f, d => { d.plan.pages[3].composition = 'a different departure'; d.plan.pages[4].composition = 'the lane'; d.plan.pages[2].composition = 'inside'; });
    expect(run(d3b)).toThrow('storyboard_self_check_protected_page_changed');
    expect(run(d3b, s => { s.resolutions[0].changed = ['p2:plan', 'p3:plan']; })).not.toThrow();
    // A first failure is a targeted correction: no diagnosis is required or accepted (a resolution without one refuses).
    const first = prepare(f, { repair: { ...continuation.parentRepair, addedContracts: ['selfCheckContract'] }, selfCheck: true });
    expect('diagnosis' in (first.planningInput as any).priorReviewedStoryboard).toBe(false);
    expect(storyboardRecovery(first).diagnosis).toBeNull();
    expect(() => compilePersonalStoryboard(first, withCheck(d2, first, s => { s.resolutions = [{ finding: 'book:x', cause: 'composition', confirmed: 'c', hypothesis: '',
      impact: 'story', remedy: 'r', changed: ['p3:plan'], quotes: [], check: 'k' }]; }))).toThrow('storyboard_self_check_resolutions_without_diagnosis');
  });

  it('section names (storyboard-self-check-names/v1, opt-in compile): book-level names resolve to the engine\'s own; strict v1 and every check unchanged', async () => {
    const f = await personalStoryboardFixture(), { continuation } = await heldChain(f);
    const source = prepare(f, { repair: continuation, selfCheck: true, impact: true });
    const repairCtx = { diagnosis: (source.planningInput as any).priorReviewedStoryboard.diagnosis, parentDraft: continuation.draft };
    // The candidate answers both diagnosed findings (pages 2 and 4) and also changes two book-level sections: a prop design and a location design.
    const d3 = momentDraft(f, d => { d.plan.pages[3].composition = continuation.draft.plan.pages[3].composition; d.plan.pages[4].composition = 'the lane, the pause made visible';
      d.plan.pages[2].composition = 'the idea forming, framed from inside'; d.plan.recurringProps[0].design = 'one red cotton ribbon, knotted twice';
      d.plan.locations[1].design = 'stone lane beside the garden wall'; });
    const named = (n0: string[], n1: string[]) => withCheck(d3, source, s => { s.resolutions[0].changed = ['p2:plan', ...n0]; s.resolutions[1].changed = ['p4:plan', ...n1]; }, repairCtx);
    const strict = (draft: any) => () => compilePersonalStoryboard(source, structuredClone(draft));
    const opted = (draft: any) => compilePersonalStoryboard(source, structuredClone(draft), { selfCheckNames: true });
    // The planner's short book-level names: strict v1 refuses exactly as before; the opt-in resolves each to the ONE engine section with that key.
    const short = named(['book:recurringProps'], ['book:locations']);
    expect(strict(short)).toThrow('storyboard_self_check_resolution_changed');
    const book = opted(short);
    expect(book.selfCheck!.resolutions.map(r => r.changed)).toEqual([['p2:plan', 'book:plan.recurringProps'], ['p4:plan', 'book:plan.locations']]);
    expect(book.selfCheckNames).toBe(STORYBOARD_SELF_CHECK_NAMES_VERSION);
    expect(personalStoryboardReviewInput(book)).toMatchObject({ selfCheck: { resolutions: book.selfCheck!.resolutions } });
    // A group name becomes the group's sections this candidate changed; exact engine names stay and compile under both.
    expect(opted(named(['book:plan'], [])).selfCheck!.resolutions[0].changed).toEqual(['p2:plan', 'book:plan.locations', 'book:plan.recurringProps']);
    const exact = named(['book:plan.recurringProps'], ['book:plan.locations']);
    const plainBook = compilePersonalStoryboard(source, structuredClone(exact)), exactBook = opted(exact);
    expect(exactBook.selfCheck).toEqual(plainBook.selfCheck);
    // The marker is bound: the same content compiled under the correction is a different, marked book (never the strict one's digest).
    expect(['selfCheckNames' in plainBook, exactBook.storyboardDigest === plainBook.storyboardDigest]).toEqual([false, false]);
    expect({ ...exactBook, storyboardDigest: '', selfCheckNames: undefined }).toEqual({ ...plainBook, storyboardDigest: '', selfCheckNames: undefined });
    // No substantive check relaxes: a name that resolves to an UNCHANGED section, an empty group, an unknown name and a wrong page all still refuse.
    for (const n of [['book:wardrobe'], ['book:continuity'], ['book:nothing'], ['p5:plan'], ['book:']])
      expect(() => opted(named(n, [])), n.join()).toThrow('storyboard_self_check_resolution_changed');
    // Deterministic and narrow: an ambiguous key stays as written (and is refused); duplicates collapse; page names pass through.
    const sections = new Set(['book:plan.version', 'book:moments.version', 'book:plan.locations', 'p1:plan']);
    expect(resolveSelfCheckSections(['book:version'], sections, ['book:plan.version'])).toEqual(['book:version']);
    expect(resolveSelfCheckSections(['book:locations', 'book:plan', 'p1:plan'], sections, ['book:plan.locations'])).toEqual(['book:plan.locations', 'p1:plan']);
    expect(resolveSelfCheckSections(['book:moments'], sections, ['book:moments.version'])).toEqual(['book:moments.version']);
    // Policy: the option alone, only true, only on a self-check source; the validator's own option is strict too.
    expect(() => compilePersonalStoryboard(source, structuredClone(exact), { selfCheckNames: true, other: true } as never)).toThrow('personal_storyboard_self_check_names_policy');
    expect(() => compilePersonalStoryboard(source, structuredClone(exact), { selfCheckNames: 'yes' } as never)).toThrow('personal_storyboard_self_check_names_policy');
    expect(() => compilePersonalStoryboard(prepare(f), momentDraft(f), { selfCheckNames: true })).toThrow('personal_storyboard_self_check_names_policy');
    expect(() => validateStoryboardSelfCheck({}, {} as never, [], undefined, { sectionNames: 'yes' } as never)).toThrow('storyboard_self_check_options');
  });

  it('swaps and stale histories refuse: another review, a dropped ancestor, a foreign parent; the stage ceiling stops a fourth attempt', async () => {
    const f = await personalStoryboardFixture(), { r1, repair1, r2, continuation } = await heldChain(f);
    const on = (repair: unknown) => () => prepare(f, { repair, selfCheck: true, impact: true });
    expect(on({ ...continuation, review: r1 })).toThrow(/personal_storyboard_(review_binding|repair_binding)/);
    const { parentRepair: _dropped, ...noAncestor } = continuation;
    expect(on(noAncestor)).toThrow('personal_storyboard_repair_binding');
    expect(on({ ...continuation, parentRepair: { ...repair1, review: reviewOf(f, { sourceDigest: r1.sourceDigest, storyboardDigest: r1.storyboardDigest }, false,
      r => set(r.frames[5].checks[1], 'uncertain', 'another held review of the same parent')) } })).toThrow('personal_storyboard_repair_binding');
    expect(on({ ...continuation, parentStoryboardDigest: 'f'.repeat(64) })).toThrow('personal_storyboard_repair_binding');
    expect(on({ ...continuation, addedContracts: ['selfCheckContract'] })).toThrow();
    // A supported-with-notes parent is admitted, so there is nothing to repair.
    const s3 = prepare(f, { repair: continuation, selfCheck: true, impact: true }), d3 = momentDraft(f, d => {
      d.plan.pages[3].composition = continuation.draft.plan.pages[3].composition; d.plan.pages[4].composition = 'lane'; d.plan.pages[2].composition = 'inside'; });
    const diagnosis = (s3.planningInput as any).priorReviewedStoryboard.diagnosis;
    const b3 = compilePersonalStoryboard(s3, withCheck(d3, s3, undefined, { diagnosis, parentDraft: continuation.draft }));
    const draft3 = withCheck(d3, s3, undefined, { diagnosis, parentDraft: continuation.draft });
    const notes = reviewOf(f, b3, true, r => set(r.frames[6].checks[2], 'uncertain', 'shade', [{ impact: 'detail', ref: 'p6:requirement:0', note: 'shade', whyNotMaterial: 'same meaning' }]));
    expect(on({ parentStoryboardDigest: b3.storyboardDigest, draft: draft3, review: notes, parentRepair: continuation }))
      .toThrow('personal_storyboard_repair_not_held');
    // Held a third time: the stage's ceiling (three attempts) refuses a fourth before any request exists.
    const third = reviewOf(f, b3, true, r => set(r.frames[6].checks[0], 'contradiction', 'still omitted', [{ impact: 'story', ref: 'p6:instant', note: 'omitted', whyNotMaterial: '' }]));
    expect(on({ parentStoryboardDigest: b3.storyboardDigest, draft: draft3, review: third, parentRepair: continuation }))
      .toThrow('personal_storyboard_repair_allowance_exhausted');
    expect(r2.frames[4].checks[2].verdict).toBe('contradiction');
  });

  it('call sites: the diagnostic sends the self-check cap and the typed review instruction/schema; with notes yields packets, held yields none', async () => {
    const r = await replanFixture();
    const source = prepareCurrentPersonalStoryboard(r.request, r.writerResult, r.options, true, true, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, true, true);
    const frames: any[] = Array.from({ length: 9 }, () => ({ requirements: [], depicted: null }));
    frames[6] = { requirements: [{ kind: 'show', subject: 'the red ribbon still in the child\'s hand', evidence: LATER }], depicted: null };
    const plain = { ...structuredClone(r.draft), moments: { version: STORYBOARD_MOMENTS_VERSION, frames } };
    const draft = { ...plain, selfCheck: fullSelfCheck(plain, textsOf(source)) };
    const go = async (review: (x: any) => void) => {
      const calls: SimpleStoryboardDiagnosticCall[] = [];
      const out = await runSimpleStoryboardDiagnostic({ request: r.request, writerResult: r.writerResult, options: r.options, signal: new AbortController().signal,
        actorOwnedAppearance: true, momentContract: true, selfCheckContract: true, reviewImpactPolicy: true,
        generate: async call => { calls.push(call); if (call.stage === 'storyboard') return structuredClone(draft);
          const c = call.context as any; return reviewOf(r.f, { sourceDigest: c.sourceDigest, storyboardDigest: c.storyboardDigest }, true, review); } });
      return { out, calls };
    };
    const minor = await go(x => set(x.frames[6].checks[2], 'uncertain', 'shade', [{ impact: 'detail', ref: 'p6:requirement:0', note: 'shade', whyNotMaterial: 'same meaning' }]));
    expect([minor.out.status, minor.out.framePackets.length]).toEqual(['review_supported_with_notes', 9]);
    expect(minor.out.framePackets.every(p => (p.context as any).reviewImpact?.notes.length === 1)).toBe(true);
    const [planner, reader] = minor.calls;
    expect(planner.maxOutputTokens).toBe(personalBookOutputLimits(8, { selfCheck: true }).storyboardOutputTokens);
    expect(planner.context).toMatchObject({ selfCheckContract: true, momentContract: true, actorOwnedAppearance: true });
    expect(planner.instructions).toContain(SELF_CHECK_STORYBOARD_ADDENDUM);
    expect(reader.instructions.endsWith(`\n${SELF_CHECK_REVIEW_ADDENDUM}\n${STORYBOARD_REVIEW_IMPACT_ADDENDUM}`)).toBe(true);
    expect([reader.schema === impactStoryboardReviewSchema, (reader.context as any).reviewImpactPolicy]).toEqual([true, true]);
    expect(JSON.parse(reader.input)).toMatchObject({ selfCheck: { version: STORYBOARD_SELF_CHECK_VERSION }, reviewImpact: { version: STORYBOARD_REVIEW_IMPACT_VERSION } });
    expect(source.sourceDigest).toBe(minor.out.sourceDigest);
    const held = await go(x => set(x.frames[6].checks[0], 'contradiction', 'the action is omitted',
      [{ impact: 'story', ref: 'p6', note: 'the action is omitted', whyNotMaterial: '' }]));
    expect([held.out.status, held.out.framePackets.length]).toEqual(['held_contradiction', 0]);
    expect(impactStoryboardReviewSchema).not.toBe(personalStoryboardReviewSchema);
  });
});
