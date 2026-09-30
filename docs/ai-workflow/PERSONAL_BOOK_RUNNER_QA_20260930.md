# Personal book automatic runner: Claude Code independent QA

## Product requirement and boundary

Guy asked Codex to implement the book engine while Claude separately edits the
site, then return a completed technical milestone for independent review. Parent
approved details, edits/removals, chosen companion and length must feed a whole
story, then a whole-book storyboard with explicit continuity, before page packets.
Camera, expressions and composition must remain variable, not physical identity.

Branch `codex/personal-book-storyboard-bridge`, worktree
`C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes`. Successor base
`07d3c8d352ceb813b7135fd72276d6cc7d0f9dc9`. The exact successor HEAD is supplied in
the post-commit copy-ready handoff; freeze that SHA, not a moving branch.

The preceding bridge `45b9e754..07d3c8d3` still needs independent QA. This successor
does not silently close it or the base writer's review. Review these as distinct
milestones, or explicitly state the combined range if reviewing both. No Codex
self-PASS. First Claude pass is read-only; no key/provider/render/push authority.

## Implementation claims to falsify

1. `generatePersonalBook`: narrative plan -> final manuscript -> full visual draft
   -> distinct semantic review, at most four generate() invocations, no retry,
   fallback, repair or image dispatch. The final ending/all prose reach planning;
   full storyboard/all prose reach review. This is not per-page authoring.
2. One outer process ledger reserves all four calls and holds the user lock before
   provider construction. Reuse the existing writer with a subordinate ledger,
   not a second charge. Duplicate, busy, job/budget cap and cancellation block
   key/provider access at the real HTTP consumer. Failed reservations remain spent
   in this ledger, including credential-unavailable jobs. Restart resets it.
3. Default-off `/api/dev/personal-wizard/book`: development + loopback URL/real Host,
   exact POST Origin, actual authenticated allowlisted operator, request/body
   validation. Reuse one shared access guard; old `/story` flags/rate namespace
   and response behavior remain unchanged. GET reports configuration, not live
   availability, and reads no key. No UI calls this new endpoint yet.
4. SDK author/reviewer output uses ordered complete arrays and fixed review groups.
   Engine supplies page numbers, category names and source/report bindings, without
   rewriting model content. Schema mismatch/incomplete/malformed response stops.
   Adapter has `maxRetries:0`, `store:false`, token/input bounds, abort signal and
   explicit configured model; no default fallback. No live SDK validation was run.
5. Semantic prompt explicitly tests approved facts, age/Hebrew/humor, agency,
   companion want/care, optional coping, causality/reveal timing and source
   entailment. Matching unrelated quotations are not permission to move state.
   This is a separate call using the same configured model, NOT independent
   Claude QA, a human-equivalent accuracy claim or creative acceptance.
6. Uncertain/contradictory reports preserve issues and return no frame packets.
   Supported reports produce cover + all-spread packets through the prior bridge,
   binding current request/result/options and one identical render/QA context.
   Every result is `runtimeEligible:false`, even model-supported diagnostics.
7. Source rechecks before/after each call detect mutation of the supplied request
   or options. Browser edits after submitting a separate HTTP request are NOT
   magically visible to the server: a future UI consumer must cancel/invalidate
   by current revision. No UI end-to-end edit/run behavior is claimed here.
8. Accounting separates full reservation, generate() attempts, known usage subtotal
   and complete token estimate (null if any usage is unknown). Known usage overrun
   stops subsequent stages even when earlier usage is missing. Captured failed
   response usage remains counted; raw errors/biography are not telemetry. These
   estimates use existing rate cards, not invoices/fresh price verification.
9. A noncooperating provider cannot hold the runner indefinitely: 180s deadline per
   stage, abort race, lock release, no later stage or late-result mutation. This
   does NOT prove a cancelled remote request cost zero; unresolved usage stays
   unknown. Maximum chain is four stage deadlines, not one 180s whole-job limit.

## Files, compatibility and test changes

- New book config/runner/OpenAI adapter and real local operator route.
- Shared access guard extraction; existing manuscript route source unchanged.
- New runner (45) and real-handler (28) tests. Prior storyboard fixture moved
  byte-identically into a non-spec helper; its 60 existing assertions retained.
- Spec inventory 391 -> 393, ordinary 371 -> 373, resource still 20.
- Boundary test explicitly allows the third isolated server adapter, still checks
  server-only/no retry/no storage, and adds new modules to forbidden client imports.
  First broad run caught this stale allowlist (461 passed/1 failed); it was fixed,
  not labelled inherited. No test timeout, worker or resource policy changed.
- CURRENT/ROADMAP, Decision Gate and tracked verification summary.

Public site, wizard UI, recording/transcription, accepted story bank, writer
implementation/result, donor compiler modules, image providers/thresholds (0.70),
anchors, narration, orders/payments and database schema are unchanged by successor.
Claude's concurrent landing branch/worktree is not merged or edited.

## Reproduce and evidence

```powershell
Set-Location 'C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes'
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run lib/personal-wizard lib/__tests__/local-book-sequence.spec.ts lib/__tests__/local-preview-quality.spec.ts lib/__tests__/vitest-workload-classifier.spec.ts lib/__tests__/style01-prompt-assembly-child-presence.spec.ts lib/__tests__/style01-child-expression-style-fidelity.spec.ts --maxWorkers 1
npm run check
```

Final tsc native 0; focused **462/462 in 21 files**, native 0. Full check native 1:
ordinary 373 files, 10 failed/5194 passed/73 skipped; resource 20 files, 635/635
passed but three unhandled onTaskUpdate RPC timeouts, native 1. Gate RED. Sorted
failure names match the preceding recorded gate; no untouched-base reproduction
proves causal independence. Final code hashes unchanged during checks; prior
bridge raw logs preserved; extracted fixture/prior assertions byte-identical
after EOL normalization. Final results and exact raw log identities are in
`PERSONAL_BOOK_RUNNER_VERIFICATION_20260930.json` and the post-commit handoff.
Do not infer stability from a focused green set or partial full-check output.

Raw evidence `outputs/personal-book-runner-20260930/` includes initial and final
logs with distinct filenames and native child exits, plus the recorder. It is
ignored/untracked, retained only on this machine with no verified off-machine
backup; a push does not preserve it. Earlier bridge evidence root was not edited.
Tests use synthetic data and mocked SDK/providers, including actual route handler
invocation and real SDK adapter payload assembly. No dev server/browser run,
real auth/database, key load, provider call, rendering or audio in this milestone.
Cost $0. Runtime packets are diagnostic data, not a delivered book.

## Recommended adversarial targets / remaining work

Try actual unauthorized/malformed/duplicate/budget-refused POSTs and inspect key
read/factory counters. Poison a state transition with unrelated prose, mutate the
request during each stage, alter review bindings/coverage, omit usage then exceed
the reserve, cancel a hung SDK call, and resolve it late. Check old manuscript
route tests and prove previous fixture/assertions did not weaken. Check all four
SDK payloads, not only fake adapter returns. Verify private sentinels stay absent
from responses and telemetry; verify frame content, not just equal hashes.

Still required: independent technical QA; real bounded text run/creative review;
client wiring/revision invalidation; durable jobs/evidence/recovery and cross-instance
or cross-endpoint budget authority; qualified reference/image QA sequence; narration
and deliverable packaging; Guy's product acceptance and release qualification.
No public enablement, renderer cutover or deployment approval follows from this.
