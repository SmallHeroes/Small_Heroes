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

⚠ CRITICAL HOOK CONTRACT RULES (these caused 100% failures in prior batch):
- hook.sound: MAX 4 Hebrew letters, ONE token only (e.g., "טוּמְפּ", "ששש", "פששש"). NO punctuation. NO commas.
- hook.phrase: a SHORT Hebrew phrase (3-5 words), repeatable as-is (e.g., "בפנים היה חם"). NOT a sentence.
- hook.object: ONE Hebrew noun + optional definite article (e.g., "המדבקה", "הצעיף"). NOT a description.
- hook.microAction: max 3 words, a CONCRETE verb+object (e.g., "נסגר לכדור", "כנף עוטפת"). NOT poetic.
- FORBIDDEN hook formats: long phrases, commas inside any field, "X — Y" patterns, decorative descriptions.

These short tokens MUST appear verbatim on declared pages. The model that drafts the
story will be asked to use them exactly. Long poetic descriptions get lost in prose
and fail hookAppearances validation.

⚠ momentContract.physicalAction: MAX 8 Hebrew words. Concrete body action only.
⚠ momentContract.residue: ONE specific noun (object) that remains at story end.
⚠ momentContract.companionSignature: MAX 6 Hebrew words. Concrete behavior.

⚠ preserveListSeeds rules:
- Each seed: MAX 12 Hebrew chars, MAX 2 words.
- Atomic nouns only (e.g., "מדבקה", "כדור", "בטן ורודה").
- NEVER verb phrases like "בולי נסגר לכדור" — those rephrase and break anchors.
- Use the companion's canonical name (e.g., "בּוֹלִי") as the FIRST seed.

⚠ COMPANION NAME — use the canonical form from the Companion Bible ONLY.
Never invent variants. Never produce near-spellings like "שולי" / "בולו" / "ליליה"
in beatMap.companionAction or anywhere else.

Constraints:
- beatMap.length MUST equal pageCount exactly.
- moment.page inside direction moment window.
- hook.appearsOnPages length >= 2 AND <= 6 (not every page — only key beats).
- Companion appears by intro page for direction.
- ⚠ FANTASY OVERRIDE: in fantasy direction, the companion's canonical name MUST be
  the subject of companionAction on pages 1 AND 2 explicitly. Not "he", not "the creature",
  not "the small ball" — the actual name. Fantasy without the companion in its first beats
  fails companionPresence validation.
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
