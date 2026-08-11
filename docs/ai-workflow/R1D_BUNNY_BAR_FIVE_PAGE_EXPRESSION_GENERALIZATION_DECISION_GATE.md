# R1D Bunny/Bar five-page expression generalization — Decision Gate

**Date:** 2026-08-11
**Owner decision:** Guy explicitly authorized a bounded five-page render in the current Lead task.
**Branch:** `codex/r1d-child-expression-style-fidelity`

## 1. Proposed change

Add a local-only `bunny-bar-five-page` profile to the existing Wizard-connected LOW measurement runner, then render pages 1–5 of approved Story Source `bunny_ometz_adventure` with Bar's existing canonical styled anchor.

## 2. Why now?

The Dini proof showed improved expression control but mixed style fidelity at smaller scale. A second story is required to determine whether the correction generalizes beyond one companion, one setting and one emotional arc.

## 3. Scope

General measurement infrastructure plus story-specific measurement data. Production prompt, expression classifier, child-reference contract, Story Source, Visual Contract, model and Wizard behavior remain unchanged.

## 4. Hardcoding risk

The runner profile names the approved Story Source and shot plan, as any reproducible test fixture must. No production branch may name Bar, Buni, a page or story phrase. Identity/expression treatment continues through the shared canonical-anchor and Blueprint prompt path.

## 5. Files likely affected

- local Wizard LOW measurement runner and its measurement authority data;
- focused measurement tests;
- ignored local output evidence;
- tracked QA Reader fixture only after all five calls complete and pass structural inspection;
- `CURRENT.md` and implementation evidence.

## 6. Expected behavior

Exactly five distinct, Wizard-qualified pages render at LOW. Bar keeps one recognizable semi-naturalistic identity and wardrobe while page-owned expressions change across tense, attentive, amused, hesitant and focused beats. Buni and clinic geometry follow their own authorities.

## 7. Validation plan

1. Zero-cost qualification and distinct-frame proof.
2. Focused tests, TypeScript and `git diff --check`.
3. Official OpenAI pricing verification.
4. Exactly five sequential LOW image calls, zero retries/fallback/Vision.
5. Contact-sheet inspection and a real QA Reader fixture using the physical-sheet-only transition.

## 8. Cost impact

Five `gpt-image-2` LOW page generations only. No HIGH/full-book/hidden regeneration. Record provider usage and conservative local accounting; stop after two failed measurement attempts, consistent with Guy's standing instruction.

## 9. Rollback

Revert the local profile/fixture commits. Generated outputs are ignored local evidence and can be retained without becoming production authority. Production remains blocked.

## 10. Review assignment

Guy reviews expression correctness, identity/style continuity, story legibility and whether the Reader motion is the intended physical page turn. Claude Code should falsify runner isolation, canonical-anchor use, five-call accounting, distinct story authority, artifact identity and absence of production/downstream authority.

## 11. Do not do

No full book, HIGH, Vision, remote database/storage, Board, approval, publication, promotion or production deployment. Do not change the 0.70 resemblance gate, model, budgets or production prompt/schema authority.

## Stop-check decisions

1. General system treatment; story-specific data is measurement-only.
2. Production behavior is unchanged.
3. Spend is bounded to five LOW calls.
4. The smallest useful proof is pages 1–5 because they contain five materially different expressions and cross the waiting-room/exam-room boundary.
5. Guy has already approved this exact proof.
6. Visual acceptance remains Guy's; independent technical QA remains Claude Code's.
7. Production stays blocked regardless of the result.
