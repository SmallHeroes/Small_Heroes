/**
 * FRONT-LOAD render of the 4 hard-lookalike pairs (Guy's de-risk): synthetic photo → Stage-0 Method-B
 * canonical watercolour anchor, for the 8 hard-pair children. Reads the plan manifest written by
 * build-diverse-calibration-set.ts. Faithful production path (generateGPTImage + generateStage0MethodB
 * Anchor, same model/dims/quality). Flag stays OFF; no orders (synthetic order id `calib-<id>`).
 *
 * STOP-GATE: render the hard pairs, eyeball distinct-but-similar + child-holds, and STOP before the
 * remaining ~52 if the pairs aren't usable. CALIB_SMOKE=1 renders ONE child only (wiring smoke-test, 2 calls).
 *
 * COST: 2 LOW calls (smoke) or 16 LOW calls (8 photos + 8 anchors). Run ONLY after Guy's render-go.
 *
 * Usage:  CALIB_SMOKE=1 npx tsx scripts/render-diverse-calibration-hardpairs.ts   (1 child, 2 calls)
 *         npx tsx scripts/render-diverse-calibration-hardpairs.ts                 (4 pairs, 16 calls)
 */
import type { Order } from '@prisma/client';
import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

const SMOKE = process.env.CALIB_SMOKE === '1';

interface ManifestChild {
  id: string;
  gender: 'boy' | 'girl';
  age: number;
  skin: string;
  hairColor: string;
  hairTexture: string;
  glasses: boolean;
  faceTrait: string;
  pair: string | null;
  split: string;
  photoPrompt: string;
}

function lockedDescription(c: ManifestChild): string {
  return (
    `A ${c.age}-year-old ${c.gender} with ${c.skin} skin, ${c.hairColor} ${c.hairTexture} hair, ` +
    `${c.faceTrait}${c.glasses ? ', wearing glasses' : ''}.`
  );
}

function syntheticOrder(c: ManifestChild): Order {
  return {
    id: `calib-${c.id}`,
    childName: c.id, // opaque — NEVER a real name
    childGender: c.gender,
    childAge: c.age,
    illustrationStyle: 'pencil_watercolor',
  } as unknown as Order;
}

async function download(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${url}: ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function main() {
  const manifestPath = path.join(process.cwd(), 'outputs', 'diverse-calibration', 'set-manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error(`run build-diverse-calibration-set.ts first (${manifestPath} missing)`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { children: ManifestChild[] };

  const hardPairChildren = manifest.children.filter((c) => c.pair);
  const targets = SMOKE ? hardPairChildren.slice(0, 1) : hardPairChildren;
  console.log(`[hardpairs] ${SMOKE ? 'SMOKE (1 child)' : `FULL (${targets.length} children)`} → ${targets.map((c) => c.id).join(',')}`);
  console.log(`[hardpairs] image-gen calls = ${targets.length * 2} (photo + anchor per child)`);

  const { generateGPTImage } = await import('@/lib/generate-image');
  const { uploadOrderSubpathAsset } = await import('@/lib/image-storage');
  const { generateStage0MethodBAnchor } = await import('@/lib/generation-pipeline/stage0-method-b');

  const outDir = path.join(process.cwd(), 'outputs', 'diverse-calibration', 'hardpairs');
  fs.mkdirSync(outDir, { recursive: true });
  const resultFile = path.join(outDir, 'hardpairs-result.json');
  // Resume-safe: re-use already-rendered children (e.g. the smoke-test c01) — never re-spend.
  const results: Array<Record<string, unknown>> = fs.existsSync(resultFile)
    ? (JSON.parse(fs.readFileSync(resultFile, 'utf8')) as Array<Record<string, unknown>>)
    : [];
  const done = new Set(results.map((r) => String(r.id)));

  for (const c of targets) {
    if (done.has(c.id)) {
      console.log(`[hardpairs] ${c.id} already rendered — skipping (no re-spend)`);
      continue;
    }
    console.log(`\n[hardpairs] === ${c.id} (${c.pair}, ${c.gender}/${c.age}, ${c.skin}, ${c.hairColor} ${c.hairTexture}) ===`);
    // 1) synthetic SOURCE photo (text-only image gen) → upload.
    const photo = await generateGPTImage({ finalPrompt: c.photoPrompt, size: '1024x1024', quality: 'low' });
    const photoUrl = await uploadOrderSubpathAsset({
      orderId: `calib-${c.id}`,
      subpath: 'source-photo.png',
      buffer: photo.buffer,
      contentType: 'image/png',
    });
    console.log(`[hardpairs] ${c.id} photo → ${photoUrl}`);

    // 2) Stage-0 Method-B canonical watercolour anchor (the production anchor path).
    const anchor = await generateStage0MethodBAnchor({
      order: syntheticOrder(c),
      childPhotoUrl: photoUrl,
      lockedChildDescription: lockedDescription(c),
    });
    console.log(`[hardpairs] ${c.id} anchor → ${anchor.anchorUrl} (resemblance=${anchor.resemblanceScore?.toFixed?.(3) ?? '?'})`);

    await download(photoUrl, path.join(outDir, `${c.id}-photo.png`));
    await download(anchor.anchorUrl, path.join(outDir, `${c.id}-anchor.png`));
    results.push({ id: c.id, pair: c.pair, photoUrl, anchorUrl: anchor.anchorUrl, resemblance: anchor.resemblanceScore });
  }

  fs.writeFileSync(resultFile, JSON.stringify(results, null, 2));
  console.log(`\n[hardpairs] wrote ${resultFile}`);
  console.log('[hardpairs] EYEBALL the anchors: each pair distinct-but-similar? child holds vs its photo? STOP if not usable.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
