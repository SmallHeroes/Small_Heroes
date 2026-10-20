import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { fullSelfCheck } from './storyboard-self-check-fixture';
import { resolvePersonalWizardOptions } from '../options';
import { preparePersonalStoryboard, compilePersonalStoryboard, personalStoryboardFrame, personalStoryboardReviewInput, storyboardInstructions,
  storyboardReviewDisposition, claimBasisStoryboardReviewSchema, calibrationStoryboardReviewSchema } from '../storyboard';
import { STORYBOARD_MOMENTS_VERSION } from '../storyboard-moments';
import { CLAIM_BASIS_REVIEW_ADDENDUM, claimBasisSectionsView, sourceSpans } from '../storyboard-claim-basis';
import { SELF_CHECK_STORYBOARD_ADDENDUM } from '../storyboard-self-check';
import { STORYBOARD_REVIEW_IMPACT_ADDENDUM, storyboardFrameClaims } from '../storyboard-review-impact';
import { STORYBOARD_ATTEMPT_EXTENSION_VERSION, STORYBOARD_ATTEMPT_EXTENSION_V2, assertStoryboardRepair } from '../storyboard-repair';
import { STORYBOARD_CALIBRATION_VERSION, CALIBRATION_COMPONENTS, CALIBRATION_STORYBOARD_ADDENDUM, CALIBRATION_REVIEW_IMPACT_ADDENDUM, CALIBRATION_REVIEW_ADDENDUM,
  multispanCitationBinds, citationText, relationLifetimeViolations, validateVisualStates, findingGroups, severityMaterial } from '../storyboard-calibration';
import { personalBookProviderSchema } from '../book-openai';
import { previewStoryEvidence } from '../../local-story-preview';
import { storyboardReviewInstructions } from '../simple-storyboard-diagnostic';
import { savedCalibrationContract } from '../../../scripts/personal-simple-book-reviewed-audition';

const options = resolvePersonalWizardOptions();
type Fixture = Awaited<ReturnType<typeof personalStoryboardFixture>>;
// Page 6: 'They climb inside the hut again, and the ribbon stays with נועה.' The drawn instant is its first clause.
const DRAWN = 'They climb inside the hut again', LATER = 'the ribbon stays with נועה';
type Opts = { repair?: unknown; selfCheck?: true; impact?: true; basis?: true; calibration?: true };
/** Every source here has the moments and drawn-instant contracts; the claim basis also needs the self-check and the typed review; the calibration the claim basis. */
const prep = (f: Fixture, o: Opts = {}) => preparePersonalStoryboard(f.request, f.result, options, undefined, true, undefined, undefined, undefined, undefined,
  o.repair as never, true, undefined, o.selfCheck ?? (o.basis || o.calibration ? true : undefined), o.impact ?? (o.basis || o.calibration ? true : undefined),
  o.basis ?? o.calibration, o.calibration);
/** A drawn-instant draft (page 6 drawn at its first clause, both actors beside the hut, one requirement quoted from its later clause). */
function drawnDraft(f: Fixture, change?: (draft: any) => void) {
  const frames: any[] = Array.from({ length: f.result.manuscript.pages.length + 1 }, () => ({ requirements: [], depicted: null }));
  frames[6] = { requirements: [{ kind: 'show', subject: 'the red ribbon still in the child\'s hand', evidence: LATER }],
    depicted: { evidence: DRAWN, attributes: [], actorStates: [], relations: ['child', 'companion'].map(entityId => ({ entityId, value: { relation: 'beside', targetId: 'hut' }, evidence: DRAWN })) } };
  const draft: any = { ...structuredClone(f.draft), moments: { version: STORYBOARD_MOMENTS_VERSION, frames } };
  change?.(draft);
  return draft;
}
/** The same draft in the claim basis's shape: every frame lists staging, every show/avoid requirement null entityId and revealPage. */
const asBasis = (draft: any) => { const d = structuredClone(draft); d.moments.frames = d.moments.frames.map((fr: any) => ({ ...fr, staging: fr.staging ?? [],
  requirements: fr.requirements.map((r: any) => ({ entityId: null, revealPage: null, ...r })) })); return d; };
