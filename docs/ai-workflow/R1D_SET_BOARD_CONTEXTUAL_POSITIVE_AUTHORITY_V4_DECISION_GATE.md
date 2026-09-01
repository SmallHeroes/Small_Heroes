# R1D Set Board Contextual Positive Authority v4 — Decision Gate

**Date:** 2026-09-01

**Owner authorization:** Guy's standing explicit authorization to diagnose and close the
new-story Wizard path continuously, including general offline corrections, while preserving
existing authority and avoiding speculative provider spend.

**Branch/worktree:** `codex/r1d-order-package-authority-binding` /
`C:\GNart\Work\sh-order-package-authority`

## 1. Proposed change

Add `set-board-positive-authority/v4` as a third, additive precision tier after existing v2 and
v3 Set Board admission. V4 keeps every current cast, action, undeclared-prop and spoiler rule and
adds two structurally bounded geometry-only exceptions:

1. an exact hyphenated `child-accessible` occurrence may describe a closed known furniture
   suffix only when the structured node kind, node-ID suffix and immediately following prose
   suffix agree;
2. a non-head contextual qualifier from a namespaced `human:<context>_<role>` identity may appear
   only inside the exact matching structured aperture-node phrase. The person-denoting head,
   full role, names, aliases, generic cast terms and any second occurrence remain blocked.

The effective template remains byte-identical. A pure required-Board admission assertion will
also be added at approved-bridge advance and load, where both the effective template and exact
production style are known. It writes no new manifest field and performs no Registry I/O.

## 2. Why now?

The full downstream map found a deterministic blocker before another paid authoring attempt.
Effective product template
`d96336715724d498a19792df094bfb5f085309f2cf946c853d4e6443c4528f2e` requires
`set_home_interior` and `set_kindergarten_route`. The canonical collect-all census is exactly:

```yaml
required: 2
admitted: 0
rejected: 2
issueCount: 2
```

The two findings are:

- `Sturdy child-accessible craft table.` on `node_craft_table` / `furniture`, falsely matched as
  `child:hero`;
- `Openable kindergarten gate.` on `node_kindergarten_gate` / `doorway`, falsely matched through
  the contextual token in `human:kindergarten_guard`.

There is no masked third finding and no Registry read occurs. The fixed template, not a future
provider-authored Blueprint, owns this Board authority, so another paid authoring call cannot
repair it. The contributing workflow gap is that approved bridge advance/load did not re-derive
the already-existing downstream Board admission census.

## 3. Scope

General Set Board matcher and bridge-admission change. It contains no story key, Set ID, child,
companion, page, phrase, candidate digest or revision allowlist. It changes no Story Source,
template, reconciliation, package, Board, locator, Order or render artifact.

## 4. Risk of hardcoding

The exceptions are closed structural grammars, not string allowlists:

- furniture affordance modifier: exact Unicode-dash compound, geometry source only, kind
  `furniture`, existing closed suffix vocabulary, and suffix equality with the structured node ID;
- human context qualifier: `human:` identity only, non-head qualifier only, geometry source only,
  closed aperture kind, exact qualifier-plus-fixture node ID, and the same contiguous physical
  phrase in prose.

Real cast/head/name/alias occurrences remain forbidden. V4 is selected only after both older
policies reject, so already-admitted v2/v3 definitions never change identity.

## 5. Files likely affected

- `lib/set-identity-board/types.ts`
- `lib/set-identity-board/positiveAuthoritySpoilerGuard.ts`
- `lib/set-identity-board/setDefinition.ts`
- `lib/set-identity-board/boardSafeIdentity.ts`
- `lib/set-identity-board/index.ts`
- `lib/visual-package/qaWizardCandidateBridge.ts`
- focused Set Board and bridge specs
- `CURRENT.md` and one implementation-evidence document

## 6. Expected behavior after change

- The exact d963 template admits both required Sets under v4 with zero issues.
- `child-accessible` never exempts an actual child occurrence, a non-furniture node, a spaced
  phrase, a mismatched node ID or an unapproved fixture suffix.
- `kindergarten gate` remains physical geometry, while `kindergarten guard`, `guard`, the Hebrew
  alias, a human name or a second contextual occurrence remains a cast leak.
- Clean v2 and current v3 definitions preserve exact hashes, prompt bytes, content-policy digests
  and Registry paths.
- An approved bridge cannot advance or load for production when its exact effective template/style
  has any Board-admission issue, and that check happens before Registry/provider work.

## 7. Validation plan

1. Unit safe/counterexample matrix for both v4 refinements.
2. Exact reproducible compatibility locks:
   - synthetic v2 `f4e271938edf91beb3b12c7b8634e43564edfbfecfd5a6d66eee42b747101f50`;
   - synthetic v3 `11541e35b618217fca3dc3db6ceabf0a8096f776839ba25fa8c091cfd2c22bdd`;
   - the approved legacy Chameleon package's two stored v2 hashes, recomputed from that package.
   Three additional v2/v3 values carried by the prior precision milestone are historical
   handoff evidence only: their normalized replay inputs are not present as committed artifacts,
   so this milestone must not claim them as independently reproducible locks.
3. Exact d963 pure census: `2 admitted / 0 rejected / 0 issues`, both policy v4.
4. Hostile bridge advance/load fails before publication or Registry access; clean d963 bridge
   remains loadable.
5. Focused Set Board + bridge suites, `npx --no-install tsc --noEmit`,
   `npm run story:autonomous-typecheck`, `git diff --check`, and proportional repository check.
6. Independent Claude Code Opus/max falsification before any Board image call.

## 8. Cost impact

This milestone costs $0. It performs no provider, image, Vision, audio, upload, database, network
or render operation. After PASS, two separately gated LOW Board renders and two Vision QA calls are
unavoidable because no exact Board or legal rebind exists for either new identity.

## 9. Rollback plan

Revert the focused code commit. No artifact migration or Registry rewrite is required because v2
and v3 semantics are unchanged and no v4 Board exists before this milestone passes.

## 10. Review assignment

Guy's standing operational-Wizard authorization covers this zero-cost general correction. Codex
selects the minimal v4 modifier set `{accessible}` under the closed rule above. Claude Code must
try to bypass the geometry/node/kind binding, leak a real child or human role/name/alias, move the
exception into non-geometry fields, alter a historical hash, or advance/load an invalid bridge.
Claude Cowork product/creative review is not needed because no visual or story content changes.
Guy will later inspect the two exact LOW Board images before their approval.

## 11. Rejected alternatives / do not do

- Do not reinterpret v2 or v3 in place.
- Do not edit or re-reconcile immutable d963 prose as a workaround.
- Do not add raw `child-accessible`, `kindergarten`, story, Set or phrase allowlists.
- Do not drop individual cast protection without preserving role heads, names and aliases.
- Do not rename/rebind the old `set_child_home_night` or `set_town_night` Boards.
- Do not touch provider/model/quality/budget/retry/fallback behavior.
- Do not mint, approve, publish, render, deploy, mutate a locator/database/Order, access a
  credential, or push in this milestone.

## Stop-check answers

1. General system fix: yes.
2. Cross-story risk: bounded matcher and bridge admission; covered by hostile tests and identity
   locks.
3. Production behavior: fail-closed admission only; no render behavior change.
4. Spend: none.
5. Smallest proof: pure unit/census/bridge tests plus exact d963 read-only replay.
6. Owner decision: existing standing authorization; no unresolved creative decision.
7. Claude falsification: boundary escapes, under-blocking, historical identity drift, bridge bypass.
8. Claude Cowork: not applicable.
9. Guy eyeball: the two future LOW Boards, not this code milestone.
