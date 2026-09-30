# Personal book text/storyboard/review runner: Decision Gate

## Goal and owner decision

Guy explicitly instructed Codex to continue implementation while Claude works on
the separate site, with independent QA after completion. Continue in this chat,
sole writer of `codex/personal-book-storyboard-bridge`, base `07d3c8d3` at
`C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes`. Do not edit
Claude's site worktree. The existing-key choice is already explicit; no new key.

## Observed gap / expected behavior

The prior bridge requires externally authored storyboard/review data. Implement
one bounded server-side callable runner using the existing writer, typed whole-book
compiler and exact frame packets. It will execute narrative plan, manuscript,
whole-book visual draft, then a distinct semantic review call, at most once each.
The whole story/ending precede visual planning; all frames precede semantic review.
No new UI or public flow is enabled, and no image provider is connected here.
A new default-off loopback/operator `/api/dev/personal-wizard/book` consumer will
exercise the same runner. Reuse the existing local-access guard with a distinct
settings resolver/rate namespace; keep the old endpoint's policy unchanged.

## Scope, risks and rejected alternatives

General system change. Reuse the writer without modifying its public result or
existing route behavior. One outer process-local ledger reserves all four calls before
provider construction; the writer's internal ledger is subordinate, not extra
spend. Record generate() invocation attempts/usages, including billed failure
responses; these are not acknowledged network dispatch counts.
This is not durable multi-instance spend authority. Reject per-page generation,
detached model-authored hashes, unbounded repair, silent retries/fallbacks and
turning a model-supported report into product/visual/release acceptance.

SDK schema metadata (page order and source/report identities) is supplied by the
engine, not guessed by the model. Semantic review can still be wrong. It must
explicitly assess age, humor, child agency, coping, excluded biography, causality
and source entailment; schema compliance is not proof of these properties.

## Files and order

- Add runner/config and a Responses provider adapter beside personal-wizard modules.
- Add an explicit semantic-review instruction and reuse the existing review schema.
- Extract the existing synthetic test fixture into a non-spec helper for shared
  tests, preserving prior regression assertions. Update spec inventory by two.
- Add the operator route; prove auth, origin, default-off flags, request validation,
  reservation and cancellation precede key/provider access through the real handlers.
- Prove the entire four-stage call path, budget/idempotency/concurrency, cancellation,
  late edits, held reports, usage/error accounting and provider schema boundaries.
- Run tsc, focused tests, full repository check; update CURRENT/ROADMAP; commit.
- Supply Claude a frozen successor range and the prior bridge range still unreviewed.

## Acceptance / compatibility / rollback

Invalid input/settings or exhausted budget must precede provider construction.
The same ledger holds the user lock through all four stages; repeat jobs cannot
spend again in this process. Generate() attempts are distinct from internal
intentions and from acknowledged network dispatches.
No failed or held stage may reach later calls or image generation. Unknown usage
stays unknown; token-derived estimates are not invoices. Renderer/QA packets must
still bind current request, final prose, full plan and supported review exactly.
All results remain diagnostic/runtime-ineligible. Public site/wizard routes,
catalog, anchors, image thresholds, narration, database and checkout are unchanged.
Rollback is a revert of the scoped successor commit, no data migration.

## Cost and stop-check

This milestone costs $0: mocked providers only, no real credential load, live call,
image/audio generation, push or deployment. Rate cards reuse existing repository
settings; no claim of fresh price/model-availability verification for a live run.
Production behavior: unchanged. General regression risk: test compatibility. Prompt
and semantic gate changes: owner intent explicit above; independent QA still needed.
No unresolved product choice is silently broadened. Guy should judge real creative
output later; this milestone only proves execution/holds with synthetic data.
