# Literary Shelf Tracker

**Purpose.** Single visible counter for the C-first strategy: ship hand-tuned literary-tier rewrites into `story-bank/v5-fixed-v2/` before touching the recipe pipeline.

**Don't expand this file.** It is not a workflow tracker, a kanban, a methodology doc, or a brief template. It's a checklist. If it starts to look like anything else, delete the new section.

---

## Locked rules (do not violate)

**Page count is determined by direction. Single source of truth, no exceptions:**

| Direction | Pages | Age | Price |
|---|---|---|---|
| **bedtime** (לפני שינה) | **10** | 4–6 | ₪59 |
| **adventure** (הרפתקה) | **15** | 6–8 | ₪79 |
| **fantasy** (פנטזיה) | **20** | 6–8 | ₪99 |

Bank uses **one file per `<companion>_<direction>.md`** — no `ageBand` variants. Each direction targets one age range. A literary rewrite that doesn't match its direction's page count is DRAFT, not SHIPPED.

---

## Strategy in one breath

1. Recipe pipeline produces *competent compliant* prose, not literary. Empirically demonstrated (chameleon_koko A/B, 2026-05-26).
2. C-first: hand/AI-edit 5 golden examples, drop them into the production bank.
3. Only after 5 golden examples ship do we revisit the recipe pipeline — and then only as a **few-shot generator** trained on those examples. No refactor until then.

---

## The slots

