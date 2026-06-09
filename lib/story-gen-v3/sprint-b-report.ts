import type { ChipNormalizeReport } from '../story-gen/chip-normalize';
import type { ChipSafetyReport } from '../story-gen/chip-safety';
import type { StoryAliveReport } from './story-alive-gate';

export function buildSprintBReport(args: {
  runDir: string;
  tokens: { in: number; out: number };
  alive: StoryAliveReport;
  chipSafety: ChipSafetyReport;
  chipNormalize: ChipNormalizeReport;
  repairPass?: string;
  poseLinesRepaired?: string[];
}): string {
  const prosePoseCheck = args.alive.checks.find((c) => c.id === 'prose_not_image_prompt');
  return [
    '# Generator-v3 Sprint B — Prose + StoryAlive',
    '',
    `**Repair pass:** ${args.repairPass ?? 'REPAIR_PROSE (surgical, no regenerate)'}`,
    '',
    `**Verdict:** ${args.alive.verdict}`,
    `**completed_p12:** ${args.alive.completedP12 ? 'yes' : 'no'}`,
    `**prose_not_image_prompt:** ${prosePoseCheck?.pass ? 'pass' : 'warnings'}`,
    `**Tokens:** in=${args.tokens.in} out=${args.tokens.out}`,
    `**Humor moments (heuristic):** ${args.alive.humorMoments}`,
    `**Chip safety:** ${args.chipSafety.advisoryFail ? 'FAIL' : 'PASS'} (${args.chipSafety.hitCount} hits)`,
    `**Chip normalize:** ${args.chipNormalize.advisoryFail ? 'FAIL' : 'PASS'} (${args.chipNormalize.fixCount} fixes)`,
    '',
    '## pose_lines_repaired',
    ...(args.poseLinesRepaired?.length
      ? args.poseLinesRepaired.map((l) => `- ${l}`)
      : ['- none']),
    '',
    ...(args.alive.proseNotImagePromptHits.length
      ? [
          '## prose_not_image_prompt hits (remaining)',
          ...args.alive.proseNotImagePromptHits.map((h) => `- p${h.page}: ${h.line}`),
          '',
        ]
      : []),
    '## REPAIR_PROSE history',
    '**Pass 1:** defuse p1; pride p3; kill אומץ p8; concrete p10; quiet p11; callback p12',
    '**Pass 2:** p1 pose→action; completed_p12 check; prose_not_image_prompt gate',
    '',
    '## StoryAlive hard fails',
    ...(args.alive.hardFails.length ? args.alive.hardFails.map((f) => `- ${f}`) : ['- none']),
    '',
    '## Soft warnings',
    ...(args.alive.softWarnings.length ? args.alive.softWarnings.map((w) => `- ${w}`) : ['- none']),
    '',
    '## Anchor checklist',
    ...Object.entries(args.alive.anchorHits).map(([k, v]) => `- ${k}: **${v ? 'yes' : 'NO'}**`),
    '',
    '## Human read — HARD STOP',
    '',
    'Read `story.md` as a book, then aloud.',
    '',
    '- [ ] Popcorn arc alive (lid, kernel-on-nose, towel-sail, popcorn rain, אש→אחרי הסרט)',
    '- [ ] Not flattened to pretty description / soft lesson',
    '- [ ] p11 emotional beat lands (sibling pride) without lecture',
    '- [ ] Chips clean when read aloud',
    '',
    `Artifacts: \`${args.runDir}\``,
    '',
    'No production. No bank write. No images.',
  ].join('\n');
}
