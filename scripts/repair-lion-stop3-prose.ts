/**
 * Lion STOP 3 — suffix-chip conversion + Hebrew line fix + gate rerun.
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/repair-lion-stop3-prose.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import { LION_SHAKET_ANGER } from '../lib/story-gen-v3/confidence-batch-specs';
import { convertSuffixChipsInMarkdown } from '../lib/story-gen-v3/suffix-chip-scan';
import { rerunStop3Gates } from '../lib/story-gen-v3/stop3-gates';
import type { PageBeatV3, StoryPremiseCandidate } from '../lib/story-gen-v3/types';

const DEFAULT_RUN = path.join(
  process.cwd(),
  'outputs/story-gen-v3-runs/confidence_lion_shaket_anger-stop3-2026-06-09T18-04-50-867Z'
);

const HEBREW_SWAPS: Array<{ from: string; to: string }> = [
  {
    from: '"לעלה זה לא חשב."',
    to: '"בעיני העלה זה לא היה עדין."',
  },
];

function runDir(): string {
  return path.resolve(
    process.argv.find((a) => a.startsWith('--run='))?.split('=')[1] ?? DEFAULT_RUN
  );
}

async function main(): Promise<void> {
  const dir = runDir();
  const storyPath = path.join(dir, 'story.md');
  let md = fs.readFileSync(storyPath, 'utf8');

  const chipConvert = convertSuffixChipsInMarkdown(md);
  md = chipConvert.markdown;

  const hebrewApplied: Array<{ from: string; to: string; ok: boolean }> = [];
  for (const swap of HEBREW_SWAPS) {
    const ok = md.includes(swap.from);
    if (ok) md = md.replace(swap.from, swap.to);
    hebrewApplied.push({ ...swap, ok });
  }

  fs.writeFileSync(
    path.join(dir, 'prose-repair-log.json'),
    JSON.stringify({ suffixChipConverted: chipConvert.converted, hebrewApplied }, null, 2)
  );
  fs.writeFileSync(storyPath, md, 'utf8');

  const premise = JSON.parse(
    fs.readFileSync(path.join(dir, 'hardened-premise.json'), 'utf8')
  ) as StoryPremiseCandidate;
  const beats = JSON.parse(
    fs.readFileSync(path.join(dir, 'page-beats.json'), 'utf8')
  ) as PageBeatV3[];

  console.log('[lion-repair] suffix chips converted — rerunning STOP 3 gates...');
  const result = await rerunStop3Gates({
    runDir: dir,
    spec: LION_SHAKET_ANGER,
    premise,
    beats,
  });

  const report = `# Lion STOP 3 repair — suffix chips + Hebrew

## NOT human-approved
humanAloudReadRequired: true

## Suffix chip conversions
${chipConvert.converted.map((c) => `- ${c}`).join('\n') || '- none'}

## Hebrew swaps
${hebrewApplied.map((a) => `- ${a.ok ? 'OK' : 'MISSING'}: \`${a.from}\``).join('\n')}

## Gates
- StoryAlive: ${result.storyAliveVerdict}
- HebrewReadAloud: ${result.hebrewVerdict}
- read-back: ${result.readBackPass ? 'PASS' : 'FAIL'}
- suffixChipHits: ${result.suffixChipHits}
- gatePassAutomated: ${result.gatePassAutomated}

Run dir: \`${dir}\`
`;
  fs.writeFileSync(path.join(dir, 'report.md'), report, 'utf8');

  console.log(`[lion-repair] suffixChipHits: ${result.suffixChipHits}`);
  console.log(`[lion-repair] gatePassAutomated: ${result.gatePassAutomated}`);

  if (!result.gatePassAutomated) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
