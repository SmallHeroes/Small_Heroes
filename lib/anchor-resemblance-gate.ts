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
  /**
   * Scores below this are clearly wrong identity (hard fail). NOTE: this is the
   * ANCHOR-vs-PHOTO embedding (a watercolor anchor scored against a real photo —
   * cross-domain, so it sits LOW even for a great likeness). It is a DIFFERENT
   * distribution from the per-page render-vs-anchor gate (the protected ~0.70).
   */
  embeddingHardFailBelow: number;
  /**
   * Auto-accept floor for the anchor-vs-photo embedding (best-of-N). At/above this
   * the anchor is accepted automatically — no human approval, no env var. Calibrated
   * for Style-01 from shipped goldens (good ≈ 0.28–0.59; occluded-bad ≈ 0.12).
   */
  embeddingSoftAcceptAt: number;
  /** Informational only — page gate still uses ~0.70; anchor does not auto-pass here. */
  embeddingStrongAt: number;
  minFaceDetectConfidence: number;
};

/** Which band the anchor-vs-photo embedding lands in. */
export type AnchorEmbeddingBand = 'auto_accept' | 'review' | 'hard_fail';

export type AnchorEmbeddingEvaluation = {
  verdict: AnchorEmbeddingVerdict;
  band: AnchorEmbeddingBand;
  resemblanceScore: number;
  hardFail: boolean;
  /** True when score >= embeddingSoftAcceptAt — accept with no human/env approval. */
  autoAccept: boolean;
  /**
   * True in the soft "review" band (>= hardFail, < softAccept). The customer flow
   * does NOT block on this — it regenerates, then accepts-best-and-flags. Retained
   * for QA telemetry / the dev override path.
   */
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
  // Calibrated 2026-06-24 from staging Style-01 data (anchor-vs-photo cosine):
  //   good shipped anchors: יובל best-of-N 0.281 (a1 0.193 / a2 0.275), נועם 0.594;
  //   occluded known-bad ≈ 0.12. hardFail 0.15 catches the bad without rejecting a
  //   good ~0.19; softAccept 0.22 auto-passes the goods with headroom over 0.12.
  // These are SEPARATE from the protected per-page 0.70 render-vs-anchor gate.
  const embeddingHardFailBelow = parseNumberEnv('ANCHOR_EMBEDDING_HARD_FAIL_BELOW', 0.15);
  const embeddingSoftAcceptAt = parseNumberEnv('ANCHOR_SOFT_ACCEPT_AT', 0.22);
  return {
    embeddingHardFailBelow,
    // Guard against a misconfiguration where softAccept <= hardFail (would make the
    // "review" band empty / invert ordering). Keep softAccept strictly above hardFail.
    embeddingSoftAcceptAt: Math.max(embeddingSoftAcceptAt, embeddingHardFailBelow + 0.01),
    embeddingStrongAt: parseNumberEnv('ANCHOR_EMBEDDING_STRONG_AT', 0.7),
    minFaceDetectConfidence: parseNumberEnv('ANCHOR_MIN_FACE_DETECT', 0.35),
  };
}

export function evaluateAnchorEmbeddingScore(
  resemblanceScore: number,
  config: AnchorGateConfig = resolveAnchorGateConfig()
): AnchorEmbeddingEvaluation {
  const hardFail = resemblanceScore < config.embeddingHardFailBelow;
  const autoAccept = resemblanceScore >= config.embeddingSoftAcceptAt;
  const band: AnchorEmbeddingBand = hardFail ? 'hard_fail' : autoAccept ? 'auto_accept' : 'review';
  return {
    verdict: hardFail ? 'hard_fail' : 'soft_ok',
    band,
    resemblanceScore,
    hardFail,
    autoAccept,
    /** Soft "review" band only — no longer a customer block (see chunk-runner Stage 0). */
    needsHumanApproval: band === 'review',
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
