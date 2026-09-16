# Kim prop design / scene separation — data-only Decision Gate

## Authority and topology
Claude supplied PASS0/0/1 for 6b14617a..c1ae489a, closing the previous HOLD and
all five findings. That PASS is bounded to the code correction, not this data work
or the whole repository. New P2: prop design contains named bus passengers despite
the board header excluding people/animals. Apply the standing fix/re-gate workflow.
Current task sole writer, C:/GNart/Work/sh-r3b1b-semantic-m1, branch
codex/r3b1b-semantic-recovery-m1. Base c1ae489a8dc9d65ced37829ac4abd968004f4395,
clean/ahead39 at start. Protected d53b768ccb2f and accepted-intent63ccb484 clean,
read-only. No extra execution task, parallel writer or new product decision needed.

## Observed and expected
ownerDraftPropBoardPrompt concatenates visualLanguage and recurringProps.design.
previewPagePrompt uses the same design plus each page's prop state/composition/
childAction/companionAction. Existing schema already separates stable design from
scene state. The data violates that separation: last_bus requests Bar/Kim in the
windows, striped_sock requests placement on Kim, and visualLanguage describes an
expressive human child. Invariant design duplicates the polluted prop descriptions.
Expected board input has object geometry/material only; scene placement belongs to
page3 sock state and page7 bus state. Preserve those page constraints, not delete
them from illustration instructions. Neutralize the positive human-subject phrase
in shared style; expressive child actions/expressions already exist on every page.

## Smallest solution / risk / files
New ignored outputs/kim-system-sample-v2-input-20260916 plan/config and read-only
validation script. Seven changed plan leaves only: bus/sock designs and their two
invariant copies, page3 sock state, page7 bus state, shared visualLanguage. Existing
story, locations, scale, framing, selection3/7, anchors, budgets2/4 and all other
page actions/compositions unchanged. Bind new plan SHA and fresh future output root
outputs/kim-system-sample-v2-20260916. Do not create a second engine or regex filter.
No production code/schema edits. Track this evidence and CURRENT only; disclose
new input artifacts are local-only. Validation must inspect actual assembled board
and page prompts, shared source/plan/continuity loaders, exact diff inventory and
old-root byte preservation. This data correction does not guarantee clean pixels.

## Stop-check / spend / rollback / review
Story-specific authored data, not hardcoded engine behavior. No other book changes.
Zero provider/image/audio calls, no real key access, no paid-root resume or edits.
No separate board QA, judge change, threshold waiver, accepted-source publication,
Blueprint/package/customer cutover, product acceptance, push or deployment.
No rendering needed to prove absence/preservation of contradictory instructions.
Rollback uses the old immutable config/plan; old evidence remains held, never approved.
Full repository check remains non-green. Claude should falsify seven-leaf scope,
no invented cast in board design, preserved page placement, bindings and no automatic
PASS. First review read-only; code PASS remains bounded to c1ae489a. No image QA
accuracy claim and no expansion to unreviewed5e25996f..d1a79ab3.

## Completed data changes

| Plan path | Correction |
|---|---|
| recurringProps[1].design | Remove only the sentence placing the sock on Kim. Shape, heel/toe/cuff, colors and non-hat exclusions unchanged. |
| recurringProps[2].design | Keep first sentence: cream/teal bus, wheels, windows and solid mullions. Move all passenger placement to page7 state. |
| continuity.entities[1].invariants[0].value | Match the corrected sock design exactly. |
| continuity.entities[2].invariants[0].value | Match the corrected bus design exactly. |
| pages[3].props[1].state | Append the exact removed sock-placement sentence. |
| pages[7].props[1].state | Append all removed bus passenger/head/hand/body positioning sentences. |
| visualLanguage | Remove only `, expressive human child`; medium, palette and negative style constraints unchanged. |

No schema or generic engine filter added. The existing design/state split supports
this correction. Authoring convention: design/invariants describe enduring identity;
page state/actions describe where characters are and how they interact right now.
This convention is not newly enforced by an automatic semantic lint gate.
All other plan leaves identical. Config differs only at plan file/SHA and outputDir.
Source6ad8028651496247e70c7e1bdce1ab648ecf66642a5e44a43f548f0b6f0728a3 unchanged.

