import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { fullSelfCheck } from './storyboard-self-check-fixture';
import { resolvePersonalWizardOptions } from '../options';
import { preparePersonalStoryboard, compilePersonalStoryboard, personalStoryboardFrame, storyboardInstructions, storyboardReviewDisposition,
  storyboardDraftSchema } from '../storyboard';
import { STORYBOARD_MOMENTS_VERSION } from '../storyboard-moments';
import { claimBasisSectionsView } from '../storyboard-claim-basis';
import { storyboardFrameClaims, storyboardReviewRefs } from '../storyboard-review-impact';
import { CALIBRATION_STORYBOARD_ADDENDUM, CALIBRATION_REVIEW_ADDENDUM, calibrationSelfCheckStoryboardAddendum } from '../storyboard-calibration';
import { STORYBOARD_PRESENCE_VERSION, PRESENCE_COMPONENTS, PRESENCE_STORYBOARD_ADDENDUM, PRESENCE_REVIEW_ADDENDUM, validatePresence, repeatedReferences,
  typedFindingsOf } from '../storyboard-presence';
import { personalBookProviderSchema } from '../book-openai';
import { previewStoryEvidence, previewTextPages } from '../../local-story-preview';
import { storyboardReviewInstructions, runSimpleStoryboardDiagnostic } from '../simple-storyboard-diagnostic';
import { savedPresenceContract } from '../../../scripts/personal-simple-book-reviewed-audition';
import { STORYBOARD_ATTEMPT_EXTENSION_VERSION, STORYBOARD_ATTEMPT_EXTENSION_V2, assertStoryboardRepair } from '../storyboard-repair';

const options = resolvePersonalWizardOptions();
type Fixture = Awaited<ReturnType<typeof personalStoryboardFixture>>;
// Page 6: 'They climb inside the hut again, and the ribbon stays with נועה.' The drawn instant is its first clause; the child's transition is
// moved to the later clause, so at the drawn instant the child has not made it yet and the instant must declare the child's state.
const DRAWN = 'They climb inside the hut again', LATER = 'the ribbon stays with נועה';
type Opts = { repair?: unknown; calibration?: true; presence?: true };
/** Every source here has the moments, drawn-instant, self-check, typed-review and claim-basis contracts; the calibration; presence when asked. */
const prep = (f: Fixture, o: Opts = {}) => preparePersonalStoryboard(f.request, f.result, options, undefined, true, undefined, undefined, undefined, undefined,
  o.repair as never, true, undefined, true, true, true, o.calibration ?? (o.presence ? true : undefined), o.presence);
const textsOf = (source: ReturnType<typeof prep>) => previewStoryEvidence(source.story).texts;
/** A claim-basis draft: page 6 drawn at its first clause (both actors beside the hut), the child's transition at its later clause. */
function basisDraft(f: Fixture, change?: (draft: any) => void) {
  const frames: any[] = Array.from({ length: f.result.manuscript.pages.length + 1 }, () => ({ requirements: [], depicted: null, staging: [] }));
  frames[6] = { requirements: [{ kind: 'show', subject: 'the red ribbon still in the child\'s hand', evidence: LATER, entityId: null, revealPage: null }], staging: [],
    depicted: { evidence: DRAWN, attributes: [], actorStates: [], relations: ['child', 'companion'].map(entityId => ({ entityId, value: { relation: 'beside', targetId: 'hut' }, evidence: DRAWN })) } };
  const draft: any = { ...structuredClone(f.draft), moments: { version: STORYBOARD_MOMENTS_VERSION, frames } };
  draft.sequence.pages[5].transitions.find((t: any) => t.entityId === 'child').evidence = LATER;
  change?.(draft);
  return draft;
}
/** The same draft in the presence contract's shape (every depicted lists presence, empty when none). */
const asPresence = (draft: any) => { const d = structuredClone(draft); for (const fr of d.moments.frames) if (fr.depicted) fr.depicted.presence ??= []; return d; };
/** The child present (unplaced) at page 6's drawn instant instead of a relation override. */
const present = (d: any, evidence = DRAWN) => { const dep = d.moments.frames[6].depicted;
  dep.relations = dep.relations.filter((o: any) => o.entityId !== 'child'); dep.presence = [{ actorId: 'child', evidence }]; };
