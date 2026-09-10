# Blueprint provider diagnostic log — bounded continuation

2026-09-09. Guy: continue after the real Blueprint failed without preserved transport classification. Codex sole writer, same task/worktree C:/GNart/Work/sh-r3b1b-semantic-m1, branch codex/r3b1b-semantic-recovery-m1, base f4cf3f0500f7a2b9c7660ff4001605fd1d52e24f, clean 0/0 at start. Protected d53b768ccb2f and accepted-intent63ccb484 clean/read-only.

1. Proposed change: preserve an allowlisted, non-authoritative diagnostic log when the Blueprint adapter catches credential/transport failures. Reuse the existing provider failure classifier; retain terminal error behavior and receipt bytes/schema.
2. Why: transport.create already throws ProviderCallFailureDiagnosticError with safe classification, but Blueprint's catch discards it. The real failed receipt has one dispatch, null response/usage, generic provider_call_failed. This explains lost observability, NOT the original API failure cause. GET model metadata subsequently returned 200; original failure remains unknown.
3. Scope: general Blueprint adapter failure logging, shared by ordinary/replacement/diagnostic callers. No story-specific runtime branch.
4. Hardcoding: none for Dini, child or page. No new abstraction for rendering.
5. Files: adapter, bounded diagnostic reporter, existing adapter spec, CURRENT/ROADMAP, this gate/evidence.
6. Expected: HTTP failure class/code/status or local credential failure classification appears in stderr. No raw errors/messages/stack/headers/prompts/keys, unbounded values or approvals. Existing failure still propagates; no retries, fallback, receipt authority or consumed-identity changes. Logs are supplemental; not crash-durable evidence or recovered original error.
7. Validation: reproduce missing log at untouched adapter; tests for classified 429 quota vs rate limit, connection/parse/credential failures, malicious diagnostics/accessors, throwing console, no retry. Run focused existing specs, both typechecks and full check. No live provider required.
8. Cost: USD0 additional, no credentials read and no live generation. Previous call billing remains unknown. No render in this milestone.
9. Rollback: revert focused commit; immutable artifacts and old v8 receipts are untouched. Diagnostic-only behavior must not change execution program or allow reuse of paid identities. New tracked HEAD makes prior current-bound bridge historical; no live call while dirty/ahead.
10. Review: product direction already resolved. Claude first pass read-only against immutable code range; falsify leakage, altered failure semantics, missing caller coverage, false billing claims and authority escalation. Cowork not needed for this engineering issue. Guy eventually reviews real images, not logger output.
11. Do not: generate/retry a book, replace keys/model, increase budgets, relax gates, rewrite receipts, infer original API cause, push automatically, or publish ignored evidence.

Stop-check: general failure observability fix, no creative/identity/layout change; could affect all Blueprint failures so regression coverage required; zero spend; smallest proof is injected transport failure through real adapter; no unresolved product choice; no automatic QA PASS. Independent code PASS stays f4cf3f05 until Claude reviews this change.

## Completion evidence — local green, no independent PASS

Six-file milestone: this gate, CURRENT, ROADMAP, adapter, new reporter and existing adapter spec. Only two production TypeScript paths; no schema/receipt/policy/runner/CLI change. Shared default claimed executor and ordinary CLI both construct the same adapter, so no duplicated reporter wiring was required. Count adapter and post-response completion/usage failures are intentionally unchanged.

Red regression on original adapter:1 failed/28 filtered skips, expected one log but got zero. Final focused command:99 passed/0failed in3specs (adapter40, diagnostics38,count21). Twelve new adapter tests. Real SDK/guard path with mocked fetch covers quota vs rate limit,401,400,connection andSSE error; credential failure/no dispatch, success/no log, throwing logger, malformed diagnostic/accessors/extra fields/toJSON and terminal/no retry also verified. No real provider or credential access.

`npm run check` exit0:5808passed/73existing skips/0failed; both typechecks0. Ordinary5137 and resource671; inventory391=369+22, workers4/2 unchanged. Existing64-test Blueprint lifecycle suite passed, including failure receipt replay. This single green run does not close the unrelated resource-phase timing P1.

Local log raw SHA-256:

- red.log: e63aae063f7e52e7517483d290233a93caf6a87a362a519d527a2feb0709ff4a
- focused-final.log: c8679410e9b4ca986b4616cf8cd96372203391005fcc1b3500d94b3fb8efe375
- full-check.log: 80a86230265b6643bea31928d3d653ccdb9eb453ab7f939f8db7d8bf5efdf653

