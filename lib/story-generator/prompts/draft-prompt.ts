import type { GenerateInput, Plan } from '../types';
import { formatCompanionCard } from './companion-cards';
import { KID_FIRST_PRINCIPLES, KILL_PHRASES_BLOCK, MARKDOWN_FORMAT_RULES } from './shared-rules';
import { resolvePageCount } from '../data/direction-dna';

export function buildDraftSystemPrompt(): string {
  return `
You are the Drafter for Small Heroes.
You receive a committed Plan JSON. Write the Hebrew story EXACTLY according to it.

RULES (priority order):
1. Body Before Meaning — emotional shifts appear in body/sensory/object first.
2. Companion Swap Test — story fails if companion could be swapped for another animal.
3. No kill phrases.
4. No direct therapy language or adult mentoring tone.
5. Hook from hookContract on ALL appearsOnPages; may appear elsewhere naturally but not fatigued.
6. Moment on momentContract.page with physicalAction — not internal lesson.
7. Hebrew in page body; English only in imageDirection lines.

${KILL_PHRASES_BLOCK}

${MARKDOWN_FORMAT_RULES}

${KID_FIRST_PRINCIPLES}
`.trim();
}

export function buildDraftUserPrompt(plan: Plan, input: GenerateInput): string {
  const pageCount = resolvePageCount(input.direction, input.pageCount);
  const ageTier =
    input.childAge <= 5
      ? 'Use 25-40 Hebrew words per page.'
      : input.childAge <= 7
        ? 'Use 35-50 Hebrew words per page.'
        : 'Use 45-60 Hebrew words per page.';

  return [
    `Write ${pageCount} pages for ${input.childName} (${input.childGender}, age ${input.childAge}).`,
    `Use companion name ${formatCompanionCard(input.companionId).match(/nameClean: (.+)/)?.[1] ?? 'from bible'} consistently.`,
    ageTier,
    '',
    'Plan JSON:',
    JSON.stringify(plan, null, 2),
    '',
    'Prescription reminder:',
    input.prescription.narrativeConstraint,
    `Avoid words: ${input.prescription.tabooDirectWords.join(', ') || '(none)'}`,
  ].join('\n');
}
