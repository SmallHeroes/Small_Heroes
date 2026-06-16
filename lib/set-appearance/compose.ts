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

  if (!isCloseUpShot(options)) {
    lines.push(
      '',
      'VISUAL SET BOARD (when attached): identity/appearance ONLY for bed, window, lamp, shelf, rug, pillows — neutral sheet background is NOT the page background. Do NOT copy sheet layout or composition.'
    );
  }

  lines.push(
    '',
    'ACCEPTABLE variation: camera angle, brush texture, book spine order, pillow arrangement within palette.',
    'FORBIDDEN: different bed design family, different shelf shape, daytime-bright lighting, off-palette objects, rebuilt standing fort/canopy.'
  );

  return lines.join('\n');
}
