# Book continuity: verified diagnosis, scope and remaining limits

Owner intent: the book is one coherent story/world, not independent illustrations.
Same identities, object structure, geography and physical situations persist until
the story supports a change. Preserve humor, acting and camera diversity.

## What the paid artifacts demonstrate

Selected sample page1 (2987a50e) has corrected left-side window/front doorway.
Page2 (5d33bf62) depicts the driver outside the station at an extra box. Its QA
receipt flags props and scene, and the run stopped. Old repair752d0bb1 received a
false PASS for its window; retain that evidence. No statistical model-accuracy or
causal isolation claim follows from these few samples.

| Layer | Actual behavior before this change | Consequence |
| --- | --- | --- |
| Whole-book planning | The owner sample has an authored complete plan; the separate local preview planner receives the whole story. | It is FALSE that no component ever sees the whole book. The problem is retaining that meaning downstream. |
| Persistent state | previewContinuity keeps appearance strings and source-excerpt attribute changes; all12 Panda change arrays are empty. | Driver containment, wheel attachment and telescope custody are repeated page prose, not inherited/checkable relations. |
| Generation | First attempts in both local runners receive child/companion/prop refs, not previous pages. | Same setting is reconstructed independently; QA comparison is too late to prevent drift. |
| Context selection | Selected atlas removed future reference images; page2 still invented an extra box. | Board leakage was real but not the sole cause. Prompt compliance and staging remain separate. |
| QA | Prior3 pages, plan/context, identity refs and8 categories; no publication authority. | Detects some mismatches, misses others. A schema-valid PASS is not calibrated vision or numerical resemblance. |
| Retry | One repair allowed in original run, none reset in successor. | A repair did not fix wrong-wall geometry. Blind additional retries are not an architecture. |

## Existing architecture was checked, not replaced blindly

Production BookVisualContract already contains spatial nodes/relations, cast,
prop policies and typed action constraints. derivePageVisualContracts projects
zone geometry. Legacy scene-memory contains seeded stable facts/timelines and
prompt constraints. chunk-runner resolves it only without early runtime authority;
backend/providers/image.ts deliberately passes null legacy scene memory when PVB
runtime is active. The new local sidecar is NOT a replacement for that authority
chain and does not clear canonical Panda semantic HOLDs. Activating the legacy
memory indiscriminately would conflict with the production contract, not fix it.

Actual changed consumer is scripts/run-owner-book-draft.ts --sample. The separate
scripts/run-local-story-preview.ts remains unchanged with the diagnosed asymmetry;
production image.ts/chunk-runner/visual compiler remain unchanged. General means
story-independent behavior in this lane, NOT automatic migration of every path.

## Implemented remedy

1. A hash-bound sidecar covers every body page and declares overall motivation,
   scene visits, visible cast and principal physical relations for the whole
   entity inventory. Camera and expression do not change those relations.
2. Full-book validation before key access. Persistent state also survives pages
   where an entity is offscreen. No unmentioned relationship change, unknown target,
   containment/custody cycle, inventory loss or unsupported scene/location reset.
   Changes need exact before/after and a same-page source excerpt. Appearance is
   fixed by default; old attribute changes need explicit mutable-attribute opt-in.
3. One current packet goes to prompt and judge. It contains overall intent and
   recent narrative progress, not future visual designs or actions to draw now.
4. A hash/review-bound adjacent passed image is an additional generation reference
   within a scene visit only. No cover, failed image or cross-scene image as a
   generation template. Current canonical refs/state outrank prior pixels.
5. Repair uses its own failed edit target instead of a fifth image; the same scene
   state stays in force. Existing stop, uncertainty, cost and retry fences remain.

## What this does NOT solve by itself

- Source quotes prove byte linkage, not semantic entailment. A weak matching quote
  or incorrectly authored state still requires creative review; a test explicitly
  records this limitation. There is no new accepted-source or runtime authority.
- The ledger expresses one principal relation per entity, not a full3D scene or
  complete contact graph. Capacity, handedness, simultaneous wheel control, limb
  topology and incidental unregistered items still need their own typed coverage.
- Final Panda tote is prose in the prior plan, not an independent prop inventory
  entry; the sidecar records the wheel as detached/on-site, not a proven bag shape.
- Same-scene reference can copy a prior visual mistake, and added image context
  can cost more. Only a controlled visual pair can measure whether it improves
  scene continuity without flattening compositions. No new images in this task.
- Existing wide staging says head48%/feet81% while some numeric targets differ;
  this inherited framing tension is recorded, not silently folded into this fix.
- Existing prop-board crops may contain incidental edge fragments. No claim of
  semantic segmentation, calibrated anatomy or reliable autonomous acceptance.

## Next empirical test (not executed)

First independently review the code and authored sidecar. Then a bounded same-scene
pair1/2 through the same new mode; compare with the retained failure. Measure driver
inside/at-door continuity, station geometry, invented props, child response and
framing. Do not copy/approve an old false-PASS image or change thresholds to get
five green pages. Continue3-5 only after the pair's gate is genuinely satisfied.
Original spend reservation and unknown call remain accounted; the offline config
does not itself renew the previous run's aggregate budget.
