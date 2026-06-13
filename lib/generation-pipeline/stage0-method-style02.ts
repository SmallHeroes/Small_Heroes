import path from 'path';
import type { Order } from '@prisma/client';
import { generateGPTImage } from '@/lib/generate-image';
import {
  evaluateAnchorEmbeddingScore,
  evaluateAnchorSemanticQa,
  resolveAnchorGateConfig,
} from '@/lib/anchor-resemblance-gate';
import { evaluateAnchorStyle02FromVision } from '@/lib/anchor-style-qa';
import {
  resolveEffectiveThreshold,
  resolveResemblanceThresholdConfig,
  scoreResemblanceAgainstReference,
} from '@/lib/resemblance-core';
import {
  STYLE_02_ANTI_SOFTNESS,
  STYLE_02_AVOIDANCE_NEGATIVE,
  STYLE_02_CHARACTER_GUARD,
  STYLE_02_CHILD_PHOTO_IDENTITY_RULE,
  STYLE_02_NO_TEXT,
  STYLE_02_REFERENCE_INSTRUCTION,
  STYLE_02_RENDERING_CORRECTION,
  STYLE_02_SHARED,
  STYLE_02_GPT_MODEL,
  resolveStyle02StyleReferencePaths,
} from '@/lib/style02-gptimage';
import { describeChildFromPhoto } from '@/backend/providers/story-bank-loader';
import { assertPipelineStyleBranchMatchesOrder } from '@/lib/image-engine-guard';

export type Stage0Style02Result = {
  anchorUrl: string;
  anchorModel: string;
  anchorPrompt: string;
  referenceImages: string[];
  referenceOrderLabels: string[];
  resemblanceScore: number;
  semantic: ReturnType<typeof evaluateAnchorSemanticQa>;
  styleQa: Awaited<ReturnType<typeof evaluateAnchorStyle02FromVision>>;
  embeddingVerdict: string;
};

/** Style 02 anchor refs: Style 02 style subset only + raw photo last (identity cues). */
export function buildStage0Style02References(input: { childPhotoUrl: string }): {
  paths: string[];
  labels: string[];
} {
  const styleRefPaths = resolveStyle02StyleReferencePaths('classroom-day', 2);
  return {
    paths: [...styleRefPaths, input.childPhotoUrl],
    labels: ['style02_ref_1', 'style02_ref_2', 'raw_child_photo'],
  };
}

export function buildStage0Style02Prompt(input: {
  order: Pick<Order, 'childGender' | 'childAge'>;
  lockedChildDescription: string;
  wardrobeLock?: string;
  childPhotoDescription?: string | null;
}): string {
  const genderWord = input.order.childGender === 'boy' ? 'boy' : 'girl';
  return [
    'CANONICAL CHILD ANCHOR — PERSONALIZED STORYBOOK (Style 02 semi-realistic cinematic fantasy).',
    'Generate ONE neutral child portrait for continuity across pages.',
    `The child MUST read clearly as a ${genderWord} of about ${input.order.childAge ?? 5}.`,
    'Front or 3/4 view, half/full body, clean near-empty background.',
    'NO props. NO companion. NO family. NO story objects. NO text.',
    'Style 02 ONLY — semi-realistic illustrated storybook character with dimensional painted forms.',
    STYLE_02_SHARED,
    STYLE_02_RENDERING_CORRECTION,
    `CHILD VISUAL LOCK: ${input.lockedChildDescription}`,
    input.wardrobeLock ?? '',
    input.childPhotoDescription
      ? `PHOTO IDENTITY CUES (last reference — hair/skin/eyes/face only): ${input.childPhotoDescription}`
      : '',
    STYLE_02_CHILD_PHOTO_IDENTITY_RULE,
    STYLE_02_REFERENCE_INSTRUCTION,
    STYLE_02_NO_TEXT,
    STYLE_02_ANTI_SOFTNESS,
    STYLE_02_CHARACTER_GUARD,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export async function generateStage0Style02Anchor(input: {
  order: Order;
  childPhotoUrl: string;
  lockedChildDescription: string;
  wardrobeLock?: string;
  childPhotoDescription?: string | null;
  childStructuredHair?: string | null;
  attemptSuffix?: string;
}): Promise<Stage0Style02Result> {
  assertPipelineStyleBranchMatchesOrder({
    orderIllustrationStyle: input.order.illustrationStyle,
    pipelineStyleBranch: 'style02',
    context: 'stage0-style02 child anchor',
  });

  const { paths, labels } = buildStage0Style02References({
    childPhotoUrl: input.childPhotoUrl,
  });
  const anchorPrompt = buildStage0Style02Prompt(input);

  console.log(
    `[anchor_stage0_style02] orderId=${input.order.id} finalOrder=${JSON.stringify(labels)} ` +
      `paths=${JSON.stringify(paths.map((p) => path.basename(p)))}`
  );

  const anchorResult = await generateGPTImage({
    finalPrompt: anchorPrompt,
    negativePrompt: STYLE_02_AVOIDANCE_NEGATIVE,
    referenceImages: paths,
    referenceMode: 'style02_book',
    requireReferenceEdit: true,
    size: '1024x1536',
    quality: (process.env.GPT_IMAGE_QUALITY?.trim() || 'low') as 'low' | 'medium' | 'high',
    modelOverride: STYLE_02_GPT_MODEL,
  });

  const thresholdConfig = resolveResemblanceThresholdConfig();
  const pageThreshold = resolveEffectiveThreshold(input.order.illustrationStyle, thresholdConfig);
  const anchorGate = resolveAnchorGateConfig();

  const { uploadOrderSubpathAsset } = await import('@/lib/image-storage');
  const anchorUrl = await uploadOrderSubpathAsset({
    orderId: input.order.id,
    subpath: `character-anchors/child-canonical-style02-${input.attemptSuffix ?? Date.now()}.png`,
    buffer: anchorResult.buffer,
    contentType: 'image/png',
  });

  const similarity = await scoreResemblanceAgainstReference({
    referenceImageUrl: input.childPhotoUrl,
    candidateImageUrl: anchorUrl,
    effectiveThreshold: pageThreshold,
    minAcceptableScore: thresholdConfig.minAcceptableScore,
  });
  const embeddingEval = evaluateAnchorEmbeddingScore(similarity.resemblanceScore, anchorGate);
  const anchorPhotoDescription = await describeChildFromPhoto(anchorUrl).catch(() => null);
  const semantic = evaluateAnchorSemanticQa({
    childGender: input.order.childGender,
    childPhotoDescription: input.childPhotoDescription,
    childStructuredHair: input.childStructuredHair,
    anchorVisionDescription: anchorPhotoDescription,
    faceDetectConfidence: similarity.faceDetectConfidence,
    config: anchorGate,
  });
  const styleQa = await evaluateAnchorStyle02FromVision(anchorUrl);

  return {
    anchorUrl,
    anchorModel: anchorResult.model,
    anchorPrompt,
    referenceImages: paths,
    referenceOrderLabels: labels,
    resemblanceScore: similarity.resemblanceScore,
    semantic,
    styleQa,
    embeddingVerdict: embeddingEval.verdict,
  };
}
