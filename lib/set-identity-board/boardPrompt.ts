/**
 * Set Identity Board — the PURE board-prompt builder. NO I/O, NO clock, NO randomness.
 *
 * Turns a `SetDefinition` (the SET-only projection) into the text used to render ONE unoccupied establishing
 * view of the set. Composed from the projection ONLY plus the order's style blocks (`@/lib/styles`). It never
 * imports the image provider or any env-coupled module, so it is fully testable and deterministic: same def →
 * same prompt → same `promptHash`.
 *
 * WHY A SINGLE VIEW (learned from the first real mint): this asked for a "multi-view reference sheet" with a
 * numbered VIEW PLAN, and the model did exactly that — it returned a 3-panel sheet with cream gutters. Board QA
 * correctly failed it on `panels`. Enumerating views IS what draws panels, and panel borders are precisely what
 * must never leak into a page. The set content was already right; only the layout was. So: ONE continuous
 * establishing view of the whole connected set. A single wide shot already captures it (the rejected board's own
 * top panel proved that), and it cannot grow a gutter.
 *
 * Two hard rules make this reusable and safe:
 *  1. ZERO story-specific literals. Every set-specific word comes from the projection; the scaffolding is generic.
 *  2. Openings are declared ONLY as they appear in the projection's `spatialNodes`. The builder never invents an
 *     opening kind (a doorway/window/balcony_door) that the structure does not contain.
 */
import { canonicalHash } from '@/lib/canonical-json';
import { getNegativeStylePromptBlock, getSetBoardStylePromptBlock } from '@/lib/styles';

import type { SetDefinition, SetDefinitionLocation, SetDefinitionZone } from './types';
import {
  assertCurrentSetBoardAmbientDressingPolicy,
  SET_BOARD_AMBIENT_PALETTE_COLOR_LABELS,
  SET_BOARD_AMBIENT_PALETTE_INTENT_LABEL,
  SET_BOARD_AMBIENT_PALETTE_TARGET_LABELS,
  selectSetBoardAmbientDressing,
} from './ambientDressing';
import {
  assertSetBoardPositiveAuthoritySpoilerNeutral,
  positiveAuthorityLabelIsSafe,
} from './positiveAuthoritySpoilerGuard';
import {
  setBoardSafeIdentityLabel,
  setBoardSafeLocationName,
} from './boardSafeIdentity';

/**
 * The wall-APERTURE kinds (a subset of `SpatialNodeKind`). Only these are announced as "openings" in the prompt;
 * solid elements (wall/floor/furniture/railing/ledge) are set geometry but not apertures. Declared here so the
 * builder can enumerate exactly the openings the structure authored — never guess one.
 */
const OPENING_KINDS: ReadonlySet<string> = new Set(['doorway', 'window', 'balcony_door']);

/** Generic negatives that make this a SET PLATE and not a story page. No story-specific words. */
const BOARD_FORBIDS: readonly string[] = [
  'NO people, NO children, NO human figures, NO characters of any kind',
  'NO animals, NO creatures, NO mascots, NO pets',
  'NO action, NO pose, NO gesture, NO narrative moment — the set is empty and still, nothing is happening',
  'NO labels, NO text, NO letters, NO numbers, NO captions, NO watermarks, NO signage',
  'NO page composition, NO story panel, NO book-page layout, NO comic layout, NO speech bubbles',
  'NO panel borders, NO gutters, NO frames or dividing lines splitting the image',
  // The failure mode the first real mint actually produced: a 3-panel sheet with cream gutters. Named explicitly
  // and positively resolved ("ONE single continuous illustration") — a forbid the model can obey by doing one thing.
  'NO multiple views, NO second angle, NO inset, NO detail study, NO grid, NO contact sheet, NO collage — ONE single continuous illustration of ONE view, edge to edge',
];

function humanizeKind(kind: string): string {
  return kind.replace(/_/g, ' ');
}

