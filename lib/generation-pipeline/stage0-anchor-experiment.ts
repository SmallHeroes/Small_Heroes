import path from 'path';
import type { Order } from '@prisma/client';
import { generateGPTImage, type GPTImageReferenceMode } from '@/lib/generate-image';
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
  STYLE_01_NO_TEXT,
  STYLE_01_REFERENCE_INSTRUCTION,
  STYLE_01_RENDERING_CORRECTION,
  STYLE_01_SHARED,
  resolveStyle01GptModel,
  resolveStyle01StyleReferencePaths,
} from '@/lib/style01-gptimage';
import { uploadOrderSubpathAsset } from '@/lib/image-storage';
import { describeChildFromPhoto } from '@/backend/providers/story-bank-loader';

export type Stage0AnchorExperimentVariant = 'A' | 'B' | 'C' | 'D';

export type Stage0AnchorExperimentInput = {
  order: Order;
  childPhotoUrl: string;
  lockedChildDescription: string;
  childPhotoDescription: string | null;
  childStructuredHair?: string | null;
  wardrobeLock?: string;
};

export type Stage0AnchorExperimentVariantSpec = {
  variant: Stage0AnchorExperimentVariant;
  label: string;
  referenceOrderLabels: string[];
  referenceImages: string[];
  referenceMode: GPTImageReferenceMode;
  rawPhotoInEdit: boolean;
  apiMode: 'images.edit' | 'images.generate';
  prompt: string;
};

export type Stage0AnchorExperimentResult = Stage0AnchorExperimentVariantSpec & {
  imageUrl: string;
  resemblanceScore: number;
  pageThreshold: number;
  embeddingVerdict: string;
  embeddingNote: string;
  semantic: ReturnType<typeof evaluateAnchorSemanticQa>;
  styleQa: Awaited<ReturnType<typeof evaluateAnchorStyleFromVision>>;
  judgment: string;
};

