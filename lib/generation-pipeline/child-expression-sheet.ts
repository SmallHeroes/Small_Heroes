import type { Order } from '@prisma/client';
import { generateGPTImage } from '@/lib/generate-image';
import {
  evaluateAnchorEmbeddingScore,
  resolveAnchorGateConfig,
} from '@/lib/anchor-resemblance-gate';
import { evaluateAnchorStyleFromVision } from '@/lib/anchor-style-qa';
import { uploadOrderSubpathAsset } from '@/lib/image-storage';
import {
  scoreResemblanceAgainstReference,
} from '@/lib/resemblance-core';
import {
  STYLE_01_ANTI_STYLE02,
  STYLE_01_AVOIDANCE_NEGATIVE,
  STYLE_01_NO_TEXT,
  STYLE_01_RENDERING_CORRECTION,
  STYLE_01_SHARED,
  resolveStyle01GptModel,
} from '@/lib/style01-gptimage';
import type { PipelineCache } from './types';

export type ChildExpressionKind = 'neutral' | 'happy' | 'worried' | 'shouting' | 'action';

export const CHILD_EXPRESSION_KINDS: ChildExpressionKind[] = [
  'neutral',
  'happy',
  'worried',
  'shouting',
  'action',
];

const EXPRESSION_SCENE: Record<ChildExpressionKind, string> = {
  neutral:
    'Neutral calm front or 3/4 view, standing relaxed, gentle closed mouth, soft attentive eyes — same child as canonical anchor.',
  happy:
    'Warm happy smile with closed mouth, bright open eyes (same eye size as canonical), cheerful but not shouting.',
  worried:
    'Worried or sad expression: concerned eyebrows, small downturned mouth, eyes still clearly visible and same size as canonical — not crying caricature.',
  shouting:
    'Childlike open-mouth shout: surprise, frustration, or startled fear — NOT adult anger. Soft eyebrows (not harsh furrowed), mouth open O-shape without changing jaw width or cheek volume. SAME eye size and placement, eyes fully visible. SAME age 5. Hair volume unchanged.',
  action:
    'Strong physical motion ONLY: running, jumping, riding, falling, or chasing — one foot off ground or clear sprint pose. Face matches canonical. NOT emotional posing, NOT careful/manual work. Clean anchor sheet, not a full scene.',
};

export const SHOUTING_VARIANT_PROMPTS: Record<'v2' | 'v3', string> = {
  v2:
    'Childlike FRUSTRATION or SURPRISE shout — mouth open, eyebrows raised slightly (NOT angry V-shape), cheeks unchanged, jaw unchanged. Eyes wide and readable. Cute Style 01, same Mia identity.',
  v3:
    'Childlike STARTLED / fear-shout — mouth open in O, eyes wide and clearly visible (same size as canonical), soft worried brows, NO adult anger, NO baby face. Same hair, pajamas, bracelet.',
};

export type ChildExpressionAnchorResult = {
  kind: ChildExpressionKind;
  url: string;
  resemblanceToBase: number;
  styleQaPass: boolean;
  qaStatus: 'passed' | 'failed';
  attempts: number;
};

export type ChildExpressionSheetBundle = NonNullable<PipelineCache['childExpressionSheet']>;

export function getChildExpressionSheet(
  cache: PipelineCache | null | undefined
): ChildExpressionSheetBundle | null {
  const sheet = cache?.childExpressionSheet;
  if (!sheet?.baseAnchorUrl) return null;
  return sheet;
}

export function isChildExpressionSheetApproved(cache: PipelineCache | null | undefined): boolean {
  const sheet = getChildExpressionSheet(cache);
  if (!sheet) return false;
  if (sheet.approved) return true;
  const kinds = sheet.approvedKinds ?? [];
  return (
    kinds.includes('neutral') &&
    kinds.includes('happy') &&
    kinds.includes('worried') &&
    Boolean(resolveSelectedShoutingUrl(sheet))
  );
}

export function isExpressionKindApproved(
  sheet: ChildExpressionSheetBundle,
  kind: ChildExpressionKind
): boolean {
  if (sheet.approved) return true;
  return (sheet.approvedKinds ?? []).includes(kind);
}

export function resolveSelectedShoutingUrl(sheet: ChildExpressionSheetBundle): string | null {
  const pick = sheet.selectedShouting ?? 'v1';
  if (pick === 'v2') return sheet.shoutingVariants?.v2?.url ?? null;
  if (pick === 'v3') return sheet.shoutingVariants?.v3?.url ?? null;
  const v1 = sheet.anchors.shouting;
  return v1?.url && v1.qaStatus === 'passed' ? v1.url : null;
}

