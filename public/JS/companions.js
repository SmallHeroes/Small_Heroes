/**
 * Companion characters per narrative topic bucket (public/JS/companions.js)
 * Keys match COMPANIONS_BY_CATEGORY ids (NIGHT_FEAR, NOISE_FEAR, …).
 *
 * Server mirror (must stay in sync by hand): `lib/companions.ts`
 *
 * Category taxonomy v2 — added GENERAL_FEARS, ANGER_FRUSTRATION, SENSITIVITY_OVERWHELM.
 * 11 categories, 46 companions total.
 */
window.COMPANIONS_BY_CATEGORY = {
  NIGHT_FEAR: [
    { id: 'bat_lily',       name: 'העטלף לילי',   tagline: 'רואה בחושך טוב מביום, מוביל בשבילים ידידותיים',  image: '/companions/NIGHT_FEAR/bat_lily.jpg',       narrativeHook: 'מראה שהצללים הם אור שמנוח' },
    { id: 'fox_uri',        name: 'השועל אוּרי',   tagline: 'שועל נחושתי עם עיני פנס שמכיר כל מסלול של הלילה', image: '/companions/NIGHT_FEAR/fox_uri.jpg',        narrativeHook: 'מלמד ערמומיות ובחירה חכמה במקום פחד' },
    { id: 'owl_chacham',    name: 'הינשוף חכם',    tagline: 'ינשוף זקן ששומר על העולם בזמן שהוא ישן',          image: '/companions/NIGHT_FEAR/owl_chacham.jpg',    narrativeHook: 'נוכחות שקטה ואיתנה בשעות החלשות של הלילה' },
    { id: 'little_shadow',  name: 'הצל הקטן',     tagline: 'צל קטן שהיה פחד — ונהיה חבר',                    image: '/companions/NIGHT_FEAR/little_shadow.jpg',  narrativeHook: 'הדבר שהפחיד הופך לבן־לוויה שצועד לידך' },
    { id: 'candle_nomad',   name: 'הנר הנודד',     tagline: 'נר קטן שהולך לפניך לאורך כל הלילה',              image: '/companions/NIGHT_FEAR/candle_nomad.jpg',   narrativeHook: 'אור זעיר מבטל חדר שלם של חושך' },
  ],
  NOISE_FEAR: [
    { id: 'footstep_giant', name: 'הענק תום',     tagline: 'ענק עדין שצעדיו מרעידים את האדמה — וליבו שקט',   image: '/companions/NOISE_FEAR/footstep_giant.jpg', narrativeHook: 'מלמד את הגיבור שבתוך כל קול גדול יש חדר פנימי שקט' },
    { id: 'song_whale',     name: 'הלוויתן ים',    tagline: 'לוויתן כחול ששירתו מרגיעה אוקיינוסים שלמים',     image: '/companions/NOISE_FEAR/song_whale.jpg',     narrativeHook: 'מראה שיש קולות שהם חיבוק ולא סכנה' },
    { id: 'drum_shelly',    name: 'התוף שלי',     tagline: 'תופון קטן שהופך כל רעש מפחיד לקצב של אומץ',       image: '/companions/NOISE_FEAR/drum_shelly.jpg',    narrativeHook: 'סופג קולות מפחידים ומחזיר אותם כדופק לב רגוע' },
    { id: 'startled_bird',  name: 'ציפור הבהלה',   tagline: 'ציפור קטנה שקופצת מכל רעש — ותמיד חוזרת',         image: '/companions/NOISE_FEAR/startled_bird.jpg',  narrativeHook: 'בהלה היא רגע שחולף, לא מקום שנשארים בו' },
    { id: 'whisper_deer',   name: 'הצבי הלוחש',    tagline: 'צבי עדין שלוחש בקולות של יער',                   image: '/companions/NOISE_FEAR/whisper_deer.jpg',   narrativeHook: 'יש מקומות שהם מקדש של שקט — וצריך רק להיכנס אליהם' },
  ],
  GENERAL_FEARS: [
    { id: 'rabbit_yariv',    name: 'הארנב יריב',    tagline: 'ארנב זהיר שלא בורח — מקשיב',                    image: '/companions/GENERAL_FEARS/rabbit_yariv.jpg',    narrativeHook: 'לכבד את הפחד במקום להילחם בו' },
    { id: 'lighthouse_or',   name: 'המגדלור אוֹר',  tagline: 'מגדלור קטן שעומד בסערה ושומר על ספינות',         image: '/companions/GENERAL_FEARS/lighthouse_or.jpg',   narrativeHook: 'יש מקום בטוח לחזור אליו, תמיד דולק' },
    { id: 'butterfly_tzipi', name: 'הפרפר ציפי',   tagline: 'פרפר שזוכר את הזחל שהיה',                        image: '/companions/GENERAL_FEARS/butterfly_tzipi.jpg', narrativeHook: 'פחד יכול להיות שלב במהלך — לא תחנה סופית' },
    { id: 'brave_cape',      name: 'הגלימה האמיצה', tagline: 'גלימה קטנה שלובשים כשצריך להיות גדול יותר',     image: '/companions/GENERAL_FEARS/brave_cape.jpg',      narrativeHook: 'אומץ הוא חפץ שאפשר ללבוש, לא תכונה שחייבים להוליד' },
  ],
  ANGER_FRUSTRATION: [
    { id: 'volcano_tumi', name: 'הר געש תומי',  tagline: 'הר געש שלומד לשחרר אדים בעדינות',       image: '/companions/ANGER_FRUSTRATION/volcano_tumi.jpg', narrativeHook: 'כעס יכול לזרום במנות קטנות במקום להתפרץ' },
    { id: 'wild_horse',   name: 'הסוס הפראי',    tagline: 'סוס פרא שצריך לרוץ כדי להירגע',           image: '/companions/ANGER_FRUSTRATION/wild_horse.jpg',   narrativeHook: 'אנרגיה גדולה זקוקה למרחב — לא לכלוב' },
    { id: 'storm_ruri',   name: 'הסופה רוּרי',    tagline: 'סופה קטנה שחולפת תמיד מהר ממה שחשבת',     image: '/companions/ANGER_FRUSTRATION/storm_ruri.jpg',   narrativeHook: 'כעס הוא רגעי — והשמש שבה תמיד' },
    { id: 'kettle_kaki',  name: 'הקומקום קאקי',   tagline: 'קומקום קטן ששורק לפני שהוא רותח',         image: '/companions/ANGER_FRUSTRATION/kettle_kaki.jpg',  narrativeHook: 'לזהות את האזהרה הפנימית — ולנשום' },
    { id: 'beat_lev',     name: 'הלב הפועם',      tagline: 'לב קטן ששואל: רגע, מה אתה מרגיש?',        image: '/companions/ANGER_FRUSTRATION/beat_lev.jpg',     narrativeHook: 'הנשימה הראשונה שהופכת תגובה למודעות' },
  ],
  SENSITIVITY_OVERWHELM: [
    { id: 'mimosa_rakiki', name: 'צמח המימוזה רכיקי', tagline: 'צמח שנסגר כשנוגעים בו — ופורח שוב',       image: '/companions/SENSITIVITY_OVERWHELM/mimosa_rakiki.jpg', narrativeHook: 'להסתגר זה לא חולשה — זה התאוששות' },
    { id: 'shell_sadaf',   name: 'הצדפה סדף',          tagline: 'צדפה שסוגרת את עצמה מול הים — ויוצרת פנינה', image: '/companions/SENSITIVITY_OVERWHELM/shell_sadaf.jpg',   narrativeHook: 'יופי נוצר גם מהרגעים שסוגרים את עצמנו' },
    { id: 'dewdrop_tal',   name: 'טיפת הטל טל',        tagline: 'טיפה שמשקפת את כל השמים — ולא נהיית השמים',  image: '/companions/SENSITIVITY_OVERWHELM/dewdrop_tal.jpg',   narrativeHook: 'אפשר להרגיש הכל בלי להיות הכל' },
    { id: 'soft_moon',     name: 'הירח הרך',           tagline: 'ירח שאורו עדין תמיד — אף פעם לא צורב',       image: '/companions/SENSITIVITY_OVERWHELM/soft_moon.jpg',     narrativeHook: 'יש אור שאפשר לסבול — ואור שאפשר לייצר' },
  ],
  SOCIAL: [
    { id: 'panda_anat',        name: 'הפנדה ענת',    tagline: 'פנדה רכה שמגלה שחברים טובים אוהבים גם את השקט', image: '/companions/SOCIAL/panda_anat.jpg',        narrativeHook: 'לא חייבים להיות רועשים כדי להיות נראים' },
    { id: 'bear_mati',         name: 'המַנְצֵחַ מתי', tagline: 'דוב-מנצח שמראה שלכל קול יש מקום בתזמורת',       image: '/companions/SOCIAL/bear_mati.jpg',         narrativeHook: 'שייכות היא על מציאת התפקיד, לא על דומות' },
    { id: 'hedgehog_rachi',    name: 'הקיפוד רַכִּי', tagline: 'קיפוד שלומד לרכך קוצים רק לרגע של חיבוק',       image: '/companions/SOCIAL/hedgehog_rachi.jpg',    narrativeHook: 'להיות רך בלי לאבד את עצמך' },
    { id: 'nightingale_zamir', name: 'הזמיר זמיר',   tagline: 'זמיר שהיה ביישן — ומצא את הלחן שלו',            image: '/companions/SOCIAL/nightingale_zamir.jpg', narrativeHook: 'קול נמצא כשאתה שר את מה שרק אתה יודע' },
  ],
  SELF_CONFIDENCE: [
    { id: 'lion_shaket',  name: 'האריה שֶׁקֶט',  tagline: 'גור ביישן שמגלה שהשאגה תמיד הייתה בפנים',     image: '/companions/SELF_CONFIDENCE/lion_shaket.jpg',  narrativeHook: 'הקול שלך קיים — רק מחכה שתקרא לו' },
    { id: 'fairy_zohara', name: 'הפיה זוהרה',     tagline: 'פיה זעירה שאור קטן שלה משנה חדר שלם',        image: '/companions/SELF_CONFIDENCE/fairy_zohara.jpg', narrativeHook: 'גודל לא מגדיר השפעה' },
    { id: 'robot_robi',   name: 'הרובוט רובי',    tagline: 'רובוט שכותב את הקוד של עצמו — בחירה בכל פעם', image: '/companions/SELF_CONFIDENCE/robot_robi.jpg',   narrativeHook: 'אומץ נבנה מצעדים קטנים עקביים' },
    { id: 'seed_garin',   name: 'הגרעין גרין',    tagline: 'גרעין קטן שכבר יודע מה הוא יהיה',             image: '/companions/SELF_CONFIDENCE/seed_garin.jpg',   narrativeHook: 'הכוח שלך כבר בתוכך — הוא רק מחכה לזמן שלו' },
  ],
  NEW_SIBLING: [
    { id: 'twin_stars',  name: 'הכוכב התאום',   tagline: 'כוכב אחד שהתחלק לשניים — והאור שלו רק גדל',  image: '/companions/NEW_SIBLING/twin_stars.jpg',  narrativeHook: 'אהבה מתרבה, לא מתחלקת' },
    { id: 'dragon_dini', name: 'הדרקון דיני',   tagline: 'דרקונון צעיר שמגלה שהכוח שלו גדל כשהוא שומר', image: '/companions/NEW_SIBLING/dragon_dini.jpg', narrativeHook: 'להיות אח גדול/ה זה מאפיין של כוח' },
    { id: 'bee_ima',     name: 'הדבורה אִמָּא',   tagline: 'מלכת דבורים בכוורת שגדלה — ויצרה יותר דבש', image: '/companions/NEW_SIBLING/bee_ima.jpg',     narrativeHook: 'משפחה שמתרחבת מייצרת יותר מתיקות' },
    { id: 'elder_wolf',  name: 'הזאב הבכור זאבי', tagline: 'זאב מבוגר שיודע שלהיות ראשון זה תפקיד',      image: '/companions/NEW_SIBLING/elder_wolf.jpg',  narrativeHook: 'הבכורה היא כבוד, לא מתחרה' },
  ],
  TRANSITION: [
    { id: 'chameleon_koko', name: 'הקמליון קוקו',      tagline: 'שובב שנושא צבע מכל מקום שהיה בו',       image: '/companions/TRANSITION/chameleon_koko.jpg', narrativeHook: 'מראה שבכל מקום חדש חלק מהבית נוסע איתך' },
    { id: 'squirrel_navad', name: 'הסנאי נוָּד',        tagline: 'סנאי שקבר אוצרות של אומץ בכל עץ חדש',   image: '/companions/TRANSITION/squirrel_navad.jpg', narrativeHook: 'כל מקום זר מכיל מתנה מוחבאת' },
    { id: 'turtle_beiti',   name: 'הצב בֵּיתִי',          tagline: 'הצב שהשריון שלו הוא הבית שלו',          image: '/companions/TRANSITION/turtle_beiti.jpg',   narrativeHook: 'בית זה מה שאתה נושא, לא מה שנשאר מאחור' },
    { id: 'migrating_bird', name: 'הציפור הנודדת נילה', tagline: 'ציפור שיודעת שלכל מעבר יש סוף',         image: '/companions/TRANSITION/migrating_bird.jpg', narrativeHook: 'עשיתי את זה קודם — ושרדתי, ועוד איך' },
  ],
  FOCUS_LEARNING: [
    { id: 'hunter_parparon',    name: 'צייד פרפרון',     tagline: 'רוכב-רשת עדין של מחשבות-פרפרים',          image: '/companions/FOCUS_LEARNING/hunter_parparon.jpg',    narrativeHook: 'לא תופסים הכל — בוחרים אחד ורצים איתו' },
    { id: 'wizard_abab',        name: 'הקוסם אָבָב',       tagline: 'קוסם שגילה שהאותיות רוקדות למי שרוקד איתן', image: '/companions/FOCUS_LEARNING/wizard_abab.jpg',        narrativeHook: 'למידה היא ריקוד, לא מאבק' },
    { id: 'captain_navat',      name: 'הקפטן נַוָּט',       tagline: 'לוטרת-ים עם כובע קפטן שמנווט ספינת מחשבות', image: '/companions/FOCUS_LEARNING/captain_navat.jpg',      narrativeHook: 'ריכוז זה הגה, לא כלוב' },
    { id: 'hummingbird_zomzom', name: 'יונק הדבש זומזום', tagline: 'יונק דבש שמהיר — אבל תמיד מדייק בפרח אחד', image: '/companions/FOCUS_LEARNING/hummingbird_zomzom.jpg', narrativeHook: 'מהירות זה לא פיזור — זה דיוק' },
  ],
  OTHER: [
    { id: 'magic_map',   name: 'המפה הקסומה',    tagline: 'מפה חיה שמציירת את עצמה בזמן שאתה הולך', image: '/companions/OTHER/magic_map.jpg',   narrativeHook: 'השביל שלך נוצר רק כשאתה הולך בו' },
    { id: 'seer_mirror', name: 'המראָה שָׁמַיִּית', tagline: 'מראה חמה שמראה את מי שאתה הופך להיות',   image: '/companions/OTHER/seer_mirror.jpg', narrativeHook: 'פוגש את עצמך העתידי, לא את הפחד' },
    { id: 'golden_key',  name: 'המפתח הזהב',     tagline: 'מפתח מטייל שיודע שלכל מנעול יש צורה',     image: '/companions/OTHER/golden_key.jpg',  narrativeHook: 'לכל ילד יש את המפתח הנכון בפנים' },
  ],
};
