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
