# R3-B0b QA Story Source / Visual Direction Review Batch — Decision Gate

Date: 2026-09-02
Product owner: Guy
Technical owner: Codex
Implementation branch: `codex/r3b0b-story-source-review-batch`
Worktree: `C:\GNart\Work\sh-r3b0b-story-source-review`
Base: `68795de8c519f1260e01737582165cbe0ec75433`
Milestone: R3-B0b, zero-cost candidate preparation only

## 1. Approved outcome

Prepare one deterministic, content-addressed review batch for every current
Wizard slot whose R3-A report still requires a V3-versus-QA product-source
decision. Guy selected the QA corpus as the review starting point and decided
to preserve all six fantasy stories at 16 beats.

The current repository derives exactly 17 such slots. The already accepted and
render-qualified `chameleon_koko_bedtime` lineage remains outside the batch by
predicate, not by a hand-written 17-key exception list. The batch is evidence
for independent technical review, Claude Cowork review where required, and
Guy's later exact product review. It is not acceptance or publication.

## 2. Observed state and root cause

- `wizard-all-story-render-readiness/v1` reports 18 nominal Wizard slots, 18
  QA LOW-ready candidates, and one strict accepted/render-qualified slot.
- The remaining 17 rows stop first at `product_source_corpus_unconfirmed`:
  their V3 and QA bytes differ and no strict accepted revision selects the QA
  pair.
- Each QA `.md` is an integrated projection: removing its one
  `imageDirection` line per page reproduces the top-level accepted `story.md`
  bytes exactly. Its import sidecar binds the same accepted source, typed
  Visual Direction record and generation receipt.
- The QA candidate v2 validates its own normalized Story Source identity and
  adjacent QA inputs, but it does not itself load and raw-byte-verify the
  accepted manifest named by the sidecar. A normalized text digest also cannot
  alone detect raw EOL or Unicode-byte changes.
- The historical 17-story review corpus is not today's unresolved set: it
  excludes `dragon_dini_adventure` and includes `chameleon_koko_bedtime`.
  Reusing it would select the wrong 17.
- Existing source-revision and Visual Direction publication lifecycles are
  shaped around a creative-replacement/gender-migration parent. Using them for
  this milestone would turn corpus selection into unapproved story rewrites.

The missing system is therefore an exact, raw-byte-bound review-batch
materializer—not new stories, a production fallback, or a relaxed gate.

## 3. Scope

Add a general review-batch module and operator CLI that:

1. runs the canonical all-story readiness audit and loads the validated QA
   catalog;
2. derives only rows with `sources.corpusDecisionRequired === true`, requires
   the complete 18-slot matrix and exactly 17 unique selected rows, and sorts
   them canonically;
3. for each selected row safely reloads and raw-SHA-binds the QA candidate,
   QA integrated story, import sidecar, top-level accepted manifest/story and
   product-acceptance evidence, Visual Direction record, receipt, and the
   storyboard-corpus manifest/record;
4. proves that the integrated story's exact source projection equals the
   accepted story bytes and that every identity, path, page count and digest
   agrees across the chain;
5. verifies the tracked editorial-review snapshot stored beside every accepted
   Story Source, records the manifest's upstream `sourcePath` only as opaque
   provenance, and never probes that upstream path because Dini adventure
   points to a legitimately absent ignored output;
6. carries current narration-preflight findings as review evidence without
   calling them human narration acceptance;
7. emits one candidate digest per row and one digest for the sorted batch;
8. defaults to dry-run and can optionally write one immutable canonical JSON
   artifact only beneath `outputs/`; identical replay is idempotent and any
   conflicting existing bytes fail closed.

A small tracked review-request JSON records the already-made owner choices
(QA corpus, 16-beat fantasy preservation, required count 17) and the explicit
`lion_shaket_adventure` Claude Cowork story-review requirement. It does not
enumerate the 17 selected keys and does not contain a product acceptance.

## 4. Explicit exclusions and unchanged behavior

This milestone does not:

- rewrite or gender-migrate any of the 18 Story Sources;
- edit any Visual Direction, QA candidate, accepted revision, Visual Contract,
  Blueprint, Board, prop reference, Visual Package or locator;
- create Guy or Claude approval, publication, runtime eligibility or a
  production-current pointer;
- call a credential, network/provider, image/audio/PDF renderer, database,
  storage service, order, payment, deployment or production flag;
- lower or bypass the per-page resemblance threshold of `0.70`;
- reuse source-stale adjacent V3 visual artifacts;
- fix narration in this batch. `fox_uri_fantasy`'s critical unpointed `ספר`
  findings and all soft TTS review items must remain visible for a later
  narration correction/review gate.

