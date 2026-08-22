# Chameleon source-revision reconciliation and Blueprint migration evidence

## Status

Local green on branch `codex/qa-wizard-presentation-dispositions`. This is a
Codex implementation result awaiting independent Claude Code review. It records
Guy's exact reconciliation approval and creates a new Blueprint candidate and
review. It is not Blueprint or package approval and authorizes no provider,
render, locator, deployment or Wizard action.

## Approved input

Guy explicitly approved:

- pending Source Reconciliation
  `601bf27eec36b31a9be1074671715fb3c9868d3d6c9c56dcede57f1b1a77f8d5`;
- pending Migration Review Bundle
  `dada71130f08bd71ffdd81686263ccce29be51d9e9fac8b21be40a0f0b542887`;
- all ten recorded dispositions and documented changes.

The source phase is the independently re-gated manifest
`db14ca61024e125cb63499846e4e56d8043e0103cf2997cbe955b5bb2ed6e184`
under:

`outputs/r1d-chameleon-source-revision-package-migration-pending-20260822T064826732Z`

## Implementation

The general lifecycle:

1. reloads and fully re-derives the pending source-revision migration against
   the exact current locator/package before accepting approval;
2. requires exact Guy, canonical UTC millisecond timestamp, every overall and
   per-disposition review approved, and no unresolved blocker;
3. writes one immutable content-addressed approval only after planning every
   approval/reconciliation/review byte and checking collision compatibility;
4. later reloads that immutable approval without consulting a moved locator,
   validates every bound source/template/coverage/review artifact, and rebuilds
   the complete Production Authoring Context from the approved reconciliation;
5. converts the approved full Blueprint into the exact authoring-draft shape
   and performs one deterministic offline compiler call with zero repairs;
6. rejects any Blueprint content drift except compiler-owned identity/Visual
   Contract authority and one exact reviewed page-8 summary replacement;
7. builds the ordinary Blueprint candidate, provenance, validation evidence,
   review JSON/Markdown/contact sheet and a migration manifest, preflights the
   exact writer byte form, and cross-checks all six returned persisted paths;
8. never approves the Blueprint and exposes no provider implementation.

The canonical Blueprint writer's compact JSON serializer is now exported as a
single byte authority. The migration preflight and writer therefore cannot
disagree about immutable provenance, validation or review bytes; the focused
replay regression specifically falsifies that historical mismatch.

## Real artifact result

Approval:

- approval digest
  `b6a8c144a86bfb1bd0ff6a431cee3149ea07c31a5e68285bba9d0e9364b583dd`;
- approved reconciliation
  `57fdeb0477d8ecda77b55a7dd702845a15d3a3fa6e7a8ce077b3d7ebe3405f78`;
- approved review bundle
  `1288a8c45deb55253ff9a07061029d14f38dcb5027a7fe81d308745231535cac`;
- canonical `approvedAt` `2026-08-22T12:13:27.349Z`;
- exact approval replay returned `created: false`.

Blueprint:

- migration manifest
  `ef8d3008069573eee621cecc8710b12d735ebaf0b72bb81028cc706ec9c3d7cd`;
- Production Authoring Context
  `0cc212ea805e53395d9757c04b436ac55527aecc2f434c5a35c5c91dbee80d0c`;
- candidate
  `bdde1c154c513275b7b696cc641d692dc6a6dcb7c2b140c26271d1d456bd2bfe`;
- authoring authority
  `6e826abe7f015a8e0987c9ba8d84704ac385180284a2563f2b5a1a6ebb491aec`;
- review packet
  `73121a73b6ca2565e7e44351d982bcc0ac49de00c14e4637539092925979a612`;
- changed frames exactly `frame:page:8`;
- first write `created: true`, exact replay `created: false`.

The only content edit is:

- from: `In the cozy bedroom, the child rests on the bed with Kim beside her while the bus and settled stop remain a small quiet echo beyond the window.`
- to: `In the cozy bedroom, the child rests on the bed with Kim beside the child while the bus and settled stop remain a small quiet echo beyond the window.`

The old phrase does not occur in the new candidate. The accepted page-8 source
direction contains `Kim curled beside the child`.

## Validation

- focused lifecycle and Blueprint matrix: 9 files / 173 tests PASS;
- focused new/reused migration core: 4 files / 22 tests PASS;
- `npx --no-install tsc --noEmit`: PASS;
- `npm run story:autonomous-typecheck`: PASS;
- `git diff --check`: PASS;
- real approval write replay: `created: false`;
- real Blueprint write + replay: `created: true`, then `created: false`;
- dependency graph: 83 repository inputs, 0 node_modules, no provider-call,
  render, database, storage or credential-capable input. The static
  `openaiResponsesStructuredOutputSchemaCompatibility.ts` module has no client,
  fetch, credential or external-call surface;
- literal `npm run check`: exact inventory 318 total / 298 ordinary / 20
  resource-intensive. Ordinary: 3,488 PASS, 65 skipped, 5 failures, all five
  pre-existing absent ignored-output fixtures. Resource-intensive: 611/611
  assertions PASS with three known post-assertion Vitest `onTaskUpdate` RPC
  timeouts. The migration spec passed in the full run.

## Preservation fence

Exact SHA-256 values remain:

- current locator
  `9d6ea2f84cbee48bb6f671edeea5aee2960328f55f0e3427bd4ee1e916b1cddf`;
- current approved package bytes
  `45145cd59561d5aaf974fc7461a9e026acf0141f811df11de46814685786c38d`;
- four untracked Board artifacts
  `8e530b4489c003307d85ebb22fc7125912d94a99809330bb7b7f0d2ef22892db`,
  `bbce002dbee70639dc6651f0aaf85f274b7cf45fac6f99a7041168e75f4c74b3`,
  `a2bff52603b01bef4dfc61c78c9e078e9c2d9adeef35bfbbb2bb94ca3522fbf8`,
  `53e446c9db371fb67e1d851f7c3ecdcf356019a7ef083abd1c97e676820bfe86`.

The four Board files remain untracked and unstaged.

## Explicit exclusions

No provider, network, credential, image, audio, database, storage, deployment,
publication, Board, package approval, locator update, Wizard order or render
operation occurred. The Blueprint candidate is unapproved.

## Independent falsification targets

Claude Code should try to falsify:

1. cross-manifest, stale locator/package, wrong digest, non-Guy, timestamp and
   partial-disposition approval rejection;
2. immutable approval reload without accidentally trusting a moved current
   locator or unvalidated persisted reconciliation/review bytes;
3. complete Production Authoring Context reconstruction and exact source,
   template, coverage and reconciliation bindings;
4. any content drift outside compiler-owned identity/Visual Contract authority
   and the exact page-8 narrative pointer;
5. provider reachability, extra compiler calls, repair use or raw draft/error
   leakage from the CLI;
6. planned-versus-written byte/path mismatch, partial writes, collision and
   replay behavior across every Blueprint artifact;
7. any mutation of the current package, locator, accepted Story Source or four
   Board artifacts;
8. any path that treats this candidate as approved or advances package/locator
   authority without fresh exact Guy approval.
