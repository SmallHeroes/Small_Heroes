import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  readFrozenVisualContract,
  contractToLocationPlanBundle,
  contractPageEnvironmentClass,
  contractToCastRegistry,
  contractToHumanCastDetectionEntries,
  contractPageSupportingCharacters,
  expectedCastIdsForPage,
  contractToQaObservability,
  isVisualContractSteeringEnabled,
  type BookVisualContract,
} from '@/lib/visual-contract-compiler';
import {
  buildLocationContinuityPromptBlock,
  resolvePageLocationPlan,
  isStoryLocationPlanValid,
} from '@/lib/story-location-bible';
import { buildSetTopologyLockBlock, promptContainsSetTopologyLock } from '@/lib/story-location-bible/set-topology';
import type { PageLocationPlan } from '@/lib/story-location-bible/types';
import { detectExpectedCharactersForPage } from '@/lib/generation-pipeline/anchor-registry';
import { assembleStyle01Phase2Prompt } from '@/lib/style01-prompt-assembly';

/**
 * WS0b(c): the projection adapters are BUILT + unit-tested here but wired NOWHERE (steering is (e)). These
 * prove: (1) reads re-validate, never blind-cast; (2) faithful projection into the target shapes; (3) the
 * steering flag defaults OFF.
 */

const child = { id: 'child:hero', role: 'child' as const, name: 'Dana', wardrobe: { description: 'red raincoat + yellow boots', forbidden: ['dress'] } };
const companion = { id: 'companion:fox', role: 'companion' as const, name: 'Fox', wardrobe: { description: 'green scarf' } };

// A structurally valid vNext contract (modeled on the WS0a clinic fixture) — passes the vNext validator.
const clinic: BookVisualContract = {
  version: 1,
  storyKey: 'clinic_visit',
  worldType: 'realistic_clinic',
  locations: [
    {
      id: 'clinic',
      name: 'Village clinic',
      description: 'A small friendly village clinic.',
      environmentClass: 'indoor',
      lighting: 'clinic_fluorescent',
      anchors: [{ id: 'reception_desk', description: 'wooden reception desk near the entrance' }],
      topology: 'waiting room adjoins the exam room through a single door',
    },
  ],
  zones: [
    { id: 'clinic.waiting_room', locationId: 'clinic', name: 'Waiting room', description: 'chairs, a low table, picture books', shot: 'wide' },
    { id: 'clinic.exam_room', locationId: 'clinic', name: 'Exam room', description: 'exam table, a small sink, a growth chart' },
  ],
  cast: { child, companion },
  humanCast: [
    {
      id: 'human:doctor',
      role: 'doctor',
      aliases: ['הרופא', 'the doctor'],
      gender: 'male',
      coarseAppearance: 'tall adult, short dark hair, medium skin tone',
      wardrobe: { description: 'white coat over blue scrubs', forbidden: ['surgical mask covering the face'] },
      forbiddenAppearance: ['clown attire', 'sunglasses'],
      pagesPresent: [3, 4],
      textEvidence: '"הרופא" (masculine Hebrew article) → male',
    },
  ],
  recurringProps: [{ id: 'teddy', name: 'Teddy bear', description: "the child's brown teddy bear" }],
  forbiddenGlobalElements: ["any animal that is not the story's declared companion"],
  coverContract: { worldType: 'realistic_clinic', locationId: 'clinic', timeOfDay: 'day', mustShow: ['child', 'clinic entrance'], mustNotShow: ['exam instruments'] },
  pageContracts: [
    { pageNumber: 1, locationId: 'clinic', zoneId: 'clinic.waiting_room', mustShow: ['waiting room chairs'], mustNotShow: ['exam table'], characterPresence: { child: true, companion: true }, propState: [{ propId: 'teddy', state: 'held' }], camera: 'wide establishing', castIds: ['child:hero', 'companion:fox'], transition: { kind: 'steady' } },
    { pageNumber: 2, locationId: 'clinic', zoneId: 'clinic.waiting_room', mustShow: ['a nurse at the door'], mustNotShow: [], characterPresence: { child: true, companion: true }, propState: [], camera: 'medium', castIds: ['child:hero', 'companion:fox'], transition: { kind: 'before_transition', fromZoneId: 'clinic.waiting_room', toZoneId: 'clinic.exam_room', cue: 'the nurse calls their name' } },
    { pageNumber: 3, locationId: 'clinic', zoneId: 'clinic.waiting_room', mustShow: ['the exam-room door opening'], mustNotShow: [], characterPresence: { child: true, companion: true }, propState: [], camera: 'over-the-shoulder toward the doorway', castIds: ['child:hero', 'companion:fox', 'human:doctor'], transition: { kind: 'threshold', fromZoneId: 'clinic.waiting_room', toZoneId: 'clinic.exam_room', cue: 'the exam-room door opens' } },
    { pageNumber: 4, locationId: 'clinic', zoneId: 'clinic.exam_room', mustShow: ['the doctor greeting the child'], mustNotShow: [], characterPresence: { child: true, companion: true }, propState: [], camera: 'medium two-shot', castIds: ['child:hero', 'companion:fox', 'human:doctor'], transition: { kind: 'after_transition', fromZoneId: 'clinic.waiting_room', toZoneId: 'clinic.exam_room', cue: 'they step inside' } },
  ],
};

