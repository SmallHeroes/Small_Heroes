# Power Cards — Shelf v1 (20 golden stories)

Complete set of Power Card frontmatter blocks for the shipped golden shelf.
Each block to be inserted into the corresponding `story-bank/v5-fixed-v2/<companion>_<direction>.md` file's YAML frontmatter under a `powerCard:` key.

**Schema rules (locked):**
- Title pattern: `כרטיס ה___ של {{childName}}` (default), allowed to deviate when story demands it (e.g. Mati's "הדברים שראיתי")
- Subtitle: starts with `כש___`, captures the trigger moment
- Exactly 4 child-facing steps
- Step 4: roughly 70% start with `אני זוכר/ת...`, 30% varied
- `companionReminder`: short story-anchored line, ≤16 words, companion voice
- `visualMotifs`: 3-4 concrete English visual hooks (designer/dev-facing)
- No parentheses in steps. No graphic em-dashes. Child-friendly language only.

---

## bedtime (7)

### 1. owl_chacham_bedtime — בובו / NIGHT_FEAR

```yaml
powerCard:
  title: "כרטיס הלילה של {{childName}}"
  subtitle: "כשקול בחדר נשמע מפחיד"
  coreTool: "name-a-sound to shrink it"
  steps:
    - "אני מקשיב/ה לקול אחד"
    - "אני נותן/ת לו שם"
    - "אני נושם/ת לאט"
    - "אני זוכר/ת: קול עם שם נעשה קטן יותר"
  companionReminder: "לא לדעת זה לא אותו דבר כמו מפלצת."
  visualMotifs:
    - "owl on moonlit shelf"
    - "named sound labels"
    - "soft curtain breeze"
    - "two-blink applause"
```

### 2. bat_lily_bedtime — לילי / RACING_THOUGHTS

```yaml
powerCard:
  title: "כרטיס המחשבות של {{childName}}"
  subtitle: "כשהראש לא רוצה להירדם"
  coreTool: "let thoughts pass like sounds"
  steps:
    - "אני לא מנסה לעצור את המחשבות"
    - "אני נותן/ת לאחת לעבור"
    - "אני נושם/ת איתה — פנימה, החוצה"
    - "שקט קטן בתוך הקולות מספיק"
  companionReminder: "שקט גמור הוא חשוד."
  visualMotifs:
    - "bat hanging cozy upside down"
    - "night window with passing shadows"
    - "in-out breath rhythm marks"
    - "small thought-cloud floating by"
```

### 3. bee_ima_bedtime — דבורי / NEW_SIBLING

```yaml
powerCard:
  title: "כרטיס הצוף של {{childName}}"
  subtitle: "כשמשהו שלי מרגיש קטן מדי לחלק"
  coreTool: "shared nectar becomes honey"
  steps:
    - "אני שם/ה לב למה שיש לי"
    - "אני נושם/ת לאט"
    - "אני נותן/ת לזה להצטרף"
    - "אני זוכר/ת: כשמצטרפים — נהיה דבש"
  companionReminder: "צוף שלא נשמר לעצמך הופך לדבש."
  visualMotifs:
    - "honey drop on windowsill"
    - "soft hive hum"
    - "bee landing on hand"
    - "family hug widening"
```

### 4. bolly_armadillo_bedtime — בולי / FEAR_GENERAL

```yaml
powerCard:
  title: "כרטיס הדבר האמיתי של {{childName}}"
  subtitle: "כשהחדר נהיה גדול מדי"
  coreTool: "find one small real thing"
  steps:
    - "אני נושם/ת לאט"
    - "אני מחפש/ת דבר אחד קטן אמיתי"
    - "אני נוגע/ת בו בעדינות"
    - "אני זוכר/ת: הפחד יכול להיות, רק לא על כל המיטה"
  companionReminder: "כדור הוא לא מחבוא. לפעמים הוא הפסקה."
  visualMotifs:
    - "armadillo curling close to child"
    - "moonlit bedroom corner"
    - "one small touchable object"
    - "blanket edge softly held"
```

### 5. song_whale_bedtime — לולי / LONELINESS

```yaml
powerCard:
  title: "כרטיס הקול של {{childName}}"
  subtitle: "כשאני מרגיש/ה שלא שמעו אותי"
  coreTool: "send one small voice"
  steps:
    - "אני מוצא/ת קול קטן"
    - "אני נותן/ת לו לצאת לאט"
    - "אני מחכה רגע"
    - "אני זוכר/ת: קול אמיתי מחפש דרך"
  companionReminder: "קול שנשלח באמת לא נעלם מיד."
  visualMotifs:
    - "whale song line glowing through water"
    - "watery moonlit window"
    - "deep ocean blue gradient"
    - "distant echo wave"
```

### 6. starfish_kokhavi_bedtime — כוכבי / MEDICAL_PROCEDURE

```yaml
powerCard:
  title: "כרטיס הריפוי של {{childName}}"
  subtitle: "כשמשהו בגוף לוקח זמן"
  coreTool: "trust the body's quiet healing"
  steps:
    - "אני נותן/ת לפלסטר קצת זמן"
    - "אני נח/ה ולא ממהר/ת לבדוק"
    - "אני אומר/ת לגוף משהו נחמד"
    - "אני זוכר/ת: חזק/ה זה גם לקחת זמן"
  companionReminder: "לפעמים הריפוי עובד בשקט."
  visualMotifs:
    - "pink-gold starfish in waterdrop"
    - "fish-pattern bandage"
    - "moonlit windowsill"
    - "quiet bowl with one ripple"
```

### 7. turtle_beiti_bedtime — טולי / PATIENCE_PACE

```yaml
powerCard:
  title: "כרטיס הקצב של {{childName}}"
  subtitle: "כשהיום עוד רץ בתוכי"
  coreTool: "carry yourself at your own pace"
  steps:
    - "אני שם/ה יד על הלב"
    - "אני לא ממהר/ת להירדם"
    - "אני נושם/ת לאט — לפי הקצב שלי"
    - "אני זוכר/ת: דברים חשובים לא נשארים מאחור"
  companionReminder: "כף היד שלי מצאה קצב שלא מבקש למהר."
  visualMotifs:
    - "turtle shell home"
    - "small leaf resting on shell"
    - "book-bridge to bed"
    - "tiny knock-knock pulse in palm"
```

---

## adventure (6)

### 8. fox_uri_adventure — אורי / NIGHT_FEAR (shadow map)

```yaml
powerCard:
  title: "כרטיס הצללים של {{childName}}"
  subtitle: "כשהחושך בחצר נראה כמו משהו זז"
  coreTool: "soften the gaze, see paths not enemies"
  steps:
    - "אני מרכך/ת את המבט"
    - "אני נושם/ת ולא צועק/ת"
    - "אני מסתכל/ת על מה שהפנס מראה"
    - "אני זוכר/ת: צללים הם שבילים, לא אויבים"
  companionReminder: "כשמפסיקים להאשים את הפנס, הצללים מראים את הדרך."
  visualMotifs:
    - "small flashlight beam"
    - "garden shadow path"
    - "line of ants in the light"
    - "fox tail-tip showing direction"
```

### 9. dolphin_shahkan_adventure — דודי / FOCUS_LEARNING

```yaml
powerCard:
  title: "כרטיס הדבר האחד של {{childName}}"
  subtitle: "כשהכל מסביב יותר מדי"
  coreTool: "one thing at a time — pick a single sound"
  steps:
    - "אני עוצר/ת לרגע"
    - "אני בוחר/ת דבר אחד להקשיב לו"
    - "אני נושם/ת איתו"
    - "אני זוכר/ת: כל השאר לא נעלם — הוא רק נותן רגע"
  companionReminder: "דבר אחד."
  visualMotifs:
    - "pink spiral shell"
    - "sunlit shallow water"
    - "playful dolphin fin"
    - "single bubble rising"
```

### 10. firefly_namit_adventure — נמית / NIGHT_FEAR (corridor)

```yaml
powerCard:
  title: "כרטיס הצעד הבא של {{childName}}"
  subtitle: "כשהדרך לפניי נראית ארוכה ושחורה"
  coreTool: "the next step is enough"
  steps:
    - "אני לא מסתכל/ת על כל הדרך בבת אחת"
    - "אני נושם/ת ומחפש/ת רק את הצעד הבא"
    - "אני עושה אותו"
    - "אני זוכר/ת: אור קטן מספיק אם הוא מאיר עכשיו"
  companionReminder: "האור שלה היה קטן מאוד. אבל הוא לא התנצל."
  visualMotifs:
    - "tiny firefly halo"
    - "long dark corridor"
    - "single illuminated floor tile"
    - "child's hand reaching forward"
```

### 11. bear_cub_gahal_adventure — דובי / ANGER_FRUSTRATION

```yaml
powerCard:
  title: "כרטיס הכוח של {{childName}}"
  subtitle: "כשאני מרגיש/ה שהחום עולה"
  coreTool: "safe anger release"
  steps:
    - "אני עוצר/ת רגע"
    - "אני מוצא/ת מקום בטוח"
    - "אני נותן/ת לחום לצאת בלי לפגוע"
    - "ואז אני חוזר/ת לדבר"
  companionReminder: "יש דברים שלא צריך לשבור. יש דברים שצריך להעביר דרכם את החום."
  visualMotifs:
    - "roaring pond ripple"
    - "smooth stone"
    - "fallen log"
    - "bear cub paw print"
```

### 12. bear_mati_adventure — מתי / DISAPPOINTMENT (small things seen)

```yaml
powerCard:
  title: "כרטיס הדברים שראיתי של {{childName}}"
  subtitle: "כשלא ניצחתי"
  coreTool: "notice what still exists after a loss"
  steps:
    - "אני נותן/ת להרגשה להיות שם"
    - "אני מסתכל/ת על דבר קטן אחד"
    - "אני מחפש/ת מה עוד היה בדרך"
    - "אני שומר/ת משהו שראיתי"
  companionReminder: "דברים שלא שמים לב אליהם יכולים ללכת לאיבוד."
  visualMotifs:
    - "dry race-leaf with veins"
    - "bear winning-ribbons box"
    - "small forest stone"
    - "soft trail through trees"
```

### 13. mongoose_zariz_adventure — זומי / RESTRAINT_IMPULSE

```yaml
powerCard:
  title: "כרטיס העצירה של {{childName}}"
  subtitle: "כשהגוף שלי רוצה לזוז מהר מדי"
  coreTool: "one small pause before action"
  steps:
    - "אני מרגיש/ה שהגוף רוצה לרוץ"
    - "אני לוקח/ת נשימה אחת"
    - "אני עושה לולאה קטנה עם האצבעות"
    - "אני זוכר/ת: עצירה קטנה עוזרת לעיניים לראות"
  companionReminder: "מהירות יודעת לרוץ. חכמה יודעת לעצור רגע."
  visualMotifs:
    - "green vine loop with seed bell"
    - "soft seed-pod chime"
    - "alert mongoose tail"
    - "blue dragonfly on a rock"
```

---

## fantasy (7)

### 14. chameleon_koko_fantasy — קים / TRANSITION (moving home)

```yaml
powerCard:
  title: "כרטיס הצבעים של {{childName}}"
  subtitle: "כשמקום חדש מרגיש ריק"
  coreTool: "carry one color into the new place"
  steps:
    - "אני זוכר/ת צבע אחד מהמקום הישן"
    - "אני בוחר/ת צבע אחד מהמקום החדש"
    - "אני שם/ה משהו שלי בחדר"
    - "אני זוכר/ת: הצבעים שלי באים איתי"
  companionReminder: "לוקח לצבעים רגע לצאת."
  visualMotifs:
    - "tiny color scarf"
    - "yellow-blue-green-brown threads"
    - "chameleon resting on a hand"
    - "child drawing on a new wall"
```

### 15. dragon_dini_fantasy — דיני / NEW_SIBLING

```yaml
powerCard:
  title: "כרטיס המקום של {{childName}}"
  subtitle: "כשמשהו אחר נכנס למשפחה"
  coreTool: "warmth shared multiplies"
  steps:
    - "אני מרגיש/ה מה שאני מרגיש/ה"
    - "אני זוכר/ת שהחיבוק לא נהיה קטן"
    - "אני בודק/ת אם יש מקום לעוד אחד"
    - "ואז אני עושה מקום"
  companionReminder: "החיבוק לא נהיה קטן יותר. הוא למד לעשות מקום."
  visualMotifs:
    - "warm windowsill spark"
    - "dragon stone of three"
    - "family hug widening"
    - "soft ember glow"
```

### 16. fawn_tzvi_fantasy — צבי / SENSORY_OVERLOAD

```yaml
powerCard:
  title: "כרטיס הנשימה של {{childName}}"
  subtitle: "כשהכל מסביב גדול מדי"
  coreTool: "breath makes room inside the noise"
  steps:
    - "אני שם/ה יד על הלב"
    - "אני נושם/ת לאט — בשבילי"
    - "אני נותן/ת לקולות להיות בגודל האמיתי שלהם"
    - "אני זוכר/ת: עשיתי לי, לא להם"
  companionReminder: "לא עשיתי להם. עשיתי לי."
  visualMotifs:
    - "green-blue chest mark"
    - "forest of mirror-creatures"
    - "fawn breathing softly"
    - "small sound-creature shrinking"
```

### 17. butterfly_zohar_fantasy — זוהר / FIRST_DAY_SCHOOL

```yaml
powerCard:
  title: "כרטיס האמצע של {{childName}}"
  subtitle: "כשאני במקום חדש"
  coreTool: "one small step while in the middle"
  steps:
    - "אני מסתכל/ת רק על הצעד הבא"
    - "אני לוקח/ת נשימה אחת"
    - "אני אומר/ת שלום קטן"
    - "אני זוכר/ת: מותר להיות באמצע"
  companionReminder: "עלה אחד. נשימה אחת. שלום אחד."
  visualMotifs:
    - "butterfly with copper dust"
    - "single leaf bridge"
    - "magical meadow nursery"
    - "cocoon in soft light"
```

### 18. bunny_ometz_fantasy — בוני / SHYNESS_SOCIAL

```yaml
powerCard:
  title: "כרטיס המילים של {{childName}}"
  subtitle: "כשהמילים נתקעות"
  coreTool: "one small honest word"
  steps:
    - "אני בוחר/ת מילה אחת קטנה"
    - "אני לא צריך/ה להגיד הכל"
    - "אני אומר/ת אותה כמו שיוצא"
    - "מילה אמיתית יכולה להיות גם לחישה"
  companionReminder: "המילים לא חייבות לצאת חזק. רק באמת."
  visualMotifs:
    - "tiny whisper-word creature"
    - "bunny ear bent close"
    - "meadow nursery party"
    - "one shy word kept by pillow"
```

### 19. bear_mati_fantasy — מתי / DISAPPOINTMENT (new box, value reframe)

**Authoring note (locked):** This card must NOT be a second take on "I lost a race." Adventure already does that. Fantasy lives one level up — it's about a **conceptual shift in what deserves a place**. The leaf is a permitted background motif but is NOT the emotional center; the **two-box image** is.

```yaml
powerCard:
  title: "כרטיס הקופסה החדשה של {{childName}}"
  subtitle: "כשמשהו חשוב לא נכנס למקום הרגיל"
  coreTool: "open a new place for a different kind of value"
  steps:
    - "אני שם/ה לב שיש דבר שלא נכנס לקופסה הרגילה"
    - "אני פותח/ת לו מקום משלו"
    - "אני נותן/ת לו שם"
    - "אני שומר/ת אותו לידם — לא במקומם"
  companionReminder: "יש דברים שצריך לפתוח להם קופסה משלהם — לא קטנים, רק אחרים."
  visualMotifs:
    - "two boxes side by side, the new one fresh wood"
    - "small object held carefully in palm"
    - "oak leaf as background motif only"
    - "winner's gentle bow toward another"
```

---

## Authoring notes

**Step 4 variation audit (19/19, target ~30% non-זוכר):**
- Variations (5): Dobi `ואז אני חוזר/ת לדבר` · Lily `שקט קטן... מספיק` · Mati-adv `אני שומר/ת משהו שראיתי` · Buni `מילה אמיתית... לחישה` · Dini `ואז אני עושה מקום` · Mati-fan `אני שומר/ת שם דבר אחד`
- All others (14): `אני זוכר/ת...`
- Ratio: ~31% variation. On target.

**companionReminder sourcing audit:**
- All 19 are story-anchored: heart-line excerpts, world-rule shortened, or direct character lines (e.g. Dudi `דבר אחד.` is verbatim page 11).

**Two Mati cards — emotional levels MUST stay distinct:**
- Adventure (#12) = **immediate tool for the child right after a loss.** Sensory recovery: feel the feeling, notice what was still there, save one small thing.
- Fantasy (#19) = **a perceptual shift one level deeper.** Not about coping with the loss — about discovering that *some things deserve their own place*. The new box is the emotional center; the leaf is a background motif only.
- The Fantasy card's `companionReminder` is deliberately NOT loss-anchored ("כשלא ניצחתי" removed). It articulates a value statement Mati's character arrives at.
- If a future edit makes the two cards' steps start to rhyme, that's a red flag the stories themselves are too close.

**Outstanding:**
- `octopus_seara_adventure` (slot 4) is QUEUED, not yet SHIPPED. Not included in this set. When it ships, add a 20th Power Card.
