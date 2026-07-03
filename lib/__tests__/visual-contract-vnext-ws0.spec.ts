/**
 * WS0 no-render regression — BookVisualContract vNext foundation (enforcement OFF).
 *
 * Deterministic, no-LLM, no-render. Covers the slice landed in WS0:
 *   - vNext validator: exact per-page coverage (location + zone), transitions well-formed, castIds resolve,
 *     human cast well-formed; fail-closed on malformed.
 *   - a `before_transition`/`steady` page can NEVER sit in / declare the destination zone.
 *   - golden structural snapshots for representative slots (clinic waiting/threshold/exam, classroom→home,
 *     bedroom, fantasy, legit-outdoor).
 *   - import-artifact loader round-trip + fail-closed on missing/invalid.
 *   - canonical contract hash: deterministic + key-order invariant.
 *   - QualityCheckResult aggregation truth table (enforcement OFF → nothing blocks).
 *   - contract-hash validity: mismatch → stale; layer-off (no order hash) → not stale.
 *
 * NOTE: the location/cast/transition check PRODUCERS + prompt/style-ref/freeze wiring land in a later slice
 * (WS1/WS2 + the Codex-reviewed 3–6 slice); those tests are intentionally out of scope here.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import path from 'path';
import os from 'os';
import {
  validateVNextVisualContract,
  assertValidVNextVisualContract,
  InvalidVNextVisualContractError,
  computeVisualContractHash,
  loadVisualContractArtifact,
  contractArtifactPath,
  MissingContractArtifactError,
  type BookVisualContract,
} from '@/lib/visual-contract-compiler';
import {
  aggregateQualityChecks,
  isQualityEvidenceContractStale,
  type QualityCheckResult,
} from '@/lib/generation-pipeline/quality-check-result';

/** JSON deep clone (all fixtures are JSON-safe) — avoids relying on the structuredClone lib global. */
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

// ── Shared cast (child + companion) ────────────────────────────────────────────────────────────
const child = { id: 'child:hero', role: 'child' as const, name: 'Dana', wardrobe: { description: 'red raincoat + yellow boots' } };
const companion = { id: 'companion:fox', role: 'companion' as const, name: 'Fox', wardrobe: { description: 'green scarf' } };
const globalForbidden = ["any animal, creature, or pet that is not the story's declared companion"];

// ── Fixture 1: clinic — waiting_room → threshold → exam_room, with a recurring human doctor ─────
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
    { id: 'clinic.waiting_room', locationId: 'clinic', name: 'Waiting room', description: 'chairs, a low table, picture books' },
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
  forbiddenGlobalElements: globalForbidden,
  coverContract: { worldType: 'realistic_clinic', locationId: 'clinic', timeOfDay: 'day', mustShow: ['child', 'clinic entrance'], mustNotShow: ['exam instruments'] },
  pageContracts: [
    { pageNumber: 1, locationId: 'clinic', zoneId: 'clinic.waiting_room', mustShow: ['waiting room chairs'], mustNotShow: [], characterPresence: { child: true, companion: true }, propState: [{ propId: 'teddy', state: 'held' }], camera: 'wide establishing', castIds: ['child:hero', 'companion:fox'], transition: { kind: 'steady' } },
    { pageNumber: 2, locationId: 'clinic', zoneId: 'clinic.waiting_room', mustShow: ['a nurse at the door'], mustNotShow: [], characterPresence: { child: true, companion: true }, propState: [], camera: 'medium', castIds: ['child:hero', 'companion:fox'], transition: { kind: 'before_transition', fromZoneId: 'clinic.waiting_room', toZoneId: 'clinic.exam_room', cue: 'the nurse calls their name' } },
    { pageNumber: 3, locationId: 'clinic', zoneId: 'clinic.waiting_room', mustShow: ['the exam-room door opening'], mustNotShow: [], characterPresence: { child: true, companion: true }, propState: [], camera: 'over-the-shoulder toward the doorway', castIds: ['child:hero', 'companion:fox', 'human:doctor'], transition: { kind: 'threshold', fromZoneId: 'clinic.waiting_room', toZoneId: 'clinic.exam_room', cue: 'the exam-room door opens' } },
    { pageNumber: 4, locationId: 'clinic', zoneId: 'clinic.exam_room', mustShow: ['the doctor greeting the child'], mustNotShow: [], characterPresence: { child: true, companion: true }, propState: [], camera: 'medium two-shot', castIds: ['child:hero', 'companion:fox', 'human:doctor'], transition: { kind: 'after_transition', fromZoneId: 'clinic.waiting_room', toZoneId: 'clinic.exam_room', cue: 'they step inside' } },
  ],
};

