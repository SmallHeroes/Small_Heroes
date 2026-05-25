import { readFileSync } from 'fs';
import path from 'path';

const STANDARD_PATH = path.join(
  process.cwd(),
  'lib/story-generator/STORYBOOK_VOICE_STANDARD.md'
);

let cachedStandard: string | null = null;

function loadFullStandard(): string {
  if (!cachedStandard) {
    cachedStandard = readFileSync(STANDARD_PATH, 'utf8');
  }
  return cachedStandard;
}

/**
 * Sections 2–5: principles, BAD/GOOD library, forbidden-pattern ref, read-aloud rules.
 * Single source of truth — read from disk, not duplicated in code.
 */
export function loadStorybookVoiceStandardHe(): string {
  const md = loadFullStandard();
  const start = md.indexOf('## 2. Core principles');
  const end = md.indexOf('## 6. Age Voice Profiles');
  if (start === -1 || end === -1) {
    throw new Error(
      'STORYBOOK_VOICE_STANDARD.md: expected ## 2 and ## 6 section headers'
    );
  }
  return md.slice(start, end).trim();
}

const AGE_PROFILE_MARKERS: Record<string, string> = {
  '3-4': '**Ages 3-4:**',
  '5-6': '**Ages 5-6:**',
  '7-8': '**Ages 7-8:**',
};

/**
 * Age Voice Profile block from section 6 for the given tier label (e.g. "5-6").
 */
export function loadAgeVoiceProfile(ageTier: string): string {
  const md = loadFullStandard();
  const sectionStart = md.indexOf('## 6. Age Voice Profiles');
  if (sectionStart === -1) {
    throw new Error('STORYBOOK_VOICE_STANDARD.md: missing ## 6. Age Voice Profiles');
  }
  const section = md.slice(sectionStart);

  const marker = AGE_PROFILE_MARKERS[ageTier];
  if (!marker) {
    return [
      `Age tier "${ageTier}" has no dedicated profile block yet.`,
      'Use the general principles and Families A–J; flag age_mismatch only when clearly wrong for the tier.',
    ].join('\n');
  }

  const idx = section.indexOf(marker);
  if (idx === -1) {
    throw new Error(`STORYBOOK_VOICE_STANDARD.md: missing age marker ${marker}`);
  }

  const after = section.slice(idx);
  const nextBold = after.indexOf('**Ages ', marker.length);
  const block =
    nextBold === -1
      ? after
      : after.slice(0, nextBold);

  if (ageTier === '5-6') {
    return `${block.trim()}\n\n(Families A–J in the Voice Standard are calibrated to ages 5–6.)`;
  }
  return block.trim();
}
