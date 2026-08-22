# Decision Gate — Chameleon accepted-source package assembly

## 1. Proposed change

Record Guy's exact approval of Blueprint Candidate
`bdde1c154c513275b7b696cc641d692dc6a6dcb7c2b140c26271d1d456bd2bfe`
and Review Packet
`73121a73b6ca2565e7e44351d982bcc0ac49de00c14e4637539092925979a612`,
then assemble a fresh Visual Package candidate and package review offline.

## 2. Why now?

The neutral accepted Story Source, migrated Visual Contract, approved
reconciliation and fresh Blueprint have all passed independent QA. The current
locator still points at the historical female-source package, so Wizard runtime
cannot use the corrected authority until a new package is reviewed and later
approved/published.

## 3. Scope

Reuse the existing Blueprint approval writer and Visual Package v5 lifecycle.
Add only a source-revision adapter that reloads the immutable migration chain,
binds the exact Blueprint approval, assembles candidate/review artifacts and
proves that Board/prop authorities remain byte-identical.

## 4. Explicit exclusions

No provider, image/audio render, Board mint/rebind, prop mint, package approval,
publication, locator update, deployment, Wizard order, database or storage
operation.

## 5. Acceptance criteria

- exact Guy/canonical-time Blueprint approval with preview/write/replay;
- Blueprint approval cannot be substituted across migration manifests;
- package candidate validates against the new source/template/reconciliation;
- required Boards and prop authorities exactly equal the current package;
- offline qualification is candidate-valid and review-ready but fails closed
  only on missing package approval;
- all candidate/review/manifest bytes are preflighted before any write;
- real write and exact replay are immutable and content-addressed;
- package, locator, accepted source and four Board preservation hashes remain
  unchanged;
- dependency graph contains no provider/render/database/storage capability.

## 6. Rollback

Revert the focused code commit and ignore the fresh gitignored package-candidate
artifacts. No approved/current authority is modified by this milestone.

## 7. Next gate

Claude Code independently re-gates the immutable commit range. Only after PASS
does Guy approve the exact package candidate/review. Publication and locator
cutover remain a separate final authority boundary.
