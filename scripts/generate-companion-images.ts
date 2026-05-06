/**
 * Generate companion character images via Replicate (Flux).
 *
 * Usage:
 *   npx tsx scripts/generate-companion-images.ts
 *
 * Requirements:
 *   - REPLICATE_API_TOKEN in .env
 *   - `replicate` package installed
 *
 * Generates 24 unique companion portraits in STYLE_01 (soft hand-drawn storybook),
 * square 1:1 format, and saves them to public/companions/<CATEGORY>/<id>.jpg
 */

import 'dotenv/config';
import Replicate from 'replicate';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';

// ── Companion definitions (extracted from lib/companions.ts) ──────────────────
// We inline them here to keep the script self-contained and runnable without
// Next.js server-only imports.

interface CompanionEntry {
  id: string;
  name: string;
  category: string;
  imagePath: string; // relative to public/
  visualDescription: string;
}

const COMPANIONS: CompanionEntry[] = [
  // NOISE_FEAR
  {
    id: 'footstep_giant',
    name: 'הענק תום',
    category: 'NOISE_FEAR',
    imagePath: 'companions/NOISE_FEAR/footstep_giant.jpg',
    visualDescription:
      'A gentle giant in soft earth-toned clothes with calm, kind eyes; his enormous footsteps make the ground tremble but his presence feels safe and warm.',
  },
  {
    id: 'song_whale',
    name: 'הלוויתן ים',
    category: 'NOISE_FEAR',
    imagePath: 'companions/NOISE_FEAR/song_whale.jpg',
    visualDescription:
      'A friendly deep-blue cartoon whale with smooth skin and a gentle smile; a soft bioluminescent hum glows around him as if his song is visible light in calm water.',
  },
  {
    id: 'drum_shelly',
    name: 'התוף שלי',
    category: 'NOISE_FEAR',
    imagePath: 'companions/NOISE_FEAR/drum_shelly.jpg',
    visualDescription:
      'A small round magical drum on tiny legs with a snare surface that glows softly; a cozy ribbon tied like a belt; looks like a sentient instrument sidekick with dot eyes.',
  },
  // NIGHT_FEAR
  {
    id: 'bat_lily',
    name: 'העטלף לילי',
    category: 'NIGHT_FEAR',
    imagePath: 'companions/NIGHT_FEAR/bat_lily.jpg',
    visualDescription:
      'A soft-furred night bat with large gentle eyes, tiny fangs, and a friendly face; a small warm lantern pendant around the neck; wings look velvety, not scary.',
  },
  {
    id: 'fox_uri',
    name: 'השועל אוּרי',
    category: 'NIGHT_FEAR',
    imagePath: 'companions/NIGHT_FEAR/fox_uri.jpg',
    visualDescription:
      'A small copper-tinged fox with warm lantern-like eyes and a fluffy tail; wears a light scarf; always looks clever, alert, and kind, never predatory.',
  },
  {
    id: 'owl_chacham',
    name: 'הינשוף חכם',
    category: 'NIGHT_FEAR',
    imagePath: 'companions/NIGHT_FEAR/owl_chacham.jpg',
    visualDescription:
      'A stout wise owl with soft feathers, small spectacles, and sleepy friendly eyes; carries a dim starlight glow on its wings; very calm and grandfatherly in posture.',
  },
  // TRANSITION
  {
    id: 'chameleon_koko',
    name: 'הקמליון קוקו',
    category: 'TRANSITION',
    imagePath: 'companions/TRANSITION/chameleon_koko.jpg',
    visualDescription:
      'A small playful chameleon with patchwork pastel patches that change gently; a striped scarf; big sweet eyes; looks mischievous and adventurous.',
  },
  {
    id: 'squirrel_navad',
    name: 'הסנאי נוָּד',
    category: 'TRANSITION',
    imagePath: 'companions/TRANSITION/squirrel_navad.jpg',
    visualDescription:
      'A quick nimble squirrel with a tiny knapsack and acorn badges; big ears; a confident stance; always looks ready to hide a "treasure" in a new tree hollow.',
  },
  {
    id: 'turtle_beiti',
    name: 'הצב בֵּיתִי',
    category: 'TRANSITION',
    imagePath: 'companions/TRANSITION/turtle_beiti.jpg',
    visualDescription:
      'A friendly tortoise with a warm pastel shell patterned like a tiny house roof; soft smile; a small potted plant strapped to the shell for a cozy "home on the back" look.',
  },
  // NEW_SIBLING
  {
    id: 'twin_stars',
    name: 'הכוכב התאום',
    category: 'NEW_SIBLING',
    imagePath: 'companions/NEW_SIBLING/twin_stars.jpg',
    visualDescription:
      'A tiny humanoid made of two linked golden stars for eyes and head; soft trailing light like a comet; warm glow; feels like love multiplying instead of splitting.',
  },
  {
    id: 'dragon_dini',
    name: 'הדרקון דיני',
    category: 'NEW_SIBLING',
    imagePath: 'companions/NEW_SIBLING/dragon_dini.jpg',
    visualDescription:
      'A small chubby dragon with rounded snout, pastel scales, and tiny wing nubs; carries a "guardian\'s sash"; friendly eyes; looks protective, not dangerous.',
  },
  {
    id: 'bee_ima',
    name: 'הדבורה אִמָּא',
    category: 'NEW_SIBLING',
    imagePath: 'companions/NEW_SIBLING/bee_ima.jpg',
    visualDescription:
      'A proud bee queen in soft cartoon style, golden and black stripes, small crown, gentle smile; a tiny honeycomb brooch; wings shimmer like warm kitchen light.',
  },
  // SELF_CONFIDENCE
  {
    id: 'lion_shaket',
    name: 'האריה שֶׁקֶט',
    category: 'SELF_CONFIDENCE',
    imagePath: 'companions/SELF_CONFIDENCE/lion_shaket.jpg',
    visualDescription:
      'A small shy lion cub with a fluffy mane starting to grow, big hesitant eyes, soft round ears; a tiny cape-like scarf; always looks on the edge of a brave roar.',
  },
  {
    id: 'fairy_zohara',
    name: 'הפיה זוהרה',
    category: 'SELF_CONFIDENCE',
    imagePath: 'companions/SELF_CONFIDENCE/fairy_zohara.jpg',
    visualDescription:
      'A minuscule fairy with translucent wings, warm amber glow, short curly hair, and a simple leaf dress; light trails from her like dust sparkles, friendly face.',
  },
  {
    id: 'robot_robi',
    name: 'הרובוט רובי',
    category: 'SELF_CONFIDENCE',
    imagePath: 'companions/SELF_CONFIDENCE/robot_robi.jpg',
    visualDescription:
      'A small round friendly robot with soft rounded metal panels, LED eyes, and a notepad on its chest; looks curious and non-threatening; has little expressive antenna.',
  },
  // SOCIAL
  {
    id: 'panda_anat',
    name: 'הפנדה ענת',
    category: 'SOCIAL',
    imagePath: 'companions/SOCIAL/panda_anat.jpg',
    visualDescription:
      'A soft panda in muted colors, gentle eyes, a small music-note patch on a sweater; posture is quiet and open; very huggable, calm presence.',
  },
  {
    id: 'bear_mati',
    name: 'המַנְצֵחַ מתי',
    category: 'SOCIAL',
    imagePath: 'companions/SOCIAL/bear_mati.jpg',
    visualDescription:
      'A friendly conductor bear in a small tailcoat, holding a light baton; expressive eyebrows; warm smile; not intimidating; slightly theatrical but kind.',
  },
  {
    id: 'hedgehog_rachi',
    name: 'הקיפוד רַכִּי',
    category: 'SOCIAL',
    imagePath: 'companions/SOCIAL/hedgehog_rachi.jpg',
    visualDescription:
      'A small hedgehog with soft pastel quills, round eyes, a gentle blush; a tiny heart-shaped patch; quills can look slightly softened on purpose for hugs.',
  },
  // FOCUS_LEARNING
  {
    id: 'hunter_parparon',
    name: 'צייד פרפרון',
    category: 'FOCUS_LEARNING',
    imagePath: 'companions/FOCUS_LEARNING/hunter_parparon.jpg',
    visualDescription:
      'A lanky young rider with a soft butterfly-net staff and airy cloak; small playful butterflies orbit them; light, whimsical; looks focused but not aggressive.',
  },
  {
    id: 'wizard_abab',
    name: 'הקוסם אָבָב',
    category: 'FOCUS_LEARNING',
    imagePath: 'companions/FOCUS_LEARNING/wizard_abab.jpg',
    visualDescription:
      'A friendly cartoon wizard with a pointed hat covered in letter patches, a swirling wand, bright eyes, soft beard; looks playful and bookish, not stern.',
  },
  {
    id: 'captain_navat',
    name: 'הקפטן נַוָּט',
    category: 'FOCUS_LEARNING',
    imagePath: 'companions/FOCUS_LEARNING/captain_navat.jpg',
    visualDescription:
      'An otter wearing a small captain\'s hat and scarf, holding a ship wheel prop; a tiny "thought-bubble ship" made of soft clouds; cheerful and alert.',
  },
  // OTHER (shared by GENERAL_FEARS, ANGER_FRUSTRATION, SENSITIVITY_OVERWHELM)
  {
    id: 'magic_map',
    name: 'המפה הקסומה',
    category: 'OTHER',
    imagePath: 'companions/OTHER/magic_map.jpg',
    visualDescription:
      'A living paper map with a friendly little paper face, ink lines that wiggle, corners that curl like feet; looks animated and kind, not torn or messy.',
  },
  {
    id: 'seer_mirror',
    name: 'המראָה שָׁמַיִּית',
    category: 'OTHER',
    imagePath: 'companions/OTHER/seer_mirror.jpg',
    visualDescription:
      'A warm hand-held mirror with a sun motif frame; soft gold glow; a gentle face reflected as a kind silhouette, not a horror mirror; very comforting.',
  },
  {
    id: 'golden_key',
    name: 'המפתח הזהב',
    category: 'OTHER',
    imagePath: 'companions/OTHER/golden_key.jpg',
    visualDescription:
      'A small floating golden key with tiny wings, a friendly "eye" in the handle, a soft halo; not sharp; looks like a helpful object-character.',
  },
];