/** Sorted, de-duplicated list of the OPENING kinds actually present in the projection's zones. */
function openingKindsPresent(def: SetDefinition): string[] {
  const present = new Set<string>();
  for (const zone of def.zones) {
    for (const node of zone.spatialNodes) {
      if (node && typeof node.kind === 'string' && OPENING_KINDS.has(node.kind)) {
        present.add(node.kind);
      }
    }
  }
  return Array.from(present).sort().map(humanizeKind);
}

function locationLine(definition: SetDefinition, loc: SetDefinitionLocation): string {
  const facets: string[] = [];
  if (loc.timeOfDay) facets.push(`time of day: ${loc.timeOfDay}`);
  if (loc.lighting) facets.push(`lighting: ${loc.lighting}`);
  if (loc.environmentClass) facets.push(`environment: ${loc.environmentClass}`);
  const facetText = facets.length ? ` (${facets.join('; ')})` : '';
  return `- ${setBoardSafeLocationName(definition, loc)}${facetText}`;
}

function zoneGeometryLines(zone: SetDefinitionZone, index: number): string[] {
  if (zone.geometry.length === 0) return [];
  return [`- Area ${index + 1}:`, ...zone.geometry.map((g) => `    • ${g}`)];
}

function placementAreaLabels(def: SetDefinition, zoneIds: readonly string[]): string[] {
  return [...new Set(zoneIds)]
    .map((zoneId) => def.zones.findIndex((zone) => zone.id === zoneId))
    .filter((index) => index >= 0)
    .map((index) => `Area ${index + 1}`);
}

/**
 * Build the board prompt, its negative prompt, and their joint hash.
 *
 * The positive prompt contains stable physical-set authority only: locations, geometry, fixed objects, light,
 * declared openings, and the board-safe style projection. All blocked entities/actions/layouts live exclusively
 * in the negative prompt, where they cannot become positive visual authority.
 *
 * Deliberately NO view plan and no "reference sheet" framing: enumerating views is what made the model draw a
 * panelled sheet (see the module header).
 */
