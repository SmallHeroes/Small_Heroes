# משימה לקורסור — שליטת קומפוזיציה דרך תמונת רפרנס

## למה זה דרוש

ניסינו לבקש מ-gpt-image-1 קומפוזיציה רחבה דרך טקסט ("character occupies AT MOST 25% of frame", "WIDE CINEMATIC"). המודל מתעלם. הדמות מגיעה ב-50-60% מהפריים. זו מגבלה מהותית של המודל.

הפתרון: **להזיז את שליטת הקומפוזיציה מטקסט לתמונת רפרנס.**

gpt-image-1 כבר משמש ב-mode `images.edit` עם תמונת רפרנס אחת (תמונת הילד). המודל מחקה את הפנים מהתמונה. אם נוסיף תמונת רפרנס שנייה — **תמונת תבנית קומפוזיציה** — המודל יחקה את המבנה המרחבי.

---

## מה לבנות

### חלק 1 — ספריית תבניות

צור תיקיה: `public/composition-templates/`

בתוכה — 10 קבצי PNG פשוטים, **1024x1536** (אותו יחס של הספר). כל אחד הוא איור line-art שטוח שמראה:
- איפה הדמות הראשית במסגרת
- איפה הקומפניון (אם רלוונטי)
- איזה אחוז מהמסגרת הסביבה תופסת

קבצים:

| שם | מה הוא מציג | shotType ↔ |
|----|--------------|-------------|
| `wide_establishing.png` | דמות קטנה (15-20%) תחתון-שמאל, סביבה ענקית | `wide` + `environmental` |
| `medium_duo.png` | שתי דמויות (כל אחת 25-30%) side-by-side, סביבה 50% | `medium` + `duo_interaction` |
| `over_shoulder.png` | דמות גדולה משמאל בקדמה (צד-אחורי), דמות שנייה ברקע ימין | `over_shoulder` + `foreground_background` |
| `intimate_close.png` | פנים/ידיים close-up, רקע מטושטש | `close_up` + `intimate_close` |
| `companion_dominant.png` | קומפניון בקדמה (50%), ילד ברקע (15%) | `medium` + `companion_dominant` |
| `tracking_motion.png` | דמות נעה אלכסונית דרך הפריים, סביבה דינמית | `medium`/`tracking` + `diagonal_motion` |
| `aerial_wide.png` | תצוגה מלמעלה — דמויות קטנות בתוך נוף | `wide` + `aerial` |
| `low_angle.png` | מהקרקע למעלה — דמות חוצה את הפריים | `wide` + `low_angle` |
| `peeking.png` | דמות מציצה מהפינה (פינה תחתון-ימין), השאר ריק | `close_up` + `single_focus` |
| `silhouette.png` | צללית של דמות נגד רקע מואר | `medium` + `single_focus` |

**איך לייצר את התבניות:**
- אפשר לבקש מ-gpt-image-1 עצמו: "Generate a flat line-art composition template, 1024x1536, showing the layout for a [wide_establishing] children's book illustration. Just black outlines on white. Small placeholder character at coordinates X, large environment around. No detail — just composition zones."
- או לצייר ידנית ב-Figma/Sketch — סוף סוף זה רק קווים פשוטים.

**חשוב:** התבניות **לא** צריכות להיות יפות. הן צריכות להראות **חלוקת המסגרת** בלבד. ככל שהן יותר סכמטיות — המודל יבין יותר טוב.

---

### חלק 2 — מיפוי shotType → template

הוסף ל-`backend/providers/image.ts` (או קובץ חדש `lib/compositionTemplates.ts`):

