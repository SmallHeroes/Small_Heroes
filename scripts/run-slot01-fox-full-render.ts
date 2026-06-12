/**
 * Sprint 11 Slot #1 — full 12-beat LOW render (fox_uri · adventure · NIGHT_FEAR).
 * Creates a dev story-bank order from v3-approved fox_uri_adventure.md, drives the
 * production chunked pipeline (cover + p1–p12), writes raw/ + normalized/ + contact sheet.
 *
 *   npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs \
 *     scripts/run-slot01-fox-full-render.ts [--orderId <existing>]
 */
import { config as loadEnv } from 'dotenv';
import type { Prisma } from '@prisma/client';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

const STORY_FILE = 'fox_uri_adventure.md';
const BANK_FILE = path.join(process.cwd(), 'story-bank', 'v3-approved', STORY_FILE);
const ALL_PAGES = Array.from({ length: 12 }, (_, i) => i + 1).join(',');
const OUT_ROOT = path.join(
  process.cwd(),
  'outputs',
  'sprint-11-runs',
  'slot01-full-render'
);
const RAW_DIR = path.join(OUT_ROOT, 'raw');
/** Girl example photo + approved Stage-0 anchor (dev reuse). */
const TEMPLATE_ANCHOR_ORDER_ID = '345ecd64-c9c2-4e0a-8f9d-a35de8d09883';

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
  const miaOrderId = '345ecd64-c9c2-4e0a-8f9d-a35de8d09883';
  const { prisma } = await import('@/lib/prisma');
  const mia = await prisma.order.findUnique({
    where: { id: miaOrderId },
    select: { childImageUrl: true },
  });
  if (mia?.childImageUrl) {
    console.log(`[slot01] photo from Mia order ${miaOrderId}`);
    return mia.childImageUrl;
  }
  throw new Error('No child photo — pass --photo or ensure Mia order has childImageUrl');
}

async function seedApprovedChildAnchorFromTemplate(orderId: string): Promise<void> {
  const { prisma } = await import('@/lib/prisma');
  const { parsePipelineCache } = await import('@/lib/generation-pipeline/helpers');
  const { getApprovedChildCanonicalAnchor } = await import(
    '@/lib/generation-pipeline/character-anchor-store'
  );

  const [targetJob, targetOrder, templateJob, templateOrder] = await Promise.all([
    prisma.generationJob.findUnique({ where: { orderId } }),
    prisma.order.findUnique({ where: { id: orderId } }),
    prisma.generationJob.findUnique({ where: { orderId: TEMPLATE_ANCHOR_ORDER_ID } }),
    prisma.order.findUnique({ where: { id: TEMPLATE_ANCHOR_ORDER_ID } }),
  ]);
  if (!targetJob) throw new Error(`no generation job for ${orderId}`);
  if (!templateJob || !templateOrder) {
    throw new Error(`template anchor order ${TEMPLATE_ANCHOR_ORDER_ID} not found`);
  }

  const templateCache = parsePipelineCache(templateJob.pipelineCache);
  const approved = getApprovedChildCanonicalAnchor(templateCache);
  if (!approved?.url) {
    throw new Error(`template order ${TEMPLATE_ANCHOR_ORDER_ID} has no approved child anchor`);
  }

  const targetCache = parsePipelineCache(targetJob.pipelineCache);
  const templateAnchors =
    templateOrder.characterAnchors && typeof templateOrder.characterAnchors === 'object'
      ? (templateOrder.characterAnchors as Record<string, unknown>)
      : {};
  const targetAnchors =
    targetOrder?.characterAnchors && typeof targetOrder.characterAnchors === 'object'
      ? (targetOrder.characterAnchors as Record<string, unknown>)
      : {};

  const nextCache = {
    ...targetCache,
    devStoryBankFile: BANK_FILE,
    skipLlmPersonalization: true,
    textFinalized: true,
    childAnchorApproved: true,
    lockedChildDescription: templateCache.lockedChildDescription,
    childPhotoDescription: templateCache.childPhotoDescription,
    dna: templateCache.dna,
    characterAnchorStore: templateCache.characterAnchorStore,
    challengeCategory: 'NIGHT_FEAR',
    directionForV3: 'adventure',
  };

  await prisma.generationJob.update({
    where: { orderId },
    data: {
      status: 'pending',
      currentStage: 'cover',
      lastError: null,
      failedAt: null,
      retryable: true,
      textDone: true,
      lockedBy: null,
      leaseExpiresAt: new Date(0),
      pipelineCache: nextCache,
    },
  });
  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'generating',
      textStatus: 'done',
      imageStatus: 'pending',
      lastError: null,
      characterAnchors: {
        ...targetAnchors,
        child: templateAnchors.child,
      } as Prisma.InputJsonValue,
    },
  });
  console.log(
    `[slot01] seeded approved child anchor from ${TEMPLATE_ANCHOR_ORDER_ID} → resume at cover`
  );
}

async function prepareOrderForRender(orderId: string): Promise<void> {
  await seedApprovedChildAnchorFromTemplate(orderId);
}

async function createOrder(): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const childPhoto = await resolveChildPhoto();
  const res = await fetch(`${baseUrl}/api/dev/story-bank`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storyFile: STORY_FILE,
      bankDir: 'v3-approved',
      childName: 'נועה',
      childGender: 'girl',
      childAge: 6,
      illustrationStyle: 'soft_hand_drawn_storybook',
      maxPages: 12,
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
  console.log(`[slot01] order created ${data.orderId}`);
  return data.orderId;
}

