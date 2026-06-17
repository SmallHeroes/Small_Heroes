/**
 * Generic world-lock render gate — any v3-approved or v5 story.
 *
 *   STORY_KEY=lion_shaket_bedtime@v3-approved ONLY_PAGES=1,4,6 \
 *   npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs \
 *     scripts/run-story-gate.ts
 *
 * STORY_KEY: e.g. "dragon_dini_bedtime@v3-approved" (v3-approved bank) or
 *            "fox_uri_bedtime" (default v5 bank).
 * Optional: ONLY_PAGES, CHILD_PHOTO_PATH, APPROVE_ANCHOR_CACHE_KEY, PROMPT_AUDIT_ONLY.
 *
 * First run (no APPROVE_ANCHOR_CACHE_KEY) generates a Stage0 anchor candidate and reports
 * ANCHOR_REVIEW_REQUIRED with the cache key; re-run with that key to approve + render.
 */
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

import { approveQaAnchorCache } from '../lib/qa-console-anchor';
import { runQaConsoleRender } from '../lib/qa-console-run';

function parsePages(): number[] | null {
  const raw = process.env.ONLY_PAGES?.trim();
  if (!raw) return null;
  const nums = raw
    .split(/[,\s]+/)
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return nums.length ? nums : null;
}

async function main(): Promise<void> {
  const storyKey = process.env.STORY_KEY?.trim();
  if (!storyKey) throw new Error('Set STORY_KEY (e.g. dragon_dini_bedtime@v3-approved)');
  const pages = parsePages() ?? [1, 4, 6];
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

  const label = `qa-console-${storyKey.replace(/[^a-z0-9]+/gi, '-')}-low`;
  const result = await runQaConsoleRender({
    storyKey,
    pages,
    child,
    quality: 'low',
    skipLlmPersonalization: true,
    promptAuditOnly,
    runLabelPrefix: label,
    approveAnchorCacheKey: approveKey ?? null,
    forceRegenerateAnchor: process.env.FORCE_REGENERATE_ANCHOR === 'true',
  });

  console.log(`\n=== ${storyKey} gate ===`);
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
