# R1D Wizard Remote QA Full-Book Operational Proof Decision Gate

**Date:** 2026-08-21

**Owner decision:** Guy has instructed Codex to continue until a complete new
story can be created through the Wizard, explicitly authorized a render when
the technical gates permit it, and asked not to pause for routine approvals.
This gate interprets that authority narrowly: one synthetic QA order on one
Preview deployment. It is not Production launch authority.

## 1. Proposed change

Prove the first complete new-story path through the deployed Wizard:

1. bind only the branch
   `codex/qa-wizard-presentation-dispositions` to the staging-QA carve-out;
2. redeploy the exact reviewed branch head and verify its immutable Git SHA;
3. point only `qa.smallheroes.co.il` at that Preview deployment;
4. create one synthetic Chameleon bedtime order through the real Wizard and
   fake-payment path;
5. let the existing chunked pipeline render, persist, QA and assemble the
   complete eight-beat book at `gpt-image-2` LOW quality; and
6. verify the generated order, delivery/readiness evidence and Reader without
   promoting anything to Production.

No authoring, package mint, package locator mutation, Story Source rewrite,
Board change, renderer change or prompt change belongs to this operation.

## 2. Why now?

The repository and exact current Preview already prove that the new Chameleon
Story Source and approved Visual Package are selectable and
production-render-qualified. One LOW page also reached the provider through
that same frozen authority. What has not yet been proved is the operational
boundary from deployed Wizard order creation through the real chunked worker,
remote persistence, readiness gates and Reader. That is the remaining gap
between “the components are connected” and “the Wizard can create a book.”

Production is deliberately not the next step. The deployed Production build
is based on `ed1da86c…`, while this branch is hundreds of commits ahead, and
the historical production-generation quarantine still requires an independent
cutover operation. Promoting this Preview would therefore be an unaudited
release, not a QA proof.

## 3. Scope

This is a general-system operational proof against one approved new-story
package. The Chameleon package supplies the smallest currently qualified
product (eight beats); no Chameleon-specific production branch or special
runtime data is added.

The only intended external mutations are:

- branch-scoped Preview environment settings for the exact feature branch;
- one QA-domain alias assignment, never an apex or Production alias;
- one synthetic fake-paid QA Order and the artifacts generated for that Order;
- the provider/storage/database writes inherently required by that one book.

## 4. Risk of hardcoding

The operation uses the normal Matrix, order resolver, current Visual Package
locator, package-bound Story Source, chunked worker, readiness system and
Reader. The only fixed identifiers are the reviewed package/branch/deployment
identities used to prove that the intended authority ran. No code path may
special-case a story, child, companion, page or revision.

## 5. Files and external surfaces likely affected

Repository changes before the run are documentation-only:

- this Decision Gate;
- `CURRENT.md`;
- `docs/ai-workflow/R1D_WIZARD_V4_PACKAGE_SELECTION_IMPLEMENTATION_EVIDENCE.md`.

Authorized external surfaces after independent pre-action review:

- Vercel Preview environment scoped only to
  `codex/qa-wizard-presentation-dispositions`;
- the exact Preview deployment for the reviewed Git SHA;
- only the `qa.smallheroes.co.il` alias;
- synthetic QA rows/assets belonging to the one test order.

## 6. Expected behavior after the operation

The deployed Wizard offers Chameleon bedtime, freezes the autonomous Story
Source from approved Visual Package revision
`a9c253d989118262ed2b38a671fc7eccf6af44a084512af35285ad2f548a14fb`,
creates a fake-paid synthetic order, and drives the existing chunked pipeline
to a complete eight-page book. The Reader loads the exact book, and persisted
evidence binds the expected source, contract, Home/Town Boards, cover and all
eight page images.

Any identity drift, missing environment dependency, payment-gate mismatch,
provider failure, failed quality/readiness gate, missing artifact, stale
deployment SHA or unexpected Production mutation stops the operation. A held
book remains evidence of a real gate result; it is not silently released.

## 7. Validation plan

### Before external mutation or spend

1. Reconfirm branch/HEAD/upstream parity, clean tracked state and the four
   preserved untracked Board artifacts.
2. Reconfirm the exact Preview is READY and remotely reports Chameleon bedtime
   as selectable and production-render-qualified.
3. Reconfirm current Production SHA/aliases and record them as rollback fences.
4. Reconfirm the staging-QA route is closed before branch configuration.
5. Independently review this gate with Claude Code, read-only.

### Preview setup

1. Add only the branch-scoped QA settings required by existing middleware and
   fake-payment logic. Existing secret values are reused without printing,
   downloading or copying them.
