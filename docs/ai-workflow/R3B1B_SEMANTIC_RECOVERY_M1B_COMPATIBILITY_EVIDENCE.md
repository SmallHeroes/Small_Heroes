# M1b compatibility foundation — execution evidence

Date: 2026-09-07. Status: IMPLEMENTED; FINAL FULL CHECK NON-GREEN; QA PENDING.
No independent PASS. This is the first M1b slice, not completed M1b/M1/M2.

## Requirement, authority and sequencing

Guy prioritized render-qualifying the 18-story catalog, with payments last,
and now explicitly authorized continuation and renders. The approved general
semantic-recovery Gate requires a preserved legacy v9 candidate/v3 catalog
lane before any new group schema or motion catalog. M1a code and its P2s are
independently closed at `09d67f38`. The user-supplied last wording re-gate
`ceefae25..a0344114` is documentation PASS P0=0/P1=0/P2=0, not new code authority.

Codex chose a compatibility-first code slice within M1b. This does not resolve
the six P1 semantic findings, enable groups, add `runs`, or create an effective
candidate. No new provider call is needed to test a deterministic reader.
Render approval is recorded but unused; a precise LOW sample/budget and the
candidate/Blueprint/package prerequisites still precede any paid execution.
No full-book render or product acceptance is inferred. Actual spend is $0.

## Topology and ownership

- Sole writer: current Codex task, execution worktree
  `C:/GNart/Work/sh-r3b1b-semantic-m1`, branch
  `codex/r3b1b-semantic-recovery-m1`.
- Immutable base: `a03441145a442410cdaf0e799fac028517c1dcf6`; implementation
  started clean, HEAD/local upstream/observed origin equal, ahead 0 / behind 0.
- Read-only P1 evidence: `C:/Users/guyna/.codex/worktrees/d53b/Small_Heroes`,
  branch `codex/r3b1b-p1-a1-post-cardinality-authoring`, HEAD `768ccb2f`, clean 0/0.
- Read-only accepted intent: `C:/GNart/Work/sh-r3b1b-accepted-intent-wave-2`,
  branch `codex/r3b1b-accepted-intent-wave-2`, HEAD `63ccb484`, clean 0/0.
- `git worktree list --porcelain`, relevant `git branch -vv`, statuses and
  upstream counts were inspected. No new task, agent, worktree or cleanup.
  Existing dependency junction is unchanged. No push belongs to this slice.

## Observed defect, fix and limits

The existing reconciliation reader checked candidate checksum, template
checksum, coverage and snapshot identity but did not check the advertised
Action Semantic Catalog version/digest or Source Evidence Catalog binding.
A self-consistently rehashed envelope could therefore claim a different
catalog. Referencing only the mutable-current version constant would also
couple old candidate admission to a future producer version change.

The original v3 table now has named historical exports, a literal golden
digest and runtime freezing of the table, each entry and its nested arrays.
The current exports still select those same bytes. No predicate, prompt,
schema, snapshot, request, receipt, candidate or cost policy is upgraded.

The public reconciliation assertion delegates to an explicit v9 reader.
It pins candidate v9 / template schema v4 / action catalog v3 and its original
digest / coverage v6 / source-evidence catalog v1 and the exact supplied
snapshot's catalog digest. It also rejects non-v3 predicates even if someone
rehashes the enclosing candidate and template. Existing checksum, coverage,
status and expected-template checks remain. The reader is read-only and never
uses the paid factory to upgrade/reissue an old candidate.

This is **envelope compatibility**, not a replacement for full contract
validation, source-semantic review, request/receipt-chain validation, candidate
attestation or downstream approval. No claim is made that all semantic forgery
is detected. Future catalog/schema expansion must retain this explicit lane,
add its own reader and re-prove exact historical replay; that future cutover
has not been implemented or tested here.

Rejected alternatives: adding `runs` directly to v3 would invalidate the
historical catalog identity; accepting any catalog digest would erase the
authority boundary; rebuilding the old candidate under a future paid factory
would misrepresent its receipt. Re-authoring would spend money without fixing
this reader contract. No story/page/character-specific production condition.

