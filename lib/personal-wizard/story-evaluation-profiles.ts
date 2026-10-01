import type { ReviewedPersonalBookRequest } from './contract';

// Synthetic evaluation data only, never imported into author/editor instructions.
// held_out means reserved from creative tuning; it is not a secret-access mechanism.
const children = {
  a: { name: 'יעל', age: 3, address: 'girl', interest: 'לבנות גשרים מקוביות', habit: null, residence: 'בצפון', difficulty: null },
  b: { name: 'רועי', age: 5, address: 'boy', interest: 'לגלגל טבעות ולצייר מסלולים', habit: 'מברך כל אבן בשם אחר', residence: 'ליד גבעה', difficulty: 'מהסס כשמשהו לא מצליח' },
  c: { name: 'דניאל', age: 8, address: 'boy', interest: 'לחפש צורות בעננים', habit: null, residence: 'בעיר', difficulty: null },
  d: { name: 'מאיה', age: 6, address: 'girl', interest: 'להמציא משחקי קפיצה', habit: 'ממציאה שמות מצחיקים לכל תחנה', residence: 'ליד הים', difficulty: 'קשה לה להצטרף למשחק' },
  e: { name: 'עידו', age: 4, address: 'boy', interest: 'לסדר צדפים לפי צורות', habit: null, residence: 'ליד החוף', difficulty: 'קשה לו כשמפסיקים משחק אהוב' },
  f: { name: 'רוני', age: 7, address: 'girl', interest: 'לבנות כלי נגינה מחפצים', habit: 'בודקת איך נשמע כל דבר בנקישה קטנה', residence: 'ליד פרדס', difficulty: null },
  h: { name: 'איתן', age: 8, address: 'boy', interest: 'להמציא כתב סתרים', habit: null, residence: 'בדרום', difficulty: null },
} as const;
const matrix = [
  ['a', 'dragon_dini', 'short', null, 'development'], ['a', 'fox_uri', 'short', null, 'development'],
  ['a', 'panda_anat', 'short', null, 'development'], ['b', 'dragon_dini', 'medium', 'confidence', 'development'],
  ['b', 'chameleon_koko', 'medium', 'confidence', 'development'], ['b', 'lion_shaket', 'medium', 'confidence', 'development'],
  ['c', 'bunny_ometz', 'long', null, 'development'], ['h', 'panda_anat', 'long', null, 'held_out'],
  ['d', 'fox_uri', 'long', 'social', 'development'], ['d', 'lion_shaket', 'long', 'social', 'development'],
  ['e', 'chameleon_koko', 'short', 'transitions', 'held_out'], ['f', 'bunny_ometz', 'medium', null, 'held_out'],
] as const;

export function personalStoryEvaluationProfiles(): { id: string; split: 'development' | 'held_out'; detail: 'sparse' | 'rich'; request: ReviewedPersonalBookRequest }[] {
  return matrix.map(([childId, companionId, lengthId, topicId, split], i) => {
    const child = children[childId];
    const facts: ReviewedPersonalBookRequest['facts'] = [{ id: 'f_interest0001', kind: 'interest', value: child.interest, source: 'fixture' }];
    if (child.habit) facts.push({ id: 'f_habit0000001', kind: 'habit', value: child.habit, source: 'fixture' });
    if (child.difficulty) facts.push({ id: 'f_difficulty01', kind: 'difficulty', value: child.difficulty, source: 'fixture' });
    return { id: `synthetic_${i + 1}`, split, detail: child.habit ? 'rich' : 'sparse', request: {
      kind: 'personal_book_request', version: 'reviewed-personal-book-request/v3', draftId: `d_plannereval${String(i + 1).padStart(3, '0')}`, draftRevision: 1,
      child: { name: child.name, age: child.age, address: child.address, residence: child.residence,
        nameSource: 'fixture', ageSource: 'fixture', addressSource: 'fixture', residenceSource: 'fixture' },
      facts, noDifficulty: !child.difficulty, storyPlace: null, companion: { id: companionId },
      intent: topicId ? { kind: 'topic', topicId } : { kind: 'just_for_fun' }, avoid: ['מלחמה'],
      appearance: { photo: 'none' }, bookOptions: { lengthId, voiceId: null },
    } };
  });
}
