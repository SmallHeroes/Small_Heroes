# Decision Gate — Wizard no-photo anchor and accepted UI restoration

Status: approved by Guy in this task on 2026-08-21. Implementation may start; paid QA remains gated on local green and independent Claude Code PASS.

## 1. Proposed change

Deliver two isolated corrective milestones on `codex/qa-wizard-presentation-dispositions`:

1. Make the advertised Wizard "continue without a photo" path create a canonical Style 01 child anchor from the approved gender template, the locked child description, the story wardrobe, and character-free Style 01 references. The anchor must pass semantic and style QA, carry `generated_story_anchor` provenance, and make no photo-likeness claim.
2. Restore the previously accepted Landing and Wizard presentation from immutable design commit `1dc555396065cee9724fa530bc17c262901e8c35`, while retaining all newer Visual Package, Story Matrix, checkout, fake-payment, and generation behavior from the current branch.

## 2. Why now?

The first real fake-paid QA order reached text/DNA and then failed before cover generation with `ANCHOR_GATE_BLOCK` because no-photo orders never create a child anchor. Separately, the current QA deployment comes from the functional branch and therefore shows an older Landing/Wizard design instead of the design Guy accepted. Both block a truthful end-to-end Wizard proof.

## 3. Scope

General system changes:

- all current sellable Style 01 Wizard orders without a child photo;
- canonical anchor generation, bounded QA, persistence, and crash recovery for that identity mode;
- Landing/Wizard presentation only, restored from the accepted design authority;
- no story-, child-, companion-, page-, or Chameleon-specific runtime exception.

## 4. Risk of hardcoding

The no-photo branch is selected from order facts and the existing Style 01 template contract, never from story key or child name. UI restoration is commit-bound and presentation-scoped. Functional JavaScript and current server routes are reconciled rather than replaced by old copies.

## 5. Files likely affected

Anchor milestone:

- `lib/generation-pipeline/stage0-method-b.ts`
- `lib/generation-pipeline/chunk-runner.ts`
- `lib/generation-pipeline/types.ts`
- `lib/generation-pipeline/stage0-candidate-recovery.ts`
- focused Stage-0 and recovery specs

UI milestone:

- accepted Landing App Router components/styles/assets;
- legacy Wizard HTML/CSS and only the minimum reconciled JS required for presentation;
- no reader or unrelated legacy-page restoration.

State/evidence:

- `CURRENT.md`
- implementation evidence and Claude Code handoff

## 6. Expected behavior after change

- Photo orders keep the current photo-based anchor lane and resemblance policy unchanged.
- No-photo Style 01 orders generate one bounded template/description anchor attempt in the QA deployment, reject semantic/style failures, and persist a passed canonical anchor with `source: generated_story_anchor` and no resemblance score or threshold.
- A durable generic candidate recovers with the same provenance and may proceed only when its semantic/style evidence passed.
- Cover and page generation continue to require the same approved canonical child anchor.
- Landing and Wizard visually match the accepted design, while current Story Matrix/Visual Package selection and checkout behavior remain operational.

## 7. Validation plan

Before any new paid order:

1. Pure/unit tests for exact no-photo reference order/mode, prompt privacy and semantics, provenance, QA rejection, recovery, and unchanged photo behavior.
2. Focused Wizard, Matrix, Visual Package, checkout, and route tests.
3. `npx tsc --noEmit`, Next production build, repository check (with any pre-existing infrastructure failures identified exactly), and `git diff --check`.
4. Browser verification of Landing and Wizard across desktop/mobile sizes without creating an order.
5. Two focused local commits, then an immutable read-only Claude Code adversarial review/re-gate.
6. Only after Claude PASS: deploy the reviewed commit to QA and create exactly one fresh Chameleon bedtime order through the Wizard, fake-pay it once, and observe one complete eight-page book.

## 8. Cost impact

Implementation and all pre-deployment proof are $0. The eventual approved QA proof may generate one generic child anchor, one cover, and eight pages at LOW quality, plus only the already configured bounded QA replacement allowance. No retry of the failed order and no second live order without a new root-cause decision.

## 9. Rollback plan

Keep anchor and UI restoration in separate focused commits. Either can be reverted independently. The existing failed order remains immutable evidence. No database migration or destructive artifact rewrite is introduced.

## 10. Review assignment

Guy has approved the product intent, no-photo behavior, restoration of the accepted design, and one post-PASS QA book proof.

Claude Code must try to falsify:

- a no-photo order can still reach cover without an approved anchor;
- generic anchors can be mislabeled as photo-derived or carry invented likeness scores;
- semantic/style failures or failed cached candidates can be promoted;
- photo orders, Style 02, reference ordering, or production policy changed;
- UI restoration overwrote current Visual Package/Matrix/checkout logic;
- stale design assets, mobile breakpoints, inaccessible controls, or server/client build errors remain;
- QA deployment or the eventual run mutates Production.

Guy must visually inspect the restored Landing/Wizard and the resulting QA book before product acceptance.

## 11. Do not do

- Do not retry or mutate order `cmt3di8sh0002kw04wmkodr48`.
- Do not create another order before local green and Claude Code PASS.
- Do not touch Production, deploy to Production, or alter Production environment variables.
- Do not weaken the anchor gate, fabricate resemblance evidence, expand image budgets, change model/quality policy, or add fallback/retry behavior.
- Do not merge the accepted design branch wholesale or overwrite current functional Wizard JavaScript with its older version.
- Do not touch, stage, or delete the four pre-existing untracked Set Board artifacts.
