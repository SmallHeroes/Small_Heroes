/**
 * Personal-product companions beyond the original six (Guy 2026-10-05: show them all and offer them in the
 * wizard, since the story is written for the child when the book is created, not chosen by topic).
 *
 * IDs, names, genders and the one-line temperament come from Codex's candidate identities of 2026-10-03
 * (pending `personal-companion-character/v3` profiles: the temperament is each profile's `essence`). The card
 * art is the candidate front view, re-framed to the size and footing of the existing card art. These IDs are
 * new identities, never aliases of similarly named legacy companions in `lib/companions.ts`.
 *
 * Being listed here is a wizard choice, NOT illustration qualification: none of these has a character sheet set
 * yet, and the new engine still needs their v3 profiles admitted before it can write with them.
 */
export type PersonalAddedCompanion = {
  id: string;
  /** Display name in the same species-first form as the registry companions. */
  name: string;
  gender: 'male' | 'female';
  /** Public path of the card art, checked on disk before the companion is offered. */
  image: string;
  /** What the story writer gets as the companion's temperament when it has no deep profile. */
  temperament: string;
};

export const PERSONAL_ADDED_COMPANIONS: readonly PersonalAddedCompanion[] = [
  {
    id: 'elephant_momo',
    name: 'הפילון מוֹמוֹ',
    gender: 'male',
    image: '/Images/personal-companions/elephant_momo.webp',
    temperament: 'מומו הוא פילון חזק ועדין שמתעניין ברצינות בדברים זעירים. הוא רוצה ליצור, לבחור ולהפתיע, ולא להיות רק החבר שמבקשים ממנו לסחוב.',
  },
  {
    id: 'turtle_tuk',
    name: 'הצבון טוּק',
    gender: 'male',
    image: '/Images/personal-companions/turtle_tuk.webp',
    temperament: 'טוק הוא הרפתקן נלהב שהראש שלו כבר במקום הבא והשריון עדיין בדרך. הוא רוצה לנסות בעצמו ולא שיחליטו בשבילו שעליו לחכות.',
  },
  {
    id: 'hedgehog_tuti',
    name: 'הקיפודה תּוּתִי',
    gender: 'female',
    image: '/Images/personal-companions/hedgehog_tuti.webp',
    temperament: 'תותי היא חברה חמה, עצמאית וישירה שרוצה לבחור איך מתקרבים אליה. היא יודעת לומר מה אינה רוצה אך לפעמים מתקשה לבקש שמישהו יישאר.',
  },
  {
    id: 'owl_shush',
    name: 'הינשופה שׁוּשׁ',
    gender: 'female',
    image: '/Images/personal-companions/owl_shush.webp',
    temperament: 'שוש היא חברה סקרנית עם דמיון נועז שמוצאת הסבר מלהיב כמעט לכל דבר. לפעמים היא נקשרת לתיאוריה יפה גם כשהפרטים אינם מתאימים לה.',
  },
  {
    id: 'cloud_puf',
    name: 'העננון פּוּף',
    gender: 'male',
    image: '/Images/personal-companions/cloud_puf.webp',
    temperament: 'פוף הוא חבר ענני סקרן שאוהב לצאת לדרך אך נקשר למקומות ולמזכרות. הוא רוצה להשאיר סימן שהיה כאן ולפעמים מנסה לשמור הכול בדיוק כפי שהיה.',
  },
  {
    id: 'kangaroo_nula',
    name: 'הקנגורית נוּלָה',
    gender: 'female',
    image: '/Images/personal-companions/kangaroo_nula.webp',
    temperament: 'נולה היא קנגורית יצירתית שרואה כמה אפשרויות בדבר אחד ורוצה להיות שותפה שממציאה. קשה לה לפעמים להניח לרעיון כדי לבחור במה מתחילים.',
  },
  {
    id: 'dog_zohar',
    name: 'הכלבלבה זֹהַר',
    gender: 'female',
    image: '/Images/personal-companions/dog_zohar.webp',
    temperament: 'זוהר היא כלבלבה נמרצת שאוהבת להופיע ולהמציא משחקים. היא רוצה שיראו את הרעיון ולא רק את הקפיצה המצחיקה, אך לפעמים ההצגה מסתירה מה קורה לידה.',
  },
];

export function getPersonalAddedCompanion(id: string): PersonalAddedCompanion | undefined {
  return PERSONAL_ADDED_COMPANIONS.find((companion) => companion.id === id);
}
