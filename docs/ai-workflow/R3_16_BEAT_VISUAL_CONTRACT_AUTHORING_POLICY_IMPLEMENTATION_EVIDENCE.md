# R3 16-Beat Visual Contract Authoring Policy — Implementation Evidence

Date: 2026-09-02
Status: implementation and documentation-only closeout independently Claude Code PASSed; R3-B0a technically closed locally and unpushed
Branch: `codex/r3-all-wizard-render-readiness`
Worktree: `C:\GNart\Work\sh-all-wizard-render-readiness`
Immutable base: `146bb53a435f5ce9b5190cd03522160ec976ac01`
Reviewed implementation head: `2b41750f9f9d12a878af3607c0d41a40e14293b9`
Decision Gate: `docs/ai-workflow/R3_16_BEAT_VISUAL_CONTRACT_AUTHORING_POLICY_DECISION_GATE.md`

## Authorized outcome

Guy selected the QA corpus as the product-review starting point for the 17 unresolved Wizard stories, preserved the six
fantasy stories at 16 beats, and authorized the bounded policy implementation. This milestone authorizes code, tests,
documentation and provider-unreachable local evidence only. It does not authorize a provider call, render, accepted
Story Source revision, package publication, order change, deployment or spend.

## Independent Claude Code gate

Claude Code reviewed the immutable one-commit/no-merge range
`146bb53a435f5ce9b5190cd03522160ec976ac01..2b41750f9f9d12a878af3607c0d41a40e14293b9`
read-only and returned **PASS with no P0/P1**. It independently reproduced TypeScript PASS, all 14 changed spec files
at 646/646 passing assertions, page and input boundaries, USD 9.152 reservation, legacy v1/v2 immutability, the exact
all-story digest, and zero changed product/output paths. The two Vitest `onTaskUpdate` messages in its focused run were
post-assertion infrastructure errors and were not counted as PASS.

The three P2 notes were accepted and addressed by a separate documentation-only follow-up:

- the USD 9.152 reservation leaves only USD 0.848 (8.48%) under the USD 10 ceiling, making cost the binding constraint
  on any later page/input/model-price increase;
- the pre-commit 16-file/794-assertion slice was green but its exact argv was omitted from the original evidence; this
  closeout records that exact selection, while the immutable-range-derived 14-file selection remains the canonical
  independent-review claim;
- the reviewed implementation head was one commit ahead of origin and unpushed. Neither the PASS nor this closeout
  authorizes a push.

Claude Code independently re-gated the exact documentation-only range
`2b41750f9f9d12a878af3607c0d41a40e14293b9..9b944f4d7a980d812b7a8a7b03392ba12543b416`
read-only and returned **PASS with no P0/P1/P2**. It confirmed a clean one-commit/no-merge range touching only these
four documentation files, reproduced both published commands at 794/794 and 646/646 assertions with their exact
post-summary RPC disclosures, verified USD 0.848/8.48%, and confirmed that the implementation range is byte-unchanged
and the two reviewed commits remained unpushed.

## Verified cause and correction

Policy v20 capped the general Visual Contract authoring lifecycle at 12 pages and 64,000 standard input units. The
compiler and exact-page schemas already handled 16 pages, so the missing capability was policy and versioned evidence.
Measured real fantasy initial inputs also proved that a page-only change was insufficient: Fox and Panda exceeded the
old 64,000 ceiling.

Implementation raised the current policy to 16 pages and the provider option to 80,000. A late adversarial audit then
found that the existing 4,096 safety margin was enforced only by selected route selectors. The correction now uses one
shared effective standard-route ceiling of `80,000 - 4,096 = 75,904` in request validation, provider-adjacent dispatch,
and receipt accounting validation. All standard repair modes pass through that seam. Terminal-reference cleanup keeps
its separately approved exact 12,000-input ceiling.

Changing the route threshold also changed persisted route-admission diagnostics semantics. Current diagnostics were
therefore advanced from v2 to v3. Historical v2 and v1 diagnostics remain readable only at their original 59,904
boundary with their original seven-call and 4,096-unit protocol contracts frozen; they cannot be reinterpreted as
current 75,904 evidence or nested inside a current receipt/readiness artifact.

## Exact current policy

