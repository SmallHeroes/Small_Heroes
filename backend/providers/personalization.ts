import 'server-only';

import type { Order } from '@prisma/client';
import type { CharacterAnchorsWizardMeta } from '../../lib/orderMeta';
import { callLLM } from './pipeline';
import { getDeepProfile } from '../../lib/companion-deep-profiles';

/** `{{patch:name|sourceField|instruction|optionalFallback}}` — optional spaces allowed around `|` */
const PATCH_REGEX = /\{\{\s*patch\s*:\s*([^|{}]+?)\s*\|\s*([^|{}]+?)\s*\|\s*([^|{}]+?)(?:\s*\|\s*([^}]+?))?\s*\}\}/gi;

export interface PatchContext {
  childName: string;
  childAge: number;
  childGender: 'boy' | 'girl' | 'other';
  categoryAnswers: Record<string, { selectedQuickAnswers?: string[]; answer?: string }>;
  difficulties: string[];
  helpers: string[];
  goals: string[];
  avoid: string[];
  superpower: string[];
}

export interface LetterContext extends PatchContext {
  companionId: string;
  companionName: string;
  direction: 'bedtime' | 'adventure' | 'fantasy';
  category: string;
}

function trimToken(s: string): string {
  return s.replace(/^\s+|\s+$/g, '');
}

function stripChipEmoji(chip: string): string {
  return chip.replace(/^[\s\uFEFF]*(?:[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F9FF}]+[\s\uFEFF]*)+/u, '').trim();
}