// ── Fixture 2: classroom → home (cross-location transition) ─────────────────────────────────────
const classroomHome: BookVisualContract = {
  version: 1,
  storyKey: 'classroom_home',
  worldType: 'realistic_daily_life',
  locations: [
    { id: 'school', name: 'School', description: 'a bright primary school', environmentClass: 'indoor', lighting: 'daylight_windows' },
    { id: 'home', name: 'Home', description: 'a cozy family home', environmentClass: 'indoor', lighting: 'warm_lamps' },
  ],
  zones: [
    { id: 'school.classroom', locationId: 'school', name: 'Classroom', description: 'desks, a whiteboard' },
    { id: 'home.livingroom', locationId: 'home', name: 'Living room', description: 'a sofa, a bookshelf' },
  ],
  cast: { child, companion },
  recurringProps: [],
  forbiddenGlobalElements: globalForbidden,
  coverContract: { worldType: 'realistic_daily_life', locationId: 'school', timeOfDay: 'day', mustShow: ['child'], mustNotShow: [] },
  pageContracts: [
    { pageNumber: 1, locationId: 'school', zoneId: 'school.classroom', mustShow: ['the child at a desk'], mustNotShow: [], characterPresence: { child: true, companion: false }, propState: [], camera: 'wide', castIds: ['child:hero'], transition: { kind: 'steady' } },
    { pageNumber: 2, locationId: 'school', zoneId: 'school.classroom', mustShow: ['packing a backpack'], mustNotShow: [], characterPresence: { child: true, companion: false }, propState: [], camera: 'medium', castIds: ['child:hero'], transition: { kind: 'before_transition', fromZoneId: 'school.classroom', toZoneId: 'home.livingroom', cue: 'the bell rings, time to go home' } },
    { pageNumber: 3, locationId: 'home', zoneId: 'home.livingroom', mustShow: ['the child home on the sofa'], mustNotShow: [], characterPresence: { child: true, companion: true }, propState: [], camera: 'wide', castIds: ['child:hero', 'companion:fox'], transition: { kind: 'after_transition', fromZoneId: 'school.classroom', toZoneId: 'home.livingroom', cue: 'arriving home' } },
  ],
};

// ── Fixture 3: bedroom (single indoor zone, all steady) ──────────────────────────────────────────
const bedroom: BookVisualContract = {
  version: 1,
  storyKey: 'bedroom_bedtime',
  worldType: 'bedtime',
  locations: [{ id: 'bedroom', name: 'Bedroom', description: "the child's bedroom at night", environmentClass: 'indoor', lighting: 'night_nightlight' }],
  zones: [{ id: 'bedroom.main', locationId: 'bedroom', name: 'Bedroom', description: 'a railed bed, a window with stars' }],
  cast: { child, companion },
  recurringProps: [{ id: 'nightlight', name: 'Night light', description: 'a warm star-shaped night light' }],
  forbiddenGlobalElements: globalForbidden,
  coverContract: { worldType: 'bedtime', locationId: 'bedroom', timeOfDay: 'night', mustShow: ['child', 'bed'], mustNotShow: ['daylight'] },
  pageContracts: [
    { pageNumber: 1, locationId: 'bedroom', zoneId: 'bedroom.main', mustShow: ['the child in bed'], mustNotShow: ['daylight'], characterPresence: { child: true, companion: true }, propState: [{ propId: 'nightlight', state: 'on' }], camera: 'wide', castIds: ['child:hero', 'companion:fox'], transition: { kind: 'steady' } },
    { pageNumber: 2, locationId: 'bedroom', zoneId: 'bedroom.main', mustShow: ['the child asleep'], mustNotShow: ['daylight'], characterPresence: { child: true, companion: true }, propState: [{ propId: 'nightlight', state: 'on' }], camera: 'close', castIds: ['child:hero', 'companion:fox'], transition: { kind: 'steady' } },
  ],
};

