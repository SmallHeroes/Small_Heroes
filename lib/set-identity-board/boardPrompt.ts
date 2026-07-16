/**
 * Set Identity Board — the PURE board-prompt builder. NO I/O, NO clock, NO randomness.
 *
 * Turns a `SetDefinition` (the SET-only projection) into the text used to render ONE character-free, multi-view
 * SET reference sheet. Composed from the projection ONLY plus the order's style blocks (`@/lib/styles`). It never
 * imports the image provider or any env-coupled module, so it is fully testable and deterministic: same def → same
 * prompt → same `promptHash`.
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
  'NO panel borders, NO gutters, NO frames or dividing lines splitting the sheet',
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
  if (loc.topology) facets.push(`layout: ${loc.topology}`);
  const facetText = facets.length ? ` (${facets.join('; ')})` : '';
  const anchorText = loc.anchors.length
    ? ` — fixed anchors: ${loc.anchors.map((a) => a.description).join('; ')}`
    : '';
  return `- ${loc.description}${facetText}${anchorText}`;
}

function zoneGeometryLines(zone: SetDefinitionZone): string[] {
  if (zone.geometry.length === 0) return [];
  const heading = zone.name ? `${zone.name}:` : `${zone.id}:`;
  return [`- ${heading}`, ...zone.geometry.map((g) => `    • ${g}`)];
}

/**
 * Build the board prompt, its negative prompt, and their joint hash.
 *
 * The positive prompt: announces a multi-view SET reference sheet (one canonical empty establishing view + 1–2
 * neutral alternate views/details of the SAME set), states the set's locations / geometry / materials / lighting
 * from the projection, declares ONLY the openings present, forbids all inhabitants/action/text/paneling, and applies
 * the order's positive style block. The negative prompt fuses the style's negatives with the board forbids.
 */
export function buildSetIdentityBoardPrompt(def: SetDefinition): {
  prompt: string;
  negativePrompt: string;
  promptHash: string;
} {
  const openings = openingKindsPresent(def);

  const geometryLines = def.zones.flatMap(zoneGeometryLines);
  const materialLines = def.fixedSetFacts.map((f) => {
    const detail = [f.material ? `material: ${f.material}` : '', f.scale ? `scale: ${f.scale}` : '']
      .filter(Boolean)
      .join('; ');
    return `- ${f.propId}${detail ? ` — ${detail}` : ''}`;
  });

  const sections: string[] = [
    'SET IDENTITY BOARD — CHARACTER-FREE MULTI-VIEW SET REFERENCE SHEET',
    'Render the SET ONLY, empty of all inhabitants: one canonical establishing view of the whole set plus 1–2 neutral alternate views or fixed-detail studies of the EXACT SAME physical set, arranged as a clean reference sheet.',
    '',
    `SET IDENTITY: ${def.setIdentityId}  (board ${def.boardVersion})`,
    '',
    'LOCATIONS / VIEWPOINTS OF THIS ONE PHYSICAL SET:',
    ...def.locations.map(locationLine),
    '',
    'SET GEOMETRY (fixed architecture — must be identical across every view):',
    ...(geometryLines.length ? geometryLines : ['- (no structured geometry authored for this set)']),
    '',
    'FIXED SET OBJECTS (stable materials + scale — the same object, never redesigned, in every view):',
    ...(materialLines.length ? materialLines : ['- (no fixed set objects bound into this set)']),
    '',
    'WALL OPENINGS:',
    ...(openings.length
      ? [
          `Render ONLY these opening types, exactly as authored — invent no other opening: ${openings.join(', ')}.`,
        ]
      : ['No wall openings belong to this set — render solid, unbroken walls only.']),
    '',
    'VIEW PLAN:',
    '1. Primary establishing view — the whole empty set from a natural establishing angle.',
    '2. Secondary view — a neutral alternate angle of the same set, empty.',
    '3. Optional detail study — a close look at a fixed surface, material, or opening of the same set.',
    '',
    'STRICT FORBIDS (this is a SET PLATE, not a story page):',
    ...BOARD_FORBIDS.map((f) => `- ${f}`),
    '',
    'STYLE (from the order style; apply this rendering language to the set plate):',
    getPositiveStylePromptBlock(def.styleId),
  ];

  const prompt = sections.join('\n');

  const negativePrompt = [
    getNegativeStylePromptBlock(def.styleId),
    ...BOARD_FORBIDS,
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
