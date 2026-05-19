import { getCompanionBible } from '@/lib/companion-bible';
import type { GenerateInput, Plan, MvpCompanionId } from '../types';
import { formatCompanionCard } from './companion-cards';
import { formatAnchorsForPrompt, getCategoryAnchors } from './category-anchors';
import { resolvePageCount } from '../data/direction-dna';

/**
 * v0.3.4 — Age-tier density. Simple, but NOT thin.
 */

const FORBIDDEN_NAME_MUTATIONS: Record<MvpCompanionId, string[]> = {
  bolly_armadillo: ['שולי', 'בולו', 'בולא', 'בולה', 'בובו', 'בובה'],
  bat_lily: ['ליליל', 'ליליה', 'לילית', 'לִיללִי'],
  chameleon_koko: ['קימה', 'קימו', 'קומי'],
};

const ADULT_POETIC_KILL_LIST = [
  'השקט החזיק',
  'דממה נמתחה',
  'הלילה נמס',
  'לב רוקד',
  'אור ליטף',
  'אור נושק',
  'צחוק נפל לחלל',
  'שחרור התרחב',
  'בועת שקיפות',
  'מרפדת את האוויר',
  'חצי חלום',
  'מתפוגג',
  'לחישה מתערבלת',
  'שקט נמתח',
  'שלווה נוצצת',
  'צחוק מתנחשל',
  'הלילה החזיק',
  'גשר אור',
  'גשר דק של אור',
  'כבל דק',
  'כבל אור',
  'עמק כריות',
  'מילא את החדר',
  'נעים מילא',
];

const ENDING_KILL_LIST = [
  'זוכרת את',
  'זוכר את',
  'מזכירה כמה',
  'מזכיר כמה',
  'עכשיו היא שלווה',
  'עכשיו הוא שלו',
  'כמה שלווה',
  'כמה רגוע',
  'היא הבינה',
  'הוא הבין',
  'הפחד נעלם',
  'הכול היה בסדר',
  'כמו חבר קטן מהיום ההוא',
  'מהיום ההוא',
];

export interface AgeTierGuidance {
  label: string;
  sentencesPerPage: string;
  wordsPerPage: string;
  characteristics: string[];
}

export function getAgeTier(age: number): AgeTierGuidance {
  // v0.3.5 — wider word ranges per user spec: 8-18 / 18-32 / 32-55.
  // Earlier (v0.3.4) ranges were too tight for 5-8 → stories felt skeletal.
  if (age <= 4) {
    return {
      label: 'Age 3-4',
      sentencesPerPage: '1-2',
      wordsPerPage: '8-18',
      characteristics: [
        'Very concrete physical actions only.',
        'Almost no inner thought.',
        'Short, simple sentences.',
        'Little dialogue.',
        'Quiet pages with one sound are fine.',
      ],
    };
  }
  if (age <= 6) {
    return {
      label: 'Age 5-6',
      sentencesPerPage: '2-3',
      wordsPerPage: '18-32',
      characteristics: [
        'One body reaction per page (hand closes, breath, look).',
        'One clear action plus one clear response.',
        'Short concrete sentences. No abstract metaphor.',
        'Short dialogue allowed sparingly, in quotes.',
      ],
    };
  }
  return {
    label: 'Age 7-8',
    sentencesPerPage: '3-5',
    wordsPerPage: '32-55',
    characteristics: [
      'More cause-and-effect explicit on the page.',
      'More child agency — she does things, makes choices.',
      'Short dialogue welcome.',
      'More concrete detail (texture, temperature, sound).',
      'Still NO adult-poetic language. Concrete only.',
    ],
  };
}

function formatAgeTierForPrompt(tier: AgeTierGuidance): string {
  return [
    `${tier.label}:`,
    `  - ${tier.sentencesPerPage} short sentences per page.`,
    `  - ${tier.wordsPerPage} Hebrew words per page.`,
    ...tier.characteristics.map((c) => `  - ${c}`),
  ].join('\n');
}