- Pages admitted: 1 through 16; 17 and above reject before credentials or transport.
- Provider max input option: 80,000.
- Effective standard-route admission: 75,904 estimated bytes/units.
- Terminal cleanup: one separately gated call, 12,000 input and 1,000 output.
- Standard calls: seven total, initial plus at most six repairs.
- 16-page output schedule: `[53334, 42666, 48000, 32000, 32000, 32000, 32000]`.
- 16-page output pool: 272,000.
- 16-page conservative maximum reservation: USD 9.152.
- Hard ceiling: USD 10.
- Remaining reservation headroom: USD 0.848 (8.48%); a later increase requires a fresh cost Decision Gate.
- Provider/model/reasoning/retry/no-fallback policy: unchanged.
- Resemblance threshold: unchanged at 0.70.

## Authority cutover

| Surface | Previous | Current |
|---|---|---|
| Authoring policy | v20 | v21 |
| Authoring request | v54 | v55 |
| Authoring receipt | v57 | v58 |
| Authoring readiness | v54 | v55 |
| Route-admission diagnostics | v2 | v3 |
| Live materialization input | v42 | v43 |
| Live materialization manifest/verifier | v52 | v53 |
| Canonical pre-live readiness | v49 | v50 |
| Execution materialization input/result | v39/v44 | v40/v45 |
| Supervisor request/readiness/result | v49/v49/v42 | v50/v50/v43 |

Authoring request v54, receipt v57 and readiness v54 are registered as `legacy_immutable`. Route diagnostics v2/v1 are
legacy-readable at 59,904. Current execution requires fresh current-only materialization. Existing QA bridge artifacts
that embed prior current-only upstream versions are expected to fail closed and require rematerialization; this
milestone does not claim cross-policy bridge replay compatibility.

## Real corpus evidence

Provider-unreachable prompt accounting for the six 16-page QA fantasy sources:

| Story | Initial estimated input |
|---|---:|
| `bunny_ometz_fantasy` | 62,437 |
| `chameleon_koko_fantasy` | 60,354 |
| `dragon_dini_fantasy` | 56,212 |
| `fox_uri_fantasy` | 66,097 |
| `lion_shaket_fantasy` | 54,957 |
| `panda_anat_fantasy` | 68,318 |

Panda, the largest initial prompt, retains 7,586 units below the effective 75,904 route ceiling and 11,682 below the
raw 80,000 provider option. A 16-page Panda full-draft repair with the maximum 128 normalized issues measured 72,194;
a one-affected-record-per-page source-ID repair measured 70,740. Larger legal payloads remain safe because the shared
seam rejects any standard route above 75,904 before transport.

The all-story audit reports:

- 18 nominal slots, 18 sellable, 18 QA LOW-ready and 18 policy-admitted;
- no remaining fantasy authoring-policy decision or blocked story key;
- one accepted product lineage and one strict render-qualified story;
- 17 records still first-blocked by `product_source_corpus_unconfirmed`;
- digest `4e0a667926639526b106bc45cd3c4e7df7c11518d7cf941e35d528d856294977`;
- zero files/directories written, database/storage reads or writes, network/provider calls, images/audio generated, and
  orders created or modified.

The report field `visualContractAuthoringAdmitted` is presently derived from the page-policy result. Its value is
correct for this exact corpus because the independent prompt-accounting evidence above proves every measured input is
below 75,904. A future <=16-page source with a larger prompt remains fail-closed at the shared dispatch seam; a later
report-schema hardening should carry exact input-bound evidence instead of relying on that separate corroboration.

## Tests and checks

- `npx tsc --noEmit`: PASS.
- `npm run story:autonomous-typecheck`: PASS.
- `git diff --check`: PASS.
- Pre-commit broad suite: 16/16 files, 794/794 assertions PASS. The exact previously omitted selection is now
  reproducible as:

