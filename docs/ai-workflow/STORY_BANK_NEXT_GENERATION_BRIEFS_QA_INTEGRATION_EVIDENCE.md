# Story Bank Next Generation Briefs — QA Integration Evidence

## Status and scope

- Date: 2026-08-13.
- Branch: `codex/story-bank-next-generation-briefs-qa-integration`.
- Worktree: `C:\Users\guyna\.codex\worktrees\storyqa1\Small_Heroes`.
- Exact QA base: `e6dbcdd369b1dabfe560344c20ac779954b11e0c`.
- Source creative authority: independently PASSed pushed branch `codex/story-bank-next-generation-creative-briefs` at `dafbbbf44b18170a9a3fc35e7cec2d4c6943f650`.
- Product decision: current product uses curated prepared stories. Fully custom story-from-scratch authoring remains a separate future feature and receives no authority from this milestone.
- Production: unchanged and intentionally out of scope.

## Integrated implementation

The source branch was based on older runtime history, so it was not merged wholesale. Its reviewed story-specific implementation was replayed onto the active QA checkout base and conflicts were resolved by retaining the current QA `CURRENT.md` history and recomputing the Vitest inventory.

Integrated commits:

1. `f6c90a8e` — next-generation story contract, premise foundations and six normalized companion bibles.
2. `a378360d` — exact 18-slot creative-brief catalog and shared ChatGPT writer contract.
3. `da68b6c6` — personalization and placeholder hardening.
4. `c78d32e3` — closed structured-language guards and human-language-QA boundary.
5. `85bf081f` — QA-base commission materializer, physical-page accounting and child visual-authority boundary.

## Product contracts

| Direction | Text pages | Illustration pages | Physical pages |
|---|---:|---:|---:|
| bedtime | 8 | 8 | 16 |
| adventure | 12 | 12 | 24 |
| fantasy | 16 | 16 | 32 |

The 18 records equal the full six-companion × three-direction matrix. Each direction for a companion is a materially different story rather than an expanded version of another direction.

The brief owns premise identity and the minimum causal system. ChatGPT owns exact prose, dialogue, rhythm, local scene blocking and page allocation. This boundary is intentionally open enough for strong writing while preventing the generic, visually repetitive failure mode previously observed in the balcony/bucket story.

Each brief contains:

- a visible opening event and concrete child want;
- a physical problem and playable world rule;
- two or more meaningful set pieces for bedtime and three or more for adventure/fantasy;
- five or six high-level causal movements, never a page-by-page manual spine;
- companion-specific wrong help and exactly three different comic escalations;
- two failed attempts, visible discovery and child-owned climax;
- bounded recurring objects/cast, reread hooks, safety locks and anti-copy exclusions;
- explicit model freedom for dialogue, local visual detail and comic realization.

## Copy-ready ChatGPT commission materializer

`scripts/materialize-story-commission-briefs.cjs` supports:

```powershell
node scripts/materialize-story-commission-briefs.cjs list

node scripts/materialize-story-commission-briefs.cjs materialize `
  --brief-id <catalog-brief-id> `
  --output-dir <new-empty-directory>

node scripts/materialize-story-commission-briefs.cjs materialize-all `
  --output-dir <new-empty-directory>
```

It resolves records only from the repository catalog, refuses missing/non-unique IDs and non-empty output directories, produces content-addressed Markdown, and writes a manifest with exact text/physical page counts. It performs no network, provider, credential or bank write.

The local staging run created exactly 18 Markdown bundles plus `manifest.json` in:

`outputs/story-bank-next-generation-chatgpt-commissions-20260813`

The output is intentionally ignored/untracked. It is a dispatch artifact, not source authority.

## Age and image boundary

The current story commission deliberately excludes the child's photo and visual body model. The writer must not invent or lock height, body proportions, head-to-body ratio, clothing, face, hair, skin or illustration style.

The parent's selected age remains a downstream visual input. The desired general end-state is a typed age-to-body-proportion authority combined with face-only photo identity. That visual hardening is not implemented by this story milestone and should be reviewed separately before claiming it is closed.

## Validation

Focused command:

```powershell
npx --no-install vitest run `
  lib/__tests__/story-pipeline-next-generation-foundations.spec.ts `
  lib/__tests__/story-pipeline-next-generation-creative-briefs.spec.ts `
  lib/__tests__/story-commission-materializer.spec.ts `
  lib/__tests__/vitest-workload-classifier.spec.ts
```

Result: **PASS — 4 files / 23 tests**.

Additional validation:

- `node --check scripts/materialize-story-commission-briefs.cjs`: PASS.
- `npx --no-install prisma generate`: PASS, local only.
- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS before the implementation commit.
- Materializer census: 18 records, 6 companions, exact `8/16`, `12/24`, `16/32` text/physical contracts.

The one literal `npm run check` ran once and was not retried:

- TypeScript: PASS.
- Canonical inventory: **299 files = 280 ordinary + 19 resource-intensive**.
- Ordinary: the six established missing ignored-output fixture assertions plus the pre-existing stale `r1d-dini-bar-five-page-measurement-authority` source-string assertion. No story or materializer assertion failed.
- Resource-intensive: `onTaskUpdate` RPC timeout with valid diagnostic protocol. This is the separately known test-infrastructure class.
- Repository/release status remains HOLD. This milestone does not waive or hide those failures.

## Explicit exclusions

No approved-bank import, runtime story replacement, personalized story-from-scratch implementation, credential read, model/provider/network call, story generation, image/audio/Vision render, database/storage action, checkout/payment change, Reader/Wizard behavior change, QA deployment, Production deployment, promotion or push occurred.

External cost: `$0`.

## Independent QA falsification targets

Claude Code should review `e6dbcdd369b1dabfe560344c20ac779954b11e0c..HEAD` read-only and try to prove:

1. The catalog does not equal the exact 18 current Wizard companion/direction slots.
2. The page accounting is not exactly 8/12/16 text pages and 16/24/32 physical pages.
3. One direction reuses another direction's premise/mechanic rather than providing a distinct story.
4. A brief prewrites a page-by-page spine or leaves ChatGPT too little useful creative freedom.
5. A companion can be swapped without breaking causality, humor or climax.
6. The child does not own the decisive external action.
7. The materializer admits raw supplied story JSON or can select a non-catalog brief.
8. A generated commission contains more than the four declared authorities or leaks another slot.
9. The materializer can overwrite an existing output directory or produce non-content-addressed files.
10. The story writer is allowed to invent child appearance or confuse face-photo evidence with body authority.
11. Approved banks, runtime, Wizard, checkout, Reader, dependencies, pricing, provider or Production changed.
12. The focused test, TypeScript, full-check or Git claims above are inaccurate.

Independent QA may award only technical PASS/HOLD for this range. Guy retains story selection, prose quality, product, visual and launch acceptance.
