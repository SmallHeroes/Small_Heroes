/**
 * Slot #2 — full LOW render (lion_shaket · bedtime · ANGER · 8 beats + cover).
 * Uses v5 golden + sidecar locks. NEW test child (default עומר boy) — NOT Mia/נועה.
 *
 *   npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs \
 *     scripts/run-slot02-lion-bedtime-full-render.ts --photo path/to/child.jpg
 *
 * 2nd-child sanity (cover/p1/p6/p7 only):
 *   ... --photo path/to/other-child.jpg --pages cover,1,6,7 --outputDir outputs/slot02-lion-bedtime-sanity-b
 */
import { config as loadEnv } from 'dotenv';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

const STORY_FILE = 'lion_shaket_bedtime.md';
const BANK_FILE = path.join(process.cwd(), 'story-bank', 'v5-fixed-v2', STORY_FILE);
const OUT_ROOT = path.join(process.cwd(), 'outputs', 'slot02-lion-bedtime-full-render');
const RAW_DIR = path.join(OUT_ROOT, 'raw');
const ALL_PAGES = '1,2,3,4,5,6,7,8';

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function flag(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

async function resolveChildPhoto(): Promise<string> {
  const explicit = flag('--photo');
  if (explicit && fs.existsSync(explicit)) {
    const buf = fs.readFileSync(explicit);
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  }
  throw new Error(
    'Pass --photo <path> with a NEW test child photo (not Mia/Slot #1). Guy must confirm audition child.'
  );
}

async function createOrder(): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const childPhoto = await resolveChildPhoto();
  const childName = flag('--child-name')?.trim() || 'עומר';
  const childGender = flag('--child-gender')?.trim() || 'boy';
  const childAge = Number(flag('--child-age') ?? '6');

  const res = await fetch(`${baseUrl}/api/dev/story-bank`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storyFile: STORY_FILE,
      childName,
      childGender,
      childAge,
      illustrationStyle: 'soft_hand_drawn_storybook',
      maxPages: 20,
      skipCover: false,
      skipPersonalization: true,
      skipWorkerChain: true,
      childPhotoBase64: childPhoto.startsWith('data:') ? childPhoto : undefined,
      childImageUrl: childPhoto.startsWith('http') ? childPhoto : undefined,
    }),
  });
  const data = (await res.json()) as { orderId?: string; error?: string };
  if (!res.ok || !data.orderId) {
    throw new Error(`Create order failed: ${JSON.stringify(data)}`);
  }
  console.log(`[slot02] order created ${data.orderId} child=${childName} (${childGender})`);
  return data.orderId;
}

async function ensureFullBookPages(orderId: string): Promise<void> {
  const { prisma } = await import('@/lib/prisma');
  const { loadStoryFromBank } = await import('@/backend/providers/story-bank-loader');
  const { assignTemplatesForBook } = await import('@/lib/bookPageLayout');
  const { getCompanionById } = await import('@/lib/companions');

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  const book = await prisma.generatedBook.findUnique({
    where: { orderId },
    include: { pages: true },
  });
  if (!order || !book) throw new Error(`order/book missing for ${orderId}`);

  const companion = getCompanionById('lion_shaket');
  const story = await loadStoryFromBank(
    BANK_FILE,
    order.childName ?? 'עומר',
    companion?.name ?? 'ליאו',
    order.childGender ?? 'boy',
    { skipLlmPersonalization: true, maxPages: 20 }
  );
  if (story.pages.length < 8) {
    throw new Error(`expected 8 beats, loaded ${story.pages.length}`);
  }

  const existing = new Set(book.pages.map((p) => p.pageNumber));
  const missing = story.pages.filter((p) => !existing.has(p.pageNumber));
  if (missing.length === 0) return;

  const templates = assignTemplatesForBook(
    story.pages.map((page) => ({
      pageNumber: page.pageNumber,
      text: page.text,
      imageSubject: page.imageSubject,
    }))
  );
  const templateByPage = new Map(story.pages.map((p, i) => [p.pageNumber, templates[i]]));

  await prisma.bookPage.createMany({
    data: missing.map((p) => ({
      bookId: book.id,
      pageNumber: p.pageNumber,
      text: p.text,
      narrationText: p.narrationText,
      pageTemplate: templateByPage.get(p.pageNumber) ?? 'art_top_text_bottom',
    })),
  });
  await prisma.generatedBook.update({
    where: { id: book.id },
    data: { title: story.title, coverText: story.coverText },
  });
  console.log(`[slot02] backfilled book pages: +${missing.length}`);
}

