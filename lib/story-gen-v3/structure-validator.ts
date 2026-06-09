/**
 * Deterministic hard-fails for StorySpineV3 + PageBeatV3 (Phase 2).
 */

import type { PageBeatV3, StorySpineV3, StructureHardFail } from './types';

const PASSIVE_CHILD_RE =
  /^(צופה|מחכה|מרגיש|מסתכל|עומד ומסתכל|נוכח|מאפשר)/i;

const GENERIC_TEMPLATE_RE =
  /עטיפה\/החזקה מדי|הבעיה היא לא הסכנה|לשחרר|צריך מרחב|צריך אוויר|לא לסגור|דיני לומדת|דיני מבינה/i;

const ABSTRACT_VISUAL_RE =
  /אווירה|רגש|הבנה|שקט פנימי|זוהר רגשי|מראה של/i;

const UNSAFE_RE =
  /מיקרוגל פעיל|להבה|אש אמיתית|סכנת אש|ילד מפעיל מיקרוגל/i;

const GENERIC_PAGE_TURN_RE =
  /מה יקרה הלאה|נשאר לראות|האם יצליח|מה יעשה עכשיו/i;

function fieldOk(s: string | undefined, min: number): boolean {
  return typeof s === 'string' && s.trim().length >= min;
}

export function validateStorySpineV3(spine: StorySpineV3): StructureHardFail[] {
  const fails: StructureHardFail[] = [];

  if (!fieldOk(spine.childWant, 20)) {
    fails.push({ code: 'weak_child_want', message: 'childWant too short or missing' });
  }
  if (!/פופקורן|גרעין|קערה/i.test(spine.oneLineHook + spine.playSystem)) {
    fails.push({ code: 'not_popcorn_specific', message: 'Spine missing popcorn-specific anchors' });
  }
  if (GENERIC_TEMPLATE_RE.test(JSON.stringify(spine))) {
    fails.push({ code: 'generic_template', message: 'Spine contains generic Dini-wrap template language' });
  }
  if (UNSAFE_RE.test(JSON.stringify(spine))) {
    fails.push({ code: 'unsafe_tone', message: 'Spine contains unsafe kitchen/fire imagery' });
  }
  if (!fieldOk(spine.secondTryFail, 30)) {
    fails.push({ code: 'missing_second_try_fail', message: 'secondTryFail missing or too thin' });
  }
  if (!fieldOk(spine.braveChildAction, 25) || /ביחד יוצרים/i.test(spine.braveChildAction)) {
    fails.push({
      code: 'child_not_owning_climax',
      message: 'braveChildAction must be child-led (towel-sail / wind tunnel)',
    });
  }
  if (!/גשם|קשת|עוד סרט|על האף/i.test(spine.bigReleasePayoff)) {
    fails.push({ code: 'weak_payoff', message: 'bigReleasePayoff missing visible popcorn release' });
  }

  return fails;
}

export function validatePageBeatV3(beat: PageBeatV3): StructureHardFail[] {
  const fails: StructureHardFail[] = [];
  const page = beat.page;

  if (!fieldOk(beat.whatChanges, 12)) {
    fails.push({ code: 'empty_what_changes', message: 'whatChanges empty', page });
  }
  if (!fieldOk(beat.event, 12)) {
    fails.push({ code: 'empty_event', message: 'event empty or too short', page });
  }
  if (PASSIVE_CHILD_RE.test(beat.childDoes.trim()) && beat.childDoes.length < 40) {
    fails.push({ code: 'passive_child', message: 'childDoes is passive', page });
  }
  if (/רק מרגיש|רק חושב|מבין ש/i.test(beat.event) && !/\b(קופץ|נופל|מרים|מכסה|מניף|רץ|אוחז)\b/i.test(beat.childDoes)) {
    fails.push({ code: 'emotional_only_event', message: 'event is only emotional/internal', page });
  }
  if (GENERIC_PAGE_TURN_RE.test(beat.pageTurnReason)) {
    fails.push({ code: 'generic_page_turn', message: 'pageTurnReason is generic', page });
  }
  if (ABSTRACT_VISUAL_RE.test(beat.visualAnchor)) {
    fails.push({ code: 'abstract_visual', message: 'visualAnchor is abstract', page });
  }
  if (UNSAFE_RE.test(JSON.stringify(beat))) {
    fails.push({ code: 'unsafe_beat', message: 'beat contains unsafe imagery', page });
  }

  return fails;
}

export function validateAllBeatsV3(beats: PageBeatV3[]): StructureHardFail[] {
  const all: StructureHardFail[] = [];
  for (const beat of beats) {
    all.push(...validatePageBeatV3(beat));
  }
  return all;
}