| # | Story | Pages | Status | Commit | Notes |
|---|---|---|---|---|---|
| 1 | `fox_uri_adventure.md` (אוּרִי וּמַפַּת הַצְּלָלִים) | 15 ✓ | **SHIPPED** | `f96fbb9d` 2026-05-27 | Manual rewrite + ChatGPT QA. Gate passes for boy/girl + substring fix verified. |
| 2 | `chameleon_koko_fantasy.md` ({{childName}} וקים בצעיף הצבעים) | **20 ✓** | **SHIPPED** | `8ff86401` 2026-05-28 | Third fantasy. TRANSITION (moving home). Kim's colors take time in new places. Scarf knit by grandma with stripes from every place she's lived — each color stayed. p13 child finds OLD ROOM colors in magical clearing; p15-16 the loom weaves old + new brown. Heart line p10 'הם לא נעלמו. לא.' Gate 4/4. |
| 3 | `bolly_armadillo_bedtime.md` ({{childName}} ובולי מוצאים דבר אחד אמיתי) | **10 ✓** | **SHIPPED** | `f172b1eb` 2026-05-28 | ChatGPT cut 15→10 by removing repetition. Heart line p9 preserved verbatim. Two distinct wrapping moments p4+p8. New wisdom on p5: 'כדור הוא לא מחבוא. לפעמים הוא הפסקה.' Gate 4/4. |
| 4 | `octopus_seara_adventure.md` (יובל וסיארה במרפאת השיניים של הים) | 15 (target) | QUEUED | — | Golden-tier draft from 2026-05-27, awaiting cut from 16→15 (merge p6+p7) and adapt-pass. Direction=adventure / MEDICAL_PROCEDURE. Not blocking — shelf already at 5/5/5 without it. Optional 6th adventure when ready. |
| 5 | `dolphin_shahkan_adventure.md` ({{childName}} ודודי מחפשים את הצדף הקטן) | 15 ✓ | **SHIPPED** | `a09ce577` 2026-05-28 | Literary rewrite. FOCUS_LEARNING, residue = pink spiral shell with soft hum. Companion name corrected שחכן→דודי. Gate passes 3/3. |
| 6 | `owl_chacham_bedtime.md` ({{childName}} ובובו מקשיבים ללילה) | **10 ✓** | **SHIPPED** | `bd783105` 2026-05-28 | First story under new bedtime=10p rule. NIGHT_FEAR. Heart line p10 "וחושך עם שמות הוא חושך קטן יותר". Mechanic: naming sounds to shrink them, one at a time. Gate passes 4/4 (boy/בר, girl/נטע, boy/דניאל, girl/Mika). |
| 7 | `firefly_namit_adventure.md` ({{childName}} ונמית במסדרון הגדול) | **15 ✓** | **SHIPPED** | `e0a5f70f` 2026-05-28 | 15p adventure under NIGHT_FEAR (dark corridor + retrieve doll). Mechanic: tiny firefly light illuminates only the next step, not the whole path. Heart line p14 "האור שלה היה קטן מאוד. אבל הוא לא התנצל." Gate passes 4/4. |
| 8 | `dragon_dini_fantasy.md` ({{childName}} ודיני במערת האבנים החמות) | **20 ✓** | **SHIPPED** | `4d39f2e7` 2026-05-28 | First 20p fantasy under page-count rule. NEW_SIBLING via parallel structure (dragon's stone mirrors child's family). Heart line p19 "החיבוק לא נהיה קטן יותר. הוא למד לעשות מקום." Same commit fixed /ה Hebrew \b regex bug. Gate passes 4/4. |
| 9 | `fawn_tzvi_fantasy.md` ({{childName}} וצבי ביער הקולות) | **20 ✓** | **SHIPPED** | `95930eab` 2026-05-28 | Second 20p fantasy. SENSORY_OVERLOAD via noise-as-creatures world. Heart line p8: 'לא עשיתי להם. עשיתי לי.' Strongest single line in the shelf. p16 agency-transfer: child regulates a frightened sound-creature smaller than themselves. Gate 4/4. |
| 10 | `bat_lily_bedtime.md` ({{childName}} ולילי מקשיבים למה שעובר) | **10 ✓** | **SHIPPED** | `72758071` 2026-05-28 | Second bedtime. RACING_THOUGHTS. p3 reframe: 'שקט גמור הוא חשוד'. p7→8 the leap from naming sounds to naming thoughts intuited by the child. p9 the Mom-was-tired thought Lily doesn't fix — just listens with. Gate 4/4. |
| 11 | `bee_ima_bedtime.md` ({{childName}} ודבורי בצנצנת האהבה) | **10 ✓** | **SHIPPED** | `094d3083` 2026-05-28 | Third bedtime. NEW_SIBLING. Show-only metaphor — never named in dialogue. p3 Dvori shares the child's same insecurity. p9 hive-mixing scene. p10 hug visibly grows when more bodies join. Residue: drop of honey on windowsill + hive hum. Gate 4/4. |
| 12 | `bear_cub_gahal_adventure.md` ({{childName}} ודובי בבריכה הרועמת) | **15 ✓** | **SHIPPED** | `e6090ebf` 2026-05-28 | Fourth adventure. ANGER_FRUSTRATION. Four-stage body-release: roar → stones → stomp → breathe. p3 anger-direction wisdom, p5 'תירגע = closing door', p15 closing montage with squirrel offering peace berry. p15 visually overloaded but emotionally complete. Gate 4/4. |
| 13 | `starfish_kokhavi_bedtime.md` ({{childName}} וכוכבי שמחכה לצמוח) | **10 ✓** | **SHIPPED** | `28325a95` 2026-05-28 | Fourth bedtime. MEDICAL_PROCEDURE (small scrape on knee). Kochavi the starfish appears in moonlit puddle, teaches quiet healing. Heart line p8 'את חזקה. אבל מותר לך לקחת זמן.' p6 'לפעמים הריפוי עובד בשקט.' Companion name updated דורי→כוכבי. Gate 4/4. |
| 14 | `bunny_ometz_fantasy.md` ({{childName}} ובוני בממלכת המילים הלוחשות) | **20 ✓** | **SHIPPED** | `0b3c8f4c` 2026-05-28 | Fourth fantasy. SHYNESS / NEW_SOCIAL. Magical clearing with word-creatures. p14-15 the tangled word-creature (all stuck words at once); p17 partial real return to party; p20 unused word kept by pillow. Heart line p18 'כולן היו שלו/ה.' Gate 4/4. |
| 15 | `song_whale_bedtime.md` ({{childName}} ולולי בשיר שחזר) | **10 ✓** | **SHIPPED** | `044be39c` 2026-05-28 | Fifth bedtime. LONELINESS. Whale Luli's song travels deep ocean and finds answers. p2 'קול שנשלח באמת לא נעלם מיד.' p9 'הילד לא היה לבד באמת — רק רחוק יותר מאלה שמקשיבים לו.' Gate 4/4. |
| 16 | `butterfly_zohar_fantasy.md` ({{childName}} וזוהר במקום שבאמצע) | **20 ✓** | **SHIPPED** | `8186c4d2` 2026-05-28 | Fifth fantasy. FIRST_DAY_SCHOOL. Metamorphosis frame + magical meadow nursery with in-between creatures. Heart line p8 'לפעמים גם גולמים מפחדים. הם פשוט מפחדים בשקט.' p11 child helps Poli with leaf-bridge = agency transfer. ChatGPT completed truncated p20. Gate 4/4. |
| 17 | `bear_mati_adventure.md` ({{childName}} ומתי שלמד לראות) | **15 ✓** | **SHIPPED** | `7b654b7f` 2026-05-28 | Fifth adventure. DISAPPOINTMENT_LOSING. The winning bear loses for the first time. Heart line p13 'דברים שלא שמים לב אליהם יכולים ללכת לאיבוד.' p14-15 Mati opens NEW box ('דברים שראיתי') beside the trophy box; the leaf is first item. Gate 4/4. |
| 18 | `turtle_beiti_bedtime.md` ({{childName}} וטולי הולכים עם הבית) | **10 ✓** | **SHIPPED** | `444a7fa4` 2026-05-28 | **First recipe-generated golden.** PATIENCE_PACE. Gpt-5 + 3 bedtime examples, 272s. Tuli carries his shell-home, won't leave anything behind. Heart line p9 'כף היד של {{childName}} מצאה קצב שלא מבקש למהר.' p5 leaf-on-shell metaphor. p8 child engineers book-bridge respecting Tuli's pace. Gate 4/4. |
| 19 | `mongoose_zariz_adventure.md` ({{childName}} וזומי ולולאת העצירה הקטנה) | **15 ✓** | **SHIPPED** | `26e5f0ed` 2026-05-28 | Second recipe-generated golden. RESTRAINT_IMPULSE. Gpt-5, 159s. Vine-loop + seed-pod-bell mechanic. Echo structure: collapsed hut p1 → rebuilt acorn tower p13. Heart line p12 'כשהיד שלי עצרה, העיניים שלי הספיקו לראות.' Companion shares the struggle. Gate 4/4. |
| 20 | `bear_mati_fantasy.md` ({{childName}} ומתי שלמד לראות) — **parallel to slot 17** | **20 ✓** | **SHIPPED** | `d5b1c6f1` 2026-05-28 | Parallel product: same companion + opening arc as slot 17 (15p adventure), but pp 16-20 get full breathing room. NEW p16 oak with two stubborn golden leaves; p17 ritual box-building; pp 18-19 squirrel rematch + Mati's first soft clap; p20 split-scene closing. ⚠️ **UI cards must differentiate:** adventure = 'focused arc on handling not-winning'; fantasy = 'deeper forest journey on seeing what remains after losing'. Gate 4/4. |