Local input root: C:/GNart/Work/sh-r3b1b-semantic-m1/outputs/kim-system-sample-v2-input-20260916.

| File | Bytes | SHA-256 |
|---|---:|---|
| plan.json | 17513 | 90660c71804820bdcf887d6f37e47aabf90c95eba7dccf3b758fb9d9c22fbd10 |
| config.json | 1273 | b3328765d5c451eae0e865594860265add5c1a2f5bb5cb25555343fa9c6cfccf |
| validate.cjs | 4763 | 420c19c9b6a8c08dc554cbf6034a61e3f6c418583931fc814eac57750cbad6a9 |

These three files are ignored/local-only, with no verified off-machine backup.
The Git commit preserves this record, NOT the data/validator bytes. It does not
make this experiment reproducible from a fresh clone without those local inputs.
Old paid/input roots remain untouched; a sorted path/SHA comparison before/after
verified26/26 identical files, including original plan/config, receipts, logs and
images. No old board/page reused as approved anchors or silently reclassified.

## Validation results
Read-only validate.cjs exit0 using actual loadOwnerDraft, validatePreviewPlan /
continuity validation and ownerDraftPropBoardPrompt / ownerDraftPagePrompt:
- Exactly seven leaf differences and exact two config-field replacements.
- Old built board is positive control for bus passengers, Kim sock placement and
  expressive-human-child text; new built board retains all four objects and generic
  exclusion, without those subject/placement instructions.
- Removed sentences preserved verbatim in page3/page7 state and actual page prompts.
- Page7 child and companion actions unchanged; page5/page6 no longer inherit the
  later bus-window placement through canonical prop design.
- Nine complete planned cover/body prompts, same story, anchors, selected3/7 and
  budgets2/4. Source and asset bindings validated by the real loader.
- Throwing fetch sentinel: providerDispatches0. Future paid output root absent at
  validation. No rendering or credentials required. tsc --noEmit exit0.

No engine/spec changes; no focused suite or full check rerun for this data/docs
milestone. Claude's supplied124/124/tsc0 is his preceding range only. Last full
check remains exit1 (ordinary5640pass/2fail/73skip, resource671pass); model inventory
and393-vs409 classifier failures were not baseline-reproduced or resolved here.
This does not solve visual scale, anatomy, actual board compliance or calibrated
automatic QA. Walking-stop foot disagreement remains in historical raw evidence.

## Claude Code — ready-to-copy review brief
Please review this DATA correction read-only, not repeat your prior code re-gate.
Worktree/branch above; base c1ae489a8dc9d65ced37829ac4abd968004f4395; head is the
single docs(creative) commit supplied in Codex's final response. Reconcile exact
HEAD first. Tracked range is CURRENT plus this document; changed local artifacts
are the three hashed files above, and they must be inspected separately from Git.
Verify that the old plan/input/paid outputs are unchanged and only seven new-plan
leaves differ; attack assembled prompts rather than searching engine for Kim.
Check bus passengers and sock placement survive on their proper pages, but not in
board design/invariants. Check config source/ref/budget identity and new-root binding.
Do not rerender, access keys, mutate artifacts, self-award visual acceptance or move
your c1ae489a code PASS boundary. Assess new P2 closure independently; still no
product acceptance, new catalog revision or customer pipeline activation.

```powershell
Set-Location 'C:/GNart/Work/sh-r3b1b-semantic-m1'
git status --short --branch
git log --oneline c1ae489a..HEAD
git diff --stat c1ae489a..HEAD
git diff --check c1ae489a..HEAD
npx.cmd tsc --noEmit
npx.cmd tsx --require ./scripts/shims/register-server-only.cjs outputs/kim-system-sample-v2-input-20260916/validate.cjs
```
No stage/commit steps remain after the local milestone commit. No push performed.
Only after Guy separately requests propagation (the entire ahead set travels):
```powershell
git push origin codex/r3b1b-semantic-recovery-m1
```
