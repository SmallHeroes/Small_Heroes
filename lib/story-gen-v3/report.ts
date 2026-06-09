/**
 * Sprint A human-read report.
 */

import type {
  GoldenPremiseRecord,
  PremiseExperimentSpecV3,
  PremiseTournamentResult,
} from './types';

export function buildSprintAReport(args: {
  spec: PremiseExperimentSpecV3;
  runDir: string;
  goldenPremises: GoldenPremiseRecord[];
  tournament: PremiseTournamentResult;
}): string {
  const { spec, tournament } = args;
  const passed = tournament.candidates.filter((c) => !c.disqualified);
  const failed = tournament.candidates.filter((c) => c.disqualified);

  const topLines = tournament.topThree.map((t, i) => {
    const c = t.candidate;
    return [
      `### ${i + 1}. ${c.id} (score: ${t.weightedTotal ?? 'DQ'}, ${t.disqualified ? 'DISQUALIFIED' : 'survived'})`,
      `**Hook:** ${c.oneLineHook}`,
      `**Opening:** ${c.openingWeirdEvent}`,
      `**Child want:** ${c.childWant}`,
      `**Funny fail:** ${c.funnyFailureImage}`,
      `**Payoff:** ${c.bigReleasePayoff}`,
      `**Why not fable:** ${c.whyNotTherapeuticFable}`,
      t.judgeNotes ? `**Judge:** ${t.judgeNotes}` : '',
      t.criticAttacks?.length ? `**Critic:** ${t.criticAttacks.join(' | ')}` : '',
      t.hardFails.length ? `**Hard fails:** ${t.hardFails.map((f) => f.code).join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  });

  const candidateTable = tournament.candidates
    .map((t) => {
      const status = t.disqualified ? 'FAIL' : 'PASS';
      return `| ${t.candidate.id} | ${t.candidate.premiseFamily ?? '?'} | ${status} | ${t.weightedTotal ?? '—'} | ${t.hardFails.map((f) => f.code).join('; ') || '—'} |`;
    })
    .join('\n');

  return [
    '# Generator-v3 Sprint A — Story Premise Engine',
    '',
    `**Experiment:** ${spec.id}`,
    `**Companion:** ${spec.companionId} · **Direction:** ${spec.direction}`,
    `**Theme (hidden):** ${spec.resilienceTheme}`,
    `**Child age:** ${spec.childAgeMin}–${spec.childAgeMax}`,
    '',
    '## Calibration goldens',
    '',
    args.goldenPremises.map((g) => `- ${g.sourceStoryId}: ${g.premise.oneLineHook.slice(0, 80)}…`).join('\n'),
    '',
    '## Tournament summary',
    '',
    `- Candidates generated: **${tournament.candidates.length}**`,
    `- Passed hard-fail + emotional threshold: **${passed.length}**`,
    `- Disqualified: **${failed.length}**`,
    `- Selected: **${tournament.selected.id}**`,
    `- Reason: ${tournament.selectionReason}`,
    '',
    '## Score table',
    '',
    '| id | family | gate | score | hard-fails |',
    '|----|--------|------|-------|------------|',
    candidateTable,
    '',
    '## Top 3 (diversity)',
    '',
    ...topLines,
    '',
    '## Human read gate — STOP HERE',
    '',
    'Read `premise-candidates.json`, `premise-score-report.json`, `selected-premise.json`.',
    '',
    '**Question:** Do at least 2 of the 12 candidates make you say *"that\'s a story"*?',
    '',
    '- [ ] YES — ≥2 alive premises → may proceed to StorySpine + PageBeats (Sprint A phase 2, still no prose)',
    '- [ ] NO — Sprint A did not prove the v3 premise-generation thesis under current conditions',
    '',
    'If NO, do **not** continue to prose. Options:',
    '- try different premise model',
    '- improve golden calibration',
    '- human-authored premise catalog',
    '- return to goldens for launch',
    '',
    '**Do NOT say "v3 thesis disproven."** Say: Sprint A did not prove the thesis under current conditions.',
    '',
    '---',
    'Isolated v3 R&D — no production, no bank writes.',
    '',
    `Artifacts: \`${args.runDir}\``,
  ].join('\n');
}
