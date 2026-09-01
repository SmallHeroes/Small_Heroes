# R1D Set Board Reserved Page Placement Authority — Implementation Evidence

**Date:** 2026-09-01

**Branch/worktree:** `codex/r1d-order-package-authority-binding` /
`C:\GNart\Work\sh-order-package-authority`

**Decision Gate:**
`docs/ai-workflow/R1D_SET_BOARD_RESERVED_PAGE_PLACEMENT_AUTHORITY_DECISION_GATE.md`

**Cost/render through this milestone:** zero provider, image, Vision, audio, upload, database,
network, deployment or render calls

## Outcome

The route Board can now represent a future page-conditioned placement point as structured empty
physical authority. A base Board for a qualifying contract must leave that point usable while
remaining free to add ordinary fixed lighting and ambient dressing elsewhere. The change is a
selective forward tier: only Sets with at least one exact reservation use `set-board/v7` and
`set-board-content/v6`; all other Sets preserve the exact v6/v5 projection.

This milestone also closes the compatibility boundary end to end. A trusted immutable package can
replay an exact historical v6 Board inventory, but a Registry row, cached binding or caller-chosen
string cannot request a downgrade. Fresh assembly remains forward-policy. Semantic-source and
time-authority successor lifecycles explicitly reuse only their digest-verified source package
authority.

## Exact derivation

A reservation exists only for the same-page conjunction of:

- positive `must` action;
- predicate `places`;
- typed prop object;
- exactly one same-page `required` constraint for that prop with a nonempty `anchorId`;
- one exact page zone inside the physical Set;
- one exact LocationAnchor with a stable description; and
- a prop that is not already a stable fixed Board object.

Zero anchored constraints carry semantic intent but no compiler-owned physical authority and are
ignored. Multiple exact candidates, missing/ambiguous zone, missing/ambiguous anchor or conflicting
descriptions fail closed. Exact `(locationId, zoneId, anchorId)` values aggregate deterministically,
with sorted contributing prop IDs.

The provider receives `Area N, reserved placement point K` plus the exact natural physical anchor
description. It does not receive location, zone, anchor or prop IDs, nor the blocked prop name.
Vision QA uses the same projection and emits
`reserved-placement-occupied:area-N:point-K` when ambient/fixed content occupies the point.

## Exact d963 offline proof

Effective Template:
`d96336715724d498a19792df094bfb5f085309f2cf946c853d4e6443c4528f2e`.

| Set | Board tier | Definition hash | Prompt hash |
|---|---|---|---|
| `set_home_interior` | v6, unchanged | `48bf9d53437746e27026a9b975b5fb6d35954f4a46782bb2f064380147fa0926` | `5013469b5941b74f94691d99300bbf74556b0b0c389fe90e6fdc64cec6811748` |
| `set_kindergarten_route` | v7 successor | `38870567284b295c73cfea594ec3ab837b4a7ea221cf3df0c1de36404270071a` | `ee55e313d67f3c4f4601d3b7b3c4983cc7f31d9ecf20d3bf28dad1bef05fa1e2` |

The route contains 10 qualifying authored action events. Duplicate chronology collapses to nine
unique prop/anchor associations and six physical reservations:

1. fountain stone — amber, green and olive labels, plus terminal blank state;
2. gate path — green label;
3. hedge path surface — olive label;
4. courtyard hanging hook — paper moon lantern;
5. courtyard path — spare blank label;
6. market cartway — amber label.

The old failed v6 route Registry entry and asset remain immutable evidence. No same-byte recheck,
approval, overwrite, deletion or successor path was performed during this offline milestone.

## Compatibility and lifecycle proof

- `deriveExpectedSetBoardIdentity` is the one identity projection used by mint, Registry lookup,
  package resolution and runtime binding.
- `validateTrustedFrozenSetBoardAuthorities` requires a complete exact package inventory, supports
  only v6/v7, re-derives every identity, and rejects missing, extra, duplicate, unsupported or
  mismatching authorities before Registry/storage I/O.
- Wizard preflight passes the qualified immutable package inventory through Board binding and
  pre-render assertion.
- Package-backed Orders reload `requiredBoards` from their frozen immutable package; legacy Orders
  do not invoke that loader.
- Semantic-source migration assembly, qualification, approval and finalization replay the exact
  verified source-package inventory. The historical migration suite remains 9/9 green.
- Time-authority source qualification and Board rebind use only exact source-package Board tiers;
  unsupported versions fail closed.
- Fresh mint publishes both dry and paid Registry outputs create-only. Collision is checked before
  spend and again atomically at publication. Partial approval stamps reject.
- Fresh approval/recheck re-derive forward authority, so a stale v6 Registry row cannot acquire a
  new approval or be rechecked after v7 cutover. Already-approved v6 replay remains package-owned.

## Hostile coverage

Focused regressions cover:

