# Decision Gate — Chameleon accepted-source package promotion

## 1. Proposed change

Record Guy's exact approval of Visual Package Candidate
`31176f576824ca7f3bb56d945c04e460f66c99d576cf6f63d3d2c00e864bfc9d`
and Package Review
`bb6de707e9ae7ca88c46c6b13423ab9065fc999e32239562e5c7e133065eff61`,
finalize the approved package through the existing lifecycle, publish its
immutable revision, and atomically advance only the exact Chameleon current
locator after proving that it still contains the reviewed predecessor bytes.

## 2. Why now?

The neutral accepted Story Source, reconciliation, Blueprint, package
candidate and package review have all received the required product decisions
and independent technical PASS. The Wizard still resolves the historical
female-source package because publication and locator cutover have not occurred.

## 3. Scope

This is a general lifecycle adapter over the existing package approval,
finalization and publication authorities. It adds exact current-locator race
protection, immutable promotion evidence, preview/write/replay and collision
tests. It does not change story, prompt, Blueprint, Board, prop, rendering or
Wizard product semantics.

## 4. Risk of hardcoding

The adapter derives story/style/source/Blueprint/Board/prop identities from the
content-addressed assembly manifest. The approved Chameleon digests are CLI
inputs and evidence, not production-code branches.

## 5. Files likely affected

- Story Source revision package lifecycle and its CLI/spec;
- package publication helper only if exact-locator compare-and-swap must be
  generalized;
- the new approved immutable package revision and current locator;
- `CURRENT.md` and focused implementation evidence.

## 6. Expected behavior after change

Preview derives one exact Package approval, final package revision, locator and
promotion record with zero external calls. Write persists identical approval
and revision bytes, changes only the expected locator, and is idempotent on
replay. Stale locator, conflicting revision, wrong approval path/digest or any
authority drift rejects before locator mutation.

## 7. Validation plan

- exact Guy/canonical-time approval preview/write/replay;
- wrong candidate/review/approver/time and cross-path rejection;
- source predecessor locator and package hash binding;
- stale/racing locator rejection with no revision/manifest advancement;
- conflicting revision rejection before locator update;
- final package qualification and read-only Wizard product selection;
- focused lifecycle, runtime qualification and TypeScript suites;
- dependency/capability scan and full preservation fence;
- independent Claude Code re-gate before QA deployment.

## 8. Cost impact

Implementation, publication, deployment and runtime preflight cost `$0` in
model/image/audio spend. After technical PASS, Guy has explicitly authorized
one full Wizard book render. No image call occurs before the zero-spend deployed
preflight passes.

## 9. Rollback plan

Before deployment, revert the focused publication commit to restore the tracked
locator; the newly written revision is immutable and harmless if unselected.
After deployment, redeploy the reverted locator commit. Preserve the promotion
record and failed/runtime evidence for audit.

## 10. Review assignment

Guy supplied the exact Package approval and explicit authority to proceed until
the Wizard is operational. Claude Code must falsify approval/path binding,
locator race protection, collision atomicity, exact revision bytes, authority
preservation, runtime selection and absence of external capability. No product
or creative decision remains before technical review.

## 11. Do not do

Do not regenerate authoring authority, Story Source, Blueprint, Boards or props.
Do not change prompts, models, budgets, retries, fallbacks, payment semantics or
site design. Do not deploy or render before independent technical PASS and a
provider-free deployed preflight.
