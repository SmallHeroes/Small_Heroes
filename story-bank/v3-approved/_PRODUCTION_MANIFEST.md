# Story Bank — PRODUCTION MANIFEST (source of truth)
Last updated: 2026-07-02 · Owner: Guy (approver) · Maintained by: CTO (Claude)

**This file is the single source of truth for which stories are LIVE in the MVP.**
If a story is not listed here, it is NOT production. When in doubt, this file wins.

---

## The 18 production goldens = 6 MVP companions × 3 directions

Legend: ✅ already in `v3-approved/` · 🆕 promote into production this pass

| # | companion | direction | title | category | source of truth |
|---|-----------|-----------|-------|----------|-----------------|
| 1 | fox_uri | adventure | {{childName}} ואוּרי במנגינת הטיפות | MEDICAL | ✅ v3-approved |
| 2 | fox_uri | bedtime | {{childName}} ואוּרי: שומר הנשימות הקטנות | (calm/breath) | 🆕 CALIBRATION (v5==calib, EOL only) |
| 3 | fox_uri | fantasy | {{childName}} ואוּרי: יָם הַחוֹשֶׁךְ | GENERAL_FEARS | ✅ v3-approved |
| 4 | lion_shaket | adventure | {{childName}} וליאו: רק מקום קטן לכעס | ANGER_FRUSTRATION | 🆕 CALIBRATION (v5==calib, EOL only) |
| 5 | lion_shaket | bedtime | {{childName}} וליאו: השאגה הקטנה | ANGER_FRUSTRATION | ✅ v3-approved |
| 6 | lion_shaket | fantasy | {{childName}} וליאו: הבריכה של הרעם | ANGER_FRUSTRATION | ✅ v3-approved |
| 7 | chameleon_koko | adventure | {{childName}} וקִים: השמש שעל הבקבוק | TRANSITION | 🆕 CALIBRATION — **use "איתי" not "עִמִּי"** (see note) |
| 8 | chameleon_koko | bedtime | {{childName}} וקים: הכחול שהבאתי | TRANSITION | ✅ v3-approved |
| 9 | chameleon_koko | fantasy | {{childName}} וקִים: שער הצבעים | TRANSITION | ✅ v3-approved |
| 10 | bunny_ometz | adventure | {{childName}} וּבּוּנִי מוֹצְאִים אֶת הַכַּפּוֹת | MEDICAL_PROCEDURE | 🆕 v5-fixed-v2 (kept+renamed golden) |
| 11 | bunny_ometz | bedtime | {{childName}} ובּוּני: אוזן אחת למחר | MEDICAL_PROCEDURE | ✅ v3-approved |
| 12 | bunny_ometz | fantasy | {{childName}} ובּוּני: דלת הלב | MEDICAL_PROCEDURE | ✅ v3-approved |
| 13 | dragon_dini | adventure | {{childName}} ודיני: כלל מספר אחד | NEW_SIBLING | ✅ v3-approved |
| 14 | dragon_dini | bedtime | {{childName}} ודיני: שמיכה עם רֶוַח | NEW_SIBLING | ✅ v3-approved |
| 15 | dragon_dini | fantasy | {{childName}} ודִּינִי עושים מקום לחיבוק | NEW_SIBLING | 🆕 v5-fixed-v2 (kept golden) |
| 16 | panda_anat | adventure | {{childName}} ועֲנָת נכנסים לאט | SOCIAL | 🆕 v5-fixed-v2 (kept golden) |
| 17 | panda_anat | bedtime | {{childName}} ועֲנָת: הכיסא של מחר | SOCIAL | ✅ v3-approved |
| 18 | panda_anat | fantasy | {{childName}} ועֲנָת: אבן הרגע | SOCIAL | ✅ v3-approved |

**Status: 12 present + 6 to promote = 18.**

---

## Open decision for Guy (slot #7 chameleon adventure)
Two versions exist for the coreLine word choice:
- **"איתי"** (CALIBRATION, colloquial, warm) — recommended; matches intended coreLine "השמש באה איתי", natural register for ages 6–8.
- **"עִמִּי"** (v5-fixed-v2, formal + niqqud) — someone substituted the word; too formal for a children's book.

→ Promote the **"איתי"** version unless Guy prefers "עִמִּי".

---

## Canon anchors (must be present in every page's imageDirection)
- **fox_uri (אוּרי):** neck lantern (canonical accessory)
- **lion_shaket (ליאו):** NO accessory (forbidden cape/scarf/held-prop); dry leaf is environment only
- **chameleon_koko (קִים):** ONE harmonious warm green→yellow tone; **orange nose + mustard shoulder satchel = invariant**
- **bunny_ometz (בּוּני):** cream-white; **heart badge on chest** (NOT a medal)
- **dragon_dini (דיני):** female, moss-green baby
- **panda_anat (עֲנָת):** panda

---

## Known STALE / OLD files (must not be served) — move to OLD/
- `v5-fixed-v2/bunny_ometz_bedtime.md` = "הסיפור שגדל יותר מדי" (GENERAL_FEARS, first-person, NOT personalizable, "medal" drift) — **superseded by #11 "אוזן אחת למחר".** This is the exact file that caused confusion 2026-07-02.
- `v5-fixed-v2/chameleon_koko_bedtime.superseded.md`, `chameleon_koko_fantasy.superseded.md` — already tagged.
- All other v5-fixed-v2 slots for the 6 MVP companions once promoted (avoid same-name-two-folders duplication).
