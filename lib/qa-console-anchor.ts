import { createHash } from 'crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import type { Order } from '@prisma/client';
import {
  generateStage0MethodBAnchor,
} from '@/lib/generation-pipeline/stage0-method-b';
import {
  resolveStyle01StoryWardrobeLock,
  storyFileKeyFromPath,
} from '@/lib/style01-story-wardrobe';

export const QA_ANCHOR_ROOT = path.join(process.cwd(), 'outputs', 'qa-anchors');

export type QaAnchorCacheEntry = {
  cacheKey: string;
  storyFileKey: string;
  companionId: string;
  wardrobeLockHash: string;
  childPhotoFingerprint: string;
  anchorUrl: string;
  localPath: string;
  approved: boolean;
  resemblanceScore: number;
  generatedAt: string;
  anchorPrompt?: string;
};

export class QaAnchorReviewRequiredError extends Error {
  readonly review: {
    cacheKey: string;
    previewUrl: string;
    resemblanceScore: number;
    storyFileKey: string;
    companionId: string;
  };

  constructor(review: QaAnchorReviewRequiredError['review']) {
    super(
      `ANCHOR_REVIEW_REQUIRED: Stage 0 child anchor awaits approval (key=${review.cacheKey}, score=${review.resemblanceScore.toFixed(3)}). Approve in /dev/creator before page render.`
    );
    this.name = 'QaAnchorReviewRequiredError';
    this.review = review;
  }
}

export function qaAnchorRequiresStage0(companionId: string, storyFileKey: string): boolean {
  return Boolean(resolveStyle01StoryWardrobeLock(companionId, storyFileKey));
}

export function allowRawPhotoRefForWardrobeStory(): boolean {
  return process.env.ALLOW_RAW_PHOTO_REF_FOR_WARDROBE_STORY === 'true';
}

export function childPhotoFingerprint(input: {
  photoPath?: string;
  photoDataUrl?: string;
}): string {
  if (input.photoPath?.trim() && existsSync(input.photoPath.trim())) {
    const buf = readFileSync(input.photoPath.trim());
    return createHash('sha256').update(buf).digest('hex').slice(0, 16);
  }
  const dataUrl = input.photoDataUrl?.trim();
  if (dataUrl) {
    return createHash('sha256').update(dataUrl).digest('hex').slice(0, 16);
  }
  throw new Error('QA Stage 0 anchor requires a child photo');
}

export function buildQaAnchorCacheKey(input: {
  photoFingerprint: string;
  storyFileKey: string;
  wardrobeLock: string;
}): string {
  const wardrobeHash = createHash('sha256').update(input.wardrobeLock).digest('hex').slice(0, 8);
  return `${input.storyFileKey}__${input.photoFingerprint}__${wardrobeHash}`;
}

export function qaAnchorMetaPath(cacheKey: string): string {
  return path.join(QA_ANCHOR_ROOT, cacheKey, 'anchor.json');
}

export function qaAnchorLocalPngPath(cacheKey: string): string {
  return path.join(QA_ANCHOR_ROOT, cacheKey, 'anchor.png');
}

export function loadQaAnchorCache(cacheKey: string): QaAnchorCacheEntry | null {
  const metaPath = qaAnchorMetaPath(cacheKey);
  if (!existsSync(metaPath)) return null;
  try {
    return JSON.parse(readFileSync(metaPath, 'utf-8')) as QaAnchorCacheEntry;
  } catch {
    return null;
  }
}

export function saveQaAnchorCache(entry: QaAnchorCacheEntry): void {
  const dir = path.join(QA_ANCHOR_ROOT, entry.cacheKey);
  mkdirSync(dir, { recursive: true });
  writeFileSync(qaAnchorMetaPath(entry.cacheKey), JSON.stringify(entry, null, 2));
}

export function approveQaAnchorCache(cacheKey: string): QaAnchorCacheEntry {
  const entry = loadQaAnchorCache(cacheKey);
  if (!entry) {
    throw new Error(`No QA anchor cache for key ${cacheKey}`);
  }
  if (!existsSync(entry.localPath)) {
    throw new Error(`QA anchor PNG missing at ${entry.localPath}`);
  }
  entry.approved = true;
  saveQaAnchorCache(entry);
  return entry;
}

export function qaAnchorPreviewUrl(cacheKey: string): string {
  return `/api/dev/qa-console/anchor?key=${encodeURIComponent(cacheKey)}`;
}

async function persistAnchorLocally(anchorUrl: string, localPath: string): Promise<void> {
  mkdirSync(path.dirname(localPath), { recursive: true });
  if (existsSync(anchorUrl)) {
    copyFileSync(anchorUrl, localPath);
    return;
  }
  if (anchorUrl.startsWith('data:')) {
    const b64 = anchorUrl.replace(/^data:image\/\w+;base64,/, '');
    writeFileSync(localPath, Buffer.from(b64, 'base64'));
    return;
  }
  const res = await fetch(anchorUrl);
  if (!res.ok) {
    throw new Error(`Failed to download Stage 0 anchor (${res.status})`);
  }
  writeFileSync(localPath, Buffer.from(await res.arrayBuffer()));
}

function buildFakeOrder(input: {
  cacheKey: string;
  child: { name: string; gender: 'boy' | 'girl'; age: number };
}): Pick<Order, 'id' | 'childGender' | 'childAge' | 'childName' | 'illustrationStyle'> {
  return {
    id: `qa-anchor-${input.cacheKey.slice(0, 20)}`,
    childGender: input.child.gender,
    childAge: input.child.age,
    childName: input.child.name,
    illustrationStyle: 'soft_hand_drawn_storybook' as Order['illustrationStyle'],
  };
}

