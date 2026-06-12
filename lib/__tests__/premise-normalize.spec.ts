import { describe, expect, it } from 'vitest';

import { MVP_STORY_MATRIX } from '../../backend/config/mvp-story-matrix';
import {
  CREATIVE_PREMISE_FIELDS,
  hasDiniCollapseResidue,
  missingCreativePremiseFields,
  normalizePremiseCandidate,
} from '../story-gen-v3/premise-normalize';
import { validatePremiseHardFails } from '../story-gen-v3/premise-validator';
import type { StoryPremiseCandidate } from '../story-gen-v3/types';

function rawWithCreativeFields(
  companionId: string,
  engine: string,
  wrong: string,
  escalation: string,
  discovery: string
): StoryPremiseCandidate {
  return normalizePremiseCandidate(
    {
      id: `${companionId}_test`,
      oneLineHook: 'פתיחה מצחיקה עם חפץ פיזי בלילה',
      openingWeirdEvent: 'משהו זז בחצר בלילה',
      childWant: 'לגלות מה זה בלי לברוח',
      playSystem: 'בדיקת צל עם פנס קטן',
      companionComicEngineUsed: engine,
      companionWrongHelp: wrong,
      escalation,
      childDiscovery: discovery,
      firstTry: 'ניסיון ראשון קטן',
      whyFirstTryFails: 'נכשל כי הגזימו',
      funnyFailureImage: 'תמונה מצחיקה של בלאגן פיזי קטן',
      bigReleasePayoff: 'שניהם צוחקים כשהאמת נחשפת',
      whyNotTherapeuticFable: 'זה סיפור על חפץ וצל — לא שיעור על פחד',
      whyNotGoldenCopy: 'אובייקט ומקום שונים מהגולדן',
    },
    'TEST_THEME',
    companionId
  );
}

describe('premise-normalize fail-closed', () => {
  it('throws on unknown companionId (no Dini fallback)', () => {
    expect(() =>
      normalizePremiseCandidate({ id: 'x' }, 'theme', 'unknown_companion')
    ).toThrow(/unknown companionId/);
  });

  it('does not back-fill creative fields from defaults', () => {
    const c = normalizePremiseCandidate(
      { id: 'uri_premise_x', oneLineHook: 'hook', openingWeirdEvent: 'open' },
      'NIGHT_FEAR',
      'fox_uri'
    );
    expect(c.companionComicEngineUsed).toBe('');
    expect(c.escalation).toBe('');
    expect(c.childDiscovery).toBe('');
    expect(missingCreativePremiseFields(c)).toEqual([...CREATIVE_PREMISE_FIELDS]);
  });

  it('hard-fails missing creative fields with explicit gate code', () => {
    const c = normalizePremiseCandidate(
      {
        id: 'uri_premise_x',
        oneLineHook: 'hook enough text',
        openingWeirdEvent: 'open weird',
      },
      'NIGHT_FEAR',
      'fox_uri'
    );
    const fails = validatePremiseHardFails(c);
    expect(fails.some((f) => f.code === 'missing_creative_fields')).toBe(true);
  });

  it('all 6 MVP matrix companions normalize without Dini collapse residue', () => {
    const engines: Record<string, { engine: string; wrong: string; esc: string; disc: string }> = {
      fox_uri: {
        engine: 'פנס מתכווץ כשאורי מדבר גדול מדי על צל',
        wrong: 'אורי מתקרב מהר מדי עם שם דרמטי לצל',
        esc: 'הפנס מהבהב והזנב מתחבא',
        disc: 'מי שמקשיב שומע שהרעש מהחלון',
      },
      panda_anat: {
        engine: 'עֲנָת שוקעת בחול בזמן שמדברת על רוגע',
        wrong: 'עֲנָת מדברת עם הדלי במקום עם הילד',
        esc: 'הברכיים מצביעות על עוד הצבעה',
        disc: 'הילד רואה עלה שמחכה לתור',
      },
      bunny_ometz: {
        engine: 'אוזניים זקפו לפני המילים האמיצות',
        wrong: 'בוּנִי מתרגל משפט אמיץ הפוך',
        esc: 'יותר תרחישים בראש — לא שקר מרגיע',
        disc: 'הילד בוחר משפט אמת קטן',
      },
      dragon_dini: {
        engine: 'דִּינִי מסדרת כנף כמגן על בובה קטנה',
        wrong: 'דִּינִי סוגרת את הבובה בקן רך מדי',
        esc: 'הכנף מכסה יותר מדי את המרפסת',
        disc: 'הילד מוצא פער קטן ליד הבובה',
      },
      chameleon_koko: {
        engine: 'קִים משנה צבע לפני המילים',
        wrong: 'קִים מתחבאת על התיק בזמן הלא נכון',
        esc: 'יותר פסים ופחות ברור איפה היא',
        disc: 'הילד שם לב לסימן פיזי קטן',
      },
      lion_shaket: {
        engine: 'הזנב מכה כשלֵיוֹ מנסה ללחוש',
        wrong: 'לֵיוֹ מכריז שקט בקול רועש',
        esc: 'יותר משקל לקול — לא רק הסלמה',
        disc: 'הילד מגלה ציוץ קטן שעובד',
      },
    };

    for (const category of Object.keys(MVP_STORY_MATRIX) as (keyof typeof MVP_STORY_MATRIX)[]) {
      const companionId = MVP_STORY_MATRIX[category].companionId;
      const e = engines[companionId];
      const c = rawWithCreativeFields(companionId, e.engine, e.wrong, e.esc, e.disc);
      expect(missingCreativePremiseFields(c)).toEqual([]);
      expect(hasDiniCollapseResidue(c)).toBe(false);
      if (companionId !== 'dragon_dini') {
        expect(c.companionComicEngineUsed).not.toMatch(/הגנה דרקונית|העטיפה\/החזקה/);
      }
    }
  });
});
