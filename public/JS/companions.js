/**
 * Companion characters per narrative topic bucket (public/JS/companions.js)
 * Keys match COMPANIONS_BY_CATEGORY ids (NOISE_FEAR, …).
 *
 * Server mirror (must stay in sync by hand): `lib/companions.ts`
 */
window.COMPANIONS_BY_CATEGORY = {
  NOISE_FEAR: [
    { id: 'footstep_giant', name: 'הענק בּוּמִי', tagline: 'ענק עדין שצעדיו מרעידים את האדמה — וליבו שקט', image: '/companions/NOISE_FEAR/footstep_giant.jpg', narrativeHook: 'מלמד את הגיבור שבתוך כל קול גדול יש חדר פנימי שקט' },
    { id: 'song_whale', name: 'הלוויתן לוּלִי', tagline: 'לוויתן כחול ששירתו מרגיעה אוקיינוסים שלמים', image: '/companions/NOISE_FEAR/song_whale.jpg', narrativeHook: 'מראה שיש קולות שהם חיבוק ולא סכנה' },
    { id: 'baby_elephant', name: 'baby_elephant', tagline: 'שותף חדש — תמונת ייחוס בהמתנה', image: '/companions/NOISE_FEAR/baby_elephant.jpg', narrativeHook: 'PLACEHOLDER — story + reference asset pending' },
  ],
  NIGHT_FEAR: [
    { id: 'bat_lily', name: 'העטלף לילי', tagline: 'רואה בחושך טוב מביום, מוביל בשבילים ידידותיים', image: '/companions/NIGHT_FEAR/bat_lily.jpg', narrativeHook: 'מראה שהצללים הם אור שמנוח' },
    { id: 'fox_uri', name: 'השועל אוּרי', tagline: 'שועל נחושתי עם עיני פנס שמכיר כל מסלול של הלילה', image: '/companions/fox_uri/style01-sheets/front.png', narrativeHook: 'מלמד ערמומיות ובחירה חכמה במקום פחד' },
    { id: 'owl_chacham', name: 'הינשוף בּוּבּוּ', tagline: 'ינשוף זקן ששומר על העולם בזמן שהוא ישן', image: '/companions/NIGHT_FEAR/owl_chacham.jpg', narrativeHook: 'נוכחות שקטה ואיתנה בשעות החלשות של הלילה' },
  ],
  TRANSITION: [
    { id: 'chameleon_koko', name: 'הזיקית קִים', tagline: 'שובבה שנושאת צבע מכל מקום שהייתה בו', image: '/companions/chameleon_koko/style01-sheets/front.png', narrativeHook: 'מראה שבכל מקום חדש חלק מהבית נוסע איתך', visualDescription: 'A small round chameleon in soft warm green with a gentle yellowish-green glow — ONE harmonious green-to-warm-yellow tone across the body (NOT patches, NOT pink spots, NOT pure mint); pale cream-yellow belly; big warm round eyes; shy gentle smile; tail softly curled; carries a TINY fabric shoulder satchel in warm mustard — her little travel bag ("a piece of home travels with her"); cute simplified storybook proportions — warm, huggable, slightly shy.' },
    { id: 'squirrel_navad', name: 'הסנאי נוּטִי', tagline: 'סנאי שקבר אוצרות של אומץ בכל עץ חדש', image: '/companions/TRANSITION/squirrel_navad.jpg', narrativeHook: 'כל מקום זר מכיל מתנה מוחבאת' },
    { id: 'turtle_beiti', name: 'הצב טוֹלִי', tagline: 'הצב שהשריון שלו הוא הבית שלו', image: '/companions/TRANSITION/turtle_beiti.jpg', narrativeHook: 'בית זה מה שאתה נוסע, לא מה שנשאר מאחור' },
  ],
  NEW_SIBLING: [
    { id: 'pelican_kis', name: 'השקנאי פֵּלִי', tagline: 'שקנאי עם כיס שתמיד יש בו מקום לעוד אחד — אהבה לא נגמרת', image: '/companions/NEW_SIBLING/pelican_kis.jpg', narrativeHook: 'הלב גדל כשמכניסים עוד מישהו פנימה' },
    { id: 'dragon_dini', name: 'הדרקון דיני', tagline: 'דרקונון צעיר שמגלה שהכוח שלו גדל כשהוא שומר', image: '/companions/dragon_dini/style01-sheets/front.png', narrativeHook: 'להיות אח גדול/ה זה מאפיין של כוח' },
    { id: 'puppy_neeman', name: 'הכלבלב רוֹקִי', tagline: 'כלבלב שהולך איתך לכל מקום ואף פעם לא מוותר עליך', image: '/companions/OTHER/puppy_neeman.jpg', narrativeHook: 'לא משנה מה קורה — אני כאן' },
  ],
  SELF_CONFIDENCE: [
    { id: 'butterfly_zohar', name: 'הפרפר זֹהַר', tagline: 'פרפר שהיה זחל אפור — וגילה שהשינוי הכי גדול מתחיל מבפנים', image: '/companions/SELF_CONFIDENCE/butterfly_zohar.jpg', narrativeHook: 'מי שאתה היום הוא לא מי שתהיה מחר' },
    { id: 'bolly_armadillo', name: 'בּוֹלִי', tagline: 'חברון שריון שמתקפל לכדור חם כשהעולם גדול מדי', image: '/companions/bolly_armadillo/reference.jpg', narrativeHook: 'מלמד שהגוף יכול להתכווץ ולהיפתח שוב, לוח אחר לוח' },
    { id: 'monkey', name: 'monkey', tagline: 'שותף חדש — תמונת ייחוס בהמתנה', image: '/companions/SELF_CONFIDENCE/monkey.jpg', narrativeHook: 'PLACEHOLDER — story + reference asset pending' },
  ],
  SOCIAL: [
    { id: 'panda_anat', name: 'הפנדה עֲנָת', tagline: 'פנדה רכה שמגלה שחברים טובים אוהבים גם את השקט', image: '/companions/panda_anat/style01-sheets/front.png', narrativeHook: 'לא חייבים להיות רועשים כדי להיות נראים' },
    { id: 'bear_mati', name: 'המַנְצֵחַ מתי', tagline: 'דוב-מנצח שמראה שלכל קול יש מקום בתזמורת', image: '/companions/SOCIAL/bear_mati.jpg', narrativeHook: 'שייכות היא על מציאת התפקיד, לא על דומות' },
    { id: 'hedgehog_rachi', name: 'הקיפוד רַכִּי', tagline: 'קיפוד שלומד לרכך קוצים רק לרגע של חיבוק', image: '/companions/SOCIAL/hedgehog_rachi.jpg', narrativeHook: 'להיות רך בלי לאבד את עצמך' },
  ],
  FOCUS_LEARNING: [
    { id: 'parrot_tzivon', name: 'התוכי תּוּתִי', tagline: 'תוכי צבעוני שמדבר בשפה שלך ומוצא את הצד המצחיק', image: '/companions/OTHER/parrot_tzivon.jpg', narrativeHook: 'אפילו ביום אפור אפשר למצוא צבע' },
    { id: 'dolphin_shahkan', name: 'הדולפין דּוּדִי', tagline: 'דולפין שמגלה שהמוח עובד הכי טוב כשמשחקים', image: '/companions/FOCUS_LEARNING/dolphin_shahkan.jpg', narrativeHook: 'למידה היא משחק — מי שמשחק, זוכר' },
    { id: 'hawk_had', name: 'הבז רוּפִי', tagline: 'בז שרואה עכבר מגובה קילומטר — מלמד לנעול מבט על דבר אחד', image: '/companions/FOCUS_LEARNING/hawk_had.jpg', narrativeHook: 'ריכוז זה לבחור מה לראות, לא לראות הכל' },
  ],
  GENERAL_FEARS: [],
  ANGER_FRUSTRATION: [
    { id: 'bear_cub_gahal', name: 'הדוב דּוֹבִּי', tagline: 'גור דובים עם רגשות ענקיים שלומד שנשימה עמוקה היא הכוח הכי גדול', image: '/companions/ANGER_FRUSTRATION/bear_cub_gahal.jpg', narrativeHook: 'גדול מבפנים לא חייב להיות הרסני' },
    { id: 'lion_shaket', name: 'האריה לֵיוֹ', tagline: 'גור ביישן שמגלה שהשאגה תמיד הייתה בפנים', image: '/companions/lion_shaket/style01-sheets/front.png', narrativeHook: 'הקול שלך קיים — רק מחכה שתקרא לו' },
    { id: 'wolf_pup_siyar', name: 'גור הזאב לוּלוּ', tagline: 'גור זאב צעיר עם אינסטינקט להקה — אף אחד לא הולך לבד', image: '/companions/OTHER/wolf_pup_siyar.jpg', narrativeHook: 'כוח אמיתי הוא כשמישהו הולך לידך' },
  ],
  SENSITIVITY_OVERWHELM: [
    { id: 'fawn_tzvi', name: 'העופר צְבִי', tagline: 'עופר עם אוזניים שקולטות הכל — ולומד אילו קולות לשמוע', image: '/companions/SENSITIVITY_OVERWHELM/fawn_tzvi.jpg', narrativeHook: 'רגישות היא כוח-על אם יודעים מתי להדליק אותה' },
    { id: 'snail_sheli', name: 'החילזון שֶׁלִי', tagline: 'חילזון שנושא מקום בטוח על הגב ויודע מתי לצאת ומתי להתכנס', image: '/companions/SENSITIVITY_OVERWHELM/snail_sheli.jpg', narrativeHook: 'מותר להיכנס פנימה — וגם לצאת כשמוכנים' },
    { id: 'kitten_mishi', name: 'החתלתול מִשִׁי', tagline: 'חתלתול עם שפמים שמרגישים הכל, ושמגלה שהגרגור שלו מרגיע עולמות', image: '/companions/SENSITIVITY_OVERWHELM/kitten_mishi.jpg', narrativeHook: 'גופך יודע ליצור שקט — תקשיב לו' },
  ],
  MEDICAL_PROCEDURE: [
    { id: 'gecko_rifa', name: 'השממית גֵּקִי', tagline: 'שממית שמחליפה עור ומצמיחה זנב חדש — מומחית להתחדשות', image: '/companions/MEDICAL_PROCEDURE/gecko_rifa.jpg', narrativeHook: 'מה שנשבר יכול לגדול מחדש, אפילו יותר חזק' },
    { id: 'starfish_kokhavi', name: 'כוכבי', tagline: 'כוכב ים שמתחדש ומחליף — מראה שהגוף יודע לרפא את עצמו', image: '/companions/MEDICAL_PROCEDURE/starfish_kokhavi.jpg', narrativeHook: 'הגוף שלך חכם — הוא כבר עובד על זה' },
    { id: 'bunny_ometz', name: 'הארנבון בּוּנִי', tagline: 'ארנבון שנולד פחדן וגילה שאומץ הוא שריר שאפשר לאמן', image: '/companions/bunny_ometz/style01-sheets/happy.png', narrativeHook: 'להיות פחדן לא אומר שאתה לא אמיץ' },
  ],
  OTHER: [],
};
