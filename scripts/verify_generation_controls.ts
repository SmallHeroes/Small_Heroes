import fs from 'fs';
import path from 'path';
import { generateAllPageImages } from '../backend/providers/image';
const argv = new Set(process.argv.slice(2));
const isLive = argv.has('--live');
const hasLiveConfirmation = argv.has('--confirm-live');
const MAX_PAGES = 5;
const CONTROL_STYLE_ID = 'soft_hand_drawn_storybook';

function loadEnv(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(path.resolve(process.cwd(), '.env.local'));
loadEnv(path.resolve(process.cwd(), '.env'));

async function run() {
  if (isLive && !hasLiveConfirmation) {
    throw new Error('Live mode requires --confirm-live');
  }

  const lines: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    const line = args.map((arg) => String(arg)).join(' ');
    lines.push(line);
    originalLog(...args);
  };

  const pages = [
    { pageNumber: 1, imagePrompt: 'simple flat 2d cartoon child in room with father, clean outlines and minimal shading', expectedCharacterIds: ['child', 'father'], imageSubject: 'child' },
    { pageNumber: 2, imagePrompt: 'simple flat 2d cartoon child and father under stars, clear silhouettes and reduced texture', expectedCharacterIds: ['child', 'father'], imageSubject: 'child' },
    { pageNumber: 3, imagePrompt: 'simple flat 2d cartoon child in spaceship imagination, clean edge definition and no cinematic glow', expectedCharacterIds: ['child'], imageSubject: 'child' },
    { pageNumber: 4, imagePrompt: 'simple flat 2d cartoon child father and orange cat on couch, simplified background', expectedCharacterIds: ['child', 'father', 'cat'], imageSubject: 'child' },
    { pageNumber: 5, imagePrompt: 'simple flat 2d cartoon child asleep with orange cat, minimal shading and calm clean room', expectedCharacterIds: ['child', 'cat'], imageSubject: 'child' },
  ];

  if (pages.length > MAX_PAGES) {
    throw new Error(`Refusing to run more than ${MAX_PAGES} pages`);
  }

  if (!isLive) {
    originalLog(
      JSON.stringify(
        {
          mode: 'dry-run',
          selectedStyleId: CONTROL_STYLE_ID,
          pages: pages.length,
          maxPages: MAX_PAGES,
          note: 'No provider call made. Use --live --confirm-live to run real generation.',
        },
        null,
        2
      )
    );
    return;
  }

  if (process.env.DISABLE_IMAGE_GENERATION === 'true') {
    throw new Error('Live verification blocked: DISABLE_IMAGE_GENERATION=true');
  }

  originalLog('LIVE IMAGE GENERATION ENABLED');
  const orderId = `control-${Date.now()}`;
  const result = await generateAllPageImages(pages, {
    illustrationStyle: CONTROL_STYLE_ID,
    childDescription: 'boy age 6 short brown hair yellow t-shirt blue shorts',
    orderId,
    initialCharacterAnchors: {},
    existingPageNumbers: [],
  });

  const attemptLines = lines.filter((line) => line.includes('[ImageAttempt]'));
  const relevantAttempts = attemptLines.filter((line) => line.includes(`orderId=${orderId}`));
  const actualPredictionAttempts = relevantAttempts.filter((line) => line.includes('skippedExistingImage=false')).length;
  const retryAttempts = relevantAttempts.filter((line) => /attempt=[2-9]/.test(line)).length;
  const attemptsPerPage = new Map<number, number>();
  for (const line of relevantAttempts) {
    const pageMatch = line.match(/page=(\d+)/);
    if (!pageMatch) continue;
    const page = Number(pageMatch[1]);
    attemptsPerPage.set(page, (attemptsPerPage.get(page) ?? 0) + 1);
  }
  const finalUrls = [...result.results.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([pageNumber, image]) => ({ pageNumber, url: image.url }));
  const compositionPerPage = lines
    .map((line) => {
      const match = line.match(
        /\[ImageComposition\] Page (\d+)\/\d+ — type=([a-z-]+) cameraDistance=([a-z-]+) cameraAngle=([a-z-]+(?: [a-z-]+)?) characterPose=([a-z-]+) interactionType=([a-z-]+)/
      );
      if (!match) return null;
      return {
        pageNumber: Number(match[1]),
        compositionType: match[2],
        cameraDistance: match[3],
        cameraAngle: match[4],
        characterPose: match[5],
        interactionType: match[6],
      };
    })
    .filter(
      (
        item
      ): item is {
        pageNumber: number;
        compositionType: string;
        cameraDistance: string;
        cameraAngle: string;
        characterPose: string;
        interactionType: string;
      } => Boolean(item)
    )
    .sort((a, b) => a.pageNumber - b.pageNumber);
  const hasCompositionDuplicates =
    new Set(compositionPerPage.map((item) => item.compositionType)).size !== compositionPerPage.length;
  const promptPreviews = lines
    .map((line) => {
      const match = line.match(/\[Image\] Page (\d+)\/\d+ — .*preview="([^"]*)"/);
      if (!match) return null;
      return {
        pageNumber: Number(match[1]),
        promptPreview: match[2],
      };
    })
    .filter((item): item is { pageNumber: number; promptPreview: string } => Boolean(item))
    .sort((a, b) => a.pageNumber - b.pageNumber);

  originalLog(
    JSON.stringify(
      {
        orderId,
        selectedStyleId: CONTROL_STYLE_ID,
        pages: 5,
        totalPredictionAttempts: actualPredictionAttempts,
        retryAttempts,
        attemptsPerPage: Object.fromEntries([...attemptsPerPage.entries()].sort((a, b) => a[0] - b[0])),
        compositionPerPage,
        compositionVariationHasDuplicates: hasCompositionDuplicates,
        promptPreviews,
        finalImageUrls: finalUrls,
        failedPages: result.failedPages,
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
