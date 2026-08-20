/**
 * Set Identity Board — the character-free QA pass over a rendered board image.
 *
 * The vision call is INJECTED (`deps.callVision`) so this is testable with no real network. The QA instruction is
 * built entirely from the `SetDefinition`: it tells the checker to flag any inhabitant/action/text/paneling and any
 * opening kind that is NOT part of this set. A board is failed if the checker returns ANY contamination flag —
 * fail-closed, because a contaminated board must never become an approved reference.
 *
 * FAIL-CLOSED covers UNCERTAINTY, not just contamination: a malformed response or a thrown vision call also FAILS
 * (with a diagnostic flag). Only an affirmative, well-formed, empty flag list passes — see `qaSetIdentityBoardImage`.
 *
 * `boardContaminationFlags` is a PURE classifier (no network): given a list of OBSERVED terms it returns the subset
 * that are contamination. A real vision adapter can use it to turn free observations into flags; the tests use it to
 * verify the forbidden vocabulary without a network.
 */
import type { BoardQaResult, SetDefinition } from './types';
import {
  assertCurrentSetBoardAmbientDressingPolicy,
  SET_BOARD_AMBIENT_PALETTE_COLOR_LABELS,
  SET_BOARD_AMBIENT_PALETTE_INTENT_LABEL,
  SET_BOARD_AMBIENT_PALETTE_TARGET_LABELS,
  selectSetBoardAmbientDressing,
} from './ambientDressing';
import { setBoardSafeIdentityLabel } from './boardSafeIdentity';
import {
  assertSetBoardPositiveAuthoritySpoilerNeutral,
  positiveAuthorityLabelIsSafe,
} from './positiveAuthoritySpoilerGuard';

const OPENING_KINDS: ReadonlySet<string> = new Set(['doorway', 'window', 'balcony_door']);

/**
 * The forbidden-observation vocabulary for a SET plate. Reusable + story-agnostic: these are the categories that must
 * NOT appear on a character-free set reference sheet. Matching is case-insensitive and substring-based so an observed
 * phrase like "a small child" flags on "child".
 */
const CONTAMINATION_TERMS: readonly string[] = [
  'person',
  'people',
  'human',
  'child',
  'children',
  'boy',
  'girl',
  'man',
  'woman',
  'figure',
  'character',
  'animal',
  'creature',
  'mascot',
  'pet',
  'action',
  'pose',
  'gesture',
  'text',
  'letter',
  'number',
  'label',
  'caption',
  'watermark',
  'panel',
  'border',
  'gutter',
  'speech bubble',
];

/**
 * PURE. Given a list of observed terms, return those that are contamination for a set plate (case-insensitive,
 * substring match against the forbidden vocabulary). Order/duplicates of the input are preserved for the caller's
 * reporting; a term matching no forbidden category is dropped.
 */
export function boardContaminationFlags(observed: string[]): string[] {
  const out: string[] = [];
  for (const term of observed) {
    if (typeof term !== 'string') continue;
    const lower = term.toLowerCase();
    if (CONTAMINATION_TERMS.some((forbidden) => lower.includes(forbidden))) {
      out.push(term);
    }
  }
  return out;
}

/** The opening kinds (humanized) that ARE part of this set — everything else is an out-of-contract opening. */
function allowedOpenings(def: SetDefinition): string[] {
  const present = new Set<string>();
  for (const zone of def.zones) {
    for (const node of zone.spatialNodes) {
      if (node && typeof node.kind === 'string' && OPENING_KINDS.has(node.kind)) {
        present.add(node.kind.replace(/_/g, ' '));
      }
    }
  }
  return Array.from(present).sort();
}

function placementAreaLabels(def: SetDefinition, zoneIds: readonly string[]): string[] {
  return [...new Set(zoneIds)]
    .map((zoneId) => def.zones.findIndex((zone) => zone.id === zoneId))
    .filter((index) => index >= 0)
    .map((index) => `Area ${index + 1}`);
}

function allowedGeometryLines(def: SetDefinition): string[] {
  return def.zones.flatMap((zone, zoneIndex) =>
    zone.geometry.map((geometry) => `- Area ${zoneIndex + 1}: ${geometry}`),
  );
}