## Changed surfaces and consumer disposition

Paths below are relative to the execution worktree.

- `lib/visual-contract-compiler/actionSemanticCatalog.ts`: frozen named v3
  exports; current aliases unchanged. Nested freezing also freezes the shared
  closed entity-kind arrays; this is intentional immutability, not new values.
- `lib/visual-package/reconciliationLifecycle.ts`: explicit version-pinned
  envelope reader and delegation from the existing public assertion. Both
  in-memory reconciliation and persisted candidate loading use this boundary.
- `lib/__tests__/action-semantic-catalog.spec.ts`: golden v3 hash, deep runtime
  immutability and unchanged `walks`/absent `runs` assertions.
- `lib/visual-package/__tests__/source-authority-lifecycle.spec.ts`: rehashed
  cross-binding and unsupported-version/predicate cases, read-only persisted
  rejection, positive legacy read and expected-template mismatch, plus strict
  paid-factory regressions for altered receipt catalog metadata.
- `lib/visual-package/__tests__/pre-render-book-visual-blueprint.fixtures.ts`
  and its six calls across five production/Blueprint/Wizard lifecycle specs:
  replace placeholder catalog labels/digests with the real current catalog
  identity and the supplied snapshot's Source Evidence Catalog. The helper now
  requires the full snapshot; no duplicate derivation or weakening of the
  production reader. Its unsafe type assertion is replaced by `satisfies` and
  an explicit mutable clone of coverage. The five caller specs are
  `production-lifecycle-foundation.spec.ts`, `production-package-lifecycle.spec.ts`,
  `qa-wizard-blueprint-authoring-lifecycle.spec.ts`,
  `qa-wizard-blueprint-replacement-lifecycle.spec.ts`, and
  `qa-wizard-package-lifecycle.spec.ts` (same test directory).
- Candidate producer/persistence, canonical supervisor and Wizard rebuild
  paths remain unchanged. Current-factory rejection was not weakened.
- Compiler, supporting-cast input, validators/materializer, prompt/prose,
  Blueprint/wire/runtime/Board consumers and correction lifecycle are not
  migrated in this slice. All group/motion Gate criteria still apply next.

No new spec file: canonical file inventory remains 385 (364 ordinary / 21
resource-intensive); no classifier, timeout, RPC, exclusion or runner-policy
change. No library/runtime dependency change.

## Validation

Intermediate evidence is retained, not relabeled; the delivered result below
controls the handoff:

- Catalog + authoring lifecycle: 139/139 passed across 2 files, including
  16 added tests (1 catalog + 15 lifecycle); log
  `outputs/qa-m1b-v9-compat/focused-catalog-lifecycle.log`.
- Six consumer suites: 91 passed / 1 failed across 5 passing / 1 failing files.
  Wizard legacy-manifest replay failed at its unchanged Git repository
  authority reader; one onTaskUpdate RPC timeout also occurred. The suite
  completed in 265.65 seconds. This is not a green consumer result.
- Both initial typechecks exited 0. Final-tree checks and isolated Wizard
  diagnostics are recorded below.

The isolated Wizard legacy-manifest case then passed (1 passed / 14 skipped,
14,815ms test, 18.81s run) with no code or timeout changes. This is diagnostic
evidence, not a retroactive green result for the six-suite run. Log
`outputs/qa-m1b-v9-compat/wizard-legacy-isolated.log`, SHA-256
`9b8af73d79731d4e4919a9516711ecb2a7c5dc52c7312b1cd7d0c7d6bb9c5598`.

### First full check — superseded, real fixture regression found