// ── Style prefix (STYLE_01 = soft hand-drawn storybook) ──────────────────────
const STYLE_PREFIX = [
  'Soft hand-drawn children\'s book character portrait.',
  'Visible pencil linework with slight wobble and natural imperfection.',
  'Muted warm watercolor palette on textured paper.',
  'Gentle diffused lighting, no harsh shadows.',
  'Centered character on a simple soft warm background.',
  'No text, no letters, no UI elements.',
  'Square composition, character fills most of the frame.',
  'Friendly, approachable, emotionally warm.',
].join(' ');

const NEGATIVE = [
  'No text', 'no letters', 'no numbers', 'no speech bubbles',
  'no 3D render', 'no CGI', 'no Pixar', 'no anime', 'no manga',
  'no photorealism', 'no vector art', 'no neon', 'no glow effects',
  'no dark background', 'no scary elements', 'no sharp edges',
  'no digital polish', 'no glossy rendering',
].join(', ');

// ── Replicate client ─────────────────────────────────────────────────────────
const token = process.env.REPLICATE_API_TOKEN;
if (!token) {
  console.error('Missing REPLICATE_API_TOKEN in .env');
  process.exit(1);
}

const replicate = new Replicate({ auth: token });
const MODEL = 'black-forest-labs/flux-dev' as const;

