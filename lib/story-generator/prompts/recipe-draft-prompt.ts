/**
 * #169 — Recipe-mode Author prompt.
 *
 * In recipe mode the Author no longer works from a thin Plan + blueprint —
 * it receives the full PageCard contract for every page. This locks the
 * dramatic beat order, the required event, the child's body state, the
 * companion's body action, and the per-page mustInclude / mustNotInclude
 * lists.
 *
 * Smoke test (#168) showed the Author shifting beats one page earlier
 * because the synth-Plan only carried childAction/companionAction strings.
 * With Page Cards explicit in the prompt, the Author has no excuse to drift.
 *
 * Output schema is UNCHANGED (StructuredDraftOutput). Downstream parsing,
 * blueprint validation, and auto-inject all work as before.
 */

import { getCompanionBible } from '@/lib/companion-bible';
import type { GenerateInput, Plan } from '../types';
import { formatCompanionCard } from './companion-cards';
import { getAgeTier } from './draft-prompt';
import type { PageBlueprint } from '../editorial/draft-page-schema';
import type {
  PageCard,
  ProductionRecipe,
  RecipeVariationSlots,
} from '../recipes/recipe-types';
import { buildBlueprintFromRecipe } from '../recipes/blueprint-from-recipe';

type ResolvedVariations = Partial<Record<keyof RecipeVariationSlots, string>>;

/**
 * Recipe-mode system prompt — keeps the legacy rules verbatim and prepends
 * the Page Card contract. Putting the Page Cards rules FIRST makes them the
 * dominant frame: every page must be filled by reading its Page Card, not
 * by free invention.
 */