Logs and complete handoff: `outputs/qa-blueprint-provider-diagnostic-20260909/`. Ignored/untracked, local only; no verified off-machine backup. This tracked summary does not preserve original logs. Prior real run45-file inventory verified unchanged. Protected P1:14files/412516bytes, inventorycd621f7712912a92d14fa87432c609c5e92a006363e7eed7be5231a856e8fdd0. Prior failed receipt raw SHA b3aa6619d1b03ae48f60d67f06d4fc6277362f85e038dccf757c66bf8efed46d unchanged.

Reproduce focused validation:

```powershell
Set-Location 'C:/GNart/Work/sh-r3b1b-semantic-m1'
npx --no-install vitest run lib/visual-package/__tests__/openai-responses-blueprint-authoring-adapter.spec.ts lib/visual-package/__tests__/provider-failure-diagnostics.spec.ts lib/visual-package/__tests__/openai-responses-blueprint-authoring-count-adapter.spec.ts
npm run check
```

Before handoff: active worktree contains only this milestone; relevant branch/worktree inventory rechecked, protected dependencies clean at the same hashes. Focused local commit is not automatically pushed. Earlier runtime bridge is historical after HEAD movement. No billing claim, original-error reconstruction, paid retry, ready Blueprint/book or independent PASS follows from this logging fix.

## Review received and required next-attempt capture — 2026-09-10

Claude supplied code PASS P0=0/P1=0/P2=1 for exactly `f4cf3f0500f7a2b9c7660ff4001605fd1d52e24f..38f07659d1a78b10351c902fd6a66fb4f9c7b727`, independently reproducing focused99/99, full5808passed/73existing skips/0failed and both typechecks. The preceding implementation/handoff statements describe that earlier milestone; the code PASS now ends at38f07659, not this documentation correction.

P2-1 is accepted: the previous retained execution log captured stdout only. The next legitimate, separately reviewed billable Blueprint attempt MUST capture stderr as well. The initial native-shell redirection prescription was rejected in Claude's review of38f07659..1fad4583 (PASS0/0/1, P2 carried forward): Windows PowerShell5.1 can decorate stderr as ErrorRecords, and under ErrorActionPreference Stop can lose both logs and the real exit code. Do not use native `1> ... 2> ...` or merged `2>&1` for this recovery runbook.

Use process-level redirection instead, on Windows PowerShell5.1 or PowerShell7. The following is a capture pattern, NOT an executable recovery authorization. The reviewed runbook must supply the absolute Node executable, working directory, correctly Windows-quoted argument string, and distinct new absolute stdout/stderr paths under that attempt's evidence directory. Start-Process joins argument arrays with spaces; do not assume an array preserves quoting. Validate the exact arguments offline, including paths containing spaces, without changing the approved program or exposing credentials.

```powershell
$process = Start-Process -FilePath $nodeExe -ArgumentList $approvedArgumentLine -WorkingDirectory $runDirectory -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -WindowStyle Hidden -Wait -PassThru -ErrorAction Stop
$exitCode = $process.ExitCode
```

Use the returned process ExitCode, not LASTEXITCODE. If process launch/wait throws, record a capture/launch failure without inventing a child exit code or automatically retrying; investigate any claim/dispatch before recovery. Never overwrite prior attempt logs. Keep stdout separate and parseable; stderr can contain multiple diagnostic lines, so parse relevant events per line rather than assuming the entire stderr file is one JSON document.

Capture is part of the next recovery runbook, not permission to run the old command again. Pre-create the evidence directory and verify the new log paths are writable; retain both logs, the recorded exit code and their SHA-256 hashes whether execution succeeds or fails. Inspect stderr AND the structured terminal receipt: process exit0 alone does not establish Blueprint success. The sanitized log remains supplemental, best effort and non-authoritative; do not dump environment variables, raw SDK errors or credentials to augment it. Evidence under outputs remains ignored/local-only with no verified off-machine backup.

No live attempt, credential read, receipt mutation or code change was needed for this correction. The consumed execution identity remains consumed; a valid recovery plan plus review is still required. Original API cause and actual charge remain unknown. Independent closure of this documentation P2 is not claimed.

Codex synthetic verification of the replacement pattern: Windows PowerShell5.1.26100.9444 and PowerShell7.6.5, each with Continue/Stop and child exit0/1: eight cases passed. Both logs parsed as clean JSON, long stderr text remained intact, and a script path plus argument containing spaces survived. All eight stdout files share SHA256 d3e04efa74bfd8969d4af276de5f6aca508b0b2586cc165d1ce7d1359c8fd692; stderr cf4bc100f71dcb9bad46e944a3fbfe4233e7cf5fa692106fee2c6bf3a148a210. This verifies capture only, not provider recovery. Local ignored probes: outputs/qa-blueprint-provider-diagnostic-20260909/verify-process-capture.ps1 and capture probe.cjs; result roots capture-5a650a162732491d9029b70b102ba2c0 (5.1) and capture-292a5a5d219043de89ecc1104be20151 (7.6). No external backup verified.
