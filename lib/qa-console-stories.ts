import { readdir } from 'fs/promises';
import path from 'path';
import { STORY_BANK_V3_DIR_NAME } from '@/backend/providers/story-bank-index';

export type QaStoryBankEntry = {
  storyKey: string;
  storyFile: string;
  companionId: string;
  direction: 'bedtime' | 'adventure' | 'fantasy';
  label: string;
};

const DIRECTION_SUFFIX = /_(bedtime|adventure|fantasy)\.md$/i;

export function storyBankRoot(): string {
  return path.join(process.cwd(), 'story-bank', STORY_BANK_V3_DIR_NAME);
}

export function parseStoryFileName(filename: string): Omit<QaStoryBankEntry, 'storyFile' | 'label'> | null {
  const match = filename.match(DIRECTION_SUFFIX);
  if (!match) return null;
  const direction = match[1].toLowerCase() as QaStoryBankEntry['direction'];
  const companionId = filename.replace(DIRECTION_SUFFIX, '');
  if (!companionId || !/^[a-z0-9_]+$/i.test(companionId)) return null;
  return {
    storyKey: `${companionId}_${direction}`,
    companionId,
    direction,
  };
}

export function storyFileForKey(storyKey: string): string {
  if (!/^[a-z0-9_]+_(bedtime|adventure|fantasy)$/i.test(storyKey)) {
    throw new Error('Invalid story key');
  }
  return `${storyKey}.md`;
}

export async function listQaStoryBankEntries(): Promise<QaStoryBankEntry[]> {
  const root = storyBankRoot();
  const names = await readdir(root);
  const entries: QaStoryBankEntry[] = [];
  for (const name of names.sort()) {
    if (!name.endsWith('.md') || name.startsWith('_')) continue;
    const parsed = parseStoryFileName(name);
    if (!parsed) continue;
    entries.push({
      ...parsed,
      storyFile: name,
      label: `${parsed.companionId} · ${parsed.direction}`,
    });
  }
  return entries;
}