- action polarity/predicate/type counterexamples;
- stable fixed props, zero/multiple anchors, missing zones and missing anchors;
- deterministic grouping and explicit v6 versus forward-v7 projection;
- provider/QA technical-ID and prop-name egress;
- contextual human-role collisions inside natural anchor descriptions, including alias claim,
  role-head leak and unproved physical context;
- v6 package replay versus fresh forward v7 selection;
- Registry/cache/binding downgrade attempts;
- missing/extra/duplicate/unsupported frozen package Board inventories;
- same-core rival Registry artifacts;
- package-backed versus legacy Order loading;
- create-only mint collision/race, stale v6 approval/recheck and v7 mint/recheck/approval;
- historical semantic-source package replay and publication.

## Validation before independent QA

- Full Set Board folder: 15 files / 391 tests PASS.
- Reserved/contextual focused matrix: 2 files / 31 tests PASS.
- Package/Wizard focused matrix: 6 files / 88 tests PASS.
- Historical semantic-source migration plus reservation harness: 2 files / 19 tests PASS.
- Artifact-conditioned time-authority Set Board suite is present but skipped in this worktree
  because its historical output artifacts are absent; TypeScript compiles the corrected path.
- `npx tsc --noEmit`: exit 0.
- `npm run story:autonomous-typecheck`: exit 0.
- `git diff --check`: clean.
- Literal `npm run check` passed both TypeScript phases. Ordinary completed 4,354 passing tests and
  73 skips; it reproduced the established nine assertions whose ignored `outputs/` fixtures are
  absent and initially reported the new spec's expected 353→354 inventory change. The classifier
  was corrected and passes 7/7. Resource completed 631 passing tests; two unrelated subprocess
  tests exceeded their 5-second per-test timeout and Vitest emitted the three known
  `onTaskUpdate` RPC timeouts. The materialization file passes 21/21 alone; all 14 readiness
  assertions pass alone before that same RPC infrastructure error. The literal command remains
  exit 1 and is reported as such; no changed-path assertion remains failed.

## Independent Claude Code gate

Claude Code Opus/max independently reviewed immutable range
`512d1229ac8efbdcb3352b6b8f76c82c702ff072..c813727e259439d1413c6cd0a173748d5c82c067`
read-only and returned **PASS — 0 BLOCKER / 0 MAJOR / 0 MINOR**. It verified the one-commit,
zero-merge, 34-file topology and found no material defect across the exact derivation,
selective-v7 compatibility, provider/QA egress, package-only frozen replay, Wizard/Order binding,
successor lifecycles or create-only mint boundary. Its harness denied local command execution, so
its gate is static plus artifact-consistency review; the executed suites and typechecks above are
the runtime evidence. This PASS authorizes only the separately approved single LOW route successor;
it does not approve that unseen Board, a package, a Wizard Order or a render.

## Post-gate bounded successor

After the independent PASS, the pre-spend fence verified the exact branch/HEAD, d963 Template and
bridge, complete live environment, absent v7 target, and unchanged Home / failed-route Registry
SHAs. A network-denied live-import preflight completed with zero fetch attempts. The one authorized
canonical route LOW then ran once, with no custom output root and no retry:

- Set Definition: `38870567284b295c73cfea594ec3ab837b4a7ea221cf3df0c1de36404270071a`
- prompt: `ee55e313d67f3c4f4601d3b7b3c4983cc7f31d9ecf20d3bf28dad1bef05fa1e2`
- asset: `4f0d592dbf3f1aa333655dae1b0e21f6b180b1bacaba01fad648919b92125272`
- Registry bytes: `93e6196ea70867d5283406b9796045f6afe6e24cf12b998fa07de2d4f1d55fb5`
- model / quality: `gpt-image-2` / `low`
- automated QA: `passed`, zero flags
- initial approval at mint: null / null

The old route Registry remains SHA-256 `d11d4930084d51bad74e161397c3f241043e0fdc0f6b5521e4eb8fc6cc1292e8`
and Home remains `01ccfe0e411803c2f00f32b153aba9abf5798f8592068288531a472b58404a32`.
Guy subsequently approved the exact Home definition / asset `48bf9d53...` / `741ef784...` and route
definition / asset `38870567...` / `4f0d592d...`. The controlled writer recorded Home approval at
`2026-09-01T06:22:42.080Z` and route approval at `2026-09-01T06:22:48.799Z`, both by exact value
`Guy`. The resulting approved Registry byte digests are respectively
`241db2f303c0649929d4aed07766437ed321e9a6b11d36ac6fcee24859d2c979` and
`d637792b390558b14265af79099faa5b21f36f44c9dc1ed4fde076b90ef68262`.
No Blueprint, package, locator, Wizard Order or render action followed the approvals in this
artifact milestone.

## Unchanged / excluded

No Story Source, d963 Template, bridge, reconciliation, existing Board/Registry/asset, Visual
Package, locator, Wizard selection, Order/payment row, renderer, budget, model, retry/fallback or
deployment artifact changed. This milestone does not approve any Board and does not authorize a
blind retry.
