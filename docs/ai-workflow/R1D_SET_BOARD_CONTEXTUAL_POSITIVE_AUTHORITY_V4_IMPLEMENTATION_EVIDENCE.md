# R1D Set Board Contextual Positive Authority v4 — Implementation Evidence

**Date:** 2026-09-01

**Branch/worktree:** `codex/r1d-order-package-authority-binding` /
`C:\GNart\Work\sh-order-package-authority`

**Decision Gate:**
`docs/ai-workflow/R1D_SET_BOARD_CONTEXTUAL_POSITIVE_AUTHORITY_V4_DECISION_GATE.md`

**Cost/render:** zero provider, image, Vision, audio, upload, database, network, deployment or
render calls

## Outcome

The fixed product template
`d96336715724d498a19792df094bfb5f085309f2cf946c853d4e6443c4528f2e` is no longer
blocked by two false cast-authority collisions. Both of its required Sets now pass the canonical
collect-all admission census under a new additive policy tier,
`set-board-positive-authority/v4`, while every previously admitted v2/v3 definition keeps its
exact policy and identity bytes.

The approved reconciliation bridge also re-derives complete Set Board admission at both
authority boundaries: before the first `reconciliation_approved` publication and whenever an
approved production context is loaded or replayed. A future deterministic Board failure can no
longer travel downstream until package preparation happens to discover it.

## Verified root cause

Before this correction, exact d963 admission was:

```yaml
required: [set_home_interior, set_kindergarten_route]
admitted: []
rejected: [set_home_interior, set_kindergarten_route]
issueCount: 2
```

The two complete-census findings were:

- `Sturdy child-accessible craft table.` on `node_craft_table` / `furniture` was falsely
  attributed to `child:hero` through the isolated token `child`.
- `Openable kindergarten gate.` on `node_kindergarten_gate` / `doorway` was falsely attributed
  to `human:kindergarten_guard` through the contextual qualifier `kindergarten`.

There was no masked third issue and no Registry read. The effective template owns these facts;
another paid Blueprint-authoring call could not repair them. An exhaustive 52-worktree census
also found no existing Board, Candidate, rebind, migration or legal adoption artifact for either
new Set identity. The old `set_child_home_night` and `set_town_night` Boards are different
authorities and cannot be renamed through the time-only rebind lifecycle.

## Implementation

### Additive v4 selection

- v2 is still evaluated first and is byte-unchanged.
- v3 is still evaluated only after v2 rejects and is byte-unchanged.
- v4 is evaluated only after both v2 and v3 reject.
- v4 inherits v3's precise excluded-prop semantic heads, cast/action checks, safe-label behavior,
  prompt construction and negative authority.

### Closed physical-fixture grammar

The `child` occurrence in `child-accessible` is released only when all of these are true:

- the source is one compiler-projected spatial-node geometry field;
- the compound uses an explicit Unicode dash/hyphen;
- the structured node kind is `furniture`;
- the next prose words are one existing closed furniture suffix: `bed`, `table`, `craft table`
  or `work table`;
- after removing only the closed `node` / `spatial` namespace, the structured node ID equals the
  same suffix.

A spaced phrase, wrong kind, mismatched node ID, disallowed fixture, non-geometry field, or any
real second child occurrence remains a leak.

### Closed human-context grammar

For a stable `human:<context>_<person-head>` identity, v4 may release only the non-head context
qualifier when one `doorway` node is exactly `<context>_gate` and its geometry contains the same
single contiguous `<context> gate` phrase. The grammar is deliberately limited to the evidenced
`doorway + gate` form; unused door/window/entrance variants were not enabled speculatively.

The person head, full role, names, aliases, generic cast vocabulary, repeated contextual phrase,
wrong node/kind, non-geometry field and child/companion identities remain blocked. A
non-structural name or alias that claims any qualifier word disables the exception entirely.

### Bridge prevention fence

`advanceQaWizardApprovedReconciliation` and `loadQaWizardApprovedProductionContext` now run the
same pure admission census over the exact effective Template and production style. The Template
to Contract projection uses the existing explicit seam from `visual-package/artifacts.ts`;
appearance-only human fields are outside Set Board authority. The fence:

