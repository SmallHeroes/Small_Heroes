import 'server-only';

import { existsSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Canonical companion definitions for story + image prompts (server).
 * Kept in sync manually with: `public/JS/companions.js` (client bundle).
 *
 * Category taxonomy v2 (added GENERAL_FEARS, ANGER_FRUSTRATION, SENSITIVITY_OVERWHELM).
 * Total: 11 categories, 46 companions (4–5 per category, except OTHER=3).
 */
export type ChallengeCategory =
  | 'NIGHT_FEAR'
  | 'NOISE_FEAR'
  | 'GENERAL_FEARS'
  | 'ANGER_FRUSTRATION'
  | 'SENSITIVITY_OVERWHELM'
  | 'SOCIAL'
  | 'SELF_CONFIDENCE'
  | 'NEW_SIBLING'
  | 'TRANSITION'
  | 'FOCUS_LEARNING'
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
    {
      id: 'little_shadow',
      name: 'הצל הקטן',
      tagline: 'צל קטן שהיה פחד — ונהיה חבר',
      image: '/companions/NIGHT_FEAR/little_shadow.jpg',
      narrativeHook: 'הדבר שהפחיד הופך לבן־לוויה שצועד לידך',
      visualDescription:
        'A small friendly shadow character shaped like a gentle humanoid outline in deep indigo-purple; two soft glowing eyes, a rounded silhouette, a tiny smile; floats lightly above the ground; never menacing, always warm.',
    },
    {
      id: 'candle_nomad',
      name: 'הנר הנודד',
      tagline: 'נר קטן שהולך לפניך לאורך כל הלילה',
      image: '/companions/NIGHT_FEAR/candle_nomad.jpg',
      narrativeHook: 'אור זעיר מבטל חדר שלם של חושך',
      visualDescription:
        'A small animated candle with a flickering warm flame on top, a waxen body with tiny arms and legs, a painted friendly face; soft golden halo of light around it; walks with a gentle bobbing gait.',
    },
  ],

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
    {
      id: 'startled_bird',
      name: 'ציפור הבהלה',
      tagline: 'ציפור קטנה שקופצת מכל רעש — ותמיד חוזרת',
      image: '/companions/NOISE_FEAR/startled_bird.jpg',
      narrativeHook: 'בהלה היא רגע שחולף, לא מקום שנשארים בו',
      visualDescription:
        'A tiny round cartoon bird with wide surprised eyes and slightly puffed-up pastel feathers; mid-recovery pose — caught between startle and calm; endearing and friendly, with one wing tucked close.',
    },
    {
      id: 'whisper_deer',
      name: 'הצבי הלוחש',
      tagline: 'צבי עדין שלוחש בקולות של יער',
      image: '/companions/NOISE_FEAR/whisper_deer.jpg',
      narrativeHook: 'יש מקומות שהם מקדש של שקט — וצריך רק להיכנס אליהם',
      visualDescription:
        'A graceful small cartoon deer with soft moss-green and cream fur, a tiny tuft of living moss on its head like a crown, gentle kind eyes; surrounded by silently floating leaves; the atmosphere around it feels hushed and protected.',
    },
  ],

  GENERAL_FEARS: [
    {
      id: 'rabbit_yariv',
      name: 'הארנב יריב',
      tagline: 'ארנב זהיר שלא בורח — מקשיב',
      image: '/companions/GENERAL_FEARS/rabbit_yariv.jpg',
      narrativeHook: 'לכבד את הפחד במקום להילחם בו',
      visualDescription:
        'A soft cartoon rabbit with alert upright ears, one ear tipped gently to the side as if listening; warm taupe-grey fur, a small tuft of white on the chest, big calm eyes; posture is still and respectful, not flight-ready.',
    },
    {
      id: 'lighthouse_or',
      name: 'המגדלור אוֹר',
      tagline: 'מגדלור קטן שעומד בסערה ושומר על ספינות',
      image: '/companions/GENERAL_FEARS/lighthouse_or.jpg',
      narrativeHook: 'יש מקום בטוח לחזור אליו, תמיד דולק',
      visualDescription:
        'A small cartoon lighthouse standing on a tiny island, with a smiling face painted on the tower, a soft rotating beam of warm golden light, gentle cartoon clouds and waves around it; looks steady and kind, not imposing.',
    },
    {
      id: 'butterfly_tzipi',
      name: 'הפרפר ציפי',
      tagline: 'פרפר שזוכר את הזחל שהיה',
      image: '/companions/GENERAL_FEARS/butterfly_tzipi.jpg',
      narrativeHook: 'פחד יכול להיות שלב במהלך — לא תחנה סופית',
      visualDescription:
        'A cheerful cartoon butterfly with large warm-toned wings in amber and coral, big friendly eyes, a tiny green leaf-satchel; a small caterpillar-shaped pendant necklace that hints at its past self.',
    },
    {
      id: 'brave_cape',
      name: 'הגלימה האמיצה',
      tagline: 'גלימה קטנה שלובשים כשצריך להיות גדול יותר',
      image: '/companions/GENERAL_FEARS/brave_cape.jpg',
      narrativeHook: 'אומץ הוא חפץ שאפשר ללבוש, לא תכונה שחייבים להוליד',
      visualDescription:
        'A soft deep-red hooded cape floating as if worn by an invisible friend, a small golden heart clasp at the neck, the hood showing a subtle friendly face in its folds; warm and regal, never aggressive.',
    },
  ],

  ANGER_FRUSTRATION: [
    {
      id: 'volcano_tumi',
      name: 'הר געש תומי',
      tagline: 'הר געש שלומד לשחרר אדים בעדינות',
      image: '/companions/ANGER_FRUSTRATION/volcano_tumi.jpg',
      narrativeHook: 'כעס יכול לזרום במנות קטנות במקום להתפרץ',
      visualDescription:
        'A chubby cartoon volcano with a friendly face on its slope, tiny arms hugging itself, soft puffs of steam rising gently from the top; warm red-orange tones but gentle eyes; little wildflowers blooming on the lower slope.',
    },
    {
      id: 'wild_horse',
      name: 'הסוס הפראי',
      tagline: 'סוס פרא שצריך לרוץ כדי להירגע',
      image: '/companions/ANGER_FRUSTRATION/wild_horse.jpg',
      narrativeHook: 'אנרגיה גדולה זקוקה למרחב — לא לכלוב',
      visualDescription:
        'A strong but friendly young horse with a wind-tossed mane in soft autumn colors, gentle eyes, mid-gallop across an open field; tail flowing; expressive and kinetic, never angry-looking or tense.',
    },
    {
      id: 'storm_ruri',
      name: 'הסופה רוּרי',
      tagline: 'סופה קטנה שחולפת תמיד מהר ממה שחשבת',
      image: '/companions/ANGER_FRUSTRATION/storm_ruri.jpg',
      narrativeHook: 'כעס הוא רגעי — והשמש שבה תמיד',
      visualDescription:
        'A playful small cloud character with a friendly face, stylized zigzag lightning shaped like a drawn squiggle, raindrops like tiny beads; a soft rainbow peeking from behind; warm palette softens the storm motif.',
    },
    {
      id: 'kettle_kaki',
      name: 'הקומקום קאקי',
      tagline: 'קומקום קטן ששורק לפני שהוא רותח',
      image: '/companions/ANGER_FRUSTRATION/kettle_kaki.jpg',
      narrativeHook: 'לזהות את האזהרה הפנימית — ולנשום',
      visualDescription:
        'A friendly cartoon kettle with a tiny spout, rounded belly, painted eyes and a gentle smile; a small puff of whistle-steam above the spout; warm cream-and-red enamel color; looks like a reminder, never a scold.',
    },
    {
      id: 'beat_lev',
      name: 'הלב הפועם',
      tagline: 'לב קטן ששואל: רגע, מה אתה מרגיש?',
      image: '/companions/ANGER_FRUSTRATION/beat_lev.jpg',
      narrativeHook: 'הנשימה הראשונה שהופכת תגובה למודעות',
      visualDescription:
        'A small floating heart character with a soft pulsing warm-pink glow, tiny legs, friendly eyes, a delicate halo of a single breath-line circling it; looks reflective and kind, never clinical.',
    },
  ],

  SENSITIVITY_OVERWHELM: [
    {
      id: 'mimosa_rakiki',
      name: 'צמח המימוזה רכיקי',
      tagline: 'צמח שנסגר כשנוגעים בו — ופורח שוב',
      image: '/companions/SENSITIVITY_OVERWHELM/mimosa_rakiki.jpg',
      narrativeHook: 'להסתגר זה לא חולשה — זה התאוששות',
      visualDescription:
        'A small animated mimosa plant with a friendly face on the central stem, tiny fern-like leaves that curl gently on touch, big soft eyes; planted in a small pot shaped like a cozy house; tender and responsive.',
    },
    {
      id: 'shell_sadaf',
      name: 'הצדפה סדף',
      tagline: 'צדפה שסוגרת את עצמה מול הים — ויוצרת פנינה',
      image: '/companions/SENSITIVITY_OVERWHELM/shell_sadaf.jpg',
      narrativeHook: 'יופי נוצר גם מהרגעים שסוגרים את עצמנו',
      visualDescription:
        'A gentle pearlescent seashell character with a small friendly face peeking from inside, soft pastel pink-and-cream colors, a tiny forming pearl visible inside; surrounded by quiet water ripples; serene, not defensive.',
    },
    {
      id: 'dewdrop_tal',
      name: 'טיפת הטל טל',
      tagline: 'טיפה שמשקפת את כל השמים — ולא נהיית השמים',
      image: '/companions/SENSITIVITY_OVERWHELM/dewdrop_tal.jpg',
      narrativeHook: 'אפשר להרגיש הכל בלי להיות הכל',
      visualDescription:
        'A translucent cartoon dewdrop hanging from a green leaf tip, a tiny reflected sky (soft clouds, a bird, a star) visible inside the drop; a subtle friendly eye hint in the water; shimmering, clean, serene.',
    },
    {
      id: 'soft_moon',
      name: 'הירח הרך',
      tagline: 'ירח שאורו עדין תמיד — אף פעם לא צורב',
      image: '/companions/SENSITIVITY_OVERWHELM/soft_moon.jpg',
      narrativeHook: 'יש אור שאפשר לסבול — ואור שאפשר לייצר',
      visualDescription:
        'A warm cartoon crescent moon with a sleepy kind face, a soft amber-pink glow, a tiny tasseled nightcap tilted on one side; small sparkling stars floating around; feels like a gentle nightlight in a child\u2019s room.',
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
    {
      id: 'nightingale_zamir',
      name: 'הזמיר זמיר',
      tagline: 'זמיר שהיה ביישן — ומצא את הלחן שלו',
      image: '/companions/SOCIAL/nightingale_zamir.jpg',
      narrativeHook: 'קול נמצא כשאתה שר את מה שרק אתה יודע',
      visualDescription:
        'A small songbird with warm brown feathers, a soft cream chest, bright expressive eyes; beak slightly open mid-song; tiny musical notes drifting upward; gentle and individual, never flashy.',
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
        'A small round friendly robot with soft rounded metal panels, LED eyes, and a notepad on its chest; looks curious and non-threatening; has little expressive antennae.',
    },
    {
      id: 'seed_garin',
      name: 'הגרעין גרין',
      tagline: 'גרעין קטן שכבר יודע מה הוא יהיה',
      image: '/companions/SELF_CONFIDENCE/seed_garin.jpg',
      narrativeHook: 'הכוח שלך כבר בתוכך — הוא רק מחכה לזמן שלו',
      visualDescription:
        'A tiny friendly seed character with a cracked top revealing a first green sprout, small arms and round eyes, warm golden-brown shell; standing in soft rich soil with a hint of morning light; hopeful and patient.',
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
        'A small chubby dragon with rounded snout, pastel scales, and tiny wing nubs; carries a "guardian\u2019s sash"; friendly eyes; looks protective, not dangerous.',
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
    {
      id: 'elder_wolf',
      name: 'הזאב הבכור זאבי',
      tagline: 'זאב מבוגר שיודע שלהיות ראשון זה תפקיד',
      image: '/companions/NEW_SIBLING/elder_wolf.jpg',
      narrativeHook: 'הבכורה היא כבוד, לא מתחרה',
      visualDescription:
        'A calm adult wolf with soft grey-and-white fur, gentle golden eyes, a slight kind smile; wearing a simple leather collar with a small star pendant; posture is protective and assured, never fierce.',
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
        'A quick nimble squirrel with a tiny knapsack and acorn badges; big ears; a confident stance; always looks ready to hide a "treasure" in a new tree hollow.',
    },
    {
      id: 'turtle_beiti',
      name: 'הצב בֵּיתִי',
      tagline: 'הצב שהשריון שלו הוא הבית שלו',
      image: '/companions/TRANSITION/turtle_beiti.jpg',
      narrativeHook: 'בית זה מה שאתה נושא, לא מה שנשאר מאחור',
      visualDescription:
        'A friendly tortoise with a warm pastel shell patterned like a tiny house roof; soft smile; a small potted plant strapped to the shell for a cozy "home on the back" look.',
    },
    {
      id: 'migrating_bird',
      name: 'הציפור הנודדת נילה',
      tagline: 'ציפור שיודעת שלכל מעבר יש סוף',
      image: '/companions/TRANSITION/migrating_bird.jpg',
      narrativeHook: 'עשיתי את זה קודם — ושרדתי, ועוד איך',
      visualDescription:
        'A graceful cartoon migrating bird with long warm-toned wings, a small travel bag strapped to the back, a tiny compass pendant; mid-flight with a soft gradient sky behind; confident yet gentle.',
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
        'An otter wearing a small captain\u2019s hat and scarf, holding a ship wheel prop; a tiny "thought-bubble ship" made of soft clouds; cheerful and alert.',
    },
    {
      id: 'hummingbird_zomzom',
      name: 'יונק הדבש זומזום',
      tagline: 'יונק דבש שמהיר — אבל תמיד מדייק בפרח אחד',
      image: '/companions/FOCUS_LEARNING/hummingbird_zomzom.jpg',
      narrativeHook: 'מהירות זה לא פיזור — זה דיוק',
      visualDescription:
        'A tiny iridescent hummingbird with shimmering green-and-blue feathers, a long slender beak, rapidly beating wings shown with subtle motion-blur; hovering precisely over one specific flower; elegant and focused.',
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
        'A small floating golden key with tiny wings, a friendly "eye" in the handle, a soft halo; not sharp; looks like a helpful object-character.',
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
