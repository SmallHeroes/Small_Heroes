/**
 * Generate Style 01 multi-angle companion character sheet (pilot tool).
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/generate-companion-sheet.ts dragon_dini
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/generate-companion-sheet.ts fox_uri --publish
 */
import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

const PILOT_COMPANIONS = ['dragon_dini', 'fox_uri', 'octopus_seara'] as const;

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const publish = process.argv.includes('--publish');
  const companionId = args[0]?.trim();

  if (!companionId) {
    console.error(
      'Usage: npx tsx --require ./scripts/shims/register-server-only.cjs scripts/generate-companion-sheet.ts <companionId> [--publish]'
    );
    console.error(`Pilot ids: ${PILOT_COMPANIONS.join(', ')}`);
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is required');
    process.exit(1);
  }

  const { generateCompanionCharacterSheet, COMPANION_SHEET_VIEW_KINDS } = await import(
    '@/lib/generation-pipeline/companion-character-sheet'
  );
  const { getCompanionById } = await import('@/lib/companions');

  const companion = getCompanionById(companionId);
  if (!companion) {
    console.error(`Unknown companion: ${companionId}`);
    process.exit(1);
  }

  const outDir = path.join(process.cwd(), 'outputs', 'companion-sheets', companionId);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`[companion-sheet] Generating ${companionId} → ${outDir}`);
  const bundle = await generateCompanionCharacterSheet({
    companionId,
    outDir,
    publishToPublic: publish,
  });

  const readme = [
    `# Companion sheet — ${companionId}`,
    '',
    `Reference jpg: ${bundle.referenceJpg}`,
    `Generated: ${bundle.generatedAt}`,
    '',
    '## Views',
    ...COMPANION_SHEET_VIEW_KINDS.map((k) => {
      const v = bundle.views[k];
      if (!v) return `- ${k}: (missing)`;
      return `- ${k}: ${v.qaStatus} resemblance=${v.resemblanceToIdentity.toFixed(3)} → ${path.basename(v.localPath)}`;
    }),
    '',
    publish
      ? 'Published to public/companions/.../style01-sheets/'
      : 'Eyeball PNGs here. Re-run with --publish to copy into public/companions/<id>/style01-sheets/',
    '',
    'Pilot order: dragon_dini → fox_uri → octopus_seara',
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'README.md'), readme);

  console.log(JSON.stringify(bundle, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
