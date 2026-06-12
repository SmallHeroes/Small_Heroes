/**
 * Phase A — BookShotPlan composition compliance calibration (diagnostic only).
 *
 * Four single LOW renders with forced PageShot / COMPOSITION overrides.
 * Uses existing order anchors + bunny v3 bank closed builders — no pipeline changes.
 *
 *   npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs \
 *     scripts/run-phase-a-shot-plan-calibration.ts [--orderId=<id>] [--fixture=<json>] [--dry-run]
 *     scripts/run-phase-a-shot-plan-calibration.ts --pages=wide,close,low
 *     scripts/run-phase-a-shot-plan-calibration.ts --pages=wide,close,low,ots
 *
 * Output: outputs/phase-a-calibration/<timestamp>/
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

import { prisma } from '../lib/prisma';
import { parsePipelineCache } from '../lib/generation-pipeline/helpers';
import type { PipelineCache } from '../lib/generation-pipeline/types';
import type { Order } from '@prisma/client';
import {
  getApprovedChildCanonicalAnchor,
  getChildCanonicalAnchor,
} from '../lib/generation-pipeline/character-anchor-store';
import {
  buildImagePipelineAnchors,
  resolveCompanionForOrder,
} from '../lib/generation-pipeline/anchor-registry';
import { getWizardMeta } from '../lib/orderMeta';
import { loadStoryFromBank } from '../backend/providers/story-bank-loader';
import { buildEnrichedScenePrompt, deriveLayout } from '../backend/providers/image-prompt-enricher';
import { assembleStyle01Phase2Prompt } from '../lib/style01-prompt-assembly';
import {
  STYLE_01_AVOIDANCE_NEGATIVE,
  assembleStyle01BookReferences,
  resolveStyle01CompanionReferencePaths,
  resolveStyle01RefBudgetConfig,
  resolveStyle01GptModel,
  resolveStyle01StyleReferencePaths,
} from '../lib/style01-gptimage';
import { formatPageShotFramingSummary } from '../lib/book-shot-plan/compose';
import type { PageShot } from '../lib/book-shot-plan/types';
import { childPresenceAllowsReferencePhoto } from '../lib/image-entity-presence';
import { mergeGptImageReferenceSources } from '../lib/image-reference-utils';
import {
  isChildExpressionSheetActive,
  resolveApprovedExpressionAnchorUrl,
} from '../lib/generation-pipeline/child-expression-sheet';
import { resolveChildExpressionKindForPage } from '../lib/generation-pipeline/child-expression-page-map';
import { generateGPTImage } from '../lib/generate-image';
import { assertCompanionSheetRenderable } from '../lib/style01-gptimage';

const BANK_FILE = path.join(process.cwd(), 'story-bank', 'v3-approved', 'bunny_ometz_bedtime.md');
const DEFAULT_ORDER_ID = 'cmq8gafgs00004wq0b4nbb4x9';

type TriScore = 'PASS' | 'PARTIAL' | 'FAIL';

type CalibrationTarget = {
  id: string;
  page: number;
  pageShot: PageShot;
  /** Replace assembled composition block (Phase A probe). */
  customComposition?: string;
  /** Replace FRAMING RULE section (Phase A probe). */
  customFraming?: string;
  /** Override imageDirection for establishing / conflict cases. */
  sceneOverride?: string;
  judgeBrief: string;
};

const PAGE_FILTER_ALIASES: Record<string, string> = {
  wide: 'p1_establishing_wide',
  close: 'p7_close_up_calibration',
  low: 'p4_dynamic_low',
  ots: 'p6_ots_calibration',
};

