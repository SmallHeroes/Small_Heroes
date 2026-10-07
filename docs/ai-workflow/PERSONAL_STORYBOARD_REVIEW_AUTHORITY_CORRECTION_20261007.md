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

Code commit: `3981e22f7505782271bb507eaf7a0f5a1e803b11` (parent `87b93c93`). Local and clean-commit focused checks pass 486/486 across nine files; type-check exits 0. Book runner grows 130 -> 134 tests, none removed. Production changes one review-authority sentence.

Nine virtual mutants at the committed code are caught by intended assertions (selected control 20/20): six four-companion review-call failures, two nested-snapshot failures, one 15-companion embodiment failure. HEAD/tree, source hashes, operator/config hashes and actual exit codes are recorded; no source is mutated. This is a regression-contract check, not a model-quality comparison.

One serial full `npm run check` completed at clean `3981e22f`, exit 1: ordinary 6580 passed / 10 same missing-artifact failures / 73 skipped; resource 634 passed / same Windows probe assertion / three onTaskUpdate RPC errors. All 11 assertion names match `dad37132`. No new assertion failure occurs in the changed files; the full gate remains RED and the probe's cause remains unestablished.

Focused/full receipts inventory all 3372 tracked files, equal before/after digests, exact HEAD/tree, operator hash, command and confirmed termination. This excludes ignored/external fixtures/dependencies. Preservation independently checks 86 historical and 83 age evidence hashes and six protected clean baseline trees. Earlier receipts/reports/stories remain intact.

Re-gate target: the whole held binding surface `119ac518..3981e22f`, plus this subsequent docs-only closeout. Evidence is in `simple-story-review-authority-evidence-20261007` beside the handoff `CLAUDE-STORYBOARD-REVIEW-AUTHORITY-REGATE-20261007.md`. No independent PASS is claimed; no provider/key/generation/push occurred.

Instruction versus input authority is also consistent with [official OpenAI prompt guidance](https://developers.openai.com/api/docs/guides/prompt-engineering#message-roles-and-instruction-following): per-call instructions guide interpretation of supplied context. That guidance does not prove literary judgement or model compliance; actual model/pixel quality remains unmeasured in this correction.