export function buildDraftSystemPrompt(): string {
  const allTiers = [getAgeTier(4), getAgeTier(6), getAgeTier(8)];
  return `
You are a children's book author writing in Hebrew for ages 3-8.

Your goal: write ONE simple story. Not ten beautiful page-moments.

THE LAW: SIMPLE, BUT NOT THIN. "פשוט, אבל לא דל."
Simple means easy Hebrew, concrete words. Simple does NOT mean minimal.
A page can be quiet (one short line) when the beat is quiet. Otherwise FILL it
to the age tier. An over-thin page is as bad as an over-poetic one.

═══════════════════════════════════════════════════════
5 RULES.
═══════════════════════════════════════════════════════

1. ONE moment per page.
2. Each page FOLLOWS from the previous (cause-and-effect, not montage).
3. Hebrew of a child — pitched to the age (see Age-Tier Density).
4. CATEGORY ANCHORS drive the plot — they are NOT decoration.
5. COMPANION must be irreplaceable.

═══════════════════════════════════════════════════════
🎂 AGE-TIER DENSITY (v0.3.4) — the actual page-length rule.
═══════════════════════════════════════════════════════
The user prompt will tell you the child's age. Match the density:

${allTiers.map(formatAgeTierForPrompt).join('\n\n')}

CRITICAL examples:
  Age 3-4 (OK): "נועה התכופפה. הוא נשאר סגור לרגע."
  Age 6 (TOO THIN): same two lines.
  Age 6 (RIGHT): "נועה התכופפה ליד בּוֹלִי. הוא נשאר סגור, כמו כדור קטן. נועה לא מיהרה. היא חיכתה איתו רגע."

═══════════════════════════════════════════════════════
🚫 PAGE STRUCTURE CEILING (on top of age-tier).
═══════════════════════════════════════════════════════
A page is NEVER a paragraph block. Sentences on their own lines.
Even at age 7-8: max 5 short sentences. No 60-word lumps.

═══════════════════════════════════════════════════════
⛔ FORBIDDEN — adult-poetic Hebrew.
═══════════════════════════════════════════════════════
${ADULT_POETIC_KILL_LIST.map((p) => `  ✗ ${p}`).join('\n')}

CONCRETE instead:
  Instead of "השקט החזיק את האוויר"     → "השמיכה לא זזה."
  Instead of "אור ליטף את הקיר"          → "האור היה על הקיר."

═══════════════════════════════════════════════════════
🏥 PROCEDURE MOMENT — heart of MEDICAL_PROCEDURE (v0.3.3).
═══════════════════════════════════════════════════════
If the Category Anchors include a PROCEDURE MOMENT (Bolly Adventure / Fantasy):
  - The 6 procedure beats are NON-NEGOTIABLE.
  - Each beat = its own page. Do NOT collapse them.
  - The procedure phase consumes at least 30% of total pages.
  - The narrator STAYS IN the moment of the touch. Do NOT skip.
  - Failure pattern: 4 pages walking + 1 page exam. That is a route-to-clinic
    story, not a procedure story.

═══════════════════════════════════════════════════════
🏷 NO PLANNING LABELS IN PROSE (v0.3.5).
═══════════════════════════════════════════════════════
The Category Anchors / Procedure Moment uses internal beat identifiers like
[medical-object-appears], [child-body-resists], etc.

These are PLANNING NOTES ONLY. They MUST NEVER appear in the Hebrew story prose.
Never start a page with a bracketed label. Never include any [identifier] in
the story body. The Hebrew text is pure prose only.

  ✗ "[medical-object-appears] מעליהם עמד עמוד האבן."   (BAD — label leaked)
  ✓ "מעליהם עמד עמוד האבן. קר ממנו יצא."                (GOOD — pure Hebrew)

═══════════════════════════════════════════════════════
🛑 NARRATIVE VOICE LOCK.
═══════════════════════════════════════════════════════
THIRD PERSON only. NEVER 1st-person prose verbs:
  ✗ שמעתי / ראיתי / הלכתי / הרגשתי / אמרתי / רציתי
1st-person ALLOWED only inside quoted dialogue.

═══════════════════════════════════════════════════════
⏳ TIMELINE LOCK.
═══════════════════════════════════════════════════════
If page 1-2 sets the exam in the FUTURE ("מחר"), later pages CANNOT
refer to it as past.

═══════════════════════════════════════════════════════
🌬 ENDING RULE — show, don't explain.
═══════════════════════════════════════════════════════
FORBIDDEN endings:
${ENDING_KILL_LIST.map((p) => `  ✗ ...${p}...`).join('\n')}

═══════════════════════════════════════════════════════
🪞 BODY MIRROR (see Companion Card).
═══════════════════════════════════════════════════════
At the procedure moment, the CHILD physically mirrors the companion's
mechanic. Two short lines, not a metaphor.

═══════════════════════════════════════════════════════
🚫 NO LATE INTRODUCTION of new abstract objects.
═══════════════════════════════════════════════════════
After 60% of the pages, do NOT introduce poetic objects that weren't already
in the world.

OUTPUT FORMAT — Markdown story:
\`\`\`
---
title: "..."
companionId: ...
direction: ...
childGender: ...
pages: N
---

--- Page 1 ---
[Hebrew prose — pitched to age tier]

imageDirection: [English shot direction]
\`\`\`

Hebrew in body. English in imageDirection.
`.trim();
}

