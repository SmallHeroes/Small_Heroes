# 0067 · Claude → Cursor · Golden-QA re-import (4 slots + 2 sweep fixes + 1 shot-plan regen)

**Context:** Golden-QA pass on the 18-slot MVP bank is complete and Guy-approved. This brief closes it in ONE round-trip. 4 slot changes + 2 one-line sweep fixes + regenerate one shot-plan. No new stories, no model calls, no full-book render.

**Source of truth for the 4 slot edits:** the QA'd target drafts live at
`story-pipeline/02_prompts/drafts/*.bank.md`. Each draft has a Claude QA-note header ABOVE the first `---`. **Use only the content from the `---` frontmatter fence onward** (frontmatter + `--- Page N ---` blocks). Do NOT copy the QA-note header into the bank file. Preserve each live file's existing provenance header style (the `# Story:` + generator/approval lines) — only the frontmatter + pages change.

**Hard rules (CLAUDE.md):** stage with explicit pathspecs ONLY — never `git add -A` (EOL/CRLF churn). Run `npm run check` (tsc + vitest) before commit; commit only when green. Standalone scripts import `server-only` → run with `--require ./scripts/shims/register-server-only.cjs`.

---

## 1) fox_uri_adventure — PATCH in place (v3-approved, LOCKED golden)
File: `story-bank/v3-approved/fox_uri_adventure.md`
Final content = `story-pipeline/02_prompts/drafts/fox_uri__adventure.bank.md` (frontmatter + 12 pages).
Apply exactly:
- **Remove the `gender: female` frontmatter line** (chip-safe story; code-verified metadata-only, loader uses chip-detected gender — safe to drop).
- Page 1 imageDirection → `moonlit balcony edge and dark shadow under railing; the sound source is hidden. No bucket visible, no visible drip source yet. companionPresence: present. view: 3-4.`
- Pages **2, 5, 6, 7, 8, 9, 10, 11, 12** = full replace (per draft).
- Page 3 = imageDirection only (per draft); keep page-3 prose.
- Page 8 line: `הוא עשה תור` → `היה לו סדר קטן`.
- Page 12 line: `אני רק מאיר לו קצת` → `אני רק מאיר לו טיפונת`.
- Pages 1 (prose), 4 = unchanged.
Canon now correct: Uri = neck-lantern only (no handheld flashlight / hat / boat). Portable line p11 stays: "קודם מקשיבים. אחר כך מאירים טיפונת."

### 1a) REGENERATE the fox_uri_adventure shot-plan ⚠️
This is the ONLY slot with image sidecars. The **reveal sequence changed** (bucket hidden until p5), so:
- **Regenerate** `story-bank/v3-approved/fox_uri_adventure.shot-plan.json` from the new page imageDirections (use the same generator that produced it).
- `fox_uri_adventure.location-bible.json` + `fox_uri_adventure.zone-sheets/` → **set is unchanged** (same balcony/bucket/ledge); keep as-is unless the regen tool rewrites them.
- After regen, sanity-check that no shot-plan page still references the bucket on pages 1–4.

## 2) bunny_ometz_bedtime — FULL REPLACE (v3-approved, re-angle)
File: `story-bank/v3-approved/bunny_ometz_bedtime.md`
Replace entire story (frontmatter + 8 pages) with `story-pipeline/02_prompts/drafts/bunny_ometz__bedtime.bank.md`. The old clinic-based + locked-female version is discarded. New = "אוזן אחת למחר" (night-before-checkup at home, chip-safe both genders).

## 3) chameleon_koko_fantasy — FULL REPLACE (v3-approved, re-angle)
File: `story-bank/v3-approved/chameleon_koko_fantasy.md`
Replace entire story (frontmatter + 16 pages) with `story-pipeline/02_prompts/drafts/chameleon_koko__fantasy.bank.md`. The old marble/new-room version (duplicated koko_bedtime's frame) is discarded. New = "שער הצבעים" (Color Gate).

## 4) chameleon_koko_adventure — PATCH (v5-fixed-v2, canon fix)
File: `story-bank/v5-fixed-v2/chameleon_koko_adventure.md`
Apply edits from `story-pipeline/02_prompts/drafts/chameleon_koko__adventure.bank.md`:
- imageDirections pp2–12: add "mustard satchel + orange nose never change color" (Kim canon consistency across her 3 books).
- Page 9 prose: child now spots Kim by her **orange nose + satchel** (the 3 lines reworked in the draft).
- Page 11 prose: `"זה בא איתי"` → `"את זה הבאתי"` (kills the `איתי` denylist name-trap — verified blocked by `BANK_PROTAGONIST_DENYLIST`).
- Keep the tail-anchor (זנב-עוגן) mechanic + powerCard + page count (12). No other prose changes.

---

## Sweep fixes (one line each)

## 5) bunny_ometz_adventure (v5-fixed-v2) — passive→active
File: `story-bank/v5-fixed-v2/bunny_ometz_adventure.md`, page 85 line.
`"אֲנִי {בוֹחֵר|בּוֹחֶרֶת} אֶת הַיָּד הַזֹּאת," נֶאֱמַר.` → replace `נֶאֱמַר` with `{אָמַר|אָמְרָה}` (keep niqqud; everywhere else uses active voice; the next sentence already uses `{אָמַר|אָמְרָה} {{childName}}`).

## 6) fox_uri_bedtime (v5-fixed-v2) — redundant chip
File: `story-bank/v5-fixed-v2/fox_uri_bedtime.md`, page 87 line.
`{{childName}} {לא|לא} {קפץ|קפצה} מהמיטה.` → `{{childName}} לא {קפץ|קפצה} מהמיטה.` (לא is gender-invariant).

---

## Verify after all edits
1. `npm run check` (tsc + vitest) — must be green. Watch the v3-approved bank spec.
2. `ENABLE_V3_APPROVED_BANK=true npm run release-check` — must still report **18/18 sellable**, all 6 categories 3/3.
3. Confirm the story personalization gate passes for the 4 changed slots (no unresolved chips, no slash forms in prose, no denylist names) — load each once for a boy and a girl name if there's a quick harness.

## Stage (explicit pathspecs only)
```
git add story-bank/v3-approved/fox_uri_adventure.md story-bank/v3-approved/fox_uri_adventure.shot-plan.json \
        story-bank/v3-approved/bunny_ometz_bedtime.md story-bank/v3-approved/chameleon_koko_fantasy.md \
        story-bank/v5-fixed-v2/chameleon_koko_adventure.md story-bank/v5-fixed-v2/bunny_ometz_adventure.md \
        story-bank/v5-fixed-v2/fox_uri_bedtime.md
```
Commit message suggestion: `bank(golden-qa): re-angle bunny·bedtime + koko·fantasy; patch fox·adventure (+shot-plan) + koko·adventure; sweep fixes`

## Optional (NOT blocking) — general cleanup
The `gender:` frontmatter field is vestigial metadata in **all 12** v3-approved files (loader resolves gender from chips, not this field). If you want the general fix later, remove `gender:` from the other 11 too in a separate commit. Do NOT bundle it here.

---
**Reply as 0068** with: check result, release-check count, shot-plan regen confirmation, and any gate failures.
