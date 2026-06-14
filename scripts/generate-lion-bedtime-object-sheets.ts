/**
 * Slot #2 — generate LOW isolated object sheets for lion bedtime (pillow-cave + blanket-fold).
 * Night lamp intentionally omitted (optional/dropped per Guy).
 *
 *   npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs \
 *     scripts/generate-lion-bedtime-object-sheets.ts [--candidates=3]
 *
 * Publish Guy-approved candidates (after eyeball):
 *   ... --publish-pillow=pillow-cave-candidate-01.png --publish-fold=blanket-fold-candidate-01.png
 */
import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

const STORY_KEY = 'lion_shaket_bedtime';
const ZONE_ID = 'night_bedroom';
const BANK_DIR = 'v5-fixed-v2';
const STORY_MD = path.join(process.cwd(), 'story-bank', BANK_DIR, `${STORY_KEY}.md`);
const SIDECAR = path.join(process.cwd(), 'story-bank', BANK_DIR, `${STORY_KEY}.location-bible.json`);
const CANDIDATES_DIR = path.join(process.cwd(), 'outputs', 'zone-sheets', STORY_KEY, ZONE_ID, 'candidates');
const PUBLISHED_DIR = path.join(
  process.cwd(),
  'story-bank',
  BANK_DIR,
  `${STORY_KEY}.zone-sheets`,
  ZONE_ID
);

function parseFlag(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split('=').slice(1).join('=').trim() || undefined;
}

async function main(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is required');
    process.exit(1);
  }
  if (!fs.existsSync(STORY_MD) || !fs.existsSync(SIDECAR)) {
    console.error('Missing story or location bible sidecar');
    process.exit(1);
  }

  const { loadStoryLocationPlanOverride } = await import('@/lib/story-location-bible');
  const { generateLionBedtimeObjectCandidates } = await import(
    '@/lib/generation-pipeline/zone-object-reference-sheet'
  );

  const bundle = loadStoryLocationPlanOverride(STORY_MD);
  if (!bundle) {
    console.error('Failed to load location bible');
    process.exit(1);
  }

  const publishPillow = parseFlag('publish-pillow');
  const publishFold = parseFlag('publish-fold');
  if (publishPillow || publishFold) {
    fs.mkdirSync(PUBLISHED_DIR, { recursive: true });
    const manifestPath = path.join(PUBLISHED_DIR, 'manifest.json');
    const manifest = fs.existsSync(manifestPath)
      ? (JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>)
      : { zoneId: ZONE_ID, files: {} };

    if (publishPillow) {
      const src = path.isAbsolute(publishPillow)
        ? publishPillow
        : path.join(CANDIDATES_DIR, publishPillow);
      const dest = path.join(PUBLISHED_DIR, 'pillow-cave-object.png');
      if (!fs.existsSync(src)) throw new Error(`Missing pillow candidate: ${src}`);
      fs.copyFileSync(src, dest);
      console.log(`[lion-object] published pillow-cave → ${dest}`);
    }
    if (publishFold) {
      const src = path.isAbsolute(publishFold)
        ? publishFold
        : path.join(CANDIDATES_DIR, publishFold);
      const dest = path.join(PUBLISHED_DIR, 'blanket-fold-object.png');
      if (!fs.existsSync(src)) throw new Error(`Missing fold candidate: ${src}`);
      fs.copyFileSync(src, dest);
      console.log(`[lion-object] published blanket-fold → ${dest}`);
    }

    const files = (manifest.files as Record<string, unknown>) ?? {};
    files.isolatedObject = 'pillow-cave-object.png';
    files.objects = ['blanket-fold-object.png'];
    manifest.zoneId = ZONE_ID;
    manifest.approvedBy = manifest.approvedBy ?? 'Guy';
    manifest.approvedAt = new Date().toISOString().slice(0, 10);
    manifest.generatedAt = new Date().toISOString();
    manifest.files = files;
    manifest.notes =
      'REQUIRED: pillow-cave-object.png + blanket-fold-object.png. Night lamp omitted. REJECT blanket-fold if magical — fall back to TEXT-only location bible.';
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`[lion-object] manifest → ${manifestPath}`);
    return;
  }

  const candidatesRaw = parseFlag('candidates');
  const candidates = candidatesRaw ? Number.parseInt(candidatesRaw, 10) : 3;
  const objects = (parseFlag('objects') as 'both' | 'pillow' | 'fold' | undefined) ?? 'both';
  const pillowVariant = (parseFlag('pillow-variant') as 'collapsed' | 'built' | undefined) ?? 'collapsed';
  process.env.GPT_IMAGE_QUALITY = 'low';

  fs.mkdirSync(CANDIDATES_DIR, { recursive: true });
  console.log(
    `[lion-object] generating ${candidates} LOW candidates (${objects}, pillow=${pillowVariant}) → ${CANDIDATES_DIR}`
  );

  const report = await generateLionBedtimeObjectCandidates({
    bible: bundle.bible,
    outDir: CANDIDATES_DIR,
    candidates,
    quality: 'low',
    pillowVariant,
    objects,
  });

  const readme = [
    '# Lion bedtime object sheets — night_bedroom',
    '',
    `Generated: ${report.generatedAt} · quality: ${report.quality}`,
    '',
    '## REQUIRED objects',
    '1. **pillow-cave-object.png** — collapsed/scattered pillow fort (p1, p6, p8, cover)',
    '2. **blanket-fold-object.png** — PLAIN soft blanket fold by pillow (p6, p7, p8)',
    '',
    '## Eyeball gate (Guy)',
    '- Pillow-cave: readable collapsed fort, child-scale pillows',
    '- Blanket-fold: must look ORDINARY — **REJECT if magical/special/glow/lightning/text**',
    '- If blanket-fold fails → publish pillow only + TEXT-only fold in location bible',
    '',
    '## Night lamp',
    'INTENTIONALLY OMITTED (optional; text-only in story)',
    '',
    '## Candidates',
    '### Pillow cave',
    ...report.pillowCave.map((c) => `- ${path.basename(c.localPath)} (${c.durationMs}ms)`),
    '',
    '### Blanket fold',
    ...report.blanketFold.map((c) => `- ${path.basename(c.localPath)} (${c.durationMs}ms)`),
    '',
    '## Publish after approval',
    '```',
    `npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs \\`,
    `  scripts/generate-lion-bedtime-object-sheets.ts \\`,
    `  --publish-pillow=pillow-cave-candidate-01.png \\`,
    `  --publish-fold=blanket-fold-candidate-01.png`,
    '```',
  ].join('\n');
  fs.writeFileSync(path.join(CANDIDATES_DIR, 'README.md'), readme);
  console.log(`[lion-object] README → ${path.join(CANDIDATES_DIR, 'README.md')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