function buildHardCompanionLock(companionId: MvpCompanionId): string {
  const bible = getCompanionBible(companionId);
  if (!bible) return '';

  const forbiddenAnatomy = bible.forbiddenAnatomy.length
    ? bible.forbiddenAnatomy.slice(0, 8).join(', ')
    : '(none)';
  const forbiddenObjects = bible.forbiddenObjects.length
    ? bible.forbiddenObjects.slice(0, 8).join(', ')
    : '(none)';
  const forbiddenNames = FORBIDDEN_NAME_MUTATIONS[companionId] ?? [];

  return `
⛔ COMPANION LOCK — ${bible.nameClean}

The name is EXACTLY: ${bible.nameClean}
Never write: ${forbiddenNames.join(', ')}, or any near-spelling.

Forbidden anatomy: ${forbiddenAnatomy}
Forbidden objects — DO NOT USE THESE AT ALL in the Hebrew story prose:
  ${forbiddenObjects}
`.trim();
}

const COMPANION_IDENTITY_REMINDER: Record<MvpCompanionId, string> = {
  bolly_armadillo:
    "בּוֹלִי's identity is in his shell, his טוּמְפּ, his pink-belly-inside, his בפנים היה חם. The plot moves through closing and opening — not through fighting or pushing.",
  bat_lily:
    "לִילִי's identity is in her wings, her בלילה רואים אחרת, her tiny lantern. The plot moves through gentle wrapping and a small light inside the dark.",
  chameleon_koko:
    "קִים's identity is in her striped scarf, her פששש, her הצבע מהמקום הקודם. The plot moves through carrying a color from one place to the next.",
};

export function buildDraftUserPrompt(plan: Plan, input: GenerateInput): string {
  const pageCount = resolvePageCount(input.direction, input.pageCount);
  const anchors = getCategoryAnchors(input.companionId, input.direction);
  const companionCard = formatCompanionCard(input.companionId);
  const identityReminder = COMPANION_IDENTITY_REMINDER[input.companionId];
  const ageTier = getAgeTier(input.childAge);

  const planSummary = [
    `Moment page: ${plan.momentContract.page}`,
    `Hook: ${plan.hookContract.sound ?? plan.hookContract.phrase ?? '(none)'}`,
    `Hook appears on pages: [${plan.hookContract.appearsOnPages.join(', ')}]`,
  ].join('\n');

  return [
    buildHardCompanionLock(input.companionId),
    '',
    '═══════════════ COMPANION CARD ═══════════════',
    companionCard,
    '',
    '═══════════════ CATEGORY ANCHORS ═══════════════',
    formatAnchorsForPrompt(anchors),
    '',
    '═══════════════ AGE TIER FOR THIS STORY ═══════════════',
    `Child age: ${input.childAge} → ${ageTier.label}`,
    `  Target: ${ageTier.sentencesPerPage} short sentences per page, ${ageTier.wordsPerPage} Hebrew words per page.`,
    `  Characteristics:`,
    ...ageTier.characteristics.map((c) => `    - ${c}`),
    '',
    '═══════════════ THE ORDER ═══════════════',
    `Write ${pageCount} pages of a ${input.direction} story.`,
    `Child: ${input.childName}, ${input.childGender}, age ${input.childAge}`,
    '',
    'Plan signals:',
    planSummary,
    '',
    '═══════════════ REMINDER ═══════════════',
    "Write like a great children's author. Simple. Concrete. Causal. Warm.",
    'Match the age tier density. Simple, but NOT thin.',
    identityReminder,
    '',
    'Now write the story.',
  ].join('\n');
}