// ── Fixture 4: fantasy forest (outdoor) ──────────────────────────────────────────────────────────
const fantasy: BookVisualContract = {
  version: 1,
  storyKey: 'fantasy_forest',
  worldType: 'fantasy',
  locations: [{ id: 'enchanted_forest', name: 'Enchanted forest', description: 'a glowing storybook forest', environmentClass: 'outdoor', lighting: 'magical_dusk', anchors: [{ id: 'great_oak', description: 'a giant ancient oak with a lantern' }] }],
  zones: [{ id: 'enchanted_forest.clearing', locationId: 'enchanted_forest', name: 'Clearing', description: 'a mossy clearing ringed by tall trees' }],
  cast: { child, companion },
  recurringProps: [],
  forbiddenGlobalElements: globalForbidden,
  coverContract: { worldType: 'fantasy', locationId: 'enchanted_forest', timeOfDay: 'dusk', mustShow: ['child', 'glowing forest'], mustNotShow: [] },
  pageContracts: [
    { pageNumber: 1, locationId: 'enchanted_forest', zoneId: 'enchanted_forest.clearing', mustShow: ['the child in the clearing'], mustNotShow: [], characterPresence: { child: true, companion: true }, propState: [], camera: 'wide', castIds: ['child:hero', 'companion:fox'], transition: { kind: 'steady' } },
  ],
};

// ── Fixture 5: legit outdoor (playground) — a same-LOCATION zone move (swings → gate) declared by a
//    transition (an undeclared steady jump between the two zones would now fail closed) ──
const legitOutdoor: BookVisualContract = {
  version: 1,
  storyKey: 'playground_day',
  worldType: 'realistic_outdoor',
  locations: [{ id: 'playground_main', name: 'Playground', description: 'a neighborhood playground', environmentClass: 'outdoor', lighting: 'bright_day' }],
  zones: [
    { id: 'playground_main.swings', locationId: 'playground_main', name: 'Swings', description: 'a set of swings' },
    { id: 'playground_main.gate', locationId: 'playground_main', name: 'Gate', description: 'the playground gate (a ZONE, not a new world)' },
  ],
  cast: { child, companion },
  recurringProps: [],
  forbiddenGlobalElements: globalForbidden,
  coverContract: { worldType: 'realistic_outdoor', locationId: 'playground_main', timeOfDay: 'day', mustShow: ['child', 'playground'], mustNotShow: ['cave', 'mountains'] },
  pageContracts: [
    { pageNumber: 1, locationId: 'playground_main', zoneId: 'playground_main.swings', mustShow: ['the child on a swing'], mustNotShow: ['cave'], characterPresence: { child: true, companion: true }, propState: [], camera: 'wide', castIds: ['child:hero', 'companion:fox'], transition: { kind: 'steady' } },
    { pageNumber: 2, locationId: 'playground_main', zoneId: 'playground_main.gate', mustShow: ['the child at the gate'], mustNotShow: ['cave'], characterPresence: { child: true, companion: true }, propState: [], camera: 'medium', castIds: ['child:hero', 'companion:fox'], transition: { kind: 'after_transition', fromZoneId: 'playground_main.swings', toZoneId: 'playground_main.gate', cue: 'the child skips over to the gate' } },
  ],
};

const FIXTURES: Array<[string, BookVisualContract]> = [
  ['clinic', clinic],
  ['classroomHome', classroomHome],
  ['bedroom', bedroom],
  ['fantasy', fantasy],
  ['legitOutdoor', legitOutdoor],
];

/** A minimal two-zone/one-location contract for the cross-page SEQUENCE tests: the child starts in the
 *  hall and legitimately moves up into the attic via an after_transition (the attic's only entry). */
