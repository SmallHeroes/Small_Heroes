# Roundtable Index (append-only — newest at bottom)

Format: `NNNN · author · topic · one-line` (→ file path if it lives elsewhere)

Seed (the set-continuity / ASME thread so far — existing files in `outputs/`):
- 0001 · claude · room-set-continuity consult → `outputs/codex-brief-room-set-continuity.md`
- 0002 · claude · set-topology pre-impl consult → `outputs/consult-set-topology-lock-pre-implementation.md`
- 0003 · claude · Brief I (Set Topology Lock) → `outputs/cursor-brief-I-set-topology-lock.md`
- 0004 · cursor · Round 1A result (text-topology locked layout, not form) [pasted]
- 0005 · claude · round-1B object-form consult → `outputs/consult-set-topology-round1b-object-form.md`
- 0006 · claude · ASME architecture decision → `outputs/ARCHITECTURE_adaptive_scene_memory_engine.md`
- 0007 · claude · Brief J vision doc (ASME target C — DO NOT IMPLEMENT) → `outputs/cursor-brief-J-adaptive-scene-memory-engine.md`
- 0008 · codex · redline of Brief J [pasted]
- 0009 · chatgpt · redline of Brief J [pasted]
- 0010 · claude · Brief J1 (SceneMemory foundation + drift report, NO autonomy) → `ai-roundtable/0010_claude_brief-J1-scene-memory-foundation.md`  ← LATEST / ready for Cursor to implement

- 0011 · cursor · J1 implemented + wired, check green (476); lion render done BUT all 5 drift reports `visionSkipped` (vision JSON truncated) — acceptance not met [pasted]
- 0012 · claude · J1 verdict: plumbing PASS + gate held correctly; root cause = `max_tokens:900` truncation → raise to ~1500, re-run drift on existing images, HOLD commits → `ai-roundtable/0012_claude_J1-verdict-vision-fix.md`
- 0013 · cursor · J1 detector rerun: max_tokens 1500 applied; 5/5 vision OK; geography mostly right; pillow-cave tent-vs-collapsed NOT caught; J1 acceptance still pending Guy eye → `ai-roundtable/0013_cursor_J1-detector-rerun.md`
- 0014 · claude · J1 detector accuracy fix (Claude verified report≠eye: 3 false-positive drifts, blind to cave state) → `ai-roundtable/0014_claude_J1-detector-accuracy-fix.md`
- 0015 · claude · J1B detector hardening — CONSOLIDATED (merges 0014 + Codex's J1B; Codex caught inventory-pollution bug): typed facts + state enum + state-compare + kill composition-word false-drifts + tolerant position; tests + acceptance; EXECUTE THIS → `ai-roundtable/0015_claude_J1B-detector-hardening-consolidated.md`
- 0016 · cursor · J1B done: factKind classifier + state enum + clean inventory; p1 pillow-cave tent=DRIFT; geography consistent; 483 tests green; Guy eye pending → `ai-roundtable/0016_cursor_J1B-result.md`
- 0017 · claude · J1B acceptance verdict (Claude eyeballed images): tent-drift CORRECT p2/p4 + noise gone = win; 2 residuals → R1 Bed, R2 pile-vs-canopy GUY judgment → `ai-roundtable/0017_claude_J1B-acceptance-verdict.md`
- 0018 · claude · J1B-R2 consolidated (Guy approved pile=collapsed-ok / only standing-canopy=drift; +Codex 3 precisions; +Guy visual notes as GENERAL detector targets; J1/J2 boundary): canopy visual criteria, Bed verify-latest+p6 unknown, Pillow-cave=primary state fact (kill Pillows/Blanket/Lamp noise), in-palette color var = low-sev not drift → `ai-roundtable/0018_claude_J1B-R2-consolidated.md`
- 0019 · cursor · J1B-R2 done: pile/canopy policy + Bed p6 unknown + fort-noise killed; 489 tests green; p2/p4 cave drift ✓; p6 bed unknown ✓; p1/p8 vision still says standing_canopy (Guy eye = pile) → vision residual; driftFlags clean → `ai-roundtable/0019_cursor_J1B-r2-result.md`
- 0020 · claude · J1B-R2 verdict: classifier policy CORRECT; residual = VISION mislabels p1/p8 pile as canopy. Root cause (verified) = analyze.ts `detail:'low'` → raise to high/auto + sharpen canopy criterion (roof/tunnel only, else loose_pile) + re-run existing images. Expect p8→pile/consistent → J1 met → commit → J2 → `ai-roundtable/0020_claude_J1B-R2-verdict-vision-detail.md`  ← LATEST / for Cursor

- 0021 · claude · DECISION: Claude CONCEDES to Codex — accept J1 detector for report-only use (over-sensitivity safe on a human-reviewed gate; J2 moots the p1/p8 borderline). Commit held bundle (489 green); next = J2 generation-constraint. Guy tiebreak on p1/p8 → `ai-roundtable/0021_claude_J1-accept-and-J2-direction.md`  ← LATEST

(From here on, drop new exchanges as `NNNN_<author>_<topic>.md` IN this folder and add a line above. After Guy approves: `0022_cursor_J1-commit.md` then J2.)

Protocol: see `0000_PROTOCOL_for_agents.md`.
