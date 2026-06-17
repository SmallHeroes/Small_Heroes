/**
 * 0071/0072 gate — koko·fantasy 5-page LOW with approved Stage0 anchor.
 *
 *   npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs \
 *     scripts/run-koko-fantasy-gate.ts
 *
 * Optional:
 *   ONLY_PAGES=5
 *   CHILD_PHOTO_PATH=path/to/boy.jpg
 *   APPROVE_ANCHOR_CACHE_KEY=chameleon_koko_fantasy__...
 *   PROMPT_AUDIT_ONLY=true
 */
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

import { approveQaAnchorCache } from '../lib/qa-console-anchor';
import { runQaConsoleRender } from '../lib/qa-console-run';

const DEFAULT_PAGES = [1, 2, 3, 4, 5];

function parsePages(): number[] {
  const raw = process.env.ONLY_PAGES?.trim();
  if (!raw) return DEFAULT_PAGES;
  const nums = raw
    .split(/[,\s]+/)
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return nums.length ? nums : DEFAULT_PAGES;
}

async function main(): Promise<void> {
  const pages = parsePages();
  const promptAuditOnly = process.env.PROMPT_AUDIT_ONLY?.trim().toLowerCase() === 'true';
  const childPhotoPath = process.env.CHILD_PHOTO_PATH?.trim();
  const approveKey = process.env.APPROVE_ANCHOR_CACHE_KEY?.trim();

  if (approveKey) {
    approveQaAnchorCache(approveKey);
    console.log(`[gate] approved anchor cache ${approveKey}`);
  }

  const child = childPhotoPath && (existsSync(childPhotoPath) || childPhotoPath.startsWith('http'))
    ? {
        name: process.env.CHILD_NAME?.trim() || 'נועם',
        gender: 'boy' as const,
        age: Number.parseInt(process.env.CHILD_AGE?.trim() ?? '5', 10) || 5,
        photoPath: childPhotoPath,
      }
    : { preset: 'noam' as const };

  const result = await runQaConsoleRender({
    storyKey: 'chameleon_koko_fantasy@v3-approved',
    pages,
    child,
    quality: 'low',
    skipLlmPersonalization: true,
    promptAuditOnly,
    runLabelPrefix: 'qa-console-chameleon_koko-fantasy-low',
    approveAnchorCacheKey: approveKey ?? null,
    forceRegenerateAnchor: process.env.FORCE_REGENERATE_ANCHOR === 'true',
  });

  console.log('\n=== Koko fantasy gate ===');
  console.log(`Manifest: ${result.manifestPath}`);
  console.log(`Rendered: ${result.renderedPageNumbers.join(', ') || '(none)'}`);
  console.log(`Failed: ${result.failedPages.join(', ') || 'none'}`);
  console.log(`Preview: http://localhost:3000/dev/style01-book-preview?dir=${encodeURIComponent(result.manifestDir)}&root=outputs`);

  if (result.failedPages.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
