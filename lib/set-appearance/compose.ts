import { isFortFormPrimaryFact } from '../scene-memory/fact-compare';
import { filterSignaturesForFixedBoard } from './quarantine';
import type { SceneAppearanceMemory, SetAppearanceBoardOptions } from './types';

export function promptContainsSetAppearanceLock(prompt: string): boolean {
  return /SET APPEARANCE LOCK/i.test(prompt);
}

function isCloseUpShot(options?: SetAppearanceBoardOptions): boolean {
  return options?.pageShot?.shot === 'close_up';
}

/** J2.5 — appearance signatures + lighting target (extends SCENE MEMORY LOCK). */
export function buildSetAppearanceLockBlock(
  appearance: SceneAppearanceMemory | null | undefined,
  options?: SetAppearanceBoardOptions
): string | null {
  if (!appearance?.signatures?.length) return null;

  const lines = [
    'SET APPEARANCE LOCK (same illustrator, same set — appearance identity, NOT pixel-perfect):',
    `scene: ${appearance.sceneId}`,
    '',
    'LIGHTING TARGET (mandatory consistency across pages):',
    appearance.lightingLockNote,
    '',
    'OBJECT APPEARANCE SIGNATURES:',
    ...appearance.signatures.map((s) => {
      const parts = [
        s.silhouette ? `silhouette: ${s.silhouette}` : '',
        s.material ? `material: ${s.material}` : '',
        s.colorFamily ? `palette: ${s.colorFamily}` : '',
        s.formNote ? `note: ${s.formNote}` : '',
      ].filter(Boolean);
      return `- ${s.factId}: ${parts.join(' · ') || 'hold established design'}`;
    }),
  ];

  // VISUAL SET BOARD line — data-driven: name ONLY the fixed-board objects that
  // actually exist in THIS story's scene set, never a hardcoded furniture list.
  if (!isCloseUpShot(options)) {
    const boardObjects = filterSignaturesForFixedBoard(appearance.signatures).map((s) => s.factId);
    if (boardObjects.length) {
      lines.push(
        '',
        `VISUAL SET BOARD (when attached): identity/appearance ONLY for ${boardObjects.join(', ')} — neutral sheet background is NOT the page background. Do NOT copy sheet layout or composition.`
      );
    }
  }

  // FORBIDDEN line — data-driven: emit object-specific drift bans only for objects
  // present in THIS scene set; a set without bed/shelf/fort omits those clauses.
  const factIds = appearance.signatures.map((s) => s.factId);
  const isNightLighting = appearance.lightingTarget.startsWith('night');
  const forbidden: string[] = [];
  if (factIds.some((id) => /bed/i.test(id))) forbidden.push('different bed design family');
  if (factIds.some((id) => /shelf/i.test(id))) forbidden.push('different shelf shape');
  if (isNightLighting) forbidden.push('daytime-bright lighting');
  forbidden.push('off-palette objects');
  if (factIds.some((id) => isFortFormPrimaryFact(id))) forbidden.push('rebuilt standing fort/canopy');

  lines.push(
    '',
    'ACCEPTABLE variation: camera angle, brush texture, minor object arrangement within palette.',
    `FORBIDDEN: ${forbidden.join(', ')}.`
  );

  return lines.join('\n');
}
