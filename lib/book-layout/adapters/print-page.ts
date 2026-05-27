import { BOOK_DESIGN_TOKENS } from '../design-tokens';
import type { PrintPage, StoryScene } from '../types';

/** Future PrintRenderer — Phase 1 stub only. */
export function storyScenesToPrintPages(scenes: StoryScene[]): PrintPage[] {
  const t = BOOK_DESIGN_TOKENS.trim;
  return scenes
    .filter((s) => s.kind === 'story')
    .map((s) => ({
      sceneIndex: s.sceneIndex,
      sceneId: s.sceneId,
      direction: s.direction,
      trimRatio: { widthIn: t.widthIn, heightIn: t.heightIn },
      bleedMm: BOOK_DESIGN_TOKENS.printBleedMm,
    }));
}
