# Phase C — Story Quality Layer

**Status:** Spec / v1 design. No code yet — review before implementation.
**Author:** CTO. **Date:** 2026-05-24 (rev 3 — lexicon dropped from v1; the LLM Voice Reviewer is the centerpiece).
**Related:** `lib/story-generator/STORYBOOK_VOICE_STANDARD.md`; backlog #178 (gender-inflection gap), #184 (Adventure name economy). (#183 lexicon validator — dropped from v1 scope; see 5.1.)

## 1. Why Phase C exists

Recipe-mode ships stories to paying customers with **no human reviewer**. The
v0.5.6 conversions (Fantasy sealed; Adventure + Bedtime 3/3 READY) proved the
*structure* — arc, resilience, gender, caps. They did not prove the *voice*.

The measure for Phase C is one question:

> Would I read this aloud to my own child at night — after dozens of good
> children's books — and not feel that it was written by an AI?

If the answer is "no", the system is not ready for no-human-review. Phase C is
the layer that makes the answer "yes" — reliably, with no person in the loop.

Phase C is **not "another QA pass."** It is a **Story Quality Layer**. It does
not only ask "are there errors?" — it asks "does this sound like a real
children's book?"

## 2. What Phase C gates

- **recipe-sealed** (true for the Bolly line) — the recipe reliably produces
  structurally-correct stories.
- **launch-ready / no-human-review** — NOT yet true. **Phase C v1 is this
  gate.** Until it ships, every recipe — including sealed Fantasy — is
  launch-blocked.

## 3. The five-layer model (target architecture)

| Layer | Name | Mechanism | Question it answers |
|---|---|---|---|
| 1 | Language Correctness | Deterministic (code) | Is the Hebrew correct? |
| 2 | Storybook Voice | LLM | Children's book, or a therapy report? |
| 3 | Age Voice | LLM axis | Is the voice right for the age? |
| 4 | Relationship Quality | LLM axis | Is the companion a friend, not a tool? |
| 5 | Read-Aloud | LLM axis | Does it flow read aloud? |

**Layers 2-5 are axes of ONE multi-axis LLM Voice Reviewer — not five separate
LLM calls.** One rich rubric, one call, findings tagged by axis.

## 4. Roadmap — v1 / v2

### Phase C v1 — the launch blocker (build now)
1. **The multi-axis LLM Voice Reviewer — the centerpiece.** Axes: `voice`,
   `age-fit`, `relationship`, `read-aloud`, `ai-smell`. It catches the issues
   that actually occur — semantic misuse, AI-poetic phrasing, therapeutic
   prose, read-aloud awkwardness. See 5.1 for why this, not a lexicon, leads.
2. Layer 1 — deterministic Language Correctness: the low-false-positive checks
   only. **No Hebrew spell-check / lexicon.**
3. detect -> page-level splice-reroll.
4. Calibration loop on the current 7-story corpus.

### Phase C v2 — later (when there is content to justify it)
- **Age Voice** as standalone per-age profiles — built when the 3-4 / 7-8 age
  tiers actually have recipes. Building age profiles for tiers with zero
  recipes is speculation.
- **Relationship Quality** as a standalone layer — currently largely covered by
  the B.3 `relationshipLoop` structure + the Y-lite Resilience reviewer.
  Promote to its own layer only if calibration shows a recurring gap.
- Finer-grained **Read-Aloud** rhythm scoring.

Building the full five-layer architecture as the *design*, shipping it in
*versions*, is "building for the long term." It is the opposite of a plaster.

## 5. Detector design

### 5.1 Layer 1 — Language Correctness (deterministic)

Pure code, no LLM. Per-language adapter (`he` first). Only **low-false-positive**
checks — things that are unambiguously wrong:
- Foreign characters; broken / abnormal spacing.
- Unresolved `/ה` placeholder residue leaking into prose.
- Gender / number inflection mismatch — verb / pronoun / adjective must agree
  with the child's declared gender (closes backlog #178). A `דניאל` with
  `לוחשת` must never pass.
- Companion-speech and recipe `forbiddenPatterns` — exact deterministic strings.
- Exact known-bad strings — used **only as reroll triggers**, never as
  auto-replacements (no guessed corrections).

Severity: **blocking** — these are unambiguous.

