# Brief J1 — SceneMemory Foundation + Drift Report (NO autonomy)

**Owner:** Claude (CTO). 3-way agreed (Claude + Codex + ChatGPT). **Mandate (Guy):** quality-first — this is the heart of the product's visual believability. But **build only the measurable floor**, not the full engine.
**What this is:** the first, safe layer of the Adaptive Scene Memory Engine (ASME). The full target lives in `cursor-brief-J-adaptive-scene-memory-engine.md` — that file is a **VISION DOC, DO NOT IMPLEMENT DIRECTLY.** Implement **only** what is in this J1 brief.
**The J1 thesis:** before a system can *correct* continuity, it must *prove it can SEE* continuity. J1 builds the memory + injection + a **drift REPORT**. No auto-correction until the report demonstrably agrees with Guy's eye.

---

## ⛔ Generality contract (non-negotiable)
- No `if (storyFile === ...)`, no story-specific literals. Works for any scene/room type by the same code.
- `lion_shaket_bedtime` is the **test case only**.
- Hand-authored data (StoryLocationBible / SetTopology) may **seed/constrain** SceneMemory, never be hardcoded per story.

## Source of truth is LAYERED — vision is NEVER the sole judge (the #1 rule)
Precedence, highest first:
1. **story text / pageAction**
2. **approved seed** (existing StoryLocationBible / SetTopology, if present)
3. **set-plate vision** (analysis only)
4. **rendered-page vision** (evidence only)
5. **human approval**
Runtime vision alone must never lock a fact. Vision is **evidence**, not a judge.

---

## What J1 BUILDS

### 1. `SceneMemory` schema (foundation subset)
```
SceneMemory {
  sceneId: string                  // content-derived (e.g. "bedroom_night"); J1 = single scene for lion
  sceneType: "fixed_interior" | "fixed_exterior" | "journey_leg" | "abstract"
  seedSource: "approved_wide_page" | "set_plate" | "authored_seed"
  stableFacts: {                   // fixed geometry/appearance
    [objectId]: {
      position: string             // wall + relative location
      appearance?: string
      color?: string
      confidence: number           // 0..1 (J1 may set, but NEVER auto-promotes to a hard lock)
      lockLevel: "open" | "soft" | "human_locked"   // J1: NO automatic hard lock from one image
      provenance: ("story" | "authored_seed" | "set_plate_vision" | "page_vision" | "human")[]
    }
  }
  statefulObjects: {               // legitimately change on the story timeline
    [objectId]: { identity: string, timeline: [{ page, state, authorizedBy: "story" | "human" }] }
  }
  unknowns: string[]
  allowedChanges: string[]
  forbiddenChanges: string[]
  inventory: string[]              // closed set — "only these items exist"
}
```

### 2. `sceneMemoryPlan` on `BookImageLockContext` (shared QA + production path)
Add `sceneMemoryPlan` to `BookImageLockContext` so QA-console and production resolve and pass it through **one** path (do NOT reintroduce the Brief-H divergence). Seams:
- **Production:** resolve alongside `ensureStoryLocationPlan` — `lib/generation-pipeline/chunk-runner.ts:~699` — and pass into `generateAllPageImages`.
- **QA console:** resolve in/next to `resolveQaBookLockContext` — `lib/qa-console-book-lock-context.ts:~35`.
- **Shared render:** consumed by `generateAllPageImages` — `backend/providers/image.ts:~3893` — via `BookImageLockContext`.

### 3. Seeding (smart, not "page 1 always")
Seed SceneMemory using the layered precedence:
- if a **sufficiently-wide, approved story page** exists → seed from it;
- else **render a character-free set-plate** (LOW, empty room) and seed from it;
- if an **authored seed** (SetTopology/StoryLocationBible) exists → use it as initial constraints.
The set-plate (if rendered) is used **for analysis/seed ONLY** in J1 — **never attached as a page reference.** Memory becomes `human_locked` only after Guy approves or on strong multi-page corroboration — **never from a single image.**

### 4. `SCENE MEMORY LOCK` prompt injection (extends, doesn't replace, SET TOPOLOGY LOCK)
Render a per-page `SCENE MEMORY LOCK`, filtered by sceneId + shot type, built from SceneMemory. Wide pages get full geography; close-ups get a light "same room, match palette, invent nothing not in inventory" lock. Extend the existing block in `lib/story-location-bible/compose.ts` (the SET TOPOLOGY LOCK from Round 1A). `BookShotPlan` + `pageAction` still own camera/pose.

