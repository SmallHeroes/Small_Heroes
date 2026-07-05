/**
 * P0 commit 2 — deterministic palette + pure materializer (no render, no LLM, no DB, no live-path).
 *
 * Proves: (a) byte-identical determinism (same inputs → identical serialized Resolved → identical hash);
 * (b) palette fairness (18 stories don't cluster on one appearance); (c) the materialized Resolved passes the
 * Resolved validator; (d) a family gap FAILS materialization (no silent neutral default).
 */
import { describe, it, expect } from 'vitest';
import {
  materialize,
  MaterializationError,
  DEFAULT_APPEARANCE_PALETTE,
  paletteEntryFor,
  validateResolvedBookVisualContract,
  computeVisualContractHash,
  VISUAL_CONTRACT_SCHEMA_VERSION,
  PALETTE_VERSION,
  type BookVisualContractTemplate,
  type ResolvedFamilyAppearanceProfile,
} from '@/lib/visual-contract-compiler';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const FAMILY: ResolvedFamilyAppearanceProfile = { skinTone: 'warm medium-brown', hairColour: 'dark brown', hairStyle: 'medium-length wavy' };

function template(): BookVisualContractTemplate {
  return clone({
    contractKind: 'template',
    schemaVersion: VISUAL_CONTRACT_SCHEMA_VERSION,
    version: 1,
    storyKey: 'clinic_visit',
    worldType: 'realistic_clinic',
    locations: [{ id: 'clinic', name: 'Clinic', description: 'a clinic', environmentClass: 'indoor' }],
    zones: [
      { id: 'clinic.waiting', locationId: 'clinic', name: 'Waiting', description: 'waiting area' },
      { id: 'clinic.exam', locationId: 'clinic', name: 'Exam', description: 'exam room' },
    ],
    cast: { child: { id: 'child:hero', role: 'child', wardrobe: { description: 'everyday outfit' } } },
    recurringProps: [],
    forbiddenGlobalElements: [],
    coverContract: { worldType: 'realistic_clinic', locationId: 'clinic', mustShow: [], mustNotShow: [] },
    pageContracts: [
      { pageNumber: 1, locationId: 'clinic', zoneId: 'clinic.waiting', mustShow: ['x'], mustNotShow: [], characterPresence: { child: true, companion: false }, propState: [], camera: 'wide', castIds: ['child:hero', 'human:mother'], transition: { kind: 'steady' } },
      { pageNumber: 2, locationId: 'clinic', zoneId: 'clinic.exam', mustShow: ['x'], mustNotShow: [], characterPresence: { child: true, companion: false }, propState: [], camera: 'wide', castIds: ['child:hero', 'human:doctor'], transition: { kind: 'after_transition', fromZoneId: 'clinic.waiting', toZoneId: 'clinic.exam', cue: 'in' } },
    ],
    humanCast: [
      {
        id: 'human:mother', role: 'mother', gender: 'female', aliases: ['אמא'], textEvidence: 'page 1: אמא', pagesPresent: [1], forbiddenAppearance: [],
        appearance: {
          skinTone: { mode: 'family_profile', origin: { kind: 'family_profile' } },
          hairColour: { mode: 'family_profile', origin: { kind: 'family_profile' } },
          hairStyle: { mode: 'explicit', value: 'medium-length softly wavy, loose, side part', origin: { kind: 'story_evidence', page: 1, phrase: 'p1 hair' } },
        },
        garments: [{ id: 'cardigan', colour: { mode: 'explicit', value: 'sage-green', origin: { kind: 'story_evidence', page: 1, phrase: 'sage-green cardigan' } } }],
      },
      {
        id: 'human:doctor', role: 'doctor', gender: 'male', aliases: ['הרופא'], textEvidence: 'page 2: הרופא', pagesPresent: [2], forbiddenAppearance: [],
        appearance: {
          skinTone: { mode: 'deterministic_palette', origin: { kind: 'deterministic_palette', paletteId: 'doctor', version: PALETTE_VERSION } },
          hairColour: { mode: 'deterministic_palette', origin: { kind: 'deterministic_palette', paletteId: 'doctor', version: PALETTE_VERSION } },
          hairStyle: { mode: 'explicit', value: 'short neatly combed, side part', origin: { kind: 'policy_default', policyId: 'doctor-hair', version: 'v1' } },
        },
        garments: [
          { id: 'coat', colour: { mode: 'explicit', value: 'white', origin: { kind: 'policy_default', policyId: 'coat', version: 'v1' } } },
          { id: 'scrubs', colour: { mode: 'explicit', value: 'blue', origin: { kind: 'policy_default', policyId: 'scrubs', version: 'v1' } } },
        ],
      },
    ],
  }) as unknown as BookVisualContractTemplate;
}

