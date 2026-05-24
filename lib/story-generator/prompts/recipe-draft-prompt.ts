/**
 * #169 — Recipe-mode Author prompt.
 *
 * In recipe mode the Author works from the full PageCard contract for
 * every page — dramatic beat order, required event, per-page mustInclude /
 * mustNotInclude, caps.
 *
 * v0.5.2 — Phase B.3: a page is modeled as an INTERACTION, not two
 * parallel actors. Most Page Cards carry a `relationshipLoop` — a 4-beat
 * exchange (childFeels → companionAnswers → childNotices → shift). When a
 * card has a loop, the loop IS the page; the Author renders the four beats
 * as one connected moment. childBodyState / companionAction demote to
 * constraint-data on loop pages. A few deliberately-solo pages carry no
 * loop and are rendered the old way.
 *
 * v0.5.4 — Phase B.4: each loop carries a `loopType` (relief / no-relief /
 * hold / spark) that tells the Author how beat 4 RESOLVES. Not every page
 * ends calm — relief is withheld and then accumulates across the arc.
 *
 * Output schema is UNCHANGED (StructuredDraftOutput).
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

type LoopType = 'relief' | 'no-relief' | 'hold' | 'spark';

/**
 * Per-loopType guidance for beat 4 ("how the page ends"). v0.5.4 Phase B.4.
 * The recipe already authors the beat-4 text in the right spirit; this note
 * tells the Author what KIND of ending it is, so a no-relief / hold page is
 * not "fixed" into a calm resolution.
 */
const LOOP_TYPE_NOTE: Record<LoopType, string> = {
  relief:
    'relief — beat 4 softens the body a little; the worry eases.',
  'no-relief':
    'no-relief — the companion answered, but the child is STILL tense. Do NOT calm the body. End unresolved, with the companion staying close.',
  hold:
    'hold — nothing resolves; just the child and the companion near each other in the quiet. Do NOT add a calming line. Presence is the page.',
  spark:
    'spark — a small light moment: a tiny smile, a playful copy, a quiet warmth. Not tension-relief.',
};