The first complete run is retained at
`outputs/qa-m1b-v9-compat/npm-run-check-final.log` (the filename reflects its
original intent, **not** delivered-tree status), SHA-256
`0e8113d2a63f344999a9e7383723e8d5d807e640225d7fb30e31d17b7602a773`.
Both typechecks passed; `npm run check` exited 1. Ordinary: 334 passed /
13 failed / 17 skipped files, 4,666 passed / 214 failed / 73 skipped tests,
129,042ms. Resource: 14 passed / 7 failed files, 631 passed / 11 failed /
11 skipped tests, four onTaskUpdate RPC errors, 376,588ms. Classes were
signal_or_exit_failure in ordinary and RPC timeout / test timeout / exit
failure in resource. No code changed while this run was active.

The new guard correctly rejected `fixture-catalog` and fabricated source
catalog metadata from the shared candidate test builder. This was a **real
integration regression in this milestone**, not inherited: five additional
consumer suites failed through the same reader. The fixture and six callers
were corrected only after the full run finished. The five suites then passed
222/222 tests, 5/5 files, in 67.60s; log
`outputs/qa-m1b-v9-compat/focused-production-fixtures.log`.
Removing the helper's unsafe cast exposed a readonly-array TypeScript error;
an explicit mutable clone fixed it. Both subsequent typechecks exited 0.
The second full run below rechecks that final code, including the clone.

The first run also had resource-suite timeouts beyond the previously recorded
baseline. These are not classified wholesale as inherited and are not hidden
by the fixture fix. No timeout, test inventory, worker limit or exclusion was
changed. The delivered full-check result remains the controlling evidence.

### Delivered-code full check — controlling result

`npm run check` exited **1**, with both typechecks passing. Log:
`outputs/qa-m1b-v9-compat/npm-run-check-delivered.log`, SHA-256
`fd80e8c96b26ee6fbba421eca1d86a80afc1b8fa8b398e926865d3fc43d17d00`.
No code changed from this run's start through completion; all ten code-file
SHA-256 values matched `outputs/qa-m1b-v9-compat/delivered-code-sha256.json`
(manifest SHA-256 `c729c4cba1ab42b7ab93cc9c71d15f34bfbc9c3484928c6f1987d0d1754616da`).

| Phase | Files passed / failed / skipped | Tests passed / failed / skipped | Supervisor elapsed |
| --- | --- | --- | --- |
| Ordinary | 338 / 9 / 17 (364) | 4,859 / 21 / 73 (4,953) | 186,899ms |
| Resource-intensive | 14 / 7 / 0 (21) | 626 / 16 / 11 (653) | 460,213ms |

Four unhandled onTaskUpdate RPC timeouts occurred in resource-intensive.
Diagnostic protocol was valid for both phases. Ordinary classes:
test_timeout + signal_or_exit_failure; resource classes also include
on_task_update_rpc_timeout. Policy remained 4 ordinary / 2 resource workers.

All **361 tests in the seven directly affected suites passed in this run**:
catalog 11, authoring lifecycle 128, production foundation 97, production
package 21, Blueprint authoring 63, Blueprint replacement 31, Wizard package
10. This proves the corrected fixture helper and its final mutable-clone
implementation in the delivered tree. It does not make the full gate green.

Ordinary failures: the six previously recorded missing-fixture suites, the
review/correction-batch corpus bindings, and two Wizard-all-story-readiness
timeouts. Resource: correction-acceptance beforeAll corpus binding (11 skipped
tests), plus 16 timeouts across Supervisor (3), canonical readiness (4), Wizard
candidate bridge (1), request materialization (5), request verification (1),
and materialization input (2). The Wizard candidate timeout was its existing
15-second Fresh Readiness/provenance case; the other 15 resource timeouts were
at the existing 5-second limit. These additional timeouts were **not** proven
inherited; no root-cause/performance closure is claimed.

After the full run, the two ordinary Wizard-readiness cases were run alone,
with one worker and the unchanged default: both still timed out (5,617ms and
6,920ms), 2 failed / 10 skipped, 14.68s run. Log:
`outputs/qa-m1b-v9-compat/wizard-readiness-isolated.log`. This failed diagnostic
is distinct from the earlier **candidate-bridge legacy replay** isolated PASS.
No timeout was relaxed, and isolated results do not replace the full result.

Exact commands (run from the execution worktree):

