import type { ReviewedPersonalBookRequest } from '../lib/personal-wizard/contract';

/** Experiment fixtures, NOT plot templates or new companion/topic associations. */
export function companionTrialCohort() {
  const rows = [
    ['נטע', 4, 'girl', 'בחיפה', 'fox_uri', 'short', 'confidence', 'למצוא דברים מוסתרים באיורים', 'מצביעה על פרט קטן לפני שהיא אומרת מה היא חושבת', 'מהססת להציע רעיון כשאחרים מסתכלים עליה', 'בגינה ציבורית'],
    ['תום', 6, 'boy', 'בבאר שבע', 'dragon_dini', 'medium', 'transitions', 'לקפל מטוסי נייר ולנסות איך הם עפים', 'מתבונן מאיזה כיוון העלים זזים לפני שהוא משחרר מטוס', 'קשה לו כשסדר התוכנית משתנה ברגע האחרון', null],
    ['אלמה', 8, 'girl', 'ברמת גן', 'panda_anat', 'long', 'anger', 'לצייר קומיקס בלי מילים', 'מסתכלת שוב על הפרט האחרון כשמשהו לא מסתדר', 'מתרגזת כשמשנים כללי משחק בלי להודיע', 'בחנות משחקים'],
    ['יואב', 5, 'boy', 'ביישוב ליד ירושלים', 'chameleon_koko', 'short', null, 'להכין ציורים מחלקי נייר קרועים', 'מחפש שתי דרכים לסדר את אותם חלקים', null, null],
    ['שירה', 7, 'girl', 'בעכו', 'lion_shaket', 'medium', 'sensitivity', 'לבנות ערים קטנות מקופסאות', 'בודקת מה יש מאחורי כל פתח לפני שהיא ממשיכה', 'קשה לה כשכמה אנשים מדברים יחד', 'בגינת משחקים'],
    ['גיל', 6, 'boy', 'באשדוד', 'bunny_ometz', 'long', 'social', 'להרכיב דברים מחלקים שהתפרקו', 'בודק אם חלק מסתובב לפני שהוא מחבר אותו', 'מהסס להצטרף כשלא ברור מה התפקיד שלו', null],
  ] as const;
  return rows.map(([name, age, address, residence, companion, lengthId, topic, interest, habit, difficulty, place], index) => {
    const id = `case${index + 1}`;
    const request: ReviewedPersonalBookRequest = {
      kind: 'personal_book_request', version: 'reviewed-personal-book-request/v3', draftId: `d_companiontrial0${index + 1}`, draftRevision: 1,
      child: { name, age, address, residence, nameSource: 'fixture', ageSource: 'fixture', addressSource: 'fixture', residenceSource: 'fixture' },
      facts: [{ id: `f_trial0${index + 1}interest`, kind: 'interest', value: interest, source: 'fixture' },
        { id: `f_trial0${index + 1}habit000`, kind: 'other', value: habit, source: 'fixture' },
        ...(difficulty ? [{ id: `f_trial0${index + 1}difficulty`, kind: 'difficulty' as const, value: difficulty, source: 'fixture' as const }] : [])],
      noDifficulty: !difficulty, storyPlace: place ? { value: place, source: 'fixture' } : null,
      companion: { id: companion }, intent: topic ? { kind: 'topic', topicId: topic, suggestedBy: 'fixture', basis: 'difficulty' } : { kind: 'just_for_fun' },
      avoid: [], appearance: { photo: 'none' }, bookOptions: { lengthId, voiceId: null },
    };
    return { id, request };
  });
}