const CALIBRATION_TARGETS: CalibrationTarget[] = [
  {
    id: 'p1_establishing_wide',
    page: 1,
    pageShot: {
      page: 1,
      shot: 'establishing_wide',
      angle: 'eye',
      rationale: 'Phase A: true establishing — small characters, environment-led, full clinic room',
    },
    sceneOverride:
      'wide establishing view inside pediatric clinic exam room, small child and cream bunny on exam table, nurse at doorway, full room depth and furniture visible, characters embedded small in environment',
    judgeBrief:
      'Must read as WIDE ESTABLISHING: full clinic room visible, child+bunny relatively SMALL (environment leads). FAIL if medium eye-level portrait crop or characters dominate >40% frame height.',
  },
  {
    id: 'p7_close_up_calibration',
    page: 7,
    pageShot: {
      page: 7,
      shot: 'close_up',
      rationale: 'Phase A: true close-up — face+hands fill frame (B1 shot-aware)',
    },
    judgeBrief:
      'Must read as TRUE CLOSE-UP: face and/or hands fill most of frame (emotional tapping/laugh beat). PARTIAL if medium-wide. FAIL if wide establishing or only medium shot.',
  },
  {
    id: 'p4_dynamic_low',
    page: 4,
    pageShot: {
      page: 4,
      shot: 'dynamic_angle',
      angle: 'low',
      rationale: 'Phase A: bunny on chair heroic shout — low angle action',
    },
    judgeBrief:
      'Must read as LOW ANGLE dynamic action: bunny on chair, heroic energy, upward camera. FAIL if flat eye-level medium with no low-angle drama.',
  },
  {
    id: 'p6_ots_calibration',
    page: 6,
    pageShot: {
      page: 6,
      shot: 'medium',
      angle: 'over_shoulder',
      rationale: 'Phase A: OTS toward nurse+thermometer (manual angle override)',
    },
    judgeBrief:
      'Must read as OVER-THE-SHOULDER: child shoulder/back-of-head foreground, nurse+thermometer readable ahead. PARTIAL if frontal medium group shot. FAIL if no OTS depth cue.',
  },
];

type FixtureBundle = {
  order: Pick<
    Order,
    | 'id'
    | 'childName'
    | 'childAge'
    | 'childGender'
    | 'childImageUrl'
    | 'illustrationStyle'
    | 'characterAnchors'
    | 'topic'
    | 'storyDirection'
  >;
  pipelineCache: PipelineCache;
};

function parseArgs(): {
  orderId: string;
  dryRun: boolean;
  fixturePath: string | null;
  pagesFilter: string[] | null;
} {
  let orderId = DEFAULT_ORDER_ID;
  let dryRun = false;
  let fixturePath: string | null = null;
  let pagesFilter: string[] | null = null;
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg.startsWith('--orderId=')) orderId = arg.split('=')[1]?.trim() || orderId;
    else if (arg.startsWith('--fixture=')) fixturePath = arg.split('=')[1]?.trim() || null;
    else if (arg.startsWith('--pages=')) {
      pagesFilter = arg
        .split('=')[1]
        ?.split(',')
        .map((s) => s.trim())
        .filter(Boolean) ?? [];
    } else if (!arg.startsWith('--')) orderId = arg.trim();
  }
  return { orderId, dryRun, fixturePath, pagesFilter };
}

function selectCalibrationTargets(filter: string[] | null): CalibrationTarget[] {
  if (!filter?.length) return CALIBRATION_TARGETS;
  const ids = new Set(
    filter.map((key) => PAGE_FILTER_ALIASES[key] ?? key).filter(Boolean)
  );
  const selected = CALIBRATION_TARGETS.filter((t) => ids.has(t.id));
  if (!selected.length) {
    throw new Error(
      `No calibration targets matched --pages=${filter.join(',')} (aliases: wide, close, low, ots)`
    );
  }
  return selected;
}

function loadFixture(fixturePath: string): FixtureBundle {
  const resolved = path.isAbsolute(fixturePath)
    ? fixturePath
    : path.join(process.cwd(), fixturePath);
  if (!fs.existsSync(resolved)) throw new Error(`Fixture not found: ${resolved}`);
  return JSON.parse(fs.readFileSync(resolved, 'utf8')) as FixtureBundle;
}

function replaceFramingRule(prompt: string, newFraming: string): string {
  const start = prompt.indexOf('FRAMING RULE');
  const styleStart = prompt.indexOf('Style 01:');
  if (start < 0 || styleStart <= start) return prompt;
  return `${prompt.slice(0, start)}${newFraming}\n\n${prompt.slice(styleStart)}`;
}

