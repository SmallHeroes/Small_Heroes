# R1D Deferred Represented-Elsewhere / BookSurface Routing — Implementation Evidence

## Outcome

The implementation is locally green and has no product/provider spend. It
routes an independently closed mixed surface through the existing atomic
BookSurface lane while deferring only three closed represented-elsewhere
coverage failures. Full validation then exposes the residual to the existing
PageContract lane. The production-backed offline harness reaches a Candidate
with complete unique issue counts `5 -> 1 -> 0` and no provider call.

## Consumed live evidence

The canonical root
`outputs/r1d-missing-binding-fresh-9d9aa56f-20260818T220552372Z` is consumed
and must never be retried or reused. Receipt v46 digest
`7601985aa8027823bb1d0600961db58bf35e4cfc15cd6a7fd4887f37eedd59e8`
records:

- story `chameleon_koko_bedtime`, eight pages;
- route `initial -> full_draft`;
- two completed provider calls, one repair, zero transport retries and no
  fallback;
- complete unique census `17 -> 24` and terminal
  `draft_validation_repair_regressed` before a third dispatch;
- no Candidate, reconciliation, Wizard or render authority.

The first census contained eight closed-catalog presentation gaps, eight page
action-requirement structural issues, and one page-5
`represented_elsewhere_pointer_out_of_scope` diagnostic whose persisted
coverage item index was 43.

## Root cause

Two independent defects formed the broad-route fallback:

1. the semantic-coverage classifier treated every represented-elsewhere
   pointer/value failure as a blocking non-surface issue, so the otherwise
   closed BookSurface surface was discarded and `full_draft` was selected;
2. the final coverage validator persists a flat book-level coverage index in a
   page-item locator, while PageContract interpreted that index as local to the
   named page. A synthetic two-page fixture reproduced the same mismatch with
   persisted item index 1 and current page-local record index 0.

## Implementation

### Closed deferred classifier

`compileBookVisualContractTemplate.ts` admits the independent BookSurface lane
only when the semantic coverage population is nonempty and every issue is
either:

- a capability-dependent `coverage_missing` on a page already represented by
  the closed catalog gap; or
- exactly one of
  `represented_elsewhere_pointer_out_of_scope`,
  `represented_elsewhere_pointer_unresolved`, or
  `represented_elsewhere_value_mismatch`.

All other action-semantic, source, world, cast or mixed failures remain
blocking. BookSurface receives no action-semantic coverage authority and the
full compiler validation boundary remains unchanged.

### Scan-based PageContract rebinding

`pageContractRepair.ts` no longer trusts the historical locator index for a
represented-elsewhere mutation. For each typed diagnostic it:

1. scans only the named page's current coverage records;
2. recomputes the exact same failure code with the canonical pointer permission
   and JSON-pointer resolution functions;
3. requires exactly one current record to reproduce that exact code;
4. uses that record's page-local index for the existing exact target/applier.

Zero matches, multiple same-code matches, stale current state, duplicate
targets, malformed records or mixed unsupported diagnostics return no repair
authority. No index fallback or nearest-match guess exists.

## Offline proof

The production-backed harness injects an initial draft with a closed catalog
gap, structural failures and a represented-elsewhere failure whose persisted
flat index differs from the page-local draft index. It injects two deterministic
responses and proves:

- exact route `[null, book_surface_patch, page_contract_patch]`;
- BookSurface preserves the represented coverage record;
- PageContract resolves the unique current local record;
- a Candidate is produced;
- surfaced and complete unique counts are `5 -> 1 -> 0`;
- complete deltas are `null, -4, -1`;
- monotonic complete census is true, maximum positive delta is zero;
- provider calls are zero.

Direct PageContract tests additionally prove all three failure codes, flat to
local index rebinding, distinct-code coexistence, same-code ambiguity and stale
state rejection.

## Validation

- focused compiler/PageContract/harness run: **72/72 PASS**;
- broader six-suite run: **245/245 PASS**;
- `npx tsc --noEmit`: PASS;
- `git diff --check`: clean;
- Claude Code dirty-diff adversarial review: PASS after one minor hardening;
- Claude Code micro re-gate: PASS with no remaining finding.

