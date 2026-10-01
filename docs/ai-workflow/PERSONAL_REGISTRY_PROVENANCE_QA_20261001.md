# Registry provenance invariant and received QA

## Receipt / scope

Read the complete independent report:
`C:/Users/guyna/AppData/Local/Temp/claude/C--GNart-Work-Small-Heroes/af9211ff-30ea-426d-9794-43cad9ee3788/scratchpad/qa-registry/CLAUDE-QA-REGISTRY-719dcb7f.md`,
SHA256 `e85e6d53def7fef6cd03395f711a4ab447c55555d0a212df58a10ffa74340d4b`.
Attachment SHA256 `9daadf4b27c6e63e0f520aa82a504f89482aa330f028aadc7cfc810662830a4a`.
Received PASS EXACTLY `9adf6555..719dcb7f`, P0/P1/P2 = 0, P3-D non-blocking.
Received 456/456, 14 admission probes, 9/12 mutations caught, full check RED:
ten ordinary failures/5470 passes/73 skips, resource 635/635 with three RPC errors.
These are received results, not new Codex reruns or literary/product acceptance.

## Bounded correction

Same chat/sole Codex writer, `codex/personal-book-storyboard-bridge`,
`C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes`, base
`719dcb7ffca5ccff38e6d8fd844b5a381d621acf`, clean/no upstream/13 not remotely
reachable before correction. Reviewer now detached clean at that exact base.
Protected d53b `768ccb2f`, accepted-intent `63ccb484` clean/parity; site
`86ca47e8` clean/ahead 2. Advisers read-only at the frozen base; root sole writer.

Root cause: exact admission puts trust in the committed synthetic registry; its
tests asserted shape/diversity, not source provenance. Expected: a test fails if
any core/fact/place source becomes typed/transcript or a topic records transcript.
Only a regression invariant is added. Registry/schema/runtime admission unchanged.
No second source authority, redaction, fixture relabelling or origin attestation.
Rollback: revert the test-only successor; no migration or old-output change.
Stop-check: no prompt, production flow, money, QA threshold, UI or image change.

Codex's historical 13 admission-mutation failures were the targeted filter
`rejects an unregistered|registry-invalid`. Claude's full-spec mutation includes
six additional typed-source cases, giving 19. The earlier handoff now names the
filter explicitly, without changing old test results or historical artifacts.

## Validation / handoff

Two focused files **94/94** (planning 46, comparison 48), native 0; tsc native 0.
Representative G1 mutation changes only first registry nameSource to typed:
new invariant fails, 1 failed/47 skipped, native 1. Registry restored byte-identical
and final focused rerun passed 94/94. No registry relabelling ships.
No full check repeated for this test-only invariant; previous gate remains RED,
no fresh baseline or stability closure. No provider/key value/paid allowance reset,
images/audio, deployment or push; $0. Earlier bridge still unreviewed.

Claude: first review read-only of the ONE successor supplied by Codex above this
base. Try relabelling registry name/age/address/residence/fact/place and adding a
transcript-suggested topic. Verify the new invariant catches these while leaving
normal registered profiles and all packaging tests unchanged. Confirm production
and registry bytes unchanged. No self-PASS or expansion of earlier verdicts.

```powershell
Set-Location 'C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes'
git status --short --branch
git diff --stat 719dcb7f..HEAD
git diff --check 719dcb7f..HEAD
npx vitest run lib/personal-wizard/__tests__/story-comparison.spec.ts lib/personal-wizard/__tests__/story-planning.spec.ts --reporter=dot
npx tsc --noEmit
# Only after Guy's separate push decision and earlier-history gate audit:
# git push -u origin codex/personal-book-storyboard-bridge
```

Next substantive milestone: preserve valid planner HOLD evidence/classification/UI
before a trial evaluating held outlines; it is not implemented by this correction.
