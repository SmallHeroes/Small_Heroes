/**
 * generate-companions.mjs
 *
 * Generates companion card images using GPT Image (gpt-image-1).
 * Style 01: cute illustrated cartoon storybook style.
 *
 * Usage:
 *   node scripts/generate-companions.mjs                    # all companions
 *   node scripts/generate-companions.mjs --test 3           # first 3 only
 *   node scripts/generate-companions.mjs --ids octopus_seara,fawn_tzvi,starfish_kokhavi
 */

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Load env
dotenv.config({ path: join(ROOT, '.env') });
dotenv.config({ path: join(ROOT, '.env.local') });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY in .env or .env.local');
  process.exit(1);
}

// ── All companions (from companions.ts, flattened) ──────────────────
const ALL_COMPANIONS = [
  // NOISE_FEAR
  { id: 'footstep_giant', category: 'NOISE_FEAR', visualDescription: 'A gentle giant in soft earth-toned clothes with calm, kind eyes; his enormous footsteps make the ground tremble but his presence feels safe and warm.' },
  { id: 'song_whale', category: 'NOISE_FEAR', visualDescription: 'A friendly deep-blue cartoon whale with smooth skin and a gentle smile; a soft bioluminescent hum glows around him as if his song is visible light in calm water.' },
  { id: 'mole_sheket', category: 'NOISE_FEAR', visualDescription: 'A small velvety mole with tiny round ears, closed calm eyes, and soft brown fur; wears a cozy knitted scarf; paws hold a little glowing crystal; radiates underground peace and quiet safety.' },
  // NIGHT_FEAR
  { id: 'bat_lily', category: 'NIGHT_FEAR', visualDescription: 'A soft-furred night bat with large gentle eyes, tiny fangs, and a friendly face; a small warm lantern pendant around the neck; wings look velvety, not scary.' },
  { id: 'fox_uri', category: 'NIGHT_FEAR', visualDescription: 'A small copper-tinged fox with warm lantern-like eyes and a fluffy tail; wears a light scarf; always looks clever, alert, and kind, never predatory.' },
  { id: 'owl_chacham', category: 'NIGHT_FEAR', visualDescription: 'A stout wise owl with soft feathers, small spectacles, and sleepy friendly eyes; carries a dim starlight glow on its wings; very calm and grandfatherly in posture.' },
  // TRANSITION
  { id: 'chameleon_koko', category: 'TRANSITION', visualDescription: 'A small playful chameleon with patchwork pastel patches that change gently; a striped scarf; big sweet eyes; looks mischievous and adventurous.' },
  { id: 'squirrel_navad', category: 'TRANSITION', visualDescription: 'A quick nimble squirrel with a tiny knapsack and acorn badges; big ears; a confident stance; always looks ready to hide a "treasure" in a new tree hollow.' },
  { id: 'turtle_beiti', category: 'TRANSITION', visualDescription: 'A friendly tortoise with a warm pastel shell patterned like a tiny house roof; soft smile; a small potted plant strapped to the shell for a cozy "home on the back" look.' },
  // NEW_SIBLING
  { id: 'pelican_kis', category: 'NEW_SIBLING', visualDescription: 'A warm friendly pelican with a large soft pouch, gentle eyes, and fluffy white-cream feathers; the pouch glows softly from within as if full of warmth; wears a tiny bow tie; looks nurturing and proud.' },
  { id: 'dragon_dini', category: 'NEW_SIBLING', visualDescription: 'A small chubby dragon with rounded snout, pastel scales, and tiny wing nubs; carries a "guardian\'s sash"; friendly eyes; looks protective, not dangerous.' },
  { id: 'bee_ima', category: 'NEW_SIBLING', visualDescription: 'A proud bee queen in soft cartoon style, golden and black stripes, small crown, gentle smile; a tiny honeycomb brooch; wings shimmer like warm kitchen light.' },
  // SELF_CONFIDENCE
  { id: 'lion_shaket', category: 'SELF_CONFIDENCE', visualDescription: 'A small shy lion cub with a fluffy mane starting to grow, big hesitant eyes, soft round ears; a tiny cape-like scarf; always looks on the edge of a brave roar.' },
  { id: 'butterfly_zohar', category: 'SELF_CONFIDENCE', visualDescription: 'A beautiful butterfly with iridescent pastel wings that shimmer between purple and gold; a small friendly face with big warm eyes; a faint cocoon charm around the neck; wings spread wide with confidence.' },
  { id: 'ant_harutza', category: 'SELF_CONFIDENCE', visualDescription: 'A tiny determined ant with a shiny dark-red carapace, bright expressive eyes, and strong little legs; carries a leaf flag on her back like a cape; stands tall despite being small; looks brave and industrious.' },
  // SOCIAL
  { id: 'panda_anat', category: 'SOCIAL', visualDescription: 'A soft panda in muted colors, gentle eyes, a small music-note patch on a sweater; posture is quiet and open; very huggable, calm presence.' },
  { id: 'bear_mati', category: 'SOCIAL', visualDescription: 'A friendly conductor bear in a small tailcoat, holding a light baton; expressive eyebrows; warm smile; not intimidating; slightly theatrical but kind.' },
  { id: 'hedgehog_rachi', category: 'SOCIAL', visualDescription: 'A small hedgehog with soft pastel quills, round eyes, a gentle blush; a tiny heart-shaped patch; quills can look slightly softened on purpose for hugs.' },
  // FOCUS_LEARNING
  { id: 'hawk_had', category: 'FOCUS_LEARNING', visualDescription: 'A sleek young hawk with sharp golden eyes, warm brown-cream feathers, and a focused gaze; wears a tiny aviator scarf; wings slightly folded back ready to dive; looks alert, precise, and friendly.' },
  { id: 'dolphin_shahkan', category: 'FOCUS_LEARNING', visualDescription: 'A playful grey-blue dolphin with a wide smile, bright curious eyes, and a small splash crown on its head; carries a tiny book in one flipper; looks joyful and intelligent.' },
  { id: 'captain_navat', category: 'FOCUS_LEARNING', visualDescription: 'An otter wearing a small captain\'s hat and scarf, holding a ship wheel prop; a tiny "thought-bubble ship" made of soft clouds; cheerful and alert.' },
  // GENERAL_FEARS
  { id: 'firefly_namit', category: 'GENERAL_FEARS', visualDescription: 'A tiny cute firefly with a warm yellow-green glowing abdomen, big round friendly eyes, delicate translucent wings, and small antennae; carries a miniature lantern; radiates gentle warmth in darkness.' },
  { id: 'bunny_ometz', category: 'GENERAL_FEARS', visualDescription: 'A small soft bunny with long floppy ears, wide uncertain eyes that are also brave, and a tiny heart-shaped badge pinned to the chest; fur is cream-white with a blush on the cheeks; looks vulnerable but standing tall.' },
  { id: 'mongoose_zariz', category: 'GENERAL_FEARS', visualDescription: 'A sleek agile mongoose with warm brown fur, alert bright eyes, a bushy tail, and a confident stance; wears a tiny explorer vest; looks quick, fearless, and ready for anything.' },
  // ANGER_FRUSTRATION
  { id: 'octopus_seara', category: 'ANGER_FRUSTRATION', visualDescription: 'A small cartoon octopus with expressive eyes, eight curly tentacles in warm orange-red tones; when calm the tentacles are neatly curled, when upset they flail wildly; wears a tiny sailor hat; looks emotional but lovable.' },
  { id: 'bear_cub_gahal', category: 'ANGER_FRUSTRATION', visualDescription: 'A chubby brown bear cub with big expressive eyebrows, warm amber eyes, and large soft paws; a faint warm glow around the chest like inner fire; looks strong but gentle; wears a small woven bracelet.' },
  { id: 'salamander_lahav', category: 'ANGER_FRUSTRATION', visualDescription: 'A small fire salamander with glossy black skin and bright orange-yellow flame patterns; calm wise eyes; a soft warm glow emanates from the body; looks ancient and peaceful despite living in fire; small and cute.' },
  // SENSITIVITY_OVERWHELM
  { id: 'fawn_tzvi', category: 'SENSITIVITY_OVERWHELM', visualDescription: 'A young deer fawn with large sensitive ears, big soft brown eyes with long lashes, light spotted coat, and slender legs; looks alert but gentle; a small flower tucked behind one ear; graceful and delicate.' },
  { id: 'snail_sheli', category: 'SENSITIVITY_OVERWHELM', visualDescription: 'A friendly snail with a warm spiral shell painted in soft pastel swirls, two cute eye-stalks with gentle expression, and a small cozy blanket draped over the shell opening; looks safe and peaceful.' },
  { id: 'kitten_mishi', category: 'SENSITIVITY_OVERWHELM', visualDescription: 'A small fluffy kitten with long sensitive whiskers, soft grey-lavender fur, half-closed peaceful eyes, and a gentle purring posture; curled up slightly; a tiny bell collar; radiates calm and softness.' },
  // MEDICAL_PROCEDURE
  { id: 'starfish_kokhavi', category: 'MEDICAL_PROCEDURE', visualDescription: 'A cheerful five-pointed starfish in warm coral-pink color with a friendly face, tiny dot eyes, and a gentle smile; one arm has a small bandage as a badge of healing; soft pastel glow around the body; looks resilient and warm.' },
  { id: 'seahorse_yam', category: 'MEDICAL_PROCEDURE', visualDescription: 'A small graceful seahorse with iridescent scales in soft turquoise and gold, a curled tail, a proud upright posture, and calm kind eyes; the bony armor plates look like decorative jewelry rather than protection; gentle and elegant.' },
  { id: 'gecko_rifa', category: 'MEDICAL_PROCEDURE', visualDescription: 'A cute small gecko with bright green skin, large friendly eyes with vertical pupils, sticky toe pads, and a regrowing tail tip that glows faintly; wears a tiny leaf cape; looks curious, adaptable, and full of life.' },
  // OTHER
  { id: 'puppy_neeman', category: 'OTHER', visualDescription: 'A small golden-brown puppy with floppy ears, big warm brown eyes, a wagging tail, and a loyal expression; wears a tiny red bandana; looks eager, devoted, and always ready to follow you anywhere.' },
  { id: 'parrot_tzivon', category: 'OTHER', visualDescription: 'A colorful cartoon parrot with bright green, yellow, and red feathers, a curved beak in a permanent grin, bright playful eyes, and ruffled head feathers; perches on a small branch; looks chatty and cheerful.' },
  { id: 'wolf_pup_siyar', category: 'OTHER', visualDescription: 'A young wolf pup with soft grey-silver fur, bright blue-grey eyes, pointed ears, and a bushy tail; looks brave but still puppy-cute; wears a small woven friendship bracelet around one paw; pack instinct in every glance.' },
];

