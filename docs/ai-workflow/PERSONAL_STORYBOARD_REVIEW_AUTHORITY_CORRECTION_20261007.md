# Storyboard reviewer physical authority correction

## Decision and verified cause

Guy's approved storyboard continuation includes fixing valid independent QA findings. Codex is the sole writer in this chat on `codex/simple-story-voice-20261007`, worktree `C:/Users/guyna/.codex/worktrees/simple-story-voice-followup/Small_Heroes`, from clean `87b93c933879323ba93289eb0be8ea505168b4fe`. This is a focused successor, not the simple-source adapter.

Claude independently reports PASS for `2b4035d8..119ac518` and `dad37132..87b93c93`, HOLD for `119ac518..dad37132`. R2-1 is verified: `personalStoryboardReviewInput` now includes the exact visual declaration, but `PERSONAL_BOOK_REVIEW_INSTRUCTION` does not limit that legacy prose to physical checks. The planner already has this limit. This is a deterministic input risk, not observed bad model output.

## Change and acceptance

Give the existing reviewer explicit physical-only authority for `companionVisualAuthority`; literary personality/role come from `approvedBrief.companion.character` and this story. Optional appearance states must not force an emotional arc. Preserve every existing semantic criterion and the raw input. Pin the boundary in actual injected-provider review calls for four registry-backed companions whose legacy descriptions contain personality cues. This general fix does not ban a companion's current story role.

Strengthen the existing Kim snapshot test at the nested states array and state-object levels (R2-2), pin unresolved embodiment wording already present for all 15 simple-engine IDs (P3-1), and clarify that Codex's earlier mutations were pre-commit, unlike the committed focused/full gates (D-1). No production snapshot or source identity code needs changing for these test/doc corrections.

R2-3's optional version bump is deliberately deferred to the adapter's next identity change. Current binding is fail-closed. P3-2's historic generalized editor-gender wording is recorded without claiming it fixed or a V1 regression; the author still has explicit child/companion gender and the editor still requires correct gender.

## Scope and stop check

- General review-authority fix, not a story/child/companion patch. Production change is one existing diagnostic instruction, not a customer route or new stage.
- Expected files: book runner/instruction, its spec, storyboard spec, simple-engine spec, CURRENT, ROADMAP and this record.
- Unchanged: source/digest recipe and version, canon, assets, profiles, editor/continuity/current/archive gates, financial policy, provider, schema, 0.70 threshold and renderer.
- Validation: type-check, existing eight-file set plus semantic-audit admission tests; virtual negative controls for missing reviewer boundary, wrong literary authority, forced states, shallow copy and lost embodiment. One full gate at clean committed code with file-hash receipts; report RED honestly and separate old assertions/RPC errors.
- No key, model/provider call, Max session, story/visual generation, render, wizard integration, push, merge or deployment. No new resource allowance is assumed.
- Rollback: revert this focused successor, preserving all evidence. This restores the prior HOLD; it is not approval for a paid run.
- Claude re-gates the whole storyboard-binding range plus successor in a first-pass read-only review. Technical tests do not prove literary/pixel quality. Guy remains product/visual owner. No new product decision is needed for this previously authorized defect correction.

## Evidence

Local type-check exits 0; nine focused specs pass 486/486. The book runner grows 130 -> 134 tests; no existing test is removed. Source production change is the single review-authority sentence. Committed negative controls and one hashed full gate follow the focused commit. Their receipts and exact re-gate range will be recorded before handoff; no self-awarded independent PASS.
