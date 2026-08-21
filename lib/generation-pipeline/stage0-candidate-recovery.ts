import type { Order } from '@prisma/client';
import type { PipelineCache } from './types';
import type { CharacterAnchorEntry } from './character-anchor-store';
import { upsertCharacterAnchor } from './character-anchor-store';
import { resolveResemblanceThresholdConfig, resolveEffectiveThreshold } from '@/lib/resemblance-core';

export type Stage0CandidateRow = NonNullable<PipelineCache['stage0AnchorCandidates']>[number];

export function stage0CandidateIsRecoverable(row: Stage0CandidateRow): boolean {
  if (row.identityMode !== 'description_template') return true;
  return row.passed === true && row.semanticPass === true && row.stylePass === true;
}

export function generatedStoryAnchorHasRecoverableCandidate(
  cache: PipelineCache,
  anchorUrl: string
): boolean {
  return (cache.stage0AnchorCandidates ?? []).some(
    (row) =>
      row.url === anchorUrl &&
      row.identityMode === 'description_template' &&
      stage0CandidateIsRecoverable(row)
  );
}

export function pickStage0Candidate(
  cache: PipelineCache,
  attempt?: number
): Stage0CandidateRow | null {
  const rows = cache.stage0AnchorCandidates ?? [];
  if (!rows.length) return null;
  if (attempt != null) {
    const selected = rows.find((r) => r.attempt === attempt) ?? null;
    return selected && stage0CandidateIsRecoverable(selected) ? selected : null;
  }
  return rows.filter(stage0CandidateIsRecoverable).sort(
    (a, b) => (b.resemblanceScore ?? 0) - (a.resemblanceScore ?? 0)
  )[0] ?? null;
}

/** Recover pending_review child anchor from a prior Stage 0 run (no image regen). */
export function attachPendingChildAnchorFromCandidate(
  order: Order,
  cache: PipelineCache,
  row: Stage0CandidateRow
): PipelineCache {
  if (!stage0CandidateIsRecoverable(row)) return cache;
  const thresholdConfig = resolveResemblanceThresholdConfig();
  const effectiveThreshold = resolveEffectiveThreshold(order.illustrationStyle, thresholdConfig);
  const lockedChildDescription = cache.lockedChildDescription ?? cache.dna?.childDNA ?? '';
  const generatedFromDescription = row.identityMode === 'description_template';

  const entry: CharacterAnchorEntry = {
    orderId: order.id,
    styleId: order.illustrationStyle,
    characterId: 'child',
    role: 'child',
    anchorType: 'canonical_portrait',
    source: generatedFromDescription ? 'generated_story_anchor' : 'uploaded_photo',
    url: row.url,
    provider: 'openai',
    model: row.model ?? 'gpt-image-2',
    quality: process.env.GPT_IMAGE_QUALITY?.trim() || 'low',
    promptUsed: cache.stage0AnchorPrompt,
    inputDescriptionUsed: lockedChildDescription,
    referenceOrderUsed: undefined,
    qaStatus: 'pending_review',
    anchorQuality: process.env.GPT_IMAGE_QUALITY?.trim() || 'low',
    resemblanceScore: generatedFromDescription ? undefined : row.resemblanceScore,
    thresholdUsed: generatedFromDescription ? undefined : effectiveThreshold,
    qaNotes: generatedFromDescription
      ? `Recovered passed description-template Stage 0 candidate attempt ${row.attempt}; no photo-likeness claim`
      : `Recovered from stage0 candidate attempt ${row.attempt}`,
    createdAt: row.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return {
    ...cache,
    stage0SelectedAttempt: row.attempt,
    characterAnchorStore: upsertCharacterAnchor(cache, entry).characterAnchorStore,
  };
}
