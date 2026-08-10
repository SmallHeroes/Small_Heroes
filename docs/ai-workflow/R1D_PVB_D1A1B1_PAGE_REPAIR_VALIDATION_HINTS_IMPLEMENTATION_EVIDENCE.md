# R1D-PVB-D1A1B1 Page Repair Validation Hints - Implementation Evidence

## Status

Implementation complete locally; independent Claude Code QA pending.

- Base: `c3c0937d15eef84a26caa22735f809031ce10012`
- Implementation commit: `bba169c2`
- Branch: `codex/r1d-pvb-d1a1b1-page-repair-validation-hints`
- Worktree: `C:\Users\guyna\.codex\worktrees\presentationrepair1\Small_Heroes`
- External implementation cost: `$0`

## Observed defect

The bounded attempt-2 and attempt-3 records show the same system failure. Earlier compact repairs completed and resolved their eligible typed failures. The next validation pass produced twelve page-local `draft_contract / final_structural_invariant_invalid / page / final_structure` issues, one for every page. The selected `page_contract_patch` input contained the complete affected page contracts and the generic typed target, but not the concrete deterministic validator messages. Both page-repair provider responses completed while all twelve failures remained.

This was an information defect inside an already-authorized repair route, not a transport, structured-output, routing, timeout or budget defect.

## General correction

`pageContractRepairAffectedPages` now requires the validation-message array that belongs to the same compiler attempt as the typed diagnostic array. It:

1. rejects cardinality mismatch and empty/non-string messages;
2. derives page membership only through the existing closed typed issue parser;
3. groups each message by that typed positive page locator;
4. deduplicates and lexically sorts the page-local messages;
5. requires every affected page to retain at least one message; and
6. sends the resulting `validationHints` inside the existing lossless compact input.

`compileBookVisualContractTemplate` supplies its in-memory `attemptErrors` alongside `attemptDiagnosticIssues`. The provider is instructed to resolve the page-local typed targets and exact repository-validator hints while preserving unaffected page semantics.

The strict output schema, parser, exact-set application and complete revalidation are unchanged. Validation hints are not persisted in receipts, readiness, candidates or operator evidence. The lifecycle test explicitly proves the hint reaches the repair call while the receipt does not contain it.

## Authority and unchanged policy

- Current prompt authorities: `page-contract-repair-prompt/v6` and `page-contract-repair-user-prompt/v6`.
- Output schema remains `page-contract-repair-schema/v1` / `PageContractRepairPatches`.
- Compact input encoding remains the existing lossless `page-contract-repair-input-encoding/v1`.
- Visual Contract request/receipt/readiness and every downstream schema remain unchanged because no persisted shape changed; newly materialized authorities bind the new prompt version and system-prompt digest content-addressably.
- Model, service tier, reasoning, 64K input ceiling, 36K output ceiling, call/repair budget, timeout, transport retry/fallback policy, candidate semantics, Blueprint, Wizard and render policy are unchanged.
- Historical output roots and artifacts were not modified.

## Validation

Focused compiler and lifecycle:

```text
npx vitest run \
  lib/__tests__/page-contract-repair.spec.ts \
  lib/__tests__/visual-contract-repair-loop.spec.ts \
  lib/visual-package/__tests__/source-authority-lifecycle.spec.ts \
  --pool=forks --maxWorkers=1 --no-file-parallelism

3 files / 133 tests PASS
```

Canonical authority chain:

```text
npx vitest run \
  lib/visual-package/__tests__/canonical-live-authoring-boundary.spec.ts \
  lib/visual-package/__tests__/live-request-materialization.spec.ts \
  lib/visual-package/__tests__/live-request-verification.spec.ts \
  lib/visual-package/__tests__/live-execution-request-materialization.spec.ts \
  lib/visual-package/__tests__/live-execution-supervisor.spec.ts \
  lib/visual-package/__tests__/canonical-pre-live-readiness.spec.ts \
  --pool=forks --maxWorkers=1 --no-file-parallelism

6 files / 283 tests PASS
```

Additional gates:

- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.
- The single literal `npm run check`: TypeScript PASS; resource-intensive phase PASS at 19 files with valid diagnostic protocol; ordinary phase reported exactly the six established missing ignored-output fixture failures across the known five files and no seventh assertion or infrastructure failure.

Those fixtures remain a separate repository/release HOLD. Guy has accepted them only for the one-page local LOW measurement; they are not waived for release.

## Acceptance evidence

- Exact message/diagnostic cardinality and empty-message failure are directly tested.
- Two-page grouping, duplicate suppression and deterministic ordering are directly tested.
- Compact prompt encode/decode retains exact validation hints.
- The live compiler repair loop receives the actual camera validator message.
- The twelve-page lifecycle remains under the unchanged 64K admission ceiling.
- A represented-elsewhere message reaches only its page repair while the canonical receipt retains typed diagnostics and omits the prose.
- B0/materialization/verifier/Supervisor/Fresh Readiness remain green and provider sentinels remain unreachable.

## Boundaries

No credential access, pricing lookup, provider/model/network call, real B0 or Fresh Readiness, preflight, live authoring, candidate, Semantic Reconciliation, Blueprint/Wizard action, image/Vision/render, storage/database, Board, approval, publication, promotion, deployment or production activation occurred. Production remains blocked.

## Rollback

Revert `bba169c2` and its documentation closeout. No artifact or data migration is necessary because the change is in-memory repair input and historical evidence remains immutable.
