#!/usr/bin/env tsx
import path from 'node:path';

import { materializeWizardQaCatalog } from '@/lib/wizard-render-readiness';

function flagValue(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

const historicalCandidateDir = flagValue('--historical-candidate-dir');
if (!historicalCandidateDir) {
  throw new Error('usage: --historical-candidate-dir <directory> [--output-root <repo-relative-directory>]');
}

const catalog = materializeWizardQaCatalog({
  repoRoot: process.cwd(),
  historicalCandidateDir: path.resolve(historicalCandidateDir),
  ...(flagValue('--output-root') ? { outputRoot: flagValue('--output-root')! } : {}),
});

console.log(JSON.stringify({
  version: catalog.version,
  digest: catalog.digest,
  slotCount: catalog.slotCount,
  companionCount: catalog.companionCount,
  readyForBlueprintAuthoring: catalog.records.length,
}, null, 2));