// ── Helpers ──────────────────────────────────────────────────────────────────
async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function buildPrompt(companion: CompanionEntry): string {
  return `${STYLE_PREFIX}\n\n${companion.visualDescription}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MAX_RETRIES = 3;
const RATE_LIMIT_WAIT_MS = 12_000; // 12s between requests (rate limit: 6/min burst 1)

async function generateOneWithRetry(companion: CompanionEntry): Promise<string> {
  const prompt = buildPrompt(companion);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[gen] ${companion.id} (${companion.name})${attempt > 1 ? ` [retry ${attempt}]` : ''}`);

      const output = await replicate.run(MODEL, {
        input: {
          prompt,
          aspect_ratio: '1:1',
          output_format: 'jpg',
          num_outputs: 1,
          num_images: 1,
        },
      });

      // Extract URL from output (can be string, URL, or array)
      let imageUrl: string;
      if (typeof output === 'string') {
        imageUrl = output;
      } else if (Array.isArray(output) && output.length > 0) {
        const first = output[0];
        imageUrl = typeof first === 'string' ? first : String(first);
      } else if (output instanceof URL) {
        imageUrl = output.toString();
      } else {
        throw new Error(`Unexpected output shape: ${JSON.stringify(output).slice(0, 200)}`);
      }

      console.log(`[url] ${imageUrl.slice(0, 80)}...`);
      return imageUrl;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const is429 = msg.includes('429');
      if (is429 && attempt < MAX_RETRIES) {
        // Extract retry_after from error message if available
        const retryMatch = msg.match(/retry_after[":]+\s*(\d+)/i);
        const waitSec = retryMatch ? parseInt(retryMatch[1], 10) + 2 : 15;
        console.log(`[429] ${companion.id} — waiting ${waitSec}s before retry...`);
        await sleep(waitSec * 1000);
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const publicDir = join(process.cwd(), 'public');
  const { existsSync, statSync } = await import('fs');
  const results: { id: string; name: string; status: string; path?: string }[] = [];

  // Filter out already-generated companions (file > 100 bytes = real image)
  const pending = COMPANIONS.filter((c) => {
    const fullPath = join(publicDir, c.imagePath);
    try {
      if (existsSync(fullPath) && statSync(fullPath).size > 100) {
        console.log(`[skip] ${c.id} — already exists (${Math.round(statSync(fullPath).size / 1024)} KB)`);
        results.push({ id: c.id, name: c.name, status: 'ok (cached)', path: c.imagePath });
        return false;
      }
    } catch {}
    return true;
  });

  console.log(`\n=== Generating ${pending.length} companion images (${COMPANIONS.length - pending.length} cached) ===`);
  console.log(`Model: ${MODEL}`);
  console.log(`Style: STYLE_01 (soft hand-drawn storybook)`);
  console.log(`Format: 1:1 square, JPG`);
  console.log(`Rate limit mode: sequential, ${RATE_LIMIT_WAIT_MS / 1000}s between requests\n`);

  // Process ONE AT A TIME to respect rate limit
  for (let i = 0; i < pending.length; i++) {
    const comp = pending[i];
    const progress = `[${i + 1}/${pending.length}]`;

    try {
      console.log(`\n${progress} ──────────────────────────────`);
      const imageUrl = await generateOneWithRetry(comp);
      const imageBuffer = await downloadImage(imageUrl);

      const outPath = join(publicDir, comp.imagePath);
      await mkdir(dirname(outPath), { recursive: true });
      await writeFile(outPath, imageBuffer);

      const sizeKB = Math.round(imageBuffer.length / 1024);
      console.log(`[saved] ${comp.imagePath} (${sizeKB} KB)`);
      results.push({ id: comp.id, name: comp.name, status: 'ok', path: comp.imagePath });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[FAIL] ${comp.id}: ${msg}`);
      results.push({ id: comp.id, name: comp.name, status: `FAIL: ${msg}` });
    }

    // Wait between requests to avoid rate limit
    if (i < pending.length - 1) {
      console.log(`[wait] ${RATE_LIMIT_WAIT_MS / 1000}s cooldown...`);
      await sleep(RATE_LIMIT_WAIT_MS);
    }
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  const ok = results.filter((r) => r.status.startsWith('ok'));
  const failed = results.filter((r) => !r.status.startsWith('ok'));
  console.log(`Success: ${ok.length}/${COMPANIONS.length}`);
  if (failed.length > 0) {
    console.log('Failed:');
    failed.forEach((f) => console.log(`  - ${f.id} (${f.name}): ${f.status}`));
    console.log(`\nRe-run the script to retry failed ones (cached images are skipped).`);
  }
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