// ── Style 01 prompt wrapper ─────────────────────────────────────────
const STYLE_PREFIX = `Premium children's book illustration style: adorable round character with large sparkling eyes, rosy cheeks, button nose. Rich detailed watercolor on cream paper with warm soft tones.`;

function buildPrompt(visualDescription) {
  return `${STYLE_PREFIX}

CHARACTER: ${visualDescription}

COMPOSITION RULES:
- Single character portrait, centered in frame
- The ENTIRE character body must be fully visible — no cropping of limbs, feet, tails, or any body part
- Character fills about 50-60% of the image area, with clear padding on all sides
- Leave generous margin at bottom so legs/feet are never clipped
- Pure white background (#FFFFFF) — NO environment, NO ground, NO shadows, NO decorative elements
- The character should appear to float on white, like a sticker or card illustration
- Clean edges, no vignette, no gradient background
- Square composition (1:1)

STYLE: Cute cartoon storybook illustration. Warm cream palette, soft watercolor texture, hand-drawn feel. The character should look like it belongs in a premium children's picture book.`;
}

// ── GPT Image API call ──────────────────────────────────────────────
async function generateImage(prompt) {
  const resp = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'medium',
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`GPT Image API error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  // gpt-image-1 returns b64_json by default
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) {
    // Try URL fallback
    const url = data.data?.[0]?.url;
    if (url) {
      const imgResp = await fetch(url);
      return Buffer.from(await imgResp.arrayBuffer());
    }
    throw new Error('No image data in response');
  }
  return Buffer.from(b64, 'base64');
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  let companions = ALL_COMPANIONS;

  // --test N: only first N
  const testIdx = args.indexOf('--test');
  if (testIdx !== -1) {
    const n = parseInt(args[testIdx + 1]) || 3;
    companions = ALL_COMPANIONS.slice(0, n);
  }

  // --ids id1,id2,id3
  const idsIdx = args.indexOf('--ids');
  if (idsIdx !== -1) {
    const ids = args[idsIdx + 1].split(',');
    companions = ALL_COMPANIONS.filter(c => ids.includes(c.id));
  }

  console.log(`\nGenerating ${companions.length} companion images...\n`);

  for (const comp of companions) {
    const outDir = join(ROOT, 'public', 'companions', comp.category);
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, `${comp.id}.jpg`);

    if (existsSync(outPath) && !args.includes('--force')) {
      console.log(`  SKIP ${comp.category}/${comp.id} (exists, use --force to regenerate)`);
      continue;
    }

    console.log(`  GEN  ${comp.category}/${comp.id}...`);
    try {
      const prompt = buildPrompt(comp.visualDescription);
      const imgBuffer = await generateImage(prompt);

      // Resize 1024→512 and convert to real JPEG (smaller file, faster load)
      const resized = await sharp(imgBuffer)
        .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .jpeg({ quality: 90 })
        .toBuffer();
      writeFileSync(outPath, resized);
      console.log(`  OK   ${comp.category}/${comp.id} → ${outPath} (${(resized.length / 1024).toFixed(0)}KB)`);
    } catch (err) {
      console.error(`  FAIL ${comp.category}/${comp.id}: ${err.message}`);
    }

    // Rate limit: slight pause between calls
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('\nDone!');
}

main().catch(console.error);