describe('readFrozenVisualContract — re-validate, never blind-cast', () => {
  it('null → null', () => {
    expect(readFrozenVisualContract(null)).toBeNull();
    expect(readFrozenVisualContract(undefined)).toBeNull();
  });
  it('structurally invalid stored value → null (validator rejects; corrupt cache never propagates)', () => {
    expect(readFrozenVisualContract({})).toBeNull();
    expect(readFrozenVisualContract({ version: 1, worldType: 'x' })).toBeNull();
    expect(readFrozenVisualContract('not-an-object')).toBeNull();
  });
  it('valid contract → returns the typed contract', () => {
    const out = readFrozenVisualContract(clinic);
    expect(out).not.toBeNull();
    expect(out?.worldType).toBe('realistic_clinic');
  });
});

describe('contractToLocationPlanBundle', () => {
  it('projects bible core + pagePlans faithfully', () => {
    const b = contractToLocationPlanBundle(clinic);
    expect(b.bible.continuityMode).toBe('single_location'); // one location
    expect(b.bible.primarySetting).toBe('Village clinic');
    expect(b.bible.source).toBe('derived');
    expect(b.bible.pageCount).toBe(4);
    expect(b.bible.forbiddenDrift).toEqual(clinic.forbiddenGlobalElements);
    expect(b.bible.allowedZones.map((z) => z.id)).toEqual(['clinic.waiting_room', 'clinic.exam_room']);
    // zone visualAnchors come from the parent location's anchors
    expect(b.bible.allowedZones[0].visualAnchors).toEqual(['wooden reception desk near the entrance']);
    expect(b.bible.allowedZones[0].allowedCameraAccess).toEqual(['wide']); // from zone.shot
    expect(b.bible.fixedAnchors.map((a) => a.id)).toEqual(['reception_desk']);
    expect(b.bible.fixedAnchors[0].mustRemainSameAcrossPages).toBe(true);
    // pagePlans — page 0 (cover) is projected first, then the real pages
    expect(b.pagePlans.map((p) => p.page)).toEqual([0, 1, 2, 3, 4]);
    const p1 = b.pagePlans.find((p) => p.page === 1)!;
    expect(p1.zoneId).toBe('clinic.waiting_room');
    expect(p1.visibleAnchors).toEqual(['waiting room chairs']); // mustShow
    expect(p1.forbiddenDrift).toEqual(['exam table']); // mustNotShow
    expect(p1.cameraPositionHint).toBe('wide establishing'); // camera
  });

  it('(e4a) contractPageEnvironmentClass → the page location environmentClass; null when absent', () => {
    expect(contractPageEnvironmentClass(clinic, 1)).toBe('indoor'); // clinic location is indoor
    expect(contractPageEnvironmentClass(clinic, 99)).toBeNull(); // page not in contract
    const outdoor: BookVisualContract = { ...clinic, locations: [{ ...clinic.locations[0], environmentClass: 'outdoor' }] };
    expect(contractPageEnvironmentClass(outdoor, 1)).toBe('outdoor');
    const noEnv: BookVisualContract = { ...clinic, locations: [{ ...clinic.locations[0], environmentClass: undefined }] };
    expect(contractPageEnvironmentClass(noEnv, 1)).toBeNull(); // location without environmentClass → legacy fallback
  });

  it('(e1 validation) the projected bundle feeds the REAL consumer (buildLocationContinuityPromptBlock) coherently', () => {
    // Proves the projection FITS the consumer: zone resolves by id, world/anchors/forbidden-drift/camera all flow.
    const bundle = contractToLocationPlanBundle(clinic);
    const plan = bundle.pagePlans.find((p) => p.page === 1)!;
    const block = buildLocationContinuityPromptBlock(bundle.bible, plan);
    expect(block).toContain('STORY WORLD: Village clinic'); // primarySetting
    expect(block).toContain('zone: clinic.waiting_room'); // pagePlan.zoneId
    expect(block).toContain('chairs, a low table, picture books'); // zone resolved by id → description
    expect(block).toContain('waiting room chairs'); // visibleAnchors (mustShow)
    expect(block).toContain('camera position hint: wide establishing'); // cameraPositionHint (camera)
    expect(block).toContain('exam table'); // forbidden drift (mustNotShow)
  });

  it('(A2a) projects transitionRules from non-steady page transitions → reaches the live TRANSITION RULES block', () => {
    const b = contractToLocationPlanBundle(clinic);
    expect(b.bible.transitionRules).toEqual([
      'p2: before_transition clinic.waiting_room → clinic.exam_room (the nurse calls their name)',
      'p3: threshold clinic.waiting_room → clinic.exam_room (the exam-room door opens)',
      'p4: after_transition clinic.waiting_room → clinic.exam_room (they step inside)',
    ]);
    // reaches the LIVE prompt builder (buildLocationContinuityPromptBlock via buildResolvedLocationEnvironmentBlock)
    const plan = resolvePageLocationPlan(b, 3)!;
    const promptBlock = buildLocationContinuityPromptBlock(b.bible, plan);
    expect(promptBlock).toContain('TRANSITION RULES:');
    expect(promptBlock).toContain('the exam-room door opens');
  });

  it('(A2a) projects stableGeometry + a SET TOPOLOGY LOCK the REAL consumer re-emits (buildSetTopologyLockBlock)', () => {
    const b = contractToLocationPlanBundle(clinic);
    // per-zone stableGeometry seeded from the single location's topology
    expect(b.bible.allowedZones[0].stableGeometry).toEqual([
      'waiting room adjoins the exam room through a single door',
    ]);
    // the direct consumer now re-emits the lock (was lost entirely when the adapter left setTopology unset)
    const topoBlock = buildSetTopologyLockBlock(b.bible);
    expect(topoBlock).not.toBeNull();
    expect(promptContainsSetTopologyLock(topoBlock!)).toBe(true);
    expect(topoBlock!).toContain('reception_desk'); // location anchor → element
    expect(topoBlock!).toContain('waiting room adjoins the exam room'); // topology → layout element
  });

  it('(A2a) emits a page-0 cover plan from coverContract → resolvePageLocationPlan(0) has NO home-night leak', () => {
    const b = contractToLocationPlanBundle(clinic);
    const cover = resolvePageLocationPlan(b, 0)!;
    expect(cover.page).toBe(0);
    expect(cover.zoneId).toBe('clinic.waiting_room'); // first zone of the cover location → stays in allowedZones
    expect(cover.visibleAnchors).toEqual(['child', 'clinic entrance']); // coverContract.mustShow
    expect(cover.forbiddenDrift).toEqual(['exam instruments']); // coverContract.mustNotShow
    expect(cover.visibleAnchors.join(' ')).not.toContain('home-night'); // legacy synthesis bypassed
    expect(isStoryLocationPlanValid(b)).toBe(true); // the added page-0 plan keeps the bundle valid
  });

  it('(A2a) multi-location primarySetting spans all locations (journey → arrows), not just the first', () => {
    const twoLoc: BookVisualContract = {
      ...clinic,
      locations: [
        clinic.locations[0],
        { id: 'home', name: 'Home', description: 'the family home', environmentClass: 'indoor' },
      ],
    };
    const b = contractToLocationPlanBundle(twoLoc);
    expect(b.bible.primarySetting).toBe('Village clinic → Home'); // was 'Village clinic' (dropped the rest)
  });

  it('(A2a) neutral fallback: single-location, no topology/anchors, all-steady → all empty, fabricates nothing', () => {
    const bare: BookVisualContract = {
      ...clinic,
      locations: [{ id: 'room', name: 'Room', description: 'a plain room' }], // no anchors, no topology
      zones: [{ id: 'room.main', locationId: 'room', name: 'Main', description: 'the room' }],
      coverContract: { worldType: 'realistic', locationId: 'room', mustShow: [], mustNotShow: [] },
      pageContracts: [
        { pageNumber: 1, locationId: 'room', zoneId: 'room.main', mustShow: [], mustNotShow: [], characterPresence: { child: true, companion: false }, propState: [], camera: 'wide', castIds: ['child:hero'], transition: { kind: 'steady' } },
      ],
    };
    const b = contractToLocationPlanBundle(bare);
    expect(b.bible.transitionRules).toEqual([]); // all steady
    expect(b.bible.allowedZones[0].stableGeometry).toEqual([]); // no topology
    expect(b.bible.setTopology).toBeUndefined(); // no anchors/topology → no fabricated lock
    expect(buildSetTopologyLockBlock(b.bible)).toBeNull();
    const cover = resolvePageLocationPlan(b, 0)!;
    expect(cover.visibleAnchors).toEqual([]); // empty coverContract → empty, never a home-night default
    expect(cover.visibleAnchors.join(' ')).not.toContain('home-night');
  });

  it('(A2b) a contract cover plan SUPPRESSES the legacy COVER_MYSTERY_LOCK; forbiddenDrift carries the no-spoiler intent', () => {
    const b = contractToLocationPlanBundle(clinic);
    const coverPlan = resolvePageLocationPlan(b, 0)!;
    expect(coverPlan.contractCover).toBe(true);
    const block = buildLocationContinuityPromptBlock(b.bible, coverPlan, { isCover: true });
    // the hardcoded bedtime mystery-lock is gone from a (non-bedtime) clinic cover
    expect(block).not.toContain('NO bucket');
    expect(block).not.toContain("child's room near the night window");
    // the cover's OWN no-spoiler intent (coverContract.mustNotShow) survives via forbidden drift
    expect(block).toContain('exam instruments');
  });

  it('(A2b) flag-off byte-identity: a legacy cover plan (no contractCover) still emits COVER_MYSTERY_LOCK as today', () => {
    // A non-contract / steering-off cover plan has no contractCover marker → the cover lock is unchanged.
    const legacyCover: PageLocationPlan = {
      page: 0,
      zoneId: 'clinic.waiting_room',
      visibleAnchors: ['child', 'clinic entrance'],
      allowedVariation: '',
      forbiddenDrift: [],
    };
    const b = contractToLocationPlanBundle(clinic);
    const block = buildLocationContinuityPromptBlock(b.bible, legacyCover, { isCover: true });
    expect(block).toContain('NO bucket'); // COVER_MYSTERY_LOCK still emitted verbatim
    expect(block).toContain("child's room near the night window");
  });
});

