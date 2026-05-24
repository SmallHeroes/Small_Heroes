import { z } from 'zod';
import { isVoiceReviewerBlockingEnabled } from './voice-reviewer-meta';

export const VoiceFamily = z.enum([
  'therapeutic_abstract',
  'body_as_character',
  'ai_poetic',
  'emotion_explained',
  'motif_overuse',
  'semantic_misuse',
  'read_aloud_stumble',
  'mechanism_over_relationship',
  'name_overuse',
  'parallel_action_chains',
  'age_mismatch',
]);

/** Exactly what the LLM returns. */
export const VoiceFindingLLM = z.object({
  page: z.number().int().nullable(),
  scope: z.enum(['page', 'story']),
  axis: z.enum(['voice', 'ai-smell', 'read-aloud', 'relationship', 'age-fit']),
  family: VoiceFamily,
  severity: z.enum(['blocking', 'warning', 'diagnostic']),
  quote: z.string().optional(),
  reason: z.string(),
  confidence: z.number().min(0).max(1),
});

export const VoiceReviewMeta = z.object({
  reviewerVersion: z.string(),
  promptVersion: z.string(),
  modelName: z.string(),
  standardVersion: z.string(),
  createdAt: z.string(),
});

/** Final finding = LLM output, normalized, + code-derived reroll fields. */
export const VoiceFinding = VoiceFindingLLM.extend({
  rerollEligibleCandidate: z.boolean(),
  rerollEligibleActive: z.boolean(),
});

export const VoiceReviewReport = z.object({
  meta: VoiceReviewMeta,
  storyId: z.string(),
  language: z.literal('he'),
  ageTier: z.string(),
  findings: z.array(VoiceFinding),
});

export type VoiceFamilyId = z.infer<typeof VoiceFamily>;
export type VoiceFindingLLMType = z.infer<typeof VoiceFindingLLM>;
export type VoiceFindingType = z.infer<typeof VoiceFinding>;
export type VoiceReviewReportType = z.infer<typeof VoiceReviewReport>;

export function deriveRerollEligibleCandidate(finding: VoiceFindingLLMType): boolean {
  return finding.scope === 'page' && finding.severity !== 'diagnostic';
}

export function deriveRerollEligibleActive(finding: VoiceFindingLLMType): boolean {
  return (
    isVoiceReviewerBlockingEnabled() &&
    finding.scope === 'page' &&
    finding.severity === 'blocking' &&
    finding.confidence >= 0.75
  );
}

/**
 * Normalize story-scope severity; derive reroll fields (never from LLM).
 * Returns null to drop a finding (e.g. page-scope without quote).
 */
export function processVoiceFinding(raw: VoiceFindingLLMType): VoiceFindingType | null {
  const finding: VoiceFindingLLMType = { ...raw };

  // motif_overuse is always story-scope (never a single-page category error).
  if (finding.family === 'motif_overuse') {
    finding.scope = 'story';
    finding.page = null;
    delete finding.quote;
  }

  if (finding.scope === 'story') {
    if (finding.page != null) {
      finding.page = null;
    }
    if (finding.severity !== 'diagnostic') {
      console.warn(
        `[voice-reviewer] story finding had severity=${finding.severity} — normalized to diagnostic`
      );
      finding.severity = 'diagnostic';
    }
  }

  if (finding.scope === 'page') {
    if (finding.page == null || finding.page < 1) {
      console.warn('[voice-reviewer] dropping page finding with invalid page number');
      return null;
    }
    if (!finding.quote?.trim()) {
      console.warn('[voice-reviewer] dropping page finding without quote');
      return null;
    }
  }

  return {
    ...finding,
    rerollEligibleCandidate: deriveRerollEligibleCandidate(finding),
    rerollEligibleActive: deriveRerollEligibleActive(finding),
  };
}