function buildSharedAnchorPrompt(input: Stage0AnchorExperimentInput, variant: Stage0AnchorExperimentVariant): string {
  const genderWord = input.order.childGender === 'boy' ? 'boy' : 'girl';
  const extraC =
    variant === 'C'
      ? 'CRITICAL: simplified storybook character illustration — NOT a portrait, NOT photorealistic, NOT semi-realistic.'
      : '';
  return [
    `STAGE 0 ANCHOR EXPERIMENT ${variant} — Style 01 watercolor canonical child.`,
    'Neutral front or 3/4 view, half/full body, clean near-empty background.',
    'NO props. NO companion. NO family. NO story objects. NO text.',
    extraC,
    `The child MUST read as a ${genderWord} about ${input.order.childAge ?? 5} years old.`,
    STYLE_01_SHARED,
    STYLE_01_RENDERING_CORRECTION,
    `CHILD VISUAL LOCK (identity from text): ${input.lockedChildDescription}`,
    input.wardrobeLock ?? '',
    input.childPhotoDescription
      ? `PHOTO IDENTITY CUES (when photo attached — hair/skin/eyes/face only, never realism): ${input.childPhotoDescription}`
      : '',
    STYLE_01_REFERENCE_INSTRUCTION,
    STYLE_01_NO_TEXT,
    STYLE_01_ANTI_STYLE02,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function buildStage0AnchorExperimentVariant(
  input: Stage0AnchorExperimentInput,
  variant: Stage0AnchorExperimentVariant
): Stage0AnchorExperimentVariantSpec {
  const templatePath = resolveStyle01ChildTemplatePath(input.order.childGender);
  const styleRefPaths = resolveStyle01StyleReferencePaths('fantasy-cave', 2);
  const prompt = buildSharedAnchorPrompt(input, variant);

  switch (variant) {
    case 'A':
      return {
        variant: 'A',
        label: 'Template base + style refs + DNA — NO raw photo',
        referenceOrderLabels: ['style01_child_template', 'style01_ref_1', 'style01_ref_2'],
        referenceImages: [templatePath, ...styleRefPaths],
        referenceMode: 'anchor_template',
        rawPhotoInEdit: false,
        apiMode: 'images.edit',
        prompt,
      };
    case 'B':
      return {
        variant: 'B',
        label: 'Template base + style refs + photo last (identity cue)',
        referenceOrderLabels: [
          'style01_child_template',
          'style01_ref_1',
          'style01_ref_2',
          'raw_child_photo',
        ],
        referenceImages: [templatePath, ...styleRefPaths, input.childPhotoUrl],
        referenceMode: 'anchor_template_photo_last',
        rawPhotoInEdit: true,
        apiMode: 'images.edit',
        prompt,
      };
    case 'C':
      return {
        variant: 'C',
        label: 'Photo first + style refs (control — verbal anti-realism)',
        referenceOrderLabels: ['raw_child_photo', 'style01_ref_1', 'style01_ref_2'],
        referenceImages: [input.childPhotoUrl, ...styleRefPaths],
        referenceMode: 'style',
        rawPhotoInEdit: true,
        apiMode: 'images.edit',
        prompt,
      };
    case 'D':
      return {
        variant: 'D',
        label: 'images.generate — no edit base (DNA + style text only)',
        referenceOrderLabels: ['(none — text-only generate)'],
        referenceImages: [],
        referenceMode: 'style',
        rawPhotoInEdit: false,
        apiMode: 'images.generate',
        prompt: [
          prompt,
          'PROPORTION GUIDE (text): large expressive storybook eyes, small nose, rounded cheeks, simplified child proportions typical of premium watercolor picture books.',
        ].join('\n\n'),
      };
  }
}

function buildJudgmentLine(result: {
  styleQa: Awaited<ReturnType<typeof evaluateAnchorStyleFromVision>>;
  semantic: ReturnType<typeof evaluateAnchorSemanticQa>;
  resemblanceScore: number;
  embeddingNote: string;
}): string {
  const parts: string[] = [];
  if (!result.styleQa.ok) {
    parts.push('REJECT: not cute Style 01 (realistic/portrait)');
  } else {
    parts.push('style OK');
  }
  parts.push(`resemblance=${result.resemblanceScore.toFixed(3)} (${result.embeddingNote})`);
  if (!result.semantic.ok) {
    parts.push(
      `semantic FAIL (gender=${result.semantic.genderMismatch} missingHair=${result.semantic.missingHairTraits.join('|') || 'none'})`
    );
  } else {
    parts.push('semantic OK');
  }
  if (result.styleQa.notes) parts.push(result.styleQa.notes);
  return parts.join(' | ');
}

export async function runStage0AnchorExperimentVariant(
  input: Stage0AnchorExperimentInput,
  variant: Stage0AnchorExperimentVariant
): Promise<Stage0AnchorExperimentResult> {
  const spec = buildStage0AnchorExperimentVariant(input, variant);
  const quality = (process.env.GPT_IMAGE_QUALITY?.trim() || 'low') as 'low' | 'medium' | 'high';

  const gen = await generateGPTImage({
    finalPrompt: spec.prompt,
    negativePrompt: STYLE_01_AVOIDANCE_NEGATIVE,
    referenceImages: spec.referenceImages,
    referenceMode: spec.referenceMode,
    requireReferenceEdit: spec.apiMode === 'images.edit',
    size: '1024x1536',
    quality,
    modelOverride: resolveStyle01GptModel(),
  });

  const imageUrl = await uploadOrderSubpathAsset({
    orderId: input.order.id,
    subpath: `character-anchors/experiment-${variant}-${Date.now()}.png`,
    buffer: gen.buffer,
    contentType: 'image/png',
  });

  const thresholdConfig = resolveResemblanceThresholdConfig();
  const pageThreshold = resolveEffectiveThreshold(input.order.illustrationStyle, thresholdConfig);
  const anchorGate = resolveAnchorGateConfig();

  const similarity = await scoreResemblanceAgainstReference({
    referenceImageUrl: input.childPhotoUrl,
    candidateImageUrl: imageUrl,
    effectiveThreshold: pageThreshold,
    minAcceptableScore: thresholdConfig.minAcceptableScore,
  });
  const embeddingEval = evaluateAnchorEmbeddingScore(similarity.resemblanceScore, anchorGate);

  const anchorVision = await describeChildFromPhoto(imageUrl).catch(() => null);
  const semantic = evaluateAnchorSemanticQa({
    childGender: input.order.childGender,
    childPhotoDescription: input.childPhotoDescription,
    childStructuredHair: input.childStructuredHair,
    anchorVisionDescription: anchorVision,
    faceDetectConfidence: similarity.faceDetectConfidence,
    config: anchorGate,
  });
  const styleQa = await evaluateAnchorStyleFromVision(imageUrl);

  const embeddingNote =
    embeddingEval.hardFail
      ? 'embedding HARD FAIL (<0.20)'
      : `embedding soft (page gate ${pageThreshold.toFixed(2)} unchanged)`;

  return {
    ...spec,
    imageUrl,
    resemblanceScore: similarity.resemblanceScore,
    pageThreshold,
    embeddingVerdict: embeddingEval.verdict,
    embeddingNote,
    semantic,
    styleQa,
    judgment: buildJudgmentLine({
      styleQa,
      semantic,
      resemblanceScore: similarity.resemblanceScore,
      embeddingNote,
    }),
  };
}

export async function runStage0AnchorExperimentGrid(
  input: Stage0AnchorExperimentInput
): Promise<Stage0AnchorExperimentResult[]> {
  const variants: Stage0AnchorExperimentVariant[] = ['A', 'B', 'C', 'D'];
  const results: Stage0AnchorExperimentResult[] = [];
  for (const variant of variants) {
    console.log(`[stage0_experiment] orderId=${input.order.id} variant=${variant} starting`);
    results.push(await runStage0AnchorExperimentVariant(input, variant));
    console.log(
      `[stage0_experiment] orderId=${input.order.id} variant=${variant} done score=${results[results.length - 1].resemblanceScore.toFixed(3)} judgment=${results[results.length - 1].judgment}`
    );
  }
  return results;
}

export function formatExperimentMarkdownReport(
  orderId: string,
  results: Stage0AnchorExperimentResult[]
): string {
  const lines = [
    `# Stage 0 anchor experiment — ${orderId}`,
    '',
    '| Var | Style OK | Score | Photo in edit | Reference order | Judgment |',
    '|-----|----------|-------|---------------|-----------------|----------|',
  ];
  for (const r of results) {
    lines.push(
      `| ${r.variant} | ${r.styleQa.ok ? 'yes' : '**NO**'} | ${r.resemblanceScore.toFixed(3)} | ${r.rawPhotoInEdit ? 'yes' : 'no'} | ${r.referenceOrderLabels.join(' → ')} | ${r.judgment.replace(/\|/g, '/')} |`
    );
    lines.push('');
    lines.push(`### ${r.variant} — ${r.label}`);
    lines.push(`![${r.variant}](${r.imageUrl})`);
    lines.push('');
    lines.push(`- **API:** ${r.apiMode}`);
    lines.push(`- **refMode:** ${r.referenceMode}`);
    lines.push(`- **Paths:** ${r.referenceImages.map((p) => path.basename(p)).join(', ') || '(none)'}`);
    lines.push(`- **embedding:** ${r.embeddingNote}`);
    lines.push('');
    lines.push('<details><summary>Prompt</summary>');
    lines.push('');
    lines.push('```');
    lines.push(r.prompt);
    lines.push('```');
    lines.push('</details>');
    lines.push('');
  }
  return lines.join('\n');
}