const basisDraft = (f: Fixture, change?: (draft: any) => void) => { const d = asBasis(drawnDraft(f)); change?.(d); return d; };
const textsOf = (source: ReturnType<typeof prep>) => previewStoryEvidence(source.story).texts;
/** The planner's self-check (on the contract's neutral view); under the calibration with its visual-state map. */
const withCheck = (draft: any, source: ReturnType<typeof prep>, visualStates?: unknown[], repair?: { diagnosis: any; parentDraft: unknown }) =>
  ({ ...draft, selfCheck: { ...fullSelfCheck(claimBasisSectionsView(draft), textsOf(source),
    repair ? { ...repair, parentDraft: claimBasisSectionsView(repair.parentDraft) } : undefined), ...(visualStates ? { visualStates } : {}) } });
/** A typed review of `book` from the fixture's supported one; every check lists its issues (none when supported). */
const reviewOf = (f: Fixture, book: { sourceDigest: string; storyboardDigest: string }, change?: (r: any) => void, typed = true) => {
  const r: any = { ...structuredClone(f.review), sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest };
  if (typed) for (const c of [...r.bookChecks, ...r.frames.flatMap((x: any) => x.checks)]) c.issues = [];
  change?.(r);
  return r;
};
const set = (check: any, verdict: string, observation: string, issues?: unknown[]) => Object.assign(check, { verdict, observation, ...(issues ? { issues } : {}) });
/** A calibration issue: the typed issue, its citation and the reviewer's basis. */
const cal = (impact: string, ref: string, basis: string, whyNotMaterial = '', citation = '') => ({ impact, ref, note: 'what the reviewer saw', whyNotMaterial, citation, basis });
const WHY = 'it changes no event, identity, age, safety or material relation';
/** A supporting character beside the companion on page 1 (visible there only, unless `seenAgainOn`), or anchored at the garden. */
const withCat = (d: any, o: { seenAgainOn?: number; anchor?: true } = {}) => {
  d.plan.continuity.entities.push({ id: 'cat', kind: 'supporting_character', invariants: [{ attribute: 'design', value: 'small grey cat' }] });
  d.sequence.initialStates.push({ entityId: 'cat', value: o.anchor ? { relation: 'at', targetId: 'garden' } : { relation: 'beside', targetId: 'companion' } });
  const shown = (n: number) => n === 1 || n === o.seenAgainOn;
  d.sequence.pages.forEach((p: any, i: number) => { if (shown(i + 1)) p.visibleCastIds = [...p.visibleCastIds, 'cat']; });
  d.plan.continuity.pages.forEach((p: any, n: number) => { if (n >= 1 && shown(n)) p.visibleEntityIds = [...p.visibleEntityIds, 'cat']; });
};
/** The ribbon's colour as a mutable attribute changed on page 3, and the visual language stating it. */
const PHRASE = 'the ribbon turns a little crumpled once they set out';
const withFade = (d: any) => {
  d.plan.visualLanguage = `warm watercolor; ${PHRASE}`;
  d.sequence.mutableAttributes = [{ entityId: 'ribbon', attribute: 'color' }];
  d.plan.continuity.pages[3].changes = [{ entityId: 'ribbon', attribute: 'color', value: 'red, a little crumpled', storyEvidence: 'carrying the ribbon' }];
};

