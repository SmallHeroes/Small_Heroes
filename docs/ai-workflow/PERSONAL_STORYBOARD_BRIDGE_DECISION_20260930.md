# Personal manuscript -> whole-book storyboard: Decision Gate

## 1. Proposed change

Implement an offline, source-bound bridge from a reviewed personal request and its
exact writer result to complete visual planning, inherited state and per-frame
render/QA packets. Reuse the existing diagnostic planning/sequence validators.
No public route, provider adapter or image generation is enabled in this milestone.

## 2. Why now / observed and expected behavior

Guy approved the 2026-09-30 chain diagnosis and requested implementation followed
by Claude Code QA. The writer plans the entire narrative but its continuity field
is free text; the separate diagnostic renderer has typed continuity. There is no
consumer connecting the exact personal manuscript to those validators. Expected:
one frozen personal source, all frames planned before any frame packet, inherited
physical state, variable camera and an explicit semantic-review hold.

## 3. Scope and topology

General diagnostic system change, not a story fix. This chat is the sole implementer.
Reuse the clean attached worktree at
`C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes` on new branch
`codex/personal-book-storyboard-bridge`, base `45b9e754256751d2e115916cfcf0d267825f7da1`.
The original branch/ref remains intact. Claude's site branch stays at `cdf5938b`;
the donor engine stays at `ef865968`; d53b/wave2 stay at `768ccb2f`/`63ccb484`.
The new branch has no upstream. No overlapping writer task is dispatched.

## 4. Root cause, risks and rejected alternatives

Missing source/format bridge and structured personal-book state, not a proven
image-model root cause. Structural source binding does not prove semantic truth;
quotes may be present without supporting a transition. Use an explicit bound
review record, never rename a schema success as visual or editorial acceptance.
Reject isolated page prompts, implicit Markdown rewriting, unqualified automatic
rendering and whole-branch merges. Port only the five self-contained diagnostic
modules needed by the bridge, with donor provenance recorded. This creates a
local copy; future shared-module extraction is deferred, not falsely claimed done.

## 5. Files and work order

1. Port `local-story-preview`, `local-preview-quality`, `local-visual-priority`,
   `local-book-sequence`, `local-book-planning` from the pinned donor. Add a literal
   text-pages constructor so generated prose never goes through template parsing.
2. Add personal request/result binding, full-book planning input, compilation,
   bound semantic-review disposition and immutable render/QA frame packets.
3. Add an offline preparation CLI and mocked end-to-end boundary tests.
   Ported prompt assembly requires one optional anatomical-lock compatibility flag;
   its omitted/false behavior must remain byte-identical. Register the three added
   test files in the existing inventory assertions; do not change worker/time limits.
4. Run tsc, focused tests, CLI falsification and the full repository check;
   update CURRENT/ROADMAP and commit with explicit pathspecs; supply QA handoff.

## 6. Acceptance criteria

- A current reviewed request must match the complete writer result and plan digest.
- The final title/prose bytes are preserved; 8/12/16 spreads remain distinct from
  16/24/32 display pages. No catalogue/source approval is minted.
- The entire storyboard, including ending and cover, precedes frame extraction.
- State inherits across offscreen pages; unmotivated inside/outside, custody,
  appearance and location changes fail structurally or remain held for review.
- Camera, expression and framing survive compilation; returning visits use the
  same canonical location/landmark identity rather than a previous pixel error.
- A bound complete semantic report is required before extracting reviewed frame
  packets. Uncertainty/contradiction holds; a report is not proof the model was right.
- Both renderer and judge receive the same packet and digest. A stale request,
  source, plan, report or mutated/forged in-memory compiled object is rejected.
- All outputs remain diagnostic, `runtimeEligible:false`, no release/product grant.

## 7. Validation

Use synthetic requests and mocked writer outputs through the real writer, then
the real bridge/compiler/packet functions and offline CLI. Cover all lengths and
companions, removals/edits, semantic holds, deliberate bad state and exact source
preservation. No live transcription, literary-quality claim or paid image proof.
Independent review of the base writer remains separately open.

## 8. Cost

$0; no keys loaded into the new bridge, no provider/network calls, no images/audio.
Guy's existing-key choice is retained for a later separately bounded live trial.

## 9. Rollback / compatibility

Additive local modules and CLI, plus the opt-in pure anatomical-lock flag; the public site, writer route/result, old catalog,
anchors, resemblance threshold, payments and deployed generation are unchanged.
Rollback is a revert of this focused commit; no database/storage migration.

## 10. Review assignment

Guy's implementation approval is the latest message, not release acceptance.
Claude Code reviews the immutable range read-only, especially detached-hash
spoofing, input mutation, stale reviews, quote-vs-entailment, camera/state separation
and CLI containment. Creative quality and real pixel compliance remain empirical.

## 11. Stop-check and exclusions

General change: yes. Can regress other stories: covered by generic fixtures, but
not a guarantee. Production-flow change: no; one shared pure prompt helper has an
additive flag, tested with omitted/false compatibility. Spend: no. Smallest run: offline full-plan
fixtures. No unresolved product choice is being assumed. Guy should judge the
later real manuscript/illustrations, not a synthetic test book. No push, deployment,
full book render, stability closure, independent self-PASS or new companion assets.
