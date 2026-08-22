# R1D accepted-revision runtime Story Source selection — implementation evidence

## Outcome

Fresh and resumed Wizard Orders can now rehydrate the exact immutable Story
Source selected by a current Visual Package when that source is a nested
product-accepted revision. The correction is provider-free and does not alter
the frozen product contract, database schema, package format or legacy Story
Bank bytes.

## Verified root cause

- Order creation already persisted the package source as an exact repo-relative
  path plus raw SHA-256.
- `resolveFrozenOrderStorySelection` admitted only the old three-segment Story
  Bank form, so the accepted nested path returned `null` and text finalization
  could invoke the old companion selector.
- `ensureFrozenVisualContract` and render qualification derived the package key
  from the basename, which would turn `integrated.md` into `integrated`.
- Vercel output tracing included Story Bank and Visual Package authority but not
  the product-accepted revision tree, so deployed functions were not guaranteed
  to contain the selected source.

## General correction

1. The runtime parser accepts only:
   - `story-bank/<bank>/<storyKey>.md`; or
   - `story-pipeline/04_approved_story_sources/accepted/<storyKey>/revisions/<64-hex>/integrated.md`.
2. It returns the exact repo-relative reference, explicit story key, authority
   kind and revision digest. Accepted paths reject whitespace, backslashes,
   wrong basenames, malformed keys/digests, extra segments and traversal.
3. Runtime file validation requires an ordinary single-link file whose real
   path remains inside the repository root. Every intermediate component is
   checked, so an in-repository junction/symlink alias is rejected too.
4. Text finalization always prefers a valid frozen Order reference over stale
   cache, compares path/raw SHA/product version/page expectation before loading,
   rejects accepted-source cache state that lacks exact Order authority, and
   durably closes Order/Job status on any pre-load authority failure.
5. Contract freeze and render qualification use the centralized runtime story
   key. An explicit key/source-kind must agree with the exact source reference;
   the accepted story key must also equal the Wizard companion/direction slot;
   both Stage-0 anchor branches use the same key for wardrobe authority;
   historical caches retain their basename fallback except for reserved
   `integrated.md` without accepted-revision authority.
6. Relevant Vercel matrix/order/generate/worker/cron/resume/preflight/regeneration
   functions include the accepted revision tree in output tracing. The actual
   pre-order `/api/wizard/product-truth` route includes both the current package
   tree and accepted source tree plus its bounded legacy fallback inputs.

## Falsification evidence

- exact legacy and accepted paths pass;
- traversal, malformed digest, wrong basename, extra segment, noncanonical
  separator and leading whitespace fail;
- hard-linked source and parent-junction realpath escape fail;
- raw-SHA drift fails before `loadStoryFromBank` and before legacy selection;
- a malformed accepted Order ref and cache-only accepted source both fail before
  the old QA-bank selector;
- an accepted-authority marker combined with only a legacy-bank cache path
  fails closed, and a cross-slot companion/direction binding is rejected;
- both an escaping parent junction and an in-repository parent junction are
  rejected;
- a stale resume cache is ignored in favor of the exact Order source;
- render qualification uses the explicit accepted-revision story key rather
  than `integrated`;
- Bar-boy and Bar-girl each load eight pages from the accepted source, resolve
  every gender chip, and make zero `fetch` calls.

## Validation

- final focused source/path/tracing/Stage-0 matrix:
  **7 files / 50 tests PASS**;
- broader runtime/order/freeze/Story Source matrix:
  **22 files / 209 tests PASS**, **2 files / 2 tests skipped**;
- `npx --no-install tsc --noEmit`: PASS;
- `npm run story:autonomous-typecheck`: PASS;
- `git diff --check`: PASS.

Before the corrective micro-diff, one literal `npm run check` completed with the repository's known non-green
baseline: ordinary **3,475 PASS / 65 skipped / 5 failures**, all from four
absent ignored-output fixtures; resource-intensive **609 PASS / 2 timeouts**
plus three `onTaskUpdate` RPC timeouts under parallel load. Both timed-out files
then passed all **29/29 assertions** with one worker; that isolated process still
reported one post-assertion RPC timeout. The complete corrective range then
passed all 209 broader assertions, all 50 final focused assertions, both
TypeScript checks and diff-check. No test
assertion in this milestone failed.

## Boundaries and next gate

No provider, image, audio, render, Vision, network, credential, database,
storage, deployment, package migration, approval, publication or locator action
occurred. Historical Story Sources, the accepted revision, packages, locators
and four untracked Board artifacts remain outside this diff.

Claude Code must independently review the immutable implementation range before
the deterministic package migration begins. That next milestone must rebind all
source-evidence identities, rebuild reconciliation and Blueprint (including the
explicit page-8 `Kim beside her` correction), prove both Board hashes unchanged,
and obtain the new exact Guy approvals before publication.
