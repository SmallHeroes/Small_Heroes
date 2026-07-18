# Text-first visual-contract tool — CC build briefs (from Codex architecture, 2026-07-12)

Two briefs. Brief 1 = the offline compiler (Phases 1-2). Brief 2 = calibration (Phase 3). The tool is slot-agnostic; the RUN/review/calibrate targets the launch-slot set (Guy to specify). Queued behind CC's current task.

---

## BRIEF 1 → Claude Code — Text-first visual-contract compiler (offline: source → facts → LLM-drafted Template → validate → review report)

```
Task title: Build the text-first visual-contract compiler — generate a CANDIDATE template + review report per story, offline, before any render
Why now: Only 1/18 slots has a hand-authored contract (~470 lines). Hand-authoring the rest doesn't scale + blocks launch consistency. Codex architecture (project-os/briefs/PLAN-text-first-visual-contracts.md): derive a candidate contract from story text + imageDirection, offline + human-signed, so authoring stops being per-story hand-work — and it bridges to the shelved story generator.
MVP category: launch blocker (scales the visual-contract authoring the launch depends on).
Assigned agent: Claude Code (deep specialist). OFFLINE tooling. Codex re-gate the TOOL (it produces money-adjacent, hash-frozen artifacts).

CRITICAL constraints (Codex safety model — non-negotiable):
  - LLM authoring is OFFLINE ONLY, human-in-the-loop. Only the human-APPROVED artifact is EVER input to freeze/hash; drafts are NEVER served. NO live LLM on the paid/frozen path (mirrors Fork B).
  - Deterministic extraction runs BEFORE the LLM. The LLM drafts ONLY descriptive fields (stableGeometry prose, forbidden clauses, prop material/scale/persistence, bodyState phrasing, cover no-spoiler). It must NOT fabricate evidence origins / cast gender / laterality — those come from deterministic extraction.
  - Emit `.visual-contract-template.json` (the Template shape with structured bindings), NOT just the legacy `.visual-contract.json`.
  - Fail-closed: every draft passes validateTemplateContract; invalid → reject, never ship.
  - No \b for Hebrew — reuse the Hebrew-boundary helper from the gender-gate fix (07050dae) for all Hebrew morphology.

Components (numbered, dependent pipeline):
  1. SOURCE EXTRACTOR (no LLM): story-bank/v3-approved/*.md → {storyKey}.source.json (per-page text + imageDirection, frontmatter, companion, gender header, pageCount). Reuse the source seam in scripts/compile-visual-contract-artifacts.ts.
  2. DETERMINISTIC FACT EXTRACTOR (no LLM) extractVisualContractFactsFromStory → a fact GRAPH (not prose): recurring-human role/gender/evidence-span (gender via Hebrew morphology), location/zone clusters from imageDirection, per-page cast presence, recurring props, EXPLICIT laterality mentions (never invent left/right if absent), transition cues, + CONFIDENCE/AMBIGUITY flags on anything uncertain.
  3. TEMPLATE COMPILER: source + facts → offline LLM drafts ONLY the descriptive fields → assemble `.visual-contract-template.json` → normalizeRawBookVisualContract → validateTemplateContract (fail-closed). Split compileBookVisualContract.ts so deterministic extraction precedes the single LLM pass, and target the Template shape (not BookVisualContract).
  4. REVIEW REPORT: {storyKey}.visual-contract-review.md — story-phrase→field mapping (evidence), all inferred humans/genders, all locations/zones, every page's castIds/props/laterality/bodyState, LOW-CONFIDENCE fields flagged, validator result, calibration-page suggestions, diff from any previous approved artifact. This is the human-signoff surface (Guy/ChatGPT).

Reuse (don't reinvent): scripts/compile-visual-contract-artifacts.ts, lib/visual-contract-compiler/{compileBookVisualContract,normalizeRawContract,validateTemplateContract,contractTemplateTypes,contractArtifact}.ts.
Allowed: scripts/ (compiler + extractors), lib/visual-contract-compiler/* (extend extraction/compile ONLY — NOT the materialize/freeze/hash/render-guard path), a review-report writer; + tests.
Forbidden: render; ANY live LLM on the paid path; touching materialize/freeze/hash/render-guards; serving a draft artifact; \b for Hebrew.
Expected output: the offline pipeline emitting {storyKey}.source.json + {storyKey}.visual-contract-template.json (candidate) + {storyKey}.visual-contract-review.md; a run on 1-2 PILOT stories — critically, RE-DERIVE bunny_ometz_adventure and DIFF the candidate against the hand-authored template (strong self-check: does the tool reproduce the doctor=male lock, laterality 9-12, mom continuity, geometry?); npm run check green; tests for the deterministic extractors + fail-closed validation.
Do not: claim the candidate is "approved" — the tool produces CANDIDATES only; Guy signs + calibration proves.
Definition of done: for the pilot, the tool emits a schema-valid candidate template + review report (evidence + ambiguity flags), offline, no render, fail-closed; the bunny re-derivation is compared to the hand-authored template with gaps documented; check green; TOOL handed to Codex to gate (extraction rules + validator + no-live-LLM + stable serialization).
QA required: yes — check + extractor tests + the bunny re-derivation diff. Codex review required: YES (money-adjacent tool). Owner approval: Guy signs each candidate before use.
```

---

## BRIEF 2 → Claude Code — Contract calibration workflow (prove a candidate visually before full render)

```
Task title: Build the contract calibration workflow — render cover + risk pages to prove a candidate template before a full book
Why now: Codex — a text-derived candidate can't PROVE the renderer obeys geometry/scale/laterality/appearance. Before a slot's contract is trusted for a sellable book, render a small calibration set + contract QA. This is the irreducible visual step (authoring moves to text; QA moves to calibration).
MVP category: launch blocker (per-slot visual proof).
Assigned agent: Claude Code (wire the workflow) + Guy (cost approval + eyeball) + Cowork (pull images/logs). Codex gates the technical path.
Required:
  1. Use selectCalibrationPages to pick cover + 3-5 RISK pages (establishing location, transition, companion action, key prop continuity, and — for medical/procedure stories — the laterality pages). Do NOT reduce to 1-2 (page 1 won't test laterality/prop/transition).
  2. Render ONLY those pages at LOW on staging (steering ON) from the candidate/approved template. Guy approves the small cost.
  3. Run world/contract QA (Slice A) + surface laterality/body checks for Guy's eye (not gated until Slice C).
  4. HOLD on drift: if the calibration set drifts, do NOT promote the contract; report the failing check.
  5. Only after calibration passes → allow a full-book QA render for that slot (Guy's final sellability proof).
Reuse: lib/visual-contract-compiler/{selectCalibrationPages,calibrateBookVisualContract}.ts (the calibrator already fails before render on an invalid contract).
Allowed: scripts/ + lib/visual-contract-compiler/calibrate*; the staging render trigger; Cowork pulls images+logs.
Forbidden: prod; enabling steering on prod; a full-book render before calibration passes.
Expected output: a calibration run per target slot (cover + risk pages, LOW, staging) + the contract-QA result + Cowork contact sheet + drift read; a PASS/HOLD per slot.
Definition of done: calibration renders the risk set, runs contract QA, holds on drift, and gates the full render; a slot passes only after cover+risk pages are visually confirmed.
QA required: yes — the calibration IS the QA (Cowork pull + Guy eye). Codex review required: the technical path. Owner approval: Guy (cost + eyeball).
```