/** Build the character-free QA instruction from the projection ONLY (no story literals). */
export function buildBoardQaInstruction(def: SetDefinition): string {
  assertSetBoardPositiveAuthoritySpoilerNeutral(def);
  assertCurrentSetBoardAmbientDressingPolicy(def.contentPolicy.ambientDressing);
  const openings = allowedOpenings(def);
  const geometryLines = allowedGeometryLines(def);
  const openingsLine = openings.length
    ? `The ONLY wall openings that belong to this set are: ${openings.join(', ')}. Flag any other opening kind (e.g. a doorway/window/balcony door not in that list) as "opening-kind-not-in-contract".`
    : 'This set has NO wall openings. Flag any doorway, window, or balcony door as "opening-kind-not-in-contract".';
  const blockedProps = new Map(
    def.positiveAuthorityPolicy.blockedProps.map((prop) => [prop.propId, prop]),
  );
  for (const prop of def.contentPolicy.excludedProps) blockedProps.set(prop.propId, prop);
  const excludedPropLines = [...blockedProps.values()]
    .sort((a, b) => (a.propId < b.propId ? -1 : a.propId > b.propId ? 1 : 0))
    .map(
      (prop) => `- "${prop.name}" (${prop.propId}) must be completely absent; flag it as "excluded-prop:${prop.propId}".`,
    );
  const fixedPropLines = def.fixedSetFacts.map((fact) => {
    const areas = placementAreaLabels(
      def,
      fact.placements.map((placement) => placement.zoneId),
    );
    return (
      `- "${fact.name}" (${fact.propId}) must appear exactly ${fact.quantity} time(s) as one recurring physical ` +
      `identity, in the declared placement area(s) ${areas.join(', ') || 'none'}; flag a missing/duplicate count as ` +
      `"prop-count:${fact.propId}" and wrong placement as "prop-placement:${fact.propId}".`
    );
  });
  const ambientPolicy = def.contentPolicy.ambientDressing;
  const ambientSelections = selectSetBoardAmbientDressing(
    ambientPolicy,
    (label) => positiveAuthorityLabelIsSafe(def, label),
  );
  const ambientCategoryLines = ambientSelections.map(({ label }) => `- ${label}`);
  const allowsInanimateDoll = ambientSelections.some(
    ({ category }) => category === 'clearly_inanimate_cloth_doll',
  );
  const sleepingPriorityLabels = ambientSelections
    .filter(({ category }) => [
      'fixed_practical_light',
      'books_without_readable_text',
      'soft_furnishing',
      'toy_storage_and_blocks',
      'clearly_inanimate_cloth_doll',
      'ordinary_storage',
      'non_text_wall_decor',
    ].includes(category))
    .map(({ label }) => label);
  const preferredPalette = ambientPolicy.preferredColorFamilies
    .map((color) => SET_BOARD_AMBIENT_PALETTE_COLOR_LABELS[color])
    .join(', ');
  const paletteTargets = ambientPolicy.paletteTargets
    .map((target) => SET_BOARD_AMBIENT_PALETTE_TARGET_LABELS[target])
    .join('; ');

  return [
    `Inspect this image as a CHARACTER-FREE set reference sheet for set identity "${setBoardSafeIdentityLabel(def)}".`,
    'It must show ONLY the empty physical set (architecture, fixed surfaces, fixed objects). Return a list of contamination flags for anything present that must NOT be, using these exact categories where they apply:',
    '- "people" for any person, child, human figure, or character',
    '- "animals" for any animal, creature, mascot, or pet',
    ...(allowsInanimateDoll
      ? ['- Do NOT flag a clearly manufactured, inert toy or cloth doll as a person, animal, or living character. Flag it only if it is depicted as alive, acting, posing, or occupying the scene as a character.']
      : []),
    '- "action" for any pose, gesture, or narrative action',
    '- "text" for any text, letters, numbers, labels, captions, or watermarks',
    '- "panels" for any story panel, page layout, panel border, or gutter',
    openingsLine,
    'ALLOWED SET GEOMETRY AND BUILT-IN FURNISHINGS:',
    ...(geometryLines.length ? geometryLines : ['- none declared']),
    'Treat the geometry and built-in furnishings above as permitted set content. For an excluded-prop flag, require a distinct, recognizable physical instance of that prop. Do NOT flag an allowed surface, furnishing, color, stripe, pattern, texture, material, or shape merely because it resembles or shares words with the excluded prop name.',
    'UNDECLARED OR PAGE-CONDITIONED PROPS THAT MUST NOT APPEAR:',
    ...(excludedPropLines.length ? excludedPropLines : ['- none']),
    'FIXED PROP COUNT AND PLACEMENT:',
    ...(fixedPropLines.length ? fixedPropLines : ['- none']),
    'REQUIRED AMBIENT SET DRESSING:',
    `- The set must read as ${ambientPolicy.density.replace(/_/g, ' ')}, with at least ${ambientPolicy.minimumDistinctDetails} visually distinct, space-appropriate ambient details selected from the allowed categories below.`,
    ...ambientCategoryLines,
    `- For a sleeping room with a bed, a hotel-like image containing only a bed, side table, window, and empty floor/walls is too sparse. Expect several applicable safe details from: ${sleepingPriorityLabels.join('; ')}.`,
    '- If the set is materially sparse, generic, or lacks the minimum distinct ambient details, return "ambient-dressing-too-sparse".',
    `- Inspect these palette-sensitive surfaces: ${paletteTargets}. The ambient palette must read as ${SET_BOARD_AMBIENT_PALETTE_INTENT_LABEL}; preferred balancing colors include ${preferredPalette}.`,
    '- A single pink or coral accent is allowed and is not a defect. Do not require an all-blue room. Return "ambient-palette-strongly-gender-coded" only when large furnishings and toy clothing combine into a materially dominant gender-coded presentation.',
    'If the image is a clean, empty, spoiler-neutral, sufficiently dressed set plate with only the allowed openings and exact fixed-prop count/placement, return an empty flag list.',
  ].join('\n');
}

