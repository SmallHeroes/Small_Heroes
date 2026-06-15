TYPE: RESULT
From: cursor   To: claude + guy   Re: 0015 (J1B detector hardening — consolidated)   Date: 2026-06-15

# J1B result — detector hardening on existing lion render

## Responding to
`0015_claude_J1B-detector-hardening-consolidated.md` — 4 Codex fixes + 2 Claude refinements; re-run drift on existing images only; no new generation; no J2/autonomy.

## What changed (code)

| Area | File(s) | Change |
|------|---------|--------|
| Fact typing | `lib/scene-memory/types.ts` | `factKind: position \| appearance \| stateful`; `SceneMemoryObservedState` enum |
| Compare logic | `lib/scene-memory/fact-compare.ts` **(new)** | Tolerant position buckets; state synonyms; appearance-only for walls/floor; warm-neutral + wood token matching |
| Seeding | `lib/scene-memory/seed.ts` | Inventory = **stableFacts only** (no visibleAnchor garbage); stateful timeline from pageAction **adjacent** keywords only (prefix/forward window); `factKind` on every fact |
| Classifier | `lib/scene-memory/drift-report.ts` | Compare by `factKind`; state mismatch = drift; removed fuzzy pillow-substring authorization; walls/floor excluded from driftFlags noise |
| Vision | `lib/scene-memory/analyze.ts` | Prompt requires `state` enum for stateful facts; normalizes observed state |
| Tests | `lib/scene-memory-j1b.spec.ts` **(new)** | 7 tests per brief checklist |

## `npm run check`
**GREEN** — 483 tests, 82 files.

## Drift rerun (existing images only)
`outputs/style01-auditions/qa-console-lion_shaket-bedtime-low-20260615-141017/` — pages 1,2,4,6,8 re-analyzed via `scripts/rerun-scene-memory-drift.ts` (~48s). **5/5 `visionSkipped=false`.**

### Per-page summary

| Page | visionSkipped | Pillow-cave | Bed | Window | Rug | False-pos geography drift? | driftFlag count |
|------|---------------|-------------|-----|--------|-----|---------------------------|-----------------|
| **1** | false | **DRIFT** `built_or_tent` vs `collapsed` | consistent | consistent | consistent | **No** walls/floor/shelf/lamp position noise | 4 (state-level) |
| **2** | false | **DRIFT** tent vs collapsed | drift (vision: center) | consistent | unknown (foreground) | No wall/floor position noise | 3 + 1 unknown |
| **4** | false | **DRIFT** tent vs collapsed | consistent | consistent | consistent | No | 3 |
| **6** | false | **DRIFT** tent vs scattered | drift (close framing) | consistent | **unknown** | No wall/floor position noise | 5 + 2 unknown |
| **8** | false | **DRIFT** tent vs scattered | consistent | consistent | consistent | No | 3 (+ lamp dim story_auth on p8) |

**Unauthorized props:** none on any page.

### Page 1 detail (Guy eyeball gate)
```
Bed: consistent (right)
Window: consistent (back-left · curtains)
Rug: consistent (center)
Pillow-cave: DRIFT — observed built_or_tent, expected collapsed  ← matches tent-in-image
walls/floor: consistent (beige/wood ≈ cream/wood)
```
Remaining p1 driftFlags are **state-level** on Blanket/Pillows/Lamp (vision reports folded/dimmed/tent on adjacent props) — not the old walls/floor/lamp-position false positives.

## Acceptance checklist (0015)

| Criterion | Result |
|-----------|--------|
| 5/5 visionSkipped=false | **PASS** |
| p1 pillow-cave tent → drift | **PASS** |
| window left + purple/curtains consistent (wide) | **PASS** |
| rug center consistent (unknown when cropped p6) | **PASS** |
| wall/floor/shelf position noise gone | **PASS** (walls/floor consistent p1; no background/foreground drift) |
| no autonomy/reroll/hard-lock | **PASS** |
| inventory clean | **PASS** (10 stableFacts only; no leo/same-child-bed) |

**J1 acceptance (Guy eye):** detector now flags the **primary form drift** (pillow-cave tent). Secondary state flags on Blanket/Pillows/Lamp may need Guy/Claude triage — vision sometimes conflates adjacent pillow props or mis-reads lamp brightness on p1.

## Commits
This commit (explicit pathspec): J1B detector hardening files + roundtable report. **Full J1 feat bundle still held** until Guy confirms report ↔ eye.

## NOT done
- J2 / learning / hard-lock / reroll
- New image generation
- `manifest.json` still embeds stale drift from original render run (JSON files on disk are updated)

## Guy action
Compare `page-01.png` ↔ `page-01-scene-memory-drift.json`. If pillow-cave drift + geography match your eye → approve J1 commit bundle.
