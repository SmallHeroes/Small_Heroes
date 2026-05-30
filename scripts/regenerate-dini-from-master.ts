/**
 * scripts/regenerate-dini-from-master.ts
 *
 * Stage 1.5 — Dini identity refinement.
 *
 * Takes a single APPROVED master Pose 2 of Dini and regenerates the remaining
 * 3 poses (front-standing, side-profile, small-action) using images.edit with
 * the master as image-reference so the model is conditioned on Dini's actual
 * face/body identity rather than re-deriving it from text.
 *
 * After this:
 *   public/companions/dragon_dini/style01-sheets/
 *     dini-master.png            <- Pose 2 (you provide; renamed from dini-pose-2-three-quarter.png)
 *     dini-front-v2.png          <- generated here
 *     dini-side-v2.png           <- generated here
 *     dini-action-v2.png         <- generated here
 *
 * Usage:
 *   # 1. Copy approved Pose 2 to master:
 *   #    Copy-Item public/companions/dragon_dini/style01-sheets/dini-pose-2-three-quarter.png `
 *   #            public/companions/dragon_dini/style01-sheets/dini-master.png
 *
 *   # 2. Dry run — print prompts only
 *   npx tsx scripts/regenerate-dini-from-master.ts --dry-run
 *
 *   # 3. Real run (paid). Model = gpt-image-2 by default for production refs.
 *   npx tsx scripts/regenerate-dini-from-master.ts --confirm
 *
 * Env:
 *   OPENAI_API_KEY       required
 *   STYLE_01_GPT_MODEL   optional, default 'gpt-image-2' (override to gpt-image-1 if needed)
 *   DINI_QUALITY         optional, default 'high' (sheets are reused — invest)
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';

const SHEETS_DIR = path.join('public', 'companions', 'dragon_dini', 'style01-sheets');
const MASTER_PATH = path.join(SHEETS_DIR, 'dini-master.png');

const DINI_VISUAL_LOCK =
  `Same exact Dini from the attached reference image. Do not invent a different copper dragon. ` +
  `Match every identity landmark verbatim:\n` +
  `  - rounded friendly head (NOT long lizard skull)\n` +
  `  - short rounded snout\n` +
  `  - EXACTLY two small curved horns on top of the head — same shape and size as the reference\n` +
  `  - small soft side ear-frills/cheek-fins behind the cheeks — same shape every pose, do NOT swap between ear, horn, fin and spike\n` +
  `  - three or four small back spikes behind the head, same count, same spacing, same softness as the reference (do NOT remove spikes entirely, do NOT add a full spinal ridge)\n` +
  `  - large dark eyes with one small white highlight in each eye\n` +
  `  - warm cream belly plates, soft and visible from neck to tail\n` +
  `  - copper-orange scaly body, same density and softness as the reference\n` +
  `  - peach/coral wing membranes, same size proportion as the reference (do NOT make wings enormous)\n` +
  `  - rounded childlike body proportions, NOT a long lean lizard\n` +
  `  - same scale texture density, same line weight, same color saturation as the reference\n` +
  `  - if a small warm flame appears, it is gentle and soft, not aggressive`;

const STYLE_01_WRAPPER =
  `Style 01 — soft hand-drawn children's-storybook character study on warm cream paper. ` +
  `Single character, centered on a clean off-white background, NO scene, NO props. ` +
  `Gentle transparent watercolor washes, visible paper texture, delicate hand-drawn linework, ` +
  `luminous muted palette, cozy picture-book warmth. ` +
  `NOT cinematic, NOT photorealistic, NOT Pixar CGI, NOT dense ink-and-gouache. ` +
  `[NO TEXT, no labels, no signatures, no watermarks.]`;

type Pose = { id: string; outFile: string; description: string };

const POSES: Pose[] = [
  {
    id: 'front',
    outFile: 'dini-front-v2.png',
    description:
      `Same Dini as the reference, redrawn in a clean front view: full body standing on four legs facing the viewer, ` +
      `wings folded comfortably at the sides (not spread), neutral peaceful expression, head facing forward. ` +
      `Keep IDENTICAL: horn shape, ear/cheek-fin shape, back-spike count, eye style, body proportion, color.`,
  },
  {
    id: 'three-quarter',
    outFile: 'dini-three-quarter-v2.png',
    description:
      `Same Dini as the reference, redrawn in a calm three-quarter view (body angled roughly 30-45 degrees from the viewer), ` +
      `full body on four legs, head turned slightly toward the camera with a soft friendly expression, wings folded at sides (NOT raised, NOT spread), ` +
      `weight settled, neutral storybook companion stance. ` +
      `This is NOT upright on hind legs — it is the rounded childlike four-legged Dini at a friendly angle. ` +
      `Keep IDENTICAL: horn shape, ear/cheek-fin shape, back-spike count and spacing, eye style with white highlight, belly plates, wing size proportion, body roundness and age.`,
  },
  {
    id: 'side',
    outFile: 'dini-side-v2.png',
    description:
      `Same Dini as the reference, redrawn in a pure side profile: full body walking gently on four legs from left to right, ` +
      `tail extended naturally behind, wings tucked against the body, gentle determined expression, head facing forward in profile. ` +
      `Keep IDENTICAL: horn shape, ear/cheek-fin shape, back-spike count and spacing (visible in profile), eye style, body proportion, color. ` +
      `Body must NOT become longer or more lizard-like — keep the rounded childlike proportions from the reference.`,
  },
  {
    id: 'action',
    outFile: 'dini-action-v2.png',
    description:
      `Same Dini as the reference, redrawn in a small gentle action pose: standing on hind legs with both wings opening softly upward and outward (not full flight, not aggressive), ` +
      `front legs slightly raised in a friendly waving or stretching gesture, gentle happy expression. ` +
      `Keep IDENTICAL: horn shape, ear/cheek-fin shape, back-spike count, eye style, body proportion, color. ` +
      `Keep the wings the same size relative to the body as in the reference — do NOT enlarge.`,
  },
];

function parseArgs(): { dryRun: boolean; confirmed: boolean; only?: string } {
  const args = process.argv.slice(2);
  const only = args.find((a) => a.startsWith('--only='))?.split('=')[1];
  return {
    dryRun: args.includes('--dry-run'),
    confirmed: args.includes('--confirm'),
    only,
  };
}

function buildPrompt(p: Pose): string {
  return [
    `Pose change for the SAME Dini in the attached reference: ${p.description}`,
    ``,
    DINI_VISUAL_LOCK,
    ``,
    STYLE_01_WRAPPER,
  ].join('\n');
}

async function main(): Promise<void> {
  const { dryRun, confirmed, only } = parseArgs();

  const poses = only ? POSES.filter((p) => p.id === only) : POSES;
  if (poses.length === 0) {
    console.error(`No pose matches --only=${only}. Valid: ${POSES.map((p) => p.id).join(', ')}`);
    process.exit(1);
  }

  const quality = (process.env.DINI_QUALITY?.trim() || 'high') as 'low' | 'medium' | 'high';
  const model = process.env.STYLE_01_GPT_MODEL?.trim() || 'gpt-image-2';
  const costPerImage = { low: 0.011, medium: 0.042, high: 0.167 }[quality];
  const estCost = poses.length * costPerImage;

  console.log(`\n=== Dini v2 regenerator (reference-conditioned) ===`);
  console.log(`Master:    ${MASTER_PATH}`);
  console.log(`Model:     ${model}`);
  console.log(`Quality:   ${quality}`);
  console.log(`Poses:     ${poses.map((p) => p.id).join(', ')} (${poses.length})`);
  console.log(`Est cost:  $${estCost.toFixed(2)}`);
  console.log(``);

  if (dryRun) {
    console.log('--dry-run: printing prompts only, no API calls\n');
    for (const p of poses) {
      console.log(`\n--- ${p.id} → ${p.outFile} ---`);
      console.log(buildPrompt(p));
    }
    return;
  }

  if (!confirmed) {
    console.error('Refusing to run without --confirm (paid API calls).');
    process.exit(1);
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.error('OPENAI_API_KEY missing in environment.');
    process.exit(1);
  }

  if (!existsSync(MASTER_PATH)) {
    console.error(`Master image not found: ${MASTER_PATH}`);
    console.error(`Copy your approved Pose 2 file there first:`);
    console.error(`  Copy-Item ${SHEETS_DIR}/dini-pose-2-three-quarter.png ${MASTER_PATH}`);
    process.exit(1);
  }

  const client = new OpenAI({ apiKey });
  const masterBytes = await readFile(MASTER_PATH);
  const outDir = path.join(process.cwd(), SHEETS_DIR);
  await mkdir(outDir, { recursive: true });

  let calls = 0;
  let errors = 0;

  for (const p of poses) {
    calls++;
    const outFile = path.join(outDir, p.outFile);
    const prompt = buildPrompt(p);

    process.stdout.write(`  [${calls}/${poses.length}] ${p.id} ... `);
    try {
      const imageFile = await toFile(masterBytes, 'dini-master.png', { type: 'image/png' });
      const response = await client.images.edit({
        model,
        image: imageFile,
        prompt,
        size: '1024x1024',
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

  console.log(`\n=== Summary ===`);
  console.log(`Calls:        ${calls}`);
  console.log(`Saved:        ${calls - errors}`);
  console.log(`Errors:       ${errors}`);
  console.log(`Actual cost:  ~$${(calls * costPerImage).toFixed(2)}`);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