```powershell
npx vitest run lib/__tests__/action-semantic-catalog.spec.ts lib/visual-package/__tests__/source-authority-lifecycle.spec.ts --maxWorkers=2 --no-cache
npx vitest run lib/visual-package/__tests__/production-lifecycle-foundation.spec.ts lib/visual-package/__tests__/production-package-lifecycle.spec.ts lib/visual-package/__tests__/qa-wizard-blueprint-authoring-lifecycle.spec.ts lib/visual-package/__tests__/qa-wizard-blueprint-replacement-lifecycle.spec.ts lib/visual-package/__tests__/qa-wizard-package-lifecycle.spec.ts --maxWorkers=2 --no-cache
npx tsc --noEmit
npm run story:autonomous-typecheck
npm run check
npx vitest run lib/visual-package/__tests__/wizard-all-story-render-readiness.spec.ts -t 'confines historical accepted-lineage|keeps its semantic digest deterministic' --maxWorkers=1 --no-cache
```

The previous final repository gate was non-green. Historical missing-fixture,
corpus and timeout evidence does not classify every current failure as
inherited. No full-green or independent-QA claim follows from focused success.

## Original P1 evidence and exact replay

Before edits, the Gate's exact inventory block was executed from d53b:
14 regular single-link files, 412,516 bytes, raw inventory SHA-256
`cd621f7712912a92d14fa87432c609c5e92a006363e7eed7be5231a856e8fdd0`.
The identical script was rerun after the delivered full check: exit 0 with
the same count, size, link checks and complete raw inventory hash.

An ignored read-only diagnostic script in the execution tree loads the old
snapshot, request, receipt, replay sidecar and candidate directly from d53b,
checks their content addresses, exercises both new candidate readers, and
rebuilds the candidate through the unchanged current factory before replaying
the exact captured responses through the **active code**, not d53b code.

```powershell
Set-Location 'C:\GNart\Work\sh-r3b1b-semantic-m1'
npx tsx --require ./scripts/shims/register-server-only.cjs outputs/qa-m1b-v9-compat/verify-held-candidate.ts
```

Script SHA-256: `2f6df3ca057900edacf42f35a822097529a54d3a7de02b7d733e3e40d9dbf1d8`.
Log `outputs/qa-m1b-v9-compat/held-candidate-replay.log`, SHA-256
`7a3f2dad52097c8d20b7f8764d7f12a84b3c982c3304eddda10f3efce40230cc`.
Both are ignored local diagnostic evidence, not artifacts available from a
fresh clone. The reproduction script is included verbatim in the appendix.

Exit 0 with explicit output: providerCalls=0; exactCapturedCallSequence=true;
receiptOutcomeCongruent=true; receiptCandidateDigestCongruent=true;
harness outcome=candidate; rebuiltCandidateIdentical=true.
Template digest `8632bd95869b93bf115500f3a24890daaa967a39805079e2f0ae86afc2543b18`;
candidate digest `efbdd2e13c03af194af425c5e050e0bfedad29d4e0c8cec1aa8b54530192ad88`.
An earlier multiline `tsx -e` invocation exited 0 with no output and was not
counted as evidence; the file-backed diagnostic above supplied the real proof.

No held output was rewritten, no new accepted source/effective candidate was
created, and no current locator was changed. P1 remains semantically
**HELD at P0=0/P1=3/P2=3**. Structural replay does not close semantic findings.

## Commit, rollback and independent QA

The focused local commit is handed off from the immutable base above. Final
handoff supplies its exact HEAD; no push is performed in this task. No
migration is needed. This is a bounded implementation submission with
a disclosed non-green full gate, not a claim of overall repository stability.
Rollback would be a separately authorized revert of this focused commit,
never a reset/deletion of existing work or evidence. No rollback was executed.

Claude Code first pass is read-only on the exact base..HEAD range. Falsify:

1. Frozen v3 bytes and catalog digest are unchanged, including nested objects.
2. Rehashed catalog/version/schema/source-catalog substitutions are rejected
   by the existing public and persisted readers, not just a dormant helper.
