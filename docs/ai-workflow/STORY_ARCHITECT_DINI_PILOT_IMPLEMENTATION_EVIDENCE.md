# Story Architect Dini Pilot — Implementation Evidence

**Milestone:** `STORY-FIRST-CREATIVE-NUCLEUS-DINI-ARCHITECT-PILOT`

**Status:** locally implemented; independent Claude Code technical QA pending.

**Branch/worktree:** `codex/story-bank-next-generation-briefs-qa-integration` at `C:\Users\guyna\.codex\worktrees\storyqa1\Small_Heroes`.

**Base:** `99c1e9ede6507b153c4df37b388864fdf3afd4ed`.

## Product problem and verified root cause

The prior v2 freedom projection removed sample dialogue and internal review data, but the Dini draft still followed the supplied plot almost page for page. Repository inspection showed that `projectBriefForWriter` still dispatched the source opening, physical rule, complete ordered movement, companion complication, discovery, climax action, payoff and ending. The companion card also described recurring physical behavior. The system had granted prose freedom after already deciding the story.

The external ChatGPT critique corroborated that diagnosis and proposed a staged separation: creative nucleus, Story Architect alternatives, Guy selection, Writer, then Editor/QA. It also warned against migrating all 18 slots before a pilot proves better product output.

## Implemented solution

1. The existing v2 18-slot materializer is preserved. Its commission and manifest versions, projection keys, six companion-card contract and output behavior remain covered by regression tests.
2. `story-architect-pilots.json` defines exactly one closed Dini pilot with a premise seed and a psychology-only companion portrait.
3. `STORY_ARCHITECT_PILOT_CHARTER.md` requires exactly three materially different story shapes, forbids a page spine or prose, prohibits a hidden recommended winner and terminates Stage 1 with `WAITING_FOR_GUY_SELECTION`.
4. The generated prompt omits the source working title, product category, child deadline, hidden theme, full editorial plot, previous companion choreography and production metadata.
5. `STORY_DRAFT_EDITORIAL_QA_CONTRACT.md` preserves strict story, delight, companion, Hebrew read-aloud, category and visual-journey standards after drafting. Its digest is recorded in the manifest with `dispatchedToArchitect:false`; its body is absent from the prompt.
6. The new CLI command accepts only the pilot brief and an empty output root, writes one content-addressed prompt plus a v1 manifest, and refuses reuse or undeclared pilot structure.

## Changed surface

- `scripts/materialize-story-commission-briefs.cjs`
- `lib/__tests__/story-commission-materializer.spec.ts`
- `lib/__tests__/story-pipeline-next-generation-creative-briefs.spec.ts`
- `story-pipeline/03_story_briefs/README.md`
- `story-pipeline/03_story_briefs/STORY_ARCHITECT_PILOT_CHARTER.md`
- `story-pipeline/03_story_briefs/STORY_DRAFT_EDITORIAL_QA_CONTRACT.md`
- `story-pipeline/03_story_briefs/story-architect-pilots.json`
- `CURRENT.md`
- this evidence file
- `docs/ai-workflow/STORY_FIRST_CREATIVE_NUCLEUS_DECISION_GATE.md`

No approved story bank, runtime loader, Wizard, Reader, generation, provider, image, payment, storage, database or deployment surface changed.

## Generated evidence

Output root: `outputs/story-architect-pilot-dini-cake-20260813-final-v1`.

- Prompt: `dragon_dini_adventure_wobble_cake_convoy_brief_v1.architect.3c26d0c05119fe497cc216535a2a6c37e3ffce4e0455dfa7f385f2a4bc6d74bf.md`
- Prompt length: 4,693 bytes.
- Prompt raw SHA-256: `3c26d0c05119fe497cc216535a2a6c37e3ffce4e0455dfa7f385f2a4bc6d74bf`, equal to its filename digest.
- Manifest: `small-heroes-story-architect-pilot-manifest/v1`, one record, `staging_pilot_only`.
- Sanitized scan: zero matches for former Dini mechanics, screenplay field names, `imageDirection`, source category `NEW_SIBLING` or the post-draft QA body.
- A pre-final artifact was moved to `outputs/_superseded-story-architect-pilot-dini-cake-pre-final-do-not-dispatch`; it is not dispatch authority.
- Earlier abandoned all-18 experiments remain under `_superseded-*` roots and must not be dispatched.

## Validation

Focused:

```text
npx vitest run lib/__tests__/story-commission-materializer.spec.ts lib/__tests__/story-pipeline-next-generation-creative-briefs.spec.ts --maxWorkers=1 --no-file-parallelism
PASS — 2 files / 15 tests
```

Deterministic TypeScript:

```text
npx --no-install tsc --noEmit
PASS
```

Whitespace/error check:

```text
git diff --check
PASS
```

Repository gate:

```text
npm run check
EXIT 1
ordinary: 280 files, exactly seven previously documented failures
resource-intensive: 19 files, PASS with valid diagnostics
```

The ordinary failures are the six established missing ignored-output fixtures (`story-read-back-validation` ×2, `child-lexicon-ages-5-8`, `page-entity-qa`, `momentum-gate-koko`, `set-appearance-ref-budget`) plus the pre-existing stale source-string assertion in `r1d-dini-bar-five-page-measurement-authority.spec.ts`. No changed or adjacent story-pilot test failed. Repository/release remains HOLD independently of this implementation.

## Migration and rollback

There is no catalog or runtime migration. The pilot is additive and isolated. Rollback is one focused commit revert; v2 behavior and all 18 source records remain available exactly as before.

## Limitations and next gate

- Code can prove isolation and prompt shape; it cannot prove that the three model-authored alternatives are delightful.
- Only Dini is supported. Generalization is deliberately deferred.
- Guy must select A, B or C before Stage 2. A model response that skips the waiting boundary is rejected as a pilot result.
- The selected draft still requires the post-draft editorial QA contract and Guy product acceptance before any bank, visual-package or render action.
- Independent Claude Code review is still required before this implementation receives technical PASS.

## Exclusions and cost

No credential access, network/provider/model call, story generation, approved-bank write, render, Vision, narration, database/storage action, Wizard/Reader change, deployment or push occurred. External cost: `$0`.