export function buildRecipeStructuredDraftSystemPrompt(): string {
  return `
You are a children's book author writing in Hebrew for ages 3-8.

This story is governed by a RECIPE. For each page you receive a PAGE CARD
that is a strict contract. You do NOT invent structure. You write Hebrew
prose that satisfies the card.

OUTPUT FORMAT — STRICT JSON ONLY:
{
  "frontmatter": {
    "title": "<short Hebrew title>"
  },
  "pages": [
    {
      "page": <integer>,
      "purpose": "<echo the Page Card's dramaticRole>",
      "textSentences": ["<Hebrew sentence>", "<Hebrew sentence>"],
      "imageDirection": "<English shot direction>"
    }
  ]
}

⚠ THIS IS NOT FREE-FORM MARKDOWN. Return JSON only. No \`\`\` fences. No commentary.

═══════════════════════════════════════════════════════
HOW TO READ A PAGE CARD
═══════════════════════════════════════════════════════

Every page in the input has 9 fields you MUST honor:

  • dramaticRole     — WHAT this page does (closed vocabulary, do not invent)
  • requiredEvent    — the literal event in plain Hebrew. Write it.
  • childBodyState   — how the child's body moves/reacts. Show it.
  • companionAction  — what the companion does. BODY ONLY. Never speech.
  • requiredObject   — the object that must physically appear on this page
                        (when present; otherwise none)
  • mustInclude      — a list of tokens. EACH token must appear verbatim
                        in the page's textSentences.
  • mustNotInclude   — a list of tokens. NONE of these may appear anywhere
                        on this page.
  • critical         — if true, this page carries the resilience moment.
                        It must be PHYSICALLY exact (no abstract softening).
  • caps             — maxWords, maxSentences, targetWords. ABSOLUTE.

You are NOT free to:
  - move events between pages
  - merge or split dramatic roles
  - replace the companion's body action with speech ("בּוֹלִי אמר" is forbidden
    on every page — the companion is a body, not a voice)
  - skip a mustInclude token
  - emit a mustNotInclude token

You ARE free to:
  - choose the exact Hebrew sentence forms
  - add small concrete sensory details that serve the card
  - vary phrasing across the book so prose doesn't repeat itself

═══════════════════════════════════════════════════════
GLOBAL RULES (apply on top of every Page Card)
═══════════════════════════════════════════════════════

1. PAGE CAPS ARE ABSOLUTE. If a page exceeds maxWords or maxSentences, it
   is rejected at parse time.

2. textSentences is an ARRAY of short Hebrew sentences — ONE per entry.
   No cramming multiple sentences into one element.

3. Hebrew of a child. Concrete verbs. No adult-poetic metaphors.
   Forbidden across all pages: "השקט החזיק", "אור ליטף", "גשר אור",
   "כבל דק", "עמק כריות", "מילא את החדר", "כמו בועת שקיפות", "לב רוקד",
   "לב התמלא", "שקט שרר", "האור ליטף",
   // #170 polish — additional adult-poetic kills observed in smoke runs:
   "ריח ילדות", "האוויר נהיה דק", "שקט לבן", "טומפ בזיכרון",
   "האוויר התמלא", "ריח של חמימות", "נהיה דק ושקט".

4. CHILD NAME RHYTHM. The child's name is a strong opening note — use it
   sparingly. RULES:
   - Pages 1–2: you MAY open with the child's name.
   - Pages 3+: do NOT open consecutive pages with the child's name.
     Open with a pronoun (היא / הוא), an object ("המדחום…", "היד…",
     "המדבקה…"), or an action ("בחוץ הרוח…", "במרפאה…").
   - Total appearances of the child's name across the book: aim for 6–10,
     not more. The previous smoke runs hit 18 — that reads mechanical.

5. Third person. Never 1st-person verbs in prose (✗ שמעתי / ראיתי).
   Quoted dialogue in "…" may be 1st-person.

6. NO planning labels in prose. Never write "[medical-object-appears]" or
   any bracket identifier in textSentences. The "purpose" field echoes the
   Page Card; textSentences contains pure Hebrew prose only.

7. NO meta-instructions in prose. Never write "סיים בX" / "כתוב Y".
   textSentences is the story the child hears.

8. Companion does NOT give speeches. Bolly does not say "אל תפחדי" or
   "זה בסדר". He closes to a ball. He opens slowly. That's his mechanic.

9. Ending: show physical state. Do NOT explain emotion. Forbidden across
   the last two pages: "זוכרת ש", "מזכירה ש", "הבינה ש", "למדה ש",
   "מעכשיו תמיד", "הפחד נעלם".

═══════════════════════════════════════════════════════
WHY PAGE CARDS: in previous batches the Author drifted beats by a page or
collapsed two roles into one. Y-lite still scored well sometimes — but the
beat order matters for resilience. Page Cards remove the drift entirely.
Stay inside the card. The story ships.
`.trim();
}

/**
 * Build the per-story user prompt with all Page Cards laid out.
 *
 * Returns:
 *   - prompt   — the formatted string to send as user message
 *   - blueprint — PageBlueprint[] derived from PageCards, for downstream
 *                 validators / blueprint check inside structured-draft core.
 */
