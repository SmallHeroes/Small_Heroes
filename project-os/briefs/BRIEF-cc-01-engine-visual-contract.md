# BRIEF → Claude Code #01 — Engine: visual-contract enforcement (clinic drift blocker)

**Status:** READY TO SEND · P0 launch blocker · needs Guy mom-continuity decision (below) · after CC + Codex re-gate → 1 bunny QA render (pages 6-12)
**Source:** Codex file-grounded diagnosis (2026-07-08) + Cowork consolidation. Real book cmrbzemgn.

```
Task title: Enforce visual-contract set-topology, recurring-prop identity, page-action/body-state, and laterality + make QA contract-aware (clinic drift blocker)
Why now: Real staging book cmrbzemgn drifts systemically (door/decor/furniture re-improvised, exam-chair identity changes, child on the FLOOR mid-exam, bandage on the WRONG arm) DESPITE the contract being frozen AND steered into every prompt. Codex root-caused: the contract is a TEXT-ONLY spine — encodes location/zone/cast/wardrobe/mustShow/propState but NOT stable geometry, recurring-prop identity, scale, body/action state, or laterality; and QA is NOT contract-aware (contract checks are observability-only, not gate-driving) → the defective book passed as status=ready. #1 sellability blocker.
MVP category: launch blocker (visual consistency engine). MONEY-ADJACENT: extends the frozen/hashed contract shape → Codex re-gate mandatory (coordinate with DEC-002 fail-closed freeze).
Assigned agent: Claude Code (engine). GENERAL fix, not bunny-specific. NO full render until fix + Codex re-gate + Guy cost approval.

Context — verified by Codex (ground truth; the wiring is FINE, the contract+QA are the gap):
- Contract IS in Style01: cover (chunk-runner.ts:948/957/999); pages get visualContractPromptBlock (chunk-runner.ts:1278/1304/1359); Style01 puts it at prompt top (image.ts:3368); sceneClass from contract env (style01-prompt-assembly.ts:586); style refs by env (image.ts:3351).
- No vision-QA gate yet (types.ts:10). PageVisualContract ends at mustShow/propState/camera/castIds/transition (types.ts:136) — insufficient for "same room exactly."
- adapters.ts:51 leaves stableGeometry:[] even when authored data exists; Set Topology Lock only fires with exactly ONE location + ONE zone (adapters.ts:99/108) → bunny (clinic+outside, waiting+exam) gets NO real topology lock.
- No approved zone sheets for bunny (bunny_ometz_adventure.zone-sheets missing) → no canonical door/wall/chair reference.
- Ref cap = 4 (generate-image.ts:245); budget split child/bunny/others/style/set (image.ts:3321/3356) → set refs starved.
- QA not contract-aware: inputs only expectsChild/expectsCompanion/expectedPageTimeOfDay (page-visual-qa.ts:67/313; image.ts:3131); companion check won't fail on small drift (page-visual-qa.ts:119); contractObservability is observability-only (quality-evidence-producer.ts:61; chunk-runner.ts:209); page-world-qa.ts exists but only in QA console (qa-console-run.ts:872), not automatic delivery.

Required changes (GENERAL — schema/adapter/prompt/refs/QA):
1) Extend the contract schema: per-zone STABLE GEOMETRY (door, wall/decal layout, cabinets/furniture, floor cues); PERSISTENT PROP identity (exam_chair geometry/shape/material + SCALE-TO-CHILD); BODY/ACTION state (child seated on exam_chair, doctor action, companion position); LATERALITY continuity (injectionArm, bandageArm, "holds parent's hand with the other arm") — fixed left/right that persists across pages.
2) Adapter + prompt: stop leaving multi-zone stableGeometry empty when authored data exists (adapters.ts:51); support multi-location/multi-zone topology (not only single-room); promote propState/action into PageLocationPlan.pageAction so "PAGE ACTION — MANDATORY" fires (zone-sheets.ts:217; adapters.ts:83 doesn't set pageAction today); add STABLE GEOMETRY / PERSISTENT PROP / BODY STATE / LATERALITY lines to the authoritative contract prompt block.
3) References: add approved zone/set sheets for clinic.waiting_room and clinic.exam_room (door / sticker wall / exam chair); PROTECT set/prop refs in the reference budget (generate-image.ts:245; image.ts:3321/3356) — style refs must not evict them.
4) QA gate — contract-aware + gate-driving: promote contract-derived checks from observability-only to GATE-DRIVING (quality-evidence-producer.ts:61; chunk-runner.ts:209); wire world/contract QA (page-world-qa.ts) into QualityEvidence/readiness for frozen-contract renders; required checks = zone match, recurring-prop identity, required body/action state, laterality consistency, forbidden-scene; on fail → regen if budget remains, else needs_human_qa (NOT ready).
5) Tests (negative fixtures): child on floor while contract says seated on exam_chair → FAIL; bandage on opposite arm from injection → FAIL; exam chair visible but redesigned → FAIL; multi-zone clinic emits stable geometry (not reliant on single-room topology).

Allowed: lib/visual-contract-compiler/* (types/adapters/materialize/validate), lib/story-location-bible/zone-sheets.ts, lib/generation-pipeline/chunk-runner.ts, backend/providers/image.ts, lib/generate-image.ts, lib/generation-pipeline/{page-visual-qa,page-world-qa,quality-evidence-producer}.ts, story-bank/v3-approved/bunny_ometz_adventure.* (author as the FIRST instance of the general mechanism); tests.
Forbidden: receipt/refund/readiness transaction machinery beyond wiring the QA result; the atomic freeze/hash MECHANICS except as required to include new fields (a changed hashed shape is EXPECTED → Codex re-gate); no full render; no bunny-only hacks that don't generalize.
Expected output: general schema+adapter+prompt+refs+QA impl; bunny authored as first instance; npm run check green + the negative fixtures; files+commits; explicit note of the frozen-contract shape change for Codex.
Do not: claim "verified/consistent" (Codex's word); render unprompted; fix only topology and skip laterality/pageAction/contract-aware QA.
Definition of done: contract encodes + prompt enforces stable geometry, persistent-prop identity+scale, body/action state, laterality; QA is contract-aware and gate-driving (drift → regen or needs_human_qa, never silent ready); negative fixtures pass; npm run check green; pushed to feat/chunked-generation; handed to Codex for the money-adjacent re-gate.
QA required: yes — check + negative fixtures; then ONE bunny QA render (pages 6-12 focus) after Codex PASS + Guy cost approval.
Codex review required: YES — mandatory (hash-affecting).
Owner approval required: Guy approves mom-continuity policy + authorizes the render.
```

## OPEN DECISION (Guy) — mom continuity
Codex: mom appear/disappear is NOT a bug — contract authors mom only on pages 1,4,9,10,12 (bunny contract:125). Continuous mom in the clinic = a policy/contract authoring change. Cowork lean: continuous reads truer. **Guy to decide → fold into the brief.**
