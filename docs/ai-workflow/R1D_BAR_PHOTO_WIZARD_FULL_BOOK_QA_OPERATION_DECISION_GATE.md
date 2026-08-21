# R1D Bar Photo Wizard Full-Book QA Operation Decision Gate

**Date:** 2026-08-22

**Owner decision:** Guy instructed Codex to continue autonomously until the
real Wizard produces a new complete book, explicitly authorized one full-book
render, identified the tracked Bar photo, set the child name to `בר`, and chose
mother narration. This gate interprets that authority narrowly: one new
photo-backed fake-paid QA Order on one Preview deployment. It is not Production
launch authority and does not authorize a second Order after failure.

## 1. Proposed change

Run the ordinary photo-backed product path end to end:

1. deploy the independently re-gated code at `95ebce20` to a new Preview;
2. configure only the feature branch's Preview environment for QA, LOW image
   quality and the ordinary bounded product attempts;
3. point only `qa.smallheroes.co.il` to the READY deployment;
4. traverse the real Wizard with tracked `public/Images/Bar.png`, child name
   `בר`, boy profile, mother voice `mom`, Chameleon / `TRANSITION` / bedtime /
   Style 01 / 16 physical pages;
5. complete only the staging fake-payment flow; and
6. allow the existing chunked pipeline to generate, QA, persist and assemble
   one complete eight-beat book, then inspect its Reader.

No prompt, renderer, Story Source, Visual Package, Board, current locator,
payment implementation, QA threshold, fallback or retry code changes belong to
this operation.

## 2. Why now?

The prior no-photo QA Order proved checkout, text/DNA and child-anchor dispatch,
then stopped correctly on one rejected anchor under a deliberately one-attempt
Preview cap. The correction at `7a3d0001..95ebce20` now preserves bounded QA
reasons, uses current Anthropic defaults, passes 8 files / 79 focused tests and
TypeScript, and received independent Claude Code PASS with 0 findings. The
remaining product gap is a complete new-story book through the deployed Wizard.

## 3. Scope

This is a one-off operational proof of the general system. The fixed Bar inputs
are test data selected by Guy; runtime code remains generic. The only intended
external mutations are branch-scoped Preview configuration, one QA alias move,
one synthetic fake-paid Order, and that Order's provider/storage/database
artifacts.

## 4. Risk of hardcoding

No story, child, page or companion special case is added. The Wizard itself
selects the current approved Chameleon package and package-bound Story Source.
The fixed name/photo/voice are proof inputs only. The file is tracked repository
test media, not a customer upload discovered from another Order.

Photo authority:

- path: `public/Images/Bar.png`;
- bytes: `6,983,037`;
- SHA-256: `b3e6bef5ac4c07050389fad02767b5f007426aa850e16ef4a8fa813b929ae668`.

## 5. Files and external surfaces likely affected

Repository change for this gate is documentation-only. External surfaces:

- Vercel Preview settings scoped exactly to
  `codex/qa-wizard-presentation-dispositions`;
- one new Preview deployment from a clean checkout of reviewed code;
- only `qa.smallheroes.co.il`;
- one new QA Order and its content-addressed generated artifacts.

Pre-operation rollback fences:

- QA alias: deployment `dpl_137gpenMQtXyw8wD4E8rediXwkx1`;
- Production: deployment `dpl_2X7E6d1acZ5vKJVhLSuKFGP5Q4HN`;
- Production target and aliases are excluded.

## 6. Expected behavior

The Wizard uploads Bar's photo, creates a fake-paid Order with the requested
identity and mother narration, resolves the approved Chameleon Visual Package
revision `a9c253d989118262ed2b38a671fc7eccf6af44a084512af35285ad2f548a14fb`,
and completes text, child/companion authority, cover, eight story images,
narration, readiness/package assembly and Reader. Every existing QA gate remains
authoritative. A hold or failure is preserved; it is never manually bypassed.

## 7. Validation plan

### Before deploy or spend

