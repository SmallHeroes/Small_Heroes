/**
 * Style comparison test — same scene, both styles via GPT Image.
 * Generates 2 images using the EXACT same prompt structure as buildGPTImagePrompt.
 */
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SCENE = `A 5-year-old girl with curly brown hair and big hazel eyes sits on a cozy window seat in her bedroom. She is hugging a small stuffed bunny tightly against her chest. Warm golden afternoon light streams through the window, casting soft shadows. Her expression is gentle and thoughtful, with a slight smile forming. She wears a light purple dress with small white flowers. The room has soft cream-colored walls with a bookshelf partially visible behind her.`;

const CHARACTER_DNA = `PROTAGONIST IDENTITY LOCK:
- Face: round face, big hazel eyes, small nose, rosy cheeks
- Hair: curly brown hair, shoulder-length, slightly messy
- Skin: light olive skin tone
- Build: small, age-appropriate proportions for 5-year-old
- Clothing: light purple dress with small white flower pattern
- Signature: always holding a small cream-colored stuffed bunny`;

const COMPOSITION = `Camera: medium-close portrait, character fills 60-70% of frame.
Text zone: top 20-25% of image must be open lighter area that fades smoothly — NO hard line or box. Background naturally dissolves upward into warm light wash.`;

// Style 01 — using ACTUAL renderingDescription + imageNudge from styles.ts
const STYLE_01_BLOCK = `Soft Pixar-watercolor children's book illustration — cute expressive characters with rounded features, light cream watercolor background, gentle warm lighting, cheerful and inviting. Modern illustrated storybook style. Soft Pixar-watercolor style: cute expressive characters with rounded features, light cream watercolor background. Gentle warm lighting, cheerful and inviting. Top 20-30% open light space for text. No hard edges or picture frame borders. No text, no letters, no UI.`;

// Style 02 — using ACTUAL renderingDescription + imageNudge from styles.ts
const STYLE_02_BLOCK = `Warm realistic watercolor painting of a real child — NOT a cartoon, NOT an illustration, NOT dark or moody. This MUST look like a photograph turned into a delicate watercolor painting: real child proportions, real facial features, natural skin texture. Warm bright lighting, light cream/beige paper background. Airy, pleasant, emotionally warm atmosphere. Think: professional children's portrait photographer + watercolor artist. This MUST look like a warm realistic watercolor — NOT a cartoon, NOT dark oil painting. Real child proportions, real facial features, natural skin texture. Warm bright lighting, cream paper feel. Top 20-30% open warm area for text. No dark atmosphere. No text, no letters, no UI.`;

async function generateImage(prompt, label) {
  console.log(`\n--- Generating ${label} ---`);
  console.log(`Prompt length: ${prompt.length} chars`);
  
  const response = await openai.images.generate({
    model: 'gpt-image-1',
    prompt,
    n: 1,
    size: '1024x1024',
    quality: 'high',
  });

  const imageData = response.data[0];
  if (!imageData?.b64_json) {
    console.error(`No image data for ${label}`);
    return null;
  }

  const outDir = path.join(process.cwd(), 'test-output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  
  const filename = `style-compare-${label.toLowerCase().replace(/\s+/g, '-')}.png`;
  const filepath = path.join(outDir, filename);
  fs.writeFileSync(filepath, Buffer.from(imageData.b64_json, 'base64'));
  console.log(`Saved: ${filepath}`);
  return filepath;
}

async function main() {
  const basePrompt = [SCENE, '', CHARACTER_DNA, '', COMPOSITION].join('\n');
  
  const prompt01 = `${basePrompt}\n\nSTYLE:\n${STYLE_01_BLOCK}`;
  const prompt02 = `${basePrompt}\n\nSTYLE:\n${STYLE_02_BLOCK}`;
  
  console.log('=== STYLE COMPARISON TEST ===');
  console.log('Scene: Girl with bunny on window seat');
  console.log('');
  
  const [img1, img2] = await Promise.all([
    generateImage(prompt01, 'Style-01-Illustrated'),
    generateImage(prompt02, 'Style-02-Realistic'),
  ]);
  
  console.log('\n=== DONE ===');
  if (img1) console.log(`Style 01: ${img1}`);
  if (img2) console.log(`Style 02: ${img2}`);
}

main().catch(console.error);
