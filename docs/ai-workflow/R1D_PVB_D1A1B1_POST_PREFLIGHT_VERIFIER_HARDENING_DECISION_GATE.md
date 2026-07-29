# R1D-PVB-D1A1B1 post-preflight verifier hardening Decision Gate

**Decision owner:** Guy
**Technical owner / implementer:** Codex
**Independent QA:** Claude Code, first pass read-only
**Decision date:** 2026-07-29
**Approved start:** `36f88f62c69b86237f7af322a0660ab37f09723f`
**Worktree:** `C:\Users\guyna\.codex\worktrees\2ad5\Small_Heroes`
**Branch:** `codex/r1d-pvb-d1a1b1-attempt-3`
**Cost authority:** `$0.00`

## Problem and root cause

Attempt 3 correctly stopped after its one canonical preflight because the mandatory post-preflight verifier failed before artifact evaluation. The verification method used a tsx eval string and expected a named module export through that loader shape. That import behavior was not a repository-owned executable contract. The canonical materializer already owned artifact schemas, payload-domain digests, Story Source reconstruction, and the future live command, but no supported read-only CLI re-read and reconciled the resulting four-artifact bundle.

This is a verification-boundary defect, not evidence that the approved B0 artifacts are stale. Attempt 3 remains exhausted; correcting the boundary does not authorize retrying it.

## Expected behavior

A deterministic repository command accepts only the exact repository root and one materialization manifest. It derives every other path and identity from the validated manifest, re-reads all four canonical artifacts, rebuilds current Story Source authority, validates exact live policy/cost/command authority, and emits one sanitized versioned result. It performs no writes and cannot reach credentials, pricing, network, provider, render, database, storage, or downstream production surfaces.

## Approved decisions

1. Add canonical command `source-authoring-live-request-verify` to the production visual lifecycle CLI seam.
2. Public arguments are only `--repo-root` and `--manifest`; every referenced artifact is derived from the manifest.
3. Do not use eval, ad-hoc PowerShell, dynamic command construction, or a private entrypoint.
4. Implement a general read-only library verifier for schemas, canonical bytes, canonical payload-domain digests, containment, manifest linkage, and cross-artifact identities.
5. Rebuild Story Source through the existing canonical builder. Source snapshot and live request identities are portable; source-authority request and manifest identities are intentionally worktree-bound.
6. Validate exact live request/provider policy, call/repair/retry/fallback fence, reservation no greater than `$4.884`, hard ceiling exactly `$5.00`, and exact future live command. Do not perform a pricing lookup.
7. Emit `canonical-live-request-verification/v1`, `verified`, `zeroWrite: true`, bounded safe identities, and no credential/provider-reachability claim. Failure emits stable bounded reason codes and exits nonzero without raw secret, environment, provider, path-escape, or stack leakage.
8. Fail closed on unknown, duplicate, equals-form, positional, missing, wrong-mode, and path-escape inputs. Preserve existing real-path, symlink/junction, and content-address collision safety semantics.
9. Validate the real script file through exact local tsx plus the repository server-only shim with credential, provider, network, and write sentinels and positive controls. Cover success and all approved corruption/staleness/linkage/policy/path failure classes.

## Scope

- `lib/visual-package/liveRequestMaterialization.ts` and its existing public barrel export.
- `scripts/production-visual-lifecycle.ts`.
- Focused verifier/materialization tests and test-only sentinels.
- `CURRENT.md` and checked-in Decision Gate/execution evidence.

No source schema, package, lockfile, provider adapter, live launcher, Story Source, pricing authority, request budget, evidence brand, or production behavior outside the verification seam may change.

## Validation contract

1. Deterministic local TypeScript.
2. Focused materializer/verifier tests, including the exact real subprocess and all sentinel positive controls.
3. Only after focused PASS, literal `npm run check` exactly once.
4. The full-run success criterion is TypeScript PASS and no timeout/new failure beyond the established six ignored-output fixture failures in five known files. No missing fixture may be copied, fabricated, or imported, and the full suite may not be rerun.
5. Remove only exact current-run ignored synthetic artifacts and preserve historical Attempt-3 B0/dependency evidence.
6. Stage explicit pathspecs, create focused local commits, leave clean and unpushed, and hand the immutable range to Claude Code read-only.

## Risks and mitigations

- **Schema duplication:** Reuse the existing validators and canonical builders, then compare exact rebuilt canonical values rather than introducing a second request or Story Source policy.
- **Filesystem alias/escape:** Reuse canonical real-path containment and reject lexical/real aliases before artifact reads.
- **Sanitization:** Convert internal failures only to fixed bounded codes; never emit caught messages.
- **False zero-write claim:** Exercise the real subprocess under a write sentinel and compare the entire synthetic repository tree before/after.
- **Story-specific drift:** Use general synthetic stories in tests and prohibit selected-story literals in shared code.
- **Accidental Attempt-3 retry:** Do not run canonical preflight or the new verifier against the preserved Attempt-3 bundle in this milestone.

## Rejected alternatives

- Fixing or changing the eval import form.
- A PowerShell-only or hand-built JSON verifier.
- Exporting and calling a private live-runner decoder.
- Accepting artifact paths as public flags.
- Whole-file hashes as payload authority.
- Loading credentials or checking provider reachability as part of verification.
- Repairing/copying absent full-suite fixtures or rerunning the complete suite.

## Stop check

- Product decision owner approval: **explicit for all nine decisions**.
- General system solution: **yes**; no selected-story special case.
- External/cost authority: **none; `$0.00`**.
- Exact exclusions understood: **yes**.
- Open product decisions: **none for this corrective milestone**.
- Attempt-3 retry authority: **none**.

Implementation may proceed only within this gate. Completion remains pending independent Claude Code review and Lead Task re-gate; Codex cannot self-award independent technical PASS.
