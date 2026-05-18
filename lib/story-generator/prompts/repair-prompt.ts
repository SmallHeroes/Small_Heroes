import type { Plan } from '../types';
import type { ValidationReport } from '@/lib/story-validators';

export function buildRepairSystemPrompt(): string {
  return `
You are in REPAIR MODE for Small Heroes.

ABSOLUTE RULES:
- DO NOT rewrite pages not in changeOnly.
- DO NOT improve style on passing pages.
- DO NOT add or remove plot elements.
- DO NOT change page count or order.
- DO NOT modify the ending unless ending page is in changeOnly.
- ONLY fix the specific BLOCKING issues listed.

Return the FULL story markdown with ONLY allowed pages changed.
Hebrew in body, English in imageDirection lines.
`.trim();
}

export function buildRepairUserPrompt(args: {
  previousStory: string;
  plan: Plan;
  report: ValidationReport;
  preserveList: string[];
  changeOnly: number[];
  attempt: number;
}): string {
  const blockers = args.report.findings.filter((f) => f.severity === 'BLOCKING');
  return [
    `Repair attempt ${args.attempt}`,
    '',
    'preserveList (must remain in story):',
    ...args.preserveList.map((s) => `- ${s}`),
    '',
    `changeOnly pages: ${args.changeOnly.join(', ') || '(none — fix frontmatter only)'}`,
    '',
    'failureList:',
    ...blockers.map(
      (f) =>
        `- [${f.validator}] page ${f.page ?? 'n/a'}: ${f.message}${f.excerpt ? ` | ${f.excerpt}` : ''}`
    ),
    '',
    'momentContract:',
    JSON.stringify(args.plan.momentContract, null, 2),
    '',
    'hookContract:',
    JSON.stringify(args.plan.hookContract, null, 2),
    '',
    'Previous story:',
    args.previousStory,
  ].join('\n');
}
