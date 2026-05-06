import { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { buildImagePrompt } from '../lib/promptBuilder';
import { normalizeStyleId, STYLE_IDS, type StyleId } from '../lib/styles';
import type { CharacterConsistencyLock } from '../lib/character-lock';
import { generateReplicateImage } from '../lib/generate-image';
import { resolveReplicateImageModel } from '../lib/replicate';
import sharp from 'sharp';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import readline from 'node:readline/promises';

type Variant = 'current' | 'minimalist_v1';
const prisma = new PrismaClient();
// Phase 2 selector strategy: choose a ready order with >=8 pages + populated anchors.
// Scene seed strategy: derive one deterministic scene seed per page from BookPage.text.

const STYLE_IDS_EXPERIMENT: StyleId[] = [
  STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  STYLE_IDS.EXPRESSIVE_PAINTERLY_STORYBOOK,
];
const VARIANTS: Variant[] = ['current', 'minimalist_v1'];
const FIXED_PAGES = [1, 3, 6, 8];
const COST_PER_IMAGE_USD = 0.04;

const MINIMALIST_STYLE_BLOCKS: Record<StyleId, { style: string; negatives: string }> = {
  soft_hand_drawn_storybook: {
    style:
      "Pencil sketch and watercolor children's book illustration, scan of paper, visible graphite lines, washed-out muted palette, paper texture grain.",
    negatives:
      '3D, render, CGI, plastic, glossy, smooth digital, airbrush, photoreal, vector, pixar, animation, polished, clean lines, perfect symmetry.',
  },
  expressive_painterly_storybook: {
    style:
      "Gouache and oil pastel painting, thick brushstrokes, exaggerated chunky character proportions, saturated colors, visible canvas texture, hand-painted picture book.",
    negatives:
      '3D, render, CGI, plastic, glossy, smooth digital, airbrush, photoreal, vector, pixar, dreamworks, animation, polished, thin lines, flat color.',
  },
};

type PageRow = {
  pageNumber: number;
  text: string;
  pageTemplate: string | null;
  imageAsset: { prompt: string | null } | null;
};

type OrderCandidate = {
  id: string;
  status: string;
  updatedAt: Date;
  childName: string;
  childAge: number | null;
  childGender: string | null;
  childImageUrl: string | null;
  characterAnchors: Prisma.JsonValue | null;
  book: { pages: PageRow[] } | null;
};

type CellResult = {
  pageNumber: number;
  styleId: StyleId;
  variant: Variant;
  promptLength: number;
  negativePromptLength: number;
  rawProviderUrl: string;
  localFile: string;
  promptHead: string;
};

function parseSeedArg(argv: string[]): number | null {
  const seedArg = argv.find((item) => item.startsWith('--seed='));
  if (!seedArg) return null;
  const n = Number(seedArg.split('=')[1]);
  return Number.isFinite(n) ? Math.floor(n) : null;
}

function parseStoredCharacterAnchors(raw: unknown): Record<string, { name: string; description: string; anchorImageUrl?: string; aliases?: string[] }> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const parsed: Record<string, { name: string; description: string; anchorImageUrl?: string; aliases?: string[] }> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (key === '_wizard') continue;
    if (key.startsWith('companion:') && typeof value === 'string') {
      const companionId = key.slice('companion:'.length);
      parsed[key] = {
        name: `companion:${companionId}`,
        description: `Companion character ${companionId}`,
        anchorImageUrl: value,
        aliases: [companionId],
      };
      continue;
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const candidate = value as Record<string, unknown>;
    parsed[key] = {
      name: typeof candidate.name === 'string' ? candidate.name : key,
      description:
        typeof candidate.description === 'string'
          ? candidate.description
          : `${typeof candidate.name === 'string' ? candidate.name : key} recurring character`,
      anchorImageUrl: typeof candidate.anchorImageUrl === 'string' ? candidate.anchorImageUrl : undefined,
      aliases: Array.isArray(candidate.aliases)
        ? candidate.aliases.filter((entry): entry is string => typeof entry === 'string')
        : [],
    };
  }
  return parsed;
}

