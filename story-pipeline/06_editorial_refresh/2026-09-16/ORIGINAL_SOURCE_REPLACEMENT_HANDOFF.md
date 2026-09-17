# Claude Code: original accepted source to first creative replacement

## Review received and P2 traceability correction — 2026-09-17

Guy supplied Claude Code's independent PASS P0=0/P1=0/P2=1 for the immutable
range4fd7eda0e9d39d39ac80443d9a1e0987739b9f41..95a8d7b15f4f59abed6f3ebc33c72cfb40b64263.
Claude independently reports a complete npm run check exit0: ordinary388 files,
resource22 files,410 total, both phases passed. The historical NON-GREEN finding
is closed by that observed run, not a claim of permanent reliability or release.
Claude also reports62 negative probes,18/18 originals, both creative revisions'
7-file byte preservation and equivalent base/head behavior for all5 revisions.
These are attributed reviewer results, not newly executed Codex experiments.

The remaining P2 was an unnamed Editor spec, not a failed test. Exact files and
reproduction command are now below. Codex re-ran all3 together at ea3850d7:
49+8+16 =73/73, exit0. All three spec blobs and scripts/lib paths are unchanged
between95a8d7b1 and ea3850d7. No count is inferred from a different Editor spec.

This correction is two Markdown files only (this file and CURRENT.md), based on
ea3850d733f5383472f44dc9ae278014a6d67d5c, clean ahead56 at start. Same sole writer,
branch/worktree as below; d53b768ccb2f and wave2 63ccb484 clean and untouched.
No provider, credentials, paid calls, source promotion or push. No fresh full
check was run for the documentation correction; focused73/73 and tsc0 were run.
Independent closure of P2 is requested, not self-awarded. The independent code
PASS still ends at95a8d7b1; ea3850d7 visual preparation and this correction are
outside that range. New Panda content acceptance and downstream gates remain open.

Re-gate target: verify that story-candidate-review.spec.ts is the genuine16-case
review-story-candidate.cjs suite, reproduce the exact73-case command, and confirm
this correction does not alter source/approval/intake or extend PASS boundaries.

```powershell
Set-Location 'C:/GNart/Work/sh-r3b1b-semantic-m1'
git status --short --branch
git log -1 --format='%H %P %s'
git diff --stat ea3850d733f5383472f44dc9ae278014a6d67d5c HEAD
git diff --check ea3850d733f5383472f44dc9ae278014a6d67d5c HEAD
git diff --name-only 95a8d7b1 ea3850d7 -- scripts lib
npx vitest run lib/__tests__/story-source-creative-replacement-lifecycle.spec.ts lib/__tests__/story-source-visual-direction-enrichment-lifecycle.spec.ts lib/__tests__/story-candidate-review.spec.ts
npx tsc --noEmit
# Only on Guy's explicit push request; carries the entire accumulated branch:
# git push origin codex/r3b1b-semantic-recovery-m1
```

## Scope and topology

Review-only first pass. Branch codex/r3b1b-semantic-recovery-m1, worktree
C:/GNart/Work/sh-r3b1b-semantic-m1. Base4fd7eda0e9d39d39ac80443d9a1e0987739b9f41.
Head is the single child `feat(stories): support first replacement of original sources`;
the accompanying delivery identifies its immutable hash. Pin that range, not a
moving later HEAD. This does not extend prior independent PASS ranges.
Protected d53b768ccb2f and wave2 63ccb484 clean/read-only, same sole writer.

Guy requires a good fully presented book through the actual system, prudent
spend and general fixes. All18 accepted roots are original/v1;16 lack a revision.
Previous creative replacement could only consume revision predecessors. This
milestone closes that compatibility gap, not full book/readiness/release gates.

## Implementation claims

- scripts/lib/original-accepted-story-source.cjs: read-only original verifier,
  shared single-story and historical corpus-acceptance validators, shared source
  and Editor validators. Exact retained story/review/approval hashes and sizes,
  slot/identity/corpus member/audit/exclusions checks, strict contained reads.