```powershell
npx --no-install vitest run `
  lib/__tests__/visual-contract-live-authoring.spec.ts `
  lib/__tests__/visual-contract-prompt-table-compaction.spec.ts `
  lib/__tests__/visual-contract-template.spec.ts `
  lib/__tests__/visual-contract-repair-loop.spec.ts `
  lib/__tests__/page-contract-repair.spec.ts `
  lib/__tests__/book-surface-repair.spec.ts `
  lib/__tests__/draft-authority-reference-diagnostics.spec.ts `
  lib/visual-package/__tests__/source-authority-lifecycle.spec.ts `
  lib/visual-package/__tests__/canonical-live-authoring-boundary.spec.ts `
  lib/visual-package/__tests__/live-request-materialization.spec.ts `
  lib/visual-package/__tests__/live-request-verification.spec.ts `
  lib/visual-package/__tests__/canonical-pre-live-readiness.spec.ts `
  lib/visual-package/__tests__/live-execution-request-materialization.spec.ts `
  lib/visual-package/__tests__/live-execution-supervisor.spec.ts `
  lib/visual-package/__tests__/wizard-all-story-render-readiness.spec.ts `
  lib/visual-package/__tests__/canonical-live-authoring-launcher.spec.ts `
  --maxWorkers=1 --no-file-parallelism
```

The documentation closeout independently reran that exact command: **16/16 files and 794/794 assertions PASS**.
Vitest exited 1 after the summary for one known worker `onTaskUpdate` RPC timeout; the timeout is not counted as PASS.

- Canonical immutable-range suite: every changed `*.spec.ts` file in the reviewed range, exactly 14 files and 646
  assertions. Claude Code independently reproduced 646/646 passing assertions with two known post-assertion RPC
  errors. The deterministic one-worker rerun uses this exact PowerShell command:

```powershell
$reviewBase = '146bb53a435f5ce9b5190cd03522160ec976ac01'
$reviewHead = '2b41750f9f9d12a878af3607c0d41a40e14293b9'
$changedSpecs = @(
  git diff --name-only "$reviewBase..$reviewHead" |
    Where-Object { $_ -match '\.spec\.ts$' }
)
npx vitest run @changedSpecs --maxWorkers=1 --no-file-parallelism
```

Codex reran that exact command after the QA handoff: **14/14 files and 646/646 assertions PASS**. Vitest still exited
1 after the assertion summary for one known worker `onTaskUpdate` RPC timeout; the timeout is not counted as PASS.

- The final three-file route-diagnostics regression slice passed 178/178 assertions after current-receipt v1/v2
  laundering guards and frozen legacy policy constants were added, using:

```powershell
npx vitest run `
  lib/__tests__/draft-authority-reference-diagnostics.spec.ts `
  lib/visual-package/__tests__/source-authority-lifecycle.spec.ts `
  lib/visual-package/__tests__/visual-contract-authoring-replay-evidence.spec.ts `
  --maxWorkers=1 --no-file-parallelism
```
- Generic boundaries prove 75,904 accepted and 75,905 rejected.
- A dynamically built initial request inside 75,905–80,000 rejects with zero provider calls.
- A Page Contract repair measuring 78,494 rejects before its second provider dispatch and records sanitized accounting.
- Exact 16-page template coverage rejects a truncated page 16.
- 13, 14, 15 and 16 pages admit in preflight; 17 and 23 pages reject with the provider sentinel unreachable.
- Materialization, verification, pre-live readiness, execution materialization and Supervisor current/legacy/tamper
  paths are covered.

Literal `npm run check` was run. Both TypeScript phases passed. The ordinary partition initially exposed two task-owned
stale route-diagnostics expectations; they were corrected and their affected suite is green. The remaining established
baseline is ten missing ignored-`outputs/` fixture assertions in six unchanged files. The resource-intensive partition
passed 20/20 files and 640/640 assertions, then reported three known Vitest worker RPC `onTaskUpdate` timeouts. The
literal repository gate is therefore red and is not reported as PASS.

## Preservation and external effects

- Accepted Story Source tree at base: `62ce09fa6ea6ca5bb9b320d59cc75d9d27ac887d`.
- Storyboard input tree at base: `2d272829adfa901a3c7ad50301c756eb3f47ab50`.
- QA Story Source tree at base: `8f42417b4da4c25cb189f1c0efa031398d255a94`.
- Current Chameleon package revision remains
  `836a3414174dbe3060010371e81ebdbef821f705650a199cc4bbfd70081d523f`.
- No working diff exists under Story Source, storyboard input, QA bank, approved package or locator paths.
- No provider, credential, network, image, audio, database, storage, order, payment, PDF, deployment or production-flag
  action occurred.

## Next gate

Both the implementation and documentation-only correction ranges have independent Claude Code PASS. R3-B0b may next
prepare the exact 17 digest-bound QA Story Source/Visual Direction candidate bundles. Product acceptance, publication,
push and paid authoring remain separate decisions.