1. Reconfirm exact Git head, Claude PASS, tracked cleanliness and preservation
   of the four unrelated untracked Board artifacts.
2. Query the effective branch Preview environment without printing secrets.
3. Verify the effective Anthropic Vision model through the provider Models API;
   verify required credential/payment dependencies only as booleans.
4. Restore the ordinary product bounds on this Preview branch:
   `CHILD_ANCHOR_MAX_ATTEMPTS=4` and `PAGE_VISUAL_QA_MAX_REGENS=2`; retain
   `ALLOW_STAGING_QA=true` and `GPT_IMAGE_QUALITY=low`. These replace the prior
   proof-only 1/1 caps and do not expand the repository's existing defaults.
5. Build/deploy from a clean temporary checkout so the four untracked Board
   files cannot enter deployment input. Require READY.
6. Run authenticated QA-domain Matrix, product-selection and fake-payment gate
   probes before Order creation. Prove Production deployment remains exact.

### One operational book

1. Use the real Wizard UI, upload the exact tracked photo, and choose the fixed
   inputs above.
2. Create exactly one new Order and complete only fake payment.
3. Observe until `ready`, `needs_human_qa`, `partial`, or terminal failure. Do
   not create another Order or manually retry a terminal path.
4. Record status progression, provider attempts, anchor/cover/page/audio assets,
   diagnostic reasons, source/package/Board bindings and readiness result.
5. If ready, open the real Reader and inspect cover, all pages, text, narration
   presence, identity/companion continuity and sequencing.
6. Give the deployment and immutable runtime evidence to Claude Code for
   post-action audit; Guy retains visual/product acceptance.

## 8. Cost impact

This operation is authorized to spend for one complete LOW book. The nominal
successful path is one accepted child anchor, one cover and eight story images,
plus existing bounded Vision/text/narration calls. The ordinary code permits up
to four child-anchor candidates and two page/cover replacements when QA requires
them. No manual retry, second Order, model/quality escalation or HIGH image is
authorized. Actual calls and cost must be reported from evidence, not inferred.

## 9. Rollback plan

1. Restore `qa.smallheroes.co.il` to
   `dpl_137gpenMQtXyw8wD4E8rediXwkx1` if Preview verification regresses.
2. Restore only this branch's prior proof caps if the QA operation must be
   abandoned; do not touch global Preview or Production settings.
3. Preserve the generated/held Order and artifacts as evidence unless a
   separately approved cleanup is performed.
4. Production requires no rollback because it is never touched.

## 10. Review assignment and stop-check answers

- **General or specific?** General operational proof with fixed test inputs.
- **Could it break another product?** Blast radius is one branch Preview and one
  QA alias; Matrix probes must remain stable before Order creation.
- **Production effect?** None authorized; any Production movement is a hard stop.
- **Spend?** Yes, one bounded LOW book, explicitly authorized by Guy.
- **Smallest safe validation?** Component/one-image proof already exists; one
  eight-beat book is now the smallest proof of the missing end-to-end outcome.
- **Guy decision?** Supplied: Bar photo, name Bar, mother narration, one full
  book. Production launch remains undecided.
- **Claude falsification?** Exact reviewed code, branch env scope/default bounds,
  payment/provider/model preflight, single Order, source/package/Board binding,
  call counts, readiness, Reader, and Production fence.
- **Creative review?** Guy must eyeball the resulting cover and all pages; Claude
  Cowork may advise afterward but is not a technical gate.

## 11. Do not do

- Do not push by implication, promote to Production, or change apex/Production
  aliases, environment, branch or data.
- Do not retry/resume the old failed Order `cmt3hfqkf0002ky04rqrcc05v`.
- Do not create a second Order after this run without a new diagnosis/gate.
- Do not use a real payment provider, real charge, or customer Order.
- Do not weaken or bypass anchor, visual, safety, world or readiness QA.
- Do not manually approve a rejected candidate.
- Do not change model, prompt, quality, threshold, reference, renderer, Story
  Source, Visual Package, Board or current locator to force completion.
- Do not delete or rewrite runtime evidence.
