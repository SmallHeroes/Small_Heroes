# R1D Chameleon / Bar First-Kindergarten Story Source Rewrite — Implementation Evidence

**Date:** 2026-08-23

**Status:** INDEPENDENT TECHNICAL AND EDITORIAL PASS; GUY PRODUCT ACCEPTANCE PENDING

**Cost:** `$0`

**Generations:** `0`

## Outcome

The old walking-bus-stop story remains the current accepted source. A separate
staging rewrite now gives the child an explicit first-kindergarten transition,
a concrete personal want, multiple actions before the climax and ownership of
the final solution. Kim is no longer exchangeable with a generic animal: her
eyes, tongue, mustard satchel and gradual closed colour sequence cause both the
mistakes and the evidence from which the child builds the route.

## Root cause and corrected boundary

The prior story's main dramatic problem belonged to an animated bus stop. The
child solved one late technical condition, while Kim mainly remembered sounds
and labels. Her chameleon colour did not change and did not affect causality.

The first staging edit replaced the current Brief id inside the live 18-slot
catalog. A broader materializer run correctly failed
`story_review_corpus_coverage_invalid`: the historical autonomous corpus still
binds the old Brief id and old story. Relabeling that evidence would be false.
The edit was therefore removed. The current catalog, commission table, Hebrew
review table and historical corpus are byte-clean against HEAD. The new Brief
and draft live only in digest-bound staging until their own replacement
lifecycle exists.

## Tracked implementation

`story-pipeline/01_companions/chameleon_koko.md` now states Kim's invariant
anatomy and mustard satchel separately from one closed, gradual appearance
sequence: warm green, olive, amber mismatch/stress stripes, blue-green
attunement and moonlit teal resolution. One coherent state is visible at a
time; random patchwork, identity drift and disappearing accessories remain
forbidden. This is a creative-authority alignment with the independently
passed typed Companion State system, not a runtime special case.

## Digest-bound staging artifacts

Root: `outputs/r1d-chameleon-kim-story-rewrite-draft-v1/`

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `creative-brief.json` | 10,432 | `dc06be6f13c475ef82b34dba1e8c9a31ded92f2c98cdc38749708df6b4e46ab6` |
| `chameleon_koko_bedtime_first_kindergarten_lantern.md` | 4,058 | `0ea3a150326214dd08ade9bd6d949daac7100364ca6e49c516fc161db7a39059` |
| `evidence-manifest.json` | 1,638 | `ff77219374dd8219814be0e5ff45ebbe63b28839b1fe8a8336548b0263b9d41b` |

The manifest is explicitly `diagnostic_staging_only` and `authority: false`.
It cannot select a story, mint a Candidate or reach the Wizard.

## Story proof

- Page 1 states that tomorrow is the child's first day at the new kindergarten
  and launches the paper moon lantern immediately.
- Kim's three wrong matches are materially different: green hedges, an
  olive/vegetable market and amber bakery light/rolling bread.
- The child stops the cart, turns its handle, tries a plausible but wrong
  light-to-dark ordering, then discovers that Kim's colour *sequence* records
  the route.
- The child threads the route, leads the unknown final segment, opens the gate,
  hangs the lantern and creates the first new sign at the kindergarten.
- Kim progresses visibly through warm green, olive, amber stripes, blue-green
  and moonlit teal while remaining the same chameleon with the same satchel.
- Page 8 alone introduces pajamas and bed; motion and sentence energy descend.

The eight whitespace word counts are exactly:
`43, 42, 41, 41, 41, 44, 41, 45`. All are inside the bedtime target of 25–45.
The draft contains 24 distinct full-form gender chips; both Bar/boy and a girl
control render with no unresolved chip.

## Validation

- Canonical `validateEditorialPassDraft` with explicit
  `gender_flexible`: PASS, zero normalization actions, draft SHA-256
  `0ea3a150...a39059`.
- Content assertions: 10/10 PASS (transition, five ordered state markers,
  satchel, child discovery, child climax and final-page-only pajamas).
- `story-pipeline-next-generation-creative-briefs.spec.ts` +
  `story-commission-materializer.spec.ts` +
  `story-source-revision-materializer.spec.ts`: **3 files / 50 tests PASS**.
- The same three-file run first produced **49/50** with the intentional
  historical-corpus mismatch, then passed **50/50** after restoring the live
  catalog boundary. No test was skipped or weakened.
- `npx --no-install tsc --noEmit`: exit 0.
- `git diff --check`: exit 0.

## Preservation

- Current accepted integrated source remains 9,642 bytes, SHA-256
  `3aac47b55f606fd65a127c0679ffb42e6b16f93783d7a6386d81e5e8db01cef4`.
