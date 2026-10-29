import type { CompanionSheetGeometry } from '@/lib/personal-wizard/personal-companions';
import type { CompanionSheetViewKind } from './companion-sheet-prompt';

/**
 * The companion sheet VIEW CONTRACT (CSR-1, 2026-10-28): what each sheet angle shows, hides and keeps, derived from one companion's own
 * declared geometry (counts, face parts, accessories with their side). The S1 prompts stated these rules only as a front view sees
 * them, and let the profile face "left or right", so an accessory's side and a rear view's face were left to chance. Pure: no
 * per-companion text lives here; every word about a companion comes from its geometry.
 *
 * Sides are the companion's OWN left/right. One fixed near side for every turned view: the side carrying a lateral accessory (so the
 * accessory stays a visible identity cue), otherwise LEFT. Seen from the front, its own left is on the viewer's right.
 */
export const COMPANION_SHEET_VIEW_CONTRACT_VERSION = 'companion-sheet-view-contract/v1' as const;

export class CompanionSheetContractError extends Error { constructor(readonly code: string) { super(code); } }
const fail = (code: string): never => { throw new CompanionSheetContractError(code); };

type Side = 'left' | 'right';
const other = (s: Side): Side => (s === 'left' ? 'right' : 'left');
const viewerSide = (s: Side) => `the viewer's ${s.toUpperCase()}`;

/** The near side of every turned view. Two lateral accessories on opposite sides have no single honest near side: refused. */
export function companionSheetNearSide(g: CompanionSheetGeometry): Side {
  const sides = [...new Set(g.accessories.map(a => a.side).filter((s): s is Side => s !== 'front'))];
  if (sides.length > 1) fail('companion_sheet_contract_sides');
  return sides[0] ?? 'left';
}

/** The per-view line for the prospective path (the legacy SIDE line said "left or right"; the contract fixes it). */
export const CONTRACT_VIEW_LINE: Record<CompanionSheetViewKind, string> = {
  front: 'FRONT-FACING full-body view: the companion faces the viewer, neutral calm expression.',
  three_quarter_front: 'THREE-QUARTER FRONT full-body view: the companion turned about 30 degrees, both eyes still readable.',
  side: 'SIDE PROFILE full-body view: one clean lateral profile, full silhouette readable, neutral expression.',
  three_quarter_back: 'THREE-QUARTER BACK full-body view: the companion seen from behind and a little from one side.',
  happy: 'HAPPY expression, front-facing full-body view: a warm gentle smile or bright friendly eyes; a subtle cheerful pose is fine.',
  theme: 'THEME expression, front-facing full-body view: one gentle calm story mood, still the same creature.',
};

export type CompanionSheetViewContract = {
  version: typeof COMPANION_SHEET_VIEW_CONTRACT_VERSION;
  view: CompanionSheetViewKind;
  nearSide: Side;
  facing: string;
  shows: string;
  hides: string;
  accessories: { item: string; placement: string }[];
  counts: string;
};

const countsLine = (g: CompanionSheetGeometry) =>
  Object.entries(g.counts).map(([part, n]) => `${n} ${part}`).join(', ');

function placement(view: CompanionSheetViewKind, near: Side, a: CompanionSheetGeometry['accessories'][number]) {
  const { item, part, side } = a;
  const frontView = view === 'front' || view === 'happy' || view === 'theme';
  if (side === 'front') {
    if (frontView) return `the ${item} sits at the front of the ${part}, centred`;
    if (view === 'three_quarter_front') return `the ${item} sits at the front of the ${part}, turned slightly toward ${viewerSide(near)}`;
    if (view === 'side') return `the ${item} sits at the front of the ${part}: in this profile it shows only at the leading edge of the ${part}`;
    return `the ${item} sits at the front of the ${part}, so it is HIDDEN from behind; at most the band around the ${part} shows`;
  }
  if (frontView) return `the ${item} sits on the companion's own ${side.toUpperCase()} side of the ${part}, which is ${viewerSide(other(side))} in this view`;
  // A lateral accessory's side IS the near side (companionSheetNearSide), so every turned view shows it on the near side.
  if (side !== near) fail('companion_sheet_contract_sides');
  if (view === 'side') return `the ${item} sits on the NEAR side of the ${part}, fully visible and facing the viewer (not under the chin, not at the front of the ${part})`;
  if (view === 'three_quarter_front') return `the ${item} sits on the near side of the ${part}, turned toward the viewer`;
  return `the ${item} sits on the NEAR side of the ${part}, seen from behind`;
}

