TYPE: RESULT
From: cursor   To: claude + guy + codex   Re: 0023 (J1 landing + J2 brief)   Date: 2026-06-15

# Part A + Part B — J1 wiring landed, J2 generation constraints + validation render

## Responding to
`0023_claude_finish-J1-landing-and-J2-brief.md`

---

## Part A — commit shared-path wiring

**Diff review:** all three files are **100% SceneMemory wiring** — no unrelated edits to separate.

| File | What changed |
|------|----------------|
| `lib/book-image-lock-context.ts` | `sceneMemoryPlan` on context; `sceneMemory` on `PageImageLockSlice` |
| `lib/qa-console-book-lock-context.ts` | `resolveSceneMemoryPlan` + pass-through to QA image fields |
| `lib/generation-pipeline/chunk-runner.ts` | resolve `sceneMemoryPlan` in page-images chunk; pass to lock context |

**Commit:** `5a809955` — `feat(scene-memory): wire sceneMemoryPlan through shared lock context`  
**`npm run check`:** green before commit.

---

## Part B — J2 proactive generation constraints

**Mechanism (general, no story literals):**
- `buildSceneMemoryGenerationConstraints()` in `lib/scene-memory/compose.ts` — per-page timeline state drives fort-form instructions (collapsed/scattered → anti-canopy FORBIDDEN block); fixed-position hard lines; palette/appearance locks.
- Appended to `buildSceneMemoryLockBlock` on **wide and close-up** paths when `pageNumber` is set.
- Wired through `story-location-bible/compose.ts` → `style01-prompt-assembly.ts` → `qa-console-run.ts` (sceneMemory on assembly + drift report files on disk).

**NOT done (J3 boundary):** no auto-reroll, no detector-in-the-loop at generation, no autonomy.

**Commit:** `76c5cf6b` — `feat(scene-memory): J2 proactive generation constraints from SceneMemory`  
**Tests:** `lib/__tests__/scene-memory-j2.spec.ts` (4 tests) — **493 total green**.

### Files in `76c5cf6b`
- `lib/scene-memory/compose.ts`, `index.ts`
- `lib/story-location-bible/compose.ts`
- `lib/style01-prompt-assembly.ts`
- `lib/qa-console-run.ts`
- `lib/__tests__/scene-memory-j2.spec.ts`

---

## Validation — NEW LOW render + J1 detector

**Output dir:** `outputs/style01-auditions/qa-console-lion_shaket-bedtime-low-j2-20260615-183145/`  
**Rendered:** p1, p2, p4, p8 (LOW, gpt-image-2)  
**Failed:** **p6** — 3 attempts; `Page 6 soft timeout after 240000ms` then `Supabase buffer upload failed: Bad Gateway` (infra, not J2 logic). Prompt on p6 included full J2 constraint block before failure.

### J1 drift vs pre-J2 baseline (141017)

| Page | Pre-J2 Pillow-cave | Post-J2 Pillow-cave | driftFlags (post-J2) |
|------|-------------------|---------------------|----------------------|
| **p1** | `standing_canopy` → **drift** | `loose_pile` → **story_auth / collapsed OK** | Rug unknown only |
| **p2** | `standing_canopy` → **drift** | `loose_pile` → **consistent** | Bed/Rug unknown (conservative) |
| **p4** | `standing_canopy` → **drift** | vision all **uncertain** (parse low-confidence) | unknown flags only |
| **p6** | — | **not rendered** | — |
| **p8** | `standing_canopy` → **drift** | `loose_pile` → **story_auth / scattered OK** | Blanket folded state |

**Primary J2 payoff met on assessed pages:** no `standing_canopy` / tent drift on p1/p2/p8; geography mostly consistent (Bed/Window back-right/back-left on wide pages).

**Residuals (not J2 blockers):**
- p8 Blanket `folded` state still missed by image model (story-authorized; drift flag expected until generation obeys fold instruction).
- p4 vision returned all-uncertain (detector couldn't score — re-run or eyeball).
- p6 needs infra retry.
- walls `light` vs `warm cream` perFact on p1/p8 — suppressed from driftFlags (J1B policy).

### Prompt proof (J2 block present)
All rendered pages show `THIS PAGE — SCENE MEMORY GENERATION CONSTRAINTS` + `FORBIDDEN: standing tent` in saved `prompts/page-0N-prompt.txt`.

---

## Guy action
1. Eyeball `qa-console-lion_shaket-bedtime-low-j2-20260615-183145` p1/p2/p8 — confirm cave reads collapsed pile not tent.
2. Retry p6 when Supabase stable (or re-run QA console page 6 only).
3. If J2 visual pass → issue J3 brief separately (autonomy/reroll still out of scope).

## NOT started
J3 / auto-reroll / hard-lock.
