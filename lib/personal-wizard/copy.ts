/**
 * Hebrew copy for the personal Wizard prototype. Inflection follows the grammatical address the
 * parent chose or used when talking about the child, never the child's name or photo.
 */
import type { FactKind, GrammaticalAddress } from './contract';
import type { FactGroupId } from './draft';
import type { LiveIntakeError } from './intake-live-client';
import type { RecorderErrorKind, StopReason } from './recorder';

export function g(address: GrammaticalAddress | null, boy: string, girl: string): string {
  return address === 'girl' ? girl : boy;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export const STEP_NAMES = ['היכרות', 'חבר והרפתקה', 'מראה וקול', 'הספר'] as const;

export const COMMON = {
  prototypeBadge: 'אבטיפוס',
  draftNotice: 'הפרטים נשמרים רק בחלון הזה. רענון או סגירה ימחקו אותם.',
  stepOf: (step: number) => `שלב ${step} מתוך ${STEP_NAMES.length}`,
  back: 'חזרה',
  next: 'להמשיך',
  backToSummary: 'חזרה לסיכום',
  edit: 'עריכה',
  remove: 'הסרה',
  save: 'שמירה',
  cancel: 'ביטול',
  add: 'הוספה',
};

/** The child's basics (name, age, grammatical address, residence), asked in the details card. */
export const HERO = {
  nameLabel: 'השם שיופיע בספר',
  namePlaceholder: 'למשל: בר',
  nameRow: (name: string) => `שם: ${name}`,
  ageLabel: (address: GrammaticalAddress | null) => (address ? g(address, 'בן כמה?', 'בת כמה?') : 'בן או בת כמה?'),
  ageRow: (age: number) => `גיל: ${age}`,
  ageHint: 'האבטיפוס בנוי לגילי 3 עד 8.',
  addressLabel: (name: string) => (name ? `איך לפנות ל${name} בסיפור?` : 'איך לפנות בסיפור?'),
  addressBoy: 'בלשון זכר',
  addressGirl: 'בלשון נקבה',
  addressRow: (address: GrammaticalAddress) => `פנייה: ${address === 'girl' ? 'בלשון נקבה' : 'בלשון זכר'}`,
  addressHint: 'נכתוב את הסיפור בלשון הזו. לא נסיק אותה מהשם.',
  residenceLabel: (name: string, address: GrammaticalAddress | null) =>
    name && address ? `איפה ${name} ${g(address, 'גר', 'גרה')}?` : 'איפה גרים?',
  residencePlaceholder: 'למשל: חיפה, קיבוץ עין גדי',
  residenceRow: (value: string) => `מקום מגורים: ${value}`,
  residenceHint: 'המקום שבו גרים. ההרפתקה יכולה להתחיל במקום אחר.',
  errors: {
    child_name_missing: 'צריך שם לספר',
    child_name_invalid: 'אפשר להשתמש באותיות, רווח, גרש או מקף',
    child_age_missing: 'בחרו גיל',
    child_address_missing: 'בחרו איך לפנות בסיפור',
    child_residence_missing: 'כתבו איפה גרים',
  },
};

/** What the child loves (picked or typed; a recording proposes them too). */
export const LOVES_CHIPS = [
  { id: 'ball', label: 'כדור' },
  { id: 'crafts', label: 'יצירה' },
  { id: 'building', label: 'בנייה' },
  { id: 'music', label: 'מוזיקה' },
  { id: 'animals', label: 'בעלי חיים' },
  { id: 'outdoor', label: 'משחק בחוץ' },
  { id: 'dance', label: 'ריקוד' },
  { id: 'stories', label: 'סיפורים' },
] as const;

/** "What is hard" chips are the story topics: picking one also proposes it as the direction. */
export const hardChipId = (topicId: string) => `hard_${topicId}`;

/** The five must-haves, as short cues shown while recording and next to the writing box. */
export const MUST_HAVE_CUES = ['שם', 'גיל', 'איפה גרים', 'מה אוהבים', 'מה קשה'] as const;

/**
 * The voice-first step: the parent talks (or picks, or writes) first and the details card is the
 * result. Until the name and grammatical address are known, the copy stays neutral.
 */
export function tellCopy(name: string, address: GrammaticalAddress | null) {
  const known = Boolean(name) && address !== null;
  const loves = known ? `${name} ${g(address, 'אוהב', 'אוהבת')}` : null;
  return {
    title: 'ספרו לנו על הילד שלכם',
    lead: 'דקה אחת מספיקה. ספרו בחופשיות, ואנחנו נסדר את הפרטים.',
    voiceCta: 'ספרו לנו בקול',
    voiceCtaLocal: 'בדיקת מיקרופון',
    durationHint: 'חצי דקה עד דקה, בכל סדר שנוח לכם.',
    localNote: 'באבטיפוס הזה, בלי עיבוד חי, ההקלטה נשארת במכשיר ולא מפוענחת.',
    exampleCta: 'לראות דוגמה של פענוח',
    chipsLink: 'לענות מתשובות מוכנות',
    writeLink: 'לכתוב טקסט חופשי',
    cuesTitle: 'כדאי לספר:',
    processingVoice: 'מפענחים את מה שסיפרתם',
    processingWritten: 'מפענחים את מה שכתבתם',
    processingFixture: 'מפענחים את הדוגמה',
    processingStatus: 'מפענחים ומסדרים את הפרטים. עוד כמה שניות.',
    // What organising does, in order; shown one after another, never as a progress claim.
    decodeSteps: (written: boolean) => [
      written ? 'קוראים את מה שכתבתם' : 'מקשיבים להקלטה',
      'מזהים שם, גיל ואיפה גרים',
      'מסדרים מה אוהבים ומה קשה',
      'בודקים מה עוד חסר',
    ],
    writeTitle: 'כתבו לנו על הילד שלכם',
    writeLead: 'כמה משפטים מספיקים, בכל סדר שנוח לכם.',
    writeLabel: 'מה תרצו לספר?',
    writeSend: 'סדרו את הפרטים',
    writeLocalNote: 'באבטיפוס הזה, בלי עיבוד חי, הטקסט לא מסודר אוטומטית. אפשר לענות על השאלות במקום.',
    writeToQuestions: 'לענות על שאלות',
    chipsTitle: 'בואו נכיר',
    switchToVoice: 'להקליט במקום',
    cardTitleHeard: name ? `זה מה שהבנו על ${name}` : 'זה מה שהבנו',
    cardTitleOwn: name ? `הפרטים על ${name}` : 'הפרטים על הילד',
    cardNote: 'אפשר לערוך או להסיר כל פרט. מה שתסירו לא ייכנס לספר.',
    cardNoteHeard: 'בדקו במיוחד את השם והמקום. אפשר לתקן או להסיר כל פרט, ומה שתסירו לא ייכנס לספר.',
    missingNote: (count: number) =>
      count === 1 ? 'חסר עוד פרט אחד. שאלנו עליו כאן למטה.' : `חסרים עוד ${count} פרטים. שאלנו עליהם כאן למטה.`,
    lovesTitle: loves ? `מה ${loves}` : 'מה אוהבים',
    lovesQuestion: loves ? `מה ${name} הכי ${g(address, 'אוהב', 'אוהבת')}?` : 'מה הכי אוהבים?',
    lovesError: 'בחרו או כתבו לפחות דבר אחד',
    otherChip: 'משהו אחר',
    lovesOtherLabel: 'מה עוד?',
    hardTitle: name ? `מה קשה ל${name}` : 'מה קשה',
    hardQuestion: name ? `מה קצת קשה ל${name} בזמן האחרון?` : 'מה קצת קשה בזמן האחרון?',
    hardHint: 'במילים שלכם, בלי אבחנות. הסיפור ייתן לזה מקום.',
    hardError: 'בחרו, כתבו, או סמנו שאין משהו מיוחד',
    hardNone: 'אין משהו מיוחד',
    hardNoneRow: 'אין משהו מיוחד שקשה עכשיו',
    hardOtherLabel: 'מה קשה, במילים שלכם?',
    directionTitle: 'הסיפור יעזור עם',
    directionFromHard: 'לפי מה שקשה',
    directionRemovedNote: 'בלי כיוון, זו תהיה הרפתקה בשביל הכיף.',
    bonusTitle: 'עוד פרטים',
    bonusAdd: 'להוסיף עוד פרט',
    placeLabel: name ? `איפה מתחילה ההרפתקה של ${name}?` : 'איפה מתחילה ההרפתקה?',
    placeHint: 'לא חובה. למשל ליד הים או בגינה ליד הבית. זה המקום של הסיפור, לא כתובת.',
    extraLabel: 'עוד פרט קטן',
    extraHint: known
      ? `משהו ש${name} ${g(address, 'נוהג', 'נוהגת')} לומר או לעשות. לא חובה.`
      : 'משהו שנוהגים לומר או לעשות. לא חובה.',
    recordMore: 'להוסיף בהקלטה',
    groupTitle: {
      loves: loves ?? 'אוהבים לעשות',
      hard: name ? `מה קשה ל${name}` : 'מה קשה',
      places: 'מקומות',
      habits: 'הרגלים ומשפטים',
      more: 'עוד',
    } satisfies Record<FactGroupId, string>,
    // A direction is already chosen and a recording (or the example) brings another: an explicit choice.
    directionChange: (current: string, proposed: string, source: 'transcript' | 'fixture' | 'chip') =>
      `כבר נבחר כיוון: ״${current}״. ${source === 'fixture' ? 'בדוגמה' : source === 'chip' ? 'בבחירה שלכם' : 'במה שסיפרתם'} עלה ״${proposed}״. להחליף?`,
    directionReplace: (proposed: string) => `להחליף ל״${proposed}״`,
    directionKeep: (current: string) => `להשאיר את ״${current}״`,
    directionKeepNote: (current: string) => `אם לא תבחרו, נשאיר את ״${current}״.`,
    directionPickLater: 'עלו כמה כיוונים. אפשר לבחור ביניהם בשלב הבא.',
    continue: 'אלה הפרטים, ממשיכים',
    processingPrompt: 'הפרטים עוד בעיבוד.',
    processingWait: 'לחכות',
    processingSkip: 'להמשיך בלי הפרטים האלה',
    recordingPrompt: 'ההקלטה עדיין פעילה.',
    recordingResume: 'לחזור להקלטה',
    recordingSkip: 'לעצור ולהמשיך בלי לשלוח',
    conflictKeepNote: 'אם לא תבחרו, נשאיר את מה שכבר ברשימה.',
    staleFact: (value: string) => `בתמלול המתוקן כבר לא מופיע ״${value}״. להשאיר אותו בסיפור?`,
    stalePlace: (value: string) => `בתמלול המתוקן כבר לא מופיע מקום ההרפתקה ״${value}״. להשאיר אותו?`,
    staleKeep: 'להשאיר',
    staleRemove: 'להסיר',
    staleDirection: (topic: string) =>
      `הכיוון ״${topic}״ הוצע ממה שקשה, ושיניתם או הסרתם את מה שהוא נשען עליו. להשאיר את הכיוון בסיפור?`,
    staleDirectionKeep: 'להשאיר את הכיוון',
    staleDirectionRemove: 'להסיר את הכיוון',
    staleDirectionNote: 'צריך לבחור לפני שממשיכים.',
    similarRemoved: (value: string, removedValue: string) =>
      `במה שסיפרתם עלה ״${value}״, שנשמע כמו ״${removedValue}״ שהסרתם. להוסיף אותו בכל זאת?`,
    similarAdd: 'להוסיף',
    similarSkip: 'לא להוסיף',
    // "You wrote" only when the parent typed the current value; otherwise it is simply what the list holds.
    conflictAge: (current: string, heard: string, typed: boolean) =>
      `${typed ? `כתבתם ${current}` : `ברשימה מופיע ${current}`} ושמענו ${heard}. מה נכון?`,
    conflictName: (current: string, heard: string, typed: boolean) =>
      `${typed ? `כתבתם ״${current}״` : `ברשימה מופיע ״${current}״`} ושמענו ״${heard}״. ${
        address ? `איך לקרוא ל${g(address, 'גיבור', 'גיבורה')}?` : 'באיזה שם להשתמש בספר?'
      }`,
    conflictAddress: (current: string, heard: string, typed: boolean) =>
      `${typed ? `בחרתם ${current}` : `ברשימה מופיע ${current}`}, ובמה שסיפרתם עלה ${heard}. איך לפנות בסיפור?`,
    conflictResidence: (current: string, heard: string, typed: boolean) =>
      `${typed ? `כתבתם ״${current}״` : `ברשימה מופיע ״${current}״`} ושמענו ״${heard}״. איפה גרים?`,
    conflictPlace: (current: string, heard: string, typed: boolean) =>
      `${typed ? `כתבתם ״${current}״` : `ברשימה מופיע ״${current}״`} ושמענו ״${heard}״. איפה מתחילה ההרפתקה?`,
    conflictFixtureNote: 'ההצעה הזו הגיעה מהדוגמה המוכנה, לא ממה שסיפרתם.',
    factOutcome: {
      limit: 'הגעתם למספר המקסימלי כאן. אפשר להסיר פרט ולהוסיף אחר.',
      duplicate: 'הפרט הזה כבר ברשימה.',
      too_long: 'קצר יותר, בבקשה (עד 80 תווים).',
      empty: 'כתבו משהו קצר, או הסירו את הפרט.',
    },
  };
}

export function factLabel(kind: FactKind, value: string): string {
  switch (kind) {
    case 'favorite_place':
      return `מקום אהוב: ${value}`;
    case 'family':
      return `משפחה: ${value}`;
    case 'recent_event':
      return `לאחרונה: ${value}`;
    default:
      return value;
  }
}

export const storyPlaceLabel = (value: string) => `מקום ההרפתקה: ${value}`;

/** Provenance badges. A written text and a recording are both "what you told us". */
export const SOURCE_BADGE = { fixture: 'דוגמה', transcript: 'ממה שסיפרתם' } as const;

export const RECORDER = {
  requesting: 'מחכים לאישור המיקרופון',
  recording: 'מקליטים',
  finishLive: 'סיימתי, סדרו את הפרטים',
  finishLocal: 'לסיים את ההקלטה',
  warn: 'נשארו 15 שניות',
  timer: (elapsed: number, max: number) => `${formatDuration(elapsed)} מתוך ${formatDuration(max)}`,
  stopping: 'מסיימים את ההקלטה',
  recordedLocal: (duration: string) =>
    `ההקלטה (${duration}) נשמרה במכשיר בלבד. עיבוד חי עדיין לא מחובר באבטיפוס הזה, ולכן לא נשלח דבר.`,
  recordedReady: (duration: string) => `ההקלטה (${duration}) מוכנה ועוד לא נשלחה.`,
  stopReason: {
    user_done: '',
    user_stop: '',
    time_limit: 'הגענו לזמן המקסימלי, והמיקרופון נסגר. ההקלטה לא נשלחה.',
    size_limit: 'ההקלטה הגיעה לגודל המקסימלי, והמיקרופון נסגר. ההקלטה לא נשלחה.',
    interrupted: 'ההקלטה הופסקה כי המסך ננעל, המיקרופון נותק או שעברתם לחלון אחר. החלק שהוקלט נשמר רק במכשיר ולא נשלח.',
    left_step: 'עצרנו את ההקלטה כשעברתם שלב. היא נשמרה רק במכשיר ולא נשלחה.',
    incomplete: 'ההקלטה לא הסתיימה כרגיל, ולכן לא נשלחה. החלק שנשמר נמצא במכשיר בלבד: אפשר להאזין לו, לשלוח אותו בכל זאת או להקליט מחדש.',
  } satisfies Record<StopReason, string>,
  listen: 'האזנה',
  stopListen: 'עצירת האזנה',
  newRecording: 'הקלטה חדשה',
  deleteRecording: 'מחיקת ההקלטה',
  deleteNote: 'מחיקת ההקלטה לא מסירה פרטים שכבר נוספו לרשימה. אפשר להסיר אותם בנפרד.',
  send: 'לשלוח לעיבוד',
  notSendable: 'הדפדפן הקליט בפורמט שעוד לא נתמך לעיבוד. אפשר להאזין או לכתוב את הפרטים.',
  cancelledPermission: 'ביטלנו. המיקרופון לא נפתח.',
  processing: 'מסדרים את הפרטים',
  processedAdded: (count: number) =>
    count === 1 ? 'הוספנו פרט אחד. אפשר לערוך או להסיר אותו.' : `הוספנו ${count} פרטים. אפשר לערוך או להסיר כל אחד.`,
  processedNothingNew: 'לא מצאנו פרטים חדשים.',
  retiredByCorrection: (count: number) =>
    count === 1
      ? 'הצעה אחת שלא הופיעה בתמלול המתוקן הוסרה מהרשימה.'
      : `${count} הצעות שלא הופיעו בתמלול המתוקן הוסרו מהרשימה.`,
  notUnderstood: 'לא הצלחנו להבין מספיק. אפשר לנסות שוב, לכתוב או לבחור.',
  abandoned: 'ביטלנו. אם תגיע תשובה מאוחרת, לא נוסיף אותה.',
  failed: 'העיבוד לא הצליח. הפרטים שכבר ברשימה נשארו. אפשר לנסות שוב או לכתוב.',
  errors: {
    insecure_context: 'הקלטה אפשרית רק בחיבור מאובטח. אפשר לכתוב או לבחור.',
    unsupported: 'הדפדפן הזה לא תומך בהקלטה. אפשר לכתוב או לבחור.',
    permission_denied: 'לא הצלחנו לפתוח את המיקרופון. אפשר לכתוב או לבחור.',
    no_device: 'לא מצאנו מיקרופון. אפשר לכתוב או לבחור.',
    device_busy: 'המיקרופון תפוס כרגע. אפשר לנסות שוב, לכתוב או לבחור.',
    empty: 'לא הצלחנו להבין מספיק. אפשר לנסות שוב או לכתוב.',
    failed: 'ההקלטה נעצרה בגלל תקלה. הפרטים שכתבתם נשארו. אפשר לנסות שוב או לכתוב.',
  } satisfies Record<RecorderErrorKind, string>,
  retry: 'לנסות שוב',
  level: 'עוצמת הקול שהמיקרופון קולט',
  sent: 'ההקלטה נשלחה לעיבוד.',
  privacyLive:
    'ההקלטה והתמלול נשלחים לעיבוד אצל ספק חיצוני ואינם נשמרים אצלנו. הספק עשוי לשמור את טקסט התמלול עד 30 יום לבדיקות אבטחה.',
  privacyWritten:
    'הטקסט נשלח לעיבוד אצל ספק חיצוני ואינו נשמר אצלנו. הספק עשוי לשמור אותו עד 30 יום לבדיקות אבטחה.',
};

/** Parent-facing text for live intake failures (P2). An aborted request says nothing extra. */
export const INTAKE_ERRORS: Record<LiveIntakeError, string> = {
  not_signed_in: 'עיבוד חי לא זמין כרגע. אפשר להמשיך בכתיבה או בבחירה.',
  not_operator: 'עיבוד חי לא זמין כרגע. אפשר להמשיך בכתיבה או בבחירה.',
  disabled: 'עיבוד חי לא זמין כרגע. אפשר להמשיך בכתיבה או בבחירה.',
  rejected_audio: 'ההקלטה לא התקבלה לעיבוד (קצרה או ארוכה מדי, או בפורמט שלא נתמך). אפשר לנסות שוב או לכתוב.',
  busy: 'יש כבר עיבוד פעיל. אפשר לנסות שוב בעוד רגע.',
  budget: 'תקציב הניסוי של האבטיפוס נגמר. אפשר להמשיך בכתיבה או בבחירה.',
  rate_limited: 'היו יותר מדי ניסיונות ברצף. אפשר לנסות שוב בעוד דקה.',
  failed: 'העיבוד לא הצליח. הפרטים שכבר ברשימה נשארו. אפשר לנסות שוב או לכתוב.',
  network: 'לא הצלחנו להגיע לשרת. הפרטים שכבר ברשימה נשארו. אפשר לנסות שוב או לכתוב.',
  malformed_response: 'העיבוד לא הצליח. הפרטים שכבר ברשימה נשארו. אפשר לנסות שוב או לכתוב.',
  aborted: '',
};

export const TRANSCRIPT = {
  show: 'הצגת מה ששמענו',
  showWritten: 'הצגת מה שכתבתם',
  hide: 'הסתרה',
  titleLive: 'התמלול',
  titleWritten: 'מה שכתבתם',
  titleFixture: 'תמלול לדוגמה (כתוב מראש, לא מההקלטה)',
  editNote: 'תיקון הטקסט לא נשלח מחדש מעצמו.',
  editLabel: 'תיקון הטקסט',
  reorganize: 'לסדר שוב מהטקסט המתוקן',
};

export const TEST_PANEL = {
  toggle: 'כלי בדיקה לאבטיפוס',
  note: 'הדוגמאות כתובות מראש. הן לא נגזרות מההקלטה שלכם, וההקלטה לא נשלחת אליהן.',
  delayNote: 'הדוגמה מגיעה אחרי השהיה קצרה, כדי שאפשר יהיה לבדוק עיבוד, ביטול והמשך.',
  voice: 'טעינת דוגמה: הכל נאמר',
  simple: 'טעינת דוגמה: חסרים פרטים',
  mixed: 'טעינת דוגמה: סתירה, מקום וכיוון',
  lateIgnored: 'הגיעה תשובה מאוחרת ולא נוספה.',
};

export function companionCopy(name: string, address: GrammaticalAddress | null) {
  return {
    title: `מי יצטרף ל${name} להרפתקה?`,
    sub: 'בוחרים חבר או חברה לסיפור.',
    rosterNote: 'הדמויות מוצגות לבדיקת האבטיפוס. בחירה כאן עוד לא מאשרת את הדמות לאיור בספר.',
    missing: 'בחרו חבר או חברה לסיפור',
    intentTitle: 'במה הסיפור יעזור?',
    intentSub: 'לא חובה. אפשר גם הרפתקה בלי נושא מיוחד.',
    justForFun: 'הרפתקה בשביל הכיף',
    clearIntent: 'בלי לבחור כיוון',
    suggestion: (label: string, source: 'transcript' | 'fixture' | 'chip') =>
      source === 'fixture'
        ? `בדוגמה המוכנה עלה: ״${label}״. לבחור בזה?`
        : source === 'chip'
          ? `בחרתם ש${g(address, 'קשה לו', 'קשה לה')}: ״${label}״. לבחור בזה?`
          : `במה שסיפרתם עלה: ״${label}״. לבחור בזה?`,
    suggestionAccept: 'לבחור',
    suggestionDismiss: 'לא עכשיו',
    avoidTitle: 'מה לא תרצו שיופיע?',
    avoidHint: 'לא חובה. למשל: בלי כלבים גדולים. אין צורך להסביר למה.',
    avoidLimit: 'אפשר עד 5 דברים.',
    avoidDuplicate: 'זה כבר ברשימה.',
    avoidTooLong: 'קצר יותר, בבקשה (עד 60 תווים).',
    childRef: g(address, 'הגיבור', 'הגיבורה'),
  };
}

/** Length tiers: every book is an adventure with fantasy; only length and plot depth differ. */
export const LENGTH_COPY: Record<string, { name: string; depth: string }> = {
  short: { name: 'קצר', depth: 'עלילה פשוטה וקצרה' },
  medium: { name: 'בינוני', depth: 'עוד תחנות בדרך' },
  long: { name: 'ארוך', depth: 'מסע מלא ועלילה עמוקה' },
};

export function bookCopy(name: string) {
  return {
    title: 'איך הספר ייראה ויישמע',
    photoTitle: `תמונה של ${name}`,
    optional: 'לא חובה',
    photoPick: 'בחירת תמונה',
    photoReplace: 'החלפת תמונה',
    photoRemove: 'הסרת התמונה',
    photoNoPhoto: `בלי תמונה, נאייר את ${name} לפי הפרטים שמסרתם, ולא נבטיח דמיון.`,
    photoLocalNote: 'באבטיפוס הזה התמונה מוצגת רק כאן ולא נשלחת.',
    photoTypeError: 'אפשר לבחור תמונת JPG, PNG או WEBP.',
    photoSizeError: 'התמונה גדולה מדי. אפשר עד 15MB.',
    photoAlt: `התמונה שבחרתם של ${name}`,
    voiceTitle: 'מי יקריא את הספר?',
    voiceNote: 'הקריינות נפרדת מההקלטה שלכם. ההקלטה לא משמשת לקול הספר.',
    playSample: 'האזנה לדוגמה',
    stopSample: 'עצירה',
    noSample: 'דוגמה תתווסף בהמשך',
    lengthTitle: 'כמה ארוך הספר?',
    lengthNote:
      'כל הספרים הם הרפתקה עם קסם ופנטזיה. ההבדל הוא באורך ובעומק העלילה. מחיר וזמינות ייקבעו כשהכתיבה האישית תחובר.',
    pages: (count: number) => `${count} עמודים`,
    clearChoice: 'לבחור אחר כך',
  };
}

export function summaryCopy(name: string, address: GrammaticalAddress | null) {
  return {
    title: `הספר של ${name}`,
    sections: {
      hero: g(address, 'הגיבור', 'הגיבורה'),
      facts: 'הפרטים שניקח לסיפור',
      companion: 'החבר להרפתקה',
      intent: 'הכיוון',
      look: 'מראה וקול',
    },
    childLine: (age: number) => `${name}, ${g(address, 'בן', 'בת')} ${age}, בלשון ${g(address, 'זכר', 'נקבה')}`,
    residenceLine: (value: string) => `מקום מגורים: ${value}`,
    noDifficulty: 'אין משהו מיוחד שקשה עכשיו',
    noFacts: 'בלי פרטים נוספים. הסיפור יתבסס על הבחירות שמסרתם.',
    intentHelps: (label: string) => `הסיפור יעזור עם: ${label}`,
    intentNone: 'הרפתקה בלי נושא מיוחד',
    avoid: (items: readonly string[]) => `בלי: ${items.join(', ')}`,
    photoNone: 'בלי תמונה',
    photoLocal: 'נבחרה תמונה לתצוגה בלבד. באבטיפוס היא לא נשלחת.',
    voice: (label: string | null) => `קריינות: ${label ?? 'עוד לא נבחרה'}`,
    length: (label: string | null) => `אורך: ${label ?? 'עוד לא נבחר'}`,
    fixtureWarning: 'חלק מהפרטים הם דוגמה מוכנה ולא מידע שמסרתם.',
    connectionTitle: 'מה קורה בלחיצה',
    connectionBody:
      'נבדוק את הבקשה בשרת האבטיפוס ונכין את הפרטים. יצירת הספר עדיין לא מחוברת, ולכן לא ייכתב סיפור, לא ייווצרו איורים ולא יהיה חיוב.',
    finish: 'לסיים את בקשת הספר',
    finishing: 'בודקים את הבקשה',
    accepted: 'הפרטים מוכנים. יצירת הספר עדיין לא מחוברת באבטיפוס הזה.',
    requestId: (id: string) => `מזהה הבקשה: ${id}`,
    payload: 'מה הבקשה נושאת (לבדיקה)',
    rejected: 'השרת לא קיבל את הבקשה. אפשר לתקן ולנסות שוב.',
    network: 'לא הצלחנו להגיע לשרת האבטיפוס. הפרטים עדיין כאן, אפשר לנסות שוב.',
    changedSince: 'שיניתם פרטים אחרי הבדיקה. לחצו שוב כדי לבדוק את הגרסה הנוכחית.',
    missing: {
      child_name_missing: 'חסר שם לספר',
      child_name_invalid: 'השם צריך תיקון',
      child_age_missing: 'חסר גיל',
      child_address_missing: 'חסרה לשון פנייה',
      child_residence_missing: 'חסר מקום מגורים',
      loves_missing: 'חסר מה אוהבים',
      hard_missing: 'חסר מה קשה (או ״אין משהו מיוחד״)',
      direction_unconfirmed: 'צריך להחליט אם להשאיר את הכיוון של הסיפור',
      facts_unreviewed: 'יש פרטים שעוד לא אישרתם ברשימה',
      companion_missing: 'עוד לא נבחר חבר להרפתקה',
      contract_violation: 'יש פרט שלא עומד בכללי הבקשה',
    },
  };
}
