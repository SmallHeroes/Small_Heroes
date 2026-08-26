# R1D Set Board Positive-Authority Precision + Collect-All Admission — Decision Gate

**Date:** 2026-08-26
**Owner authorization:** Guy's standing explicit authorization to continue the revised Chameleon path through an operational Wizard, including general offline corrections, without pausing for another implementation approval.
**Branch/worktree:** `codex/r1d-qa-wizard-downstream-lifecycle` / `C:\GNart\Work\sh-live-chameleon-v3`

## 1. Proposed change

Add an explicitly versioned precise Set Board positive-authority matcher for two
verified lexical false-positive classes, while retaining deterministic v2
compatibility for definitions that already pass v2. Add a pure collect-all Set
Board admission census that runs before any Registry path/read.

The precise policy will:

- treat exact hyphenated `child-(scale|scaled|sized)` only on a structured
  `furniture` node whose ID-derived suffix immediately follows the compound
  and whose entire closed fixture suffix is one of
  `bed|table|craft table|work table`, while still rejecting any
  unqualified cast occurrence in the same or another source;
- derive excluded-prop singleton heads from the terminal semantic ID token,
  with only a closed singular/plural alignment to the authored name, rather
  than selecting an earlier shared modifier;
- keep full prop-name and de-namespaced ID phrases blocked;
- preserve every action, specific cast/name/alias, undeclared-prop, and
  excluded-prop gate.

## 2. Why now?

The paid authoring run succeeded and produced immutable Candidate
`be2d3202…bcbc9`, but downstream Set Board admission currently fails before
Registry resolution:

- `set_home`: benign `Fixed child-scale craft table` / `Child-scale bed` is
  classified as a cast leak;
- `set_neighborhood_route`: `prop_route_labels` (`Route-label set`) derives
  bare `route`, so benign route thresholds/openings are classified as spoilers;
- fail-fast projection masks later Set/field findings.

Another provider call cannot fix this deterministic offline consumer defect.

## 3. Scope

General system change. No story, child, companion, page, Set ID, prop ID, or
Candidate phrase is allowlisted in production code. The versioned v3 grammar
does contain a closed, general fixture-suffix vocabulary
(`bed|table|craft table|work table`) so the scale exception is bounded to
ordinary furniture rather than arbitrary provider prose. Candidate-shaped
phrases remain test evidence only.

## 4. Risk of hardcoding

The exemption is a closed grammatical category (physical scale compound), not
a Chameleon literal. Prop-head selection is derived from structured ID/name
authority. Counterexamples must prove that real cast and prop prose still
fails, including a safe compound followed by a real cast occurrence.

The long-term schema improvement is a typed `relativeScale` field owned by the
compiler. It is deliberately deferred here because this milestone corrects
the current immutable text schema without widening the authoring/provider
contract. Any change to the v3 vocabulary or derivation is hash-semantic and
requires a new policy version rather than an in-place reinterpretation.

## 5. Files likely affected

- `lib/set-identity-board/types.ts`
- `lib/set-identity-board/positiveAuthoritySpoilerGuard.ts`
- `lib/set-identity-board/setDefinition.ts`
- `lib/set-identity-board/boardSafeIdentity.ts`
- `lib/set-identity-board/setBoardAdmission.ts`
- `lib/set-identity-board/resolveBoards.ts`
- `lib/set-identity-board/index.ts`
- `lib/visual-package/artifacts.ts`
- downstream qualification, promotion, readiness and v4 lifecycle consumers
- `lib/visual-package/types.ts`
- focused Set Board / Visual Package specs
- `CURRENT.md` and implementation evidence

## 6. Expected behavior after change

- Existing v2-admissible definitions remain v2 and retain their exact
  definition hash, prompt bytes, content-policy digest, and Registry path.
- A definition rejected by v2 may use precise v3 only if the full v3 census is
  clean; v3 is identity-bound in `positiveAuthorityPolicy.version`.
- `child-scale` and environmental `route` geometry no longer fail because of
  the two verified collisions.
- Real cast/action/prop leaks remain fail-closed.
- Board consumers receive a two-layer census before any Registry access:
  stable/semantic issues isolated per required Set, plus residual
  contract-scope orphan/malformed authority issues. One bad Set or field can no
  longer mask the remainder, and authority failures remain distinct from stale
  or missing Registry artifacts.

## 7. Validation plan

1. Unit counterexamples for safe scale compounds versus actual cast prose.
2. v2/v3 prop-term tests for `route_labels`, bucket, globe, case and punctuation.
3. Historical clean definition/hash/prompt compatibility proof.
4. Three-Set Candidate-shaped census with zero issues after the correction.
5. Hostile multi-Set/multi-field census proving stable ordering, deduplication,
   and zero Registry reads.
6. Relevant Set Board and Visual Package suites, `npx tsc --noEmit`,
   `git diff --check`, and proportional `npm run check`.
7. Claude Code adversarial read-only QA before any downstream image call.

## 8. Cost impact

$0. No provider, image, audio, database, storage, deployment, or render action.

## 9. Rollback plan

Revert the focused commit. Because existing passing definitions stay on v2 and
no artifact is migrated in this milestone, rollback requires no Registry or
package rewrite.

## 10. Review assignment

Guy already authorized the general offline correction through the operational
Wizard objective. Claude Code must try to falsify the v2 identity-preservation
claim, bypass the scale compound with real cast prose, find missed prop forms,
and prove whether collect-all truly precedes filesystem/Registry access.

Claude Cowork product/creative review is not needed: this is an authority
classifier correction with no customer-visible creative decision.

## 11. Do not do

- Do not edit the Candidate or Story Source prose to dodge the guard.
- Do not rename `prop_route_labels` or add story/Set/prop allowlists.
- Do not remove generic cast or singleton prop protection.
- Do not migrate or reapprove existing Boards when byte-compatible v2 identity
  can remain authoritative.
- Do not call a provider, mint a Board, render, deploy, or write to a database.

## Stop-check answers

1. General system fix: yes.
2. Cross-story risk: bounded matcher semantics and Registry identity; covered by
   version dispatch, compatibility tests, and fail-closed counterexamples.
3. Production behavior: admission only; rendering remains gated.
4. Spend: none.
5. Smallest proof: pure three-Set census plus hostile no-I/O counterexamples.
6. Owner decision: already supplied by Guy's standing authorization.
7. Claude falsification: identity drift, cast/prop bypass, masked issues, I/O
   before census.
8. Claude Cowork: not applicable.
9. Guy eyeball: no image exists in this milestone; Guy reviews later LOW Boards.
