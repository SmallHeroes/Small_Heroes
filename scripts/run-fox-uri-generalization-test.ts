/**
 * Generalization test — fox_uri_adventure, 5-page LOW sample (production chunked path).
 * Requires published fox_uri style01-sheets (≥4 views) from generate-companion-sheet --publish.
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-fox-uri-generalization-test.ts
 *   npx tsx ... --selection-only   # page pick + preflight only, no render
 *   npx tsx ... --photo path/to/IMG_3423.JPG
 */
import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

const STORY_FILE = 'fox_uri_adventure.md';
const COMPANION_ID = 'fox_uri';
const COMPANION_REF = 'public/companions/NIGHT_FEAR/fox_uri.jpg';
const CHILD_NAME = 'מיה';
const SELECTED_PAGES = [1, 3, 5, 9, 15] as const;

const DINI_ABORT_MARKERS = [
  'DRAGON_DINI',
  'dragon_dini',
  'green_speckled_egg',
  'baby_dragon',
  'DRAGON_DINI_COMPOSITION',
  'DRAGON_DINI_RECURRING',
  'baby_dragon:dini_hatchling',
  'COMPANION LOCK — DINI',
  'RECURRING ENTITY LOCK — BABY SISTER',
  'RECURRING ENTITY LOCK — BABY DRAGON',
];

const PAGE_CATEGORIES: Record<
  number,
  'wide_environment' | 'companion_close_medium' | 'companion_action' | 'emotional' | 'ending'
> = {
  1: 'wide_environment',
  3: 'companion_close_medium',
  5: 'companion_action',
  9: 'emotional',
  15: 'ending',
};