export function resolveApprovedExpressionAnchorUrl(
  cache: PipelineCache | null | undefined,
  kind: ChildExpressionKind
): string | null {
  const sheet = getChildExpressionSheet(cache);
  if (!sheet) return null;

  if (kind === 'shouting') {
    if (sheet.selectedShouting) return resolveSelectedShoutingUrl(sheet);
    if (sheet.approved || (sheet.approvedKinds ?? []).includes('shouting')) {
      const entry = sheet.anchors.shouting;
      return entry?.url && entry.qaStatus === 'passed' ? entry.url : null;
    }
    return null;
  }

  if (!sheet.approved && !isExpressionKindApproved(sheet, kind)) return null;
  const entry = sheet.anchors[kind];
  if (!entry?.url || entry.qaStatus !== 'passed') return null;
  return entry.url;
}

export function isChildExpressionSheetActive(cache: PipelineCache | null | undefined): boolean {
  const sheet = getChildExpressionSheet(cache);
  if (!sheet) return false;
  if (sheet.approved) return true;
  return (sheet.approvedKinds?.length ?? 0) > 0 || Boolean(sheet.selectedShouting);
}

function buildExpressionPrompt(input: {
  kind: ChildExpressionKind;
  lockedChildDescription: string;
  wardrobeLock?: string;
}): string {
  return [
    'MINI CHILD EXPRESSION ANCHOR — per-order sheet (Style 01 watercolor).',
    'Edit from the attached canonical child anchor. Isolated character on near-empty cream background.',
    EXPRESSION_SCENE[input.kind],
    STYLE_01_SHARED,
    STYLE_01_RENDERING_CORRECTION,
    `CHILD VISUAL LOCK: ${input.lockedChildDescription}`,
    input.wardrobeLock ?? '',
    STYLE_01_NO_TEXT,
    STYLE_01_ANTI_STYLE02,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export async function generateChildExpressionAnchor(input: {
  order: Pick<Order, 'id'>;
  kind: ChildExpressionKind;
  baseAnchorUrl: string;
  lockedChildDescription: string;
  wardrobeLock?: string;
  attemptSuffix?: string;
}): Promise<ChildExpressionAnchorResult> {
  const anchorGate = resolveAnchorGateConfig();
  const prompt = buildExpressionPrompt(input);
  const maxAttempts = Number.parseInt(process.env.CHILD_EXPRESSION_MAX_ATTEMPTS ?? '5', 10) || 5;

  let lastFailure = 'unknown';
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const gen = await generateGPTImage({
      finalPrompt: prompt,
      negativePrompt: STYLE_01_AVOIDANCE_NEGATIVE,
      referenceImages: [input.baseAnchorUrl],
      referenceMode: 'anchor_expression_from_canonical',
      requireReferenceEdit: true,
      size: '1024x1536',
      quality: (process.env.GPT_IMAGE_QUALITY?.trim() || 'low') as 'low' | 'medium' | 'high',
      modelOverride: resolveStyle01GptModel(),
    });

    const url = await uploadOrderSubpathAsset({
      orderId: input.order.id,
      subpath: `character-anchors/child-expression-${input.kind}-${input.attemptSuffix ?? Date.now()}-a${attempt}.png`,
      buffer: gen.buffer,
      contentType: 'image/png',
    });

    const scored = await scoreResemblanceAgainstReference({
      referenceImageUrl: input.baseAnchorUrl,
      candidateImageUrl: url,
      effectiveThreshold: 0.7,
      minAcceptableScore: 0.7,
    });
    const embedding = evaluateAnchorEmbeddingScore(scored.resemblanceScore, anchorGate);
    const styleQa = await evaluateAnchorStyleFromVision(url);
    const stylePass = styleQa.ok;

    const shoutingMin =
      Number.parseFloat(process.env.CHILD_EXPRESSION_SHOUTING_MIN_RESEMBLANCE ?? '0.28') || 0.28;
    const minResemblance = input.kind === 'shouting' ? shoutingMin : anchorGate.embeddingHardFailBelow;

    const identityOk = !embedding.hardFail && scored.resemblanceScore >= minResemblance;
    if (identityOk && stylePass) {
      return {
        kind: input.kind,
        url,
        resemblanceToBase: scored.resemblanceScore,
        styleQaPass: stylePass,
        qaStatus: 'passed',
        attempts: attempt,
      };
    }

    lastFailure = `resemblance=${scored.resemblanceScore.toFixed(3)} style=${stylePass} embedding=${embedding.verdict}`;
    console.warn(
      `[child_expression_sheet] reject kind=${input.kind} attempt=${attempt}/${maxAttempts} ${lastFailure}`
    );
  }

  throw new Error(
    `Expression anchor "${input.kind}" failed QA after ${maxAttempts} attempts: ${lastFailure}`
  );
}

export async function generateShoutingVariantAnchor(input: {
  order: Pick<Order, 'id'>;
  variant: 'v2' | 'v3';
  baseAnchorUrl: string;
  directionAnchorUrl?: string;
  lockedChildDescription: string;
  wardrobeLock?: string;
}): Promise<{ variant: 'v2' | 'v3'; url: string; resemblanceToBase: number }> {
  const refs = [input.baseAnchorUrl];
  if (input.directionAnchorUrl) refs.push(input.directionAnchorUrl);
  const prompt = [
    'MINI CHILD EXPRESSION ANCHOR — shouting variant (Style 01 watercolor).',
    'Edit from canonical Mia anchor. Isolated character, near-empty cream background.',
    SHOUTING_VARIANT_PROMPTS[input.variant],
    EXPRESSION_SCENE.shouting,
    STYLE_01_SHARED,
    STYLE_01_RENDERING_CORRECTION,
    `CHILD VISUAL LOCK: ${input.lockedChildDescription}`,
    input.wardrobeLock ?? '',
    STYLE_01_NO_TEXT,
    STYLE_01_ANTI_STYLE02,
  ]
    .filter(Boolean)
    .join('\n\n');

  const gen = await generateGPTImage({
    finalPrompt: prompt,
    negativePrompt: STYLE_01_AVOIDANCE_NEGATIVE,
    referenceImages: refs,
    referenceMode:
      refs.length > 1 ? 'anchor_expression_with_direction' : 'anchor_expression_from_canonical',
    requireReferenceEdit: true,
    size: '1024x1536',
    quality: (process.env.GPT_IMAGE_QUALITY?.trim() || 'low') as 'low' | 'medium' | 'high',
    modelOverride: resolveStyle01GptModel(),
  });

  const url = await uploadOrderSubpathAsset({
    orderId: input.order.id,
    subpath: `character-anchors/child-expression-shouting-${input.variant}-${Date.now()}.png`,
    buffer: gen.buffer,
    contentType: 'image/png',
  });

  const scored = await scoreResemblanceAgainstReference({
    referenceImageUrl: input.baseAnchorUrl,
    candidateImageUrl: url,
    effectiveThreshold: 0.7,
    minAcceptableScore: 0.7,
  });
  const anchorGate = resolveAnchorGateConfig();
  const embedding = evaluateAnchorEmbeddingScore(scored.resemblanceScore, anchorGate);
  const shoutingMin =
    Number.parseFloat(process.env.CHILD_EXPRESSION_SHOUTING_MIN_RESEMBLANCE ?? '0.28') || 0.28;
  if (embedding.hardFail || scored.resemblanceScore < shoutingMin) {
    throw new Error(
      `Shouting ${input.variant} failed identity QA: resemblance=${scored.resemblanceScore.toFixed(3)}`
    );
  }

  return { variant: input.variant, url, resemblanceToBase: scored.resemblanceScore };
}

export async function generateFullChildExpressionSheet(input: {
  order: Order;
  baseAnchorUrl: string;
  lockedChildDescription: string;
  wardrobeLock?: string;
}): Promise<ChildExpressionSheetBundle> {
  const anchors: ChildExpressionSheetBundle['anchors'] = {};
  const suffix = Date.now();

  for (const kind of CHILD_EXPRESSION_KINDS) {
    console.log(`[child_expression_sheet] generating kind=${kind} orderId=${input.order.id}`);
    const result = await generateChildExpressionAnchor({
      order: input.order,
      kind,
      baseAnchorUrl: input.baseAnchorUrl,
      lockedChildDescription: input.lockedChildDescription,
      wardrobeLock: input.wardrobeLock,
      attemptSuffix: `${suffix}-${kind}`,
    });
    anchors[kind] = {
      url: result.url,
      qaStatus: result.qaStatus,
      resemblanceToBase: result.resemblanceToBase,
      styleQaPass: result.styleQaPass,
      attempts: result.attempts,
      createdAt: new Date().toISOString(),
    };
  }

  return {
    baseAnchorUrl: input.baseAnchorUrl,
    approved: false,
    anchors,
  };
}

export function mergeChildExpressionSheetIntoCache(
  cache: PipelineCache,
  sheet: ChildExpressionSheetBundle
): PipelineCache {
  return { ...cache, childExpressionSheet: sheet };
}
