# Claude Code handoff — Opus cumulative usage scope (milestone A)

Read-only first pass; no provider/key/network/spend/push/deploy. Guy approved
the two free milestones in PERSONAL_TEXT_PATH_SIMPLIFICATION_DECISION_20261004.md.
Worktree: C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes.
Branch: codex/personal-book-storyboard-bridge. Base b9995108; the focused local
successor is the commit containing this file (freeze its SHA before reviewing).
B will be a separate successor; do not widen this review to it or earlier work.

Original requirement: remove unnecessary complexity without losing meaningful
story QA; stop repeated paid failures and fix the observed transport error first.
Trial05 CLI native 0 returned a schema-valid plan, cumulative 22785 outputs and
USD .617876; our adapter compared that to an 18000 per-request setting and failed.
Those sealed records are preserved; they are not accepted or resumable books.

Implementation: only the Opus aggregate output comparison is removed. Input and
output usage still must be safe nonnegative integers; CLI USD must convert to
known finite safe microUSD. Native termination, sole reported model, schema,
UTF8, bytes, environment, abort, timeout and no-retry guards remain. Receipt
reports cli_cumulative separately from configured_per_request_not_cli_aggregate.
No inferred internal request count or actual per-request compliance claim.
Host and coordinator still enforce unchanged slot USD allowances. Astra's single
Responses output limit is unchanged. CLI estimate is not an invoice guarantee.

Changed runtime: scripts/personal-causal-trial-adapters.ts only.
Specs: lib/__tests__/personal-causal-trial-native.spec.ts and
lib/__tests__/personal-causal-trial-host.spec.ts. Other changes are Markdown.

Validation:

```powershell
Set-Location 'C:\Users\guyna\.codex\worktrees\personal-story-product\Small_Heroes'
npx tsc --noEmit
npx vitest run lib/__tests__/personal-causal-trial-native.spec.ts lib/__tests__/personal-causal-trial-host.spec.ts
git diff --check
```

Type check 0; focused 157/157 (80 native + 77 host). Four cumulative positive
tests fail with the old comparison temporarily restored, pass after restoration.
Invalid token/cost matrices reject with receipts. Host equality passes; cap+1
fails cost, seals, preserves exact receipt and suppresses second case/replay.
The initial two fixture errors were repaired before final focused validation.
Full check began on A; ordinary 11 failed/6089 passed/73 skipped, extra EEXIST
in unchanged story-commission-materializer source beyond ten known missing
artifact failures. Resource was pending when this handoff was written; see the
later CURRENT entry for final observation. Do not infer full GREEN.

Falsify: (1) unchanged child cap in all four Opus stages, not only author;
(2) above-request aggregate under USD accepted without relaxing malformed usage;
(3) exact monetary boundary reaches host cost check, not another rejection;
(4) durable failed receipt/no subsequent dispatch; (5) Astra still rejects cap+1;
(6) no cap, retry, key, model, production wizard or historical evidence mutation.

70 files/20 historical roots match SHA/size baselines, independently recomputed
by an engineering subagent, not Claude QA. No verified backup claimed. Root is
sole writer; protected/site worktrees unchanged. This is not a literary, product,
release or independent technical PASS. B and any new paid run require their own
gate. Push not requested; stage explicit paths, never git add -A.