---

## Definition of "SHIPPED"

A slot moves to **SHIPPED** only when ALL of:
- `.md` file replaces existing in `story-bank/v5-fixed-v2/`
- **Page count matches direction rule** (bedtime=10, adventure=15, fantasy=20)
- All light-validation checks pass (imageDirection per page, WORD_COUNT footer, no Mustache leakage, no denylist hits, well-formed gender chips, `{{childName}}` on ≥5 pages, no English drift)
- `runStoryPersonalizationGate` passes for both `boy` + `girl` test names
- One focused commit `feat(story-bank): upgrade <slug>`

Anything in the table that doesn't meet all four is **DRAFT**, not SHIPPED.

---

## When this hits 5 SHIPPED golden

Currently SHIPPED: **20 golden** across 6/5/6 (counting Mati twice — once per direction).

| Direction | Count | Stories |
|---|---|---|
| **bedtime (10p)** | 6 | Bolly · Bubu · Lily · Dvori · Kochavi · Luli · Tuli |
| **adventure (15p)** | 5 | Uri-fox · Dudi · Namit · Dobi · Mati · Zomi |
| **fantasy (20p)** | 6 | Koko · Dini · Tzvi · Buni · Zohar · Mati(20p) |

**Recipe pipeline production-ready.** Slots 18-19 generated by recipe few-shot (commit `993960a4` infrastructure), 2/2 golden on first try. Slot 20 = parallel 20p of slot 17 — same companion, different pace + closing — a product distinction, not a duplicate.

Note: bedtime actually has 6 (counting Luli). Including dolphin_shahkan adventure makes total **16 SHIPPED**.

**Categories covered (15 distinct):** NIGHT_FEAR (3x) · FEAR_GENERAL · FOCUS_LEARNING · NEW_SIBLING (2x) · SENSORY · RACING_THOUGHTS · ANGER · MEDICAL · SHYNESS · TRANSITION · LONELINESS · FIRST_DAY · DISAPPOINTMENT_LOSING.

**Recipe few-shot training threshold (9/9) far exceeded.** Recommended training set (3 per direction, distinct categories):
- bedtime: Bubu (NIGHT_FEAR), Lily (RACING_THOUGHTS), Kochavi (MEDICAL)
- adventure: Dudi (FOCUS_LEARNING), Dobi (ANGER), Mati (LOSING)
- fantasy: Dini (NEW_SIBLING), Tzvi (SENSORY), Buni (SHYNESS)

Next phase: build few-shot generator on these 9 → run MVP_MATRIX → measure quality vs golden bar. See memory `literary_first_story_direction.md`.