```ts
interface CompositionTemplate {
  filename: string;
  description: string;
}

const COMPOSITION_TEMPLATES: Record<string, CompositionTemplate> = {
  'wide_establishing':    { filename: 'wide_establishing.png', description: 'tiny character in vast environment' },
  'medium_duo':           { filename: 'medium_duo.png', description: 'two characters side by side, environment present' },
  'over_shoulder':        { filename: 'over_shoulder.png', description: 'foreground character looking at background subject' },
  'intimate_close':       { filename: 'intimate_close.png', description: 'face/hands close-up, blurred background' },
  'companion_dominant':   { filename: 'companion_dominant.png', description: 'companion foreground, child small in back' },
  'tracking_motion':      { filename: 'tracking_motion.png', description: 'character moving diagonally through scene' },
  'aerial_wide':          { filename: 'aerial_wide.png', description: 'top-down view of small characters in landscape' },
  'low_angle':            { filename: 'low_angle.png', description: 'ground-up view, character large against sky' },
  'peeking':              { filename: 'peeking.png', description: 'character peeking from corner, mostly empty frame' },
  'silhouette':           { filename: 'silhouette.png', description: 'character silhouette against bright background' },
};

/**
 * Pick the composition template that best matches a storyboard row.
 * Priority: explicit compositionMode → derive from shotType + protagonistDominance.
 */
export function pickCompositionTemplate(
  shotType: string,
  compositionMode: string,
  protagonistDominance: string
): CompositionTemplate {
  // Direct mapping by compositionMode if available
  if (compositionMode === 'environmental' || compositionMode === 'wide_establishing') {
    return COMPOSITION_TEMPLATES.wide_establishing!;
  }
  if (compositionMode === 'duo_interaction') return COMPOSITION_TEMPLATES.medium_duo!;
  if (compositionMode === 'foreground_background') return COMPOSITION_TEMPLATES.over_shoulder!;
  if (compositionMode === 'intimate_close' || shotType === 'close_up') return COMPOSITION_TEMPLATES.intimate_close!;
  if (compositionMode === 'diagonal_motion' || shotType === 'tracking') return COMPOSITION_TEMPLATES.tracking_motion!;

  // Fallback by dominance
  if (protagonistDominance === 'secondary') return COMPOSITION_TEMPLATES.companion_dominant!;
  if (protagonistDominance === 'background') return COMPOSITION_TEMPLATES.wide_establishing!;

  // Default
  if (shotType === 'wide') return COMPOSITION_TEMPLATES.wide_establishing!;
  return COMPOSITION_TEMPLATES.medium_duo!;
}
```

---

### חלק 3 — להעביר את התבנית כ-reference שנייה ל-gpt-image-1

ב-`backend/providers/image.ts` בפונקציה `generateWithGPTImage`:

איתור הקוד הקיים:
```ts
const referenceImages: Buffer[] = [];
// existing: child reference photo loaded into referenceImages
```

הוסף **לפניה**:
```ts
// Load composition template if storyboard has shotType
if (input.composition?.compositionMode || input.composition?.cameraDistance) {
  const tpl = pickCompositionTemplate(
    input.composition.cameraDistance ?? 'medium',
    input.composition.compositionMode ?? '',
    input.composition.protagonistDominance ?? 'primary'
  );
  const tplPath = path.join(process.cwd(), 'public', 'composition-templates', tpl.filename);
  if (existsSync(tplPath)) {
    const tplBuffer = await fs.readFile(tplPath);
    referenceImages.push(tplBuffer);
    console.log(`[GPTImage] composition template loaded: ${tpl.filename}`);
  }
}
// existing: child reference photo
```

ובפרומפט עצמו, **בתחילה**:
```
REFERENCE IMAGES:
  Image #1 — COMPOSITION TEMPLATE: copy this framing EXACTLY. Match where the character is in the frame, how much space the environment takes, the camera angle, the relative sizes. The template is line-art only — render in the storybook style described below.
  Image #2 — CHARACTER LOOK: copy the face, hair, skin tone, age, body proportions. DO NOT copy this image's framing — that comes from Image #1.
```

הוסף את המשפט הזה בראש ה-styleBlock או לפניו.

---

## בדיקה

אחרי שכל החלקים מוכנים:

1. צור 10 תבניות ב-`/public/composition-templates/`
2. חבר ל-`pickCompositionTemplate`
3. רגן את 5 העמודים של `starfish_kokhavi_adventure` דרך `/api/dev/story-bank`
4. בדוק:
   - הדמות תופסת ~30% של הפריים (לא 60%)
   - קומפוזיציות שונות בין עמודים (wide → medium → over_shoulder → close → tracking)
   - הסגנון נשאר Style 01 (סטוריבוק חם)

---

## הערות

- **gpt-image-1 תומך עד 4 תמונות רפרנס.** שתיים זה בטוח.
- **התבנית לא צריכה להיות מהוקצעת.** רק קוים שחורים על לבן, מציינים אזורים.
- **אם המודל לא מציית** — נסה את הניסוח: "Image #1 is a STORYBOARD SKETCH showing the desired SHOT and FRAMING. The final illustration must have characters at the same scale and position as Image #1."
- **רגישות לסדר:** ייתכן שצריך לשים את התבנית **כראשונה** ב-array, או דווקא אחרונה — תבדוק שני המקרים.

## זמן מוערך

- חלק 1 (יצירת 10 תבניות): 90 דקות (אם משתמשים ב-gpt-image-1 ליצירת התבניות)
- חלק 2 (מיפוי + helper): 30 דקות
- חלק 3 (אינטגרציה): 60 דקות
- בדיקה ראשונית: 30 דקות

**סה"כ: 3.5 שעות**