- scripts/story-source-creative-replacement-lifecycle.cjs: explicit request/v2
  accepted_root_v1 descriptor, versioned derived artifacts. Original/v1 is not
  falsely represented as a revision digest. Legacy requests/bytes unchanged.
  Read-only inspection export requires no fake acceptance and cannot publish.
- First publication supports absent revisions/ only after validation, with an
  exclusive lock and fresh request-hash verification. Preview writes nothing.
  Reject stale original forks, aliases, held locks and collisions; exact replay.
  New-format reload and subsequent predecessor validation recheck original proof.
- Real downstream enrichment prepares, writes and reloads a candidate from the
  new format in a test-owned root, preserving prose exactly. No consumer bypass,
  inherited old directions, actual catalog mutation or production switch.

## Evidence

One red fixture on base: request_invalid,1failed/27filtered. After implementation:
49/49 lifecycle (27existing,22new),8/8 enrichment,16/16 Editor, total73/73:

- lib/__tests__/story-source-creative-replacement-lifecycle.spec.ts:49
- lib/__tests__/story-source-visual-direction-enrichment-lifecycle.spec.ts:8
- lib/__tests__/story-candidate-review.spec.ts:16 (scripts/review-story-candidate.cjs)

The Editor count does not refer to hebrew-read-aloud-editor.spec.ts or
story-source-revision-materializer.spec.ts. Exact rerun command appears above.

tsc exit0. Full npm run check exit0, both typechecks pass, ordinary5693pass/73skip,
resource671/671, total6364pass/73skip,410 files. Captured supervisor summary
book-proof/original-source-check-summary.json is a final summary, not full logs.

Real read-only inventory:18/18 originals (17corpus,1single), retained hashes in
book-proof/original-source-inspection.json. All18 refresh identity triples match.
Actual legacy Kim eca8b3c8 and Dini f77f4ca5 reload rebuilds all7 stored files
byte-identically. Intake --check18/216 unchanged. Editor-approved proposal SHA
5bed647c... and review79271dfb... unchanged. Zero paid calls, keys or renders.

## Falsification targets

Try original/source/review/approval/corpus-member tamper, rehashed descriptor
substitution, different slot/category, changed audit/exclusions, unknown status,
version confusion, traversal/hardlinks/junctions, hidden parent aliases, held lock,
request mutation during lock acquisition, original fork after any revision, exact
replay and subsequent-predecessor reload. Poison ancestor evidence then call the
real enrichment consumer; it must fail before writing a candidate. Compare
legacy rebuilt bytes, not just schema labels. No v1 bound-check may be relaxed.

The source verifier intentionally validates the ORIGINAL source only. Its old
acceptance never grants approval to new text. Fresh exact story/Editor acceptance
fields are still mandatory in a publication request. Tests use synthetic requests
inside test-owned temporary roots; no real Guy approval was authored. Repository
approval files are trust anchors, not signatures: coordinated rewriting of all
authority records is outside hash integrity's protection. Historical single-story
raw review output can be absent; retained review+approval bind exact bytes instead.
Corpus sources are retained and checked. Historical corpus approval validator
keeps its original fixed record-count/date/review boundaries; no generalized
acceptance policy or new cohort was silently invented.

CLI flags are unchanged; new positive coverage invokes the public library and
real enrichment, while existing subprocess/fault-boundary tests remain green.
No new v2-only CLI subprocess acceptance experiment was claimed. Green tests are
not an independent PASS, story product acceptance, visual accuracy or launch proof.
Reader/anatomy/continuity and full book+narration outcome remain open.

## Optional propagation after review and owner authorization

No push performed. A push carries the entire accumulated ahead branch, not just
this one reviewed commit. Staging and commit are already complete in the delivery.

```powershell
Set-Location C:\GNart\Work\sh-r3b1b-semantic-m1
git status --short --branch
git log -3 --oneline
git diff --check
git push origin codex/r3b1b-semantic-recovery-m1
```
