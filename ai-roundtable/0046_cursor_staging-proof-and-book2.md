TYPE: RESULT
From: cursor   To: roundtable   Re: staging proof + book #2   Date: 2026-06-16

# 0046 — STAGING LOCK proof (lion p6/p8) + book #2 generalization (fox_uri)

## A) Lion staging proof — LOW p6 + p8 only

**Run:** `qa-console-lion_staging-proof-20260616-110700`  
**Viewer:** `/dev/viewer?dir=qa-console-lion_staging-proof-20260616-110700&root=outputs`

### stagingSurface (inferred)

| page | zone | stagingSurface | STAGING LOCK in prompt? |
|------|------|----------------|-------------------------|
| p1 | night_bedroom | **floor** | yes (pillow-cave) |
| p2 | night_bedroom | unknown | no |
| p4 | night_bedroom | unknown | no |
| p6 | night_bedroom | **floor** | yes — `on the FLOOR near the scattered pillow cave; do NOT place them on the bed` |
| p7 | night_bedroom | unknown | no |
| p8 | night_bedroom | **floor** | yes — `on the FLOOR near the pillow cave` |

### Images (Guy eyeball — floor vs bed)

| page | local PNG | setRefsPassed | appearance hard | scene notes |
|------|-----------|---------------|-------------------|-------------|
| **p6** | `outputs/style01-auditions/qa-console-lion_staging-proof-20260616-110700/page-06.png` | `blanket-fold-object.png`, `pillow-cave-object.png` (both) | **0** | Pillow-cave `loose_pile`; Blanket state review only |
| **p8** | `outputs/style01-auditions/qa-console-lion_staging-proof-20260616-110700/page-08.png` | both state refs | **0** | Pillow-cave `loose_pile` |

**Prompt proof (p6):** STAGING LOCK line present; state refs 2/2; style 0 (budget invariant holds).

**Acceptance:** Claude/Guy must eyeball **p6** — prior failure was child+Leo on **bed**; STAGING LOCK now active. JSON alone cannot prove floor staging.

---

## B) Book #2 — `fox_uri_adventure@v3-approved` (companion + location ≠ lion bedroom)

**Choice:** fox_uri · home-night **balcony/bucket cluster** (not lion bedroom fort). Full pipeline: scene memory + appearance seed + board generate/QA + staging lock + isolated bucket refs.

**Run:** `qa-console-fox_uri-book2-20260616-111640`  
**Viewer:** `/dev/viewer?dir=qa-console-fox_uri-book2-20260616-111640&root=outputs`  
**Pages:** p1 (bedroom_window), p5 (balcony_drip_area first bucket reveal), p6, p8 (bucket_close_area)

### stagingSurface (sample pages)

| page | zone | stagingSurface | STAGING LOCK |
|------|------|----------------|--------------|
| p1 | bedroom_window | unknown | — |
| p5 | balcony_drip_area | **floor** | `on the FLOOR; do NOT place them on the bed` |
| p6 | bucket_close_area | unknown | — |
| p8 | bucket_close_area | unknown | — |

### setRefs + drift (from manifest JSON)

| page | setRefsPassed | appearance hard | board attached |
|------|---------------|-----------------|----------------|
| p1 | — | 1 (window_door) | no |
| p5 | `bucket-object.png`, `bucket.png` | **1** (same_window position) | no |
| p6 | both bucket refs | 1 | no |
| p8 | both bucket refs | 1 | no |

### Set appearance board

- **sceneId:** `fixed_interior_bedroom_window_unspecified`
- **Generated:** `outputs/set-appearance-boards/fixed_interior_bedroom_window_unspecified/set-appearance-board.png`
- **QA:** **REJECTED** — `contains curtain fabric` / draped forms (same class of contamination as lion R1). `approved=false`, not attached to renders.
- **Pipeline still ran:** SET APPEARANCE LOCK text + scene memory + state/bucket isolated refs on p5–p8.

### Images

- p1: `.../page-01.png`
- p5: `.../page-05.png` (+ `page-05-appearance-drift.json`, `page-05-scene-memory-drift.json`)
- p6: `.../page-06.png`
- p8: `.../page-08.png`

**Cost:** ~$0.044 LOW (4 pages).

---

## Enablers (uncommitted — for Guy review)

| change | why |
|--------|-----|
| `story-bank/v3-approved/fox_uri_adventure.shot-plan.json` | fox had no sidecar; dev `resolveBookShotPlan` threw on page-1 shot |
| `lib/qa-console-run.ts` | `skipLlmPersonalization` (v3 12-page gender-swap infra bug); `skipPromptAudit` (fox night-adventure wardrobe TBD) |
| `scripts/run-0046-staging-proof-and-book2.ts` | repro script (not for commit) |

---

## Follow-ups (not in scope)

- Guy eyeball **lion p6** floor staging.
- Fox **board quarantine** — curtains on fixed-objects sheet (tighten QA or board prompt for window-without-drape).
- Fox **night wardrobe lock** (replace day-clothes DNA + drop `skipPromptAudit`).
- Pre-existing `dev-layout-overrides` test failures (3) — unrelated to this run.
