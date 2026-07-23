/**
 * Set Identity Board — the PURE board-prompt builder. NO I/O, NO clock, NO randomness.
 *
 * Turns a `SetDefinition` (the SET-only projection) into the text used to render ONE character-free establishing
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
import { getNegativeStylePromptBlock, getPositiveStylePromptBlock } from '@/lib/styles';

import type { SetDefinition, SetDefinitionLocation, SetDefinitionZone } from './types';

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

function locationLine(loc: SetDefinitionLocation): string {
  const facets: string[] = [];
  if (loc.timeOfDay) facets.push(`time of day: ${loc.timeOfDay}`);
  if (loc.lighting) facets.push(`lighting: ${loc.lighting}`);
  if (loc.environmentClass) facets.push(`environment: ${loc.environmentClass}`);
  const facetText = facets.length ? ` (${facets.join('; ')})` : '';
  return `- ${loc.name}${facetText}`;
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
 * The positive prompt: asks for ONE single continuous establishing view of the whole empty set, states the set's
 * locations / geometry / materials / lighting from the projection, declares ONLY the openings present, forbids all
 * inhabitants/action/text/paneling, and applies the order's positive style block. The negative prompt fuses the
 * style's negatives with the board forbids.
 *
 * Deliberately NO view plan and no "reference sheet" framing: enumerating views is what made the model draw a
 * panelled sheet (see the module header).
 */
export function buildSetIdentityBoardPrompt(def: SetDefinition): {
  prompt: string;
  negativePrompt: string;
  promptHash: string;
} {
  const openings = openingKindsPresent(def);

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

  const sections: string[] = [
    'SET IDENTITY BOARD — CHARACTER-FREE SINGLE ESTABLISHING VIEW OF ONE SET',
    'Render ONE single canonical establishing view of this whole set, empty of all inhabitants: a SINGLE CONTINUOUS ILLUSTRATION filling the frame edge to edge, from one natural establishing angle wide enough to take in the entire connected space at once.',
    'This is ONE picture — NOT a sheet, NOT multiple views, NOT panels, NOT a grid, NOT a collage. There are no dividing lines anywhere in the image.',
    '',
    `SET IDENTITY: ${def.setIdentityId}  (board ${def.boardVersion})`,
    '',
    'THE ONE PHYSICAL SET (all of the areas below are ONE continuous connected space, shown together in the single view):',
    ...def.locations.map(locationLine),
    '',
    'SET GEOMETRY (the fixed architecture of this set):',
    ...(geometryLines.length ? geometryLines : ['- (no structured geometry authored for this set)']),
    '',
    'FIXED SET OBJECTS (stable materials + scale — the same object, never redesigned):',
    ...(materialLines.length ? materialLines : ['- (no fixed set objects bound into this set)']),
    '',
    'SPOILER-NEUTRAL CONTENT POLICY:',
    ...(excludedLines.length
      ? excludedLines.map((line) => `- ${line}`)
      : ['- No page-conditioned prop is declared for exclusion.']),
    '',
    'WALL OPENINGS:',
    ...(openings.length
      ? [
          `Render ONLY these opening types, exactly as authored — invent no other opening: ${openings.join(', ')}.`,
        ]
      : ['No wall openings belong to this set — render solid, unbroken walls only.']),
    '',
    'STRICT FORBIDS (this is a SET PLATE, not a story page):',
    ...BOARD_FORBIDS.map((f) => `- ${f}`),
    ...excludedLines.map((f) => `- ${f}`),
    '',
    'STYLE (from the order style; apply this rendering language to the set plate):',
    getPositiveStylePromptBlock(def.styleId),
  ];

  const prompt = sections.join('\n');

  const negativePrompt = [
    getNegativeStylePromptBlock(def.styleId),
    ...BOARD_FORBIDS,
    ...excludedLines,
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
