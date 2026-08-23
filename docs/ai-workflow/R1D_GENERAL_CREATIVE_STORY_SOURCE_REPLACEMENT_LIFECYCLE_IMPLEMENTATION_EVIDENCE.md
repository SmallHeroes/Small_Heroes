# R1D General Creative Story Source Replacement Lifecycle — Implementation Evidence

**Date:** 2026-08-23

**State:** independent Claude Code PASS; lifecycle milestone technically closed

**Branch:** `codex/qa-wizard-presentation-dispositions`

**Worktree:** `C:\GNart\Work\sh-wt-r1d-output-budget`

## Outcome

The repository now has a general immutable publication boundary for a
product-accepted creative Story Source replacement before visual directions
exist. It does not reuse the specialized v2 gender-metadata correction and does
not carry predecessor visual directions into changed prose.

The first published local revision is:

- story key: `chameleon_koko_bedtime`
- predecessor: `20a1280107a94ca0134c08351bc18565883ee358ce7ed1ca47ea797549bca1eb`
- replacement revision: `eca8b3c8a8ed32a6a884cd9bd4fc493fcc6f00fed3c4ebe710c6a870ead2115d`
- accepted Story Revision SHA-256:
  `b18e824c96bf43a3d3f5b9dfe6457b2ad8a19112b73e89fcfbb55417a02afd09`
- Editorial PASS SHA-256:
  `bd1bf219cd3e0361a2875a00604ae9ac8e66fe69694ee96fa8d1064c8cc4fce6`
- Creative Brief SHA-256:
  `dc06be6f13c475ef82b34dba1e8c9a31ded92f2c98cdc38749708df6b4e46ab6`
- Review Bundle digest:
  `d415b07833d5f799083223e161b33c999becbafc36347dfe04c55cb49d4ae524`
- Guy acceptance digest:
  `f63400631a808f76c8c36f339d98a176f6aa8f63b27a8f42cf27e63103129d95`
- accepted manifest digest:
  `1dffb1a6b4f0eda5d389fc33b799a94a86f071a81793867de42b7ea6541ab757`

## General contract

`scripts/story-source-creative-replacement-lifecycle.cjs` accepts only an
exact versioned request beneath `outputs/`. The request binds:

- one canonical story key and closed identity tuple;
- one exact accepted predecessor manifest path, digest and byte SHA;
- one exact Creative Brief, story and Editorial Review;
- source profile `gender_flexible` / source gender mode `neutral`;
- exact Guy approval of the Story Revision and Editorial Review; and
- a canonical UTC acceptance timestamp plus an explicit no-render decision.

The lifecycle validates canonical frontmatter, sequential non-empty pages,
complete gender chips, both deterministic boy/girl projections, exact Brief
topology and an Editorial Review with `pass`, zero issues and zero revision
priorities. Inputs must be ordinary one-link files inside their allowed roots;
path escapes, symbolic links and hard links fail closed.

The revision identity excludes the approval timestamp and is derived only from
the predecessor, slot identity and approved content hashes. Publication writes
the seven-file revision directory through one sibling staging directory and
atomic rename. Existing identical bytes replay as `created:false`; an unlike
inventory or byte is a collision. Once one accepted creative successor exists,
a second distinct successor from the same predecessor is rejected.

## Self-contained accepted loader

`loadAcceptedCreativeReplacement` does not depend on ignored staging files. It
checks the canonical manifest path and exact seven-file inventory, recomputes
every byte/digest descriptor, validates the embedded Guy acceptance and
Editorial PASS, reloads the exact predecessor, revalidates the story and both
gender projections, rebuilds the complete revision and compares every byte.
This is the safe source boundary for the later visual-direction lifecycle.

## Runtime and cost boundary

The manifest declares:

```json
{
  "eligible": false,
  "reason": "visual_directions_not_approved"
}
```

There is deliberately no `integrated.md` and no `visual-directions.json`.
Current accepted-revision runtime selection only accepts `integrated.md`, and
the current Visual Package still freezes the predecessor path. The replacement
therefore cannot become Wizard/runtime authority accidentally.

No provider, model, network, credential, image, audio, Vision, database,
storage, deployment or render operation occurred. Cost was `$0`.

## Real-artifact evidence

The published directory is
`story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/revisions/eca8b3c8a8ed32a6a884cd9bd4fc493fcc6f00fed3c4ebe710c6a870ead2115d/`.

Its inventory is exactly:

