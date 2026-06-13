/**
 * Generate Style 01 multi-angle companion character sheet (pilot tool).
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/generate-companion-sheet.ts dragon_dini
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/generate-companion-sheet.ts fox_uri --publish
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/generate-companion-sheet.ts panda_anat --views=front,3-4,side,happy,theme
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/generate-companion-sheet.ts chameleon_koko --canon-redo
 */
import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

const PILOT_COMPANIONS = ['dragon_dini', 'fox_uri', 'octopus_seara'] as const;

const VIEW_ALIAS: Record<string, string> = {
  front: 'front',
  '3-4': 'three_quarter_front',
  three_quarter_front: 'three_quarter_front',
  side: 'side',
  back: 'three_quarter_back',
  three_quarter_back: 'three_quarter_back',
  happy: 'happy',
  theme: 'theme',
};

function parseViewsFlag(raw: string | undefined): string[] | undefined {
  if (!raw?.trim()) return undefined;
  const kinds = raw
    .split(',')
    .map((part) => VIEW_ALIAS[part.trim()])
    .filter(Boolean);
  return kinds.length > 0 ? kinds : undefined;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const publish = process.argv.includes('--publish');
  const publishOnly = process.argv.includes('--publish-only');
  const canonRedo = process.argv.includes('--canon-redo');
  const viewsArg = process.argv.find((a) => a.startsWith('--views='));
  const viewsToRegenerate = parseViewsFlag(viewsArg?.split('=')[1]);
  const companionId = args[0]?.trim();

  if (!companionId) {
    console.error(
      'Usage: npx tsx --require ./scripts/shims/register-server-only.cjs scripts/generate-companion-sheet.ts <companionId> [--publish|--publish-only|--canon-redo|--views=front,3-4,...]'
    );
    console.error(`Pilot ids: ${PILOT_COMPANIONS.join(', ')}`);
    process.exit(1);
  }

  if (publishOnly) {
    const {
      COMPANION_SHEET_VIEW_FILENAME,
      COMPANION_SHEET_VIEW_KINDS,
      resolveCompanionPublicSheetsDir,
    } = await import('@/lib/generation-pipeline/companion-character-sheet');
    const outDir = path.join(process.cwd(), 'outputs', 'companion-sheets', companionId);
    const reportPath = path.join(outDir, 'report.json');
    if (!fs.existsSync(reportPath)) {
      console.error(`No generated sheet found at ${outDir} — run generation first.`);
      process.exit(1);
    }
    const bundle = JSON.parse(fs.readFileSync(reportPath, 'utf-8')) as {
      companionId: string;
      referenceJpg: string;
      generatedAt: string;
      views: Record<string, { qaStatus: string; resemblanceToIdentity: number } | undefined>;
    };
    const pubDir = resolveCompanionPublicSheetsDir(companionId);
    fs.mkdirSync(pubDir, { recursive: true });
    for (const kind of COMPANION_SHEET_VIEW_KINDS) {
      const fname = COMPANION_SHEET_VIEW_FILENAME[kind];
      const src = path.join(outDir, fname);
      if (!fs.existsSync(src)) continue;
      fs.copyFileSync(src, path.join(pubDir, fname));
      console.log(`[companion-sheet] published ${fname}`);
    }
    fs.writeFileSync(
      path.join(pubDir, 'manifest.json'),
      JSON.stringify(
        {
          companionId: bundle.companionId,
          referenceJpg: bundle.referenceJpg,
          generatedAt: bundle.generatedAt,
          views: Object.fromEntries(
            COMPANION_SHEET_VIEW_KINDS.flatMap((k) => {
              const v = bundle.views[k];
              return v
                ? [[k, { filename: COMPANION_SHEET_VIEW_FILENAME[k], qaStatus: v.qaStatus, resemblanceToIdentity: v.resemblanceToIdentity }]]
                : [];
            })
          ),
        },
        null,
        2
      )
    );
    console.log(`[companion-sheet] publish-only done → ${pubDir}`);
    return;
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
    canonRedo,
    viewsToRegenerate: viewsToRegenerate as import('@/lib/generation-pipeline/companion-character-sheet').CompanionSheetViewKind[] | undefined,
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
      : 'Eyeball PNGs here. Re-run with --publish-only to copy into public/companions/<id>/style01-sheets/',
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