### 5. New vision interface `analyzeSceneMemoryImage`
```
analyzeSceneMemoryImage(image, expectedMemory?) -> ObservedSceneFacts
```
- Returns observed set facts (objects, walls/positions, colours, states) **with a confidence each, and an explicit `unknown` / `uncertain` when not clearly visible.**
- The existing `lib/generation-pipeline/page-visual-qa.ts:~220` is general QA (anatomy/style/time/geometry) and is **insufficient** — this is a new, dedicated interface.
- Provider-agnostic. On vision failure or low confidence → **return uncertain; do NOT learn, do NOT reroll, flag for review.**

### 6. `SceneMemoryDriftReport` (post-render, REPORT ONLY)
After rendering, for each page produce a report comparing expected SceneMemory vs `analyzeSceneMemoryImage` output:
```
SceneMemoryDriftReport {
  page, sceneId,
  expected: {...}, observed: {...},
  perFact: [{ factId, status: "consistent" | "new_info" | "story_authorized_change" | "drift" | "unknown" }],
  driftFlags: string[],            // e.g. "bed moved to left wall (expected back-right)", "unauthorized prop: plush"
  sceneMemoryLockPresent: boolean
}
```
Write it to the manifest/output dir next to the images (like the existing QA manifest fields).

### 7. Drift classification (report only — NO action)
Each fact → `consistent` | `new_info` (additive candidate) | `story_authorized_change` (text/pageAction allowed it) | `drift` (contradicts a fact with NO story authorization, or a hallucinated prop) | `unknown`. **Text-authority rule:** only story text/pageAction can authorize a set change; otherwise a contradiction = `drift`.

## What J1 DOES NOT BUILD (hard out-of-scope)
- ❌ No auto-reroll / no auto-correction.
- ❌ No automatic hard-lock from one image.
- ❌ No set-plate (or any composed image) attached as a page reference.
- ❌ No full automatic learning loop.
- ❌ No full multi-scene / journey / re-entry.
- ❌ Not solving the whole catalog — lion is the test case.
- ❌ Do not revive `zoneSetPath`. Do not regress Brief H or the Round 1A SET TOPOLOGY LOCK.

## Reference budget (P1)
No set-plate as a page ref. Per page: child + companion + (at most **one** isolated/cropped element ref, only if needed) + style. Identity (child/companion) never evicted; style cedes first; selection explicit — **no silent slicing.** Aligns with the existing selector at `lib/story-location-bible/set-topology.ts:~126`. Manifest logs `sceneId`, `sceneMemoryLockPresent`, refs requested/passed/dropped, and the drift report.

## Tests (prompt/report-level — must pass before render)
- `SCENE MEMORY LOCK` is emitted and contains SceneMemory facts; QA and production both attach `sceneMemoryPlan` (one path).
- `analyzeSceneMemoryImage` returns `unknown`/`uncertain` for not-visible facts (not forced true/false).
- A drift report is produced per page with the five statuses.
- No composed/set-plate image is attached as a page ref; close_up never gets one.
- No story-specific literals; no auto-hard-lock; no reroll path exists.
- `npm run check` green.

## Acceptance (the J1 gate)
Render lion `p1/p2/p4/p6/p8` LOW, then:
1. The prompt includes `SCENE MEMORY LOCK`.
2. QA + production used the same `sceneMemoryPlan`.
3. A `SceneMemoryDriftReport` is produced for each page.
4. The report correctly identifies: bed moved / not; window+curtains consistent / not; rug consistent / not; pillow-cave consistent / not (incl. tent-vs-scattered); any unauthorized new prop.
5. The report returns `unknown`/`uncertain` where something isn't visible.
6. No auto-reroll happened; no fact hard-locked from one image.
**PASS = Guy reads the report and the images and says "yes, the report sees what I see."** Only then do we proceed to **J2** (confidence lifecycle + learning + earned hard-lock), and later J3 (autonomy). If the detector does NOT match Guy's eye, we fix the detector before any autonomy — never give reroll power to a detector we don't trust.

## Guardrails / git
Style01 only · don't regress Brief H or Round 1A · 2.5D not 3D · identity refs top priority · explicit pathspecs only (worktree has unrelated junk — never `git add -A`; do not touch `public/*`, `HANDOFF*`, untracked scripts). Suggested commits per green milestone: `feat(scene-memory): SceneMemory schema + sceneMemoryPlan on BookImageLockContext (shared QA/prod)` · `feat(scene-memory): SCENE MEMORY LOCK injection extending SET TOPOLOGY LOCK` · `feat(scene-memory): analyzeSceneMemoryImage + SceneMemoryDriftReport (report only, no autonomy)`.

## Deliverable order
Schema + `sceneMemoryPlan` wiring (shared path) → seeding → SCENE MEMORY LOCK injection → `analyzeSceneMemoryImage` → drift report → `npm run check` → lion p1/p2/p4/p6/p8 LOW → post the images + the per-page drift reports. Then Guy validates the report against his eye.