/** The planner's self-check (on the contract's neutral view) with its visual-state map; `edit` adjusts it (for example a resolution's cause). */
const withCheck = (draft: any, source: ReturnType<typeof prep>, repair?: { diagnosis: any; parentDraft: unknown }, edit?: (s: any) => void) =>
  ({ ...draft, selfCheck: { ...fullSelfCheck(claimBasisSectionsView(draft), textsOf(source),
    repair ? { ...repair, parentDraft: claimBasisSectionsView(repair.parentDraft) } : undefined, edit), visualStates: [] } });
const reviewOf = (f: Fixture, book: { sourceDigest: string; storyboardDigest: string }, change?: (r: any) => void) => {
  const r: any = { ...structuredClone(f.review), sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest };
  for (const c of [...r.bookChecks, ...r.frames.flatMap((x: any) => x.checks)]) c.issues = [];
  change?.(r);
  return r;
};
const set = (check: any, verdict: string, observation: string, issues?: unknown[]) => Object.assign(check, { verdict, observation, ...(issues ? { issues } : {}) });
const cal = (impact: string, ref: string, basis: string, whyNotMaterial = '', citation = '') => ({ impact, ref, note: 'what the reviewer saw', whyNotMaterial, citation, basis });
const WHY = 'it changes no event, identity, age, safety or material relation';