- Live 18-slot Brief catalog, commission table, Hebrew review table,
  autonomous selection and historical review corpus are absent from the final
  tracked diff.
- The four pre-existing untracked Board files remain unstaged and retain
  SHA-256 values `8e530b44...`, `bbce002d...`, `a2bff526...` and `53e446c9...`.

## Independent review and bounded Revision 1

Claude Code reviewed exact commit `a0d75209` read-only and returned technical
and artifact **PASS** with zero BLOCKER, zero MAJOR and zero MINOR. It
independently reproduced the 50/50 tests, TypeScript, diff check, all three
staging hashes, all four Board hashes, the eight page counts, 24 gender chips,
the ordered Kim states, child-owned action/climax and the restored historical
catalog boundary.

Its separate closed editorial result was `revise` with two MINOR issues:

1. Pages 4–6 did not visibly distinguish the failed green-to-amber ordering
   from the successful Kim-state ordering.
2. `על ראשה` had two feminine referents on page 4, while the girl form
   `לא רצה לשער` created an oral homograph on page 5.

The exact returned review is preserved at
`outputs/r1d-chameleon-kim-story-rewrite-revision1/editorial-review-round1.json`
(3,966 bytes; SHA-256
`b799eeed95e9abb1fc17e6c2f9cec1a8ddcea282bfccfffae9c7797d5139577c`).
Revision 1 preserves the reviewed v1 draft byte-for-byte and changes only pages
4–6. The first assembly now closes the labels into a ring, so the cart circles
the fountain. The child then opens the ring into a path, places the blank label
at its terminal end, holds that end and leads the unmapped final segment. The
possessive now names Kim explicitly, and `במקום למהר לשער` removes the gendered
homograph while preserving the child's deliberate refusal to rush.

Revision 1 is
`outputs/r1d-chameleon-kim-story-rewrite-revision1/chameleon_koko_bedtime_first_kindergarten_lantern.revision1.md`
(4,142 bytes; SHA-256
`b18e824c96bf43a3d3f5b9dfe6457b2ad8a19112b73e89fcfbb55417a02afd09`).
Its evidence manifest is 1,936 bytes, SHA-256
`f8f273c005b2c9e14952d06c1bd21cd0251281f306126b1109a3349b5a5cf7bc`.
Automated comparison proves identical frontmatter and pages 1–3/7–8, with
exactly pages 4–6 changed. Page counts remain inside contract at
`43, 42, 41, 45, 43, 45, 41, 45`; canonical validation again reports zero
normalization actions. The same three focused suites remain **50/50 PASS**,
with TypeScript and diff check clean.

Claude Code's narrow read-only re-gate of exact HEAD `65a8ab74` returned
technical/artifact **PASS** with zero BLOCKER, MAJOR or MINOR findings and a
fresh closed editorial **`pass`** with four strengths, zero issues, zero
revision priorities and all eight preservation anchors. It independently
confirmed the ring-to-path causality, blank-label continuity, both Hebrew
read-aloud corrections, exact three-page revision scope, all page/word/gender
contracts and every preservation fence.

The exact round-two Editor result is preserved at
`outputs/r1d-chameleon-kim-story-rewrite-editorial-pass/editorial-review-round2.json`
(2,941 bytes; SHA-256
`bd1bf219cd3e0361a2875a00604ae9ac8e66fe69694ee96fa8d1064c8cc4fce6`).
Its evidence manifest binds the passed draft, both Editor rounds and the prior
revision manifest; it is 1,708 bytes with SHA-256
`ba4012a01eb7b9f286fc7da4880d2af4dfc77ec283a95deb566cbd76ae8ea4fb`.
The manifest remains non-product authority and explicitly excludes accepted
source, bank, Wizard, visual and render authority.

## Known next boundary

Revision 1 now has an independent Editor PASS but is not an accepted Story
Source. Guy's explicit product acceptance is the next gate. The older pilot
review CLI is intentionally limited to the single Dini pilot, and its accepted
candidate writer defaults to the legacy `female` source profile. Reusing it for
this neutral creative replacement would bypass authority. After Guy story
acceptance, the next technical milestone must provide a general
versioned creative-rewrite lifecycle that explicitly binds the slot, prior
revision, new Brief, `gender_flexible` profile, Editor result and Guy approval.

No provider, render, image, audio, Vision, credential, storage, database,
Board, accepted-source, catalog, bank, Wizard, package, locator or deployment
action occurred in this closeout. Guy pushed the reviewed branch through
`65a8ab74`; Codex performed no push.
