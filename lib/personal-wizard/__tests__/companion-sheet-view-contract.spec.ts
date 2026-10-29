import { describe, it, expect } from 'vitest';
import { COMPANION_SHEET_VIEW_KINDS } from '../../generation-pipeline/companion-sheet-prompt';
import { composeCompanionOnlySheetPrompt, COMPANION_SHEET_NEGATIVE, COMPANION_SHEET_RENDERING } from '../../generation-pipeline/companion-sheet-prompt';
import { assertCompanionSheetGeometryGrounded, companionSheetNearSide, companionSheetViewContract, companionSheetViewContractText,
  CONTRACT_VIEW_LINE } from '../../generation-pipeline/companion-sheet-view-contract';
import { style01SheetBlocks } from '../../generation-pipeline/companion-character-sheet';
import { STYLE_01_RENDERING_CORRECTION } from '../../style01-prompt-core';
import { STYLE_01_AVOIDANCE_NEGATIVE } from '../../style01-gptimage';
import { PERSONAL_ADDED_COMPANIONS, type CompanionSheetGeometry } from '../personal-companions';

const geometry = (id: string) => PERSONAL_ADDED_COMPANIONS.find(c => c.id === id)!.sheetGeometry!;
const MOMO = geometry('elephant_momo'), TUK = geometry('turtle_tuk'), TUTI = geometry('hedgehog_tuti');
const text = (g: CompanionSheetGeometry, view: Parameters<typeof companionSheetViewContract>[1]) => companionSheetViewContractText(companionSheetViewContract(g, view));

describe('every pictured companion declares a geometry grounded in its own description; the two without a look declare none', () => {
  it('grounded, word for word, for all seven; null for Tzuki and Mishi', () => {
    for (const c of PERSONAL_ADDED_COMPANIONS) {
      if (!c.visualDescription) { expect(c.sheetGeometry).toBeNull(); continue; }
      expect(c.sheetGeometry).not.toBeNull();
      expect(() => assertCompanionSheetGeometryGrounded(c.visualDescription!, c.sheetGeometry!)).not.toThrow();
    }
  });
  it.each([
    ['a part the description never names', { ...MOMO, counts: { ...MOMO.counts, wings: 2 } }],
    ['a face part it never names', { ...MOMO, face: [...MOMO.face, 'beak'] }],
    ['the knot on the other side (the description only says "viewer\'s right" for a front view)', { ...MOMO, accessories: [{ item: 'neckerchief knot', part: 'neck', side: 'right' as const }] }],
    ['an accessory placed at the front that the description puts on the side', { ...MOMO, accessories: [{ item: 'neckerchief knot', part: 'neck', side: 'front' as const }] }],
    ['an item it never names', { ...MOMO, accessories: [{ item: 'scarf', part: 'neck', side: 'left' as const }] }],
    ['a negative count', { ...MOMO, counts: { ...MOMO.counts, ears: -1 } }],
  ])('refuses %s', (_label, bad) => {
    expect(() => assertCompanionSheetGeometryGrounded(PERSONAL_ADDED_COMPANIONS[0].visualDescription!, bad as CompanionSheetGeometry))
      .toThrow('companion_sheet_geometry_grounding');
  });
  it('refuses a front accessory whose description names another part', () => {
    expect(() => assertCompanionSheetGeometryGrounded(PERSONAL_ADDED_COMPANIONS[1].visualDescription!, { ...TUK, accessories: [{ item: 'bow', part: 'tail', side: 'front' }] }))
      .toThrow('companion_sheet_geometry_grounding');
  });
});

describe('the near side is one fixed side for every turned view', () => {
  it('the side carrying a lateral accessory; otherwise LEFT; two opposite sides refuse', () => {
    expect(companionSheetNearSide(MOMO)).toBe('left');
    expect(companionSheetNearSide(TUK)).toBe('left'); // a front accessory is not lateral
    expect(companionSheetNearSide(TUTI)).toBe('left');
    expect(companionSheetNearSide({ ...MOMO, accessories: [{ item: 'scarf', part: 'neck', side: 'right' }] })).toBe('right');
    expect(() => companionSheetNearSide({ ...MOMO, accessories: [{ item: 'scarf', part: 'neck', side: 'right' }, { item: 'band', part: 'arm', side: 'left' }] }))
      .toThrow('companion_sheet_contract_sides');
  });
});

