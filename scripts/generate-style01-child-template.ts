/**
 * One-time: generate neutral Style 01 child template assets (girl/boy).
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/generate-style01-child-template.ts girl
 */
import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

async function main() {
  const variant = (process.argv[2]?.trim().toLowerCase() || 'girl') as 'girl' | 'boy';
  if (variant !== 'girl' && variant !== 'boy') {
    console.error('Usage: ... generate-style01-child-template.ts girl|boy');
    process.exit(1);
  }

  const { generateGPTImage } = await import('@/lib/generate-image');
  const { STYLE_01_AVOIDANCE_NEGATIVE, STYLE_01_SHARED, STYLE_01_RENDERING_CORRECTION } =
    await import('@/lib/style01-gptimage');
  const { STYLE01_CHILD_TEMPLATE_DIR } = await import('@/lib/style01-child-template');

  const genderWord = variant === 'girl' ? 'girl' : 'boy';
  const prompt = [
    'SYSTEM ASSET: Style 01 child character TEMPLATE for storybook personalization.',
    `Generic cute simplified ${genderWord} child age 5, neutral standing front 3/4 view, half body.`,
    'Clean near-empty warm cream background. NO props. NO animals. NO text. NO name.',
    'Large expressive storybook eyes, small nose, rounded cheeks, soft watercolor on cream paper.',
    'Hand-drawn children\'s picture book — NOT photorealistic, NOT photographic portrait.',
    STYLE_01_SHARED,
    STYLE_01_RENDERING_CORRECTION,
  ].join('\n\n');

  const result = await generateGPTImage({
    finalPrompt: prompt,
    negativePrompt: STYLE_01_AVOIDANCE_NEGATIVE,
    referenceImages: [],
    requireReferenceEdit: false,
    size: '1024x1536',
    quality: (process.env.GPT_IMAGE_QUALITY?.trim() || 'low') as 'low' | 'medium' | 'high',
  });

  fs.mkdirSync(STYLE01_CHILD_TEMPLATE_DIR, { recursive: true });
  const outPath = path.join(STYLE01_CHILD_TEMPLATE_DIR, `${variant}.png`);
  fs.writeFileSync(outPath, result.buffer);
  console.log(JSON.stringify({ variant, outPath, bytes: result.buffer.length, model: result.model }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