async function prepareOrderForRender(orderId: string): Promise<void> {
  const { prisma } = await import('@/lib/prisma');
  const { parsePipelineCache } = await import('@/lib/generation-pipeline/helpers');

  await ensureFullBookPages(orderId);

  const job = await prisma.generationJob.findUnique({ where: { orderId } });
  const cache = job ? parsePipelineCache(job.pipelineCache) : {};
  const nextCache = {
    ...cache,
    devStoryBankFile: BANK_FILE,
    skipLlmPersonalization: true,
    textFinalized: true,
    challengeCategory: 'ANGER_FRUSTRATION',
    directionForV3: 'bedtime',
    expectedPageCount: 8,
  };

  await prisma.generationJob.update({
    where: { orderId },
    data: {
      status: 'running',
      currentStage: 'cover',
      imagesDone: false,
      textDone: true,
      pipelineCache: nextCache,
    },
  });
}

async function main(): Promise<void> {
  if (!fs.existsSync(BANK_FILE)) {
    throw new Error(`Missing ${BANK_FILE}`);
  }
  if (!fs.existsSync(BANK_FILE.replace(/\.md$/, '.location-bible.json'))) {
    throw new Error('Missing location bible sidecar — run Stage B first');
  }

  process.env.GPT_IMAGE_QUALITY = 'low';
  process.env.GENERATION_DISABLE_SELF_CHAIN = 'true';
  if (process.env.PHASE2_STYLE01_BOOK_PIPELINE?.trim() !== 'true') {
    throw new Error('PHASE2_STYLE01_BOOK_PIPELINE must be true');
  }

  const { countPublishedCompanionSheetViews } = await import(
    '@/lib/generation-pipeline/companion-character-sheet'
  );
  const sheetCount = countPublishedCompanionSheetViews('lion_shaket');
  if (sheetCount < 4) {
    throw new Error(`lion_shaket published sheets need ≥4 views (found ${sheetCount})`);
  }

  const pages = flag('--pages')?.trim() || `cover,${ALL_PAGES}`;
  const outputDir = flag('--outputDir')?.trim() || RAW_DIR;

  let orderId = flag('--orderId')?.trim() ?? '';
  if (!orderId) {
    orderId = await createOrder();
  } else {
    console.log(`[slot02] resuming order ${orderId}`);
  }
  await prepareOrderForRender(orderId);

  process.env.CHILD_ANCHOR_REVIEW_OK_ORDER_IDS = orderId;
  process.env.PAGE_REF_MANIFEST_DIR = path.join(path.dirname(outputDir), 'ref-manifests');
  fs.mkdirSync(process.env.PAGE_REF_MANIFEST_DIR, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const smokeScript = path.join(__dirname, 'run-bunny-smoke-render.ts');
  const args = [
    '--env-file=.env.local',
    '--require',
    './scripts/shims/register-server-only.cjs',
    smokeScript,
    '--orderId',
    orderId,
    '--pages',
    pages,
    '--quality',
    'low',
    '--outputDir',
    outputDir,
    '--bankFile',
    BANK_FILE,
    ...(hasFlag('--rerender') ? ['--rerender'] : []),
  ];

  console.log(`[slot02] LOW render ${pages} → ${outputDir}/`);
  const result = spawnSync('npx', ['tsx', ...args], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);

  console.log('');
  console.log('=== SLOT #2 LION BEDTIME LOW RENDER COMPLETE ===');
  console.log(`orderId=${orderId}`);
  console.log('STOP for 3-way eyeball — matrix NOT flipped.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
