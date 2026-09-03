# R3-B1a — חבילת החלטת מוצר: Story Source ו־Visual Direction

תאריך: 2026-09-03

בעל החלטת המוצר: Guy

בעלים טכני: Codex

סטטוס: **review-only; טרם נרשמה אף החלטת קבלה או פרסום**

## 1. למה המסמך הזה קיים

המסמך מרכז את ההחלטות הנדרשות עבור 17 הסיפורים בלי לבקש מ־Guy לעבור
ידנית על 208 עמודים. הוא קושר כל החלטה לארטיפקט המדויק שעבר QA טכני,
מפריד בין קבלת מוצר לבין קריינות, ומציג המלצה אחת ברורה לכל סוגיית HOLD.

המסמך עצמו אינו authority לקבלה. סימון או תשובה של Guy הם קלט לשער
R3-B1b עתידי; הם אינם משנים את הארטיפקט, אינם מפרסמים מקור, ואינם הופכים
סיפור ל־render-ready.

## 2. זהות בלתי־משתנה ומצב אמת

- Candidate batch digest:
  `96154a39091b71c9dffb64dcf60b8667c149b78d4b4c0d5a07787189d00a7e9b`
- Raw SHA-256:
  `d8a57650364d62cfc52496b1385ba5dd95fe702f06edf51ff327ae5a43caba4c`
- גודל: 353,307 bytes.
- מימוש R3-B1a שעבר Claude Code QA:
  `462aaf4c19c7e8809284a96579fb993400e5a593..85ef104cd7765a3e0376bb5ec84a72e75103d9c8`.
- תיקון התיעוד שעבר re-gate ללא P0/P1/P2:
  `e7c7bf4a3dda1e06a692802000a0a93cb1646bd0..e1df111f9b956fa360a03d53ef0bfc438bb29c2c`.
- 17 רשומות / 208 עמודים / 5 bedtime / 6 adventure / 6 fantasy.
- 388 תיקוני Story Source ו־52 תיקוני Visual Direction.
- 8 רשומות ממתינות לבדיקת מוצר מדויקת; 9 רשומות ב־HOLD.
- 13 סוגיות תוכן/רציפות: 10 `hold`, שלוש `review`.
- 7 פריטי קריינות critical, 24 soft, ואפס אישורי האזנה.
- כל 17 הרשומות הן `runtimeEligible:false` ו־`productionEligible:false`.
- מצב render-readiness של הקטלוג נשאר 1/18; batch זה הוא 0/17.
- רף הדמיון נשאר 0.70.

## 3. איך לאשר

יש שלושה סוגי החלטות שונים:

1. **P1–P5, P7, P8:** כוונת קבלת זוג Story Source / Visual Direction קיים,
   לפי digest מדויק. היא אינה אישור קריינות או פרסום.
2. **P6:** הרשאה להעביר את הסיפור לביקורת Cowork. לפי שער R3-B1a, Guy
   יקבל או ידחה את P6 רק אחרי החזרת Cowork.
3. **D1–D13:** החלטת כיוון עבור רשומת HOLD. החלטה כאן מאשרת ל־Codex
   להכין מועמד מתוקן חדש; היא אינה מקבלת את digest הנוכחי ואינה מפרסמת אותו.

תשובת הקיצור המומלצת היא:

> עבור candidate batch
> `96154a39091b71c9dffb64dcf60b8667c149b78d4b4c0d5a07787189d00a7e9b`
> ולפי נוסח packet זה ב־Git commit שמופיע ב־handoff של Codex: מאשר כוונת
> ACCEPT ל־P1–P5, P7 ו־P8 לפי הדיג׳סטים וה־worldMode המפורטים; מאשר להעביר
> את P6 לביקורת Cowork, ללא קבלה עדיין; ומאשר להכין מועמדים חדשים לפי
> D1–D5, D6A ו־D7–D13. קריינות, QA, digest סופי ופרסום דורשים שערים ואישור
> סופי נפרדים.

Guy יכול כמובן לציין חריגים לפי מזהה, למשל `D7: לבחור חלופה אחרת`.
התשובה מתעדת כוונת מוצר בלבד. R3-B1b חייב לקבע אותה ב־decision envelope
שקשור ל־batch, ל־packet commit ולכל record digest, ולאחר QA Guy יאשר שוב
את digest הפרסום הסופי.

