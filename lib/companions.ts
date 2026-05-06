import 'server-only';

import { existsSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Canonical companion definitions for story + image prompts (server).
 * Kept in sync manually with: `public/JS/companions.js` (client bundle).
 */
export type ChallengeCategory =
  | 'NOISE_FEAR'
  | 'NIGHT_FEAR'
  | 'TRANSITION'
  | 'NEW_SIBLING'
  | 'SELF_CONFIDENCE'
  | 'SOCIAL'
  | 'FOCUS_LEARNING'
  | 'GENERAL_FEARS'
  | 'ANGER_FRUSTRATION'
  | 'SENSITIVITY_OVERWHELM'
  | 'OTHER';

export type Companion = {
  id: string;
  name: string;
  tagline: string;
  narrativeHook: string;
  image: string;
  /** English, image-prompt friendly — must stay stable for Flux anchors */
  visualDescription: string;
};

export const COMPANIONS_BY_CATEGORY: Record<ChallengeCategory, Companion[]> = {
  NOISE_FEAR: [
    {
      id: 'footstep_giant',
      name: 'הענק תום',
      tagline: 'ענק עדין שצעדיו מרעידים את האדמה — וליבו שקט',
      image: '/companions/NOISE_FEAR/footstep_giant.jpg',
      narrativeHook: 'מלמד את הגיבור שבתוך כל קול גדול יש חדר פנימי שקט',
      visualDescription:
        'A gentle giant in soft earth-toned clothes with calm, kind eyes; his enormous footsteps make the ground tremble but his presence feels safe and warm.',
    },
    {
      id: 'song_whale',
      name: 'הלוויתן ים',
      tagline: 'לוויתן כחול ששירתו מרגיעה אוקיינוסים שלמים',
      image: '/companions/NOISE_FEAR/song_whale.jpg',
      narrativeHook: 'מראה שיש קולות שהם חיבוק ולא סכנה',
      visualDescription:
        'A friendly deep-blue cartoon whale with smooth skin and a gentle smile; a soft bioluminescent hum glows around him as if his song is visible light in calm water.',
    },
    {
      id: 'drum_shelly',
      name: 'התוף שלי',
      tagline: 'תופון קטן שהופך כל רעש מפחיד לקצב של אומץ',
      image: '/companions/NOISE_FEAR/drum_shelly.jpg',
      narrativeHook: 'סופג קולות מפחידים ומחזיר אותם כדופק לב רגוע',
      visualDescription:
        'A small round magical drum on tiny legs with a snare surface that glows softly; a cozy ribbon tied like a belt; looks like a sentient instrument sidekick with dot eyes.',
    },
  ],
  NIGHT_FEAR: [
    {
      id: 'bat_lily',
      name: 'העטלף לילי',
      tagline: 'רואה בחושך טוב מביום, מוביל בשבילים ידידותיים',
      image: '/companions/NIGHT_FEAR/bat_lily.jpg',
      narrativeHook: 'מראה שהצללים הם אור שמנוח',
      visualDescription:
        'A soft-furred night bat with large gentle eyes, tiny fangs, and a friendly face; a small warm lantern pendant around the neck; wings look velvety, not scary.',
    },
    {
      id: 'fox_uri',
      name: 'השועל אוּרי',
      tagline: 'שועל נחושתי עם עיני פנס שמכיר כל מסלול של הלילה',
      image: '/companions/NIGHT_FEAR/fox_uri.jpg',
      narrativeHook: 'מלמד ערמומיות ובחירה חכמה במקום פחד',
      visualDescription:
        'A small copper-tinged fox with warm lantern-like eyes and a fluffy tail; wears a light scarf; always looks clever, alert, and kind, never predatory.',
    },
    {
      id: 'owl_chacham',
      name: 'הינשוף חכם',
      tagline: 'ינשוף זקן ששומר על העולם בזמן שהוא ישן',
      image: '/companions/NIGHT_FEAR/owl_chacham.jpg',
      narrativeHook: 'נוכחות שקטה ואיתנה בשעות החלשות של הלילה',
      visualDescription:
        'A stout wise owl with soft feathers, small spectacles, and sleepy friendly eyes; carries a dim starlight glow on its wings; very calm and grandfatherly in posture.',
    },
  ],
  TRANSITION: [
    {
      id: 'chameleon_koko',
      name: 'הקמליון קוקו',
      tagline: 'שובב שנושא צבע מכל מקום שהיה בו',
      image: '/companions/TRANSITION/chameleon_koko.jpg',
      narrativeHook: 'מראה שבכל מקום חדש חלק מהבית נוסע איתך',
      visualDescription:
        'A small playful chameleon with patchwork pastel patches that change gently; a striped scarf; big sweet eyes; looks mischievous and adventurous.',
    },
    {
      id: 'squirrel_navad',
      name: 'הסנאי נוָּד',
      tagline: 'סנאי שקבר אוצרות של אומץ בכל עץ חדש',
      image: '/companions/TRANSITION/squirrel_navad.jpg',
      narrativeHook: 'כל מקום זר מכיל מתנה מוחבאת',
      visualDescription:
        'A quick nimble squirrel with a tiny knapsack and acorn badges; big ears; a confident stance; always looks ready to hide a “treasure” in a new tree hollow.',
    },
    {
      id: 'turtle_beiti',
      name: 'הצב בֵּיתִי',
      tagline: 'הצב שהשריון שלו הוא הבית שלו',
      image: '/companions/TRANSITION/turtle_beiti.jpg',
      narrativeHook: 'בית זה מה שאתה נוסע, לא מה שנשאר מאחור',
      visualDescription:
        'A friendly tortoise with a warm pastel shell patterned like a tiny house roof; soft smile; a small potted plant strapped to the shell for a cozy “home on the back” look.',
    },
  ],
  NEW_SIBLING: [
    {
      id: 'twin_stars',
      name: 'הכוכב התאום',
      tagline: 'כוכב אחד שהתחלק לשניים — והאור שלו רק גדל',
      image: '/companions/NEW_SIBLING/twin_stars.jpg',
      narrativeHook: 'אהבה מתרבה, לא מתחלקת',
      visualDescription:
        'A tiny humanoid made of two linked golden stars for eyes and head; soft trailing light like a comet; warm glow; feels like love multiplying instead of splitting.',
    },
    {
      id: 'dragon_dini',
      name: 'הדרקון דיני',
      tagline: 'דרקונון צעיר שמגלה שהכוח שלו גדל כשהוא שומר',
      image: '/companions/NEW_SIBLING/dragon_dini.jpg',
      narrativeHook: 'להיות אח גדול/ה זה מאפיין של כוח',
      visualDescription:
        'A small chubby dragon with rounded snout, pastel scales, and tiny wing nubs; carries a “guardian’s sash”; friendly eyes; looks protective, not dangerous.',
    },
    {
      id: 'bee_ima',
      name: 'הדבורה אִמָּא',
      tagline: 'מלכת דבורים בכוורת שגדלה — ויצרה יותר דבש',
      image: '/companions/NEW_SIBLING/bee_ima.jpg',
      narrativeHook: 'משפחה שמתרחבת מייצרת יותר מתיקות',
      visualDescription:
        'A proud bee queen in soft cartoon style, golden and black stripes, small crown, gentle smile; a tiny honeycomb brooch; wings shimmer like warm kitchen light.',
    },
  ],
  SELF_CONFIDENCE: [
    {
      id: 'lion_shaket',
      name: 'האריה שֶׁקֶט',
      tagline: 'גור ביישן שמגלה שהשאגה תמיד הייתה בפנים',
      image: '/companions/SELF_CONFIDENCE/lion_shaket.jpg',
      narrativeHook: 'הקול שלך קיים — רק מחכה שתקרא לו',
      visualDescription:
        'A small shy lion cub with a fluffy mane starting to grow, big hesitant eyes, soft round ears; a tiny cape-like scarf; always looks on the edge of a brave roar.',
    },
    {
      id: 'fairy_zohara',
      name: 'הפיה זוהרה',
      tagline: 'פיה זעירה שאור קטן שלה משנה חדר שלם',
      image: '/companions/SELF_CONFIDENCE/fairy_zohara.jpg',
      narrativeHook: 'גודל לא מגדיר השפעה',
      visualDescription:
        'A minuscule fairy with translucent wings, warm amber glow, short curly hair, and a simple leaf dress; light trails from her like dust sparkles, friendly face.',
    },
    {
      id: 'robot_robi',
      name: 'הרובוט רובי',
      tagline: 'רובוט שכותב את הקוד של עצמו — בחירה בכל פעם',
      image: '/companions/SELF_CONFIDENCE/robot_robi.jpg',
      narrativeHook: 'אומץ נבנה מצעדים קטנים עקביים',
      visualDescription:
        'A small round friendly robot with soft rounded metal panels, LED eyes, and a notepad on its chest; looks curious and non-threatening; has little expressive antenna.',
    },
  ],
  SOCIAL: [
    {
      id: 'panda_anat',
      name: 'הפנדה ענת',
      tagline: 'פנדה רכה שמגלה שחברים טובים אוהבים גם את השקט',
      image: '/companions/SOCIAL/panda_anat.jpg',
      narrativeHook: 'לא חייבים להיות רועשים כדי להיות נראים',
      visualDescription:
        'A soft panda in muted colors, gentle eyes, a small music-note patch on a sweater; posture is quiet and open; very huggable, calm presence.',
    },
    {
      id: 'bear_mati',
      name: 'המַנְצֵחַ מתי',
      tagline: 'דוב-מנצח שמראה שלכל קול יש מקום בתזמורת',
      image: '/companions/SOCIAL/bear_mati.jpg',
      narrativeHook: 'שייכות היא על מציאת התפקיד, לא על דומות',
      visualDescription:
        'A friendly conductor bear in a small tailcoat, holding a light baton; expressive eyebrows; warm smile; not intimidating; slightly theatrical but kind.',
    },
    {
      id: 'hedgehog_rachi',
      name: 'הקיפוד רַכִּי',
      tagline: 'קיפוד שלומד לרכך קוצים רק לרגע של חיבוק',
      image: '/companions/SOCIAL/hedgehog_rachi.jpg',
      narrativeHook: 'להיות רך בלי לאבד את עצמך',
      visualDescription:
        'A small hedgehog with soft pastel quills, round eyes, a gentle blush; a tiny heart-shaped patch; quills can look slightly softened on purpose for hugs.',
    },
  ],
  FOCUS_LEARNING: [
    {
      id: 'hunter_parparon',
      name: 'צייד פרפרון',
      tagline: 'רוכב-רשת עדין של מחשבות-פרפרים',
      image: '/companions/FOCUS_LEARNING/hunter_parparon.jpg',
      narrativeHook: 'לא תופסים הכל — בוחרים אחד ורצים איתו',
      visualDescription:
        'A lanky young rider with a soft butterfly-net staff and airy cloak; small playful butterflies orbit them; light, whimsical; looks focused but not aggressive.',
    },
    {
      id: 'wizard_abab',
      name: 'הקוסם אָבָב',
      tagline: 'קוסם שגילה שהאותיות רוקדות למי שרוקד איתן',
      image: '/companions/FOCUS_LEARNING/wizard_abab.jpg',
      narrativeHook: 'למידה היא ריקוד, לא מאבק',
      visualDescription:
        'A friendly cartoon wizard with a pointed hat covered in letter patches, a swirling wand, bright eyes, soft beard; looks playful and bookish, not stern.',
    },
    {
      id: 'captain_navat',
      name: 'הקפטן נַוָּט',
      tagline: 'לוטרת-ים עם כובע קפטן שמנווט ספינת מחשבות',
      image: '/companions/FOCUS_LEARNING/captain_navat.jpg',
      narrativeHook: 'ריכוז זה הגה, לא כלוב',
      visualDescription:
        'An otter wearing a small captain’s hat and scarf, holding a ship wheel prop; a tiny “thought-bubble ship” made of soft clouds; cheerful and alert.',
    },
  ],
  /** Branching / wizard topics — asset paths mirror `OTHER` until category-specific art exists. */
  GENERAL_FEARS: [
    {
      id: 'gf_magic_map',
      name: 'המפה הקסומה',
      tagline: 'מפה חיה שמציירת את עצמה בזמן שאתה הולך',
      image: '/companions/OTHER/magic_map.jpg',
      narrativeHook: 'השביל שלך נוצר רק כשאתה הולך בו',
      visualDescription:
        'A living paper map with a friendly little paper face, ink lines that wiggle, corners that curl like feet; looks animated and kind, not torn or messy.',
    },
    {
      id: 'gf_seer_mirror',
      name: 'המראָה שָׁמַיִּית',
      tagline: 'מראה חמה שמראה את מי שאתה הופך להיות',
      image: '/companions/OTHER/seer_mirror.jpg',
      narrativeHook: 'פוגש את עצמך העתידי, לא את הפחד',
      visualDescription:
        'A warm hand-held mirror with a sun motif frame; soft gold glow; a gentle face reflected as a kind silhouette, not a horror mirror; very comforting.',
    },
    {
      id: 'gf_golden_key',
      name: 'המפתח הזהב',
      tagline: 'מפתח מטייל שיודע שלכל מנעול יש צורה',
      image: '/companions/OTHER/golden_key.jpg',
      narrativeHook: 'לכל ילד יש את המפתח הנכון בפנים',
      visualDescription:
        'A small floating golden key with tiny wings, a friendly “eye” in the handle, a soft halo; not sharp; looks like a helpful object-character.',
    },
  ],
  ANGER_FRUSTRATION: [
    {
      id: 'ang_magic_map',
      name: 'המפה הקסומה',
      tagline: 'מפה חיה שמציירת את עצמה בזמן שאתה הולך',
      image: '/companions/OTHER/magic_map.jpg',
      narrativeHook: 'השביל שלך נוצר רק כשאתה הולך בו',
      visualDescription:
        'A living paper map with a friendly little paper face, ink lines that wiggle, corners that curl like feet; looks animated and kind, not torn or messy.',
    },
    {
      id: 'ang_seer_mirror',
      name: 'המראָה שָׁמַיִּית',
      tagline: 'מראה חמה שמראה את מי שאתה הופך להיות',
      image: '/companions/OTHER/seer_mirror.jpg',
      narrativeHook: 'פוגש את עצמך העתידי, לא את הפחד',
      visualDescription:
        'A warm hand-held mirror with a sun motif frame; soft gold glow; a gentle face reflected as a kind silhouette, not a horror mirror; very comforting.',
    },
    {
      id: 'ang_golden_key',
      name: 'המפתח הזהב',
      tagline: 'מפתח מטייל שיודע שלכל מנעול יש צורה',
      image: '/companions/OTHER/golden_key.jpg',
      narrativeHook: 'לכל ילד יש את המפתח הנכון בפנים',
      visualDescription:
        'A small floating golden key with tiny wings, a friendly “eye” in the handle, a soft halo; not sharp; looks like a helpful object-character.',
    },
  ],
  SENSITIVITY_OVERWHELM: [
    {
      id: 'so_magic_map',
      name: 'המפה הקסומה',
      tagline: 'מפה חיה שמציירת את עצמה בזמן שאתה הולך',
      image: '/companions/OTHER/magic_map.jpg',
      narrativeHook: 'השביל שלך נוצר רק כשאתה הולך בו',
      visualDescription:
        'A living paper map with a friendly little paper face, ink lines that wiggle, corners that curl like feet; looks animated and kind, not torn or messy.',
    },
    {
      id: 'so_seer_mirror',
      name: 'המראָה שָׁמַיִּית',
      tagline: 'מראה חמה שמראה את מי שאתה הופך להיות',
      image: '/companions/OTHER/seer_mirror.jpg',
      narrativeHook: 'פוגש את עצמך העתידי, לא את הפחד',
      visualDescription:
        'A warm hand-held mirror with a sun motif frame; soft gold glow; a gentle face reflected as a kind silhouette, not a horror mirror; very comforting.',
    },
    {
      id: 'so_golden_key',
      name: 'המפתח הזהב',
      tagline: 'מפתח מטייל שיודע שלכל מנעול יש צורה',
      image: '/companions/OTHER/golden_key.jpg',
      narrativeHook: 'לכל ילד יש את המפתח הנכון בפנים',
      visualDescription:
        'A small floating golden key with tiny wings, a friendly “eye” in the handle, a soft halo; not sharp; looks like a helpful object-character.',
    },
  ],
  OTHER: [
    {
      id: 'magic_map',
      name: 'המפה הקסומה',
      tagline: 'מפה חיה שמציירת את עצמה בזמן שאתה הולך',
      image: '/companions/OTHER/magic_map.jpg',
      narrativeHook: 'השביל שלך נוצר רק כשאתה הולך בו',
      visualDescription:
        'A living paper map with a friendly little paper face, ink lines that wiggle, corners that curl like feet; looks animated and kind, not torn or messy.',
    },
    {
      id: 'seer_mirror',
      name: 'המראָה שָׁמַיִּית',
      tagline: 'מראה חמה שמראה את מי שאתה הופך להיות',
      image: '/companions/OTHER/seer_mirror.jpg',
      narrativeHook: 'פוגש את עצמך העתידי, לא את הפחד',
      visualDescription:
        'A warm hand-held mirror with a sun motif frame; soft gold glow; a gentle face reflected as a kind silhouette, not a horror mirror; very comforting.',
    },
    {
      id: 'golden_key',
      name: 'המפתח הזהב',
      tagline: 'מפתח מטייל שיודע שלכל מנעול יש צורה',
      image: '/companions/OTHER/golden_key.jpg',
      narrativeHook: 'לכל ילד יש את המפתח הנכון בפנים',
      visualDescription:
        'A small floating golden key with tiny wings, a friendly “eye” in the handle, a soft halo; not sharp; looks like a helpful object-character.',
    },
  ],
};

const ALL_COMPANIONS: Companion[] = Object.values(COMPANIONS_BY_CATEGORY).flat();

export function getCompanionById(id: string | null | undefined): Companion | null {
  if (!id || typeof id !== 'string') return null;
  return ALL_COMPANIONS.find((c) => c.id === id) ?? null;
}

export function getCompanionByIdAndCategory(
  id: string | null,
  category: string | null
): Companion | null {
  if (id && typeof id === 'string' && category) {
    const list = COMPANIONS_BY_CATEGORY[category as ChallengeCategory];
    if (list) {
      const found = list.find((c) => c.id === id);
      if (found) return found;
    }
  }
  return getCompanionById(id);
}

const MIN_REFERENCE_BYTES = 100;

/**
 * If `public/companions/...` exists and is > MIN_REFERENCE_BYTES, returns an absolute
 * public URL for the local Next server. Otherwise null (use first-generation anchor).
 */
export function getCompanionReferencePublicUrl(
  companion: Companion,
  baseUrl: string
): string | null {
  const rel = companion.image.replace(/^\//, '');
  const abs = join(process.cwd(), 'public', rel);
  try {
    if (!existsSync(abs)) return null;
    const st = statSync(abs);
    if (!st.isFile() || st.size <= MIN_REFERENCE_BYTES) return null;
  } catch {
    return null;
  }
  const root = baseUrl.replace(/\/+$/, '');
  return `${root}/${rel}`;
}