/** The contract of one view, from one companion's geometry. */
export function companionSheetViewContract(g: CompanionSheetGeometry, view: CompanionSheetViewKind): CompanionSheetViewContract {
  if (!g || !Object.keys(g.counts).length || !g.face.length) fail('companion_sheet_contract_geometry');
  const near = companionSheetNearSide(g), face = g.face.join(', ');
  const turned: Record<CompanionSheetViewKind, { facing: string; shows: string; hides: string }> = {
    front: { facing: 'faces the viewer straight on', shows: `the whole face (${face}) and the front of the body`, hides: 'nothing of the face' },
    happy: { facing: 'faces the viewer', shows: `the whole face (${face}) with a happy expression`, hides: 'nothing of the face' },
    theme: { facing: 'faces the viewer', shows: `the whole face (${face}) with one calm gentle mood`, hides: 'nothing of the face' },
    three_quarter_front: { facing: `faces toward ${viewerSide(near)}, turned about 30 degrees from the viewer`,
      shows: `both eyes, the face (${face}) and a little of the companion's own ${near.toUpperCase()} side`, hides: `most of its own ${other(near).toUpperCase()} side` },
    side: { facing: `faces ${viewerSide(near)} in a clean profile, so the viewer sees its own ${near.toUpperCase()} side`,
      shows: `its own ${near.toUpperCase()} side and ONE eye (the near one)`, hides: `its whole own ${other(near).toUpperCase()} side and the far eye` },
    three_quarter_back: { facing: `faces AWAY from the viewer, into the picture and toward ${viewerSide(near)}`,
      shows: `mostly its back, the back of its head and a little of its own ${near.toUpperCase()} side`,
      hides: `the WHOLE face: no eye, none of ${face} is visible; at most the outer curve of one cheek shows` },
  };
  const t = turned[view];
  return { version: COMPANION_SHEET_VIEW_CONTRACT_VERSION, view, nearSide: near, ...t,
    accessories: g.accessories.map(a => ({ item: a.item, placement: placement(view, near, a) })),
    counts: `${countsLine(g)}. Each counted part keeps exactly its number: this angle may hide some, but nothing may be added, doubled or merged, and no shape may read as an extra one` };
}

/** The contract as prompt text. */
export function companionSheetViewContractText(c: CompanionSheetViewContract) {
  return [
    `VIEW CONTRACT (${c.version}, ${c.view}). Sides are the companion's OWN left and right.`,
    `Facing: the companion ${c.facing}.`,
    `This view shows ${c.shows}.`,
    `This view hides ${c.hides}.`,
    ...c.accessories.map(a => `Accessory: ${a.placement}.`),
    `Counts: ${c.counts}.`,
  ].join('\n');
}

/**
 * Every geometry word must come from the companion's own description: each counted part, face part and accessory item word, and each
 * accessory's placement as the description states it ("on his left side", "at the front of his neck"). A geometry that says what
 * the description does not is refused.
 */
export function assertCompanionSheetGeometryGrounded(description: string, g: CompanionSheetGeometry) {
  const d = description.toLowerCase(), has = (w: string) => d.includes(w.toLowerCase());
  const words = [...Object.keys(g.counts), ...g.face, ...g.accessories.flatMap(a => a.item.split(' '))];
  if (!words.length || words.some(w => !w.trim() || !has(w))) fail('companion_sheet_geometry_grounding');
  const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const a of g.accessories) {
    const stated = a.side === 'front' ? new RegExp(`\\bat the front of (his|her|its) ${escape(a.part.toLowerCase())}\\b`)
      : new RegExp(`\\bon (his|her|its) ${a.side} side\\b`);
    if (!stated.test(d)) fail('companion_sheet_geometry_grounding');
  }
  if (Object.values(g.counts).some(n => !Number.isInteger(n) || n < 0)) fail('companion_sheet_geometry_grounding');
  companionSheetNearSide(g);
}
