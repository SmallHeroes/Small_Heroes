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
  evaluateImageFaceSignal,
  resolveEffectiveThreshold,
  resolveResemblanceThresholdConfig,
  scoreResemblanceAgainstReference,
} from '@/lib/resemblance-core';
import { resolveStyle01ChildTemplatePath } from '@/lib/style01-child-template';
import {
  STYLE_01_ANTI_STYLE02,
  STYLE_01_AVOIDANCE_NEGATIVE,
  STYLE_01_CHILD_PHOTO_IDENTITY_RULE,
  STYLE_01_CHILD_TEMPLATE_STYLE_RULE,
  STYLE_01_NO_TEXT,
  STYLE_01_REFERENCE_INSTRUCTION,
  STYLE_01_RENDERING_CORRECTION,
  STYLE_01_SHARED,
  resolveStyle01GptModel,
  resolveStyle01RefBudgetConfig,
  resolveStyle01StyleReferencePaths,
} from '@/lib/style01-gptimage';
import { describeChildFromPhoto } from '@/backend/providers/story-bank-loader';
import { assertPipelineStyleBranchMatchesOrder } from '@/lib/image-engine-guard';
import {
  assertIdentityLockFreeOfClothingWhenWardrobeApplies,
  sanitizeTransientExpressionFromIdentity,
} from '@/lib/child-photo-dna-sanitize';
import type { GPTImageReferenceMode } from '@/lib/generate-image';
import { stage0StyleQaEvidenceIsUnavailable } from './stage0-qa-diagnostics';

export type Stage0MethodBReferenceLayout =
  /** Legacy — template dominates edit base; photo last. */
  | 'template_first_photo_last'
  /** Photo first, then template + style refs. */
  | 'photo_first_with_template'
  /** Production default — photo + style refs only; no generic boy/girl template. */
  | 'photo_only_no_template';

export type Stage0MethodBReferences = {
  paths: string[];
  labels: string[];
  referenceMode: GPTImageReferenceMode;
  layout: Stage0MethodBReferenceLayout;
};

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

export type Stage0DescriptionTemplateReferences = {
  paths: string[];
  labels: string[];
  referenceMode: Extract<GPTImageReferenceMode, 'anchor_template'>;
};

export type Stage0DescriptionTemplateResult = {
  anchorUrl: string;
  anchorModel: string;
  anchorPrompt: string;
  referenceImages: string[];
  referenceOrderLabels: string[];
  faceSignal: Awaited<ReturnType<typeof evaluateImageFaceSignal>>;
  anchorVisionDescription: string | null;
  semantic: ReturnType<typeof evaluateAnchorSemanticQa>;
  styleQa: Awaited<ReturnType<typeof evaluateAnchorStyleFromVision>>;
};

export function shouldGenerateStage0DescriptionTemplateAnchor(input: {
  hasExistingChildAnchor: boolean;
  childImageUrl: string | null | undefined;
  orderStyleBranch: 'style01' | 'style02';
}): boolean {
  return (
    !input.hasExistingChildAnchor &&
    !input.childImageUrl?.trim() &&
    input.orderStyleBranch === 'style01'
  );
}

export function stage0DescriptionTemplateQaEvidenceIsAvailable(
  result: Pick<Stage0DescriptionTemplateResult, 'anchorVisionDescription' | 'semantic' | 'styleQa'>
): boolean {
  const styleEvidenceUnavailable = stage0StyleQaEvidenceIsUnavailable(result.styleQa.notes);
  return Boolean(result.anchorVisionDescription?.trim()) && !styleEvidenceUnavailable;
}

export function stage0DescriptionTemplateCandidatePassesQa(
  result: Pick<Stage0DescriptionTemplateResult, 'anchorVisionDescription' | 'semantic' | 'styleQa'>
): boolean {
  return (
    stage0DescriptionTemplateQaEvidenceIsAvailable(result) &&
    result.semantic.ok &&
    result.styleQa.ok
  );
}

