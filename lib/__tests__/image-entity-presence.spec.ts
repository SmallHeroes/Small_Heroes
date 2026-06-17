import { describe, expect, it } from 'vitest';

import { getCompanionById } from '../companions';
import {
  assertCompanionPresenceConsistency,
  CompanionPresenceConflictError,
  derivePageEntityPresence,
  tokenMentionedPositively,
} from '../image-entity-presence';
import { assembleStyle01Phase2Prompt } from '../style01-prompt-assembly';

describe('derivePageEntityPresence chameleon_koko', () => {
  it('honors explicit companionPresence: present when Kim is named (koko fantasy p2)', () => {
    const contract = derivePageEntityPresence({
      companionId: 'chameleon_koko',
      companionName: 'הזיקית קִים',
      imageDirection:
        'Kim steps out from behind a low stone with a mustard satchel. companionPresence: present. view: front 3-4.',
      bookPageText: 'קים יצאה מהצל. זיקית קטנה, עם תיק צד חרדלי.',
    });
    expect(contract.companionPresence).toBe('present');
    expect(contract.forbiddenEntities).not.toContain('companion creature');
  });

  it('explicit companionPresence: present wins over missing name tokens (koko fantasy p5)', () => {
    const contract = derivePageEntityPresence({
      companionId: 'chameleon_koko',
      companionName: 'הזיקית קִים',
      imageDirection:
        'Kim tries to match the gate color. companionPresence: present. view: close 3-4.',
      bookPageText: 'קים הרימה אצבע קטנה.',
    });
    expect(contract.companionPresence).toBe('present');
  });

  it('matches קים in Hebrew text with niqqud stripped (heuristic fallback)', () => {
    const contract = derivePageEntityPresence({
      companionId: 'chameleon_koko',
      companionName: 'הזיקית קִים',
      imageDirection: 'Morning path, child walks slowly.',
      bookPageText: 'קים יצאה מהצל.',
    });
    expect(contract.companionPresence).toBe('present');
  });
});

describe('assertCompanionPresenceConsistency explicit token', () => {
  it('throws when explicit present conflicts with resolved absent', () => {
    expect(() =>
      assertCompanionPresenceConsistency({
        pageNumber: 2,
        imageDirection: 'Kim on stone. companionPresence: present.',
        companionPresence: 'absent',
        companionName: 'הזיקית קִים',
        companionId: 'chameleon_koko',
      })
    ).toThrow(CompanionPresenceConflictError);
  });
});

describe('derivePageEntityPresence lion_shaket', () => {
  it('detects Leo in English imageDirection when Hebrew text omits the name (p4 swallow beat)', () => {
    const contract = derivePageEntityPresence({
      companionId: 'lion_shaket',
      companionName: 'האריה ליאו',
      imageDirection:
        'The child pulls the blanket up to the nose, trying to hide the feeling. Leo watches quietly beside, concerned but gentle.',
      bookPageText:
        'נועם משך את השמיכה עד האף. אולי אם לא יראו את הכעס, הוא ילך לבד.',
    });
    expect(contract.companionPresence).toBe('present');
  });

  it('keeps companion absent when imageDirection negates presence (Leo not present yet)', () => {
    const contract = derivePageEntityPresence({
      companionId: 'lion_shaket',
      companionName: 'האריה ליאו',
      imageDirection:
        'Night bedroom. The child sits beside a collapsed pillow-cave. Leo not present yet. companionPresence: absent.',
      bookPageText: 'כבר היה לילה.',
    });
    expect(contract.companionPresence).toBe('absent');
  });

  it('keeps companion absent when neither imageDirection nor text names the companion', () => {
    const contract = derivePageEntityPresence({
      companionId: 'lion_shaket',
      companionName: 'האריה ליאו',
      imageDirection: 'Night bedroom, warm lamp. The child sits alone on the bed, frustrated.',
      bookPageText: 'כבר היה לילה.',
    });
    expect(contract.companionPresence).toBe('absent');
  });
});

describe('tokenMentionedPositively', () => {
  it('ignores negated companion phrases', () => {
    expect(tokenMentionedPositively('no scary lion in the scene', 'lion')).toBe(false);
    expect(tokenMentionedPositively('Leo not present yet', 'leo')).toBe(false);
    expect(tokenMentionedPositively('without Leo in frame', 'leo')).toBe(false);
  });

  it('accepts positive companion action phrases', () => {
    expect(tokenMentionedPositively('Leo watches quietly beside the child', 'leo')).toBe(true);
    expect(tokenMentionedPositively('ליאו (Leo) watches quietly beside', 'ליאו')).toBe(true);
  });
});

describe('assertCompanionPresenceConsistency', () => {
  it('throws when presence is absent but imageDirection positively names the companion', () => {
    expect(() =>
      assertCompanionPresenceConsistency({
        pageNumber: 4,
        imageDirection: 'Leo watches quietly beside the child.',
        companionPresence: 'absent',
        companionName: 'האריה ליאו',
        companionId: 'lion_shaket',
      })
    ).toThrow(CompanionPresenceConflictError);

    try {
      assertCompanionPresenceConsistency({
        pageNumber: 4,
        imageDirection: 'Leo watches quietly beside the child.',
        companionPresence: 'absent',
        companionName: 'האריה ליאו',
        companionId: 'lion_shaket',
      });
    } catch (err) {
      expect(err).toBeInstanceOf(CompanionPresenceConflictError);
      expect((err as Error).message).toMatch(/COMPANION_PRESENCE_CONFLICT page 4/);
      expect((err as Error).message).toMatch(/Leo/i);
    }
  });

  it('does not throw when negated mention keeps companion absent', () => {
    expect(() =>
      assertCompanionPresenceConsistency({
        pageNumber: 1,
        imageDirection: 'Leo not present yet.',
        companionPresence: 'absent',
        companionName: 'האריה ליאו',
        companionId: 'lion_shaket',
      })
    ).not.toThrow();
  });
});

describe('lion_shaket_bedtime p4 assembly', () => {
  it('assembles with companion present and no forbidden sidekick conflict', () => {
    const companion = getCompanionById('lion_shaket');
    expect(companion).toBeTruthy();

    const imageDirection =
      "The child pulls the blanket up to the nose, trying to hide the feeling. The blanket looks heavy, the child's body still tense underneath. ליאו (Leo) watches quietly beside, concerned but gentle. Warm dim readable light. companionPresence: present; view: medium/3-4.";

    const { prompt, entityPresence } = assembleStyle01Phase2Prompt({
      pageNumber: 4,
      rawScenePrompt: imageDirection,
      bookPageText:
        'נועם משך את השמיכה עד האף. אולי אם לא יראו את הכעס, הוא ילך לבד.',
      childFirstName: 'נועם',
      childAge: 5,
      childGender: 'boy',
      companion: companion!,
      storyFile: 'lion_shaket_bedtime.md',
      direction: 'bedtime',
      storyTimeOfDay: 'night',
    });

    expect(entityPresence.companionPresence).toBe('present');
    expect(prompt).toMatch(/companionPresence:\s*present/i);
    expect(prompt).not.toMatch(/FORBIDDEN:.*sidekick animal/i);
  });
});