One literal `npm run check` was executed once. TypeScript and the autonomous
story typecheck completed successfully. The command returned exit 1 after
228,761 ms; the Codex app retained only the first 20,000 characters of the
Vitest output and clipped the final summary. Relevant changed suites visible in
the retained output were green, but no unsupported full-repository count is
claimed and the command was not retried.

## Unchanged authority

No model, tier, reasoning, prompt, provider schema, persisted artifact version,
policy v17, output budget v6, input/output cap, timeout, call count, retry,
fallback, hard USD fence, Candidate, Wizard, Story Source, Reader or render
contract changed. The fix consumes no provider, credential, image or render
authority.

## Independent QA and stop boundary

Claude Code reviewed immutable range
`9d9aa56f0a77e76bf126f8cb9657123db05e2b81..9dbc9b8de2c23fa597a3a9b04d549eeee7684a48`
read-only and returned **PASS — 0 BLOCKER / 0 MAJOR / 0 MINOR**. It independently
confirmed the exact three-code eligibility, BookSurface coverage non-mutation,
canonical same-page failure reproduction, flat-to-local index replacement,
stale/ambiguous rejection, harness Candidate trajectory and absence of
authority/policy/version drift. Its three advisories were explicitly
fail-safe and required no code change.

The already-authorized next step is push, one new current-head Fresh Readiness
and one canonical live authoring attempt. It is the second consecutive bounded
live attempt: any failure is a hard stop with no retry and no symptom-fix loop.
Wizard reconciliation and LOW render require a real current Candidate.

## Post-PASS Fresh and single live outcome

After push, one new Fresh v39 root was created at
`outputs/r1d-deferred-represented-fresh-d3c50c85-20260819T000133976Z`.
Probe, prepare and verify passed; prepare and verify returned identical Fresh
digest
`beb76a067877f54066bc7f44a6e89174eda977d22edba3d03df3220e616e8dd9`.
The verified evidence retained `credentialAccess:none`, `providerCalls:0`,
`canonicalPreflight:not_run` and `liveAuthority:none`. Claude Code independently
audited the exact eight-file inventory, five preservation fences and zero-write
Supervisor readiness v39. OpenAI's official current default-tier Sol prices
matched the canonical price authority before spend.

The exact canonical Supervisor invocation bound to Execution Request
`24405a58e4ca54e925a30a08154fd694a5fbb727d84ff63e7d15a5daedc95f01`
was consumed once. It returned child exit 1 and no output authority. Receipt
v46 digest
`b4f8ad031b0ead6d1adf4ea67b1664d51ccbdb42e7bfaf32ae1cde845d10178d`
records:

- seven completed logical/provider dispatches, six repairs, zero transport
  retries and no fallback;
- route `initial -> book_surface_patch x6`;
- complete unique issue progression `17 -> 7 -> 7 -> 7 -> 7 -> 7 -> 7`;
- ten closed-catalog action-semantic gaps resolved by attempt 2;
- seven persistent page structural identities on pages 1 through 7, each with
  cause `page_prop_constraints_invalid`, unresolved through all remaining
  BookSurface attempts;
- terminal `draft_validation_repair_exhausted` /
  `draft_validation_budget_exhausted`;
- aggregate usage 53,355 input, 21,870 cached input, 31,464 cache-write input,
  42,756 output, 16,312 reasoning and 96,111 total tokens;
- USD 1.490370 nominal and USD 1.777768 conservative accounted cost;
- `candidateDigest:null` and `reconciliationDigest:null`.

Supervisor v32 persisted `child_failed`, reason `child_nonzero_exit`, child exit
1, suppressed child streams, credential read success followed by
`authorityCleared:true`, and `outputAuthority:null`. Its stderr artifact is zero
bytes. Claude Code independently recomputed and cross-checked the persisted
artifact graph and returned **Artifact Integrity PASS / Execution HOLD**.

The implementation's BookSurface preference was exercised: no full-draft route
was selected. The exact represented-elsewhere residual and PageContract
rebinding were not exercised because this initial response contained no
represented-elsewhere diagnostic. The terminal failure is a BookSurface
fixed-point on page prop constraints, not provider transport, budget overrun,
artifact corruption or a positive complete-census regression.

This run is the second consecutive bounded live failure. The mandatory stop
condition is active: no retry, no third live attempt, no symptom-fix milestone,
no Wizard mutation and no render. No Candidate or downstream authority exists.
