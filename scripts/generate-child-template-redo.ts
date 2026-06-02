/**
 * Part 2: 3 identity-neutral girl template options (parallel to Mia book work).
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/generate-child-template-redo.ts
 */
import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

const OUT_DIR = path.join(process.cwd(), 'outputs', 'child-template-redo');

const NEUTRAL_PROMPT_BASE = [
  'SYSTEM ASSET: Style 01 DEFAULT child archetype template (identity-neutral).',
  'Generic cute simplified girl child age 5, neutral standing front 3/4, half body.',
  'Clean near-empty warm cream background. NO props. NO animals. NO text. NO name.',
  'HAIR: medium-length straight or wavy brown hair — NOT long curly, NOT ringlets.',
  'OUTFIT: simple neutral storybook clothes (plain soft sweater and pants) — NO bird pajamas, NO prints, NO bracelets.',
  'Large expressive storybook eyes, rounded cheeks, soft watercolor on cream paper.',
  'Small Heroes default child feel — NOT any real child, NOT photorealistic.',
].join('\n\n');

const VARIANTS = [
  { id: 'option-1', extra: 'Slightly wider eyes, gentle smile, hair in low ponytail.' },
  { id: 'option-2', extra: 'Hair loose to shoulders, center-part, calm expression.' },
  { id: 'option-3', extra: 'Hair in two braids, rounder face, curious look.' },
];

async function main() {
  const { generateGPTImage } = await import('@/lib/generate-image');
  const { STYLE_01_AVOIDANCE_NEGATIVE, STYLE_01_SHARED, STYLE_01_RENDERING_CORRECTION } =
    await import('@/lib/style01-gptimage');
  const { STYLE01_CHILD_TEMPLATE_DIR } = await import('@/lib/style01-child-template');

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const approvedB = path.join(
    process.cwd(),
    'outputs',
    'stage0-experiment',
    '345ecd64-c9c2-4e0a-8f9d-a35de8d09883',
    'B.png'
  );
  const currentTemplate = path.join(STYLE01_CHILD_TEMPLATE_DIR, 'girl.png');
  for (const [label, src] of [
    ['approved-B-target.png', approvedB],
    ['current-system-template.png', currentTemplate],
  ] as const) {
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(OUT_DIR, label));
    }
  }

  const results: Array<{ id: string; path: string }> = [];
  for (const v of VARIANTS) {
    const prompt = [NEUTRAL_PROMPT_BASE, v.extra, STYLE_01_SHARED, STYLE_01_RENDERING_CORRECTION].join(
      '\n\n'
    );
    const gen = await generateGPTImage({
      finalPrompt: prompt,
      negativePrompt: STYLE_01_AVOIDANCE_NEGATIVE,
      referenceImages: [],
      requireReferenceEdit: false,
      size: '1024x1536',
      quality: (process.env.GPT_IMAGE_QUALITY?.trim() || 'low') as 'low' | 'medium' | 'high',
    });
    const outPath = path.join(OUT_DIR, `${v.id}.png`);
    fs.writeFileSync(outPath, gen.buffer);
    results.push({ id: v.id, path: outPath });
    console.log(`[template-redo] wrote ${outPath}`);
  }

  fs.writeFileSync(
    path.join(OUT_DIR, 'README.md'),
    [
      '# Child template redo (girl)',
      '',
      '- `approved-B-target.png` — Mia experiment B (Style 01 direction reference only, NOT a system template).',
      '- `current-system-template.png` — copy of `style-references/01-child-template/girl.png`.',
      '- `option-1.png` … `option-3.png` — identity-neutral archetype candidates.',
      '',
      'FLAG: If a child with very different hair gets forced long-curly, regenerate with more hair-neutral prompts.',
    ].join('\n')
  );

  console.log(JSON.stringify({ outDir: OUT_DIR, results }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
