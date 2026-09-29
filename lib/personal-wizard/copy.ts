/**
 * Hebrew copy for the personal Wizard prototype. Inflection follows the parent's explicit choice
 * of grammatical address, never the child's name or photo.
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

export const STEP_NAMES = ['הגיבור', 'היכרות', 'חבר והרפתקה', 'מראה וקול', 'הספר'] as const;

export const COMMON = {
  prototypeBadge: 'אבטיפוס',
  draftNotice: 'הפרטים נשמרים רק בחלון הזה. רענון או סגירה ימחקו אותם.',
  stepOf: (step: number) => `שלב ${step} מתוך 5`,
  back: 'חזרה',
  next: 'להמשיך',
  backToSummary: 'חזרה לסיכום',
  edit: 'עריכה',
  remove: 'הסרה',
  save: 'שמירה',
  cancel: 'ביטול',
  add: 'הוספה',
};

export const HERO = {
  title: 'מי הגיבור או הגיבורה של הספר?',
  sub: 'שלושה פרטים קצרים, ואז נכיר יותר.',
  nameLabel: 'השם שיופיע בספר',
  namePlaceholder: 'למשל: בר',
  ageLabel: 'גיל',
  ageHint: 'האבטיפוס בנוי לגילי 3 עד 8.',
  addressLabel: 'איך לפנות בסיפור?',
  addressBoy: 'בלשון זכר',
  addressGirl: 'בלשון נקבה',
  addressHint: 'נכתוב את הסיפור לפי הבחירה הזו, לא לפי השם.',
  errors: {
    child_name_missing: 'צריך שם לספר',
    child_name_invalid: 'אפשר להשתמש באותיות, רווח, גרש או מקף',
    child_age_missing: 'בחרו גיל',
    child_address_missing: 'בחרו איך לפנות בסיפור',
  },
};

export const CHIPS = [
  { id: 'ball', label: 'כדור' },
  { id: 'crafts', label: 'יצירה' },
  { id: 'building', label: 'בנייה' },
  { id: 'music', label: 'מוזיקה' },
  { id: 'animals', label: 'בעלי חיים' },
  { id: 'outdoor', label: 'משחק בחוץ' },
] as const;

export function meetCopy(name: string, address: GrammaticalAddress | null) {
  return {
    title: `בואו נכיר את ${name}`,
    lead: `מה ${name} ${g(address, 'אוהב', 'אוהבת')} לעשות? אפשר לספר גם על מקום אהוב, הרגל מצחיק או משהו שקרה לאחרונה. כמה פרטים קטנים מספיקים.`,
    voiceCta: 'ספרו לנו בקול',
    voiceNoteLive:
      'בסיום נשלח את ההקלטה לעיבוד ונציג את הפרטים לעריכה לפני שישמשו בסיפור. ההקלטה אינה הקול שיקריא את הספר.',
    voiceNoteLocal:
      'באבטיפוס הזה ההקלטה נשארת במכשיר שלכם ולא נשלחת לעיבוד. ההקלטה אינה הקול שיקריא את הספר.',
    orPickOrType: 'אפשר גם לבחור או לכתוב',
    chipsLabel: `דברים ש${name} ${g(address, 'אוהב', 'אוהבת')}`,
    otherChip: 'משהו אחר',
    otherLabel: `מה עוד ${name} ${g(address, 'אוהב', 'אוהבת')}?`,
    placeLabel: `איפה מתחילה ההרפתקה של ${name}?`,
    placeHint: 'למשל באודם, ליד הים או בגינה ליד הבית. זה המקום של הסיפור, לא כתובת.',
    extraLabel: 'עוד פרט קטן',
    extraHint: `משהו ש${name} ${g(address, 'נוהג', 'נוהגת')} לומר או לעשות. לא חובה.`,
    listTitle: 'הפרטים שניקח לסיפור',
    listEmpty: 'עוד אין פרטים. אפשר להמשיך גם בלי, והסיפור יתבסס על הבחירות שמסרתם.',
    groupTitle: {
      interests: `${name} ${g(address, 'אוהב', 'אוהבת')}`,
      places: 'מקומות',
      habits: 'הרגלים ומשפטים',
      more: 'עוד',
    } satisfies Record<FactGroupId, string>,
    continueWith: 'להמשיך עם הפרטים האלה',
    continueWithout: 'להמשיך בלי פרטים נוספים',
    continueWithoutNote: 'הסיפור יתבסס על הבחירות שכבר מסרתם. לא נמציא פרטים.',
    processingPrompt: 'הפרטים מההקלטה עוד בעיבוד.',
    processingWait: 'לחכות',
    processingSkip: 'להמשיך בלי הפרטים מההקלטה',
    recordingPrompt: 'ההקלטה עדיין פעילה.',
    recordingResume: 'לחזור להקלטה',
    recordingSkip: 'לעצור ולהמשיך בלי לשלוח',
    conflictKeepNote: 'אם לא תבחרו, נשאיר את מה שכבר ברשימה.',
    staleFact: (value: string) => `בתמלול המתוקן כבר לא מופיע ״${value}״. להשאיר אותו בסיפור?`,
    stalePlace: (value: string) => `בתמלול המתוקן כבר לא מופיע מקום ההרפתקה ״${value}״. להשאיר אותו?`,
    staleKeep: 'להשאיר',
    staleRemove: 'להסיר',
    conflictAge: (typed: string, heard: string) => `כתבתם ${typed} ושמענו ${heard}. מה נכון?`,
    conflictName: (typed: string, heard: string) => `כתבתם ״${typed}״ ושמענו ״${heard}״. איך לקרוא ל${g(address, 'גיבור', 'גיבורה')}?`,
    conflictPlace: (typed: string, heard: string) => `כתבתם ״${typed}״ ושמענו ״${heard}״. איפה מתחילה ההרפתקה?`,
    conflictFixtureNote: 'ההצעה הזו הגיעה מהדוגמה המוכנה, לא מההקלטה.',
    factOutcome: {
      limit: 'אפשר עד 12 פרטים. כמה פרטים קטנים מספיקים.',
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
    case 'residence':
      return `מקום מגורים: ${value}`;
    case 'family':
      return `משפחה: ${value}`;
    case 'recent_event':
      return `לאחרונה: ${value}`;
    default:
      return value;
  }
}

export const storyPlaceLabel = (value: string) => `מקום ההרפתקה: ${value}`;

export const SOURCE_BADGE = { fixture: 'דוגמה', transcript: 'מההקלטה' } as const;

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
    count === 1 ? 'הוספנו פרט אחד לרשימה. אפשר לערוך או להסיר אותו.' : `הוספנו ${count} פרטים לרשימה. אפשר לערוך או להסיר כל אחד.`,
  processedNothingNew: 'לא מצאנו פרטים חדשים.',
  retiredByCorrection: (count: number) =>
    count === 1
      ? 'הצעה אחת שלא הופיעה בתמלול המתוקן הוסרה מהרשימה.'
      : `${count} הצעות שלא הופיעו בתמלול המתוקן הוסרו מהרשימה.`,
  suggestionNext: 'הצעה לכיוון הסיפור תחכה לכם בשלב הבא.',
  notUnderstood: 'לא הצלחנו להבין מספיק. אפשר לנסות שוב או לכתוב.',
  abandoned: 'ביטלנו. אם תגיע תשובה מאוחרת, לא נוסיף אותה.',
  failed: 'העיבוד לא הצליח. הפרטים שכבר ברשימה נשארו. אפשר לנסות שוב או לכתוב.',
  errors: {
    insecure_context: 'הקלטה אפשרית רק בחיבור מאובטח. אפשר לכתוב או לבחור כאן.',
    unsupported: 'הדפדפן הזה לא תומך בהקלטה. אפשר לכתוב או לבחור כאן.',
    permission_denied: 'לא הצלחנו לפתוח את המיקרופון. אפשר לכתוב או לבחור כאן.',
    no_device: 'לא מצאנו מיקרופון. אפשר לכתוב או לבחור כאן.',
    device_busy: 'המיקרופון תפוס כרגע. אפשר לנסות שוב, או לכתוב ולבחור כאן.',
    empty: 'לא הצלחנו להבין מספיק. אפשר לנסות שוב או לכתוב.',
    failed: 'ההקלטה נעצרה בגלל תקלה. הפרטים שכתבתם נשארו. אפשר לנסות שוב או לכתוב.',
  } satisfies Record<RecorderErrorKind, string>,
  retry: 'לנסות שוב',
  level: 'עוצמת הקול שהמיקרופון קולט',
  sent: 'ההקלטה נשלחה לעיבוד.',
  privacyLive:
    'ההקלטה והתמלול נשלחים לעיבוד אצל ספק חיצוני ואינם נשמרים אצלנו. הספק עשוי לשמור את טקסט התמלול עד 30 יום לבדיקות אבטחה.',
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
  show: 'הצגת התמלול',
  hide: 'הסתרת התמלול',
  titleLive: 'התמלול',
  titleFixture: 'תמלול לדוגמה (כתוב מראש, לא מההקלטה)',
  editNote: 'תיקון התמלול לא נשלח מחדש מעצמו.',
  editLabel: 'תיקון התמלול',
  reorganize: 'לסדר שוב מהטקסט המתוקן',
};

export const TEST_PANEL = {
  title: 'כלי בדיקה לאבטיפוס',
  note: 'הדוגמאות כתובות מראש. הן לא נגזרות מההקלטה שלכם, וההקלטה לא נשלחת אליהן.',
  delayNote: 'הדוגמה מגיעה אחרי השהיה קצרה, כדי שאפשר יהיה לבדוק עיבוד, ביטול והמשך.',
  simple: 'טעינת דוגמה: פרטים פשוטים',
  mixed: 'טעינת דוגמה: סתירה, מקום וכיוון',
  lateIgnored: 'הגיעה תשובה מאוחרת ולא נוספה.',
  processing: 'מסדרים את הפרטים מהדוגמה',
};

export function companionCopy(name: string, address: GrammaticalAddress | null) {
  return {
    title: `מי יצטרף ל${name} להרפתקה?`,
    sub: 'בוחרים חבר או חברה לסיפור. לכל אחד יש אופי משלו.',
    rosterNote: 'הדמויות מוצגות לבדיקת האבטיפוס. בחירה כאן עוד לא מאשרת את הדמות לאיור בספר.',
    missing: 'בחרו חבר או חברה לסיפור',
    intentTitle: 'יש משהו שתרצו לתת לו מקום בסיפור?',
    intentSub: 'לא חובה. אפשר גם לבקש הרפתקה בלי נושא מיוחד.',
    justForFun: 'הרפתקה בשביל הכיף',
    clearIntent: 'בלי לבחור כיוון',
    suggestion: (label: string, source: 'transcript' | 'fixture') =>
      source === 'fixture' ? `בדוגמה המוכנה עלה: ״${label}״. לבחור בזה?` : `שמענו בהקלטה: ״${label}״. לבחור בזה?`,
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
    packageTitle: 'איזה ספר?',
    packageNote: 'סוגי הספרים מוצגים לבדיקת האבטיפוס. מחיר וזמינות ייקבעו כשהכתיבה האישית תחובר.',
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
    noFacts: 'בלי פרטים נוספים. הסיפור יתבסס על הבחירות שמסרתם.',
    intentNone: 'לא נבחר כיוון מיוחד',
    avoid: (items: readonly string[]) => `בלי: ${items.join(', ')}`,
    photoNone: 'בלי תמונה',
    photoLocal: 'נבחרה תמונה לתצוגה בלבד. באבטיפוס היא לא נשלחת.',
    voice: (label: string | null) => `קריינות: ${label ?? 'עוד לא נבחרה'}`,
    pkg: (label: string | null) => `סוג הספר: ${label ?? 'עוד לא נבחר'}`,
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
      facts_unreviewed: 'יש פרטים שעוד לא אישרתם ברשימה',
      companion_missing: 'עוד לא נבחר חבר להרפתקה',
      contract_violation: 'יש פרט שלא עומד בכללי הבקשה',
    },
  };
}
