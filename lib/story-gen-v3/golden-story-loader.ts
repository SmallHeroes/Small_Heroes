/**
 * Read-only golden story loader for v3 calibration (no bank writes).
 */

import fs from 'fs';
import path from 'path';

const STORY_BANK_DIR = path.join(
  process.cwd(),
  'story-bank',
  (process.env.STORY_BANK_V3_DIR || 'v5-fixed-v2').trim()
);

const GOLDEN_FILES: Record<string, string> = {
  panda_anat_adventure: 'panda_anat_adventure.md',
  dragon_dini_fantasy: 'dragon_dini_fantasy.md',
  fox_uri_adventure: 'fox_uri_adventure.md',
  dragon_dini_bedtime: 'dragon_dini_bedtime.md',
  octopus_seara_adventure: 'octopus_seara_adventure.md',
  chameleon_koko_adventure: 'chameleon_koko_adventure.md',
  chameleon_koko_bedtime: 'chameleon_koko_bedtime.md',
  chameleon_koko_fantasy: 'chameleon_koko_fantasy.md',
  lion_shaket_fantasy: 'lion_shaket_fantasy.md',
  lion_shaket_adventure: 'lion_shaket_adventure.md',
  bunny_ometz_bedtime: 'bunny_ometz_bedtime.md',
  bunny_ometz_adventure: 'bunny_ometz_adventure.md',
  turtle_beiti_adventure: 'turtle_beiti_adventure.md',
  turtle_beiti_bedtime: 'turtle_beiti_bedtime.md',
};

export function loadGoldenStoryMarkdown(sourceId: string): string {
  const file = GOLDEN_FILES[sourceId];
  if (!file) {
    throw new Error(`[v3] Unknown golden source: ${sourceId}`);
  }
  const filePath = path.join(STORY_BANK_DIR, file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`[v3] Golden file not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

export function listV3CalibrationGoldens(): string[] {
  return Object.keys(GOLDEN_FILES);
}
