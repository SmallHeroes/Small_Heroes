# R1D Real Candidate -> QA Wizard Reconciliation Bridge — Implementation Evidence

**Date:** 2026-08-17

**Status:** first bridge milestone independently QA-passed locally; unpushed; no Fresh Readiness, live, Blueprint, Wizard, or render authority

## Topology and scope

- Worktree: `C:\GNart\Work\sh-wt-r1d-output-budget`
- Branch: `codex/r1d-real-candidate-qa-wizard-low-bridge`
- Exact accepted base: `b2f6a7418f0f112a1ab911153be2718f1a339d45`
- Accepted Decision Gate commit: `86ef43ab2448223d3d828a8b6822ff8c181735a2`
- Implementation commit: this focused closeout commit; the immutable hash is recorded in the independent-QA handoff
- External implementation cost: `$0`
- Production, database/storage, package registries, approved locators, and historical output artifacts: untouched

This is commit boundary 1 of the accepted bridge plan. It carries a real canonical Visual Contract candidate only as far as a pending or exactly approved Source Prompt Reconciliation and production authoring context v3. Blueprint authoring/approval, Visual Package v5 assembly/promotion, real Wizard freeze/runtime-v6 qualification, and LOW rendering remain later milestones.

## Root cause and authority correction

The existing Supervisor result v18 attested readiness, credential handling, child termination, and suppressed output, but did not bind the successful child to the receipt/readiness/candidate later found in its output root. A child that merely exited zero could therefore be followed by post-hoc direct authoring artifacts and appear eligible to a downstream bridge. That did not satisfy the accepted requirement to consume only a candidate produced inside the canonical Supervisor boundary.

Supervisor result v19 adds `canonical-live-execution-child-output-authority/v1`. The parent inspects the output root synchronously after the child closes and accepts `child_completed` only when all of the following hold:

- the exact authoring request, receipt, readiness evidence, and candidate each exist as one unique canonical artifact;
- provider-failure and rejected-request categories are empty;
- request, receipt, readiness, candidate, B0 manifest, Fresh Readiness, output root, and current repository authority cross-bind exactly;
- current receipt/readiness validators pass and the candidate rebuilds byte-identically;
- the sanitized child-output authority carries the exact four descriptors and a canonical digest.

All failure results carry `outputAuthority:null`. Exit zero without the tuple becomes `child_failed / child_output_authority_rejected`, and the public Supervisor exits nonzero. Duplicate request or output artifacts, post-hoc artifacts, category substitution, stale or redigested authority, and path aliases fail closed. Fresh Readiness and Supervisor now share the exact five pre-live absence categories: `authoring-receipts`, `contract-candidates`, `provider-call-failure-evidence`, `readiness-evidence`, and `rejected-authoring-requests`. `authoring-requests` is deliberately excluded because B0 creates and binds it before live execution.

## Reconciliation bridge

`qa-wizard-candidate-bridge-manifest/v1` binds the current Story Source snapshot, canonical Fresh/Execution/Supervisor chain, Visual Contract request/receipt/readiness/candidate, template and semantic evidence, reconciliation/review artifacts, and explicit downstream exclusions. The bridge:

1. captures a schema-valid Supervisor v19 result as contained content-addressed evidence;
2. verifies current clean same-name-upstream `0/0` topology and replays the B0, Fresh, Supervisor, receipt/readiness/candidate, Story Source, and reconciliation bindings;
3. persists a deterministic pending reconciliation packet without provider or credential access;
4. requires a separate `qa-wizard-reconciliation-approval-attestation/v1` bound to the pending manifest, exact completed reconciliation, review bundle, and review Markdown;
5. advances only to production authoring context v3 after the exact approval artifact validates.

The approval command records but cannot technically authenticate reviewer identity. It must be invoked only after Guy reviews and explicitly approves the exact content and digests. Automation stops at `reconciliation_pending`; a string field is not autonomous approval authority. The approved manifest continues to state that it does not authorize Blueprint authoring or approval, Visual Package authoring or approval, Wizard qualification or render, any provider/image call, production publication, or deployment.

The CLI exposes four strict commands: `capture-supervisor-result`, `prepare-reconciliation`, `approve-reconciliation`, and `advance-reconciliation`. Unknown, duplicate, equals-form, missing, or malformed inputs fail with closed sanitized reason codes. Rejections do not claim that an immutable write occurred.

## Validation record

### Focused and policy-correct validation

