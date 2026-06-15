import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import type { Order } from '@prisma/client';
import sharp from 'sharp';
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
import {
  STYLE_01_AVOIDANCE_NEGATIVE,
  resolveStyle01GptModel,
} from '@/lib/style01-gptimage';
import { LION_SHAKET_BEDTIME_WARDROBE_LOCK } from '@/lib/style01-story-wardrobe';
import { describeChildFromPhoto } from '@/backend/providers/story-bank-loader';
import {
  buildStage0MethodBPrompt,
  buildStage0MethodBReferences,
  type Stage0MethodBReferenceLayout,
} from './stage0-method-b';

/** Corrected Bar identity — olive/tan, not vision-misread "warm pale". */
export const LION_BEDTIME_BAR_CHILD_PHOTO_DESCRIPTION =
  'Round face with prominent cheeks. Warm olive / tan sun-kissed skin tone (NOT pale). Short dark brown curly hair with unruly volume. Large dark brown eyes.';

export const LION_BEDTIME_BAR_LOCKED_CHILD_DESCRIPTION =
  'Round face with prominent cheeks. Warm olive / tan sun-kissed skin tone (NOT pale). Short dark brown curly hair with unruly volume. Large dark brown eyes. Build and height appropriate for a 5-year-old boy.';

export type LionBedtimeBarAnchorVariant = 'A' | 'B';

export type LionBedtimeBarAnchorVariantSpec = {
  variant: LionBedtimeBarAnchorVariant;
  label: string;
  layout: Stage0MethodBReferenceLayout;
  skipped?: false;
};

export const LION_BEDTIME_BAR_ANCHOR_VARIANTS: LionBedtimeBarAnchorVariantSpec[] = [
  {
    variant: 'A',
    label: 'Photo FIRST + template + style refs',
    layout: 'photo_first_with_template',
  },
  {
    variant: 'B',
    label: 'Photo + style refs ONLY (no boy.png template)',
    layout: 'photo_only_no_template',
  },
];

export type LionBedtimeBarFivePointGate = {
  resemblesBar: 'auto_pass' | 'auto_fail' | 'eyeball_required';
  correctPajama: 'auto_pass' | 'auto_fail' | 'eyeball_required';
  notDayClothes: 'auto_pass' | 'auto_fail' | 'eyeball_required';
  notPhotorealistic: 'auto_pass' | 'auto_fail' | 'eyeball_required';
  stillStyle01: 'auto_pass' | 'auto_fail' | 'eyeball_required';
  notes: string[];
};

export type LionBedtimeBarAnchorVariantResult = LionBedtimeBarAnchorVariantSpec & {
  localPngPath: string;
  promptPath: string;
  resemblanceScore: number;
  pageThreshold: number;
  embeddingVerdict: string;
  styleQa: Awaited<ReturnType<typeof evaluateAnchorStyleFromVision>>;
  semantic: ReturnType<typeof evaluateAnchorSemanticQa>;
  anchorVisionDescription: string | null;
  referenceOrderLabels: string[];
  referenceMode: string;
  fivePointGate: LionBedtimeBarFivePointGate;
  prompt: string;
};

function buildFakeBarOrder(): Pick<Order, 'id' | 'childGender' | 'childAge' | 'childName' | 'illustrationStyle'> {
  return {
    id: 'lion-bedtime-bar-experiment',
    childGender: 'boy',
    childAge: 5,
    childName: 'עומר',
    illustrationStyle: 'soft_hand_drawn_storybook' as Order['illustrationStyle'],
  };
}

function evaluateFivePointGate(input: {
  variant: LionBedtimeBarAnchorVariant;
  resemblanceScore: number;
  styleQa: Awaited<ReturnType<typeof evaluateAnchorStyleFromVision>>;
  anchorVisionDescription: string | null;
  pageThreshold: number;
}): LionBedtimeBarFivePointGate {
  const vision = (input.anchorVisionDescription ?? '').toLowerCase();
  const notes: string[] = [];

  const resemblesBar =
    input.resemblanceScore >= input.pageThreshold
      ? ('auto_pass' as const)
      : input.resemblanceScore >= 0.55
        ? ('eyeball_required' as const)
        : ('eyeball_required' as const);

  if (input.resemblanceScore < input.pageThreshold) {
    notes.push(`resemblance ${input.resemblanceScore.toFixed(3)} below gate ${input.pageThreshold.toFixed(2)} — eyeball #1`);
  }

  const pajamaHits = /pajama|pyjama|moons|moon-and|slipper-sock|sleepwear|cream.*beige|sand-beige/.test(vision);
  const correctPajama = pajamaHits ? 'auto_pass' : 'eyeball_required';
  if (!pajamaHits) notes.push('vision did not confirm pajamas — eyeball #2');

  const dayClothesHits = /t-shirt|denim|sneaker|shorts|shirtless|bare chest|beach|outdoor|swim/.test(vision);
  const notDayClothes = dayClothesHits ? 'auto_fail' : 'auto_pass';
  if (dayClothesHits) notes.push('vision flagged day-clothes/beach cues — FAIL #3');

  if (input.variant === 'A' && /shirtless|bare chest|beach|outdoor sun/.test(vision)) {
    notes.push('Variant A risk: photo-first pulled outdoor/shirtless cues');
  }

  const notPhotorealistic = input.styleQa.looksPhotoreal || input.styleQa.looksPortrait ? 'auto_fail' : 'auto_pass';
  if (input.styleQa.looksPhotoreal || input.styleQa.looksPortrait) {
    notes.push(`style QA photoreal=${input.styleQa.looksPhotoreal} portrait=${input.styleQa.looksPortrait}`);
  }

  const stillStyle01 = input.styleQa.style01Match && input.styleQa.ok ? 'auto_pass' : 'eyeball_required';
  if (!input.styleQa.style01Match) notes.push('style QA did not confirm Style 01 — eyeball #5');

  return {
    resemblesBar,
    correctPajama,
    notDayClothes,
    notPhotorealistic,
    stillStyle01,
    notes,
  };
}

