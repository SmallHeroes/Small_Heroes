# Cursor Brief — Topic List Unification (canonical 9)

**Owner:** CTO · **Date:** 2026-05-25 · **Status:** v2 — ready for Cursor (refined with guardrails)

---

## Why

The wizard topic step and the home-page "מתי זה מתאים?" are two separately-maintained lists of the same thing — they've drifted in wording and count. Two different "product languages" between the landing page and the purchase flow erodes trust. Fix: **one canonical list, single source of truth.**

---

## 1. One canonical topic object — single source of truth

Define ONE array, consumed by **both** the wizard topic step and the home "מתי זה מתאים?". No second hardcoded copy anywhere.

```js
canonicalTopics = [
  {
    id: "fears",
    label: "פחדים",                 // identical string in wizard + home
    emoji: "🌙",
    categories: ["NIGHT_FEAR", "NOISE_FEAR", "GENERAL_FEARS"],
    wizardDescription: "...",       // short — wizard chip context
    homepageDescription: "...",     // richer — home card supporting copy
  },
  ...
]
```

Keep `wizardDescription` (short) and `homepageDescription` (richer) as **separate fields** — same topic, same label, but the home card carries more explanation. The home page's existing card copy seeds `homepageDescription`.

---

## 2. The canonical 9 (final labels)

| # | id | label | emoji | categories |
|---|---|---|---|---|
| 1 | fears | פחדים | 🌙 | NIGHT_FEAR, NOISE_FEAR, GENERAL_FEARS |
| 2 | new_sibling | אח או אחות חדשים | 👶 | NEW_SIBLING |
| 3 | anger | כעס ותסכול | ⚡ | ANGER_FRUSTRATION |
| 4 | confidence | ביטחון וערך עצמי | 🌟 | SELF_CONFIDENCE |
| 5 | transitions | מעברים ושינויים | 🌱 | TRANSITION |
| 6 | social | חברים ומפגשים | 🤝 | SOCIAL |
| 7 | sensitivity | רגישות ועומס | 🌿 | SENSITIVITY_OVERWHELM |
| 8 | focus | קשב, סקרנות ולמידה | 🦋 | FOCUS_LEARNING |
| 9 | medical | טיפולים רפואיים | 🩹 | MEDICAL_PROCEDURE |

Home page shows exactly these 9. Wizard shows these 9 + "נושא אחר" (§3).

---

## 3. "נושא אחר" — wizard-only escape hatch

- Wizard only — the home page must **NOT** show it (it is not a use case).
- **Do NOT over-promise** — it must not imply arbitrary story generation.
  - Chip label: `נושא אחר`
  - Helper / placeholder when selected: `ספרו לנו בקצרה — נבחר את הכיוון הכי מתאים. למשל: מילואים, מעבר דירה, פחד חדש.`
- The מילואים example in that helper text is deliberate — it surfaces demand without promising support.
- The free-text the parent types is already persisted on the order — **no new telemetry needed**; it can be queried later for demand signal (especially מילואים).

---

## 4. The fear-merge — routing (the critical guardrail)

"פחדים" is ONE parent-facing chip covering THREE underlying story categories. This is a **presentation merge only** — do NOT merge, rename, or touch story-bank categories or enums.

Routing must be **deterministic**:

- Selecting "פחדים" must surface companions from **all three**: NIGHT_FEAR, NOISE_FEAR, GENERAL_FEARS.
- After the parent picks a companion, the system must resolve **exactly one** underlying category.
- Verify the chosen companion + direction maps to an **existing** story-bank file.
- If a companion could map to more than one fear category → **fail loudly**, or use a deterministic, logged priority. **Never randomly pick a fear sub-category.**
- **First check whether the companion alone deterministically resolves the category.** If it does NOT, add a fears-only micro-question after the companion step: `איזה פחד הכי קרוב למה שקורה עכשיו? — לילה / רעשים ואזעקות / משהו אחר`. Add this micro-question **only if routing is otherwise ambiguous** — not by default.
- **Report which path you took** (companion resolves deterministically, or the micro-question is needed) before finalizing.

---

## 5. QA requirements

1. Home page and wizard render the SAME 9 labels + emojis, from the SAME source.
2. Wizard may add "נושא אחר" as a 10th, wizard-only escape hatch; home page must not show it.
3. Selecting each topic produces the correct companion list.
4. Each topic + companion + direction resolves to an **existing** story-bank file.
5. For "פחדים", test all three underlying categories — NIGHT_FEAR, NOISE_FEAR, GENERAL_FEARS — each resolves correctly.
6. No story-bank files or category enums renamed/merged.
7. No production orders mutated.
8. No hardcoded duplicate topic list remains after the change.

---

## 6. Roadmap — NOT in this task

- **מילואים** (parent on reserve duty) — the strongest next topic for an Israeli product. Becomes Topic #10 **only once it has a real, sensitive, reviewed story-bank set** (≥3 directions, ≥1–2 fitting companions, human sensitivity QA, wording that doesn't promise "everything will be fine"). Until then it lives only as the example in the "נושא אחר" helper text.
- **אובדן** (loss / grief) — **sensitive tier.** Needs precise writing, human review, possibly age separation — possibly not MVP at all. Do not add.
- **Rule:** a topic appears in the wizard ONLY if real stories back it.

---

## Out of scope

- No story-bank content changes, no new categories, no enum renames.
- No `Order` schema / DB changes.
- No production order mutation.
- Nothing that touches Phase 2.