3. V3 rejects `runs`/unknown predicates; `walks` and valid old evidence survive.
4. The paid factory remains strict, preview guards remain intact, and no
   provider/re-render/receipt fabrication is used for compatibility.
5. Exact P1 replay uses active code, produces the original identities at zero
   provider calls, and all 14 original files remain byte-identical.
6. Final-tree logs, non-green findings and consumer-suite diagnostic limits are
   recorded honestly. Do not infer all failures are inherited or any full PASS.
7. Full M1b/group/motion/cutover and M2 are explicitly incomplete; no downstream
   authority, product acceptance, full-book permission or automatic push.

Do not access credentials, call providers, write approval/candidate/recovery
artifacts, render, push, deploy or mutate the held root. Return PASS/HOLD with
P0/P1/P2 findings. Codex has not self-awarded independent PASS.

## Appendix — exact read-only replay diagnostic

```typescript
import fs from 'node:fs';
import path from 'node:path';
import { canonicalHash } from '../../lib/canonical-json';
import { replayVisualContractAuthoringEvidence } from '../../lib/visual-package/visualContractAuthoringReplayRunner';
import { loadVisualContractCandidateForReconciliation, assertLegacyVisualContractCandidateV9ForReconciliation } from '../../lib/visual-package/reconciliationLifecycle';
import { buildVisualContractCandidateArtifact } from '../../lib/visual-package/visualContractAuthoringLifecycle';

// Read-only diagnostic using the active code against the immutable evidence tree.
const repoRoot = 'C:/Users/guyna/.codex/worktrees/d53b/Small_Heroes';
const base = 'outputs/r3b1b-p1a1-v22r2-02/b0';
function load(category: string) {
  const dir = path.join(repoRoot, base, category);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  if (files.length !== 1) throw new Error('Ambiguous artifact category');
  const file = path.join(dir, files[0]!);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error('Non-regular artifact');
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  const { digest, digestAlgorithm, ...payload } = value;
  if (files[0] !== digest + '.json' || digestAlgorithm !== 'canonical-json-sha256' || canonicalHash(payload) !== digest) throw new Error('Content address mismatch');
  return { value, relative: base + '/' + category + '/' + files[0] };
}
async function main() {
  const snapshot = load('source-snapshots').value;
  const request = load('authoring-requests').value;
  const receipt = load('authoring-receipts').value;
  const evidence = load('structured-draft-replay-evidence');
  const original = load('contract-candidates');
  const candidate = loadVisualContractCandidateForReconciliation({ repoRoot, candidatePath: original.relative, snapshot, expectedTemplateDigest: original.value.templateDigest });
  assertLegacyVisualContractCandidateV9ForReconciliation({ snapshot, candidate });
  const rebuilt = buildVisualContractCandidateArtifact({ request, receipt, compileResult: { template: candidate.template, actionSemanticCoverage: candidate.actionSemanticCoverage, supportingCastReviewDigest: null } });
  const result = await replayVisualContractAuthoringEvidence({ repoRoot, snapshot, request, receipt, evidence: evidence.value, evidencePath: evidence.relative });
  const report = {
    providerCalls: result.providerCalls,
    exactCapturedCallSequence: result.exactCapturedCallSequence,
    receiptOutcomeCongruent: result.receiptOutcomeCongruent,
    receiptCandidateDigestCongruent: result.receiptCandidateDigestCongruent,
    outcome: result.harness.outcome,
    candidateTemplateDigest: result.harness.candidateTemplateDigest,
    persistedCandidateDigest: candidate.digest,
    rebuiltCandidateIdentical: canonicalHash(rebuilt) === canonicalHash(candidate),
  };
  console.log(JSON.stringify(report, null, 2));
  if (report.providerCalls !== 0 || !report.exactCapturedCallSequence || !report.receiptOutcomeCongruent || !report.receiptCandidateDigestCongruent || !report.rebuiltCandidateIdentical) throw new Error('Legacy replay mismatch');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
```
