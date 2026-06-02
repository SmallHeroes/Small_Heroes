import type { Order } from '@prisma/client';
import type { PipelineCache } from './types';
import type { CharacterAnchorEntry } from './character-anchor-store';
import { upsertCharacterAnchor } from './character-anchor-store';
import { resolveResemblanceThresholdConfig, resolveEffectiveThreshold } from '@/lib/resemblance-core';

export type Stage0CandidateRow = NonNullable<PipelineCache['stage0AnchorCandidates']>[number];

export function pickStage0Candidate(
  cache: PipelineCache,
  attempt?: number
): Stage0CandidateRow | null {
  const rows = cache.stage0AnchorCandidates ?? [];
  if (!rows.length) return null;
  if (attempt != null) {
    return rows.find((r) => r.attempt === attempt) ?? null;
  }
  return [...rows].sort(
    (a, b) => (b.resemblanceScore ?? 0) - (a.resemblanceScore ?? 0)
  )[0];
}

/** Recover pending_review child anchor from a prior Stage 0 run (no image regen). */
export function attachPendingChildAnchorFromCandidate(
  order: Order,
  cache: PipelineCache,
  row: Stage0CandidateRow
): PipelineCache {
  const thresholdConfig = resolveResemblanceThresholdConfig();
  const effectiveThreshold = resolveEffectiveThreshold(order.illustrationStyle, thresholdConfig);
  const lockedChildDescription = cache.lockedChildDescription ?? cache.dna?.childDNA ?? '';

  const entry: CharacterAnchorEntry = {
    orderId: order.id,
    styleId: order.illustrationStyle,
    characterId: 'child',
    role: 'child',
    anchorType: 'canonical_portrait',
    source: 'uploaded_photo',
    url: row.url,
    provider: 'openai',
    model: row.model ?? 'gpt-image-2',
    quality: process.env.GPT_IMAGE_QUALITY?.trim() || 'low',
    promptUsed: cache.stage0AnchorPrompt,
    inputDescriptionUsed: lockedChildDescription,
    referenceOrderUsed: undefined,
    qaStatus: 'pending_review',
    anchorQuality: process.env.GPT_IMAGE_QUALITY?.trim() || 'low',
    resemblanceScore: row.resemblanceScore,
    thresholdUsed: effectiveThreshold,
    qaNotes: `Recovered from stage0 candidate attempt ${row.attempt}`,
    createdAt: row.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return {
    ...cache,
    stage0SelectedAttempt: row.attempt,
    characterAnchorStore: upsertCharacterAnchor(cache, entry).characterAnchorStore,
  };
}
