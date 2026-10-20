import { describe, expect, it } from 'vitest';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { fullSelfCheck } from './storyboard-self-check-fixture';
import { replanFixture } from './storyboard-replan-fixture';
import { resolvePersonalWizardOptions } from '../options';
import { preparePersonalStoryboard, prepareCurrentPersonalStoryboard, compilePersonalStoryboard, personalStoryboardFrame, personalStoryboardReviewInput,
  storyboardInstructions, storyboardReviewDisposition, claimBasisStoryboardReviewSchema } from '../storyboard';
import { STORYBOARD_MOMENTS_VERSION, momentRenderSection } from '../storyboard-moments';
import { CLAIM_BASIS_CONTRACT_VERSION, CLAIM_BASIS_STORYBOARD_ADDENDUM, CLAIM_BASIS_DRAWN_INSTANT_RULE, CLAIM_BASIS_REVIEW_ADDENDUM,
  CLAIM_BASIS_SELF_CHECK_REVIEW_RULE, claimBasisSectionsView, sourceSpans, citationBinds, CLAIM_BASIS_STAGING_FIELDS_VERSION, CLAIM_BASIS_STAGING_FIELDS_REVIEW_RULE,
  stagedPlanFields } from '../storyboard-claim-basis';
import { storyboardReviewRefs } from '../storyboard-review-impact';
import { STORYBOARD_ATTEMPT_EXTENSION_VERSION } from '../storyboard-repair';
import { personalBookProviderSchema } from '../book-openai';
import { previewStoryEvidence } from '../../local-story-preview';
import { runSimpleStoryboardDiagnostic, storyboardReviewInstructions, type SimpleStoryboardDiagnosticCall } from '../simple-storyboard-diagnostic';
import { savedClaimBasisContract, savedStagingFields } from '../../../scripts/personal-simple-book-reviewed-audition';

const options = resolvePersonalWizardOptions();
type Fixture = Awaited<ReturnType<typeof personalStoryboardFixture>>;
// Page 6: 'They climb inside the hut again, and the ribbon stays with נועה.' The drawn instant is its first clause.
const DRAWN = 'They climb inside the hut again', LATER = 'the ribbon stays with נועה';
type Opts = { repair?: unknown; selfCheck?: true; impact?: true; basis?: true };
/** Every source here has the moments and drawn-instant contracts; the claim basis also needs the self-check and the typed review. */
const prep = (f: Fixture, o: Opts = {}) => preparePersonalStoryboard(f.request, f.result, options, undefined, true, undefined, undefined, undefined, undefined,
  o.repair as never, true, undefined, o.selfCheck ?? (o.basis ? true : undefined), o.impact ?? (o.basis ? true : undefined), o.basis);
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
/** The planner's self-check, built on the contract's neutral view (as the compiler measures it). */
const withCheck = (draft: any, source: ReturnType<typeof prep>, edit?: (s: any) => void, repair?: { diagnosis: any; parentDraft: unknown }) =>
  ({ ...draft, selfCheck: fullSelfCheck(claimBasisSectionsView(draft), textsOf(source), repair ? { ...repair, parentDraft: claimBasisSectionsView(repair.parentDraft) } : undefined, edit) });
/** A typed review of `book` from the fixture's supported one; every check lists its issues (none when supported). */
const reviewOf = (f: Fixture, book: { sourceDigest: string; storyboardDigest: string }, change?: (r: any) => void, typed = true) => {
  const r: any = { ...structuredClone(f.review), sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest };
  if (typed) for (const c of [...r.bookChecks, ...r.frames.flatMap((x: any) => x.checks)]) c.issues = [];
  change?.(r);
  return r;
};
const set = (check: any, verdict: string, observation: string, issues?: unknown[]) => Object.assign(check, { verdict, observation, ...(issues ? { issues } : {}) });
const issue = (impact: string, ref: string, citation = '', whyNotMaterial = '') => ({ impact, ref, note: 'the bound quote does not state it', whyNotMaterial, citation });

