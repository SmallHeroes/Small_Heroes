/**
 * Re-render Dini p5 + p11 only (identity-scale fix verification).
 *
 *   ONLY_PAGES=5,11 CHILD_PHOTO_PATH=/path/to/photo.jpg CHILD_NAME=מיה CHILD_GENDER=girl CHILD_AGE=8 \
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/rerender-dini-identity-pages.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

import { existsSync } from 'fs';
import { runQaConsoleRender } from '../lib/qa-console-run';

const PAGES = (process.env.ONLY_PAGES ?? '5,11')
  .split(/[,\s]+/)
  .map((s) => Number.parseInt(s.trim(), 10))
  .filter((n) => Number.isFinite(n) && n >= 1 && n <= 20);

async function main(): Promise<void> {
  const childPhotoPath = process.env.CHILD_PHOTO_PATH?.trim();
  const child = childPhotoPath
    ? {
        name: process.env.CHILD_NAME?.trim() || 'מיה',
        gender: (process.env.CHILD_GENDER?.trim() || 'girl') as 'boy' | 'girl',
        age: Number.parseInt(process.env.CHILD_AGE?.trim() ?? '8', 10) || 8,
        photoPath:
          existsSync(childPhotoPath) || childPhotoPath.startsWith('http') ? childPhotoPath : undefined,
      }
    : { preset: 'mia' as const };

  console.log(`Re-rendering Dini pages: ${PAGES.join(', ')}`);

  const result = await runQaConsoleRender({
    storyKey: 'dragon_dini_fantasy',
    pages: PAGES,
    child,
    quality: 'low',
    generateAudio: false,
    runLabelPrefix: 'dini-identity-scale-fix',
  });

  console.log('\n=== Done ===');
  console.log(`Manifest: ${result.manifestPath}`);
  console.log(`Preview: http://localhost:3000${result.previewUrl}`);
  console.log(`Model: ${result.model} | Failed: ${result.failedPages.join(', ') || 'none'}`);

  if (result.failedPages.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
