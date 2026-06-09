/**
 * Turtle STOP 3 — tiny Hebrew fixes only (do NOT touch valid full chips) + gate rerun.
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/repair-turtle-stop3-prose.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import { TURTLE_BEITI_HOMESICK } from '../lib/story-gen-v3/confidence-batch-specs';
import { rerunStop3Gates } from '../lib/story-gen-v3/stop3-gates';
import type { PageBeatV3, StoryPremiseCandidate } from '../lib/story-gen-v3/types';

const DEFAULT_RUN = path.join(
  process.cwd(),
  'outputs/story-gen-v3-runs/confidence_turtle_beiti_homesick-stop3-2026-06-09T18-05-19-259Z'
);

const SURGICAL_SWAPS: Array<{ from: string; to: string }> = [
  { from: 'שתי חדרים, חלון אחד', to: 'שני חדרים, חלון אחד' },
  { from: '"האור פה... גם כן,"', to: '"האור פה כבר קצת שלנו."' },
];

function runDir(): string {
  return path.resolve(
    process.argv.find((a) => a.startsWith('--run='))?.split('=')[1] ?? DEFAULT_RUN
  );
}

function stripMarkdownFence(md: string): string {
  const trimmed = md.trim();
  if (trimmed.startsWith('```markdown') && trimmed.endsWith('```')) {
    return trimmed.slice('```markdown'.length, -3).trim();
  }
  return md;
}

async function main(): Promise<void> {
  const dir = runDir();
  const storyPath = path.join(dir, 'story.md');
  let md = stripMarkdownFence(fs.readFileSync(storyPath, 'utf8'));
  const applied: Array<{ from: string; to: string; ok: boolean }> = [];

  for (const swap of SURGICAL_SWAPS) {
    const ok = md.includes(swap.from);
    if (ok) md = md.replace(swap.from, swap.to);
    applied.push({ ...swap, ok });
  }

  fs.writeFileSync(path.join(dir, 'prose-repair-log.json'), JSON.stringify({ applied }, null, 2));
  fs.writeFileSync(storyPath, md, 'utf8');

  const premise = JSON.parse(
    fs.readFileSync(path.join(dir, 'hardened-premise.json'), 'utf8')
  ) as StoryPremiseCandidate;
  const beats = JSON.parse(
    fs.readFileSync(path.join(dir, 'page-beats.json'), 'utf8')
  ) as PageBeatV3[];

  console.log('[turtle-repair] Hebrew fixes applied — rerunning STOP 3 gates...');
  const result = await rerunStop3Gates({
    runDir: dir,
    spec: TURTLE_BEITI_HOMESICK,
    premise,
    beats,
  });

  const report = `# Turtle STOP 3 repair — Hebrew only (chips untouched)

## NOT human-approved — literary swing decision pending
humanAloudReadRequired: true

## Surgical swaps
${applied.map((a) => `- ${a.ok ? 'OK' : 'MISSING'}: \`${a.from}\``).join('\n')}

## Gates
- StoryAlive: ${result.storyAliveVerdict}
- HebrewReadAloud: ${result.hebrewVerdict}
- read-back: ${result.readBackPass ? 'PASS' : 'FAIL'}
- suffixChipHits: ${result.suffixChipHits}
- gatePassAutomated: ${result.gatePassAutomated}

Run dir: \`${dir}\`
`;
  fs.writeFileSync(path.join(dir, 'report.md'), report, 'utf8');

  console.log(`[turtle-repair] gatePassAutomated: ${result.gatePassAutomated}`);

  if (!result.gatePassAutomated) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
