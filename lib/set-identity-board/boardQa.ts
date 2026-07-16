/**
 * Set Identity Board — the character-free QA pass over a rendered board image.
 *
 * The vision call is INJECTED (`deps.callVision`) so this is testable with no real network. The QA instruction is
 * built entirely from the `SetDefinition`: it tells the checker to flag any inhabitant/action/text/paneling and any
 * opening kind that is NOT part of this set. A board is failed if the checker returns ANY contamination flag —
 * fail-closed, because a contaminated board must never become an approved reference.
 *
 * `boardContaminationFlags` is a PURE classifier (no network): given a list of OBSERVED terms it returns the subset
 * that are contamination. A real vision adapter can use it to turn free observations into flags; the tests use it to
 * verify the forbidden vocabulary without a network.
 */
import type { BoardQaResult, SetDefinition } from './types';

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

/** Build the character-free QA instruction from the projection ONLY (no story literals). */
export function buildBoardQaInstruction(def: SetDefinition): string {
  const openings = allowedOpenings(def);
  const openingsLine = openings.length
    ? `The ONLY wall openings that belong to this set are: ${openings.join(', ')}. Flag any other opening kind (e.g. a doorway/window/balcony door not in that list) as "opening-kind-not-in-contract".`
    : 'This set has NO wall openings. Flag any doorway, window, or balcony door as "opening-kind-not-in-contract".';

  return [
    `Inspect this image as a CHARACTER-FREE set reference sheet for set identity "${def.setIdentityId}".`,
    'It must show ONLY the empty physical set (architecture, fixed surfaces, fixed objects). Return a list of contamination flags for anything present that must NOT be, using these exact categories where they apply:',
    '- "people" for any person, child, human figure, or character',
    '- "animals" for any animal, creature, mascot, or pet',
    '- "action" for any pose, gesture, or narrative action',
    '- "text" for any text, letters, numbers, labels, captions, or watermarks',
    '- "panels" for any story panel, page layout, panel border, or gutter',
    openingsLine,
    'If the image is a clean, empty, character-free set plate with only the allowed openings, return an empty flag list.',
  ].join('\n');
}

/**
 * Run the character-free QA pass. Builds the instruction from `def`, calls the injected vision fn, and fails the board
 * if it returns ANY flag (fail-closed). Returns the flags verbatim for reporting.
 */
export async function qaSetIdentityBoardImage(
  input: { imageUrl: string; def: SetDefinition },
  deps: { callVision: (args: { imageUrl: string; instruction: string }) => Promise<{ flags: string[] }> }
): Promise<BoardQaResult> {
  const instruction = buildBoardQaInstruction(input.def);
  const { flags } = await deps.callVision({ imageUrl: input.imageUrl, instruction });
  const qaFlags = Array.isArray(flags) ? flags.filter((f) => typeof f === 'string') : [];
  return { qaStatus: qaFlags.length > 0 ? 'failed' : 'passed', qaFlags };
}
