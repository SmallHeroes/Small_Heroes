# Text-first visual-contract authoring at scale (Codex architecture, 2026-07-12)

**Thesis (refined by Codex):** story text + `imageDirection` generate a valid CANDIDATE contract. They CANNOT prove the renderer obeys geometry/scale/laterality/appearance. So visual QA does not disappear — it moves from **authoring → calibration/proof**.

**Scalable model:**
`text/imageDirection → deterministic extraction (with evidence) → offline LLM-assisted DRAFT → validator → human review/signoff → Codex/tool gate → selected calibration render → approved template artifact → runtime freeze/hash`
**No live LLM on the paid/frozen path** (mirrors Fork B).

## Derivability (what text gives us vs what needs eyes)
- **Deterministic from text:** storyKey/version/pageCount; child + companion cast; recurring-human role/gender/pages/evidence (Hebrew morphology — the הָרוֹפֵא→male fix proves it); per-page castIds/mustShow/propState; explicit laterality; locations/zones (from imageDirection).
- **LLM-assisted draft (descriptive only):** stableGeometry prose, forbidden clauses, prop material/scale/persistence, bodyState phrasing, cover no-spoiler. LLM must NOT fabricate evidence origins.
- **Needs visual/human:** appearance palettes look-sane, set reference sheets (rendered), does the renderer actually keep the room/scale/laterality stable, cover WOW. → CALIBRATION, not authoring.

## Existing infra to reposition (already on feat)
`scripts/compile-visual-contract-artifacts.ts` (batch runner — extend to emit `.visual-contract-template.json`, not just legacy `.json`) · `compileBookVisualContract.ts` (LLM draft seam — split deterministic extraction BEFORE the LLM) · `normalizeRawContract.ts` · `validateTemplateContract.ts` (fail-closed) · `selectCalibrationPages.ts` (already picks cover + establishing/transition/companion/prop risk pages) · `calibrateBookVisualContract.ts` (fails before render on invalid contract).

## Safety / hashing (money-adjacent)
LLM authoring OFFLINE only. Only the human-APPROVED JSON artifact is input to freeze/hash; drafts never served. **Scale the Codex re-gates:** gate the GENERATOR/tool ONCE (extraction rules + validator + no-live-LLM + stable serialization), batch-validate all artifacts in CI, Codex deep-reviews a sample + every validator failure + every tool change — NOT 18×470 lines by hand. Human signs every artifact.

## Irreducible visual step
Per launch slot: render **cover + 3–5 selected calibration pages LOW** (via selectCalibrationPages) → world/contract QA → only then a full-book render. Do NOT reduce to 1–2 pages for clinic-like stories (page 1 won't test laterality/prop/transition). Full-book render stays Guy's final sellability proof for the slots actually launched — but authoring no longer requires hand-writing the whole contract.

## Story-generator integration (Phase 4, post-MVP — the bridge Guy wanted)
The shelved generator already emits `imageDirection` per page (story-generator/markdown.ts, structured-draft-prompt.ts, story-gen-v3/story-md-renderer.ts). Long-term:
`generator → story.md/story-pages.json → visual-contract-source.json → facts → candidate template → validator → human review → calibration → approved story+template package`.
Paid generation must NEVER generate/revise the contract live.

## Phased plan
- **Phase 1** — text-first compiler for the launch slots (source extractor + deterministic fact extractor + Template-shape compiler + validate + review report). Owner: CC; Codex gate.
- **Phase 2** — human review + batch validator (evidence report; ambiguity flags; compact page table; Guy/ChatGPT approve/edit). Owner: CC + Guy/ChatGPT.
- **Phase 3** — calibration render per launch slot (selectCalibrationPages → cover+risk pages LOW → contract QA → then full render). Owner: Guy cost approval; Codex gate.
- **Phase 4** — full catalog + generator integration. Post-MVP.

## CC build briefs (Codex sketch — to be expanded on Guy's go)
- **A** — Source extractor: `story-bank/v3-approved/*.md` → `.source.json` (page text, imageDirection, frontmatter, companion, gender, pageCount). No LLM.
- **B** — Deterministic fact extractor `extractVisualContractFactsFromStory`: role/gender/evidence spans, location/zone clusters, page cast presence, recurring props, laterality mentions, transitions, confidence/ambiguity flags. Fact graph, not prose.
- **C** — Template compiler: source+facts → LLM drafts ONLY descriptive fields → `.visual-contract-template.json` → validateTemplateContract → fail-closed.
- **D** — Review report `storyKey.visual-contract-review.md`: field-by-field evidence, ambiguities, low-confidence fields, validator result, calibration-page suggestions.
- **E** — Calibration workflow: selectCalibrationPages → render LOW after Guy approval → store → fail/hold on drift.

## Decisions for Guy
1. Launch slot SET (which N stories) → Phase 1 scope.
2. Green-light building the tool (vs hand-author a few + build later). Codex + Cowork recommend: BUILD IT (only sane scale; bridges the generator).
3. Cost for calibration renders (Phase 3, per slot).
