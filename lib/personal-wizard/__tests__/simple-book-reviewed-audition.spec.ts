import type { SavedSheet } from '../simple-book-reviewed-audition';
import { companionScaleAuthority } from '../companion-scale-authority';
import type { ScaleEvidence } from '../companion-scale';
import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
vi.mock('../storyboard', () => ({
  // A fifth argument (the owner's acceptance) is named in the packet, as the real frame does; four arguments give the exact packet as before.
  currentPersonalStoryboardFrame: (...a: unknown[]) =>
    ({ context: { pageNumber: a[2], ...(a.length > 4 ? { ownerAcceptance: a[4] } : {}) }, render: { prompt: `PAGE ${a[2]}` } }),
}));
import { QUALITY_CATEGORIES } from '../../local-preview-quality';
import type { PageChildResemblanceVisionResult } from '../../generation-pipeline/page-child-resemblance-vision';
import type { PersonalStoryboard } from '../storyboard';
import { auditionSheetDesigns, auditionSheetPrompt, illustrateReviewedAudition, rejudgeAudition, assessAuditionReview, attemptStatus, selectAuditionAttempt,
  auditionPageChecks, reviewedAuditionHTML, AUDITION_WORST_CASE_CALLS, AUDITION_JUDGE_INSTRUCTIONS, ReviewedAuditionError, auditionPageReviewSchema,
  auditionCorrections, landmarkFeatureCatalogue, assessLandmarkInventory, type AuditionAttempt, type AuditionLandmark, type LandmarkAspect,
  sheetRepairPrompt, sheetRequirementIds, sheetScaleLineup, auditionJudgeInstruction, reviewedAuditionPolicy, REVIEWED_AUDITION_POLICY, SCALE_LINEUP_AUDITION_POLICY,
  AUDITION_SCALE_LINEUP_VERSION, AUDITION_SHEET_JUDGE_INSTRUCTION, AUDITION_SCALE_LINEUP_SHEET_JUDGE_INSTRUCTION, AUDITION_PAGE_SUFFIX,
  AUDITION_SCALE_LINEUP_PAGE_SUFFIX, AUDITION_ATTEMPT_INTERRUPTED, AUDITION_FULL_BOOK_DIAGNOSTIC_VERSION, REFERENCE_QUALIFICATION_VERSION,
  INSTANCE_JUDGE_RULES, auditionInstanceDistinction } from '../simple-book-reviewed-audition';
import { INSTANCE_DISTINCTION_VERSION } from '../storyboard-instance-distinction';
import { NATIVE_BOOK_CONTINUITY_VERSION } from '../engine-continuity-contracts';
import { COMPANION_SCALE_SAMPLE_GATE } from '../companion-scale';
import { runNativePageProofFrames, preflightNativePageProofFrames } from '../native-page-proof-frames';
import { runTrialAudition, trialBookVisualQualification, trialDrawnFrames, writeTrialReader } from '../../../scripts/personal-book-e2e-trial';
import { AuditionMeter, readAuditionGrant, auditionMeterRules, auditionRenderRule, auditionReviewRule, auditionIdentityRule, auditionJudgePayload,
  readReusedSheets, interruptedAttempts, conservativeDebitOf, rereviewAllowance, runReviewedAudition, auditionAdapters, auditionRenderPlan,
  type ConservativeDebit } from '../../../scripts/personal-simple-book-reviewed-audition';
import { AUDITION_REREVIEW_VERSION, AUDITION_CALIBRATION_VERSION, LANDMARK_DESIGN_HEAD_VERSION, LANDMARK_TOPOLOGY_VERSION, auditionPageContext,
  AUDITION_TOPOLOGY_CONTINUATION_VERSION, calibrationRequalificationParent,
  AUDITION_COVERAGE_CONTINUATION_VERSION, LANDMARK_COVERAGE_TOPOLOGY_VERSION, topologyRequalificationParent,
  type AuditionCoverageContinuation, type SavedTopologyContinuation, type AuditionTopologyContinuation,
  type SavedRereview, type SavedPage, type AuditionCalibration, type SavedCalibration } from '../simple-book-reviewed-audition';
import { previewSha } from '../../local-story-preview';
import sharp from 'sharp';
import { LANDMARK_KIND_CONTRACT_VERSION } from '../storyboard-landmark-kind';
import { canonicalJson } from '../request-acceptance';
import { AUDITION_ANATOMY_VERSION, AUDITION_LOCAL_ANATOMY_REPAIR_VERSION } from '../audition-anatomy';
import { auditionLocalAnatomyRepairPlan, repairReviewedAuditionPage } from '../simple-book-reviewed-audition';
import { planGPTImageRequest } from '../../generate-image';
import { sceneRepairStops } from '../../../scripts/personal-fresh-book-scene-repair';
import { assertAnatomyClarityRawPrior } from '../../../scripts/personal-fresh-book-anatomy-clarity';

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
  inventory?: (step: string, context: any) => unknown; topology?: true; coverage?: true;
  anatomy?: (step: string, context: any, normal: any) => unknown } = {}) {
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
      const inventory = kind === 'page' ? opts.inventory?.(step, context) ?? singleInventory(context) : null;
      if ((opts.topology || opts.coverage) && inventory) for (const l of (inventory as any).landmarks) {
        const own = l.candidates[0], features = (context as any).checks.uniqueLandmarks.find((x: any) => x.id === l.landmarkId).features;
        l.candidates = (inventory as any).objects.map((o: any) => o.objectId === own.objectId ? own : {
          objectId: o.objectId, association: 'different_object', evidence: 'visible incompatible canonical kind',
          featureChecks: features.map((f: any) => ({ featureId: f.id, observed: f.aspect === 'kind' ? 'contradicted' : 'not_visible' })),
        });
      }
      if (opts.coverage && inventory) (inventory as any).objects.forEach((o: any) => o.quadrants = ['top_left']);
      const typed = (opts.topology || opts.coverage) && inventory ? { ...(inventory as any), topology: {
        version: opts.coverage ? LANDMARK_COVERAGE_TOPOLOGY_VERSION : LANDMARK_TOPOLOGY_VERSION,
        relations: (inventory as any).objects.flatMap((o: any, i: number, list: any[]) => list.slice(i + 1).map(p => ({
          from: o.objectId, to: p.objectId, relation: 'separate_objects', basis: 'visible_separation', evidence: 'visible separate physical objects' }))),
        bindings: (inventory as any).landmarks.flatMap((l: any) => l.candidates.map((c: any) => ({ landmarkId: l.landmarkId,
          objectId: c.objectId, extent: c.association === 'different_object' ? 'not_instance' : 'whole_instance', sourceKind: (context as any).checks.uniqueLandmarks
            .find((x: any) => x.id === l.landmarkId).features.find((f: any) => f.aspect === 'kind').text,
          evidence: 'actual source-kind whole visible in the synthetic observation' }))),
        ...(opts.coverage ? { coverage: { version: 'landmark-candidate-coverage/v1', populations: [],
          scans: ['top_left', 'top_right', 'bottom_left', 'bottom_right'].map(quadrant => ({ quadrant, status: 'complete',
            unresolvedReason: 'none', uncertainLandmarkIds: [], populationIds: [],
            objectIds: quadrant === 'top_left' ? (inventory as any).objects.map((o: any) => o.objectId) : [],
            evidence: 'synthetic complete quadrant witness, not pixel proof' })) } } : {}),
      } } : inventory;
      const anatomy = (context as any).anatomy ? {
        version: AUDITION_ANATOMY_VERSION, actors: (context as any).anatomy.castIds.map((actorId: string) => ({ actorId,
          region: 'synthetic actor body, not pixel proof', limbs: { part: 'limbs', condition: 'intact', expectedTotal: 4,
            expectationBasis: 'canonical_design', expectationEvidence: 'Synthetic four-limbed design', visibleDistinct: 3,
            unseen: 'occluded', evidence: 'Three attached paths; fourth naturally hidden', correction: '' }, otherParts: [] })) } : undefined;
      return { ...review(candidate.imageSha, contextSha, opts.judge?.(step) ?? {}),
        ...(kind === 'page' ? { landmarkInventory: typed } : {}),
        ...(anatomy ? { anatomy: opts.anatomy ? opts.anatomy(step, context, anatomy) : anatomy } : {}) };
    })),
    identity: vi.fn((step: string) => wrap(step, async () => identity(opts.score?.(step) ?? .82))),
    check: vi.fn(), save: (name: string, value: unknown) => { saved.set(name, JSON.parse(JSON.stringify(value))); },
  };
  return { args, prompts, saved, contexts };
}

describe('fresh full-cohort trial',()=>{
  const cohort='audition-fresh-cohort/v1' as const;
  const settings={pageAttempts:1,structuralAnatomy:true as const,landmarkTopology:LANDMARK_COVERAGE_TOPOLOGY_VERSION,freshCohort:cohort};
  it('renders all nine body-first/cover-last before the first page review, retains material HOLD',async()=>{
    const h=harness({book:typedFixture(),coverage:true,judge:()=>({environment:{issues:[issue('continuity','visual_language')]}})}),events:string[]=[];
    const result=await illustrateReviewedAudition({...h.args,...settings,
      render:async(step,...rest)=>{events.push(`draw:${step}`);return h.args.render(step,...rest);},
      judge:async(step,...rest)=>{events.push(`judge:${step}`);return h.args.judge(step,...rest);}});
    const before=events.slice(0,events.findIndex(e=>e.startsWith('judge:page_')));
    expect(before.filter(e=>e.startsWith('draw:page_'))).toEqual([...Array.from({length:8},(_,i)=>`draw:page_${i+1}_0`),'draw:page_0_0']);
    expect(result.pages).toHaveLength(9);expect(result.pages.every(p=>p.status==='held')).toBe(true);
    expect(result.status).toBe('diagnostic_audition');expect(result.runtimeEligible).toBe(false);
    expect(result.freshCohort?.version).toBe(cohort);
  });
  it('detail-only notes do not block any of the nine pages or cause retries',async()=>{
    const h=harness({book:typedFixture(),coverage:true,judge:()=>({environment:{issues:[issue('detail','visual_language')]}})});
    const result=await illustrateReviewedAudition({...h.args,...settings});
    expect(result.pages).toHaveLength(9);expect(result.pages.every(p=>p.status==='qa_supported')).toBe(true);
    expect(h.args.render.mock.calls.filter(c=>c[0].startsWith('page_'))).toHaveLength(9);
  });
  it.each([{sample:[1,2]}, {pages:[1,2]}, {pageAttempts:2}, {resume:{}}, {structuralAnatomy:undefined}])(
    'refuses incompatible cohort scope before a provider callback: %j',async extra=>{
      const h=harness({book:typedFixture(),coverage:true});await expect(illustrateReviewedAudition({...h.args,...settings,...extra} as any))
        .rejects.toThrow('audition_fresh_cohort_scope');expect(h.args.render).not.toHaveBeenCalled();expect(h.args.judge).not.toHaveBeenCalled();
    });
  it('an unusable first page review keeps all nine already drawn candidates, never turns them PASS',async()=>{
    const h=harness({book:typedFixture(),coverage:true});await expect(illustrateReviewedAudition({...h.args,...settings,
      judge:async(step,...rest)=>step.startsWith('page_')?{} as any:h.args.judge(step,...rest)})).rejects.toThrow('audition_review_unusable');
    expect(h.args.render.mock.calls.filter(c=>c[0].startsWith('page_'))).toHaveLength(9);
    expect([...h.saved.keys()].filter(k=>k.startsWith('diagnostic_render_'))).toHaveLength(9);
    expect(h.saved.has('reviewed_audition_manifest')).toBe(false);
  });
  it.each(['defect','uncertain'] as const)('material-scene opt-in repairs only a bound positive defect (%s)',async verdict=>{
    const h=harness({book:typedFixture(),coverage:true,pages:[1],judge:step=>step.startsWith('page_')?{environment:{verdict,issues:[issue('continuity','visual_language')]}}:{}});
    await illustrateReviewedAudition({...h.args,pageAttempts:1,structuralAnatomy:true,landmarkTopology:LANDMARK_COVERAGE_TOPOLOGY_VERSION});
    const page=h.saved.get('page_1') as SavedPage,context=h.contexts.get('page_1_0_qa'),canonical=context.references;
    const before=h.args.render.mock.calls.length;
    const fixed=await repairReviewedAuditionPage({page:1,prefix:'r1_',consumedAttemptsBefore:1,prior:page.chosen,context,contextSha:page.contextSha,
      canonical,predecessor:null,check:h.args.check,render:h.args.render,judge:h.args.judge,identity:h.args.identity,save:h.args.save,materialScene:true});
    if(verdict==='uncertain'){expect(fixed.corrected).toBeNull();expect(h.args.render.mock.calls.length).toBe(before);}
    else{expect(fixed.corrected?.status).toBe('qa_supported');expect(fixed.corrected?.sceneRepair?.version).toBe('audition-local-material-scene/v1');
      const call=h.args.render.mock.calls[h.args.render.mock.calls.length-1]!;expect(call[3]).toBe('book_scene_edit');expect((call[2] as any[])[0]).toEqual(page.chosen.candidate);
      expect(h.args.identity.mock.calls[h.args.identity.mock.calls.length-1]?.[0]).toBe('r1_page_1_1_identity');}
  });
});

describe('reference-qualification/v1: pages are conditioned only on approved references', () => {
  const on = { referenceQualification: REFERENCE_QUALIFICATION_VERSION };
  const heldEntities = (step: string): Spec => step.startsWith('sheet_entities_') ? { props: { issues: [issue('continuity', 'design:trail', 'trail drawn as pebbles')] } } : {};
  const heldLocations = (step: string): Spec => step.startsWith('sheet_locations_') ? { environment: { issues: [issue('continuity', 'landmark_unique:stone', 'bench has two slats')] } } : {};
  // Every page-level provider callback (render, review, identity), with or without a resume prefix.
  const pageCalls = (h: ReturnType<typeof harness>) => [h.args.render, h.args.judge, h.args.identity]
    .flatMap(f => f.mock.calls.map(c => String(c[0]))).filter(s => /(^|_)page_\d/.test(s));
  const pageRecords = (h: ReturnType<typeof harness>) => [...h.saved.keys()].filter(k => /^(page_|diagnostic_render_|halted_)/.test(k) || k === 'reviewed_audition_manifest');

  it.each([['entities', heldEntities], ['locations', heldLocations]] as const)(
    'a %s sheet still held after its bounded repair stops the run before any page call', async (role, judge) => {
      const h = harness({ judge });
      await expect(illustrateReviewedAudition({ ...h.args, ...on })).rejects.toThrow('audition_reference_unqualified');
      // The bounded repair ran in full; the held sheet stays saved as evidence.
      expect(h.args.render.mock.calls.filter(c => String(c[0]).startsWith(`sheet_${role}_`))).toHaveLength(REVIEWED_AUDITION_POLICY.sheetAttempts);
      expect(h.saved.get(`sheet_${role}`)).toMatchObject({ status: 'held' });
      expect(pageCalls(h)).toEqual([]); expect(pageRecords(h)).toEqual([]);
    });
  it('without the flag the same held sheet stays a diagnostic candidate for every page, exactly as before', async () => {
    const h = harness({ judge: heldLocations }), m = await illustrateReviewedAudition(h.args);
    expect(m.sheets.locations).toMatchObject({ referenceStatus: 'diagnostic_candidate', status: 'held' });
    expect(m.pages).toHaveLength(9); expect(h.contexts.get('page_2_0_qa').referenceStatus.locations.status).toBe('diagnostic_candidate');
  });
  it('approved references (one only after its in-place repair): the run is identical to the same run without the flag', async () => {
    const judge = (step: string): Spec => step === 'sheet_entities_0_qa' ? { props: { issues: [issue('continuity', 'design:trail', 'trail drawn as pebbles')] } } : {};
    const a = harness({ judge }), b = harness({ judge });
    const ma = await illustrateReviewedAudition({ ...a.args, ...on }), mb = await illustrateReviewedAudition(b.args);
    expect(ma.sheets.entities).toMatchObject({ referenceStatus: 'approved_reference', chosenAttempt: 1 });
    expect(ma.pages).toHaveLength(9);
    expect(JSON.stringify(ma)).toBe(JSON.stringify(mb)); expect(JSON.stringify([...a.saved])).toBe(JSON.stringify([...b.saved]));
    expect(JSON.stringify([...a.contexts])).toBe(JSON.stringify([...b.contexts]));
    for (const f of ['render', 'judge', 'identity'] as const) expect(JSON.stringify(a.args[f].mock.calls)).toBe(JSON.stringify(b.args[f].mock.calls));
  });
  it('the fresh full cohort draws no page from a held reference', async () => {
    const h = harness({ book: typedFixture(), coverage: true, judge: heldLocations });
    await expect(illustrateReviewedAudition({ ...h.args, ...on, pageAttempts: 1, structuralAnatomy: true,
      landmarkTopology: LANDMARK_COVERAGE_TOPOLOGY_VERSION, freshCohort: 'audition-fresh-cohort/v1' })).rejects.toThrow('audition_reference_unqualified');
    expect(pageCalls(h)).toEqual([]); expect(pageRecords(h)).toEqual([]);
  });
  it('a held sheet resumed or reused from a saved run is refused just the same: no permissive fallback', async () => {
    const old = harness({ judge: heldLocations }); await illustrateReviewedAudition(old.args);
    const designs = old.saved.get('audition_sheet_designs'), sheets = { entities: old.saved.get('sheet_entities') as any, locations: old.saved.get('sheet_locations') as any };
    const resumed = harness();
    await expect(illustrateReviewedAudition({ ...resumed.args, ...on, resume: { designs, sheets, pages: {}, stepPrefix: 'r1_' } }))
      .rejects.toThrow('audition_reference_unqualified');
    expect([resumed.args.render, resumed.args.judge, resumed.args.identity].map(f => f.mock.calls.length)).toEqual([0, 0, 0]);
    const reused = harness();
    await expect(illustrateReviewedAudition({ ...reused.args, ...on, reuseSheets: { locations: sheets.locations } })).rejects.toThrow('audition_reference_unqualified');
    expect(reused.args.render.mock.calls.map(c => c[0])).toEqual(['sheet_entities_0']); expect(pageCalls(reused)).toEqual([]);
  });
  it('an unknown contract version refuses before anything is saved or called', async () => {
    const h = harness();
    await expect(illustrateReviewedAudition({ ...h.args, referenceQualification: 'reference-qualification/v0' as never })).rejects.toThrow('audition_reference_contract');
    expect(h.args.render).not.toHaveBeenCalled(); expect(h.saved.size).toBe(0);
  });
});

describe('instance-distinction/v1 (page context v7): set dressing is told apart from the story object', () => {
  const LIGHTNING = 'split by lightning down its trunk';
  // The typed garden shows "tree" dressing; its old_tree landmark (kind tree) bears a fixed distinction; trail is a prop not yet revealed on page 1.
  const instanceFixture = () => {
    const b = typedFixture() as any;
    b.plan.continuity.entities.find((e: any) => e.id === 'old_tree').invariants.push({ attribute: 'distinction', value: LIGHTNING });
    b.plan.continuity.entities.find((e: any) => e.id === 'trail').invariants.push({ attribute: 'distinction', value: 'tiny star prints' });
    b.instanceDistinction = { version: INSTANCE_DISTINCTION_VERSION, populations: [{ locationId: 'garden', kinds: ['tree'] }],
      entities: [{ id: 'paper_boat', kind: 'boat', distinction: null }, { id: 'ribbon', kind: 'ribbon', distinction: null },
        { id: 'trail', kind: 'trail', distinction: 'tiny star prints' }, { id: 'old_tree', kind: 'tree', distinction: LIGHTNING },
        { id: 'stone', kind: 'stone', distinction: null }] };
    return b as PersonalStoryboard;
  };
  const plainOf = (book: PersonalStoryboard) => { const { instanceDistinction: _record, ...plain } = book as any; return plain as PersonalStoryboard; };
  const refs = { entities: { image: image('sheet_entities_0'), status: 'approved_reference' as const, knownFlaws: [] },
    locations: { image: image('sheet_locations_0'), status: 'approved_reference' as const, knownFlaws: [] } };
  const canonical = [image('child'), image('companion'), image('sheet_entities_0'), image('sheet_locations_0')];
  const pageContext = (book: PersonalStoryboard, anatomy = true) => auditionPageContext(book, { pageNumber: 1 }, 1, 'copper dragon', canonical, refs, null,
    LANDMARK_DESIGN_HEAD_VERSION, LANDMARK_COVERAGE_TOPOLOGY_VERSION, anatomy ? true : undefined);
  type Row = { association: string; observed: (aspect: string) => string; extent: string };
  const own: Row = { association: 'this_landmark', observed: () => 'matches', extent: 'whole_instance' };
  const unrelated: Row = { association: 'different_object', observed: a => a === 'kind' ? 'contradicted' : 'not_visible', extent: 'not_instance' };
  const dressing: Row = { association: 'set_dressing', observed: a => a === 'kind' ? 'matches' : a === 'distinction' ? 'contradicted' : 'not_visible', extent: 'not_instance' };
  // A complete synthetic v7 answer: the full object/landmark matrix, every pair, every binding, four scans and intact anatomy (not pixel proof).
  const answer = (ctx: ReturnType<typeof pageContext>, objects: Record<string, Partial<Record<string, Row>>>, o: { populations?: unknown[]; spec?: Spec } = {}) => {
    const landmarks = ctx.checks.uniqueLandmarks, ids = Object.keys(objects), populations = o.populations ?? [];
    const row = (id: string, landmarkId: string) => objects[id][landmarkId] ?? unrelated;
    return { ...review(sha('candidate'), ctx.contextSha, o.spec ?? {}),
      landmarkInventory: { objects: ids.map(id => ({ objectId: id, region: `region of ${id}`, description: `object ${id}`, quadrants: ['top_left'] })),
        landmarks: landmarks.map(l => ({ landmarkId: l.id, candidates: ids.map(id => ({ objectId: id, association: row(id, l.id).association, evidence: 'synthetic observation',
          featureChecks: l.features.map(f => ({ featureId: f.id, observed: row(id, l.id).observed(f.aspect) })) })) })),
        topology: { version: LANDMARK_COVERAGE_TOPOLOGY_VERSION,
          relations: ids.flatMap((a, i) => ids.slice(i + 1).map(b => ({ from: a, to: b, relation: 'separate_objects', basis: 'visible_separation', evidence: 'visibly separate objects' }))),
          bindings: landmarks.flatMap(l => ids.map(id => ({ landmarkId: l.id, objectId: id, extent: row(id, l.id).extent,
            sourceKind: l.features.find(f => f.aspect === 'kind')!.text, evidence: 'synthetic binding evidence' }))),
          coverage: { version: 'landmark-candidate-coverage/v1', populations, scans: ['top_left', 'top_right', 'bottom_left', 'bottom_right'].map(quadrant => ({ quadrant,
            status: 'complete', unresolvedReason: 'none', uncertainLandmarkIds: [], populationIds: quadrant === 'top_left' ? populations.map((p: any) => p.populationId) : [],
            objectIds: quadrant === 'top_left' ? ids : [], evidence: 'synthetic complete quadrant witness' })) } } },
      anatomy: { version: AUDITION_ANATOMY_VERSION, actors: (ctx.context.anatomy as { castIds: string[] }).castIds.map(actorId => ({ actorId, region: 'synthetic actor body, not pixel proof',
        limbs: { part: 'limbs', condition: 'intact', expectedTotal: 4, expectationBasis: 'canonical_design', expectationEvidence: 'Synthetic four-limbed design',
          visibleDistinct: 3, unseen: 'occluded', evidence: 'Three attached paths; fourth naturally hidden', correction: '' }, otherParts: [] })) } };
  };
  const assess = (raw: unknown, ctx = pageContext(instanceFixture()), legacy = false) =>
    assessAuditionReview(raw, sha('candidate'), ctx.contextSha, ctx.checks.requirementIds, ctx.checks.uniqueLandmarks, LANDMARK_COVERAGE_TOPOLOGY_VERSION,
      (ctx.context.anatomy as { castIds: string[] }).castIds, legacy ? undefined : INSTANCE_DISTINCTION_VERSION).assessment;
  const uniqueFindings = (a: ReturnType<typeof assess>) => a.findings.filter(f => f.requirement === 'landmark_unique:old_tree');

  it('the distinction is one decisive cue of its own aspect only under the book record; without it, ordinary design text', () => {
    const tree = (book: PersonalStoryboard) => auditionPageChecks(book, 1, 'x', LANDMARK_DESIGN_HEAD_VERSION).uniqueLandmarks.find(l => l.id === 'old_tree')!;
    expect(tree(instanceFixture()).features.filter(f => f.aspect === 'distinction')).toEqual([expect.objectContaining({ text: LIGHTNING, decisive: true })]);
    expect(tree(plainOf(instanceFixture())).features.some(f => f.aspect === 'distinction')).toBe(false);
    const wrong = { ...instanceFixture(), instanceDistinction: { ...instanceFixture().instanceDistinction!, version: 'instance-distinction/v0' } };
    expect(() => auditionPageChecks(wrong as never, 1, 'x')).toThrow('audition_instance_contract');
  });

  it('page context v7 is v6 plus the marker and the frame instance checks; it needs structural anatomy; a mismatched marker refuses', () => {
    const { context, checks } = pageContext(instanceFixture());
    expect(context).toMatchObject({ version: 'audition-page-context/v7', instanceDistinction: INSTANCE_DISTINCTION_VERSION });
    expect(checks.instances).toEqual({ version: INSTANCE_DISTINCTION_VERSION, populations: [{ locationId: 'garden', kinds: ['tree'] }],
      entities: expect.arrayContaining([{ id: 'old_tree', kind: 'tree', distinction: LIGHTNING, state: 'visible' },
        { id: 'trail', kind: 'trail', distinction: 'tiny star prints', state: 'not_yet_revealed' }, { id: 'stone', kind: 'stone', distinction: null, state: 'offstage' }]) });
    expect(auditionInstanceDistinction(context)).toBe(INSTANCE_DISTINCTION_VERSION);
    expect(auditionJudgeInstruction('page', context)).toContain(INSTANCE_JUDGE_RULES);
    expect(() => pageContext(instanceFixture(), false)).toThrow('audition_instance_contract');
    const legacy = pageContext(plainOf(instanceFixture())).context;
    expect(legacy.version).toBe('audition-page-context/v6'); expect('instanceDistinction' in legacy).toBe(false);
    expect(auditionInstanceDistinction(legacy)).toBeUndefined(); expect(auditionJudgeInstruction('page', legacy)).not.toContain('INSTANCE DISTINCTION');
    expect(() => auditionInstanceDistinction({ ...context, version: 'audition-page-context/v6' })).toThrow('audition_instance_contract');
    expect(() => auditionInstanceDistinction({ ...context, instanceDistinction: undefined })).toThrow('audition_instance_contract');
  });

  it('CE-R2 render lines: only visible distinctions prime drawing; unrevealed cues stay with the judge', async () => {
    const run = async (book: PersonalStoryboard) => { const h = harness({ book, coverage: true, pages: [1] });
      await illustrateReviewedAudition({ ...h.args, pageAttempts: 1, structuralAnatomy: true, landmarkTopology: LANDMARK_COVERAGE_TOPOLOGY_VERSION }); return h; };
    const h = await run(instanceFixture()), prompt = h.prompts.get('page_1_0')!;
    expect(prompt).toContain('UNIQUE LANDMARKS (one each, never duplicated): old_tree.');
    expect(prompt).toContain('SET DRESSING (allowed here, never a story object): tree.');
    expect(prompt).toContain(`old_tree: other tree objects are allowed; only this one bears ${LIGHTNING}.`);
    expect(prompt).not.toContain('tiny star prints');
    expect(h.contexts.get('page_1_0_qa').version).toBe('audition-page-context/v7');
    const legacy = (await run(typedFixture())).prompts.get('page_1_0')!;
    expect(legacy).toContain('UNIQUE LANDMARKS (one each, never duplicated): old_tree, stone.'); expect(legacy).not.toContain('SET DRESSING');
  });


  it('CE-R2 hidden distinctions stay judge-only through first/repeated renders and the fresh cohort', async () => {
    const b=instanceFixture(),h=harness({book:b,coverage:true,pages:[1,2],
      judge:step=>step==='page_1_0_qa'?{scene:{issues:[issue('story','scene_plan','A verified current action is missing.')]}}:{}});
    await illustrateReviewedAudition({...h.args,pageAttempts:2,structuralAnatomy:true,landmarkTopology:LANDMARK_COVERAGE_TOPOLOGY_VERSION});
    expect(h.prompts.has('page_1_1')).toBe(true);
    for(const step of ['page_1_0','page_1_1'])expect(h.prompts.get(step)).not.toContain('tiny star prints');
    expect(h.prompts.get('page_2_0')).toContain('tiny star prints');
    expect(canonicalJson(h.contexts.get('page_1_0_qa'))).toContain('tiny star prints');
    const fresh=harness({book:b,coverage:true});
    await illustrateReviewedAudition({...fresh.args,pageAttempts:1,structuralAnatomy:true,
      landmarkTopology:LANDMARK_COVERAGE_TOPOLOGY_VERSION,freshCohort:'audition-fresh-cohort/v1'});
    for(const step of ['page_0_0','page_1_0'])expect(fresh.prompts.get(step)).not.toContain('tiny star prints');
    expect(fresh.prompts.get('page_2_0')).toContain('tiny star prints');
  });

  it.each(['material','anatomy'] as const)('CE-R2 %s scene correction keeps the visible canon but not unrevealed judge-only cues',async kind=>{
    const h=harness({book:instanceFixture(),coverage:true,pages:[1],
      judge:step=>kind==='material'&&step.startsWith('page_')?{environment:{issues:[issue('continuity','visual_language','Verified current scene defect.')]}}:{},
      ...(kind==='anatomy'?{anatomy:(_step:string,_context:any,normal:any)=>({...normal,actors:normal.actors.map((actor:any)=>actor.actorId==='child'?
        {...actor,limbs:{...actor.limbs,condition:'extra',expectedTotal:4,visibleDistinct:5,unseen:'not_applicable',evidence:'Five distinct attached limb paths.',
          correction:'Restore four canonical limb paths without changing the current scene.'}}:actor)})}:{})});
    await illustrateReviewedAudition({...h.args,pageAttempts:1,structuralAnatomy:true,landmarkTopology:LANDMARK_COVERAGE_TOPOLOGY_VERSION});
    const p=h.saved.get('page_1') as SavedPage,context=h.contexts.get('page_1_0_qa'),before=canonicalJson(context);
    await repairReviewedAuditionPage({page:1,prefix:'r2_',consumedAttemptsBefore:1,prior:p.chosen,context,contextSha:p.contextSha,
      canonical:context.references,predecessor:null,check:h.args.check,render:h.args.render,judge:h.args.judge,identity:h.args.identity,
      save:h.args.save,...(kind==='material'?{materialScene:true}:{})});
    const render=h.args.render.mock.calls[h.args.render.mock.calls.length-1]!;
    expect(render[0]).toBe('r2_page_1_1');expect(render[1]).not.toContain('tiny star prints');
    expect(render[1]).toContain(LIGHTNING);expect(canonicalJson(context)).toBe(before);
    expect(before).toContain('tiny star prints');
    const saved=h.saved.get('scene_repair_1_candidate') as any;
    expect(saved.recipeSha256).toBe(previewSha(canonicalJson({prompt:render[1],references:render[2],mode:render[3],roles:render[4],provenance:saved.sceneRepair})));
  });

  it('a tree visibly WITHOUT the distinction is set dressing and is not counted', () => {
    const a = assess(answer(pageContext(instanceFixture()), { o1: { old_tree: own }, o2: { old_tree: dressing } }));
    expect(uniqueFindings(a)).toEqual([]); expect(a.landmarks!.find(l => l.landmarkId === 'old_tree')!.instances).toBe(1);
  });

  it('a second object bearing the distinction is a duplicate (defect)', () => {
    const a = assess(answer(pageContext(instanceFixture()), { o1: { old_tree: own }, o2: { old_tree: { association: 'possible_copy', observed: () => 'matches', extent: 'whole_instance' } } }));
    expect(uniqueFindings(a)).toEqual([expect.objectContaining({ verdict: 'defect', impact: 'continuity' })]);
  });

  it('set_dressing whose distinction is not visibly absent stays counted and uncertain, never excluded on the label', () => {
    const a = assess(answer(pageContext(instanceFixture()), { o1: { old_tree: own },
      o2: { old_tree: { association: 'set_dressing', observed: x => x === 'kind' ? 'matches' : 'not_visible', extent: 'uncertain' } } }));
    expect(uniqueFindings(a)).toEqual([expect.objectContaining({ verdict: 'uncertain' })]);
  });

  it('a decorative population is excluded by its visibly missing distinction (basis visible_distinction)', () => {
    const ctx = pageContext(instanceFixture()), feature = (id: string, aspect: string) => ctx.checks.uniqueLandmarks.find(l => l.id === id)!.features.find(f => f.aspect === aspect)!.id;
    const population = { populationId: 'p1', quadrants: ['top_left'], description: 'a stand of plain trees without any split', membership: 'uniform_noninstances',
      witnessObjectIds: ['o2'], negativeChecks: [
        { landmarkId: 'old_tree', featureId: feature('old_tree', 'distinction'), observed: 'contradicted', basis: 'visible_distinction', allMembersReadable: true,
          evidence: 'no trunk in the stand is split', grounding: null },
        { landmarkId: 'stone', featureId: feature('stone', 'kind'), observed: 'contradicted', basis: 'visible_kind', allMembersReadable: true,
          evidence: 'these are trees, not a stone', grounding: null }] };
    const raw = answer(ctx, { o1: { old_tree: own }, o2: { old_tree: dressing } }, { populations: [population] });
    const a = assess(raw, ctx);
    expect(uniqueFindings(a)).toEqual([]); expect(a.landmarks!.find(l => l.landmarkId === 'old_tree')!.topologyUncertain).toBe(false);
  });

  it('a set_dressing answer outside the v7 contract refuses (the legacy schema has no such association)', () => {
    const ctx = pageContext(instanceFixture());
    const raw = answer(ctx, { o1: { old_tree: own }, o2: { old_tree: dressing } });
    expect(() => assess(raw, ctx, true)).toThrow(/set_dressing|invalid_enum_value|Invalid enum value/);
    // The same picture answered with the legacy vocabulary (different_object, distinction contradicted) is the v6 judgement, unchanged.
    expect(() => assess(answer(ctx, { o1: { old_tree: own }, o2: { old_tree: { ...dressing, association: 'different_object' } } }), ctx, true)).not.toThrow();
  });

  it('a not-yet-revealed entity drawn with its distinction is a bound story issue that holds the page', () => {
    const ctx = pageContext(instanceFixture());
    expect(ctx.checks.requirementIds).toContain('not_yet_revealed:trail');
    const a = assess(answer(ctx, { o1: { old_tree: own } }, { spec: { scene: { issues: [issue('story', 'not_yet_revealed:trail', 'a trail of tiny star prints is drawn')] } } }), ctx);
    expect(a.findings).toEqual(expect.arrayContaining([expect.objectContaining({ impact: 'story', requirement: 'not_yet_revealed:trail', bound: true })]));
    expect(a.counts.story).toBe(1);
  });
});