## 4. סדר ההתקדמות המומלץ

1. **Tranche A — נקי גם מדגלי קריינות:** P1–P3.
2. **Tranche B — מוצר נקי, בדיקת `שם` נפרדת:** P4, P5, P7, P8.
3. **Tranche C — ביקורת סיפור Cowork חובה:** P6.
4. **Tranche D — מועמדים חדשים לאחר הכרעות:** D1–D13.

גם לאחר קבלת מוצר, כל רשומה נשארת חסומה עד למסלול הפרסום החדש, בדיקת
קריינות אנושית, Visual Contract, Blueprint, Board/prop, package ו־qualification.

## 5. שמונה מועמדים ללא HOLD: שבעה לכוונת קבלה ואחד ל־Cowork

### P1 — `dragon_dini_adventure` — המלצה: ACCEPT

- Record digest:
  `16ab0316f197aff6afae4ad42419c1f3b7d7cc285c71f0a16d75000426cc4046`
- Story candidate SHA-256:
  `d94a867035e7e3df37c047f991d900e067c3133e0a1f49c105479b92c171deeb`
- Visual Direction SHA-256:
  `cb7f92664de6627ed7efd7a62b6838d413dc2df8136f1b9f45c6098b06ec4b6e`
- 12 עמודים; תיקון טקסט אחד ותיקון VD אחד.
- השינוי היחיד במקור הוא `gender: female` → `gender: neutral`.
- תיקון VD בעמוד 12: `her slice` → `Dini's slice`.
- `worldMode`: `grounded`; אין בעיות תוכן, continuity או דגלי TTS.

### P2 — `bunny_ometz_adventure` — המלצה: ACCEPT

- Record digest:
  `57d3663c0cd0e30b162dada2cc78c1dc472ec8f2fe46037aac83042f11c6a307`
- Story candidate SHA-256:
  `1009d9a0fdfa744f7b04b74626b6e77cd1bc7b922990d3c114d71c9d0966a4e0`
- Visual Direction SHA-256:
  `6012ef9117f0412472121d8928f8fc67ab3621d11f3b1fdda22bfd0060ec8617`
- 12 עמודים; 35 תיקוני טקסט וחמישה תיקוני VD.
- `worldMode`: `grounded_with_visual_metaphor`.
- אין בעיות תוכן, continuity או דגלי TTS.

### P3 — `bunny_ometz_fantasy` — המלצה: ACCEPT

- Record digest:
  `1526df4dabf8c7cc48d710a99cb7b97952ba161d84b088d779ceceb995c2a113`
- Story candidate SHA-256:
  `ddb575737b609e93c795f3aec965001f261556fc45f4f865996bb57a746cf521`
- Visual Direction SHA-256:
  `d602695839761082b93fdb072434608a2dddfd510af7ae802937ea213d5e9169`
- 16 עמודים; 42 תיקוני טקסט ושמונה תיקוני VD.
- `worldMode`: `fantastical`; אין בעיות תוכן, continuity או דגלי TTS.

### P4 — `chameleon_koko_adventure` — המלצה: ACCEPT; ear gate נפרד

- Record digest:
  `8c4db420c6430dc69d96e9e7b7c14cf4b06728365115d7973bd503e3fb02524d`
- Story candidate SHA-256:
  `4cf5792d6ddff6e6fc5d57b8684179929651ef8987fd81ff79c6299be4d63b7e`
- Visual Direction SHA-256:
  `5c6d73e43d698a91cca67ecb025556cda49fed5fc88010fbdffcd8ea7001b180`
- 12 עמודים; 18 תיקוני טקסט ותיקון VD אחד.
- `worldMode`: `fantastical`; אין בעיית תוכן/continuity.
- קריינות: `שם`, עמוד 8, בשתי השלכות המגדר.

### P5 — `fox_uri_bedtime` — המלצה: ACCEPT; ear gate נפרד

- Record digest:
  `060ea523143e6d34d14e5b5438fdb8ba7d50237e451280586f009e2b973f5365`
- Story candidate SHA-256:
  `f6c2a45babe469f447f08fa1003c08500c1b5771906d0f2d6391a0629489dfd4`
- Visual Direction SHA-256:
  `996033f1628c8a9e493508af55643c75309fdb736cb6c4f3b8c0f08a45c2da7b`