describe('storyboard-calibration/v1 (opt-in, owner-approved 2026-10-20): the visual-completion rule, multi-span citations, relation lifetime, one source for state', { timeout: 120_000 }, () => {
  it('absent: byte-identical; it needs the claim basis; its entries REPLACE the grounding, typed-impact, citation and claims entries; provider shapes; marker and review input', async () => {
    const f = await personalStoryboardFixture();
    expect(preparePersonalStoryboard(f.request, f.result, options).sourceDigest).toBe('f1ad9a28816945b860324527a4050018ecd43cbb4eae2bd01b60975dfc4344f5');
    expect(f.book.storyboardDigest).toBe('cb09f0812bafb902f1a7c27de12cc0593636b42b2e33498ac9501c20402c8c1f');
    expect(() => preparePersonalStoryboard(f.request, f.result, options, undefined, true, undefined, undefined, undefined, undefined, undefined, true, undefined,
      true, true, undefined, true)).toThrow('personal_storyboard_calibration_policy');
    const basis = prep(f, { basis: true }), calibrated = prep(f, { calibration: true });
    expect(calibrated.sourceDigest).not.toBe(basis.sourceDigest);
    // The planner: the self-check's grounding entry is replaced (never contradicted) and the calibration addendum follows the claim basis.
    const ins = storyboardInstructions(calibrated), before = storyboardInstructions(basis);
    expect([ins.includes(CALIBRATION_STORYBOARD_ADDENDUM), ins.includes('A null one is a visual completion'), ins.includes('a null one is shown generically in the plan')])
      .toEqual([true, true, false]);
    expect([before.includes(SELF_CHECK_STORYBOARD_ADDENDUM), before.includes('CALIBRATION')]).toEqual([true, false]);
    // The review: the typed-impact, citation, claims and grounding entries replaced; the calibration addendum closes the instruction.
    const contracts = { momentContract: true, drawnInstantContract: true, selfCheckContract: true, reviewImpactPolicy: true, claimBasisContract: true } as const;
    const review = storyboardReviewInstructions({ ...contracts, calibrationContract: true }), old = storyboardReviewInstructions(contracts);
    expect([review.includes(CALIBRATION_REVIEW_IMPACT_ADDENDUM), review.includes(STORYBOARD_REVIEW_IMPACT_ADDENDUM), review.endsWith(`\n${CALIBRATION_REVIEW_ADDENDUM}`),
      review.includes('one to three spans of ONE of the claim\'s own pages'), review.includes('but ONE span of the claim\'s own page'),
      review.includes('unless one to three spans of its page together state it'), review.includes('An unquoted one (quote null, or missing here) is setting')])
      .toEqual([true, false, true, true, false, true, true]);
    expect([old.includes(STORYBOARD_REVIEW_IMPACT_ADDENDUM), old.includes(CLAIM_BASIS_REVIEW_ADDENDUM), old.includes('CALIBRATION')]).toEqual([true, true, false]);
    expect(storyboardReviewInstructions({ ...contracts, claimBasisContract: undefined, calibrationContract: true })).not.toContain('CALIBRATION (storyboard-calibration');
    // Provider shapes: the planner's visual-state map and the review issue's basis exist only under the contract, which needs the claim basis.
    const ctx = { narrativeSpreads: 8, sourceDigest: 'a'.repeat(64), storyboardDigest: 'b'.repeat(64), momentContract: true as const, drawnInstantContract: true as const,
      selfCheckContract: true as const, reviewImpactPolicy: true as const, claimBasisContract: true as const };
    const provider = (stage: 'storyboard' | 'review', on: boolean) =>
      personalBookProviderSchema({ stage, context: { ...ctx, ...(on ? { calibrationContract: true } : {}) } } as any) as any;
    expect([Object.keys(provider('storyboard', true).shape.selfCheck.shape).sort(), Object.keys(provider('storyboard', false).shape.selfCheck.shape).sort()])
      .toEqual([['designs', 'frames', 'resolutions', 'version', 'visualStates'], ['designs', 'frames', 'resolutions', 'version']]);
    const issueKeys = (on: boolean) => Object.keys(provider('review', on).shape.bookChecks.shape.approved_facts.shape.issues.element.shape).sort();
    expect([issueKeys(true), issueKeys(false)]).toEqual([['basis', 'citation', 'impact', 'note', 'ref', 'whyNotMaterial'], ['citation', 'impact', 'note', 'ref', 'whyNotMaterial']]);
    expect(() => personalBookProviderSchema({ stage: 'review', context: { ...ctx, claimBasisContract: undefined, calibrationContract: true } } as any)).toThrow('book_provider_context');
    // The book: its marker (components and the planner's validated map) is in the digest; the review input carries it; the loader reads it.
    const draft = basisDraft(f), book = compilePersonalStoryboard(calibrated, withCheck(draft, calibrated, []));
    const plainBook = compilePersonalStoryboard(basis, withCheck(draft, basis));
    expect(book.calibration).toEqual({ version: STORYBOARD_CALIBRATION_VERSION, components: [...CALIBRATION_COMPONENTS], visualStates: [] });
    expect([book.storyboardDigest === plainBook.storyboardDigest, 'calibration' in plainBook]).toEqual([false, false]);
    expect(personalStoryboardReviewInput(book)).toMatchObject({ calibration: { version: STORYBOARD_CALIBRATION_VERSION, visualStates: [] } });
    expect('calibration' in personalStoryboardReviewInput(plainBook)).toBe(false);
    expect([savedCalibrationContract(undefined), savedCalibrationContract({}), savedCalibrationContract({ calibration: { version: STORYBOARD_CALIBRATION_VERSION } })])
      .toEqual([undefined, undefined, true]);
    expect(() => savedCalibrationContract({ calibration: { version: 'storyboard-calibration/v2' } })).toThrow('audition_board_binding');
    // A frame packet builds from the calibrated book (its source re-prepared under the same contract).
    expect(personalStoryboardFrame(book, reviewOf(f, book, r => { for (const c of [...r.bookChecks, ...r.frames.flatMap((x: any) => x.checks)]) c.issues = []; }), 1, f.current)
      .packetDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('severity: the reviewer\'s basis decides; a justified setting or inference is a note; a contradiction, an unsupported consequential element and safety/story/identity block', async () => {
    const f = await personalStoryboardFixture(), source = prep(f, { calibration: true });
    const book = compilePersonalStoryboard(source, withCheck(basisDraft(f), source, []));
    const decide = (issues: unknown[], verdict = 'uncertain') => storyboardReviewDisposition(book, reviewOf(f, book,
      r => set(r.frames[3].checks[3], verdict, 'the plan places the garden more precisely than the text', issues)));
    // Notes: a justified visual completion or a reasonable inference (evidence, continuity or detail impact).
    for (const [impact, basis] of [['evidence', 'setting'], ['continuity', 'inference'], ['evidence', 'inference'], ['detail', 'setting']])
      expect([impact, basis, decide([cal(impact, 'location:garden', basis, WHY)]).disposition]).toEqual([impact, basis, 'review_supported_with_notes']);
    const note = decide([cal('evidence', 'location:garden', 'setting', WHY)]);
    expect(note.impact!.notes[0].issues[0]).toMatchObject({ basis: 'setting', whyNotMaterial: WHY });
    // Blocking: no reason, an unsupported consequential element, a contradiction (whatever its impact), and safety, story or identity whatever the basis.
    expect(decide([cal('evidence', 'location:garden', 'setting')]).disposition).toBe('held_uncertain');
    expect(decide([cal('evidence', 'location:garden', 'unsupported', WHY)]).disposition).toBe('held_uncertain');
    for (const impact of ['continuity', 'detail', 'evidence'])
      expect([impact, decide([cal(impact, 'location:garden', 'contradiction', WHY)], 'contradiction').disposition]).toEqual([impact, 'held_contradiction']);
    for (const impact of ['safety', 'story', 'identity']) for (const basis of ['setting', 'inference'])
      expect([impact, basis, decide([cal(impact, 'location:garden', basis, WHY)]).disposition]).toEqual([impact, basis, 'held_uncertain']);
    // One blocking issue holds the check even beside a note.
    expect(decide([cal('evidence', 'location:garden', 'setting', WHY), cal('evidence', 'p3:transition:child', 'unsupported')]).disposition).toBe('held_uncertain');
    // The materiality rule itself.
    expect([severityMaterial({ impact: 'evidence', basis: 'unsupported' }, true), severityMaterial({ impact: 'evidence', basis: 'unsupported' }, false),
      severityMaterial({ impact: 'evidence', basis: 'contradiction' }, true), severityMaterial({ impact: 'story', basis: 'setting' }, true)]).toEqual([false, true, true, true]);
    // The schemas: the calibration issue needs a basis; the claim basis's strict issue refuses one (absent, exactly the existing review).
    const withBasis = reviewOf(f, book, r => set(r.frames[3].checks[3], 'uncertain', 'x', [cal('evidence', 'location:garden', 'setting', WHY)]));
    const { basis: _b, ...noBasis } = cal('evidence', 'location:garden', 'setting', WHY);
    expect([calibrationStoryboardReviewSchema.safeParse(withBasis).success, claimBasisStoryboardReviewSchema.safeParse(withBasis).success,
      calibrationStoryboardReviewSchema.safeParse(reviewOf(f, book, r => set(r.frames[3].checks[3], 'uncertain', 'x', [noBasis]))).success]).toEqual([true, false, false]);
  });

  it('multi-span citations: one to three spans of ONE of the claim\'s own pages, in text order, whose joined text is not the claim\'s own quote', async () => {
    const f = await personalStoryboardFixture(), source = prep(f, { calibration: true }), spans = sourceSpans(textsOf(source));
    expect(spans.p1.map(s => s.id)).toEqual(['p1:s1', 'p1:s2']);
    const claims = new Map([['p1:x', { evidence: 'wait inside their wooden hut', pages: [1] }], ['p0:requirement:0', { evidence: 'A red ribbon', pages: [0, 1] }],
      ['p1:whole', { evidence: spans.p1[0].text, pages: [1] }]]);
    const binds = (ref: string, citation: string, why = WHY, impact = 'evidence') => multispanCitationBinds({ impact, ref, citation, whyNotMaterial: why }, claims, spans);
    expect([binds('p1:x', 'p1:s1+p1:s2'), binds('p1:x', 'p1:s1'), binds('p0:requirement:0', 'p1:s1+p1:s2')]).toEqual([true, true, true]);
    // Refused: reversed order, a duplicate, another page, more than three, a missing span, another page's claim, the claim's own quote, no reason, another impact.
    expect([binds('p1:x', 'p1:s2+p1:s1'), binds('p1:x', 'p1:s1+p1:s1'), binds('p1:x', 'p1:s1+p2:s1'), binds('p1:x', 'p1:s1+p1:s2+p1:s3+p1:s4'),
      binds('p1:x', 'p1:s9'), binds('p1:x', 'p2:s1'), binds('p1:whole', 'p1:s1'), binds('p1:x', 'p1:s1+p1:s2', ''), binds('p1:x', 'p1:s1+p1:s2', WHY, 'story')])
      .toEqual([false, false, false, false, false, false, false, false, false]);
    expect(citationText(spans, 'p1:s1+p1:s2')).toBe(`${spans.p1[0].text} … ${spans.p1[1].text}`);
    // At most three, even on a page with four sentences.
    const long = { p9: [1, 2, 3, 4].map(k => ({ id: `p9:s${k}`, text: `Sentence ${k}.` })) }, nine = new Map([['p9:x', { evidence: 'Sentence', pages: [9] }]]);
    const bindsLong = (citation: string) => multispanCitationBinds({ impact: 'evidence', ref: 'p9:x', citation, whyNotMaterial: WHY }, nine, long);
    expect([bindsLong('p9:s1+p9:s2+p9:s3'), bindsLong('p9:s2+p9:s3+p9:s4'), bindsLong('p9:s1+p9:s2+p9:s3+p9:s4')]).toEqual([true, true, false]);
    // On the book: a cover requirement cited by two spans of page 1 is a binding note, and the cover's packet carries the joined text.
    const cover = compilePersonalStoryboard(source, withCheck(basisDraft(f, d => { d.moments.frames[0].requirements = [{ kind: 'show',
      subject: 'the red ribbon in her hand on the cover', evidence: 'A red ribbon', entityId: null, revealPage: null }]; }), source, []));
    const raw = reviewOf(f, cover, r => set(r.frames[0].checks[2], 'uncertain', 'narrow', [cal('evidence', 'p0:requirement:0', 'unsupported', WHY, 'p1:s1+p1:s2')]));
    expect(storyboardReviewDisposition(cover, raw).disposition).toBe('review_supported_with_notes');
    expect((personalStoryboardFrame(cover, raw, 0, f.current).context as any).claimBasis.citations)
      .toEqual([{ ref: 'p0:requirement:0', citation: 'p1:s1+p1:s2', text: `${spans.p1[0].text} … ${spans.p1[1].text}` }]);
    // Without the calibration the same two-span citation does not bind (the claim basis's single span), and the schema refuses it.
    expect(claimBasisStoryboardReviewSchema.safeParse(raw).success).toBe(false);
    expect(storyboardReviewDisposition(cover, reviewOf(f, cover, r => set(r.frames[0].checks[2], 'uncertain', 'narrow',
      [cal('evidence', 'p0:requirement:0', 'unsupported', WHY, 'p1:s2+p1:s1')]))).disposition).toBe('held_uncertain');
  });

  it('relation lifetime: a relation beside, on or held by an actor who changes place refuses when the entity is never visible again; a seen-again, anchored or carried prop stays', async () => {
    const f = await personalStoryboardFixture(), source = prep(f, { calibration: true }), basis = prep(f, { basis: true });
    const compileOf = (o?: Parameters<typeof withCat>[1], s = source) => () => {
      const d = basisDraft(f, d => withCat(d, o));
      return compilePersonalStoryboard(s, withCheck(d, s, s === source ? [] : undefined));
    };
    // The companion moves from the garden (inside, then beside the hut) to the lane on page 4 and back on page 5; the cat, beside it since page 1,
    // is never shown again, so it would travel unseen both times (every such page is reported).
    const plain = compileOf(undefined, basis)();
    expect(relationLifetimeViolations(plain.plan, plain.sequence)).toEqual([
      { pageNumber: 4, entityId: 'cat', relation: 'beside', targetId: 'companion', from: 'garden', to: 'lane' },
      { pageNumber: 5, entityId: 'cat', relation: 'beside', targetId: 'companion', from: 'lane', to: 'garden' }]);
    expect(compileOf()).toThrow('personal_storyboard_calibration_relation_lifetime');
    // Seen again (it travelled with them), anchored at a place, or the ribbon held by the child and shown later: nothing refuses.
    for (const o of [{ seenAgainOn: 5 }, { anchor: true as const }]) {
      const b = compileOf(o, basis)();
      expect([o, relationLifetimeViolations(b.plan, b.sequence)]).toEqual([o, []]);
      expect(compileOf(o)).not.toThrow();
    }
    expect(relationLifetimeViolations(f.book.plan, f.book.sequence)).toEqual([]);
  });

  it('one source for state: each visual-language phrase maps to changes of mutable attributes; its own words, existing change refs, once each; the review reads the map', async () => {
    const f = await personalStoryboardFixture(), source = prep(f, { calibration: true });
    const draft = basisDraft(f, withFade), ok = [{ phrase: PHRASE, refs: ['p3:change:ribbon:color'] }];
    const book = compilePersonalStoryboard(source, withCheck(draft, source, ok));
    expect(book.calibration!.visualStates).toEqual(ok);
    expect(personalStoryboardReviewInput(book)).toMatchObject({ calibration: { visualStates: ok } });
    const compileWith = (visualStates?: unknown[]) => () => compilePersonalStoryboard(source, withCheck(draft, source, visualStates));
    expect(compileWith([])).not.toThrow();
    // The map is part of the book's digest (the marker carries it).
    expect(compileWith([])().storyboardDigest).not.toBe(book.storyboardDigest);
    for (const [name, visualStates, code] of [
      ['not its own words', [{ phrase: 'the ribbon fades', refs: ['p3:change:ribbon:color'] }], 'visual_state_phrase'],
      ['not a change', [{ phrase: PHRASE, refs: ['p3:transition:child'] }], 'visual_state_ref'],
      ['a change that does not exist', [{ phrase: PHRASE, refs: ['p6:change:hut:material'] }], 'visual_state_ref'],
      ['the same ref twice', [{ phrase: PHRASE, refs: ['p3:change:ribbon:color', 'p3:change:ribbon:color'] }], 'visual_state_ref'],
      ['no refs', [{ phrase: PHRASE, refs: [] }], 'visual_state_shape'],
      ['nine entries', Array.from({ length: 9 }, () => ok[0]), 'visual_state_shape']] as const)
      expect(compileWith(visualStates as unknown as unknown[]), name).toThrow(`storyboard_calibration_${code}`);
    expect(compileWith(undefined)).toThrow('storyboard_calibration_visual_state_shape');
    // Structure only: the validator itself, on the compiled plan and ledger (a change of an attribute that is not mutable is refused there too).
    const changeClaims = (n: number) => storyboardFrameClaims(book, n).map(c => c.ref).filter(r => /^p\d+:change:/.test(r));
    expect(validateVisualStates(ok, book.plan, book.sequence, changeClaims)).toEqual(ok);
    const frozen = { ...book.sequence, mutableAttributes: [] };
    expect(() => validateVisualStates(ok, book.plan, frozen as any, changeClaims)).toThrow('storyboard_calibration_visual_state_not_mutable');
  });

  it('the chained owner extension (v2) and the finding groups: exactly one attempt above the previous extension, naming it, only once it is spent', async () => {
    const f = await personalStoryboardFixture();
    // Four consecutive held candidates: the claim-basis spec's chain (recovery, repair, continuation, the v1 extension), then the extension's own held review.
    const hiddenOnP4 = (d: any) => { d.sequence.pages[3].visibleCastIds = ['child'];
      d.moments.frames[4] = { requirements: [], depicted: { evidence: 'They walk down the lane', actorStates: [], attributes: [],
        relations: [{ entityId: 'companion', value: { relation: 'beside', targetId: 'hut' }, evidence: 'They walk down the lane' }] } }; };
    const d1 = drawnDraft(f, hiddenOnP4), b1 = compilePersonalStoryboard(prep(f), d1);
    const r1 = reviewOf(f, b1, r => { set(r.bookChecks[1], 'contradiction', 'the causal action is omitted'); set(r.frames[2].checks[0], 'contradiction', 'page 2 idea'); }, false);
    const repair1 = { parentStoryboardDigest: b1.storyboardDigest, draft: d1, review: r1 };
    const d2 = drawnDraft(f, d => { hiddenOnP4(d); d.plan.pages[2].composition = 'the idea, framed from the doorway'; });
    const b2 = compilePersonalStoryboard(prep(f, { repair: repair1 }), d2);
    const r2 = reviewOf(f, b2, r => { set(r.bookChecks[1], 'contradiction', 'the causal action is still omitted, now on another page'); set(r.frames[4].checks[2], 'contradiction', 'page 4 state'); }, false);
    const continuation = { parentStoryboardDigest: b2.storyboardDigest, draft: d2, review: r2, parentRepair: repair1, addedContracts: ['selfCheckContract', 'reviewImpactPolicy'] };
    const s3 = prep(f, { repair: continuation, selfCheck: true, impact: true }), diagnosis3 = (s3.planningInput as any).priorReviewedStoryboard.diagnosis;
    const d3plain = drawnDraft(f, d => { hiddenOnP4(d); d.plan.pages[2].composition = d2.plan.pages[2].composition; d.plan.pages[4].composition = 'the lane, the pause made visible';
      d.plan.pages[5].composition = 'the return, framed from the gate'; });
    const d3 = { ...d3plain, selfCheck: fullSelfCheck(d3plain, textsOf(s3), { diagnosis: diagnosis3, parentDraft: d2 }) }, b3 = compilePersonalStoryboard(s3, structuredClone(d3));
    const r3 = reviewOf(f, b3, r => set(r.frames[6].checks[0], 'contradiction', 'the causal action is still omitted', [{ impact: 'story', ref: 'p6:instant', note: 'omitted', whyNotMaterial: '' }]));
    const v1 = { version: STORYBOARD_ATTEMPT_EXTENSION_VERSION, maxAttempts: 4, approvalSha256: 'a'.repeat(64) };
    const ext4 = { parentStoryboardDigest: b3.storyboardDigest, draft: d3, review: r3, parentRepair: continuation, addedContracts: ['claimBasisContract'], extension: v1 };
    const s4 = prep(f, { repair: ext4, basis: true }), input4 = s4.planningInput as any;
    const d4 = asBasis(d3plain);
    d4.plan.pages[6].composition = 'the climb in, drawn at its causal moment';
    const draft4 = withCheck(d4, s4, undefined, { diagnosis: input4.priorReviewedStoryboard.diagnosis, parentDraft: d3 });
    const b4 = compilePersonalStoryboard(s4, structuredClone(draft4), { selfCheckNames: true });
    // Attempt 4's own review holds it: two checks on the same location (one cause), one on page 6's instant.
    const r4 = reviewOf(f, b4, r => {
      set(r.frames[3].checks[3], 'uncertain', 'the garden is more precise than the text', [{ impact: 'evidence', ref: 'location:garden', note: 'garden', whyNotMaterial: '', citation: '' }]);
      set(r.frames[5].checks[3], 'uncertain', 'the garden again', [{ impact: 'evidence', ref: 'location:garden', note: 'garden', whyNotMaterial: '', citation: '' }]);
      set(r.frames[6].checks[0], 'contradiction', 'the instant', [{ impact: 'story', ref: 'p6:instant', note: 'omitted', whyNotMaterial: '', citation: '' }]); });
    expect(storyboardReviewDisposition(b4, r4).disposition).toBe('held_uncertain');
    const v2 = { version: STORYBOARD_ATTEMPT_EXTENSION_V2, maxAttempts: 5, approvalSha256: 'c'.repeat(64), previous: v1 };
    const ext5 = { parentStoryboardDigest: b4.storyboardDigest, draft: draft4, review: r4, parentRepair: ext4, addedContracts: ['calibrationContract'],
      parentCompile: { selfCheckNames: true }, extension: v2 };
    const s5 = prep(f, { repair: ext5, calibration: true }), input5 = s5.planningInput as any;
    expect(input5.priorReviewedStoryboard.diagnosis.allowance).toEqual({ nextAttempt: 5, maxAttempts: 5, remainingAfterNext: 0 });
    // The finding groups: one group per reference, naming every check it holds (one group is one cause).
    expect(input5.priorReviewedStoryboard.findingGroups).toEqual([{ ref: 'location:garden', checks: ['page:3:identity_and_set', 'page:5:identity_and_set'] },
      { ref: 'p6:instant', checks: ['page:6:moment'] }]);
    expect(findingGroups([{ scope: 'book', category: 'continuity', issues: [{ ref: 'a' }, { ref: 'a' }] }])).toEqual([{ ref: 'a', checks: ['book:continuity'] }]);
    // Without the calibration a repair carries no groups.
    const { addedContracts: _a, ...noCalibration } = ext5;
    expect('findingGroups' in (prep(f, { repair: noCalibration, basis: true }).planningInput as any).priorReviewedStoryboard).toBe(false);
    // Bound: the v1 extension cannot reach attempt 5; a v2 must name exactly the extension the parent used, be exactly one above it, and have a repaired parent.
    expect(() => prep(f, { repair: { ...ext5, extension: v1 }, calibration: true })).toThrow('personal_storyboard_repair_policy');
    expect(() => prep(f, { repair: { ...ext5, extension: { ...v2, previous: { ...v1, approvalSha256: 'b'.repeat(64) } } }, calibration: true })).toThrow('personal_storyboard_repair_policy');
    expect(() => prep(f, { repair: { ...ext5, extension: { ...v2, maxAttempts: 6 } }, calibration: true })).toThrow('personal_storyboard_repair_policy');
    expect(() => assertStoryboardRepair({ ...ext5, parentRepair: undefined })).toThrow('personal_storyboard_repair_policy');
    expect(() => assertStoryboardRepair({ parentStoryboardDigest: 'd'.repeat(64), draft: {}, review: {}, extension: v2 })).toThrow('personal_storyboard_repair_policy');
    // A v2 one attempt early (its previous not yet spent: attempt 4's chain) is refused by the engine's policy.
    expect(() => prep(f, { repair: { ...ext4, addedContracts: ['claimBasisContract'], extension: { ...v2, maxAttempts: 4, previous: { ...v1, maxAttempts: 3 } } },
      basis: true })).toThrow(/personal_storyboard_repair_(extension_)?policy/);
    // The parent's compile options are its own: the staging-fields option is accepted in shape, and binds only to a parent compiled under it
    // (attempt 4 here was not, so it does not recompile to its digest).
    expect(() => assertStoryboardRepair({ ...ext5, parentCompile: { selfCheckNames: true, stagingFields: true } })).not.toThrow();
    expect(() => assertStoryboardRepair({ ...ext5, parentCompile: { stagingFields: true } })).toThrow('personal_storyboard_repair_policy');
    expect(() => prep(f, { repair: { ...ext5, parentCompile: { selfCheckNames: true, stagingFields: true } }, calibration: true }))
      .toThrow('personal_storyboard_repair_binding');
  });

  const BOOK = 'C:/GNart/Work/book-renders/fresh-book-usd7-20261018';
  const XREVAL_RESULT = path.join(BOOK, 'storyboard-extension-revalidation', 'simple-book-result.json');
  it.skipIf(!existsSync(XREVAL_RESULT))('the real attempt 4 (read only): the relation check names the lizard; the state check refuses the only listing its visual language allowed; two spans bind page 3', () => {
    const result = JSON.parse(readFileSync(XREVAL_RESULT, 'utf8')), board = result.storyboard.storyboard;
    // The lizard, beside the companion from page 3 and never shown again, would travel unseen on every page the companion changes place.
    expect(relationLifetimeViolations(board.plan, board.sequence)).toEqual([
      { pageNumber: 4, entityId: 'lizard', relation: 'beside', targetId: 'companion', from: 'crater_rim', to: 'spiral_trail' },
      { pageNumber: 7, entityId: 'lizard', relation: 'beside', targetId: 'companion', from: 'spiral_trail', to: 'behind_rock_hollow' },
      { pageNumber: 8, entityId: 'lizard', relation: 'beside', targetId: 'companion', from: 'behind_rock_hollow', to: 'yonatan_home' }]);
    const changeClaims = (n: number) => storyboardFrameClaims(board, n).map(c => c.ref).filter(r => /^p\d+:change:/.test(r));
    const phrase = 'In the ending the crater bursts back into striped purple, yellow and red';
    expect(board.plan.visualLanguage).toContain(phrase);
    expect(() => validateVisualStates([{ phrase, refs: ['p8:change:crater_walls:colour'] }], board.plan, board.sequence, changeClaims))
      .toThrow('storyboard_calibration_visual_state_ref');
    const manuscript = result.source.manuscript, texts = [manuscript.title, ...manuscript.pages.map((p: { text: string }) => p.text)];
    const spans = sourceSpans(texts), find = (start: string) => spans.p3.find(s => s.text.startsWith(start))!.id;
    const claim = storyboardFrameClaims(board, 3).find(c => c.ref === 'p3:change:lizard:skin colour')!;
    const claims = new Map([[claim.ref, { evidence: claim.evidence, pages: [3] }]]);
    const citation = `${find('ענן סגול עף')}+${find('"כלומר, הייתי ירוקה')}`;
    expect(multispanCitationBinds({ impact: 'evidence', ref: claim.ref, citation, whyNotMaterial: WHY }, claims, spans)).toBe(true);
  });
});