2. Set LOW image quality and cost-bounded QA controls for this branch only:
   one Stage-0 anchor attempt and at most one visual-QA replacement per
   artifact. Do not change provider, model, transport retry or fallback code.
3. Redeploy and prove READY status, exact Git SHA and branch-only environment.
4. Assign only `qa.smallheroes.co.il`; prove apex and Production aliases did
   not move.
5. Re-run the remote Matrix and fake-payment gate probes before creating data.

### One operational book

1. Use a synthetic child name/profile and a synthetic or explicitly
   QA-authorized image; no customer or unrelated personal data.
2. Traverse the real Wizard, create the order, and confirm only the fake
   payment.
3. Observe the worker until it reaches `ready`, `needs_human_qa`, `partial` or
   a terminal failed state. Do not dispatch a second order.
4. Record provider attempts, generated assets, retries/regens, storage and DB
   identities, quality/readiness results, and exact source/package/Board
   bindings.
5. If ready, open the real Reader and inspect cover plus every story page. If
   held, preserve the evidence and diagnose before any additional paid run.
6. Return the generated book to Guy for visual/product acceptance and then
   give Claude Code the immutable artifact/deployment range for post-action QA.

## 8. Cost impact

Provider-free setup costs $0. The normal nominal successful path is:

- one LOW Stage-0 child-anchor image (the branch is capped at one attempt);
- one LOW cover image;
- eight LOW story-page images;
- the pipeline's existing bounded visual-QA and narration calls.

That is **10 nominal LOW image generations**. The branch-only visual-QA cap
allows at most one replacement for each cover/page artifact; provider/runtime
transport errors remain governed by existing visible retry logic. No retry,
replacement or second order is initiated manually. Exact observed calls and
costs must be reported from the resulting evidence, not inferred from caps.

## 9. Rollback plan

1. Restore `qa.smallheroes.co.il` to the exact deployment recorded immediately
   before the operation.
2. Remove only the environment entries scoped to this feature branch and
   redeploy if necessary.
3. Leave the failed/held synthetic order and its content-addressed artifacts as
   auditable QA evidence unless a separately approved data-cleanup operation
   removes them.
4. Repository rollback is unnecessary unless the Preview exposes a code defect;
   this gate itself changes no runtime code.

Production aliases, Production environment and customer data are never part of
the rollback because they are never part of the operation.

## 10. Review assignment

Guy has already approved the product goal, one full QA render and use of the
new story. Guy must eyeball the complete generated book and Reader before any
claim of product acceptance.

Claude Code must try to falsify, before the run:

- that the target deployment is the exact reviewed SHA;
- that every environment mutation is branch-scoped Preview-only;
- that the QA alias move cannot affect apex/Production;
- that fake payment cannot reach a real payment provider;
- that the order resolves only the approved package-bound Story Source;
- that the intended cost controls are effective and do not disable readiness;
- that no second order/retry is implied by failure.

After the run, Claude Code must independently audit the deployment, Order,
provider-call counts, source/package/Board bindings, generated artifacts,
readiness result and Reader. Claude Cowork is optional for visual/product
critique; it is not a technical gate.

## 11. Stop-check answers

1. **General or specific?** General operational proof using the smallest
   currently qualified new-story product.
2. **Could it break another product?** Branch-scoped QA settings and a QA-only
   alias minimize blast radius; Matrix/API rechecks must show other slots are
   unchanged.
3. **Production effect?** None authorized. Any Production drift is a hard stop.
4. **Spend?** Yes: one bounded LOW full-book QA order.
5. **Smallest safe validation?** The one-page proof already passed; one complete
   eight-beat book is now the smallest proof of the missing operational chain.
6. **Guy decision?** Already supplied for this QA-only proof; Production launch
   remains undecided.
7. **Claude falsification?** Exact SHA/scope/payment/source/cost/evidence and
   no Production mutation, as listed above.
8. **Creative review?** Optional after rendering; not needed before wiring QA.
9. **Guy eyeball?** Cover, all eight images, text, continuity, child/companion,
   scene identity, Reader sequencing and overall book quality.

## 12. Do not do

- Do not promote or deploy this 557-commit-ahead branch to Production.
- Do not change apex/Production aliases, Production branch or Production env.
- Do not enable a real payment provider or use a real card/payment record.
- Do not use customer data or an unconsented child photo.
- Do not modify the Story Source, Visual Package, current locator or Boards.
- Do not change image model, prompt, renderer, retry/fallback policy or quality
  threshold to make the run pass.
- Do not create a second paid QA order after failure without a new diagnosis
  and an explicit follow-up gate.
- Do not release a safety/world/readiness hold merely to show a completed book.
- Do not delete or rewrite runtime evidence after the run.