/** Production Stage 0: photo-first identity + style refs (no generic child template). */
export function buildStage0MethodBReferences(input: {
  childPhotoUrl: string;
  childGender: string | null | undefined;
  layout?: Stage0MethodBReferenceLayout;
}): Stage0MethodBReferences {
  const layout = input.layout ?? 'photo_only_no_template';
  // Subset choice is technique-only since the character-free ref flip (Task 5) —
  // every subset now carries watercolor texture/palette refs with NO characters.
  const styleRefPaths = resolveStyle01StyleReferencePaths(
    'fantasy-cave',
    resolveStyle01RefBudgetConfig() === 'A' ? 2 : 3
  );
  const styleLabels = [
    'style01_ref_1',
    'style01_ref_2',
    ...(styleRefPaths.length > 2 ? ['style01_ref_3'] : []),
  ] as const;

  if (layout === 'photo_only_no_template') {
    return {
      layout,
      referenceMode: 'anchor_photo_style_only',
      paths: [input.childPhotoUrl, ...styleRefPaths],
      labels: ['raw_child_photo', ...styleLabels],
    };
  }

  const templatePath = resolveStyle01ChildTemplatePath(input.childGender);

  if (layout === 'photo_first_with_template') {
    return {
      layout,
      referenceMode: 'anchor_photo_template_middle',
      paths: [input.childPhotoUrl, templatePath, ...styleRefPaths],
      labels: ['raw_child_photo', 'style01_child_template', ...styleLabels],
    };
  }

  return {
    layout: 'template_first_photo_last',
    referenceMode: 'anchor_template_photo_last',
    paths: [templatePath, ...styleRefPaths, input.childPhotoUrl],
    labels: ['style01_child_template', ...styleLabels, 'raw_child_photo'],
  };
}

/** No-photo identity authority: approved gender template + character-free Style 01 technique refs. */
export function buildStage0DescriptionTemplateReferences(input: {
  childGender: string | null | undefined;
}): Stage0DescriptionTemplateReferences {
  const styleRefPaths = resolveStyle01StyleReferencePaths(
    'fantasy-cave',
    resolveStyle01RefBudgetConfig() === 'A' ? 2 : 3
  );
  const styleLabels = [
    'style01_ref_1',
    'style01_ref_2',
    ...(styleRefPaths.length > 2 ? ['style01_ref_3'] : []),
  ];
  return {
    referenceMode: 'anchor_template',
    paths: [resolveStyle01ChildTemplatePath(input.childGender), ...styleRefPaths],
    labels: ['style01_child_template', ...styleLabels],
  };
}

/** Strip toddler-pushing wording from identity text — keep real traits (round face, prominent cheeks). */
export function sanitizeStage0AnchorIdentityText(text: string): string {
  return sanitizeTransientExpressionFromIdentity(text)
    .replace(/\byoung-child softness\b/gi, '')
    .replace(/\bbaby-soft(ness)?\b/gi, '')
    .replace(/\btoddler(-like)?\b/gi, '')
    .replace(/\binfant(-like)?\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/,\s*,/g, ',')
    .replace(/\.\s*\./g, '.')
    .trim();
}

export const STAGE0_ANCHOR_NEUTRAL_EXPRESSION =
  'ANCHOR EXPRESSION (mandatory): relaxed neutral face, lips naturally closed, calm eyes, no smile, no grin, no open mouth. This is a reusable identity/style anchor, not a story moment; page-specific expression and gaze are authored later.';

export const STAGE0_ANCHOR_STYLE_FIDELITY =
  'ANCHOR STYLE FIDELITY (mandatory): refined semi-naturalistic Style 01 watercolor with believable human facial anatomy, natural eye scale, natural five-finger hands, subtle skin-value modeling, fine hair strands, and delicate watercolor edges. Keep the child recognisably human and portrait-faithful; never simplify into a mascot, chibi, flat cartoon, plastic doll, or generic picture-book child.';

export const STAGE0_ANCHOR_ANTI_TODDLER =
  'ANTI-TODDLER (mandatory): NOT baby cheeks, NOT infant cheeks, NOT toddler chub, NOT baby face, NOT infant proportions, NOT toddler body. This is NOT a 2–3-year-old.';

/** Calibrated age lock — kindergarten-age ~5, must not overshoot to 7–8. */
export function buildStage0AnchorAgeLockLine(input: {
  childAge: number | null | undefined;
  childGender: string | null | undefined;
}): string {
  const age = input.childAge ?? 5;
  const isBoy = input.childGender === 'boy';
  const genderNoun = isBoy ? 'boy' : 'girl';
  const pronoun = isBoy ? 'He' : 'She';
  const objectPronoun = isBoy ? 'him' : 'her';

  if (age === 5) {
    return (
      `The child is a 5-year-old kindergarten-age ${genderNoun} — clearly NOT a toddler, NOT a baby, NOT an infant. ` +
      `${pronoun} should read as about age 5: a young child with kindergarten-age proportions, slightly longer limbs than a toddler, ` +
      `less baby-chubby face, and more defined facial features than a 2–3-year-old, while still remaining soft, warm, and childlike. ` +
      `Do NOT make ${objectPronoun} look 7–8 or older.`
    );
  }

  const band =
    age <= 3 ? 'toddler-age' : age <= 5 ? 'kindergarten-age' : age <= 8 ? 'young school-age' : 'school-age';
  const notToddler = age > 3 ? ', NOT a toddler' : '';
  return (
    `The child is a ${age}-year-old ${band} ${genderNoun} — clearly NOT a baby, NOT an infant${notToddler}. ` +
    `${pronoun} should read as about age ${age} with ${band} proportions — not younger, not ${age + 2}–${age + 3} or older. ` +
    'Still soft, warm, and childlike.'
  );
}

