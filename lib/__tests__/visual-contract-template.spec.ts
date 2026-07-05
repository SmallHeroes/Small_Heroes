/**
 * P0 commit 1 — Contract Template + Resolved validators (PURE; no render, no LLM, no DB).
 *
 * Proves the structured-appearance foundation:
 *  - the Template validator accepts a well-formed template and REJECTS family_profile on a non-relative (the clinic
 *    doctor), a binding missing its typed evidence origin, an empty structured slot, and an explicit binding with no
 *    value;
 *  - the Resolved validator accepts a fully-concrete contract and REJECTS an unresolved/deferred trait, a garment
 *    with no concrete colour, and a Template shape (a Template can never be frozen/rendered as a Resolved).
 */
import { describe, it, expect } from 'vitest';
import {
  validateBookVisualContractTemplate,
  assertValidBookVisualContractTemplate,
  InvalidTemplateContractError,
  validateResolvedBookVisualContract,
  assertValidResolvedBookVisualContract,
  InvalidResolvedContractError,
  VISUAL_CONTRACT_SCHEMA_VERSION,
  MATERIALIZER_VERSION,
  PALETTE_VERSION,
} from '@/lib/visual-contract-compiler';

type Obj = Record<string, unknown>;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

// ── Shared minimal clinic structure (satisfies the vNext structural checks) ──────────────────────
const SHARED = {
  version: 1,
  worldType: 'realistic_clinic',
  locations: [
    { id: 'clinic', name: 'Clinic', description: 'a small friendly clinic', environmentClass: 'indoor' },
  ],
  zones: [
    { id: 'clinic.waiting', locationId: 'clinic', name: 'Waiting', description: 'waiting area' },
    { id: 'clinic.exam', locationId: 'clinic', name: 'Exam', description: 'exam room' },
  ],
  cast: { child: { id: 'child:hero', role: 'child', wardrobe: { description: 'everyday outfit' } } },
  recurringProps: [],
  forbiddenGlobalElements: [],
  coverContract: { worldType: 'realistic_clinic', locationId: 'clinic', mustShow: [], mustNotShow: [] },
  pageContracts: [
    {
      pageNumber: 1, locationId: 'clinic', zoneId: 'clinic.waiting', mustShow: ['x'], mustNotShow: [],
      characterPresence: { child: true, companion: false }, propState: [], camera: 'wide',
      castIds: ['child:hero', 'human:mother'], transition: { kind: 'steady' },
    },
    {
      pageNumber: 2, locationId: 'clinic', zoneId: 'clinic.exam', mustShow: ['x'], mustNotShow: [],
      characterPresence: { child: true, companion: false }, propState: [], camera: 'wide',
      castIds: ['child:hero', 'human:doctor'],
      transition: { kind: 'after_transition', fromZoneId: 'clinic.waiting', toZoneId: 'clinic.exam', cue: 'they step in' },
    },
  ],
};

// ── A valid Template: mother = family_profile (relative), doctor = deterministic_palette, garments/hair = explicit ──
function templateFixture(): Obj {
  return clone({
    contractKind: 'template',
    schemaVersion: VISUAL_CONTRACT_SCHEMA_VERSION,
    ...SHARED,
    humanCast: [
      {
        id: 'human:mother', role: 'mother', gender: 'female', aliases: ['אמא'], pagesPresent: [1], forbiddenAppearance: [],
        appearance: {
          skinTone: { mode: 'family_profile', origin: { kind: 'family_profile' } },
          hairColour: { mode: 'family_profile', origin: { kind: 'family_profile' } },
          hairStyle: { mode: 'explicit', value: 'medium-length softly wavy, loose, side part', origin: { kind: 'story_evidence', page: 1, phrase: 'page-1 canonical hair' } },
        },
        garments: [
          { id: 'cardigan', label: 'cardigan', colour: { mode: 'explicit', value: 'sage-green', origin: { kind: 'story_evidence', page: 1, phrase: 'sage-green cardigan on page 1' } } },
        ],
      },
      {
        id: 'human:doctor', role: 'doctor', gender: 'male', aliases: ['הרופא'], pagesPresent: [2], forbiddenAppearance: [],
        appearance: {
          skinTone: { mode: 'deterministic_palette', origin: { kind: 'deterministic_palette', paletteId: 'clinic-doctor', version: PALETTE_VERSION } },
          hairColour: { mode: 'deterministic_palette', origin: { kind: 'deterministic_palette', paletteId: 'clinic-doctor', version: PALETTE_VERSION } },
          hairStyle: { mode: 'explicit', value: 'short neatly combed, side part', origin: { kind: 'policy_default', policyId: 'doctor-hair', version: 'v1' } },
        },
        garments: [
          { id: 'coat', colour: { mode: 'explicit', value: 'white', origin: { kind: 'policy_default', policyId: 'doctor-coat', version: 'v1' } } },
          { id: 'scrubs', colour: { mode: 'explicit', value: 'blue', origin: { kind: 'policy_default', policyId: 'doctor-scrubs', version: 'v1' } } },
        ],
      },
    ],
  });
}

