# Decision Gate — R1D-FULL-BOOK-STORYBOARD-REGRESSION-AND-LOW-RENDER

Status: APPROVED BY GUY / IMPLEMENTATION COMPLETE / INDEPENDENT QA PENDING
Base: `21e501794ea7931c8bdd73366056ad0a9bf9eb3a`
Branch: `codex/r1d-full-book-storyboard-regression-low-render`
Worktree: `C:\Users\guyna\.codex\worktrees\fullbookaudit1\Small_Heroes`

## Product decision

Guy explicitly authorized a local LOW render of the complete 12-page Story Source so the visual system can be judged as a book rather than from one isolated page. The cover is excluded from this measurement: “full book” here means the twelve authored interior story pages.

## Observed regression

The canonical `fox_uri_adventure.shot-plan.json` contains twelve page-specific shot decisions. The prior local Wizard measurement runner did not project that authority into its synthetic Blueprint. It assigned pages 10–12 the same cast regions, the same bucket region, the same vertical drop path, the same eye-level camera family, and a generic narrative summary. The causal-alignment fix therefore succeeded while the measurement Blueprint flattened the storyboard into near-duplicate frames.

The defect is in the local measurement authority construction. It is not evidence that the stored shot plan disappeared, and it is not yet evidence that the image model cannot produce a varied book.

## Nine decisions

1. The existing sidecar Book Shot Plan remains the storyboard authority for this measurement; no story text or shot-plan artifact is rewritten.
2. The immutable Blueprint remains the sole runtime composition authority. The measurement must project the shot plan into Blueprint camera and placement data before Wizard qualification; it must not append a competing prompt-only camera hint.
3. Shot, angle and region projection are general and deterministic. Story-specific facts may enter only as approved source/contract data consumed by the local measurement runner.
4. A zero-cost twelve-page storyboard dry-run is mandatory before credential access. It must prove page coverage, camera mapping, adjacent-frame non-identity, and a minimum visual-rhythm vocabulary.
5. The full measurement is exactly pages 1–12, sequential, `gpt-image-2` LOW, with no Vision call, no per-page retry, no fallback, and no hidden regeneration.
6. A previously approved local child anchor may be supplied as identity-only reference. Blueprint composition, contract wardrobe and scene authority continue to outrank reference composition/content.
7. The already approved typed causal relation remains active on pages 10–12. Its action path and destination are derived from each page’s target placement, so causal alignment does not force identical composition.
8. All images and evidence are written to a new ignored local output root through the local storage emulator. Production, remote storage/database, Board, publication, promotion, deployment and activation remain blocked.
9. At most two orchestration failures are allowed. A completed but visually weak book is evidence to inspect, not an automatic rerender authorization. Technical changes are committed and pushed to QA only after focused tests, TypeScript and repository checks.

## Acceptance criteria

- Twelve storyboard rows resolve from Story Source + shot plan + Visual Contract.
- Every page has an exact Blueprint camera, cast placement and focal region.
- No adjacent pages have identical camera-plus-placement signatures.
- Pages 10, 11 and 12 are structurally distinct while retaining the correct bucket/drip geometry.
- Wizard render qualification passes on the exact twelve-page authority.
- Twelve LOW images are persisted locally with content hashes and call/cost evidence.
- A contact sheet and page-by-page visual audit expose story progression, composition rhythm, causal geometry, child/companion continuity and obvious regressions.
- Production remains unavailable.

## Rollback

Delete only the new ignored output root and revert this milestone’s focused commits. Historical images, approved story artifacts, remote state and production state are not modified.