async function buildContactSheet2x2(imagePaths: string[], outPath: string): Promise<void> {
  const tileW = 512;
  const tileH = 640;
  const labelH = 36;
  const composites: sharp.OverlayOptions[] = [];
  const positions = [
    { left: 0, top: 0 },
    { left: tileW, top: 0 },
    { left: 0, top: tileH + labelH },
    { left: tileW, top: tileH + labelH },
  ];

  for (let i = 0; i < imagePaths.length; i++) {
    const file = imagePaths[i];
    const label = path.basename(file, '.png');
    const tile = await sharp(file)
      .resize(tileW, tileH, { fit: 'contain', background: '#f4efe3' })
      .png()
      .toBuffer();
    const pos = positions[i];
    composites.push({ input: tile, left: pos.left, top: pos.top + labelH });
    const labelSvg = Buffer.from(
      `<svg width="${tileW}" height="${labelH}"><text x="8" y="24" font-family="sans-serif" font-size="18" fill="#333">${label}</text></svg>`
    );
    composites.push({ input: labelSvg, left: pos.left, top: pos.top });
  }

  await sharp({
    create: {
      width: tileW * 2,
      height: (tileH + labelH) * 2,
      channels: 3,
      background: '#f4efe3',
    },
  })
    .composite(composites)
    .png()
    .toFile(outPath);
}

async function judgeCompliance(args: {
  imagePath: string;
  target: CalibrationTarget;
  compositionBlock: string;
}): Promise<{
  compositionCompliance: TriScore;
  identitySurvival: TriScore;
  storybookReadability: TriScore;
  notes: string;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      compositionCompliance: 'PARTIAL',
      identitySurvival: 'PARTIAL',
      storybookReadability: 'PARTIAL',
      notes: 'OPENAI_API_KEY missing — vision judge skipped',
    };
  }

  const b64 = fs.readFileSync(args.imagePath).toString('base64');
  const dataUrl = `data:image/png;base64,${b64}`;
  const visionModel = process.env.CHILD_PHOTO_VISION_MODEL?.trim() || 'gpt-4o';

  const prompt = `You are a STRICT composition-compliance judge for Phase A BookShotPlan calibration.
Judge obedience to the requested shot — NOT beauty, NOT art quality.

TARGET: ${args.target.id} (page ${args.target.page})
EXPECTED: ${args.target.judgeBrief}

COMPOSITION BLOCK SENT TO IMAGE MODEL:
${args.compositionBlock}

Return ONLY JSON:
{
  "compositionCompliance": "PASS" | "PARTIAL" | "FAIL",
  "identitySurvival": "PASS" | "PARTIAL" | "FAIL",
  "storybookReadability": "PASS" | "PARTIAL" | "FAIL",
  "notes": "one or two sentences — cite what obeyed or violated the shot"
}

Scoring guide:
- compositionCompliance: does framing match the expected shot type?
- identitySurvival: child remains recognizable storybook protagonist (hair/face/age); bunny companion on-model (cream bunny, floppy ears) — not generic random rabbit
- storybookReadability: soft watercolor picture-book (NOT photoreal), scene beat readable for parent read-aloud`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: visionModel,
      max_tokens: 400,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    return {
      compositionCompliance: 'PARTIAL',
      identitySurvival: 'PARTIAL',
      storybookReadability: 'PARTIAL',
      notes: `Vision judge HTTP ${res.status}`,
    };
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}') as {
    compositionCompliance?: TriScore;
    identitySurvival?: TriScore;
    storybookReadability?: TriScore;
    notes?: string;
  };

  const norm = (v: unknown): TriScore =>
    v === 'PASS' || v === 'PARTIAL' || v === 'FAIL' ? v : 'PARTIAL';

  return {
    compositionCompliance: norm(parsed.compositionCompliance),
    identitySurvival: norm(parsed.identitySurvival),
    storybookReadability: norm(parsed.storybookReadability),
    notes: parsed.notes ?? '',
  };
}

