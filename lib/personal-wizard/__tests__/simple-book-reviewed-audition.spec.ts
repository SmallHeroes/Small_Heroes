import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
vi.mock('../storyboard', () => ({
  currentPersonalStoryboardFrame: (_book: unknown, _review: unknown, pageNumber: number) =>
    ({ context: { pageNumber }, render: { prompt: `PAGE ${pageNumber}` } }),
}));
import { QUALITY_CATEGORIES } from '../../local-preview-quality';
import type { PageChildResemblanceVisionResult } from '../../generation-pipeline/page-child-resemblance-vision';
import type { PersonalStoryboard } from '../storyboard';
import { auditionSheetDesigns, auditionSheetPrompt, illustrateReviewedAudition, rejudgeAudition, assessAuditionReview, attemptStatus, selectAuditionAttempt,
  auditionPageChecks, reviewedAuditionHTML, AUDITION_WORST_CASE_CALLS, AUDITION_JUDGE_INSTRUCTIONS, ReviewedAuditionError, auditionPageReviewSchema,
  auditionCorrections, landmarkFeatureCatalogue, type AuditionAttempt, type AuditionLandmark, type LandmarkAspect } from '../simple-book-reviewed-audition';
import { AuditionMeter, readAuditionGrant } from '../../../scripts/personal-simple-book-reviewed-audition';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const texts = ['She takes the paper.', 'She folds it into a boat. A thin trail appears.', 'A cat watches.', 'A big stone.', 'p5', 'p6', 'p7', 'p8'];
const ENTITIES = ['child', 'companion', 'paper_boat', 'ribbon', 'old_tree', 'stone', 'cat', 'trail'];
const state = (n: number) => ENTITIES.map(entityId => ({ entityId, value:
  entityId === 'ribbon' ? { relation: 'attached_to', targetId: 'child' } : entityId === 'paper_boat' ? { relation: 'held_by', targetId: 'child' }
    : entityId === 'stone' && n < 4 || entityId === 'cat' && n < 3 || entityId === 'trail' && n < 2 ? { relation: 'unestablished', targetId: null }
      : { relation: 'at', targetId: 'garden' } }));
const visible = (n: number) => ['old_tree', 'paper_boat', 'ribbon', ...(n >= 2 ? ['trail'] : []), ...(n >= 3 ? ['cat'] : []), ...(n >= 4 ? ['stone'] : [])];
// Data projection input only: an actor attachment, a prop with a later state, landmarks, a late supporting character and a clue.
const fixture = (moments?: unknown) => ({
  narrativeSpreads: 8, sourceDigest: sha('source'), storyboardDigest: sha('board'),
  plan: { recurringProps: [{ id: 'paper_boat', design: 'red folded paper' }, { id: 'ribbon', design: 'gold ribbon' }, { id: 'trail', design: 'thin trail' }],
    wardrobe: 'teal shirt', locations: [{ id: 'garden', design: 'garden with an old tree on the left and a big stone at the back' }],
    actorAppearance: { child: { clothing: ['teal shirt with a gold ribbon'] } },
    continuity: { entities: [
      { id: 'paper_boat', kind: 'prop', invariants: [{ attribute: 'crease', value: 'flat' }, { attribute: 'size', value: 'about 0.3 child heights' }] },
      { id: 'ribbon', kind: 'prop', invariants: [{ attribute: 'color', value: 'gold' }] },
      { id: 'trail', kind: 'prop', invariants: [{ attribute: 'design', value: 'thin dark trail with tiny prints' }] },
      { id: 'old_tree', kind: 'landmark', invariants: [{ attribute: 'design', value: 'forked trunk' }] },
      { id: 'stone', kind: 'landmark', invariants: [{ attribute: 'design', value: 'one big pale stone' }] },
      { id: 'cat', kind: 'supporting_character', invariants: [{ attribute: 'appearance', value: 'ginger cat with a pink nose' }] },
    ], pages: Array.from({ length: 9 }, (_, n) => ({ pageNumber: n, visibleLocationIds: ['garden'], visibleEntityIds: visible(n),
      changes: n === 2 ? [{ entityId: 'paper_boat', attribute: 'crease', value: 'folded boat', storyEvidence: texts[1] }] : [] })) } },
  sequence: { premise: 'a child follows a trail to a stone', mutableAttributes: [{ entityId: 'paper_boat', attribute: 'crease' }],
    pages: Array.from({ length: 8 }, (_, i) => ({ pageNumber: i + 1, sceneId: i < 3 ? 'scene_a' : 'scene_b', states: state(i + 1),
      visibleCastIds: ['child', 'companion', ...(i + 1 >= 3 ? ['cat'] : [])] })) },
  ...(moments ? { moments } : {}),
}) as unknown as PersonalStoryboard;

type Spec = Partial<Record<typeof QUALITY_CATEGORIES[number], { verdict?: 'defect' | 'uncertain'; issues: { impact: string; requirement: string; note: string }[] }>>;
const review = (candidateSha: string, contextSha: string, spec: Spec = {}) => ({ candidateSha, contextSha,
  checks: QUALITY_CATEGORIES.map(category => { const x = spec[category]; return x
    ? { category, verdict: x.verdict ?? 'defect', observation: `${category} observed`, correction: (x.verdict ?? 'defect') === 'defect' ? `fix ${category}` : '', issues: x.issues }
    : { category, verdict: 'pass', observation: `${category} ok`, correction: '', issues: [] }; }) });
const issue = (impact: string, requirement: string, note = `${impact} note`) => ({ impact, requirement, note });
const identity = (score: number): PageChildResemblanceVisionResult => ({ status: score >= .7 ? 'passed' : 'failed', resemblanceScore: score,
  threshold: .7, subjectVisible: true, sameChild: score >= .7, reasonCode: score >= .7 ? 'same_child' : 'different_child', attempts: 1, model: 'gpt-4o' } as never);
const image = (name: string) => ({ imageName: `${name}.png`, imageSha: sha(name) });

// Default page inventory: one matching object per listed landmark (a clean single instance), checked on its own catalogue.
const singleInventory = (context: any) => {
  const landmarks: AuditionLandmark[] = context?.checks?.uniqueLandmarks ?? [];
  return { objects: landmarks.map((l, i) => ({ objectId: `o${i + 1}`, region: `${l.id} in its usual place`, description: `the ${l.id}` })),
    landmarks: landmarks.map((l, i) => ({ landmarkId: l.id, candidates: [{ objectId: `o${i + 1}`, association: 'this_landmark', evidence: 'one instance',
      featureChecks: l.features.map(f => ({ featureId: f.id, observed: 'matches' })) }] })) };
};
function harness(opts: { judge?: (step: string) => Spec; score?: (step: string) => number; renderFail?: (step: string) => Error | null;
  book?: PersonalStoryboard; pages?: number[]; wrap?: <T>(step: string, work: () => Promise<T>) => Promise<T>;
  inventory?: (step: string, context: any) => unknown } = {}) {
  const prompts = new Map<string, string>(), saved = new Map<string, unknown>(), contexts = new Map<string, any>();
  const wrap = opts.wrap ?? (<T>(_step: string, work: () => Promise<T>) => work());
  const args = {
    book: opts.book ?? fixture(), rawReview: {}, texts, current: { request: {}, writerResult: {}, options: {} as never },
    child: image('child'), companion: image('companion'), companionDescription: 'copper dragon with a short rounded snout and two wings',
    ...(opts.pages ? { pages: opts.pages } : {}),
    render: vi.fn((step: string, prompt: string, _refs?: unknown, _mode?: unknown, _roles?: unknown) => wrap(step, async () => {
      const error = opts.renderFail?.(step); if (error) throw error;
      prompts.set(step, prompt); return image(step);
    })),
    judge: vi.fn((step: string, candidate: { imageSha: string }, context: unknown, contextSha: string, _refs?: unknown, _predecessor?: { imageName: string } | null,
      kind?: 'sheet' | 'page') => wrap(step, async () => {
      contexts.set(step, context);
      return { ...review(candidate.imageSha, contextSha, opts.judge?.(step) ?? {}),
        ...(kind === 'page' ? { landmarkInventory: opts.inventory?.(step, context) ?? singleInventory(context) } : {}) };
    })),
    identity: vi.fn((step: string) => wrap(step, async () => identity(opts.score?.(step) ?? .82))),
    check: vi.fn(), save: (name: string, value: unknown) => { saved.set(name, JSON.parse(JSON.stringify(value))); },
  };
  return { args, prompts, saved, contexts };
}

describe('reference sheets: explicit, source-linked deferral', () => {
  it('defers only structured requirements and keeps every other fixed fact, including text that mentions the child', () => {
    const d = auditionSheetDesigns(fixture(), texts);
    expect(d.pageDeferred).toEqual([
      expect.objectContaining({ entityId: 'ribbon', reason: 'attached_to_actor', source: { entityId: 'ribbon', relation: 'attached_to', targetId: 'child' } }),
      expect.objectContaining({ entityId: 'child', reason: 'actor_owned_clothing' }),
      expect.objectContaining({ entityId: 'paper_boat', reason: 'later_state', source: { attribute: 'crease', pageNumber: 2, evidence: texts[1] }, verifiedOn: 'page_2' }),
    ]);
    expect(d.entities.entities.map(e => e.id)).toEqual(['paper_boat', 'trail', 'cat']);
    expect(d.entities.entities[0].invariants).toEqual([{ attribute: 'crease', value: 'flat' }, { attribute: 'size', value: 'about 0.3 child heights' }]);
    expect(d.entities.referenceState.mutableAttributes[0].knownValues).toEqual([{ value: 'flat', pageNumber: 0, evidence: null }]);
    expect('childClothingAuthority' in d.entities).toBe(false);
    expect(d.locations.landmarks.map(l => l.id)).toEqual(['old_tree', 'stone']);
    expect('geography' in d.locations).toBe(false);
    expect(d.locations.sheetScope.excluded).toEqual([expect.objectContaining({ field: 'geography' })]);
    const locations = auditionSheetPrompt('locations', d.locations);
    expect(locations).toContain('FIXED GEOGRAPHY ONLY');
    expect(locations).not.toContain('follows a trail');
    expect(auditionSheetPrompt('entities', d.entities)).toContain('keeps the actor reference\'s characteristic outline');
  });
});