export async function generateQaStage0AnchorCandidate(input: {
  companionId: string;
  storyFileKey: string;
  child: { name: string; gender: 'boy' | 'girl'; age: number };
  childPhotoUrl: string;
  lockedChildDescription: string;
  childPhotoDescription?: string | null;
  photoFingerprint: string;
}): Promise<QaAnchorCacheEntry> {
  const wardrobeLock = resolveStyle01StoryWardrobeLock(input.companionId, input.storyFileKey);
  if (!wardrobeLock) {
    throw new Error(`No wardrobe lock for ${input.companionId}/${input.storyFileKey}`);
  }

  const cacheKey = buildQaAnchorCacheKey({
    photoFingerprint: input.photoFingerprint,
    storyFileKey: input.storyFileKey,
    wardrobeLock,
  });
  const localPath = qaAnchorLocalPngPath(cacheKey);

  const fakeOrder = buildFakeOrder({ cacheKey, child: input.child });
  const result = await generateStage0MethodBAnchor({
    order: fakeOrder as Order,
    childPhotoUrl: input.childPhotoUrl,
    lockedChildDescription: input.lockedChildDescription,
    wardrobeLock,
    childPhotoDescription: input.childPhotoDescription,
    attemptSuffix: 'qa',
  });

  await persistAnchorLocally(result.anchorUrl, localPath);

  const entry: QaAnchorCacheEntry = {
    cacheKey,
    storyFileKey: input.storyFileKey,
    companionId: input.companionId,
    wardrobeLockHash: createHash('sha256').update(wardrobeLock).digest('hex').slice(0, 8),
    childPhotoFingerprint: input.photoFingerprint,
    anchorUrl: result.anchorUrl,
    localPath,
    approved: false,
    resemblanceScore: result.resemblanceScore,
    generatedAt: new Date().toISOString(),
    anchorPrompt: result.anchorPrompt,
  };
  saveQaAnchorCache(entry);
  writeFileSync(
    path.join(QA_ANCHOR_ROOT, cacheKey, 'anchor-prompt.txt'),
    result.anchorPrompt,
    'utf-8'
  );
  return entry;
}

export async function resolveQaConsoleChildReference(input: {
  companionId: string;
  storyFileKey: string;
  child: { name: string; gender: 'boy' | 'girl'; age: number };
  childPhotoUrl: string;
  photoPath?: string;
  photoDataUrl?: string;
  lockedChildDescription: string;
  childPhotoDescription?: string | null;
  approveAnchorCacheKey?: string | null;
  forceRegenerateAnchor?: boolean;
}): Promise<{ childRefUrl: string; anchorCacheKey?: string; usedApprovedAnchor: boolean }> {
  const storyKey = storyFileKeyFromPath(input.storyFileKey) ?? input.storyFileKey;
  const requiresAnchor = qaAnchorRequiresStage0(input.companionId, storyKey);

  if (!requiresAnchor) {
    return { childRefUrl: input.childPhotoUrl, usedApprovedAnchor: false };
  }

  if (!input.childPhotoUrl?.trim()) {
    throw new Error(
      'WARDROBE_LOCKED_STORY_REQUIRES_PHOTO: upload a child photo so Stage 0 can build a pajama anchor.'
    );
  }

  if (allowRawPhotoRefForWardrobeStory()) {
    console.warn(
      '[qa-console] ALLOW_RAW_PHOTO_REF_FOR_WARDROBE_STORY=true — using raw photo (wardrobe leak risk)'
    );
    return { childRefUrl: input.childPhotoUrl, usedApprovedAnchor: false };
  }

  const photoFp = childPhotoFingerprint({
    photoPath: input.photoPath,
    photoDataUrl: input.photoDataUrl,
  });
  const wardrobeLock = resolveStyle01StoryWardrobeLock(input.companionId, storyKey)!;
  const cacheKey = buildQaAnchorCacheKey({
    photoFingerprint: photoFp,
    storyFileKey: storyKey,
    wardrobeLock,
  });

  if (input.approveAnchorCacheKey?.trim()) {
    const approved = approveQaAnchorCache(input.approveAnchorCacheKey.trim());
    if (approved.cacheKey !== cacheKey) {
      throw new Error(
        `Anchor cache key mismatch: approved ${approved.cacheKey} but current run expects ${cacheKey}`
      );
    }
    return {
      childRefUrl: approved.anchorUrl,
      anchorCacheKey: approved.cacheKey,
      usedApprovedAnchor: true,
    };
  }

  let cached = input.forceRegenerateAnchor ? null : loadQaAnchorCache(cacheKey);
  if (!cached || input.forceRegenerateAnchor) {
    cached = await generateQaStage0AnchorCandidate({
      companionId: input.companionId,
      storyFileKey: storyKey,
      child: input.child,
      childPhotoUrl: input.childPhotoUrl,
      lockedChildDescription: input.lockedChildDescription,
      childPhotoDescription: input.childPhotoDescription,
      photoFingerprint: photoFp,
    });
  }

  if (cached.approved) {
    return {
      childRefUrl: cached.anchorUrl,
      anchorCacheKey: cached.cacheKey,
      usedApprovedAnchor: true,
    };
  }

  throw new QaAnchorReviewRequiredError({
    cacheKey: cached.cacheKey,
    previewUrl: qaAnchorPreviewUrl(cached.cacheKey),
    resemblanceScore: cached.resemblanceScore,
    storyFileKey: storyKey,
    companionId: input.companionId,
  });
}
