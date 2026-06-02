import type { PipelineCache } from './types';

export type CharacterAnchorRole = 'child' | 'companion' | 'creature' | 'family_member';
export type CharacterAnchorType = 'canonical_portrait' | 'character_sheet' | 'predefined_sheet';
export type CharacterAnchorSource = 'uploaded_photo' | 'companion_sheet' | 'generated_story_anchor' | 'static_asset';
export type CharacterAnchorQaStatus = 'pending' | 'pending_review' | 'passed' | 'failed';

export type CharacterAnchorEntry = {
  orderId: string;
  styleId: string;
  characterId: string;
  role: CharacterAnchorRole;
  anchorType: CharacterAnchorType;
  source: CharacterAnchorSource;
  url: string;
  provider?: string;
  model?: string;
  quality?: string;
  promptUsed?: string;
  inputDescriptionUsed?: string;
  referenceOrderUsed?: string[];
  qaStatus?: CharacterAnchorQaStatus;
  anchorQuality?: string;
  resemblanceScore?: number;
  thresholdUsed?: number;
  qaNotes?: string;
  createdAt: string;
  updatedAt: string;
};

export function getCharacterAnchorStore(cache: PipelineCache | null | undefined): Record<string, CharacterAnchorEntry> {
  return (cache?.characterAnchorStore ?? {}) as Record<string, CharacterAnchorEntry>;
}

export function upsertCharacterAnchor(
  cache: PipelineCache,
  anchor: CharacterAnchorEntry
): PipelineCache {
  const store = getCharacterAnchorStore(cache);
  return {
    ...cache,
    characterAnchorStore: {
      ...store,
      [anchor.characterId]: anchor,
    },
  };
}

export function getChildCanonicalAnchor(cache: PipelineCache | null | undefined): CharacterAnchorEntry | null {
  const store = getCharacterAnchorStore(cache);
  const child = store.child;
  if (!child?.url) return null;
  if (child.anchorType !== 'canonical_portrait') return null;
  return child;
}

/** Canonical child anchor approved for paid page generation (passed QA + human review). */
export function getApprovedChildCanonicalAnchor(
  cache: PipelineCache | null | undefined
): CharacterAnchorEntry | null {
  const child = getChildCanonicalAnchor(cache);
  if (!child) return null;
  if (child.qaStatus !== 'passed') return null;
  return child;
}

export {
  isChildExpressionSheetApproved,
  isChildExpressionSheetActive,
  resolveApprovedExpressionAnchorUrl,
} from './child-expression-sheet';