async function main(): Promise<void> {
  const { orderId, dryRun, fixturePath, pagesFilter } = parseArgs();
  const targets = selectCalibrationTargets(pagesFilter);
  if (process.env.PHASE2_STYLE01_BOOK_PIPELINE?.trim() !== 'true') {
    throw new Error('PHASE2_STYLE01_BOOK_PIPELINE must be true');
  }
  if (!fs.existsSync(BANK_FILE)) throw new Error(`Missing bank file: ${BANK_FILE}`);

  process.env.GPT_IMAGE_QUALITY = 'low';

  let order: Pick<
    Order,
    | 'id'
    | 'childName'
    | 'childAge'
    | 'childGender'
    | 'childImageUrl'
    | 'illustrationStyle'
    | 'characterAnchors'
    | 'topic'
    | 'storyDirection'
  >;
  let cache: PipelineCache;

  if (fixturePath) {
    usedFixture = true;
    const fixture = loadFixture(fixturePath);
    order = { ...fixture.order, id: fixture.order.id || orderId };
    cache = parsePipelineCache(fixture.pipelineCache);
    console.log(`[phase-a] loaded fixture ${fixturePath}`);
  } else {
    const dbOrder = await prisma.order.findUnique({ where: { id: orderId } });
    if (!dbOrder) throw new Error(`Order ${orderId} not found`);
    order = dbOrder;
    const job = await prisma.generationJob.findUnique({ where: { orderId } });
    if (!job) throw new Error(`GenerationJob missing for ${orderId} — need anchors in pipeline cache`);
    cache = parsePipelineCache(job.pipelineCache);
  }

  if (order.illustrationStyle !== 'pencil_watercolor') {
    throw new Error(`Order must be Style 01 (pencil_watercolor), got ${order.illustrationStyle}`);
  }
  if (!order.childImageUrl) throw new Error('Order has no childImageUrl');
  const companion = resolveCompanionForOrder(order as Order);
  if (!companion) throw new Error('Companion did not resolve');
  assertCompanionSheetRenderable(companion);

  const approvedChildAnchor = getApprovedChildCanonicalAnchor(cache);
  const childAnchor = getChildCanonicalAnchor(cache);
  if (!approvedChildAnchor?.url && !childAnchor?.url) {
    throw new Error('No child canonical anchor in cache — run Stage-0 on this order first');
  }

  const wizardMeta = getWizardMeta(order.characterAnchors);
  const challengeCategory = wizardMeta.challengeCategory ?? 'MEDICAL_PROCEDURE';
  const refConfig = resolveStyle01RefBudgetConfig();
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const expressionActive = isChildExpressionSheetActive(cache);

  const story = await loadStoryFromBank(
    BANK_FILE,
    order.childName || '',
    companion.name,
    order.childGender || undefined,
    { skipLlmPersonalization: true }
  );

  buildImagePipelineAnchors({
    order: order as Order,
    lockedChildDescription: cache.lockedChildDescription ?? cache.dna?.childDNA ?? '',
    resolvedCompanion: companion,
    characterSheet: story.characterSheet,
    appBaseUrl,
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(process.cwd(), 'outputs', 'phase-a-calibration', timestamp);
  fs.mkdirSync(outDir, { recursive: true });

  const model = resolveStyle01GptModel();
  const quality = 'low';
  const pageRecords: Array<Record<string, unknown>> = [];
  const imagePaths: string[] = [];

  console.log(`[phase-a] calibration → ${outDir}`);
  console.log(`[phase-a] order=${orderId} model=${model} quality=${quality} dryRun=${dryRun}`);

  for (const target of targets) {
    const page = story.pages.find((p) => p.pageNumber === target.page);
    if (!page) throw new Error(`Page ${target.page} missing from bank story`);

    const layout = deriveLayout({
      pageNumber: target.page,
      totalPages: story.pages.length,
      text: page.text,
      isLetter: Boolean(page.isLetter),
    });
    const enriched = buildEnrichedScenePrompt({
      rawScenePrompt: target.sceneOverride ?? page.rawScenePrompt,
      imagePrompt: target.sceneOverride ?? page.imagePrompt,
      layout,
      text: page.text,
      textZone: null,
      isLetter: page.isLetter,
      pageNumber: target.page,
      totalPages: story.pages.length,
      pageShot: target.pageShot,
    });

    const assembled = assembleStyle01Phase2Prompt({
      pageNumber: target.page,
      totalPages: story.pages.length,
      pagePrompt: enriched.imagePrompt,
      rawScenePrompt: enriched.rawScenePrompt,
      bookPageText: page.text,
      childFirstName: order.childName,
      childAge: order.childAge,
      childGender: order.childGender,
      childDescription: cache.lockedChildDescription ?? cache.dna?.childDNA ?? '',
      childStructured: cache.dna?.childStructured,
      companion: {
        id: companion.id,
        name: companion.name,
        visualDescription: companion.visualDescription,
        image: companion.image,
      },
      companionStructured: cache.dna?.companionStructured,
      familyCoherence: cache.familyCoherence ?? null,
      storyRecurringEntityDeclarations: story.storyRecurringEntities,
      storyTimeOfDay: story.storyTimeOfDay,
      pageTimeOfDayOverrides: story.pageTimeOfDayOverrides,
      challengeCategory,
      pageShot: target.pageShot,
      explicitCloseUp: target.pageShot.shot === 'close_up',
    });

    let finalPrompt = assembled.prompt;
    let compositionBlock = assembled.compositionBlock;
    if (target.customComposition) {
      finalPrompt = finalPrompt.replace(compositionBlock, target.customComposition);
      compositionBlock = target.customComposition;
    }
    if (target.customFraming) {
      finalPrompt = replaceFramingRule(finalPrompt, target.customFraming);
    }

    const companionRefPaths =
      assembled.entityPresence.companionPresence === 'absent'
        ? []
        : resolveStyle01CompanionReferencePaths({
            companionId: companion.id,
            companionImage: companion.image,
            companionPresence: assembled.entityPresence.companionPresence,
            pageNumber: target.page,
            imagePrompt: enriched.imagePrompt,
            bookPageText: page.text,
            rawScenePrompt: enriched.rawScenePrompt,
          });
    const useMultiCompanionSheets = companionRefPaths.length >= 3;
    const styleRefCount = useMultiCompanionSheets ? 1 : refConfig === 'A' ? 2 : 3;
    const styleRefPaths = resolveStyle01StyleReferencePaths(assembled.sceneClass, styleRefCount);

    const baseChildUrl = approvedChildAnchor?.url ?? childAnchor?.url;
    let childRefUrl = baseChildUrl
      ? mergeGptImageReferenceSources(baseChildUrl, companion, appBaseUrl)?.[0] ?? baseChildUrl
      : undefined;
    if (!childRefUrl) throw new Error('Child anchor URL missing after merge');
    let exprKind: string | null = null;
    if (expressionActive) {
      exprKind = resolveChildExpressionKindForPage({
        pageNumber: target.page,
        imagePrompt: page.imagePrompt,
        bookPageText: page.text,
        rawScenePrompt: page.rawScenePrompt,
        companionId: companion.id,
      });
      childRefUrl =
        resolveApprovedExpressionAnchorUrl(cache, exprKind as never) ?? childRefUrl;
    }

    const includeChildPhoto = childPresenceAllowsReferencePhoto(assembled.entityPresence.childPresence);
    const { paths: referenceOrder, breakdown } = assembleStyle01BookReferences({
      styleRefPaths,
      childPhotoPath: refConfig === 'C' ? undefined : childRefUrl,
      companionRefPaths: refConfig === 'B' ? undefined : companionRefPaths,
      otherCharacterRefPaths: [],
      config: refConfig,
      includeChildPhoto,
      useMultiCompanionSheets,
    });

    const promptPath = path.join(outDir, `${target.id}-prompt.txt`);
    fs.writeFileSync(promptPath, finalPrompt, 'utf8');
    fs.writeFileSync(
      path.join(outDir, `${target.id}-meta.json`),
      JSON.stringify(
        {
          page: target.page,
          pageShotOverride: target.pageShot,
          framingSummary: formatPageShotFramingSummary(target.pageShot),
          model,
          quality,
          referenceOrder,
          referenceBreakdown: breakdown,
          expressionKind: exprKind,
          compositionBlock,
          sceneOverride: target.sceneOverride ?? null,
          customFraming: Boolean(target.customFraming),
        },
        null,
        2
      )
    );

    const outImage = path.join(outDir, `${target.id}.png`);
    if (dryRun) {
      console.log(`[phase-a] dry-run ${target.id} — prompt written, skip render`);
      pageRecords.push({
        id: target.id,
        page: target.page,
        dryRun: true,
        pageShotOverride: target.pageShot,
        compositionBlock,
      });
      continue;
    }

    console.log(`[phase-a] rendering ${target.id}...`);
    const gen = await generateGPTImage({
      finalPrompt,
      negativePrompt: STYLE_01_AVOIDANCE_NEGATIVE,
      referenceImages: referenceOrder,
      referenceMode: 'style02_book',
      requireReferenceEdit: referenceOrder.length > 0,
      size: '1024x1536',
      quality,
      modelOverride: model,
    });
    fs.writeFileSync(outImage, gen.buffer);
    imagePaths.push(outImage);
    console.log(`[phase-a] saved ${outImage} (${gen.durationMs}ms)`);

    const scores = await judgeCompliance({
      imagePath: outImage,
      target,
      compositionBlock,
    });

    pageRecords.push({
      id: target.id,
      page: target.page,
      pageShotOverride: target.pageShot,
      model: gen.model,
      quality,
      referenceOrder,
      compositionBlock,
      scores,
      imageFile: path.basename(outImage),
    });
  }

  if (!dryRun && imagePaths.length >= 2) {
    const sheetPath = path.join(outDir, 'contact-sheet-2x2.png');
    await buildContactSheet2x2(imagePaths, sheetPath);
    console.log(`[phase-a] contact sheet → ${sheetPath}`);
  }

  const compScores = pageRecords
    .map((r) => (r.scores as { compositionCompliance?: TriScore } | undefined)?.compositionCompliance)
    .filter(Boolean) as TriScore[];
  const compPassPartial = compScores.filter((s) => s === 'PASS' || s === 'PARTIAL').length;
  const identityFails = pageRecords.filter(
    (r) => (r.scores as { identitySurvival?: TriScore } | undefined)?.identitySurvival === 'FAIL'
  ).length;
  const otsScore = pageRecords.find((r) => r.id === 'p6_ots_calibration')?.scores as
    | { compositionCompliance?: TriScore; storybookReadability?: TriScore }
    | undefined;

  const reportMd = [
    '# Phase A — BookShotPlan composition calibration',
    '',
    `**Diagnostic only** — no production code changes.`,
    `**Order:** \`${orderId}\` · **Bank:** \`bunny_ometz_bedtime.md\` · **Model:** \`${model}\` · **Quality:** \`${quality}\``,
    `**Run:** \`${outDir}\``,
    '',
    '## Per-page results',
    '',
    '| page | target | shot override | compositionCompliance | identitySurvival | storybookReadability | notes |',
    '|---:|---|---|---|---|---|---|',
    ...pageRecords.map((r) => {
      const s = r.scores as
        | {
            compositionCompliance?: TriScore;
            identitySurvival?: TriScore;
            storybookReadability?: TriScore;
            notes?: string;
          }
        | undefined;
      const shot = (r.pageShotOverride as PageShot | undefined)?.shot ?? '?';
      return `| ${r.page} | ${r.id} | ${shot} | ${s?.compositionCompliance ?? (dryRun ? '—' : '?')} | ${s?.identitySurvival ?? '—'} | ${s?.storybookReadability ?? '—'} | ${(s?.notes ?? '').replace(/\|/g, '/')} |`;
    }),
    '',
    '## Artifacts per page',
    '',
    ...targets.map(
      (t) =>
        `- **${t.id}**: \`${t.id}.png\`, \`${t.id}-prompt.txt\` (final prompt), \`${t.id}-meta.json\` (composition block, pageShot override, model, reference order)`
    ),
    '',
    dryRun ? '' : '- `contact-sheet-2x2.png`',
    '',
    '## Decision hints (Guy + Claude eyeball)',
    '',
    `- compositionCompliance PASS/PARTIAL: **${compPassPartial}/${targets.length}** (success bar: ≥3/4 on a full run)`,
    `- identitySurvival FAIL count: **${identityFails}** (success bar: 0 FAIL across all pages)`,
    `- OTS (p6) readability: composition=${otsScore?.compositionCompliance ?? '—'}, storybook=${otsScore?.storybookReadability ?? '—'} (success: at least PARTIAL composition)`,
    '',
    '**Success → Phase B:** expand BookShotPlan vocabulary (OTS + stricter close_up).',
    '**Failure →** strengthen COMPOSITION block mapping before vocabulary expansion.',
    '',
    '## STOP',
    '',
    'Human eyeball required before any Phase B code.',
  ]
    .filter(Boolean)
    .join('\n');

  fs.writeFileSync(path.join(outDir, 'PHASE_A_CALIBRATION_REPORT.md'), reportMd, 'utf8');
  fs.writeFileSync(
    path.join(outDir, 'phase-a-calibration.json'),
    JSON.stringify({ orderId, model, quality, dryRun, pageRecords }, null, 2)
  );

  console.log(`[phase-a] report → ${path.join(outDir, 'PHASE_A_CALIBRATION_REPORT.md')}`);
  console.log('[phase-a] STOP — Guy+Claude eyeball before Phase B');
}

let usedFixture = false;
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    if (!usedFixture) return prisma.$disconnect();
  });