export async function runLionBedtimeBarAnchorVariant(input: {
  childPhotoUrl: string;
  outDir: string;
  spec: LionBedtimeBarAnchorVariantSpec;
}): Promise<LionBedtimeBarAnchorVariantResult> {
  const order = buildFakeBarOrder() as Order;
  const wardrobeLock = LION_SHAKET_BEDTIME_WARDROBE_LOCK;
  const lockedChildDescription = LION_BEDTIME_BAR_LOCKED_CHILD_DESCRIPTION;
  const childPhotoDescription = LION_BEDTIME_BAR_CHILD_PHOTO_DESCRIPTION;

  const refs = buildStage0MethodBReferences({
    childPhotoUrl: input.childPhotoUrl,
    childGender: order.childGender,
    layout: input.spec.layout,
  });

  const prompt = buildStage0MethodBPrompt({
    order,
    lockedChildDescription,
    wardrobeLock,
    childPhotoDescription,
  });

  mkdirSync(input.outDir, { recursive: true });
  const localPngPath = path.join(input.outDir, `variant-${input.spec.variant}.png`);
  const promptPath = path.join(input.outDir, `variant-${input.spec.variant}-prompt.txt`);
  writeFileSync(promptPath, prompt, 'utf-8');

  process.env.GPT_IMAGE_QUALITY = 'low';
  const gen = await generateGPTImage({
    finalPrompt: prompt,
    negativePrompt: STYLE_01_AVOIDANCE_NEGATIVE,
    referenceImages: refs.paths,
    referenceMode: refs.referenceMode,
    requireReferenceEdit: true,
    size: '1024x1536',
    quality: 'low',
    modelOverride: resolveStyle01GptModel(),
  });
  writeFileSync(localPngPath, gen.buffer);

  const thresholdConfig = resolveResemblanceThresholdConfig();
  const pageThreshold = resolveEffectiveThreshold(order.illustrationStyle, thresholdConfig);
  const anchorGate = resolveAnchorGateConfig();

  const similarity = await scoreResemblanceAgainstReference({
    referenceImageUrl: input.childPhotoUrl,
    candidateImageUrl: localPngPath,
    effectiveThreshold: pageThreshold,
    minAcceptableScore: thresholdConfig.minAcceptableScore,
  });
  const embeddingEval = evaluateAnchorEmbeddingScore(similarity.resemblanceScore, anchorGate);
  const anchorVisionDescription = await describeChildFromPhoto(localPngPath).catch(() => null);
  const semantic = evaluateAnchorSemanticQa({
    childGender: order.childGender,
    childPhotoDescription,
    childStructuredHair: 'Short dark brown curly hair with unruly volume.',
    anchorVisionDescription: anchorVisionDescription,
    faceDetectConfidence: similarity.faceDetectConfidence,
    config: anchorGate,
  });
  const styleQa = await evaluateAnchorStyleFromVision(localPngPath);

  const fivePointGate = evaluateFivePointGate({
    variant: input.spec.variant,
    resemblanceScore: similarity.resemblanceScore,
    styleQa,
    anchorVisionDescription,
    pageThreshold,
  });

  return {
    ...input.spec,
    localPngPath,
    promptPath,
    resemblanceScore: similarity.resemblanceScore,
    pageThreshold,
    embeddingVerdict: embeddingEval.verdict,
    styleQa,
    semantic,
    anchorVisionDescription,
    referenceOrderLabels: refs.labels,
    referenceMode: refs.referenceMode,
    fivePointGate,
    prompt,
  };
}