/**
 * Recipe-mode system prompt.
 *
 * v0.5.2 Phase B.3: the dominant frame is "a page is one exchange between
 * the child and the companion." The Page Card hands the Author that
 * exchange as four explicit beats; the Author renders it as one connected
 * moment, never as two parallel actors.
 *
 * v0.5.4 Phase B.4: a page does NOT have to end calm. The loopType tells
 * the Author whether the page resolves, holds, sparks, or stays tense.
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

A "moment" is NOT purple prose. Keep the Hebrew simple, plain and warm.

  ✗ REPORT:   "דניאל התיישבה. בּוֹלִי התגלגל. דניאל הסתכלה."
  ✓ MOMENT:   "טוּמְפּ קטן נשמע מהכיס. דניאל עצרה — ואז הציצה פנימה."

  ✗ OBJECT:   "בּוֹלִי נח בכיס התרמיל."
  ✓ ALIVE:    "בּוֹלִי התכרבל בכיס התרמיל, חמים ושקט."

EMOTIONAL IS NOT POETIC. A feeling reaches the reader through a BODY, a
real OBJECT, or physical CLOSENESS — never through a poetic summary, never
through an abstract idea.
  • Do NOT write "summary" sentences that step back and name the mood.
  • Do NOT make an abstract noun the subject — שתיקה, רגע, פחד, מחשבה,
    נועם do NOT perform actions. The subject is the child, her body, the
    companion, or a real object.
  • The child's name appears EXACTLY as given — never change a letter.

  ✗ POETIC:   "שתיקת שניהם מילאה את הרגע."
  ✓ SIMPLE:   "נועה שמה יד ליד בּוֹלִי. שניהם נשארו רגע בשקט."

  ✗ ADULT:    "עיני נועה נעולות בו."   (locked eyes — adult phrasing)
  ✓ CHILD:    "נועה לא הורידה ממנו את העיניים."

  ✗ STIFF:    "ריח של סבון נמצא באוויר."   (a smell does not "exist in the air")
  ✓ NATURAL:  "ריח של סבון עלה מהכיור."

But do NOT flatten every gentle image. Soft, concrete pictures a child can
see ARE good — "חיוך קטן עלה", "בּוֹלִי התכרבל, חמים ושקט". The enemy is
ADULT or ABSTRACT phrasing, not warmth. Keep the warmth; cut the adult.

═══════════════════════════════════════════════════════
THE PAGE IS AN EXCHANGE — not two actors
═══════════════════════════════════════════════════════

A page is ONE small interaction between the child and the companion —
never two separate things happening side by side.

Most Page Cards hand you that interaction already broken into FOUR BEATS
(the ★ EXCHANGE):
  1. the child FEELS or does something, in the body
  2. the companion REGISTERS that and ANSWERS it — in body, never speech
  3. the child REGISTERS the companion's answer
  4. how the page ENDS

Render the four beats as ONE connected moment — each beat caused by the
one before. The companion answers the SPECIFIC thing the child did; the
child changes a little BECAUSE he answered. Never write "child does X,
companion does Y" side by side — that is the exact failure this structure
exists to prevent.

  ✗ PARALLEL: "נועה ישבה על קצה הכיסא. בּוֹלִי היה שקט בכיס."
  ✓ EXCHANGE: "נועה כיווצה את הרגליים. בּוֹלִי הרגיש את התנועה והזיז פס שריון
              לכיוונה — טוּמְפּ. נועה הרגישה אותו שם."

The four beats compress into the page's 2–4 sentence cap — childNotices
and beat 4 often merge into one sentence. That is fine. Keep all four
beats present; do not pad to four sentences.

A few pages have NO ★ EXCHANGE — these are deliberately SOLO beats (the
feared object appears; the child's body resists while the companion stays
silent). On those pages, render requiredEvent + childBodyState +
companionAction directly.

DIRECT COMMUNICATION. On a few pages a loop beat has the child SPEAKING to
the companion — a short, childlike line in quotes ("אתה בא איתי?", "ככה?",
"גם אתה?"). Render it as quoted dialogue. The companion NEVER replies in
words — he answers only in body (a טוּמְפּ, a shell strip moving, a roll,
curling, a peek). Keep the child's lines short and natural. Never invent
dialogue the card did not give you.

ATTRIBUTE EVERY QUOTED LINE TO THE CHILD — by the child's name or by a
pronoun, never to an abstract noun. A whisper does not speak; the child does.
  ✗ הלחישה באה: …    ✗ השאלה יצאה: …    ✗ הקול אמר: …
  ✓ נועה לחשה: …     ✓ היא לחשה: …      ✓ נועה שאלה: …

═══════════════════════════════════════════════════════
NOT EVERY PAGE ENDS CALM — the four kinds of exchange
═══════════════════════════════════════════════════════

A real children's book has a SHAPE: worry builds, presence holds it, and
relief arrives — and relief EARNED across several pages lands far deeper
than relief handed out on every page. If every page ends "and then the
child felt better," the book stops being a story and becomes a regulation
machine.

So each ★ EXCHANGE is tagged with a loopType. It tells you how BEAT 4 —
how the page ENDS — must read:

  • relief    — beat 4 softens the body a little. The worry eases.
  • no-relief — the companion answered, but the child is STILL tense.
                Do NOT calm the body. End with the worry unresolved and
                the companion staying close.
                e.g. "הכתפיים עדיין מורמות — אבל בּוֹלִי נשאר צמוד."
  • hold      — nothing resolves. Just the child and the companion near
                each other in the quiet. Do NOT add a calming line —
                presence itself is the page.
                e.g. "הם נשארים ככה רגע, צעד ליד צעד."
  • spark     — a small light moment: a tiny smile, a playful copy, a
                quiet "me too." Warmth and connection, not tension-relief.

⚠ On a no-relief or hold page, resist the urge to "fix" the child. The
companion is ALWAYS present and close — but the child does not have to
feel better yet. That restraint IS the craft. The relief is coming on a
later page; let it build. A page tagged no-relief that ends with the body
calm has FAILED the card.

═══════════════════════════════════════════════════════
HOW TO READ A PAGE CARD
═══════════════════════════════════════════════════════

THE PAGE — what you write:
  • ★ EXCHANGE [loopType] — four beats (child feels → companion answers →
            child notices → how it ends). When present, THIS IS THE PAGE.
            Render the four beats as one connected exchange. The loopType
            in brackets tells you how beat 4 must resolve (see above). On
            these pages there is no separate childBodyState /
            companionAction to render — the exchange already contains the
            body and the companion.
  • If there is no ★ EXCHANGE: render requiredEvent + childBodyState +
            companionAction directly — a deliberately solo beat.

THE CONSTRAINTS — guardrails the finished page must satisfy:
  • requiredEvent  — the literal event; it must occur
  • dramaticRole   — what the page does structurally (closed vocabulary)
  • requiredObject — object that must physically appear (when present)
  • mustInclude    — tokens that MUST appear verbatim in textSentences
  • mustNotInclude — tokens that must NOT appear anywhere on the page
  • critical       — the resilience moment; physically exact
  • caps           — maxWords / maxSentences — ABSOLUTE

Write the EXCHANGE. Make the requiredEvent happen inside it. Then check
the CONSTRAINTS. A page that satisfies every constraint but reads as two
parallel actions has failed — rewrite it as one exchange.

You are NOT free to:
  - move events between pages, or merge / split dramatic roles
  - replace the companion's body action with speech ("בּוֹלִי אמר" is
    forbidden on every page — the companion is a body, not a voice)
  - skip a mustInclude token, or emit a mustNotInclude token
  - exceed any cap
  - turn a no-relief or hold page into a calm resolution

You ARE free to — and SHOULD:
  - choose the exact Hebrew sentences and their rhythm
  - decide how the moment feels
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

4. CHILD NAME RHYTHM. The child's name keeps the story about a PERSON,
   not a list of body parts. Use it deliberately.
   - TARGET: the child's name appears 8-12 times across the whole book.
     Fewer and the child vanishes behind "the body / the hand / the
     eyes"; more and the text starts to read like a report.
   - On a page marked "NAME ANCHOR", carry that page with the child's
     actual name as a subject — those pages are where the name belongs.
   - On every other page, prefer a pronoun (היא / הוא), a body part, an
     object ("המדחום…") or a sound ("טוּמְפּ…").
   - Do NOT open 3 or more pages in a row with a body part
     (הגוף / היד / העיניים / הנשימה) — vary the opening.
   - Refer to a body part as "היד שלה", never "היד של <name>".
   - The loop beats write "הילד/ה" only as a PLACEHOLDER: render it as
     the child's name on NAME ANCHOR pages, as a pronoun elsewhere.

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
like two characters acting in parallel — or like the same calm-down beat
twenty times — is not a children's book. The Page Card guarantees the
resilience arc. YOU guarantee that each page is a real exchange, with its
own kind of ending, that a child wants to return to. Stay inside the card
— write each page as one interaction, and respect its loopType.
`.trim();
}

/**
 * Build the per-story user prompt with all Page Cards laid out.
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
    'Where a card has a ★ EXCHANGE, that is the page — render the four beats',
    'as ONE connected interaction, never as two parallel actions, and end it',
    'the way its [loopType] says (relief / no-relief / hold / spark).',
    'If a Page Card has mustInclude: ["בּוֹלִי", "טוּמְפּ"], BOTH tokens must',
    'appear on that page — the companion is a body, not a voice.',
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

  // v0.5.2 Phase B.3 — when the card has a relationshipLoop, the loop IS
  // the page. v0.5.4 Phase B.4 — the loopType controls how beat 4 resolves.
  if (card.relationshipLoop) {
    const L = card.relationshipLoop;
    const loopType: LoopType = L.loopType ?? 'relief';
    lines.push(
      `   ★ EXCHANGE [loopType: ${loopType}] — write these four beats as ONE connected moment:`,
      `       1. child feels:        ${L.childFeels}`,
      `       2. companion answers:  ${L.companionAnswers}`,
      `       3. child notices:      ${L.childNotices}`,
      `       4. how the page ends:  ${L.shift}`,
      `          -> ${LOOP_TYPE_NOTE[loopType]}`,
      `   requiredEvent:    ${card.requiredEvent}  (must occur inside the exchange)`,
      `   dramaticRole:     ${card.dramaticRole}`
    );
  } else {
    lines.push(
      '   (no ★ EXCHANGE — a deliberately solo beat; render the lines below directly)',
      `   dramaticRole:     ${card.dramaticRole}`,
      `   requiredEvent:    ${card.requiredEvent}`,
      `   childBodyState:   ${card.childBodyState}`,
      `   companionAction:  ${card.companionAction}`
    );
  }

  if (card.nameAnchor) {
    lines.push(
      "   NAME ANCHOR: carry this page with the child's actual name as a subject, not only a pronoun or a body part."
    );
  }

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
