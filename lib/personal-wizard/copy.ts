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
  draftNotice: 'הפרטים נשמרים בחלון הזה ונמחקים ברענון או בסגירה.',
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
  nameLabel: 'שם',
  namePlaceholder: 'למשל: בר',
  nameRow: (name: string) => `שם: ${name}`,
  ageLabel: 'גיל',
  ageRow: (age: number) => `גיל: ${age}`,
  addressLabel: 'פנייה בסיפור',
  addressBoy: 'בלשון זכר',
  addressGirl: 'בלשון נקבה',
  addressRow: (address: GrammaticalAddress) => `פנייה: ${address === 'girl' ? 'בלשון נקבה' : 'בלשון זכר'}`,
  residenceLabel: 'מקום מגורים',
  residencePlaceholder: 'למשל: חיפה',
  residenceRow: (value: string) => `מקום מגורים: ${value}`,
  residenceHint: 'יישוב או אזור, בלי כתובת.',
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
    // A no-break space keeps "לפני שנכתוב" together, so a phone breaks the line between the sentences.
    lead: 'דקה אחת בקול שלכם. לפני שנכתוב, תוכלו לבדוק הכול.',
    voiceCta: 'להתחיל להקליט',
    voiceCtaLocal: 'בדיקת מיקרופון',
    localNote: 'ללא פענוח חי, ההקלטה נשארת במכשיר ולא מפוענחת.',
    chipsLink: 'לבחור תשובות',
    writeLink: 'לכתוב במקום',
    cuesTitle: 'כדאי לספר',
    // Live trial only: decoding needs a signed-in operator; the window re-checks when the parent returns.
    signInNote: 'כדי שנפענח את ההקלטה, צריך קודם להתחבר.',
    signInLink: 'להתחבר בחלון חדש',
    processingVoice: 'מפענחים את מה שסיפרתם',
    processingWritten: 'מפענחים את מה שכתבתם',
    processingFixture: 'מפענחים את הדוגמה',
    processingStatus: 'מסדרים את הפרטים. בסיום תוכלו לבדוק, לתקן ולהחליט מה ייכנס לסיפור.',
    // What organising does, in order; shown one after another, never as a progress claim.
    decodeSteps: (written: boolean) => [
      written ? 'קוראים את מה שכתבתם' : 'מקשיבים להקלטה',
      'מזהים שם, גיל ואיפה גרים',
      'מסדרים מה אוהבים ומה קשה',
      'בודקים מה עוד חסר',
    ],
    writeTitle: 'כתבו לנו על הילד שלכם',
    writeLead: 'כמה משפטים מספיקים, בכל סדר.',
    writeLabel: 'מה תרצו לספר?',
    writeSend: 'סדרו את הפרטים',
    writeLocalNote: 'באבטיפוס הזה הטקסט לא מסודר אוטומטית.',
    writeToQuestions: 'לענות על שאלות',
    chipsTitle: 'בואו נכיר',
    switchToVoice: 'להקליט במקום',
    cardTitleHeard: name ? `זה מה שהבנו על ${name}` : 'זה מה שהבנו',
    cardTitleOwn: name ? `הפרטים על ${name}` : 'הפרטים על הילד',
    cardNoteHeard: 'בדקו במיוחד את השם והמקום.',
    missingNote: (count: number) => (count === 1 ? 'חסר עוד פרט אחד' : `חסרים עוד ${count} פרטים`),
    lovesTitle: loves ? `מה ${loves}` : 'מה אוהבים',
    lovesError: 'בחרו או כתבו לפחות דבר אחד',
    otherChip: 'משהו אחר',
    lovesOtherLabel: 'מה עוד?',
    // One question, asked once: it heads the heard rows as well as the empty field.
    hardTitle: name ? `מה קצת קשה ל${name} בזמן האחרון?` : 'מה קצת קשה בזמן האחרון?',
    hardHint: 'במילים שלכם, בלי אבחנות. הסיפור ייתן לזה מקום.',
    hardError: 'בחרו, כתבו, או סמנו שאין משהו מיוחד',
    hardNone: 'אין משהו מיוחד',
    hardNoneRow: 'אין משהו מיוחד שקשה עכשיו',
    hardOtherLabel: 'מה קשה, במילים שלכם?',
    directionTitle: 'הנושא שבחרתם לסיפור',
    directionFromHard: 'לפי מה שקשה',
    bonusTitle: 'עוד פרטים',
    bonusAdd: 'להוסיף עוד פרט',
    placeLabel: name ? `איפה מתחילה ההרפתקה של ${name}?` : 'איפה מתחילה ההרפתקה?',
    placeHint: 'לא חובה. למשל: ליד הים.',
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
  finishLocal: 'סיימתי',
  warn: 'נשארו 15 שניות',
  timer: (elapsed: number, max: number) => `${formatDuration(elapsed)} מתוך ${formatDuration(max)}`,
  timerMax: (max: number) => `מתוך ${formatDuration(max)}`,
  stopping: 'מסיימים את ההקלטה',
  recordedLocal: (duration: string) => `ההקלטה (${duration}) נשמרה רק במכשיר ולא נשלחה.`,
  recordedReady: (duration: string) => `ההקלטה (${duration}) מוכנה ועוד לא נשלחה.`,
  stopReason: {
    user_done: '',
    user_stop: '',
    time_limit: 'הגענו לזמן המקסימלי וההקלטה נעצרה. היא לא נשלחה.',
    size_limit: 'ההקלטה הגיעה לגודל המקסימלי ונעצרה. היא לא נשלחה.',
    interrupted: 'ההקלטה נעצרה כי המסך ננעל, המיקרופון נותק או שעברתם לחלון אחר. היא נשמרה רק במכשיר.',
    left_step: 'ההקלטה נעצרה כשעברתם שלב. היא נשמרה רק במכשיר.',
    incomplete: 'ההקלטה לא הסתיימה כרגיל ולא נשלחה. אפשר להאזין לה, לשלוח אותה בכל זאת או להקליט מחדש.',
  } satisfies Record<StopReason, string>,
  listen: 'האזנה',
  stopListen: 'עצירת האזנה',
  newRecording: 'הקלטה חדשה',
  deleteRecording: 'מחיקת ההקלטה',
  deleteNote: 'המחיקה לא מסירה פרטים שכבר ברשימה.',
  send: 'לשלוח לעיבוד',
  notSendable: 'הדפדפן הקליט בפורמט שעוד לא נתמך לעיבוד. אפשר להאזין או לכתוב את הפרטים.',
  cancelledPermission: 'ביטלנו. המיקרופון לא נפתח.',
  processing: 'מסדרים את הפרטים',
  processedAdded: (count: number) => (count === 1 ? 'הוספנו פרט אחד.' : `הוספנו ${count} פרטים.`),
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
  toggle: 'כלי בדיקה',
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
    missing: 'בחרו חבר או חברה לסיפור',
    intentTitle: 'הכיוון של הסיפור',
    intentSub: 'לא חובה. בכל מקרה זו תהיה הרפתקה, לא שיעור.',
    justForFun: 'הרפתקה בשביל הכיף',
    clearIntent: 'בלי לבחור כיוון',
    suggestion: (label: string, source: 'transcript' | 'fixture' | 'chip') =>
      source === 'fixture'
        ? `בדוגמה המוכנה עלה: ״${label}״. לבחור בזה?`
        : source === 'chip'
          ? `בחרתם ש${g(address, 'קשה לו', 'קשה לה')}: ״${label}״. לבחור בזה?`
          : `במה שסיפרתם עלה: ״${label}״. לבחור בזה?`,
    suggestionAccept: 'לבחור',
    suggestionDismiss: 'בלי הכיוון הזה',
    avoidTitle: 'מה לא תרצו שיופיע?',
    avoidHint: 'לא חובה. למשל: כלבים גדולים.',
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
    title: 'תמונה, קול ואורך',
    photoTitle: `תמונה של ${name}`,
    optional: 'לא חובה',
    photoPick: 'בחירת תמונה',
    photoReplace: 'החלפת תמונה',
    photoRemove: 'הסרת התמונה',
    photoNoPhoto: `בלי תמונה נאייר את ${name} לפי הפרטים, בלי הבטחה לדמיון.`,
    photoLocalNote: 'באבטיפוס התמונה נשארת במכשיר.',
    photoTypeError: 'אפשר לבחור תמונת JPG, PNG או WEBP.',
    photoSizeError: 'התמונה גדולה מדי. אפשר עד 15MB.',
    photoAlt: `התמונה שבחרתם של ${name}`,
    voiceTitle: 'מי יקריא את הספר?',
    voiceNote: 'ההקלטה שלכם לא משמשת לקול הספר.',
    playSample: 'האזנה לדוגמה',
    stopSample: 'עצירה',
    noSample: 'דוגמה תתווסף בהמשך',
    lengthTitle: 'כמה ארוך הספר?',
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
    // The section is already headed "the direction"; the row is just the topic.
    intentHelps: (label: string) => label,
    intentNone: 'הרפתקה בלי נושא מיוחד',
    avoid: (items: readonly string[]) => `בלי: ${items.join(', ')}`,
    photoNone: 'בלי תמונה',
    photoLocal: 'נבחרה תמונה לתצוגה בלבד. באבטיפוס היא לא נשלחת.',
    voice: (label: string | null) => `קריינות: ${label ?? 'עוד לא נבחרה'}`,
    length: (label: string | null) => `אורך: ${label ?? 'עוד לא נבחר'}`,
    fixtureWarning: 'חלק מהפרטים הם דוגמה מוכנה ולא מידע שמסרתם.',
    // Validation is free and never writes; writing is its own explicit, separate action.
    connectionBody: 'הבדיקה לא עולה כסף ולא כותבת את הסיפור. הכתיבה היא שלב נפרד.',
    finish: 'לסיים את בקשת הספר',
    finishing: 'בודקים את הבקשה',
    accepted: 'הפרטים נבדקו ומוכנים.',
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