export function buildStage0MethodBPrompt(input: {
  order: Pick<Order, 'childGender' | 'childAge'>;
  lockedChildDescription: string;
  wardrobeLock?: string;
  childPhotoDescription?: string | null;
  referenceLayout?: Stage0MethodBReferenceLayout;
}): string {
  const layout = input.referenceLayout ?? 'photo_only_no_template';
  const usesGenericTemplate =
    layout === 'template_first_photo_last' || layout === 'photo_first_with_template';
  const lockedChildDescription = sanitizeStage0AnchorIdentityText(input.lockedChildDescription);
  const childPhotoDescription = input.childPhotoDescription
    ? sanitizeStage0AnchorIdentityText(input.childPhotoDescription)
    : null;
  return [
    layout === 'photo_only_no_template'
      ? 'CANONICAL CHILD ANCHOR — PERSONALIZED STORYBOOK (Style 01 watercolor). Photo-first identity + watercolor style refs (no generic child template).'
      : 'CANONICAL CHILD ANCHOR — PERSONALIZED STORYBOOK (Style 01 watercolor). Method B: template visual language + photo identity cues.',
    'Generate ONE neutral child portrait for continuity across pages.',
    STAGE0_ANCHOR_NEUTRAL_EXPRESSION,
    STAGE0_ANCHOR_STYLE_FIDELITY,
    buildStage0AnchorAgeLockLine({
      childAge: input.order.childAge,
      childGender: input.order.childGender,
    }),
    STAGE0_ANCHOR_ANTI_TODDLER,
    'Front or 3/4 view, half/full body, clean near-empty background.',
    'NO props. NO companion. NO family. NO story objects. NO text.',
    usesGenericTemplate
      ? 'The SYSTEM TEMPLATE provides Style 01 proportions/rendering ONLY — NOT this child\'s identity.'
      : 'REFERENCE IMAGE 1 is the child photo — identity only (hair/skin/eyes/face). Style ref images provide watercolor technique only. Do NOT copy photo realism or day clothes from the photo.',
    STYLE_01_SHARED,
    STYLE_01_RENDERING_CORRECTION,
    `CHILD VISUAL LOCK: ${lockedChildDescription}`,
    input.wardrobeLock ?? '',
    childPhotoDescription
      ? `PHOTO IDENTITY CUES (reference photo — hair/skin/eyes/face only, never clothing or realism): ${childPhotoDescription}`
      : '',
    STYLE_01_CHILD_PHOTO_IDENTITY_RULE,
    STYLE_01_REFERENCE_INSTRUCTION,
    STYLE_01_NO_TEXT,
    STYLE_01_ANTI_STYLE02,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Canonical Style 01 child authority when the family intentionally continues without an uploaded image.
 * Identity comes only from the locked story DNA; the generic template supplies rendering/proportions.
 */
export function buildStage0DescriptionTemplatePrompt(input: {
  order: Pick<Order, 'childGender' | 'childAge'>;
  lockedChildDescription: string;
  wardrobeLock?: string;
}): string {
  const lockedChildDescription = sanitizeStage0AnchorIdentityText(input.lockedChildDescription);
  return [
    'CANONICAL CHILD ANCHOR — DESCRIPTION-DEFINED STORYBOOK CHILD (Style 01 watercolor).',
    'Generate ONE stable neutral child character for continuity across every page in this book.',
    STAGE0_ANCHOR_NEUTRAL_EXPRESSION,
    STAGE0_ANCHOR_STYLE_FIDELITY,
    buildStage0AnchorAgeLockLine({
      childAge: input.order.childAge,
      childGender: input.order.childGender,
    }),
    STAGE0_ANCHOR_ANTI_TODDLER,
    'Front or 3/4 view, half/full body, clean near-empty background.',
    'NO props. NO companion. NO family. NO story objects. NO text.',
    'The SYSTEM TEMPLATE provides Style 01 proportions and rendering only. It is not a specific child identity.',
    'The CHILD VISUAL LOCK below is the complete identity authority. Preserve it consistently and do not invent additional identity traits.',
    STYLE_01_CHILD_TEMPLATE_STYLE_RULE,
    STYLE_01_SHARED,
    STYLE_01_RENDERING_CORRECTION,
    `CHILD VISUAL LOCK: ${lockedChildDescription}`,
    input.wardrobeLock ?? '',
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
  referenceLayout?: Stage0MethodBReferenceLayout;
}): Promise<Stage0MethodBResult> {
  // Gap 2 (bunny forensics): this anchor flow is Style 01 only (Style 01 template,
  // prompt, and style refs). A Style 02 order reaching it = silent style mixing — throw.
  assertPipelineStyleBranchMatchesOrder({
    orderIllustrationStyle: input.order.illustrationStyle,
    pipelineStyleBranch: 'style01',
    context: 'stage0-method-b child anchor',
  });
  assertIdentityLockFreeOfClothingWhenWardrobeApplies({
    identityLockText: input.lockedChildDescription,
    wardrobeLock: input.wardrobeLock,
  });
  const refs = buildStage0MethodBReferences({
    childPhotoUrl: input.childPhotoUrl,
    childGender: input.order.childGender,
    layout: input.referenceLayout,
  });
  const { paths, labels, referenceMode } = refs;
  const anchorPrompt = buildStage0MethodBPrompt({
    ...input,
    referenceLayout: refs.layout,
  });

  console.log(
    `[anchor_stage0_method_b] orderId=${input.order.id} finalOrder=${JSON.stringify(labels)} ` +
      `paths=${JSON.stringify(paths.map((p) => path.basename(p)))}`
  );

  const anchorResult = await generateGPTImage({
    finalPrompt: anchorPrompt,
    negativePrompt: STYLE_01_AVOIDANCE_NEGATIVE,
    referenceImages: paths,
    referenceMode,
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

/** Generate and QA a canonical Style 01 child without claiming photo likeness. */
export async function generateStage0DescriptionTemplateAnchor(input: {
  order: Order;
  lockedChildDescription: string;
  wardrobeLock?: string;
  childStructuredHair?: string | null;
  attemptSuffix?: string;
}): Promise<Stage0DescriptionTemplateResult> {
  assertPipelineStyleBranchMatchesOrder({
    orderIllustrationStyle: input.order.illustrationStyle,
    pipelineStyleBranch: 'style01',
    context: 'stage0 description-template child anchor',
  });
  assertIdentityLockFreeOfClothingWhenWardrobeApplies({
    identityLockText: input.lockedChildDescription,
    wardrobeLock: input.wardrobeLock,
  });
  const refs = buildStage0DescriptionTemplateReferences({
    childGender: input.order.childGender,
  });
  const anchorPrompt = buildStage0DescriptionTemplatePrompt(input);

  console.log(
    `[anchor_stage0_description_template] orderId=${input.order.id} finalOrder=${JSON.stringify(refs.labels)} ` +
      `paths=${JSON.stringify(refs.paths.map((p) => path.basename(p)))}`
  );

  const anchorResult = await generateGPTImage({
    finalPrompt: anchorPrompt,
    negativePrompt: STYLE_01_AVOIDANCE_NEGATIVE,
    referenceImages: refs.paths,
    referenceMode: refs.referenceMode,
    requireReferenceEdit: true,
    size: '1024x1536',
    quality: (process.env.GPT_IMAGE_QUALITY?.trim() || 'low') as 'low' | 'medium' | 'high',
    modelOverride: resolveStyle01GptModel(),
  });

  const { uploadOrderSubpathAsset } = await import('@/lib/image-storage');
  const anchorUrl = await uploadOrderSubpathAsset({
    orderId: input.order.id,
    subpath: `character-anchors/child-canonical-description-${input.attemptSuffix ?? Date.now()}.png`,
    buffer: anchorResult.buffer,
    contentType: 'image/png',
  });
  const [faceSignal, anchorVisionDescription, styleQa] = await Promise.all([
    evaluateImageFaceSignal(anchorUrl),
    describeChildFromPhoto(anchorUrl).catch(() => null),
    evaluateAnchorStyleFromVision(anchorUrl),
  ]);
  const semantic = evaluateAnchorSemanticQa({
    childGender: input.order.childGender,
    childPhotoDescription: null,
    childStructuredHair: input.childStructuredHair,
    anchorVisionDescription,
    faceDetectConfidence: faceSignal.faceDetectConfidence,
  });

  return {
    anchorUrl,
    anchorModel: anchorResult.model,
    anchorPrompt,
    referenceImages: refs.paths,
    referenceOrderLabels: refs.labels,
    faceSignal,
    anchorVisionDescription,
    semantic,
    styleQa,
  };
}
