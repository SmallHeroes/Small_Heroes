# Cursor Brief — Voice Reviewer, Calibration Tuning Round 1

**Owner:** CTO  **Status:** ready for Cursor  **Depends on:** Phase C v1 (shipped, diagnostic-only)
**Outcome of this brief:** a re-runnable calibration that is trustworthy, and a reviewer that stops punishing our own architecture.

---

## 0. Context & decision

Calibration round 1 ran over the 8-story corpus. Result:

| axis | precision | recall | notes |
|---|---|---|---|
| voice | 30.8% | 100% | 9 FP — 6 `body_as_character`, 2 `motif_overuse`, 1 `semantic_misuse` |
| ai-smell | 100% | 100% | n=1 — too few examples |
| read-aloud | 100% | 100% | n=3 — best axis, still thin |
| relationship | 0% | 0% | 7 `parallel_action_chains` story-diagnostics scored as FP; 1 FN mis-bucketed |
| age-fit | 100% | 100% | zero evidence (tp=0 fp=0 fn=0) — not a measurement |

**Keystone PASSED** — `דוקדק` caught as `semantic_misuse`, confidence 1.00, on the exact run Y-lite let through. The layer has proven value.

**Decision (unchanged):** `VOICE_REVIEWER_BLOCKING` stays **OFF**. v1 is **diagnostic-only**. No axis graduates to blocking. This brief is a tuning round so that calibration round 2 produces numbers we can trust — graduation to blocking is a separate, later decision and is **out of scope here**.

The two root problems this brief fixes:
1. The calibration harness has real bugs — we are measuring with a bent ruler.
2. The reviewer over-flags our intentional design: somatic body-state language, the Bolly warmth motif, and the relationshipLoop structure itself.

Work the phases in order. **Phase 1 (harness) must land before Phase 4 (re-run).**

---

## Phase 1 — Fix the calibration harness (code)

Files: `scripts/calibrate-voice-reviewer.ts`, `lib/story-generator/editorial/voice-calibration.ts`

### 1.1 — Land Fix B (min-evidence guard) — never applied last round
The report still shows `blockingCandidates: ["ai-smell","read-aloud","age-fit"]` — that is the *old* filter. `age-fit` has zero evidence; `ai-smell` has n=1. In `scripts/calibrate-voice-reviewer.ts`, replace the `blockingCandidates` filter:

```ts
const complete = fixtures.length === ids.length;
if (!complete) {
  console.log(
    `\n=== CALIBRATION INVALID — ${ids.length - fixtures.length}/${ids.length} stories did not run ===`
  );
}
const blockingCandidates = !complete
  ? []
  : axisStats.filter((a) => {
      const expected = a.matched + a.falseNegatives; // expected findings for this axis
      return (
        expected >= 3 &&   // axis genuinely exercised
        a.matched >= 1 &&  // caught at least one real defect
        a.precision >= 80 &&
        a.falsePositives <= 1
      );
    });
```

### 1.2 — Land Fix C (partial run = invalid) — never applied
In the `writeFileSync` JSON object add `valid: complete,` (right after `corpusSize`). At the end of `main()`, after the `Wrote ...` log, add `if (!complete) process.exit(1);`. A calibration where any fixture skipped is not a calibration.

### 1.3 — Fix `familyToAxis` — `name_overuse` is on the wrong axis
In `voice-calibration.ts`, `familyToAxis()` currently has `name_overuse: 'relationship'`. That is wrong — name overuse is not a relationship issue. Change it:

```ts
name_overuse: 'voice',
```

The root issue in name overuse is prose texture, subject monotony, and mechanical author voice. It affects read-aloud, but it belongs on the `voice` axis. It must not be `relationship`.

### 1.4 — Fix the axis-source asymmetry in `summarizeAxisMetrics`
TP/FP are currently counted on `finding.axis` (whatever the LLM picked); FN is counted on `familyToAxis(exp.family)` (the static map). Two different sources → the metrics never reconcile. Make all three deterministic — drive the axis from the **family**, not from the LLM's `axis` field:

```ts
// inside summarizeAxisMetrics, replace `const axis = finding.axis;`
const axis = familyToAxis(finding.family);
```

The LLM's `axis` field stays in the finding for display, but calibration math must use the family→axis map only.

### 1.5 — Add per-family metrics
Per-axis is too coarse. `semantic_misuse` is the keystone and the realistic first family that could ever graduate to blocking — today it is invisible inside the 30.8% `voice` axis. Add a `summarizeFamilyMetrics(fixtures)` that returns the same `{precision, recall, matched, falsePositives, falseNegatives}` shape but keyed by **family** (all 11 families). Print it under the per-axis block and include it in `voice-calibration-report.json` as `familyStats`.

### 1.6 — Fix the matched/expectedCount inconsistency
In `calibrateFixture`, `matched` = `matchedExpected.size` (counts optional matches too); `expectedCount` = non-optional only. So `matched` can exceed `expectedCount` (`fantasy_gold` → `1/0`). Make `matched` count **non-optional** matched expecteds only, so `matched ≤ expectedCount` always holds. If you want to keep optional visibility, add a separate `matchedOptional` field — do not overload `matched`.

---

## Phase 2 — Tune the reviewer (prompt + Standard)

Files: `lib/story-generator/prompts/voice-reviewer-prompt.ts` (`VOICE_REVIEWER_SYSTEM_PROMPT`), `lib/story-generator/STORYBOOK_VOICE_STANDARD.md`, `lib/story-generator/editorial/voice-schemas.ts`

### 2.1 — `body_as_character`: stop flagging legitimate somatic language
This is the single biggest precision lever. 6 of 9 voice FPs are `body_as_character` firing on normal body-state description. Add this paragraph to the system prompt (new block, after the FIVE AXES section):

```
BODY-STATE LANGUAGE IS INTENTIONAL. This is a calm/medical/anxiety storybook.
Sentences where the body is the LOCUS of a felt sensation are correct and
on-brand — do NOT flag them as body_as_character:
  OK:  "הגוף עוד דרוך"   "הכתפיים עולות"   "הנשימה מתקצרת"
  OK:  "הגוף שלה לא מתכווץ הפעם"   "הגוף מתחיל להתרכך"   "הגוף לא נסוג"
Flag body_as_character ONLY when the body part or an abstraction genuinely
REPLACES the child as the agent of the scene — it acts, decides, carries the
narrative, while the child disappears from the sentence — or when the result
reads as therapeutic/clinical prose rather than a story:
  FLAG: "הגוף יודע"   "הגוף מחליט"   "הגוף זוכר"   "הצעדים נושאים מבט"   "השקט עונה"
```

In `STORYBOOK_VOICE_STANDARD.md`, revise the `body_as_character` family: replace its BAD/GOOD examples with the two columns above so the Standard and the prompt agree.

### 2.2 — Draw the `semantic_misuse` ↔ `body_as_character` boundary
The reviewer tagged "הגוף מרגיש את הצליל ויודע שהוא שם" as `semantic_misuse` — it is arbitrating inconsistently between the two families for body-lines. Clarify Family F in both the prompt and the Standard:

```
semantic_misuse type (b) — "impossible subject-verb" — is NOT triggered by a
body feeling a sensation ("הגוף מרגיש" is fine). It is triggered by a body or
abstraction performing a human COGNITIVE/INTENTIONAL act in a way that reads as
a plain error ("הצעדים שומעים", "האור דוקדק"). When a body-line is borderline,
prefer body_as_character (or no finding) over semantic_misuse — reserve
semantic_misuse for genuine language errors.
```

### 2.3 — `motif_overuse`: make it story-scope only
A single page cannot exhibit "overuse." The reviewer flagged "ובפנים חם" as a **page** finding 8 times — a category error.