describe('storyboard-presence/v1 (opt-in, owner-directed 2026-10-20): presence without a placement, and no re-quoting a repeated reference', { timeout: 120_000 }, () => {
  it('absent: unchanged; it needs the calibration; its instruction, review rule, provider shape, strict frames, marker and loader', async () => {
    const f = await personalStoryboardFixture();
    expect(() => preparePersonalStoryboard(f.request, f.result, options, undefined, true, undefined, undefined, undefined, undefined, undefined, true, undefined,
      true, true, true, undefined, true)).toThrow('personal_storyboard_presence_policy');
    const calibrated = prep(f, { calibration: true }), withPresence = prep(f, { presence: true });
    expect(withPresence.sourceDigest).not.toBe(calibrated.sourceDigest);
    const before = storyboardInstructions(calibrated), ins = storyboardInstructions(withPresence);
    expect([before.includes('PRESENCE (storyboard-presence'), ins.includes(`${CALIBRATION_STORYBOARD_ADDENDUM}\n${PRESENCE_STORYBOARD_ADDENDUM}`)]).toEqual([false, true]);
    // The self-check's claims list names the presence claim only under the contract (the calibrated list is exactly as before).
    expect([ins.includes('p{n}:presence:{actorId} (depicted.presence)'), before.includes('p{n}:presence'),
      before.includes(calibrationSelfCheckStoryboardAddendum())]).toEqual([true, false, true]);
    const contracts = { momentContract: true, drawnInstantContract: true, selfCheckContract: true, reviewImpactPolicy: true, claimBasisContract: true,
      calibrationContract: true } as const;
    expect([storyboardReviewInstructions(contracts).endsWith(CALIBRATION_REVIEW_ADDENDUM), storyboardReviewInstructions({ ...contracts, presenceContract: true })
      .endsWith(`\n${PRESENCE_REVIEW_ADDENDUM}`), storyboardReviewInstructions({ ...contracts, calibrationContract: undefined, presenceContract: true })
      .includes('PRESENCE')]).toEqual([true, true, false]);
    // The diagnostic refuses presence without the calibration before anything else (its own policy code).
    const diagnostic = (extra: object) => runSimpleStoryboardDiagnostic({ request: f.request, writerResult: {}, options, signal: new AbortController().signal,
      generate: async () => { throw Error('no call'); }, ...contracts, ...extra } as any);
    await expect(diagnostic({ calibrationContract: undefined, presenceContract: true })).rejects.toThrow('simple_storyboard_diagnostic_presence_policy');
    await expect(diagnostic({ presenceContract: true })).rejects.toThrow('simple_storyboard_diagnostic_simple_source_required');
    // The provider's storyboard shape lists presence only under the contract, which needs the calibration.
    const ctx = { narrativeSpreads: 8, sourceDigest: 'a'.repeat(64), momentContract: true as const, drawnInstantContract: true as const, selfCheckContract: true as const,
      claimBasisContract: true as const, calibrationContract: true as const };
    const depictedKeys = (extra: object) => Object.keys((personalBookProviderSchema({ stage: 'storyboard', context: { ...ctx, ...extra } } as any) as any)
      .shape.moments.shape.frames.element.shape.depicted.unwrap().shape).sort();
    expect([depictedKeys({ presenceContract: true }).includes('presence'), depictedKeys({}).includes('presence')]).toEqual([true, false]);
    expect(() => personalBookProviderSchema({ stage: 'storyboard', context: { ...ctx, calibrationContract: undefined, presenceContract: true } } as any))
      .toThrow('book_provider_context');
    expect([Object.keys((storyboardDraftSchema(withPresence) as any).shape.moments.shape.frames.element.shape.depicted.unwrap().shape).includes('presence'),
      Object.keys((storyboardDraftSchema(calibrated) as any).shape.moments.shape.frames.element.shape.depicted.unwrap().shape).includes('presence')]).toEqual([true, false]);
    // Without the contract a frame that lists presence does not parse (the claim basis's strict frames); with it the book carries the marker.
    const plain = basisDraft(f), book = compilePersonalStoryboard(withPresence, withCheck(asPresence(plain), withPresence));
    expect(() => compilePersonalStoryboard(calibrated, withCheck(asPresence(plain), calibrated))).toThrow();
    const calibratedBook = compilePersonalStoryboard(calibrated, withCheck(plain, calibrated));
    expect([book.presence, 'presence' in calibratedBook]).toEqual([{ version: STORYBOARD_PRESENCE_VERSION, components: [...PRESENCE_COMPONENTS] }, false]);
    // A calibrated book's packet is exactly as before: no presence key.
    expect('presence' in (personalStoryboardFrame(calibratedBook, reviewOf(f, calibratedBook), 6, f.current).context.sequence as any).drawnInstant).toBe(false);
    expect([savedPresenceContract(undefined), savedPresenceContract({}), savedPresenceContract({ presence: { version: STORYBOARD_PRESENCE_VERSION } })])
      .toEqual([undefined, undefined, true]);
    expect(() => savedPresenceContract({ presence: { version: 'storyboard-presence/v2' } })).toThrow('audition_board_binding');
  });

  it('presence: an unplaced actor fills the drawn instant\'s declaration; drawn at the scene\'s place touching nothing; a claim the review judges', async () => {
    const f = await personalStoryboardFixture(), source = prep(f, { presence: true });
    // The child's state at the drawn instant must be declared: neither an override nor presence refuses (the existing completeness rule).
    expect(() => compilePersonalStoryboard(source, withCheck(asPresence(basisDraft(f, d => { d.moments.frames[6].depicted.relations =
      d.moments.frames[6].depicted.relations.filter((o: any) => o.entityId !== 'child'); })), source))).toThrow('storyboard_moments_drawn_instant_relation');
    const book = compilePersonalStoryboard(source, withCheck(asPresence(basisDraft(f, present)), source));
    expect(storyboardFrameClaims(book, 6).map(c => c.ref)).toContain('p6:presence:child');
    expect(storyboardReviewRefs(book)).toContain('p6:presence:child');
    // Instruction/validator parity: every claim form the compiler requires in the self-check is named in the planner's self-check claims entry.
    const instructions = storyboardInstructions(source), from = instructions.indexOf('- claims: one entry per evidence-bearing claim');
    const entry = instructions.slice(from, instructions.indexOf('- events:', from));
    const forms = [...new Set(book.plan.pages.flatMap((_, n) => storyboardFrameClaims(book, n).map(c => c.ref.split(':')[1].replace(/#\d+$/, ''))))];
    expect([from >= 0, forms.includes('presence'), forms.filter(k => !entry.includes(`p{n}:${k}`))]).toEqual([true, true, []]);
    // The packet: the child at the frame's own location (related to no entity), the list on the instant, the end-of-page state recorded; the render
    // line forbids any contact or action.
    const packet = personalStoryboardFrame(book, reviewOf(f, book), 6, f.current), sequence = packet.context.sequence as any;
    expect(sequence.relations.find((s: any) => s.entityId === 'child').value).toEqual({ relation: 'at', targetId: 'garden' });
    expect(sequence.drawnInstant.presence).toEqual([{ actorId: 'child', evidence: DRAWN }]);
    expect(sequence.endOfPageLedger.map((s: any) => s.entityId).sort()).toEqual(['child', 'companion']);
    expect(packet.render.prompt).toContain('IN THE SCENE, NOT PLACED');
    expect(packet.render.prompt).toContain('child: part of this scene at its place; not touching, holding, pushing, carrying or acting on anything');
    // The review judges it like any claim under the owner's rule: a positively justified setting is a note; an unsupported presence holds.
    const judge = (issue: unknown) => storyboardReviewDisposition(book, reviewOf(f, book, r => set(r.frames[6].checks[2], 'uncertain', 'presence', [issue]))).disposition;
    expect([judge(cal('evidence', 'p6:presence:child', 'setting', WHY)), judge(cal('evidence', 'p6:presence:child', 'unsupported')),
      judge(cal('continuity', 'p6:presence:child', 'contradiction', WHY)), judge(cal('identity', 'p6:presence:child', 'setting', WHY))])
      .toEqual(['review_supported_with_notes', 'held_uncertain', 'held_uncertain', 'held_uncertain']);
    // A present actor is validated where it is drawn (the scene's place), not at its end-of-page state. Synthetic structure: the companion's
    // end-of-page state (inside the hut) would close a relation cycle with an instant override (the hut on the companion); at the garden, none.
    expect(() => compilePersonalStoryboard(source, withCheck(asPresence(basisDraft(f, d => {
      d.sequence.pages[5].transitions.find((t: any) => t.entityId === 'companion').evidence = LATER;
      const dep = d.moments.frames[6].depicted;
      dep.relations = [dep.relations.find((o: any) => o.entityId === 'child'), { entityId: 'hut', value: { relation: 'on', targetId: 'companion' }, evidence: DRAWN }];
      dep.presence = [{ actorId: 'companion', evidence: DRAWN }]; })), source))).not.toThrow();
  });

  it('presence refuses what would hide a material relation: a non-cast or hidden actor, beside an override or a look, a later quote, where nothing is pending, twice, staged', async () => {
    const f = await personalStoryboardFixture(), source = prep(f, { presence: true });
    const compileWith = (change: (d: any) => void) => () => compilePersonalStoryboard(source, withCheck(asPresence(basisDraft(f, d => { present(d); change(d); })), source));
    expect(compileWith(() => {})).not.toThrow();
    for (const [name, change, code] of [
      ['a prop is not cast', (d: any) => { d.moments.frames[6].depicted.presence.push({ actorId: 'ribbon', evidence: DRAWN }); }, 'not_cast'],
      // (the child is always visible: the sequence compiler requires it on every page)
      ['an actor the frame does not show', (d: any) => { d.sequence.pages[5].visibleCastIds = ['child'];
        d.moments.frames[6].depicted.presence.push({ actorId: 'companion', evidence: DRAWN }); }, 'not_visible'],
      ['with its own relation override', (d: any) => { d.moments.frames[6].depicted.relations.push({ entityId: 'child', value: { relation: 'beside', targetId: 'hut' }, evidence: DRAWN }); }, 'with_relation'],
      ['with a temporary look (an action) for it', (d: any) => { d.moments.frames[6].depicted.actorStates = [{ actorId: 'child', state: 'Pushing the hut door open',
        evidence: DRAWN }]; }, 'with_state'],
      ['a quote after the drawn instant', (d: any) => { d.moments.frames[6].depicted.presence = [{ actorId: 'child', evidence: LATER }]; }, 'evidence'],
      ['a quote not on its page', (d: any) => { d.moments.frames[6].depicted.presence = [{ actorId: 'child', evidence: 'They walk down the lane' }]; }, 'evidence'],
      ['an actor with nothing pending at the instant', (d: any) => { const dep = d.moments.frames[6].depicted;
        dep.relations = []; dep.presence = [{ actorId: 'child', evidence: DRAWN }, { actorId: 'companion', evidence: DRAWN }]; }, 'not_needed'],
      ['the same actor twice', (d: any) => { d.moments.frames[6].depicted.presence.push({ actorId: 'child', evidence: DRAWN }); }, 'duplicate'],
      ['staged', (d: any) => { d.moments.frames[6].staging = [{ ref: 'p6:presence:child', reason: 'a visual choice' }]; }, 'staged'],
    ] as const) expect(compileWith(change as (d: any) => void), name).toThrow(`storyboard_presence_${code}`);
    // The validator itself on a compiled book's frames (structure only).
    const book = compilePersonalStoryboard(source, withCheck(asPresence(basisDraft(f, present)), source));
    expect(() => validatePresence(book.moments!.frames as any, book.plan, book.sequence, textsOf(source))).not.toThrow();
    // A supporting character is cast too; a landmark is not (synthetic structure: one body page, its drawn instant, the transition later).
    const synthetic = (actorId: string) => () => validatePresence([{ depicted: null, staging: [] }, { depicted: { evidence: 'the stripes peeled', relations: [],
      presence: [{ actorId, evidence: 'they rolled back' }] }, staging: [] }] as any,
      { continuity: { entities: [{ id: 'ibex', kind: 'supporting_character', invariants: [] }, { id: 'cliff', kind: 'landmark', invariants: [] }] } } as any,
      { pages: [{ visibleCastIds: ['child', 'ibex'], transitions: [{ entityId: actorId, evidence: 'went home' }] }] } as any,
      ['title', 'they rolled back and the stripes peeled, then everyone went home']);
    expect(synthetic('ibex')).not.toThrow();
    expect(synthetic('cliff')).toThrow('storyboard_presence_not_cast');
  });

  it('a reference held for the same impact in both last reviews: listed for the planner; no re-quote, no re-declaration, no hiding; presence passes', async () => {
    const f = await personalStoryboardFixture();
    // Unit: same reference and impact in both reviews (latest checks first); another impact or a one-off reference is not repeated.
    const typed = (key: [string, number?], issues: [string, string][]) => ({ scope: key[1] === undefined ? 'book' as const : 'page' as const,
      ...(key[1] === undefined ? {} : { pageNumber: key[1] }), category: key[0], issues: issues.map(([impact, ref]) => ({ impact, ref })) });
    expect(repeatedReferences([typed(['physical_state', 6], [['evidence', 'p6:relation:child'], ['continuity', 'location:garden']]), typed(['continuity'], [['evidence', 'p6:relation:child']])],
      [typed(['physical_state', 6], [['evidence', 'p6:relation:child'], ['evidence', 'location:garden']])])).toEqual([
      { ref: 'p6:relation:child', impact: 'evidence', checks: ['page:6:physical_state', 'book:continuity'], previousChecks: ['page:6:physical_state'] }]);
    expect([typedFindingsOf([{ scope: 'book', category: 'continuity' }]), typedFindingsOf('x')]).toEqual([null, null]);
    // A chain: both actors' page-6 transitions come after the drawn instant; the first plan's two relations are held for evidence, its repair
    // re-binds them and is held for the same reason. Page 3 also has a drawn instant, and the first review's page-3 finding is resolved by the
    // repair, so the diagnosis protects page 3: its (empty) presence list must stay out of what the next repair changed (the neutral view).
    const bothLater = (d: any) => { d.sequence.pages[5].transitions.find((t: any) => t.entityId === 'companion').evidence = LATER;
      d.moments.frames[3].depicted = { evidence: 'They leave the hut for the garden', attributes: [], actorStates: [], relations: [] }; };
    const s0 = prep(f, { calibration: true }), d1 = withCheck(basisDraft(f, bothLater), s0), b1 = compilePersonalStoryboard(s0, structuredClone(d1));
    const holdBoth = (r: any) => set(r.frames[6].checks[2], 'uncertain', 'their places are not stated',
      [cal('evidence', 'p6:relation:child', 'unsupported'), cal('evidence', 'p6:relation:companion', 'unsupported')]);
    const holdFirst = (r: any) => { holdBoth(r); set(r.frames[3].checks[0], 'contradiction', 'the moment', [cal('story', 'p3', 'contradiction')]); };
    const repair1 = { parentStoryboardDigest: b1.storyboardDigest, draft: d1, review: reviewOf(f, b1, holdFirst) };
    const s1 = prep(f, { calibration: true, repair: repair1 });
    const d2 = withCheck(basisDraft(f, d => { bothLater(d); for (const o of d.moments.frames[6].depicted.relations) o.value = { relation: 'at', targetId: 'garden' }; }), s1);
    const b2 = compilePersonalStoryboard(s1, structuredClone(d2));
    const repair2 = { parentStoryboardDigest: b2.storyboardDigest, draft: d2, review: reviewOf(f, b2, holdBoth), parentRepair: repair1, addedContracts: ['presenceContract'] };
    const s2 = prep(f, { calibration: true, presence: true, repair: repair2 }), prior = (s2.planningInput as any).priorReviewedStoryboard;
    expect(prior.repeatedReferences).toEqual(['p6:relation:child', 'p6:relation:companion'].map(ref =>
      ({ ref, impact: 'evidence', checks: ['page:6:physical_state'], previousChecks: ['page:6:physical_state'] })));
    expect([prior.diagnosis.findings.map((x: any) => x.key), prior.diagnosis.protectedPages]).toEqual([['page:6:physical_state'], [3]]);
    // Without the contract the same repair carries no such list (absent, unchanged).
    const { addedContracts: _a, ...plainRepair } = repair2;
    expect('repeatedReferences' in (prep(f, { calibration: true, repair: plainRepair }).planningInput as any).priorReviewedStoryboard).toBe(false);
    const candidate = (change: (d: any) => void, cause = 'state_design') => () => compilePersonalStoryboard(s2,
      withCheck(asPresence(basisDraft(f, d => { bothLater(d); change(d); })), s2, { diagnosis: prior.diagnosis, parentDraft: d2 },
        s => { s.resolutions.forEach((r: any) => { r.cause = cause; }); }));
    const presentAs = (d: any, ids: string[]) => { const dep = d.moments.frames[6].depicted;
      dep.relations = dep.relations.filter((o: any) => !ids.includes(o.entityId)); dep.presence = ids.map(actorId => ({ actorId, evidence: DRAWN })); };
    // Another quote, the same claim again (stated or staged), or its actor hidden from that frame: refused. Presence under a changed strategy: admitted.
    expect(candidate(d => presentAs(d, ['child', 'companion']), 'evidence_binding')).toThrow('storyboard_presence_repeated_rebind');
    expect(candidate(d => presentAs(d, ['companion']))).toThrow('storyboard_presence_repeated_claim');
    expect(candidate(d => { presentAs(d, ['companion']); d.moments.frames[6].staging = [{ ref: 'p6:relation:child', reason: 'direction' }]; }))
      .toThrow('storyboard_presence_repeated_claim');
    expect(candidate(d => { d.sequence.pages[5].visibleCastIds = ['child']; presentAs(d, ['child']); })).toThrow('storyboard_presence_repeated_hidden');
    const admitted = candidate(d => presentAs(d, ['child', 'companion']))();
    expect([admitted.presence?.version, admitted.repair?.parentStoryboardDigest]).toEqual([STORYBOARD_PRESENCE_VERSION, b2.storyboardDigest]);
  });

  it('the nesting bound rises only with the owner\'s extension: attempt 6 stands on four nested repairs under the v2 ceiling 6; otherwise the bound stays 3', () => {
    const H = (c: string) => c.repeat(64);
    const v1 = { version: STORYBOARD_ATTEMPT_EXTENSION_VERSION, maxAttempts: 4, approvalSha256: H('b') };
    const v25 = { version: STORYBOARD_ATTEMPT_EXTENSION_V2, maxAttempts: 5, approvalSha256: H('c'), previous: v1 };
    const v26 = { version: STORYBOARD_ATTEMPT_EXTENSION_V2, maxAttempts: 6, approvalSha256: H('d'), previous: v25 };
    /** A repair chain, outermost first: each entry is that repair's extension (or none); the last repair has no parent. */
    const chain = (...extensions: (object | undefined)[]): unknown => extensions.reduceRight<unknown>((parent, extension) => ({ parentStoryboardDigest: H('a'),
      draft: {}, review: {}, ...(parent ? { parentRepair: parent } : {}), ...(extension ? { extension } : {}) }), undefined);
    // Attempt k stands on k-2 nested repairs (the first plan and the first repair need none): attempt 5 at depth 3, attempt 6 at depth 4.
    expect(() => assertStoryboardRepair(chain(v25, v1, undefined, undefined))).not.toThrow();
    expect(() => assertStoryboardRepair(chain(v26, v25, v1, undefined, undefined))).not.toThrow();
    // Without the owner's ceiling 6 the same depth is refused: no extension, or the ceiling-5 extension, keeps the bound at 3.
    expect(() => assertStoryboardRepair(chain(undefined, undefined, undefined, undefined, undefined))).toThrow('personal_storyboard_repair_policy');
    expect(() => assertStoryboardRepair(chain(v25, v1, undefined, undefined, undefined))).toThrow('personal_storyboard_repair_policy');
    // Never past the ceiling's own depth, and an ancestor's extension never raises it (it must be exactly the one the extension above names).
    expect(() => assertStoryboardRepair(chain(v26, v25, v1, undefined, undefined, undefined))).toThrow('personal_storyboard_repair_policy');
    expect(() => assertStoryboardRepair(chain(undefined, v26, v25, v1, undefined))).toThrow('personal_storyboard_repair_policy');
  });

  const BOOK = 'C:/GNart/Work/book-renders/fresh-book-usd7-20261018';
  const CAL_RESULT = path.join(BOOK, 'storyboard-calibration', 'simple-book-result.json'), XREVAL_RESULT = path.join(BOOK, 'storyboard-extension-revalidation', 'simple-book-result.json');
  it.skipIf(!existsSync(CAL_RESULT) || !existsSync(XREVAL_RESULT))('the real attempt 5 (read only): page 8 needs the child\'s instant state, presence fits it structurally, and the reference repeated', () => {
    const result = JSON.parse(readFileSync(CAL_RESULT, 'utf8')), board = result.storyboard.storyboard;
    const texts = previewStoryEvidence(previewTextPages({ title: result.source.manuscript.title, pages: result.source.manuscript.pages })).texts;
    const frames = structuredClone(board.moments.frames).map((fr: any) => fr.depicted ? { ...fr, depicted: { ...fr.depicted, presence: [] } } : fr);
    const d8 = frames[8].depicted, end = texts[8].indexOf(d8.evidence) + d8.evidence.length;
    // The child's own transition (going home) comes after the drawn instant, so the instant had to declare the child's state.
    const home = board.sequence.pages[7].transitions.find((t: any) => t.entityId === 'child');
    expect([home.evidence, texts[8].indexOf(home.evidence) >= end]).toEqual(['ויונתן חזר הביתה', true]);
    // Presence instead of the held relation: structurally admitted with the child's own proposal (before the instant); a later quote refuses.
    const proposal = '"עכשיו נגלגל את הכדור בחזרה, באותה דרך," הציע יונתן.';
    d8.relations = d8.relations.filter((o: any) => o.entityId !== 'child'); d8.presence = [{ actorId: 'child', evidence: proposal }];
    expect(() => validatePresence(frames, board.plan, board.sequence, texts)).not.toThrow();
    d8.presence = [{ actorId: 'child', evidence: home.evidence }];
    expect(() => validatePresence(frames, board.plan, board.sequence, texts)).toThrow('storyboard_presence_evidence');
    // The repeated reference, from the two held reviews' own typed findings (attempt 5's one note is not blocking).
    const blocking = (raw: any, notes: string[]) => [...raw.bookChecks.map((c: any) => ({ scope: 'book', category: c.category, verdict: c.verdict, issues: c.issues ?? [] })),
      ...raw.frames.flatMap((fr: any) => fr.checks.map((c: any) => ({ scope: 'page', pageNumber: fr.pageNumber, category: c.category, verdict: c.verdict, issues: c.issues ?? [] })))]
      .filter((c: any) => c.verdict !== 'supported' && !notes.includes(c.scope === 'book' ? `book:${c.category}` : `page:${c.pageNumber}:${c.category}`));
    const latest = blocking(result.storyboard.rawReview, ['page:8:identity_and_set']);
    const previous = blocking(JSON.parse(readFileSync(XREVAL_RESULT, 'utf8')).storyboard.rawReview, []);
    expect(repeatedReferences(latest as any, previous as any)).toEqual([{ ref: 'p8:relation:child', impact: 'evidence',
      checks: ['book:continuity', 'page:8:physical_state'], previousChecks: ['page:8:physical_state'] }]);
  });
});