export function buildSetIdentityBoardPrompt(def: SetDefinition): {
  prompt: string;
  negativePrompt: string;
  promptHash: string;
} {
  // Defense in depth for callers that construct/read a SetDefinition without using projectSetDefinition.
  // This runs before any positive prompt text or provider-facing hash can be produced.
  assertSetBoardPositiveAuthoritySpoilerNeutral(def);
  assertCurrentSetBoardAmbientDressingPolicy(def.contentPolicy.ambientDressing);
  const openings = openingKindsPresent(def);
  const providerSafeIdentity = setBoardSafeIdentityLabel(def);

  const geometryLines = def.zones.flatMap(zoneGeometryLines);
  const materialLines = def.fixedSetFacts.map((f) => {
    const placementAreas = placementAreaLabels(
      def,
      f.placements.map((placement) => placement.zoneId),
    );
    const detail = [
      `count: exactly ${f.quantity}`,
      f.material ? `material: ${f.material}` : '',
      f.scale ? `scale: ${f.scale}` : '',
      placementAreas.length ? `placement areas: ${placementAreas.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('; ');
    return `- ${f.name}${detail ? ` — ${detail}` : ''}`;
  });
  const excludedLines = def.contentPolicy.excludedProps.map(
    (prop) => `NO ${prop.name}; it is page-conditioned content and must be absent from this base board`,
  );
  const excludedPropIds = new Set(def.contentPolicy.excludedProps.map((prop) => prop.propId));
  const undeclaredPropLines = def.positiveAuthorityPolicy.blockedProps
    .filter((prop) => !excludedPropIds.has(prop.propId))
    .map(
      (prop) =>
        `NO ${prop.name}; it is not declared as a stable fixed set object and must be absent from this base board`,
    );
  const ambientPolicy = def.contentPolicy.ambientDressing;
  const ambientSelections = selectSetBoardAmbientDressing(
    ambientPolicy,
    (label) => positiveAuthorityLabelIsSafe(def, label),
  );
  const ambientCategoryLines = ambientSelections.map(({ label }) => `- ${label}`);
  const sleepingPriorityLabels = ambientSelections
    .filter(({ category }) => [
      'fixed_practical_light',
      'books_without_readable_text',
      'soft_furnishing',
      'toy_storage_and_blocks',
      'clearly_inanimate_cloth_doll',
      'non_text_wall_decor',
    ].includes(category))
    .map(({ label }) => label);
  const preferredPalette = ambientPolicy.preferredColorFamilies
    .map((color) => SET_BOARD_AMBIENT_PALETTE_COLOR_LABELS[color])
    .join(', ');
  const paletteTargets = ambientPolicy.paletteTargets
    .map((target) => SET_BOARD_AMBIENT_PALETTE_TARGET_LABELS[target])
    .join('; ');

  const sections: string[] = [
    'SET IDENTITY BOARD — SINGLE ESTABLISHING VIEW OF ONE PHYSICAL SET',
    'Render ONE single canonical establishing view of this unoccupied physical set: a SINGLE CONTINUOUS ILLUSTRATION filling the frame edge to edge, from one natural establishing angle wide enough to take in the entire connected space at once.',
    'Compose the result as one uninterrupted picture filling the frame edge to edge.',
    '',
    `SET IDENTITY: ${providerSafeIdentity}  (board ${def.boardVersion})`,
    '',
    'THE ONE PHYSICAL SET (all of the areas below are ONE continuous connected space, shown together in the single view):',
    ...def.locations.map((location) => locationLine(def, location)),
    '',
    'SET GEOMETRY (the fixed architecture of this set):',
    ...(geometryLines.length ? geometryLines : ['- (no structured geometry authored for this set)']),
    '',
    'FIXED SET OBJECTS (stable materials + scale — the same object, never redesigned):',
    ...(materialLines.length ? materialLines : ['- (no fixed set objects bound into this set)']),
    '',
    'STABLE OBJECT AUTHORITY:',
    '- Exact recurring/story-prop identity comes only from the fixed set objects declared above.',
    '- Ambient dressing below is non-narrative background detail, never a recurring story prop or new spatial opening.',
    '',
    'AMBIENT SET DRESSING (bounded visual personality, not story content):',
    `- Density: ${ambientPolicy.density}; use at least ${ambientPolicy.minimumDistinctDetails} visually distinct, space-appropriate details rather than a sparse or generic room/set.`,
    '- Select only a physically appropriate subset from these allowed categories:',
    ...ambientCategoryLines.map((line) => `  ${line}`),
    `- When the declared geometry is a sleeping room with a bed, prioritize the applicable safe items from this subset: ${sleepingPriorityLabels.join('; ')}.`,
    `- For these palette-sensitive surfaces — ${paletteTargets} — keep the ambient palette ${SET_BOARD_AMBIENT_PALETTE_INTENT_LABEL} and prefer a balanced mix drawn from ${preferredPalette}.`,
    '- Do not make pink or coral the dominant combined cue across large furnishings and toy clothing. One isolated pink or coral accent is allowed; do not replace it with an all-blue stereotype.',
    '- Every dressing detail must be visibly inanimate, text-free, spoiler-neutral, and subordinate to the exact authored geometry.',
    '- Never imitate, substitute for, or visually introduce a blocked/page-conditioned recurring prop.',
    '',
    'WALL OPENINGS:',
    ...(openings.length
      ? [
          `Render ONLY these opening types, exactly as authored — invent no other opening: ${openings.join(', ')}.`,
        ]
      : ['No wall openings belong to this set — render solid, unbroken walls only.']),
    '',
    'STYLE (from the order style; apply this rendering language to the set plate):',
    getSetBoardStylePromptBlock(def.styleId),
  ];

  const prompt = sections.join('\n');

  const negativePrompt = [
    getNegativeStylePromptBlock(def.styleId),
    ...BOARD_FORBIDS,
    ...excludedLines,
    ...undeclaredPropLines,
    'people',
    'child',
    'character',
    'animal',
    'action',
    'pose',
    'text',
    'label',
    'caption',
    'panel',
    'border',
    'gutter',
  ].join('; ');

  const promptHash = canonicalHash({ prompt, negativePrompt });

  return { prompt, negativePrompt, promptHash };
}
