# Decision Gate: complete drawn-moment contract, then one more Opus storyboard repair (2026-10-15)

**Context.** The one approved Opus 5.5 repair, at `0eb7ddc8` after Codex PASS, compiled. Sol 6.1 then held it (`held_contradiction`, 40 supported, 3 contradictions); stop report `_review/new-book-run-20261015/STOP-REPORT-REPAIR-20261015.md`.

**Guy's choice** (AskUserQuestion, 2026-10-15): "Fix the rule, then 1 repair (Recommended)", that is: make the drawn-moment rule complete, add a code check, then one more Opus repair and Sol review after Codex QA.

## 1. Proposed change (general; opt-in; experiment path only)

**A. Planner contract text** (a new opt-in addendum, `storyboard-drawn-instant/v1`):
- A picture drawn at an earlier moment of its page declares *everything* that differs at that moment. That includes states offscreen or cropped out: a crop never exempts a state.
- It also declares any temporary look of the child or the companion that the picture shows (squashed, flattened, soaked, tangled…).
- A frame whose requirements show such a temporary look must declare the moment.

**B. Engine.** The drawn-moment declaration (`moments.frames[n].depicted`) gains `actorStates`: a temporary look of the child or companion at that moment, quoted from the same page.
- A moment may consist of only such a look.
- **The gap this closes:** the companion cannot carry ledger attributes (the sequence compiler allows attributes only on continuity entities, and child and companion are fixed roles). So "Uri's tail flat as a pita" had no legal form; Sol held the page because the moment was undeclared.

**C. Code check before the review.** When a picture is drawn at an earlier moment, every change its page makes *after* the drawn quote must be overridden in the declaration: a move (sequence transition, `evidence`) or a state (continuity change, `storyEvidence`). Otherwise the plan is refused before any Sol call.

Read-only probe on the real plans (`_review/new-book-run-20261015/`):

| plan | what the check flags |
|---|---|
| R1 | page 7 only: `stone_enclosure.gate_state → Closed` (Sol's finding) and the herd's entry into the enclosure (which Sol missed) |
| C3 | the herd only |

Nothing else in either plan is flagged.

**D. Engine-derived findings.** The check's findings on the parent plan join the parent review's findings in the repair input, so the planner is told exactly what to fix. They are derived, never supplied.

**E. Sol, renderer, pixel judge:**
- one review-addendum line, so Sol reads `actorStates` like any override (own quote, consistent with the moment);
- the render prompt's drawn-moment section and the judge packet include the declared look.

**F. Repair of a repair.** The engine binds a repair whose parent is itself a repair:
- the parent's own repair input is nested and recompiled to the parent digest;
- a repair may add this contract on top of the parent's contracts;
- records without these fields stay byte-identical.

**G. Experiment stage `storyboard-repair-2`** (one use; amendment `continuation-5`, bound to `continuation-4` and every `text-repair-1` record):
- the story is replayed;
- R1 is replayed from its raw Opus and Sol answers and must be held exactly as sealed;
- the request must be R1's with exactly this change;
- routing: Opus 5.5 on Claude Max plans, Sol 6.1 reviews;
- same caps, full carry, one review call on the API meter;
- the child, grant and audition read and verify it like the first repair (source-derived producer check, folder fingerprint).

## 2. Why now

Without it, any repair hits the same wall: the flat-tail gag that C3's review demanded cannot be declared, and offscreen states are skipped with no code backstop. The class can recur on every live-written book that draws an earlier moment.

## 3. Scope

A general system change to the opt-in moments contract, on the experimental new-book path. Books without the contract are unchanged; old digests are byte-identical and asserted in tests. Nothing in production or the Wizard changes.

## 4. Risk of hardcoding

- No book, page or entity ids appear in rules or code.
- The check reads the ledger's own quotes.
- Tests use synthetic books plus the real records only as read-only evidence.

## 5. Files likely affected

- `lib/personal-wizard/storyboard-moments.ts`, plus a new `storyboard-drawn-instant.ts`;
- `storyboard.ts`, `storyboard-repair.ts`, `simple-storyboard-diagnostic.ts`, `simple-book-flow.ts`;
- `scripts/personal-simple-book-reviewed-audition.ts` (saved marker, loader);
- `scripts/personal-new-book-experiment.ts`;
- their specs, and docs.

## 6. Expected behaviour

**The planner** declares every earlier-moment difference, including offscreen ones and temporary looks.

**The compiler** refuses a declaration that misses a later same-page change.

**The repair input** names the check's findings with the review's.

**For books without the contract**, nothing changes.

## 7. Validation (no paid call)

- **Unit tests:**
  - absent contract: byte-identical;
  - each new rule broken → its exact code;
  - `actorStates` validation;
  - nested repair binding;
  - the check on relations and attributes, including offscreen.
- **Real-records evidence:**
  - the probe reports exactly R1 page 7 (gate, herd);
  - a read-only dry preview of `storyboard-repair-2`: admissible, R1 replayed to `held_contradiction`, request changed only by this contract, fit with the full carry;
  - 56+18 records and Goni's 412 files unchanged.
- **Controls:** negative controls on the previous code, then Codex QA. Nothing is executed before an explicit Codex PASS.

## 8. Cost

**Build:** none (offline).

**Then, once:**

| call | cost | budget |
|---|---|---|
| Opus planner (Claude Max) | ~$0.6 list | under its $2 guard; Max total so far $1.098973 |
| Sol review (API) | ~$0.06 | reserved $0.71 within the remaining $2.433757, with the full $2.267639 carry |

**Only if the review is supported:** child → grant → two samples → the rest and the cover only if both pass, under the same $7. A complete illustrated book is not promised: Goni's full LOW book cost $3.48.

## 9. Rollback

The contract is opt-in, so books without it are unaffected. The experiment stage is single-use. `git revert` of the milestone's commits restores the previous engine.

## 10. Review assignment

**Guy decided** (AskUserQuestion, 2026-10-15):
- "Fix the rule, then 1 repair (Recommended)";
- then, on this corrected scope (B and F are wider than "instruction + check": they make the tail declarable and a repair of a repair possible), "Confirm and build (Recommended)";
- the spend above, only after an explicit Codex PASS.

**Claude Code tries to falsify:**
- old digests unchanged;
- the check catches every later change (relations and attributes) and nothing earlier;
- `actorStates` cannot smuggle ledger state or another actor;
- nested binding can't be forged;
- the new stage can't reuse R1's allowance.

**Claude Cowork:** none (technical).

## 11. Do not

- No paid call before Codex PASS.
- No change to models, caps, the 0.70 identity threshold, the judge or the gates' meaning.
- No manual plan or story edit, and no edit of earlier records.
- No production or Wizard change, and no push, merge or deploy.
- A compile refusal or a held review of the second repair is a real stop: no retry.