- שמונה עמודים; 19 תיקוני טקסט ותיקון VD אחד.
- `worldMode`: `grounded_with_visual_metaphor`; אין בעיית תוכן/continuity.
- קריינות: `שם`, עמוד 3, בשתי השלכות המגדר.

### P6 — `lion_shaket_adventure` — המלצה: SEND TO COWORK; טרם ACCEPT

- Record digest:
  `e10757db73cfb1c9a9ef49cc24ff7f0a32a6b83ff4197dc172cb4f72e760ee40`
- Story candidate SHA-256:
  `1f7d84d2f1e7db2c325b8524a84d98b470ed80b63fee940c9f83503a939a4429`
- Visual Direction SHA-256:
  `9d5277badb616b951561ca0dd734b6f793149fc0548abf4dc66a5061ca8b0442`
- 12 עמודים; 31 תיקוני טקסט ואפס תיקוני VD.
- `worldMode`: `grounded_with_visual_metaphor`; אין בעיית continuity.
- קריינות: `שם`, עמוד 5, בשתי השלכות המגדר.
- ביקורת איכות סיפור של Claude Cowork היא תנאי מפורש **לפני קבלת Guy
  המדויקת**, לא רק לפני פרסום.

### P7 — `lion_shaket_fantasy` — המלצה: ACCEPT; ear gate נפרד

- Record digest:
  `ad7799f7e6acd4d1fc99da65c13fabe51a1624d43f3482f26a2aae2cc12e6494`
- Story candidate SHA-256:
  `e0881f7641224a4e3bd066b7acfe2b6136ec546e559ca6ef965b6531833cc67c`
- Visual Direction SHA-256:
  `fc12873a05986114d4d16459cf5721f64d2be16e2f3c73ca94b3b025a52e1eae`
- 16 עמודים; 31 תיקוני טקסט ועשרה תיקוני VD.
- `worldMode`: `fantastical`; אין בעיית תוכן/continuity.
- קריינות: `שם`, עמודים 2 ו־9, בשתי השלכות המגדר.

### P8 — `panda_anat_bedtime` — המלצה: ACCEPT; ear gate נפרד

- Record digest:
  `9ca77317f023507cdd88704cae1839316684d48a522092013228ea01db89e851`
- Story candidate SHA-256:
  `15d88b977c9bd2ed7fc5bd39e01f01e00c2a12f97044829d4fea4d10d0cde692`
- Visual Direction SHA-256:
  `8399bf9fbcf3dea6318209e6af48f8616978e24e8e43afd15e7881d7cbd2d449`
- שמונה עמודים; 24 תיקוני טקסט ותיקון VD אחד.
- `worldMode`: `grounded_with_visual_metaphor`; אין בעיית תוכן/continuity.
- קריינות: `שם`, עמוד 5, בשתי השלכות המגדר.

## 6. שלוש־עשרה הכרעות HOLD והמלצת Codex

### D1 — `bunny_ometz_bedtime`, עמוד 4 — המלצה: APPROVE

לאשר את תיקון ההתאמה:
`{{childName}} {לקח|לקחה} שלושה כרטיסי רכבת {והניח|והניחה} אותם בשורה.`

### D2 — `bunny_ometz_bedtime`, עמוד 6 — המלצה: APPROVE

לאשר:
`{{childName}} {לא הזיז|לא הזיזה} את הקטר.`

### D3 — `chameleon_koko_fantasy`, עמוד 7 — המלצה: APPROVE

לתקן `זה תשובה מאוד לא מסודרת` ל־`זאת תשובה מאוד לא מסודרת`.

### D4 — `chameleon_koko_fantasy`, עמוד 1 — המלצה: APPROVE PROJECTED AGREEMENT

להשתמש ב־`{מוכרחים|מוכרחות}`: בהשלכת הילד הקבוצה מעורבת ולכן זכר־רבים;
בהשלכת הילדה קים והילדה הן קבוצה נקבית ולכן נקבה־רבות. זו התאמה מפורשת
ועדיפה כאן על השארת `מוכרחים` כניסוח סתמי.

### D5 — `dragon_dini_bedtime`, עמוד 3 — המלצה: FEMALE FROG

לאשר צפרדע נקבית באופן עקבי: `הציצה` ו־`קפצה`, בהתאם ל־`צפרדע נחתה`
בעמוד 7.

### D6 — `dragon_dini_fantasy`, עמודים 9–16 — הכרעת canon חובה