export function buildRecipeStructuredDraftUserPrompt(args: {
  recipe: ProductionRecipe;
  variations: ResolvedVariations;
  plan: Plan;
  input: GenerateInput;
}): { prompt: string; blueprint: PageBlueprint[] } {
  const { recipe, variations, plan, input } = args;

  const blueprint = buildBlueprintFromRecipe(recipe);
  const companionCard = formatCompanionCard(input.companionId);
  const tier = getAgeTier(input.childAge);
  const bible = getCompanionBible(input.companionId);
  const canonicalName = bible?.nameClean ?? recipe.companionId;

  const headerLines = [
    `Recipe: ${recipe.id} (v${recipe.meta.version})`,
    `Companion: ${recipe.companionId} (name: ${canonicalName})`,
    `Direction: ${recipe.direction}`,
    `Category: ${recipe.category}`,
    `Child: ${input.childName}, age ${input.childAge}, gender ${input.childGender}`,
    `Page count: ${recipe.pageCount}`,
    '',
    `Age tier: ${tier.label} — ${tier.sentencesPerPage} sentences/page, ${tier.wordsPerPage} words/page.`,
    '',
    `Story promise: ${recipe.storyPromise}`,
    `Emotional arc: ${recipe.emotionalArc}`,
    `Resilience pattern: ${recipe.resiliencePattern}`,
  ];

  const variationLines = [
    '',
    '═══════════════ RESOLVED VARIATIONS (this run) ═══════════════',
    ...formatVariations(variations),
  ];

  const pageCardLines = [
    '',
    '═══════════════ PAGE CARDS (THE PER-PAGE CONTRACT) ═══════════════',
    ...recipe.pageCards.flatMap((card) =>
      formatPageCard(card, variations, canonicalName)
    ),
  ];

  const globalForbiddenLines = [
    '',
    '═══════════════ GLOBAL FORBIDDEN PATTERNS (any page) ═══════════════',
    ...recipe.forbiddenPatterns.map((p) => `  ✗ ${p}`),
  ];

  const acceptanceLines = [
    '',
    '═══════════════ ACCEPTANCE CRITERIA (reviewers will check) ═══════════════',
    ...recipe.acceptanceCriteria.map((c, i) => `  ${i + 1}. ${c}`),
  ];

  const hookLines = [
    '',
    '═══════════════ HOOK (use verbatim on declared pages) ═══════════════',
    `sound: ${plan.hookContract.sound ?? '(none)'}`,
    `object: ${plan.hookContract.object ?? '(none)'}`,
    `appearsOnPages: [${plan.hookContract.appearsOnPages.join(', ')}]`,
  ];

  const closingLines = [
    '',
    '═══════════════ FINAL INSTRUCTION ═══════════════',
    'Return JSON only. Match every Page Card exactly. Stay within every cap.',
    'If a Page Card has mustInclude: ["בּוֹלִי", "טוּמְפּ"], BOTH tokens must',
    'appear on that page — do NOT collapse them into one phrase like',
    '"בּוֹלִי אמר טומפ". The companion is a body, not a voice.',
  ];

  const prompt = [
    ...headerLines,
    '',
    '═══════════════ COMPANION CARD ═══════════════',
    companionCard,
    ...variationLines,
    ...pageCardLines,
    ...globalForbiddenLines,
    ...acceptanceLines,
    ...hookLines,
    ...closingLines,
  ]
    .filter((line) => line !== null && line !== undefined)
    .join('\n');

  return { prompt, blueprint };
}

// ─────────────────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────────────────

function formatVariations(variations: ResolvedVariations): string[] {
  const entries = Object.entries(variations).filter(([, v]) => Boolean(v));
  if (entries.length === 0) return ['  (none)'];
  return entries.map(([k, v]) => `  ${k}: ${v}`);
}

function formatPageCard(
  card: PageCard,
  variations: ResolvedVariations,
  canonicalName: string
): string[] {
  const requiredObject = card.requiredObjectSlot
    ? variations[card.requiredObjectSlot] ?? '(missing — skip this field)'
    : null;

  const lines: string[] = [
    '',
    `── PAGE ${card.page} ${card.critical ? '★ CRITICAL' : ''}`.trimEnd(),
    `   dramaticRole:     ${card.dramaticRole}`,
    `   requiredEvent:    ${card.requiredEvent}`,
    `   childBodyState:   ${card.childBodyState}`,
    `   companionAction:  ${card.companionAction}`,
  ];

  // Note: requiredExactLine is NOT rendered in the prompt by design.
  // Prompt-level enforcement of it caused prompt overload and made the
  // Author miss other anchors. The field is instead enforced by code
  // post-Draft (see enforceRequiredExactLines in structured-draft.ts).

  if (requiredObject) {
    lines.push(`   requiredObject:   ${requiredObject} (slot: ${card.requiredObjectSlot})`);
  }

  lines.push(
    `   mustInclude:      [${card.mustInclude.map(quote).join(', ')}]`,
    `   mustNotInclude:   [${card.mustNotInclude.map(quote).join(', ')}]`,
    `   caps:             target ${card.targetWords} words / max ${card.maxWords} words / max ${card.maxSentences} sentences`,
    `   imageIntent:      ${card.imageIntent}`
  );

  return lines;
}

function quote(s: string): string {
  return `"${s}"`;
}
