# Story Bank Next Generation — Creative Briefs Implementation Evidence

## Status and authority

- Product direction: Guy instructed on 2026-08-12 to let ChatGPT write stories from a supplied structure and to author a brief for every story.
- Branch: `codex/story-bank-next-generation-creative-briefs`.
- Worktree: `C:\Users\guyna\.codex\worktrees\1602\Small_Heroes`.
- Exact base: reviewed local foundation commit `5368bce73978e159fe1d64ab2662e8e734cfa29b`.
- Writer topology: this branch/worktree is the sole writer for this milestone.
- Runtime authority: none. All briefs and future model drafts are staging-only.
- Independent QA: pending. Codex does not self-award technical PASS.

## Implemented claims

1. One shared, slot-neutral ChatGPT writer contract replaces the legacy prose template for next-generation staging drafts.
2. Exactly 18 complete structured briefs cover the current MVP matrix: six companion/category pairs × bedtime/adventure/fantasy.
3. The briefs spend human judgment on story identity and causal constraints without prewriting page prose or a page-by-page spine.
4. ChatGPT remains responsible for exact page realization, dialogue, oral rhythm, and local blocking inside the accepted brief.
5. Every brief locks a strange opening, concrete child want, physical problem, playable rule, meaningful set pieces, companion-caused wrong help, three comic escalations, two causal attempts, child discovery, child-owned external climax, visible payoff, direction energy, bounded continuity, reread hooks, safety, and anti-copy exclusions.
6. Every brief has a unique ID, working title, mechanic key, opening hook, climax action, and payoff. No approved old story is a positive prompt input.
7. The selected Koko/bedtime B premise is retained as a compact brief. The rejected hand-authored spine was removed and never committed.
8. Existing approved banks and every production/runtime surface remain unchanged.

## Material file set

- `story-pipeline/03_story_briefs/README.md`
- `story-pipeline/03_story_briefs/STORY_WRITER_CONTRACT.md`
- `story-pipeline/03_story_briefs/STORY_BRIEF_REVIEW_HE.md`
- `story-pipeline/03_story_briefs/story-brief-catalog.json`
- `story-pipeline/03_story_briefs/briefs/{fox_uri,panda_anat,bunny_ometz,dragon_dini,chameleon_koko,lion_shaket}.json`
- `story-pipeline/00_NEXT_GENERATION_STORY_CONTRACT.md`
- `story-pipeline/00b_PREMISE_LAB.md`
- `story-pipeline/00_MASTER_STORY_PROMPT_TEMPLATE.md`
- `story-pipeline/02_prompts/drafts/chameleon_koko__bedtime.premises.md`
- `story-pipeline/README.md`
- `lib/__tests__/story-pipeline-next-generation-creative-briefs.spec.ts`
- `lib/__tests__/story-pipeline-next-generation-foundations.spec.ts`
- `lib/__tests__/vitest-workload-classifier.spec.ts`
- `CURRENT.md`
- this evidence and the associated Decision Gate.

## Validation evidence

### Focused creative, compatibility, and census selection

Command:

```powershell
npx vitest run lib/__tests__/story-pipeline-next-generation-creative-briefs.spec.ts lib/__tests__/story-pipeline-next-generation-foundations.spec.ts lib/__tests__/vitest-workload-classifier.spec.ts
```

Result: **PASS — 3 files / 18 tests**.

The new test proves:

- exact 18-slot equality with `MVP_STORY_MATRIX`;
- six companion sets and bedtime/adventure/fantasy completeness per set;
- exact 8/12/16 page contracts;
- complete brief fields, meaningful set-piece minima, causal-movement bounds, exactly three comic escalations and two attempts;
- bounded recurring objects and transient cast;
- explicit child ownership of discovery and climax;
- companion-specific causal markers and indispensability;
- no known old plot fingerprint or direct therapy/moral language in positive creative fields;
- all 18 IDs, titles, mechanic keys, hooks, climaxes, and payoffs are unique;
- all 18 titles appear in the Hebrew Guy-review artifact;
- no full page prose, image direction, or rejected spine artifact exists;
- the ChatGPT contract requires current format, word bands, personalization chips, fail-closed conflict behavior, and untrusted staging status.

