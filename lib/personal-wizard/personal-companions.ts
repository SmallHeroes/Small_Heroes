import 'server-only';
import { getCompanionById } from '../companions';

/**
 * Personal-product companions beyond the original six (Guy 2026-10-05: show them all and offer them in the wizard; 2026-10-28: prepare
 * the others so a book can be made with them). Seven come from Codex's 2026-10-03 candidate identities (df728f73: ids, names, genders,
 * temperaments, card art); Tzuki and Mishi come from their admitted literary profiles and have no art yet. These are new identities, never
 * aliases of similarly named legacy companions in `lib/companions.ts`.
 *
 * Listing here is not drawing qualification. A companion becomes selectable only once it has a declared appearance (`visualDescription`),
 * card art and a complete passed sheet set (see companion-identity.ts).
 *
 * The seven pictured descriptions (2026-10-28) were written from the looks Guy approved ("מאשר את כולם"); they are the verbatim lock of
 * their sheet views. They state no size beside the child yet: the isolated sheet proof does not need one, and the scale of a new companion
 * beside the child is decided at its admission (as bunny's description carries a child-relative range).
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
  /** Physical appearance only; null until Guy approves the look. Its size beside the child is added at admission. */
  visualDescription: string | null;
};

export const PERSONAL_ADDED_COMPANIONS: readonly PersonalAddedCompanion[] = [
  { id: 'elephant_momo', name: 'הפילון מוֹמוֹ', gender: 'male', image: '/Images/personal-companions/elephant_momo.webp', visualDescription:
    "A sturdy, huggable young elephant standing upright on two broad hind feet, two relaxed forelegs at his sides. Soft warm-gray body, very large rounded floppy ears with peach-pink insides, rosy cheeks, large warm-brown eyes with soft brows, a little gray tuft on top of his head, and a short, gently curved trunk; no tusks. Three pale toenails on each foot. He always wears exactly one muted-coral neckerchief tied in a single knot on his left side (the viewer's right in a front view); never a hat, bag or other clothing.",
    temperament: 'מומו הוא פילון חזק ועדין שמתעניין ברצינות בדברים זעירים. הוא רוצה ליצור, לבחור ולהפתיע, ולא להיות רק החבר שמבקשים ממנו לסחוב.' },
  { id: 'turtle_tuk', name: 'הצבון טוּק', gender: 'male', image: '/Images/personal-companions/turtle_tuk.webp', visualDescription:
    "A sturdy young land tortoise who walks on four short, thick legs (never upright). Pale sage-green head, neck and legs with soft darker-green spots, rosy cheeks, large warm-brown eyes with soft brows and a gentle smile. A high domed deep teal-green shell of large rounded plates with lighter seams, a warm sand-coloured belly shell, and a short pointed tail. He always wears exactly one mustard-yellow bow tied at the front of his neck; never a hat, bag or other clothing.",
    temperament: 'טוק הוא הרפתקן נלהב שהראש שלו כבר במקום הבא והשריון עדיין בדרך. הוא רוצה לנסות בעצמו ולא שיחליטו בשבילו שעליו לחכות.' },
  { id: 'hedgehog_tuti', name: 'הקיפודה תּוּתִי', gender: 'female', image: '/Images/personal-companions/hedgehog_tuti.webp', visualDescription:
    "A round, cuddly young hedgehog standing upright on two short legs, two small forepaws held in front of her belly. Soft cream-beige face and fluffy belly, warm light-brown arms and feet, two small round ears with pink insides, rosy cheeks, large warm-brown eyes with lashes, a small dark nose and a gentle smile. A full rounded coat of plum-purple spines with pale tips, pointed like soft leaves, framing her head and back. No accessories and no clothing.",
    temperament: 'תותי היא חברה חמה, עצמאית וישירה שרוצה לבחור איך מתקרבים אליה. היא יודעת לומר מה אינה רוצה אך לפעמים מתקשה לבקש שמישהו יישאר.' },
  { id: 'owl_shush', name: 'הינשופה שׁוּשׁ', gender: 'female', image: '/Images/personal-companions/owl_shush.webp', visualDescription:
    "A round, plump, fluffy young owl standing on two small orange-brown feet. Indigo-blue feathered body with soft lilac feather tips on the wings and chest, a large cream face disk, rosy cheeks, large warm-brown eyes with lashes, a small orange beak, and two lilac feather tufts on top of her head. Two folded wings at her sides. No glasses, hat, book or clothing.",
    temperament: 'שוש היא חברה סקרנית עם דמיון נועז שמוצאת הסבר מלהיב כמעט לכל דבר. לפעמים היא נקשרת לתיאוריה יפה גם כשהפרטים אינם מתאימים לה.' },
  { id: 'kangaroo_nula', name: 'הקנגורית נוּלָה', gender: 'female', image: '/Images/personal-companions/kangaroo_nula.webp', visualDescription:
    "A lively young kangaroo standing upright on two long hind feet with dark-brown toes, two small forepaws held in front of her chest, and one long thick tail resting on the ground behind her. Warm tan-pink fur, a cream chest and belly with a natural empty pouch, two tall upright ears with pale pink-cream insides, a little tuft of fur on her head, large warm-brown eyes, a small dark nose and a gentle smile. No accessories and no clothing.",
    temperament: 'נולה היא קנגורית יצירתית שרואה כמה אפשרויות בדבר אחד ורוצה להיות שותפה שממציאה. קשה לה לפעמים להניח לרעיון כדי לבחור במה מתחילים.' },
  { id: 'dog_zohar', name: 'הכלבלבה זֹהַר', gender: 'female', image: '/Images/personal-companions/dog_zohar.webp', visualDescription:
    "A soft, huggable young golden puppy standing upright on two hind legs, two forepaws held up in front of her chest. Warm golden fur, long floppy ears, a cream muzzle, chest and belly, cream paw tips, a fluffy tuft of fur on her head, large warm-brown eyes with lashes, a dark nose, rosy cheeks and a happy smile. One fluffy, gently curled tail. No collar, no clothing, no glow, never flying.",
    temperament: 'זוהר היא כלבלבה נמרצת שאוהבת להופיע ולהמציא משחקים. היא רוצה שיראו את הרעיון ולא רק את הקפיצה המצחיקה, אך לפעמים ההצגה מסתירה מה קורה לידה.' },
  { id: 'cloud_puf', name: 'העננון פּוּף', gender: 'male', image: '/Images/personal-companions/cloud_puf.webp', visualDescription:
    "A soft, friendly cloud creature with no legs, floating just above the ground over a soft shadow. A white fluffy body with a pale-blue tinge and a fine blue-gray outline, built from three big rounded puffs (one on top, one on each side), and two round side paws at the lower front. Large warm-brown eyes with soft brows, rosy cheeks and a small smile. No rain, no lightning, never changes shape into something else.",
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
