# Image Pipeline — Brief לצ׳אט/יועץ מומחה

הקשר: אנחנו מנסים להגיע לאיכות אילוסטרציה ברמת Pixar/picture-book classic. הגענו לתקרה. מבקש את דעתך — איך לפרוץ אותה.

---

## מה אנחנו בונים

**Small Heroes** — ספרי ילדים מותאמים אישית בעברית. 15 עמודים, כל עמוד = תמונה + טקסט.

זרימה:
```
1. Wizard (ילד מילא פרטים)
2. Brain — בוחר סיפור מ-story bank (108 סיפורים)
3. Personalization — מחליף שם, מין, גיל
4. Storyboard LLM — בוחר shotType/composition לכל עמוד
5. Director LLM — בונה BLOCKING (פוזיציות, eyeline, רגש) פר-עמוד
6. Scene Extractor LLM — מתרגם טקסט עברי לתיאור סצנה אנגלי
7. buildGPTImagePrompt — מחבר הכל לפרומפט סופי
8. gpt-image-1 (או gpt-image-2) — מייצר תמונה
9. CSS Reader — מציג מסך מלא / 2-page spread
```

## הסטאק

- Next.js 15 + TypeScript + Prisma + Supabase
- gpt-image-1 או gpt-image-2 (env toggle GPT_IMAGE_MODEL)
- gpt-4o-mini ל-storyboard + director + scene extractor
- Style: "Soft Hand-Drawn Storybook" — watercolor on cream paper

## מה כן עובד טוב

1. **סגנון יציב** — אקוורל-ספר-ילדים מתפרסם נכון, פלטה חמה, נראה כמו ספר אמיתי.
2. **דמויות חמודות** — round characters עם עיניים גדולות, מתאים לגיל 3-7.
3. **Storyboard מגוון** — ה-LLM באמת מחזיר shotType שונה לכל עמוד (wide / medium / close / over_shoulder / tracking).
4. **Director Layer** — מחזיר BLOCKING JSON מפורט עם eyeline, emotion, interaction.
5. **קומפניונים זיהוי** — בעקבות תיקון anchor recently, פנים הילד יחסית עקבי אם יש תמונה אמיתית של הילד.

## מה לא עובד — הבעיות הקריטיות

### 1. **gpt-image-1 מתעלם מהוראות framing**

הפרומפט מבקש מפורש:
> "TINY CHARACTER IN VAST ENVIRONMENT — child occupies AT MOST 15-20% of the frame. The environment dominates 80%+."

המודל מחזיר דמות ב-50-60% מהפריים. **כל פעם.** ניסיתי 5 גרסאות של הניסוח הזה (35%, 25%, 20%, "ant-sized", "drone shot"). שום דבר לא עובד.

### 2. **הקומפוזיציות זהות בין עמודים**

ה-Storyboard מחזיר {wide, medium, over_shoulder, tracking, close-up}. ה-gpt-image-1 מחזיר 5 פעמים: ילדה כורעת באמצע פריים, watercolor, סביבה ירוקה. נראה אותו דבר.

### 3. **חוסר רציפות בין עמודים**

עמוד 1: ילדה על השפה ברגליים יבשות.
עמוד 2: ילדה מתחת למים עם דגים.
עמוד 3: ילדה ביער (??).

אין flow ויזואלי. בעלילה הילדה לא יוצאת מהמים לסירוגין.

### 4. **Scene-text mismatch**

הטקסט בעברית אומר:
> "כוכב הים מציץ מהמים ומסתכל עליה. היא יושבת על השפה ולא רוצה להיכנס."

ה-Scene Extractor (gpt-4o-mini) מתרגם:
> "Noa kneels next to Dori the starfish underwater, both looking at each other."

זה לא נכון. החלוקה המרחבית (ילדה מעל המים, כוכב במים) נמחקה. הוספתי כללי "PRESERVE SPATIAL ZONES" — עוזר מעט אבל לא מספיק.

### 5. **חוסר רגישות לרגש העמוד**

ב-heart_line page (העמוד הרגשי ביותר בספר), המודל נותן close-up רגיל. לא מצליח להשיג את האינטימיות הקולנועית של תמונה כמו "ילדה ראש-בכתף עם דמות, רכות".

---

## מה כבר ניסינו

