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
import { buildLocationContinuityPromptBlock } from '@/lib/story-location-bible';
import { detectExpectedCharactersForPage } from '@/lib/generation-pipeline/anchor-registry';
import { buildCharacterConsistencyBlock } from '@/lib/character-lock';

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
    // pagePlans
    expect(b.pagePlans.map((p) => p.page)).toEqual([1, 2, 3, 4]);
    const p1 = b.pagePlans[0];
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

  it('(e4b validation) supportingCharacters feed the character-lock consumer with gender/appearance/wardrobe', () => {
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
    // feed the REAL consumer (buildCharacterConsistencyBlock, character-lock.ts:65)
    const block = buildCharacterConsistencyBlock({
      child: { name: 'Dana', description: 'the hero' },
      supportingCharacters: sc.map((s) => ({ name: s.name, description: s.description })),
    });
    expect(block).toContain('SUPPORTING_CHARACTER_GUIDELINES:');
    expect(block).toContain('doctor');
    expect(block).toContain('male');
    expect(block).toContain('white coat');
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

describe('VISUAL_CONTRACT_STEERING flag', () => {
  const saved = process.env.VISUAL_CONTRACT_STEERING;
  beforeEach(() => { delete process.env.VISUAL_CONTRACT_STEERING; });
  afterEach(() => { if (saved === undefined) delete process.env.VISUAL_CONTRACT_STEERING; else process.env.VISUAL_CONTRACT_STEERING = saved; });

  it('defaults OFF (adapters never drive render until WS1 turns it on with the gate)', () => {
    expect(isVisualContractSteeringEnabled()).toBe(false);
  });
  it('reads the env var when set (non-prod)', () => {
    process.env.VISUAL_CONTRACT_STEERING = 'true';
    expect(isVisualContractSteeringEnabled()).toBe(true);
  });
});