describe('geometry and laterality per view (sides are the companion\'s own)', () => {
  it('front: its own left is on the viewer\'s right (as the description says), the whole face shows', () => {
    const c = companionSheetViewContract(MOMO, 'front');
    expect(c.accessories).toEqual([{ item: 'neckerchief knot', placement: "the neckerchief knot sits on the companion's own LEFT side of the neck, which is the viewer's RIGHT in this view" }]);
    expect(c.shows).toContain('eyes, rosy cheeks, trunk');
    expect(companionSheetViewContract(MOMO, 'happy').accessories).toEqual(c.accessories);
  });
  it('side: a fixed profile facing that shows the accessory side, one eye, the accessory on the near side and never at the throat', () => {
    const c = companionSheetViewContract(MOMO, 'side');
    expect(c.facing).toBe("faces the viewer's LEFT in a clean profile, so the viewer sees its own LEFT side");
    expect(c.shows).toBe('its own LEFT side and ONE eye (the near one)');
    expect(c.hides).toBe('its whole own RIGHT side and the far eye');
    expect(c.accessories[0].placement).toContain('on the NEAR side of the neck, fully visible and facing the viewer (not under the chin, not at the front of the neck)');
    // Mirror: a right-side accessory faces the other way, generally (no companion-specific text).
    const mirror = companionSheetViewContract({ ...MOMO, accessories: [{ item: 'scarf', part: 'neck', side: 'right' }] }, 'side');
    expect(mirror.facing).toBe("faces the viewer's RIGHT in a clean profile, so the viewer sees its own RIGHT side");
  });
  it('three-quarter back: faces away toward the near side; the WHOLE face is hidden, part by part; ears keep their count', () => {
    const c = companionSheetViewContract(MOMO, 'three_quarter_back');
    expect(c.facing).toBe("faces AWAY from the viewer, into the picture and toward the viewer's LEFT");
    expect(c.hides).toBe('the WHOLE face: no eye, none of eyes, rosy cheeks, trunk is visible; at most the outer curve of one cheek shows');
    expect(c.counts).toContain('2 ears, 2 eyes, 1 trunk, 0 tusks, 3 toenails on each foot');
    expect(c.counts).toContain('nothing may be added, doubled or merged, and no shape may read as an extra one');
    expect(c.accessories[0].placement).toBe('the neckerchief knot sits on the NEAR side of the neck, seen from behind');
    // Each companion's own face parts, not the elephant's.
    expect(companionSheetViewContract(geometry('owl_shush'), 'three_quarter_back').hides).toContain('none of face disk, eyes, beak, rosy cheeks is visible');
  });
  it('a front accessory: centred from the front, only at the leading edge in profile, hidden from behind', () => {
    expect(companionSheetViewContract(TUK, 'front').accessories[0].placement).toBe('the bow sits at the front of the neck, centred');
    expect(companionSheetViewContract(TUK, 'side').accessories[0].placement).toBe('the bow sits at the front of the neck: in this profile it shows only at the leading edge of the neck');
    expect(companionSheetViewContract(TUK, 'three_quarter_back').accessories[0].placement).toContain('HIDDEN from behind');
  });
  it('no accessory, no accessory line; every view has a contract with facing, shows, hides and counts', () => {
    for (const view of COMPANION_SHEET_VIEW_KINDS) {
      const t = text(TUTI, view);
      expect(t).not.toContain('Accessory:');
      for (const part of ['Facing: the companion', 'This view shows', 'This view hides', 'Counts: 2 ears, 2 eyes']) expect(t).toContain(part);
    }
  });
});

describe('the companion-only prompt carries no child, page or story prose; the legacy blocks are untouched', () => {
  it('angle variant: contract required, companion rendering in place of the child correction, no page negative', () => {
    const p = composeCompanionOnlySheetPrompt({ mode: 'angle_variant_contract', viewLine: CONTRACT_VIEW_LINE.side, contract: text(MOMO, 'side'),
      visualLock: 'LOCK', style: style01SheetBlocks() });
    expect(p).toContain(text(MOMO, 'side')); expect(p).toContain(COMPANION_SHEET_RENDERING);
    expect(p).not.toContain(STYLE_01_RENDERING_CORRECTION);
    for (const banned of ['Render the child', 'human facial proportions', 'age-appropriate body', 'Dini', 'void']) expect(p).not.toContain(banned);
    expect(() => composeCompanionOnlySheetPrompt({ mode: 'angle_variant_contract', viewLine: 'x', visualLock: 'L', style: style01SheetBlocks() }))
      .toThrow('companion_sheet_contract_required');
    expect(() => composeCompanionOnlySheetPrompt({ mode: 'concept_front_technique_refs', viewLine: 'x', contract: 'c', visualLock: 'L', style: style01SheetBlocks() }))
      .toThrow('companion_sheet_contract_required');
    expect(COMPANION_SHEET_NEGATIVE).not.toMatch(/Dini|cave|dragon/);
    // The legacy Style 01 strings are unchanged (the digest of every legacy prompt is pinned in companion-sheets.spec.ts).
    expect(STYLE_01_RENDERING_CORRECTION).toContain('Render the child');
    expect(STYLE_01_AVOIDANCE_NEGATIVE).toContain('Dini');
  });
});