| File | Bytes | SHA-256 |
|---|---:|---|
| `creative-brief.json` | 10,432 | `dc06be6f13c475ef82b34dba1e8c9a31ded92f2c98cdc38749708df6b4e46ab6` |
| `editorial-review.json` | 2,941 | `bd1bf219cd3e0361a2875a00604ae9ac8e66fe69694ee96fa8d1064c8cc4fce6` |
| `manifest.json` | 2,711 | `0cb441f8e51d8b1a228db449f07029626a949ef5bd5a0dcd3e1f884676f7635a` |
| `product-acceptance.json` | 1,767 | `c83ae3473d55e94d728a862d3662b39c4e121dc467a2a991d8dcd481aa452d16` |
| `review-bundle.json` | 1,861 | `3ba72b8efbc52f25f71286f694cb46461624f0df2cd7dde62b0afa24a6ca4e89` |
| `revision-identity.json` | 1,095 | `eca8b3c8a8ed32a6a884cd9bd4fc493fcc6f00fed3c4ebe710c6a870ead2115d` |
| `story.md` | 4,142 | `b18e824c96bf43a3d3f5b9dfe6457b2ad8a19112b73e89fcfbb55417a02afd09` |

Real identical replay returned `created:false`. The self-contained loader
returned the same revision and Story SHA.

## Preservation fence

- predecessor manifest SHA-256 remains
  `e53816df057241b09b0841b18d63496c6b3baf9894b5377c1d1da3ff73012d07`;
- current Chameleon Visual Package locator SHA-256 remains
  `6d3d9431054a71b47456b659f343bc0674efa62403e6f488156b8a8fc02bb96b`
  and still selects package `2b488f2d...98a6`;
- all six existing Chameleon Board artifact hashes are unchanged;
- the four pre-existing untracked Board artifacts remain untracked and
  unstaged.

## Validation

- new dedicated lifecycle suite: **5/5 PASS**;
- general lifecycle plus specialized v2 revision, Brief, commission and
  workload-inventory suites: **6 files / 68 tests PASS**;
- `node --check scripts/story-source-creative-replacement-lifecycle.cjs`:
  PASS;
- `npx --no-install tsc --noEmit`: PASS;
- `git diff --check`: PASS.

Literal `npm run check` completed both phases with canonical inventory
**324 / 304 / 20**. Resource-intensive passed **20 files / 611 tests**.
Ordinary passed **3,551 tests**, skipped 65 and reported six failures: five are
the established absent ignored-output fixtures in four unchanged files; one
unchanged Story Source package-migration test exceeded the five-second
parallel timeout. The two slow package-migration cases pass **2/2** with a
30-second diagnostic timeout (4.8s and 3.8s in the focused run). The new
lifecycle and inventory suites are green in both the focused and literal runs.

## Independent QA targets

Claude Code should try to falsify:

1. content identity or predecessor binding can be replayed across slots;
2. unapproved/revise editorial evidence can publish;
3. either gender projection retains an unresolved chip or wrong source mode;
4. staging paths, links or changed bytes can cross the boundary;
5. atomic/replay/collision/fork behavior can create mixed authority;
6. the accepted loader depends on ignored outputs or accepts extra/missing
   fields/files;
7. the new revision can be selected by current Wizard/runtime/package code;
8. predecessor, locator, package, catalog or Board bytes changed; and
9. any provider/render/spend boundary was crossed.

This record is implementation evidence, not an independent technical PASS and
not render authorization.

## Independent Claude Code verdict

Claude Code independently reviewed immutable range
`5dda3ec2ac7de4d7f5c0a758aa89ca2d90995613..633f39faaf898312694867382a58c8eec496bac9`
at HEAD `633f39faaf898312694867382a58c8eec496bac9` and returned **PASS** on all
14 claims with **0 BLOCKER, 0 MAJOR and 0 MINOR** findings.

The reviewer independently:

- recomputed the manifest (`1dffb1a6...ab757`), Review Bundle
  (`d415b078...ae524`), product acceptance (`f6340063...129d95`) and revision
  identity (`eca8b3c8...2115d`) from their bound content;
- verified the exact seven-file immutable inventory, canonical identity bytes,
  genuine UTF-8 Hebrew, predecessor binding and the exact round-two Editorial
  PASS;
- reproduced the boy and girl projections and found zero unresolved chips;
- confirmed `story_text_only` scope, `visual_directions_not_approved`, absence
  of `integrated.md` and `visual-directions.json`, and unchanged Wizard/package
  authority;
- inspected fork rejection, atomic publication, replay/collision enforcement
  and the staging-independent accepted loader; and
- confirmed there is no provider, network, database, subprocess or other
  external reachability in the new lifecycle.

Claude Code ran **5 files / 62 tests PASS**, including the dedicated **5/5**,
and reported clean Node syntax, `tsc --noEmit` and `git diff --check`. It also
ran the unchanged package-migration spec in isolation at **5/5 in 856 ms**,
supporting the documented classification of its five-second failure under the
parallel full-check load.

Codex records that independent verdict here; this document does not convert it
into product acceptance or grant Visual Directions, Visual Contract, package,
locator, Wizard, render, deployment or production authority. The published
revision remains runtime-ineligible until a separately approved downstream
milestone supplies and validates new Visual Directions.