המקור הנוכחי מצייר על דיני פסים סגול/כתום/**ירוק**, אך authority הקיים
קובע שדיני היא copper-orange ו־`never green`; ירוק שייך לדרקון/ביצה אחרים.
בנוסף, axis ה־appearance הקיים מחייב לפחות מצבי baseline, transition,
mismatched ו־resolved, ולכן אסור לדחוס אליו מעבר מיידי בן עמוד אחד באופן
לא אמיתי.

**D6A — המלצת Codex:** לשנות ירוק לזהב ולאשר סמנטיקה סגורה בשם
`storm_stripes_purple_orange_gold_overlay`: שכבת צבע חיצונית וזמנית מעל
הקשקשים ה־copper-orange שאינם משתנים, מתחילת עמוד 9 עד סוף עמוד 16,
אינה זהות קנונית ונעלמת מחוץ לסיפור. Dini נשארת ב־HOLD עד ששער טכני נפרד
מוסיף authority כללי ואמיתי ל־transient surface overlay; אין לכפות זאת על
axis הישן.

חלופה D6B היא לאשר במפורש חריג צר של overlay ירוק לעמודים 9–16, למרות
`never green`. חלופה D6C היא להסיר את שינוי הגוף ולכתוב ביט קומי אחר.
אישור הקיצור לעיל בוחר D6A; D6B או D6C חייבות להיאמר במפורש.

### D7 — `dragon_dini_fantasy`, עמודים 5–10 — המלצה: SECURED AT SIDE

לאחר שהילד/ה מתיר/ה את הרשת מאפה של דיני בעמוד 5, הרשת מגולגלת
ומאובטחת **מתחת לאבנט הטרקוטה האלכסוני הקיים** בעמודים 6–9—ללא כיס,
קליפ או אביזר חדש. בעמוד 10 נשמר המקור המדויק
`דיני קיפלה את רשת העשן לכיס` וה־VD נשאר `smoke net folded away`.
אין להציג או לייחס את הכיס לדיני, ואין להוסיף pouch; אם בעלות הכיס תידרש
חזותית, היא תחזור להכרעת creative-source נפרדת.

### D8 — `fox_uri_adventure`, עמודים 5 ו־11 — המלצה: ONE BOLT

לשמור על הבורג היחיד והמבריק שהוצג בעמוד 5, ולשנות את עמוד 11 ליחיד:
הילד/ה מהדק/ת את **הבורג שמצא/ה**. זו האפשרות המינימלית והשומרת ביותר.

### D9 — `fox_uri_fantasy`, עמודים 5, 6, 11, 15 ו־16 — המלצה: EXPLICIT EXITS

- מפת הים יורדת מראשו של אורי ונשארת בספרייה בסוף עמוד 5.
- כובע המסיבה חוזר לדג־החלום לפני היציאה מעמוד 6.
- הגרב נשארת כסמן על דלת חדר המנוחה עד עמוד 15.
- אורי אוסף את הגרב ולובש אותה מחדש כשהם יוצאים בסוף עמוד 15, לפני
  סצנת הבית בעמוד 16.

### D10 — `lion_shaket_bedtime`, עמודים 2–8 — המלצה: HEAD → LAP ON PAGE 7

ירח הקרטון נשאר על ראשו של ליאו בעמודים 2–6. בזמן האטת הקרוסלה בעמוד 7
הוא מחליק וליאו תופס אותו על ברכיו; בעמוד 8 הוא כבר נח שם. המעבר הופך
את הקומדיה לרציפה ואינו ממציא אביזר חדש.

### D11 — `panda_anat_adventure`, עמודים 7–8 — המלצה: INDEPENDENT STAGE PROP

הצעיף העוטף את התוף הוא אביזר במה עצמאי, לא הצעיף הקנוני של ענת. זו
ברירת המחדל השמרנית ואינה יוצרת transition חדש עבור companion accessory.

### D12 — `panda_anat_fantasy`, עמוד 9 — המלצה: MALE CREATURE

להגדיר את היצור כזכר, לשנות `את יודעת` ל־`אתה יודע`, ולהשאיר את
`אותו` ו־`היצור` הקיימים. זהו השינוי הקטן והעקבי ביותר.

### D13 — `panda_anat_fantasy`, עמודים 1–4 — המלצה: STORY SCARF VISIBLE, SHIRT RETURNED

הצעיף הוא אביזר זמני וספציפי לסיפור—לא חלק מן הזהות הקנונית של ענת ולא
appearance-state authority. הוא נשאר מאובטח ונראה מעמוד 1; בעמוד 3
החולצה מכסה אותו זמנית. לאחר שענת מוציאה את הראש מן הצווארון, הצעיף נראה
שוב והחולצה חוזרת **לאותו סל כביסה מעופף** לפני עמוד 4. אין להפוך את
החולצה ללבוש קבוע או את הצעיף לאביזר קנוני.

## 7. קריינות — שער נפרד שאסור לנטו מול קבלת מוצר

- שבעת פריטי ה־critical הם `ספר` ב־`fox_uri_fantasy`: ארבעה בהשלכת הילד
  בעמודים 3, 4, 4 ו־5; שלושה בהשלכת הילדה בעמודים 4, 4 ו־5.
- 24 פריטי ה־soft הם 12 מופעי `שם` בשתי השלכות מגדר:
  `chameleon_koko_adventure` עמוד 8;
  `dragon_dini_bedtime` עמוד 1;
  `dragon_dini_fantasy` עמוד 11;
  `fox_uri_adventure` פעמיים בעמוד 6;
  `fox_uri_bedtime` עמוד 3;
  `lion_shaket_adventure` עמוד 5;
  `lion_shaket_fantasy` עמודים 2 ו־9;
  `panda_anat_bedtime` עמוד 5;
  `panda_anat_fantasy` עמודים 1 ו־11.
- audition בן 24 הקליפים הקיים מכייל את `הד`, `ברחה`, `צפצפה` ו־`תפוח`,
  אך אינו מאשר אוטומטית את מופעי `ספר` ו־`שם` האלה.
- Milestone B של הקריינות חייב להוסיף את ההקשרים המדויקים, להפעיל ניקוד
  מינימלי בלבד, ולהסתיים בבדיקת אוזן אנושית. Automated preflight הוא ראיה
  מכנית בלבד ולעולם אינו human-ear PASS; 16/17 הרשומות עוברות אותו כעת,
  בעוד `fox_uri_fantasy` נכשל בשער ה־critical בגלל `ספר`.

## 8. לבוש ורציפות חזותית

כל 17 הרשומות מצהירות כרגע על
`childWardrobeTransitionPages: []`. המשמעות היא שאין במקור מעבר לבוש מאושר;
היא אינה אומרת ש־bedtime שווה פיג'מה. לבוש קונקרטי ייקבע ב־Visual Contract
ויישמר בכל העמודים, אלא אם Story Source מאושר מציג מעבר מפורש. כך נמנע
מהכשל שכבר נראה אצל לביא—סווטשירט בכריכה/חלק מהעמודים ופיג'מה באחרים בלי
מעבר ברור. זהו כלל authoring לעבודה העתידית בלבד; packet זה אינו משנה או
מתקן את הספר, ה־Visual Package או ההזמנה הקיימים של לביא, שנשארים מסלול
remediation נפרד.

## 9. מה יקרה לאחר החלטת Guy

1. Codex ימלא Decision Gate חדש ל־R3-B1b.
2. החלטות P יירשמו ב־disposition נפרד, digest-bound; הארטיפקט המקורי לא ישתנה.
3. החלטות D ייצרו candidate digests חדשים עם source/VD מדויקים.
4. `lion_shaket_adventure` יעבור ביקורת Cowork; גם כל שינוי D שדורש
   שכתוב creative-source מהותי או עריכת צפיפות, ולא רק תיקון מכני, יעבור
   Cowork לפני קבלת Guy המדויקת.
5. Claude Code יבצע QA read-only על המימוש והדיג׳סטים.
6. רק לאחר PASS וקבלה מדויקת נוספת יפורסמו revisions מאושרים.
7. קריינות, Visual Contract, Blueprint, Boards, package ורנדר נשארים שערים
   נפרדים. אין רנדר מלא בלי אישור עלות מפורש.

## 10. אפקטים וגבולות

הכנת packet זה מבצעת אפס provider/network/database/storage calls, אפס
image/audio/PDF renders, אפס שינויי order/payment/deployment, ואפס עלות.
היא אינה משנה מקור היסטורי, acceptance, publication, runtime, Wizard catalog,
resemblance threshold או eligibility.
