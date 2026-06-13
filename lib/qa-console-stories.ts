import { readdir } from 'fs/promises';
import path from 'path';
import { STORY_BANK_V3_DIR_NAME, V3_APPROVED_DIR_NAME } from '@/backend/providers/story-bank-index';

export type QaStoryBankSource = 'v5' | 'v3-approved';

export type QaStoryBankEntry = {
  storyKey: string;
  storyFile: string;
  companionId: string;
  direction: 'bedtime' | 'adventure' | 'fantasy';
  label: string;
  /** When set, dev routes load from story-bank/v3-approved/ instead of the default v5 dir. */
  bankDir?: 'v3-approved';
  source: QaStoryBankSource;
};

const DIRECTION_SUFFIX = /_(bedtime|adventure|fantasy)\.md$/i;
const STORY_KEY_SUFFIX = /@v3-approved$/;

export function storyBankRoot(): string {
  return path.join(process.cwd(), 'story-bank', STORY_BANK_V3_DIR_NAME);
}

export function parseStoryKey(storyKey: string): { baseKey: string; bankDir: 'v3-approved' | null } {
  const trimmed = String(storyKey ?? '').trim();
  if (STORY_KEY_SUFFIX.test(trimmed)) {
    return { baseKey: trimmed.replace(STORY_KEY_SUFFIX, ''), bankDir: 'v3-approved' };
  }
  return { baseKey: trimmed, bankDir: null };
}

export function parseStoryFileName(filename: string): Omit<QaStoryBankEntry, 'storyFile' | 'label' | 'bankDir' | 'source' | 'storyKey'> | null {
  const match = filename.match(DIRECTION_SUFFIX);
  if (!match) return null;
  const direction = match[1].toLowerCase() as QaStoryBankEntry['direction'];
  const companionId = filename.replace(DIRECTION_SUFFIX, '');
  if (!companionId || !/^[a-z0-9_]+$/i.test(companionId)) return null;
  return {
    companionId,
    direction,
  };
}

export function storyFileForKey(storyKey: string): string {
  const { baseKey } = parseStoryKey(storyKey);
  if (!/^[a-z0-9_]+_(bedtime|adventure|fantasy)$/i.test(baseKey)) {
    throw new Error('Invalid story key');
  }
  return `${baseKey}.md`;
}

export function storyPathForKey(storyKey: string): string {
  const { bankDir } = parseStoryKey(storyKey);
  const storyFile = storyFileForKey(storyKey);
  if (bankDir === 'v3-approved') {
    return path.join(process.cwd(), 'story-bank', V3_APPROVED_DIR_NAME, storyFile);
  }
  return path.join(storyBankRoot(), storyFile);
}

async function listStoriesInDir(
  dirName: string,
  source: QaStoryBankSource,
  keySuffix: string,
  labelSuffix: string,
  bankDir?: 'v3-approved'
): Promise<QaStoryBankEntry[]> {
  const root = path.join(process.cwd(), 'story-bank', dirName);
  let names: string[];
  try {
    names = await readdir(root);
  } catch {
    return [];
  }
  const entries: QaStoryBankEntry[] = [];
  for (const name of names.sort()) {
    if (!name.endsWith('.md') || name.startsWith('_')) continue;
    const parsed = parseStoryFileName(name);
    if (!parsed) continue;
    const baseKey = `${parsed.companionId}_${parsed.direction}`;
    entries.push({
      ...parsed,
      storyKey: `${baseKey}${keySuffix}`,
      storyFile: name,
      label: `${parsed.companionId} · ${parsed.direction} · ${labelSuffix}`,
      bankDir,
      source,
    });
  }
  return entries;
}

/** All QA stories: v5-fixed-v2 (default) + v3-approved owner slots, labeled by source. */
export async function listQaStoryBankEntries(): Promise<QaStoryBankEntry[]> {
  const v5 = await listStoriesInDir(STORY_BANK_V3_DIR_NAME, 'v5', '', STORY_BANK_V3_DIR_NAME);
  const approved = await listStoriesInDir(
    V3_APPROVED_DIR_NAME,
    'v3-approved',
    '@v3-approved',
    'v3-approved',
    'v3-approved'
  );
  return [...approved, ...v5];
}