async function writeShotPlanReport(orderId: string): Promise<void> {
  const { prisma } = await import('@/lib/prisma');
  const { loadStoryFromBank } = await import('@/backend/providers/story-bank-loader');
  const { getCompanionById } = await import('@/lib/companions');
  const {
    beatsFromStoryPages,
    formatBookShotPlanTable,
    formatPageShotFramingSummary,
    isBookShotPlanValid,
    resolveBookShotPlan,
  } = await import('@/lib/book-shot-plan');

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error(`order ${orderId} not found`);

  const companion = getCompanionById('fox_uri');
  const story = await loadStoryFromBank(
    BANK_FILE,
    order.childName ?? 'נועה',
    companion?.name ?? 'אורי',
    order.childGender ?? 'girl',
    {
      skipLlmPersonalization: true,
    }
  );
  const plan = resolveBookShotPlan({
    storyFilePath: BANK_FILE,
    pages: beatsFromStoryPages(story.pages),
  });

  const manifestDir = path.join(OUT_ROOT, 'ref-manifests');
  const framingByPage: string[] = [];
  for (const p of plan.pages) {
    const summary = formatPageShotFramingSummary(p);
    framingByPage.push(`| ${p.page} | ${p.shot} | ${p.angle} | ${summary.replace(/\|/g, '\\|')} |`);
    if (fs.existsSync(manifestDir)) {
      const mf = path.join(manifestDir, `page-${p.page}.json`);
      if (fs.existsSync(mf)) {
        const manifest = JSON.parse(fs.readFileSync(mf, 'utf8')) as { framingSummary?: string };
        if (manifest.framingSummary) {
          framingByPage[framingByPage.length - 1] =
            `| ${p.page} | ${p.shot} | ${p.angle} | ${manifest.framingSummary.replace(/\|/g, '\\|')} |`;
        }
      }
    }
  }

  const lines = [
    '# Sprint 11 Slot #1 — full LOW render report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Order: \`${orderId}\``,
    `Bank: \`story-bank/v3-approved/${STORY_FILE}\``,
    `Child: נועה (girl) · companion: fox_uri · category: NIGHT_FEAR · direction: adventure`,
    `Quality: \`${process.env.GPT_IMAGE_QUALITY ?? 'low'}\``,
    '',
    '## BookShotPlan (derived)',
    '',
    `Valid: **${isBookShotPlanValid(plan) ? 'PASS' : 'FAIL'}** · source: \`${plan.source}\``,
    '',
    '```',
    formatBookShotPlanTable(plan),
    '```',
    '',
    '## Framing summary per page',
    '',
    '| Page | Shot | Angle | Framing (B1 shot-aware) |',
    '| --- | --- | --- | --- |',
    ...framingByPage,
    '',
    '## Artifacts',
    '',
    `- raw: \`${path.relative(process.cwd(), RAW_DIR)}/\``,
    `- normalized: \`${path.relative(process.cwd(), path.join(OUT_ROOT, 'normalized'))}/\``,
    `- contact sheet: \`contact-sheet-raw-vs-normalized.png\``,
    '',
    '**STOP** — Guy + Claude eyeball on full book before matrix flip.',
  ];

  const reportPath = path.join(OUT_ROOT, 'RENDER_REPORT.md');
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
  console.log(`[slot01] report → ${reportPath}`);
  await prisma.$disconnect();
}

async function main(): Promise<void> {
  if (!fs.existsSync(BANK_FILE)) {
    throw new Error(`Import first — missing ${BANK_FILE}`);
  }

  process.env.GPT_IMAGE_QUALITY = 'low';
  process.env.GENERATION_DISABLE_SELF_CHAIN = 'true';
  if (process.env.PHASE2_STYLE01_BOOK_PIPELINE?.trim() !== 'true') {
    throw new Error('PHASE2_STYLE01_BOOK_PIPELINE must be true');
  }

  const { countPublishedCompanionSheetViews } = await import(
    '@/lib/generation-pipeline/companion-character-sheet'
  );
  const sheetCount = countPublishedCompanionSheetViews('fox_uri');
  if (sheetCount < 4) {
    throw new Error(`fox_uri published sheet needs ≥4 views (found ${sheetCount})`);
  }

  let orderId = flag('--orderId')?.trim() ?? '';
  const rerender = Boolean(flag('--rerender'));
  if (!orderId) {
    orderId = await createOrder();
  } else {
    console.log(`[slot01] resuming order ${orderId}`);
  }
  await prepareOrderForRender(orderId);

  process.env.CHILD_ANCHOR_REVIEW_OK_ORDER_IDS = orderId;
  process.env.PAGE_REF_MANIFEST_DIR = path.join(OUT_ROOT, 'ref-manifests');
  fs.mkdirSync(process.env.PAGE_REF_MANIFEST_DIR, { recursive: true });

  const smokeScript = path.join(__dirname, 'run-bunny-smoke-render.ts');
  const args = [
    '--env-file=.env.local',
    '--require',
    './scripts/shims/register-server-only.cjs',
    smokeScript,
    '--orderId',
    orderId,
    '--pages',
    `cover,${ALL_PAGES}`,
    '--quality',
    'low',
    '--outputDir',
    RAW_DIR,
    '--bankFile',
    BANK_FILE,
    ...(rerender ? ['--rerender'] : []),
  ];

  console.log(`[slot01] full LOW render cover + p1–p12 → ${RAW_DIR}/`);
  const result = spawnSync('npx', ['tsx', ...args], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);

  await writeShotPlanReport(orderId);
  console.log('');
  console.log('=== SLOT #1 FULL LOW RENDER COMPLETE ===');
  console.log(`orderId=${orderId}`);
  console.log(`STOP for Guy + Claude eyeball — matrix NOT flipped.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
