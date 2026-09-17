# Claude: Panda visual-data review, not another evidence-only re-gate

## Requirement and topology

Guy accepted the revised Panda story and asked to continue through the real book
pipeline. After Codex identified premature telescope-lowering on page9, Guy
authorized its correction and downstream continuity preparation. Preserve prose.

Worktree: C:/GNart/Work/sh-r3b1b-semantic-m1
Branch: codex/r3b1b-semantic-recovery-m1
Base: 8d85366eba7bb8b814f58e372daef74026c6afa5
Head: the single focused commit containing this file; the delivery message pins
its full hash. Stop if the supplied head differs; do not review a moving HEAD.
At start: clean, ahead59/behind0. Codex sole writer, Claude first pass read-only.
Protected: d53b768ccb2f and accepted-intent-wave-2 63ccb484, clean and untouched.

## Review the actual creative data

Read all12 pages in ../panda_anat_adventure_revision02.md and candidate/integrated.md,
not only this commit's one-leaf delta. The unchanged eleven directions originated
in ea3850d7 and do not already carry a creative PASS. This is explicitly requesting
their first independent visual-direction review in context, without implying that
the previous code or publication PASS covered them.

The selected mainAction on page9 now keeps the tube at eye level. Page10 retains
lowering it to discover the peripheral route. Every other direction field and
every source-prose page is unchanged. Canonical prop/style fields are NOT added to
the page-direction schema. CONTRACT_MAPPING.md is future authoring guidance only.

Exact pending candidate:
407c34c88fd6c5a851ed253c0534f01332a599222a2d6a6ecff967e65b81d160
Review bundle digest:
6b125a90e8e8b24f9c7b81a9611f8f89edf83e80d4bac9c48aec807e83572da1
Candidate manifest digest:
630bc33679814b6308a497976b23181a229f519cd96027928384ce45036b62d2
Source revision:
9ea583e13fa979e1105a60f52721f550f518e5eed01295983f2f02e2c7aaf3cb
Direction bytes11823 / SHA b5e7691a1da79058c95d0f7cd40aeec2725b70c9cbcb0b9ff5d09f11c7ade6ce.

## Falsification targets

1. Compare every page to source: one stage of action, no premature reveal, duplicate
   child, extra rover occupant, literal lava, spacecraft or invented garage.
2. Challenge page9 eye-level staging and page10 lowering; verify the repair does not
   erase hesitation, sharing or the child's own discovery.
3. Check supporting cast, station vs rover, feet as wheels, rug chronology,
   flower scale and bench detour. Flag contradictions before authoring downstream.
4. Challenge the mapping's actual existing fields, the character-free board
   boundary, and any prose incorrectly portrayed as an enforced contract.
5. Verify exactly one direction leaf differs; prose/other directions/composition
   are identical, original12 artifacts preserved and new5 match tracked copies.
6. Verify lifecycle created/replay identities and that no acceptance record or
   runtime authority was fabricated. A structurally valid candidate is not pixels.

## Reproduction and observed results

From the named worktree in PowerShell:

```powershell
node --import tsx --require ./scripts/shims/register-server-only.cjs story-pipeline/06_editorial_refresh/2026-09-16/book-proof/visual-refinement/verify.cjs
npx vitest run lib/__tests__/story-source-visual-direction-enrichment-lifecycle.spec.ts lib/__tests__/story-source-visual-direction-acceptance-lifecycle.spec.ts
npx tsc --noEmit
git diff --check
```

Verifier exit0:12 pages, one changed leaf, unchanged parsed prose and composition,
12 original snapshots and5 replay snapshots including mtime,5 exact tracked copies,
3 negative controls. Specs8+5=13/13, tsc0. No full-check rerun or stability closure.
Actual CLI used:

```powershell
node --import tsx --require ./scripts/shims/register-server-only.cjs scripts/story-source-visual-direction-enrichment-lifecycle.cjs prepare --request outputs/panda-visual-refinement-inputs-20260917/enrichment-request.json --output-root outputs/panda-visual-refinement-candidate-20260917 --write true
```

First run created:true, second created:false, both exit0; receipts retained separately.
Dry run before creation used --write false, exit0. Verifier subsequently uses the
real loadExistingCandidate and prepare(write:false); it does not write or call providers.

## Storage and limits

New ignored roots (not backed up by pushing outputs):
- outputs/panda-visual-refinement-inputs-20260917/ (request and direction input)
- outputs/panda-visual-refinement-candidate-20260917/ (digest child directory,5 files)

All seven new input/candidate files have exact copies in THIS tracked folder.
Original7 source files stay in the accepted revision; original5 pending candidate
files stay in outputs/panda-visual-enrichment-20260917/50103b10c6d72866987aa6fbe0a2c5bc4397d14eff5f64f2d3e4433fa6b82a16/.
Historical original inputs remain outputs/panda-approved-source-20260917/;
preservation in this milestone asserts the named12 artifacts, not every old log.
No verified off-machine backup or push is claimed. The verifier's mtime evidence
is machine-local, not a fresh-clone timestamp guarantee. Recreating inputs must use
the exact tracked bytes; it does not recreate the original execution timestamps.

No provider/credential access, image/audio/render, product acceptance, release or
runtime cutover. Cost$0. Reader/anatomy/continuity/narration remain open.
No existing PASS boundary moves. Your prior949a360d..8d85366e closes evidence only.

## Deliverable needed to proceed

Return findings and a verdict pinned to the supplied commit range AND the candidate
and bundle digests above. The existing acceptance lifecycle subsequently requires
a genuine small-heroes-story-source-visual-direction-technical-review/v1 artifact
from Claude Code (including canonical digest). First pass remains read-only:
return that record in your response if warranted, do not write acceptance files.
Do not treat this handoff as a prewritten PASS. Guy retains exact product acceptance.
After that dependency, proceed to actual contract/reconciliation/Blueprint/package,
then the small visual sample, and only then the illustrated/narrated book.