`chameleon_koko_bedtime`'s accepted source revision, current package and
locator must remain byte-identical.

## 5. Risks and controls

- **Wrong 17:** derive from the complete matrix/readiness predicate, require
  17, reject missing, duplicate or extra identities, and sort arbitrary input
  enumeration into one canonical ASCII story-key order.
- **Normalized-digest blind spot:** bind every input's raw bytes, size and
  SHA-256 in addition to embedded canonical/normalized digests.
- **Cross-story splice:** require exact story key, companion, category,
  direction, page count and paths across every manifest/sidecar/candidate/
  corpus record.
- **Mutable or aliased filesystem input:** accept canonical repository-relative
  paths only; reject escape, symlink/reparse aliases, hard links, non-regular
  files and oversized inputs.
- **Historical evidence overclaim:** byte-verify the tracked accepted snapshot,
  keep its upstream source locator opaque and non-required, and never treat
  either as a substitute for the new exact product/visual review.
- **Accidental authority escalation:** closed status, runtime-ineligible reason,
  zero-effect counters and exclusions are digest-bound; the CLI exposes no
  accept or publish command.
- **Artifact overwrite:** write to a content-addressed path under `outputs/`,
  use exclusive/atomic creation, permit only byte-identical replay, and reject
  collisions.

## 6. Rejected alternatives

- Hard-code today's 17 story keys: it would drift from the matrix and could
  silently omit a future unresolved row.
- Reuse the historical 17-story corpus: it contains the wrong present-day
  membership.
- Promote the QA catalog or old accepted story manifests directly: neither
  grants Visual Direction or strict v3 source authority.
- Run the existing gender/source revision lifecycle for all 17: that performs
  unapproved creative changes and is outside this gate.
- Treat stale adjacent V3 Visual Contracts or location artifacts as reusable:
  they bind different source bytes.

## 7. Acceptance criteria

- Real-repository preparation yields exactly 17 unique records derived from
  the complete 18-slot matrix, excludes exactly the already-resolved row, and
  preserves six 16-page fantasy candidates.
- Every record proves exact source projection and binds all present input bytes
  with raw SHA-256; all embedded hashes/digests and identity fields agree.
- The same inputs yield byte-identical record and batch digests independent of
  wall clock, Git HEAD, current working directory and record enumeration order.
- Missing/swapped/tampered manifests, source, sidecar, candidate, direction,
  receipt or corpus records fail closed, including raw EOL/Unicode changes.
- Path escape, symlink/reparse alias, hardlink, non-file, oversized input,
  output escape and conflicting replay fail closed.
- Dry-run writes nothing. Optional write creates one content-addressed
  canonical JSON artifact and exact replay does not rewrite it.
- `lion_shaket_adventure` is marked pending Claude Cowork story review and
  later Guy exact acceptance. Narration findings remain visible.
- Chameleon accepted/package/locator bytes and all 18 story/direction files are
  unchanged.
- `npx tsc --noEmit`, relevant focused tests, adjacent lifecycle/readiness
  regressions, `git diff --check`, and `npm run check` are run and reported
  honestly. Claude Code independently reviews the immutable implementation
  range before technical PASS.

## 8. Cost and render allowance

Provider calls: 0. Image renders: 0. Audio renders: 0. PDF renders: 0.
Database/storage/order/payment/deployment writes: 0. Maximum spend: USD 0.

Any Visual Contract/Blueprint authoring or Board/prop image generation remains
a later, separately budgeted Decision Gate. A full-book render is not
authorized.

## 9. Rollback

Revert only the focused R3-B0b implementation commit. The optional ignored
artifact can be removed separately after its exact path and digest are
recorded; it carries no runtime or publication authority. No locator or
production rollback is required because none is touched.

## 10. Stop-check

1. General solution? Yes: matrix-derived review batching with per-record data,
   not story-specific runtime logic.
2. Could it affect another story/companion/style? Only through read-only
   validation; exact 18/17 and six-companion coverage are mandatory.
3. Production impact? None.
4. Spend? None.
5. Smallest safe proof? One real exact-17 dry-run/write/replay plus hostile
   fixture tests; no render.
6. Unresolved owner decision? None for candidate preparation. Exact candidate
   acceptance and later paid waves remain pending.
7. Claude Code falsification targets? Membership, source projection, raw-byte
   binding, cross-story swaps, filesystem safety, determinism, output
   immutability and authority non-escalation.
8. Claude Cowork? Required for `lion_shaket_adventure` story quality before
   Guy's exact acceptance; optional elsewhere unless Guy requests it.
9. Guy eyeball gate? The exact batch candidates and their Visual Directions,
   before any acceptance/publication.