A deliberately broken control proves the guard rejects wrong page count, too few set pieces, a page-sized causal sequence, only two comic escalations, generic companion help, and companion-owned discovery/climax.

### TypeScript

Command:

```powershell
npx --no-install tsc --noEmit
```

Result: **PASS** before the literal repository check; rerun before commit.

### Literal repository check

Command executed exactly once:

```powershell
npm run check
```

Observed result:

- TypeScript PASS.
- Canonical inventory: **289** files — **270 ordinary**, **19 resource-intensive**.
- Resource-intensive phase: **PASS**, 19 files, two workers, `106344 ms`, exit `0`, `signal:null`, `launchErrorCode:null`, valid diagnostic protocol.
- Ordinary phase: exactly the six established missing ignored-output fixture assertions:
  - `child-lexicon-ages-5-8` — missing Sprint 11 `story.md`;
  - `momentum-gate-koko` — missing STOP2 `page-beats.json`;
  - `page-entity-qa` — missing local audition PNG;
  - `set-appearance-ref-budget` — missing ignored appearance-board output;
  - two `story-read-back-validation` assertions — missing ignored story-run files.
- No seventh assertion and no timeout, RPC/IPC, reporter, launch, signal, teardown, or protocol failure occurred. The ordinary exit class reflects assertion exit `1`; its signal and launch error are null and protocol is valid.
- Repository/release status remains HOLD on those six pre-existing fixture dependencies, not on this implementation.

### Diff and authority checks

- `git diff --check`: PASS before final staging; rerun before commit.
- Base-to-working-tree diff under `story-bank/v3-approved`, `story-bank/v5-fixed-v2`, `backend/providers/story-bank-loader.ts`, and `backend/config/mvp-story-matrix.ts`: empty.
- Package and lockfile are unchanged. SHA-256:
  - `package.json`: `7DF1D93BCD93E7CE577525627048584096A04C110FC3D0E9D21436242308993D`
  - `package-lock.json`: `BF7932428AC1BC2CB8885E83A21F231486F35EA36820381B7D1763A77BA03D59`
- Catalog count: 18; unique mechanic keys: 18; unique working titles: 18.

## Limitations and next decisions

- These are creative briefs, not finished stories. No child/parent read-aloud evidence exists yet.
- All 18 records remain `draft_for_guy_review`. Guy may accept, reject, or revise any premise independently.
- The writer contract has not been exercised against a real model in this milestone; no execution or quality claim is made about generated prose.
- A later drafting execution should start with one Guy-accepted brief, not all 18, so its oral Hebrew, humor, page turns, format, and cost can be measured before batch authoring.
- Generated output remains untrusted and must pass deterministic validation, read-aloud editing, Guy content acceptance, and a separately approved bank migration.
- No versioned-bank name, import, visual contract, or rendering migration is included.

## Explicit exclusions and cost

No credential access/check/load; no provider/model/network/pricing call; no story generation; no approved-bank write; no order/database/storage action; no image/audio/render/Vision; no Blueprint/Wizard/reader change; no publication/promotion/activation/deployment; no push.

External cost: **$0**.

## Adversarial falsification targets

Claude Code should review the exact immutable base-to-commit range and try to prove:

1. The catalog does not exactly match all 18 matrix slots.
2. One or more briefs are incomplete, duplicate another mechanic, or secretly encode a manual page spine.
3. A companion can be swapped without breaking causality, jokes, discovery, or climax handoff.
4. An old V3/V5 plot is used positively rather than only disclosed as an exclusion.
5. A child does not own the decisive external action.
6. A bedtime brief is still a bedroom/sleep template or fails to descend in its final quarter.
7. The writer contract permits therapy language, companion-owned resolution, malformed personalization, wrong page count, hidden bank authority, or unconstrained image directions.
8. The tests merely count fields and fail to reject a representative broken brief.
9. Approved banks, runtime, dependencies, package identity, or cost-bearing paths changed despite the stated exclusions.
10. The reported Git, test, full-check, or cost evidence is inaccurate.

Claude Code's first pass is read-only. Guy retains all story/product acceptance.
