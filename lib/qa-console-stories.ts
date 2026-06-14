import { readdir } from 'fs/promises';
import path from 'path';
import {
  MVP_STORY_MATRIX,
  type SlotStatus,
} from '@/backend/config/mvp-story-matrix';
import { STORY_BANK_V3_DIR_NAME, V3_APPROVED_DIR_NAME } from '@/backend/providers/story-bank-index';
import { getCompanionById } from '@/lib/companions';

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

export type CreatorStoryBankEntry = QaStoryBankEntry & {
  matrixStatus: SlotStatus;
};

const MVP_COMPANION_IDS: Set<string> = new Set(
  Object.values(MVP_STORY_MATRIX).map((slot) => slot.companionId)
);

const DIRECTION_LABEL_HE: Record<QaStoryBankEntry['direction'], string> = {
  bedtime: 'לילה טוב',
  adventure: 'הרפתקה',
  fantasy: 'פנטזיה',
};

const MATRIX_STATUS_SORT: Record<SlotStatus, number> = {
  approved: 0,
  approved_v3: 1,
  in_gate: 2,
  missing: 3,
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

function lookupMatrixStatus(
  companionId: string,
  direction: QaStoryBankEntry['direction']
): SlotStatus | null {
  for (const slot of Object.values(MVP_STORY_MATRIX)) {
    if (slot.companionId === companionId) {
      return slot.directions[direction];
    }
  }
  return null;
}

function matrixStatusLabelHe(status: SlotStatus): string {
  switch (status) {
    case 'approved':
    case 'approved_v3':
      return 'נמכר';
    case 'in_gate':
    case 'missing':
      return 'בבדיקה';
  }
}

function creatorStoryLabel(
  companionId: string,
  direction: QaStoryBankEntry['direction'],
  matrixStatus: SlotStatus
): string {
  const companion = getCompanionById(companionId);
  const name = companion?.name ?? companionId;
  return `${name} · ${DIRECTION_LABEL_HE[direction]} · ${matrixStatusLabelHe(matrixStatus)}`;
}

/** MVP-matrix goldens only — human companion labels + configured slot status (creator UI). */
export async function listCreatorStoryBankEntries(): Promise<CreatorStoryBankEntry[]> {
  const all = await listQaStoryBankEntries();
  const filtered: CreatorStoryBankEntry[] = [];

  for (const entry of all) {
    if (!MVP_COMPANION_IDS.has(entry.companionId)) continue;
    const matrixStatus = lookupMatrixStatus(entry.companionId, entry.direction);
    if (!matrixStatus) continue;

    filtered.push({
      ...entry,
      matrixStatus,
      label: creatorStoryLabel(entry.companionId, entry.direction, matrixStatus),
    });
  }

  filtered.sort((a, b) => {
    const byStatus = MATRIX_STATUS_SORT[a.matrixStatus] - MATRIX_STATUS_SORT[b.matrixStatus];
    if (byStatus !== 0) return byStatus;
    return a.label.localeCompare(b.label, 'he');
  });

  return filtered;
}
