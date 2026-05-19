# Small Heroes — Story Generation System Brief
**For external architectural consultation. Status as of 2026-05-19, v0.4.8.**

---

## 0. The product in one paragraph

Small Heroes is a Hebrew children's book product (~99₪/book) that generates a **personalized, illustrated, 10–20 page storybook** from a short wizard (child name, age, gender, companion, direction). The book ships **directly to a paying customer** — there is **no human editor between the AI output and the buyer**. The story must read like a real published Israeli children's book. Currently we are deep in the **story-quality phase**: 1 companion (Bolly the Armadillo), 3 directions (bedtime / adventure / fantasy), trying to get 3/3 stories to READY consistently before scaling.

**Core constraint:** the QA must be ruthless. If the AI produces something off — bad Hebrew, wrong pacing, "AI smell", missing resilience moment, leaked meta-instructions — it must FAIL LOUDLY, not slip through.

---

## 1. The pipeline (high-level, end-to-end)

```
┌─────────┐   ┌─────────┐   ┌────────────┐   ┌─────────────┐   ┌──────────┐   ┌─────────┐   ┌─────────┐
│ Wizard  │ → │ Plan    │ → │ Blueprint  │ → │ Draft       │ → │ Validate │ → │ Repair  │ → │ Y-lite  │ → READY/FAIL
│ inputs  │   │ (LLM)   │   │ (code)     │   │ (LLM, JSON) │   │ (code)   │   │ (LLM)   │   │ (2 LLM) │
└─────────┘   └─────────┘   └────────────┘   └─────────────┘   └──────────┘   └─────────┘   └─────────┘
                                                                                   ↑              ↓
                                                                                   └── page-level repair (LLM)
                                                                                              ↓
                                                                                   revert-on-regression
```

### Stage by stage:

1. **Plan** (`stages/plan.ts`)
   LLM produces structured outline: title, theme, arc summary, `beatMap` (page→beat→companionAction), childPresence, hookAppearances. Validated by `validatePlan` (code) — currently enforces **companion-by-page gate** (fantasy=p1, adventure=p2, bedtime=p3 must mention companion as subject of `companionAction`). On fail → 1 retry → if still fails → **deterministic code injection** (`inferCompanionInjection`) writes a hardcoded Hebrew companion-action into the beatMap.

2. **Blueprint** (`stages/page-blueprint.ts`)
   Pure code. Converts Plan + age tier + category-anchors into a per-page contract:
   ```ts
   { page, purpose, targetWords, maxWords, maxSentences,
     requiredCompanionPresence, companionRequirementMode, requiredAnchor }
   ```
   Direction-aware: fantasy=strict per-page, adventure=cumulative-by-page-2, bedtime=soft.

3. **Draft** (`stages/structured-draft.ts`, DRAFT_MODE=structured)
   LLM returns **JSON array of pages** (Zod-validated), each with `text` + `imageDirection`. Schema enforces maxWords/maxSentences. Author prompt is bounded: simple > beautiful, age-tier density caps, no brackets, anti-AI-smell killer list, anchored examples.
   - On Zod fail: 1 retry.
   - On blueprint-violation (e.g., page 2 missing companion in adventure): code **auto-injects** one of 4 contextual companion sentences (entrance / fear-object / after-mirror / support-quiet) for the specific companion.
   - **Hard pre-assembly gate**: if blueprint violations remain after retry + inject → throw.
   - Output: assembled markdown.

4. **Validate** (`lib/story-validators/`)
   ~20 code validators. The high-signal ones:
   - `instructionLeakage` (~50 patterns + structural detection) — catches meta-instructions ("פשטי את המשפט", "Page 1:", etc.) bleeding into prose
   - `pageLengthSpike` — early pages (1–3) BLOCKING at ≥2.0× median; other pages BLOCKING at ≥3.0× (or ≥2.0× with late-abstract-object)
   - `hookAppearances` — companion must appear N times depending on direction
   - `modeCompliance` — in repair mode, only `changeOnly` pages may differ from previous version + preserveList must remain
   - `companionPresence`, `childPresence`, `categoryFit`, `endingFit`, `densityCheck`, `nikkudConsistency`...
   Verdict: PASS / WARN / FAIL_TECH (BLOCKING).

5. **Editorial Repair** (`stages/run-editorial-pipeline.ts` + `editorial-repair-prompt.ts`)
   LLM is given the current story + a list of "issues" (Hebrew descriptions of problems) and asked to surgically fix only those pages. Output is JSON (changeOnly pages). Re-assembled into markdown.
   - **This is the wild-card stage** (see §5).
   - If technical validators still BLOCK after repair → **page-level repair** (single-page LLM call).
   - If still failing → **REVERT-ON-REGRESSION**: throw away the repair and use the pre-editorial markdown.

