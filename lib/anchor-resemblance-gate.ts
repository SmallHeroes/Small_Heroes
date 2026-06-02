import type { Order } from '@prisma/client';
import type { PipelineCache } from '@/lib/generation-pipeline/types';
import { getCharacterAnchorStore } from '@/lib/generation-pipeline/character-anchor-store';

/**
 * Anchor-only embedding gate — decoupled from per-page RESEMBLANCE_BASE_THRESHOLD (0.70).
 *
 * Long-term improvement (not implemented): score anchor candidates against a stylized
 * reference (e.g. approved watercolor sketch) instead of the raw photo embedding.
 */
export type AnchorEmbeddingVerdict = 'hard_fail' | 'soft_ok';

export type AnchorSemanticQaResult = {
  ok: boolean;
  genderMismatch: boolean;
  missingHairTraits: string[];
  faceDetectConfidence: number;
  faceDetectOk: boolean;
};

export type AnchorGateConfig = {
  /** Scores below this are clearly wrong identity (hard fail). */
  embeddingHardFailBelow: number;
  /** Informational only — page gate still uses ~0.70; anchor does not auto-pass here. */
  embeddingStrongAt: number;
  minFaceDetectConfidence: number;
};

export type AnchorEmbeddingEvaluation = {
  verdict: AnchorEmbeddingVerdict;
  resemblanceScore: number;
  hardFail: boolean;
  needsHumanApproval: boolean;
};

function parseNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

export function resolveAnchorGateConfig(): AnchorGateConfig {
  return {
    embeddingHardFailBelow: parseNumberEnv('ANCHOR_EMBEDDING_HARD_FAIL_BELOW', 0.2),
    embeddingStrongAt: parseNumberEnv('ANCHOR_EMBEDDING_STRONG_AT', 0.7),
    minFaceDetectConfidence: parseNumberEnv('ANCHOR_MIN_FACE_DETECT', 0.35),
  };
}

export function evaluateAnchorEmbeddingScore(
  resemblanceScore: number,
  config: AnchorGateConfig = resolveAnchorGateConfig()
): AnchorEmbeddingEvaluation {
  const hardFail = resemblanceScore < config.embeddingHardFailBelow;
  return {
    verdict: hardFail ? 'hard_fail' : 'soft_ok',
    resemblanceScore,
    hardFail,
    /** Mid band and strong band both require explicit human approval for anchors. */
    needsHumanApproval: !hardFail,
  };
}

export function evaluateAnchorSemanticQa(params: {
  childGender: string | null | undefined;
  childPhotoDescription: string | null | undefined;
  childStructuredHair?: string | null;
  anchorVisionDescription: string | null | undefined;
  faceDetectConfidence: number;
  config?: AnchorGateConfig;
}): AnchorSemanticQaResult {
  const config = params.config ?? resolveAnchorGateConfig();
  const refDesc = `${params.childPhotoDescription ?? ''} ${params.childStructuredHair ?? ''}`.toLowerCase();
  const anchorDesc = (params.anchorVisionDescription ?? '').toLowerCase();
  const genderMismatch =
    params.childGender === 'girl'
      ? ['boy', 'male', 'young boy'].some((term) => anchorDesc.includes(term))
      : params.childGender === 'boy'
        ? ['girl', 'female', 'young girl'].some((term) => anchorDesc.includes(term))
        : false;
  const hairTraits = ['curly', 'wavy', 'straight', 'long', 'short', 'brown', 'blonde', 'black', 'red'].filter(
    (trait) => refDesc.includes(trait)
  );
  const missingHairTraits = hairTraits.filter((trait) => !anchorDesc.includes(trait));
  const faceDetectOk = params.faceDetectConfidence >= config.minFaceDetectConfidence;
  const ok = !genderMismatch && missingHairTraits.length === 0 && faceDetectOk;
  return {
    ok,
    genderMismatch,
    missingHairTraits,
    faceDetectConfidence: params.faceDetectConfidence,
    faceDetectOk,
  };
}

/** Dev / human approval — required before paid page generation uses the anchor. */
export function isChildAnchorReviewApproved(
  orderId: string,
  cache?: PipelineCache | null,
  order?: Pick<Order, 'characterAnchors'> | null
): boolean {
  if (cache?.childAnchorApproved === true) return true;

  if (process.env.CHILD_ANCHOR_REVIEW_OK?.trim().toLowerCase() === 'true') return true;

  const orderIds = (process.env.CHILD_ANCHOR_REVIEW_OK_ORDER_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (orderIds.includes(orderId)) return true;

  const anchors = order?.characterAnchors;
  if (anchors && typeof anchors === 'object') {
    const child = (anchors as Record<string, unknown>).child;
    if (child && typeof child === 'object') {
      const approved = (child as Record<string, unknown>).anchorApproved;
      if (approved === true) return true;
    }
  }

  return false;
}

export function getChildAnchorReviewState(cache: PipelineCache | null | undefined): {
  approved: boolean;
  qaStatus: string | null;
  resemblanceScore: number | null;
  selectedAttempt: number | null;
} {
  const child = getCharacterAnchorStore(cache).child;
  return {
    approved: cache?.childAnchorApproved === true || child?.qaStatus === 'passed',
    qaStatus: child?.qaStatus ?? null,
    resemblanceScore: child?.resemblanceScore ?? null,
    selectedAttempt: cache?.stage0SelectedAttempt ?? null,
  };
}
