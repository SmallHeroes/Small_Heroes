# Claude Code: test-premise correction, independent review requested

Read-only first pass. Worktree C:/GNart/Work/sh-r3b1b-semantic-m1,
branch codex/r3b1b-semantic-recovery-m1. Base
08eb84b27dbc7769e52c76f54619746dad7d23f5; review the single child commit with
subject `test: repair inventory and model namespace assertions`. Resolve its
immutable hash before review; later editorial-data commits are outside this range.
No branch push, credential access, provider call, source edit or render requested.

Requirement: unblock actual book work by diagnosing general failures, not waiving
tests. Two assertions failed both full and isolated on the untouched base specs:
fixed393 vs discovered410 specs, and truncated claude-4 from the existing
Replicate anthropic/claude-4.5-sonnet registry entry. Real caller is
scripts/lib/visual-qa-comparison.ts, api.replicate.com, unchanged.

Changed executable files: ONLY lib/__tests__/vitest-workload-classifier.spec.ts
and lib/__tests__/anthropic-model-authority.spec.ts. Plus CURRENT, decision, this
handoff and the captured supervisor summary. No production or config changes.
The inventory gate checks exact discovered coverage, explicit22 resources,
all prior named inclusion/negative checks and a new arbitrary ordinary spec.
Model tokens preserve namespace/dots. One exact existing registry path/ID is
allowed, version pinned; no blanket namespace exception or first-party change.

Validation: before7pass/2fail; after11/11 focused. tsc exit0. Full npm run check
exit0, both typechecks pass, ordinary5671pass/73skip, resource671pass, total
6342pass/73skip across410 files. Ordinary135789ms, resource250715ms. Supervisor
summary captured verbatim as parsed JSON; not a full log. A second explicit
tsc --noEmit also exit0. No claim of repeated/load-invariant stability.

Attack: remove an ordinary target, duplicate/overlap targets, add an unlisted
ordinary spec, alter a resource manifest entry, inject unknown/retired IDs,
bare dotted IDs, nested/other namespaces, move allowed ID outside registry,
or change pinned version. Confirm no scanning directory is newly excluded.
Inspect diff for lost assertions rather than treating green tests as proof.

Protected d53b768ccb2f and wave2 63ccb484 remain read-only and clean. Separate
editorial work's untracked artifacts existed during this check; they contain
no test/runtime code and are excluded from this commit. Test inputs were not
edited during the full run. No independent self-PASS, product acceptance,
source promotion or release readiness. Prior intake PASS ends bfbf5473 only.

After review, optional owner-authorized propagation (not run by Codex):

```powershell
Set-Location C:\GNart\Work\sh-r3b1b-semantic-m1
git status --short --branch
git log -3 --oneline
git diff --check
# Push carries the whole accumulated ahead branch, not just this reviewed range.
git push origin codex/r3b1b-semantic-recovery-m1
```
