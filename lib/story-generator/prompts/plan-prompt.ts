import type { GenerateInput } from '../types';
import { formatDirectionDNAForPrompt } from '../data/direction-dna';
import { KID_FIRST_PRINCIPLES } from './shared-rules';
import { formatCompanionCard } from './companion-cards';
import { resolvePageCount } from '../data/direction-dna';

export function buildPlanSystemPrompt(): string {
  return `
You are the Planner for Small Heroes story generation.
Your job is NOT to write prose. Output a single JSON object only.

Required JSON fields:
- beatMap: array of {pageNumber, location, childAction, companionAction, emotionalRead, wordCountTarget}
- momentContract: {page, type?, setup?, pause?, physicalAction, companionSignature, childBodyResponse?, echo?, residue?}
- hookContract: {sound?, phrase?, microAction?, object?, appearsOnPages: number[]}
- preserveListSeeds: string[] (lines repair mode must keep verbatim later)
- visualPacingMap: {quietPages: number[], activePages: number[], heartPage: number}

Constraints:
- beatMap.length MUST equal pageCount exactly.
- moment.page inside direction moment window.
- hook.appearsOnPages length >= 2.
- Companion appears by intro page for direction.
- Do NOT include Hebrew story prose.

${KID_FIRST_PRINCIPLES}
`.trim();
}

export function buildPlanUserPrompt(input: GenerateInput, feedback?: string): string {
  const pageCount = resolvePageCount(input.direction, input.pageCount);
  const ageTier =
    input.childAge <= 5
      ? '3-5: shorter sentences, concrete sensory words, 25-40 Hebrew words per page target.'
      : input.childAge <= 7
        ? '5-7: mix short and medium sentences, 35-50 words per page target.'
        : '7-9: slightly richer vocabulary, 45-60 words per page target.';

  return [
    feedback ? `Previous plan rejected: ${feedback}\nFix and return valid JSON.\n` : '',
    `Order:`,
    `childName: ${input.childName}`,
    `childGender: ${input.childGender}`,
    `childAge: ${input.childAge}`,
    `pageCount: ${pageCount}`,
    `companionId: ${input.companionId}`,
    `direction: ${input.direction}`,
    '',
    'Companion Bible:',
    formatCompanionCard(input.companionId),
    '',
    'Direction DNA:',
    formatDirectionDNAForPrompt(input.direction),
    '',
    'Prescription:',
    `emotionalSituation: ${input.prescription.emotionalSituation}`,
    `physicalMechanicSuggestion: ${input.prescription.physicalMechanicSuggestion}`,
    `tabooDirectWords: ${input.prescription.tabooDirectWords.join(', ') || '(none)'}`,
    `narrativeConstraint: ${input.prescription.narrativeConstraint}`,
    '',
    `Age tier: ${ageTier}`,
  ].join('\n');
}
