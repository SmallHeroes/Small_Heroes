# R3 16-Beat Visual Contract Authoring Policy — Implementation Evidence

Date: 2026-09-02
Status: local implementation complete; independent Claude Code QA pending
Branch: `codex/r3-all-wizard-render-readiness`
Worktree: `C:\GNart\Work\sh-all-wizard-render-readiness`
Immutable base: `146bb53a435f5ce9b5190cd03522160ec976ac01`
Decision Gate: `docs/ai-workflow/R3_16_BEAT_VISUAL_CONTRACT_AUTHORING_POLICY_DECISION_GATE.md`

## Authorized outcome

Guy selected the QA corpus as the product-review starting point for the 17 unresolved Wizard stories, preserved the six
fantasy stories at 16 beats, and authorized the bounded policy implementation. This milestone authorizes code, tests,
documentation and provider-unreachable local evidence only. It does not authorize a provider call, render, accepted
Story Source revision, package publication, order change, deployment or spend.

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
- Exact 16-file authoring/materialization/execution suite: 16/16 files, 794/794 assertions PASS. Vitest returned exit 1
  only for the known shared-worker `onTaskUpdate` RPC timeout after all assertions passed.
- The final three-file route-diagnostics regression slice passed 178/178 assertions after current-receipt v1/v2
  laundering guards and frozen legacy policy constants were added.
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

Commit this focused milestone, confirm branch/worktree topology again, and hand the immutable base-to-head range to
Claude Code for read-only adversarial review. Only after PASS or a correction/re-gate may R3-B0b prepare the exact 17
digest-bound QA Story Source/Visual Direction candidate bundles. Product acceptance, publication and paid authoring
remain separate decisions.
