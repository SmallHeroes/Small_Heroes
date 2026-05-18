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
  | 'MEDICAL_PROCEDURE'
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
      name: 'הענק בּוּמִי',
      tagline: 'ענק עדין שצעדיו מרעידים את האדמה — וליבו שקט',
      image: '/companions/NOISE_FEAR/footstep_giant.jpg',
      narrativeHook: 'מלמד את הגיבור שבתוך כל קול גדול יש חדר פנימי שקט',
      visualDescription:
        'A gentle giant in soft earth-toned clothes with calm, kind eyes; his enormous footsteps make the ground tremble but his presence feels safe and warm.',
    },
    {
      id: 'song_whale',
      name: 'הלוויתן לוּלִי',
      tagline: 'לוויתן כחול ששירתו מרגיעה אוקיינוסים שלמים',
      image: '/companions/NOISE_FEAR/song_whale.jpg',
      narrativeHook: 'מראה שיש קולות שהם חיבוק ולא סכנה',
      visualDescription:
        'A friendly deep-blue cartoon whale with smooth skin and a gentle smile; a soft bioluminescent hum glows around him as if his song is visible light in calm water.',
    },
    {
      id: 'mole_sheket',
      name: 'החפרפרת חוֹפִי',
      tagline: 'חפרפרת שחיה מתחת לאדמה בשקט מוחלט ומלמדת למצוא את השקט הפנימי',
      image: '/companions/NOISE_FEAR/mole_sheket.jpg',
      narrativeHook: 'בתוך כל רעש יש שכבה של שקט — רק צריך לחפור אליה',
      visualDescription:
        'A small velvety mole with tiny round ears, closed calm eyes, and soft brown fur; wears a cozy knitted scarf; paws hold a little glowing crystal; radiates underground peace and quiet safety.',
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
      name: 'הינשוף בּוּבּוּ',
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
      name: 'הזיקית קִים',
      tagline: 'שובבה שנושאת צבע מכל מקום שהייתה בו',
      image: '/companions/TRANSITION/chameleon_koko.jpg',
      narrativeHook: 'מראה שבכל מקום חדש חלק מהבית נוסע איתך',
      visualDescription:
        'A small playful chameleon with patchwork pastel patches that change gently; a striped scarf; big sweet eyes; looks mischievous and adventurous.',
    },
    {
      id: 'squirrel_navad',
      name: 'הסנאי נוּטִי',
      tagline: 'סנאי שקבר אוצרות של אומץ בכל עץ חדש',
      image: '/companions/TRANSITION/squirrel_navad.jpg',
      narrativeHook: 'כל מקום זר מכיל מתנה מוחבאת',
      visualDescription:
        'A quick nimble squirrel with a tiny knapsack and acorn badges; big ears; a confident stance; always looks ready to hide a “treasure” in a new tree hollow.',
    },
    {
      id: 'turtle_beiti',
      name: 'הצב טוֹלִי',
      tagline: 'הצב שהשריון שלו הוא הבית שלו',
      image: '/companions/TRANSITION/turtle_beiti.jpg',
      narrativeHook: 'בית זה מה שאתה נוסע, לא מה שנשאר מאחור',
      visualDescription:
        'A friendly tortoise with a warm pastel shell patterned like a tiny house roof; soft smile; a small potted plant strapped to the shell for a cozy “home on the back” look.',
    },
  ],
  NEW_SIBLING: [
    {
      id: 'pelican_kis',
      name: 'השקנאי פֵּלִי',
      tagline: 'שקנאי עם כיס שתמיד יש בו מקום לעוד אחד — אהבה לא נגמרת',
      image: '/companions/NEW_SIBLING/pelican_kis.jpg',
      narrativeHook: 'הלב גדל כשמכניסים עוד מישהו פנימה',
      visualDescription:
        'A warm friendly pelican with a large soft pouch, gentle eyes, and fluffy white-cream feathers; the pouch glows softly from within as if full of warmth; wears a tiny bow tie; looks nurturing and proud.',
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
      name: 'הדבורה דְּבוֹרִי',
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
      name: 'האריה לֵיוֹ',
      tagline: 'גור ביישן שמגלה שהשאגה תמיד הייתה בפנים',
      image: '/companions/SELF_CONFIDENCE/lion_shaket.jpg',
      narrativeHook: 'הקול שלך קיים — רק מחכה שתקרא לו',
      visualDescription:
        'A small shy lion cub with a fluffy mane starting to grow, big hesitant eyes, soft round ears; a tiny cape-like scarf; always looks on the edge of a brave roar.',
    },
    {
      id: 'butterfly_zohar',
      name: 'הפרפר זֹהַר',
      tagline: 'פרפר שהיה זחל אפור — וגילה שהשינוי הכי גדול מתחיל מבפנים',
      image: '/companions/SELF_CONFIDENCE/butterfly_zohar.jpg',
      narrativeHook: 'מי שאתה היום הוא לא מי שתהיה מחר',
      visualDescription:
        'A beautiful butterfly with iridescent pastel wings that shimmer between purple and gold; a small friendly face with big warm eyes; a faint cocoon charm around the neck; wings spread wide with confidence.',
    },
    {
      id: 'ant_harutza',
      name: 'הנמלה טִיטִי',
      tagline: 'נמלה זעירה שמזיזה דברים פי מאה מגודלה — גודל לא קובע כוח',
      image: '/companions/SELF_CONFIDENCE/ant_harutza.jpg',
      narrativeHook: 'קטן לא אומר חלש',
      visualDescription:
        'A tiny determined ant with a shiny dark-red carapace, bright expressive eyes, and strong little legs; carries a leaf flag on her back like a cape; stands tall despite being small; looks brave and industrious.',
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
      id: 'hawk_had',
      name: 'הבז רוּפִי',
      tagline: 'בז שרואה עכבר מגובה קילומטר — מלמד לנעול מבט על דבר אחד',
      image: '/companions/FOCUS_LEARNING/hawk_had.jpg',
      narrativeHook: 'ריכוז זה לבחור מה לראות, לא לראות הכל',
      visualDescription:
        'A sleek young hawk with sharp golden eyes, warm brown-cream feathers, and a focused gaze; wears a tiny aviator scarf; wings slightly folded back ready to dive; looks alert, precise, and friendly.',
    },
    {
      id: 'dolphin_shahkan',
      name: 'הדולפין דּוּדִי',
      tagline: 'דולפין שמגלה שהמוח עובד הכי טוב כשמשחקים',
      image: '/companions/FOCUS_LEARNING/dolphin_shahkan.jpg',
      narrativeHook: 'למידה היא משחק — מי שמשחק, זוכר',
      visualDescription:
        'A playful grey-blue dolphin with a wide smile, bright curious eyes, and a small splash crown on its head; carries a tiny book in one flipper; looks joyful and intelligent.',
    },
    {
      id: 'captain_navat',
      name: 'הקפטנית רוֹלִי',
      tagline: 'לוטרת-ים עם כובע קפטן שמנווטת ספינת מחשבות',
      image: '/companions/FOCUS_LEARNING/captain_navat.jpg',
      narrativeHook: 'ריכוז זה הגה, לא כלוב',
      visualDescription:
        'An otter wearing a small captain’s hat and scarf, holding a ship wheel prop; a tiny “thought-bubble ship” made of soft clouds; cheerful and alert.',
    },
  ],
  GENERAL_FEARS: [
    {
      id: 'firefly_namit',
      name: 'הגחלילית נָמִית',
      tagline: 'גחלילית זעירה שנושאת אור קטן לכל מקום חשוך',
      image: '/companions/GENERAL_FEARS/firefly_namit.jpg',
      narrativeHook: 'לא צריך אור גדול — מספיק אחד קטן שנע איתך',
      visualDescription:
        'A tiny cute firefly with a warm yellow-green glowing abdomen, big round friendly eyes, delicate translucent wings, and small antennae; carries a miniature lantern; radiates gentle warmth in darkness.',
    },
    {
      id: 'bunny_ometz',
      name: 'הארנבון בּוּנִי',
      tagline: 'ארנבון שנולד פחדן וגילה שאומץ הוא שריר שאפשר לאמן',
      image: '/companions/GENERAL_FEARS/bunny_ometz.jpg',
      narrativeHook: 'להיות פחדן לא אומר שאתה לא אמיץ',
      visualDescription:
        'A small soft bunny with long floppy ears, wide uncertain eyes that are also brave, and a tiny heart-shaped badge pinned to the chest; fur is cream-white with a blush on the cheeks; looks vulnerable but standing tall.',
    },
    {
      id: 'mongoose_zariz',
      name: 'הנמייה זוּמִי',
      tagline: 'נמייה מהירה וחסרת פחד שפוגשת כל צל פנים אל פנים',
      image: '/companions/GENERAL_FEARS/mongoose_zariz.jpg',
      narrativeHook: 'הפחד מתכווץ כשמסתכלים עליו ישר',
      visualDescription:
        'A sleek agile mongoose with warm brown fur, alert bright eyes, a bushy tail, and a confident stance; wears a tiny explorer vest; looks quick, fearless, and ready for anything.',
    },
  ],
  ANGER_FRUSTRATION: [
    {
      id: 'octopus_seara',
      name: 'התמנון זוּזִי',
      tagline: 'תמנון עם 8 זרועות שמתנפנפות כשהוא כועס — ולומד לכוון כל אחת',
      image: '/companions/ANGER_FRUSTRATION/octopus_seara.jpg',
      narrativeHook: 'כעס הוא אנרגיה — תבחר לאן היא הולכת',
      visualDescription:
        'A small cartoon octopus with expressive eyes, eight curly tentacles in warm orange-red tones; when calm the tentacles are neatly curled, when upset they flail wildly; wears a tiny sailor hat; looks emotional but lovable.',
    },
    {
      id: 'bear_cub_gahal',
      name: 'הדוב דּוֹבִּי',
      tagline: 'גור דובים עם רגשות ענקיים שלומד שנשימה עמוקה היא הכוח הכי גדול',
      image: '/companions/ANGER_FRUSTRATION/bear_cub_gahal.jpg',
      narrativeHook: 'גדול מבפנים לא חייב להיות הרסני',
      visualDescription:
        'A chubby brown bear cub with big expressive eyebrows, warm amber eyes, and large soft paws; a faint warm glow around the chest like inner fire; looks strong but gentle; wears a small woven bracelet.',
    },
    {
      id: 'salamander_lahav',
      name: 'הסלמנדרה רוּמִי',
      tagline: 'סלמנדרת אש שחיה בתוך להבות ואף פעם לא נשרפת',
      image: '/companions/ANGER_FRUSTRATION/salamander_lahav.jpg',
      narrativeHook: 'אפשר לגעת באש בלי שהיא תשרוף אותך',
      visualDescription:
        'A small fire salamander with glossy black skin and bright orange-yellow flame patterns; calm wise eyes; a soft warm glow emanates from the body; looks ancient and peaceful despite living in fire; small and cute.',
    },
  ],
  SENSITIVITY_OVERWHELM: [
    {
      id: 'fawn_tzvi',
      name: 'העופר צְבִי',
      tagline: 'עופר עם אוזניים שקולטות הכל — ולומד אילו קולות לשמוע',
      image: '/companions/SENSITIVITY_OVERWHELM/fawn_tzvi.jpg',
      narrativeHook: 'רגישות היא כוח-על אם יודעים מתי להדליק אותה',
      visualDescription:
        'A young deer fawn with large sensitive ears, big soft brown eyes with long lashes, light spotted coat, and slender legs; looks alert but gentle; a small flower tucked behind one ear; graceful and delicate.',
    },
    {
      id: 'snail_sheli',
      name: 'החילזון שֶׁלִי',
      tagline: 'חילזון שנושא מקום בטוח על הגב ויודע מתי לצאת ומתי להתכנס',
      image: '/companions/SENSITIVITY_OVERWHELM/snail_sheli.jpg',
      narrativeHook: 'מותר להיכנס פנימה — וגם לצאת כשמוכנים',
      visualDescription:
        'A friendly snail with a warm spiral shell painted in soft pastel swirls, two cute eye-stalks with gentle expression, and a small cozy blanket draped over the shell opening; looks safe and peaceful.',
    },
    {
      id: 'kitten_mishi',
      name: 'החתלתול מִשִׁי',
      tagline: 'חתלתול עם שפמים שמרגישים הכל, ושמגלה שהגרגור שלו מרגיע עולמות',
      image: '/companions/SENSITIVITY_OVERWHELM/kitten_mishi.jpg',
      narrativeHook: 'גופך יודע ליצור שקט — תקשיב לו',
      visualDescription:
        'A small fluffy kitten with long sensitive whiskers, soft grey-lavender fur, half-closed peaceful eyes, and a gentle purring posture; curled up slightly; a tiny bell collar; radiates calm and softness.',
    },
  ],
  MEDICAL_PROCEDURE: [
    {
      id: 'starfish_kokhavi',
      name: 'כוכב הים דּוּרִי',
      tagline: 'כוכב ים שמתחדש ומחליף — מראה שהגוף יודע לרפא את עצמו',
      image: '/companions/MEDICAL_PROCEDURE/starfish_kokhavi.jpg',
      narrativeHook: 'הגוף שלך חכם — הוא כבר עובד על זה',
      visualDescription:
        'A cheerful five-pointed starfish in warm coral-pink color with a friendly face, tiny dot eyes, and a gentle smile; one arm has a small bandage as a badge of healing; soft pastel glow around the body; looks resilient and warm.',
    },
    {
      id: 'seahorse_yam',
      name: 'הסוסון גְּלִי',
      tagline: 'סוסון ים עם שריון טבעי שנראה יפה ולא מפחיד',
      image: '/companions/MEDICAL_PROCEDURE/seahorse_yam.jpg',
      narrativeHook: 'הגנה לא חייבת להיות קשה — היא יכולה להיות יפה',
      visualDescription:
        'A small graceful seahorse with iridescent scales in soft turquoise and gold, a curled tail, a proud upright posture, and calm kind eyes; the bony armor plates look like decorative jewelry rather than protection; gentle and elegant.',
    },
    {
      id: 'gecko_rifa',
      name: 'השממית גֵּקִי',
      tagline: 'שממית שמחליפה עור ומצמיחה זנב חדש — מומחית להתחדשות',
      image: '/companions/MEDICAL_PROCEDURE/gecko_rifa.jpg',
      narrativeHook: 'מה שנשבר יכול לגדול מחדש, אפילו יותר חזק',
      visualDescription:
        'A cute small gecko with bright green skin, large friendly eyes with vertical pupils, sticky toe pads, and a regrowing tail tip that glows faintly; wears a tiny leaf cape; looks curious, adaptable, and full of life.',
    },
  ],
  OTHER: [
    {
      id: 'puppy_neeman',
      name: 'הכלבלב רוֹקִי',
      tagline: 'כלבלב שהולך איתך לכל מקום ואף פעם לא מוותר עליך',
      image: '/companions/OTHER/puppy_neeman.jpg',
      narrativeHook: 'לא משנה מה קורה — אני כאן',
      visualDescription:
        'A small golden-brown puppy with floppy ears, big warm brown eyes, a wagging tail, and a loyal expression; wears a tiny red bandana; looks eager, devoted, and always ready to follow you anywhere.',
    },
    {
      id: 'parrot_tzivon',
      name: 'התוכי תּוּתִי',
      tagline: 'תוכי צבעוני שמדבר בשפה שלך ומוצא את הצד המצחיק',
      image: '/companions/OTHER/parrot_tzivon.jpg',
      narrativeHook: 'אפילו ביום אפור אפשר למצוא צבע',
      visualDescription:
        'A colorful cartoon parrot with bright green, yellow, and red feathers, a curved beak in a permanent grin, bright playful eyes, and ruffled head feathers; perches on a small branch; looks chatty and cheerful.',
    },
    {
      id: 'wolf_pup_siyar',
      name: 'גור הזאב לוּלוּ',
      tagline: 'גור זאב צעיר עם אינסטינקט להקה — אף אחד לא הולך לבד',
      image: '/companions/OTHER/wolf_pup_siyar.jpg',
      narrativeHook: 'כוח אמיתי הוא כשמישהו הולך לידך',
      visualDescription:
        'A young wolf pup with soft grey-silver fur, bright blue-grey eyes, pointed ears, and a bushy tail; looks brave but still puppy-cute; wears a small woven friendship bracelet around one paw; pack instinct in every glance.',
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
