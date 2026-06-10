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
};

export function loadGoldenStoryMarkdown(sourceId: string): string {
  const file = GOLDEN_FILES[sourceId];
  if (!file) {
    throw new Error(`Unknown golden source: ${sourceId}`);
  }
  const filePath = path.join(STORY_BANK_DIR, file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Golden file not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}
