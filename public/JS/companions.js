/**
 * Companion characters per narrative topic bucket (public/JS/companions.js)
 * Keys match COMPANIONS_BY_CATEGORY ids (NOISE_FEAR, …).
 *
 * Server mirror (must stay in sync by hand): `lib/companions.ts`
 */
window.COMPANIONS_BY_CATEGORY = {
  NOISE_FEAR: [
    { id: 'footstep_giant', name: 'הענק תום', tagline: 'ענק עדין שצעדיו מרעידים את האדמה — וליבו שקט', image: '/companions/NOISE_FEAR/footstep_giant.jpg', narrativeHook: 'מלמד את הגיבור שבתוך כל קול גדול יש חדר פנימי שקט' },
    { id: 'song_whale',     name: 'הלוויתן ים',  tagline: 'לוויתן כחול ששירתו מרגיעה אוקיינוסים שלמים',      image: '/companions/NOISE_FEAR/song_whale.jpg',     narrativeHook: 'מראה שיש קולות שהם חיבוק ולא סכנה' },
    { id: 'drum_shelly',    name: 'התוף שלי',   tagline: 'תופון קטן שהופך כל רעש מפחיד לקצב של אומץ',        image: '/companions/NOISE_FEAR/drum_shelly.jpg',    narrativeHook: 'סופג קולות מפחידים ומחזיר אותם כדופק לב רגוע' },
  ],
  NIGHT_FEAR: [
    { id: 'bat_lily',    name: 'העטלף לילי',  tagline: 'רואה בחושך טוב מביום, מוביל בשבילים ידידותיים',  image: '/companions/NIGHT_FEAR/bat_lily.jpg',    narrativeHook: 'מראה שהצללים הם אור שמנוח' },
    { id: 'fox_uri',     name: 'השועל אוּרי',  tagline: 'שועל נחושתי עם עיני פנס שמכיר כל מסלול של הלילה', image: '/companions/NIGHT_FEAR/fox_uri.jpg',     narrativeHook: 'מלמד ערמומיות ובחירה חכמה במקום פחד' },
    { id: 'owl_chacham', name: 'הינשוף חכם',   tagline: 'ינשוף זקן ששומר על העולם בזמן שהוא ישן',          image: '/companions/NIGHT_FEAR/owl_chacham.jpg', narrativeHook: 'נוכחות שקטה ואיתנה בשעות החלשות של הלילה' },
  ],
  TRANSITION: [
    { id: 'chameleon_koko',  name: 'הקמליון קוקו', tagline: 'שובב שנושא צבע מכל מקום שהיה בו',          image: '/companions/TRANSITION/chameleon_koko.jpg',  narrativeHook: 'מראה שבכל מקום חדש חלק מהבית נוסע איתך' },
    { id: 'squirrel_navad',  name: 'הסנאי נוָּד',   tagline: 'סנאי שקבר אוצרות של אומץ בכל עץ חדש',      image: '/companions/TRANSITION/squirrel_navad.jpg',  narrativeHook: 'כל מקום זר מכיל מתנה מוחבאת' },
    { id: 'turtle_beiti',    name: 'הצב בֵּיתִי',    tagline: 'הצב שהשריון שלו הוא הבית שלו',             image: '/companions/TRANSITION/turtle_beiti.jpg',    narrativeHook: 'בית זה מה שאתה נושא, לא מה שנשאר מאחור' },
  ],
  NEW_SIBLING: [
    { id: 'twin_stars',   name: 'הכוכב התאום', tagline: 'כוכב אחד שהתחלק לשניים — והאור שלו רק גדל',    image: '/companions/NEW_SIBLING/twin_stars.jpg',   narrativeHook: 'אהבה מתרבה, לא מתחלקת' },
    { id: 'dragon_dini',  name: 'הדרקון דיני', tagline: 'דרקונון צעיר שמגלה שהכוח שלו גדל כשהוא שומר',  image: '/companions/NEW_SIBLING/dragon_dini.jpg',  narrativeHook: 'להיות אח גדול/ה זה מאפיין של כוח' },
    { id: 'bee_ima',      name: 'הדבורה אִמָּא',  tagline: 'מלכת דבורים בכוורת שגדלה — ויצרה יותר דבש',  image: '/companions/NEW_SIBLING/bee_ima.jpg',      narrativeHook: 'משפחה שמתרחבת מייצרת יותר מתיקות' },
  ],
  SELF_CONFIDENCE: [
    { id: 'lion_shaket', name: 'האריה שֶׁקֶט',  tagline: 'גור ביישן שמגלה שהשאגה תמיד הייתה בפנים',      image: '/companions/SELF_CONFIDENCE/lion_shaket.jpg', narrativeHook: 'הקול שלך קיים — רק מחכה שתקרא לו' },
    { id: 'fairy_zohara',name: 'הפיה זוהרה',    tagline: 'פיה זעירה שאור קטן שלה משנה חדר שלם',         image: '/companions/SELF_CONFIDENCE/fairy_zohara.jpg',narrativeHook: 'גודל לא מגדיר השפעה' },
    { id: 'robot_robi',  name: 'הרובוט רובי',   tagline: 'רובוט שכותב את הקוד של עצמו — בחירה בכל פעם',  image: '/companions/SELF_CONFIDENCE/robot_robi.jpg',  narrativeHook: 'אומץ נבנה מצעדים קטנים עקביים' },
  ],
  SOCIAL: [
    { id: 'panda_anat',    name: 'הפנדה ענת',   tagline: 'פנדה רכה שמגלה שחברים טובים אוהבים גם את השקט', image: '/companions/SOCIAL/panda_anat.jpg',     narrativeHook: 'לא חייבים להיות רועשים כדי להיות נראים' },
    { id: 'bear_mati',     name: 'המַנְצֵחַ מתי', tagline: 'דוב-מנצח שמראה שלכל קול יש מקום בתזמורת',       image: '/companions/SOCIAL/bear_mati.jpg',      narrativeHook: 'שייכות היא על מציאת התפקיד, לא על דומות' },
    { id: 'hedgehog_rachi',name: 'הקיפוד רַכִּי', tagline: 'קיפוד שלומד לרכך קוצים רק לרגע של חיבוק',      image: '/companions/SOCIAL/hedgehog_rachi.jpg', narrativeHook: 'להיות רך בלי לאבד את עצמך' },
  ],
  FOCUS_LEARNING: [
    { id: 'hunter_parparon', name: 'צייד פרפרון',  tagline: 'רוכב-רשת עדין של מחשבות-פרפרים',             image: '/companions/FOCUS_LEARNING/hunter_parparon.jpg', narrativeHook: 'לא תופסים הכל — בוחרים אחד ורצים איתו' },
    { id: 'wizard_abab',     name: 'הקוסם אָבָב',   tagline: 'קוסם שגילה שהאותיות רוקדות למי שרוקד איתן',   image: '/companions/FOCUS_LEARNING/wizard_abab.jpg',     narrativeHook: 'למידה היא ריקוד, לא מאבק' },
    { id: 'captain_navat',   name: 'הקפטן נַוָּט',   tagline: 'לוטרת-ים עם כובע קפטן שמנווט ספינת מחשבות',  image: '/companions/FOCUS_LEARNING/captain_navat.jpg',   narrativeHook: 'ריכוז זה הגה, לא כלוב' },
  ],
  GENERAL_FEARS: [
    { id: 'gf_magic_map',  name: 'המפה הקסומה',   tagline: 'מפה חיה שמציירת את עצמה בזמן שאתה הולך',         image: '/companions/OTHER/magic_map.jpg',  narrativeHook: 'השביל שלך נוצר רק כשאתה הולך בו' },
    { id: 'gf_seer_mirror',name: 'המראָה שָׁמַיִּית', tagline: 'מראה חמה שמראה את מי שאתה הופך להיות',        image: '/companions/OTHER/seer_mirror.jpg',narrativeHook: 'פוגש את עצמך העתידי, לא את הפחד' },
    { id: 'gf_golden_key', name: 'המפתח הזהב',    tagline: 'מפתח מטייל שיודע שלכל מנעול יש צורה',            image: '/companions/OTHER/golden_key.jpg', narrativeHook: 'לכל ילד יש את המפתח הנכון בפנים' },
  ],
  ANGER_FRUSTRATION: [
    { id: 'ang_magic_map',  name: 'המפה הקסומה',   tagline: 'מפה חיה שמציירת את עצמה בזמן שאתה הולך',         image: '/companions/OTHER/magic_map.jpg',  narrativeHook: 'השביל שלך נוצר רק כשאתה הולך בו' },
    { id: 'ang_seer_mirror',name: 'המראָה שָׁמַיִּית', tagline: 'מראה חמה שמראה את מי שאתה הופך להיות',        image: '/companions/OTHER/seer_mirror.jpg',narrativeHook: 'פוגש את עצמך העתידי, לא את הפחד' },
    { id: 'ang_golden_key', name: 'המפתח הזהב',    tagline: 'מפתח מטייל שיודע שלכל מנעול יש צורה',            image: '/companions/OTHER/golden_key.jpg', narrativeHook: 'לכל ילד יש את המפתח הנכון בפנים' },
  ],
  SENSITIVITY_OVERWHELM: [
    { id: 'so_magic_map',  name: 'המפה הקסומה',   tagline: 'מפה חיה שמציירת את עצמה בזמן שאתה הולך',         image: '/companions/OTHER/magic_map.jpg',  narrativeHook: 'השביל שלך נוצר רק כשאתה הולך בו' },
    { id: 'so_seer_mirror',name: 'המראָה שָׁמַיִּית', tagline: 'מראה חמה שמראה את מי שאתה הופך להיות',        image: '/companions/OTHER/seer_mirror.jpg',narrativeHook: 'פוגש את עצמך העתידי, לא את הפחד' },
    { id: 'so_golden_key', name: 'המפתח הזהב',    tagline: 'מפתח מטייל שיודע שלכל מנעול יש צורה',            image: '/companions/OTHER/golden_key.jpg', narrativeHook: 'לכל ילד יש את המפתח הנכון בפנים' },
  ],
  OTHER: [
    { id: 'magic_map',  name: 'המפה הקסומה',  tagline: 'מפה חיה שמציירת את עצמה בזמן שאתה הולך',         image: '/companions/OTHER/magic_map.jpg',  narrativeHook: 'השביל שלך נוצר רק כשאתה הולך בו' },
    { id: 'seer_mirror',name: 'המראָה שָׁמַיִּית', tagline: 'מראה חמה שמראה את מי שאתה הופך להיות',        image: '/companions/OTHER/seer_mirror.jpg',narrativeHook: 'פוגש את עצמך העתידי, לא את הפחד' },
    { id: 'golden_key', name: 'המפתח הזהב',    tagline: 'מפתח מטייל שיודע שלכל מנעול יש צורה',            image: '/companions/OTHER/golden_key.jpg', narrativeHook: 'לכל ילד יש את המפתח הנכון בפנים' },
  ],
};
