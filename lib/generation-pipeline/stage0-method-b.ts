import path from 'path';
import type { Order } from '@prisma/client';
import { generateGPTImage } from '@/lib/generate-image';
import {
  evaluateAnchorEmbeddingScore,
  evaluateAnchorSemanticQa,
  resolveAnchorGateConfig,
} from '@/lib/anchor-resemblance-gate';
import { evaluateAnchorStyleFromVision } from '@/lib/anchor-style-qa';
import {
  resolveEffectiveThreshold,
  resolveResemblanceThresholdConfig,
  scoreResemblanceAgainstReference,
} from '@/lib/resemblance-core';
import { resolveStyle01ChildTemplatePath } from '@/lib/style01-child-template';
import {
  STYLE_01_ANTI_STYLE02,
  STYLE_01_AVOIDANCE_NEGATIVE,
  STYLE_01_CHILD_PHOTO_IDENTITY_RULE,
  STYLE_01_NO_TEXT,
  STYLE_01_REFERENCE_INSTRUCTION,
  STYLE_01_RENDERING_CORRECTION,
  STYLE_01_SHARED,
  resolveStyle01GptModel,
  resolveStyle01RefBudgetConfig,
  resolveStyle01StyleReferencePaths,
} from '@/lib/style01-gptimage';
import { describeChildFromPhoto } from '@/backend/providers/story-bank-loader';

export type Stage0MethodBResult = {
  anchorUrl: string;
  anchorModel: string;
  anchorPrompt: string;
  referenceImages: string[];
  referenceOrderLabels: string[];
  resemblanceScore: number;
  semantic: ReturnType<typeof evaluateAnchorSemanticQa>;
  styleQa: Awaited<ReturnType<typeof evaluateAnchorStyleFromVision>>;
  embeddingVerdict: string;
};

/** Production Stage 0: template base + style refs + raw photo last (method B). */
export function buildStage0MethodBReferences(input: {
  childPhotoUrl: string;
  childGender: string | null | undefined;
}): { paths: string[]; labels: string[] } {
  const templatePath = resolveStyle01ChildTemplatePath(input.childGender);
  const styleRefPaths = resolveStyle01StyleReferencePaths(
    'fantasy-cave',
    resolveStyle01RefBudgetConfig() === 'A' ? 2 : 3
  );
  return {
    paths: [templatePath, ...styleRefPaths, input.childPhotoUrl],
    labels: [
      'style01_child_template',
      'style01_ref_1',
      'style01_ref_2',
      ...(styleRefPaths.length > 2 ? ['style01_ref_3'] : []),
      'raw_child_photo',
    ],
  };
}

export function buildStage0MethodBPrompt(input: {
  order: Pick<Order, 'childGender' | 'childAge'>;
  lockedChildDescription: string;
  wardrobeLock?: string;
  childPhotoDescription?: string | null;
}): string {
  const genderWord = input.order.childGender === 'boy' ? 'boy' : 'girl';
  return [
    'CANONICAL CHILD ANCHOR — PERSONALIZED STORYBOOK (Style 01 watercolor). Method B: template visual language + photo identity cues.',
    'Generate ONE neutral child portrait for continuity across pages.',
    `The child MUST read clearly as a ${genderWord} of about ${input.order.childAge ?? 5}.`,
    'Front or 3/4 view, half/full body, clean near-empty background.',
    'NO props. NO companion. NO family. NO story objects. NO text.',
    'The SYSTEM TEMPLATE provides Style 01 proportions/rendering ONLY — NOT this child\'s identity.',
    STYLE_01_SHARED,
    STYLE_01_RENDERING_CORRECTION,
    `CHILD VISUAL LOCK: ${input.lockedChildDescription}`,
    input.wardrobeLock ?? '',
    input.childPhotoDescription
      ? `PHOTO IDENTITY CUES (last reference — hair/skin/eyes/face only): ${input.childPhotoDescription}`
      : '',
    STYLE_01_CHILD_PHOTO_IDENTITY_RULE,
    STYLE_01_REFERENCE_INSTRUCTION,
    STYLE_01_NO_TEXT,
    STYLE_01_ANTI_STYLE02,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export async function generateStage0MethodBAnchor(input: {
  order: Order;
  childPhotoUrl: string;
  lockedChildDescription: string;
  wardrobeLock?: string;
  childPhotoDescription?: string | null;
  childStructuredHair?: string | null;
  attemptSuffix?: string;
}): Promise<Stage0MethodBResult> {
  const { paths, labels } = buildStage0MethodBReferences({
    childPhotoUrl: input.childPhotoUrl,
    childGender: input.order.childGender,
  });
  const anchorPrompt = buildStage0MethodBPrompt(input);

  console.log(
    `[anchor_stage0_method_b] orderId=${input.order.id} finalOrder=${JSON.stringify(labels)} ` +
      `paths=${JSON.stringify(paths.map((p) => path.basename(p)))}`
  );

  const anchorResult = await generateGPTImage({
    finalPrompt: anchorPrompt,
    negativePrompt: STYLE_01_AVOIDANCE_NEGATIVE,
    referenceImages: paths,
    referenceMode: 'anchor_template_photo_last',
    requireReferenceEdit: true,
    size: '1024x1536',
    quality: (process.env.GPT_IMAGE_QUALITY?.trim() || 'low') as 'low' | 'medium' | 'high',
    modelOverride: resolveStyle01GptModel(),
  });

  const thresholdConfig = resolveResemblanceThresholdConfig();
  const pageThreshold = resolveEffectiveThreshold(input.order.illustrationStyle, thresholdConfig);
  const anchorGate = resolveAnchorGateConfig();

  const { uploadOrderSubpathAsset } = await import('@/lib/image-storage');
  const anchorUrl = await uploadOrderSubpathAsset({
    orderId: input.order.id,
    subpath: `character-anchors/child-canonical-method-b-${input.attemptSuffix ?? Date.now()}.png`,
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
  const styleQa = await evaluateAnchorStyleFromVision(anchorUrl);

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