describe('findings: impact, requirement binding and status', () => {
  const ids = ['page_text', 'cast:companion', 'landmark_unique:stone', 'safety'];
  it('enforces issue coverage and the existing review binding', () => {
    const ok = review(sha('c'), sha('x'));
    expect(() => assessAuditionReview({ ...ok, checks: ok.checks.map(c => c.category === 'props' ? { ...c, issues: [issue('detail', 'page_text')] } : c) }, sha('c'), sha('x'), ids)).toThrow('audition_review_issue_coverage');
    expect(() => assessAuditionReview(review(sha('c'), sha('x'), { props: { issues: [] } }), sha('c'), sha('x'), ids)).toThrow('audition_review_issue_coverage');
    expect(() => assessAuditionReview(ok, sha('other'), sha('x'), ids)).toThrow('quality_evidence_binding');
  });
  it('a miscited critical finding stays critical and invalidates the review; a miscited detail stays detail; unreadable safety blocks', () => {
    for (const impact of ['story', 'identity', 'continuity'])
      for (const requirement of ['made_up_requirement', 'cast:dinI', 'cast:Companion']) {
        const a = assessAuditionReview(review(sha('c'), sha('x'), { identity: { issues: [issue(impact, requirement)] } }), sha('c'), sha('x'), ids).assessment;
        expect(a).toMatchObject({ counts: { [impact]: 1, detail: 0 }, invalidCitations: 1, findings: [expect.objectContaining({ bound: false })] });
        expect(attemptStatus('page', { candidate: image('x'), assessment: a, identity: identity(.82) })).toBe('review_invalid');
        expect(attemptStatus('sheet', { candidate: image('x'), assessment: a })).toBe('review_invalid');
      }
    const d = assessAuditionReview(review(sha('c'), sha('x'), { framing: { issues: [issue('detail', 'made_up_requirement')] } }), sha('c'), sha('x'), ids).assessment;
    expect(d).toMatchObject({ counts: { detail: 1 }, invalidCitations: 0 });
    expect(attemptStatus('page', { candidate: image('x'), assessment: d, identity: identity(.82) })).toBe('qa_supported');
    expect(attemptStatus('page', { candidate: image('x'), assessment: d, identity: identity(.69) })).toBe('held');
    const s = assessAuditionReview(review(sha('c'), sha('x'), { safety: { verdict: 'uncertain', issues: [issue('detail', 'safety')] } }), sha('c'), sha('x'), ids).assessment;
    expect(s.safetyBlocked).toBe(true);
  });
  const attempt = (n: number, spec: Spec, score = .9): AuditionAttempt => {
    const { review: r, assessment } = assessAuditionReview(review(sha(`c${n}`), sha('x'), spec), sha(`c${n}`), sha('x'), ids);
    const candidate = image(`c${n}`), id = identity(score);
    return { attempt: n, candidate, review: r, assessment, identity: id, status: attemptStatus('page', { candidate, assessment, identity: id }) };
  };
  it('holds anything with story, identity or continuity findings or a missing/low child measurement; detail alone is supported', () => {
    expect(attempt(0, { framing: { issues: [issue('detail', 'page_text')] } }).status).toBe('qa_supported');
    expect(attempt(0, { scene: { issues: [issue('story', 'page_text')] } }).status).toBe('held');
    expect(attempt(0, {}, .5).status).toBe('held');
    expect(attemptStatus('page', { candidate: image('x'), assessment: attempt(0, {}).assessment, identity: null })).toBe('held');
    expect(attemptStatus('sheet', { candidate: image('x'), assessment: attempt(0, {}).assessment })).toBe('qa_supported');
    expect(attempt(0, { safety: { verdict: 'uncertain', issues: [issue('safety', 'safety')] } }).status).toBe('ineligible_safety');
  });
  it('prefers fewer story findings over fewer details, never the newest by default, and never a safety-blocked image', () => {
    const story = attempt(0, { scene: { issues: [issue('story', 'page_text')] } });
    const details = attempt(1, { framing: { issues: [issue('detail', 'page_text'), issue('detail', 'page_text')] }, props: { issues: [issue('continuity', 'landmark_unique:stone')] } });
    expect(selectAuditionAttempt('page', [story, details])!.attempt).toBe(1);
    const tieA = attempt(0, { props: { issues: [issue('continuity', 'landmark_unique:stone')] } }), tieB = attempt(1, { props: { issues: [issue('continuity', 'landmark_unique:stone')] } });
    expect(selectAuditionAttempt('page', [tieA, tieB])!.attempt).toBe(0);
    const unsafe = attempt(2, { safety: { issues: [issue('safety', 'safety')] } });
    expect(selectAuditionAttempt('page', [unsafe])).toBeNull();
    // A good face does not outrank a broken story.
    const faceGoodStoryBroken = attempt(0, { scene: { issues: [issue('story', 'page_text')] } }, .95), faceLowStoryOk = attempt(1, {}, .6);
    expect(selectAuditionAttempt('page', [faceGoodStoryBroken, faceLowStoryOk])!.attempt).toBe(1);
  });
});

