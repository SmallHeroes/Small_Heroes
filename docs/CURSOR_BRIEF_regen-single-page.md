# משימה לקורסור — endpoint לרינדור עמוד בודד

## למה זה דרוש

אנחנו מתקנים את צינור התמונות (image pipeline) ויש צורך לבדוק תיקונים על עמוד ספציפי בספר קיים, בלי לרנדר מחדש את כל הספר.

כרגע אפשר לרנדר רק 1/2/5 תמונות ראשונות (`/api/debug/dev-image-limit`). חסר: לבקש "רנדר רק את עמוד 5 של הספר X".

## מה לבנות

### 1. Endpoint חדש

```
POST /api/debug/regen-page
```

**גוף הבקשה:**
```json
{
  "secret": "<GENERATION_SECRET>",
  "orderId": "e6684ea8-32fd-466f-8d6e-8ece86e75d25",
  "pageNumber": 5
}
```

**מה הוא עושה:**

1. אימות מול `process.env.GENERATION_SECRET` (כמו ב-`dev-image-limit`).
2. חוסם בפרודקשן (`if (process.env.NODE_ENV === 'production') return 404`) — או יש flag `ALLOW_REGEN_IN_PROD=1`.
3. טוען מ-DB את ה-order + ה-book + ה-page המבוקש כולל:
   - `imagePrompt` (אם יש)
   - `bookPageText` / `text`
   - `expectedCharacterIds`
   - `pageLayout` / `pageLayoutStyle`
   - `textZone`
   - הסטוריבורד של העמוד (shotType, compositionMode, mainCharacterVisibility, protagonistDominance)
   - `personaContext` (visualDirection, companionStructured, propDNA, supportingCharacters)
   - `illustrationStyle` של ה-order
   - `childDescription` + reference photo (אם קיימת)
4. קורא ל-`generateAllPageImages([singlePage], config)` עם כל המידע הזה.
5. שומר את התוצאה ב-DB:
   - מעדכן את `imageAsset.url` / `rawUrl` / `prompt` של אותו `pageNumber`
   - שומר את הפרומפט המלא ב-log + ב-DB לבדיקה
6. מחזיר JSON:
   ```json
   {
     "ok": true,
     "orderId": "...",
     "pageNumber": 5,
     "newImageUrl": "https://...",
     "oldImageUrl": "https://...",
     "promptLength": 3976,
     "promptPreview": "MEDIUM LOCK:\n..."
   }
   ```

### 2. כפתור ב-UI

ב-`/app/book/[id]/read-v2/` או ב-admin panel — כפתור "צור עמוד מחדש" ליד כל עמוד. הוא קורא ל-endpoint עם orderId+pageNumber ומרענן את התמונה אחרי שהיא חוזרת.

לחילופין, אם יש כבר admin/dev panel — להוסיף שם input של pageNumber + כפתור "Regen".

### 3. בדיקה

אחרי שזה בנוי, להריץ:
```bash
curl -X POST https://small-heroes.vercel.app/api/debug/regen-page \
  -H "Content-Type: application/json" \
  -d '{"secret":"$GENERATION_SECRET","orderId":"e6684ea8-32fd-466f-8d6e-8ece86e75d25","pageNumber":5}'
```

ולוודא:
- התמונה הישנה ב-Supabase נשמרת (לא נמחקת — נחוץ להשוואה)
- התמונה החדשה זמינה ב-URL המוחזר
- ה-DB מעודכן עם ה-URL החדש

## דגשים

- **חשוב:** הפרומפט שיוצא בלוג חייב להיות שלם — קוד הקיים כבר מדפיס `[gpt_prompt_full]` עם הפרומפט המלא. לוודא שזה ממשיך לעבוד.
- אם reference photo (תמונת ילד) קיימת — להעביר אותה ל-`generateAllPageImages` בדיוק כמו ב-flow הראשי. אחרת המודל יציג ילד גנרי.
- לא ליגע במחיר/שכפול — זה debug endpoint, לא לשימוש לקוחות.

## איפה הקוד הקיים שאפשר ללמוד ממנו

- `/app/api/debug/dev-image-limit/route.ts` — דוגמה ל-debug endpoint עם secret.
- `/app/api/generate/route.ts` — ה-orchestrator הראשי, שם רואים איך בונים את ה-input ל-`generateAllPageImages`.
- `/backend/providers/image.ts` — `generateAllPageImages` עצמו.

## זמן מוערך

90 דקות (כולל כפתור UI ובדיקה).