describe('contractToCastRegistry + expectedCastIdsForPage', () => {
  it('projects child + companion + recurring human with stable ids and pagesPresent', () => {
    const reg = contractToCastRegistry(clinic);
    expect(reg.map((e) => e.id)).toEqual(['child:hero', 'companion:fox', 'human:doctor']);
    const doctor = reg.find((e) => e.id === 'human:doctor')!;
    expect(doctor.kind).toBe('human');
    expect(doctor.role).toBe('doctor');
    expect(doctor.gender).toBe('male');
    expect(doctor.wardrobe).toBe('white coat over blue scrubs');
    expect(doctor.forbiddenAppearance).toEqual(['clown attire', 'sunglasses']);
    expect(doctor.pagesPresent).toEqual([3, 4]);
    expect(doctor.aliases).toEqual(['הרופא', 'the doctor']); // detection tokens from humanCast.aliases
    const kid = reg.find((e) => e.id === 'child:hero')!;
    expect(kid.forbiddenAppearance).toEqual(['dress']);
    expect(kid.aliases).toEqual(['Dana']); // child name is its detection token
    expect(kid.pagesPresent).toEqual([1, 2, 3, 4]); // characterPresence.child on all pages
  });

  it('(e2 validation) detection augment → detectExpectedCharactersForPage picks up the human cast by alias', () => {
    const humanEntries = contractToHumanCastDetectionEntries(clinic);
    expect(Object.keys(humanEntries)).toEqual(['human:doctor']); // human cast only (child/companion excluded)
    expect(humanEntries['human:doctor'].aliases).toContain('the doctor');
    // The EPHEMERAL augmented registry (base has child; we never mutate the persisted anchorRegistry).
    const base = { child: { name: 'child', description: 'the hero', aliases: ['child'] } };
    const detectionRegistry = { ...base, ...humanEntries };
    const detected = detectExpectedCharactersForPage(
      { text: 'The doctor greeted the child warmly.', imagePrompt: '', imageSubject: '' },
      detectionRegistry as never,
    );
    expect(detected).toContain('human:doctor'); // matched by alias "the doctor"
    expect(detected).toContain('child');
  });

  it('no humanCast → just child (+ companion)', () => {
    const noHuman: BookVisualContract = { ...clinic, humanCast: [] };
    expect(contractToCastRegistry(noHuman).map((e) => e.id)).toEqual(['child:hero', 'companion:fox']);
  });

  it('expectedCastIdsForPage → the page castIds; unknown page → []', () => {
    expect(expectedCastIdsForPage(clinic, 3)).toEqual(['child:hero', 'companion:fox', 'human:doctor']);
    expect(expectedCastIdsForPage(clinic, 99)).toEqual([]);
  });

  it('(e4b validation) supportingCharacters reach the ACTIVE Style-01 Phase-2 prompt with gender/appearance/wardrobe', () => {
    const sc = contractPageSupportingCharacters(clinic, 3); // doctor is present on page 3
    expect(sc).toHaveLength(1);
    const doctor = sc[0];
    expect(doctor.name).toBe('doctor');
    expect(doctor.relationship).toBe('doctor');
    // description carries the FROZEN gender + appearance + wardrobe + drift guards (the doctor-flip fix)
    expect(doctor.description).toContain('male'); // gender — NOT flipped
    expect(doctor.description).toContain('short dark hair'); // coarse appearance
    expect(doctor.description).toContain('white coat'); // wardrobe
    expect(doctor.description).toContain('must never appear'); // forbidden drift guards
    // The LOAD-BEARING assertion: the human-cast reaches the OUTPUT of the ACTIVE assembler — the prompt string
    // that becomes finalPrompt → the model — via assembleStyle01Phase2Prompt → buildStyle01BookPagePrompt. This is
    // the LIVE Style-01 Phase-2 path (image.ts:generateWithGPTImageStyle01Phase2Once), NOT the fallback block.
    const { prompt } = assembleStyle01Phase2Prompt({
      pageNumber: 3,
      rawScenePrompt: 'the exam-room door opens as the child and the doctor meet',
      bookPageText: 'הרופא חייך אל הילד.',
      childFirstName: 'Dana',
      childDescription: 'the hero',
      supportingCharacters: sc,
    });
    expect(prompt).toContain('SUPPORTING CHARACTER'); // the block reached the live prompt
    expect(prompt).toContain('male'); // the doctor's frozen gender survives (doctor-flip fix)
    expect(prompt).toContain('white coat'); // wardrobe lock reaches the prompt (mom-wardrobe class of drift)
    expect(prompt).toContain('must never appear'); // frozen drift guards reach the prompt
  });

  it('(e4b) flag-off byte-identity: no supportingCharacters → no SUPPORTING CHARACTER block in the live prompt', () => {
    const { prompt } = assembleStyle01Phase2Prompt({
      pageNumber: 3,
      rawScenePrompt: 'the exam-room door opens as the child and the doctor meet',
      bookPageText: 'הרופא חייך אל הילד.',
      childFirstName: 'Dana',
      childDescription: 'the hero',
      // supportingCharacters omitted (steering OFF / no human cast) → no block, prompt unchanged vs today
    });
    expect(prompt).not.toContain('SUPPORTING CHARACTER');
  });

  it('(e4b) no human on a page → empty (byte-identical: the chunked supportingCharacters stays empty)', () => {
    expect(contractPageSupportingCharacters(clinic, 1)).toEqual([]); // doctor only on pages 3,4
  });
});