6. **Y-lite QA** (`stages/y-lite-qa.ts`) — runs **after** editorial
   Two independent LLM reviewers in parallel, each scoring 6 dimensions on 1–5:
   - **Book Editor** (literary): naturalHebrew / pageRhythm / readAloud / wordDensity / endingFit / childWouldAskAgain
   - **Resilience Reviewer** (psychological/procedure): categoryFit / childFacedDifficulty / companionMechanicVisible / companionIrreplaceable / mirrorMomentExists / residueResilient
   `childWouldAskAgain` and `companionIrreplaceable` are near-binary STOP conditions. Both reviewers must PASS for **READY**. Each retries once on Zod fail.
   - After repair runs, Y-lite is **re-run** on the new markdown (v0.4.1 fix — previously it was scoring stale pre-repair text).

7. **Final verdict**
   `READY` (tech PASS + Y-lite both PASS) | `REVIEW_REQUIRED` (tech PASS, Y-lite WEAK) | `FAILED_TECHNICAL` (tech BLOCKING after all attempts).
   READY currently means: **ship to customer.** That's the bar.

---

## 2. Why we built it this way (the story so far)

**v0.3 (free-form Draft):** single Author LLM, free-form Hebrew, single Editor LLM for QA. Result: pretty stories but **unpredictable lengths**, occasional dropped companion, occasional meta-leakage ("סיים בשינה רכה" appearing in prose), single editor missing things.

**v0.4 (structured Draft):** Author returns JSON with hard per-page word/sentence caps. Massive predictability win. **But:** Author still occasionally drops companion on early pages → blueprint violations.

**v0.4.1 → 4.3:** Plan gate + page-blueprint + auto-inject + post-repair Y-lite re-run + companion fallback injection.