function buildCharacterLock(order: OrderCandidate): CharacterConsistencyLock {
  const stored = parseStoredCharacterAnchors(order.characterAnchors);
  const childFallback = `A ${order.childGender === 'girl' ? 'girl' : 'boy'} named ${order.childName}, approximately ${order.childAge ?? 5} years old, warm and friendly appearance`;
  const childRecord = stored.child ?? {
    name: order.childName,
    description: childFallback,
    anchorImageUrl: order.childImageUrl ?? undefined,
    aliases: [order.childName, 'child'],
  };
  const companionEntry = Object.entries(stored).find(([id]) => id.startsWith('companion:'))?.[1];
  const supportingCharacters = Object.entries(stored)
    .filter(([id]) => id !== 'child' && !id.startsWith('companion:'))
    .map(([, value]) => ({
      name: value.name,
      description: value.description,
      anchorImageUrl: value.anchorImageUrl,
    }));
  return {
    child: {
      name: childRecord.name,
      description: childRecord.description,
      anchorImageUrl: childRecord.anchorImageUrl,
    },
    companionSecondary: companionEntry
      ? {
          name: companionEntry.name,
          description: companionEntry.description,
          anchorImageUrl: companionEntry.anchorImageUrl,
        }
      : undefined,
    supportingCharacters: supportingCharacters.length > 0 ? supportingCharacters : undefined,
    referenceImages: childRecord.anchorImageUrl ? [{ role: 'child', url: childRecord.anchorImageUrl }] : undefined,
  };
}

function buildSceneSeed(page: { pageNumber: number; text: string }, totalPages: number): string {
  const cleanedText = page.text.replace(/\s+/g, ' ').trim();
  return (
    `Page ${page.pageNumber} of ${totalPages}: stage a concrete scene based on "${cleanedText}". ` +
    'Show where it happens, what the child is doing, what the companion or entity is doing, and what surrounds them. ' +
    'Include full environment depth with foreground, midground, and background.'
  );
}

function detectStyleFromAnyPrompt(order: OrderCandidate): StyleId {
  const prompts = (order.book?.pages ?? [])
    .map((p) => p.imageAsset?.prompt)
    .filter((p): p is string => typeof p === 'string' && p.length > 0);
  for (const prompt of prompts) {
    if (prompt.includes('internal_id: expressive_painterly_storybook')) {
      return STYLE_IDS.EXPRESSIVE_PAINTERLY_STORYBOOK;
    }
    if (prompt.includes('internal_id: soft_hand_drawn_storybook')) {
      return STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK;
    }
  }
  return STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK;
}

function assertSuitableOrder(order: OrderCandidate): { ok: boolean; reason?: string; templateCount?: number } {
  if (!order.book) return { ok: false, reason: 'missing generated book' };
  const pages = order.book.pages;
  if (pages.length < 8) return { ok: false, reason: 'book has fewer than 8 pages' };
  if (!order.characterAnchors || typeof order.characterAnchors !== 'object' || Array.isArray(order.characterAnchors)) {
    return { ok: false, reason: 'character anchors missing' };
  }
  const nonWizardKeys = Object.keys(order.characterAnchors as Record<string, unknown>).filter((k) => k !== '_wizard');
  if (nonWizardKeys.length === 0) return { ok: false, reason: 'character anchors empty' };
  const needed = new Set(FIXED_PAGES);
  const byNumber = new Map(pages.map((p) => [p.pageNumber, p]));
  for (const n of needed) {
    const page = byNumber.get(n);
    if (!page || !page.text || !page.text.trim()) {
      return { ok: false, reason: `missing page text for page ${n}` };
    }
  }
  const templateCount = new Set(pages.map((p) => p.pageTemplate ?? 'null')).size;
  return { ok: true, templateCount };
}

