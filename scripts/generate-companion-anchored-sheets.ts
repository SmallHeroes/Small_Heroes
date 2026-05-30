/**
 * scripts/generate-companion-anchored-sheets.ts
 *
 * Auto-anchored Style 01 sheet generation:
 *   1. Generate pose-1 via images.generate (text-only). Save as <name>-master.png.
 *   2. Generate the remaining poses via images.edit conditioned on the master.
 *
 * This is the same flow we used for Dini v2 (which passed 5/5 QA), now for
 * baby_dragon and Dobi where we don't already have a hand-picked master.
 *
 * Usage:
 *   npx tsx scripts/generate-companion-anchored-sheets.ts --target=baby-dragon --dry-run
 *   npx tsx scripts/generate-companion-anchored-sheets.ts --target=baby-dragon --confirm
 *   npx tsx scripts/generate-companion-anchored-sheets.ts --target=dobi --confirm
 *
 * Output:
 *   public/companions/dragon_dini/style01-sheets/baby-dragon-master.png
 *   public/companions/dragon_dini/style01-sheets/baby-dragon-{curled,wobble,nestled}-v2.png
 *   public/companions/bear_cub_gahal/style01-sheets/dobi-master.png
 *   public/companions/bear_cub_gahal/style01-sheets/dobi-{front,three-quarter,side,reach}-v2.png
 *
 * Env:
 *   OPENAI_API_KEY                required
 *   STYLE_01_GPT_MODEL            optional, default 'gpt-image-2'
 *   COMPANION_SHEET_QUALITY       optional, default 'medium'
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';

const STYLE_01_WRAPPER =
  `Style 01 — soft hand-drawn children's-storybook character study on warm cream paper. ` +
  `Single character, centered on a clean off-white background, NO scene, NO props. ` +
  `Gentle transparent watercolor washes, visible paper texture, delicate hand-drawn linework, ` +
  `luminous muted palette, cozy picture-book warmth. ` +
  `NOT cinematic, NOT photorealistic, NOT Pixar CGI, NOT dense ink-and-gouache. ` +
  `[NO TEXT, no labels, no signatures, no watermarks.]`;

type Pose = { id: string; description: string };

type CompanionSpec = {
  characterId: string;       // 'baby-dragon' | 'dobi'
  outputDir: string;
  masterFile: string;        // e.g. 'baby-dragon-master.png'
  visualLock: string;
  anchorPose: Pose;          // generated first via text-only
  followupPoses: Pose[];     // generated via image.edit from master
};

const COMPANIONS: Record<string, CompanionSpec> = {
  'baby-dragon': {
    // NESTED subfolder: resolver expects /baby-dragon/ inside style01-sheets/
    characterId: 'baby-dragon',
    outputDir: 'public/companions/dragon_dini/style01-sheets/baby-dragon',
    masterFile: 'baby-dragon-01-master.png',
    visualLock:
      `Same EXACT baby dragon every pose — one consistent character. Match every identity landmark:\n` +
      `  - Tiny copper-orange dragon hatchling, MUCH smaller than an adult dragon (fits in two cupped hands)\n` +
      `  - oversized round soft head with large dark eyes and a tiny white highlight in each eye\n` +
      `  - very short rounded snout, almost button-like\n` +
      `  - EXACTLY two tiny soft bumps on top of the head (NOT yet developed horns) — same shape every pose\n` +
      `  - small soft side ear-flaps behind the cheeks, same shape every pose\n` +
      `  - tiny sunset-coral wings still folded close to the body, NOT spread\n` +
      `  - NO back spikes (too young), NO horns yet, NO fire yet\n` +
      `  - chubby short legs and rounded belly with soft pale cream underside\n` +
      `  - copper-orange scale family (NOT green, NOT teal, NOT a different species — clearly Dini's kin)\n` +
      `  - vulnerable, very young, soft-rounded proportions\n` +
      `  - NOT a miniature adult Dini: this baby has softer features, no developed horns, no back spikes, folded tiny wings, and newborn proportions`,
    anchorPose: {
      id: 'master',
      description:
        `Reference master character sheet — full body, sitting upright at the center of the frame, looking gently toward the viewer, ` +
        `wings folded close, hands/front-paws resting in lap, soft curious expression. ` +
        `This is the canonical baby dragon hatchling from Dini's story — every following pose must look exactly like this same character.`,
    },
    followupPoses: [
      {
        id: '02-wobble',
        description:
          `Same baby dragon as the reference, redrawn standing on wobbly legs for the first time: ` +
          `slightly off-balance, looking up with wide bright eyes, mouth slightly open in curiosity, wings still folded. ` +
          `Keep IDENTICAL: head shape, soft head bumps (still NOT horns), ear-flaps, eye style, wing size, body proportion, color.`,
      },
      {
        id: '03-low-curious',
        description:
          `Same baby dragon as the reference, redrawn sitting low on its belly with front paws forward (a soft crawling-ready pose), ` +
          `looking up curiously toward the viewer with bright wide eyes, head slightly tilted, very young and trusting. ` +
          `Keep IDENTICAL: head shape, soft head bumps, ear-flaps, eye style, wing size, body proportion, color.`,
      },
      {
        id: '04-curled',
        description:
          `Same baby dragon as the reference, redrawn curled up and asleep: body wrapped softly into a small bundle, ` +
          `eyes closed peacefully, head tucked against belly, tail wrapped around itself. ` +
          `Keep IDENTICAL: head shape, the two soft bumps on top, ear-flaps, eye style (closed but same eyelid shape), wing size, body proportion, color.`,
      },
    ],
  },

  dobi: {
    // Priority-numbered output names so alphabetical sort in resolver = our priority
    characterId: 'dobi',
    outputDir: 'public/companions/bear_cub_gahal/style01-sheets',
    masterFile: 'dobi-01-master.png',
    visualLock:
      `Same EXACT Dobi every pose — one consistent character. Match every identity landmark:\n` +
      `  - Small warm-brown bear cub, chubby short body, knee-height to a child\n` +
      `  - honey-dark amber eyes, LARGE and round, with a small white highlight in each eye\n` +
      `  - big soft expressive eyebrows above the eyes\n` +
      `  - short rounded snout, dark wet-looking nose\n` +
      `  - rounded ears on top of the head, same size and position every pose\n` +
      `  - oversized soft paws (front and back), slightly clumsy looking\n` +
      `  - faint warm cream chest glow / lighter chest patch\n` +
      `  - same warm-brown fur tone and shaggy density every pose\n` +
      `  - NOT a polar bear (no white), NOT a panda (no black patches), NOT a brown grizzly (not aggressive), NOT a realistic photo bear\n` +
      `  - childlike rounded proportions, soft and friendly`,
    anchorPose: {
      id: 'master',
      description:
        `Reference master character sheet — full body, sitting upright on hind legs at the center of the frame, ` +
        `front paws resting comfortably in lap, smiling gently toward the viewer, ears perked, eyes warm and friendly. ` +
        `This is the canonical Dobi — every following pose must look exactly like this same cub.`,
    },
    followupPoses: [
      {
        id: '02-three-quarter',
        description:
          `Same Dobi as the reference, redrawn at a three-quarter turn (body angled ~45 degrees from viewer), ` +
          `walking on all fours, one front paw lifted mid-step, head turned slightly toward the viewer with curious expression. ` +
          `Keep IDENTICAL: head shape, ear placement, eyes, eyebrows, snout, chest patch, fur color and density, body proportion.`,
      },
      {
        id: '03-reach',
        description:
          `Same Dobi as the reference, redrawn standing on hind legs reaching upward (as if toward an imagined high object like a berry), ` +
          `front paws stretched up, expression eager and gentle, smile visible. ` +
          `Keep IDENTICAL: head shape, ear placement, eyes, eyebrows, snout, chest patch, fur color and density, body proportion.`,
      },
      {
        id: '04-side',
        description:
          `Same Dobi as the reference, redrawn in a pure side profile, sitting upright watching something off-frame, ` +
          `ears alert, soft attentive gentle expression. ` +
          `Keep IDENTICAL: head shape (from side), ear placement, eye (one visible), eyebrow, snout, chest patch, fur color and density, body proportion. ` +
          `Body must NOT become longer or more lean — keep the chubby childlike proportions from the reference.`,
      },
    ],
  },
};

function parseArgs(): { target: string; dryRun: boolean; confirmed: boolean } {
  const args = process.argv.slice(2);
  const target = args.find((a) => a.startsWith('--target='))?.split('=')[1] ?? '';
  return {
    target,
    dryRun: args.includes('--dry-run'),
    confirmed: args.includes('--confirm'),
  };
}

function buildAnchorPrompt(c: CompanionSpec): string {
  return [
    `Character reference sheet — ${c.anchorPose.description}`,
    ``,
    `CHARACTER IDENTITY (verbatim, must hold for all future poses):`,
    c.visualLock,
    ``,
    STYLE_01_WRAPPER,
  ].join('\n');
}

function buildFollowupPrompt(c: CompanionSpec, p: Pose): string {
  return [
    `Pose change for the SAME character in the attached reference: ${p.description}`,
    ``,
    `IDENTITY LOCK (verbatim with the reference):`,
    c.visualLock,
    ``,
    STYLE_01_WRAPPER,
  ].join('\n');
}

async function main(): Promise<void> {
  const { target, dryRun, confirmed } = parseArgs();

  const c = COMPANIONS[target];
  if (!c) {
    console.error(`Invalid --target=${target}. Valid: ${Object.keys(COMPANIONS).join(', ')}`);
    process.exit(1);
  }

  const quality = (process.env.COMPANION_SHEET_QUALITY?.trim() || 'medium') as 'low' | 'medium' | 'high';
  const model = process.env.STYLE_01_GPT_MODEL?.trim() || 'gpt-image-2';
  const costPerImage = { low: 0.011, medium: 0.042, high: 0.167 }[quality];
  const totalImages = 1 + c.followupPoses.length;
  const estCost = totalImages * costPerImage;

  console.log(`\n=== Auto-anchored sheet generator — ${c.characterId} ===`);
  console.log(`Output:    ${c.outputDir}`);
  console.log(`Model:     ${model}`);
  console.log(`Quality:   ${quality}`);
  console.log(`Images:    ${totalImages} (1 anchor + ${c.followupPoses.length} followups)`);
  console.log(`Est cost:  $${estCost.toFixed(2)}`);
  console.log(``);

  if (dryRun) {
    console.log('--dry-run: printing prompts only, no API calls\n');
    console.log(`\n=== ANCHOR (text-only generate) ===\n`);
    console.log(buildAnchorPrompt(c));
    for (const p of c.followupPoses) {
      console.log(`\n=== FOLLOWUP "${p.id}" (image.edit conditioned on master) ===\n`);
      console.log(buildFollowupPrompt(c, p));
    }
    return;
  }

  if (!confirmed) {
    console.error('Refusing to run without --confirm (paid API calls).');
    process.exit(1);
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.error('OPENAI_API_KEY missing.');
    process.exit(1);
  }

  const client = new OpenAI({ apiKey });
  const outDir = path.join(process.cwd(), c.outputDir);
  await mkdir(outDir, { recursive: true });

  // STEP 1: anchor (text-only generate)
  console.log(`>>> Step 1/2: anchor (text-only generate)`);
  process.stdout.write(`  anchor ... `);

  let masterBytes: Buffer | null = null;
  try {
    const response = await client.images.generate({
      model,
      prompt: buildAnchorPrompt(c),
      size: '1024x1024',
      quality: quality as 'low' | 'medium' | 'high',
      n: 1,
    });
    const item = response.data?.[0];
    if (!item) throw new Error('No image in anchor response');

    if (item.b64_json) {
      masterBytes = Buffer.from(item.b64_json, 'base64');
    } else if (item.url) {
      const res = await fetch(item.url);
      if (!res.ok) throw new Error(`fetch ${item.url} → HTTP ${res.status}`);
      masterBytes = Buffer.from(await res.arrayBuffer());
    }
    if (!masterBytes) throw new Error('No image bytes in anchor response');

    const masterPath = path.join(outDir, c.masterFile);
    await writeFile(masterPath, masterBytes);
    console.log(`OK (${(masterBytes.length / 1024).toFixed(0)} KB) → ${c.masterFile}`);
  } catch (err) {
    console.log('FAIL');
    console.error(`     ${(err as Error).message}`);
    console.error('Cannot proceed to followups without anchor. Exiting.');
    process.exit(1);
  }

  // STEP 2: followups (image.edit conditioned on master)
  console.log(`\n>>> Step 2/2: followups (image.edit conditioned on master)`);
  let calls = 0;
  let errors = 0;

  for (const p of c.followupPoses) {
    calls++;
    const outFile = path.join(outDir, `${c.characterId}-${p.id}-v2.png`);
    process.stdout.write(`  [${calls}/${c.followupPoses.length}] ${p.id} ... `);

    try {
      const imageFile = await toFile(masterBytes, c.masterFile, { type: 'image/png' });
      const response = await client.images.edit({
        model,
        image: imageFile,
        prompt: buildFollowupPrompt(c, p),
        size: '1024x1024',
        quality: quality as 'low' | 'medium' | 'high',
        n: 1,
      });

      const item = response.data?.[0];
      if (!item) throw new Error('No image in followup response');

      let buffer: Buffer | null = null;
      if (item.b64_json) {
        buffer = Buffer.from(item.b64_json, 'base64');
      } else if (item.url) {
        const res = await fetch(item.url);
        if (!res.ok) throw new Error(`fetch ${item.url} → HTTP ${res.status}`);
        buffer = Buffer.from(await res.arrayBuffer());
      }
      if (!buffer) throw new Error('No image bytes in followup response');
      await writeFile(outFile, buffer);
      console.log(`OK (${(buffer.length / 1024).toFixed(0)} KB)`);
    } catch (err) {
      errors++;
      console.log('FAIL');
      console.error(`     ${(err as Error).message}`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Anchor:       OK`);
  console.log(`Followups:    ${calls - errors} / ${calls}`);
  console.log(`Total cost:   ~$${(totalImages * costPerImage).toFixed(2)}`);
  console.log(`\nReview: ${outDir}/${c.masterFile} + ${c.characterId}-*-v2.png`);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