- QA bridge: **1 file / 5 tests PASS**. This includes a real Git/Fresh/Supervisor-shaped fixture, post-hoc splice rejection, exact absence and child-request binding tamper, junction rejection, missing/tampered/replayed approval, CLI fail-closed output, and the valid pending-to-approved path.
- Supervisor v19: the final repository resource phase ran **41/41 PASS**, including exit-zero output rejection, duplicate authoring request, tuple tamper, multiple outputs, failure-category artifacts, and valid child output authority.
- A policy-correct replacement for an earlier over-concurrent aggregate ran Supervisor/readiness sequentially under the repository workload policy: **2 files / 53 tests PASS**, diagnostic protocol valid, no timeout/RPC/IPC/reporter/launch/signal/teardown class. The final duplicate-request and exit-disposition additions were then covered by focused slices and by the later 41/41 repository-phase result.
- Corrected live Execution Request materializer: **1 file / 20 tests PASS**, resource-intensive worker policy, diagnostic protocol valid, no infrastructure class.
- `npx --no-install tsc --noEmit`: **PASS** after the final correction.
- `git diff --check`: **PASS** after the final correction.
- CLI `--help` and process-level sanitized rejection paths: **PASS**.

An earlier raw mixed focused aggregate was not policy-conformant and is not acceptance evidence: it completed 92/94 assertions but encountered one five-second test timeout, one Git subprocess timeout, and two `onTaskUpdate` RPC timeouts. It was not repeated in the same shape. Exact orphan Vitest processes from that failed wrapper were identity-checked and terminated; the repository-policy replacement above passed.

### One literal repository gate

`npm run check` was invoked exactly once and was not rerun.

- TypeScript and autonomous story typecheck: **PASS**.
- Ordinary phase: 281 files; 3,210 tests passed, 65 skipped, and 5 assertions failed across the 4 established missing-output fixture specs (`child-lexicon-ages-5-8`, `momentum-gate-koko`, `page-entity-qa`, and `story-read-back-validation`). These remain a separate release HOLD.
- Resource-intensive phase: 20 files; 19 files passed. The new bridge (5/5), final Supervisor (41/41), and canonical readiness (13/13) were green. One materializer file failed 9 assertions because its old fixture supplied only `contract-candidates` as an expected-absence path after v19 made the exact five-path set canonical. The first failures occurred before request staging, causing the remaining intended failure tests to collapse to the same generic rejection.
- The stale fixture alone was corrected to call the shared canonical five-path helper. No production behavior changed. Its complete 20-test file then passed under resource-intensive diagnostics. The literal repository gate was not repeated, so this milestone does not claim a green `npm run check`.
- Neither phase reported a diagnostic-protocol failure. The literal gate's nonzero exits were assertion failures, not launch, timeout, RPC/IPC, reporter, signal, or teardown failures.

## Migration, boundaries, and rollback

- Current Supervisor results are v19. Historical v18 results remain immutable but cannot authorize this bridge; there is no rewrite migration.
- Existing candidate v9, reconciliation v2/review v2, production context v3, Blueprint v4, Visual Package v5, locator v3, frozen authority v3, and runtime v6 contracts are unchanged.
- No model, prompt/schema authority, token/input/output budget, call/repair count, timeout, retry, fallback, price fence, candidate semantics, Board/prop authority, Wizard policy, or render policy changed.
- No credential was read or checked. No pricing lookup, network/provider call, Fresh Readiness, preflight, live authoring, image/Vision, render, database/storage, QA deployment, production deployment, or push occurred during implementation.
- Rollback is a focused revert of this implementation commit. No persisted production or database state exists to migrate or repair.

## Independent Claude Code QA

Claude Code independently reviewed exact immutable range `b2f6a7418f0f112a1ab911153be2718f1a339d45..80a929d1f54f9e899efa00c19b53142e370f4192` in read-only plan mode and returned **PASS** at the independent technical-QA level with zero BLOCKER, zero MAJOR, and zero MINOR.

The review verified exact two-commit/zero-merge topology and all ten requested falsification targets: causal Supervisor v19 output binding, sole canonical tuple enforcement, the exact five expected-absence categories, rejection of synthetic or post-hoc authoring, content-addressed reconstruction and tamper/replay/link defenses, separate non-inferred reconciliation approval, strict sanitized CLI behavior, unchanged policy/dependency/literal surfaces, validation-evidence fidelity, and the exact test-only materializer correction. It independently confirmed closure of all three prior internal findings: rejected exit-zero now returns nonzero, duplicate authoring requests fail count-exactly-one, and the stale singleton fixture now consumes the shared canonical five-path authority.

Claude retained four non-blocking advisory notes. The material limitation preserved in its returned summary is that it did not rerun the consumed `npm run check`, TypeScript, or independently reproduce the recorded `41/41`, `53/53`, and `20/20` runtime figures; its verdict rests on source-contract review plus this document's explicit non-green repository-gate disclosure. No advisory changes the PASS or authorizes downstream work.

The single external Claude Opus High review cost `$10.8810505`; it used 39 turns and performed no web search/fetch. No follow-up review was run because there was no finding to correct. This PASS grants no Blueprint, package, Wizard, provider, render, deployment, release, or product acceptance. Codex records Claude's verdict; it does not self-award it.
