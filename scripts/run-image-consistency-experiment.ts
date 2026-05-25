/**
 * Image Consistency Experiment runner — Path A (gpt-image dual-reference).
 *
 * Usage:
 *   npx tsx scripts/run-image-consistency-experiment.ts bedtime
 *   npx tsx scripts/run-image-consistency-experiment.ts adventure
 *
 * Diagnostic stress tests only — not launch proof.
 */
import 'dotenv/config';
import { readFile, mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { generateGPTImage } from '../lib/generate-image';
import { getStyleContract } from '../lib/styles';
import {
  bookWardrobeVerificationToken,
  buildBookWardrobePromptSection,
  logBookWardrobeLockOnce,
  resolveBookWardrobeLock,
  type BookDirection,
} from '../lib/book-wardrobe-lock';

process.env.IMAGE_PROVIDER = 'gpt-image';

const STORY_BY_DIRECTION: Record<BookDirection, string> = {
  bedtime: path.join(process.cwd(), 'gold-candidates', 'bolly_bedtime_v0.5.0-b_gold.md'),
  adventure: path.join(process.cwd(), 'gold-candidates', 'bolly_adventure_v0.5.0-f_gold.md'),
  fantasy: path.join(process.cwd(), 'gold-candidates', 'bolly_fantasy_v0.5.5g_gold.md'),
};

const TEST_CHILD_PATH = path.join(
  process.cwd(),
  'public',
  'experiments',
  'image-consistency-1',
  'test-child-reference.jpg'
);

const BOLLY_REF_PATH = path.join(
  process.cwd(),
  'public',
  'companions',
  'bolly_armadillo',
  'reference.jpg'
);

const CHILD_NAME = 'מיכל';
const ILLUSTRATION_STYLE = 'realistic_illustrated';

const BOLLY_VISUAL =
  'Bolly the armadillo companion: small friendly armadillo with warm tan-brown segmented shell plates, one plate slightly open showing soft pink belly, round dark gentle eyes, short snout.';

const CHILD_FACE =
  'Michal, a 5-year-old girl with warm olive skin, soft brown eyes.';

type ParsedPage = {
  pageNumber: number;
  text: string;
  imageDirection: string;
};

function parseExperimentStory(raw: string): { title: string; pages: ParsedPage[] } {
  const yamlTitleMatch = raw.match(/^title:\s*['"]?(.+?)['"]?\s*$/m);
  const title = yamlTitleMatch?.[1]?.trim() || `הסיפור של ${CHILD_NAME}`;

  const pageParts = raw.split(/---\s*Page\s*(\d+)\s*---/).slice(1);
  const pages: ParsedPage[] = [];

  for (let i = 0; i < pageParts.length; i += 2) {
    const pageNumber = parseInt(pageParts[i], 10);
    if (!Number.isFinite(pageNumber)) continue;
    const block = pageParts[i + 1] ?? '';
    const imageDirectionMatch = block.match(/imageDirection:\s*(.+)/);
    const imageDirection = imageDirectionMatch?.[1]?.trim() ?? '';
    const text = block
      .replace(/imageDirection:.*/g, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .trim();
    pages.push({ pageNumber, text, imageDirection });
  }

  return { title, pages };
}

function buildPagePrompt(
  page: ParsedPage,
  styleDescription: string,
  direction: BookDirection,
  runId: string
): string {
  const wardrobeLock = resolveBookWardrobeLock(direction);
  if (!wardrobeLock) {
    throw new Error(`No wardrobe lock for direction: ${direction}`);
  }
  logBookWardrobeLockOnce(wardrobeLock, runId);

  const moodLine =
    direction === 'bedtime'
      ? 'Warm bedtime bedroom mood, soft evening light.'
      : direction === 'adventure'
        ? 'Daytime adventure mood — clinic, street, and indoor scenes with natural daylight.'
        : 'Fantasy storybook mood with gentle magical lighting.';

  return [
    `Children's picture book illustration, page ${page.pageNumber}.`,
    `Protagonist: ${CHILD_NAME} (${CHILD_FACE}).`,
    buildBookWardrobePromptSection(wardrobeLock),
    `Companion: ${BOLLY_VISUAL}`,
    `Scene: ${page.imageDirection || page.text.slice(0, 200)}`,
    `Story moment (Hebrew): ${page.text.replace(/\n/g, ' ').slice(0, 300)}`,
    `Style: ${styleDescription}`,
    moodLine,
    'Medium-close framing — characters occupy about 55-65% of frame.',
    'ZERO text, letters, Hebrew, or words anywhere in the image.',
  ].join('\n');
}

function parseDirectionArg(): BookDirection {
  const arg = (process.argv[2] ?? 'bedtime').trim().toLowerCase();
  if (arg === 'adventure' || arg === 'bedtime' || arg === 'fantasy') return arg;
  console.error(`Unknown direction "${arg}". Use: bedtime | adventure | fantasy`);
  process.exit(1);
}

async function main() {
  const direction = parseDirectionArg();
  const storyPath = STORY_BY_DIRECTION[direction];
  const orderId = `exp-${direction}-${randomUUID().slice(0, 8)}`;
  const outDir = path.join(
    process.cwd(),
    'image-experiment-1',
    `${direction}-${new Date().toISOString().slice(0, 10)}-${orderId}`
  );
  await mkdir(outDir, { recursive: true });

  const wardrobeLock = resolveBookWardrobeLock(direction)!;

  console.log(`=== Image Consistency Experiment — ${direction} (stress test) ===`);
  console.log('Status: Path A viable, not proven — diagnostic only');
  console.log(`IMAGE_PROVIDER=gpt-image (images.edit, 2 refs per page)`);
  console.log(`output: ${outDir}\n`);

  const referenceImages = [TEST_CHILD_PATH, BOLLY_REF_PATH];
  console.log(`references: child=${TEST_CHILD_PATH}`);
  console.log(`            bolly=${BOLLY_REF_PATH}\n`);

  logBookWardrobeLockOnce(wardrobeLock, orderId);

  const raw = await readFile(storyPath, 'utf8');
  const { title, pages } = parseExperimentStory(raw);
  console.log(`Loaded "${title}" — ${pages.length} pages`);
  console.log(`Wardrobe lock will appear in all ${pages.length} page prompts.\n`);

  const styleContract = getStyleContract(ILLUSTRATION_STYLE);
  const styleDescription =
    styleContract?.renderingDescription ??
    "Soft hand-painted children's book watercolor, warm gentle colors.";

  const verificationToken = bookWardrobeVerificationToken(wardrobeLock);
  const manifestPages: Array<{
    pageNumber: number;
    localPath: string;
    durationMs: number;
    hasDualReference: boolean;
    wardrobeLockPresent: boolean;
  }> = [];

  for (const page of pages) {
    const prompt = buildPagePrompt(page, styleDescription, direction, orderId);
    const wardrobePresent = prompt.includes(verificationToken) && prompt.includes(wardrobeLock.outfit);
    if (!wardrobePresent) {
      throw new Error(`Wardrobe lock missing from prompt for page ${page.pageNumber}`);
    }
    console.log(
      `[page ${page.pageNumber}] generating (refs=2, wardrobeLock=${wardrobePresent ? 'yes' : 'NO'})...`
    );

    const result = await generateGPTImage({
      finalPrompt: prompt,
      negativePrompt:
        'text, letters, words, Hebrew, numbers, watermark, signature, frame, border, scary, dark, crying',
      size: '1024x1536',
      quality: 'high',
      referenceImages,
    });

    const localFilename = `page-${String(page.pageNumber).padStart(2, '0')}.png`;
    const localPath = path.join(outDir, localFilename);
    await writeFile(localPath, result.buffer);

    console.log(
      `  ✓ ${localFilename} (${Math.round(result.buffer.length / 1024)} KB, ${result.durationMs}ms)`
    );

    manifestPages.push({
      pageNumber: page.pageNumber,
      localPath: localFilename,
      durationMs: result.durationMs,
      hasDualReference: true,
      wardrobeLockPresent: wardrobePresent,
    });
  }

  const manifest = {
    experiment: 'image-consistency-path-a',
    direction,
    diagnosticOnly: true,
    pathAStatus: 'viable-not-proven',
    generatedAt: new Date().toISOString(),
    orderId,
    provider: 'gpt-image',
    model: process.env.GPT_IMAGE_MODEL || 'gpt-image-1',
    storyFile: storyPath,
    childReference: TEST_CHILD_PATH,
    bollyReference: BOLLY_REF_PATH,
    referenceImageOrder: ['child-photo', 'bolly-reference'],
    wardrobeLock: {
      direction: wardrobeLock.direction,
      outfit: wardrobeLock.outfit,
      hairstyle: wardrobeLock.hairstyle,
      verifiedInAllPrompts: manifestPages.every((p) => p.wardrobeLockPresent),
    },
    pagesGenerated: manifestPages.length,
    pages: manifestPages,
    qaChecklist: [
      'Same child on every page?',
      'Same Bolly on every page?',
      'Same locked outfit on every page (not beige tee from photo)?',
      'Same locked hairstyle on every page?',
      'Each scene matches page text?',
      'No Hebrew/text inside images?',
      'Composition tolerable across varied scenes?',
    ],
  };

  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  console.log(`\n=== Done ===`);
  console.log(`Pages: ${manifestPages.length}/${pages.length}`);
  console.log(`Wardrobe lock in all prompts: ${manifest.wardrobeLock.verifiedInAllPrompts ? 'YES' : 'NO'}`);
  console.log(`Output: ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
