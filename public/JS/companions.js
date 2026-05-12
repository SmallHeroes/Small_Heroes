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
    { id: 'mole_sheket',    name: 'החפרפרת שֶׁקֶט', tagline: 'חפרפרת שחיה מתחת לאדמה בשקט מוחלט ומלמדת למצוא את השקט הפנימי', image: '/companions/NOISE_FEAR/mole_sheket.jpg', narrativeHook: 'בתוך כל רעש יש שכבה של שקט — רק צריך לחפור אליה' },
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
    { id: 'pelican_kis',  name: 'השקנאי כִּיס',  tagline: 'שקנאי עם כיס שתמיד יש בו מקום לעוד אחד — אהבה לא נגמרת', image: '/companions/NEW_SIBLING/pelican_kis.jpg',  narrativeHook: 'הלב גדל כשמכניסים עוד מישהו פנימה' },
    { id: 'dragon_dini',  name: 'הדרקון דיני', tagline: 'דרקונון צעיר שמגלה שהכוח שלו גדל כשהוא שומר',  image: '/companions/NEW_SIBLING/dragon_dini.jpg',  narrativeHook: 'להיות אח גדול/ה זה מאפיין של כוח' },
    { id: 'bee_ima',      name: 'הדבורה אִמָּא',  tagline: 'מלכת דבורים בכוורת שגדלה — ויצרה יותר דבש',  image: '/companions/NEW_SIBLING/bee_ima.jpg',      narrativeHook: 'משפחה שמתרחבת מייצרת יותר מתיקות' },
  ],
  SELF_CONFIDENCE: [
    { id: 'lion_shaket',     name: 'האריה שֶׁקֶט',  tagline: 'גור ביישן שמגלה שהשאגה תמיד הייתה בפנים',      image: '/companions/SELF_CONFIDENCE/lion_shaket.jpg',     narrativeHook: 'הקול שלך קיים — רק מחכה שתקרא לו' },
    { id: 'butterfly_zohar', name: 'הפרפר זֹהַר',    tagline: 'פרפר שהיה זחל אפור — וגילה שהשינוי הכי גדול מתחיל מבפנים', image: '/companions/SELF_CONFIDENCE/butterfly_zohar.jpg', narrativeHook: 'מי שאתה היום הוא לא מי שתהיה מחר' },
    { id: 'ant_harutza',     name: 'הנמלה חֲרוּצָה',  tagline: 'נמלה זעירה שמזיזה דברים פי מאה מגודלה — גודל לא קובע כוח', image: '/companions/SELF_CONFIDENCE/ant_harutza.jpg',     narrativeHook: 'קטן לא אומר חלש' },
  ],
  SOCIAL: [
    { id: 'panda_anat',    name: 'הפנדה ענת',   tagline: 'פנדה רכה שמגלה שחברים טובים אוהבים גם את השקט', image: '/companions/SOCIAL/panda_anat.jpg',     narrativeHook: 'לא חייבים להיות רועשים כדי להיות נראים' },
    { id: 'bear_mati',     name: 'המַנְצֵחַ מתי', tagline: 'דוב-מנצח שמראה שלכל קול יש מקום בתזמורת',       image: '/companions/SOCIAL/bear_mati.jpg',      narrativeHook: 'שייכות היא על מציאת התפקיד, לא על דומות' },
    { id: 'hedgehog_rachi',name: 'הקיפוד רַכִּי', tagline: 'קיפוד שלומד לרכך קוצים רק לרגע של חיבוק',      image: '/companions/SOCIAL/hedgehog_rachi.jpg', narrativeHook: 'להיות רך בלי לאבד את עצמך' },
  ],
  FOCUS_LEARNING: [
    { id: 'hawk_had',          name: 'הבז חַד',         tagline: 'בז שרואה עכבר מגובה קילומטר — מלמד לנעול מבט על דבר אחד', image: '/companions/FOCUS_LEARNING/hawk_had.jpg',          narrativeHook: 'ריכוז זה לבחור מה לראות, לא לראות הכל' },
    { id: 'dolphin_shahkan',   name: 'הדולפין שַׁחְקָן',  tagline: 'דולפין שמגלה שהמוח עובד הכי טוב כשמשחקים',   image: '/companions/FOCUS_LEARNING/dolphin_shahkan.jpg',   narrativeHook: 'למידה היא משחק — מי שמשחק, זוכר' },
    { id: 'captain_navat',     name: 'הקפטן נַוָּט',      tagline: 'לוטרת-ים עם כובע קפטן שמנווט ספינת מחשבות',  image: '/companions/FOCUS_LEARNING/captain_navat.jpg',     narrativeHook: 'ריכוז זה הגה, לא כלוב' },
  ],
  GENERAL_FEARS: [
    { id: 'firefly_namit',   name: 'הגחלילית נָמִית', tagline: 'גחלילית זעירה שנושאת אור קטן לכל מקום חשוך',                     image: '/companions/GENERAL_FEARS/firefly_namit.jpg',   narrativeHook: 'לא צריך אור גדול — מספיק אחד קטן שנע איתך' },
    { id: 'bunny_ometz',     name: 'הארנבון אוֹמֵץ',  tagline: 'ארנבון שנולד פחדן וגילה שאומץ הוא שריר שאפשר לאמן',            image: '/companions/GENERAL_FEARS/bunny_ometz.jpg',     narrativeHook: 'להיות פחדן לא אומר שאתה לא אמיץ' },
    { id: 'mongoose_zariz',  name: 'הנמייה זָרִיז',   tagline: 'נמייה מהירה וחסרת פחד שפוגשת כל צל פנים אל פנים',              image: '/companions/GENERAL_FEARS/mongoose_zariz.jpg',  narrativeHook: 'הפחד מתכווץ כשמסתכלים עליו ישר' },
  ],
  ANGER_FRUSTRATION: [
    { id: 'octopus_seara',      name: 'התמנון סְעָרָה',     tagline: 'תמנון עם 8 זרועות שמתנפנפות כשהוא כועס — ולומד לכוון כל אחת',           image: '/companions/ANGER_FRUSTRATION/octopus_seara.jpg',      narrativeHook: 'כעס הוא אנרגיה — תבחר לאן היא הולכת' },
    { id: 'bear_cub_gahal',     name: 'הדוב גַּחַל',        tagline: 'גור דובים עם רגשות ענקיים שלומד שנשימה עמוקה היא הכוח הכי גדול',       image: '/companions/ANGER_FRUSTRATION/bear_cub_gahal.jpg',     narrativeHook: 'גדול מבפנים לא חייב להיות הרסני' },
    { id: 'salamander_lahav',   name: 'הסלמנדרה לַהַב',    tagline: 'סלמנדרת אש שחיה בתוך להבות ואף פעם לא נשרפת',                           image: '/companions/ANGER_FRUSTRATION/salamander_lahav.jpg',   narrativeHook: 'אפשר לגעת באש בלי שהיא תשרוף אותך' },
  ],
  SENSITIVITY_OVERWHELM: [
    { id: 'fawn_tzvi',     name: 'העופר צְבִי',       tagline: 'עופר עם אוזניים שקולטות הכל — ולומד אילו קולות לשמוע',                    image: '/companions/SENSITIVITY_OVERWHELM/fawn_tzvi.jpg',     narrativeHook: 'רגישות היא כוח-על אם יודעים מתי להדליק אותה' },
    { id: 'snail_sheli',  name: 'החילזון שֶׁלִי',     tagline: 'חילזון שנושא מקום בטוח על הגב ויודע מתי לצאת ומתי להתכנס',              image: '/companions/SENSITIVITY_OVERWHELM/snail_sheli.jpg',   narrativeHook: 'מותר להיכנס פנימה — וגם לצאת כשמוכנים' },
    { id: 'kitten_mishi', name: 'החתלתול מִשִׁי',     tagline: 'חתלתול עם שפמים שמרגישים הכל, ושמגלה שהגרגור שלו מרגיע עולמות',        image: '/companions/SENSITIVITY_OVERWHELM/kitten_mishi.jpg',  narrativeHook: 'גופך יודע ליצור שקט — תקשיב לו' },
  ],
  MEDICAL_PROCEDURE: [
    { id: 'starfish_kokhavi', name: 'כוכב הים כּוֹכָבִי', tagline: 'כוכב ים שמתחדש ומחליף — מראה שהגוף יודע לרפא את עצמו',               image: '/companions/MEDICAL_PROCEDURE/starfish_kokhavi.jpg', narrativeHook: 'הגוף שלך חכם — הוא כבר עובד על זה' },
    { id: 'seahorse_yam',    name: 'הסוסון יָם',         tagline: 'סוסון ים עם שריון טבעי שנראה יפה ולא מפחיד',                           image: '/companions/MEDICAL_PROCEDURE/seahorse_yam.jpg',    narrativeHook: 'הגנה לא חייבת להיות קשה — היא יכולה להיות יפה' },
    { id: 'gecko_rifa',      name: 'השממית רִפְאָה',     tagline: 'שממית שמחליפה עור ומצמיחה זנב חדש — מומחית להתחדשות',                   image: '/companions/MEDICAL_PROCEDURE/gecko_rifa.jpg',      narrativeHook: 'מה שנשבר יכול לגדול מחדש, אפילו יותר חזק' },
  ],
  OTHER: [
    { id: 'puppy_neeman',    name: 'הכלבלב נֶאֱמָן',    tagline: 'כלבלב שהולך איתך לכל מקום ואף פעם לא מוותר עליך',                     image: '/companions/OTHER/puppy_neeman.jpg',    narrativeHook: 'לא משנה מה קורה — אני כאן' },
    { id: 'parrot_tzivon',   name: 'התוכי צִבְעוֹן',    tagline: 'תוכי צבעוני שמדבר בשפה שלך ומוצא את הצד המצחיק',                      image: '/companions/OTHER/parrot_tzivon.jpg',   narrativeHook: 'אפילו ביום אפור אפשר למצוא צבע' },
    { id: 'wolf_pup_siyar',  name: 'גור הזאב סִיָּר',   tagline: 'גור זאב צעיר עם אינסטינקט להקה — אף אחד לא הולך לבד',                image: '/companions/OTHER/wolf_pup_siyar.jpg',  narrativeHook: 'כוח אמיתי הוא כשמישהו הולך לידך' },
  ],
};
