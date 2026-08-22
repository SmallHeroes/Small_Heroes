# Chameleon accepted-source package assembly — implementation evidence

## Outcome

Guy's exact approval of Blueprint Candidate
`bdde1c154c513275b7b696cc641d692dc6a6dcb7c2b140c26271d1d456bd2bfe`
and Review Packet
`73121a73b6ca2565e7e44351d982bcc0ac49de00c14e4637539092925979a612`
was recorded through the existing Blueprint approval authority. A fresh
Visual Package v5 Candidate and Package Review were then assembled offline from
the accepted neutral Story Source migration.

No provider, image/audio render, Board mint/rebind, prop mint, package approval,
publication, locator update, deployment, Wizard Order, database or storage
operation occurred.

## Immutable source chain

- root: `outputs/r1d-chameleon-source-revision-package-migration-pending-20260822T064826732Z`
- Blueprint migration manifest:
  `ef8d3008069573eee621cecc8710b12d735ebaf0b72bb81028cc706ec9c3d7cd`
- Production Authoring Context:
  `0cc212ea805e53395d9757c04b436ac55527aecc2f434c5a35c5c91dbee80d0c`
- Blueprint authoring authority:
  `6e826abe7f015a8e0987c9ba8d84704ac385180284a2563f2b5a1a6ebb491aec`
- Blueprint Candidate:
  `bdde1c154c513275b7b696cc641d692dc6a6dcb7c2b140c26271d1d456bd2bfe`
- Blueprint Review Packet:
  `73121a73b6ca2565e7e44351d982bcc0ac49de00c14e4637539092925979a612`

## Recorded approval and package artifacts

- Blueprint approval timestamp: `2026-08-22T13:23:57.666Z`
- Blueprint approval digest:
  `34254986eea5d9fddf56d6e96dae5cd8ab53dce0845397d1c4f3b4b85805fe27`
- package Candidate:
  `31176f576824ca7f3bb56d945c04e460f66c99d576cf6f63d3d2c00e864bfc9d`
- Package Review:
  `bb6de707e9ae7ca88c46c6b13423ab9065fc999e32239562e5c7e133065eff61`
- package-assembly manifest:
  `baf92870b9b94b8873e7971647d0e175a3228d2d8a198990893883f1d1a168d7`
- offline qualification:
  `0c4c37effdf7de82923aff40dd1f7abc4f7b382438512dff3e7588b61e6847dc`

The qualification is `candidateValid:true`, `reviewReady:true`,
`approvalValid:false`, and `readyForPublication:false`. Its only reason code is
`package_approval_missing`. This milestone therefore prepares review authority
without self-approving or publishing it.

## Authority preservation

The candidate's complete `requiredBoards` array is byte-equivalent to the
current package and contains exactly two approved Board identities. Its complete
`requiredPropReferences` array is byte-equivalent and empty. No Board or prop
authority was regenerated.

Preservation SHA-256 values after the real write and replay:

- current locator:
  `9d6ea2f84cbee48bb6f671edeea5aee2960328f55f0e3427bd4ee1e916b1cddf`
- current historical package:
  `45145cd59561d5aaf974fc7461a9e026acf0141f811df11de46814685786c38d`
- four pre-existing Board artifacts:
  `8e530b4489c003307d85ebb22fc7125912d94a99809330bb7b7f0d2ef22892db`,
  `bbce002dbee70639dc6651f0aaf85f274b7cf45fac6f99a7041168e75f4c74b3`,
  `a2bff52603b01bef4dfc61c78c9e078e9c2d9adeef35bfbbb2bb94ca3522fbf8`,
  `53e446c9db371fb67e1d851f7c3ecdcf356019a7ef083abd1c97e676820bfe86`

The four Board files remain untracked and unstaged exactly as they were before
this milestone.

## Implementation boundary

`planPreRenderBlueprintApprovalAttestation` separates exact approval planning
from the existing immutable writer. The Story Source revision lifecycle reloads
and revalidates the immutable migration manifest, Blueprint, review,
reconciliation and Production Authoring Context before it can plan or write an
approval.

Package assembly uses the existing `loadApprovedBlueprintLifecycle`,
`assembleVisualPackageV4Candidate`, `persistVisualPackageV4CandidateReview`
and `qualifyVisualPackageV4Candidate` boundaries. Candidate, Package Review and
assembly manifest bytes are all checked for immutable compatibility before any
of those three artifacts is written. A differing same-address artifact rejects
the whole requested write before recreating a deliberately absent manifest.

The CLI exposes only exact key/value modes `approve-blueprint` and
`assemble-package` in addition to its existing offline modes. Approver and UTC
timestamp checks happen before authority loading. The dependency graph has 86
repository inputs, zero `node_modules`, and no provider client, render, database,
storage or credential capability. The one OpenAI-named input is the pure static
structured-output compatibility validator.

## Validation

- `npx --no-install tsc --noEmit`: PASS
- `npm run story:autonomous-typecheck`: PASS
- focused lifecycle matrix: 7 files / 61 tests PASS
- complete `lib/visual-package/__tests__`: 961 PASS / one old 5-second timeout;
  affected QA Bridge file then passed 8/8 assertions in isolation, with only the
  known post-assertion `onTaskUpdate` RPC timeout
- direct immediate-predecessor materialization rerun: 1/1 PASS
- `git diff --check`: PASS
- real preview/write/replay: PASS, byte-identical

Literal `npm run check` is not globally green for pre-existing reasons. The
ordinary phase reported 3,490 PASS, 65 skipped and five failures, all from four
tests that require ignored historical files under `outputs/`. The
resource-intensive phase reported 608 PASS and three load-related timeouts plus
the known worker RPC timeouts; the affected assertions pass in isolated runs.
No new migration or package assertion failed.

## Remaining gate

Claude Code must independently review the immutable commit range. Only after
technical PASS may Guy approve exact Package Candidate
`31176f576824ca7f3bb56d945c04e460f66c99d576cf6f63d3d2c00e864bfc9d`
and Package Review
`bb6de707e9ae7ca88c46c6b13423ab9065fc999e32239562e5c7e133065eff61`.
Publication, current-locator cutover, QA deployment, zero-spend runtime
preflight and the authorized one-book Wizard render remain later boundaries.