export async function runLionBedtimeBarAnchorExperiment(input: {
  childPhotoUrl: string;
  outDir: string;
}): Promise<LionBedtimeBarAnchorVariantResult[]> {
  const results: LionBedtimeBarAnchorVariantResult[] = [];
  for (const spec of LION_BEDTIME_BAR_ANCHOR_VARIANTS) {
    console.log(`[lion_bar_anchor_experiment] variant ${spec.variant} (${spec.label}) starting`);
    const result = await runLionBedtimeBarAnchorVariant({
      childPhotoUrl: input.childPhotoUrl,
      outDir: input.outDir,
      spec,
    });
    results.push(result);
    console.log(
      `[lion_bar_anchor_experiment] variant ${spec.variant} done score=${result.resemblanceScore.toFixed(3)} ` +
        `styleOk=${result.styleQa.ok} semanticOk=${result.semantic.ok}`
    );
  }
  return results;
}

export async function buildLionBedtimeBarContactSheet(
  results: LionBedtimeBarAnchorVariantResult[],
  outPath: string
): Promise<void> {
  const images = await Promise.all(
    results.map(async (r) => {
      const meta = await sharp(r.localPngPath).metadata();
      return {
        variant: r.variant,
        score: r.resemblanceScore,
        buffer: await sharp(r.localPngPath)
          .resize(512, 768, { fit: 'inside' })
          .png()
          .toBuffer(),
        width: 512,
        height: 768,
      };
    })
  );

  const gap = 24;
  const labelHeight = 48;
  const tileWidth = 512;
  const tileHeight = 768 + labelHeight;
  const width = images.length * tileWidth + (images.length + 1) * gap;
  const height = tileHeight + gap * 2;

  const composites: sharp.OverlayOptions[] = [];
  images.forEach((img, index) => {
    const left = gap + index * (tileWidth + gap);
    composites.push({ input: img.buffer, left, top: gap + labelHeight });
  });

  const svgLabels = images
    .map((img, index) => {
      const x = gap + index * (tileWidth + gap) + tileWidth / 2;
      const y = gap + 32;
      return `<text x="${x}" y="${y}" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" fill="#222">Variant ${img.variant} — resemblance ${img.score.toFixed(3)}</text>`;
    })
    .join('');

  const base = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: '#f5f0e8',
    },
  });

  await base
    .composite([
      { input: Buffer.from(`<svg width="${width}" height="${height}">${svgLabels}</svg>`), top: 0, left: 0 },
      ...composites,
    ])
    .png()
    .toFile(outPath);
}

export function formatLionBedtimeBarExperimentReport(
  results: LionBedtimeBarAnchorVariantResult[]
): string {
  const lines = [
    '# Lion bedtime Bar — Stage 0 anchor resemblance experiment (Brief F)',
    '',
    '**Variant C skipped** — no face-less / pose-only template asset exists.',
    '',
    `Corrected identity skin: **warm olive / tan sun-kissed** (NOT pale).`,
    '',
    '| Var | Layout | Resemblance | Gate | Style QA | 5-pt summary |',
    '|-----|--------|-------------|------|----------|--------------|',
  ];

  for (const r of results) {
    const gate = r.fivePointGate;
    const fivePt = [
      `#1 ${gate.resemblesBar}`,
      `#2 ${gate.correctPajama}`,
      `#3 ${gate.notDayClothes}`,
      `#4 ${gate.notPhotorealistic}`,
      `#5 ${gate.stillStyle01}`,
    ].join('; ');
    lines.push(
      `| ${r.variant} | ${r.referenceOrderLabels.join(' → ')} | ${r.resemblanceScore.toFixed(3)} | ${r.pageThreshold.toFixed(2)} | ${r.styleQa.ok ? 'OK' : 'FAIL'} | ${fivePt} |`
    );
  }

  lines.push('', '## Per-variant details', '');
  for (const r of results) {
    lines.push(`### Variant ${r.variant} — ${r.label}`);
    lines.push(`![${r.variant}](${path.basename(r.localPngPath)})`);
    lines.push('');
    lines.push(`- **resemblance:** ${r.resemblanceScore.toFixed(3)} (gate ${r.pageThreshold.toFixed(2)})`);
    lines.push(`- **embedding:** ${r.embeddingVerdict}`);
    lines.push(`- **refMode:** ${r.referenceMode}`);
    lines.push(`- **refs:** ${r.referenceOrderLabels.join(' → ')}`);
    lines.push(`- **vision:** ${r.anchorVisionDescription ?? '(none)'}`);
    if (r.fivePointGate.notes.length) {
      lines.push(`- **gate notes:** ${r.fivePointGate.notes.join(' · ')}`);
    }
    lines.push('');
    lines.push('**5-point gate (Guy eyeball):**');
    lines.push('1. Resembles Bar (curly dark hair, olive/tan, round face, large eyes, prominent cheeks)');
    lines.push('2. Correct pajama (cream/sand moons-and-dots)');
    lines.push('3. NOT day clothes / shirtless / beach');
    lines.push('4. NOT photorealistic');
    lines.push('5. Still Style 01 watercolor');
    if (r.variant === 'A') {
      lines.push('');
      lines.push('⚠️ Variant A: check #2/#3 hard — photo-first may pull shirtless/beach cues.');
    }
    lines.push('');
  }

  return lines.join('\n');
}
