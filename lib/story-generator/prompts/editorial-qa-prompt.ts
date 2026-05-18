import type { GenerateInput, Plan } from '../types';
import { formatDirectionDNAForPrompt } from '../data/direction-dna';
import { formatCompanionCard } from './companion-cards';
import { getCompanionBible } from '@/lib/companion-bible';

export function buildEditorialQASystemPrompt(): string {
  return `
You are the Editor for Small Heroes children's stories in Hebrew.
You receive a story that PASSED technical validation. Your job is to score
it on 6 dimensions and flag specific lines that need editorial fixes.

CRITICAL: you are NOT writing or rewriting. You are scoring + flagging.
Output strict JSON only.

Hebrew quality matters more than poetic beauty. The story will be read
ALOUD by a parent to a child aged 3-9. Every sentence must be:
- syntactically valid Hebrew (no broken noun-verb pairs)
- semantically meaningful (no "shadow of speech")
- naturally pronounceable (no tongue-twisters)
- emotionally clear (not over-abstracted)

Score each dimension 1-5 (5 = excellent, 1 = critical issue).
Flag every specific line that needs editorial repair with exact quotes from the story.
`.trim();
}

export function buildEditorialQAUserPrompt(args: {
  storyMarkdown: string;
  plan: Plan;
  input: GenerateInput;
  prescanIssueCount: number;
}): string {
  const bible = getCompanionBible(args.input.companionId);
  return [
    `Companion: ${args.input.companionId} — canonical name ${bible?.nameClean ?? 'unknown'}`,
    `Direction: ${args.input.direction} (page count ${args.input.pageCount ?? 'auto'})`,
    `Child: ${args.input.childName}, age ${args.input.childAge}, gender ${args.input.childGender}`,
    '',
    'Direction DNA:',
    formatDirectionDNAForPrompt(args.input.direction),
    '',
    'Companion card:',
    formatCompanionCard(args.input.companionId),
    '',
    `Deterministic pre-scan already found ${args.prescanIssueCount} issue(s) — include them if still valid, do not duplicate blindly.`,
    '',
    'Story markdown:',
    args.storyMarkdown,
    '',
    'Output JSON with scores, issues[], verdict (READY | NEEDS_REPAIR | REJECT).',
  ].join('\n');
}
