#!/usr/bin/env tsx
/**
 * Zero-cost, read-only audit of the historical Wizard Visual Contract candidates.
 *
 * Historical bytes are never treated as current authority. Each candidate is
 * cloned through the explicit offline vc-schema/v1 migration and validated
 * against the current template contract. The command writes nothing.
 */
import fs from 'fs';
import path from 'path';

import {
  allMvpCategories,
  MVP_STORY_MATRIX,
  type StoryDirection,
} from '@/backend/config/mvp-story-matrix';
import { migrateLegacyBookVisualContractTemplateV1 } from '@/lib/visual-contract-compiler/contractTemplateMigration';
import { validateBookVisualContractTemplate } from '@/lib/visual-contract-compiler/validateTemplateContract';

const DIRECTIONS: StoryDirection[] = ['bedtime', 'adventure', 'fantasy'];

function flagValue(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

const sourceDir = flagValue('--source-dir');
if (!sourceDir) {
  throw new Error('usage: --source-dir <historical-candidate-directory>');
}

const records: Array<{
  storyKey: string;
  path: string;
  migrated: boolean;
  currentValid: boolean;
  errors: string[];
}> = [];

for (const category of allMvpCategories()) {
  const companionId = MVP_STORY_MATRIX[category].companionId;
  for (const direction of DIRECTIONS) {
    const storyKey = `${companionId}_${direction}`;
    const candidatePath = path.resolve(
      sourceDir,
      `${storyKey}.visual-contract-template.json`,
    );
    if (!fs.existsSync(candidatePath)) {
      records.push({
        storyKey,
        path: candidatePath,
        migrated: false,
        currentValid: false,
        errors: ['historical candidate is missing'],
      });
      continue;
    }
    try {
      const historical = JSON.parse(fs.readFileSync(candidatePath, 'utf8')) as unknown;
      const migrated = migrateLegacyBookVisualContractTemplateV1(historical);
      const validation = validateBookVisualContractTemplate(migrated);
      records.push({
        storyKey,
        path: candidatePath,
        migrated: true,
        currentValid: validation.ok,
        errors: validation.ok ? [] : validation.errors,
      });
    } catch (error) {
      records.push({
        storyKey,
        path: candidatePath,
        migrated: false,
        currentValid: false,
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
  }
}

const report = {
  version: 'wizard-legacy-candidate-audit/v1',
  slotCount: records.length,
  currentValidCount: records.filter((record) => record.currentValid).length,
  records,
};

console.log(JSON.stringify(report, null, 2));
if (report.currentValidCount !== report.slotCount) process.exitCode = 1;
