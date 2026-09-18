# Companion presence P2 / readiness expectation correction — 2026-09-18

## Decision and scope (before implementation)

Same task, sole Codex writer, `C:/GNart/Work/sh-r3b1b-semantic-m1`, branch
`codex/r3b1b-semantic-recovery-m1`. Clean base3ae68d6019add4b1a18149c4453db2ac7f7f8c65,
ahead4/behind0. Protected dependencies768ccb2f/63ccb484 clean/read-only.
Claude supplied PASS0/0/1 for3fb03452..3ae68d60, not product acceptance. Standing
implementation authority covers this bounded follow-up; no new creative decision.

Confirmed: sole production caller is safe, exported helper accepts detached raw
hash/story/page-count arguments. Harden that interface to require the full source
snapshot, validate it inside the helper, and derive all three values there. Reject
missing accepted authority explicitly. Current consumers still reload disk authority;
in-memory snapshot integrity is not cryptographic proof of owner acceptance.
Do not add a nominal TypeScript brand as a substitute for runtime validation.

Also correct the CLI test's narration readiness expectation2->3: its sibling and
the actual report already include accepted Panda. Keep all-story gate exit1 and
18-slot/render qualification checks. No runtime readiness or timeout change.

Risk: an extra validation call/import must not alter old/v2 packets or provider-free
behavior. Tests must preserve all prior cases and exact artifact digests. Full check
runs only AFTER focused tests finish. Rollback: revert this focused local commit;
original artifacts are never edited. No provider/key/image/audio cost; no push.
No new owner eyeball/Cowork needed. Next QA should attack detached hash injection,
stale/missing authority, direct helper calls and snapshot/consumer provenance limits.
All cast/moment/cover/staging/custody/capacity HOLDs remain; do not render.

## Implementation and observed validation

Helper signature now requires `{rawJson, snapshot, pageNumber}`. It validates the
snapshot itself, requires accepted revision authority, derives SHA/storyKey/pageCount
from that snapshot and then checks exact bytes and typed presence. The caller no
longer supplies detached authority fields and its non-null assertion is removed.
No assertion that an in-memory hash authenticates acceptance: disk rebinding and
historical candidate binding remain required at the lifecycle consumers.

36 presence tests (prior32 retained,4 added), including direct helper stale/missing/
poisoned snapshot and detached hash misuse. The obsolete hash-only API also has a
`@ts-expect-error` regression checked by tsc. Thirteen defense-in-depth cases use
explicitly synthetic integrity-consistent snapshots; these are NOT disk acceptance.
They still reach not_present/coverage_mismatch, rather than merely failing hash.

Focused7 specs280/280 exit0 (36+27+32+131+18+29+7). Actual offline witness exit0,
plan9dad12a8/correction6e2db082/effective dc9ee910 unchanged, six original artifacts
preserve hashes/bytes/mtime. No source, fixture, original evidence or approval edit.

The first full-check invocation stopped at tsc before Vitest: TS18047 on nullable
authority narrowing. Added explicit `return fail(...)`, not a non-null assertion.
Standalone tsc then exit0; final-code presence spec36/36 exit0. Full check restarted
only after focused tests had finished. No timeout or worker policy changes.
Final full-check observation is recorded below and in REGATE-full-check-summary.json.

Final `npm run check` native exit0: both typechecks0; ordinary389 files372 passed/
17 skipped, tests5729 passed/73 skipped; resource22 files22 passed, tests671 passed.
Total6400 passed,0 failed,73 skipped. Resource isolation test that previously timed
out passed in3057ms with its unchanged5000ms threshold. No focused/full overlap.
Prior red run and original full-check-summary.json remain untouched. This single
green observation does not prove causality for the timeout or close long-term
stability. `git diff --check` clean. Independent re-gate still required.

## Review-only QA request

Base3ae68d6019add4b1a18149c4453db2ac7f7f8c65 to the single following commit,
immutable head supplied with the handoff message. Claude: do not expand your
3fb03452..3ae68d60 PASS implicitly. Try direct helper stale/poisoned authority,
caller-supplied fake hash overrides, missing accepted authority with a resealed
snapshot, old API compile acceptance, and source/identity conflicts. Confirm all
three correction digests and v1 packet unchanged, and actual CLI still exits1 for
the incomplete18-story narration matrix while reporting3 ready. Confirm no semantic
or image approval was inferred. No independent PASS is self-awarded here.

## Copy-ready PowerShell

```powershell
Set-Location 'C:\GNart\Work\sh-r3b1b-semantic-m1'
git status --short --branch
git log -1 --format=fuller
git diff --stat 3ae68d6019add4b1a18149c4453db2ac7f7f8c65 HEAD
git diff --check 3ae68d6019add4b1a18149c4453db2ac7f7f8c65 HEAD
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { throw 'Typecheck failed' }
npx vitest run lib/visual-package/__tests__/semantic-companion-presence.spec.ts lib/visual-package/__tests__/semantic-correction.spec.ts lib/visual-package/__tests__/semantic-correction-consumer.spec.ts lib/visual-package/__tests__/semantic-correction-approval-bridge.spec.ts lib/visual-package/__tests__/accepted-supporting-cast-review.spec.ts lib/__tests__/supporting-cast-review.spec.ts lib/visual-package/__tests__/wizard-all-story-readiness-cli.spec.ts --maxWorkers=1
if ($LASTEXITCODE -ne 0) { throw 'Focused tests failed' }
node --import tsx --require ./scripts/shims/register-server-only.cjs story-pipeline/06_editorial_refresh/2026-09-16/book-proof/companion-presence/verify.cjs
if ($LASTEXITCODE -ne 0) { throw 'Offline witness failed' }
# Optional, ONLY after Guy explicitly instructs push:
# git push origin codex/r3b1b-semantic-recovery-m1
```

Original ignored outputs remain local-only with no verified off-machine backup.
This correction performs no push, key/provider call, image, narration or spend.
Any green full run is one observation, not permanent stability or launch readiness.
