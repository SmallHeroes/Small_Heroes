/**
 * v0.4 — Structured Draft prompt.
 *
 * The Author returns a JSON object with `frontmatter.title` and a `pages` array.
 * Each page must respect its blueprint cap. Code assembles the markdown.
 *
 * This replaces the free-form markdown Draft for stories where
 * DRAFT_MODE=structured is set.
 *
 * The same rule set as v0.3.6 still applies (no adult poetic, no meta
 * instructions, age-tier density, mirror mechanic, etc.) — but those rules
 * are SHORTER here because the page caps make most violations impossible
 * structurally.
 */
import { getCompanionBible } from '@/lib/companion-bible';
import type { GenerateInput, Plan, MvpCompanionId } from '../types';
import { formatCompanionCard } from './companion-cards';
import { formatAnchorsForPrompt, getCategoryAnchors } from './category-anchors';
import { getAgeTier } from './draft-prompt';
import {
  buildPageBlueprint,
  formatBlueprintForPrompt,
} from '../stages/page-blueprint';
import type { PageBlueprint } from '../editorial/draft-page-schema';

export function buildStructuredDraftSystemPrompt(): string {
  return `
You are a children's book author writing in Hebrew for ages 3-8.

OUTPUT FORMAT — STRICT JSON ONLY:
{
  "frontmatter": {
    "title": "<short Hebrew title>"
  },
  "pages": [
    {
      "page": <integer>,
      "purpose": "<echo of blueprint purpose>",
      "textSentences": ["<Hebrew sentence>", "<Hebrew sentence>"],
      "imageDirection": "<English shot direction>"
    }
  ]
}

⚠ THIS IS NOT FREE-FORM MARKDOWN. Return JSON only. No \`\`\` fences. No commentary.

═══════════════════════════════════════════════════════
THE RULES — short, because page caps enforce most things structurally.
═══════════════════════════════════════════════════════

1. ONE moment per page. Each page is its OWN beat from the blueprint.

2. PAGE CAPS ARE ABSOLUTE.
   You will receive a blueprint with maxWords + maxSentences per page.
   If you exceed maxWords or maxSentences, the page is INVALID and rejected.
   These are not suggestions. The schema validator checks every page.

3. textSentences is an ARRAY of short Hebrew sentences. ONE SENTENCE PER ENTRY.
   Do NOT cram multiple sentences into one array element. The schema rejects
   strings over 160 chars. A page is built by joining the array with newlines.

4. Hebrew of a child. Concrete verbs. No adult-poetic metaphors.
   FORBIDDEN: "השקט החזיק", "אור ליטף", "גשר אור", "כבל דק", "עמק כריות",
   "מילא את החדר", "כמו בועת שקיפות", "לב רוקד".

5. Narrative voice: THIRD PERSON. NEVER 1st-person verbs in prose
   (✗ שמעתי / ראיתי / הרגשתי). Quoted dialogue in "..." can be 1st-person.

6. NO planning labels in prose. NEVER write "[medical-object-appears]" or any
   bracket identifier in textSentences. The "purpose" field echoes the blueprint
   but textSentences contains pure Hebrew prose only.

7. NO meta-instructions in prose. NEVER write "סיים בX" / "כתוב Y" / "צריך
   להיות". textSentences is the story the child hears.

8. Companion does NOT give speeches. Bolly does not say "אל תפחדי" or
   "זה בסדר". He closes to a ball. He opens slowly. That's his mechanic.

9. Mirror mechanic (for medical procedure stories): at the procedure beat,
   Bolly closes AND on the next page the child closes her hand AND opens
   slowly. Two short pages, body-to-body.

10. Anticipation phase (bedtime medical stories): the exam is TOMORROW.
    No procedure happens tonight. The mother does NOT measure temperature.
    The thermometer stays on the shelf — observed, not used.

11. Ending: show physical state. Do NOT explain emotion.
    FORBIDDEN: "זוכרת את", "מזכירה כמה", "היא הבינה", "כמה רגועה היא עכשיו",
    "הפחד נעלם".

═══════════════════════════════════════════════════════
WHY JSON: in earlier batches you (the model) consistently dumped 30-90
Hebrew words onto critical pages even when asked for brevity. The JSON
schema enforces brevity at parse time — the page is rejected before any
editorial review. Stay within the caps and the story ships.
`.trim();
}

export function buildStructuredDraftUserPrompt(
  plan: Plan,
  input: GenerateInput
): { prompt: string; blueprint: PageBlueprint[] } {
  const blueprint = buildPageBlueprint({ plan, input });
  const anchors = getCategoryAnchors(input.companionId, input.direction);
  const companionCard = formatCompanionCard(input.companionId);
  const tier = getAgeTier(input.childAge);
  const bible = getCompanionBible(input.companionId);

  const prompt = [
    `Companion: ${input.companionId} (name: ${bible?.nameClean ?? '?'})`,
    `Direction: ${input.direction}`,
    `Phase: ${anchors.phase}`,
    `Child: ${input.childName}, age ${input.childAge}, gender ${input.childGender}`,
    `Page count: ${plan.beatMap.length}`,
    '',
    `Age tier: ${tier.label} — ${tier.sentencesPerPage} sentences/page, ${tier.wordsPerPage} words/page.`,
    '',
    '═══════════════ COMPANION CARD ═══════════════',
    companionCard,
    '',
    '═══════════════ CATEGORY ANCHORS ═══════════════',
    formatAnchorsForPrompt(anchors),
    '',
    '═══════════════ PAGE BLUEPRINT (FOLLOW EXACTLY) ═══════════════',
    formatBlueprintForPrompt(blueprint, input.companionId),
    '',
    '═══════════════ HOOK (use verbatim on the pages declared) ═══════════════',
    `sound: ${plan.hookContract.sound ?? '(none)'}`,
    `phrase: ${plan.hookContract.phrase ?? '(none)'}`,
    `microAction: ${plan.hookContract.microAction ?? '(none)'}`,
    `object: ${plan.hookContract.object ?? '(none)'}`,
    `appearsOnPages: [${plan.hookContract.appearsOnPages.join(', ')}]`,
    '',
    '═══════════════ MOMENT CONTRACT ═══════════════',
    `Heart page: ${plan.momentContract.page}`,
    `Physical action: ${plan.momentContract.physicalAction}`,
    `Companion signature: ${plan.momentContract.companionSignature}`,
    plan.momentContract.residue ? `Residue: ${plan.momentContract.residue}` : '',
    '',
    'Return JSON only. Match the blueprint page-by-page. Stay within every cap.',
  ]
    .filter(Boolean)
    .join('\n');

  return { prompt, blueprint };
}