- performs no Registry/provider/network work;
- adds no manifest field or digest migration;
- runs after all exact context binding checks and before publication/return;
- throws `required_set_board_admission_failed` with the complete census.

The hostile integration test creates a real canonical Candidate whose Board authority is
inadmissible. Advance fails before any new bridge file appears. It then explicitly simulates a
pre-gate historical approved manifest and proves the independent load/recovery path rejects it.

## Exact real-artifact evidence

Current d963, production style `soft_hand_drawn_storybook`:

| Set | Policy | New Set Definition hash |
|---|---|---|
| `set_home_interior` | v4 | `48bf9d53437746e27026a9b975b5fb6d35954f4a46782bb2f064380147fa0926` |
| `set_kindergarten_route` | v4 | `6a9b573a9df25f02137714287db99e84cd60de5bb016a8abb961fa5c6311745f` |

The census is deterministic: required 2, admitted 2, rejected 0, issueCount 0. The unchanged
approved bridge `8c5bcb03...` loads as `reconciliation_approved` and remains bound to Story Source
`3ef64541...`, exact template d963, 8 pages and style `soft_hand_drawn_storybook`.

Historical replay through the current code reproduced exactly:

| Set | Policy | Preserved hash |
|---|---|---|
| `set_home` | v3 | `e71fbd7acf90869409ae5e85928951f7a941e2a87e0efd327323b98bfa155d78` |
| `set_kindergarten` | v2 | `a04ca2012f6c8837a720564f6ec32e330c49a76bf8bd3f9dd2aafe74fe7b0b8c` |
| `set_neighborhood_route` | v3 | `a9c0e87d38fdeb75f7f1bb760bcc976c213fd8e57936b7eadf3ee4d9ce55f389` |

The synthetic v2 hash remains
`f4e271938edf91beb3b12c7b8634e43564edfbfecfd5a6d66eee42b747101f50`; the synthetic v3
fixture is now locked explicitly at
`11541e35b618217fca3dc3db6ceabf0a8096f776839ba25fa8c091cfd2c22bdd`. The approved legacy
Chameleon package test still derives its two exact historical Board hashes from the package and
keeps both on v2.

## Hostile coverage

The focused matrix rejects:

- `child accessible` without a dash;
- correct prose on the wrong node kind or mismatched node ID;
- a second actual child after an otherwise valid fixture phrase;
- the phrase in lighting instead of geometry;
- `kindergarten guard`, the terminal `guard`, Hebrew alias, alias equal to the qualifier, or a
  repeated contextual phrase;
- wrong node ID, wrong node kind and non-geometry qualifier use;
- multiword context with its head or alias present;
- companion name `Koko` and identity/species token `chameleon`;
- v4 alongside excluded route-label authority or action prose.

## Validation before independent QA

- Focused v4/census: 2 files, 30 tests PASS.
- Full Set Board suite on the final production/test bytes: 14 files, 359 tests PASS.
- Full QA Wizard bridge: 15/15 tests PASS, followed by one known Vitest worker
  `onTaskUpdate` RPC timeout; the exact new advance/load hostile test also passes alone.
- `npx --no-install tsc --noEmit`: exit 0.
- `npm run story:autonomous-typecheck`: exit 0.
- `git diff --check`: clean.
- Literal `npm run check` passed both TypeScript phases. Ordinary: 311 files / 4,323 tests PASS,
  17 files / 73 skips, and only the established five ignored-output fixture files / nine absent
  local-artifact assertions failed. Resource: 20 files / 633 tests PASS, followed by the three
  known Vitest worker `onTaskUpdate` RPC timeouts. The command therefore exits 1 and is reported
  honestly; no changed-path assertion failed.

An internal read-only adversarial review found no high-confidence production defect, independently
replayed the exact current/historical censuses and confirmed both bridge placements. This is not
the independent Claude Code PASS; the focused commit will be handed to Claude Code Opus/max on an
immutable range before any Board render.

## Unchanged / not authorized by this code milestone

No Story Source, effective template, reconciliation, approved bridge, existing Board, Registry,
Visual Package, locator, Order, payment, provider policy, model, retry, fallback, budget, image,
audio or render artifact changed. No Board was minted or approved. No branch was pushed.