describe('landmark instances: code counts on a source-bound catalogue; one observed object, one id', () => {
  const F = (id: string, aspect: LandmarkAspect, text: string, decisive = true) => ({ id, aspect, text, clause: text, decisive });
  const tree: AuditionLandmark = { id: 'old_tree', features: [F('f1', 'shape', 'forked')] };
  const stone: AuditionLandmark = { id: 'stone', features: [F('f1', 'size', 'big'), F('f2', 'colour', 'pale'), F('f3', 'shape', 'rounded')] };
  type Seen = Record<string, 'matches' | 'contradicted' | 'not_visible'>;
  const cand = (objectId: string, association: string, seen: Seen = {}, l: AuditionLandmark = stone) => ({ objectId, association, evidence: `${objectId} evidence`,
    featureChecks: l.features.map(f => ({ featureId: f.id, observed: seen[f.text] ?? 'matches' })) });
  const obj = (objectId: string, region: string) => ({ objectId, region, description: `object at ${region}` });
  const assessWith = (ls: AuditionLandmark[], objects: unknown[], entries: Record<string, unknown[]>, spec: Spec = {}) => assessAuditionReview(
    { ...review(sha('c'), sha('x'), spec), landmarkInventory: { objects, landmarks: ls.map(l => ({ landmarkId: l.id, candidates: entries[l.id] ?? [] })) } },
    sha('c'), sha('x'), ['page_text', 'safety', ...ls.map(l => `landmark_unique:${l.id}`)], ls).assessment;
  const assess = (objects: unknown[], stoneCandidates: unknown[], spec: Spec = {}) => assessWith([tree, stone], objects, { stone: stoneCandidates }, spec);
  const of = (a: ReturnType<typeof assess>, id = 'stone') => a.landmarks!.find(l => l.landmarkId === id)!;
  const main = obj('o1', 'front centre, with the opening'), behind = obj('o2', 'behind it, upper left'), mainC = cand('o1', 'this_landmark');
  const held = (a: ReturnType<typeof assess>) => attemptStatus('page', { candidate: image('c'), assessment: a, identity: identity(.9) });

  it('builds one comparison catalogue per landmark from its written design: words only from the source, the same on every page', () => {
    // "+" = decisive (whole-object cue: decides strength, dismissal and owner identification); "~" = listed (a part, a nearby object or a
    // later clause: checked, never decides, never identifies — whose part it is cannot be read from wording).
    const cases: [{ attribute: string; value: string }[], string[]][] = [
      [[{ attribute: 'design', value: 'Large pale-gray rounded rock with one diagonal ochre seam and a low burrow opening beneath its front lip; rear right of garden.' }],
        ['+size:large', '+colour:pale-gray', '+shape:rounded', '~colour:ochre', '~size:low']],
      [[{ attribute: 'design', value: 'Three wooden seat slats, three back slats and two dark iron supports; behind the tree.' }], ['+material:wooden', '~colour:dark', '~material:iron']],
      // Structured invariants: an attribute named after an aspect keeps its value (its first clause decides); other attributes are read word by word.
      [[{ attribute: 'structure', value: 'one large rectangular woven rug' }, { attribute: 'count', value: '1' }, { attribute: 'material', value: 'braided cotton' },
        { attribute: 'color', value: 'sand beige with muted border' }], ['+size:large', '+shape:rectangular', '+material:braided cotton', '+colour:sand beige', '~colour:muted border']],
      // A run of colour words is one cue; a tone word before a non-colour is not a colour; unknown words never become features.
      [[{ attribute: 'design', value: 'soft gray-brown spines and a warm brown cap, light wooden frame' }], ['+colour:soft gray-brown', '~colour:warm brown', '~material:wooden']],
      [[{ attribute: 'structure', value: 'one bedroom doorway with simple frame' }], []],
      // Polarity: a negated statement yields no cue at all.
      [[{ attribute: 'design', value: 'Large rounded brown rock with no red markings.' }], ['+size:large', '+shape:rounded', '+colour:brown']],
      [[{ attribute: 'design', value: 'Small grey stone without red streaks' }], ['+size:small', '+colour:grey', '+material:stone']],
      [[{ attribute: 'colour', value: 'deep green, not red' }], ['+colour:deep green']],
      // Scope: a nearby or contained object's words are listed but never decide; a first clause that is not "descriptors... noun" never decides.
      [[{ attribute: 'design', value: 'Small blue boat beside a large red barn' }], ['+size:small', '+colour:blue', '~size:large', '~colour:red']],
      [[{ attribute: 'design', value: 'Wooden crate full of red apples' }], ['+material:wooden', '~colour:red']],
      [[{ attribute: 'design', value: 'basket holding green eggs' }], ['~colour:green']],
      [[{ attribute: 'design', value: 'kettle black with a lid' }], ['~colour:black']],
      // The same wording can name the object's own parts or a neighbour's: every later clause is listed, none decides or identifies.
      [[{ attribute: 'design', value: 'Arched portal beside a blue square sign' }], ['+shape:arched', '~colour:blue', '~shape:square']],
      [[{ attribute: 'design', value: 'Arched portal beside two blue square signs' }], ['+shape:arched', '~colour:blue', '~shape:square']],
      [[{ attribute: 'design', value: 'Arched portal with two blue square panels' }], ['+shape:arched', '~colour:blue', '~shape:square']],
      [[{ attribute: 'design', value: 'Arched portal and two blue square flags' }], ['+shape:arched', '~colour:blue', '~shape:square']],
      [[{ attribute: 'design', value: 'Single rectangular wooden seat on two cream ropes, supported by a separate wooden frame on the right lawn.' }],
        ['+shape:rectangular', '+material:wooden', '~colour:cream', '~material:wooden']],
    ];
    for (const [invariants, expected] of cases) {
      const catalogue = landmarkFeatureCatalogue(invariants);
      expect(catalogue.map(f => `${f.decisive ? '+' : '~'}${f.aspect}:${f.text}`)).toEqual(expected);
      expect(catalogue.map(f => f.id)).toEqual(expected.map((_, i) => `f${i + 1}`));
      const source = invariants.map(i => i.value).join(' ').toLowerCase();
      for (const f of catalogue) { expect(source).toContain(f.text); expect(source).toContain(f.clause.toLowerCase()); }
    }
    expect(() => landmarkFeatureCatalogue([{ attribute: 'design', value: Array.from({ length: 17 }, (_, i) => `${i} red`).join(', ') }])).toThrow('audition_landmark_catalogue');
    const book = fixture();
    expect(auditionPageChecks(book, 0, 'x').uniqueLandmarks.map(l => l.features)).toEqual(auditionPageChecks(book, 6, 'y').uniqueLandmarks.map(l => l.features));
  });
  it('counts a near-copy that the model called different only for a missing part or another placement', () => {
    const a = assess([main, behind], [mainC, cand('o2', 'different_object')]);
    expect(of(a)).toMatchObject({ instances: 2, strong: 2, reclassified: 1 });
    expect(a.findings).toEqual([expect.objectContaining({ requirement: 'landmark_unique:stone', impact: 'continuity', verdict: 'defect', bound: true, derived: true })]);
    expect(held(a)).toBe('held');
  });
  it('keeps a genuinely different object out (contradicted size or colour), and does not fail a valid occlusion or a different angle', () => {
    const pebble = [obj('o2', 'small grey pebble on the path')], pebbleC = cand('o2', 'different_object', { big: 'contradicted', pale: 'contradicted' });
    expect(assess([main, ...pebble], [mainC, pebbleC]).findings).toEqual([]);
    expect(assess([obj('o1', 'partly hidden behind the bush')], [cand('o1', 'this_landmark', { big: 'not_visible', rounded: 'not_visible' })]).findings).toEqual([]);
    expect(assess([obj('o1', 'seen from a low angle, left of frame')], [mainC]).findings).toEqual([]);
    expect(held(assess([main, ...pebble], [mainC, pebbleC]))).toBe('qa_supported');
  });
  it('reports an ambiguous second object as uncertain, never as an invented count', () => {
    const a = assess([main, obj('o2', 'distant shape in haze')], [mainC, cand('o2', 'possible_copy', { big: 'not_visible', pale: 'not_visible', rounded: 'not_visible' })]);
    expect(of(a)).toMatchObject({ instances: 2, strong: 1 });
    expect(a.findings).toEqual([expect.objectContaining({ requirement: 'landmark_unique:stone', verdict: 'uncertain', impact: 'continuity' })]);
    // Hidden is never a contradiction: dismissing an object whose features are only not visible does not remove it.
    const hidden = assess([main, obj('o2', 'half behind the tree')], [mainC, cand('o2', 'different_object', { big: 'not_visible', pale: 'not_visible', rounded: 'not_visible' })]);
    expect(of(hidden)).toMatchObject({ instances: 2, strong: 1, reclassified: 1 });
    // One shared feature is not enough for a strong copy.
    expect(assess([main, obj('o2', 'another rounded thing')], [mainC, cand('o2', 'possible_copy', { big: 'not_visible', pale: 'not_visible' })]).findings)
      .toEqual([expect.objectContaining({ verdict: 'uncertain' })]);
  });
  it('does not double count when the model already cited the landmark itself', () => {
    const a = assess([main, behind], [mainC, cand('o2', 'this_landmark')], { environment: { issues: [issue('continuity', 'landmark_unique:stone', 'two stones')] } });
    // Both observations stay listed (the model's and the inventory's); the requirement is penalised once.
    expect(a.findings.filter(f => f.requirement === 'landmark_unique:stone').map(f => f.note.startsWith('landmark inventory') ? 'derived' : f.note)).toEqual(['two stones', 'derived']);
    expect(a.counts.continuity).toBe(1);
    expect(held(a)).toBe('held');
  });
  it('keeps the derived duplicate when the model raised a lesser issue on the same landmark (QA P1)', () => {
    const a = assess([main, behind], [mainC, cand('o2', 'this_landmark')], { environment: { issues: [issue('detail', 'landmark_unique:stone', 'a minor surface marking differs')] } });
    expect(a.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ requirement: 'landmark_unique:stone', verdict: 'defect', impact: 'continuity', derived: true }),
      expect.objectContaining({ requirement: 'landmark_unique:stone', note: 'a minor surface marking differs' })]));
    expect(a.counts).toMatchObject({ continuity: 1, detail: 0 });
    expect(held(a)).toBe('held');
  });
  it('keeps the duplicate observation beside an unrelated critical issue on the same landmark, without a double penalty (QA P1)', () => {
    const a = assess([main, behind], [mainC, cand('o2', 'this_landmark')],
      { environment: { issues: [issue('continuity', 'landmark_unique:stone', 'a surface marking differs from the written design')] } });
    expect(a.findings.filter(f => f.requirement === 'landmark_unique:stone').map(f => f.derived ?? false)).toEqual([false, true]);
    expect(a.counts.continuity).toBe(1);
    const forwarded = auditionCorrections({ attempt: 0, candidate: image('c'), review: null, assessment: a, status: 'held', identity: identity(.9) }, 'page');
    expect(forwarded).toContain('landmark inventory: 2 objects match stone');
    expect(forwarded).toContain('a surface marking differs from the written design');
  });
  it('does not turn a repeated record into a second object; unknown or repeated ids are unusable (QA P2)', () => {
    expect(() => assess([main], [mainC, { ...mainC }])).toThrow('audition_review_landmark_inventory');
    expect(() => assess([main, { ...main }], [mainC])).toThrow('audition_review_landmark_inventory');
    expect(() => assess([main], [mainC, cand('o7', 'possible_copy')])).toThrow('audition_review_landmark_inventory');
    // Two ids naming the same place are one object.
    const a = assess([main, obj('o2', '  Front centre,  with the opening ')], [mainC, cand('o2', 'this_landmark')]);
    expect(of(a)).toMatchObject({ instances: 1 });
    expect(a.findings).toEqual([]);
    // Two distinct places stay two objects.
    expect(of(assess([main, behind], [mainC, cand('o2', 'this_landmark')]))).toMatchObject({ instances: 2, strong: 2 });
    // Two records of ONE place that disagree on strength stay one ambiguous object, not a confirmed copy.
    const mixed = assess([main, obj('o2', 'behind it'), obj('o3', ' Behind  it')],
      [mainC, cand('o2', 'possible_copy'), cand('o3', 'possible_copy', { big: 'not_visible', rounded: 'not_visible' })]);
    expect(of(mixed)).toMatchObject({ instances: 2, strong: 1 });
    expect(mixed.findings).toEqual([expect.objectContaining({ requirement: 'landmark_unique:stone', verdict: 'uncertain' })]);
  });
  it('one cue split into two words is not two independent supports (QA P2)', () => {
    const twoColours: AuditionLandmark = { id: 'stone', features: [F('f1', 'colour', 'pale'), F('f2', 'colour', 'grey'), F('f3', 'shape', 'rounded')] };
    const a = assessWith([tree, twoColours], [obj('o1', 'main'), obj('o2', 'distant')],
      { stone: [cand('o1', 'this_landmark', {}, twoColours), cand('o2', 'possible_copy', { rounded: 'not_visible' }, twoColours)] });
    expect(of(a)).toMatchObject({ instances: 2, strong: 1 });
    expect(a.findings).toEqual([expect.objectContaining({ requirement: 'landmark_unique:stone', verdict: 'uncertain' })]);
  });

  // Synthetic cases shaped from the two saved page-4 reviews (2026-10-11); the raw outputs themselves stay unchanged evidence.
  const rock: AuditionLandmark = { id: 'stone', features: landmarkFeatureCatalogue([{ attribute: 'design',
    value: 'Large pale-gray rounded rock with one diagonal ochre seam and a low burrow opening beneath its front lip; rear right of garden.' }]) };
  const bench: AuditionLandmark = { id: 'bench', features: landmarkFeatureCatalogue([{ attribute: 'design', value: 'Three wooden seat slats, three back slats and two dark iron supports; behind the tree.' }]) };
  const swing: AuditionLandmark = { id: 'swing', features: landmarkFeatureCatalogue([{ attribute: 'design',
    value: 'Single rectangular wooden seat on two cream ropes, supported by a separate wooden frame on the right lawn.' }]) };
  const garden = [rock, bench, swing];
  const gardenObjects = [obj('o1', 'upper-left background behind the tree'), obj('o2', 'right edge, cropped seat, ropes and frame'), obj('o3', 'upper-right large rock')];
  const benchSeesSwing = cand('o2', 'possible_copy', { dark: 'not_visible', iron: 'not_visible' }, bench);
  it('a swing identified as the swing by its whole-object cues is not also a bench copy because both are wooden (saved control shape)', () => {
    const a = assessWith(garden, gardenObjects, { bench: [cand('o1', 'this_landmark', {}, bench), benchSeesSwing],
      swing: [cand('o2', 'this_landmark', {}, swing)], stone: [cand('o3', 'this_landmark', {}, rock)] });
    expect(of(a, 'bench')).toMatchObject({ instances: 1, excluded: 1 });
    expect(of(a, 'bench').candidates[1]).toMatchObject({ objectId: 'o2', identifiedAs: 'swing', identityConfirmed: true, excluded: true, counted: false });
    expect(a.findings).toEqual([]);
    expect(held(a)).toBe('qa_supported');
    // ACCEPTED COST (Guy, 2026-10-12): with the seat's shape cropped, only wood and the rope colour are visible; the rope colour is a listed
    // cue whose owner wording cannot establish, so the swing is not identified and the bench ambiguity stays uncertain (held, not approved).
    const cropped = assessWith(garden, gardenObjects, { bench: [cand('o1', 'this_landmark', {}, bench), benchSeesSwing],
      swing: [cand('o2', 'this_landmark', { rectangular: 'not_visible' }, swing)], stone: [cand('o3', 'this_landmark', {}, rock)] });
    expect(of(cropped, 'bench')).toMatchObject({ instances: 2, excluded: 0 });
    expect(of(cropped, 'bench').candidates[1]).toMatchObject({ identifiedAs: 'swing', identityConfirmed: false, counted: true });
    expect(cropped.findings).toEqual([expect.objectContaining({ requirement: 'landmark_unique:bench', verdict: 'uncertain' })]);
    expect(held(cropped)).toBe('held');
    // Without the shared id the code cannot know it is the same object: the ambiguity is reported, not guessed away from region wording.
    const unlinked = assessWith(garden, [...gardenObjects, obj('o4', 'right edge seat')], { bench: [cand('o1', 'this_landmark', {}, bench),
      { ...benchSeesSwing, objectId: 'o4' }], swing: [cand('o2', 'this_landmark', {}, swing)], stone: [cand('o3', 'this_landmark', {}, rock)] });
    expect(unlinked.findings).toEqual([expect.objectContaining({ requirement: 'landmark_unique:bench', verdict: 'uncertain', derived: true })]);
  });
  it('a second rock matching the separate size, colour and shape features is a strong copy without the model\'s own finding (saved duplicate shape)', () => {
    const a = assessWith([rock], [obj('o1', 'large right-hand rock around the opening'), obj('o2', 'behind and left of the entrance rock')],
      { stone: [cand('o1', 'this_landmark', {}, rock), cand('o2', 'possible_copy', { low: 'not_visible' }, rock)] });
    expect(of(a)).toMatchObject({ instances: 2, strong: 2 });
    expect(a.findings).toEqual([expect.objectContaining({ requirement: 'landmark_unique:stone', verdict: 'defect', derived: true })]);
    // The same observation against one bundled feature (the earlier per-picture decomposition) is a single support: only uncertain.
    const bundled: AuditionLandmark = { id: 'stone', features: [F('f1', 'shape', 'large pale-gray rounded rock')] };
    const b = assessWith([bundled], [obj('o1', 'main'), obj('o2', 'behind')], { stone: [cand('o1', 'this_landmark', {}, bundled), cand('o2', 'possible_copy', {}, bundled)] });
    expect(b.findings).toEqual([expect.objectContaining({ verdict: 'uncertain' })]);
  });
  it('a different object identified as another landmark never excuses a real copy (peer binding is per observed object)', () => {
    const objects = [...gardenObjects, obj('o4', 'second rock by the gate')];
    const entries = (seen: Seen) => ({ stone: [cand('o3', 'this_landmark', {}, rock), cand('o4', 'possible_copy', seen, rock)],
      swing: [cand('o2', 'this_landmark', {}, swing)], bench: [cand('o1', 'this_landmark', {}, bench)] });
    expect(assessWith(garden, objects, entries({ low: 'not_visible' })).findings).toEqual([expect.objectContaining({ requirement: 'landmark_unique:stone', verdict: 'defect' })]);
    expect(assessWith(garden, objects, entries({ large: 'not_visible', rounded: 'not_visible' })).findings)
      .toEqual([expect.objectContaining({ requirement: 'landmark_unique:stone', verdict: 'uncertain' })]);
    // The bench's only decisive cue is its material, so a second wooden bench can be reported but never confirmed: uncertain.
    const benchCopy = assessWith(garden, [...gardenObjects, obj('o4', 'second bench by the gate')], { bench: [cand('o1', 'this_landmark', {}, bench),
      cand('o4', 'possible_copy', {}, bench)], swing: [cand('o2', 'this_landmark', {}, swing)], stone: [cand('o3', 'this_landmark', {}, rock)] });
    expect(benchCopy.findings).toEqual([expect.objectContaining({ requirement: 'landmark_unique:bench', verdict: 'uncertain' })]);
  });
  it('conflicting or unsupported identities stay counted (uncertain); one object claimed by two landmarks is unusable', () => {
    // Strongly supported as a rock copy while confirmed as the swing: counted, not strong, never dismissed.
    const strongBoth = assessWith(garden, gardenObjects, { stone: [cand('o3', 'this_landmark', {}, rock), cand('o2', 'possible_copy', { low: 'not_visible' }, rock)],
      swing: [cand('o2', 'this_landmark', {}, swing)], bench: [cand('o1', 'this_landmark', {}, bench)] });
    expect(of(strongBoth)).toMatchObject({ instances: 2, strong: 1 });
    expect(of(strongBoth).candidates[1]).toMatchObject({ identityConfirmed: true, conflict: true, counted: true, strong: false });
    expect(strongBoth.findings).toEqual([expect.objectContaining({ requirement: 'landmark_unique:stone', verdict: 'uncertain' })]);
    // A claim the claiming landmark's own checks contradict confirms nothing: the object still counts here.
    const selfContradicted = assessWith(garden, gardenObjects, { bench: [cand('o1', 'this_landmark', {}, bench), benchSeesSwing],
      swing: [cand('o2', 'this_landmark', { rectangular: 'contradicted' }, swing)], stone: [cand('o3', 'this_landmark', {}, rock)] });
    expect(of(selfContradicted, 'bench')).toMatchObject({ instances: 2, excluded: 0 });
    expect(selfContradicted.findings).toEqual([expect.objectContaining({ requirement: 'landmark_unique:bench', verdict: 'uncertain' })]);
    // Any contradicted cue of the claimed owner blocks the identification, even beside two matching whole-object cues (fail-closed).
    const listedContradicted = assessWith(garden, gardenObjects, { bench: [cand('o1', 'this_landmark', {}, bench), benchSeesSwing],
      swing: [cand('o2', 'this_landmark', { cream: 'contradicted' }, swing)], stone: [cand('o3', 'this_landmark', {}, rock)] });
    expect(of(listedContradicted, 'bench')).toMatchObject({ instances: 2, excluded: 0 });
    expect(of(listedContradicted, 'bench').candidates[1]).toMatchObject({ identityConfirmed: false, counted: true });
    expect(() => assessWith(garden, gardenObjects, { bench: [cand('o2', 'this_landmark', {}, bench)], swing: [cand('o2', 'this_landmark', {}, swing)],
      stone: [cand('o3', 'this_landmark', {}, rock)] })).toThrow('audition_review_landmark_inventory');
  });
  describe('a foreign identity needs positive, distinguishing support (QA F1)', () => {
    const markerA: AuditionLandmark = { id: 'marker_a', features: [F('f1', 'material', 'wooden')] };
    const markerB: AuditionLandmark = { id: 'marker_b', features: [F('f1', 'material', 'wooden'), F('f2', 'shape', 'rectangular')] };
    const objects = [obj('o1', 'left foreground'), obj('o2', 'separate object in the right foreground')];
    const run = (a: AuditionLandmark, b: AuditionLandmark, seen: Seen) => assessWith([a, b], objects, { marker_a: [cand('o1', 'this_landmark', {}, a),
      cand('o2', 'possible_copy', {}, a)], marker_b: [cand('o2', 'this_landmark', seen, b)] });
    const unresolved = (a: ReturnType<typeof run>) => {
      expect(of(a, 'marker_a')).toMatchObject({ instances: 2, excluded: 0 });
      expect(of(a, 'marker_a').candidates[1]).toMatchObject({ identifiedAs: 'marker_b', identityConfirmed: false, counted: true });
      expect(a.findings).toEqual([expect.objectContaining({ requirement: 'landmark_unique:marker_a', verdict: 'uncertain' })]);
      expect(held(a)).toBe('held');
    };
    it('control: two observed aspects, one not shared with this landmark, confirm the owner', () => {
      const observed = run(markerA, markerB, {});
      expect(of(observed, 'marker_a')).toMatchObject({ instances: 1, excluded: 1 });
      expect(held(observed)).toBe('qa_supported');
    });
    it('every owner feature hidden confirms nothing', () => unresolved(run(markerA, markerB, { wooden: 'not_visible', rectangular: 'not_visible' })));
    it('an empty owner catalogue confirms nothing', () => unresolved(run(markerA,
      { id: 'marker_b', features: landmarkFeatureCatalogue([{ attribute: 'structure', value: 'one bedroom doorway with simple frame' }]) }, {})));
    it('a cue shared with this landmark alone confirms nothing', () => unresolved(run(markerA, { id: 'marker_b', features: [F('f1', 'material', 'wooden')] }, {})));
    it('one observed aspect confirms nothing, even a distinguishing one', () => unresolved(run(markerA, markerB, { wooden: 'not_visible' })));
    it('two aspects whose every matched cue this landmark shares confirm nothing', () => {
      const sharedA: AuditionLandmark = { id: 'marker_a', features: [F('f1', 'material', 'wooden'), F('f2', 'colour', 'dark', false)] };
      // "dark green" shares "dark" with this landmark: a partly shared cue does not distinguish either.
      unresolved(run(sharedA, { id: 'marker_b', features: [F('f1', 'material', 'wooden'), F('f2', 'colour', 'dark green')] }, {}));
    });
  });
  describe('a part, nearby-object or negated cue never dismisses a whole-landmark copy (QA F2)', () => {
    const objects = [obj('o1', 'main'), obj('o2', 'second object behind it')];
    const copyOf = (l: AuditionLandmark, seen: Seen) => assessWith([l], objects, { [l.id]: [cand('o1', 'this_landmark', {}, l), cand('o2', 'different_object', seen, l)] });
    it('the written opening\'s "low" belongs to the opening: a different opening does not make the second rock another object', () => {
      const lowOpening = copyOf(rock, { low: 'contradicted' });
      expect(of(lowOpening)).toMatchObject({ instances: 2, strong: 2, reclassified: 1 });
      expect(lowOpening.findings).toEqual([expect.objectContaining({ requirement: 'landmark_unique:stone', verdict: 'defect' })]);
      expect(held(lowOpening)).toBe('held');
    });
    it('"no red markings" yields no red cue, so nothing red can dismiss a matching rock', () => {
      const negated: AuditionLandmark = { id: 'stone', features: landmarkFeatureCatalogue([{ attribute: 'design', value: 'Large rounded brown rock with no red markings.' }]) };
      expect(negated.features.some(f => f.text === 'red')).toBe(false);
      expect(copyOf(negated, {}).findings).toEqual([expect.objectContaining({ verdict: 'defect' })]);
    });
    it('a nearby object\'s size and colour are not the landmark\'s', () => {
      const boat: AuditionLandmark = { id: 'boat', features: landmarkFeatureCatalogue([{ attribute: 'design', value: 'Small blue boat beside a large red barn' }]) };
      expect(copyOf(boat, { large: 'contradicted', red: 'contradicted' }).findings).toEqual([expect.objectContaining({ requirement: 'landmark_unique:boat', verdict: 'defect' })]);
    });
    it('control: a contradicted whole-object size still dismisses (the small foreground stones of the saved control)', () => {
      expect(copyOf(rock, { large: 'contradicted' }).findings).toEqual([]);
    });
  });
  describe('only whole-object cues identify an owner: a neighbour\'s or a part\'s cues never do (QA owner-evidence, Phase 1)', () => {
    const markerA: AuditionLandmark = { id: 'marker_a', features: [F('f1', 'material', 'wooden')] };
    const portal = (design: string): AuditionLandmark => ({ id: 'marker_b', features: landmarkFeatureCatalogue([{ attribute: 'design', value: design }]) });
    const objects = [obj('o1', 'left foreground'), obj('o2', 'separate object in the right foreground')];
    const sign = obj('o3', 'separate sign beside the claimed portal');
    // o2 is a possible copy of marker_a and is claimed as marker_b's own instance; marker_b's own shape is hidden.
    const run = (b: AuditionLandmark, withSign: boolean) => assessWith([markerA, b], withSign ? [...objects, sign] : objects, {
      marker_a: [cand('o1', 'this_landmark', {}, markerA), cand('o2', 'possible_copy', {}, markerA)],
      marker_b: [cand('o2', 'this_landmark', { arched: 'not_visible' }, b), ...(withSign ? [cand('o3', 'different_object', { arched: 'contradicted' }, b)] : [])] });
    const unresolved = (a: ReturnType<typeof run>) => {
      expect(of(a, 'marker_a')).toMatchObject({ instances: 2, excluded: 0 });
      expect(a.findings).toEqual([expect.objectContaining({ requirement: 'landmark_unique:marker_a', verdict: 'uncertain' })]);
      expect(held(a)).toBe('held');
    };
    it('a sign beside the portal, listed as its own object, does not identify the hidden portal', () => unresolved(run(portal('Arched portal beside a blue square sign'), true)));
    it('the same without the sign listed', () => unresolved(run(portal('Arched portal beside a blue square sign'), false)));
    it('a counted neighbour is still a neighbour', () => unresolved(run(portal('Arched portal beside two blue square signs'), true)));
    it('an uncounted thing joined by "with" is context, not a part (conservative: lexical, it may be attached or not)', () =>
      unresolved(run(portal('Arched portal with a blue square sign'), true)));
    it('a nested neighbour\'s parts ("beside a sign with two panels") do not identify the hidden portal', () =>
      unresolved(run(portal('Arched portal beside a sign with two blue square panels'), true)));
    it('coordinated separate objects ("and two flags") do not identify the hidden portal', () =>
      unresolved(run(portal('Arched portal and two blue square flags'), true)));
    it('a possessive does not say whose parts they are ("beside a sign with its panels")', () =>
      unresolved(run(portal('Arched portal beside a sign with its blue square panels'), true)));
    it('hand-built listed cues identify nothing', () =>
      unresolved(run({ id: 'marker_b', features: [F('f1', 'shape', 'arched'), F('f2', 'colour', 'blue', false), F('f3', 'shape', 'square', false)] }, true)));
    it('ACCEPTED COST: the portal\'s own panels with its arch hidden do not identify it either (wording cannot prove they are its own)', () =>
      unresolved(run(portal('Arched portal with two blue square panels'), false)));
    it('control: two visible whole-object cues identify the portal and clear the ambiguity', () => {
      const a = assessWith([markerA, portal('Tall arched portal beside a blue square sign')], objects, {
        marker_a: [cand('o1', 'this_landmark', {}, markerA), cand('o2', 'possible_copy', {}, markerA)],
        marker_b: [cand('o2', 'this_landmark', {}, portal('Tall arched portal beside a blue square sign'))] });
      expect(of(a, 'marker_a')).toMatchObject({ instances: 1, excluded: 1 });
      expect(held(a)).toBe('qa_supported');
    });
  });
  it('rejects an inventory that skips, invents or under-checks a landmark', () => {
    const inventory = (landmarks: unknown[]) => ({ ...review(sha('c'), sha('x')), landmarkInventory: { objects: [main], landmarks } });
    const ids = ['page_text', 'safety', 'landmark_unique:old_tree', 'landmark_unique:stone'];
    expect(() => assessAuditionReview(inventory([{ landmarkId: 'old_tree', candidates: [] }]), sha('c'), sha('x'), ids, [tree, stone])).toThrow('audition_review_landmark_inventory');
    expect(() => assessAuditionReview(inventory([{ landmarkId: 'old_tree', candidates: [] }, { landmarkId: 'stone', candidates: [mainC] }, { landmarkId: 'ghost', candidates: [] }]),
      sha('c'), sha('x'), ids, [tree, stone])).toThrow('audition_review_landmark_inventory');
    expect(() => assess([main], [{ ...mainC, featureChecks: mainC.featureChecks.slice(1) }])).toThrow('audition_review_landmark_inventory');
    expect(() => assess([main], [{ ...mainC, featureChecks: [...mainC.featureChecks.slice(1), { featureId: 'f9', observed: 'matches' }] }])).toThrow('audition_review_landmark_inventory');
    expect(() => assessAuditionReview(review(sha('c'), sha('x')), sha('c'), sha('x'), ids, [tree, stone])).toThrow();
    // Sheets keep the existing schema: an inventory is not accepted there.
    expect(() => assessAuditionReview({ ...review(sha('c'), sha('x')), landmarkInventory: { objects: [], landmarks: [] } }, sha('c'), sha('x'), ids)).toThrow();
  });
  it('states the inventory rule generically: no object type from a book under test', () => {
    const page = AUDITION_JUDGE_INSTRUCTIONS.page;
    expect(page).toContain('different_object needs a visibly contradicted');
    expect(page).toContain('Hidden by angle, crop or occlusion is not_visible, never contradicted.');
    expect(page).toContain('use the SAME objectId in that entry');
    for (const word of [/\brocks?\b/i, /boulder/i, /burrow/i, /swing/i, /\bbench/i, /button nose/i]) expect(page).not.toMatch(word);
    expect(Object.keys(auditionPageReviewSchema.shape.landmarkInventory.shape)).toEqual(['objects', 'landmarks']);
  });
  it('an unusable inventory halts the run like any unusable review: no further render, review or identity', async () => {
    const h = harness({ inventory: (step, context) => step === 'page_3_0_qa' ? { objects: [], landmarks: [] } : singleInventory(context) });
    await expect(illustrateReviewedAudition(h.args)).rejects.toThrow('audition_review_unusable');
    const pageRenders = h.args.render.mock.calls.map(c => String(c[0])).filter(s => s.startsWith('page_'));
    expect(pageRenders[pageRenders.length - 1]).toBe('page_3_0');
    expect(h.args.identity.mock.calls.some(c => String(c[0]).startsWith('page_3'))).toBe(false);
    expect(h.saved.has('halted_page_3')).toBe(true);
  });
  it('a page inventory with two strong matches holds that page through the real orchestration', async () => {
    const h = harness({ inventory: (step, context) => {
      const inv = singleInventory(context);
      if (!step.startsWith('page_4_')) return inv;
      const features = (context.checks.uniqueLandmarks as AuditionLandmark[]).find(l => l.id === 'stone')!.features, id = `o${inv.objects.length + 1}`;
      return { objects: [...inv.objects, { objectId: id, region: 'behind it', description: 'a second big pale stone' }],
        landmarks: inv.landmarks.map(e => e.landmarkId !== 'stone' ? e : { ...e, candidates: [...e.candidates,
          { objectId: id, association: 'different_object', evidence: 'no opening', featureChecks: features.map(f => ({ featureId: f.id, observed: 'matches' })) }] }) };
    } });
    const m = await illustrateReviewedAudition(h.args);
    expect(m.pages[4]).toMatchObject({ status: 'held', findings: [expect.objectContaining({ requirement: 'landmark_unique:stone', verdict: 'defect', derived: true })] });
    expect(h.prompts.get('page_4_1')).toContain('- [continuity] landmark_unique:stone: landmark inventory: 2 objects match stone');
  });
});

