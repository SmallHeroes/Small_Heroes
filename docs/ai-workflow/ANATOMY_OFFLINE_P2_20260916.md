# Offline anatomy P2 corrective gate

Scope: continuation of approved offline milestone and validated independent findings.
Base 01f092eabf3988694c3195907ba0b6882867d5c1, semantic-m1 branch/worktree,
clean/ahead32 at intake. Same task sole writer; protected dependencies unchanged.
Claude's supplied PASS0/0/4 covers 7952ab1e..01f092ea ONLY; this correction has
no independent PASS yet. Existing five active judge files remain unchanged.

Decision / stop-check: general offline rule correction, no active QA integration,
provider calls, key access, renders, media edits, deployment or push. Smallest
proof: reproduce exact versus 1e-7 offset behavior, add boundary/overlap tests,
rerun adjacent suites and tsc, preserve archive replay. No new product choice or
visual acceptance is inferred. Revert this focused commit for rollback, preserving
receipts; no old evidence migrated. Same explicit false authority flags remain.

## Four findings and planned corrections

1. Near-duplicate endpoints: reproduced exact -> hold versus 1e-7 -> count defect.
   Offline-v2 uses either <=1e-6 normalized-edge difference OR IoU >=0.9 to mark
   ambiguity and suppress derived count defects for that subject/endpoint kind.
   These are provisional research ambiguity tolerances, NOT calibrated vision
   thresholds or the product resemblance threshold. Below thresholds can still
   contain duplicates. No merging into PASS; uncertainty always holds.
2. Consumer contract: disposition is scheduling/hold status, NOT the inventory of
   known problems. Consumers must always inspect/preserve defects, including while
   held_uncertain; never dispatch repairs from either field in this offline policy.
3. Box semantics: policy-local strict schema/validation snapshot, versioned with
   offline-v2. Remove new->legacy experiment dependency without modifying the old
   experiment or introducing a migration of active consumers. Small intentional
   duplication isolates experimental semantics, not a shared generic abstraction.
4. Omission: coverage=complete is a reported claim. A model omitting a real third
   hand can yield observed_pass. Add explicit limitation/test; no claim to fix it.

Known limits: hallucinated connections, omitted parts, false subject ownership and
near duplicates below tolerance remain possible. All tests use synthetic evidence,
not new labeled images. Larger overlap can mean two genuinely distinct nearby
hands; hold is intentional until a future pixel-based experiment resolves it.
Model, prompts, existing Flex adapter, 0.70 resemblance and active gates unchanged.

## Validation and re-gate

148/148 focused tests: policy45, legacy anatomy27, judge16, quality28, checkpoints32.
tsc exit0, diff check0. New tests cover positive/negative offsets, IoU below/at/above
0.9, tiny-box edge tolerance, separate defects preserved during holds, old version
rejected, out-of-image boundaries, and explicitly undetectable omitted third hand.
Five active policy/judge files remain byte-identical to base; only spec imports
new module. Archive replay still eight inspections/two images, zero calls/writes,
v2/sample-b invalid box, other seven observed_pass. No old records relabeled.
Full check not rerun for isolated correction; existing NON-GREEN stability remains.

Claude: read-only re-gate, no providers/keys/edits. Review only the single corrective
child of 01f092eabf3988694c3195907ba0b6882867d5c1, not the whole ahead branch.
Files: policy, spec, CURRENT, this brief. Falsify near-duplicate ambiguity handling
(including unrelated subjects and endpoint kinds), threshold boundary behavior,
explicit-defect retention, no active imports and independent box semantics.
P2-2 and P2-4 clarify contracts/limitations rather than change visual detection.
Neither count rule nor schema can establish that model observations are true.
Do not award visual accuracy, full-check stability or production acceptance.

```powershell
Set-Location 'C:\GNart\Work\sh-r3b1b-semantic-m1'
$anatomyP2Base = '01f092eabf3988694c3195907ba0b6882867d5c1'
$anatomyP2Head = git rev-list --reverse --ancestry-path "$anatomyP2Base..codex/r3b1b-semantic-recovery-m1" | Select-Object -First 1
git status --short --branch
git show --no-patch --oneline $anatomyP2Head
git diff --stat "$anatomyP2Base..$anatomyP2Head"
git diff --check "$anatomyP2Base..$anatomyP2Head"
npx.cmd tsc --noEmit
npx.cmd vitest run lib/anatomy-evidence-policy.spec.ts lib/__tests__/local-anatomy-experiment.spec.ts lib/__tests__/local-preview-judge.spec.ts lib/__tests__/local-preview-quality.spec.ts lib/__tests__/local-story-preview.spec.ts
npx.cmd tsx --require ./scripts/shims/register-server-only.cjs scripts/replay-anatomy-archive-offline.ts
# Optional only after explicit Guy push instruction; carries earlier unpushed ancestors too:
# git push origin "${anatomyP2Head}:refs/heads/codex/r3b1b-semantic-recovery-m1"
```

Tests run current checkout. If HEAD differs from review head, reconcile and use
an agreed pinned review worktree, never reset the writer. Codex commits locally;
no extra stage/commit is needed. No independent closure claimed for this correction.
