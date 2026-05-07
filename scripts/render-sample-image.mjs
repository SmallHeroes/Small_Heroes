#!/usr/bin/env node
/**
 * Render landing page sample images — Yuval at kindergarten
 * Usage: node scripts/render-sample-image.mjs
 *
 * Requires: OPENAI_API_KEY in .env
 */
import 'dotenv/config';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const STYLE_01_PROMPT = `A warm, emotionally rich children's book illustration in soft watercolor style with crisp focal details. Portrait format, 3:4 aspect ratio.

Scene: Yuval, a 4-year-old Israeli boy with short dark curly hair, light olive skin, and big brown eyes, stands at the open entrance gate of a new kindergarten. He holds one backpack strap with his right hand. His expression is quietly hesitant but hopeful — not scared, not crying, just a small boy facing something new.

He wears a simple light blue t-shirt, comfortable beige shorts, and small white sneakers. A soft blue backpack on his back.

Behind the gate, the kindergarten yard opens up warmly: soft morning sunlight streams in, illuminating colorful cubbies, small wooden chairs, scattered toys, children's drawings on the walls, and two or three children playing gently in the mid-ground. One kind female teacher stands in the background, smiling softly toward Yuval without dominating the frame.

Composition: slightly low angle at child eye-level. Yuval is in the lower-center foreground, large in frame. The kindergarten entrance frames him like a doorway into a new world — the space behind him is calm and muted, the space ahead is warm, colorful, and full of life. Strong depth separation between foreground boy and background activity.

A few tiny golden dust motes and one or two soft floating leaves drift near the doorway, suggesting magic and courage — subtle, not fantasy.

Color palette: warm golden morning tones dominating, mixed with gentle sky blues, soft greens, and touches of orange. Soft diffused light from behind creating a gentle backlit glow around Yuval's hair.

Style: premium illustrated children's book art, soft watercolor texture with painterly edges, crisp details on face and hands. Emotional, tender, cinematic. Not cartoonish, not flat, not anime.

No text, no letters, no words, no signs, no readable writing anywhere in the image.`;

const STYLE_02_PROMPT = `A tender, cinematic photograph-style children's book illustration with realistic artistic rendering. Portrait format, 3:4 aspect ratio.

Scene: Yuval, a 4-year-old Israeli boy with short dark curly hair, light olive skin, and large expressive brown eyes, stands just inside the open entrance gate of a new kindergarten on his first day. He grips one strap of his small blue backpack with his right hand. His face shows quiet hesitation mixed with curiosity — lips slightly pressed together, eyes wide and taking everything in. A brave, vulnerable moment.

He wears a simple light blue cotton t-shirt, comfortable beige shorts, and small white sneakers — normal everyday clothes for a 4-year-old.

The kindergarten yard stretches behind the gate: warm morning sunlight spills across colorful cubbies along the wall, small wooden chairs around a low table, soft toys on shelves, and children's artwork pinned to a notice board. Two or three children play gently in the mid-ground, slightly out of focus. One female teacher in a casual dress stands further back, her face turned toward Yuval with a gentle, welcoming smile.

Composition: shot at child eye-level with a slightly low angle, giving Yuval presence and importance in the frame. He occupies the lower-center foreground. The gate frame creates natural vignetting around him. Strong depth of field: Yuval sharp, background softly blurred. The world behind him (outside) is simple and still; the world ahead is warm and alive.

Lighting: golden hour morning light from the east, entering through the gate. Soft rim light on Yuval's hair and shoulders. Warm color temperature inside the kindergarten contrasting with cooler, simpler tones outside.

Style: realistic artistic rendering with photographic depth of field, natural skin texture, fabric wrinkles on clothes, real material surfaces. Premium children's book quality — emotional, intimate, cinematic. Like a beautifully lit still from a live-action children's film. Not illustrated, not painted, not cartoonish.

No text, no letters, no words, no signs, no readable writing anywhere in the image.`;

async function generate(prompt, filename) {
  const outPath = path.join(ROOT, filename);
  console.log(`\n🎨 Generating ${filename}...`);
  const start = Date.now();
  try {
    const res = await openai.images.generate({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1024x1536',
      quality: 'high',
    });
    const b64 = res.data[0].b64_json;
    if (!b64) throw new Error('No b64_json in response');
    fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
    const sec = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`✅ ${filename} — saved (${sec}s)`);
    return outPath;
  } catch (err) {
    const sec = ((Date.now() - start) / 1000).toFixed(1);
    console.error(`❌ ${filename} — failed (${sec}s): ${err.message || err}`);
    return null;
  }
}

async function main() {
  console.log('=== Rendering landing page sample: Yuval at kindergarten ===\n');
  console.log('Running both styles in parallel...');

  const [p1, p2] = await Promise.all([
    generate(STYLE_01_PROMPT, 'sample-yuval-style01-illustrated.png'),
    generate(STYLE_02_PROMPT, 'sample-yuval-style02-realistic.png'),
  ]);

  console.log('\n=== Done ===');
  if (p1) console.log(`  Style 01 (illustrated): ${p1}`);
  if (p2) console.log(`  Style 02 (realistic):   ${p2}`);
  if (!p1 && !p2) console.log('  Both failed. Check OPENAI_API_KEY.');
}

main().catch(console.error);