describe('page checks derived from the storyboard', () => {
  it('states the cross-character rule without an example taken from a book under test', () => {
    // An example copied from a known defect would hand the checker the expected answer of a validation run.
    expect(AUDITION_JUDGE_INSTRUCTIONS.page).toContain('A feature that belongs to another cast member is an identity issue.');
    expect(AUDITION_JUDGE_INSTRUCTIONS.page).not.toMatch(/button nose/i);
    expect(AUDITION_JUDGE_INSTRUCTIONS.page).toContain('compare EACH visible cast member only with ITS OWN reference and design');
  });
  it('lists unrevealed story objects (not landmarks), unique landmarks and each visible cast member with its own design', () => {
    const book = fixture(), cover = auditionPageChecks(book, 0, 'dragon with a snout');
    expect(cover.notYetRevealed.map(n => n.id)).toEqual(['cat', 'trail']);
    expect(cover.uniqueLandmarks.map(l => l.id)).toEqual(['old_tree', 'stone']);
    expect(cover.uniqueLandmarks.map(l => l.features.map(f => `${f.id} ${f.aspect}:${f.text}`))).toEqual([['f1 shape:forked'], ['f1 size:big', 'f2 colour:pale', 'f3 material:stone']]);
    expect(auditionPageChecks(book, 2, 'x').notYetRevealed.map(n => n.id)).toEqual(['cat']);
    const p3 = auditionPageChecks(book, 3, 'dragon with a snout');
    expect(p3.notYetRevealed).toEqual([]);
    expect(p3.castIdentity).toEqual([expect.objectContaining({ id: 'child' }), { id: 'companion', reference: 'canonical_companion', design: 'dragon with a snout' },
      { id: 'cat', reference: 'canonical_entities tile cat', design: 'appearance: ginger cat with a pink nose' }]);
    expect(p3.requirementIds).toEqual(expect.arrayContaining(['cast:cat', 'landmark_unique:stone', 'entity:trail', 'location:garden']));
  });
  it('uses the drawn instant when moments declare one', () => {
    const frames = Array.from({ length: 9 }, () => ({ requirements: [], depicted: null })) as any[];
    frames[4] = { requirements: [{ kind: 'avoid', subject: 'x', evidence: 'A big stone.' }],
      depicted: { evidence: 'A big stone.', relations: [{ entityId: 'trail', value: { relation: 'unestablished', targetId: null }, evidence: 'A big stone.' }], attributes: [] } };
    const checks = auditionPageChecks(fixture({ version: 'storyboard-moments/v1', frames }), 4, 'x');
    expect(checks.notYetRevealed.map(n => n.id)).toEqual(['trail']);
    expect(checks.requirementIds).toEqual(expect.arrayContaining(['drawn_instant', 'moment_requirement:0']));
  });
});

