# Decision Gate — R1D-DINI-BAR-FIVE-PAGE-LOW-MEASUREMENT

## 1. Proposed change

Run one bounded local/QA measurement of pages 1–5 from `dragon_dini_fantasy` with Bar, age 5, using `public/Images/Bar.png` as the direct child identity reference and Dini's canonical Style 01 sheets as companion authority.

## 2. Why now?

The Fox full-book render did not isolate engine quality from story topology: most beats shared one balcony set, and multiple frames were compositionally near-identical. Product acceptance is therefore still unproven. Dini pages 1–5 provide a discriminating sequence: bedroom, toy-chest portal, magical-world arrival, comic side action, and nest/egg reveal.

## 3. Scope

This is a one-off product measurement using general repository qualification and image boundaries. It does not change production generation behavior. A local overlay only converts explicit legacy Dini prop states into typed Blueprint placement authority for the five measured pages.

## 4. Hardcoding risk

The story, child and five-page selection are deliberately measurement-specific. No story-specific literal is added to production compiler, validator, Wizard or rendering code. The only reusable change is a test-fixture page-count option required to represent all 16 source pages faithfully.

## 5. Files likely affected

- `scripts/run-r1d-wizard-low-full-book-measurement.ts`
- `scripts/lib/r1d-dini-bar-five-page-measurement-authority.ts`
- focused tests for fixture page count and measurement authority
- `CURRENT.md` and implementation evidence after results

## 6. Expected behavior

- Local qualification sees the complete 16-page Dini source and contract.
- Only pages 1–5 render.
- The five measured pages have five distinct storyboard signatures.
- Dini is absent on pages 1–2; egg/nest are absent until page 5.
- Bar remains the same recognizable five-year-old with natural anatomy and a premium hand-painted, non-flat-cartoon treatment.
- The five images and a contact sheet remain local; production stays blocked.

## 7. Validation plan

1. Focused tests and TypeScript.
2. `--qualify-only` with no credential access or provider call.
3. One bounded run of five `gpt-image-2` LOW page generations, no visual-QA provider calls and no remote database/storage.
4. Visual inspection of all five pages for identity, environment continuity, prop lifecycle and material composition variance.

## 8. Cost impact

Five LOW image generations only. No Vision, authoring, entity-QA or world-QA provider calls. No HIGH render and no full-book continuation.

## 9. Rollback

Delete the local ignored output root and revert the focused branch. No production state, database, published package or deployment is touched.

## 10. Review assignment

Guy reviews visual/product quality. Claude Code may later falsify code/evidence claims on an immutable range. This measurement itself does not self-award product acceptance.

## 11. Do not do

No production activation, remote storage/database, Board mutation, publication, deployment, HIGH render, Vision QA, full-book render, or reuse of Fox outputs as Dini authority.
