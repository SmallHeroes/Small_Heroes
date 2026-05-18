import type { EditorialReportRuntime } from './schemas';

export function formatEditorialSummary(args: {
  storyId: string;
  report: EditorialReportRuntime;
  editorialQaCostUsd: number;
  editorialRepairCostUsd: number;
  editorialQaModel: string;
  editorialRepairModel: string;
  orchestrationStatus: string;
}): string {
  const { report } = args;
  const scores = report.scores;
  const lowest = Object.entries(scores).sort((a, b) => a[1] - b[1])[0];
  const blocking = report.issues.filter((i) => i.severity === 'BLOCKING');
  const major = report.issues.filter((i) => i.severity === 'MAJOR');
  const minor = report.issues.filter((i) => i.severity === 'MINOR');

  const lines: string[] = [
    `# Editorial QA Summary — ${args.storyId}`,
    '',
    `**Orchestration status:** ${args.orchestrationStatus}`,
    `**Editorial verdict:** ${report.verdict}`,
    `**Scores:** naturalHebrew=${scores.naturalHebrew}, directionFit=${scores.directionFit}, motifConsistency=${scores.motifConsistency}, continuity=${scores.continuity}, readAloud=${scores.readAloud}, ageFit=${scores.ageFit}`,
    `**Lowest dimension:** ${lowest[0]} (${lowest[1]}/5)`,
    '',
    `## Blocking issues (${blocking.length})`,
  ];

  if (blocking.length === 0) lines.push('- (none)');
  for (const i of blocking) {
    lines.push(
      `- **Page ${i.page} [${i.field}]:** "${i.quote}"`,
      `  - reason: ${i.reason}`,
      `  - suggestion: "${i.suggestion}"`,
      i._unmatchedQuote ? '  - ⚠ quote not matched in text' : '',
      i._repairedDeterministically ? '  - ✓ repaired deterministically' : ''
    );
  }

  lines.push('', `## Major issues (${major.length})`);
  if (major.length === 0) lines.push('- (none)');
  for (const i of major.slice(0, 10)) {
    lines.push(`- **Page ${i.page} [${i.field}]:** "${i.quote.slice(0, 60)}" → ${i.reason}`);
  }

  lines.push('', `## Minor (${minor.length} — not blocking)`);
  for (const i of minor.slice(0, 5)) {
    lines.push(`- Page ${i.page}: ${i.reason}`);
  }

  lines.push(
    '',
    '## Decision',
    `${report.verdict} — see orchestration status above.`,
    '',
    '## Cost',
    `Editorial QA: $${args.editorialQaCostUsd.toFixed(4)} (${args.editorialQaModel})`,
    `Editorial Repair: $${args.editorialRepairCostUsd.toFixed(4)} (${args.editorialRepairModel})`,
    `Total editorial: $${(args.editorialQaCostUsd + args.editorialRepairCostUsd).toFixed(4)}`
  );

  return lines.filter(Boolean).join('\n');
}