async function selectOrderCandidate(): Promise<OrderCandidate> {
  // READ-ONLY DB POLICY: this script only uses findMany/findFirst/findUnique.
  const candidates = await prisma.order.findMany({
    where: {
      status: 'ready',
      book: { isNot: null },
    },
    orderBy: { updatedAt: 'desc' },
    take: 80,
    select: {
      id: true,
      status: true,
      updatedAt: true,
      childName: true,
      childAge: true,
      childGender: true,
      childImageUrl: true,
      characterAnchors: true,
      book: {
        select: {
          pages: {
            orderBy: { pageNumber: 'asc' },
            select: {
              pageNumber: true,
              text: true,
              pageTemplate: true,
              imageAsset: { select: { prompt: true } },
            },
          },
        },
      },
    },
  });
  const eligible = candidates
    .map((order) => ({ order, suitability: assertSuitableOrder(order as OrderCandidate) }))
    .filter((entry) => entry.suitability.ok)
    .sort((a, b) => {
      const ta = a.suitability.templateCount ?? 0;
      const tb = b.suitability.templateCount ?? 0;
      if (tb !== ta) return tb - ta;
      return new Date(b.order.updatedAt).getTime() - new Date(a.order.updatedAt).getTime();
    });
  if (eligible.length === 0) {
    throw new Error(
      '[style-experiment] no suitable order found (need status=ready, ≥8 pages with prompts, character anchors populated). Aborting.'
    );
  }
  return eligible[0].order as OrderCandidate;
}

function buildMinimalistPrompt(styleId: StyleId, sceneIntent: string, childAnchorUrl?: string): { prompt: string; negativePrompt: string } {
  const styleBlock = MINIMALIST_STYLE_BLOCKS[styleId];
  const characterLine = childAnchorUrl
    ? `Character: keep child consistent with reference anchor ${childAnchorUrl}.`
    : 'Character: keep child design consistent across pages.';
  const prompt = `${styleBlock.style}\n\nScene: ${sceneIntent}\n\n${characterLine}`.replace(/\s+/g, ' ').trim();
  return { prompt, negativePrompt: styleBlock.negatives };
}

async function downloadAsWebp(sourceUrl: string, outputPath: string): Promise<void> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`[style-experiment] image download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await sharp(buf).webp({ quality: 93 }).toFile(outputPath);
}

function renderHtml(orderId: string, pages: number[], cells: CellResult[]): string {
  const byKey = new Map(cells.map((c) => [`${c.pageNumber}|${c.variant}|${c.styleId}`, c] as const));
  return `<!doctype html>
