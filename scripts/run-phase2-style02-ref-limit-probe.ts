/**
 * Step 0 — probe gpt-image-2 images.edit reference count limit.
 * Usage: npx tsx scripts/run-phase2-style02-ref-limit-probe.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { generateGPTImage } from '../lib/generate-image';
import { STYLE_02_REF_DIR, STYLE_02_GPT_MODEL } from '../lib/style02-gptimage';
import { readdir } from 'fs/promises';

async function main() {
  const counts = [4, 5, 6] as const;
  const files = (await readdir(STYLE_02_REF_DIR)).filter((f) => f.endsWith('.png'));
  const outDir = path.join(
    process.cwd(),
    'phase2-logs',
    `ref-limit-probe-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`
  );
  await mkdir(outDir, { recursive: true });

  const results: Record<string, unknown>[] = [];

  for (const n of counts) {
    process.env.GPT_IMAGE_EDIT_MAX_REFERENCES = String(n);
    const refs = files.slice(0, n).map((f) => path.join(STYLE_02_REF_DIR, f));
    console.log(`\n--- trying ${n} references ---`);
    try {
      const gen = await generateGPTImage({
        finalPrompt: 'Style probe: simple forest path, no characters, no text.',
        referenceImages: refs,
        referenceMode: 'style',
        requireReferenceEdit: true,
        modelOverride: STYLE_02_GPT_MODEL,
        size: '1024x1536',
        quality: 'low',
      });
      results.push({
        refCount: n,
        ok: true,
        model: gen.model,
        apiMode: gen.apiMode,
        refsPassed: gen.referenceCountPassed,
        usage: gen.usage,
      });
      console.log(`OK refsPassed=${gen.referenceCountPassed}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ refCount: n, ok: false, error: msg });
      console.log(`FAIL: ${msg.slice(0, 200)}`);
    }
  }

  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify({ results }, null, 2) + '\n', 'utf8');
  console.log(`\nWrote ${path.join(outDir, 'manifest.json')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