function seqBase(): BookVisualContract {
  return {
    version: 1,
    storyKey: 'seq_house',
    worldType: 'realistic_daily_life',
    locations: [{ id: 'house', name: 'House', description: 'a family house', environmentClass: 'indoor', lighting: 'warm_lamps' }],
    zones: [
      { id: 'house.hall', locationId: 'house', name: 'Hall', description: 'the entry hall' },
      { id: 'house.attic', locationId: 'house', name: 'Attic', description: 'a dusty attic up the stairs' },
    ],
    cast: { child, companion },
    recurringProps: [],
    forbiddenGlobalElements: globalForbidden,
    coverContract: { worldType: 'realistic_daily_life', locationId: 'house', timeOfDay: 'day', mustShow: ['child'], mustNotShow: [] },
    pageContracts: [
      { pageNumber: 1, locationId: 'house', zoneId: 'house.hall', mustShow: ['the child in the hall'], mustNotShow: [], characterPresence: { child: true, companion: false }, propState: [], camera: 'wide', castIds: ['child:hero'], transition: { kind: 'steady' } },
      { pageNumber: 2, locationId: 'house', zoneId: 'house.attic', mustShow: ['the child in the attic'], mustNotShow: [], characterPresence: { child: true, companion: false }, propState: [], camera: 'wide', castIds: ['child:hero'], transition: { kind: 'after_transition', fromZoneId: 'house.hall', toZoneId: 'house.attic', cue: 'up the stairs' } },
    ],
  };
}

describe('WS0 vNext — golden fixtures validate (100% coverage, valid transitions, castIds resolve)', () => {
  it.each(FIXTURES)('%s passes the vNext validator', (_name, contract) => {
    const result = validateVNextVisualContract(contract);
    expect(result.ok).toBe(true);
  });

  it.each(FIXTURES)('%s — every page resolves a location AND a zone', (_name, contract) => {
    for (const p of contract.pageContracts) {
      expect(typeof p.locationId).toBe('string');
      expect(typeof p.zoneId).toBe('string');
    }
  });

  it.each(FIXTURES)('%s covers EXACTLY pages 1..N (no gaps, no duplicates)', (_name, contract) => {
    const nums = contract.pageContracts.map((p) => p.pageNumber).sort((a, b) => a - b);
    const expected = Array.from({ length: nums.length }, (_, i) => i + 1);
    expect(nums).toEqual(expected);
  });

  it.each(FIXTURES)('%s golden structural snapshot', (name, contract) => {
    expect(contract).toMatchSnapshot(name);
  });
});

