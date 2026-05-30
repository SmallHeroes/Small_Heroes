/**
 * scripts/generate-style01-character-sheets.ts
 *
 * Generates Style 01 watercolor character identity sheets via gpt-image-1.
 * Each sheet is a clean single-character reference image used as a multi-ref
 * when rendering book pages, to prevent DNA drift across the 5-page audition.
 *
 * Targets:
 *   Dini       — 4 poses → public/companions/dragon_dini/style01-sheets/dini-pose-{1..4}.png
 *   Baby dragon — 3 poses → public/companions/dragon_dini/style01-sheets/baby-dragon-pose-{1..3}.png
 *   Dobi       — 4 poses → public/companions/bear_cub_gahal/style01-sheets/dobi-pose-{1..4}.png
 *
 * Usage:
 *   # Dry run — print prompts only, NO API calls
 *   npx tsx scripts/generate-style01-character-sheets.ts --target=all --dry-run
 *
 *   # Real run — paid API calls. Must pass --confirm
 *   npx tsx scripts/generate-style01-character-sheets.ts --target=dini --quality=medium --confirm
 *
 *   # All characters, medium quality (~ $0.46)
 *   npx tsx scripts/generate-style01-character-sheets.ts --target=all --quality=medium --confirm
 *
 * Env:
 *   OPENAI_API_KEY            required
 *   STYLE_01_GPT_MODEL        optional, default 'gpt-image-1'
 *   STYLE_01_SHEET_SIZE       optional, default '1024x1024'
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';

type PoseSpec = { id: string; description: string };

type CharacterSpec = {
  characterId: string;
  outputDir: string;        // relative to project root
  filePrefix: string;
  visualLock: string;
  poses: PoseSpec[];
};

const STYLE_01_WRAPPER =
  `Style 01 — soft hand-drawn children's-storybook character study on warm cream paper. ` +
  `Single character, centered, full body visible, with airy negative space around it on a clean off-white background. ` +
  `NO scene, NO props, NO story context — this is reference art only. ` +
  `Gentle transparent watercolor washes, visible paper texture, delicate hand-drawn linework, ` +
  `luminous muted palette, cozy picture-book warmth. ` +
  `NOT cinematic, NOT photorealistic, NOT Pixar CGI, NOT dense ink-and-gouache. ` +
  `[NO TEXT, no labels, no signatures, no watermarks, no border decorations.]`;

const CHARACTERS: CharacterSpec[] = [
  {
    characterId: 'dini',
    outputDir: 'public/companions/dragon_dini/style01-sheets',
    filePrefix: 'dini-pose-',
    visualLock:
      `Dini — young copper-orange dragon companion. Polished copper-orange scales across the body. ` +
      `Wings the color of sunset peach and coral. Warm hugging fire glow — soft orange, never destructive flames. ` +
      `Expressive gentle eyes. Medium body size — roughly the size of a large dog. ` +
      `Same species, same copper palette, same proportions in every pose. ` +
      `NOT green, NOT blue, NOT a generic lizard. Same Dini every time.`,
    poses: [
      { id: '1-front', description: 'front view, full body, standing calmly facing the viewer, wings folded comfortably at the sides, expression peaceful and curious' },
      { id: '2-three-quarter', description: 'three-quarter turn (body angled ~45 degrees), full body, head turned slightly toward viewer, one wing partially extended showing detail' },
      { id: '3-side', description: 'pure side profile, full body, walking gently on four legs, tail extended behind, wings tucked, gentle determined gait' },
      { id: '4-action', description: 'soaring in mid-flight, both wings fully extended outward, body angled slightly downward as if descending, gentle expression, viewed from a slight low angle' },
    ],
  },
  {
    characterId: 'baby-dragon',
    outputDir: 'public/companions/dragon_dini/style01-sheets',
    filePrefix: 'baby-dragon-pose-',
    visualLock:
      `Tiny copper-orange baby dragon hatchling. Same copper-orange scale family as Dini but MUCH smaller — ` +
      `fits comfortably in two cupped hands. Wobbly small legs, oversized round head with wide curious eyes, ` +
      `tiny sunset-colored wings still folded close to body, no fire yet, no horns yet. ` +
      `ONLY ONE baby dragon. Soft proportions, very young, vulnerable feeling. ` +
      `NOT green, NOT teal, NOT a separate species — clearly Dini's kin.`,
    poses: [
      { id: '1-curled', description: 'curled up and asleep, body wrapped softly into a small bundle, eyes closed, head tucked against belly, tail wrapped around itself' },
      { id: '2-wobble', description: 'standing on wobbly legs for the first time, slightly off-balance, looking up with wide curious eyes, mouth slightly open' },
      { id: '3-nestled', description: 'sitting upright comfortably, nestled in place, looking out toward the viewer with bright eyes, head slightly tilted' },
    ],
  },
  {
    characterId: 'dobi',
    outputDir: 'public/companions/bear_cub_gahal/style01-sheets',
    filePrefix: 'dobi-pose-',
    visualLock:
      `Dobi — small chubby warm-brown bear cub companion. Honey-dark amber eyes, big soft expressive eyebrows, ` +
      `oversized paws (still learning to walk quietly), rounded ears, short rounded snout, faint warm chest glow. ` +
      `Same fur tone and proportions in every pose. About knee-height to a small child. ` +
      `NOT a polar bear, NOT a panda, NOT a brown grizzly, NOT a realistic photo bear.`,
    poses: [
      { id: '1-front', description: 'front view, full body sitting on hind legs, front paws relaxed in lap, smiling gently at viewer, ears perked' },
      { id: '2-three-quarter', description: 'three-quarter turn, walking on all fours, one paw lifted mid-step, head turned slightly to look ahead with curiosity' },
      { id: '3-side', description: 'pure side profile, sitting upright watching something off-frame, ears alert, soft attentive expression' },
      { id: '4-reach', description: 'standing on hind legs reaching upward (as if toward an imagined high object), front paws stretched up, expression eager and gentle' },
    ],
  },
];

const COST_PER_IMAGE_USD: Record<string, number> = {
  low: 0.011,
  medium: 0.042,
  high: 0.167,
};

function parseArgs(): { target: string; quality: 'low' | 'medium' | 'high'; dryRun: boolean; confirmed: boolean } {
  const args = process.argv.slice(2);
  const getArg = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
  const target = getArg('target') ?? 'all';
  const quality = (getArg('quality') ?? 'medium') as 'low' | 'medium' | 'high';
  const dryRun = args.includes('--dry-run');
  const confirmed = args.includes('--confirm');
  return { target, quality, dryRun, confirmed };
}

function buildPrompt(c: CharacterSpec, p: PoseSpec): string {
  return [
    `Character reference study — ${p.description}.`,
    ``,
    `CHARACTER IDENTITY (verbatim every pose):`,
    c.visualLock,
    ``,
    STYLE_01_WRAPPER,
  ].join('\n');
}

async function main(): Promise<void> {
  const { target, quality, dryRun, confirmed } = parseArgs();

  if (!COST_PER_IMAGE_USD[quality]) {
    console.error(`Invalid --quality=${quality}. Use low | medium | high.`);
    process.exit(1);
  }

  const characters = target === 'all' ? CHARACTERS : CHARACTERS.filter((c) => c.characterId === target);
  if (characters.length === 0) {
    console.error(`No characters matched --target=${target}.`);
    console.error(`Valid: ${CHARACTERS.map((c) => c.characterId).join(', ')} | all`);
    process.exit(1);
  }

  const totalImages = characters.reduce((sum, c) => sum + c.poses.length, 0);
  const estCost = totalImages * COST_PER_IMAGE_USD[quality];

  console.log(`\n=== Style 01 Character Sheet Generator ===`);
  console.log(`Target:    ${target}`);
  console.log(`Quality:   ${quality}`);
  console.log(`Images:    ${totalImages}`);
  console.log(`Est cost:  $${estCost.toFixed(2)}`);
  console.log(``);

  if (dryRun) {
    console.log('--dry-run: printing prompts only, no API calls\n');
    for (const c of characters) {
      for (const p of c.poses) {
        console.log(`\n--- ${c.characterId} / ${p.id} ---`);
        console.log(buildPrompt(c, p));
      }
    }
    return;
  }

  if (!confirmed) {
    console.error('Refusing to run without --confirm (this calls paid OpenAI APIs).');
    console.error('Add --dry-run first to preview prompts, then --confirm to execute.');
    process.exit(1);
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.error('OPENAI_API_KEY missing in environment.');
    process.exit(1);
  }

  const model = process.env.STYLE_01_GPT_MODEL?.trim() || 'gpt-image-1';
  const size = (process.env.STYLE_01_SHEET_SIZE?.trim() || '1024x1024') as '1024x1024' | '1024x1536' | '1536x1024';

  console.log(`Model:     ${model}`);
  console.log(`Size:      ${size}`);
  console.log(``);

  const client = new OpenAI({ apiKey });

  let calls = 0;
  let errors = 0;

  for (const c of characters) {
    const outDir = path.join(process.cwd(), c.outputDir);
    await mkdir(outDir, { recursive: true });
    console.log(`\n>>> ${c.characterId} → ${outDir}`);

    for (const p of c.poses) {
      calls++;
      const outFile = path.join(outDir, `${c.filePrefix}${p.id}.png`);
      const prompt = buildPrompt(c, p);

      process.stdout.write(`  [${calls}/${totalImages}] ${c.characterId} / ${p.id} ... `);
      try {
        const response = await client.images.generate({
          model,
          prompt,
          size,
          quality: quality as 'low' | 'medium' | 'high',
          n: 1,
        });

        const item = response.data?.[0];
        if (!item) throw new Error('No image in API response');

        let buffer: Buffer | null = null;
        if (item.b64_json) {
          buffer = Buffer.from(item.b64_json, 'base64');
        } else if (item.url) {
          const res = await fetch(item.url);
          if (!res.ok) throw new Error(`fetch ${item.url} → HTTP ${res.status}`);
          buffer = Buffer.from(await res.arrayBuffer());
        }

        if (!buffer) throw new Error('No image bytes returned');
        await writeFile(outFile, buffer);
        console.log(`OK (${(buffer.length / 1024).toFixed(0)} KB)`);
      } catch (err) {
        errors++;
        console.log(`FAIL`);
        console.error(`     ${(err as Error).message}`);
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total calls:  ${calls}`);
  console.log(`Saved:        ${calls - errors}`);
  console.log(`Errors:       ${errors}`);
  console.log(`Actual cost:  ~$${(calls * COST_PER_IMAGE_USD[quality]).toFixed(2)}`);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
