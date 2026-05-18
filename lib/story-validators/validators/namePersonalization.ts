import type { StoryDirection, StoryPageCount, StoryValidator } from '../types';
import { finding, normalizeForMatch } from '../utils';

const NAME_RANGES: Record<StoryDirection, Record<StoryPageCount, [number, number]>> = {
  bedtime: { 10: [3, 6], 15: [4, 7], 20: [5, 8] },
  adventure: { 10: [4, 7], 15: [5, 8], 20: [6, 10] },
  fantasy: { 10: [4, 7], 15: [6, 9], 20: [6, 10] },
};

const SUBJECT_VERBS = [
  'הלך',
  'הלכה',
  'רץ',
  'רצה',
  'אמר',
  'אמרה',
  'לחש',
  'לחשה',
  'נשם',
  'נשמה',
  'חיבק',
  'חיבקה',
  'פתח',
  'פתחה',
  'סגר',
  'סגרה',
  'הסתכל',
  'הסתכלה',
  'שמע',
  'שמעה',
];

/** WARNING: child name occurrence count and subject-role verbs. */
export const namePersonalizationValidator: StoryValidator = {
  id: 'namePersonalization',
  run({ parsed, input }) {
    const findings = [];
    const name = input.context.childName.trim();
    if (!name) return [finding('namePersonalization', 'WARNING', 'childName ריק')];

    const full = parsed.pages.map((p) => p.text).join('\n');
    const count = (full.match(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
    const range = NAME_RANGES[input.context.direction][input.context.pageCount] ?? [3, 8];

    if (count < range[0] || count > range[1]) {
      findings.push(
        finding(
          'namePersonalization',
          'WARNING',
          `שם הילד "${name}" מופיע ${count} פעמים — טווח מומלץ ${range[0]}-${range[1]}`
        )
      );
    }

    let subjectHits = 0;
    const lines = full.split(/[.!?\n]/);
    for (const line of lines) {
      if (!line.includes(name)) continue;
      if (SUBJECT_VERBS.some((v) => line.includes(v))) subjectHits++;
    }
    if (subjectHits < 3) {
      findings.push(
        finding(
          'namePersonalization',
          'WARNING',
          `שם הילד כנושא פועל רק ~${subjectHits} פעמים — מומלץ לפחות 3`
        )
      );
    }

    return findings;
  },
};