describe('local anatomical scene repair through the EXISTING bounded loop', () => {
  const clarityFixture=async()=>{
    const h=harness({book:typedFixture(),coverage:true});
    await illustrateReviewedAudition({...h.args,pages:[1],structuralAnatomy:true,landmarkTopology:LANDMARK_COVERAGE_TOPOLOGY_VERSION});
    const p=h.saved.get('page_1') as SavedPage,c=h.contexts.get('page_1_0_qa'),prior=p.attempts[0];
    const request={version:'audition-anatomy-clarity/v1' as const,source:'owner_visual_feedback' as const,candidateSha:prior.candidate!.imageSha,
      contextSha:p.contextSha,actorId:'child',ownerApprovalSha:sha('owner'),observation:'Owner asks for clearer visible limb attachment; this is not a new pixel verdict.'};
    return {h,p,c,prior,request};
  };
  it('explicit clarity asks for readability without changing intact prior evidence; absent is still no edit',async()=>{
    const {c,p,prior,request}=await clarityFixture(),before=canonicalJson(prior);
    expect(auditionLocalAnatomyRepairPlan(prior,c,p.contextSha,c.references)).toBeNull();
    const plan=auditionLocalAnatomyRepairPlan(prior,c,p.contextSha,c.references,'',request)!;
    expect(plan.references[0]).toEqual(prior.candidate);expect(plan.prompt).toContain('not a new pixel verdict');
    expect(plan.prompt).toContain('do NOT presume a fifth limb exists or merely delete a haunch');
    expect(plan.provenance.clarity).toMatchObject(request);expect(plan.provenance.clarity!.requestSha).toBe(previewSha(canonicalJson(request)));
    expect(canonicalJson(prior)).toBe(before);
  });
  it('native clarity raw replay accepts the exact original paid answer',async()=>{
    const {c,p,prior}=await clarityFixture();
    expect(assertAnatomyClarityRawPrior(structuredClone(prior.review),prior,c,p.contextSha).review).toEqual(prior.review);
  });
  it.each(['derivative','raw','safety'])('native clarity raw replay rejects changed %s, not just two coherent derivative copies',async kind=>{
    const {c,p,prior}=await clarityFixture(),raw=structuredClone(prior.review)!,copy=structuredClone(prior);
    if(kind==='derivative'){
      copy.review!.anatomy!.actors[0].limbs.visibleDistinct=5;copy.review!.anatomy!.actors[0].limbs.condition='extra';
      copy.assessment=assessAuditionReview(copy.review,copy.candidate!.imageSha,p.contextSha,c.requirementIds,c.checks.uniqueLandmarks,LANDMARK_COVERAGE_TOPOLOGY_VERSION,c.anatomy.castIds).assessment;
      copy.status=attemptStatus('page',copy);
    }else if(kind==='raw'){raw.anatomy!.actors[0].limbs.visibleDistinct=5;raw.anatomy!.actors[0].limbs.condition='extra';}
    else{const s=raw.checks.find(r=>r.category==='safety')!;s.verdict='defect';s.correction='Resolve the synthetic unsafe condition';s.issues=[{impact:'safety',requirement:'safety',note:'Synthetic changed raw safety finding'}];}
    expect(()=>assertAnatomyClarityRawPrior(raw,copy,c,p.contextSha)).toThrow('anatomy_clarity_raw_binding');
  });
  it.each(['candidateSha','contextSha','actorId','ownerApprovalSha','source'])('explicit clarity rejects foreign/invalid %s',async field=>{
    const {c,p,prior,request}=await clarityFixture(),bad:any={...request,[field]:field==='actorId'?'unknown':field==='source'?'model_guess':field==='ownerApprovalSha'?'':sha('foreign')};
    expect(()=>auditionLocalAnatomyRepairPlan(prior,c,p.contextSha,c.references,'',bad)).toThrow('audition_scene_clarity_binding');
  });
  it('clarity uses one counted edit then full regular QA/identity; old record is untouched',async()=>{
    const {c,p,prior,request}=await clarityFixture(),calls:string[]=[],before=canonicalJson(prior),candidate=image('clarified');
    const result=await repairReviewedAuditionPage({page:1,prefix:'r9_',consumedAttemptsBefore:1,prior,context:c,contextSha:p.contextSha,canonical:c.references,
      predecessor:null,clarity:request,check:()=>{},save:()=>{},render:async step=>{calls.push(step);return candidate;},
      judge:async(step,im)=>{calls.push(step);return {...structuredClone(prior.review),candidateSha:im.imageSha};},
      identity:async step=>{calls.push(step);return identity(.9);}});
    expect(calls).toEqual(['r9_page_1_1','r9_page_1_1_qa','r9_page_1_1_identity']);expect(result.corrected!.sceneRepair!.clarity).toMatchObject(request);
    expect(result.status).toBe('corrected_supported');expect(canonicalJson(prior)).toBe(before);
  });
  it.each(['review_unusable','review_invalid','ineligible_safety'])('clarity cannot bypass %s',async status=>{
    const {c,p,prior,request}=await clarityFixture(),render=vi.fn();
    const result=await repairReviewedAuditionPage({page:1,prefix:'r9_',consumedAttemptsBefore:1,prior:{...prior,status:status as any},context:c,contextSha:p.contextSha,
      canonical:c.references,predecessor:null,clarity:request,check:()=>{},save:()=>{},render,judge:vi.fn(),identity:vi.fn()});
    expect(render).not.toHaveBeenCalled();expect(result.status).toBe('stopped_unusable_or_unsafe_parent');
  });
  it.each(['review_invalid','review_unusable','identity_unusable','unavailable','ineligible_safety'])('native F1: %s stops before another page',status=>{
    expect(sceneRepairStops({status:'corrected_not_supported',corrected:{status}} as any)).toBe(true);
  });
  it.each(['held','qa_supported'])('native F1: a valid %s still permits the next independent diagnostic page',status=>{
    expect(sceneRepairStops({status:'corrected_not_supported',corrected:{status}} as any)).toBe(false);
  });
  it('native F1: unusable parent is terminal, absent verified defect is not an edit authority',()=>{
    expect(sceneRepairStops({status:'stopped_unusable_or_unsafe_parent',corrected:null} as any)).toBe(true);
    expect(sceneRepairStops({status:'no_verified_structural_defect',corrected:null} as any)).toBe(false);
  });
  const bad = (normal: any) => { const n = structuredClone(normal); n.actors[0].limbs.visibleDistinct = 5; return n; };
  const run = async (changes: Record<string, unknown> = {}) => {
    const h = harness({ book: typedFixture(), coverage: true,
      anatomy: (step, _context, n) => step === 'page_1_0_qa' ? bad(n) : n });
    const result = await illustrateReviewedAudition({ ...h.args, pages: [1], structuralAnatomy: true,
      landmarkTopology: LANDMARK_COVERAGE_TOPOLOGY_VERSION, localAnatomyRepair: true, ...changes });
    return { h, result, page: h.saved.get('page_1') as SavedPage };
  };
  it('edits the actual failed candidate; exact roles, full four canonical judge refs, no reset or pose copying', async () => {
    const { h, result, page } = await run(), call = h.args.render.mock.calls.find(c => c[0] === 'page_1_1')!;
    expect(result.policy.version).toBe('reviewed-audition-policy/v16');
    expect(call[2]).toEqual([page.attempts[0].candidate, image('child'), image('companion'), image('sheet_entities_0')]);
    expect(call[3]).toBe('book_scene_edit');
    expect(call[4]).toEqual(['scene_edit_target','child_design_authority','companion_design_authority','entity_design_authority']);
    expect(h.args.judge.mock.calls.find(c => c[0] === 'page_1_1_qa')![4]).toHaveLength(4);
    expect(page.attempts.map(a => a.attempt)).toEqual([0,1]); expect(page.attempts[0].status).toBe('held');
    expect(page.attempts[1].sceneRepair).toMatchObject({ version: AUDITION_LOCAL_ANATOMY_REPAIR_VERSION,
      parentImageSha: page.attempts[0].candidate!.imageSha, parentContextSha: page.contextSha, targetActorIds:['child'] });
    expect(page.status).toBe('qa_supported');
    expect(call[1].replace(/\s+/g,' ')).toContain('lying on the back stays lying on the back');
    expect(call[1]).toContain('ONE canonical anatomical slot');
    const dry = auditionRenderPlan('/scratch', call[1], call[2] as any, 'book_scene_edit', call[4] as any);
    expect(dry.wire.mode).toBe('images.edit'); expect(dry.wire.references).toHaveLength(4);
    expect(dry.wire.body.prompt).toContain('Image 1: rejected FULL PAGE EDIT TARGET');
    expect(dry.wire.body.prompt).not.toContain('[PERSONAL BOOK REFERENCE ROLES]');
    expect(dry.wire.body.prompt).not.toContain('REJECTED reference sheet to edit');
  });
  it('without opt-in existing render/pixel contract is unchanged', async () => {
    const { h, result, page } = await run({localAnatomyRepair:undefined});
    expect(result.policy.version).toBe('reviewed-audition-policy/v15');
    expect(h.args.render.mock.calls.find(c=>c[0]==='page_1_1')![3]).toBe('book_identity');
    expect(page.attempts[1].sceneRepair).toBeUndefined();
  });
  it('new structural defect on every attempt uses its immediate parent and never draws a fourth', async () => {
    const h=harness({book:typedFixture(),coverage:true,anatomy:(_s,_c,n)=>bad(n)});
    await illustrateReviewedAudition({...h.args,pages:[1],structuralAnatomy:true,localAnatomyRepair:true,recovery:true,
      landmarkTopology:LANDMARK_COVERAGE_TOPOLOGY_VERSION});
    const p=h.saved.get('page_1') as SavedPage;
    expect(p.attempts).toHaveLength(3); expect(p.status).toBe('held');
    expect(p.attempts[2].sceneRepair!.parentImageSha).toBe(p.attempts[1].candidate!.imageSha);
    expect(h.prompts.get('page_1_2')).toContain('DIAGNOSIS AFTER TWO HELD');
    expect(h.prompts.has('page_1_3')).toBe(false);
  });
  it.each(['candidate','context','assessment','canonical','status'])('rejects a changed %s binding before an edit plan exists',async kind=>{
    const {h,page}=await run(), p=structuredClone(page.attempts[0]);
    const c=structuredClone(h.contexts.get('page_1_0_qa')), refs=structuredClone(c.references);
    if(kind==='candidate')p.candidate!.imageSha=sha('foreign');
    if(kind==='context')c.packet.pageNumber=9;
    if(kind==='assessment')p.assessment!.counts.identity=0;
    if(kind==='canonical')refs.reverse();
    if(kind==='status')p.status='qa_supported';
    expect(()=>auditionLocalAnatomyRepairPlan(p,c,page.contextSha,refs)).toThrow();
  });
  it('no typed defect, unusable result or cosmetic-only concern cannot produce a local edit',async()=>{
    const {h,page}=await run(); const c=h.contexts.get('page_1_1_qa');
    expect(auditionLocalAnatomyRepairPlan(page.attempts[1],c,page.contextSha,c.references)).toBeNull();
    expect(auditionLocalAnatomyRepairPlan({...page.attempts[0],status:'review_unusable'},c,page.contextSha,c.references)).toBeNull();
  });
  it('bounded successor reviews an unreviewed parent once, edits once, then FULL review and identity on the exact new candidate',async()=>{
    const {h,page}=await run(),context=h.contexts.get('page_1_0_qa'),calls:string[]=[],candidate=image('new_edit');
    const result=await repairReviewedAuditionPage({page:1,prefix:'r9_',consumedAttemptsBefore:1,
      prior:{attempt:0,candidate:page.attempts[0].candidate,review:null,assessment:null,status:'unavailable',error:'not_yet_reviewed'},
      context,contextSha:page.contextSha,canonical:context.references,predecessor:null,check:()=>{},save:()=>{},
      render:async(step,_prompt,refs,mode)=>{calls.push(step);expect(refs[0]).toEqual(page.attempts[0].candidate);expect(mode).toBe('book_scene_edit');return candidate;},
      judge:async(step,c)=>{calls.push(step);const raw=structuredClone(page.attempts[step.endsWith('_0_qa')?0:1].review!);raw.candidateSha=c.imageSha;return raw;},
      identity:async(step,_child,c)=>{calls.push(step);expect(c).toEqual(candidate);return identity(.9);}});
    expect(calls).toEqual(['r9_page_1_0_qa','r9_page_1_1','r9_page_1_1_qa','r9_page_1_1_identity']);
    expect(result.status).toBe('corrected_supported');expect(result.parent.status).toBe('held');
    expect(result.parent.identity).toBeUndefined();expect(result.corrected!.sceneRepair!.parentImageSha).toBe(page.attempts[0].candidate!.imageSha);
  });
  it('F2 actual saved-candidate diagnosis name routes through the REAL strict meter before a provider; invented aliases stay forbidden',async()=>{
    const {h,page}=await run(),context=h.contexts.get('page_1_0_qa'),calls:string[]=[];
    const result=await repairReviewedAuditionPage({page:1,prefix:'r9_',consumedAttemptsBefore:1,
      prior:{attempt:0,candidate:page.attempts[0].candidate,review:null,assessment:null,status:'unavailable',error:'not_yet_reviewed'},
      context,contextSha:page.contextSha,canonical:context.references,predecessor:null,check:()=>{},save:()=>{},render:vi.fn(),identity:vi.fn(),
      judge:async(step)=>{calls.push(step);expect(auditionMeterRules(step)).toBe(auditionReviewRule);
        expect(auditionMeterRules(step)!.reserve({model:'gpt-6.1',service_tier:'default',max_output_tokens:12000})).toBe(600000);
        return page.attempts[1].review;}});
    expect(calls).toEqual(['r9_page_1_0_qa']);expect(result.corrected).toBeNull();
    expect(auditionMeterRules('r9_page_1_0_diagnosis_qa')).toBeUndefined();
  });
  it.each(['unusable','uncertain','safety'])('parent %s does not authorize an image edit',async kind=>{
    const {h,page}=await run(),context=h.contexts.get('page_1_0_qa'),render=vi.fn();
    const result=await repairReviewedAuditionPage({page:1,prefix:'r9_',consumedAttemptsBefore:1,
      prior:{attempt:0,candidate:page.attempts[0].candidate,review:null,assessment:null,status:'unavailable',error:'not_yet_reviewed'},
      context,contextSha:page.contextSha,canonical:context.references,predecessor:null,check:()=>{},save:()=>{},render,
      judge:async()=>{if(kind==='unusable')return {};
        const r=structuredClone(page.attempts[0].review!);
        if(kind==='uncertain'){r.anatomy!.actors[0].limbs.visibleDistinct=null;r.anatomy!.actors[0].limbs.unseen='unreadable';}
        if(kind==='safety'){const c=r.checks.find(x=>x.category==='safety')!;c.verdict='defect';c.issues=[{impact:'safety',requirement:'safety',note:'Synthetic unsafe observation'}];}
        return r;},identity:vi.fn()});
    expect(render).not.toHaveBeenCalled();expect(result.corrected).toBeNull();
  });
  it.each([0,3,4])('a bounded successor refuses exhausted or reset count %i before any callback',async count=>{
    const {h,page}=await run(),context=h.contexts.get('page_1_0_qa'),judge=vi.fn();
    await expect(repairReviewedAuditionPage({page:1,prefix:'r9_',consumedAttemptsBefore:count,prior:page.attempts[0],
      context,contextSha:page.contextSha,canonical:context.references,predecessor:null,check:()=>{},save:()=>{},render:vi.fn(),judge,identity:vi.fn()})).rejects.toThrow('audition_scene_repair_scope');
    expect(judge).not.toHaveBeenCalled();
  });
  it.each([0,6])('canonical %i is not forced into four (synthetic evidence only)',async n=>{
    const h=harness({book:typedFixture(),coverage:true,anatomy:(_s,_c,normal)=>{
      normal.actors[0].limbs.expectedTotal=n;normal.actors[0].limbs.visibleDistinct=n; return normal;}});
    await illustrateReviewedAudition({...h.args,pages:[1],structuralAnatomy:true,localAnatomyRepair:true,
      landmarkTopology:LANDMARK_COVERAGE_TOPOLOGY_VERSION});
    expect(h.args.render.mock.calls.filter(c=>c[0].startsWith('page_'))).toHaveLength(1);
  });
  it.each([['scene_edit_target'],['child_design_authority','scene_edit_target','companion_design_authority','entity_design_authority']].map(roles=>({roles})))(
    'planner rejects incomplete or reordered explicit scene roles: %j',({roles})=>{
      expect(()=>planGPTImageRequest({finalPrompt:'repair',referenceImages:['a','b','c','d'],referenceMode:'book_scene_edit',
        referenceRoles:roles as any,quality:'low',size:'1024x1024'},{defaultQuality:'low',defaultModel:'gpt-image-2',maxReferences:4})).toThrow();
  });
});

describe('prospective anatomy through the EXISTING assessment and bounded page loop', () => {
  const bad = (normal: any) => { const n = structuredClone(normal); n.actors[0].limbs.visibleDistinct = 6;
    n.actors[0].limbs.unseen = 'not_applicable'; n.actors[0].limbs.evidence = 'Six visible attached paths for a four-limbed actor'; return n; };
  it('six limbs with all explicit checks and numeric identity passing still corrects instead of accepting detail', async () => {
    const h = harness({ book: typedFixture(), coverage: true,
      anatomy: (step, _context, n) => step === 'page_1_0_qa' ? bad(n) : n });
    const m = await illustrateReviewedAudition({ ...h.args, pages: [1], structuralAnatomy: true,
      landmarkTopology: LANDMARK_COVERAGE_TOPOLOGY_VERSION });
    expect(m.policy.version).toBe('reviewed-audition-policy/v15');
    const p = h.saved.get('page_1') as SavedPage;
    expect(p.attempts[0].status).toBe('held'); expect(p.status).toBe('qa_supported');
    expect(p.attempts[0].assessment!.counts.identity).toBe(1);
    expect(h.prompts.get('page_1_1')).toContain('anatomy:child');
    expect(h.prompts.get('page_1_1')).toContain('existing total');
    expect(h.contexts.get('page_1_1_qa')).toMatchObject({ version: 'audition-page-context/v6' });
  });
  it('two structural failures produce persisted diagnosis, different strategy, no fourth ordinary attempt', async () => {
    const h = harness({ book: typedFixture(), coverage: true, anatomy: (_s, _c, n) => bad(n) });
    await illustrateReviewedAudition({ ...h.args, pages: [1], recovery: true, structuralAnatomy: true,
      landmarkTopology: LANDMARK_COVERAGE_TOPOLOGY_VERSION });
    const p = h.saved.get('page_1') as SavedPage;
    expect(p.attempts).toHaveLength(3); expect(p.status).toBe('held'); expect(p.recovery!.diagnoses).toHaveLength(1);
    expect(h.prompts.get('page_1_2')).toContain('SIMPLER ANATOMICALLY VALID POSE');
    expect(h.prompts.get('page_1_2')).not.toBe(h.prompts.get('page_1_1'));
    expect(h.prompts.has('page_1_3')).toBe(false);
  });
  it('missing prospective evidence stops before identity and further renders, not legacy-schema fallback', async () => {
    const h = harness({ book: typedFixture(), coverage: true, anatomy: () => undefined });
    await expect(illustrateReviewedAudition({ ...h.args, pages: [1, 2], structuralAnatomy: true,
      landmarkTopology: LANDMARK_COVERAGE_TOPOLOGY_VERSION })).rejects.toThrow('audition_review_unusable');
    expect(h.args.identity).not.toHaveBeenCalled(); expect(h.prompts.has('page_2_0')).toBe(false);
  });
  it.each(['null-visible', 'not-counted'])('F1 full strict schema/assessment/status cannot support required unknown limbs: %s', kind => {
    const h = harness({ book: typedFixture(), coverage: true });
    return illustrateReviewedAudition({ ...h.args, pages: [1], structuralAnatomy: true,
      landmarkTopology: LANDMARK_COVERAGE_TOPOLOGY_VERSION, judge: async (...a) => {
        const raw: any = await h.args.judge(...a), limb = raw.anatomy?.actors[0].limbs;
        if (limb) Object.assign(limb, kind === 'null-visible' ? { visibleDistinct: null, unseen: 'not_applicable' }
          : { expectedTotal: null, visibleDistinct: 6, expectationBasis: 'not_counted', unseen: 'not_applicable' });
        return raw;
      } }).then(m => {
        expect(m.pages[0].status).toBe('held');
        const p = h.saved.get('page_1') as SavedPage;
        expect(p.attempts).toHaveLength(3); expect(p.attempts.every(a => a.assessment!.counts.identity > 0 && a.status === 'held')).toBe(true);
      });
  });
  it('F1 full context-selected schema rejects fur-only actor before identity/any subsequent render', async () => {
    const h = harness({ book: typedFixture(), coverage: true, anatomy: (_s, _c, n) => {
      const a = n.actors[0]; a.otherParts.push({ ...a.limbs, part: 'fur', expectedTotal: null, visibleDistinct: null, expectationBasis: 'not_counted' });
      delete a.limbs; return n;
    } });
    await expect(illustrateReviewedAudition({ ...h.args, pages: [1], structuralAnatomy: true,
      landmarkTopology: LANDMARK_COVERAGE_TOPOLOGY_VERSION })).rejects.toThrow('audition_review_unusable');
    expect(h.args.identity).not.toHaveBeenCalled(); expect(h.prompts.has('page_1_1')).toBe(false);
  });
  it('fresh sample anatomy hold stops before cover/downstream even when all model checks say pass', async () => {
    const h = harness({ book: typedFixture(), coverage: true, anatomy: (_s, _c, n) => bad(n) });
    const m = await illustrateReviewedAudition({ ...h.args, sample: [1, 2], structuralAnatomy: true,
      landmarkTopology: LANDMARK_COVERAGE_TOPOLOGY_VERSION });
    expect(m.status).toBe('held_sample'); expect(h.prompts.has('page_0_0')).toBe(false); expect(h.prompts.has('page_3_0')).toBe(false);
  });
  it('legacy v13 raw/context and policy remain legacy, not upgraded from free text', async () => {
    const h = harness({ book: typedFixture(), coverage: true });
    const m = await illustrateReviewedAudition({ ...h.args, pages: [1], landmarkTopology: LANDMARK_COVERAGE_TOPOLOGY_VERSION });
    expect(m.policy.version).toBe('reviewed-audition-policy/v13');
    expect(h.contexts.get('page_1_0_qa').version).toBe('audition-page-context/v4');
    expect(h.contexts.get('page_1_0_qa').anatomy).toBeUndefined();
    expect(h.prompts.get('page_1_0')).not.toContain('STRUCTURAL ANATOMY AND ACTION BINDING');
  });
  const successor = async (alwaysBad = false) => {
    const old = harness({ book: typedFixture(), coverage: true, pages: [1, 2],
      judge: step => step.startsWith('page_2_') ? { identity: { issues: [issue('identity', 'cast:companion')] } } : {} });
    await illustrateReviewedAudition({ ...old.args, sample: [1, 2], landmarkTopology: LANDMARK_COVERAGE_TOPOLOGY_VERSION });
    const parents = [1, 2].map((n, i) => { const p = old.saved.get(`page_${n}`) as SavedPage;
      return { page: n, consumedAttemptsBefore: i === 0 ? 2 : 4, maxNewAttempts: i === 0 ? 0 : 2,
        prior: { ...p, attempts: [p.chosen] } }; });
    const h = harness({ book: typedFixture(), coverage: true,
      anatomy: (step, _c, normal) => step.startsWith('r9_page_2_4') || alwaysBad && step.startsWith('r9_page_2_') ? bad(normal) : normal });
    const args = { ...h.args, pages: [0, 1, 2, 3, 4, 5, 6, 7, 8], sample: [1, 2], recovery: true as const, structuralAnatomy: true as const,
      landmarkTopology: LANDMARK_COVERAGE_TOPOLOGY_VERSION, anatomyRecovery: { version: AUDITION_ANATOMY_VERSION, pages: parents },
      resume: { designs: { ...(old.saved.get('audition_sheet_designs') as any), policy: reviewedAuditionPolicy() },
        sheets: { entities: old.saved.get('sheet_entities'), locations: old.saved.get('sheet_locations') } as any,
        pages: {}, stepPrefix: 'r9_' } };
    return { h, args, parents };
  };
  it('same-book successor retains2/4 counts and historic raw, requalifies without drawing, corrects4then5 then continues cover/rest', async () => {
    const { h, args, parents } = await successor(), before = canonicalJson(parents);
    const m = await illustrateReviewedAudition(args);
    const p = h.saved.get('page_2_anatomy') as SavedPage;
    expect(p.attempts.map(a => a.attempt)).toEqual([4, 5]); expect(p.status).toBe('qa_supported');
    expect(p.anatomyRecovery!.consumedAttemptsBefore).toBe(4); expect(canonicalJson(parents)).toBe(before);
    expect(h.prompts.has('r9_page_1_0')).toBe(false); expect(h.args.judge.mock.calls.some(c => c[0] === 'r9_page_1_0_qa')).toBe(true);
    expect(h.prompts.get('r9_page_2_5')).toContain('SIMPLER ANATOMICALLY VALID POSE');
    expect(h.prompts.has('r9_page_2_6')).toBe(false); expect(h.prompts.has('r9_page_0_0')).toBe(true); expect(h.prompts.has('r9_page_8_0')).toBe(true);
    expect(m.pages).toHaveLength(9);
  });
  it('two new correction candidates are a real ceiling, not another ordinary3 on top', async () => {
    const { h, args } = await successor(true);
    const m = await illustrateReviewedAudition(args);
    expect(m.status).toBe('held_sample'); expect((h.saved.get('page_2_anatomy') as SavedPage).attempts).toHaveLength(2);
    expect(h.prompts.has('r9_page_2_6')).toBe(false); expect(h.prompts.has('r9_page_0_0')).toBe(false);
  });
  it('bad second historical parent refuses before first fresh paid callback', async () => {
    const { h, args } = await successor(); args.anatomyRecovery.pages[1].prior.contextSha = 'f'.repeat(64);
    await expect(illustrateReviewedAudition(args)).rejects.toThrow('audition_anatomy_parent');
    expect(h.args.render).not.toHaveBeenCalled(); expect(h.args.judge).not.toHaveBeenCalled(); expect(h.args.identity).not.toHaveBeenCalled();
  });
});

const typedFixture = () => {
    const b = fixture(); b.landmarkKind = LANDMARK_KIND_CONTRACT_VERSION;
    for (const e of b.plan.continuity!.entities.filter(e => e.kind === 'landmark')) {
      e.invariants.unshift({ attribute: 'kind', value: e.id === 'old_tree' ? 'tree' : 'stone' });
      e.invariants.push({ attribute: 'shape', value: e.id === 'old_tree' ? 'forked' : 'rounded' });
    }
    return b;
};

