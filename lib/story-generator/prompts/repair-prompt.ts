import type { Plan } from '../types';
import type { ParsedStory, ValidationReport } from '@/lib/story-validators';

/**
 * v0.2.1: Patch-merge repair prompts.
 *
 * Prior version asked LLM for full markdown and trusted it. LLM consistently
 * modified non-changeOnly pages, cascading modeCompliance failures.
 *
 * New approach: LLM returns ONLY the repaired pages as JSON. Code merges in
 * `lib/story-generator/stages/repair.ts`.
 */
export function buildRepairPatchSystemPrompt(): string {
  return `
You are in REPAIR MODE for Small Heroes.
Your job: fix ONLY the specific pages the user lists, returning ONLY those pages.

ABSOLUTE RULES:
1. Return JSON ONLY in this shape:
   {
     "pages": [
       { "pageNumber": <number>, "text": "<Hebrew prose>", "imageDirection": "<English shot>" }
     ]
   }
2. The "pages" array MUST contain ONLY the page numbers the user requested.
   Do NOT include pages that don't need repair. Code will merge them with the original.
3. Each repaired "text" is the ENTIRE Hebrew body of that page (the prose that goes
   between "--- Page N ---" and "imageDirection:").
4. "imageDirection" stays IDENTICAL to the original UNLESS the failure involved imageDirection.
5. Hebrew only in "text". English only in "imageDirection".
6. Preserve every string in preserveList VERBATIM somewhere in your repaired text.
7. Fix ONLY the listed BLOCKING issues — do not stylistically improve.
8. Do NOT include frontmatter, page markers, or any non-JSON content.

If you return pages not in changeOnly, they will be IGNORED by code.
If you return malformed JSON, the repair will fail catastrophically.
`.trim();
}

interface RepairPatchArgs {
  pagesToRepair: ParsedStory['pages'];
  report: ValidationReport;
  preserveList: string[];
  plan: Plan;
  attempt: number;
}

export function buildRepairPatchUserPrompt(args: RepairPatchArgs): string {
  const blockers = args.report.findings.filter((f) => f.severity === 'BLOCKING');
  const targetPageNumbers = args.pagesToRepair.map((p) => p.pageNumber).sort((a, b) => a - b);

  // Group blockers per page for clarity
  const blockersByPage = new Map<number, typeof blockers>();
  for (const b of blockers) {
    if (typeof b.page === 'number') {
      const arr = blockersByPage.get(b.page) ?? [];
      arr.push(b);
      blockersByPage.set(b.page, arr);
    }
  }

  const pageBriefs = args.pagesToRepair.map((page) => {
    const pageBlockers = blockersByPage.get(page.pageNumber) ?? [];
    return [
      `--- Page ${page.pageNumber} (TO REPAIR) ---`,
      `Current text: ${page.text}`,
      `Current imageDirection: ${page.imageDirection}`,
      pageBlockers.length
        ? `Blockers on this page:\n${pageBlockers
            .map((b) => `  - [${b.validator}] ${b.message}${b.excerpt ? ` | "${b.excerpt}"` : ''}`)
            .join('\n')}`
        : `(no page-specific blockers — fix issues from global list below)`,
    ].join('\n');
  });

  const globalBlockers = blockers.filter((b) => typeof b.page !== 'number');

  return [
    `Repair attempt ${args.attempt}`,
    '',
    `Pages to repair: [${targetPageNumbers.join(', ')}]`,
    `Return JSON: {"pages": [{"pageNumber": N, "text": "...", "imageDirection": "..."}, ...]}`,
    `Include ONLY these page numbers in your response: ${targetPageNumbers.join(', ')}`,
    '',
    'preserveList — these EXACT strings MUST appear verbatim somewhere in your repaired text:',
    ...args.preserveList.map((s) => `  - "${s}"`),
    '',
    args.plan.hookContract.sound || args.plan.hookContract.phrase || args.plan.hookContract.object
      ? `Hook tokens (use verbatim on pages [${args.plan.hookContract.appearsOnPages.join(', ')}] when within changeOnly):\n  sound: ${args.plan.hookContract.sound ?? '(none)'}\n  phrase: ${args.plan.hookContract.phrase ?? '(none)'}\n  object: ${args.plan.hookContract.object ?? '(none)'}`
      : '',
    '',
    args.plan.momentContract.page && targetPageNumbers.includes(args.plan.momentContract.page)
      ? `Moment page (in repair scope): ${args.plan.momentContract.page} — keep physicalAction: "${args.plan.momentContract.physicalAction}"`
      : '',
    '',
    globalBlockers.length
      ? `Global blockers (no specific page):\n${globalBlockers.map((b) => `  - [${b.validator}] ${b.message}`).join('\n')}`
      : '',
    '',
    'Pages requiring repair (full current text shown):',
    ...pageBriefs,
    '',
    'Return JSON now. No markdown wrappers. No prose outside the JSON.',
  ]
    .filter(Boolean)
    .join('\n');
}

// Legacy exports for backwards compatibility (older orchestrate.ts may still import these)
export function buildRepairSystemPrompt(): string {
  return buildRepairPatchSystemPrompt();
}
export function buildRepairUserPrompt(args: {
  previousStory: string;
  plan: Plan;
  report: ValidationReport;
  preserveList: string[];
  changeOnly: number[];
  attempt: number;
}): string {
  // Wrap legacy signature into new patch-merge call.
  // Note: this legacy path no longer matches the new system prompt — orchestrate
  // should call buildRepairPatchUserPrompt directly via runRepair.
  const parsed = JSON.parse(JSON.stringify({ legacy: true })); // marker
  void parsed;
  return [
    `Repair attempt ${args.attempt} (legacy path — see runRepair for patch-merge)`,
    `changeOnly: ${args.changeOnly.join(', ')}`,
    args.previousStory,
  ].join('\n');
}