describe('orchestration (mocked reviews prove flow and selection, not model perception)', () => {
  it('renders two sheets and nine pages, stopping at the first qa_supported attempt, with approved references', async () => {
    const h = harness(), manifest = await illustrateReviewedAudition(h.args);
    expect(h.args.render.mock.calls.map(c => c[0])).toEqual(['sheet_entities_0', 'sheet_locations_0', ...Array.from({ length: 9 }, (_, n) => `page_${n}_0`)]);
    expect(manifest).toMatchObject({ status: 'qa_supported_audition', scope: { complete: true },
      sheets: { entities: { referenceStatus: 'approved_reference' }, locations: { referenceStatus: 'approved_reference' } },
      approval: expect.stringContaining('not product acceptance'), runtimeEligible: false, productionQualified: false });
    // The location sheet sees only the style references, never the object sheet.
    expect(h.args.render.mock.calls[1][2]).toEqual([image('child'), image('companion')]);
    expect(h.args.render.mock.calls[2][2]).toEqual([image('child'), image('companion'), image('sheet_entities_0'), image('sheet_locations_0')]);
    expect(h.prompts.get('page_0_0')).toContain('NOT YET IN THE STORY (must not appear, not even as tracks or marks): cat, trail');
    expect(h.contexts.get('page_3_0_qa').checks.castIdentity.map((c: any) => c.id)).toEqual(['child', 'companion', 'cat']);
  });

  it('a duplicated unique landmark keeps the page held; a different angle without it is supported (control)', async () => {
    const dup = harness({ judge: step => step.startsWith('page_4_') ? { environment: { issues: [issue('continuity', 'landmark_unique:stone', 'second stone behind the first')] } } : {} });
    const m = await illustrateReviewedAudition(dup.args);
    expect(m.pages[4]).toMatchObject({ status: 'held', chosenAttempt: 0, alternatives: [expect.objectContaining({ attempt: 1 }), expect.objectContaining({ attempt: 2 })] });
    expect(m.pages[4].findings).toEqual([expect.objectContaining({ impact: 'continuity', requirement: 'landmark_unique:stone' })]);
    expect(dup.prompts.get('page_4_1')).toContain('- [continuity] landmark_unique:stone: second stone behind the first');
    expect(m.status).toBe('held_audition_with_findings');
    const angle = harness({ judge: step => step.startsWith('page_4_') ? { framing: { issues: [issue('detail', 'framing', 'low angle hides the swing seat')] } } : {} });
    const control = await illustrateReviewedAudition(angle.args);
    expect(control.pages[4]).toMatchObject({ status: 'qa_supported', chosenAttempt: 0 });
    expect(angle.args.render.mock.calls.filter(c => String(c[0]).startsWith('page_4_'))).toHaveLength(1);
  });

  it('a feature transferred between characters is forwarded and the clean attempt wins', async () => {
    const h = harness({ judge: step => step === 'page_7_0_qa' ? { identity: { issues: [issue('identity', 'cast:companion', 'dark button nose like the hedgehog')] } } : {} });
    const m = await illustrateReviewedAudition(h.args);
    expect(h.prompts.get('page_7_1')).toContain('- [identity] cast:companion: dark button nose like the hedgehog');
    expect(m.pages[7]).toMatchObject({ status: 'qa_supported', chosenAttempt: 1 });
  });

  it('control pair: the same identity defect is held whether its citation is known or not; a miscited one is never redrawn or approved', async () => {
    const nose = (requirement: string) => ({ identity: { issues: [issue('identity', requirement, 'dark button nose like the hedgehog')] } });
    const known = harness({ judge: step => step.startsWith('page_7_') ? nose('cast:companion') : {} }), miscited = harness({ judge: step => step.startsWith('page_7_') ? nose('cast:dinI') : {} });
    const k = await illustrateReviewedAudition(known.args), m = await illustrateReviewedAudition(miscited.args);
    expect(k.pages[7]).toMatchObject({ status: 'held' });
    expect(m.pages[7]).toMatchObject({ status: 'review_invalid', chosenAttempt: 0, alternatives: [], findings: [expect.objectContaining({ impact: 'identity', bound: false })] });
    // A citation error is no reason to pay for another image or an identity measurement.
    expect(miscited.args.render.mock.calls.filter(c => String(c[0]).startsWith('page_7_'))).toHaveLength(1);
    expect(miscited.args.identity.mock.calls.some(c => String(c[0]).startsWith('page_7_'))).toBe(false);
    expect(m.status).toBe('held_audition_with_findings');
    // Resume re-derives the invalid review from its raw text; rewriting the citation to a known id does not re-bind.
    const designs = miscited.saved.get('audition_sheet_designs'), sheets = { entities: miscited.saved.get('sheet_entities') as any, locations: miscited.saved.get('sheet_locations') as any };
    const pages = Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7].map(n => [n, miscited.saved.get(`page_${n}`) as any]));
    const again = harness({ judge: step => step.startsWith('r1_page_7_') ? nose('cast:dinI') : {} });
    expect((await illustrateReviewedAudition({ ...again.args, resume: { designs, sheets, pages, stepPrefix: 'r1_' } })).pages[7]).toMatchObject({ status: 'review_invalid' });
    expect(again.args.render.mock.calls.map(c => c[0])).toEqual(['r1_page_8_0']);
    const edited = structuredClone(pages); edited[7].chosen.review.checks.find((c: any) => c.category === 'identity').issues[0].requirement = 'cast:companion';
    await expect(illustrateReviewedAudition({ ...harness().args, resume: { designs, sheets, pages: edited, stepPrefix: 'r1_' } })).rejects.toThrow('audition_resume_binding');
    // Re-judge of a saved image: the same miscited defect is review_invalid, not supported.
    const canonical = [image('child'), image('companion'), image('sheet_entities_0'), image('sheet_locations_0')];
    const refs = { entities: { image: canonical[2], status: 'approved_reference' as const, knownFlaws: [] }, locations: { image: canonical[3], status: 'approved_reference' as const, knownFlaws: [] } };
    const rj = harness({ judge: () => nose('cast:dinI') });
    const [r] = await rejudgeAudition({ book: fixture(), rawReview: {}, current: rj.args.current, companionDescription: 'x', canonical, references: refs,
      frames: [{ pageNumber: 7, candidate: image('page_7_0'), predecessor: null, label: 'saved p7' }], judge: rj.args.judge, check: vi.fn(), save: vi.fn() });
    expect(r).toMatchObject({ status: 'review_invalid', assessment: { counts: { identity: 1, detail: 0 }, invalidCitations: 1 } });
    // Sheets: a miscited continuity defect is a diagnostic candidate that keeps the flaw visible to every page.
    const sheet = harness({ judge: step => step.startsWith('sheet_locations_') ? { environment: { issues: [issue('continuity', 'landmark_unique:rock', 'two burrow rocks')] } } : {} });
    const s = await illustrateReviewedAudition(sheet.args);
    expect(s.sheets.locations).toMatchObject({ status: 'review_invalid', referenceStatus: 'diagnostic_candidate', chosenAttempt: 0 });
    expect(sheet.args.render.mock.calls.filter(c => String(c[0]).startsWith('sheet_locations_'))).toHaveLength(1);
    expect(sheet.contexts.get('page_2_0_qa').referenceStatus.locations).toMatchObject({ status: 'diagnostic_candidate',
      knownFlaws: [expect.objectContaining({ note: 'two burrow rocks', bound: false })] });
    expect(sheet.prompts.get('page_2_0')).toContain('Image 4 is a DIAGNOSTIC candidate with known flaws');
    expect(s.status).toBe('held_audition_with_findings');
  });

  it('a story finding outranks continuity and detail; complete ties keep the earliest attempt', async () => {
    const h = harness({ judge: step => step.startsWith('page_1_0') || step.startsWith('page_1_2') ? { scene: { issues: [issue('story', 'page_text', 'the clue is missing')] }, framing: { issues: [issue('detail', 'framing', 'tiny ratio note')] } }
      : step.startsWith('page_1_1') ? { environment: { issues: [issue('continuity', 'landmark_unique:stone')] }, framing: { issues: [issue('detail', 'framing'), issue('detail', 'framing')] } }
        : step.startsWith('page_5_') ? { environment: { issues: [issue('continuity', 'landmark_unique:old_tree')] } } : {} });
    const m = await illustrateReviewedAudition(h.args);
    expect(m.pages[1]).toMatchObject({ chosenAttempt: 1, status: 'held' });
    expect(m.pages[5]).toMatchObject({ chosenAttempt: 0, status: 'held' });
    expect(h.prompts.get('page_1_1')).toContain('- [story] page_text: the clue is missing');
    expect(h.prompts.get('page_1_1')).not.toContain('tiny ratio note');
  });

  it('never selects a safety-uncertain image: no eligible attempt stops the run before identity is measured', async () => {
    const h = harness({ judge: step => step.startsWith('page_3_') ? { safety: { verdict: 'uncertain', issues: [issue('safety', 'safety')] } } : {} });
    await expect(illustrateReviewedAudition(h.args)).rejects.toThrow('audition_page_3_unavailable');
    expect(h.args.identity.mock.calls.some(c => String(c[0]).startsWith('page_3'))).toBe(false);
  });

  it('repairs a flawed sheet in place, and a still-flawed sheet is labelled a diagnostic candidate for every page', async () => {
    const h = harness({ judge: step => step === 'sheet_entities_0_qa' ? { props: { issues: [issue('continuity', 'design:trail', 'trail drawn as pebbles')] } }
      : step.startsWith('sheet_locations_') ? { environment: { issues: [issue('continuity', 'landmark_unique:stone', 'bench has two slats')] } } : {} });
    const m = await illustrateReviewedAudition(h.args);
    const repair = h.args.render.mock.calls.find(c => c[0] === 'sheet_entities_1')!;
    expect(repair[2]).toEqual([image('sheet_entities_0'), image('child'), image('companion')]);
    expect(repair[4]).toEqual(['rejected_edit_target', 'child_design_authority', 'companion_design_authority']);
    expect(repair[1]).toContain('- [continuity] design:trail: trail drawn as pebbles');
    expect(m.sheets.entities).toMatchObject({ referenceStatus: 'approved_reference', chosenAttempt: 1 });
    expect(m.sheets.locations).toMatchObject({ referenceStatus: 'diagnostic_candidate', status: 'held' });
    expect(h.prompts.get('page_2_0')).toContain('Image 4 is a DIAGNOSTIC candidate with known flaws');
    expect(h.contexts.get('page_2_0_qa').referenceStatus.locations).toMatchObject({ status: 'diagnostic_candidate', knownFlaws: [expect.objectContaining({ note: 'bench has two slats' })] });
    expect(m.pages.every(p => p.status === 'qa_supported')).toBe(true);
    expect(m.status).toBe('held_audition_with_findings');
  });

  it('renders a bounded sample and compares only with a predecessor rendered in the same run', async () => {
    const h = harness({ pages: [0, 1, 3, 6, 5] }), m = await illustrateReviewedAudition(h.args);
    expect(m.pages.map(p => p.pageNumber)).toEqual([0, 1, 3, 5, 6]);
    expect(m).toMatchObject({ status: 'qa_supported_sample', scope: { frames: [0, 1, 3, 5, 6], complete: false } });
    const predecessors = h.args.judge.mock.calls.filter(c => String(c[0]).startsWith('page_')).map(c => c[5]?.imageName ?? null);
    expect(predecessors).toEqual([null, null, null, null, 'page_5_0.png']);
    await expect(illustrateReviewedAudition(harness({ pages: [9] }).args)).rejects.toThrow('audition_page_scope');
  });

  it('a provider glitch loses one attempt; spending, unknown cost, repeated failure and cancellation end the run', async () => {
    const glitch = harness({ renderFail: step => step === 'page_2_0' ? Object.assign(new Error('x'), { code: 'audition_image_provider_failed' }) : null });
    const m = await illustrateReviewedAudition(glitch.args);
    expect(m.pages[2]).toMatchObject({ chosenAttempt: 1, alternatives: [expect.objectContaining({ status: 'unavailable', error: 'audition_image_provider_failed' })] });
    for (const code of ['audition_budget_exhausted', 'audition_unknown_cost', 'audition_repeated_failure', 'audition_cancelled']) {
      const h = harness({ renderFail: step => step === 'page_2_0' ? new ReviewedAuditionError(code) : null });
      await expect(illustrateReviewedAudition(h.args)).rejects.toThrow(code);
    }
  });

  it('unknown identity evidence (evidence_unknown or a thrown call) halts before any next render; a measured 0.69 still retries', async () => {
    const unknown = { ...identity(.5), status: 'evidence_unknown' as const, reasonCode: 'malformed' as const, resemblanceScore: null, subjectVisible: null, sameChild: null };
    for (const fault of ['evidence_unknown', 'thrown'] as const) {
      const h = harness();
      const measure = h.args.identity.getMockImplementation()!;
      h.args.identity.mockImplementation(async (...a: Parameters<typeof measure>) => {
        if (a[0] !== 'page_1_0_identity') return measure(...a);
        if (fault === 'thrown') throw new Error('socket');
        return unknown;
      });
      await expect(illustrateReviewedAudition(h.args)).rejects.toThrow('audition_identity_unusable');
      expect(h.args.render.mock.calls.map(c => String(c[0])).filter(s => s.startsWith('page_1_') || s.startsWith('page_2_'))).toEqual(['page_1_0']);
      expect(h.args.judge.mock.calls.some(c => String(c[0]).startsWith('page_1_1') || String(c[0]).startsWith('page_2_'))).toBe(false);
      expect(h.args.identity.mock.calls.map(c => String(c[0])).filter(s => !s.startsWith('page_0_'))).toEqual(['page_1_0_identity']);
      // The candidate and the original result are kept; a null measurement is never a score of 0.
      expect(h.saved.get('halted_page_1')).toMatchObject({ error: fault === 'thrown' ? 'audition_attempt_failed' : 'identity_evidence_unknown_malformed',
        attempts: [expect.objectContaining({ status: 'identity_unusable', candidate: image('page_1_0'), identity: fault === 'thrown' ? null : unknown })] });
      expect(h.saved.has('page_1')).toBe(false);
    }
    // A valid measured 0.69 is a visual finding: the bounded correction draws again and a measured 0.82 is supported.
    const low = harness({ score: step => step === 'page_1_0_identity' ? .69 : .82 });
    const m = await illustrateReviewedAudition(low.args);
    expect(m.pages[1]).toMatchObject({ status: 'qa_supported', chosenAttempt: 1, identityScore: .82 });
    expect(low.prompts.get('page_1_1')).toContain('cast:child');
    // A saved page whose measured attempt carries unknown identity evidence is never trusted on resume.
    const designs = low.saved.get('audition_sheet_designs'), sheets = { entities: low.saved.get('sheet_entities') as any, locations: low.saved.get('sheet_locations') as any };
    const pages = Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => [n, low.saved.get(`page_${n}`) as any]));
    expect((await illustrateReviewedAudition({ ...harness().args, resume: { designs, sheets, pages, stepPrefix: 'r1_' } })).pages[1]).toMatchObject({ status: 'qa_supported' });
    const forged = structuredClone(pages); forged[1].attempts[0].identity = unknown;
    await expect(illustrateReviewedAudition({ ...harness().args, resume: { designs, sheets, pages: forged, stepPrefix: 'r1_' } })).rejects.toThrow('audition_resume_binding');
  });

  it('an unusable review (malformed even at a known cost, or misbound) halts the run: no further render, review or identity call', async () => {
    const root = path.join(mkdtempSync(path.join(tmpdir(), 'audition-unusable-')), 'paid');
    const meter = new AuditionMeter(root, 9000000, AUDITION_WORST_CASE_CALLS, 1000000);
    const wrap = <T>(step: string, work: () => Promise<T>) => meter.run(step, { step }, 1000, async () => {
      if (step.startsWith('page_1_') && step.endsWith('_qa')) throw Object.assign(new ReviewedAuditionError('audition_pixel_schema'), { receipt: { estimatedMicroUsd: 7 } });
      return { value: await work(), estimatedMicroUsd: 10, receipt: {} };
    });
    const h = harness({ wrap });
    await expect(illustrateReviewedAudition(h.args)).rejects.toThrow('audition_review_unusable');
    const page1 = h.args.render.mock.calls.map(c => String(c[0])).filter(s => s.startsWith('page_1_'));
    expect(page1).toEqual(['page_1_0']);
    expect(h.args.render.mock.calls.some(c => String(c[0]).startsWith('page_2_'))).toBe(false);
    expect(h.args.identity.mock.calls.some(c => String(c[0]).startsWith('page_1_'))).toBe(false);
    // The paid receipt and the candidate are kept; the failed call stays counted.
    expect(readdirSync(root).filter(n => n.startsWith('page_1_0_qa.')).sort()).toEqual(['page_1_0_qa.claim.json', 'page_1_0_qa.failure.json', 'page_1_0_qa.result.json', 'page_1_0_qa.wire.json']);
    expect(meter.snapshot()).toMatchObject({ failed: 1, newKnownApiMicroUsd: 7 + 10 * (2 * 2 + 3 + 1) });
    expect(h.saved.get('halted_page_1')).toMatchObject({ error: 'audition_pixel_schema', attempts: [expect.objectContaining({ status: 'review_unusable', candidate: image('page_1_0') })] });
    expect(h.saved.has('page_1')).toBe(false);
    // A misbound review (wrong candidate) or an incomplete issue list is equally unusable, on sheets too.
    const misbound = harness();
    misbound.args.judge.mockImplementation(async (step: string, _c: unknown, _ctx: unknown, contextSha: string) => review(sha('other'), contextSha, {}));
    await expect(illustrateReviewedAudition(misbound.args)).rejects.toThrow('audition_review_unusable');
    expect(misbound.args.render.mock.calls.map(c => c[0])).toEqual(['sheet_entities_0']);
    // Valid critical findings still drive the bounded correction (see the transferred-feature test); a judge transport glitch only costs its attempt.
    const glitch = harness();
    const judge = glitch.args.judge.getMockImplementation()!;
    glitch.args.judge.mockImplementation(async (...a: Parameters<typeof judge>) => { if (a[0] === 'page_2_0_qa') throw new Error('socket'); return judge(...a); });
    const g = await illustrateReviewedAudition(glitch.args);
    expect(g.pages[2]).toMatchObject({ chosenAttempt: 1, alternatives: [expect.objectContaining({ status: 'unavailable', error: 'audition_attempt_failed' })] });
  });

  it('fits the worst case (every candidate uses every attempt) inside the meter envelope, and resumes without paying again', async () => {
    const root = path.join(mkdtempSync(path.join(tmpdir(), 'audition-envelope-')), 'paid');
    const meter = new AuditionMeter(root, 9000000, AUDITION_WORST_CASE_CALLS, 1000000);
    const wrap = <T>(step: string, work: () => Promise<T>) => meter.run(step, { step }, 1000, async () => ({ value: await work(), estimatedMicroUsd: 10, receipt: {} }));
    const always = (step: string): Spec => step.startsWith('sheet_') ? { props: { issues: [issue('continuity', 'sheet_scope')] } } : { environment: { issues: [issue('continuity', 'landmark_unique:stone')] } };
    const h = harness({ wrap, judge: always }), m = await illustrateReviewedAudition(h.args);
    expect(meter.snapshot()).toMatchObject({ calls: AUDITION_WORST_CASE_CALLS, newKnownApiMicroUsd: 10 * AUDITION_WORST_CASE_CALLS, unknownCost: 0, failed: 0 });
    expect(m.pages.every(p => p.status === 'held')).toBe(true);
    // Resume: every saved page re-binds from its raw reviews; only missing pages are paid for.
    const designs = h.saved.get('audition_sheet_designs'), sheets = { entities: h.saved.get('sheet_entities') as any, locations: h.saved.get('sheet_locations') as any };
    const pages = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(n => [n, h.saved.get(`page_${n}`) as any]));
    const again = harness({ judge: always });
    const resumed = await illustrateReviewedAudition({ ...again.args, resume: { designs, sheets, pages, stepPrefix: 'r1_' } });
    expect(again.args.render.mock.calls.map(c => c[0])).toEqual(['r1_page_7_0', 'r1_page_7_1', 'r1_page_7_2', 'r1_page_8_0', 'r1_page_8_1', 'r1_page_8_2']);
    expect(resumed.pages.map(p => p.pageNumber)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    const tampered = structuredClone(pages); tampered[4].chosen.review.checks.find((c: any) => c.category === 'environment').issues[0].impact = 'detail';
    await expect(illustrateReviewedAudition({ ...harness({ judge: always }).args, resume: { designs, sheets, pages: tampered, stepPrefix: 'r1_' } })).rejects.toThrow('audition_resume_binding');
    const edited = structuredClone(pages); edited[2].attempts[1].review.checks.find((c: any) => c.category === 'environment').issues[0].impact = 'detail';
    await expect(illustrateReviewedAudition({ ...harness({ judge: always }).args, resume: { designs, sheets, pages: edited, stepPrefix: 'r1_' } })).rejects.toThrow('audition_resume_binding');
    await expect(illustrateReviewedAudition({ ...harness({ judge: always }).args, resume: { designs, sheets, pages, stepPrefix: 'page_' } })).rejects.toThrow('audition_resume_binding');
  }, 30000);

  it('publishes statuses, impact-labelled findings and rejected alternatives in the owner HTML', async () => {
    const h = harness({ judge: step => step.startsWith('page_1_') ? { scene: { issues: [issue('story', 'page_text', 'clue <b> shown early')] } } : {} });
    const m = await illustrateReviewedAudition(h.args);
    const html = reviewedAuditionHTML(m, { title: 'A <b> title', pages: texts.map(text => ({ text })) }, (i, size) => `data:${size}:${i.imageName}`);
    expect(html).toContain('A &lt;b&gt; title');
    expect(html).toContain('פגיעה בסיפור');
    expect(html).toContain('clue &lt;b&gt; shown early');
    expect(html).toContain('data:thumb:page_1_1.png');
    expect(html).toContain('לא אישור מוצר');
  });
});

