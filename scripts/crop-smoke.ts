/** Smoke the head detector + cropper on 3 DEV images before the full head-to-head. ~3 detect calls. */
import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();
import './shims/register-server-only.cjs';
import { detectChildHead, cropToHead } from './crop-head-lib';

const M = process.env.CHILD_PHOTO_VISION_MODEL?.trim() || 'gpt-4o';

async function one(url: string, name: string): Promise<void> {
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  const det = await detectChildHead(url, M);
  console.log(`\n${name}: ${JSON.stringify(det)}`);
  const crop = det.detected ? await cropToHead(buf, det) : null;
  if (crop) {
    const p = path.join(process.cwd(), 'outputs', 'diverse-calibration', 'dev', 'crops', `smoke-${name}.png`);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, crop.buffer);
    console.log(`  saved ${p}  aligned=${crop.aligned}`);
  } else console.log('  NO CROP → not_measurable');
}

async function main(): Promise<void> {
  const root = path.join(process.cwd(), 'outputs', 'diverse-calibration');
  const hp = JSON.parse(fs.readFileSync(path.join(root, 'hardpairs', 'hardpairs-result.json'), 'utf8')) as Array<{ id: string; anchorUrl: string }>;
  const a01 = hp.find((h) => h.id === 'c01')!.anchorUrl;
  const base = 'https://qvksgpzzosotubcbizay.supabase.co/storage/v1/object/public/book-images/orders';
  await one(a01, 'c01-anchor');                                   // frontal anchor → alignment path
  await one(`${base}/calib-c03/pages/page-2.png`, 'c03-p2-multichild'); // multi-child → protagonist selection
  await one(`${base}/calib-c04/pages/page-2.png`, 'c04-p2-smalltarget'); // small-in-frame → detect or not_measurable?
}

main().catch((e) => { console.error(e); process.exit(1); });