/** Diagnostic flag: the vision call returned something that is not a well-formed `{flags: string[]}`. */
export const QA_RESPONSE_MALFORMED_FLAG = 'qa-response-malformed';

/** Diagnostic flag: the vision call itself threw or rejected — we never got a verdict at all. */
export const QA_CALL_FAILED_FLAG = 'qa-call-failed';

/**
 * PURE. Parse a vision response fail-closed. `ok:false` carries a diagnostic saying WHY it was rejected.
 *
 * Deliberately strict: `flags` must be an ARRAY OF STRINGS, nothing else. The previous version coerced anything
 * non-array to `[]`, which then read as "no contamination found" and PASSED the board — so a vision adapter that
 * changed its shape, returned an error envelope, or emitted a single string silently minted approved references from
 * unchecked images. An absent verdict is not a clean verdict. A non-string entry is rejected rather than filtered out
 * for the same reason: a partially-parsed flag list means the response is not the shape we think it is, and the flags
 * we CAN read may not be all of them.
 */
function parseVisionFlags(
  response: unknown
): { ok: true; flags: string[] } | { ok: false; diagnostic: string } {
  if (response === null || typeof response !== 'object' || Array.isArray(response)) {
    return {
      ok: false,
      diagnostic: `${QA_RESPONSE_MALFORMED_FLAG}: expected an object with a "flags" array, got ${
        response === null ? 'null' : Array.isArray(response) ? 'an array' : typeof response
      }`,
    };
  }

  const flags = (response as { flags?: unknown }).flags;
  if (!Array.isArray(flags)) {
    return {
      ok: false,
      diagnostic: `${QA_RESPONSE_MALFORMED_FLAG}: "flags" is not an array (got ${
        flags === null ? 'null' : typeof flags
      })`,
    };
  }
  if (!flags.every((f) => typeof f === 'string')) {
    return {
      ok: false,
      diagnostic: `${QA_RESPONSE_MALFORMED_FLAG}: "flags" contains a non-string entry`,
    };
  }

  return { ok: true, flags: flags as string[] };
}

/**
 * Run the character-free QA pass. Builds the instruction from `def`, calls the injected vision fn, and fails the board
 * if it returns ANY flag.
 *
 * FAIL-CLOSED, on every axis: a thrown/rejected call, or a response that is not a well-formed `{flags: string[]}`,
 * yields `'failed'` with a diagnostic flag naming the reason — NEVER `'passed'`. Only an affirmative, well-formed,
 * empty flag list passes. This function gates whether an image may become an APPROVED reference that every page of a
 * set is then rendered against, so "we could not tell" must land on the same side as "we found contamination".
 *
 * `deps.callVision` is typed `Promise<unknown>` on purpose: the adapter's declared return type is a claim, not a
 * guarantee, and this is exactly the seam where an untrusted shape arrives. Validation happens at runtime.
 */
export async function qaSetIdentityBoardImage(
  input: { imageUrl: string; def: SetDefinition },
  deps: { callVision: (args: { imageUrl: string; instruction: string }) => Promise<unknown> }
): Promise<BoardQaResult> {
  const instruction = buildBoardQaInstruction(input.def);

  let response: unknown;
  try {
    // `await` inside the try so a synchronous throw and a rejected promise both land here.
    response = await deps.callVision({ imageUrl: input.imageUrl, instruction });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { qaStatus: 'failed', qaFlags: [`${QA_CALL_FAILED_FLAG}: ${reason}`] };
  }

  const parsed = parseVisionFlags(response);
  if (!parsed.ok) return { qaStatus: 'failed', qaFlags: [parsed.diagnostic] };

  return { qaStatus: parsed.flags.length > 0 ? 'failed' : 'passed', qaFlags: parsed.flags };
}