describe('WS0 vNext — fail-closed on malformed / rule violations', () => {
  it('a before_transition page sitting in the destination zone is rejected', () => {
    const bad = clone(clinic);
    bad.pageContracts[1].zoneId = 'clinic.exam_room'; // page 2 before_transition, now in the destination
    const r = validateVNextVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/before_transition/);
  });

  it('a steady page that declares a destination zone is rejected', () => {
    const bad = clone(bedroom);
    bad.pageContracts[0].transition = { kind: 'steady', toZoneId: 'bedroom.main' };
    const r = validateVNextVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/steady/);
  });

  it('a transition whose from/to zones are equal is rejected', () => {
    const bad = clone(clinic);
    bad.pageContracts[3].transition = { kind: 'after_transition', fromZoneId: 'clinic.exam_room', toZoneId: 'clinic.exam_room' };
    const r = validateVNextVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/from\/to zones must differ/);
  });

  it('a transition referencing an unknown zone is rejected', () => {
    const bad = clone(clinic);
    bad.pageContracts[3].transition = { kind: 'after_transition', fromZoneId: 'clinic.waiting_room', toZoneId: 'clinic.nowhere' };
    const r = validateVNextVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/not a declared zone/);
  });

  it('a page missing its zoneId is rejected (coverage)', () => {
    const bad = clone(bedroom);
    delete (bad.pageContracts[0] as { zoneId?: string }).zoneId;
    const r = validateVNextVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/no zoneId/);
  });

  it('a castId that resolves to no defined member is rejected', () => {
    const bad = clone(clinic);
    bad.pageContracts[0].castIds = ['child:hero', 'human:ghost'];
    const r = validateVNextVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/does not resolve/);
  });

  it('a human cast member with pagesPresent pointing at a missing page is rejected', () => {
    const bad = clone(clinic);
    bad.humanCast![0].pagesPresent = [3, 99];
    const r = validateVNextVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/unknown page/);
  });

  it('a page missing castIds entirely is rejected (fail-closed coverage)', () => {
    const bad = clone(bedroom);
    delete (bad.pageContracts[0] as { castIds?: string[] }).castIds;
    const r = validateVNextVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/castIds must be an array/);
  });

  it('a page that marks the child present but omits it from castIds is rejected', () => {
    const bad = clone(bedroom);
    bad.pageContracts[0].castIds = ['companion:fox']; // child present but not declared
    const r = validateVNextVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/child present but/);
  });

  it('a page that lists the companion in castIds but marks it absent is rejected', () => {
    const bad = clone(classroomHome);
    // page 1 has companion:false; inject the companion id into castIds without flipping presence.
    bad.pageContracts[0].castIds = ['child:hero', 'companion:fox'];
    const r = validateVNextVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/lists the companion/);
  });

  it('a human listed on a page whose pagesPresent omits that page is rejected (bidirectional)', () => {
    const bad = clone(clinic);
    bad.humanCast![0].pagesPresent = [4]; // doctor still in page 3 castIds, but 3 dropped from pagesPresent
    const r = validateVNextVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/pagesPresent/);
  });

  it('an invalid human cast gender is rejected', () => {
    const bad = clone(clinic);
    (bad.humanCast![0] as { gender: string }).gender = 'robot';
    const r = validateVNextVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/gender invalid/);
  });

  it('assertValidVNextVisualContract throws InvalidVNextVisualContractError on a malformed contract', () => {
    expect(() => assertValidVNextVisualContract({ not: 'a contract' })).toThrow(InvalidVNextVisualContractError);
  });

  // ── P1 #1: EXACT page coverage (1..N once) ──────────────────────────────────────────────────────
  it('a GAP in the page sequence is rejected (coverage requires exactly 1..N)', () => {
    const bad = clone(clinic);
    bad.pageContracts.splice(1, 1); // drop page 2 → [1,3,4]
    const r = validateVNextVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/missing pageContract for page 2/);
  });

  it('a DUPLICATE page number is rejected (coverage requires each page once)', () => {
    const bad = clone(bedroom);
    bad.pageContracts.push(clone(bad.pageContracts[0])); // second page 1 → [1,2,1]
    const r = validateVNextVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/duplicate pageContract for page 1/);
  });

  it('a page number beyond the authoritative compiled count is rejected', () => {
    const bad = clone(bedroom);
    bad.provenance = { source: 'llm', compiledFromPages: 2 };
    bad.pageContracts[1].pageNumber = 5; // [1,5] against N=2
    const r = validateVNextVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/out of range|missing pageContract for page 2/);
  });

  // ── P1 #2: cross-page transition SEQUENCE ───────────────────────────────────────────────────────
  it('the seqBase fixture (legit after_transition arrival) passes', () => {
    expect(validateVNextVisualContract(seqBase()).ok).toBe(true);
  });

  it('allows a threshold page rendered in destination B, followed by matching after_transition A→B', () => {
    const good = seqBase();
    good.pageContracts = [
      good.pageContracts[0], // page 1: steady in the hall (A)
      { pageNumber: 2, locationId: 'house', zoneId: 'house.attic', mustShow: ['at the stair top'], mustNotShow: [], characterPresence: { child: true, companion: false }, propState: [], camera: 'threshold from stairs into attic', castIds: ['child:hero'], transition: { kind: 'threshold', fromZoneId: 'house.hall', toZoneId: 'house.attic', cue: 'the attic door opens' } },
      { pageNumber: 3, locationId: 'house', zoneId: 'house.attic', mustShow: ['inside the attic'], mustNotShow: [], characterPresence: { child: true, companion: false }, propState: [], camera: 'wide attic interior', castIds: ['child:hero'], transition: { kind: 'after_transition', fromZoneId: 'house.hall', toZoneId: 'house.attic', cue: 'stepping fully inside' } },
    ];
    expect(validateVNextVisualContract(good).ok).toBe(true);
  });

  it('a steady page silently changing zone/location (no transition) is rejected (undeclared scene move)', () => {
    const bad = clone(classroomHome);
    // Strip the declared move: page 3 now claims to be "steady" in the living room after a steady classroom
    // page — a cross-location teleport with no transition. Previously fail-open (livingroom was non-gated).
    bad.pageContracts[1].transition = { kind: 'steady' }; // page 2 no longer heads home
    bad.pageContracts[2].transition = { kind: 'steady' }; // page 3 just "is" at home
    const r = validateVNextVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/undeclared scene move/);
  });

  it('a steady page sitting in destination B, with a later before_transition A→B, is rejected (Codex sequence case)', () => {
    const bad = seqBase();
    bad.pageContracts = [
      bad.pageContracts[0], // page 1: steady in the hall (A)
      // page 2: already in the attic (B) with NO transition bringing the story there — per-page legal, globally impossible
      { pageNumber: 2, locationId: 'house', zoneId: 'house.attic', mustShow: ['x'], mustNotShow: [], characterPresence: { child: true, companion: false }, propState: [], camera: 'wide', castIds: ['child:hero'], transition: { kind: 'steady' } },
      // page 3: still in A, only NOW heading toward B
      { pageNumber: 3, locationId: 'house', zoneId: 'house.hall', mustShow: ['x'], mustNotShow: [], characterPresence: { child: true, companion: false }, propState: [], camera: 'wide', castIds: ['child:hero'], transition: { kind: 'before_transition', fromZoneId: 'house.hall', toZoneId: 'house.attic', cue: 'about to head up' } },
    ];
    const r = validateVNextVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/undeclared scene move/);
  });

  it('a transition departing from a zone the story never established is rejected', () => {
    const bad = seqBase();
    bad.pageContracts[0].zoneId = 'house.attic'; // start in the attic, but page 2 claims to arrive FROM the hall
    const r = validateVNextVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/undeclared scene move|not continuous/);
  });

  // ── P1 #5: remaining structural locks ───────────────────────────────────────────────────────────
  it('a human cast member missing coarseAppearance is rejected', () => {
    const bad = clone(clinic);
    delete (bad.humanCast![0] as { coarseAppearance?: string }).coarseAppearance;
    const r = validateVNextVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/coarseAppearance missing/);
  });

  it('a location with an unknown environmentClass is rejected (runtime, not just the TS type)', () => {
    const bad = clone(bedroom);
    (bad.locations[0] as { environmentClass: string }).environmentClass = 'underwater';
    const r = validateVNextVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/unknown environmentClass/);
  });

  it('a location missing environmentClass is rejected (the style-ref lock is required)', () => {
    const bad = clone(bedroom);
    delete (bad.locations[0] as { environmentClass?: string }).environmentClass;
    const r = validateVNextVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/missing environmentClass/);
  });
});

