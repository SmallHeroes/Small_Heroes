# R1D Book Surface v8 — Compiler-Owned Action Identity Restoration Implementation Evidence

**Date:** 2026-08-18
**Branch:** `codex/r1d-book-surface-typed-hint-compaction-render-unblock`
**Base:** `371a7bdcea15491d412e75a1b3323fe41b11294f`

## Observed blocker

The sole v7 attempt ended fail-closed with no Candidate. Its receipt v37 records three completed calls, two repairs, zero transport retries/fallback and exact Book Surface output identity `book_surface_repair_action_binding_changed`. The response reached the existing atomic application boundary; it was not a transport, provider-status, lifecycle-context or admission failure.

## Implemented correction

`applyBookSurfaceRepairPatch` now parses the strict v6 output and then restores compiler-owned action identity on a clone before running the unchanged application guards:

- only pages whose exact writable fields contain `actionRequirements` are considered;
- action slots remain index-addressed and cardinality must still match the current binding authority;
- every returned `beatId` is replaced by the exact ordered authority binding;
- an existing valid `source_phenomenon` subject is replaced by its exact compiler-owned Source Evidence subject;
- malformed/count-mismatched records are left for the existing closed validator to reject;
- provider semantics remain writable, while `actionSemanticCoverage` remains private and immutable;
- atomic mask/application and full compiler revalidation are unchanged.

Book Surface schema remains `book-surface-repair-schema/v6`. System/user prompts advance to v8. Current authoring request/receipt/readiness advance to v34/v38/v36; B0 input/manifest/verification to v23/v32/v32; execution materialization input/result to v22/v26; Supervisor request/readiness/result to v31/v31/v24; Fresh Readiness to v31. Immediate authoring predecessors v33/v37/v35 are registered immutable legacy authority. Policy v12, budget v2, Candidate v9, model/tier/reasoning, caps `[40000,32000,36000]`, retry/fallback and hard `$5` fence are unchanged.

## Validation evidence

- Core: 3 files / **157 tests PASS**.
- The new lifecycle proof returns a forged provider beat during a real Book Surface semantic repair, completes in two calls/one repair, restores the original coverage binding, fully revalidates and persists a Candidate.
- Downstream canonical authority chain: 6 files / **327 assertions PASS**. Vitest reported one known post-assertion `onTaskUpdate` RPC timeout after all files and assertions completed; no assertion, code or process-under-test failed.
- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.
- The literal repository `npm run check` was not repeated. It was already run exactly once for the enclosing causal milestone; its only ordinary failures were the five established missing ignored-output fixture assertions, and resource assertions passed apart from the separately proven runner timeout behavior.

## Execution exclusions

During this implementation: credential access none; provider/network calls zero; Fresh/preflight/live calls zero; image/render calls zero; storage/database/deployment/payment changes none.

This evidence is implementation evidence only. It does not self-award independent technical PASS, Candidate authority, render authority, product acceptance or release readiness.

## Independent QA closeout

Claude Code independently reviewed immutable range
`371a7bdcea15491d412e75a1b3323fe41b11294f..1957999b03f7a7e474e43eee136dfca2f9220fff`
in read-only plan mode and returned **PASS with 0 BLOCKER / 0 MAJOR / 0 MINOR**.
It explicitly traced clone/reference semantics, ordered binding construction,
hostile beat and Source Evidence injection, null/count/duplicate behavior,
provider semantic writability, coverage immutability, atomic rejection, full
revalidation and the complete version chain. It ran no commands because its
plan-mode environment gated execution; the recorded test counts therefore
remain Codex execution evidence, while Claude's verdict is independent static
control-flow review. Its only advisory was the already-disclosed absence of a
second literal `npm run check` run.

The technical gate now permits a brand-new Fresh package and at most one
bounded live authoring attempt. This PASS alone does not create Candidate,
render, deployment, production, release or product-acceptance authority.