describe('explicit diagnostic cohort: existing engine, truthful HOLDs, no sample regeneration or approval', () => {
  const successor = async (opts: Parameters<typeof harness>[0] = {}) => {
    const book = typedFixture(), old = harness({ book, coverage: true, judge: step => step.startsWith('page_2_')
      ? { scene: { issues: [issue('story', 'scene_plan')] } } : {} });
    await illustrateReviewedAudition({ ...old.args, sample: [1, 2], structuralAnatomy: true, landmarkTopology: LANDMARK_COVERAGE_TOPOLOGY_VERSION });
    const h = harness({ book, coverage: true, ...opts });
    const pages = [1, 2].map(page => ({ page, prior: old.saved.get(`page_${page}`) as SavedPage, consumedAttemptsBefore: page === 1 ? 2 : 6 }));
    return { h, old, args: { ...h.args, sample: [1, 2], recovery: true as const, structuralAnatomy: true as const,
      landmarkTopology: LANDMARK_COVERAGE_TOPOLOGY_VERSION,
      fullBookDiagnostic: { version: AUDITION_FULL_BOOK_DIAGNOSTIC_VERSION, pages },
      resume: { designs: { ...(old.saved.get('audition_sheet_designs') as any), policy: reviewedAuditionPolicy() },
        sheets: { entities: old.saved.get('sheet_entities') as any, locations: old.saved.get('sheet_locations') as any },
        pages: {} as Record<number, SavedPage>, stepPrefix: 'r8_' } } };
  };
  it('renders six missing bodies THEN cover BEFORE all reviews; retains held sample, every new HOLD, all nine frames and no product PASS', async () => {
    const events: string[] = [], { h, args } = await successor({
      judge: () => ({ scene: { issues: [issue('story', 'scene_plan', 'synthetic visible story issue')] } }),
      wrap: async (step, work) => { events.push(step); return work(); } });
    const parentsBefore = canonicalJson(args.fullBookDiagnostic.pages), m = await illustrateReviewedAudition(args);
    const rendered = [3, 4, 5, 6, 7, 8, 0].map(n => `r8_page_${n}_0`);
    expect(events.slice(0, 7)).toEqual(rendered);
    expect(events).toHaveLength(21);
    expect(h.args.render.mock.calls.map(c => c[0])).toEqual(rendered);
    expect(events.some(s => /^r8_page_[12]_/.test(s))).toBe(false);
    expect(m.status).toBe('diagnostic_audition'); expect(m.runtimeEligible).toBe(false); expect(m.productionQualified).toBe(false);
    expect(m.pages.map(p => p.pageNumber)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(m.pages.filter(p => p.pageNumber !== 1).every(p => p.status === 'held')).toBe(true);
    expect(canonicalJson(args.fullBookDiagnostic.pages)).toBe(parentsBefore);
    expect(m.diagnostic).toMatchObject({ version: AUDITION_FULL_BOOK_DIAGNOSTIC_VERSION, newFrameAttempts: 1,
      renderThenReview: true, renderOrder: [3, 4, 5, 6, 7, 8, 0] });
    for (const n of [0, 3, 4, 5, 6, 7, 8]) {
      expect(h.saved.get(`diagnostic_render_${n}`)).toMatchObject({ pageNumber: n, attempt: 0, status: 'pending_review', recipeSha256: expect.stringMatching(/^[a-f0-9]{64}$/) });
      expect(h.saved.get(`page_${n}_diagnostic`)).toMatchObject({ pageNumber: n, status: 'held', attempts: [expect.objectContaining({ attempt: 0, status: 'held' })] });
      expect(h.saved.has(`page_${n}`)).toBe(false);
    }
    expect(reviewedAuditionHTML(m, { title: 'Synthetic diagnostic', pages: texts.map(text => ({ text })) }, i => `image:${i.imageName}`)).toContain('אבחון');
  });
  it('all new checks passing still cannot promote the retained HOLD or held reference sheets into an approved book', async () => {
    const { args } = await successor(), m = await illustrateReviewedAudition(args);
    expect(m.status).toBe('diagnostic_audition'); expect(m.pages.find(p => p.pageNumber === 2)!.status).toBe('held');
    expect(m.pages.filter(p => p.pageNumber !== 2).every(p => p.status === 'qa_supported')).toBe(true);
    expect(m.policy.version).toBe('reviewed-audition-policy/v15'); expect(reviewedAuditionPolicy().version).toBe('reviewed-audition-policy/v9');
  });
  it('ordinary sample gate is unchanged: same held sample stops cover and pages3–8', async () => {
    const { old } = await successor();
    expect(old.saved.get('reviewed_audition_manifest')).toMatchObject({ status: 'held_sample' });
    expect(old.args.render.mock.calls.some(c => /page_(0|[3-8])_/.test(c[0]))).toBe(false);
  });
  it.each(['context', 'raw', 'assessment', 'status', 'duplicates', 'count', 'scope', 'version', 'multiple-attempts', 'mixed', 'interrupted', 'unsafe'])
    ('rejects invalid authority/evidence before any new callback: %s', async kind => {
      const { h, args } = await successor(), p = args.fullBookDiagnostic.pages[1].prior, a = p.attempts[0];
      if (kind === 'context') p.contextSha = sha('edited context');
      if (kind === 'raw') (a.review as any).checks = [];
      if (kind === 'assessment') a.assessment!.counts.story++;
      if (kind === 'status') p.status = 'qa_supported';
      if (kind === 'duplicates') p.attempts.push(structuredClone(a));
      if (kind === 'count') args.fullBookDiagnostic.pages[1].consumedAttemptsBefore = 0;
      if (kind === 'scope') (args as any).pages = [1, 2, 3];
      if (kind === 'version') (args.fullBookDiagnostic as any).version = 'unreviewed';
      if (kind === 'multiple-attempts') (args as any).pageAttempts = 2;
      if (kind === 'mixed') (args as any).calibration = {};
      if (kind === 'interrupted') (args.resume as any).interrupted = { pages: {} };
      if (kind === 'unsafe') (a.review as any).checks.find((c: any) => c.category === 'safety').verdict = 'uncertain';
      await expect(illustrateReviewedAudition(args)).rejects.toThrow();
      expect(h.args.render).not.toHaveBeenCalled(); expect(h.args.judge).not.toHaveBeenCalled(); expect(h.args.identity).not.toHaveBeenCalled();
    });
  it('new unknown aborts without retry; prior priced diagnostic images and pending recipes survive; no reviews have started', async () => {
    const { h, args } = await successor({ renderFail: step => step === 'r8_page_4_0' ? new ReviewedAuditionError('audition_unknown_cost') : null });
    await expect(illustrateReviewedAudition(args)).rejects.toThrow('audition_unknown_cost');
    expect(h.args.render.mock.calls.map(c => c[0])).toEqual(['r8_page_3_0', 'r8_page_4_0']);
    expect(h.saved.get('diagnostic_render_3')).toMatchObject({ status: 'pending_review' });
    expect(h.saved.has('diagnostic_render_4')).toBe(false); expect(h.args.judge).not.toHaveBeenCalled(); expect(h.args.identity).not.toHaveBeenCalled();
  });
  it('diagnostic scope rejects every unlisted operation before image reads, key reads, meter or provider', async () => {
    const meter = { run: vi.fn() } as unknown as AuditionMeter, key = vi.fn(() => { throw new Error('must not read key'); });
    const io = auditionAdapters({ directory: 'does-not-exist', meter, key, signal: new AbortController().signal,
      allowedSteps: ['r8_page_3_0', 'r8_page_3_0_qa', 'r8_page_3_0_identity'] });
    for (const step of ['r8_page_1_0', 'r8_page_3_1', 'r9_page_3_0', 'r8_sheet_entities_0', 'r8_page_3_0_extra']) {
      await expect(io.render(step, 'prompt', [image('missing')], 'book_identity')).rejects.toThrow('audition_diagnostic_scope');
      await expect(io.judge(step, image('missing'), {}, sha('context'), [], null, 'page')).rejects.toThrow('audition_diagnostic_scope');
      await expect(io.identity(step, image('missing'), image('candidate'))).rejects.toThrow('audition_diagnostic_scope');
    }
    expect(key).not.toHaveBeenCalled(); expect(meter.run).not.toHaveBeenCalled();
    for (const allowedSteps of [[], ['same', 'same']]) expect(() => auditionAdapters({ directory: '', meter, key,
      signal: new AbortController().signal, allowedSteps })).toThrow('audition_diagnostic_scope');
  });
  it('pure first-render plan fixes LOW/model/reference edit/no retries and does not require a key or existing files', () => {
    const refs = ['child', 'companion', 'entities', 'locations'].map(image), p = auditionRenderPlan('not-opened', 'generic full-page scene', refs, 'book_identity');
    expect(p.wire).toMatchObject({ mode: 'images.edit', body: { model: 'gpt-image-2', quality: 'low', size: '1024x1024', n: 1 },
      references: refs, retries: 0, deadlineMs: 180000, outputReservationTokens: 8192 });
    expect(p.maximumMicroUsd).toBeGreaterThan(0); expect(canonicalJson(p.wire)).not.toContain('apiKey');
    expect(() => auditionRenderPlan('', 'prompt', [...refs, image('fifth')], 'book_identity')).toThrow('audition_reference_truncated');
  });
});

describe('topology opt-in through the real existing audition orchestrator (synthetic pixels, no provider)', () => {
  const typedBook = typedFixture;
  it('binds v12/page-context-v3 and fresh topology on every sample/downstream frame; default stays v9', async () => {
    const h = harness({ book: typedBook(), topology: true });
    const m = await illustrateReviewedAudition({ ...h.args, landmarkTopology: LANDMARK_TOPOLOGY_VERSION, sample: [1, 2] });
    expect(m.status).toBe('qa_supported_audition');
    expect((h.saved.get('audition_sheet_designs') as any).policy.version).toBe('reviewed-audition-policy/v12');
    expect(h.args.render.mock.calls.map(x => x[0])).toContain('page_8_0');
    for (const [step, c] of h.contexts) if (step.startsWith('page_')) {
      expect(c).toMatchObject({ version: 'audition-page-context/v3', landmarkDesignHead: LANDMARK_DESIGN_HEAD_VERSION,
        landmarkTopology: LANDMARK_TOPOLOGY_VERSION });
      const page = Number(step.split('_')[1]);
      expect((h.saved.get(`page_${page}`) as SavedPage).chosen.review?.landmarkInventory?.topology?.version).toBe(LANDMARK_TOPOLOGY_VERSION);
    }
    expect(reviewedAuditionPolicy().version).toBe('reviewed-audition-policy/v9');
  });
  it('missing fresh topology is unusable, stops before identity or the next sample; no schema downgrade', async () => {
    const h = harness({ book: typedBook() });
    await expect(illustrateReviewedAudition({ ...h.args, landmarkTopology: LANDMARK_TOPOLOGY_VERSION, sample: [1, 2] }))
      .rejects.toThrow('audition_review_unusable');
    expect(h.args.identity).not.toHaveBeenCalled();
    expect(h.args.render.mock.calls.map(x => x[0])).toEqual(['sheet_entities_0', 'sheet_locations_0', 'page_1_0']);
  });
  it('uncertain physical evidence holds the representative sample and prevents downstream', async () => {
    const h = harness({ book: typedBook(), inventory: (_step, context) => {
      const inv = singleInventory(context);
      inv.objects.push({ objectId: 'o3', region: 'distant background', description: 'a possible second whole landmark whose connection is hidden' });
      for (const l of inv.landmarks) {
        const own = l.candidates[0], features = context.checks.uniqueLandmarks.find((x: any) => x.id === l.landmarkId).features;
        l.candidates = inv.objects.map(o => o.objectId === own.objectId ? own : o.objectId === 'o3' && l === inv.landmarks[0] ? {
          objectId: o.objectId, association: 'possible_copy', evidence: 'matching whole with hidden physical connectivity',
          featureChecks: features.map((f: any) => ({ featureId: f.id, observed: 'matches' })),
        } : { objectId: o.objectId, association: 'different_object',
          evidence: 'visible incompatible kind', featureChecks: features.map((f: any) => ({ featureId: f.id,
            observed: f.aspect === 'kind' ? 'contradicted' : 'not_visible' })) });
      }
      return { ...inv, topology: { version: LANDMARK_TOPOLOGY_VERSION,
        relations: [
          { from: 'o1', to: 'o2', relation: 'separate_objects', basis: 'visible_separation', evidence: 'known distinct canonical bodies' },
          { from: 'o1', to: 'o3', relation: 'uncertain', basis: 'not_readable', evidence: 'matching whole connection hidden behind another object' },
          { from: 'o2', to: 'o3', relation: 'separate_objects', basis: 'visible_separation', evidence: 'known distinct canonical bodies' },
        ],
        bindings: inv.landmarks.flatMap(l => l.candidates.map(c => ({ landmarkId: l.landmarkId, objectId: c.objectId,
          sourceKind: context.checks.uniqueLandmarks.find((x: any) => x.id === l.landmarkId).features.find((f: any) => f.aspect === 'kind').text,
          extent: c.association === 'different_object' ? 'not_instance' : 'whole_instance', evidence: 'visible extent but relation remains unreadable' }))) } };
    } });
    const m = await illustrateReviewedAudition({ ...h.args, landmarkTopology: LANDMARK_TOPOLOGY_VERSION, sample: [1, 2] });
    expect(m.status).toBe('held_sample');
    // The existing engine evaluates BOTH representative samples, then gates all remaining frames (unchanged semantics).
    expect(h.args.render.mock.calls.some(x => /^page_[0345678]_/.test(x[0]))).toBe(false);
    expect((h.saved.get('page_1') as SavedPage).attempts).toHaveLength(3);
  });
  it('old saved policy/raw cannot resume as v12; rejects before any render/judge/identity', async () => {
    const book = typedBook(), old = harness({ book, pages: [1] });
    await illustrateReviewedAudition(old.args);
    const h = harness({ book, topology: true });
    await expect(illustrateReviewedAudition({ ...h.args, pages: [1], landmarkTopology: LANDMARK_TOPOLOGY_VERSION,
      resume: { designs: old.saved.get('audition_sheet_designs'), stepPrefix: 'r4_', pages: { 1: old.saved.get('page_1') as SavedPage },
        sheets: { entities: old.saved.get('sheet_entities') as any, locations: old.saved.get('sheet_locations') as any } } })).rejects.toThrow('audition_resume_binding');
    expect(h.args.render).not.toHaveBeenCalled(); expect(h.args.judge).not.toHaveBeenCalled(); expect(h.args.identity).not.toHaveBeenCalled();
  });
  it('rebinds an actual v12 saved run without fresh calls, keeps each attempt and raw evidence unchanged', async () => {
    const book = typedBook(), old = harness({ book, pages: [1, 2], topology: true });
    await illustrateReviewedAudition({ ...old.args, landmarkTopology: LANDMARK_TOPOLOGY_VERSION });
    const before = canonicalJson([...old.saved]), h = harness({ book, topology: true });
    await illustrateReviewedAudition({ ...h.args, pages: [1, 2], landmarkTopology: LANDMARK_TOPOLOGY_VERSION,
      resume: { designs: old.saved.get('audition_sheet_designs'), stepPrefix: 'r4_', pages: { 1: old.saved.get('page_1') as SavedPage, 2: old.saved.get('page_2') as SavedPage },
        sheets: { entities: old.saved.get('sheet_entities') as any, locations: old.saved.get('sheet_locations') as any } } });
    expect(h.args.render).not.toHaveBeenCalled(); expect(h.args.judge).not.toHaveBeenCalled(); expect(h.args.identity).not.toHaveBeenCalled();
    expect(canonicalJson([...old.saved])).toBe(before);
  });
  it('cannot attach topology to the spent calibration contract or an untyped source', async () => {
    const h = harness();
    for (const args of [{ ...h.args, landmarkTopology: LANDMARK_TOPOLOGY_VERSION },
      { ...h.args, book: typedBook(), landmarkTopology: LANDMARK_TOPOLOGY_VERSION, calibration: { version: AUDITION_CALIBRATION_VERSION, pages: [] } }])
      await expect(illustrateReviewedAudition(args)).rejects.toThrow('audition_landmark_contract');
    expect(h.args.render).not.toHaveBeenCalled(); expect(h.args.judge).not.toHaveBeenCalled();
  });
});

describe('prospective landmark design-head contract (legacy default is unchanged)', () => {
  const catalogue = (design: string, kind = 'boulder', enabled = true) => landmarkFeatureCatalogue([
    { attribute: 'kind', value: kind }, { attribute: 'design', value: design }], true, enabled ? LANDMARK_DESIGN_HEAD_VERSION : undefined);
  it('recovers only explicit prefixes of the declared kind, despite a trailing comparison', () => {
    const input = 'A big rounded boulder taller than the child, standing at the end of a trail';
    expect(catalogue(input, 'boulder', false).filter(f => f.decisive).map(f => f.aspect)).toEqual(['kind']);
    expect(catalogue(input).filter(f => f.decisive).map(f => [f.aspect, f.text])).toEqual([
      ['kind', 'boulder'], ['size', 'big'], ['shape', 'rounded']]);
    expect(catalogue(input).find(f => f.text === 'taller')?.decisive).toBe(false);
    expect(catalogue('The highest rounded hill in a valley with a broad flat top', 'hill').filter(f => f.decisive).map(f => f.text))
      .toEqual(['hill', 'highest', 'rounded']);
  });
  it.each(['A wooden seat of a bench', 'A red sign near a boulder', 'A boulder with a round mossy rim',
    'No red rounded boulder', 'A rounded fake boulder', 'A very red marking on a boulder'])('does not promote parts, neighbours or negation: %s', design => {
    expect(catalogue(design).filter(f => f.decisive).map(f => f.aspect)).toEqual(['kind']);
  });
  it('refuses missing/wrong contract, keeps the old instruction and context, binds the new one to its instruction', () => {
    expect(() => landmarkFeatureCatalogue([], false, LANDMARK_DESIGN_HEAD_VERSION)).toThrow('audition_landmark_contract');
    expect(() => landmarkFeatureCatalogue([], true, 'other' as any)).toThrow('audition_landmark_contract');
    expect(auditionJudgeInstruction('page', {})).toBe(AUDITION_JUDGE_INSTRUCTIONS.page);
    expect(auditionJudgeInstruction('page', { landmarkDesignHead: LANDMARK_DESIGN_HEAD_VERSION })).toContain('Perspective alone');
    expect(() => auditionJudgeInstruction('page', { landmarkDesignHead: 'other' })).toThrow('audition_landmark_contract');
    expect(reviewedAuditionPolicy().version).toBe('reviewed-audition-policy/v9');
    expect(reviewedAuditionPolicy(false, true).version).toBe('reviewed-audition-policy/v11');
    expect(() => reviewedAuditionPolicy(true, true)).toThrow('audition_landmark_contract');
  });
  it('newly decisive cues still expose genuine duplicates and hidden ambiguity; prose never dismisses an object', () => {
    const features = catalogue('A big rounded boulder taller than a child'), landmarks = [{ id: 'marker', features }];
    const objects = [1, 2].map(n => ({ objectId: `o${n}`, region: `region ${n}`, description: 'an object' }));
    const one = (second: 'matches' | 'contradicted' | 'not_visible', association = 'possible_copy') => assessLandmarkInventory({ objects,
      landmarks: [{ landmarkId: 'marker', candidates: objects.map((o, i) => ({ objectId: o.objectId, association: i ? association : 'this_landmark',
        evidence: 'prose is not a typed verdict', featureChecks: features.map(f => ({ featureId: f.id,
          observed: i && f.aspect !== 'kind' ? second : 'matches' })) })) }] } as any, landmarks);
    expect(one('matches')).toMatchObject([{ instances: 2, strong: 2 }]);
    expect(one('not_visible')).toMatchObject([{ instances: 2, strong: 1 }]);
    expect(one('contradicted', 'different_object')).toMatchObject([{ instances: 1, strong: 1 }]);
    expect(one('not_visible', 'different_object')).toMatchObject([{ instances: 2, strong: 1 }]);
  });
});

describe('one-use sample calibration: new evidence, no legacy PASS conversion or attempt reset', () => {
  const heldSpec: Spec = { identity: { issues: [issue('identity', 'cast:companion')] } };
  const setup = async () => {
    const book = fixture();
    book.landmarkKind = LANDMARK_KIND_CONTRACT_VERSION;
    for (const e of book.plan.continuity!.entities.filter(e => e.kind === 'landmark')) e.invariants.unshift({ attribute: 'kind', value: 'tree' });
    const h = harness({ book, judge: s => s.startsWith('page_2_') ? heldSpec : {} });
    await illustrateReviewedAudition({ ...h.args, sample: [1, 2] });
    const pages = { 1: h.saved.get('page_1') as SavedPage, 2: h.saved.get('page_2') as SavedPage };
    const calibration: AuditionCalibration = { version: AUDITION_CALIBRATION_VERSION, pages: [1, 2].map(page => ({ page,
      action: page === 1 ? 'requalify' : 'correct_once', priorSha256: previewSha(canonicalJson(pages[page as 1 | 2])),
      consumedAttemptsBefore: pages[page as 1 | 2].attempts.length })) };
    const resume = { designs: h.saved.get('audition_sheet_designs'), sheets: { entities: h.saved.get('sheet_entities') as any,
      locations: h.saved.get('sheet_locations') as any }, pages, stepPrefix: 'r1_' };
    return { h, book, pages, calibration, resume };
  };
  it('requalifies first without render, adds exactly attempt 4 to held sample, only then draws downstream; parents immutable', async () => {
    const s = await setup(), before = canonicalJson(s.pages), r = harness({ book: s.book });
    const manifest = await illustrateReviewedAudition({ ...r.args, sample: [1, 2], resume: s.resume, calibration: s.calibration });
    expect(r.args.render.mock.calls.map(c => c[0])).toEqual(['r1_page_2_3', ...[0, 3, 4, 5, 6, 7, 8].map(n => `r1_page_${n}_0`)]);
    expect(r.args.judge.mock.calls[0][0]).toBe('r1_page_1_0_qa');
    expect(r.contexts.get('r1_page_1_0_qa').landmarkDesignHead).toBe(LANDMARK_DESIGN_HEAD_VERSION);
    expect(r.saved.get('page_1')).toBeUndefined();
    expect(r.saved.get('page_2')).toBeUndefined();
    expect(r.saved.get('page_2_calibration')).toMatchObject({ consumedAttemptsBefore: 3, reviewed: { attempt: 3 }, status: 'qa_supported' });
    expect(manifest.pages.find(p => p.pageNumber === 2)).toMatchObject({ calibration: { consumedAttemptsBefore: 3, priorAttempts: s.pages[2].attempts } });
    expect(canonicalJson(s.pages)).toBe(before);
    expect(manifest.scope.complete).toBe(true);
  });
  it.each([1, 2])('a held fresh sample %i stops downstream, even though the old first sample passed', async page => {
    const s = await setup(), r = harness({ book: s.book, judge: step => step.startsWith(`r1_page_${page}_`) ? heldSpec : {} });
    const m = await illustrateReviewedAudition({ ...r.args, sample: [1, 2], resume: s.resume, calibration: s.calibration });
    expect(m.status).toBe('held_sample');
    expect(r.args.render.mock.calls.map(c => c[0])).toEqual(page === 1 ? [] : ['r1_page_2_3']);
  });
  it('refuses altered parent, reset attempt count, two corrections or missing sample BEFORE any paid adapter', async () => {
    const s = await setup();
    for (const mutation of [
      (c: AuditionCalibration) => { c.pages[1].priorSha256 = sha('wrong'); },
      (c: AuditionCalibration) => { c.pages[1].consumedAttemptsBefore = 0; },
      (c: AuditionCalibration) => { c.pages[0].action = 'correct_once'; },
      (c: AuditionCalibration) => { c.pages.shift(); },
    ]) {
      const c = structuredClone(s.calibration); mutation(c); const r = harness({ book: s.book });
      await expect(illustrateReviewedAudition({ ...r.args, sample: [1, 2], resume: s.resume, calibration: c })).rejects.toThrow('audition_calibration_binding');
      expect([r.args.render.mock.calls.length, r.args.judge.mock.calls.length, r.args.identity.mock.calls.length]).toEqual([0, 0, 0]);
    }
  });
  it('rebinds saved successors without calls; rejects old-context review and forged verdict', async () => {
    const s = await setup(), r = harness({ book: s.book });
    await illustrateReviewedAudition({ ...r.args, pages: [1, 2], sample: [1, 2], resume: s.resume, calibration: s.calibration });
    const c = structuredClone(s.calibration);
    c.pages.forEach(p => { p.saved = r.saved.get(`page_${p.page}_calibration`) as SavedCalibration; });
    const later = harness({ book: s.book });
    await illustrateReviewedAudition({ ...later.args, pages: [1, 2], sample: [1, 2], resume: s.resume, calibration: c });
    expect([later.args.render.mock.calls.length, later.args.judge.mock.calls.length]).toEqual([0, 0]);
    for (const change of [(x: SavedCalibration) => { x.reviewed.review = s.pages[1].chosen.review; },
      (x: SavedCalibration) => { x.reviewed.status = 'held'; }]) {
      const bad = structuredClone(c); change(bad.pages[0].saved!);
      await expect(illustrateReviewedAudition({ ...harness({ book: s.book }).args, pages: [1, 2], sample: [1, 2], resume: s.resume, calibration: bad }))
        .rejects.toThrow();
    }
  });
});

describe('new topology continuation follows a consumed held calibration; synthetic engine wiring only', () => {
  const heldSpec: Spec = { identity: { issues: [issue('identity', 'cast:companion')] } };
  const setup = async () => {
    const book = typedFixture(), old = harness({ book, judge: step => step === 'page_1_0_qa' || step.startsWith('page_2_') ? heldSpec : {} });
    await illustrateReviewedAudition({ ...old.args, sample: [1, 2] });
    const pages = { 1: old.saved.get('page_1') as SavedPage, 2: old.saved.get('page_2') as SavedPage };
    expect(pages[1].attempts).toHaveLength(2); expect(pages[2].attempts).toHaveLength(3);
    const parentCalibration: AuditionCalibration = { version: AUDITION_CALIBRATION_VERSION, pages: [1, 2].map(page => ({ page,
      action: page === 1 ? 'requalify' : 'correct_once', priorSha256: previewSha(canonicalJson(pages[page as 1 | 2])),
      consumedAttemptsBefore: pages[page as 1 | 2].attempts.length })) };
    const resume = { designs: old.saved.get('audition_sheet_designs'), pages, stepPrefix: 'r4_', sheets: {
      entities: old.saved.get('sheet_entities') as any, locations: old.saved.get('sheet_locations') as any } };
    const previous = harness({ book, inventory: (_step, context) => {
      const inv = singleInventory(context), l = context.checks.uniqueLandmarks[0];
      inv.objects.push({ objectId: 'o3', region: 'background', description: 'possible whole, attachment unreadable' });
      inv.landmarks[0].candidates.push({ objectId: 'o3', association: 'possible_copy', evidence: 'one required feature visible, others unreadable',
        featureChecks: l.features.map((f: any) => ({ featureId: f.id, observed: f.aspect === 'kind' ? 'matches' : 'not_visible' })) });
      return inv;
    } });
    const m = await illustrateReviewedAudition({ ...previous.args, sample: [1, 2], resume, calibration: parentCalibration });
    expect(m.status).toBe('held_sample'); expect(previous.args.render).not.toHaveBeenCalled();
    const saved = previous.saved.get('page_1_calibration') as SavedCalibration;
    expect(saved.reviewed.assessment?.findings.some(f => f.derived && f.verdict === 'uncertain')).toBe(true);
    parentCalibration.pages[0].saved = saved;
    const effective = calibrationRequalificationParent(pages[1], saved);
    const contract: AuditionTopologyContinuation = { version: AUDITION_TOPOLOGY_CONTINUATION_VERSION, parentCalibration,
      pages: [effective, pages[2]].map((p, i) => ({ page: i + 1, action: i === 0 ? 'requalify' : 'correct_once',
        priorSha256: previewSha(canonicalJson(p)), consumedAttemptsBefore: i === 0 ? 2 : 3 })) };
    return { book, old, previous, resume, contract, pages, saved };
  };
  it('fresh v12 requalifies the identical first image, carries both old counts, makes only fourth second sample then downstream', async () => {
    const s = await setup(), before = canonicalJson([s.pages, s.saved]), h = harness({ book: s.book, topology: true });
    const m = await illustrateReviewedAudition({ ...h.args, sample: [1, 2], resume: s.resume,
      topologyContinuation: s.contract, landmarkTopology: LANDMARK_TOPOLOGY_VERSION });
    expect(h.args.render.mock.calls.map(c => c[0])).toEqual(['r4_page_2_3', ...[0, 3, 4, 5, 6, 7, 8].map(n => `r4_page_${n}_0`)]);
    expect(h.args.judge.mock.calls[0][0]).toBe('r4_page_1_1_qa');
    expect(h.args.judge.mock.calls[0][1]).toEqual(s.pages[1].chosen.candidate);
    expect(h.contexts.get('r4_page_1_1_qa')).toMatchObject({ version: 'audition-page-context/v3', landmarkTopology: LANDMARK_TOPOLOGY_VERSION });
    expect(h.saved.get('page_1_topology')).toMatchObject({ version: AUDITION_TOPOLOGY_CONTINUATION_VERSION, consumedAttemptsBefore: 2,
      reviewed: { attempt: 1, status: 'qa_supported' } });
    expect(h.saved.get('page_2_topology')).toMatchObject({ consumedAttemptsBefore: 3, reviewed: { attempt: 3, status: 'qa_supported' } });
    expect(m.pages.find(p => p.pageNumber === 1)?.topologyContinuation?.prior.calibration?.priorAttempts).toEqual(s.pages[1].attempts);
    expect(m.pages.find(p => p.pageNumber === 2)?.topologyContinuation?.prior.attempts).toEqual(s.pages[2].attempts);
    expect(m.status).toBe('qa_supported_audition'); expect(canonicalJson([s.pages, s.saved])).toBe(before);
    expect(h.saved.get('page_1_calibration')).toBeUndefined(); expect(h.saved.get('page_2')).toBeUndefined();
  });
  it.each([1, 2])('fresh held sample %i stops before later paid work, never redraws the first or retries the fourth', async page => {
    const s = await setup(), h = harness({ book: s.book, topology: true, judge: step => step.startsWith(`r4_page_${page}_`) ? heldSpec : {} });
    const m = await illustrateReviewedAudition({ ...h.args, sample: [1, 2], resume: s.resume,
      topologyContinuation: s.contract, landmarkTopology: LANDMARK_TOPOLOGY_VERSION });
    expect(m.status).toBe('held_sample'); expect(h.args.render.mock.calls.map(c => c[0])).toEqual(page === 1 ? [] : ['r4_page_2_3']);
    expect(h.args.judge.mock.calls).toHaveLength(page === 1 ? 1 : 2);
  });
  it('rejects changed source context/raw/assessment/candidate/count and successor reuse BEFORE any fresh adapter', async () => {
    const s = await setup();
    const mutations = [
      (c: AuditionTopologyContinuation) => { c.pages[1].consumedAttemptsBefore = 0; },
      (c: AuditionTopologyContinuation) => { c.pages[0].priorSha256 = sha('other'); },
      (c: AuditionTopologyContinuation) => { c.parentCalibration.pages[0].saved!.contextSha = sha('other'); },
      (c: AuditionTopologyContinuation) => { c.parentCalibration.pages[0].saved!.reviewed.candidate = image('other'); },
      (c: AuditionTopologyContinuation) => { c.parentCalibration.pages[0].saved!.reviewed.review = s.pages[1].chosen.review; },
      (c: AuditionTopologyContinuation) => { c.parentCalibration.pages[0].saved!.reviewed.assessment = s.pages[1].chosen.assessment; },
      (c: AuditionTopologyContinuation) => { (c.pages[0] as { saved?: unknown }).saved = c.parentCalibration.pages[0].saved; },
      (c: AuditionTopologyContinuation) => { c.parentCalibration.pages[1].saved = c.parentCalibration.pages[0].saved; },
    ];
    for (const mutate of mutations) {
      const c = structuredClone(s.contract); mutate(c); const h = harness({ book: s.book, topology: true });
      await expect(illustrateReviewedAudition({ ...h.args, sample: [1, 2], resume: s.resume,
        topologyContinuation: c, landmarkTopology: LANDMARK_TOPOLOGY_VERSION })).rejects.toThrow();
      expect([h.args.render.mock.calls.length, h.args.judge.mock.calls.length, h.args.identity.mock.calls.length]).toEqual([0, 0, 0]);
    }
  });
  it('an unusable fresh v12 response cannot be replaced by the saved v11 answer; no identity or downstream retry', async () => {
    const s = await setup(), h = harness({ book: s.book });
    await expect(illustrateReviewedAudition({ ...h.args, sample: [1, 2], resume: s.resume,
      topologyContinuation: s.contract, landmarkTopology: LANDMARK_TOPOLOGY_VERSION })).rejects.toThrow('audition_review_unusable');
    expect(h.args.render).not.toHaveBeenCalled(); expect(h.args.judge.mock.calls).toHaveLength(1); expect(h.args.identity).not.toHaveBeenCalled();
  });
  it.each(['legacy-after-calibration', 'topology-already-used', 'topology-missing-parent'])('runner keeps %s closed before guard/key/book/grant access', async test => {
    const out = mkdtempSync(path.join(tmpdir(), 'audition-topology-closed-'));
    if (test === 'legacy-after-calibration') writeFileSync(path.join(out, 'admission-calibration.json'), '{}');
    if (test === 'topology-already-used') writeFileSync(path.join(out, 'admission-topology.json'), '{}');
    const guard = vi.fn();
    const args: Parameters<typeof runReviewedAudition>[0] = { bookDir: 'DO_NOT_READ', out, keyFile: 'DO_NOT_READ', grantFile: 'DO_NOT_READ',
      signal: new AbortController().signal, log: () => {}, resume: true, experiment: { slot: 'synthetic', claimSha256: sha('claim'), guard } };
    if (test === 'topology-missing-parent') args.topologyContinuation = { grantSha256: sha('grant'),
      contract: { version: AUDITION_TOPOLOGY_CONTINUATION_VERSION, parentCalibration: { version: AUDITION_CALIBRATION_VERSION, pages: [] }, pages: [] },
      firstReview: { step: 'r4_page_1_1_qa', wireDigest: sha('wire') } };
    await expect(runReviewedAudition(args)).rejects.toThrow(test === 'legacy-after-calibration' ? 'audition_calibration_used' :
      test === 'topology-already-used' ? 'audition_topology_used' : 'audition_topology_parent');
    expect(guard).not.toHaveBeenCalled();
  });
  const coverageSetup = async () => {
    const s = await setup(), h = harness({ book: s.book, topology: true,
      judge: () => ({ environment: { verdict: 'uncertain', issues: [issue('continuity', 'landmark_unique:old_tree', 'coverage unreadable')] } }) });
    await illustrateReviewedAudition({ ...h.args, sample: [1, 2], resume: s.resume,
      topologyContinuation: s.contract, landmarkTopology: LANDMARK_TOPOLOGY_VERSION });
    const savedTopology = h.saved.get('page_1_topology') as SavedTopologyContinuation;
    const first = topologyRequalificationParent(calibrationRequalificationParent(s.pages[1], s.saved), savedTopology);
    const contract: AuditionCoverageContinuation = { version: AUDITION_COVERAGE_CONTINUATION_VERSION,
      parentTopology: s.contract, savedTopology, pages: [first, s.pages[2]].map((p, i) => ({ page: i + 1,
        action: i === 0 ? 'requalify' : 'correct_once', priorSha256: previewSha(canonicalJson(p)), consumedAttemptsBefore: i === 0 ? 2 : 3 })) };
    return { ...s, savedTopology, coverage: contract, resume: { ...s.resume, stepPrefix: 'r5_' } };
  };
  it('prospective coverage replays consumed v12, reviews identical first, draws only page2fourth then same full book', async () => {
    const s = await coverageSetup(), before = canonicalJson([s.pages, s.saved, s.savedTopology]), h = harness({ book: s.book, coverage: true });
    const m = await illustrateReviewedAudition({ ...h.args, sample: [1, 2], resume: s.resume,
      coverageContinuation: s.coverage, landmarkTopology: LANDMARK_COVERAGE_TOPOLOGY_VERSION });
    expect(h.args.render.mock.calls.map(c => c[0])).toEqual(['r5_page_2_3', ...[0, 3, 4, 5, 6, 7, 8].map(n => `r5_page_${n}_0`)]);
    expect(h.args.judge.mock.calls[0][0]).toBe('r5_page_1_1_qa');
    expect(h.args.judge.mock.calls[0][1]).toEqual(s.pages[1].chosen.candidate);
    expect(m.policy.version).toBe('reviewed-audition-policy/v13'); expect(m.status).toBe('qa_supported_audition');
    expect(m.pages.map(p => p.pageNumber)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    for (const [step, ctx] of h.contexts) if (step.includes('page_')) expect(ctx).toMatchObject({
      version: 'audition-page-context/v4', landmarkTopology: LANDMARK_COVERAGE_TOPOLOGY_VERSION, landmarkCoverage: 'landmark-candidate-coverage/v1' });
    expect(m.pages.find(p => p.pageNumber === 1)?.coverageContinuation?.prior.topologyContinuation?.prior.calibration?.priorAttempts).toEqual(s.pages[1].attempts);
    expect(m.pages.find(p => p.pageNumber === 2)?.coverageContinuation?.prior.attempts).toEqual(s.pages[2].attempts);
    expect(h.saved.get('page_2_coverage')).toMatchObject({ consumedAttemptsBefore: 3, reviewed: { attempt: 3 } });
    expect(canonicalJson([s.pages, s.saved, s.savedTopology])).toBe(before);
    expect(h.saved.get('page_1_topology')).toBeUndefined(); expect(h.saved.get('page_2')).toBeUndefined();
  });
  it.each([1, 2])('v13 held sample%i ends the line without a retry/fifth or downstream drawings', async page => {
    const s = await coverageSetup(), h = harness({ book: s.book, coverage: true,
      judge: step => step.startsWith(`r5_page_${page}_`) ? heldSpec : {} });
    const m = await illustrateReviewedAudition({ ...h.args, sample: [1, 2], resume: s.resume,
      coverageContinuation: s.coverage, landmarkTopology: LANDMARK_COVERAGE_TOPOLOGY_VERSION });
    expect(m.status).toBe('held_sample'); expect(h.args.render.mock.calls.map(c => c[0])).toEqual(page === 1 ? [] : ['r5_page_2_3']);
    expect(h.args.judge.mock.calls).toHaveLength(page === 1 ? 1 : 2);
  });
  it.each(['low_identity', 'safety', 'missing_new_schema'])('v13 %s cannot permit any downstream', async reason => {
    const s = await coverageSetup(), h = harness({ book: s.book, ...(reason === 'missing_new_schema' ? { topology: true as const } : { coverage: true as const }),
      score: () => reason === 'low_identity' ? .69 : .82,
      judge: () => reason === 'safety' ? { safety: { issues: [issue('safety', 'safety', 'unsafe actual content')] } } : {} });
    const run = illustrateReviewedAudition({ ...h.args, sample: [1, 2], resume: s.resume,
      coverageContinuation: s.coverage, landmarkTopology: LANDMARK_COVERAGE_TOPOLOGY_VERSION });
    if (reason === 'missing_new_schema') await expect(run).rejects.toThrow('audition_review_unusable');
    else if (reason === 'safety') { await expect(run).rejects.toThrow('audition_calibration_unavailable'); expect(h.args.identity).not.toHaveBeenCalled(); }
    else expect((await run).status).toBe('held_sample');
    expect(h.args.render).not.toHaveBeenCalled();
  });
  it('coverage rejects a changed consumed raw/assessment/context/candidate/attempt/prior and version before any new adapter', async () => {
    const s = await coverageSetup();
    const changes = [
      (c: any) => c.savedTopology.contextSha = sha('changed'), (c: any) => c.savedTopology.reviewed.review = s.saved.reviewed.review,
      (c: any) => c.savedTopology.reviewed.assessment = s.saved.reviewed.assessment, (c: any) => c.savedTopology.reviewed.candidate = image('changed'),
      (c: any) => c.pages[0].priorSha256 = sha('changed'), (c: any) => c.pages[1].consumedAttemptsBefore = 0,
      (c: any) => c.parentTopology.parentCalibration.pages[0].saved.reviewed.status = 'qa_supported',
      (c: any) => c.version = AUDITION_TOPOLOGY_CONTINUATION_VERSION,
    ];
    for (const change of changes) {
      const c = structuredClone(s.coverage); change(c); const h = harness({ book: s.book, coverage: true });
      await expect(illustrateReviewedAudition({ ...h.args, sample: [1, 2], resume: s.resume,
        coverageContinuation: c, landmarkTopology: LANDMARK_COVERAGE_TOPOLOGY_VERSION })).rejects.toThrow();
      expect([h.args.render.mock.calls.length, h.args.judge.mock.calls.length, h.args.identity.mock.calls.length]).toEqual([0, 0, 0]);
    }
  });
});

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
  describe('declared landmark kind (opt-in storyboard contract): a decisive whole-object cue of its own aspect (Phase 2)', () => {
    const k = (id: string, kind: string, design: string): AuditionLandmark =>
      ({ id, features: landmarkFeatureCatalogue([{ attribute: 'kind', value: kind }, { attribute: 'design', value: design }], true) });
    const thorn = k('thorn', 'thorn bush', 'Low dusty-green thorn bush beside the path before the rock, with a forked outward-facing twig.');
    const benchK = k('bench', 'bench', 'Three wooden seat slats, three back slats and two dark iron supports; behind the tree.');
    const swingK = k('swing', 'swing', 'Single rectangular wooden seat on two cream ropes, supported by a separate wooden frame on the right lawn.');
    const rockK = k('stone', 'rock', 'Large pale-gray rounded rock with one diagonal ochre seam and a low burrow opening beneath its front lip; rear right of garden.');
    const pair = [obj('o1', 'lower-right foreground'), obj('o2', 'background across the upper middle')];
    it('builds the kind cue only under the contract, as one phrase; without it a "kind" field is ordinary text', () => {
      expect(thorn.features.map(x => `${x.decisive ? '+' : '~'}${x.aspect}:${x.text}`)).toEqual(['+kind:thorn bush', '+size:low', '+colour:dusty-green', '~shape:forked']);
      expect(landmarkFeatureCatalogue([{ attribute: 'kind', value: 'thorn bush' }, { attribute: 'design', value: 'Low dusty-green thorn bush' }]).some(x => x.aspect === 'kind')).toBe(false);
      expect(() => landmarkFeatureCatalogue([{ attribute: 'design', value: 'Low dusty-green thorn bush' }], true)).toThrow('audition_landmark_kind');
      expect(() => landmarkFeatureCatalogue([{ attribute: 'Kind', value: 'thorn bush' }], true)).toThrow('audition_landmark_kind');
      expect(() => landmarkFeatureCatalogue([{ attribute: 'kind', value: 'bush' }, { attribute: 'kind', value: 'hedge' }], true)).toThrow('audition_landmark_kind');
      // The declared kind is one cue: a vocabulary word inside it ("stone") never becomes a second, material cue.
      expect(landmarkFeatureCatalogue([{ attribute: 'kind', value: 'stone wall' }, { attribute: 'design', value: 'Long low wall' }], true)
        .map(x => `${x.decisive ? '+' : '~'}${x.aspect}:${x.text}`)).toEqual(['+kind:stone wall', '+size:long', '+size:low']);
    });
    it('a background hedge whose kind is contradicted is dismissed although it is also low and green (the rejudge-3 false positive shape)', () => {
      const a = assessWith([thorn], pair, { thorn: [cand('o1', 'this_landmark', {}, thorn), cand('o2', 'different_object', { 'thorn bush': 'contradicted', forked: 'not_visible' }, thorn)] });
      expect(of(a, 'thorn')).toMatchObject({ instances: 1 });
      expect(a.findings).toEqual([]);
      expect(held(a)).toBe('qa_supported');
    });
    it('a kind contradiction never quietly erases a possible copy, and a hidden kind never dismisses', () => {
      const possible = assessWith([thorn], pair, { thorn: [cand('o1', 'this_landmark', {}, thorn), cand('o2', 'possible_copy', { 'thorn bush': 'contradicted', forked: 'not_visible' }, thorn)] });
      expect(possible.findings).toEqual([expect.objectContaining({ requirement: 'landmark_unique:thorn', verdict: 'uncertain' })]);
      const hidden = assessWith([thorn], pair, { thorn: [cand('o1', 'this_landmark', {}, thorn), cand('o2', 'different_object', { 'thorn bush': 'not_visible', forked: 'not_visible' }, thorn)] });
      expect(of(hidden, 'thorn')).toMatchObject({ instances: 2, reclassified: 1 });
      expect(hidden.findings).toEqual([expect.objectContaining({ requirement: 'landmark_unique:thorn', verdict: 'defect' })]);
    });
    it('a real duplicate of the same kind stays a defect', () => {
      const a = assessWith([rockK], pair, { stone: [cand('o1', 'this_landmark', {}, rockK), cand('o2', 'possible_copy', { low: 'not_visible' }, rockK)] });
      expect(of(a)).toMatchObject({ instances: 2, strong: 2 });
      expect(a.findings).toEqual([expect.objectContaining({ requirement: 'landmark_unique:stone', verdict: 'defect' })]);
    });
    it('material is judged as material: the wooden swing seat is dismissed from the bench by its kind, not by "not wooden"', () => {
      const objects = [obj('o1', 'bench behind the tree'), obj('o2', 'right edge seat and ropes')];
      const a = assessWith([benchK, swingK], objects, { bench: [cand('o1', 'this_landmark', {}, benchK), cand('o2', 'different_object', { bench: 'contradicted' }, benchK)],
        swing: [cand('o2', 'this_landmark', {}, swingK), cand('o1', 'different_object', { swing: 'contradicted' }, swingK)] });
      expect(of(a, 'bench').candidates[1]).toMatchObject({ objectId: 'o2', counted: false, contradictedCore: ['f1'] });
      expect(of(a, 'bench').candidates[1].matchedCore).toContain('f2');
      expect(a.findings).toEqual([]);
    });
    it('a cropped swing (seat hidden) is resolved through kind: no bench or swing ambiguity remains', () => {
      const objects = [obj('o1', 'bench behind the tree'), obj('o2', 'frame and ropes behind the rock')];
      const seatHidden = { rectangular: 'not_visible', wooden: 'not_visible' } as Seen;
      const a = assessWith([benchK, swingK], objects, { bench: [cand('o1', 'this_landmark', {}, benchK), cand('o2', 'different_object', { bench: 'contradicted', wooden: 'not_visible' }, benchK)],
        swing: [cand('o2', 'this_landmark', seatHidden, swingK), cand('o1', 'different_object', { swing: 'contradicted' }, swingK)] });
      expect(a.findings).toEqual([]);
      expect(held(a)).toBe('qa_supported');
      // If the checker leaves the bench's kind open for that object, the ambiguity stays: kind alone (one aspect) does not confirm the owner.
      const open = assessWith([benchK, swingK], objects, { bench: [cand('o1', 'this_landmark', {}, benchK), cand('o2', 'possible_copy', { bench: 'not_visible', wooden: 'not_visible' }, benchK)],
        swing: [cand('o2', 'this_landmark', seatHidden, swingK)] });
      expect(of(open, 'bench').candidates[1]).toMatchObject({ identityConfirmed: false, counted: true });
      expect(open.findings).toEqual([expect.objectContaining({ requirement: 'landmark_unique:bench', verdict: 'uncertain' })]);
    });
    it('a shared kind alone cannot exclude; a genuinely distinguishing whole-object cue can', () => {
      const a1 = k('bench_a', 'bench', 'Long brown wooden bench'), b1 = k('bench_b', 'bench', 'Long brown wooden bench');
      const objects = [obj('o1', 'left'), obj('o2', 'right')];
      const shared = assessWith([a1, b1], objects, { bench_a: [cand('o1', 'this_landmark', {}, a1), cand('o2', 'possible_copy', { long: 'not_visible', brown: 'not_visible', wooden: 'not_visible' }, a1)],
        bench_b: [cand('o2', 'this_landmark', {}, b1)] });
      expect(of(shared, 'bench_a')).toMatchObject({ instances: 2, excluded: 0 });
      expect(of(shared, 'bench_a').candidates[1]).toMatchObject({ identityConfirmed: false });
      const b2 = k('bench_b', 'bench', 'Short green metal bench');
      const distinct = assessWith([a1, b2], objects, { bench_a: [cand('o1', 'this_landmark', {}, a1), cand('o2', 'possible_copy', { long: 'not_visible', brown: 'not_visible', wooden: 'not_visible' }, a1)],
        bench_b: [cand('o2', 'this_landmark', {}, b2)] });
      expect(of(distinct, 'bench_a')).toMatchObject({ instances: 1, excluded: 1 });
    });
    it('kind on the claimed owner: hidden is no evidence, contradicted blocks the claim', () => {
      const objects = [obj('o1', 'bench behind the tree'), obj('o2', 'right edge seat')];
      const run = (swingSeen: Seen) => assessWith([benchK, swingK], objects, { bench: [cand('o1', 'this_landmark', {}, benchK),
        cand('o2', 'possible_copy', { bench: 'not_visible', dark: 'not_visible', iron: 'not_visible' }, benchK)], swing: [cand('o2', 'this_landmark', swingSeen, swingK)] });
      expect(of(run({ swing: 'not_visible', rectangular: 'not_visible' }), 'bench').candidates[1]).toMatchObject({ identityConfirmed: false });
      expect(of(run({ swing: 'contradicted' }), 'bench').candidates[1]).toMatchObject({ identityConfirmed: false });
      expect(of(run({}), 'bench').candidates[1]).toMatchObject({ identityConfirmed: true, excluded: true });
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
    expect(page).toContain('Judge each feature ONLY on its own aspect and text');
    expect(page).toContain('a difference in count, structure or sort of object never contradicts a material, colour,');
    expect(page).toContain('kind = what sort of object it is (a copy of a landmark is the same kind; a hidden or unreadable kind is not_visible)');
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
  it('a book compiled under the landmark-kind contract carries its kind cues to every page check and records the contract in the manifest', async () => {
    const kindBook = fixture() as any;
    for (const e of kindBook.plan.continuity.entities.filter((x: any) => x.kind === 'landmark')) e.invariants.push({ attribute: 'kind', value: e.id === 'stone' ? 'rock' : 'tree' });
    kindBook.landmarkKind = LANDMARK_KIND_CONTRACT_VERSION;
    const h = harness({ book: kindBook, pages: [4] });
    const m = await illustrateReviewedAudition(h.args);
    expect(m).toMatchObject({ landmarkKind: LANDMARK_KIND_CONTRACT_VERSION });
    const stoneFeatures = h.contexts.get('page_4_0_qa').checks.uniqueLandmarks.find((l: AuditionLandmark) => l.id === 'stone').features;
    expect(stoneFeatures[0]).toMatchObject({ aspect: 'kind', text: 'rock', decisive: true });
    // Without the marker the same invariants are ordinary design data and no manifest field appears.
    const plain = fixture() as any;
    for (const e of plain.plan.continuity.entities.filter((x: any) => x.kind === 'landmark')) e.invariants.push({ attribute: 'kind', value: 'rock' });
    const p = harness({ book: plain, pages: [4] });
    const mp = await illustrateReviewedAudition(p.args);
    expect('landmarkKind' in mp).toBe(false);
    expect(p.contexts.get('page_4_0_qa').checks.uniqueLandmarks.flatMap((l: AuditionLandmark) => l.features).some((x: any) => x.aspect === 'kind')).toBe(false);
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

  it('owner acceptance: every page packet of a render and of a re-judge is built under it (passed through, never dropped); absent, as before', async () => {
    const marker = { accepted: 'owner record (synthetic)' };
    const h = harness(), plain = harness();
    await illustrateReviewedAudition({ ...h.args, ownerAcceptance: marker });
    await illustrateReviewedAudition(plain.args);
    const pageSteps = (m: Map<string, any>) => [...m.keys()].filter(k => k.startsWith('page_'));
    expect(pageSteps(h.contexts)).toHaveLength(9);
    for (const step of pageSteps(h.contexts)) expect(h.contexts.get(step).packet).toEqual({ pageNumber: expect.any(Number), ownerAcceptance: marker });
    expect(pageSteps(plain.contexts)).toHaveLength(9);
    for (const step of pageSteps(plain.contexts)) expect(plain.contexts.get(step).packet).toEqual({ pageNumber: expect.any(Number) });
    // A re-judge of a saved image is judged against the same packet.
    const canonical = [image('child'), image('companion'), image('sheet_entities_0'), image('sheet_locations_0')];
    const refs = { entities: { image: canonical[2], status: 'approved_reference' as const, knownFlaws: [] }, locations: { image: canonical[3], status: 'approved_reference' as const, knownFlaws: [] } };
    const frames = [{ pageNumber: 4, candidate: image('page_4_0'), predecessor: null, label: 'saved p4' }];
    const rj = harness(), rp = harness();
    await rejudgeAudition({ book: fixture(), rawReview: {}, current: rj.args.current, companionDescription: 'x', canonical, references: refs, frames,
      judge: rj.args.judge, check: vi.fn(), save: vi.fn(), ownerAcceptance: marker });
    expect(rj.contexts.get('rejudge_0_page_4').packet).toEqual({ pageNumber: 4, ownerAcceptance: marker });
    await rejudgeAudition({ book: fixture(), rawReview: {}, current: rp.args.current, companionDescription: 'x', canonical, references: refs, frames,
      judge: rp.args.judge, check: vi.fn(), save: vi.fn() });
    expect(rp.contexts.get('rejudge_0_page_4').packet).toEqual({ pageNumber: 4 });
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
    // An early sample must name granted narrative pages, ascending, at most two.
    expect(readAuditionGrant(write({ ...grant, scope: { mode: 'render', pages: [0, 1, 3, 6], sample: [1, 3] } }), book).grant.scope).toMatchObject({ sample: [1, 3] });
    for (const sample of [[2], [3, 1], [1, 1], [0], [1, 3, 6], []])
      expect(() => readAuditionGrant(write({ ...grant, scope: { mode: 'render', pages: [0, 1, 3, 6], sample } }), book), JSON.stringify(sample)).toThrow();
  });
});

describe('early sample: drawn first, the rest only when every sample page is supported', () => {
  const pageSteps = (h: ReturnType<typeof harness>) => h.args.render.mock.calls.map(c => String(c[0])).filter(s => s.startsWith('page_'));
  it('supported sample: the sample pages first (same scene, compared in order), then every other frame in book order', async () => {
    const h = harness(), m = await illustrateReviewedAudition({ ...h.args, sample: [1, 2] });
    expect(pageSteps(h)).toEqual(['page_1_0', 'page_2_0', 'page_0_0', ...[3, 4, 5, 6, 7, 8].map(n => `page_${n}_0`)]);
    expect(h.args.judge.mock.calls.find(c => c[0] === 'page_2_0_qa')![5]).toEqual(image('page_1_0'));
    expect(m).toMatchObject({ status: 'qa_supported_audition', scope: { frames: [0, 1, 2, 3, 4, 5, 6, 7, 8], complete: true, sample: [1, 2] } });
    expect(m.scope).not.toHaveProperty('stoppedAfterSample');
  });
  it('a held sample page stops the run before any other frame is drawn', async () => {
    const h = harness({ judge: step => step.startsWith('page_2_') ? { environment: { issues: [issue('continuity', 'landmark_unique:stone', 'a second stone')] } } : {} });
    const m = await illustrateReviewedAudition({ ...h.args, sample: [1, 2] });
    expect(pageSteps(h)).toEqual(['page_1_0', 'page_2_0', 'page_2_1', 'page_2_2']);
    expect(m).toMatchObject({ status: 'held_sample', scope: { frames: [1, 2], complete: false, sample: [1, 2], requestedFrames: [0, 1, 2, 3, 4, 5, 6, 7, 8],
      stoppedAfterSample: true } });
    expect(m.pages.map(p => [p.pageNumber, p.status])).toEqual([[1, 'qa_supported'], [2, 'held']]);
    expect(h.saved.get('reviewed_audition_manifest')).toMatchObject({ status: 'held_sample' });
  });
  it('a sample that is the whole scope still reports held_sample when held, and never draws an unrequested frame', async () => {
    const h = harness({ score: step => step.startsWith('page_4_') ? .4 : .82 });
    const m = await illustrateReviewedAudition({ ...h.args, pages: [4, 5], sample: [4, 5] });
    expect(m).toMatchObject({ status: 'held_sample', scope: { frames: [4, 5], complete: false } });
    expect(pageSteps(h).every(s => /^page_[45]_/.test(s))).toBe(true);
  });
  it.each([[[0]], [[2, 1]], [[1, 1]], [[1, 2, 3]], [[]], [[9]]])('refuses sample %j', async sample => {
    const h = harness();
    await expect(illustrateReviewedAudition({ ...h.args, sample })).rejects.toThrow('audition_sample_scope');
    expect(h.args.render).not.toHaveBeenCalled();
  });
  it('refuses a sample page outside the requested frames', async () => {
    const h = harness();
    await expect(illustrateReviewedAudition({ ...h.args, pages: [0, 1, 2], sample: [3] })).rejects.toThrow('audition_sample_scope');
  });
});

describe('the finished book reads in book order and says honestly what it is', () => {
  const html = (m: Awaited<ReturnType<typeof illustrateReviewedAudition>>) =>
    reviewedAuditionHTML(m, { title: 'Title', pages: texts.map(text => ({ text })) }, (i, size) => `data:${size}:${i.imageName}`);
  const readerOrder = (page: string) => [...page.matchAll(/<img alt="(כריכה|איור לעמוד (\d))"/g)].map(m => m[2] ? Number(m[2]) : 0);
  it.each([[[1, 2]], [[4, 5]]])('sample %j: drawn first, presented as the cover then pages 1-8', async sample => {
    const h = harness(), m = await illustrateReviewedAudition({ ...h.args, sample });
    expect(m.pages.map(p => p.pageNumber)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(m.scope).toMatchObject({ drawnOrder: [...sample, ...[0, 1, 2, 3, 4, 5, 6, 7, 8].filter(n => !sample.includes(n))] });
    expect(readerOrder(html(m))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    // Provenance stays with its page.
    for (const p of m.pages) expect(p.candidate.imageName).toBe(`page_${p.pageNumber}_0.png`);
  });
  it('without a sample the manifest is unchanged (no drawn-order field) and still reads in book order', async () => {
    const h = harness(), m = await illustrateReviewedAudition(h.args);
    expect(m.scope).toEqual({ frames: [0, 1, 2, 3, 4, 5, 6, 7, 8], complete: true });
    expect(readerOrder(html(m))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it('banner per status: supported, supported sample (partial), held, held sample (partial), and held for anything unknown', async () => {
    const full = await illustrateReviewedAudition(harness().args);
    expect(html(full)).toContain('מצב: <b>נתמך בבדיקה האוטומטית בלבד</b>. לא אישור');
    const part = await illustrateReviewedAudition({ ...harness().args, pages: [3, 4] });
    expect(part.status).toBe('qa_supported_sample');
    expect(html(part)).toContain('מצב: <b>דגימה חלקית — נתמכת בבדיקה האוטומטית בלבד</b>. ספר חלקי: צוירו עמוד 3, עמוד 4.');
    const held = await illustrateReviewedAudition(harness({ judge: step => step.startsWith('page_4_') ? { environment: { issues: [issue('continuity', 'landmark_unique:stone', 'two stones')] } } : {} }).args);
    expect(html(held)).toContain('מצב: <b>מוחזק — יש ממצאים שגיא צריך לראות</b>');
    const heldSample = await illustrateReviewedAudition({ ...harness({ judge: step => step.startsWith('page_2_') ? { environment: { issues: [issue('continuity', 'landmark_unique:stone', 'two stones')] } } : {} }).args, sample: [1, 2] });
    expect(html(heldSample)).toContain('מצב: <b>מוחזק — הדגימה המוקדמת לא עברה, ושאר הספר לא צויר</b>. ספר חלקי: צוירו עמוד 1, עמוד 2.');
    expect(readerOrder(html(heldSample))).toEqual([1, 2]);
    for (const page of [html(held), html(heldSample)]) expect(page).not.toContain('נתמך בבדיקה האוטומטית בלבד');
    expect(html({ ...full, status: 'some_future_status' } as never)).toContain('מצב: <b>מוחזק — מצב לא מוכר</b>');
    expect(html(full)).toContain('זהות הילד/ה:');
  });
});

describe('opt-in own-record verification (the new-book meter): every own call re-derived from its bound request and raw answer before it counts', () => {
  const PROMPT = 'p'.repeat(1000);
  const renderWire = { body: { model: 'gpt-image-2', prompt: PROMPT, quality: 'low', size: '1024x1024', n: 1 }, mode: 'images.generate', references: [],
    retries: 0, deadlineMs: 180000, pricing: 'image_input_8_output_30_conservative_no_cache', outputReservationTokens: 8192 };
  // The image adapter's own maximum: every prompt byte (and reference) at the image input rate, plus 8,192 output tokens at $30/M.
  const RENDER_MAX = 1000 * 8 + 8192 * 30;
  const reviewWire = { model: 'gpt-6.1-sol', store: false, service_tier: 'default', reasoning: { effort: 'medium' }, instructions: 'judge', input: [], max_output_tokens: 12000 };
  const identityWire = { model: 'gpt-4o', max_tokens: 180, temperature: 0, response_format: { type: 'json_object' }, messages: [] };
  const imageRaw = (input = 100, output = 300) => ({ created: 1, data: [{ b64_json: 'aW1hZ2U=' }], usage: { input_tokens: input, output_tokens: output } });
  const reviewRaw = (input = 5000, output = 800) => ({ model: 'gpt-6.1-sol', service_tier: 'default', status: 'completed', output_text: '{}',
    usage: { input_tokens: input, output_tokens: output } });
  const identityRaw = { model: 'gpt-4o-2024-08-06', choices: [], usage: { prompt_tokens: 1500, completion_tokens: 120 } };
  // Each adapter's price of those answers: image 8/30, Sol 2/10, identity 2.5/10 (per token, in micro-USD).
  const RENDER = 100 * 8 + 300 * 30, REVIEW = 5000 * 2 + 800 * 10, IDENTITY = 1500 * 2.5 + 120 * 10;
  const opted = (root = path.join(mkdtempSync(path.join(tmpdir(), 'audition-own-')), 'paid'), prior = 1000000) =>
    new AuditionMeter(root, 7000000, 20, prior, 0, auditionMeterRules);
  const render = (m: AuditionMeter, step: string, raw = imageRaw()) => m.run(step, renderWire, RENDER_MAX, async () => {
    const cost = raw.usage.input_tokens * 8 + raw.usage.output_tokens * 30;
    return { value: 1, estimatedMicroUsd: cost, receipt: { raw, estimatedMicroUsd: cost, model: 'gpt-image-2', candidate: { imageName: `${step}.png`, imageSha: sha(step) } } };
  });
  const review = (m: AuditionMeter, step: string, raw = reviewRaw(), cost = REVIEW) =>
    m.run(step, reviewWire, 600000, async () => ({ value: 1, estimatedMicroUsd: cost, receipt: { raw, estimatedMicroUsd: cost } }));
  const identity = (m: AuditionMeter, step: string) =>
    m.run(step, identityWire, 50000, async () => ({ value: 1, estimatedMicroUsd: IDENTITY, receipt: { raw: identityRaw, estimatedMicroUsd: IDENTITY, status: 200 } }));
  /** A genuine opted-in run: one sheet (render, review), then one page (render, review, identity). */
  async function genuine() {
    const m = opted();
    await render(m, 'sheet_entities_0'); await review(m, 'sheet_entities_0_qa');
    await render(m, 'page_1_0'); await review(m, 'page_1_0_qa'); await identity(m, 'page_1_0_identity');
    return m;
  }
  const edit = (root: string, file: string, change: (value: any) => any) => {
    const f = path.join(root, file); writeFileSync(f, JSON.stringify(change(JSON.parse(readFileSync(f, 'utf8')))));
  };
  /** One call's recorded cost set in its result and its receipt together (they agree; only the raw answer is left as it was). */
  const setCost = (root: string, step: string, cost: unknown) => {
    edit(root, `${step}.result.json`, r => ({ ...r, estimatedMicroUsd: cost })); edit(root, `${step}.receipt.json`, r => ({ ...r, estimatedMicroUsd: cost }));
  };
  /** Every record of one call moved to another step name, its claim naming it. */
  const rename = (root: string, from: string, to: string) => {
    for (const n of readdirSync(root).filter(n => n.startsWith(`${from}.`))) renameSync(path.join(root, n), path.join(root, to + n.slice(from.length)));
    edit(root, `${to}.claim.json`, c => ({ ...c, step: to }));
  };
  /** A call's request changed, with its claim's and result's digests rebound to it (the maximum as given). */
  const rebind = (root: string, step: string, change: (wire: any) => any) => {
    const wire = change(JSON.parse(readFileSync(path.join(root, `${step}.wire.json`), 'utf8'))), wireDigest = sha(canonicalJson(wire));
    writeFileSync(path.join(root, `${step}.wire.json`), JSON.stringify(wire));
    for (const k of ['claim', 'result']) edit(root, `${step}.${k}.json`, r => ({ ...r, wireDigest }));
  };
  /** Every entry of a meter folder with its content hash (a directory as such). */
  const listing = (root: string) => readdirSync(root, { withFileTypes: true }).map(e => [e.name, e.isFile() ? sha(readFileSync(path.join(root, e.name), 'utf8')) : 'directory'])
    .sort(([a], [b]) => a < b ? -1 : 1);

  it('on genuine records the opt-in changes nothing: the same snapshot as the plain sum, call for call, and the next call proceeds', async () => {
    const m = await genuine();
    const plain = new AuditionMeter(m.root, 7000000, 20, 1000000).snapshot();
    expect(m.snapshot()).toEqual(plain);
    expect(plain).toMatchObject({ calls: 5, newKnownApiMicroUsd: 2 * RENDER + 2 * REVIEW + IDENTITY, unknownCost: 0, unknownOutcome: 0, failed: 0 });
    await render(m, 'r1_page_2_0');
    expect(opted(m.root).snapshot()).toEqual(new AuditionMeter(m.root, 7000000, 20, 1000000).snapshot());
  });

  it("Codex's reproduction (490000 -> 1 in the summaries, the raw usage unchanged) is refused before the next claim: on the same meter and on a resumed one", async () => {
    const m = opted(undefined, 6500000);
    await render(m, 'page_1_0', imageRaw(50000, 3000));
    expect(m.snapshot()).toMatchObject({ newKnownApiMicroUsd: 490000, cumulativeAccountedMicroUsd: 6990000 });
    const dispatch = vi.fn(async () => ({ value: 1, estimatedMicroUsd: IDENTITY, receipt: { raw: identityRaw, estimatedMicroUsd: IDENTITY, status: 200 } }));
    await expect(m.run('page_1_0_identity', identityWire, 50000, dispatch)).rejects.toThrow('audition_budget_exhausted');
    setCost(m.root, 'page_1_0', 1);
    // Without the opt-in (every other caller, unchanged) the lowered sum is what counts: 6,550,001 accounted for a true 7,040,000.
    expect(new AuditionMeter(m.root, 7000000, 20, 6500000).snapshot().cumulativeAccountedMicroUsd).toBe(6500001);
    for (const meter of [m, opted(m.root, 6500000)]) {
      await expect(meter.run('page_1_0_identity', identityWire, 50000, dispatch)).rejects.toThrow('audition_meter_cost');
      expect(() => meter.snapshot()).toThrow('audition_meter_cost');
    }
    expect(dispatch).not.toHaveBeenCalled();
    expect(readdirSync(m.root).filter(n => n.startsWith('page_1_0_identity.'))).toEqual([]);
  });

  it.each([
    ['a render cost lowered (result and receipt agree)', 'audition_meter_cost', (r: string) => setCost(r, 'page_1_0', 1)],
    ['a receipt whose estimate disagrees with its result', 'audition_meter_cost', (r: string) => edit(r, 'page_1_0.receipt.json', x => ({ ...x, estimatedMicroUsd: 1 }))],
    ['a result cost lowered alone (the sum reads results; its receipt untouched)', 'audition_meter_cost', (r: string) => edit(r, 'page_1_0.result.json', x => ({ ...x, estimatedMicroUsd: 1 }))],
    ['a claim naming another step (it groups repeated failures)', 'audition_meter_record', (r: string) => edit(r, 'page_1_0_qa.claim.json', c => ({ ...c, step: 'page_1_0' }))],
    ['an open claim of a request no rule prices, its maximum removed (it would hold nothing)', 'audition_meter_cost', (r: string) => {
      rebind(r, 'page_1_0_identity', w => ({ ...w, model: 'unpriced' }));
      for (const k of ['result', 'receipt']) unlinkSync(path.join(r, `page_1_0_identity.${k}.json`));
      edit(r, 'page_1_0_identity.claim.json', c => ({ ...c, maximumMicroUsd: null })); }],
    ['a review cost lowered', 'audition_meter_cost', (r: string) => setCost(r, 'page_1_0_qa', 1)],
    ['an identity cost lowered', 'audition_meter_cost', (r: string) => setCost(r, 'page_1_0_identity', 1)],
    ['a review answer of another model (model swap)', 'audition_meter_cost', (r: string) => edit(r, 'page_1_0_qa.receipt.json', x => ({ ...x, raw: { ...x.raw, model: 'gpt-6-astra' } }))],
    ['a review answer at another service tier', 'audition_meter_cost', (r: string) => edit(r, 'page_1_0_qa.receipt.json', x => ({ ...x, raw: { ...x.raw, service_tier: 'flex' } }))],
    ['an identity answer of an unknown model', 'audition_meter_cost', (r: string) => edit(r, 'page_1_0_identity.receipt.json', x => ({ ...x, raw: { ...x.raw, model: 'gpt-4o-mini' } }))],
    ['a review record renamed as a render (type swap)', 'audition_meter_cost', (r: string) => rename(r, 'page_1_0_qa', 'page_1_1')],
    ['a render record renamed as an identity check (type swap)', 'audition_meter_cost', (r: string) => rename(r, 'page_1_0', 'page_1_1_identity')],
    ['an identity check renamed onto a sheet (no such step)', 'audition_meter_rule', (r: string) => rename(r, 'page_1_0_identity', 'sheet_entities_1_identity')],
    ['a rejudge step (not a kind this meter claims)', 'audition_meter_rule', (r: string) => rename(r, 'page_1_0_qa', 'rejudge_0_page_1')],
    ['a render answer without its raw usage', 'audition_meter_cost', (r: string) => edit(r, 'page_1_0.receipt.json', x => ({ ...x, raw: { ...x.raw, usage: undefined } }))],
    ['a negative recorded cost', 'audition_meter_cost', (r: string) => setCost(r, 'page_1_0', -RENDER)],
    ['a fractional recorded cost', 'audition_meter_cost', (r: string) => setCost(r, 'page_1_0', RENDER + .5)],
    ['a recorded cost as text', 'audition_meter_cost', (r: string) => setCost(r, 'page_1_0', String(RENDER))],
    ["a claim maximum that is not its request's", 'audition_meter_cost', (r: string) => edit(r, 'page_1_0.claim.json', c => ({ ...c, maximumMicroUsd: RENDER_MAX - 1 }))],
    ['a non-integer claim maximum', 'audition_meter_cost', (r: string) => edit(r, 'page_1_0.claim.json', c => ({ ...c, maximumMicroUsd: RENDER_MAX + .5 }))],
    ['a request changed after its claim', 'audition_meter_record', (r: string) => edit(r, 'page_1_0.wire.json', w => ({ ...w, body: { ...w.body, prompt: `q${w.body.prompt.slice(1)}` } }))],
    ['a request changed and rebound, its maximum kept', 'audition_meter_cost', (r: string) => rebind(r, 'page_1_0', w => ({ ...w, body: { ...w.body, prompt: w.body.prompt.slice(1) } }))],
    ['a review request rebound to another model', 'audition_meter_cost', (r: string) => rebind(r, 'page_1_0_qa', w => ({ ...w, model: 'gpt-6-astra' }))],
    ['a review request rebound to another tier', 'audition_meter_cost', (r: string) => rebind(r, 'page_1_0_qa', w => ({ ...w, service_tier: 'flex' }))],
    ['a review request rebound to a larger output', 'audition_meter_cost', (r: string) => rebind(r, 'page_1_0_qa', w => ({ ...w, max_output_tokens: 20000 }))],
    ['a render request rebound to another image model', 'audition_meter_cost', (r: string) => rebind(r, 'page_1_0', w => ({ ...w, body: { ...w.body, model: 'gpt-image-1' } }))],
    ['a render request rebound to another quality', 'audition_meter_cost', (r: string) => rebind(r, 'page_1_0', w => ({ ...w, body: { ...w.body, quality: 'high' } }))],
    ['a render request rebound to another pricing', 'audition_meter_cost', (r: string) => rebind(r, 'page_1_0', w => ({ ...w, pricing: 'image_input_4_output_15' }))],
    ['a render request rebound to a smaller output reservation', 'audition_meter_cost', (r: string) => rebind(r, 'page_1_0', w => ({ ...w, outputReservationTokens: 4096 }))],
    ['an identity request rebound to another model', 'audition_meter_cost', (r: string) => rebind(r, 'page_1_0_identity', w => ({ ...w, model: 'gpt-4o-mini' }))],
    ['an identity request rebound to a larger output', 'audition_meter_cost', (r: string) => rebind(r, 'page_1_0_identity', w => ({ ...w, max_tokens: 500 }))],
    ['a result naming another request', 'audition_meter_record', (r: string) => edit(r, 'page_1_0.result.json', x => ({ ...x, wireDigest: sha('other') }))],
    ['a completed call without its receipt', 'audition_meter_record', (r: string) => unlinkSync(path.join(r, 'page_1_0.receipt.json'))],
    ['a result whose outcome is not a boolean', 'audition_meter_record', (r: string) => edit(r, 'page_1_0.result.json', x => ({ ...x, completed: 'yes' }))],
    ['a completed review that is not a usable answer', 'audition_meter_cost', (r: string) => edit(r, 'page_1_0_qa.receipt.json', x => ({ ...x, raw: { ...x.raw, status: 'incomplete' } }))],
    ['a completed identity check with a failed HTTP status', 'audition_meter_cost', (r: string) => edit(r, 'page_1_0_identity.receipt.json', x => ({ ...x, status: 500 }))],
    ['a completed render that is not the priced image model', 'audition_meter_cost', (r: string) => edit(r, 'page_1_0.receipt.json', x => ({ ...x, model: 'gpt-image-1' }))],
    ['an earlier call deleted (a gap in the claim sequence)', 'audition_meter_record', (r: string) => {
      for (const n of readdirSync(r).filter(n => n.startsWith('sheet_entities_0.'))) unlinkSync(path.join(r, n)); }],
    ['a claim renumbered', 'audition_meter_record', (r: string) => edit(r, 'page_1_0_qa.claim.json', c => ({ ...c, seq: 2 }))],
    ['an unreadable record', 'audition_meter_record', (r: string) => { unlinkSync(path.join(r, 'page_1_0.result.json')); mkdirSync(path.join(r, 'page_1_0.result.json')); }],
    // Codex HOLD at 5e225695, F1: every record in the folder must belong to a claimed call.
    ['the last claim removed, its request, result and receipt left (a known charge)', 'audition_meter_record',
      (r: string) => unlinkSync(path.join(r, 'page_1_0_identity.claim.json'))],
    ['an interior claim removed and the later claims renumbered without a gap', 'audition_meter_record', (r: string) => {
      unlinkSync(path.join(r, 'page_1_0.claim.json'));
      edit(r, 'page_1_0_qa.claim.json', c => ({ ...c, seq: 2 })); edit(r, 'page_1_0_identity.claim.json', c => ({ ...c, seq: 3 })); }],
    ['the last claim renamed out of the record names, its evidence left', 'audition_meter_record',
      (r: string) => renameSync(path.join(r, 'page_1_0_identity.claim.json'), path.join(r, 'page_1_0_identity.claim.json.bak'))],
    ['a whole call renamed out of the record names', 'audition_meter_record', (r: string) => {
      for (const n of readdirSync(r).filter(n => n.startsWith('page_1_0_identity.'))) renameSync(path.join(r, n), path.join(r, `${n}.bak`)); }],
    ['another file in the meter folder', 'audition_meter_record', (r: string) => writeFileSync(path.join(r, 'notes.txt'), 'x')],
    ['a folder inside the meter folder', 'audition_meter_record', (r: string) => mkdirSync(path.join(r, 'extra'))],
  ])('%s: refused (%s) before the next claim or dispatch, on the same meter and on a resumed one; nothing is repaired', async (_name, code, forge) => {
    const m = await genuine(); forge(m.root);
    const dispatch = vi.fn(), before = listing(m.root);
    for (const meter of [m, opted(m.root)]) {
      expect(() => meter.snapshot()).toThrow(code);
      await expect(meter.run('page_2_0', renderWire, RENDER_MAX, dispatch)).rejects.toThrow(code);
    }
    expect(dispatch).not.toHaveBeenCalled();
    expect(listing(m.root)).toEqual(before);
  });

  it("Codex HOLD F1: a removed claim never hides its call's surviving records, whatever the outcome (known, open, unknown cost, charged failure)", async () => {
    const outcomes: [string, (m: AuditionMeter) => Promise<unknown>][] = [
      ['a known charge', m => render(m, 'page_1_0')],
      // The process stops during the call: its request and claim exist, no result.
      ['an open claim', async m => { void m.run('page_1_0', renderWire, RENDER_MAX, () => new Promise(() => {})); }],
      ['an unknown cost', m => m.run('page_1_0', renderWire, RENDER_MAX, async () => {
        throw Object.assign(new Error('socket'), { receipt: { raw: null, estimatedMicroUsd: null } }); }).catch(() => {})],
      ['a charged failure', m => m.run('page_1_0_qa', reviewWire, 600000, async () => {
        throw Object.assign(new Error('audition_pixel_schema'), { receipt: { raw: reviewRaw(), estimatedMicroUsd: REVIEW } }); }).catch(() => {})],
    ];
    for (const [name, make] of outcomes) {
      const m = opted(); await make(m);
      unlinkSync(path.join(m.root, readdirSync(m.root).find(n => n.endsWith('.claim.json'))!));
      const before = listing(m.root), dispatch = vi.fn();
      expect(before.length, name).toBeGreaterThan(0);
      for (const meter of [m, opted(m.root)]) {
        expect(() => meter.snapshot(), name).toThrow('audition_meter_record');
        await expect(meter.run('page_2_0', renderWire, RENDER_MAX, dispatch), name).rejects.toThrow('audition_meter_record');
      }
      expect(dispatch, name).not.toHaveBeenCalled();
      expect(listing(m.root), name).toEqual(before);
    }
  });

  it('Codex HOLD F2: a new call is priced under its own rule before anything is written or sent (wrong maximum, unknown step, another kind)', async () => {
    // Codex's case: 10,000 left under the cap; a Sol review's own maximum is 600,000, but the caller passes 1.
    const tight = opted(undefined, 6990000);
    const dispatch = vi.fn(async () => ({ value: 1, estimatedMicroUsd: REVIEW, receipt: { raw: reviewRaw(), estimatedMicroUsd: REVIEW } }));
    const cases: [AuditionMeter, string, unknown, number, string][] = [
      [tight, 'page_1_0_qa', reviewWire, 1, 'audition_meter_cost'],
      [tight, 'page_1_0_qa', reviewWire, 600001, 'audition_meter_cost'],
      [opted(), 'unknown_step', renderWire, RENDER_MAX, 'audition_meter_rule'],
      [opted(), 'page_1_0_qa', renderWire, RENDER_MAX, 'audition_meter_cost'],
      [opted(), 'page_1_0', reviewWire, 600000, 'audition_meter_cost'],
      [opted(), 'page_1_0_identity', { ...identityWire, model: 'gpt-4o-mini' }, 50000, 'audition_meter_cost'],
      [opted(), 'page_1_0', undefined, RENDER_MAX, 'audition_meter_cost'],
    ];
    for (const [meter, step, wire, maximum, code] of cases) {
      await expect(meter.run(step, wire, maximum, dispatch), `${step} ${maximum}`).rejects.toThrow(code);
      expect(readdirSync(meter.root), step).toEqual([]);
    }
    expect(dispatch).not.toHaveBeenCalled();
    // Its own maximum: refused by the cap where it does not fit, made where it does.
    await expect(tight.run('page_1_0_qa', reviewWire, 600000, dispatch)).rejects.toThrow('audition_budget_exhausted');
    const roomy = opted();
    await roomy.run('page_1_0_qa', reviewWire, 600000, dispatch);
    expect([dispatch.mock.calls.length, roomy.snapshot().calls, roomy.snapshot().newKnownApiMicroUsd]).toEqual([1, 1, REVIEW]);
    // Without the opt-in (every other caller) the supplied maximum is taken as before.
    await new AuditionMeter(path.join(mkdtempSync(path.join(tmpdir(), 'audition-own-')), 'paid'), 7000000, 20, 1000000).run('page_1_0_qa', reviewWire, 1, dispatch);
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it('evidence without a price cannot free budget: with every summary agreeing, it is an unknown cost held at its maximum, and it stops', async () => {
    const m = await genuine();
    edit(m.root, 'page_1_0.receipt.json', x => ({ ...x, raw: { ...x.raw, usage: undefined }, estimatedMicroUsd: null }));
    edit(m.root, 'page_1_0.result.json', x => ({ ...x, estimatedMicroUsd: null }));
    expect(m.snapshot()).toMatchObject({ unknownCost: 1, reservedUnsettledMicroUsd: RENDER_MAX, newKnownApiMicroUsd: RENDER + 2 * REVIEW + IDENTITY,
      cumulativeAccountedMicroUsd: 1000000 + RENDER_MAX + RENDER + 2 * REVIEW + IDENTITY });
    const dispatch = vi.fn();
    await expect(m.run('page_2_0', renderWire, RENDER_MAX, dispatch)).rejects.toThrow('audition_unknown_cost');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('a charged failure stays counted at its raw cost; an unknown failure and an open claim hold their own maximum and stop the next claim', async () => {
    const charged = opted();
    await render(charged, 'page_1_0');
    await expect(charged.run('page_1_0_qa', reviewWire, 600000, async () => {
      throw Object.assign(new Error('audition_pixel_schema'), { receipt: { raw: reviewRaw(), estimatedMicroUsd: REVIEW } }); })).rejects.toThrow('audition_pixel_schema');
    expect(charged.snapshot()).toMatchObject({ calls: 2, failed: 1, newKnownApiMicroUsd: RENDER + REVIEW, unknownCost: 0 });
    await render(charged, 'page_1_1');
    // A failed call's cost is re-derived like any other: lowered, it refuses the next claim.
    edit(charged.root, 'page_1_0_qa.failure.json', f => ({ ...f, receipt: { ...f.receipt, estimatedMicroUsd: 1 } }));
    edit(charged.root, 'page_1_0_qa.result.json', r => ({ ...r, estimatedMicroUsd: 1 }));
    await expect(render(charged, 'page_1_2')).rejects.toThrow('audition_meter_cost');

    const dispatch = vi.fn();
    const unknown = opted();
    await expect(unknown.run('page_1_0', renderWire, RENDER_MAX, async () => {
      throw Object.assign(new Error('socket'), { receipt: { raw: null, estimatedMicroUsd: null } }); })).rejects.toThrow('socket');
    expect(unknown.snapshot()).toMatchObject({ calls: 1, unknownCost: 1, reservedUnsettledMicroUsd: RENDER_MAX, cumulativeAccountedMicroUsd: 1000000 + RENDER_MAX });
    await expect(unknown.run('page_1_1', renderWire, RENDER_MAX, dispatch)).rejects.toThrow('audition_unknown_cost');
    // Its hold is its own request's maximum: a smaller one is refused, never counted.
    edit(unknown.root, 'page_1_0.claim.json', c => ({ ...c, maximumMicroUsd: 1 }));
    expect(() => unknown.snapshot()).toThrow('audition_meter_cost');

    // The process stops during a call: its claim stays without a result. A resumed meter holds that call's maximum and stops.
    const open = opted();
    void open.run('page_1_0', renderWire, RENDER_MAX, () => new Promise(() => {}));
    const resumed = opted(open.root);
    expect(resumed.snapshot()).toMatchObject({ calls: 1, unknownOutcome: 1, reservedUnsettledMicroUsd: RENDER_MAX, cumulativeAccountedMicroUsd: 1000000 + RENDER_MAX });
    await expect(resumed.run('page_1_1', renderWire, RENDER_MAX, dispatch)).rejects.toThrow('audition_unknown_cost');
    edit(open.root, 'page_1_0.claim.json', c => ({ ...c, maximumMicroUsd: 1 }));
    expect(() => opted(open.root).snapshot()).toThrow('audition_meter_cost');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("a long-input review keeps its long rate (auditionUsageCost's >272K branch): the shorter rate is refused", async () => {
    const m = opted(), long = reviewRaw(300000, 800);
    await review(m, 'page_1_0_qa', long, 300000 * 4 + 800 * 15);
    expect(m.snapshot().newKnownApiMicroUsd).toBe(1212000);
    setCost(m.root, 'page_1_0_qa', 300000 * 2 + 800 * 10);
    expect(() => m.snapshot()).toThrow('audition_meter_cost');
  });

  it('totals stay exact integers: a sum past the safe range refuses instead of reporting a rounded amount', async () => {
    // One answer whose own price is still exact (2^50 - 1 input tokens x 8 = 9,007,199,254,740,984); with the prior spend the total is not.
    const m = opted();
    await render(m, 'page_1_0', imageRaw(2 ** 50 - 1, 0));
    expect(() => m.snapshot()).toThrow('audition_meter_cost');
    expect(Number.isSafeInteger(new AuditionMeter(m.root, 7000000, 20, 1000000).snapshot().cumulativeAccountedMicroUsd)).toBe(false);
  });

  it('a meter integrity refusal ends the audition at once (never one unavailable attempt among others): nothing further is drawn', async () => {
    for (const code of ['audition_meter_rule', 'audition_meter_record', 'audition_meter_cost']) {
      const h = harness({ renderFail: step => step === 'sheet_entities_0' ? new ReviewedAuditionError(code) : null });
      await expect(illustrateReviewedAudition(h.args)).rejects.toThrow(code);
      expect([h.args.render.mock.calls.map(c => c[0]), h.args.judge.mock.calls.length, h.saved.has('sheet_entities')]).toEqual([['sheet_entities_0'], 0, false]);
    }
  });

  it("the audition's own steps only: renders, their reviews and a page's identity check (any resume prefix); nothing else", () => {
    for (const [step, rule] of [['sheet_entities_0', auditionRenderRule], ['sheet_locations_2', auditionRenderRule], ['page_0_0', auditionRenderRule],
      ['r3_page_8_2', auditionRenderRule], ['page_4_1_qa', auditionReviewRule], ['r1_sheet_entities_1_qa', auditionReviewRule],
      ['page_4_1_identity', auditionIdentityRule], ['r12_page_4_1_identity', auditionIdentityRule]] as const) expect(auditionMeterRules(step), step).toBe(rule);
    for (const step of ['sheet_entities_0_identity', 'rejudge_0_page_4', 'page_4', 'page_4_1_qa_identity', 'r_page_4_1', 'r123_page_4_1', 'R1_page_4_1',
      'sheet_props_0', 'page_4_1_extra', 'reference_child', 'storyboard', 'toString', '__proto__']) expect(auditionMeterRules(step), step).toBeUndefined();
  });
});

describe('opt-in scale lineup (audition-scale-lineup/v1): one common scale on the entities sheet; absent, byte-identical', () => {
  // Pinned at 69e1079a, before the lineup existed, from this file's own fixture: the flag-absent bytes must never move.
  const LEGACY = { designs: '481bc8ae0ec20118e86b8a81e004e22af4b00be011038cb836cbe19ca5db3799',
    entitiesPrompt: '5e796b015a1936a41dc399f5d3cfed0990a95450719ad97b6ed9b55da10a63d6', locationsPrompt: '30db89ebdb41cd94862c23e17d8543eadad3ee1c62a33635ceb4c996d4f01455',
    entitiesRepairPrompt: '8a5016ae60fc9c74a4e9acbd72c62da907a868e65c852c395619aca1b938f374', sheetJudge: 'f73cb818de575dded757889573a0a00e920590e4561b1fb3b6482aa77d064a85',
    pageJudge: '684127fb44e671d17850ceb3a93daa1042860e1e407cddb8b521d4d81322d7ce', pageSuffix: '5a0b65b61a0ad75e9161864f30d424c8d9989ad1bdd14a516a6c2f94a652c380',
    policy: '2ff1139ea157f9c2cf1324251f2892cdd30102f4a217c80f6c9961b6fefb4e16' };
  const repairFinding = [{ category: 'props', verdict: 'defect', impact: 'identity', requirement: 'design:cat', note: 'pink nose missing', bound: true }] as never;
  /** The fixture with the plan's structured companion height (every compiled continuity carries it); null removes it. */
  const lineupBook = (height: unknown = 1.6) => {
    const b = fixture() as any;
    if (height === null) delete b.plan.continuity.companionStandingHeightInChildHeights; else b.plan.continuity.companionStandingHeightInChildHeights = height;
    return b as PersonalStoryboard;
  };

  it('absent (or false): designs, prompts, judge instructions, page suffix and policy are exactly the pinned pre-lineup bytes', () => {
    for (const d of [auditionSheetDesigns(fixture(), texts), auditionSheetDesigns(fixture(), texts, false), auditionSheetDesigns(lineupBook(), texts)]) {
      expect(sha(canonicalJson(d))).toBe(LEGACY.designs);
      expect('scaleLineup' in d.entities).toBe(false);
      expect(sha(auditionSheetPrompt('entities', d.entities))).toBe(LEGACY.entitiesPrompt);
      expect(sha(auditionSheetPrompt('locations', d.locations))).toBe(LEGACY.locationsPrompt);
      expect(sha(sheetRepairPrompt('entities', d.entities, repairFinding))).toBe(LEGACY.entitiesRepairPrompt);
      expect(auditionJudgeInstruction('sheet', { role: 'entities', design: d.entities })).toBe(AUDITION_JUDGE_INSTRUCTIONS.sheet);
      expect(auditionJudgeInstruction('sheet', { role: 'locations', design: d.locations })).toBe(AUDITION_JUDGE_INSTRUCTIONS.sheet);
    }
    expect([sha(AUDITION_SHEET_JUDGE_INSTRUCTION), sha(AUDITION_JUDGE_INSTRUCTIONS.sheet), sha(AUDITION_JUDGE_INSTRUCTIONS.page), sha(AUDITION_PAGE_SUFFIX),
      sha(canonicalJson(REVIEWED_AUDITION_POLICY))]).toEqual([LEGACY.sheetJudge, LEGACY.sheetJudge, LEGACY.pageJudge, LEGACY.pageSuffix, LEGACY.policy]);
    expect(reviewedAuditionPolicy()).toBe(REVIEWED_AUDITION_POLICY);
    expect(reviewedAuditionPolicy(false)).toBe(REVIEWED_AUDITION_POLICY);
    expect(auditionJudgeInstruction('page', {})).toBe(AUDITION_JUDGE_INSTRUCTIONS.page);
  });

  it('present: the entities design names every supporting character it draws (structural, in design order) and the companion\'s structured height', () => {
    const legacy = auditionSheetDesigns(lineupBook(), texts), d = auditionSheetDesigns(lineupBook(), texts, true);
    expect(d.entities.scaleLineup).toEqual({ version: AUDITION_SCALE_LINEUP_VERSION, post: 'child_height', members: ['cat'],
      companionOutline: { id: 'companion', standingHeightInChildHeights: 1.6 } });
    // Only the lineup is added: the rest of the entities design, the locations design and the deferrals are unchanged.
    const { scaleLineup: _lineup, ...rest } = d.entities;
    expect(canonicalJson(rest)).toBe(canonicalJson(legacy.entities));
    expect(canonicalJson(d.locations)).toBe(canonicalJson(legacy.locations));
    expect(d.pageDeferred).toEqual(legacy.pageDeferred);
    // Membership is structural: a prop whose words give a size in child heights is not a member, and a member's size stays in its own design.
    expect(d.entities.entities.find(e => e.id === 'paper_boat')!.invariants).toContainEqual({ attribute: 'size', value: 'about 0.3 child heights' });
    expect(d.entities.scaleLineup!.members).not.toContain('paper_boat');
    // A supporting character attached to an actor is drawn with that actor on its pages, not on the sheet, so not in the lineup; the post and
    // the companion outline remain.
    const riding = lineupBook() as any;
    for (const p of riding.sequence.pages) p.states.find((s: any) => s.entityId === 'cat').value = { relation: 'attached_to', targetId: 'companion' };
    expect(auditionSheetDesigns(riding, texts, true).entities.scaleLineup).toEqual({ version: AUDITION_SCALE_LINEUP_VERSION, post: 'child_height', members: [],
      companionOutline: { id: 'companion', standingHeightInChildHeights: 1.6 } });
    // The companion's height comes only from the plan's validated measurement: absent or out of range refuses.
    for (const height of [null, 0, 0.05, 51, Number.NaN, '1.6'])
      expect(() => auditionSheetDesigns(lineupBook(height), texts, true), String(height)).toThrow('audition_scale_lineup');
  });

  it('present: the lineup block, its checks and ids and the page rule are added exactly; the locations sheet and every other text are unchanged', () => {
    const legacy = auditionSheetDesigns(lineupBook(), texts), d = auditionSheetDesigns(lineupBook(), texts, true);
    const prompt = auditionSheetPrompt('entities', d.entities), [rules] = prompt.split('\nAUTHORITATIVE DESIGN DATA: ');
    const [legacyRules] = auditionSheetPrompt('entities', legacy.entities).split('\nAUTHORITATIVE DESIGN DATA: ');
    // The legacy rules, then one lineup line, then the design data (which carries the lineup).
    expect(rules.startsWith(`${legacyRules}\nSCALE LINEUP (design.scaleLineup), in addition to the tiles:`)).toBe(true);
    expect(rules.slice(legacyRules.length + 1)).not.toContain('\n');
    expect(prompt.endsWith(`\nAUTHORITATIVE DESIGN DATA: ${canonicalJson(d.entities)}`)).toBe(true);
    for (const phrase of ['a plain vertical measuring post exactly one child height tall (label child_height; a neutral post, never a child figure',
      'flat single-tone silhouette', 'every listed ID is still drawn exactly once as its tile', 'exactly companionOutline.standingHeightInChildHeights post heights tall',
      'never enlarge or shrink one figure alone', 'the lineup is the only place on the sheet where sizes are compared']) expect(rules).toContain(phrase);
    // The in-place repair keeps the same lineup rules.
    expect(sheetRepairPrompt('entities', d.entities, repairFinding).startsWith(`${prompt}\nImage 1 is the previous sheet`)).toBe(true);
    // The locations sheet is untouched by the flag.
    expect(sha(auditionSheetPrompt('locations', d.locations))).toBe(LEGACY.locationsPrompt);
    expect(sheetRequirementIds(d.locations)).toEqual(sheetRequirementIds(legacy.locations));
    // Requirement ids: the legacy ids, then the lineup's own (post and ground line, each member, the companion outline).
    expect(sheetRequirementIds(d.entities)).toEqual([...sheetRequirementIds(legacy.entities), 'scale_lineup', 'scale_lineup:cat', 'scale_lineup:companion']);
    // The judge instruction is chosen by the judged design: the legacy instruction with the lineup checks inserted after the tile rule.
    expect(auditionJudgeInstruction('sheet', { role: 'entities', design: d.entities })).toBe(AUDITION_SCALE_LINEUP_SHEET_JUDGE_INSTRUCTION);
    expect(auditionJudgeInstruction('sheet', { role: 'locations', design: d.locations })).toBe(AUDITION_SHEET_JUDGE_INSTRUCTION);
    const anchor = 'Inspect proportions within a tile.\n', [head, tail, more] = AUDITION_SHEET_JUDGE_INSTRUCTION.split(anchor);
    expect(more).toBeUndefined();
    expect(AUDITION_SCALE_LINEUP_SHEET_JUDGE_INSTRUCTION.startsWith(`${head}${anchor}SCALE LINEUP (context.design.scaleLineup; the ONE place on the sheet where sizes are compared):\n`)).toBe(true);
    expect(AUDITION_SCALE_LINEUP_SHEET_JUDGE_INSTRUCTION.endsWith(`\n${tail}`)).toBe(true);
    for (const phrase of ['report only a clear contradiction', 'approximate agreement passes', 'Never measure tiles against each other',
      'a continuity issue citing scale_lineup:<member id>', 'scale_lineup:companion', 'is an identity issue citing scale_lineup'])
      expect(AUDITION_SCALE_LINEUP_SHEET_JUDGE_INSTRUCTION).toContain(phrase);
    // The page suffix: the legacy suffix with the relative-size rule after the authorities sentence, and nothing else.
    const s = AUDITION_SCALE_LINEUP_PAGE_SUFFIX, rule = s.slice(s.indexOf(' RELATIVE SIZE: '), s.indexOf(' Draw only the current visible entities.'));
    expect(s.replace(rule, '')).toBe(AUDITION_PAGE_SUFFIX);
    expect(rule).toContain('changed only by perspective (nearer looks larger, farther looks smaller)');
    expect(rule).toContain('a character too tall for the frame is cropped by the frame edge, never shrunk to fit');
    // The policy: v10 is every v9 rule unchanged, plus the lineup.
    const { version, scaleLineup, ...rules10 } = SCALE_LINEUP_AUDITION_POLICY, { version: v9, ...rules9 } = REVIEWED_AUDITION_POLICY;
    expect([version, v9, rules10]).toEqual(['reviewed-audition-policy/v10', 'reviewed-audition-policy/v9', rules9]);
    expect(scaleLineup).toContain('never read from words');
    expect(reviewedAuditionPolicy(true)).toBe(SCALE_LINEUP_AUDITION_POLICY);
  });

  it('a lineup anywhere but the entities sheet, or a malformed one, refuses in the prompt and in the judge instruction', () => {
    const d = auditionSheetDesigns(lineupBook(), texts, true), lineup = d.entities.scaleLineup!;
    expect(() => auditionSheetPrompt('locations', { ...d.locations, scaleLineup: lineup })).toThrow('audition_scale_lineup');
    expect(() => auditionJudgeInstruction('sheet', { role: 'locations', design: { ...d.locations, scaleLineup: lineup } })).toThrow('audition_scale_lineup');
    expect(() => auditionJudgeInstruction('sheet', { design: d.entities })).toThrow('audition_scale_lineup');
    for (const bad of [{ ...lineup, version: 'audition-scale-lineup/v2' }, { ...lineup, post: 'child' }, { ...lineup, members: ['cat', 'cat'] },
      { ...lineup, members: ['Cat'] }, { ...lineup, extra: true }, { ...lineup, companionOutline: { ...lineup.companionOutline, id: 'child' } },
      { ...lineup, companionOutline: { ...lineup.companionOutline, standingHeightInChildHeights: 60 } }, null, AUDITION_SCALE_LINEUP_VERSION]) {
      expect(() => auditionSheetPrompt('entities', { ...d.entities, scaleLineup: bad }), JSON.stringify(bad)).toThrow('audition_scale_lineup');
      expect(() => auditionJudgeInstruction('sheet', { role: 'entities', design: { ...d.entities, scaleLineup: bad } })).toThrow('audition_scale_lineup');
      expect(() => sheetScaleLineup('entities', { scaleLineup: bad })).toThrow('audition_scale_lineup');
    }
  });

  it('orchestration: the v10 policy and lineup design are saved; lineup prompt and checks on the entities sheet only; every page gets the rule; page judging unchanged', async () => {
    const on = harness({ book: lineupBook() }), off = harness({ book: lineupBook() });
    const m = await illustrateReviewedAudition({ ...on.args, scaleLineup: true }), legacy = await illustrateReviewedAudition(off.args);
    expect(on.saved.get('audition_sheet_designs')).toEqual(JSON.parse(JSON.stringify({ policy: SCALE_LINEUP_AUDITION_POLICY, designs: auditionSheetDesigns(lineupBook(), texts, true) })));
    expect(m).toMatchObject({ policy: { version: 'reviewed-audition-policy/v10' }, scaleLineup: AUDITION_SCALE_LINEUP_VERSION, status: 'qa_supported_audition' });
    expect(legacy.policy).toBe(REVIEWED_AUDITION_POLICY);
    expect('scaleLineup' in legacy).toBe(false);
    expect(on.prompts.get('sheet_entities_0')).toContain('SCALE LINEUP (design.scaleLineup)');
    expect(off.prompts.get('sheet_entities_0')).not.toContain('SCALE LINEUP');
    expect(on.prompts.get('sheet_locations_0')).toBe(off.prompts.get('sheet_locations_0'));
    expect(on.contexts.get('sheet_entities_0_qa')).toMatchObject({ design: { scaleLineup: { members: ['cat'] } },
      requirementIds: expect.arrayContaining(['scale_lineup', 'scale_lineup:cat', 'scale_lineup:companion']) });
    expect(on.contexts.get('sheet_locations_0_qa')).toEqual(off.contexts.get('sheet_locations_0_qa'));
    for (let n = 0; n <= 8; n++) {
      expect(on.prompts.get(`page_${n}_0`)).toBe(off.prompts.get(`page_${n}_0`)!.replace(AUDITION_PAGE_SUFFIX, AUDITION_SCALE_LINEUP_PAGE_SUFFIX));
      expect(on.prompts.get(`page_${n}_0`)).toContain(AUDITION_SCALE_LINEUP_PAGE_SUFFIX);
      // The page judge's context is the same: only the renderer is told about the lineup.
      expect(on.contexts.get(`page_${n}_0_qa`)).toEqual(off.contexts.get(`page_${n}_0_qa`));
    }
  });

  it('a lineup finding binds only under the lineup (repaired in place); the same citation without it is an invalid review, never redrawn', async () => {
    const short = (step: string): Spec => step === 'sheet_entities_0_qa'
      ? { relative_scale: { issues: [issue('continuity', 'scale_lineup:cat', 'the cat silhouette stands taller than the post')] } } : {};
    const on = harness({ book: lineupBook(), judge: short }), off = harness({ book: lineupBook(), judge: short });
    const m = await illustrateReviewedAudition({ ...on.args, scaleLineup: true }), legacy = await illustrateReviewedAudition(off.args);
    expect(on.prompts.get('sheet_entities_1')).toContain('- [continuity] scale_lineup:cat: the cat silhouette stands taller than the post');
    expect(on.prompts.get('sheet_entities_1')).toContain('SCALE LINEUP (design.scaleLineup)');
    expect(on.args.render.mock.calls.find(c => c[0] === 'sheet_entities_1')![2]).toEqual([image('sheet_entities_0'), image('child'), image('companion')]);
    expect(m.sheets.entities).toMatchObject({ status: 'qa_supported', referenceStatus: 'approved_reference', chosenAttempt: 1 });
    expect(legacy.sheets.entities).toMatchObject({ status: 'review_invalid', referenceStatus: 'diagnostic_candidate', chosenAttempt: 0 });
    expect(off.args.render.mock.calls.filter(c => String(c[0]).startsWith('sheet_entities_'))).toHaveLength(1);
  });

  it('a resume binds the flag: saved lineup work never resumes without it, nor saved legacy work with it', async () => {
    const on = harness({ book: lineupBook() }), off = harness({ book: lineupBook() });
    await illustrateReviewedAudition({ ...on.args, pages: [0, 1], scaleLineup: true });
    await illustrateReviewedAudition({ ...off.args, pages: [0, 1] });
    const saved = (h: typeof on) => ({ designs: h.saved.get('audition_sheet_designs'), stepPrefix: 'r1_',
      sheets: { entities: h.saved.get('sheet_entities') as any, locations: h.saved.get('sheet_locations') as any }, pages: { 0: h.saved.get('page_0') as any } });
    await expect(illustrateReviewedAudition({ ...harness({ book: lineupBook() }).args, pages: [0, 1], resume: saved(on) })).rejects.toThrow('audition_resume_binding');
    await expect(illustrateReviewedAudition({ ...harness({ book: lineupBook() }).args, pages: [0, 1], scaleLineup: true, resume: saved(off) }))
      .rejects.toThrow('audition_resume_binding');
    // Control: under the same flag the saved work resumes and only the missing frame is drawn.
    const again = harness({ book: lineupBook() });
    await illustrateReviewedAudition({ ...again.args, pages: [0, 1], scaleLineup: true, resume: saved(on) });
    expect(again.args.render.mock.calls.map(c => c[0])).toEqual(['r1_page_1_0']);
  });

  it('comparison: a saved sheet is reused exactly as judged (never redrawn or re-judged) and is a page reference; each page gets its bounded attempts', async () => {
    const source = harness({ book: lineupBook() });
    await illustrateReviewedAudition({ ...source.args, pages: [2, 3] });
    const locations = source.saved.get('sheet_locations') as any;
    const held = (step: string): Spec => step.startsWith('page_2_') ? { environment: { issues: [issue('continuity', 'landmark_unique:stone', 'two stones')] } } : {};
    const h = harness({ book: lineupBook(), judge: held });
    const m = await illustrateReviewedAudition({ ...h.args, pages: [2, 3], scaleLineup: true, reuseSheets: { locations }, pageAttempts: 1 });
    expect(h.args.render.mock.calls.map(c => c[0])).toEqual(['sheet_entities_0', 'page_2_0', 'page_3_0']);
    expect(h.args.judge.mock.calls.map(c => c[0])).toEqual(['sheet_entities_0_qa', 'page_2_0_qa', 'page_3_0_qa']);
    expect(h.saved.get('sheet_locations')).toEqual(locations);
    expect(h.args.render.mock.calls.find(c => c[0] === 'page_3_0')![2]).toEqual([image('child'), image('companion'), image('sheet_entities_0'), locations.chosen.candidate]);
    // A held page keeps its one attempt: no redraw.
    expect(m.pages.find(p => p.pageNumber === 2)).toMatchObject({ status: 'held', chosenAttempt: 0, alternatives: [] });
    expect(m).toMatchObject({ scaleLineup: AUDITION_SCALE_LINEUP_VERSION, scope: { frames: [2, 3], pageAttempts: 1, reusedSheets: ['locations'] },
      sheets: { locations: { status: locations.status } } });
    // Without the options: every sheet is drawn, three page attempts, no comparison fields (as before).
    const plain = harness({ book: lineupBook(), judge: held }), p = await illustrateReviewedAudition({ ...plain.args, pages: [2, 3] });
    expect(plain.args.render.mock.calls.filter(c => String(c[0]).startsWith('page_2_'))).toHaveLength(3);
    expect(p.scope).not.toHaveProperty('pageAttempts');
    expect(p.scope).not.toHaveProperty('reusedSheets');
  });

  it('comparison: a reused sheet binds only to an identical context and its own re-derived judgement, before anything is saved or drawn', async () => {
    const source = harness({ book: lineupBook() });
    await illustrateReviewedAudition({ ...source.args, pages: [2] });
    const entities = source.saved.get('sheet_entities') as any, locations = source.saved.get('sheet_locations') as any;
    const refused = async (args: Partial<Parameters<typeof illustrateReviewedAudition>[0]>) => {
      const h = harness({ book: lineupBook() });
      await expect(illustrateReviewedAudition({ ...h.args, pages: [2], ...args })).rejects.toThrow('audition_reuse_binding');
      expect([h.args.render.mock.calls.length, h.args.judge.mock.calls.length, h.saved.size]).toEqual([0, 0, 0]);
    };
    // A legacy entities sheet has no lineup: under the lineup its context differs, so it never stands in for the lineup sheet.
    await refused({ scaleLineup: true, reuseSheets: { entities } });
    // Control: without the lineup both bind, and only the page is drawn.
    const control = harness({ book: lineupBook() });
    await illustrateReviewedAudition({ ...control.args, pages: [2], reuseSheets: { entities, locations } });
    expect(control.args.render.mock.calls.map(c => c[0])).toEqual(['page_2_0']);
    // A saved verdict is never trusted: an edited status, chosen attempt, review or context refuses. The context binds by its complete content
    // (Codex HOLD at 225477ee, F1): a rewritten context keeping the old sha, or carrying its own new sha, is refused too.
    const rewrite = (s: any) => { s.context.design.locations[0].design = 'A different place entirely.'; };
    const edits: ((s: any) => void)[] = [s => { s.status = 'held'; }, s => { s.chosen.attempt = 1; }, s => { s.contextSha = sha('other'); },
      s => { const c = s.attempts[0].review.checks.find((x: any) => x.category === 'environment');
        Object.assign(c, { verdict: 'defect', correction: 'fix', issues: [issue('continuity', 'design:garden', 'edited after the fact')] }); },
      rewrite, s => { rewrite(s); s.contextSha = sha(JSON.stringify(s.context)); }];
    for (const edit of edits) { const forged = structuredClone(locations); edit(forged); await refused({ scaleLineup: true, reuseSheets: { locations: forged } }); }
    for (const pageAttempts of [0, 4, 1.5, -1, Number.NaN])
      await expect(illustrateReviewedAudition({ ...harness().args, pages: [2], pageAttempts }), String(pageAttempts)).rejects.toThrow('audition_page_attempts');
  });

  it('comparison source: the earlier run\'s admission, saved sheet, chosen image and raw reviews bind; any other source refuses', async () => {
    const d = auditionSheetDesigns(lineupBook(), texts, true), requirementIds = sheetRequirementIds(d.locations);
    const context = { version: 'audition-sheet-context/v2', role: 'locations', design: d.locations, requirementIds };
    const contextSha = createHash('sha256').update(JSON.stringify(context)).digest('hex');
    const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#556677' } }).png().toBuffer();
    const candidate = { imageName: 'sheet_locations_1.png', imageSha: createHash('sha256').update(png).digest('hex') };
    const answer = review(candidate.imageSha, contextSha), attempt = { attempt: 0, candidate, review: answer, assessment: null, status: 'qa_supported' };
    const binding = { requestId: sha('r'), storyboardDigest: sha('b'), child: image('child'), companion: image('companion') };
    type Source = { admission: any; sheet: any; wire: any; receipt: any; png: Buffer | null };
    const genuine = (): Source => ({ admission: { requestId: binding.requestId, storyboardDigest: binding.storyboardDigest, child: binding.child, companion: binding.companion },
      sheet: { context, contextSha, requirementIds, attempts: [attempt], chosen: attempt, status: 'qa_supported' },
      wire: { instructions: auditionJudgeInstruction('sheet', context), input: [{ content: [{ text: JSON.stringify({ candidateSha: candidate.imageSha, contextSha, context }) }] }] },
      receipt: { raw: { output_text: JSON.stringify(answer) } }, png });
    let n = 0;
    const source = (s: Source) => {
      const dir = mkdtempSync(path.join(tmpdir(), `audition-reuse-${n++}-`));
      mkdirSync(path.join(dir, 'paid-stages')); mkdirSync(path.join(dir, 'illustrations'));
      writeFileSync(path.join(dir, 'admission.json'), JSON.stringify(s.admission)); writeFileSync(path.join(dir, 'sheet_locations.json'), JSON.stringify(s.sheet));
      if (s.wire) writeFileSync(path.join(dir, 'paid-stages', 'sheet_locations_0_qa.wire.json'), JSON.stringify(s.wire));
      if (s.receipt) writeFileSync(path.join(dir, 'paid-stages', 'sheet_locations_0_qa.receipt.json'), JSON.stringify(s.receipt));
      if (s.png) writeFileSync(path.join(dir, 'illustrations', candidate.imageName), s.png);
      return dir;
    };
    const out = path.join(tmpdir(), 'audition-reuse-out-never-created'), derived = { locations: { context, contextSha } };
    const reuse = (dir: string, against: Parameters<typeof readReusedSheets>[3] = derived) => readReusedSheets({ sourceRun: dir, roles: ['locations'] }, binding, out, against);
    const ok = source(genuine()), read = reuse(ok);
    expect(read.sheets.locations).toEqual(genuine().sheet);
    expect(read.binding).toEqual({ sourceRun: path.resolve(ok), roles: ['locations'], admissionSha256: sha(readFileSync(path.join(ok, 'admission.json'), 'utf8')),
      sheets: { locations: sha(readFileSync(path.join(ok, 'sheet_locations.json'), 'utf8')) } });
    const other = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#000000' } }).png().toBuffer();
    const forged: [string, (s: Source) => void][] = [['another request', s => { s.admission.requestId = sha('x'); }],
      ['another storyboard', s => { s.admission.storyboardDigest = sha('x'); }], ['another child image', s => { s.admission.child = image('other'); }],
      ['another companion image', s => { s.admission.companion = image('other'); }], ['other image bytes', s => { s.png = other; }], ['no image', s => { s.png = null; }],
      ['another instruction', s => { s.wire.instructions = AUDITION_SCALE_LINEUP_SHEET_JUDGE_INSTRUCTION; }],
      ['a request for another context', s => { s.wire.input[0].content[0].text = JSON.stringify({ candidateSha: candidate.imageSha, contextSha: sha('x'), context }); }],
      ['a request for another image', s => { s.wire.input[0].content[0].text = JSON.stringify({ candidateSha: sha('x'), contextSha, context }); }],
      ['an edited review', s => { s.receipt.raw.output_text = JSON.stringify({ ...answer, checks: answer.checks.map((c, i) => i ? c : { ...c, observation: 'edited' }) }); }],
      ['no request', s => { s.wire = null; }], ['no receipt', s => { s.receipt = null; }]];
    // Codex HOLD at 225477ee (F1): a claimed contextSha never binds by itself. The saved record's and every judged request's COMPLETE context
    // must hash to its claimed sha and equal the context this run derives, whether rewritten with the old sha kept or with a matching new sha.
    const otherContext = { ...context, design: { ...context.design,
      locations: context.design.locations.map((l, i) => i ? l : { ...l, design: 'A different place entirely.' }) } };
    const request = (ctx: unknown, ctxSha: string) => JSON.stringify({ candidateSha: candidate.imageSha, contextSha: ctxSha, context: ctx });
    const contextual: [string, (s: Source) => void][] = [
      ['saved context rewritten, old sha kept', s => { s.sheet.context = otherContext; }],
      ['saved context rewritten with its own new sha', s => { s.sheet.context = otherContext; s.sheet.contextSha = sha(JSON.stringify(otherContext)); }],
      ['saved and judged context rewritten, old sha kept', s => { s.sheet.context = otherContext; s.wire.input[0].content[0].text = request(otherContext, contextSha); }],
      ['judged context rewritten, old sha kept', s => { s.wire.input[0].content[0].text = request(otherContext, contextSha); }],
      ['judged context rewritten with its own new sha', s => { s.wire.input[0].content[0].text = request(otherContext, sha(JSON.stringify(otherContext))); }],
      ['saved context with its keys reordered (no longer the hashed bytes)', s => { const { requirementIds, ...rest } = s.sheet.context; s.sheet.context = { requirementIds, ...rest }; }]];
    for (const [label, edit] of contextual) { const s = genuine(); edit(s); expect(() => reuse(source(s)), label).toThrow('audition_reuse_source'); }
    // The derived context is the authority: none, or another one, refuses even a genuine source.
    expect(() => reuse(ok, {})).toThrow('audition_reuse_source');
    expect(() => reuse(ok, { locations: { context: otherContext, contextSha: sha(JSON.stringify(otherContext)) } })).toThrow('audition_reuse_source');
    expect(() => readReusedSheets({ sourceRun: path.relative(process.cwd(), ok), roles: ['locations'] }, binding, out, derived)).toThrow('audition_reuse_source');
    expect(() => readReusedSheets({ sourceRun: ok, roles: ['locations'] }, binding, ok, derived)).toThrow('audition_reuse_source');
  });

  it('the grant carries the flag only as the render scope\'s literal; the judge request carries the instruction its own context selects', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'audition-lineup-')), evidence = path.join(dir, 'spend.json');
    writeFileSync(evidence, '{}');
    const book = { requestId: sha('r'), storyboardDigest: sha('b') };
    const grant = { version: 'audition-spend-grant/v1', approvalReference: 'Guy chose a common-scale lineup comparison on 2026-10-16 (synthetic example)',
      book, ledger: { priorKnownApiMicroUsd: 1000, evidence: [{ file: evidence, sha256: sha('{}') }], note: 'synthetic ledger for the scale lineup' },
      capMicroUsd: 2000000, maxCalls: 20, scope: { mode: 'render', pages: [2, 3], sample: [2, 3], scaleLineup: AUDITION_SCALE_LINEUP_VERSION },
      claudeMax: 'Claude Max usage is separate: not an API invoice, not $0 and not included in this ledger' };
    const file = path.join(dir, 'grant.json'), write = (g: unknown) => { writeFileSync(file, JSON.stringify(g)); return file; };
    expect(readAuditionGrant(write(grant), book).grant.scope).toMatchObject({ scaleLineup: AUDITION_SCALE_LINEUP_VERSION });
    for (const scaleLineup of ['audition-scale-lineup/v2', true, 'yes', null])
      expect(() => readAuditionGrant(write({ ...grant, scope: { ...grant.scope, scaleLineup } }), book), String(scaleLineup)).toThrow();
    const rejudge = { mode: 'rejudge', sourceDirectory: dir, frames: [{ label: 'saved p2', pageNumber: 2, image: image('p'), predecessor: null }],
      references: { entities: { image: image('e'), status: 'approved_reference', knownFlaws: [] }, locations: { image: image('l'), status: 'approved_reference', knownFlaws: [] } } };
    expect(readAuditionGrant(write({ ...grant, scope: rejudge }), book).grant.scope.mode).toBe('rejudge');
    expect(() => readAuditionGrant(write({ ...grant, scope: { ...rejudge, scaleLineup: AUDITION_SCALE_LINEUP_VERSION } }), book)).toThrow();
    // The judge request for the same candidate: the instruction comes from the judged context.
    const bytes = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#8899aa' } }).png().toBuffer();
    const d = auditionSheetDesigns(lineupBook(), texts, true), legacy = auditionSheetDesigns(lineupBook(), texts);
    const payload = (design: unknown, role = 'entities') => auditionJudgePayload({ candidate: { imageName: 'sheet_entities_0.png', imageSha: sha('x') },
      candidateBytes: bytes, context: { version: 'audition-sheet-context/v2', role, design, requirementIds: [] }, contextSha: sha('c'), refs: [bytes, bytes],
      predecessor: null, kind: 'sheet' });
    expect((await payload(d.entities)).instructions).toBe(AUDITION_SCALE_LINEUP_SHEET_JUDGE_INSTRUCTION);
    expect((await payload(legacy.entities)).instructions).toBe(AUDITION_SHEET_JUDGE_INSTRUCTION);
    expect((await payload(d.locations, 'locations')).instructions).toBe(AUDITION_SHEET_JUDGE_INSTRUCTION);
    await expect(payload({ ...d.locations, scaleLineup: d.entities.scaleLineup }, 'locations')).rejects.toThrow('audition_scale_lineup');
    // A comparison's reuse and page bound exist only in the render scope: distinct roles, 1 to the policy's attempts.
    const comparison = { ...grant.scope, reuseSheets: { sourceRun: dir, roles: ['locations'] }, pageAttempts: 1 };
    expect(readAuditionGrant(write({ ...grant, scope: comparison }), book).grant.scope).toMatchObject({ reuseSheets: { roles: ['locations'] }, pageAttempts: 1 });
    for (const bad of [{ reuseSheets: { sourceRun: dir, roles: ['locations', 'locations'] } }, { reuseSheets: { sourceRun: dir, roles: [] } },
      { reuseSheets: { sourceRun: dir, roles: ['pages'] } }, { reuseSheets: { sourceRun: dir, roles: ['locations'], extra: 1 } }, { pageAttempts: 0 }, { pageAttempts: 4 },
      { pageAttempts: 1.5 }]) expect(() => readAuditionGrant(write({ ...grant, scope: { ...comparison, ...bad } }), book), JSON.stringify(bad)).toThrow();
    for (const extra of [{ reuseSheets: { sourceRun: dir, roles: ['locations'] } }, { pageAttempts: 1 }])
      expect(() => readAuditionGrant(write({ ...grant, scope: { ...rejudge, ...extra } }), book), JSON.stringify(extra)).toThrow();
  });
});

describe('stage-recovery/v1 on page attempts (opt-in, inside the unchanged three-attempt ceiling)', () => {
  const held1 = { scene: { issues: [issue('story', 'scene_plan', 'the key action is missing')] },
    environment: { issues: [issue('continuity', 'entity:old_tree', 'the trunk is not forked')] } } as Spec;
  const held2 = { scene: { issues: [issue('story', 'scene_plan', 'the key action is still missing, the pose changed')] },
    props: { issues: [issue('continuity', 'entity:paper_boat', 'the boat is flat')] } } as Spec;
  const judge = (step: string): Spec => step.startsWith('page_1_0') ? held1 : step.startsWith('page_1_1') ? held2 : {};
  it('after two consecutive held attempts the third carries the diagnosis of both (persistent, new, resolved); off, the last findings as before', async () => {
    const on = harness({ judge, pages: [1] });
    await illustrateReviewedAudition({ ...on.args, recovery: true });
    const third = on.prompts.get('page_1_2')!;
    expect(third).toContain('DIAGNOSIS AFTER TWO HELD ATTEMPTS (stage-recovery/v1)');
    expect(third).toContain('PERSISTENT (held in both attempts):\n- [story] scene_plan: the key action is still missing, the pose changed (earlier: the key action is missing)');
    expect(third).toContain('NEW in the last attempt:\n- [continuity] entity:paper_boat: the boat is flat');
    expect(third).toContain('RESOLVED by the last attempt (keep it exactly as it now is):\n- [continuity] entity:old_tree');
    expect(third).not.toContain('REVIEWED FINDINGS FROM THE PREVIOUS ATTEMPT');
    // The second attempt is the ordinary targeted correction (one failure only); the ceiling is unchanged: three page renders.
    expect(on.prompts.get('page_1_1')).toContain('REVIEWED FINDINGS FROM THE PREVIOUS ATTEMPT');
    expect(on.prompts.get('page_1_1')).not.toContain('DIAGNOSIS');
    expect([...on.prompts.keys()].filter(k => k.startsWith('page_1_'))).toEqual(['page_1_0', 'page_1_1', 'page_1_2']);
    const page = on.saved.get('page_1') as any;
    expect(page.recovery).toMatchObject({ version: 'stage-recovery/v1', diagnoses: [{ beforeAttempt: 2, diagnosis: { afterAttempts: [0, 1],
      trajectory: [{ key: 'continuity:entity:paper_boat', trajectory: 'new' }, { key: 'story:scene_plan', trajectory: 'repeated_check_new_detail' },
        { key: 'continuity:entity:old_tree', trajectory: 'resolved' }] } }] });
    expect((on.saved.get('reviewed_audition_manifest') as any).recovery).toBe('stage-recovery/v1');
    const off = harness({ judge, pages: [1] });
    await illustrateReviewedAudition(off.args);
    expect(off.prompts.get('page_1_2')).toContain('REVIEWED FINDINGS FROM THE PREVIOUS ATTEMPT');
    expect(off.prompts.get('page_1_2')).not.toContain('DIAGNOSIS');
    expect([(off.saved.get('page_1') as any).recovery, (off.saved.get('reviewed_audition_manifest') as any).recovery]).toEqual([undefined, undefined]);
  });
  it('only held attempts count: a render error is not a failure to diagnose; detail notes never regenerate; a low child measurement is one', async () => {
    // A provider glitch, then one held attempt: a targeted correction, not a diagnosis.
    const glitch = harness({ judge: step => step.startsWith('page_1_1') ? held2 : {}, renderFail: step => step === 'page_1_0' ? new Error('glitch') : null, pages: [1] });
    await illustrateReviewedAudition({ ...glitch.args, recovery: true });
    expect(glitch.prompts.get('page_1_2')).toContain('REVIEWED FINDINGS FROM THE PREVIOUS ATTEMPT');
    expect(glitch.prompts.get('page_1_2')).not.toContain('DIAGNOSIS');
    // Detail only: supported on the first attempt, no further render.
    const minor = harness({ judge: () => ({ framing: { issues: [issue('detail', 'framing', 'slightly off-centre')] } }), pages: [1] });
    await illustrateReviewedAudition({ ...minor.args, recovery: true });
    expect([...minor.prompts.keys()].filter(k => k.startsWith('page_1_'))).toEqual(['page_1_0']);
    // Identity below 0.70 twice: a persistent identity finding drives the diagnosis (from the measurement, never from a name).
    const face = harness({ score: () => .5, pages: [1] });
    await illustrateReviewedAudition({ ...face.args, recovery: true });
    expect(face.prompts.get('page_1_2')).toContain('PERSISTENT (held in both attempts):\n- [identity] cast:child: the measured child resemblance was below 0.70 or missing');
  });
  it('resume: a saved page whose recovery record its re-derived attempts do not reproduce is refused; the grant is its only source', async () => {
    const on = harness({ judge, pages: [1] });
    await illustrateReviewedAudition({ ...on.args, recovery: true });
    const designs = on.saved.get('audition_sheet_designs'), sheets = { entities: on.saved.get('sheet_entities') as any, locations: on.saved.get('sheet_locations') as any };
    const page = on.saved.get('page_1') as any;
    const resume = (p: any, recovery?: true) => { const h = harness({ judge, pages: [1] });
      return illustrateReviewedAudition({ ...h.args, ...(recovery ? { recovery } : {}), resume: { designs, sheets, pages: { 1: p }, stepPrefix: 'r1_' } }); };
    await expect(resume(page, true)).resolves.toBeTruthy();
    await expect(resume(page)).rejects.toThrow('audition_resume_binding');
    await expect(resume({ ...page, recovery: undefined }, true)).rejects.toThrow('audition_resume_binding');
    const edited = structuredClone(page); edited.recovery.diagnoses[0].diagnosis.prompt += ' (edited)';
    await expect(resume(edited, true)).rejects.toThrow('audition_resume_binding');
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The same-audition continuation's engine (2026-10-21): an owner-approved conservative debit of ONE unknown-cost call, and RSM-1 (a paid
// interrupted attempt survives every resume, closed and counted). Journaled through a real meter, as the halted book was.
// ---------------------------------------------------------------------------------------------------------------
describe('RSM-1 and the one-call conservative debit (real meter journal; synthetic providers)', () => {
  /** A real meter around the harness's calls: each render writes its candidate file (bytes whose digest the candidate names) and receipt. */
  const journaled = (opts: { timeoutOn?: string[]; debits?: ConservativeDebit[]; at?: { root: string; images: string } } = {}) => {
    const dir = opts.at ? null : mkdtempSync(path.join(tmpdir(), 'audition-rsm1-'));
    const root = opts.at?.root ?? path.join(dir!, 'paid'), images = opts.at?.images ?? path.join(dir!, 'illustrations');
    mkdirSync(images, { recursive: true });
    const meter = new AuditionMeter(root, 9000000, AUDITION_WORST_CASE_CALLS, 1000000, 0, undefined, opts.debits ?? []);
    const wrap = <T>(step: string, work: () => Promise<T>) => meter.run(step, { step }, 1000, async () => {
      // A client deadline: no answer and no receipt, so the call's cost is unknown.
      if (opts.timeoutOn?.includes(step)) throw new Error('Request timed out.');
      const value = await work(), render = /_[0-9]+$/.test(step);
      if (render) writeFileSync(path.join(images, `${step}.png`), step);
      return { value, estimatedMicroUsd: 10, receipt: render ? { candidate: value } : {} };
    });
    return { meter, root, images, wrap };
  };
  const renders = (h: ReturnType<typeof harness>) => h.args.render.mock.calls.map(c => String(c[0]));
  const halted = async () => {
    const run = journaled({ timeoutOn: ['page_2_0_qa'] }), h = harness({ wrap: run.wrap });
    await expect(illustrateReviewedAudition({ ...h.args, sample: [1, 2] })).rejects.toThrow('audition_unknown_cost');
    const resume = (interrupted?: unknown, pages: Record<number, unknown> = { 1: h.saved.get('page_1') }) => ({ designs: h.saved.get('audition_sheet_designs'),
      sheets: { entities: h.saved.get('sheet_entities') as any, locations: h.saved.get('sheet_locations') as any }, pages: pages as any, stepPrefix: 'r1_',
      ...(interrupted ? { interrupted: interrupted as any } : {}) });
    return { run, h, resume };
  };

  it('the halt: page 2\'s render is paid, its review ends without a receipt (unknown cost), the meter refuses the next render; no page-2 record', async () => {
    const { run, h, resume } = await halted();
    // The next attempt's render was asked for and refused by the meter BEFORE any claim (no record of it exists).
    expect(renders(h)).toEqual(['sheet_entities_0', 'sheet_locations_0', 'page_1_0', 'page_2_0', 'page_2_1']);
    expect(readdirSync(run.root).filter(n => n.startsWith('page_2_1'))).toEqual([]);
    expect([h.saved.has('page_1'), h.saved.has('page_2')]).toEqual([true, false]);
    expect(run.meter.snapshot()).toMatchObject({ unknownCost: 1, unknownOutcome: 0, failed: 1, reservedUnsettledMicroUsd: 1000 });
    expect(readdirSync(run.root).filter(n => n.startsWith('page_2_0_qa.')).sort()).toEqual(['page_2_0_qa.claim.json', 'page_2_0_qa.failure.json',
      'page_2_0_qa.result.json', 'page_2_0_qa.wire.json']);
    // A resume without the owner's debit is still refused before any claim: the unknown is never assumed zero.
    const again = harness({ wrap: journaled({ at: run }).wrap });
    await expect(illustrateReviewedAudition({ ...again.args, sample: [1, 2], resume: resume() })).rejects.toThrow('audition_unknown_cost');
    expect(readdirSync(run.root).filter(n => n.startsWith('r1_'))).toEqual([]);
  });

  it('RSM-1: the journal gives page 2\'s paid attempt back CLOSED; the resume continues at attempt 1 (at most 1 and 2), page 1 and both sheets re-bound, never redrawn', async () => {
    const { run, h, resume } = await halted();
    const closed = interruptedAttempts(run.root, run.images, 'page', '2');
    expect(closed).toEqual([{ attempt: 0, candidate: image('page_2_0'), review: null, assessment: null, status: 'unavailable', error: AUDITION_ATTEMPT_INTERRUPTED }]);
    expect(interruptedAttempts(run.root, run.images, 'page', '1')).toHaveLength(1);  // page 1 was saved: the runner never asks for it
    const debit = conservativeDebitOf(run.root, 'page_2_0_qa');
    const r = harness({ wrap: journaled({ at: run, debits: [debit] }).wrap });
    const m = await illustrateReviewedAudition({ ...r.args, sample: [1, 2], resume: resume({ pages: { 2: closed } }) });
    expect(renders(r)).toEqual(['r1_page_2_1', ...[0, 3, 4, 5, 6, 7, 8].map(n => `r1_page_${n}_0`)]);
    expect(r.args.judge.mock.calls.map(c => String(c[0])).filter(s => /page_[12]_/.test(s))).toEqual(['r1_page_2_1_qa']);
    const page2 = r.saved.get('page_2') as any;
    expect([page2.attempts.length, page2.attempts[0], page2.chosen.attempt, page2.status]).toEqual([2, closed[0], 1, 'qa_supported']);
    expect(m).toMatchObject({ status: 'qa_supported_audition', scope: { complete: true } });
    expect(m.pages.find(p => p.pageNumber === 2)!.alternatives).toEqual([{ attempt: 0, candidate: image('page_2_0'), status: 'unavailable', counts: null,
      identityScore: null, error: AUDITION_ATTEMPT_INTERRUPTED }]);
    expect(r.saved.get('page_1')).toBeUndefined();  // page 1 re-bound from its saved record, not saved again
    // The saved page 2 (with its closed attempt) re-binds on a later resume exactly as any saved page.
    const later = harness();
    await expect(illustrateReviewedAudition({ ...later.args, sample: [1, 2], resume: resume(undefined, { 1: h.saved.get('page_1'), 2: page2 }) }))
      .resolves.toMatchObject({ status: 'qa_supported_audition' });
    expect(renders(later).filter(s => /page_[12]_/.test(s))).toEqual([]);
  });

  it('RSM-1: repeated resumes keep the ceiling (attempts numbered across prefixes); three spent leave none: nothing is drawn for that page', async () => {
    const { resume } = await halted();
    const c = (attempt: number): AuditionAttempt => ({ attempt, candidate: image(`page_2_${attempt}`), review: null, assessment: null, status: 'unavailable',
      error: AUDITION_ATTEMPT_INTERRUPTED });
    const two = harness({ judge: step => step.includes('page_2_') ? { environment: { issues: [issue('continuity', 'landmark_unique:stone', 'two stones')] } } : {} });
    await illustrateReviewedAudition({ ...two.args, sample: [1, 2], resume: { ...resume({ pages: { 2: [c(0), c(1)] } }), stepPrefix: 'r2_' } });
    expect(renders(two).filter(s => s.includes('page_2_'))).toEqual(['r2_page_2_2']);
    const none = harness();
    await expect(illustrateReviewedAudition({ ...none.args, sample: [1, 2], resume: { ...resume({ pages: { 2: [c(0), c(1), c(2)] } }), stepPrefix: 'r3_' } }))
      .rejects.toThrow('audition_page_2_unavailable');
    expect(renders(none)).toEqual([]);
  });

  it('RSM-1 binding: closed attempts must be exactly what the runner reconstructs; a saved image never has interrupted attempts', async () => {
    const { run, h, resume } = await halted();
    const closed = interruptedAttempts(run.root, run.images, 'page', '2');
    const bad: [string, unknown][] = [['renumbered', [{ ...closed[0], attempt: 1 }]], ['judged', [{ ...closed[0], review: {} }]],
      ['held status', [{ ...closed[0], status: 'held' }]], ['another error', [{ ...closed[0], error: 'audition_attempt_failed' }]],
      ['an identity', [{ ...closed[0], identity: null }]], ['over the ceiling', [0, 1, 2, 3].map(a => ({ ...closed[0], attempt: a }))]];
    for (const [name, list] of bad) {
      const r = harness();
      await expect(illustrateReviewedAudition({ ...r.args, sample: [1, 2], resume: resume({ pages: { 2: list } }) }), name).rejects.toThrow('audition_resume_binding');
      expect([name, renders(r)]).toEqual([name, []]);
    }
    const saved = harness();
    await expect(illustrateReviewedAudition({ ...saved.args, sample: [1, 2], resume: resume({ pages: { 1: interruptedAttempts(run.root, run.images, 'page', '1') } }) }))
      .rejects.toThrow('audition_resume_binding');
    await expect(illustrateReviewedAudition({ ...saved.args, sample: [1, 2], resume: resume({ sheets: { entities: [{ ...closed[0] }] } }) }))
      .rejects.toThrow('audition_resume_binding');
    expect(h.saved.has('page_2')).toBe(false);
  });

  it('RSM-1 for sheets: an interrupted sheet attempt is closed too; its next attempt continues after it', async () => {
    const run = journaled({ timeoutOn: ['sheet_entities_0_qa'] }), h = harness({ wrap: run.wrap });
    await expect(illustrateReviewedAudition(h.args)).rejects.toThrow('audition_unknown_cost');
    const closed = interruptedAttempts(run.root, run.images, 'sheet', 'entities');
    expect(closed).toEqual([{ attempt: 0, candidate: image('sheet_entities_0'), review: null, assessment: null, status: 'unavailable', error: AUDITION_ATTEMPT_INTERRUPTED }]);
    const r = harness({ wrap: journaled({ at: run, debits: [conservativeDebitOf(run.root, 'sheet_entities_0_qa')] }).wrap });
    await illustrateReviewedAudition({ ...r.args, resume: { designs: h.saved.get('audition_sheet_designs'), sheets: {}, pages: {}, stepPrefix: 'r1_',
      interrupted: { sheets: { entities: closed } } } });
    expect(renders(r).slice(0, 2)).toEqual(['r1_sheet_entities_1', 'r1_sheet_locations_0']);
    expect((r.saved.get('sheet_entities') as any).attempts[0]).toEqual(closed[0]);
  });

  it('RSM-1 at every checkpoint of an attempt: a render without a receipt (no candidate); a held attempt, then a review without one; a call killed before its result is never debited', async () => {
    const resumeOf = (h: ReturnType<typeof harness>, interrupted: unknown) => ({ designs: h.saved.get('audition_sheet_designs'),
      sheets: { entities: h.saved.get('sheet_entities') as any, locations: h.saved.get('sheet_locations') as any }, pages: { 1: h.saved.get('page_1') as any },
      stepPrefix: 'r1_', interrupted: interrupted as any });
    // The render ended without a receipt: the attempt is closed with no candidate (never judged); the resume draws attempt 1.
    const drawn = journaled({ timeoutOn: ['page_2_0'] }), d = harness({ wrap: drawn.wrap });
    await expect(illustrateReviewedAudition({ ...d.args, sample: [1, 2] })).rejects.toThrow('audition_unknown_cost');
    expect(d.args.judge.mock.calls.map(c => String(c[0])).filter(s => s.startsWith('page_2_'))).toEqual([]);
    const none = interruptedAttempts(drawn.root, drawn.images, 'page', '2');
    expect(none).toEqual([{ attempt: 0, candidate: null, review: null, assessment: null, status: 'unavailable', error: AUDITION_ATTEMPT_INTERRUPTED }]);
    const dr = harness({ wrap: journaled({ at: drawn, debits: [conservativeDebitOf(drawn.root, 'page_2_0')] }).wrap });
    await illustrateReviewedAudition({ ...dr.args, sample: [1, 2], resume: resumeOf(d, { pages: { 2: none } }) });
    expect(renders(dr).filter(s => s.includes('page_2_'))).toEqual(['r1_page_2_1']);
    expect((dr.saved.get('page_2') as any).attempts.map((a: AuditionAttempt) => [a.attempt, a.status])).toEqual([[0, 'unavailable'], [1, 'qa_supported']]);
    // A held attempt 0, then attempt 1's review ended without a receipt: both are closed (the minimal route re-judges and re-uses neither).
    const held = journaled({ timeoutOn: ['page_2_1_qa'] });
    const h = harness({ wrap: held.wrap, judge: step => step === 'page_2_0_qa' ? { environment: { issues: [issue('continuity', 'landmark_unique:stone', 'two stones')] } } : {} });
    await expect(illustrateReviewedAudition({ ...h.args, sample: [1, 2] })).rejects.toThrow('audition_unknown_cost');
    expect(renders(h).filter(s => s.startsWith('page_2_'))).toEqual(['page_2_0', 'page_2_1', 'page_2_2']);
    const both = interruptedAttempts(held.root, held.images, 'page', '2');
    expect(both).toEqual([0, 1].map(attempt => ({ attempt, candidate: image(`page_2_${attempt}`), review: null, assessment: null, status: 'unavailable',
      error: AUDITION_ATTEMPT_INTERRUPTED })));
    const hr = harness({ wrap: journaled({ at: held, debits: [conservativeDebitOf(held.root, 'page_2_1_qa')] }).wrap });
    await illustrateReviewedAudition({ ...hr.args, sample: [1, 2], resume: resumeOf(h, { pages: { 2: both } }) });
    expect(renders(hr).filter(s => s.includes('page_2_'))).toEqual(['r1_page_2_2']);
    expect((hr.saved.get('page_2') as any).chosen.attempt).toBe(2);
    // Killed between a claim and its result (no result, no failure record): an unknown outcome. It is never debitable, a debit made
    // before cannot bind it, and the resume stops before any claim either way.
    const { run, h: k, resume } = await halted(), debit = conservativeDebitOf(run.root, 'page_2_0_qa');
    for (const kind of ['result', 'failure']) unlinkSync(path.join(run.root, `page_2_0_qa.${kind}.json`));
    expect(() => conservativeDebitOf(run.root, 'page_2_0_qa')).toThrow('audition_meter_debit');
    const closed = interruptedAttempts(run.root, run.images, 'page', '2');
    for (const [debits, code] of [[[debit], 'audition_meter_debit'], [[], 'audition_unknown_cost']] as const) {
      const again = harness({ wrap: journaled({ at: run, debits: [...debits] }).wrap });
      await expect(illustrateReviewedAudition({ ...again.args, sample: [1, 2], resume: resume({ pages: { 2: closed } }) }), code).rejects.toThrow(code);
    }
    expect([readdirSync(run.root).filter(n => n.startsWith('r1_')), k.saved.has('page_2')]).toEqual([[], false]);
  });

  it('the journal reconstruction refuses a gap, a repeat across prefixes (the pre-fix restart), a foreign candidate or a bad name; nothing journaled: none', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'audition-journal-')), root = path.join(dir, 'paid'), images = path.join(dir, 'illustrations');
    mkdirSync(root); mkdirSync(images);
    const record = (step: string, candidate = true) => {
      writeFileSync(path.join(root, `${step}.claim.json`), JSON.stringify({ step, seq: 0, wireDigest: sha(step), maximumMicroUsd: 1000 }));
      writeFileSync(path.join(root, `${step}.result.json`), JSON.stringify({ wireDigest: sha(step), estimatedMicroUsd: 10, completed: true }));
      writeFileSync(path.join(root, `${step}.receipt.json`), JSON.stringify({ candidate: image(step) }));
      if (candidate) writeFileSync(path.join(images, `${step}.png`), step);
    };
    expect(interruptedAttempts(root, images, 'page', '4')).toEqual([]);
    expect(interruptedAttempts(path.join(dir, 'missing'), images, 'page', '4')).toEqual([]);
    record('page_4_0'); record('r1_page_4_1');
    expect(interruptedAttempts(root, images, 'page', '4').map(a => a.attempt)).toEqual([0, 1]);
    record('r1_page_4_0');
    expect(() => interruptedAttempts(root, images, 'page', '4')).toThrow('audition_resume_journal');
    record('page_5_1');
    expect(() => interruptedAttempts(root, images, 'page', '5')).toThrow('audition_resume_journal');
    record('page_6_0', false);
    expect(() => interruptedAttempts(root, images, 'page', '6')).toThrow('audition_resume_journal');
    writeFileSync(path.join(images, 'page_6_0.png'), 'other bytes');
    expect(() => interruptedAttempts(root, images, 'page', '6')).toThrow('audition_resume_journal');
    for (const [phase, name] of [['page', '9'], ['page', 'entities'], ['sheet', '2'], ['sheet', 'props']] as const)
      expect(() => interruptedAttempts(root, images, phase, name), `${phase}:${name}`).toThrow('audition_resume_journal');
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The ONE re-review (2026-10-22, audition-rereview/v1): a drawn page attempt whose review was lost is judged once more, the same image and
// request, as a step successor of the saved page; the saved page stays as it was. Journaled through a real meter, as the real book was.
// ---------------------------------------------------------------------------------------------------------------
describe('the ONE re-review of a drawn attempt whose review was lost (a step successor of the saved page)', () => {
  const journaled = (opts: { timeoutOn?: string[]; debits?: ConservativeDebit[]; at?: { root: string; images: string } } = {}) => {
    const dir = opts.at ? null : mkdtempSync(path.join(tmpdir(), 'audition-rereview-'));
    const root = opts.at?.root ?? path.join(dir!, 'paid'), images = opts.at?.images ?? path.join(dir!, 'illustrations');
    mkdirSync(images, { recursive: true });
    const meter = new AuditionMeter(root, 9000000, AUDITION_WORST_CASE_CALLS, 1000000, 0, undefined, opts.debits ?? []);
    const wrap = <T>(step: string, work: () => Promise<T>) => meter.run(step, { step }, 1000, async () => {
      if (opts.timeoutOn?.includes(step)) throw new Error('Request timed out.');
      const value = await work(), render = /_[0-9]+$/.test(step);
      if (render) writeFileSync(path.join(images, `${step}.png`), step);
      return { value, estimatedMicroUsd: 10, receipt: render ? { candidate: value } : {} };
    });
    return { meter, root, images, wrap };
  };
  const renders = (h: ReturnType<typeof harness>) => h.args.render.mock.calls.map(c => String(c[0]));
  const judged = (h: ReturnType<typeof harness>) => h.args.judge.mock.calls.map(c => String(c[0]));
  const measured = (h: ReturnType<typeof harness>) => h.args.identity.mock.calls.map(c => String(c[0]));
  const stones = { environment: { issues: [issue('continuity', 'landmark_unique:stone', 'two stones')] } };
  /** The continuation's end: page 2 held twice, its last drawn attempt's review lost; the sample holds; nothing else is drawn or sent. */
  const ended = async () => {
    const run = journaled({ timeoutOn: ['page_2_2_qa'] });
    const h = harness({ wrap: run.wrap, judge: step => step === 'page_2_0_qa' || step === 'page_2_1_qa' ? stones : {} });
    const m = await illustrateReviewedAudition({ ...h.args, sample: [1, 2] });
    return { run, h, m, debit: conservativeDebitOf(run.root, 'page_2_2_qa') };
  };
  const resumeOf = (h: ReturnType<typeof harness>, rereview: unknown, pages: Record<number, unknown> = { 1: h.saved.get('page_1'), 2: h.saved.get('page_2') }) => ({
    designs: h.saved.get('audition_sheet_designs'), sheets: { entities: h.saved.get('sheet_entities') as any, locations: h.saved.get('sheet_locations') as any },
    pages: pages as any, stepPrefix: 'r1_', rereview: rereview as any });

  it('the halt it starts from: page 2\'s last drawn attempt has no verdict, its review an unknown cost; the sample holds and nothing else is sent', async () => {
    const { run, h, m } = await ended();
    const page2 = h.saved.get('page_2') as any;
    expect(page2.attempts.map((a: AuditionAttempt) => [a.attempt, a.status, a.candidate?.imageName ?? null])).toEqual([[0, 'held', 'page_2_0.png'],
      [1, 'held', 'page_2_1.png'], [2, 'unavailable', 'page_2_2.png']]);
    expect([page2.attempts[2].review, page2.attempts[2].assessment, 'identity' in page2.attempts[2]]).toEqual([null, null, false]);
    expect([m.status, run.meter.snapshot().unknownCost, renders(h).filter(s => !/^page_[12]_|^sheet_/.test(s))]).toEqual(['held_sample', 1, []]);
  });

  it('ONE re-review: that attempt is judged once (no image drawn, no attempt added), the saved page untouched; it passes, so the cover and the rest are drawn', async () => {
    const { run, h, debit } = await ended();
    const r = harness({ wrap: journaled({ at: run, debits: [debit] }).wrap });
    const m = await illustrateReviewedAudition({ ...r.args, sample: [1, 2], resume: resumeOf(h, { pages: { 2: { attempt: 2 } } }) });
    expect(judged(r).filter(s => /page_2_/.test(s))).toEqual(['r1_page_2_2_qa']);
    expect(measured(r).filter(s => /page_2_/.test(s))).toEqual(['r1_page_2_2_identity']);
    expect(renders(r).filter(s => /page_[12]_/.test(s))).toEqual([]);
    expect(renders(r)).toEqual([0, 3, 4, 5, 6, 7, 8].map(n => `r1_page_${n}_0`));
    const successor = r.saved.get('page_2_rereview') as SavedRereview;
    expect(successor).toMatchObject({ version: AUDITION_REREVIEW_VERSION, pageNumber: 2, attempt: 2, priorSha256: previewSha(canonicalJson(h.saved.get('page_2'))),
      reviewed: { attempt: 2, candidate: image('page_2_2'), status: 'qa_supported' }, chosen: { attempt: 2 }, status: 'qa_supported' });
    expect([r.saved.has('page_2'), r.saved.has('page_1')]).toEqual([false, false]);
    expect(m).toMatchObject({ status: 'qa_supported_audition', scope: { complete: true } });
    expect(m.pages.find(p => p.pageNumber === 2)).toMatchObject({ status: 'qa_supported', chosenAttempt: 2, rereview: { version: AUDITION_REREVIEW_VERSION, attempt: 2 } });
    expect(m.pages.find(p => p.pageNumber === 2)!.alternatives.map(a => [a.attempt, a.status])).toEqual([[0, 'held'], [1, 'held']]);
  });

  it('a held re-review keeps the sample held (nothing else drawn); a review lost again too; each successor is saved as judged', async () => {
    for (const [name, judge, timeoutOn, expected] of [['held', (s: string) => s === 'r1_page_2_2_qa' ? stones : {}, [], 'held'],
      ['lost again', () => ({}), ['r1_page_2_2_qa'], 'unavailable']] as const) {
      const { run, h, debit } = await ended();
      const r = harness({ wrap: journaled({ at: run, debits: [debit], timeoutOn: [...timeoutOn] }).wrap, judge });
      const m = await illustrateReviewedAudition({ ...r.args, sample: [1, 2], resume: resumeOf(h, { pages: { 2: { attempt: 2 } } }) });
      expect([name, m.status, renders(r)]).toEqual([name, 'held_sample', []]);
      expect([name, (r.saved.get('page_2_rereview') as SavedRereview).reviewed.status, (r.saved.get('page_2_rereview') as SavedRereview).status])
        .toEqual([name, expected, 'held']);
    }
  });

  it('only a drawn attempt whose review was lost can be re-reviewed, only on a saved page; refused before anything is sent', async () => {
    const { run, h, debit } = await ended();
    const page2 = h.saved.get('page_2') as any;
    const cases: [string, unknown, Record<number, unknown>?][] = [['a judged attempt', { pages: { 2: { attempt: 1 } } }], ['no such attempt', { pages: { 2: { attempt: 5 } } }],
      ['a page without a saved record', { pages: { 3: { attempt: 0 } } }],
      ['an attempt without its image', { pages: { 2: { attempt: 2 } } }, { 1: h.saved.get('page_1'), 2: { ...page2, attempts: page2.attempts.map((a: AuditionAttempt) => a.attempt === 2 ? { ...a, candidate: null } : a) } }],
      ['an attempt already measured', { pages: { 2: { attempt: 2 } } }, { 1: h.saved.get('page_1'), 2: { ...page2, attempts: page2.attempts.map((a: AuditionAttempt) => a.attempt === 2 ? { ...a, identity: null } : a) } }],
      // A review that ARRIVED but was unusable is not a lost review (its answer exists): never re-reviewed.
      ['an arrived but unusable review', { pages: { 2: { attempt: 2 } } }, { 1: h.saved.get('page_1'), 2: { ...page2, attempts: page2.attempts.map((a: AuditionAttempt) =>
        a.attempt === 2 ? { ...a, status: 'review_unusable', error: 'audition_pixel_schema' } : a) } }]];
    for (const [name, rereview, pages] of cases) {
      const r = harness({ wrap: journaled({ at: run, debits: [debit] }).wrap });
      await expect(illustrateReviewedAudition({ ...r.args, sample: [1, 2], resume: resumeOf(h, rereview, pages) }), name).rejects.toThrow(/audition_rereview_binding|audition_resume_binding/);
      expect([name, judged(r).length, renders(r).length]).toEqual([name, 0, 0]);
    }
  });

  it('a later resume re-binds the saved successor (no second review); any change to it refuses', async () => {
    const { run, h, debit } = await ended();
    const r = harness({ wrap: journaled({ at: run, debits: [debit] }).wrap });
    await illustrateReviewedAudition({ ...r.args, sample: [1, 2], resume: resumeOf(h, { pages: { 2: { attempt: 2 } } }) });
    const saved = r.saved.get('page_2_rereview') as SavedRereview;
    const pages = { 1: h.saved.get('page_1'), 2: h.saved.get('page_2'), ...Object.fromEntries([0, 3, 4, 5, 6, 7, 8].map(n => [n, r.saved.get(`page_${n}`)])) };
    const later = harness();
    const m = await illustrateReviewedAudition({ ...later.args, sample: [1, 2], resume: resumeOf(h, { pages: { 2: { attempt: 2, saved } } }, pages) });
    expect([judged(later), renders(later), m.status]).toEqual([[], [], 'qa_supported_audition']);
    const bad: [string, SavedRereview][] = [['prior', { ...saved, priorSha256: sha('x') }], ['attempt', { ...saved, attempt: 1 }],
      ['context', { ...saved, contextSha: sha('x') }], ['status', { ...saved, status: 'held' }], ['chosen', { ...saved, chosen: { ...saved.chosen, attempt: 1 } }],
      ['verdict', { ...saved, reviewed: { ...saved.reviewed, assessment: { ...saved.reviewed.assessment!, counts: { ...saved.reviewed.assessment!.counts, story: 1 } } } }],
      ['image', { ...saved, reviewed: { ...saved.reviewed, candidate: image('other') } }], ['version', { ...saved, version: 'x' as never }]];
    for (const [name, s] of bad) {
      const again = harness();
      await expect(illustrateReviewedAudition({ ...again.args, sample: [1, 2], resume: resumeOf(h, { pages: { 2: { attempt: 2, saved: s } } }, pages) }), name)
        .rejects.toThrow('audition_rereview_binding');
      expect([name, judged(again).length, renders(again).length]).toEqual([name, 0, 0]);
    }
  });

  it('the runner\'s allowance binds the journal: the lost review debited by its own records, the render that drew exactly that image, no other review claimed', async () => {
    const { run, h, debit } = await ended();
    const pages = { 2: h.saved.get('page_2') as any }, at = { paid: run.root, pages, rebound: {}, debits: [debit], stepPrefix: 'r1_' };
    expect(rereviewAllowance([{ page: 2, attempt: 2, lostStep: 'page_2_2_qa' }], at))
      .toEqual([{ page: 2, attempt: 2, lostStep: 'page_2_2_qa', wireDigest: debit.wireDigest, step: 'r1_page_2_2_qa' }]);
    const refused: [string, Parameters<typeof rereviewAllowance>][] = [
      ['not debited', [[{ page: 2, attempt: 2, lostStep: 'page_2_2_qa' }], { ...at, debits: [] }]],
      ['another debit', [[{ page: 2, attempt: 2, lostStep: 'page_2_2_qa' }], { ...at, debits: [{ ...debit, seq: 0 }] }]],
      ['a judged review', [[{ page: 2, attempt: 1, lostStep: 'page_2_1_qa' }], at]],
      ['a step of another attempt', [[{ page: 2, attempt: 2, lostStep: 'page_2_1_qa' }], at]],
      ['no saved page', [[{ page: 2, attempt: 2, lostStep: 'page_2_2_qa' }], { ...at, pages: {} }]],
      ['already re-bound', [[{ page: 2, attempt: 2, lostStep: 'page_2_2_qa' }], { ...at, rebound: { 2: {} } }]],
      ['twice', [[{ page: 2, attempt: 2, lostStep: 'page_2_2_qa' }, { page: 2, attempt: 2, lostStep: 'page_2_2_qa' }], at]],
      ['another image', [[{ page: 2, attempt: 2, lostStep: 'page_2_2_qa' }], { ...at, pages: { 2: { ...pages[2], attempts: pages[2].attempts.map((a: AuditionAttempt) =>
        a.attempt === 2 ? { ...a, candidate: image('other') } : a) } } }]]];
    for (const [name, [list, args]] of refused) expect(() => rereviewAllowance(list, args), name).toThrow('audition_rereview_binding');
    // Another review of that attempt already claimed (an earlier re-review under any prefix): refused.
    writeFileSync(path.join(run.root, 'r5_page_2_2_qa.claim.json'), JSON.stringify({ step: 'r5_page_2_2_qa', seq: 99, wireDigest: debit.wireDigest, maximumMicroUsd: 1000 }));
    expect(() => rereviewAllowance([{ page: 2, attempt: 2, lostStep: 'page_2_2_qa' }], at)).toThrow('audition_rereview_binding');
  });

  it('a re-review whose request is not the lost one stops the run (fatal), never an unavailable attempt; nothing after it is drawn', async () => {
    const { run, h, debit } = await ended();
    const r = harness({ wrap: async <T>(step: string, work: () => Promise<T>) => {
      if (step === 'r1_page_2_2_qa') throw new ReviewedAuditionError('audition_rereview_wire');
      return journaled({ at: run, debits: [debit] }).wrap(step, work);
    } });
    await expect(illustrateReviewedAudition({ ...r.args, sample: [1, 2], resume: resumeOf(h, { pages: { 2: { attempt: 2 } } }) })).rejects.toThrow('audition_rereview_wire');
    expect([renders(r), r.saved.has('page_2_rereview'), readdirSync(run.root).filter(n => n.startsWith('r1_'))]).toEqual([[], false, []]);
  });
});

describe('the one-call conservative debit (opt-in, owner-approved): bound to exactly one unknown-cost record', () => {
  const meterIn = (debits: ConservativeDebit[] = [], root?: string) =>
    new AuditionMeter(root ?? path.join(mkdtempSync(path.join(tmpdir(), 'audition-debit-')), 'paid'), 4000000, 10, 3400000, 0, undefined, debits);
  const timedOut = async () => {
    const meter = meterIn();
    await meter.run('a', { a: 1 }, 1000, async () => ({ value: 1, estimatedMicroUsd: 40, receipt: {} }));
    await expect(meter.run('b_qa', { b: 1 }, 600, async () => { throw new Error('Request timed out.'); })).rejects.toThrow('Request timed out.');
    return meter;
  };
  it('without it the unknown stops the meter; with it the debit counts against the cap apart from known spend; a NEW unknown still stops', async () => {
    const meter = await timedOut(), dispatch = vi.fn();
    expect(meter.snapshot()).toMatchObject({ newKnownApiMicroUsd: 40, reservedUnsettledMicroUsd: 600, unknownCost: 1, cumulativeAccountedMicroUsd: 3400640 });
    expect(Object.keys(meter.snapshot())).not.toContain('conservativeDebitMicroUsd');
    await expect(meter.run('c', { c: 1 }, 10, dispatch)).rejects.toThrow('audition_unknown_cost');
    expect(dispatch).not.toHaveBeenCalled();
    const debit = conservativeDebitOf(meter.root, 'b_qa');
    expect(debit).toMatchObject({ version: 'audition-conservative-debit/v1', step: 'b_qa', seq: 1, maximumMicroUsd: 600, debitMicroUsd: 600, actualCost: 'unknown' });
    const debited = meterIn([debit], meter.root);
    expect(debited.snapshot()).toMatchObject({ newKnownApiMicroUsd: 40, reservedUnsettledMicroUsd: 0, conservativeDebitMicroUsd: 600, conservativeDebitCalls: 1,
      actualChargeUnknownCalls: 1, unknownCost: 0, failed: 1, cumulativeAccountedMicroUsd: 3400640 });
    expect(await debited.run('c', { c: 1 }, 10, async () => ({ value: 2, estimatedMicroUsd: 5, receipt: {} }))).toBe(2);
    await expect(debited.run('d_qa', { d: 1 }, 10, async () => { throw new Error('Request timed out.'); })).rejects.toThrow('Request timed out.');
    const after = vi.fn();
    await expect(debited.run('e', { e: 1 }, 10, after)).rejects.toThrow('audition_unknown_cost');
    expect(after).not.toHaveBeenCalled();
    expect(debited.snapshot()).toMatchObject({ unknownCost: 1, conservativeDebitMicroUsd: 600, newKnownApiMicroUsd: 45 });
  });
  it('a debit that does not bind its one record exactly refuses: another sequence, request, maximum, record bytes, a known or missing record, a repeat', async () => {
    const meter = await timedOut(), debit = conservativeDebitOf(meter.root, 'b_qa');
    const variants: [string, ConservativeDebit[]][] = [['seq', [{ ...debit, seq: 0 }]], ['wire', [{ ...debit, wireDigest: sha('x') }]],
      ['claim bytes', [{ ...debit, claimSha256: sha('x') }]], ['result bytes', [{ ...debit, resultSha256: sha('x') }]],
      ['failure bytes', [{ ...debit, failureSha256: sha('x') }]], ['a known record', [{ ...debit, step: 'a' }]], ['no record', [{ ...debit, step: 'zz' }]],
      ['repeated', [debit, debit]]];
    for (const [name, debits] of variants) expect(() => meterIn(debits, meter.root).snapshot(), name).toThrow('audition_meter_debit');
    for (const [name, d] of [['below the maximum', { ...debit, debitMicroUsd: 599 }], ['above', { ...debit, debitMicroUsd: 601, maximumMicroUsd: 601 }],
      ['actual cost claimed', { ...debit, actualCost: 'known' }], ['other version', { ...debit, version: 'x' }]] as const)
      expect(() => meterIn([d as never], meter.root).snapshot(), name).toThrow('audition_meter_debit');
    // The record changed after the decision: refused.
    writeFileSync(path.join(meter.root, 'b_qa.failure.json'), readFileSync(path.join(meter.root, 'b_qa.failure.json'), 'utf8') + ' ');
    expect(() => meterIn([debit], meter.root).snapshot()).toThrow('audition_meter_debit');
  });
  it('only a call that ended without a receipt can be debited: a known cost, a completed call, a receipt or a missing failure record refuses', async () => {
    const meter = await timedOut();
    expect(() => conservativeDebitOf(meter.root, 'a')).toThrow('audition_meter_debit');
    expect(() => conservativeDebitOf(meter.root, 'zz')).toThrow('audition_meter_debit');
    const withCost = meterIn();
    await expect(withCost.run('p_qa', { p: 1 }, 600, async () => { throw Object.assign(new Error('x'), { receipt: { estimatedMicroUsd: 7 } }); })).rejects.toThrow('x');
    expect(() => conservativeDebitOf(withCost.root, 'p_qa')).toThrow('audition_meter_debit');
    const pending = meterIn();
    await pending.run('q', { q: 1 }, 600, async () => ({ value: 1, estimatedMicroUsd: 1, receipt: {} }));
    unlinkSync(path.join(pending.root, 'q.result.json'));
    expect(() => conservativeDebitOf(pending.root, 'q')).toThrow('audition_meter_debit');
  });
});

describe('entity-material-function/v1 at the actual render boundary (synthetic adapters)',()=>{
  it('the fresh-cohort render path also receives the exact material authority before its page reviews',async()=>{
    const h=harness({book:materialBook(),coverage:true});
    await illustrateReviewedAudition({...h.args,pageAttempts:1,structuralAnatomy:true,landmarkTopology:LANDMARK_COVERAGE_TOPOLOGY_VERSION,
      freshCohort:'audition-fresh-cohort/v1'});
    const calls=h.args.render.mock.calls.filter(c=>c[0].startsWith('page_'));
    expect(calls).toHaveLength(9);
    // Only currently visible constructions enter the frame; hidden ones do not leak future material state.
    for(const call of calls){const context=h.contexts.get(call[0]+'_qa');
      expect(call[1]).toContain('ENTITY MATERIAL/FUNCTION CONTRACT');
      if(context.materialFunction.entities.length)expect(call[1]).toContain(quote);
    }
  });

  const quote='A paper boat made from its source material.';
  const materialBook=()=>({...typedFixture(),materialFunction:{version:'entity-material-function/v1' as const,
    entities:[{id:'paper_boat',builtFrom:{sources:[{entityId:'ribbon'}],evidence:{citation:'p1:s1',quote}}}]}}) as PersonalStoryboard;
  it('binds source materials into actual sheet/page contexts and both first-render and correction prompts',async()=>{
    const h=harness({book:materialBook(),pages:[1],judge:step=>step==='page_1_0_qa'?{props:{verdict:'defect',issues:[issue('continuity','material:paper_boat')]}}:{}});
    await illustrateReviewedAudition({...h.args,pageAttempts:2});
    for(const step of ['sheet_entities_0','sheet_locations_0','page_1_0','page_1_1']){
      expect(h.prompts.get(step)).toContain(quote);expect(h.prompts.get(step)).toContain('ENTITY MATERIAL/FUNCTION CONTRACT');
    }
    const c=h.contexts.get('page_1_0_qa');expect(c.materialFunction.entities[0].id).toBe('paper_boat');
    expect(c.requirementIds).toContain('material:paper_boat');
  });
  it('the opt-in does not add prompt/context bytes when absent',async()=>{
    const h=harness({book:typedFixture(),pages:[1]});await illustrateReviewedAudition({...h.args,pageAttempts:1});
    expect([...h.prompts.values()].every(p=>!p.includes('ENTITY MATERIAL/FUNCTION CONTRACT'))).toBe(true);
    expect([...h.contexts.values()].every(c=>!('materialFunction' in c))).toBe(true);
  });
  it('local scene corrections retain the material rule and seal the actual complete render recipe',async()=>{
    const h=harness({book:materialBook(),coverage:true,pages:[1],judge:step=>step.startsWith('page_')?{environment:{verdict:'defect',issues:[issue('continuity','visual_language')]}}:{}});
    await illustrateReviewedAudition({...h.args,pageAttempts:1,structuralAnatomy:true,landmarkTopology:LANDMARK_COVERAGE_TOPOLOGY_VERSION});
    const page=h.saved.get('page_1') as SavedPage,context=h.contexts.get('page_1_0_qa');
    await repairReviewedAuditionPage({page:1,prefix:'r1_',consumedAttemptsBefore:1,prior:page.chosen,context,contextSha:page.contextSha,
      canonical:context.references,predecessor:null,check:h.args.check,render:h.args.render,judge:h.args.judge,identity:h.args.identity,save:h.args.save,materialScene:true});
    const call=h.args.render.mock.calls[h.args.render.mock.calls.length-1];
    expect(call[1]).toContain(quote);expect(call[1]).toContain('ENTITY MATERIAL/FUNCTION CONTRACT');
    const saved=h.saved.get('scene_repair_1_candidate') as any;
    expect(saved.recipeSha256).toBe(previewSha(canonicalJson({prompt:call[1],references:call[2],mode:call[3],roles:call[4],provenance:saved.sceneRepair})));
  });
});

describe('companion-scale/v1 actual render/review/resume boundaries (synthetic adapters)',()=>{
  it('material and scale conditioning coexist at the actual render boundary',async()=>{
    const b=scaleBook() as any;b.materialFunction={version:'entity-material-function/v1',entities:[{id:'paper_boat',builtFrom:{sources:[{entityId:'ribbon'}],evidence:{citation:'p1:s1',quote:'Synthetic source material quote.'}}}]};
    const h=runHarness(within,{pages:[1],book:b});await illustrateReviewedAudition({...h.args,pageAttempts:1});
    expect(h.prompts.get('page_1_0')).toContain('SOURCE-BOUND CONSTRUCTION');expect(h.prompts.get('page_1_0')).toContain('APPROVED NATURAL STANDING SCALE');
    expect(h.contexts.get('page_1_0_qa')).toHaveProperty('materialFunction');expect(h.contexts.get('page_1_0_qa')).toHaveProperty('companionScale');
  });

  it('a verified scene correction keeps the scale conditioning and seals the actual recipe',async()=>{
    const h=runHarness(within,{pages:[1],coverage:true,judge:step=>step.startsWith('page_')?{environment:{verdict:'defect',issues:[issue('continuity','visual_language')]}}:{}});
    await illustrateReviewedAudition({...h.args,pageAttempts:1,structuralAnatomy:true,landmarkTopology:LANDMARK_COVERAGE_TOPOLOGY_VERSION});
    const page=h.saved.get('page_1') as SavedPage,context=h.contexts.get('page_1_0_qa');
    await repairReviewedAuditionPage({page:1,prefix:'r1_',consumedAttemptsBefore:1,prior:page.chosen,context,contextSha:page.contextSha,
      canonical:context.references,predecessor:null,check:h.args.check,render:h.args.render,judge:h.args.judge,identity:h.args.identity,save:h.args.save,materialScene:true});
    const call=h.args.render.mock.calls[h.args.render.mock.calls.length-1],saved=h.saved.get('scene_repair_1_candidate') as any;
    expect(call[1]).toContain('APPROVED NATURAL STANDING SCALE');expect(call[1]).not.toContain('return scaleEvidence');
    expect(saved.recipeSha256).toBe(previewSha(canonicalJson({prompt:call[1],references:call[2],mode:call[3],roles:call[4],provenance:saved.sceneRepair})));
    expect((h.saved.get('scene_repair_1_result') as any).corrected.assessment.companionScale.disposition).toBe('pass');
  });

  const scaleBook=(id='elephant_momo')=>{const b=typedFixture() as any,a=companionScaleAuthority(id),r=a.scale.standingHeightInChildHeights;
    b.companionScale=a;b.plan.continuity.companionStandingHeightInChildHeights=(r.min+r.max)/2;return b as PersonalStoryboard;};
  const runHarness=(evidence:ScaleEvidence,extra:Parameters<typeof harness>[0]={pages:[1]})=>{
    const h=harness({book:scaleBook(),...extra}),original=h.args.judge;
    const judge=vi.fn(async(...args:Parameters<typeof original>)=>{
      const reply=await original(...args),context=args[2] as any;
      return context.companionScale?{...reply,scaleEvidence:evidence}:reply;
    });
    return {...h,args:{...h.args,companionDescription:'Momo, a medium upright elephant in his admitted natural pose',judge}};
  };
  const within={comparable:true,reason:'same_plane_standing' as const,estimatedRatio:.7};
  const airborne={comparable:false,reason:'airborne' as const,estimatedRatio:null};
  it('a good standing frame carries its authority into the actual render, judge context and manifest',async()=>{
    const h=runHarness(within),m=await illustrateReviewedAudition({...h.args,pageAttempts:1});
    expect(h.prompts.get('page_1_0')).toContain('APPROVED NATURAL STANDING SCALE');
    expect(h.prompts.get('page_1_0')).not.toContain('return scaleEvidence');
    expect(h.contexts.get('page_1_0_qa').companionScale.companionId).toBe('elephant_momo');
    expect(m.scaleVerification).toMatchObject({status:'observed_within_range',comparableFrames:1,abstainedFrames:0});
    expect(m.pages[0].companionScale?.disposition).toBe('pass');expect(m.pages[0].identityPassed).toBe(true);
  });
  it('an all-pass model checklist cannot certify an observed oversize or an airborne frame',async()=>{
    const bad=runHarness({...within,estimatedRatio:.9}),m=await illustrateReviewedAudition({...bad.args,pageAttempts:1});
    expect(m.pages[0].status).toBe('held');expect(m.pages[0].companionScale?.disposition).toBe('defect');
    const air=runHarness(airborne),a=await illustrateReviewedAudition({...air.args,pageAttempts:3});
    expect([...air.prompts.keys()].filter(k=>k.startsWith('page_'))).toHaveLength(1);
    expect(a.pages[0].status).toBe('qa_supported');expect(a.pages[0].companionScale?.disposition).toBe('abstain');expect(a.status).toBe('held_audition_with_findings');
    expect(a.scaleVerification?.status).toBe('unverified');expect(a.pages[0].identityPassed).toBe(true);
    expect(auditionCorrections((air.saved.get('page_1') as SavedPage).chosen,'page')).not.toContain('Standing scale abstained');
  });
  it('all nine incomparable frames remain scale unverified even with full diagnostic coverage',async()=>{
    const h=runHarness(airborne,{coverage:true}),m=await illustrateReviewedAudition({...h.args,pageAttempts:1,structuralAnatomy:true,
      landmarkTopology:LANDMARK_COVERAGE_TOPOLOGY_VERSION,freshCohort:'audition-fresh-cohort/v1'});
    expect(m.scope.complete).toBe(true);expect(m.pages).toHaveLength(9);
    expect(m.scaleVerification).toMatchObject({status:'unverified',comparableFrames:0,abstainedFrames:9});
    expect(m.pages.every(p=>p.status==='qa_supported'&&p.companionScale?.disposition==='abstain')).toBe(true);
    expect(m.productionQualified).toBe(false);
  });

  it('NATIVE-CDE new gate stops an all-abstained sample before any remaining frame',async()=>{
    const h=runHarness(airborne,{}),m=await illustrateReviewedAudition({...h.args,pageAttempts:1,sample:[1,2],
      sampleScaleGate:'companion-scale-sample-gate/v1'} as any);
    expect([...h.prompts.keys()].filter(k=>k.startsWith('page_'))).toEqual(['page_1_0','page_2_0']);
    expect(m.status).toBe('held_sample');expect(m.scope.complete).toBe(false);
    expect(m.pages.every(p=>p.status==='qa_supported'&&p.companionScale?.disposition==='abstain')).toBe(true);
    expect(m.scaleVerification?.status).toBe('unverified');
    expect((m as any).scope.sampleScaleGate).toMatchObject({version:'companion-scale-sample-gate/v1',status:'held_unverified'});
  });
  it('NATIVE-CDE new gate also stops a sample-only request without comparable evidence',async()=>{
    const h=runHarness(airborne,{pages:[1,2]}),m=await illustrateReviewedAudition({...h.args,pageAttempts:1,sample:[1,2],
      sampleScaleGate:'companion-scale-sample-gate/v1'} as any);
    expect(m.status).toBe('held_sample');expect(m.scope.complete).toBe(false);
    expect(m.pages).toHaveLength(2);expect(m.scaleVerification?.status).toBe('unverified');
  });

  const nativeVisual=()=>({engineContinuity:{version:NATIVE_BOOK_CONTINUITY_VERSION,sample:[1,2]},referenceQualification:REFERENCE_QUALIFICATION_VERSION,
    sampleScaleGate:COMPANION_SCALE_SAMPLE_GATE,pageAttempts:1,materialSceneRepair:false,structuralAnatomy:true,landmarkTopology:LANDMARK_COVERAGE_TOPOLOGY_VERSION});
  const nativeHarness=(evidence:ScaleEvidence,extra:Parameters<typeof harness>[0]={},id='elephant_momo')=>{
    const b=scaleBook(id) as any;
    b.instanceDistinction={version:INSTANCE_DISTINCTION_VERSION,populations:[],entities:b.plan.continuity.entities.map((e:any)=>({id:e.id,
      kind:e.id==='paper_boat'?'boat':e.id==='old_tree'?'tree':e.id,distinction:null}))};
    b.materialFunction={version:'entity-material-function/v1',entities:[{id:'paper_boat',builtFrom:{sources:[{entityId:'ribbon'}],
      evidence:{citation:'p1:s1',quote:texts[0]}}}]};
    return runHarness(evidence,{book:b,coverage:true,...extra});
  };
  it('NATIVE-CDE actual native wrapper stops after its unmeasured sample and carries all three contracts',async()=>{
    const h=nativeHarness(airborne),m=await runTrialAudition({...h.args,visual:nativeVisual()});
    expect([...h.prompts.keys()].filter(k=>k.startsWith('page_'))).toEqual(['page_1_0','page_2_0']);
    expect(m.status).toBe('held_sample');expect(m.scope.complete).toBe(false);
    expect(h.contexts.get('page_1_0_qa')).toMatchObject({instanceDistinction:INSTANCE_DISTINCTION_VERSION,
      materialFunction:{version:'entity-material-function/v1'},companionScale:{companionId:'elephant_momo'}});
    expect(trialBookVisualQualification(m)).toMatchObject({qaSupported:false,manifestStatus:'held_sample',productAccepted:false});
  });
  it.each([['elephant_momo',.7],['bunny_ometz',.3]] as const)('NATIVE-CDE valid standing/action coverage uses the own %s authority and retains the action abstention',async(id,ratio)=>{
    const h=nativeHarness(airborne,{},id),original=h.args.judge;
    const judge=async(...args:Parameters<typeof original>)=>{const reply=await original(...args),context=args[2] as any;
      return context.companionScale?{...reply,scaleEvidence:context.packet.pageNumber===1?{...within,estimatedRatio:ratio}:airborne}:reply;};
    const m=await runTrialAudition({...h.args,judge,visual:nativeVisual()});
    expect(m.pages).toHaveLength(9);expect(m.scope.complete).toBe(true);expect(m.status).toBe('qa_supported_audition');
    expect(m.pages.find(p=>p.pageNumber===2)?.companionScale?.disposition).toBe('abstain');
    expect(m.scope.sampleScaleGate).toMatchObject({status:'passed'});expect(trialBookVisualQualification(m).qaSupported).toBe(true);
    expect([...h.prompts.keys()].filter(k=>k.startsWith('page_'))).toHaveLength(9);
  });
  it.each(['measured_defect','child_identity','unrelated_story'] as const)('NATIVE-CDE %s stops before any non-sample draw and never uses legacy outer repair',async(kind)=>{
    const h=nativeHarness(kind==='measured_defect'?{...within,estimatedRatio:.9}:within,
      kind==='child_identity'?{score:()=>.62}:kind==='unrelated_story'?{judge:step=>step.startsWith('page_')?{scene:{verdict:'defect',issues:[issue('story','scene_plan')]}}:{}}:{});
    const m=await runTrialAudition({...h.args,visual:nativeVisual()});
    expect([...h.prompts.keys()].filter(k=>k.startsWith('page_'))).toEqual(['page_1_0','page_2_0']);
    expect(m.status).toBe('held_sample');expect(m.scope.complete).toBe(false);expect(trialBookVisualQualification(m).qaSupported).toBe(false);
  });
  it('NATIVE-CDE a later measured defect blocks the book despite a passed early sample',async()=>{
    const h=nativeHarness(within),original=h.args.judge;
    const judge=async(...args:Parameters<typeof original>)=>{const reply=await original(...args),context=args[2] as any;
      return context.companionScale?{...reply,scaleEvidence:{...within,estimatedRatio:context.packet.pageNumber===4?.9:.7}}:reply;};
    const m=await runTrialAudition({...h.args,judge,visual:nativeVisual()});
    expect(m.scope.sampleScaleGate?.status).toBe('passed');expect(m.scaleVerification?.status).toBe('defect');
    expect(m.status).toBe('held_audition_with_findings');expect(trialBookVisualQualification(m).qaSupported).toBe(false);
  });
  it.each(['unmarked_book','partial_scope','resume','owner_acceptance'] as const)('NATIVE-CDE refuses %s before any provider-shaped callback',async(kind)=>{
    const h=nativeHarness(within),args:any={...h.args,visual:nativeVisual()};
    if(kind==='unmarked_book')args.book=scaleBook();
    if(kind==='partial_scope')args.pages=[1];
    if(kind==='resume')args.resume={};
    if(kind==='owner_acceptance')args.ownerAcceptance={};
    await expect(runTrialAudition(args)).rejects.toThrow('trial_continuity_book_binding');
    expect(h.args.render).not.toHaveBeenCalled();expect(h.args.judge).not.toHaveBeenCalled();expect(h.args.identity).not.toHaveBeenCalled();
  });
  it.each([
    ['review', 'temporary_connection_failure', 1, 'audition_page_1_unavailable'],
    ['review', 'audition_unknown_cost', 2, 'audition_unknown_cost'],
    ['review', 'audition_transport_unavailable', 0, 'audition_transport_unavailable'],
    ['identity', 'audition_unknown_cost', 1, 'audition_unknown_cost'],
    ['identity', 'audition_transport_unavailable', 6, 'audition_transport_unavailable'],
  ] as const)('R4 returned image survives lost %s %s on frame %s',async(kind,code,page,expected)=>{
    const h=nativeHarness(within),failure=new ReviewedAuditionError(code),trace:string[]=[],oldJudge=h.args.judge,oldIdentity=h.args.identity,oldSave=h.args.save;
    const args={...h.args,visual:nativeVisual(),save:(name:string,value:unknown)=>{trace.push('save:'+name);oldSave(name,value);},
      judge:async(...a:Parameters<typeof oldJudge>)=>{if(kind==='review'&&a[0]==='page_'+page+'_0_qa'){trace.push('lost');throw failure;}return oldJudge(...a);},
      identity:async(...a:Parameters<typeof oldIdentity>)=>{if(kind==='identity'&&a[0]==='page_'+page+'_0_identity'){trace.push('lost');throw failure;}return oldIdentity(...a);}};
    let caught:any;try{await runTrialAudition(args);}catch(error){caught=error;}
    expect(caught?.code).toBe(expected);if(expected===code)expect(caught).toBe(failure);
    expect(h.saved.get('drawn_page_'+page)).toMatchObject({version:'native-page-render-evidence/v1',pageNumber:page,attempt:0,candidate:image('page_'+page+'_0')});
    expect(trace.indexOf('save:drawn_page_'+page)).toBeGreaterThan(-1);expect(trace.indexOf('save:drawn_page_'+page)).toBeLessThan(trace.indexOf('lost'));
    const pageCalls=[...h.prompts.keys()].filter(x=>x.startsWith('page_'));expect(pageCalls[pageCalls.length-1]).toBe('page_'+page+'_0');
    expect(pageCalls.filter(x=>x==='page_'+page+'_0')).toHaveLength(1);expect(h.saved.has('page_'+page)).toBe(false);
    expect(trialDrawnFrames(h.saved)).toHaveLength(pageCalls.length);expect(trialDrawnFrames(h.saved)).toContain('drawn_page_'+page);
    const dir=mkdtempSync(path.join(tmpdir(),'native-cde-lost-review-viewer-'));
    writeTrialReader(dir,{title:'Synthetic lost answer',pages:texts.map((text,i)=>({pageNumber:i+1,text}))},h.saved,[],{pendingUnknownReserve:600000},{},undefined,'text',{status:'review_stopped'});
    const html=readFileSync(path.join(dir,'viewer/index.html'),'utf8');
    expect(html).toContain('src="../illustrations/page_'+page+'_0.png"');expect(html).toContain('data-illustration-state="drawn_review_incomplete"');
    expect(html).toContain('review_incomplete');expect(html).toContain('האיור אינו מאושר');expect(html).toContain('600000');
    expect((html.match(/לא נוצר איור/g)||[]).length).toBe(9-pageCalls.length);

  });
  it('R4 returned image is preserved before a post-render cancellation guard stops the real engine',async()=>{
    const h=nativeHarness(within),failure=new ReviewedAuditionError('audition_cancelled'),render=h.args.render;let returned=false;
    await expect(runTrialAudition({...h.args,visual:nativeVisual(),render:async(...a:Parameters<typeof render>)=>{const v=await render(...a);if(a[0]==='page_1_0')returned=true;return v;},
      check:()=>{if(returned)throw failure;}})).rejects.toBe(failure);
    expect(h.saved.get('drawn_page_1')).toMatchObject({candidate:image('page_1_0')});expect(h.contexts.has('page_1_0_qa')).toBe(false);
  });
  it('R4 a failed render with unknown cost creates no invented returned candidate',async()=>{
    const h=nativeHarness(within),failure=new ReviewedAuditionError('audition_unknown_cost'),render=h.args.render;
    await expect(runTrialAudition({...h.args,visual:nativeVisual(),render:async(...a:Parameters<typeof render>)=>{if(a[0]==='page_1_0')throw failure;return render(...a);}})).rejects.toBe(failure);
    expect(h.saved.has('drawn_page_1')).toBe(false);expect([...h.saved.keys()].some(k=>k.startsWith('drawn_page_'))).toBe(false);
  });
  const proofInput=async(evidence:ScaleEvidence=within,pages=[1,2])=>{
    const parent=nativeHarness(within);await runTrialAudition({...parent.args,visual:nativeVisual()});
    const h=nativeHarness(evidence),a=h.args;
    return{h,input:{book:a.book,rawReview:a.rawReview,texts:a.texts,current:a.current,child:a.child,companion:a.companion,companionDescription:a.companionDescription,
      pages,reuseSheets:{entities:parent.saved.get('sheet_entities') as SavedSheet,locations:parent.saved.get('sheet_locations') as SavedSheet},
      render:a.render,judge:a.judge,identity:a.identity,check:a.check,save:a.save}};
  };
  it.each([[1],[1,2],[3,5]])('R5 page-only proof stops after exact passed pages %j without buying a sheet or remainder',async(...values:any[])=>{
    const pages=values.filter(x=>typeof x==='number'),{h,input}=await proofInput(within,pages);
    const m=await runNativePageProofFrames(input);
    expect([...h.prompts.keys()]).toEqual(pages.map(n=>'page_'+n+'_0'));expect(h.args.identity).toHaveBeenCalledTimes(pages.length);
    expect(m.pages.map(p=>p.pageNumber)).toEqual(pages);expect(m.scope.complete).toBe(false);expect(m.scope.sampleScaleGate?.status).toBe('passed');
    expect(m.status).not.toBe('qa_supported_audition');expect(m.productionQualified).toBe(false);
  });
  it('R5 all-abstained partial proof remains held and never expands beyond its requested pages',async()=>{
    const {h,input}=await proofInput(airborne);const m=await runNativePageProofFrames(input);
    expect(m.status).toBe('held_sample');expect(m.scaleVerification?.status).toBe('unverified');expect([...h.prompts.keys()]).toEqual(['page_1_0','page_2_0']);
  });
  it('R5 dry reference preflight reaches the real first-page boundary with zero provider callbacks or caller saves',async()=>{
    const {h,input}=await proofInput(),{render,judge,identity,save,...dry}=input;
    await preflightNativePageProofFrames(dry);expect(h.args.render).not.toHaveBeenCalled();expect(h.args.judge).not.toHaveBeenCalled();
    expect(h.args.identity).not.toHaveBeenCalled();expect(h.saved.size).toBe(0);
  });
  it.each(['resume','fullBookDiagnostic','freshCohort','ownerAcceptance','localAnatomyRepair','sample'] as const)('R5 rejects a foreign %s flow before callbacks',async key=>{
    const {h,input}=await proofInput();await expect(runNativePageProofFrames({...input,[key]:{}} as any)).rejects.toThrow('page_proof_scope');
    expect(h.args.render).not.toHaveBeenCalled();expect(h.args.judge).not.toHaveBeenCalled();
  });
  it.each([[],[0],[1,1],[2,1],[1,2,3],[9]])('R5 invalid exact pages %j refuse before callbacks',async(...values:any[])=>{
    const pages=values.filter(x=>typeof x==='number'),{h,input}=await proofInput(within,pages);
    await expect(runNativePageProofFrames(input)).rejects.toThrow('page_proof_scope');expect(h.args.render).not.toHaveBeenCalled();
  });
  it('R5 missing or held reference authority never buys replacements',async()=>{
    const {h,input}=await proofInput();delete(input.reuseSheets as any).locations;
    await expect(runNativePageProofFrames(input)).rejects.toThrow('page_proof_scope');expect(h.args.render).not.toHaveBeenCalled();
    const held=nativeHarness(within,{judge:step=>step.startsWith('sheet_entities_')?{props:{verdict:'defect',issues:[issue('continuity','design:trail')]}}:{}});
    await expect(runTrialAudition({...held.args,visual:nativeVisual()})).rejects.toThrow('audition_reference_unqualified');
    const fresh=await proofInput();fresh.input.reuseSheets.entities=held.saved.get('sheet_entities') as SavedSheet;
    await expect(runNativePageProofFrames(fresh.input)).rejects.toThrow('audition_reference_unqualified');expect(fresh.h.args.render).not.toHaveBeenCalled();
  });
  it('R5 unknown-cost review stops before a second page and retains returned evidence',async()=>{
    const {h,input}=await proofInput(),failure=new ReviewedAuditionError('audition_unknown_cost'),judge=input.judge;
    await expect(runNativePageProofFrames({...input,judge:async(...a:Parameters<typeof judge>)=>{if(a[0]==='page_1_0_qa')throw failure;return judge(...a);}})).rejects.toBe(failure);
    expect([...h.prompts.keys()]).toEqual(['page_1_0']);expect(trialDrawnFrames(h.saved)).toEqual(['drawn_page_1']);
  });
  it('R5 checks authority again after a returned review before identity or another draw',async()=>{
    const {h,input}=await proofInput(),failure=new ReviewedAuditionError('audition_cancelled'),judge=input.judge;let revoked=false;
    await expect(runNativePageProofFrames({...input,judge:async(...a:Parameters<typeof judge>)=>{const r=await judge(...a);revoked=true;return r;},check:()=>{if(revoked)throw failure;}})).rejects.toBe(failure);
    expect([...h.prompts.keys()]).toEqual(['page_1_0']);expect(h.args.identity).not.toHaveBeenCalled();
  });
  const realProofRun=async(lost=false)=>{
    const {h,input}=await proofInput(),source=readFileSync(path.resolve(__dirname,'../../../scripts/personal-simple-book-reviewed-audition.ts'),'utf8');
    const from=source.indexOf('  const frameScope=grant.scope;'),to=source.indexOf('  const images = new Map<string, string>();',from);
    expect(from).toBeGreaterThan(0);expect(to).toBeGreaterThan(from);
    const js=transformSync('async function executeFrames(){'+source.slice(from,to)+'return manifest;}globalThis.executeFrames=executeFrames;',{loader:'ts',format:'cjs'}).code;
    const legacy=vi.fn(async()=>{throw Error('LEGACY_FLOW_FORBIDDEN');}),failure=new ReviewedAuditionError('audition_unknown_cost'),judge=input.judge;
    const c:any={proof:{version:'native-cde-page-proof/v1'},proofScope:{pages:input.pages},grant:{scope:{mode:'render',pages:input.pages}},loaded:{...input},
      child:input.child,companion:input.companion,reused:{sheets:input.reuseSheets},io:{render:input.render,judge:async(...a:Parameters<typeof judge>)=>{if(lost&&a[0]==='page_1_0_qa')throw failure;return judge(...a);},identity:input.identity,check:input.check},
      runNativePageProofFrames,illustrateReviewedAudition:legacy,trialDrawnFrames,args:{out:'VIRTUAL'},resume:undefined,existsSync:()=>false,path,
      meter:{snapshot:()=>({unknownCost:lost?1:0,reservedUnsettledMicroUsd:lost?600000:0})},save:input.save};
    vm.createContext(c);vm.runInContext(js,c);return{h,c,legacy,failure};
  };
  it('R5 actual paid runner dispatches the real page-only boundary even after its sample passes',async()=>{
    const {h,c,legacy}=await realProofRun(),m=await c.executeFrames();expect(m.pages).toHaveLength(2);expect(m.scope.complete).toBe(false);
    expect([...h.prompts.keys()]).toEqual(['page_1_0','page_2_0']);expect(legacy).not.toHaveBeenCalled();
  });
  it('R5 actual paid runner preserves original lost-review error, returned-page evidence and full reserve',async()=>{
    const {h,c,legacy,failure}=await realProofRun(true);await expect(c.executeFrames()).rejects.toBe(failure);
    expect(h.saved.get('page-proof-stop')).toMatchObject({drawnFrames:['drawn_page_1'],spend:{unknownCost:1,reservedUnsettledMicroUsd:600000},productAccepted:false});
    expect([...h.prompts.keys()]).toEqual(['page_1_0']);expect(legacy).not.toHaveBeenCalled();
  });
  it('NATIVE-CDE held references stop before even the first sample frame',async()=>{
    const h=nativeHarness(within,{judge:step=>step.startsWith('sheet_entities_')?{props:{verdict:'defect',issues:[issue('continuity','design:trail')]}}:{}});
    await expect(runTrialAudition({...h.args,visual:nativeVisual()})).rejects.toThrow('audition_reference_unqualified');
    expect([...h.prompts.keys()].some(k=>k.startsWith('page_'))).toBe(false);
  });
  it.each([null,'wrong',true] as const)('NATIVE-CDE unknown sample gate %s refuses before callbacks',async value=>{
    const h=runHarness(within,{});
    await expect(illustrateReviewedAudition({...h.args,sample:[1,2],sampleScaleGate:value} as any)).rejects.toThrow('audition_scale_sample_scope');
    expect(h.args.render).not.toHaveBeenCalled();expect(h.args.judge).not.toHaveBeenCalled();
  });

  it('CE-R2 all-abstained normal books keep valid action pages but cannot claim book-level scale qualification',async()=>{
    const h=runHarness(airborne,{}),m=await illustrateReviewedAudition({...h.args,pageAttempts:3});
    expect(m.scope.complete).toBe(true);expect(m.pages).toHaveLength(9);
    expect(m.pages.every(p=>p.status==='qa_supported'&&p.companionScale?.disposition==='abstain')).toBe(true);
    expect(m.scaleVerification).toMatchObject({status:'unverified',comparableFrames:0,abstainedFrames:9});
    expect(m.status).toBe('held_audition_with_findings');
    expect([...h.prompts.keys()].filter(k=>k.startsWith('page_'))).toHaveLength(9);
    expect(m.runtimeEligible).toBe(false);expect(m.productionQualified).toBe(false);
  });
  it('CE-R2 a comparable standing cover plus an unmeasurable action page supports only the measured coverage',async()=>{
    const h=runHarness(within,{pages:[0,1]}),original=h.args.judge;
    const judge=async(...args:Parameters<typeof original>)=>{const reply=await original(...args),context=args[2] as any;
      return context.companionScale?{...reply,scaleEvidence:context.packet.pageNumber===0?within:airborne}:reply;};
    const m=await illustrateReviewedAudition({...h.args,judge,pageAttempts:3});
    expect(m.pages.map(p=>p.status)).toEqual(['qa_supported','qa_supported']);
    expect(m.pages.map(p=>p.companionScale?.disposition)).toEqual(['pass','abstain']);
    expect(m.scaleVerification).toMatchObject({status:'observed_within_range',comparableFrames:1,abstainedFrames:1});
    expect(m.status).toBe('qa_supported_sample');expect(m.scope.complete).toBe(false);expect(m.productionQualified).toBe(false);
  });
  it.each(['uncertain','defect'] as const)('CE-R2 the existing non-scale %s retry policy is independent of scale measurability',async verdict=>{
    // This preserves the existing policy; deciding all uncertain retries globally is a separate gate, not part of E.
    const finding=(step:string):Spec=>step.startsWith('page_')?{scene:{verdict,issues:[issue('story','scene_plan','Current action evidence needs resolution.')]}}:{};
    const plain=harness({book:typedFixture(),pages:[1],judge:finding}),standing=runHarness(within,{pages:[1],judge:finding}),
      action=runHarness(airborne,{pages:[1],judge:finding});
    for(const h of [plain,standing,action])await illustrateReviewedAudition({...h.args,pageAttempts:3});
    const draws=(h:typeof plain)=>h.args.render.mock.calls.filter(c=>String(c[0]).startsWith('page_1_')).length;
    expect([draws(plain),draws(standing),draws(action)]).toEqual([3,3,3]);
  });

  it('resumes by re-deriving the actual scale evidence; saved assessments cannot turn an abstention into a pass',async()=>{
    const old=runHarness(airborne);await illustrateReviewedAudition({...old.args,pageAttempts:1});
    const designs=old.saved.get('audition_sheet_designs') as any,sheets={entities:old.saved.get('sheet_entities') as SavedSheet,locations:old.saved.get('sheet_locations') as SavedSheet};
    const prior=old.saved.get('page_1') as SavedPage;
    const resume={designs,sheets,pages:{1:prior},stepPrefix:'r1_'};
    const next=runHarness(airborne),m=await illustrateReviewedAudition({...next.args,pageAttempts:1,resume});
    expect(next.args.render).not.toHaveBeenCalled();expect(next.args.judge).not.toHaveBeenCalled();
    expect(m.pages[0].companionScale?.disposition).toBe('abstain');expect(m.scaleVerification?.status).toBe('unverified');
    const forged=structuredClone(prior);forged.chosen.assessment.companionScale!.disposition='pass';
    const bad=runHarness(airborne);
    await expect(illustrateReviewedAudition({...bad.args,pageAttempts:1,resume:{...resume,pages:{1:forged}}})).rejects.toThrow('audition_resume_binding');
    expect(bad.args.render).not.toHaveBeenCalled();expect(bad.args.judge).not.toHaveBeenCalled();
  });
  it('a missing measurement is unusable review evidence, never an instruction to regenerate',async()=>{
    const h=runHarness(within),judge=async(...args:Parameters<typeof h.args.judge>)=>{const reply=await h.args.judge(...args);const {scaleEvidence:_e,...rest}=reply as any;return rest;};
    await expect(illustrateReviewedAudition({...h.args,judge,pageAttempts:2})).rejects.toThrow('audition_review_unusable');
    expect([...h.prompts.keys()].filter(k=>k.startsWith('page_'))).toHaveLength(1);
  });
});