const PAGE_RATIONALE: Record<number, string> = {
  1: 'Wide/environmental — starlit backyard, child on porch before Uri appears (establishing scale + night mood).',
  3: 'Companion close/medium — Uri and Mia step onto the lawn together (first shared beat, readable fox scale).',
  5: 'Companion action/motion — shadow flicker, flinch, fox frozen mid-reaction (movement + stakes, not a static pose).',
  9: 'Emotional beat — child sits beside Uri, hand on fur (quiet connection, expression-led staging).',
  15: 'Ending — safe inside, fox tail in starlit yard (resolution residue, wide yard read).',
};

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function flag(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

async function download(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download ${url}: ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

function expressionSelectionReason(
  pageNumber: number,
  kind: string,
  companionId: string
): { source: 'heuristic' | 'dini_page_map'; why: string } {
  const diniOnlyPages = [1, 4, 8, 13, 20];
  if (companionId === 'dragon_dini' && diniOnlyPages.includes(pageNumber)) {
    return {
      source: 'dini_page_map',
      why: `Explicit dragon_dini override for page ${pageNumber}`,
    };
  }
  return {
    source: 'heuristic',
    why: `Generic expression heuristics from page text/imageDirection (kind=${kind})`,
  };
}

async function preflightDiniFree(companionId: string): Promise<void> {
  const { loadStoryFromBank } = await import('@/backend/providers/story-bank-loader');
  const { assembleStyle01Phase2Prompt } = await import('@/lib/style01-prompt-assembly');
  const { resolveStyle01StoryLocks } = await import('@/lib/style01-gptimage');
  const { parseRecurringEntitiesFromStoryMarkdown } = await import('@/lib/story-bank/recurring-entities');

  const storyPath = path.join(process.cwd(), 'story-bank', 'v5-fixed-v2', STORY_FILE);
  const raw = fs.readFileSync(storyPath, 'utf8');
  const story = await loadStoryFromBank(storyPath, CHILD_NAME, 'אורי', 'girl', {
    skipLlmPersonalization: true,
  });
  const declarations = parseRecurringEntitiesFromStoryMarkdown(raw);
  const locks = resolveStyle01StoryLocks(companionId, declarations);

  if (locks.compositionByPage && Object.keys(locks.compositionByPage).length > 0) {
    throw new Error('PREFLIGHT ABORT: compositionByPage map present for fox_uri');
  }
  if (locks.companionLock?.includes('DINI')) {
    throw new Error('PREFLIGHT ABORT: Dini companion lock loaded');
  }

  for (const pageNumber of SELECTED_PAGES) {
    const page = story.pages.find((p) => p.pageNumber === pageNumber);
    if (!page) throw new Error(`Missing story page ${pageNumber}`);
    const { prompt } = assembleStyle01Phase2Prompt({
      pageNumber,
      pagePrompt: page.imagePrompt,
      rawScenePrompt: page.rawScenePrompt,
      bookPageText: page.text,
      childFirstName: CHILD_NAME,
      childAge: 5,
      childGender: 'girl',
      companion: { id: companionId, name: 'אורי', image: `/${COMPANION_REF.replace(/\\/g, '/')}` },
      storyRecurringEntityDeclarations: declarations,
      familyCoherence: null,
    });
    for (const marker of DINI_ABORT_MARKERS) {
      if (prompt.includes(marker)) {
        throw new Error(`PREFLIGHT ABORT page ${pageNumber}: found "${marker}" in assembled prompt`);
      }
    }
  }

  console.log('[preflight] OK — no Dini locks in resolveStyle01StoryLocks or assembled prompts for sample pages');
  console.log(`[preflight] recurringEntities in story: ${declarations.map((d) => d.entityId).join(', ') || '(none)'}`);
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
    console.log(`[photo] Reusing Mia reference photo from order ${miaOrderId}`);
    return mia.childImageUrl;
  }
  const envPath = process.env.CHILD_PHOTO_PATH?.trim();
  if (envPath && fs.existsSync(envPath)) {
    const buf = fs.readFileSync(envPath);
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  }
  throw new Error('No child photo — pass --photo path/to/IMG_3423.JPG or ensure Mia order has childImageUrl');
}

async function assertPublishedFoxUriSheet(): Promise<{
  viewCount: number;
  views: string[];
  manifestPath: string | null;
}> {
  const {
    countPublishedCompanionSheetViews,
    listPublishedCompanionSheetViews,
  } = await import('@/lib/generation-pipeline/companion-character-sheet');
  const count = countPublishedCompanionSheetViews(COMPANION_ID);
  const published = listPublishedCompanionSheetViews(COMPANION_ID);
  const views = Object.keys(published);
  const manifestPath = path.join(
    process.cwd(),
    'public',
    'companions',
    COMPANION_ID,
    'style01-sheets',
    'manifest.json'
  );
  if (count < 4) {
    throw new Error(
      `Published fox_uri sheet required (≥4 views). Found ${count} in public/companions/fox_uri/style01-sheets/. Run generate-companion-sheet fox_uri --publish first.`
    );
  }
  return {
    viewCount: count,
    views,
    manifestPath: fs.existsSync(manifestPath) ? manifestPath : null,
  };
}

function analyzeCompanionRefs(manifest: {
  characterRefs?: string[];
  finalOrder?: string[];
} | null): {
  usesPublishedSheet: boolean;
  usesSingleJpg: boolean;
  sheetView: string | null;
  companionRefPaths: string[];
  finalOrder: string[];
} {
  const refs = [
    ...(manifest?.characterRefs ?? []),
    ...(manifest?.finalOrder ?? []),
  ].filter((r) => typeof r === 'string' && r.includes('fox_uri'));
  const sheetRefs = refs.filter((r) => r.includes('style01-sheets'));
  const jpgRefs = refs.filter((r) => /\.jpe?g$/i.test(r) && !r.includes('style01-sheets'));
  let sheetView: string | null = null;
  for (const r of sheetRefs) {
    const m = /style01-sheets[\\/]([^.\\/]+)\./i.exec(r);
    if (m) {
      sheetView = m[1];
      break;
    }
  }
  return {
    usesPublishedSheet: sheetRefs.length > 0,
    usesSingleJpg: jpgRefs.length > 0 && sheetRefs.length === 0,
    sheetView,
    companionRefPaths: [...new Set(refs)],
    finalOrder: manifest?.finalOrder ?? [],
  };
}

async function printPageSelectionReport(outRoot: string): Promise<void> {
  const { loadStoryFromBank } = await import('@/backend/providers/story-bank-loader');
  const storyPath = path.join(process.cwd(), 'story-bank', 'v5-fixed-v2', STORY_FILE);
  const story = await loadStoryFromBank(storyPath, CHILD_NAME, 'אורי', 'girl', {
    skipLlmPersonalization: true,
  });

  const selection = {
    storyFile: STORY_FILE,
    companionId: COMPANION_ID,
    childName: CHILD_NAME,
    selectedPages: SELECTED_PAGES,
    coverage: {
      wide_environment: SELECTED_PAGES.filter((p) => PAGE_CATEGORIES[p] === 'wide_environment'),
      companion_close_medium: SELECTED_PAGES.filter(
        (p) => PAGE_CATEGORIES[p] === 'companion_close_medium'
      ),
      companion_action: SELECTED_PAGES.filter((p) => PAGE_CATEGORIES[p] === 'companion_action'),
      emotional: SELECTED_PAGES.filter((p) => PAGE_CATEGORIES[p] === 'emotional'),
      ending: SELECTED_PAGES.filter((p) => PAGE_CATEGORIES[p] === 'ending'),
    },
    pages: SELECTED_PAGES.map((n) => {
      const page = story.pages.find((p) => p.pageNumber === n);
      return {
        pageNumber: n,
        category: PAGE_CATEGORIES[n],
        rationale: PAGE_RATIONALE[n],
        textSnippet: page?.text?.slice(0, 120) ?? '',
      };
    }),
    familyCoherenceNote:
      'Not exercised — fox_uri_adventure has no human parents/newborn pages in this sample.',
  };

  fs.mkdirSync(outRoot, { recursive: true });
  fs.writeFileSync(path.join(outRoot, 'page-selection.json'), JSON.stringify(selection, null, 2));

  console.log('\n=== PAGE SELECTION (before render) ===\n');
  for (const n of SELECTED_PAGES) {
    console.log(`  p${n} [${PAGE_CATEGORIES[n]}]: ${PAGE_RATIONALE[n]}`);
  }
  console.log('\nCoverage checklist:');
  console.log(`  wide/environment: ${selection.coverage.wide_environment.join(', ') || '(none)'}`);
  console.log(
    `  companion close/medium: ${selection.coverage.companion_close_medium.join(', ') || '(none)'}`
  );
  console.log(`  companion action: ${selection.coverage.companion_action.join(', ') || '(none)'}`);
  console.log(`  emotional: ${selection.coverage.emotional.join(', ') || '(none)'}`);
  console.log(`  ending: ${selection.coverage.ending.join(', ') || '(none)'}`);
  console.log(`\nWrote ${path.join(outRoot, 'page-selection.json')}\n`);
}

async function main() {
  const outRoot = path.join(process.cwd(), 'outputs', 'generalization-test', 'fox_uri_adventure');
  const pagesDir = path.join(outRoot, 'pages');
  const manifestDir = path.join(pagesDir, 'ref-manifests');
  const promptsDir = path.join(pagesDir, 'prompts');

  console.log('\n=== GENERALIZATION TEST: fox_uri_adventure ===\n');

  await printPageSelectionReport(outRoot);
  await preflightDiniFree(COMPANION_ID);

  const sheetInfo = await assertPublishedFoxUriSheet();
  console.log(
    `[sheet] Published fox_uri views (${sheetInfo.viewCount}): ${sheetInfo.views.join(', ')}`
  );
  if (sheetInfo.manifestPath) {
    console.log(`[sheet] manifest: ${sheetInfo.manifestPath}`);
  }

  if (hasFlag('--selection-only')) {
    console.log('[stop] --selection-only — no render.');
    return;
  }

  fs.mkdirSync(manifestDir, { recursive: true });
  fs.mkdirSync(promptsDir, { recursive: true });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const childPhoto = await resolveChildPhoto();
  process.env.STORY_BANK_SKIP_WORKER_CHAIN = 'true';
  process.env.GENERATION_DISABLE_SELF_CHAIN = 'true';
  process.env.GPT_IMAGE_QUALITY = process.env.GPT_IMAGE_QUALITY?.trim() || 'low';

  const existingOrderId = flag('--order-id');
  let orderId = existingOrderId ?? '';

  if (!orderId) {
  const createRes = await fetch(`${baseUrl}/api/dev/story-bank`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storyFile: STORY_FILE,
      childName: CHILD_NAME,
      childGender: 'girl',
      childAge: 5,
      illustrationStyle: 'soft_hand_drawn_storybook',
      maxPages: 15,
      skipCover: true,
      skipPersonalization: true,
      skipWorkerChain: true,
      childPhotoBase64: childPhoto.startsWith('data:') ? childPhoto : undefined,
      childImageUrl: childPhoto.startsWith('http') ? childPhoto : undefined,
    }),
  });
  const created = (await createRes.json()) as { orderId?: string; error?: string };
  if (!createRes.ok || !created.orderId) {
    throw new Error(`Create order failed: ${JSON.stringify(created)}`);
  }
  orderId = created.orderId;
  console.log(`[order] created ${orderId}`);
  } else {
    console.log(`[order] resuming ${orderId}`);
  }

  const { prisma: prismaResume } = await import('@/lib/prisma');
  const { parsePipelineCache: parseCache } = await import('@/lib/generation-pipeline/helpers');
  const resumeJob = await prismaResume.generationJob.findUnique({ where: { orderId } });
  const resumeCache = parseCache(resumeJob?.pipelineCache);
  await prismaResume.generationJob.update({
    where: { orderId },
    data: {
      status: 'pending',
      currentStage: 'pending',
      lastError: null,
      failedAt: null,
      retryable: true,
      textDone: true,
      lockedBy: null,
      leaseExpiresAt: new Date(0),
      pipelineCache: {
        ...resumeCache,
        skipLlmPersonalization: true,
        textFinalized: true,
        devSkipCover: true,
      },
    },
  });
  await prismaResume.order.update({
    where: { id: orderId },
    data: {
      status: 'generating',
      textStatus: 'done',
      imageStatus: 'pending',
      lastError: null,
    },
  });
  console.log('[order] reset for resume — textFinalized, skipLlmPersonalization, textDone=true');

  process.env.CHILD_ANCHOR_REVIEW_OK_ORDER_IDS = orderId;
  process.env.CHUNKED_IMAGE_PAGE_FILTER = SELECTED_PAGES.join(',');
  process.env.PAGE_REF_MANIFEST_DIR = manifestDir;
  process.env.PAGE_VISUAL_QA_ENABLED = 'true';

  const { prisma } = await import('@/lib/prisma');
  const { runGenerationWorkerInvocation } = await import('@/lib/generation-chunked/process-worker');

  async function ensureJobLeaseable() {
    const j = await prisma.generationJob.findUnique({ where: { orderId } });
    if (!j) return;
    const leaseStale = !j.lockedBy || !j.leaseExpiresAt || j.leaseExpiresAt < new Date();
    const needsReset = j.status === 'failed' || j.currentStage === 'failed';
    if (!needsReset && !leaseStale) return;
    await prisma.generationJob.updateMany({
      where: { orderId },
      data: {
        lockedBy: null,
        leaseExpiresAt: new Date(0),
        ...(needsReset
          ? {
              status: 'pending',
              currentStage: 'pending',
              lastError: null,
              failedAt: null,
              retryable: true,
            }
          : {}),
      },
    });
  }
  await ensureJobLeaseable();
  const { parsePipelineCache } = await import('@/lib/generation-pipeline/helpers');
  const {
    getApprovedChildCanonicalAnchor,
    getChildCanonicalAnchor,
  } = await import('@/lib/generation-pipeline/character-anchor-store');
  const {
    generateFullChildExpressionSheet,
    mergeChildExpressionSheetIntoCache,
    getChildExpressionSheet,
  } = await import('@/lib/generation-pipeline/child-expression-sheet');
  const { resolveStyle01StoryWardrobeLock } = await import('@/lib/style01-story-wardrobe');
  const { clearOrderPageImages } = await import('@/lib/generation-chunked/clear-page-images-for-regen');
  const { loadStoryFromBank } = await import('@/backend/providers/story-bank-loader');
  const { assembleStyle01Phase2Prompt } = await import('@/lib/style01-prompt-assembly');
  const { resolveChildExpressionKindForPage } = await import(
    '@/lib/generation-pipeline/child-expression-page-map'
  );
  const { detectHumanFamilyRolesOnPage } = await import('@/lib/family-coherence');
  const { getFamilyCoherenceFromAnchors } = await import('@/lib/family-coherence/persist');

  let stage = 'dna_anchor';
  for (let i = 0; i < 80; i++) {
    await ensureJobLeaseable();
    await runGenerationWorkerInvocation(orderId);
    const job = await prisma.generationJob.findUnique({ where: { orderId } });
    const cache = parsePipelineCache(job?.pipelineCache);
    const approved = getApprovedChildCanonicalAnchor(cache);
    const pending = getChildCanonicalAnchor(cache);
    if (approved?.url) {
      console.log(`[stage0] approved anchor ${approved.url.slice(0, 90)}… score=${approved.resemblanceScore}`);
      stage = 'expression_sheet';
      break;
    }
    if (pending?.url && i > 40) {
      console.log(`[stage0] pending anchor ${pending.url.slice(0, 90)}…`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (stage !== 'expression_sheet') {
    throw new Error('Stage 0 did not produce approved child anchor in time');
  }

  let job = await prisma.generationJob.findUnique({ where: { orderId } });
  let cache = parsePipelineCache(job?.pipelineCache);
  const anchor = getApprovedChildCanonicalAnchor(cache)!;
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error('Order missing');

  if (!getChildExpressionSheet(cache)) {
    console.log('[expression] generating mini expression sheet…');
    const wardrobe = resolveStyle01StoryWardrobeLock(COMPANION_ID);
    const sheet = await generateFullChildExpressionSheet({
      order,
      baseAnchorUrl: anchor.url,
      lockedChildDescription: cache.lockedChildDescription ?? cache.dna?.childDNA ?? '',
      wardrobeLock: wardrobe,
    });
    const approvedKinds = ['neutral', 'happy', 'worried', 'shouting', 'action'] as const;
    cache = mergeChildExpressionSheetIntoCache(cache, {
      ...sheet,
      approved: true,
      approvedKinds: [...approvedKinds],
    });
    await prisma.generationJob.update({
      where: { orderId },
      data: { pipelineCache: cache },
    });
    console.log('[expression] sheet generated and marked approved (all kinds)');
  } else {
    console.log('[expression] sheet already present');
  }

  const cleared = await clearOrderPageImages(prisma, orderId, [...SELECTED_PAGES]);
  console.log(`[pages] cleared ${cleared} assets; generating pages ${SELECTED_PAGES.join(',')}`);

  await prisma.generationJob.update({
    where: { orderId },
    data: {
      status: 'pending',
      currentStage: 'page_images',
      lastError: null,
      retryable: true,
      imagesDone: false,
    },
  });

  const storyPath = path.join(process.cwd(), 'story-bank', 'v5-fixed-v2', STORY_FILE);
  const story = await loadStoryFromBank(storyPath, CHILD_NAME, 'אורי', 'girl', {
    skipLlmPersonalization: true,
  });

  const done = new Set<number>();
  for (let attempt = 1; attempt <= 120; attempt++) {
    await ensureJobLeaseable();
    await runGenerationWorkerInvocation(orderId);
    const rows = await prisma.bookPage.findMany({
      where: { book: { orderId }, pageNumber: { in: [...SELECTED_PAGES] } },
      select: {
        pageNumber: true,
        imageAsset: { select: { url: true } },
      },
    });
    for (const row of rows) {
      if (!row.imageAsset?.url || done.has(row.pageNumber)) continue;
      await download(row.imageAsset.url, path.join(pagesDir, `page-${row.pageNumber}.png`));
      done.add(row.pageNumber);
      console.log(`[pages] saved page-${row.pageNumber}.png`);
    }
    if (SELECTED_PAGES.every((p) => done.has(p))) break;
    await new Promise((r) => setTimeout(r, 2500));
  }

  if (!SELECTED_PAGES.every((p) => done.has(p))) {
    throw new Error(`Incomplete pages: missing ${SELECTED_PAGES.filter((p) => !done.has(p)).join(',')}`);
  }

  const familyBundle = getFamilyCoherenceFromAnchors(
    (await prisma.order.findUnique({ where: { id: orderId }, select: { characterAnchors: true } }))
      ?.characterAnchors
  );

  const pageReports = [];
  for (const pageNumber of SELECTED_PAGES) {
    const page = story.pages.find((p) => p.pageNumber === pageNumber)!;
    const manifestPath = path.join(manifestDir, `page-${pageNumber}.json`);
    const manifest = fs.existsSync(manifestPath)
      ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      : null;

    const exprKind = resolveChildExpressionKindForPage({
      pageNumber,
      companionId: COMPANION_ID,
      imagePrompt: page.imagePrompt,
      bookPageText: page.text,
      rawScenePrompt: page.rawScenePrompt,
    });
    const exprMeta = expressionSelectionReason(pageNumber, exprKind, COMPANION_ID);

    const { prompt, effectivePageTimeOfDay: previewEffectiveTime } = assembleStyle01Phase2Prompt({
      pageNumber,
      pagePrompt: page.imagePrompt,
      rawScenePrompt: page.rawScenePrompt,
      bookPageText: page.text,
      childFirstName: CHILD_NAME,
      childAge: 5,
      childGender: 'girl',
      companion: { id: COMPANION_ID, name: 'אורי', image: '/companions/NIGHT_FEAR/fox_uri.jpg' },
      storyTimeOfDay: story.storyTimeOfDay,
      pageTimeOfDayOverrides: story.pageTimeOfDayOverrides,
      familyCoherence: familyBundle,
    });
    fs.writeFileSync(path.join(promptsDir, `page-${pageNumber}-prompt.txt`), prompt);
    const nightLockPresent = prompt.includes('SCENE TIME-OF-DAY LOCK — NIGHT');

    const foxExpected = /fox|אורי|uri/i.test(
      `${page.imagePrompt} ${page.text} ${page.rawScenePrompt ?? ''}`
    );
    const companionRefAnalysis = analyzeCompanionRefs(manifest);
    const { resolveCompanionSheetViewForPage, resolveCompanionViewIntentForPage } = await import(
      '@/lib/generation-pipeline/companion-sheet-page-map'
    );
    const { derivePageEntityPresence } = await import('@/lib/image-entity-presence');
    const entityPresence = derivePageEntityPresence({
      bookPageText: page.text,
      imageDirection: page.imagePrompt,
      rawScenePrompt: page.rawScenePrompt,
      companionName: 'השועל אוּרי',
      companionId: COMPANION_ID,
    });
    const companionViewIntent = resolveCompanionViewIntentForPage({
      pageNumber,
      bookPageText: page.text,
      rawScenePrompt: page.rawScenePrompt,
      companionPresence: entityPresence.companionPresence,
    });
    const expectedSheetView = resolveCompanionSheetViewForPage({
      pageNumber,
      bookPageText: page.text,
      rawScenePrompt: page.rawScenePrompt,
      companionPresence: entityPresence.companionPresence,
    });
    const accessoryLockPresent = prompt.includes('COMPANION ACCESSORY');

    pageReports.push({
      pageNumber,
      category: PAGE_CATEGORIES[pageNumber],
      rationale: PAGE_RATIONALE[pageNumber],
      localImage: path.join(pagesDir, `page-${pageNumber}.png`),
      imageUrl: (
        await prisma.bookPage.findFirst({
          where: { book: { orderId }, pageNumber },
          select: { imageAsset: { select: { url: true } } },
        })
      )?.imageAsset?.url,
      foxUriExpected: foxExpected,
      companionRefAnalysis,
      expectedSheetView,
      companionPresence: entityPresence.companionPresence,
      companionViewIntent,
      sceneClass: manifest?.sceneClass ?? null,
      companionSheetViewKind: manifest?.companionSheetViewKind ?? expectedSheetView,
      companionViewMatchesSheet: manifest?.companionViewMatchesSheet ?? null,
      finalReferenceOrder: manifest?.finalOrder ?? companionRefAnalysis.finalOrder ?? [],
      accessoryLockInPrompt: accessoryLockPresent,
      visualQaFlags: manifest?.pageVisualQa ?? null,
      sheetRefOk:
        entityPresence.companionPresence === 'partial' ||
        entityPresence.companionPresence === 'offscreen_hint' ||
        !foxExpected ||
        (companionRefAnalysis.usesPublishedSheet && !companionRefAnalysis.usesSingleJpg),
      storyTimeOfDay: story.storyTimeOfDay ?? manifest?.storyTimeOfDay ?? null,
      effectivePageTimeOfDay: manifest?.effectivePageTimeOfDay ?? previewEffectiveTime,
      companionSheetViewUsed: manifest?.companionSheetView ?? companionRefAnalysis.sheetView,
      nightLockInPrompt: nightLockPresent,
      timeOfDayQa: manifest?.pageVisualQa ?? null,
      companionSilhouetteOk: manifest?.pageVisualQa?.companionSilhouetteOk ?? null,
      refManifest: manifest,
      childExpression: { kind: exprKind, ...exprMeta },
      familyCoherence: {
        exercised: false,
        profilePresent: Boolean(familyBundle),
        roles: detectHumanFamilyRolesOnPage({
          bookPageText: page.text,
          imageDirection: page.imagePrompt,
          presentEntityIds: [],
        }),
      },
      diniMarkersInPrompt: DINI_ABORT_MARKERS.filter((m) => prompt.includes(m)),
    });
  }

  const allSheetRefsOk = pageReports.every((p) => p.sheetRefOk);
  const report = {
    test: 'fox_uri_adventure_generalization',
    orderId,
    companionId: COMPANION_ID,
    publishedSheet: sheetInfo,
    companionRef: COMPANION_REF,
    childName: CHILD_NAME,
    quality: process.env.GPT_IMAGE_QUALITY ?? 'low',
    selectedPages: SELECTED_PAGES,
    pageCategories: PAGE_CATEGORIES,
    pageRationale: PAGE_RATIONALE,
    allPagesUsedPublishedSheetRefs: allSheetRefsOk,
    storyTimeOfDay: story.storyTimeOfDay,
    accessoryReviewNote:
      'fox_uri canonical accessory = glowing neck lantern (no scarf, no chest star). Sheet republished with lantern + palette fix.',
    diniSystemsLoaded: false,
    familyCoherenceExercised: false,
    familyCoherenceNote:
      'No human family in fox_uri_adventure; profile may still exist from hero DNA but no family pages in sample.',
    stage0: { anchorUrl: anchor.url, resemblanceScore: anchor.resemblanceScore },
    expressionSheet: getChildExpressionSheet(cache),
    pages: pageReports,
    outputsDir: pagesDir,
  };

  fs.writeFileSync(path.join(outRoot, 'generalization-report.json'), JSON.stringify(report, null, 2));

  const md = [
    '# Fox Uri generalization test',
    '',
    `Order: \`${orderId}\``,
    `Published sheet refs OK: **${allSheetRefsOk ? 'yes' : 'NO — check ref-manifests'}**`,
    '',
    '## Pages',
    ...SELECTED_PAGES.map(
      (n) =>
        `- **p${n}** [${PAGE_CATEGORIES[n]}]: ${PAGE_RATIONALE[n]} — [\`page-${n}.png\`](pages/page-${n}.png)`
    ),
    '',
    '## Per-page companion refs',
    ...pageReports.map(
      (p) =>
        `- p${p.pageNumber}: expected view \`${p.expectedSheetView}\`, picked \`${p.companionRefAnalysis.sheetView ?? '?'}\`, paths: ${p.companionRefAnalysis.companionRefPaths.join(' | ') || '(none)'}`
    ),
    '',
    '## Dini-free confirmation',
    'Preflight + per-page prompt scan: no Dini composition/entity locks in fox_uri run.',
    '',
    '## Family coherence',
    'Not exercised (no family pages in this story).',
    '',
    '## ROI (human review)',
    'Compare Mia identity, fox_uri consistency vs muted canonical jpg, Style 01 drift, QA flags. Decide batch sheet generation for ~36 companions.',
    '',
    '## Stop',
    'Do NOT run full 15-page book without explicit go/no-go.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(outRoot, 'generalization-report.md'), md);

  console.log('\n=== REPORT ===\n');
  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
