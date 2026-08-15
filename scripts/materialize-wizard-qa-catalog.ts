#!/usr/bin/env tsx
import { materializeWizardQaCatalog } from '@/lib/wizard-render-readiness';

function flagValue(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

const catalog = materializeWizardQaCatalog({
  repoRoot: process.cwd(),
  ...(flagValue('--output-root') ? { outputRoot: flagValue('--output-root')! } : {}),
});

console.log(JSON.stringify({
  version: catalog.version,
  digest: catalog.digest,
  slotCount: catalog.slotCount,
  companionCount: catalog.companionCount,
  readyForLowStoryGeneration: catalog.records.length,
}, null, 2));
