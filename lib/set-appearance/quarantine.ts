import { isFortFormPrimaryFact, isBlanketFact, isPillowAggregateFact } from '../scene-memory/fact-compare';
import type { SceneAppearanceMemory, SceneAppearanceSignature } from './types';

export const BOARD_MANIFEST_VERSION = 'fixed-objects-only-r1';

/** Facts allowed on the fixed-appearance board (never stateful/collapsible). */
export function isFixedBoardFactId(factId: string): boolean {
  const id = factId.toLowerCase();
  if (isFortFormPrimaryFact(factId)) return false;
  if (isBlanketFact(factId)) return false;
  if (isPillowAggregateFact(factId)) return false;
  if (/pillow/i.test(id)) return false;
  if (id === 'bed' || /^bed\b/.test(id)) return true;
  if (/window|curtain/.test(id)) return true;
  if (/lamp|table/.test(id)) return true;
  if (/shelf/.test(id)) return true;
  if (/rug/.test(id)) return true;
  if (id === 'walls' || id === 'floor') return true;
  return false;
}

export function filterSignaturesForFixedBoard(
  signatures: SceneAppearanceSignature[]
): SceneAppearanceSignature[] {
  return signatures.filter((s) => isFixedBoardFactId(s.factId));
}

export function buildFixedBoardAppearanceMemory(
  appearance: SceneAppearanceMemory
): SceneAppearanceMemory {
  return {
    ...appearance,
    signatures: filterSignaturesForFixedBoard(appearance.signatures),
  };
}

export const BOARD_QUARANTINE_FORBIDDEN_LINES = [
  'FORBIDDEN on this sheet (contamination = reject):',
  '- NO pillow-cave, pillow pile, pillow fort, or scattered pillows heap',
  '- NO blanket, blanket fold, draped fabric, or upright fabric drape',
  '- NO arch, opening, tunnel, roof, canopy, tent, teepee, or fort structure',
  '- NO collapsible or stateful objects — FIXED furniture/surfaces ONLY',
].join('\n');