**NOT in Layer 1 — no Hebrew spell-check / lexicon.** A v1 prototype against
the full Hspell dictionary (341k words) settled this empirically:
- The motivating defect — `דוקדק` in `האור ... דוקדק ונוגע בעיניים` — is **a
  real Hebrew word** (a rare pu'al form), present in the dictionary. The defect
  was *semantic* (real word, wrong meaning), not a non-word; a spell-checker
  cannot catch it.
- A blocking Hebrew lexicon is false-positive-prone (rich morphology) and, on
  4 real stories, caught **zero** genuine non-words. The Author model produces
  semantic slips, not non-words.

Semantic misuse -> the LLM Voice Reviewer's `semantic_misuse` family (5.2), not
a deterministic gate. Backlog #183 is parked — an optional low-severity
"unknown token" *warning* is future research only, never a v1 blocker.

### 5.2 The multi-axis LLM Voice Reviewer

One LLM call. Input: the full story + the recipe's age tier + the relevant
`STORYBOOK_VOICE_STANDARD` language section (BAD/GOOD examples in the prompt).
Output:

```ts
{
  storyId: string,
  language: 'he',
  ageTier: '5-6',
  findings: Array<{
    page: number | null,      // page number; null for a story-level finding
    scope: 'page' | 'story',
    axis: 'voice' | 'age-fit' | 'relationship' | 'read-aloud' | 'ai-smell',
    family: string,           // a STORYBOOK_VOICE_STANDARD family id, e.g.
                              // 'therapeutic_abstract', 'name_overuse'
    severity: 'blocking' | 'warning' | 'diagnostic',
    quote?: string,           // exact text — REQUIRED for scope:'page'
                              // (the splice anchor); omitted for scope:'story'
    reason: string,           // references a STORYBOOK_VOICE_STANDARD family
    rerollEligible: boolean,  // true only for scope:'page' + blocking|warning
    confidence: number,       // 0-1. A triage signal for the calibration loop,
                              // NOT a hard gate — LLMs are poorly calibrated
                              // on self-reported confidence.
  }>,
}
```

The reviewer **detects only** — it never returns a `replacement` (see section
6). `family` makes findings measurable in calibration; `scope` decides whether
a finding can trigger a reroll (see 6.2).

## 6. Repair / reroll policy

### 6.1 The iron rule
- **No editor-LLM patches.** No second LLM rewriting lines.
- **No full-story repair.**
- A reroll-eligible finding -> **page-local splice-reroll** of the flagged page
  against its `PageCard`, with a constraint note ("avoid therapeutic /
  AI-poetic phrasing; keep the same beat"). The Author — bound by the full
  recipe contract — rewrites the page. The fixer is the Author, not an editor.
- **Deterministic fixes** (Layer 1) apply in-place only when the correction is
  certain (whitespace, foreign char, exact known-bad string). A malformed word
  is *detected* deterministically but *fixed* by reroll — guessing the intended
  word is judgment, not auto-fix.
- **Failure is fail-safe.** Budget exhausted -> `REVIEW_REQUIRED` -> a human.
  Never ship a degraded patch.

### 6.2 Page-local vs story-level — only page-local findings reroll
Every Voice finding has a `scope`, and the scope decides everything.

**Page-local** (`scope: 'page'`) — a specific bad line on a specific page:
`ניסגר`, `הצעדים נושאים מבט`, an over-dense first sentence, an abstract-noun
speaker. -> eligible for a page splice-reroll.

**Story-level** (`scope: 'story'`) — a pattern across the whole story: the
child not connected enough to the companion, the whole story feeling
mechanical, the name overused on every page, body words ("גוף" / "יד" /
"כתפיים") overused throughout. -> **never rerolled.** A story-level finding is
`severity: 'diagnostic'`, `rerollEligible: false` — it opens a **recipe /
prompt task**. The cause is in the recipe loop text or the Author prompt;
rerolling one page cannot fix it.

### 6.3 Severity matrix
What each issue family does in v1. "warning -> blocking" = starts as a warning,
promoted per-axis only after the calibration loop (section 8) validates it.
Story-level instances of any family collapse to `diagnostic` regardless of the
row below.

| Issue family | Layer | v1 severity | Reroll-eligible | Can block launch |
|---|---|---|---|---|
| Semantic misuse — real word, wrong meaning (F) | Voice | warning -> blocking | yes | yes |
| Gender / number mismatch | 1 deterministic | blocking | yes | yes |
| Foreign chars / placeholder residue | 1 deterministic | blocking | yes (or det. fix) | yes |
| Unnatural subject-verb / broken syntax (G) | Voice | warning -> blocking | yes | yes |
| AI-poetic phrasing (C) | Voice | warning -> blocking | yes | yes |
| Body-as-character, severe, page-local (B) | Voice | warning -> blocking | yes | yes |
| Read-aloud dense sentence (G) | Voice | warning -> blocking if severe | yes | yes if severe |
| Therapeutic prose, mild (A) | Voice | warning | maybe | no |
| Name overuse across the story (I) | Voice | diagnostic | no | no |
| Weak relationship across the story (H) | Voice | diagnostic | no | no |
| Parallel-action / repetitive structure (J) | Voice | diagnostic | no | no |

### 6.4 Reroll budget
Phase C feeds the existing splice-reroll; it does not get an unbounded one.

- Max Phase C reroll rounds: **2**.
- Max pages rerolled per round: **3**.
- Max attempts on the same page: **2**.
- A broad issue on **4+ pages** -> do NOT reroll -> `REVIEW_REQUIRED` + open a
  recipe / prompt task (the cause is structural, not page-local).
- A page that comes back with a *different* issue after 2 attempts ->
  `REVIEW_REQUIRED`. Do not chase it.

### 6.5 Tiering — blocking vs warning
- Layer 1 (Language Correctness) -> **blocking** from day one.
- Voice Reviewer page-local findings -> **warning** during calibration,
  promoted to **blocking** per-axis only after calibration (section 8).
- Story-level findings -> **diagnostic** always.

## 7. The Voice Standard has two consumers

`STORYBOOK_VOICE_STANDARD.md` is not only a QA reference. It feeds two places:

1. **The Author prompt / generation guidance** — so the bad voice is not
   produced in the first place.
2. **The QA Voice Reviewer** — the BAD/GOOD library anchors its judgment.

Plus a **one-time recipe voice-calibration pass** over the three sealed /
converted recipes (Fantasy, Adventure, Bedtime). Many "AI-ish" lines —
`ובפנים חם`, `הגוף עדיין מכווץ` — live in the recipe `relationshipLoop` text
itself, not in Author drift. If only the detector existed it would fight the
recipes on every story forever. The Standard cleans the recipe loop text
**once**; the detector then catches only genuine Author drift.

## 8. Calibration loop

A quality detector cannot validate itself. Before any Voice axis is promoted
to blocking:

1. Run the Voice Reviewer over the current corpus — Fantasy gold + 3 Adventure
   runs + 3 Bedtime runs (7 stories).
2. Compare its findings to the human read already on record for each.
3. Measure false positives / false negatives per axis and per family.
4. Tune the BAD/GOOD library and severities.
5. Only then promote an axis from warning to blocking.

The BAD/GOOD library grows from lines that were *really* flagged — not
invented up front.

## 9. Logging — mandatory, part of the product

Every Phase C run emits a transparent log: what was found, scope, why, what
was done, and the revalidation result.

```
[phase-c] language-correctness: 0 blocking
[phase-c] voice-reviewer: 3 findings
  p4  page  WARNING  ai-smell    family=body_as_character   "הצעדים נושאים מבט אל המדבקה"
  p7  page  WARNING  voice       family=ai_poetic           "החום עובר אל קצה האצבע"
  --  story DIAG     relationship family=name_overuse        (name on 9/10 pages)
[phase-c] reroll: page [4,7] -- against PageCard, constraint=voice
[phase-c] story-level finding -> recipe/prompt task opened, no reroll
[phase-c] revalidated: PASS
[phase-c] final: READY
```

Logs are not a nice-to-have — they are how a no-reviewer system stays
auditable.

## 10. Multilingual architecture

Phase C is `he`-first but built so other languages slot in without a rewrite.

```ts
voiceStandards:   { he: HebrewVoiceStandard,   en: EnglishVoiceStandard,   ... }
languageAdapters: { he: HebrewLanguageAdapter, en: EnglishLanguageAdapter, ... }
```

Each language gets its own BAD/GOOD library, forbidden-pattern families,
gender / agreement rules, punctuation & read-aloud norms, age voice profiles,
and common AI-smell patterns. Hebrew is first and richest because it is the
current MVP. Do not hardcode Hebrew as the world.

## 11. Pipeline placement

```
Author draft
 -> blueprint / technical validators
 -> splice retry (caps)
 -> recipeContract validators
 -> resilience / book QA (Y-lite)
 -> Phase C: Language Correctness (deterministic) + Voice Reviewer (LLM)
 -> page-local findings feed the SAME splice-reroll loop
 -> story-level findings -> recipe/prompt task (no reroll)
 -> full revalidation
 -> READY / REVIEW_REQUIRED / FAILED
```

Phase C does not add a new "apply patches" stage. It adds detectors that feed
the existing splice-reroll.

## 12. What Phase C v1 explicitly does NOT do

- No editor-LLM patching.
- No full-story editorial repair.
- No standalone Age Voice / Relationship layers (v2).
- No language beyond `he` (architecture ready, content later).
- No Hebrew spell-check / lexicon gate — a prototype proved it low-yield and
  false-positive-prone; see 5.1.

## 13. Definition of done — Phase C v1

**Built:**
- Deterministic Language Correctness layer live and blocking — the low-FP
  checks only (gender #178 folded in; no lexicon, see 5.1).
- One multi-axis Voice Reviewer wired; page-local findings feed splice-reroll;
  story-level findings open recipe/prompt tasks.
- Calibration loop run on the 7-story corpus; per-axis precision measured;
  validated axes promoted to blocking.
- One-time recipe voice-calibration pass done on Fantasy / Adventure / Bedtime.
- Transparent logs in place.

**Measured** — v1 is "done" only when, on the calibration corpus:
- The Voice Reviewer catches **>= 80%** of human-marked *severe* issues.
- **False-blocking rate < 10%** (stories blocked for a finding a human would
  not call a defect).
- **<= 1 unnecessary reroll per story** on average.
- **No** launch story carries a Layer 1 blocking issue.
- Every blocking Voice finding cites an exact `quote`.
- Every reroll-triggering finding is `scope: 'page'`.

When v1 is done — built AND measured — the Bolly line can launch with no human
reviewer. Not before.
