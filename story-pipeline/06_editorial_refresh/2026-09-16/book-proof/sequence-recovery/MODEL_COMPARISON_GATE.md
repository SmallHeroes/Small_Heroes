# Explicit image-model comparison — 2026-09-23

## Decision, topology and scope

Guy accepted Codex's revised recommendation and instructed implementation in this
task. Continue on codex/r3b1b-semantic-recovery-m1 in
C:/GNart/Work/sh-r3b1b-semantic-m1, base79dea3db, clean/ahead18. Codex is sole
writer. Protected worktree d53b at commit768ccb2f and accepted-intent worktree at
commit63ccb484 remain read-only/clean.
No independent PASS is claimed for this new implementation or the entire tree.

## Problem and recommendation

The last two outputs used gpt-image-2 LOW, not Astra or Image2.5. The pair stopped
on page1 wheel fidelity, so it did not test predecessor continuity. Full-image
repair changed unaffected details and did not resolve the wheel. Exact three
spokes and0.27 child-height originated in diagnostic design, not story prose;
their severity deserves a separate product-policy decision. Do NOT change these
requirements or QA during this model-only comparison. Existing artifacts stay HELD.

First establish a single-variable visual comparison before adding regional repair
infrastructure. Add optional allowlisted imageModel to the local owner sample CLI;
absent selection preserves Image2 and old serialized config/identity behavior.
Explicit overrides are sample-only. Keep LOW, size1024x1536, source, plan, sequence,
prompts, anchors, atlas, QA5.5-medium/Flex, resemblance0.70 and all gates unchanged.
No customer/production cutover or automatic planner upgrade.

## Evidence and cost

Official sources fetched today:
https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst
https://developers.openai.com/api/docs/guides/image-prompting
https://developers.openai.com/api/docs/guides/image-generation
Sunburst supports Image API edits and LOW; official image token rates are5/8/30
USD per million text-input/image-input/image-output tokens (cache separately).
Equal rates do NOT establish equal total cost. Account metadata GET returned200
for gpt-image-2.5-sunburst; this is not proof a generation will succeed.
Existing key reuse is explicitly authorized; do not reveal or copy the key.

Smallest paid measurement: same selected pages1/2, at most2 images/4 QA calls,
new root, no repair/import/retry/new board. Stop on first hold/error/unknown or
budget admission failure. Image cap1 + QA cap1.80 =2.80; prior conservative
accounted6.65329 (including unresolved historical1 reservation) +2.80 =9.45329,
below unchanged9.50 aggregate fence. These are admission caps, not a quoted bill.
Second-page QA may be blocked by its existing reservation floor; never refill.
Record reported usage, known estimate, unpriced/unknown outcomes and native exit.

## Implementation and acceptance checks

Likely files: scripts/run-owner-book-draft.ts, its spec, request-boundary test,
one evidence harness/readout and CURRENT/ROADMAP. No shared generator change.
Tests: old defaults/identity; exact allowlist; sample-only override; selected
model reaches provider and checkpoints; changed model cannot resume old root;
mocked wrong-model/fallback results hold at the caller with evidence retained.
This does not attest provider identity: the shared generator returns its own
requested model and its fallbackUsed comparison is always false. The actual
transport test proves the requested model only. Run focused tests, tsc,
full check separately (prior full gate RED16timeouts; do not infer green).
Before dispatch compare actual prompt and reference hashes with saved baseline.
Preserve old SHA/bytes/mtime; no root overwrite. After dispatch inspect pixels,
raw QA and cost. A one-pair observation cannot prove model superiority or18 books.

Rollback: omit override/use existing baseline config in a NEW root; do not delete
evidence or rewrite historical identities. Commit explicit paths, no push.

## Stop-check and exclusions

General model selection, not a Panda-specific runtime fix. Other stories default
unchanged. Paid diagnostic only, not launch. Guy has chosen the comparison; no
new creative choice is implemented. Claude should falsify model/config/checkpoint
binding, old-run compatibility, accidental prompt/reference/QA changes, actual
dispatch limits, cumulative cost and preservation. Guy later judges the images.
No full book, medium/high quality, new QA policy, regional edits, narration,
source publication, deployment or independent self-PASS in this milestone.

## Validation before execution

Focused192/192=owner95+image-transport23+preview42+sequence32. Standalone tsc0,
real owner preflight0/providerCalls0, both historical pair readouts reproduce0.
First-page prompt equality holds;172 historical files included in preservation.
Full check native1: both typechecks pass, both test phases fail. Resource phase
642pass/29fail and2222.99seconds; includes assertion mismatches as well as timeouts.
No classification as wholly inherited, no base counterfactual, no stability closure.
Local logs: outputs/panda-sunburst-comparison-input-20260923/full-check.*
stdout SHA fcee3113fa1215dc1e72602a737bfcf392f5d7126302c8ae4612ce1980e925f2;
stderr SHA b4ccca9740ecf4172ee138898d265cbc9b3deea4926b988a04a4c73072f3a1e1;
native-status SHA3193d407428b4e75915f7e2fe34f3cc19ff5321622ff1dc1bd27f48edb9c8af8.
These logs/inputs and future output roots are ignored/local, no verified backup.

Guy also supplied a separate site-QA merge notice. Git confirms70d4f245 has parents
4f1c8e2c/51ce55fc,24 changed paths and no overlap with this milestone's files.
No merge into this branch, live deployment verification or independent site PASS.
