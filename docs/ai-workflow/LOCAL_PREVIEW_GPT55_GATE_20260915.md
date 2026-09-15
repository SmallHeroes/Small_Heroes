# GPT-5.5 Medium judge comparison — owner-approved gate

## Change / why
Guy explicitly requested GPT-5.5 Medium for visual QA and child resemblance,
then individual rechecks of existing images. Baseline 5.4 anatomy missed the
owner-rejected original; identity's legacy 4o request permits only180 output
tokens and has no reasoning configuration. A model rename alone is insufficient.

## Scope / implementation
Same sole writer/task at C:/GNart/Work/sh-r3b1b-semantic-m1,
codex/r3b1b-semantic-recovery-m1, base4f0b6396, clean ahead18.
Protected dependencies clean at d53b768ccb2f / accepted-intent63ccb484.
General LOCAL preview policy v5 selects5.5/medium for blind anatomy and context.
Shared numerical identity gains an explicit opt-in Responses medium path;
legacy production callers/default4o and threshold0.70 stay unchanged.
New local identity recheck uses the genuine parser/scorer and exact reader bytes.
No story/child/page special case is introduced into judging.

## Validation / acceptance
Mock actual transports: model, effort, payload, legacy preservation, incomplete,
unassessable, retries and checkpoint replay; focused tests and tsc before commit.
Four unchanged calibration cases (8calls), plus13 individual reader identity
checks (13calls). Expected answers never enter model input. Same prompts/crops
initially isolate the model change. Record misses honestly, not threshold tuning.
No claim this small sample establishes general visual accuracy.

## Cost / risks / rollback
Existing key only. Two new evidence roots, planning budgets5USD each, no automatic
retries, unknown outcomes held, receipts persisted. No new image/audio calls.
Admission accounting is not a provider-enforced invoice cap. Medium may still
miss anatomy or give false positives; model upgrade is an experiment, not proof.
Old receipts, calibration policy, reader manifests and all media stay untouched.
Rollback by reverting the focused code commit; old roots remain usable with their
original policy. Do not adopt historical calibration into v5.

## Stop-check / review
General QA/identity change; production default is unchanged, so old callers keep
their request semantics. Owner model/effort and paid recheck decision explicit.
No further creative decision needed. Claude independent review pending: falsify
model dispatch, old-cache rejection, endpoint compatibility, unchanged scoring,
no replay billing, evidence/image binding and accounting. Guy judges visual quality.
No source edits, new render, repair, narration, deployment, push, production
cutover, full-check closure or independent self-PASS.
