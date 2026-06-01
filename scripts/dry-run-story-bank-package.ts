/**
 * No-image / no-audio package dry-run — same loaders as CREATOR full-book.
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/dry-run-story-bank-package.ts dragon_dini_fantasy.md
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';
import { loadStoryFromBank } from '../backend/providers/story-bank-loader';
import {
  extractYamlFrontmatterBlock,
  parseAndValidateStoryPowerCard,
  parsePowerCardFromFrontmatterYaml,
  resolvePowerCard,
} from '../lib/power-cards';
import {
  resolveSlashedGenderForms,
  resolveStoryBankPlaceholders,
} from '../lib/story-bank-personalization';

const STORY_DIR = path.join(
  process.cwd(),
  'story-bank',
  (process.env.STORY_BANK_V3_DIR || 'v5-fixed-v2').trim()
);

const UNRESOLVED_HEBREW_SLASH_RE =
  /[\u0590-\u05FF]+\/[\u0590-\u05FF]+(?=$|[^\u0590-\u05FF])/u;

async function main(): Promise<void> {
  const storyFile = process.argv[2] || 'dragon_dini_fantasy.md';
  const filePath = path.join(STORY_DIR, storyFile);
  const markdown = fs.readFileSync(filePath, 'utf8');

  const powerResult = parseAndValidateStoryPowerCard(markdown, storyFile.replace(/\.md$/, ''));
  const powerErrors = powerResult.issues.filter((i) => i.severity === 'error');
  if (powerErrors.length > 0 || !powerResult.spec) {
    console.error('powerCard FAIL:', powerErrors.map((e) => e.message).join('; '));
    process.exit(1);
  }
  resolvePowerCard({
    powerCard: parsePowerCardFromFrontmatterYaml(extractYamlFrontmatterBlock(markdown)!),
  });

  if (!/WORD_COUNT:\s*\[/.test(markdown)) {
    console.error('WORD_COUNT missing');
    process.exit(1);
  }

  const childName = 'יובל';
  const companionName = 'דיני';

  for (const gender of ['girl', 'boy'] as const) {
    const story = await loadStoryFromBank(filePath, childName, companionName, gender, {
      maxPages: 20,
    });
    if (story.pages.length !== 20) {
      console.error(`Expected 20 pages, got ${story.pages.length} (${gender})`);
      process.exit(1);
    }
    const sample = story.pages.map((p) => p.text).join('\n');
    if (sample.includes('{{childName}}')) {
      console.error(`Unresolved {{childName}} (${gender})`);
      process.exit(1);
    }
    if (UNRESOLVED_HEBREW_SLASH_RE.test(sample)) {
      console.error(`Unresolved gender slash in body (${gender})`);
      process.exit(1);
    }
    const resolvedSteps = powerResult.spec!.steps.map((step) =>
      resolveSlashedGenderForms(
        resolveStoryBankPlaceholders(step, { childName, childGender: gender }),
        gender
      )
    );
    for (const step of resolvedSteps) {
      if (UNRESOLVED_HEBREW_SLASH_RE.test(step)) {
        console.error(`Unresolved gender slash in powerCard step (${gender}): ${step}`);
        process.exit(1);
      }
    }
  }

  console.log('=== PACKAGE DRY-RUN: PASS ===');
  console.log(`story=${storyFile} pages=20 powerCard=ok WORD_COUNT=ok personalization=ok genderSlash=ok`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
