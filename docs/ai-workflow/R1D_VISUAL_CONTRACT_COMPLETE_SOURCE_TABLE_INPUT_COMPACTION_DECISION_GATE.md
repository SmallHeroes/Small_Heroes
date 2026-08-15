# R1D Visual Contract complete-source-table input compaction — Decision Gate

## 1. Proposed change

Stop sending Story Source prose twice in the initial Visual Contract authoring
prompt. The existing source-evidence catalog is complete and already carries
every exact non-whitespace prose span. Project its ordered page, evidence ID and
excerpt fields as the sole Story Source presentation and remove the second
`FULL STORY TEXT` copy. Byte offsets and explicit ordinals remain compiler-owned
catalog authority; the provider never emits or consumes them.

## 2. Observed and expected behavior

The new `lion_shaket_adventure` source produces a conservative initial input
upper bound of 69,670 against the unchanged 64,000 ceiling. Its evidence table
is 26,312 UTF-8 bytes and the same prose is repeated again as 9,645 bytes of
page-marked text. B0 therefore rejects the request before credential or provider
reachability. A valid 12-page Story Source is expected to materialize below the
existing ceiling with safety headroom.

## 3. Root cause and contributing factors

The source-evidence catalog was introduced after the full-prose prompt. The
catalog deliberately preserves exact source identity for every sentence/line,
but the older full-prose block remained. Rich new stories contain more evidence
entries, so the duplicate representation now consumes the remaining headroom.

## 4. Scope and generality

This is a deterministic prompt projection change for every Story Source. It
does not special-case Leo, a companion, category, child, page, or language
literal. Story bytes, evidence IDs, excerpt order, image directions, compiler
validation and persisted contract semantics remain unchanged.

## 5. Rejected alternatives

- Raising the 64K ceiling would weaken the approved spend/input fence.
- Truncating prose or image directions would lose authoring authority.
- Shortening evidence IDs or remapping them would change draft/schema identity.
- Rendering directly from the QA storyboard would bypass Visual Contract and
  Blueprint qualification.

## 6. Versioning and migration

Only the initial user-prompt authority version and digest advance. The full
source-evidence serializer used by bounded repair remains unchanged. Existing
requests/receipts/readiness remain immutable historical evidence and cannot be
re-digested into current authority. Schema, model, system prompt, repair prompts,
budgets, retries, fallback and timeout remain unchanged.

## 7. Acceptance criteria

1. The table round-trips every exact excerpt plus page/order/ID identity; the
   canonical catalog retains offsets and explicit ordinals.
2. The prompt states that the ordered table is the complete Story Source.
3. No second full-prose copy is present.
4. Every new 8/12-page QA source is at or below 64K with useful headroom; Leo
   clears the ceiling without provider reachability.
5. A synthetic genuinely oversized input still fails closed.
6. Prior prompt authority is rejected after canonical re-digest.

## 8. Validation and rollback

Run the prompt compaction, materialization and lifecycle suites, TypeScript and
`git diff --check`. Rollback is a focused revert of the prompt/test commit;
the failed readiness artifact remains immutable evidence and grants no authority.

## 9. Boundaries

No story edit, schema/model/service-tier/budget/timeout/retry/fallback change,
credential access, provider call, image render, audio, Production deployment or
payment action is authorized by this correction itself. After a green commit
and push, create a fresh output root and new readiness identity before any live
authoring attempt.
