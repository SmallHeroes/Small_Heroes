import { readFileSync } from 'fs';
import path from 'path';

export const VOICE_REVIEWER_VERSION = 'voice-reviewer-v1';
export const VOICE_REVIEWER_PROMPT_VERSION = '2026-05-24';

const STANDARD_PATH = path.join(
  process.cwd(),
  'lib/story-generator/STORYBOOK_VOICE_STANDARD.md'
);

export function isVoiceReviewerBlockingEnabled(): boolean {
  return process.env.VOICE_REVIEWER_BLOCKING === 'on';
}

/** e.g. "2026-05-24-rev3" from the Standard header Date line. */
export function loadStorybookVoiceStandardVersion(): string {
  const md = readFileSync(STANDARD_PATH, 'utf8');
  const dateLine = md.match(/\*\*Date:\*\*\s*(.+)/);
  if (!dateLine) return 'unknown';
  const raw = dateLine[1].trim();
  const rev = raw.match(/rev\s*(\d+)/i);
  const date = raw.match(/(\d{4}-\d{2}-\d{2})/);
  if (date && rev) return `${date[1]}-rev${rev[1]}`;
  if (date) return date[1];
  return raw.slice(0, 40);
}

export function buildVoiceReviewMeta(modelName: string) {
  return {
    reviewerVersion: VOICE_REVIEWER_VERSION,
    promptVersion: VOICE_REVIEWER_PROMPT_VERSION,
    modelName,
    standardVersion: loadStorybookVoiceStandardVersion(),
    createdAt: new Date().toISOString(),
  };
}