<html><head><meta charset="utf-8"/><title>Style Experiment ${orderId}</title>
<style>
body{font-family:Arial,sans-serif;margin:20px;background:#fafafa} .page{margin:24px 0;padding:12px;background:#fff;border:1px solid #ddd}
.grid{display:grid;grid-template-columns:repeat(2,minmax(320px,1fr));gap:12px}
.cell{border:1px solid #ccc;padding:8px;background:#fff}.cap{font-size:12px;color:#333;margin-top:6px}
img{width:100%;height:auto;display:block;background:#f0f0f0}
</style></head><body>
<h1>Style Experiment: ${orderId}</h1>
${pages
  .map((page) => {
    const block = VARIANTS.flatMap((variant) =>
      STYLE_IDS_EXPERIMENT.map((styleId) => {
        const cell = byKey.get(`${page}|${variant}|${styleId}`);
        if (!cell) return '';
        return `<div class="cell"><img src="./${cell.localFile}" alt="${cell.localFile}"/><div class="cap">page=${cell.pageNumber} style=${cell.styleId} variant=${cell.variant} promptLength=${cell.promptLength}</div></div>`;
      })
    ).join('');
    return `<section class="page"><h2>Page ${page}</h2><div class="grid">${block}</div></section>`;
  })
  .join('')}
</body></html>`;
}

async function main() {
  process.env.ENABLE_PRESENTATION_POSTPROCESS = 'false';
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error('[style-experiment] REPLICATE_API_TOKEN is required. Aborting.');
  }

  const seed = parseSeedArg(process.argv.slice(2));
  const order = await selectOrderCandidate();
  const selectedPages = [...FIXED_PAGES];
  const bookStyleId = detectStyleFromAnyPrompt(order);
  const byPage = new Map((order.book?.pages ?? []).map((p) => [p.pageNumber, p]));
  const sceneSeeds = new Map<number, string>();
  for (const n of selectedPages) {
    const page = byPage.get(n);
    if (!page) throw new Error(`[style-experiment] selected page ${n} missing. Aborting.`);
    sceneSeeds.set(n, buildSceneSeed({ pageNumber: page.pageNumber, text: page.text }, order.book?.pages.length ?? 0));
  }
  const model = resolveReplicateImageModel(undefined);
  const matrixSize = selectedPages.length * STYLE_IDS_EXPERIMENT.length * VARIANTS.length;
  const estimatedCost = (matrixSize * COST_PER_IMAGE_USD).toFixed(2);
  console.log('[style-experiment] selected order:', order.id);
  console.log('[style-experiment] selected pages:', selectedPages.join(', '));
  console.log('[style-experiment] book original style:', bookStyleId);
  console.log(
    '[style-experiment] page templates seen:',
    [...new Set((order.book?.pages ?? []).map((p) => p.pageTemplate ?? 'null'))].join(', ')
  );
  console.log('[style-experiment] matrix size:', matrixSize);
  console.log(`[style-experiment] estimated cost: $${estimatedCost} (${matrixSize} x $${COST_PER_IMAGE_USD.toFixed(2)})`);
  console.log('[style-experiment] model:', model);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question('Continue? (y/N) ')).trim();
  rl.close();
  if (!/^y$/i.test(answer)) {
    console.log('[style-experiment] aborted by user.');
    return;
  }

  const childAnchorUrl = buildCharacterLock(order).child.anchorImageUrl;
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .slice(0, 15);
  const outDir = path.resolve('experiments', 'style-test', order.id, stamp);
  await fs.mkdir(outDir, { recursive: true });

  const characterLock = buildCharacterLock(order);
  const cells: CellResult[] = [];
  let failed = 0;

  for (const pageNumber of selectedPages) {
    const sceneSeed = sceneSeeds.get(pageNumber)!;
    for (const styleId of STYLE_IDS_EXPERIMENT) {
      for (const variant of VARIANTS) {
        try {
          let finalPrompt: string;
          let negativePrompt: string;
          if (variant === 'current') {
            const built = buildImagePrompt({
              styleIdInput: styleId,
              sceneDescription: sceneSeed,
              textZoneDirective: '',
              protagonistLock: characterLock.child.description,
              entityLock: '',
              globalNegativeConstraints: [],
            });
            finalPrompt = built.finalPrompt;
            negativePrompt = built.negativePrompt;
          } else {
            const minimalist = buildMinimalistPrompt(styleId, sceneSeed, childAnchorUrl);
            finalPrompt = minimalist.prompt;
            negativePrompt = minimalist.negativePrompt;
          }
          console.log(
            `[style-experiment] page=${pageNumber} style=${styleId} variant=${variant} promptLength=${finalPrompt.length} negativePromptLength=${negativePrompt.length}`
          );
          const result = await generateReplicateImage({
            finalPrompt,
            negativePrompt,
            seed: seed ?? undefined,
          });
          const filename = `page${String(pageNumber).padStart(2, '0')}_${styleId}_${variant}.webp`;
          const outputPath = path.join(outDir, filename);
          await downloadAsWebp(result.imageUrl, outputPath);
          cells.push({
            pageNumber,
            styleId,
            variant,
            promptLength: finalPrompt.length,
            negativePromptLength: negativePrompt.length,
            rawProviderUrl: result.imageUrl,
            localFile: filename,
            promptHead: finalPrompt.slice(0, 200),
          });
        } catch (error) {
          failed += 1;
          console.error(
            `[style-experiment] failed page=${pageNumber} style=${styleId} variant=${variant}:`,
            error instanceof Error ? error.message : String(error)
          );
        }
      }
    }
  }

  const manifest = {
    experimentId: stamp,
    orderId: order.id,
    bookOriginalStyleId: bookStyleId,
    selectedPages,
    matrixSize,
    model,
    seed,
    createdAt: new Date().toISOString(),
    cells,
  };
  await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  await fs.writeFile(path.join(outDir, 'index.html'), renderHtml(order.id, selectedPages, cells), 'utf8');
  console.log(
    `[style-experiment] done: succeeded=${cells.length}/${matrixSize} failed=${failed} outputDir=${outDir}`
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
