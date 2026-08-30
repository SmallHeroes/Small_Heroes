# R1D Blueprint terminal-receipt exhaustiveness and incident evidence — implementation evidence

## Status

Local implementation complete on `codex/r1d-order-package-authority-binding`, based on `cd43d71d466d2aa138cc5d5b1afae91be87d022a`. Independent Claude Code re-gate is pending. This document is evidence, not a technical PASS or permission to redispatch the historical paid authority.

## Incident that triggered the change

The first bounded Blueprint execution for the approved Chameleon chain durably published execution claim `466252b4a082ea6b98503bb2bc3e433a36408cfb61d1fd305afcbfa2b9804b64`, then returned `execution_state_uncertain` without a receipt, terminal manifest, or terminal lookup.

The artifact record proves the failure window occurred after claim publication and before terminal publication. It cannot prove the lost in-memory receipt or its terminal code. The strongest code-level defect found in that window was exact and independently reproduced: the runner could return terminal code `repair_route_input_not_admissible`, while lifecycle receipt replay used a stale duplicate allowlist that omitted it. A valid failed receipt could therefore be rejected before its first durable receipt write. Receipt-publication failure remains a theoretical alternative for the historical run because the old path did not preserve phase evidence.

Historical evidence remains unchanged:

- claim path: `outputs/qa-wizard-blueprint-authoring-ledger-v1/execution-claims/466252b4a082ea6b98503bb2bc3e433a36408cfb61d1fd305afcbfa2b9804b64.json`;
- claim byte length: `766`;
- claim SHA-256: `900bd0c95d748637d90922c1a28fb05c87d116563c604529f027bc8160453515`;
- original output root: `outputs/r1d-lantern-blueprint-wire-20260830T044048214Z`, `58` files, `0` receipts and `0` terminal manifests;
- no historical execution incident or terminal lookup exists, because the deployed code did not yet write that evidence.

## Implementation

### One terminal-code authority

`productionAuthoringRunner.ts` now exports the complete closed terminal-failure set it can emit. The runner's failure builder and final selector are typed from that set, and lifecycle replay imports the same value. Adding a new runner terminal without extending this authority now fails at compile time instead of silently diverging from replay.

### Durable post-claim incident evidence

`qaWizardBlueprintAuthoringLifecycle.ts` now persists one immutable, content-addressed incident after a post-claim exception. The incident binds the exact authoring authority, request, preflight manifest, claim digest and claim path, plus the bounded lifecycle phase. If a valid terminal receipt exists only in memory, the incident records only its digest and terminal status. It always records provider outcome as `unknown` and resolution as `operator_resolution_required_no_redispatch`.

The incident contains no raw exception, stack, prompt, provider output, credential, story content, child data, or filesystem error. Re-entry first validates the exact claim, attempts normal terminal recovery, then loads the exact immutable incident and stops without provider construction. Conflicting incident bytes fail closed and are never overwritten.

### Safe operator surface

The CLI may expose only the repository-owned incident path and closed phase alongside `execution_state_uncertain`. It still emits no raw cause. Existing completed/failed terminal recovery remains first priority.

## Regression proof

The focused tests prove:

- a direct `repair_route_input_not_admissible` runner receipt passes lifecycle replay;
- the full lifecycle persists that route as `authoring_failed` and exact replay performs zero provider calls;
- a crash immediately after claim writes a sanitized `claim_validation` incident and re-entry performs zero provider calls;
- a post-receipt crash binds `receipt_publication`, the terminal receipt digest and status, then re-entry remains provider-unreachable;
- tampered/conflicting incident bytes fail closed without overwrite;
- the existing terminal-manifest recovery path still recovers normally rather than being shadowed by incident evidence.

Validation after the final formatting-only cleanup:

- Blueprint/Wizard focused battery: `262/262` PASS across eight files;
- `npx --no-install tsc --noEmit`: PASS, exit `0`;
- `git diff --check`: PASS, exit `0`.

Literal `npm run check` was also run and is honestly red for repository baseline/infrastructure reasons outside this change:

- ordinary partition: `4,048` passed, `73` skipped, `9` failed assertions in five unchanged files because ignored historical `outputs/` fixtures are absent;
- resource-intensive partition: `617` passed, `15` timed out in five unchanged Git/subprocess-heavy files, plus four known Vitest `onTaskUpdate` RPC timeout errors;
- the changed Blueprint lifecycle and foundation tests passed inside the literal run, and the complete focused battery passed serially afterward.

## Boundaries and next action

No credential, provider, network, image, audio, database, Candidate, Blueprint, package, locator, render, deployment, historical-artifact mutation, or paid retry occurred during this correction.

This change does not resolve, delete, supersede, or authorize redispatch of the historical orphan claim. After local commit and independent Claude Code PASS, a separate explicitly governed replacement-execution authority is required to make one new paid attempt while preserving the original claim and its uncertainty evidence.
