import { getCompanionBible } from '@/lib/companion-bible';
import type { GenerateInput, Plan, MvpCompanionId } from '../types';
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
5. Hook tokens from hookContract MUST appear verbatim on each declared page (do not paraphrase).
6. Moment on momentContract.page with physicalAction — not internal lesson.
7. Hebrew in page body; English only in imageDirection lines.

${KILL_PHRASES_BLOCK}

${MARKDOWN_FORMAT_RULES}

${KID_FIRST_PRINCIPLES}
`.trim();
}

/**
 * v0.2: Builds a HARD COMPANION LOCK block from the bible.
 * This sits AT THE TOP of the user message — repeated content the model sees first.
 * Prior batches showed forbidden items leaking (פנס/מגן/כוכב for Bolly, נוצות for Lily)
 * because forbidden lists were buried in the larger companion card. Front-loading
 * with a punitive framing makes the model treat these as a hard wall.
 */
/** Per-companion known-wrong names — the LLM must NEVER produce these. */
const FORBIDDEN_NAME_MUTATIONS: Record<MvpCompanionId, string[]> = {
  bolly_armadillo: ['שולי', 'בולו', 'בולא', 'בולה', 'בובו', 'בובה'],
  bat_lily: ['ליליל', 'ליליה', 'לילית', 'לִיללִי'],
  chameleon_koko: ['קימה', 'קימו', 'קומי'],
};

function buildHardCompanionLock(companionId: MvpCompanionId): string {
  const bible = getCompanionBible(companionId);
  if (!bible) return '';

  const forbiddenAnatomy = bible.forbiddenAnatomy.length
    ? bible.forbiddenAnatomy.join(', ')
    : '(none)';
  const forbiddenObjects = bible.forbiddenObjects.length
    ? bible.forbiddenObjects.join(', ')
    : '(none)';
  const forbiddenTone = bible.forbiddenTone.length ? bible.forbiddenTone.join(', ') : '(none)';
  const forbiddenNames = FORBIDDEN_NAME_MUTATIONS[companionId] ?? [];

  return `
========================================
⛔ CANONICAL COMPANION NAME LOCK
========================================
The companion's name is EXACTLY: ${bible.nameClean}
(Also acceptable: ${bible.canonicalName})

NEVER write any of these mutations:
${forbiddenNames.map((n) => `  ✗ ${n}`).join('\n')}
  ✗ any other near-spelling

Every page where the companion appears: use ${bible.nameClean} exactly,
or pronoun (הוא/היא/הם/הן) only AFTER the canonical name has appeared on the same page.

If you invent or mutate the name, the story FAILS and is rejected.

========================================
⛔ HARD COMPANION LOCK — ${bible.nameClean}
========================================
The following are FORBIDDEN in story prose. If ANY appears verbatim or as a clear
literal use (not metaphor with "כמו"), the story FAILS validation and is rejected.

Forbidden anatomy: ${forbiddenAnatomy}
Forbidden objects: ${forbiddenObjects}
Forbidden tone (do not write these styles): ${forbiddenTone}

You may use these as PURE SIMILES only ("X כמו Y") — never as literal description of
${bible.nameClean} or as physical objects in the story.

If you find yourself reaching for any forbidden item, STOP and choose a different beat.
========================================
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
    buildHardCompanionLock(input.companionId),
    '',
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