describe('WS0 vNext — import-artifact loader round-trip + fail-closed', () => {
  it('loads and validates a written artifact; hash is stable', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'vc-artifact-'));
    try {
      writeFileSync(contractArtifactPath(dir, clinic.storyKey!), JSON.stringify(clinic), 'utf8');
      const { contract, contractHash } = loadVisualContractArtifact(dir, clinic.storyKey!);
      expect(contract.storyKey).toBe(clinic.storyKey);
      expect(contractHash).toBe(computeVisualContractHash(clinic));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('throws MissingContractArtifactError when the artifact file is absent', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'vc-artifact-'));
    try {
      expect(() => loadVisualContractArtifact(dir, 'does_not_exist')).toThrow(MissingContractArtifactError);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('throws MissingContractArtifactError on unparseable JSON', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'vc-artifact-'));
    try {
      writeFileSync(contractArtifactPath(dir, 'broken'), '{ not json', 'utf8');
      expect(() => loadVisualContractArtifact(dir, 'broken')).toThrow(MissingContractArtifactError);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a structurally invalid artifact fails vNext validation on load', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'vc-artifact-'));
    try {
      const bad = clone(clinic);
      delete (bad.pageContracts[0] as { zoneId?: string }).zoneId;
      writeFileSync(contractArtifactPath(dir, 'bad'), JSON.stringify(bad), 'utf8');
      expect(() => loadVisualContractArtifact(dir, 'bad')).toThrow(InvalidVNextVisualContractError);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('WS0 vNext — canonical contract hash', () => {
  it('is deterministic', () => {
    expect(computeVisualContractHash(clinic)).toBe(computeVisualContractHash(clinic));
  });

  it('is invariant to object-key order (JSONB round-trip safe)', () => {
    const reordered = JSON.parse(JSON.stringify({ ...clinic })) as BookVisualContract;
    // Rebuild the top-level object with keys in a different order.
    const shuffled = Object.fromEntries(Object.entries(reordered).reverse()) as unknown as BookVisualContract;
    expect(computeVisualContractHash(shuffled)).toBe(computeVisualContractHash(clinic));
  });

  it('changes when a meaningful field changes', () => {
    const changed = clone(clinic);
    changed.pageContracts[0].camera = 'a different shot';
    expect(computeVisualContractHash(changed)).not.toBe(computeVisualContractHash(clinic));
  });
});

describe('WS0 step 8 — QualityCheckResult aggregation truth table (enforcement OFF)', () => {
  const pass = (id: string): QualityCheckResult => ({ checkId: id, status: 'pass' });
  const fail = (id: string): QualityCheckResult => ({ checkId: id, status: 'fail' });
  const unknown = (id: string): QualityCheckResult => ({ checkId: id, status: 'unknown' });
  const na = (id: string): QualityCheckResult => ({ checkId: id, status: 'not_applicable' });

  it('no results, no required checks → passed (WS0 default: nothing blocks)', () => {
    expect(aggregateQualityChecks([]).verdict).toBe('passed');
  });

  it('any fail → failed', () => {
    const agg = aggregateQualityChecks([pass('location'), fail('cast')], ['location', 'cast']);
    expect(agg.verdict).toBe('failed');
    expect(agg.failedCheckIds).toEqual(['cast']);
  });

  it('a required check that is unknown → evidence_unknown', () => {
    const agg = aggregateQualityChecks([pass('location'), unknown('cast')], ['location', 'cast']);
    expect(agg.verdict).toBe('evidence_unknown');
    expect(agg.unknownCheckIds).toEqual(['cast']);
  });

  it('a required check with no result → evidence_unknown (missing)', () => {
    const agg = aggregateQualityChecks([pass('location')], ['location', 'cast']);
    expect(agg.verdict).toBe('evidence_unknown');
    expect(agg.unknownCheckIds).toEqual(['cast']);
  });

  it('all required checks pass → passed', () => {
    expect(aggregateQualityChecks([pass('location'), pass('cast')], ['location', 'cast']).verdict).toBe('passed');
  });

  it('a required check that is not_applicable is NOT positive → evidence_unknown (fail-closed)', () => {
    const agg = aggregateQualityChecks([pass('location'), na('cast')], ['location', 'cast']);
    expect(agg.verdict).toBe('evidence_unknown');
    expect(agg.unknownCheckIds).toEqual(['cast']);
  });

  it('not_applicable on a NON-required (telemetry) check does not block', () => {
    expect(aggregateQualityChecks([pass('location'), na('telemetry')], ['location']).verdict).toBe('passed');
  });

  it('a required check with mixed pass + unknown results → evidence_unknown (any non-pass blocks)', () => {
    const agg = aggregateQualityChecks([pass('cast'), unknown('cast')], ['cast']);
    expect(agg.verdict).toBe('evidence_unknown');
  });

  it('fail beats unknown (deterministic negative wins)', () => {
    expect(aggregateQualityChecks([fail('a'), unknown('b')], ['a', 'b']).verdict).toBe('failed');
  });
});

describe('WS0 step 8 — contract-hash validity (mismatch → stale, layer-off → not stale)', () => {
  it('matching hashes → not stale', () => {
    expect(isQualityEvidenceContractStale('abc', 'abc')).toBe(false);
  });

  it('mismatched hashes with an active order contract → stale', () => {
    expect(isQualityEvidenceContractStale('old', 'new')).toBe(true);
  });

  it('evidence with no contract hash but an active order contract → stale', () => {
    expect(isQualityEvidenceContractStale(null, 'new')).toBe(true);
  });

  it('evidence carries a hash but the order has none → stale (phantom contract, fail-closed)', () => {
    expect(isQualityEvidenceContractStale('anything', null)).toBe(true);
  });

  it('neither side carries a hash (layer genuinely off) → not stale', () => {
    expect(isQualityEvidenceContractStale(null, undefined)).toBe(false);
    expect(isQualityEvidenceContractStale(undefined, null)).toBe(false);
  });
});