**v0.4.4:** page-level repair (don't rewrite the whole story to fix one page).

**v0.4.5:** **REPAIR LEAKAGE FIREWALL** in editorial prompt + concrete sentence samples in `direction-drift.suggestion` instead of imperative Hebrew. (Root cause of "סיים בשינה רכה" leak: LLM was copying the scanner's Hebrew imperative suggestion verbatim into the story.)

**v0.4.6:** contextual auto-inject (4 variants per companion based on page purpose), `childWouldAskAgain` as STOP condition.

**v0.4.7:** **REVERT-ON-REGRESSION** — if editorial repair makes the story technically worse, throw the repair away and revert to pre-editorial markdown. + early-page (1–3) length spike BLOCKING at 2.0×.

**v0.4.8:** `maxSentences + 1` on per-page strict companion pages, to give auto-inject room.

**Gold candidate achieved (v0.4.7):** `bolly_adventure_v0.4.7.md` — first Adventure to fully realize the procedure-resilience pattern (p1-4 pre-clinic → p5-7 setup → p8 child body resists → p9 companion closes → p10 child mirrors → p11 procedure → p12 sticker closes → p13-15 cooldown). Tech PASS, both Y-lite reviewers PASS (book 4.83, resilience 5.00), 1 editorial repair, $0.101.

---

## 3. The current state (0/3 READY — the regression that triggered this consultation)

Last batch on v0.4.7 (post-fixes), Bolly all 3 directions:

| Direction | Verdict | Failure |
|-----------|---------|---------|
| Bedtime | `REVIEW_REQUIRED` | tech PASS but Book Editor 4.17 → 4.00 (declined post-repair); 1 `unmatched_quote` WARN + 3 MAJOR editorial findings |
| Adventure | `FAILED_TECHNICAL` | `hookAppearances` BLOCKING on p12 + `modeCompliance` BLOCKING on p12 (repair changed p12 but didn't keep companion / didn't respect changeOnly) |
| Fantasy | `FAILED_TECHNICAL` | `pageLengthSpike` BLOCKING on p19 — 48 words vs 16-word median = 3.0× — **late-page dump**, not caught by our early-page (1–3) rule |

This is a **regression** from the previous batch which had 1/3 READY (Adventure Gold).

**Pattern:** the system now FAILS LOUDLY, which is good. But the things it fails on are mostly **editorial-repair-induced damage**, not Author-induced.

---

## 4. The architecture today (file map)

```
lib/story-generator/
  stages/
    orchestrate.ts                 ← top-level conductor
    plan.ts + validatePlan.ts      ← LLM plan + code validation + fallback inject
    page-blueprint.ts              ← pure code, per-page contract
    structured-draft.ts            ← LLM (DRAFT_MODE=structured), JSON output
    legacy-draft.ts (free-form)    ← kept but inactive
    run-editorial-pipeline.ts      ← orchestrates: validate → repair → page-level repair → Y-lite → revert-if-needed
    page-level-repair.ts           ← single-page LLM regen
    y-lite-qa.ts                   ← parallel 2-reviewer LLM
  prompts/
    structured-draft-prompt.ts     ← Author system prompt
    book-editor-prompt.ts          ← Y-lite reviewer #1
    resilience-reviewer-prompt.ts  ← Y-lite reviewer #2
    editorial-repair-prompt.ts     ← Repair LLM system prompt + firewall
    category-anchors.ts            ← Per-direction category anchors + phase
    draft-prompt.ts (legacy)
  editorial/
    draft-page-schema.ts           ← Zod schemas for Author + Blueprint types
    direction-drift.ts             ← Pre-Y scanner; suggestions feed repair
    config.ts                      ← getDraftMode() / getEditorialMode()
  qa-logger.ts                     ← writes story-qa-logs/<batchId>/summary.json

lib/story-validators/
  validators/
    instructionLeakage.ts          ← v0.4.5 expanded (~50 patterns + structural)
    pageLengthSpike.ts             ← v0.4.7 early-page rule
    hookAppearances.ts
    modeCompliance.ts
    companionPresence.ts / childPresence.ts / categoryFit.ts / endingFit.ts / ...

gold-candidates/
  bolly_adventure_v0.4.7.md        ← first saved Gold Candidate (with polish notes)
```

LLM routing: **GPT-5.x chat-latest via `/v1/responses`** (not `/v1/chat/completions` — that returned 400 silently). All callers wrapped in `callLLM` with retry + Zod parsing.

---

## 5. The wild card: editorial repair

This is the **single biggest source of regressions** in the system.

**What it does:** takes the validated draft + a list of validator findings + Y-lite findings, asks an LLM to rewrite only the offending pages.

**Why it's a wild card:**
1. **Leakage** — it has copied scanner suggestions verbatim into prose ("סיים בשינה רכה", "פשטי את המשפט") despite firewall warnings. We've largely fixed this by changing suggestions from imperative→sample-sentence, but it's empirically still the riskiest stage.
2. **Regression** — Book Editor scores have dropped post-repair multiple times (bedtime 4.17→4.00 latest batch). The repair LLM "fixes" one thing and breaks two.
3. **changeOnly violations** — modeCompliance now BLOCKING-fails when repair touches pages not in its allowed-change list.
4. **Companion drops** — repair has removed the companion from a page that previously had it, causing `hookAppearances` BLOCKING.
5. **Length spikes** — repair has dumped 48 words onto p19 because Y-lite asked for "deeper closure".

Defensive plumbing built around it (v0.4.x):
- `editorial-repair-prompt.ts` REPAIR LEAKAGE FIREWALL block
- `direction-drift.ts` suggestions reframed as sample sentences with "REWRITE IN YOUR OWN WORDS"
- post-repair tech re-validation
- post-repair Y-lite re-run (not scoring stale text)
- page-level repair (smaller surface area than whole-story repair)
- **revert-on-regression** (v0.4.7) — if it's still broken, throw the repair away

**Open question we want consultation on:** is editorial repair worth keeping, or should we replace it with one of these alternatives?
- **A. Tighter Author, no repair at all.** Make `structured-draft` re-roll itself on validator failure instead of asking a second LLM to "fix" it.
- **B. Repair becomes deterministic.** Only allow code-level patches (e.g., add a known companion line, strip a leaked phrase). No LLM rewriting.
- **C. Repair stays but is bounded to non-prose fields** (e.g., only `imageDirection`). Prose can only be fixed by Author re-draft.
- **D. Status quo + more firewalls.** Keep iterating on prompt + scanner suggestions.

We've been doing D for 8 versions and we're at 0/3 → 1/3 → 0/3 READY. The hill is getting steep.

---

## 6. What's working well

- **Structured Author** is reliably producing length-compliant Hebrew prose. Author is no longer the bottleneck.
- **Y-lite two-reviewer architecture** catches things single-editor missed (e.g., procedure stories with no real body-resistance moment scored high by old editor — Resilience Reviewer flags `childFacedDifficulty=2`).
- **Validators are now ruthless.** No more "tech=PASS + finalVerdict=FAIL" inconsistency. INVARIANT enforced in qa-logger.
- **Plan companion-gate + fallback inject** eliminated the "Bolly disappears on p1 of fantasy" failure mode.
- **Blueprint enforcement** makes blueprint violations a hard pre-assembly gate, no longer a "we'll catch it in QA" problem.
- **Gold candidate exists** — proves the system *can* produce a real publishable book. v0.4.7 bolly_adventure_v0.4.7.md.

---

## 7. What's not working

1. **Bedtime book editor consistently WEAK (4.0–4.3).**
   This is *content* quality, not code. The bedtime stories *read* OK but Book Editor (Y-lite #1) thinks they're flat. We suspect bedtime in `anticipation` phase (exam tomorrow, no procedure tonight) has too little emotional shape — flatter arc than adventure/fantasy.

2. **Late-page length dumps** (Fantasy p19 in latest batch).
   Our pageLengthSpike validator escalated early pages to BLOCKING but not late pages with the same ratio. Fix is trivial (extend the rule) but the *reason* the LLM is dumping 48 words on p19 is repair-induced.

3. **Repair changing pages it wasn't authorized to** (Adventure p12 modeCompliance BLOCKING in latest batch).
   The repair LLM is ignoring `changeOnly` even though the prompt says it. We catch it now (BLOCKING → revert) but it's wasting a repair cycle.

4. **The system is now mostly catching its own bugs.**
   When Author was the failure source, validators caught Author. Now Author is good and validators are catching Repair. This is rearranging deckchairs — we keep tightening downstream nets to catch upstream LLM noise. **Is this the right strategy?** (← the user's "think outside the box" prompt.)

5. **Cost** — each story is now $0.10–$0.15 across all LLM calls, mostly from repair + page-level repair retries. Acceptable but not great at scale.

---

## 8. The big architectural questions on the table

Pasting these as the open consultation items, in priority order:

### Q1. Do we need editorial repair at all?

Today's loop: Author → Validate → **Repair if BLOCKING** → Y-lite → **Repair again if WEAK** → revert if regressed.

Alternative: Author → Validate → **if BLOCKING, re-roll Author with stricter blueprint + previous attempt as anti-pattern** → Y-lite → **if WEAK, re-roll Author with feedback**.

Trade-off: more cost (full Author calls), but the LLM you trust most is the same one each time. Repair's "let a different LLM patch prose" is structurally fragile because the patching LLM doesn't have the full story context the way Author does.

### Q2. Should Y-lite scores drive Author, not Repair?

Currently: Y-lite WEAK → editorial repair tries to fix → Y-lite re-run.
Alternative: Y-lite WEAK → Author re-draft (with Y-lite findings as guidance) → re-validate.

This makes Y-lite a *steering* mechanism for Author rather than a *prompt* for a separate Repair LLM.

### Q3. Is the bedtime "WEAK" a content design problem, not a code problem?

Bedtime is the only direction where the Book Editor consistently scores 4.0–4.3. Adventure and Fantasy regularly hit 4.6+. The category-anchor difference is `phase: anticipation` (bedtime) vs `phase: procedure` (adv/fantasy). Procedure has built-in dramatic shape (body resists → companion closes → child mirrors → procedure → sticker). Anticipation doesn't.

**Hypothesis:** bedtime needs its own structural pattern (not the procedure 6-beat). Maybe `worry→companion-mirror→nesting→softening→sleep`. Currently it's mostly "softer adventure".

### Q4. Cost vs determinism: are we over-LLM-ing?

We have ~5 LLM calls per story (Plan + Draft + Repair + 2×Y-lite). Each adds noise. Some of these could be replaced by code:
- Repair could be deterministic for known patterns (leakage strip, companion injection — we already do this for one case)
- Plan's beatMap could be a *template* picker (one per direction × age × companion) instead of fresh LLM generation
- Y-lite could be 1 reviewer scoring 12 dimensions (but parallelism is nice)

### Q5. Is Bolly armadillo the right test case?

Bolly's mechanic is "rolls into a ball / panel glow". It's visually concrete but procedurally weird — armadillos don't fit the same procedure beats as, say, a bat (Lily) or a chameleon (Koko). Maybe we've been over-fitting to Bolly's quirks. But we explicitly chose to lock Bolly until 3/3 READY before scaling — that decision still stands.

---

## 9. Concrete asks for the consultation

1. **Strategic:** keep iterating on D (status quo + firewalls), or pivot to A/B (kill repair / make it deterministic)?
2. **Bedtime structure:** is `anticipation` phase salvageable, or do we redesign category-anchors for bedtime entirely?
3. **Length spike on late pages:** the easy fix is "apply 2.0× BLOCKING to all pages, not just 1–3." Any reason not to?
4. **changeOnly violations:** is there a way to *constrain* the repair LLM's output (token-level mask?) rather than catch violations after the fact?
5. **Anything you'd kill** in this architecture? We've been adding for 8 versions. What can go?

---

## 10. Appendix: the gold candidate (proof the system can do it)

`gold-candidates/bolly_adventure_v0.4.7.md` — bolly_armadillo / adventure / girl / 15 pages.
- tech=PASS | editorial=READY | Y-lite book 4.83, resilience 5.00
- Cost: $0.101 | Repairs: 0 technical + 1 editorial
- 4 manual polish notes (poetic line, awkward physicality, typo "הכר"→"הכרית")

This is the existence proof: when everything aligns, the system ships something publishable. The question is how to make that the default, not the exception.

---

**End of brief. Total system age: ~5 weeks of iteration. Lines of code in pipeline: ~3,500. Stories generated for QA: ~150.**
