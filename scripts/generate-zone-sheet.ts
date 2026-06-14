/**
 * Generate Style 01 zone & object reference sheet candidates (LocationBible phase 2).
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/generate-zone-sheet.ts --story=fox_uri_adventure --zone=balcony_drip_area
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/generate-zone-sheet.ts --story=fox_uri_adventure --zone=balcony_drip_area --regen-bucket-from-set=set-candidate-01.png
 */
import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

function parseFlag(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split('=').slice(1).join('=').trim() || undefined;
}

async function main() {
  const storyKey = parseFlag('story');
  const zoneId = parseFlag('zone');
  const bankDir = parseFlag('bank-dir') || 'v3-approved';
  const candidatesRaw = parseFlag('candidates');
  const candidatesPerArtifact = candidatesRaw ? Number.parseInt(candidatesRaw, 10) : 3;
  const regenFromSet = parseFlag('regen-bucket-from-set');
  const generateIsolated = process.argv.includes('--generate-isolated-bucket');

  if (!storyKey || !zoneId) {
    console.error(
      'Usage: npx tsx --require ./scripts/shims/register-server-only.cjs scripts/generate-zone-sheet.ts --story=fox_uri_adventure --zone=balcony_drip_area [--candidates=3] [--regen-bucket-from-set=set-candidate-01.png] [--generate-isolated-bucket]'
    );
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is required');
    process.exit(1);
  }

  const storyMd = path.join(process.cwd(), 'story-bank', bankDir, `${storyKey}.md`);
  const sidecar = path.join(process.cwd(), 'story-bank', bankDir, `${storyKey}.location-bible.json`);
  if (!fs.existsSync(storyMd)) {
    console.error(`Story not found: ${storyMd}`);
    process.exit(1);
  }
  if (!fs.existsSync(sidecar)) {
    console.error(`Location bible sidecar not found: ${sidecar}`);
    process.exit(1);
  }

  const { loadStoryLocationPlanOverride } = await import('@/lib/story-location-bible');
  const { generateZoneObjectSheetCandidates, generateBucketCandidatesFromSetReference } =
    await import('@/lib/generation-pipeline/zone-object-reference-sheet');
  const { resolveZoneSheetCandidatesDir } = await import('@/lib/story-location-bible/zone-sheets');

  const bundle = loadStoryLocationPlanOverride(storyMd);
  if (!bundle) {
    console.error('Failed to load location bible sidecar');
    process.exit(1);
  }

  const zone = bundle.bible.allowedZones.find((z) => z.id === zoneId);
  if (!zone) {
    console.error(`Zone ${zoneId} not found in ${sidecar}`);
    process.exit(1);
  }
  if (!zone.referenceSheet) {
    console.error(`Zone ${zoneId} has no referenceSheet — add setFile/objectFiles to location bible first`);
    process.exit(1);
  }

  const outDir = resolveZoneSheetCandidatesDir(storyKey, zoneId);
  fs.mkdirSync(outDir, { recursive: true });

  if (generateIsolated) {
    const { generateIsolatedBucketObjectSheet } = await import(
      '@/lib/generation-pipeline/zone-object-reference-sheet'
    );
    const outPath = path.join(outDir, 'bucket-object-candidate-01.png');
    const result = await generateIsolatedBucketObjectSheet({
      storyKey,
      zoneId,
      bible: bundle.bible,
      outPath,
      quality: 'low',
    });
    const published = path.join(
      process.cwd(),
      'story-bank',
      'v3-approved',
      `${storyKey}.zone-sheets`,
      zoneId,
      'bucket-object.png'
    );
    fs.mkdirSync(path.dirname(published), { recursive: true });
    fs.copyFileSync(result.localPath, published);
    console.log(`[zone-sheet] published isolated bucket → ${published}`);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (regenFromSet) {
    const setPath = path.isAbsolute(regenFromSet)
      ? regenFromSet
      : path.join(outDir, regenFromSet);
    if (!fs.existsSync(setPath)) {
      console.error(`Set reference not found: ${setPath}`);
      process.exit(1);
    }

    const canonicalCopy = path.join(outDir, 'set-approved-canonical.png');
    if (!fs.existsSync(canonicalCopy)) {
      fs.copyFileSync(setPath, canonicalCopy);
    }

    fs.writeFileSync(
      path.join(outDir, 'set-approval.json'),
      JSON.stringify(
        {
          approvedFile: path.basename(setPath),
          approvedBy: 'Guy',
          approvedAt: '2026-06-12',
          notes:
            'Canonical zone set — metal-bar railing (p4 מעקה המתכת), window-ledge drip, correct bucket scale, true night.',
        },
        null,
        2
      )
    );

    console.log(
      `[zone-sheet] Regenerating bucket from approved set → ${setPath} (${candidatesPerArtifact} candidates, LOW)`
    );

    const result = await generateBucketCandidatesFromSetReference({
      storyKey,
      zoneId,
      bible: bundle.bible,
      outDir,
      approvedSetPath: setPath,
      candidates: candidatesPerArtifact,
      quality: 'low',
    });

    const readme = [
      `# Zone & object reference sheets — ${storyKey} / ${zoneId}`,
      '',
      `## Set — APPROVED`,
      `- Canonical: ${path.basename(setPath)} (Guy 2026-06-12)`,
      `- Copy: set-approved-canonical.png`,
      '',
      `## Bucket — regen from set (${result.generatedAt})`,
      ...result.bucket.map((c) => `- ${path.basename(c.localPath)} (${c.durationMs}ms)`),
      '',
      'Derived from approved set reference — same night mood, ledge, railing, chair, bucket scale.',
      'Eyeball bucket-from-set candidates. After Guy approval → publish + wire + rerender.',
    ].join('\n');
    fs.writeFileSync(path.join(outDir, 'README.md'), readme);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`[zone-sheet] Generating ${storyKey}/${zoneId} → ${outDir} (LOW, ${candidatesPerArtifact} per artifact)`);

  const result = await generateZoneObjectSheetCandidates({
    storyKey,
    zoneId,
    bible: bundle.bible,
    outDir,
    candidatesPerArtifact,
    quality: 'low',
  });

  const readme = [
    `# Zone & object reference sheets — ${storyKey} / ${zoneId}`,
    '',
    `Generated: ${result.generatedAt}`,
    `Quality: ${result.quality}`,
    `Candidates per artifact: ${result.candidatesPerArtifact}`,
    '',
    '## Set (zone reference)',
    ...result.set.map((c) => `- ${path.basename(c.localPath)} (${c.durationMs}ms)`),
    '',
    '## Bucket (object anchor)',
    ...result.bucket.map((c) => `- ${path.basename(c.localPath)} (${c.durationMs}ms)`),
    '',
    '## Hard rules',
    '- ZERO characters in sheets',
    '- One fixed drip source: stone/plaster ledge above bucket',
    '- Bucket knee-height with chair scale cue',
    '',
    'Eyeball candidates here. After Guy approval:',
    '1. Copy chosen set.png + bucket.png → story-bank/v3-approved/{story}.zone-sheets/{zone}/',
    '2. Add manifest.json with approvedBy',
    '3. Wire refs + full rerender (separate step)',
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'README.md'), readme);

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
