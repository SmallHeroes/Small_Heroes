# Claude Code — personal literary-editor milestone, independent review

## Requirement and immutable range

Guy requested a personal story worth rereading: personal stakes, felt child
experience, kind concrete humour, creative but intelligible fantasy, purposeful
movement, an active child and a companion with its own wants. He authorised a
literary-edit stage before visuals, reuse of the existing key, and GPT-6.1 if not
materially more expensive. This is not permission to self-award creative or
release acceptance.

Review first pass READ-ONLY, against exactly:

- Worktree: `C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes`
- Branch: `codex/personal-book-storyboard-bridge`, local, no upstream
- Base: `2da203c20f4971635c9200c9efa282d15207fe42`
- Code head: `5f3ba39c120cfeb4f1a88a9ea97f7b5618ef6063`
- One implementation commit, 26 paths, +859/-71, clean after commit.
- A disclosed Markdown-only successor adds this handoff and its CURRENT link.
  Freeze the code head, not a moving HEAD. No other task writes to this worktree.

Before handoff the protected worktrees remained clean at `768ccb2f` (d53b)
and `63ccb484` (accepted-intent-wave-2). Claude's site worktree remained clean at
`86ca47e8`; personal-site-qa at `86f1bb58`, prototype at `fd2b26bd`, reviewer at
detached `806ce4d7`, release QA at `41359878`. Their branches were not edited.
No push/deploy. Earlier bridge/code review boundaries are NOT expanded here.

## Implementation claims to falsify

1. Active diagnostic book flow is plan -> manuscript -> ONE literary editor ->
   storyboard -> semantic review. One outer reservation/user lock, at most five
   provider-method invocations; no retry. All five use the explicitly selected
   model. The standalone two-call draft writer stays a compatible diagnostic.
2. Editor returns a complete revised outline and manuscript plus six named model
   observations. Original outline/prose survive immutable-by-value in the result.
   Engine computes draft/final/plan bindings, validates current approved request,
   count/order, allowed fact IDs, exclusions and resilience mode. These structural
   guards do not prove that prose entails every approved fact or is good literature.
3. Any editor `needs_work` stops before both visual calls, preserves revised text
   as partial diagnostic output, and charges the attempted calls without refund.
   Failed editor retains original draft. Changed/cancelled parent request never
   receives stale partial text. Complete v2 browser envelopes require the edited
   contract; legacy unedited drafts remain partial/offline only.
4. Storyboard uses revised final prose; editing receipt participates in its source
   digest. Existing legacy offline source-digest behaviour is unchanged. Edited
   held results cannot bypass the hold via direct offline storyboard preparation.
5. Exact `gpt-6.1-sol` is explicitly priced/allowed at $2/M input, $10/M output,
   the same base rates as GPT-6 Sol, verified against official model pages.
   No implicit upgrade/alias/fallback, tier attestation or cached-discount claim.
   Editor caps 16k/18k/20k include reasoning, reservations .3168/.3388/.3608.
   Full Sol/6.1 jobs reserve 2.1186/2.3496/2.6356. Even short Astra exceeds the
   existing $10 hard cap. Cap is not raised and rejection precedes key access.
6. Separate text-only experiment is a fixed one-shot root with $3 ceiling,
   $2.838 reservation, at most ten invocations, no alternate root, retries or
   resumed/reset old pilot. Key is memory-only; final implementation parses only
   its one key assignment, no copied env/credentials. Future error capture is
   bounded allowlisted metadata, not raw exceptions. Historical failure was NOT
   reclassified or its unknown usage reconstructed.

Main files: new story-editor contract/compiler/SDK adapter; story writer/config;
book runner/config/adapter/preview/route; storyboard binding; new editor/SDK/trial
specs and bounded trial script. Fixture extraction and adapter inventory preserve
the old tests rather than dropping assertions. Decision Gate is in the adjacent
`PERSONAL_STORY_EDITOR_DECISION_20261001.md`.

## Verification actually performed

Final focused run: 14 files, **360/360**, native exit 0. Breakdown:

| Spec | Tests |
| --- | ---: |
| story-editor | 37 |
| story-editor-openai | 14 |
| story-editor-trial | 10 |
| book-runner | 82 |
| book-routes | 32 |
| book-preview | 15 |
| storyboard | 60 |
| story-writer | 38 |
| story-openai | 19 |
| story-routes | 17 |
| request-acceptance | 9 |
| generation-deadline | 13 |
| prototype-boundary | 7 |
| vitest-workload-classifier | 7 |

Final `npx tsc --noEmit` native 0; staged `git diff --check` clean.
Logs: `outputs/personal-story-editor-validation-20261001/`.