1. **Prompt engineering אגרסיבי** — הוספתי דוגמאות מ-Sergio Ruzzier ו-Jon Klassen, "AT MOST 15%", "ant-sized character" — אין שיפור משמעותי.
2. **Storyboard variety enforcement** — חוקים קשיחים: "no two consecutive same shotType". ה-LLM מציית. ה-image model מתעלם.
3. **Director Layer** — gpt-4o-mini ייעודי שמייצר BLOCKING JSON. מצוין כיועץ, אבל gpt-image-1 לא יודע להפעיל את ה-blocking נאמנה.
4. **Anchor system** — שמרנו את תמונה 1 כייחוס לעמוד 2+. תוצאה: כל העמודים נראים זהים (anchored on page 1). הוצאנו מתפעול (env flag).
5. **Reference photo** — אם המשתמש מעלה תמונת ילד, היא מועברת כייחוס. שומרת פנים, אבל **לוקחת גם את הרקע/פוזה** של התמונה לפעמים.
6. **gpt-image-2 toggle** — מוכן. עוד לא נבדק בפועל.

---

## האסטרטגיה שאני שוקל — חוות דעתך?

### אופציה A — Composition Reference Images
כל shotType מקבל תבנית-איור (line art) שמראה איפה הדמות בפריים. נשלחת ל-gpt-image-1 כ-second reference image. המודל מחקה את הקומפוזיציה של ה-line art + הסגנון של הפרומפט.

**שאלה אליך:** האם זה אמיתי שגלל קל לקבל קומפוזיציה ספציפית מ-gpt-image-1 עם image reference? כן/לא? אולי יש גישה עדינה יותר?

### אופציה B — מעבר ל-Flux Pro 1.1 Ultra
מודל פתוח-משקלות (open weights) על Replicate. ידוע ביצירת ספרי-ילדים יפים + ציות טוב להוראות + ControlNet לקומפוזיציה.

**שאלה אליך:** האם אתה ממליץ לעבור? היתרונות/חסרונות לעומק? עלות + איכות + variety?

### אופציה ג — Hybrid Multi-Model
- gpt-image-2 לתמונה ראשונית
- Flux Pro לעמודים שדורשים קומפוזיציה ספציפית
- ייתכן Imagen 4 לעטיפה

**שאלה אליך:** האם זה מעשי? איך מנהלים סגנון אחיד בין מודלים שונים?

### אופציה D — שינוי בארכיטקטורה
שכבת "VISION REVIEWER" — gpt-4o-vision קורא את התמונה אחרי שהיא נוצרת, מחזיר ציון לקומפוזיציה, ואם הציון נמוך — מבקש regen עם פרומפט חזק יותר.

**שאלה אליך:** האם זה pattern מקובל? מה הסיכון?

### אופציה ה — Continuity ב-Storyboard
ב-Storyboard אנחנו רצים פעם אחת לפני יצירת התמונות. אבל ה-LLM לא רואה את התמונות שכבר נוצרו. אולי לרוץ ITERATIVE: עמוד 1 → רואה את התוצאה → מתכנן עמוד 2 בהתאם?

**שאלה אליך:** האם זה יעבוד? איזה latency זה מוסיף לתהליך?

---

## מה אני רוצה ממך

1. **דעה כנה** — איזו אופציה (A-E) הכי כדאית? למה?
2. **אופציות נוספות** שלא חשבתי עליהן.
3. **מה לקנות יותר זול** — אם כבר משקיעים, איפה הכי כדאי לתת עוד גלם.
4. **דוגמאות ספציפיות** של פרומפטים שעובדים טוב עבור picture-book wide-shot על gpt-image-1.
5. **דעה על gpt-image-2 vs Flux Pro vs Imagen** ספציפית לוורטיקל ספרי-ילדים.

---

## נתונים שכדאי לדעת

- כל ספר = 15 תמונות, עלות נוכחית ~$3 על gpt-image-1.
- נפח: עוד לא בפרודקשן רחב. בודק תהליך כיום.
- קהל: הורים ישראלים שרוצים מתנה אישית לילד.
- ה-USP: סיפור עם פרצוף הילד שלהם + פסיכולוגיה רלוונטית לאתגר רגשי.
- מתחרים: storybird, magic story אבל פחות איכות vizulית.

---

תודה. אני מחפש דעה אמיתית, לא חסידות. אם אתה חושב שהפיתרון הוא לזרוק את gpt-image-1 ולעבור — תגיד את זה.