describe('storyboard-claim-basis/v1 (opt-in): stated claims, visual direction, withheld reveals, verified citations, one visible-state authority', { timeout: 120_000 }, () => {
  it('absent: byte-identical; it needs the moments, drawn-instant, self-check and typed-review contracts; its rules REPLACE the drawn-instant and self-check rules', async () => {
    const f = await personalStoryboardFixture();
    expect(preparePersonalStoryboard(f.request, f.result, options).sourceDigest).toBe('f1ad9a28816945b860324527a4050018ecd43cbb4eae2bd01b60975dfc4344f5');
    expect(f.book.storyboardDigest).toBe('cb09f0812bafb902f1a7c27de12cc0593636b42b2e33498ac9501c20402c8c1f');
    for (const [selfCheck, impact, drawn] of [[undefined, true, true], [true, undefined, true], [true, true, undefined]] as const)
      expect(() => preparePersonalStoryboard(f.request, f.result, options, undefined, true, undefined, undefined, undefined, undefined, undefined, drawn, undefined,
        selfCheck, impact, true)).toThrow('personal_storyboard_claim_basis_policy');
    const plain = prep(f, { selfCheck: true, impact: true }), basis = prep(f, { basis: true });
    expect(basis.sourceDigest).not.toBe(plain.sourceDigest);
    const ins = storyboardInstructions(basis), before = storyboardInstructions(plain);
    expect([ins.includes(CLAIM_BASIS_STORYBOARD_ADDENDUM), ins.includes(CLAIM_BASIS_DRAWN_INSTANT_RULE), ins.includes('a crop never removes a state')]).toEqual([true, true, false]);
    expect([before.includes('CLAIM BASIS'), before.includes('a crop never removes a state')]).toEqual([false, true]);
    const contracts = { momentContract: true, drawnInstantContract: true, selfCheckContract: true, reviewImpactPolicy: true } as const;
    const review = storyboardReviewInstructions({ ...contracts, claimBasisContract: true }), old = storyboardReviewInstructions(contracts);
    expect([review.includes(CLAIM_BASIS_REVIEW_ADDENDUM), review.includes(CLAIM_BASIS_SELF_CHECK_REVIEW_RULE), review.includes('even when other prose on the page states it')])
      .toEqual([true, true, false]);
    expect([old.includes('CLAIM BASIS'), old.includes('even when other prose on the page states it')]).toEqual([false, true]);
    // Provider shapes: staging, the flat requirement and the issue's citation exist only under the contract.
    const ctx = { narrativeSpreads: 8, sourceDigest: 'a'.repeat(64), storyboardDigest: 'b'.repeat(64), momentContract: true as const, drawnInstantContract: true as const,
      selfCheckContract: true as const, reviewImpactPolicy: true as const };
    const provider = (stage: 'storyboard' | 'review', basisOn: boolean) =>
      personalBookProviderSchema({ stage, context: { ...ctx, ...(basisOn ? { claimBasisContract: true } : {}) } } as any) as any;
    const frame = (on: boolean) => provider('storyboard', on).shape.moments.shape.frames.element.shape;
    const issueKeys = (on: boolean) => Object.keys(provider('review', on).shape.bookChecks.shape.approved_facts.shape.issues.element.shape).sort();
    expect([Object.keys(frame(true)).sort(), Object.keys(frame(false)).sort()]).toEqual([['depicted', 'requirements', 'staging'], ['depicted', 'requirements']]);
    expect([Object.keys(frame(true).requirements.element.shape).sort(), Object.keys(frame(false).requirements.element.shape).sort()])
      .toEqual([['entityId', 'evidence', 'kind', 'revealPage', 'subject'], ['evidence', 'kind', 'subject']]);
    expect([issueKeys(true), issueKeys(false)]).toEqual([['citation', 'impact', 'note', 'ref', 'whyNotMaterial'], ['impact', 'note', 'ref', 'whyNotMaterial']]);
    expect(() => personalBookProviderSchema({ stage: 'storyboard', context: { ...ctx, selfCheckContract: undefined, claimBasisContract: true } } as any)).toThrow('book_provider_context');
    // The legacy book's frame packet and the strict compile are untouched.
    expect(personalStoryboardFrame(f.book, f.review, 1, f.current).packetDigest).toBe('d737d76dc01ff5f9311247ec78c78a79cdf09b4579802a0b3a7160e8454514a1');
  });

  it('hidden entity not drawn: its override is dropped and recorded, never a claim, a review ref or a render line; completeness needs visible entities only', async () => {
    const f = await personalStoryboardFixture(), source = prep(f, { basis: true });
    // Page 2 shows the child and the hut only: an override of the companion there cannot change the picture.
    const hidden = (d: any) => { d.moments.frames[2] = { requirements: [], staging: [], depicted: { evidence: 'They look out from inside the hut', actorStates: [], attributes: [],
      relations: [{ entityId: 'companion', value: { relation: 'beside', targetId: 'hut' }, evidence: 'They look out from inside the hut' }] } }; };
    const draft = basisDraft(f, hidden);
    // The planner's own self-check may list the dropped claim: it is ignored, never a coverage refusal.
    const book = compilePersonalStoryboard(source, { ...draft, selfCheck: fullSelfCheck(draft, textsOf(source)) });
    expect(book.claimBasis).toEqual({ version: CLAIM_BASIS_CONTRACT_VERSION, hiddenOverridesDropped: [{ pageNumber: 2, kind: 'relation', entityId: 'companion' }] });
    expect(book.moments!.frames[2].depicted!.relations).toEqual([]);
    expect([storyboardReviewRefs(book).includes('p2:relation:companion'), book.selfCheck!.frames[2].claims.some(c => c.ref === 'p2:relation:companion')]).toEqual([false, false]);
    const packet = personalStoryboardFrame(book, reviewOf(f, book), 2, f.current);
    expect(JSON.stringify((packet.context as any).sequence)).not.toContain('"companion","value":{"relation":"beside"');
    // Two overrides of the same hidden entity: both dropped, both ignored in the planner's own self-check (the second carries its #2 suffix).
    const twice = basisDraft(f, d => { hidden(d); d.moments.frames[2].depicted.relations.push({ entityId: 'companion', value: { relation: 'inside', targetId: 'hut' },
      evidence: 'They look out from inside the hut' }); });
    const twiceCheck = fullSelfCheck(twice, textsOf(source));
    expect(twiceCheck.frames[2].claims.map((c: any) => c.ref)).toContain('p2:relation:companion#2');
    expect(compilePersonalStoryboard(source, { ...twice, selfCheck: twiceCheck }).claimBasis!.hiddenOverridesDropped).toHaveLength(2);
    // Without the contract the same override stays a reviewed claim.
    const plainSource = prep(f, { selfCheck: true, impact: true }), plainDraft = drawnDraft(f, d => { d.moments.frames[2] = { requirements: [], depicted: {
      evidence: 'They look out from inside the hut', actorStates: [], attributes: [], relations: [{ entityId: 'companion', value: { relation: 'beside', targetId: 'hut' },
        evidence: 'They look out from inside the hut' }] } }; });
    expect(storyboardReviewRefs(compilePersonalStoryboard(plainSource, { ...plainDraft, selfCheck: fullSelfCheck(plainDraft, textsOf(plainSource)) })))
      .toContain('p2:relation:companion');
    // Completeness: on page 4 the companion's change comes after the drawn instant; hidden, it needs no override; visible, it still does.
    const page4 = (visible: boolean, override = false) => basisDraft(f, d => {
      d.sequence.pages[3].transitions[1].evidence = 'then pause at the oak tree';
      if (!visible) d.sequence.pages[3].visibleCastIds = ['child'];
      d.moments.frames[4] = { requirements: [], staging: [], depicted: { evidence: 'They walk down the lane', attributes: [],
        relations: override ? [{ entityId: 'companion', value: { relation: 'beside', targetId: 'hut' }, evidence: 'They walk down the lane' }] : [],
        actorStates: [{ actorId: 'child', state: 'mid-stride on the lane', evidence: 'They walk down the lane' }] } }; });
    const compileOf = (d: any, s = source) => () => compilePersonalStoryboard(s, withCheck(d, s));
    expect(compileOf(page4(false))).not.toThrow();
    expect(compileOf(page4(true))).toThrow('storyboard_moments_drawn_instant_relation');
    // A valid before/after instant: the visible companion overridden at its relation before its later move, its quote the instant's own.
    expect(compileOf(page4(true, true))).not.toThrow();
    const plainPage4 = (() => { const d = page4(false); d.moments.frames = d.moments.frames.map(({ staging: _s, ...fr }: any) => ({ ...fr,
      requirements: fr.requirements.map(({ entityId: _e, revealPage: _r, ...r }: any) => r) })); return d; })();
    expect(() => compilePersonalStoryboard(plainSource, { ...plainPage4, selfCheck: fullSelfCheck(plainPage4, textsOf(plainSource)) }))
      .toThrow('storyboard_moments_drawn_instant_relation');
  });

  it('withheld until a reveal: bound to the FIRST later frame whose visible ids show the entity and to a sentence of that page, never to a name', async () => {
    const f = await personalStoryboardFixture(), source = prep(f, { basis: true });
    // The ribbon is not visible on page 2; the first later frame that shows it is page 3 (it is also named on pages 1 and 6).
    const withhold = (n: number, revealPage: number, evidence: string, entityId = 'ribbon', change?: (d: any) => void) => basisDraft(f, d => {
      d.moments.frames[n].requirements = [{ kind: 'withhold', subject: 'it stays out of sight until the page that shows it', evidence, entityId, revealPage }];
      change?.(d); });
    const reveal = 'They leave the hut for the garden, carrying the ribbon.', page6 = 'They climb inside the hut again, and the ribbon stays with נועה.';
    const compileOf = (d: any) => () => compilePersonalStoryboard(source, withCheck(d, source));
    const book = compilePersonalStoryboard(source, withCheck(withhold(2, 3, reveal), source));
    expect(book.selfCheck!.frames[2].claims.map(c => c.ref)).toEqual(['p2:requirement:0']);
    expect(momentRenderSection(book.moments!, 2)).toContain('NOT YET (revealed on a later page; keep it out of this picture):\n- it stays out of sight until the page that shows it (first shown on page 3)');
    // A reveal declared at a later NAME while an earlier frame already shows it, or on a frame that itself shows it: refused.
    expect(compileOf(withhold(2, 6, page6))).toThrow('storyboard_claim_basis_withhold_visible_before_reveal');
    expect(compileOf(withhold(1, 3, reveal))).toThrow('storyboard_claim_basis_withhold_visible_before_reveal');
    // Its quote is on the reveal page, its reveal is later, its entity is declared; only a withhold names an entity or a reveal page.
    expect(compileOf(withhold(2, 3, 'They look out from inside the hut.'))).toThrow('storyboard_moments_requirement_evidence');
    expect(compileOf(withhold(2, 2, 'They look out from inside the hut.'))).toThrow('storyboard_claim_basis_withhold_binding');
    expect(compileOf(withhold(2, 3, reveal, 'kite'))).toThrow('storyboard_claim_basis_withhold_binding');
    expect(compileOf(basisDraft(f, d => { d.moments.frames[6].requirements[0].revealPage = 7; }))).toThrow('storyboard_claim_basis_requirement_shape');
    // A two-page gap on another entity: the hut, hidden on pages 4 and 5, is first shown again on page 6; a reveal on page 5 (still hidden) is refused.
    const hutHidden = (d: any) => { d.plan.continuity.pages[5].visibleEntityIds = ['ribbon']; };
    expect(compileOf(withhold(4, 6, 'They climb inside the hut again', 'hut', hutHidden))).not.toThrow();
    expect(compileOf(withhold(4, 5, 'stop beside the same hut', 'hut', hutHidden))).toThrow('storyboard_claim_basis_withhold_reveal');
    // Renamed ids: the rules bind the draft's own declared ids, never the fixture's names.
    const renamed = (d: any) => JSON.parse(JSON.stringify(d).replace(/"ribbon"/g, '"sash"'));
    expect(compileOf(renamed(withhold(2, 3, reveal)))).not.toThrow();
    expect(compileOf(renamed(withhold(2, 6, page6)))).toThrow('storyboard_claim_basis_withhold_visible_before_reveal');
    expect(compileOf(withhold(2, 3, reveal, 'sash'))).toThrow('storyboard_claim_basis_withhold_binding');
    // A cast member by the same visible ids: the companion (not in page 2's visibleCastIds) may be withheld there; the child (in them) may not.
    expect(compileOf(withhold(2, 3, reveal, 'companion'))).not.toThrow();
    expect(compileOf(withhold(2, 3, reveal, 'child'))).toThrow('storyboard_claim_basis_withhold_visible_before_reveal');
  });

  it('visual direction: staging names an existing claim of its own frame, never the drawn instant or a scene cut; staged requirements render as direction', async () => {
    const f = await personalStoryboardFixture(), source = prep(f, { basis: true });
    const staged = (staging: unknown[]) => basisDraft(f, d => { d.moments.frames[6].staging = staging; });
    const reason = 'holding it up fits the page and adds no event, meaning or identity';
    const book = compilePersonalStoryboard(source, withCheck(staged([{ ref: 'p6:requirement:0', reason }]), source));
    const section = momentRenderSection(book.moments!, 6);
    expect(section).toContain('ILLUSTRATION DIRECTION (a visual choice that fits the text, not a story fact):\n- SHOW: the red ribbon still in the child\'s hand');
    expect(section).not.toContain('MUST SHOW');
    const compileOf = (staging: unknown[]) => () => compilePersonalStoryboard(source, withCheck(staged(staging), source));
    for (const ref of ['p6:instant', 'p5:requirement:0', 'p6:requirement:3', 'p3:scene']) expect(compileOf([{ ref, reason }]), ref).toThrow('storyboard_claim_basis_staging_ref');
    expect(compileOf([{ ref: 'p6:requirement:0', reason }, { ref: 'p6:requirement:0', reason }])).toThrow('storyboard_claim_basis_staging_duplicate');
    expect(compileOf([{ ref: 'p6:relation:child', reason: 'beside rather than in front is a staging choice' }])).not.toThrow();
    // A withhold is a reveal by construction: never staged.
    expect(() => compilePersonalStoryboard(source, withCheck(basisDraft(f, d => { d.moments.frames[2].requirements = [{ kind: 'withhold', subject: 'it stays hidden',
      evidence: 'They leave the hut for the garden, carrying the ribbon.', entityId: 'ribbon', revealPage: 3 }]; d.moments.frames[2].staging = [{ ref: 'p2:requirement:0', reason }]; }),
      source))).toThrow('storyboard_claim_basis_staging_ref');
    // Ordinary pointing or gaze: a temporary look the text does not state, staged; it renders as direction, and a fitting one is a detail note.
    const gaze = compilePersonalStoryboard(source, withCheck(basisDraft(f, d => {
      d.moments.frames[6].depicted.actorStates = [{ actorId: 'child', state: 'pointing at the hut door', evidence: DRAWN }];
      d.moments.frames[6].staging = [{ ref: 'p6:actor:child', reason: 'pointing fits climbing in and adds no event, meaning or identity' }]; }), source));
    expect(momentRenderSection(gaze.moments!, 6)).toContain('- child: pointing at the hut door (text: "They climb inside the hut again") [visual direction]');
    const judge = (issues: unknown[]) => storyboardReviewDisposition(gaze, reviewOf(f, gaze, r => set(r.frames[6].checks[0], 'uncertain', 'the text does not state the pointing',
      issues))).disposition;
    expect(judge([issue('detail', 'p6:actor:child', '', 'pointing fits the climb and changes nothing the reader understands')])).toBe('review_supported_with_notes');
    expect(judge([issue('detail', 'p6:actor:child')])).toBe('held_uncertain');
    expect(judge([issue('identity', 'p6:actor:child', '', 'a reason')])).toBe('held_uncertain');
    // A frame without staging renders exactly as before.
    expect(momentRenderSection(compilePersonalStoryboard(source, withCheck(basisDraft(f), source)).moments!, 6))
      .toContain('PAGE MEANING (source-quoted, story-critical):\n- MUST SHOW: the red ribbon still in the child\'s hand (text: "the ribbon stays with נועה")');
  });

  it('citation: an evidence issue bound to ONE verified span of its claim\'s own page is a binding note; another page, a missing span, the claim\'s own quote, no reason or a material impact still holds', async () => {
    const f = await personalStoryboardFixture(), source = prep(f, { basis: true });
    const book = compilePersonalStoryboard(source, withCheck(basisDraft(f, d => { d.moments.frames[6].staging = [{ ref: 'p6:relation:child', reason: 'a staging choice' }]; }), source));
    const spans = sourceSpans(textsOf(source));
    expect(spans.p6).toEqual([{ id: 'p6:s1', text: 'They climb inside the hut again, and the ribbon stays with נועה.' }]);
    expect(spans.p1.map(s => s.text)).toEqual(['נועה and Dini wait inside their wooden hut.', 'A red ribbon is in her hand.']);
    expect(personalStoryboardReviewInput(book)).toMatchObject({ claimBasis: { version: CLAIM_BASIS_CONTRACT_VERSION, sourceSpans: spans } });
    const decide = (issues: unknown[], verdict = 'uncertain') => storyboardReviewDisposition(book, reviewOf(f, book, r => set(r.frames[6].checks[2], verdict, 'one bound quote is narrow', issues)));
    const why = 'that sentence states the ribbon staying with her';
    const note = decide([issue('evidence', 'p6:requirement:0', 'p6:s1', why)]);
    expect(note.disposition).toBe('review_supported_with_notes');
    expect(note.impact!.notes[0].issues[0]).toMatchObject({ impact: 'evidence', citation: 'p6:s1' });
    // The frame packet carries the verified citation, and its render line names the cited span instead of the narrow quote.
    const raw = reviewOf(f, book, r => set(r.frames[6].checks[2], 'uncertain', 'one bound quote is narrow', [issue('evidence', 'p6:requirement:0', 'p6:s1', why)]));
    const packet = personalStoryboardFrame(book, raw, 6, f.current);
    expect((packet.context as any).claimBasis).toEqual({ version: CLAIM_BASIS_CONTRACT_VERSION, citations: [{ ref: 'p6:requirement:0', citation: 'p6:s1',
      text: 'They climb inside the hut again, and the ribbon stays with נועה.' }] });
    expect(packet.render.prompt).toContain('MUST SHOW: the red ribbon still in the child\'s hand (text: "They climb inside the hut again, and the ribbon stays with נועה.")');
    // Still blocking: another page's span, a missing span, the claim's own quote as the "citation", no reason, a non-evidence impact, a non-claim ref.
    for (const [name, issues] of Object.entries({ other_page: [issue('evidence', 'p6:requirement:0', 'p5:s1', why)], missing: [issue('evidence', 'p6:requirement:0', 'p6:s9', why)],
      own_quote: [issue('evidence', 'p6:transition:child', 'p6:s1', why)], no_reason: [issue('evidence', 'p6:requirement:0', 'p6:s1')],
      story: [issue('story', 'p6:requirement:0', 'p6:s1', why)], not_a_claim: [issue('evidence', 'p6:composition', 'p6:s1', why)],
      uncited: [issue('evidence', 'p6:requirement:0')] }))
      expect([name, decide(issues).disposition]).toEqual([name, 'held_uncertain']);
    // A staged claim: fitting direction is supported (no issue) or a justified detail note; evidence on it is never lowered; material impacts hold.
    expect(decide([{ ...issue('detail', 'p6:relation:child'), whyNotMaterial: 'beside rather than in front changes nothing the reader understands' }]).disposition)
      .toBe('review_supported_with_notes');
    expect(decide([issue('evidence', 'p6:relation:child')]).disposition).toBe('held_uncertain');
    // Material impacts hold, staged or cited (a geography conflict is a continuity issue on a relation): a citation or a reason never lowers them.
    for (const impact of ['story', 'identity', 'safety', 'continuity']) for (const [ref, citation] of [['p6:relation:child', ''], ['p6:requirement:0', 'p6:s1']])
      expect([impact, ref, decide([issue(impact, ref, citation, why)], 'contradiction').disposition]).toEqual([impact, ref, 'held_contradiction']);
    // Unknown support: an unsupported check without issues holds.
    expect(decide([]).disposition).toBe('held_uncertain');
    // The cover's claims may cite the title or page 1; a body claim may not cite another page.
    const cover = compilePersonalStoryboard(source, withCheck(basisDraft(f, d => { d.moments.frames[0].requirements = [{ kind: 'show', subject: 'the red ribbon in her hand on the cover',
      evidence: 'A red ribbon', entityId: null, revealPage: null }]; }), source));
    expect(storyboardReviewDisposition(cover, reviewOf(f, cover, r => set(r.frames[0].checks[2], 'uncertain', 'narrow', [issue('evidence', 'p0:requirement:0', 'p1:s2', why)])))
      .disposition).toBe('review_supported_with_notes');
    expect(claimBasisStoryboardReviewSchema.safeParse(reviewOf(f, book, r => { r.frames[6].checks[2].issues = [{ ...issue('detail', 'p6'), citation: 'nonsense' }]; })).success)
      .toBe(false);
    // The verifier's own contract (the policy also refuses an unjustified issue downstream; the verifier never relies on it).
    const claims = new Map([['p6:requirement:0', { evidence: LATER, pages: [6] }], ['p6:transition:child', { evidence: spans.p6[0].text, pages: [6] }]]);
    const binds = (ref: string, citation: string, whyNotMaterial = why, impact = 'evidence') => citationBinds({ impact, ref, citation, whyNotMaterial }, claims, spans);
    expect([binds('p6:requirement:0', 'p6:s1'), binds('p6:requirement:0', 'p6:s1', ''), binds('p6:requirement:0', 'p5:s1'), binds('p6:requirement:0', ''),
      binds('p6:transition:child', 'p6:s1'), binds('p6:instant', 'p6:s1'), binds('p6:requirement:0', 'p6:s1', why, 'detail')]).toEqual([true, false, false, false, false, false, false]);
  });

  it('the attempt extension: exactly one attempt above the ceiling, only once it is spent, bound in the source; a parent compiled under the names correction recompiles under it', async () => {
    const f = await personalStoryboardFixture();
    // Three consecutive held candidates (the second repaired from the first, the third a diagnosed continuation under the self-check and typed review).
    // Each overrides the companion on page 4, where it is not visible (as held drafts did under the earlier completeness rule); the third attempt
    // resolves page 4's finding, so page 4 is protected for the fourth (the diagnosis protects the pages the latest attempt resolved).
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
    expect(diagnosis3.protectedPages).toEqual([2]);
    const d3plain = drawnDraft(f, d => { hiddenOnP4(d); d.plan.pages[2].composition = d2.plan.pages[2].composition; d.plan.pages[4].composition = 'the lane, the pause made visible';
      d.plan.pages[5].composition = 'the return, framed from the gate'; });
    const d3 = { ...d3plain, selfCheck: fullSelfCheck(d3plain, textsOf(s3), { diagnosis: diagnosis3, parentDraft: d2 }) }, b3 = compilePersonalStoryboard(s3, structuredClone(d3));
    const r3 = reviewOf(f, b3, r => set(r.frames[6].checks[0], 'contradiction', 'the causal action is still omitted', [{ impact: 'story', ref: 'p6:instant', note: 'omitted', whyNotMaterial: '' }]));
    const extension = { version: STORYBOARD_ATTEMPT_EXTENSION_VERSION, maxAttempts: 4, approvalSha256: 'a'.repeat(64) };
    const ext = { parentStoryboardDigest: b3.storyboardDigest, draft: d3, review: r3, parentRepair: continuation, addedContracts: ['claimBasisContract'], extension };
    // Without the extension the base ceiling refuses a fourth attempt; with it, exactly one attempt remains.
    const { extension: _none, ...unextended } = ext;
    expect(() => prep(f, { repair: unextended, basis: true })).toThrow('personal_storyboard_repair_allowance_exhausted');
    const s4 = prep(f, { repair: ext, basis: true }), input = s4.planningInput as any;
    expect(input.priorReviewedStoryboard.diagnosis.allowance).toEqual({ nextAttempt: 4, maxAttempts: 4, remainingAfterNext: 0 });
    // The planner's view: the previous storyboard without its own self-check, every finding with its typed issues, no plan unless a plan check held.
    expect(['selfCheck' in input.priorReviewedStoryboard.storyboard, 'narrativePlan' in input]).toEqual([false, false]);
    expect(input.priorReviewedStoryboard.reviewFindings).toEqual([{ scope: 'page', pageNumber: 6, category: r3.frames[6].checks[0].category, verdict: 'contradiction',
      observation: 'the causal action is still omitted', issues: [{ impact: 'story', ref: 'p6:instant', note: 'omitted' }] }]);
    // Bound: another approval is another source; never more than one extra attempt, never before the base ceiling is spent, never on an ancestor.
    expect(prep(f, { repair: { ...ext, extension: { ...extension, approvalSha256: 'b'.repeat(64) } }, basis: true }).sourceDigest).not.toBe(s4.sourceDigest);
    expect(() => prep(f, { repair: { ...ext, extension: { ...extension, maxAttempts: 5 } }, basis: true })).toThrow('personal_storyboard_repair_extension_policy');
    expect(() => prep(f, { repair: { ...continuation, extension }, selfCheck: true, impact: true })).toThrow('personal_storyboard_repair_extension_policy');
    expect(() => prep(f, { repair: { ...ext, parentRepair: { ...continuation, extension } }, basis: true })).toThrow('personal_storyboard_repair_policy');
    // The parent's compile options are its own: a parent not compiled under the names correction does not recompile under it to its digest.
    expect(() => prep(f, { repair: { ...ext, parentCompile: { selfCheckNames: true } }, basis: true })).toThrow('personal_storyboard_repair_binding');
    // A candidate in the contract's shape that keeps the protected page as it was compiles: adopting the shape, or the compiler dropping the
    // parent's own hidden override on protected page 4, is never a change (both drafts are measured on the contract's neutral view).
    expect(input.priorReviewedStoryboard.diagnosis.protectedPages).toEqual([4]);
    const d4 = asBasis(d3plain);
    d4.plan.pages[6].composition = 'the climb in, drawn at its causal moment';
    const repair4 = { diagnosis: input.priorReviewedStoryboard.diagnosis, parentDraft: d3 };
    expect(() => compilePersonalStoryboard(s4, withCheck(d4, s4, undefined, repair4), { selfCheckNames: true })).not.toThrow();
    // A resolution may also name a section that only adopted the contract's shape (its raw bytes changed).
    expect(() => compilePersonalStoryboard(s4, withCheck(d4, s4, s => { s.resolutions[0].changed.push('p2:moment'); }, repair4), { selfCheckNames: true })).not.toThrow();
  });

  it('staging fields (storyboard-claim-basis-staging-fields/v1, compile-level): a frame\'s own plan direction fields may be staged; strict v1 still refuses; marker, review refs and rule follow', async () => {
    const f = await personalStoryboardFixture(), source = prep(f, { basis: true });
    const reason = 'the pose and the arrangement are visual direction that fits the text';
    const staged = (change: (d: any) => void) => basisDraft(f, change);
    const both = staged(d => { d.moments.frames[2].staging = [{ ref: 'p2:composition', reason }]; d.moments.frames[3].staging = [{ ref: 'p3:childAction', reason }]; });
    // Strict v1: a plan field is not a claim, so it is refused exactly as before.
    expect(() => compilePersonalStoryboard(source, withCheck(both, source))).toThrow('storyboard_claim_basis_staging_ref');
    expect(() => compilePersonalStoryboard(source, withCheck(both, source), { selfCheckNames: true })).toThrow('storyboard_claim_basis_staging_ref');
    // Under the option: admitted, marked, listed; the source (and so the planner request) is unchanged.
    const book = compilePersonalStoryboard(source, withCheck(both, source), { stagingFields: true });
    expect([book.stagingFields, 'stagingFields' in compilePersonalStoryboard(source, withCheck(basisDraft(f), source))]).toEqual([CLAIM_BASIS_STAGING_FIELDS_VERSION, false]);
    expect(stagedPlanFields(book.moments!)).toEqual([{ page: 2, ref: 'p2:composition' }, { page: 3, ref: 'p3:childAction' }]);
    expect(compilePersonalStoryboard(source, withCheck(both, source), { selfCheckNames: true, stagingFields: true }).selfCheckNames).toBe('storyboard-self-check-names/v1');
    // Still refused under the option: the scene cut (and the scene field), another frame's field, a non-direction field, the instant, a withhold, a duplicate.
    const refused = (staging: unknown[], n = 3) => () => compilePersonalStoryboard(source, withCheck(staged(d => { d.moments.frames[n].staging = staging; }), source), { stagingFields: true });
    for (const ref of ['p3:scene', 'p4:childAction', 'p3:locationId', 'p3:props', 'p3:shot', 'p3:instant', 'p3:childaction'])
      expect(refused([{ ref, reason }]), ref).toThrow('storyboard_claim_basis_staging_ref');
    expect(refused([{ ref: 'p3:childGaze', reason }, { ref: 'p3:childGaze', reason }])).toThrow('storyboard_claim_basis_staging_duplicate');
    for (const ref of ['p3:childExpression', 'p3:childGaze', 'p3:companionAction', 'p3:composition']) expect(refused([{ ref, reason }]), ref).not.toThrow();
    expect(() => compilePersonalStoryboard(source, withCheck(basisDraft(f, d => { d.moments.frames[2].requirements = [{ kind: 'withhold', subject: 'it stays hidden',
      evidence: 'They leave the hut for the garden, carrying the ribbon.', entityId: 'ribbon', revealPage: 3 }]; d.moments.frames[2].staging = [{ ref: 'p2:requirement:0', reason }]; }),
      source), { stagingFields: true })).toThrow('storyboard_claim_basis_staging_ref');
    // The policy: claim-basis sources only, exactly true; an empty or unknown option refuses as before.
    const plainSource = prep(f, { selfCheck: true, impact: true }), plainDraft = drawnDraft(f);
    expect(() => compilePersonalStoryboard(plainSource, { ...plainDraft, selfCheck: fullSelfCheck(plainDraft, textsOf(plainSource)) }, { stagingFields: true }))
      .toThrow('personal_storyboard_staging_fields_policy');
    expect(() => compilePersonalStoryboard(source, withCheck(both, source), { stagingFields: 'yes' } as never)).toThrow('personal_storyboard_staging_fields_policy');
    for (const options of [{}, { other: true }, { selfCheckNames: 'yes' }])
      expect(() => compilePersonalStoryboard(source, withCheck(both, source), options as never)).toThrow('personal_storyboard_self_check_names_policy');
    // The review: the stageable fields join the reference vocabulary only under the marker, and the review reads the rule.
    expect(personalStoryboardReviewInput(book)).toMatchObject({ reviewImpact: { reviewRefs: expect.arrayContaining(['p3:childAction', 'p0:childGaze']) } });
    const strictBook = compilePersonalStoryboard(source, withCheck(basisDraft(f), source));
    expect((personalStoryboardReviewInput(strictBook) as any).reviewImpact.reviewRefs.includes('p3:childAction')).toBe(false);
    expect(storyboardReviewRefs(strictBook)).toEqual(storyboardReviewRefs(strictBook, undefined));
    const decide = (b: typeof book, issues: unknown[]) => storyboardReviewDisposition(b, reviewOf(f, b, r => set(r.frames[3].checks[0], 'uncertain', 'the pose is not stated', issues))).disposition;
    expect(decide(book, [issue('detail', 'p3:childAction', '', 'a crouch fits the comic moment and changes nothing the reader understands')])).toBe('review_supported_with_notes');
    expect(decide(book, [issue('evidence', 'p3:childAction')])).toBe('held_uncertain');
    expect(decide(strictBook, [issue('detail', 'p3:childAction', '', 'a reason')])).toBe('held_uncertain');
    const contracts = { momentContract: true, drawnInstantContract: true, selfCheckContract: true, reviewImpactPolicy: true, claimBasisContract: true } as const;
    expect([storyboardReviewInstructions({ ...contracts, stagingFields: true }).endsWith(`\n${CLAIM_BASIS_STAGING_FIELDS_REVIEW_RULE}`),
      storyboardReviewInstructions(contracts).includes('storyboard-claim-basis-staging-fields/v1'),
      storyboardReviewInstructions({ ...contracts, claimBasisContract: undefined, stagingFields: true }).includes(CLAIM_BASIS_STAGING_FIELDS_REVIEW_RULE)]).toEqual([true, false, false]);
    // The loader takes the correction only from the saved, digest-bound book's marker.
    expect([savedStagingFields(undefined), savedStagingFields({}), savedStagingFields({ stagingFields: CLAIM_BASIS_STAGING_FIELDS_VERSION })])
      .toEqual([undefined, undefined, { stagingFields: true }]);
    expect(() => savedStagingFields({ stagingFields: 'storyboard-claim-basis-staging-fields/v2' })).toThrow('audition_board_binding');
  });

  it('call path: the diagnostic sends the contract\'s instruction and shapes; the review input carries the spans; a citation note admits with notes and every packet', async () => {
    const r = await replanFixture();
    const source = prepareCurrentPersonalStoryboard(r.request, r.writerResult, r.options, true, true, undefined, undefined, undefined, undefined, undefined,
      true, undefined, true, true, true);
    const frames: any[] = Array.from({ length: 9 }, () => ({ requirements: [], depicted: null, staging: [] }));
    frames[6] = { requirements: [{ kind: 'show', subject: 'the red ribbon still in the child\'s hand', evidence: LATER, entityId: null, revealPage: null }], depicted: null, staging: [] };
    const plain = { ...structuredClone(r.draft), moments: { version: STORYBOARD_MOMENTS_VERSION, frames } };
    const draft = { ...plain, selfCheck: fullSelfCheck(plain, textsOf(source as any)) };
    const calls: SimpleStoryboardDiagnosticCall[] = [];
    const out = await runSimpleStoryboardDiagnostic({ request: r.request, writerResult: r.writerResult, options: r.options, signal: new AbortController().signal,
      actorOwnedAppearance: true, momentContract: true, drawnInstantContract: true, selfCheckContract: true, reviewImpactPolicy: true, claimBasisContract: true,
      generate: async call => { calls.push(call); if (call.stage === 'storyboard') return structuredClone(draft);
        const c = call.context as any;
        return reviewOf(r.f, { sourceDigest: c.sourceDigest, storyboardDigest: c.storyboardDigest }, x => set(x.frames[6].checks[2], 'uncertain', 'the bound quote is narrow',
          [issue('evidence', 'p6:requirement:0', 'p6:s1', 'that sentence states it')])); } });
    expect([out.status, out.framePackets.length, out.sourceDigest]).toEqual(['review_supported_with_notes', 9, source.sourceDigest]);
    const [planner, reader] = calls;
    expect(planner.instructions).toContain(CLAIM_BASIS_STORYBOARD_ADDENDUM);
    expect(planner.context).toMatchObject({ claimBasisContract: true, drawnInstantContract: true, selfCheckContract: true });
    expect([reader.schema === claimBasisStoryboardReviewSchema, (reader.context as any).claimBasisContract]).toEqual([true, true]);
    expect(reader.instructions.endsWith(`\n${CLAIM_BASIS_REVIEW_ADDENDUM}`)).toBe(true);
    expect(JSON.parse(reader.input)).toMatchObject({ claimBasis: { version: CLAIM_BASIS_CONTRACT_VERSION } });
    expect(out.framePackets[6].render.prompt).toContain('(text: "They climb inside the hut again, and the ribbon stays with נועה.")');
    // The reviewed-audition loader takes the contract only from the saved, digest-bound book's marker: absent stays off, an unknown version refuses.
    expect([savedClaimBasisContract(undefined), savedClaimBasisContract({}), savedClaimBasisContract({ claimBasis: { version: CLAIM_BASIS_CONTRACT_VERSION } })])
      .toEqual([undefined, undefined, true]);
    expect(() => savedClaimBasisContract({ claimBasis: { version: 'storyboard-claim-basis/v2' } })).toThrow('audition_board_binding');
  });
});