- **Code:** in `voice-schemas.ts` `processVoiceFinding`, before the story-scope normalization runs, coerce `family === 'motif_overuse'` to `scope = 'story'` (the existing story-scope branch then nulls `page` and forces `severity = 'diagnostic'`).
- **Prompt:** replace the current INTENTIONAL MOTIFS paragraph with:

```
INTENTIONAL MOTIFS & motif_overuse. Bolly has signature motifs by design — the
"טוּמְפּ" sound, and the warmth-shell motif "בפנים חם". A signature motif
appearing once, or a few times across a story, is by design — NEVER flag it.
motif_overuse is ALWAYS a story-scope diagnostic, never a page finding. Raise it
only when ONE motif genuinely saturates the story (most pages / 3+ times) to
the point of monotony.
A single occurrence of a motif as a bare, unanchored fragment on one page is
NOT motif_overuse. If that bare fragment genuinely harms the line, flag it
under the family that fits the real problem — read_aloud_stumble, ai_poetic,
or therapeutic_abstract — never motif_overuse.
```

### 2.4 — `relationship`: stop flagging the relationshipLoop itself
All 7 relationship findings are `parallel_action_chains` story-diagnostics — the reviewer is flagging our sealed B.3 loop as a defect. Add to the prompt:

```
THE relationshipLoop IS INTENTIONAL. The loop "child feels -> companion answers
-> child notices -> shift" is the core architecture of these stories. Do NOT
flag its existence, its repetition, or its child-acts / Bolly-responds shape.
Flag the relationship axis ONLY when genuine turn-taking is ABSENT:
  - the child never registers or addresses Bolly;
  - Bolly does not respond to the child's specific state (responds to nothing,
    or generically);
  - relief arrives automatically, with no exchange between them;
  - across most pages there is no causal link between what the child does and
    what Bolly does.
A correct loop — Bolly answering in body or sound (טוּמְפּ), the child noticing
or mirroring him, a "גם אתה?" / "ככה?" beat, body-to-body contact — is NEVER a
finding. Relationship findings remain story-scope diagnostic.
```

---

## Phase 3 — Enrich the corpus

Files: `lib/story-generator/__tests__/voice-calibration-corpus/*.human.json`, `corpus.ts`, the probe fixture files (already authored).

### 3.1 — Known-NEGATIVES (critical — do not skip)
Add `expectedNonFindings` entries to the **existing** `.human.json` files, so round 2 can measure that the FP fixes worked. Each entry: `{ "family": "...", "quoteContains": "...", "note": "..." }`.

| fixture | family | quoteContains |
|---|---|---|
| `fantasy_gold` | `body_as_character` | `המבט נח על האור` |
| `fantasy_gold` | `body_as_character` | `המדחום כבר לא נוגע` |
| `fantasy_gold` | `motif_overuse` | `ובפנים חם` |
| `adventure_michal` | `body_as_character` | `הגוף שקט` |
| `adventure_daniel` | `motif_overuse` | `ובפנים חם` |
| `bedtime_noa` | `body_as_character` | `הגוף שלה לא מתכווץ` |
| `bedtime_michal` | `body_as_character` | `הגוף שלה לא מתכווץ` |
| `bedtime_daniel` | `body_as_character` | `הגוף שלה לא מתכווץ` |

Also add `parallel_action_chains` as an `expectedNonFinding` to **all 8** existing fixtures — their loops are sealed and judged correct, so a story-scope `parallel_action_chains` diagnostic on them is not a defect.

**CTO decision (confirmed):** `fantasy_gold` "הגוף מרגיש את הצליל ויודע שהוא שם" (`semantic_misuse`) stays OUT of `expectedNonFindings` — "הגוף יודע" leans body-as-agent, so it remains measured.

### 3.2 — 5 new probe fixtures — wiring only
The 5 probe fixtures are already authored by the CTO and present in `lib/story-generator/__tests__/voice-calibration-corpus/` (`.md` + `.human.json` for each). Cursor's job is wiring only:

- Add all 5 ids to `VOICE_CALIBRATION_FIXTURE_IDS` in `corpus.ts`. It is an explicit `as const` array, and `listCalibrationFixtures()` only picks up ids in that array — so this wiring is mandatory; without it the files never run.
- Confirm `loadCalibrationFixture` resolves each.

The 5 ids and what each plants:
1. `probe_impossible_subject` — impossible subject/verb → expected `semantic_misuse`, page.
2. `probe_abstract_speaker` — abstract noun as a speaking character → expected `body_as_character`, page (sibling `semantic_misuse` in `expectedNonFindings` is intentional).
3. `probe_gender_mismatch` — "דניאל לוחשת" (boy + feminine verb) → expected `semantic_misuse`, `optional: true`. Missing it is NOT a failure — gender-inflection is owned by the deterministic validator (#178). Do NOT invent a family for it and do NOT force it into `semantic_misuse`; if the reviewer does not catch it, that optional miss is itself the signal that gender needs #178.
4. `probe_dense_readaloud` — an over-dense opening line → expected `read_aloud_stumble`, page.
5. `probe_relationship_failure` — child and Bolly together with no real turn-taking → expected story-scope `parallel_action_chains` (sibling `mechanism_over_relationship` in `expectedNonFindings` is intentional).

**Do NOT rewrite, normalize, "improve", translate, or "fix" the CTO-authored fixture story text.** The planted defects are intentional — editing the Hebrew destroys the test.

---

## Phase 4 — Re-calibrate

Run `npx tsx scripts/calibrate-voice-reviewer.ts` (env loads automatically via `@next/env`).

**Round 2 acceptance checklist — all 8 must hold (CTO gate):**

1. `relationship` no longer flags the 8 sealed/valid stories — their loops are correct.
2. `probe_relationship_failure` IS caught (story-scope `parallel_action_chains`, or `mechanism_over_relationship`).
3. `body_as_character` no longer fires on legitimate somatic body description.
4. `semantic_misuse` still catches `דוקדק` (keystone) AND `probe_impossible_subject`.
5. `read_aloud_stumble` stays clean — no new false positives; `probe_dense_readaloud` caught.
6. `motif_overuse` does not flag "ובפנים חם" when it is an intentional Bolly motif.
7. `blockingCandidates` no longer includes `age-fit` (or any axis on zero / sub-threshold evidence).
8. Per-family metrics are present in the report, not only per-axis.

**Still diagnostic-only after round 2.** Graduating any axis to blocking is a separate decision and needs a larger corpus — not part of this brief.

---

## Out of scope / parked

- **Bolly never initiates.** The B.3 loop is structurally child-driven — beat 2 is always `companionAnswers`; Bolly only ever responds. The reviewer is correct that this is real. It is *not* a v1 defect, but it is a genuine relationship-depth ceiling. Parked as a **v0.6 loop-design item**: consider a beat variant where Bolly initiates.
- Axis graduation to blocking — after a larger round-3 corpus.
- Issue #178 (genderConsistency validator) — `probe_gender_mismatch` may surface that the gender-inflection gap belongs to the deterministic validators, not the Voice Reviewer.

---

## Definition of done

1. Phase 1 — `npx tsc --noEmit` clean for the changed files; `blockingCandidates` honors the min-evidence guard; `valid` field present; `familyToAxis` fixed (`name_overuse` → `voice`); per-family metrics in the report.
2. Phase 2 — all four prompt blocks present; `STORYBOOK_VOICE_STANDARD.md` agrees with the prompt; `motif_overuse` coerced to story-scope in `processVoiceFinding`.
3. Phase 3 — all 5 probe fixture ids wired into `VOICE_CALIBRATION_FIXTURE_IDS`; `expectedNonFindings` added to the existing 8 fixtures; CTO-authored fixture text unmodified.
4. Phase 4 — round-2 calibration report includes `axisStats` + `familyStats` + `valid: true`; all 8 round-2 gates reported explicitly; report sent to CTO before any graduation discussion.
5. `VOICE_REVIEWER_BLOCKING` remains off.