describe('cumulative, fail-closed meter and spend grant', () => {
  const meterIn = (cap = 4000000, prior = 3400000, maxCalls = 10) =>
    new AuditionMeter(path.join(mkdtempSync(path.join(tmpdir(), 'audition-meter-')), 'paid'), cap, maxCalls, prior);
  it('counts the inherited ledger and refuses a reservation that would cross the cumulative cap', async () => {
    const meter = meterIn();
    expect(await meter.run('a', { a: 1 }, 500000, async () => ({ value: 1, estimatedMicroUsd: 40000, receipt: {} }))).toBe(1);
    expect(meter.snapshot()).toMatchObject({ priorKnownApiMicroUsd: 3400000, newKnownApiMicroUsd: 40000, cumulativeAccountedMicroUsd: 3440000 });
    const dispatch = vi.fn();
    await expect(meter.run('b', { b: 1 }, 600000, dispatch)).rejects.toThrow('audition_budget_exhausted');
    expect(dispatch).not.toHaveBeenCalled();
    expect(() => meterIn(12000000, 3000000)).toThrow('audition_meter_policy');
    expect(() => meterIn(3000000, 3000000)).toThrow('audition_meter_policy');
  });
  it('stops after an unknown cost or an unknown outcome instead of hiding it behind a reservation', async () => {
    const meter = meterIn();
    await expect(meter.run('a', {}, 1000, async () => ({ value: 1, estimatedMicroUsd: null, receipt: {} }))).rejects.toThrow('audition_unknown_cost');
    await expect(meter.run('b', {}, 1000, async () => ({ value: 1, estimatedMicroUsd: 1, receipt: {} }))).rejects.toThrow('audition_unknown_cost');
    const pending = meterIn();
    await pending.run('a', {}, 1000, async () => ({ value: 1, estimatedMicroUsd: 1, receipt: {} }));
    unlinkSync(path.join(pending.root, 'a.result.json'));
    expect(pending.snapshot()).toMatchObject({ unknownOutcome: 1 });
    await expect(pending.run('b', {}, 1000, async () => ({ value: 1, estimatedMicroUsd: 1, receipt: {} }))).rejects.toThrow('audition_unknown_cost');
  });
  it('allows one failed call but stops after two consecutive failures', async () => {
    const meter = meterIn(), boom = async () => { throw Object.assign(new Error('x'), { receipt: { estimatedMicroUsd: 5 } }); };
    await expect(meter.run('a', {}, 1000, boom)).rejects.toThrow('x');
    await meter.run('b', {}, 1000, async () => ({ value: 1, estimatedMicroUsd: 5, receipt: {} }));
    await expect(meter.run('c', {}, 1000, boom)).rejects.toThrow('x');
    await expect(meter.run('d', {}, 1000, boom)).rejects.toThrow('x');
    const dispatch = vi.fn();
    await expect(meter.run('e', {}, 1000, dispatch)).rejects.toThrow('audition_repeated_failure');
    expect(dispatch).not.toHaveBeenCalled();
    expect(readdirSync(meter.root).filter(n => n.startsWith('e.'))).toEqual([]);
  });
  it('two failures of one stage stop the run even when another stage succeeded in between', async () => {
    const meter = meterIn(), boom = async () => { throw Object.assign(new Error('x'), { receipt: { estimatedMicroUsd: 5 } }); };
    const ok = async () => ({ value: 1, estimatedMicroUsd: 5, receipt: {} });
    await expect(meter.run('page_1_0_qa', {}, 1000, boom)).rejects.toThrow('x');
    await meter.run('page_1_1', {}, 1000, ok);
    expect(meter.snapshot().repeatedFailure).toBe(false);
    await expect(meter.run('page_1_1_qa', {}, 1000, boom)).rejects.toThrow('x');
    expect(meter.snapshot()).toMatchObject({ repeatedFailure: true, failed: 2, newKnownApiMicroUsd: 15 });
    await expect(meter.run('page_1_2', {}, 1000, ok)).rejects.toThrow('audition_repeated_failure');
  });
  it('binds a grant to the book, its evidence hashes and a bounded cumulative cap', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'audition-grant-')), evidence = path.join(dir, 'spend.json');
    writeFileSync(evidence, '{"newKnownApiMicroUsd":3484122}');
    const book = { requestId: sha('r'), storyboardDigest: sha('b') };
    const grant = { version: 'audition-spend-grant/v1', approvalReference: 'Guy approved a priced four-frame LOW sample on 2026-10-10 (example)',
      book, ledger: { priorKnownApiMicroUsd: 3484122, evidence: [{ file: evidence, sha256: sha('{"newKnownApiMicroUsd":3484122}') }], note: 'first audition run API estimate' },
      capMicroUsd: 5000000, maxCalls: 40, scope: { mode: 'render', pages: [0, 1, 3, 6] },
      claudeMax: 'Claude Max usage is separate: not an API invoice, not $0 and not included in this ledger' };
    const file = path.join(dir, 'grant.json'), write = (g: unknown) => { writeFileSync(file, JSON.stringify(g)); return file; };
    expect(readAuditionGrant(write(grant), book).grant.capMicroUsd).toBe(5000000);
    expect(() => readAuditionGrant(write(grant), { ...book, storyboardDigest: sha('other') })).toThrow('audition_grant_book');
    expect(() => readAuditionGrant(write({ ...grant, ledger: { ...grant.ledger, evidence: [{ file: evidence, sha256: sha('x') }] } }), book)).toThrow('audition_grant_evidence');
    expect(() => readAuditionGrant(write({ ...grant, capMicroUsd: 3000000 }), book)).toThrow('audition_grant_cap');
    expect(() => readAuditionGrant(write({ ...grant, claudeMax: 'free' }), book)).toThrow();
  });
});