function splitSuperpower(raw: string | null | undefined): string[] {
  if (!raw || !String(raw).trim()) return [];
  return String(raw)
    .split(/\s*\|\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeGender(g: string | null | undefined): 'boy' | 'girl' | 'other' {
  const v = (g || '').toLowerCase();
  if (v === 'girl' || v === 'female' || v === 'bat') return 'girl';
  if (v === 'boy' || v === 'male' || v === 'ben') return 'boy';
  return 'other';
}

/** Build category answer map keyed by `questionId` (preferred). */
function categoryAnswersToRecord(
  meta: CharacterAnchorsWizardMeta
): Record<string, { selectedQuickAnswers?: string[]; answer?: string }> {
  const out: Record<string, { selectedQuickAnswers?: string[]; answer?: string }> = {};
  for (const row of meta.categoryAnswers ?? []) {
    const key = row.questionId?.trim();
    if (!key) continue;
    out[key] = {
      ...(row.selectedQuickAnswers?.length ? { selectedQuickAnswers: row.selectedQuickAnswers } : {}),
      ...(row.answer?.trim() ? { answer: row.answer.trim() } : {}),
    };
  }
  return out;
}

export function buildPatchContextFromOrder(
  order: Pick<
    Order,
    | 'childName'
    | 'childAge'
    | 'childGender'
    | 'challengeItems'
    | 'helperItems'
    | 'outcomeItems'
    | 'avoidItems'
    | 'childSuperpower'
  >,
  wizardMeta: CharacterAnchorsWizardMeta
): PatchContext {
  return {
    childName: order.childName || '',
    childAge: order.childAge ?? 0,
    childGender: normalizeGender(order.childGender),
    categoryAnswers: categoryAnswersToRecord(wizardMeta),
    difficulties: [...(order.challengeItems ?? [])],
    helpers: [...(order.helperItems ?? [])],
    goals: [...(order.outcomeItems ?? [])],
    avoid: [...(order.avoidItems ?? [])],
    superpower: splitSuperpower(order.childSuperpower),
  };
}

export function buildLetterContextFromOrder(
  order: Pick<
    Order,
    | 'childName'
    | 'childAge'
    | 'childGender'
    | 'challengeItems'
    | 'helperItems'
    | 'outcomeItems'
    | 'avoidItems'
    | 'childSuperpower'
    | 'topic'
    | 'storyDirection'
    | 'storyLength'
  >,
  wizardMeta: CharacterAnchorsWizardMeta,
  companion: { id: string; name: string }
): LetterContext {
  const base = buildPatchContextFromOrder(order, wizardMeta);
  const dirRaw = (order.storyDirection || '').toLowerCase();
  const direction: 'bedtime' | 'adventure' | 'fantasy' =
    dirRaw === 'bedtime' || dirRaw === 'adventure' || dirRaw === 'fantasy'
      ? dirRaw
      : order.storyLength === 'short'
        ? 'bedtime'
        : order.storyLength === 'long'
          ? 'fantasy'
          : 'adventure';
  return {
    ...base,
    companionId: companion.id,
    companionName: companion.name,
    direction,
    category: wizardMeta.challengeCategory || order.topic || 'OTHER',
  };
}

export function resolveSourceField(field: string, ctx: PatchContext): string | null {
  const f = field.trim();
  if (f === 'child_name') return ctx.childName || null;
  if (f === 'child_age') return ctx.childAge != null ? String(ctx.childAge) : null;
  if (f === 'child_gender') return ctx.childGender || null;

  if (f === 'difficulties') return ctx.difficulties[0] ? stripChipEmoji(ctx.difficulties[0]) : null;
  if (f === 'helpers') return ctx.helpers[0] ? stripChipEmoji(ctx.helpers[0]) : null;
  if (f === 'goals') return ctx.goals[0] ? stripChipEmoji(ctx.goals[0]) : null;
  if (f === 'avoid') return ctx.avoid[0] ? stripChipEmoji(ctx.avoid[0]) : null;
  if (f === 'superpower') return ctx.superpower[0] ? stripChipEmoji(ctx.superpower[0]) : null;

  const answer = ctx.categoryAnswers?.[f];
  if (answer?.selectedQuickAnswers?.length) {
    return stripChipEmoji(answer.selectedQuickAnswers[0]);
  }
  if (answer?.answer) return answer.answer.trim() || null;

  return null;
}

/** Apply all `{{patch:…}}` slots in one string. One LLM call per distinct match text (parallel). */
export async function applyPersonalizationPatches(storyText: string, ctx: PatchContext): Promise<string> {
  const matches = [...storyText.matchAll(new RegExp(PATCH_REGEX.source, PATCH_REGEX.flags))];
  if (matches.length === 0) return storyText;

  const resolutions = await Promise.all(
    matches.map(async (match) => {
      const full = match[0];
      const name = trimToken(match[1] || '');
      const sourceField = trimToken(match[2] || '');
      const description = trimToken(match[3] || '');
      const fallbackRaw = match[4] != null ? trimToken(match[4]) : undefined;
      const fallback = fallbackRaw;

      const t0 = Date.now();
      const value = resolveSourceField(sourceField, ctx);

      if (!value) {
        const repl = fallback ?? '';
        console.info(
          `[personalization] patch=${name} source=${sourceField} value=<empty> → "${repl.slice(0, 80)}${repl.length > 80 ? '…' : ''}" (${Date.now() - t0}ms) [fallback-only]`
        );
        return { full, replacement: repl };
      }

      const prompt = `Fill a single Hebrew slot in a children's storybook page.
Slot description: ${description}
The parent's selection from the wizard: "${value}"
Constraints:
- Output ONLY the Hebrew phrase that fills the slot, with full nikud.
- 1-5 Hebrew words.
- No commentary, no quotes, no English, no emoji.
- The phrase must flow grammatically into the surrounding sentence.
- Use the parent's selection as the source of truth.
- If the selection begins with emoji or decorative symbols, ignore them for meaning.`;

      try {
        const { text: rawOut } = await callLLM(
          "You fill Hebrew slots in children's storybook pages. Output only the Hebrew phrase with full nikud. No commentary.",
          prompt,
          60,
          0.3,
          'PersonalizationPatch',
          false
        );
        const replacement = (rawOut || '').trim() || fallback?.trim() || value;
        console.info(
          `[personalization] patch=${name} source=${sourceField} value="${value.slice(0, 60)}${value.length > 60 ? '…' : ''}" → "${replacement.slice(0, 80)}${replacement.length > 80 ? '…' : ''}" (${Date.now() - t0}ms)`
        );
        return { full, replacement };
      } catch (err) {
        console.warn(`[personalization] patch=${name} LLM failed, using fallback`, err);
        const replacement = fallback?.trim() || value;
        console.info(
          `[personalization] patch=${name} source=${sourceField} value="${value.slice(0, 40)}…" → "${replacement.slice(0, 80)}…" (${Date.now() - t0}ms) [error-fallback]`
        );
        return { full, replacement };
      }
    })
  );

  let result = storyText;
  for (const { full, replacement } of resolutions) {
    result = result.split(full).join(replacement);
  }
  return result;
}

export async function generateCompanionLetter(ctx: LetterContext): Promise<{ text: string }> {
  const profile = getDeepProfile(ctx.companionId);

  const childRef = ctx.childGender === 'girl' ? 'הִיא' : ctx.childGender === 'boy' ? 'הוּא' : 'הֵם';
  const childFor = ctx.childGender === 'girl' ? 'לָהּ' : ctx.childGender === 'boy' ? 'לוֹ' : 'לָהֶם';

  const difficultiesLine = ctx.difficulties.map(stripChipEmoji).filter(Boolean).slice(0, 2).join(', ');
  const helpersLine = ctx.helpers.map(stripChipEmoji).filter(Boolean).slice(0, 2).join(', ');
  const goalsLine = ctx.goals.map(stripChipEmoji).filter(Boolean).slice(0, 1).join(', ');
  const superpowerLine = ctx.superpower.map(stripChipEmoji).filter(Boolean).slice(0, 1).join(', ');

  const prompt = `Write a short personal letter, in Hebrew with full nikud, from the companion ${ctx.companionName} to the child ${ctx.childName} (age ${ctx.childAge}).

The letter appears on a single page near the end of an illustrated children's storybook. It must feel like the companion speaking aloud, NOT a generic note.

CONSTRAINTS:
- 4 to 6 sentences. Maximum 50 Hebrew words.
- Full nikud on every word.
- Must use the companion's distinct speech pattern: ${profile.speechPattern}
- Speech style examples to match: ${profile.speechExamples.join(' / ') || '(none)'}
- Must NOT explicitly say words like "אח", "אחות", "אהבה", or moralize. No therapy talk.
- Must NOT say "אתה אמיץ" or "אתה גדול". No bravery framing.
- Begin with the child's name vocatively. Address them directly.
- Gender reference for the child in third person (when needed): third=${childRef}, "for them"=${childFor}

WHAT THE CHILD IS GOING THROUGH (use as raw material, not literally):
- Difficulties: ${difficultiesLine || 'general challenges'}
- What helps them feel whole: ${helpersLine || '—'}
- The strength they have: ${superpowerLine || '—'}
- Where this story wants to lead: ${goalsLine || '—'}

THE LETTER MUST INCLUDE:
1. A tiny specific physical/sensory image (something the companion does or feels — using the companion's sensory world: ${profile.sensoryWorld.join(', ')}).
2. One reference to something the child is going through, in NON-LITERAL terms.
3. One promise of presence — that the companion will be there in some specific way.
4. End on a gentle, concrete, slightly open note. NOT a closure.

OUTPUT FORMAT:
Output ONLY the Hebrew text of the letter, line-broken naturally. No quotes around it. No commentary. No translations.`;

  const { text } = await callLLM(
    "You write personal Hebrew letters from a companion character to a child, with full nikud, in the companion's distinct voice. You output only the letter text — nothing else.",
    prompt,
    250,
    0.7,
    'CompanionLetter',
    false
  );

  return { text: (text || '').trim() };
}