describe('P0 materialize — resolution', () => {
  it('resolves explicit / family_profile / deterministic_palette + projects prose from the structured traits', () => {
    const r = materialize(template(), FAMILY);
    const mother = r.humanCast.find((m) => m.id === 'human:mother')!;
    const doctor = r.humanCast.find((m) => m.id === 'human:doctor')!;
    // family_profile → from the family profile
    expect(mother.appearance.skinTone.value).toBe('warm medium-brown');
    expect(mother.appearance.hairColour.value).toBe('dark brown');
    // explicit → verbatim
    expect(mother.appearance.hairStyle.value).toBe('medium-length softly wavy, loose, side part');
    expect(mother.garments[0].colour.value).toBe('sage-green');
    // deterministic_palette → a coherent palette entry (skin + hair together)
    const entry = paletteEntryFor(DEFAULT_APPEARANCE_PALETTE, 'clinic_visit', 'human:doctor');
    expect(doctor.appearance.skinTone.value).toBe(entry.skin);
    expect(doctor.appearance.hairColour.value).toBe(entry.hair);
    // prose is a PROJECTION generated from the structured traits (no deferral text)
    expect(mother.coarseAppearance).toContain('warm medium-brown');
    expect(mother.coarseAppearance).not.toMatch(/deferred|family lock/i);
    expect(mother.wardrobe.description).toContain('sage-green');
  });

  it('(c) the materialized Resolved passes the Resolved validator', () => {
    const res = validateResolvedBookVisualContract(materialize(template(), FAMILY));
    expect(res.ok, res.ok ? '' : res.errors.join('; ')).toBe(true);
  });
});

describe('P0 materialize — (a) byte-identical determinism', () => {
  it('same (template, family, palette) → identical serialized Resolved → identical hash', () => {
    const a = materialize(template(), FAMILY);
    const b = materialize(template(), clone(FAMILY));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(computeVisualContractHash(a)).toBe(computeVisualContractHash(b));
  });

  it('carries NO clock/metadata (no derivedAt / timestamp fields in the serialized output)', () => {
    const s = JSON.stringify(materialize(template(), FAMILY));
    expect(s).not.toMatch(/derivedAt|timestamp|"date"/i);
  });

  it('a changed resolved value changes the hash (content-addressed)', () => {
    const a = materialize(template(), FAMILY);
    const b = materialize(template(), { ...FAMILY, skinTone: 'deep espresso' });
    expect(computeVisualContractHash(a)).not.toBe(computeVisualContractHash(b));
  });
});

describe('P0 materialize — (b) palette fairness / distribution', () => {
  it('18 stories do not cluster on one appearance (and selection ignores order/time)', () => {
    const stories = Array.from({ length: 18 }, (_, i) => `story_slot_${i}`);
    const chosen = stories.map((s) => paletteEntryFor(DEFAULT_APPEARANCE_PALETTE, s, 'human:doctor'));
    const counts = new Map<string, number>();
    for (const e of chosen) counts.set(e.skin, (counts.get(e.skin) ?? 0) + 1);
    const distinct = counts.size;
    const maxCluster = Math.max(...counts.values());
    // Not all identical (would be a keying bug) — well spread across the table, no dominant cluster.
    expect(distinct).toBeGreaterThanOrEqual(5);
    expect(maxCluster).toBeLessThanOrEqual(6);
  });

  it('the SAME (story, castId) is stable; DIFFERENT castIds may differ', () => {
    expect(paletteEntryFor(DEFAULT_APPEARANCE_PALETTE, 'clinic_visit', 'human:doctor'))
      .toEqual(paletteEntryFor(DEFAULT_APPEARANCE_PALETTE, 'clinic_visit', 'human:doctor'));
    // normalization: dir/extension/case-insensitive → same selection
    expect(paletteEntryFor(DEFAULT_APPEARANCE_PALETTE, 'v3-approved/Clinic_Visit.md', 'human:doctor'))
      .toEqual(paletteEntryFor(DEFAULT_APPEARANCE_PALETTE, 'clinic_visit', 'human:doctor'));
  });
});

describe('P0 materialize — (d) fail-closed on a family gap', () => {
  it('a family_profile trait the profile does not provide FAILS materialization (no silent default)', () => {
    const gapFamily = { skinTone: '', hairColour: 'dark brown' } as ResolvedFamilyAppearanceProfile;
    expect(() => materialize(template(), gapFamily)).toThrow(MaterializationError);
  });

  it('a non-template input is rejected', () => {
    expect(() => materialize({ contractKind: 'resolved' } as unknown as BookVisualContractTemplate, FAMILY)).toThrow(MaterializationError);
  });
});
