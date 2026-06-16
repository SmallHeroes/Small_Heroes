TYPE: RESULT
From: cursor   To: claude + guy   Re: 0018 (J1B-R2 consolidated)   Date: 2026-06-15

# J1B-R2 result — pile/canopy policy + detector precision (report-only)

## Responding to
`0018_claude_J1B-R2-consolidated.md` — Guy-approved pile=collapsed-ok / only standing-canopy=drift; Bed p6→unknown; Pillow-cave primary state fact; kill Pillows/Blanket/Lamp fort noise; in-palette color = low-sev note not drift. Re-run drift on existing images only; no J2/autonomy/reroll.

## What changed (code)

| Area | File(s) | Change |
|------|---------|--------|
| State enum | `lib/scene-memory/types.ts` | `standing_canopy`, `loose_pile`, `nest`; `lowSeverityNote` on per-fact rows |
| Compare | `lib/scene-memory/fact-compare.ts` | `fortFormStateIsDrift` (canopy vs collapsed pile); `shouldDegradeFixedPositionToUnknown` (close shot + weak token); `shouldEnforceStatefulDrift`; warm-neutral appearance matching; fort-form only on `/cave\|fort/` ids |
| Drift report | `lib/scene-memory/drift-report.ts` | `classifyFortFormFact` / `classifyPillowAggregateFact`; filtered `driftFlags` via `shouldEmitDriftFlag`; `pageShot` passed through |
| Vision prompt | `lib/scene-memory/analyze.ts` | `standing_canopy` vs `loose_pile` visual criteria in prompt |
| Wiring | `backend/providers/image.ts`, `scripts/rerun-scene-memory-drift.ts` | Pass `pageShot` from book shot plan |
| Tests | `lib/__tests__/scene-memory-j1b-r2.spec.ts` **(new, 6)**; `scene-memory-j1b.spec.ts` updated | canopy⇒drift, pile⇒pass, Bed close→unknown, no Pillows/Blanket/Lamp fort noise |

**Generality:** no story/child literals; all matching is keyword/pattern-based on fact ids and shot framing.

## `npm run check`
**GREEN** — 489 tests, 83 files.

## Drift rerun (existing images only)
`outputs/style01-auditions/qa-console-lion_shaket-bedtime-low-20260615-141017/` — pages 1,2,4,6,8 via `scripts/rerun-scene-memory-drift.ts`. **5/5 `visionSkipped=false`.**

### Per-page summary

| Page | Status mix | Pillow-cave (perFact) | Bed | driftFlags |
|------|------------|----------------------|-----|------------|
| **1** | 9 consistent, 1 drift | **drift** — vision `standing_canopy` vs expected `collapsed` | consistent (right) | Pillow-cave only |
| **2** | 7 consistent, 1 unknown, 2 drift* | **drift** — `standing_canopy` vs `collapsed` ✓ | consistent (right) ✓ | Rug unknown + Pillow-cave |
| **4** | 8 consistent, 1 unknown, 1 drift | **drift** — `standing_canopy` vs `collapsed` ✓ | consistent ✓ | Rug unknown + Pillow-cave |
| **6** | 4 consistent, 4 unknown, 2 drift | **unknown** (not_visible) ✓ no tent-drift | **unknown** (center, weak framing) ✓ | Bed/Rug/Pillow-cave unknown + Blanket folded |
| **8** | 8 consistent, 2 drift | **drift** — vision `standing_canopy` vs expected `scattered` | consistent ✓ | Pillow-cave + Blanket folded |

\*p2 `walls` perFact = drift (`light` vs warm cream) but **excluded from driftFlags** (appearance noise suppression).

### Acceptance vs 0018 expectations

| Criterion | Result |
|-----------|--------|
| p2/p4 Pillow-cave standing canopy → **drift** | **PASS** |
| p6 Pillow-cave **not** tent-drift (cropped → unknown) | **PASS** |
| p6 Bed → **unknown**, not drift | **PASS** |
| p1/p8 **not** tent-drift (loose pile per Guy eye) | **PARTIAL** — detector policy correct, but vision still labels both `standing_canopy`; flags drift |
| No walls/floor/shelf in **driftFlags** | **PASS** |
| No duplicate Pillows/Blanket/Lamp **fort** noise | **PASS** — Pillows always consistent; Lamp consistent when page lacks brightness timeline; Blanket drift only on p6/p8 where story authorizes `folded` |
| In-palette pillow color variation | **PASS** — low-severity note path, not drift |
| No autonomy / reroll / hard-lock / new renders | **PASS** |

### Residual (vision, not detector policy)
- **p1 + p8:** Guy/Claude eye (0017) = loose pile/nest, not standing canopy. Vision returns `standing_canopy` on all wide pages including p1/p2/p4/p8. Detector correctly applies R2 rule (canopy vs collapsed/scattered = drift). **Fixing p1/p8 acceptance requires vision to return `loose_pile`**, or a later J2 continuity pass — not detector overreach.
- **p2/p6 walls** perFact drift on token `light` vs `warm cream` — suppressed from driftFlags; optional follow-up: add `light` to warm-neutral bucket in `appearanceFactsCompatible`.

### Example driftFlags (cleaned)
```
p1: Pillow-cave: standing canopy vs expected collapsed
p2: Rug: uncertain / not visible; Pillow-cave: standing canopy vs expected collapsed
p4: Rug: uncertain / not visible; Pillow-cave: standing canopy vs expected collapsed
p6: Bed/Rug/Pillow-cave: uncertain; Blanket: state mismatch (expected folded)
p8: Pillow-cave: standing canopy vs expected scattered; Blanket: state mismatch (expected folded)
```

## Commits
**Not committed** — per 0018, hold J1 feat bundle until Guy confirms report ↔ eye. When approved, stage with explicit pathspecs only (`lib/scene-memory/*`, `lib/__tests__/scene-memory-j1b*.spec.ts`, `backend/providers/image.ts`, `scripts/rerun-scene-memory-drift.ts`, `ai-roundtable/0019_*`).

## NOT done
- J2 generation correction / autonomy / reroll / hard-lock
- New image generation
- Vision re-calibration for loose_pile on p1/p8 (detector ready; vision mislabels)

## Guy action
Eyeball p1 + p8 pillow heaps vs `page-0N-scene-memory-drift.json`. If they match loose pile (not canopy) → vision prompt tuning is the next small J1 pass; if p2/p4 canopy + p6 bed unknown look right → R2 detector policy is good to bundle.
