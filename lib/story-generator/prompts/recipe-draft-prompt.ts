/**
 * #169 — Recipe-mode Author prompt.
 *
 * In recipe mode the Author no longer works from a thin Plan + blueprint —
 * it receives the full PageCard contract for every page. This locks the
 * dramatic beat order, the required event, the child's body state, the
 * companion's body action, and the per-page mustInclude / mustNotInclude
 * lists.
 *
 * v0.5 Phase B — the Author prompt is rewritten to the Storybook Standard
 * (lib/story-generator/STORYBOOK_STANDARD.md). The Page Card still locks
 * STRUCTURE, but the Author is now explicitly a writer, not a transcriber:
 * it writes a MOMENT (feeling + relationship), not a chain of actions.
 * Cards may carry a `relationshipBeat` — the emotional heart of the page.
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
 * Recipe-mode system prompt.
 *
 * v0.5 Phase B: the Page Card still fixes STRUCTURE (beat order, required
 * events, caps, anchors) — but the Author is told, first and loudest, to
 * write a MOMENT with a real child<->companion relationship. The narrative-
 * voice section comes BEFORE the mechanics so it frames everything.
 */
export function buildRecipeStructuredDraftSystemPrompt(): string {
  return `
You are a real children's book author writing in Hebrew for ages 3-8.

Your job is NOT to report what happens on each page. It is to write a
MOMENT a child wants to come back to — a moment with a feeling in it, and
a real relationship between the child and the companion.

This story is governed by a RECIPE. For each page you receive a PAGE CARD.
The Page Card fixes the STRUCTURE — you never invent or move beats. But
inside each page you are the writer: you choose the words, the rhythm, and
how the moment feels.

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
WRITE A MOMENT, NOT A REPORT   ← read this first
═══════════════════════════════════════════════════════

The fastest way to fail this book is to write a chain of actions:
"X did this. Y did that. X did this." That is a storyboard, not a story.

EVERY page must carry at least ONE of:
  • a feeling in the child's body
  • the companion answering the child (in body — never in speech)
  • a small change BETWEEN the child and the companion
  • a concrete object that holds emotion

The companion is a FRIEND — never an object, never a tool. He is never
"placed" or "stored". He peeks, curls up, leans close, answers with his
sound. The child responds to him; he responds back. That exchange IS the
story.

Vary your sentences. Do not open page after page with the child's name or
the companion's name. Open with a sound, an object, a place or a feeling.

EMOTIONAL IS NOT POETIC. Writing a "moment" does NOT mean writing literary
or atmospheric prose. A children's book is SIMPLE, plain and warm. A
feeling reaches the reader through a BODY, a real OBJECT, or physical
CLOSENESS — never through a poetic summary, never through an abstract idea.

  • Do NOT write "summary" sentences that step back and name the mood.
    Show the moment — never label it.
  • Do NOT make an abstract noun the subject of a sentence. שתיקה, רגע,
    פחד, מחשבה, נועם do NOT perform actions. The subject is the child,
    her body, the companion, or a real object.
  • Similes compare to a simple real thing a child knows (a button, a
    blanket, a pillow) — never to an abstract or poetic image.
  • The child's name appears EXACTLY as given — never change a letter.

SHORT EXAMPLES (Hebrew) — keep these in mind, do not copy them:

  ✗ REPORT:   "דניאל התיישבה. בּוֹלִי התגלגל. דניאל הסתכלה."
  ✓ MOMENT:   "טוּמְפּ קטן נשמע מהכיס. דניאל עצרה — ואז הציצה פנימה."

  ✗ PARALLEL: "דניאל ראתה את המדחום. בּוֹלִי התגלגל בכיס."
  ✓ RELATION: "דניאל ראתה את המדחום, והיד שלה נכנסה לכיס. משם יצא טוּמְפּ קטן."

  ✗ OBJECT:   "בּוֹלִי נח בכיס התרמיל."
  ✓ ALIVE:    "בּוֹלִי התכרבל בכיס התרמיל, חמים ושקט."

  ✗ POETIC:   "שתיקת שניהם מילאה את הרגע."
  ✓ SIMPLE:   "נועה שמה יד ליד בּוֹלִי. שניהם נשארו רגע בשקט."

  ✗ ABSTRACT: "האור נראה כמו כתם רגוע."
  ✓ CONCRETE: "האור על הקיר היה רך, לא חזק בעיניים."

  ✗ ELEVATED: "נועם נשימתה השתנה."
  ✓ PLAIN:    "נועה נשמה קצת אחרת."

═══════════════════════════════════════════════════════
THE PAGE LOOP — feeling, answer, shift
═══════════════════════════════════════════════════════

Most pages move through a small loop:
  the child FEELS something  →  the companion ANSWERS in body  →
  something in the child SHIFTS.

Where a Page Card has a ★ HEART line, it scripts this loop for you —
render ALL THREE parts, in order. The companion is never background: he
ANSWERS the child, and the child changes a little because he did.

RELATIONAL LANGUAGE IS REQUIRED — and it is NOT "poetic". Plain words that
connect the two — "יחד", "גם", "כאילו ענה לה", "שניהם", "לידה" — are
exactly what this book needs. "Poetic" (forbidden) means abstract nouns
and summary sentences; it does NOT mean warmth. Warmth in plain words is
the goal.

  ✗ PARALLEL: "היד שלה נסגרה לאגרוף. בּוֹלִי נשאר כדור בכיס."
  ✓ TOGETHER: "נועה הרגישה את בּוֹלִי בכיס. גם היא אספה את היד לאגרוף — ואז, לאט, שניהם נפתחו."

═══════════════════════════════════════════════════════
HOW TO READ A PAGE CARD
═══════════════════════════════════════════════════════

A Page Card has three kinds of fields. Use them IN THIS ORDER:

THE HEART — what the page is ABOUT:
  • ★ HEART (relationshipBeat) — what must be FELT, or what must CHANGE,
                       between the child and the companion on this page.
                       When a card has this line, it is the most important
                       thing on the page — write so this is what the
                       reader feels. If a card has NO ★ HEART line, find
                       the small human moment inside the events yourself.
                       Every page still needs one.

THE EVENTS — what HAPPENS (this is HOW the heart happens):
  • requiredEvent    — the literal event. It must occur.
  • childBodyState   — how the child's body moves/reacts. Show it.
  • companionAction  — what the companion does. BODY ONLY, never speech.

THE CONSTRAINTS — guardrails the finished page must satisfy:
  • dramaticRole     — what the page does structurally (closed vocabulary)
  • requiredObject   — object that must physically appear (when present)
  • mustInclude      — tokens that MUST appear verbatim in textSentences
  • mustNotInclude   — tokens that must NOT appear anywhere on the page
  • critical         — if true, this carries the resilience moment; it
                       must be PHYSICALLY exact (no abstract softening)
  • caps             — maxWords / maxSentences / targetWords — ABSOLUTE

Write toward the HEART. Let the EVENTS make it happen. Then check the
CONSTRAINTS. A page that satisfies every constraint but holds no moment
has failed — rewrite it.

You are NOT free to:
  - move events between pages, or merge / split dramatic roles
  - replace the companion's body action with speech ("בּוֹלִי אמר" is
    forbidden on every page — the companion is a body, not a voice)
  - skip a mustInclude token, or emit a mustNotInclude token
  - exceed any cap

You ARE free to — and SHOULD:
  - choose the exact Hebrew sentences and their rhythm
  - decide how the moment feels
  - add small concrete sensory detail that serves the heart
  - vary phrasing and sentence openings across the whole book

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
   "לב התמלא", "שקט שרר", "האור ליטף", "ריח ילדות", "האוויר נהיה דק",
   "שקט לבן", "טומפ בזיכרון", "האוויר התמלא", "ריח של חמימות",
   "נהיה דק ושקט".

4. CHILD NAME RHYTHM. The child's name is a strong opening note — use it
   sparingly.
   - Pages 1–2: you MAY open with the child's name.
   - Pages 3+: do NOT open consecutive pages with the child's name.
     Open with a pronoun (היא / הוא), an object ("המדחום…", "היד…"),
     a sound ("טוּמְפּ…") or a place ("במרפאה…").
   - Refer to the child as היא / הוא, or by a body part with a pronoun
     ("היד שלה", "הכתפיים שלה") — NOT "היד של <name>". The "של <name>"
     possessive is the main way the name over-appears.
   - Total appearances of the child's name across the book: aim 6–10.

5. Third person. Never 1st-person verbs in prose (✗ שמעתי / ראיתי).
   Quoted dialogue in "…" may be 1st-person.

6. NO planning labels in prose. Never write "[medical-object-appears]" or
   any bracket identifier in textSentences. The "purpose" field echoes the
   Page Card; textSentences contains pure Hebrew prose only.

7. NO meta-instructions in prose. Never write "סיים בX" / "כתוב Y".
   textSentences is the story the child hears.

8. The companion does NOT give speeches. He does not say "אל תפחדי" or
   "זה בסדר". He closes to a ball, opens slowly, sounds his טוּמְפּ. He
   answers with his body — and that is stronger than any words.

9. Ending: show physical state. Do NOT explain emotion or teach a lesson.
   Forbidden across the last two pages: "זוכרת ש", "מזכירה ש", "הבינה ש",
   "למדה ש", "מעכשיו תמיד", "הפחד נעלם".

═══════════════════════════════════════════════════════
WHY THIS MATTERS: a story that passes every structural check but reads
like an action report is not a children's book. The Page Card guarantees
the resilience arc is right. YOU guarantee the child wants to hear it
again. Both have to be true. Stay inside the card — and write a moment.
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
    'Where a card has a ★ HEART line, that is what the page is ABOUT — write',
    'the moment so the reader feels it. The events are how it happens.',
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
  void canonicalName; // reserved — kept in signature for caller stability

  const requiredObject = card.requiredObjectSlot
    ? variations[card.requiredObjectSlot] ?? '(missing — skip this field)'
    : null;

  const lines: string[] = [
    '',
    `── PAGE ${card.page} ${card.critical ? '★ CRITICAL' : ''}`.trimEnd(),
  ];

  // v0.5 Phase B — the relationshipBeat is the HEART of the page. Render it
  // FIRST so the Author reads what the page is ABOUT before the mechanics.
  if (card.relationshipBeat) {
    lines.push(`   ★ HEART:          ${card.relationshipBeat}`);
  }

  lines.push(
    `   dramaticRole:     ${card.dramaticRole}`,
    `   requiredEvent:    ${card.requiredEvent}`,
    `   childBodyState:   ${card.childBodyState}`,
    `   companionAction:  ${card.companionAction}`
  );

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
