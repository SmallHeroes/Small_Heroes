import 'server-only';
import { getCompanionById } from '../companions';

/**
 * Personal-product companions beyond the original six (Guy 2026-10-05: show them all and offer them in the wizard; 2026-10-28: prepare
 * the others so a book can be made with them). Seven come from Codex's 2026-10-03 candidate identities (df728f73: ids, names, genders,
 * temperaments, card art); Tzuki and Mishi come from their admitted literary profiles and have no art yet. These are new identities, never
 * aliases of similarly named legacy companions in `lib/companions.ts`.
 *
 * Listing here is not drawing qualification. A companion becomes selectable only once it has a declared appearance (`visualDescription`,
 * including its size beside the child), card art and a complete passed sheet set (see companion-identity.ts).
 */
export type PersonalAddedCompanion = {
  id: string;
  /** Display name in the same species-first form as the registry companions. */
  name: string;
  gender: 'male' | 'female';
  /** Public path of the card art (checked on disk), or null while there is no approved art. */
  image: string | null;
  /** The one-line temperament (each literary profile's essence). */
  temperament: string;
  /** Physical appearance only, including size beside the child; null until Guy approves the look and its sheet set is made. */
  visualDescription: string | null;
};

export const PERSONAL_ADDED_COMPANIONS: readonly PersonalAddedCompanion[] = [
  { id: 'elephant_momo', name: 'הפילון מוֹמוֹ', gender: 'male', image: '/Images/personal-companions/elephant_momo.webp', visualDescription: null,
    temperament: 'מומו הוא פילון חזק ועדין שמתעניין ברצינות בדברים זעירים. הוא רוצה ליצור, לבחור ולהפתיע, ולא להיות רק החבר שמבקשים ממנו לסחוב.' },
  { id: 'turtle_tuk', name: 'הצבון טוּק', gender: 'male', image: '/Images/personal-companions/turtle_tuk.webp', visualDescription: null,
    temperament: 'טוק הוא הרפתקן נלהב שהראש שלו כבר במקום הבא והשריון עדיין בדרך. הוא רוצה לנסות בעצמו ולא שיחליטו בשבילו שעליו לחכות.' },
  { id: 'hedgehog_tuti', name: 'הקיפודה תּוּתִי', gender: 'female', image: '/Images/personal-companions/hedgehog_tuti.webp', visualDescription: null,
    temperament: 'תותי היא חברה חמה, עצמאית וישירה שרוצה לבחור איך מתקרבים אליה. היא יודעת לומר מה אינה רוצה אך לפעמים מתקשה לבקש שמישהו יישאר.' },
  { id: 'owl_shush', name: 'הינשופה שׁוּשׁ', gender: 'female', image: '/Images/personal-companions/owl_shush.webp', visualDescription: null,
    temperament: 'שוש היא חברה סקרנית עם דמיון נועז שמוצאת הסבר מלהיב כמעט לכל דבר. לפעמים היא נקשרת לתיאוריה יפה גם כשהפרטים אינם מתאימים לה.' },
  { id: 'kangaroo_nula', name: 'הקנגורית נוּלָה', gender: 'female', image: '/Images/personal-companions/kangaroo_nula.webp', visualDescription: null,
    temperament: 'נולה היא קנגורית יצירתית שרואה כמה אפשרויות בדבר אחד ורוצה להיות שותפה שממציאה. קשה לה לפעמים להניח לרעיון כדי לבחור במה מתחילים.' },
  { id: 'dog_zohar', name: 'הכלבלבה זֹהַר', gender: 'female', image: '/Images/personal-companions/dog_zohar.webp', visualDescription: null,
    temperament: 'זוהר היא כלבלבה נמרצת שאוהבת להופיע ולהמציא משחקים. היא רוצה שיראו את הרעיון ולא רק את הקפיצה המצחיקה, אך לפעמים ההצגה מסתירה מה קורה לידה.' },
  { id: 'cloud_puf', name: 'העננון פּוּף', gender: 'male', image: '/Images/personal-companions/cloud_puf.webp', visualDescription: null,
    temperament: 'פוף הוא חבר ענני סקרן שאוהב לצאת לדרך אך נקשר למקומות ולמזכרות. הוא רוצה להשאיר סימן שהיה כאן ולפעמים מנסה לשמור הכול בדיוק כפי שהיה.' },
  { id: 'ibex_tzuki', name: 'היעלון צוּקִי', gender: 'male', image: null, visualDescription: null,
    temperament: 'צוקי הוא יעלון חיוני, סקרן ומשחקי, אוהב לנסות ולגלות נקודת מבט חדשה. הוא יכול לפרגן, לשתף פעולה או לאתגר בחביבות בלי להפוך כל דבר לתחרות.' },
  { id: 'mole_mishi', name: 'החפרפרת מִישִׁי', gender: 'female', image: null, visualDescription: null,
    temperament: 'מישי היא חפרפרת סקרנית, חמימה ומעשית, נהנית לגלות דרך מגע ותנועה. היא יכולה לשחק, להציע או להקשיב בלי שכל סיפור יהפוך למסע מתחת לאדמה.' },
];

export function getPersonalAddedCompanion(id: string): PersonalAddedCompanion | undefined {
  return PERSONAL_ADDED_COMPANIONS.find((companion) => companion.id === id);
}

/**
 * The one visual authority the engine uses for ANY companion: the legacy registry when it has the id (fields exactly as before, so
 * the six's appearance snapshots and digests do not change), otherwise the added personal companion. Unknown ids resolve to null.
 */
export function personalCompanionVisual(id: string) {
  const registry = getCompanionById(id);
  if (registry) return { id: registry.id, name: registry.name, description: registry.visualDescription,
    appearanceStateAuthority: registry.appearanceStateAuthority ?? null, source: 'lib/companions.ts' as const };
  const added = getPersonalAddedCompanion(id);
  if (added) return { id: added.id, name: added.name, description: added.visualDescription ?? '', appearanceStateAuthority: null,
    source: 'lib/personal-wizard/personal-companions.ts' as const };
  return null;
}