describe('contractToQaObservability (observability only)', () => {
  it('carries contractHash + pageContract + requiredCheckIds + frozen cast expectations', () => {
    const o = contractToQaObservability(clinic, 3, 'hash-xyz');
    expect(o.contractHash).toBe('hash-xyz');
    expect(o.pageContract?.pageNumber).toBe(3);
    expect(o.requiredCheckIds).toEqual([
      'location:clinic',
      'zone:clinic.waiting_room',
      'transition:threshold',
      'cast:child:hero',
      'cast:companion:fox',
      'cast:human:doctor',
    ]);
    expect(o.frozenCastExpectations.map((e) => e.id)).toEqual(['child:hero', 'companion:fox', 'human:doctor']);
    expect(o.frozenCastExpectations.find((e) => e.id === 'human:doctor')?.role).toBe('doctor');
  });

  it('page not in the contract → NEUTRAL empty projection (never a fabricated default)', () => {
    const o = contractToQaObservability(clinic, 99, null);
    expect(o).toEqual({ contractHash: null, pageContract: null, requiredCheckIds: [], frozenCastExpectations: [] });
  });
});

describe('VISUAL_CONTRACT_STEERING flag (B3: fail-closed-coupled to enforcement)', () => {
  const savedS = process.env.VISUAL_CONTRACT_STEERING;
  const savedE = process.env.VISUAL_CONTRACT_ENFORCEMENT;
  beforeEach(() => { delete process.env.VISUAL_CONTRACT_STEERING; delete process.env.VISUAL_CONTRACT_ENFORCEMENT; });
  afterEach(() => {
    if (savedS === undefined) delete process.env.VISUAL_CONTRACT_STEERING; else process.env.VISUAL_CONTRACT_STEERING = savedS;
    if (savedE === undefined) delete process.env.VISUAL_CONTRACT_ENFORCEMENT; else process.env.VISUAL_CONTRACT_ENFORCEMENT = savedE;
  });

  it('defaults OFF (adapters never drive render until WS1 turns it on with the gate)', () => {
    expect(isVisualContractSteeringEnabled()).toBe(false);
  });
  it('(B3) steering ON but enforcement OFF → STILL false (steering can never ship without the gate)', () => {
    process.env.VISUAL_CONTRACT_STEERING = 'true';
    // enforcement unset → the gate is off → steering must stay off (code invariant, not just operational intent)
    expect(isVisualContractSteeringEnabled()).toBe(false);
  });
  it('reads the env var when set AND enforcement is also on (non-prod)', () => {
    process.env.VISUAL_CONTRACT_STEERING = 'true';
    process.env.VISUAL_CONTRACT_ENFORCEMENT = 'true';
    expect(isVisualContractSteeringEnabled()).toBe(true);
  });
});