// ── A valid Resolved: everything concrete; coarseAppearance/wardrobe are concrete projections ──
function resolvedFixture(): Obj {
  return clone({
    contractKind: 'resolved',
    schemaVersion: VISUAL_CONTRACT_SCHEMA_VERSION,
    materializerVersion: MATERIALIZER_VERSION,
    paletteVersion: PALETTE_VERSION,
    ...SHARED,
    humanCast: [
      {
        id: 'human:mother', role: 'mother', gender: 'female', aliases: ['אמא', 'mom'], pagesPresent: [1],
        textEvidence: 'page 1: אמא',
        coarseAppearance: 'female mother; warm medium-brown skin; wavy dark-brown hair, medium-length loose side part',
        wardrobe: { description: 'sage-green cardigan over a cream top, blue denim jeans, tan loafers' },
        forbiddenAppearance: [],
        appearance: {
          skinTone: { value: 'warm medium-brown', mode: 'family_profile', origin: { kind: 'family_profile' } },
          hairColour: { value: 'dark brown', mode: 'family_profile', origin: { kind: 'family_profile' } },
          hairStyle: { value: 'medium-length softly wavy, loose, side part', mode: 'explicit', origin: { kind: 'story_evidence', page: 1, phrase: 'page-1 canonical hair' } },
        },
        garments: [{ id: 'cardigan', colour: { value: 'sage-green', mode: 'explicit', origin: { kind: 'story_evidence', page: 1, phrase: 'sage-green cardigan on page 1' } } }],
      },
      {
        id: 'human:doctor', role: 'doctor', gender: 'male', aliases: ['הרופא', 'the doctor'], pagesPresent: [2],
        textEvidence: 'page 2: הרופא',
        coarseAppearance: 'male doctor; light-tan skin; short black neatly-combed hair with a side part',
        wardrobe: { description: 'white medical coat over blue scrubs, stethoscope' },
        forbiddenAppearance: [],
        appearance: {
          skinTone: { value: 'light-tan', mode: 'deterministic_palette', origin: { kind: 'deterministic_palette', paletteId: 'clinic-doctor', version: PALETTE_VERSION } },
          hairColour: { value: 'black', mode: 'deterministic_palette', origin: { kind: 'deterministic_palette', paletteId: 'clinic-doctor', version: PALETTE_VERSION } },
          hairStyle: { value: 'short neatly combed, side part', mode: 'explicit', origin: { kind: 'policy_default', policyId: 'doctor-hair', version: 'v1' } },
        },
        garments: [
          { id: 'coat', colour: { value: 'white', mode: 'explicit', origin: { kind: 'policy_default', policyId: 'doctor-coat', version: 'v1' } } },
          { id: 'scrubs', colour: { value: 'blue', mode: 'explicit', origin: { kind: 'policy_default', policyId: 'doctor-scrubs', version: 'v1' } } },
        ],
      },
    ],
  });
}

describe('P0 — Template validator', () => {
  it('accepts a well-formed template', () => {
    const r = validateBookVisualContractTemplate(templateFixture());
    expect(r.ok, r.ok ? '' : r.errors.join('; ')).toBe(true);
  });

  it('REJECTS family_profile on a non-relative (the clinic doctor)', () => {
    const bad = templateFixture();
    (((bad.humanCast as Obj[])[1].appearance as Obj).skinTone as Obj) = { mode: 'family_profile', origin: { kind: 'family_profile' } };
    const r = validateBookVisualContractTemplate(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/family_profile is illegal for non-relative role "doctor"/);
  });

  it('REJECTS a binding missing its typed evidence origin', () => {
    const bad = templateFixture();
    delete ((((bad.humanCast as Obj[])[0].appearance as Obj).hairStyle as Obj).origin);
    const r = validateBookVisualContractTemplate(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/origin missing/);
  });

  it('REJECTS an empty structured slot', () => {
    const bad = templateFixture();
    delete ((bad.humanCast as Obj[])[0].appearance as Obj).skinTone;
    const r = validateBookVisualContractTemplate(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/appearance\.skinTone missing/);
  });

  it('REJECTS an explicit garment binding with no concrete value', () => {
    const bad = templateFixture();
    (((bad.humanCast as Obj[])[0].garments as Obj[])[0].colour as Obj) = { mode: 'explicit', origin: { kind: 'story_evidence', page: 1, phrase: 'x' } };
    const r = validateBookVisualContractTemplate(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/explicit binding must carry a concrete value/);
  });

  it('assertValidBookVisualContractTemplate throws on a malformed template', () => {
    expect(() => assertValidBookVisualContractTemplate({ contractKind: 'template' })).toThrow(InvalidTemplateContractError);
  });
});

describe('P0 — Resolved validator', () => {
  it('accepts a fully-concrete resolved contract', () => {
    const r = validateResolvedBookVisualContract(resolvedFixture());
    expect(r.ok, r.ok ? '' : r.errors.join('; ')).toBe(true);
  });

  it('REJECTS an unresolved / deferred trait', () => {
    const bad = resolvedFixture();
    (((bad.humanCast as Obj[])[0].appearance as Obj).hairColour as Obj).value = 'deferred to the family lock';
    const r = validateResolvedBookVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/appearance\.hairColour is not a concrete resolved value/);
  });

  it('REJECTS a garment with no concrete colour', () => {
    const bad = resolvedFixture();
    delete (((bad.humanCast as Obj[])[1].garments as Obj[])[0].colour as Obj).value;
    const r = validateResolvedBookVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/is not a concrete resolved colour/);
  });

  it('REJECTS a Template shape (a Template can never be frozen/rendered as a Resolved)', () => {
    const r = validateResolvedBookVisualContract(templateFixture());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/Template .* must not be validated\/frozen as a Resolved/);
  });

  it('assertValidResolvedBookVisualContract throws on a malformed resolved contract', () => {
    expect(() => assertValidResolvedBookVisualContract({ contractKind: 'resolved' })).toThrow(InvalidResolvedContractError);
  });
});
