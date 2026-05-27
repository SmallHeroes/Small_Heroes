/**
 * Single-page end-to-end verify — Bolly bedtime, Style 02 + read-v2.
 * Requires `npm run dev` (or deployed dev) and full .env.local.
 *
 * Usage:
 *   CHILD_PHOTO_PATH=C:\path\to\photo.png \
 *   npx tsx scripts/run-single-page-bedtime-verify.ts
 *
 * Optional: APP_URL=http://localhost:3000
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

const APP_URL = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(
  /\/$/,
  ''
);
const CHILD_PHOTO = process.env.CHILD_PHOTO_PATH?.trim();

function assertStyle02Env(): void {
  const required = [
    ['PHASE2_STYLE02_BOOK_PIPELINE', 'true'],
    ['IMAGE_PROVIDER', 'gpt-image'],
    ['PHASE2_STEP5_PROFILE', process.env.PHASE2_STEP5_PROFILE?.trim() || 'guarded-v2'],
  ] as const;
  const missing = required.filter(([k, v]) => process.env[k]?.trim() !== v).map(([k]) => k);
  if (missing.length) {
    console.error('Missing or wrong env for Style 02 blockers:', missing.join(', '));
    console.error('Set in .env.local before running.');
    process.exit(1);
  }
}

async function main(): Promise<void> {
  assertStyle02Env();

  if (!CHILD_PHOTO) {
    console.error('CHILD_PHOTO_PATH is required (child reference photo for Config A).');
    process.exit(1);
  }

  const body = {
    storyFile: 'bolly_armadillo_bedtime.md',
    childName: process.env.CHILD_NAME?.trim() || 'Baboo',
    childGender: process.env.CHILD_GENDER?.trim() || 'boy',
    childAge: Number.parseInt(process.env.CHILD_AGE?.trim() ?? '5', 10) || 5,
    illustrationStyle: 'detailed_whimsical_world',
    /** Server-side path or URL — same as short-book script. */
    childImageUrl: CHILD_PHOTO,
    maxPages: 1,
    skipCover: true,
    generateAudio: false,
  };

  console.log('POST /api/dev/story-bank (1 page, bolly bedtime)...');
  console.log('Ensure dev server is running:', APP_URL);

  const res = await fetch(`${APP_URL}/api/dev/story-bank`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as {
    error?: string;
    bookUrl?: string;
    orderId?: string;
    accessKey?: string;
    pagesRendered?: number;
    pagesFailed?: number[];
    style02Active?: boolean;
    hint?: string;
  };

  if (!res.ok) {
    console.error('Failed:', data.error ?? res.statusText);
    process.exit(1);
  }

  console.log('\n=== Single-page verify complete ===');
  console.log('orderId:', data.orderId);
  console.log('pagesRendered:', data.pagesRendered, 'failed:', data.pagesFailed ?? []);
  console.log('style02Active:', data.style02Active);
  if (data.hint) console.log('hint:', data.hint);
  console.log('\nOpen in read-v2:\n', data.bookUrl);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