Two full `npm run check` runs: **both native 1 / RED**.
First ordinary: 11 failures, 5334 passed, 73 skipped. One newly required adapter
inventory update was corrected; ten familiar missing-fixture failures remained.
First resource: 635/635 tests passed but three onTaskUpdate RPC errors.
Second ordinary: ten failures, 5338 passed, 73 skipped. Resource: 632 passed,
three timeouts and three RPC errors. Timeout specs: canonical-pre-live-readiness,
live-execution-supervisor, qa-wizard-candidate-bridge. No timeout was raised.
Final prompt-mapping/failure-metadata follow-ups have focused/typecheck evidence,
not a third full check. Matching historical failure names do not prove independence
or causal origin; repo stability is not closed.

Read-only one-shot negative control imported `main()` with execute plus a
nonexistent key path. It returned `trial_already_claimed`, native 1, ledger hash
unchanged. A prior attempt through tsx's external `--env-file` flag instead failed
in the launcher (native 9), and is NOT evidence of the script's root guard.

## Live creative evidence, not an excellent-engine claim

Separate synthetic experiment requested GPT-6.1 Sol Medium. Six measured
completions produced two original+edited pairs (8 and 12 spreads). Seventh method
invocation, the 16-spread profile's plan, failed without reported usage.
Known usage estimate **$0.280328**; total **unknown**, not an invoice. Reservation
$2.838 is NOT a charge. No retry, 16-spread result, comparison call, image or audio.
Original adapter failure metadata was not retained, so cause is still unknown.

I read both complete originals and revisions. BOTH raw drafts had correct item
counts yet covered only early outline beats and stopped at an unresolved midpoint.
The editor completed both plots. This is consistent with spread/display-half
confusion, not proof of causality. Final successor adds a positional one-beat to
one-spread map, required last resolution and clearer opening/adventure guidance.
Those final prompt changes were NOT rerun live. Do not attribute the paid pixels
or text to the final successor or claim its cure empirically proven.

The first revision, "בר ושער הפרח", remains too stationary/hobby-exercise-like;
seven of eight texts exceed the writer's 65-word age-five target (soft instruction,
not a hard validator). The second, "נועה והברווז עם רגלי הכפית", is livelier and
its 12 texts fit the age-four length target. Both model check groups say ready.
This is direct evidence that a model can rubber-stamp remaining weaknesses; no
model `ready_for_reading`, green spec or hash is an independent creative PASS.

Text reader: `outputs/personal-story-editor-trial-20261001/index.html`.
Six local ignored artifacts, no verified off-machine backup:

| File | Bytes | SHA256 |
| --- | ---: | --- |
| accounting.json | 1436 | 2fff380b0a8585e73dfc488ffe1f524560602f2f66f6ad37181729a47d8f8ca5 |
| index.html | 19652 | 709ffbc1a8d08ccdc2e1d6ceb42e44ec507f472c67d5c02fd39da57cae510621 |
| profile-1-draft.json | 19077 | 22b8c8ac14211db13092847dd14d38e0079b5a056f422d79151821d73de19e18 |
| profile-1-edited.json | 39946 | eb0970becf8b71df4ceb6c583810097966a94d8f7ff2646b6799265c9ec6e50e |
| profile-2-draft.json | 25231 | e1c908648b32a20ceecb69e0b314474812a6f60df44663b46db590271bfe26ab |
| profile-2-edited.json | 51429 | 52510ffec8f82e0410f75296f66d442d6e509a98716926c737ac7235b2320ea6 |

## Adversarial targets / exclusions

- Attack source mutation, stale draft/revision digests, edited held offline bypass,
  cancellation and late settlement; no stale partials, refund or extra visual call.
- Remove or corrupt checks/fact IDs/count/order/mode/usage; test real SDK schema,
  exact 6.1 payload, input caps and all five reservation components.
- Confirm original draft preservation, old draft compatibility and v2 refusal of
  a full unedited result. Confirm final revised source enters all visual packets.
- Attack root reuse and hostile failure getters without key/network access.
- Challenge the semantic and cost claims above, including self-review limitations.
  Word-count targets and causal story completeness are not hard quality proofs.

No provider/key reads, paid rerun, threshold change, code edit, push, deployment,
source promotion or test cleanup in this first review. No accepted story bank,
recording extraction, website UI, actual-child profile dispatch, images/narration,
DB migration or public activation changed. Previous pilot's storyboard compiler
failure remains undiagnosed. Earlier review boundaries, image continuity, durable
jobs, creative/product acceptance and release remain open.

## Copy-ready inspection and optional push handoff

The focused milestone is already staged/committed. Do not reconstruct its diff.
Push is NOT requested/executed here and publishes the entire local branch,
including earlier history; this review covers only the immutable range above.

```powershell
$taskRepo = 'C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes'
git -C $taskRepo status --short --branch
git -C $taskRepo branch -vv
git -C $taskRepo log --oneline 2da203c2..5f3ba39c
git -C $taskRepo diff --check 2da203c2..5f3ba39c
git -C $taskRepo show --stat 5f3ba39c
# Only after Guy explicitly chooses to publish the whole branch:
# git -C $taskRepo push -u origin codex/personal-book-storyboard-bridge
```

Official prices checked:
https://developers.openai.com/api/docs/models/gpt-6.1-sol
https://developers.openai.com/api/docs/models/gpt-6-sol
