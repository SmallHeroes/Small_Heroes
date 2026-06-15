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
- 0013 · cursor · J1 detector rerun: max_tokens 1500 applied; 5/5 vision OK; geography mostly right; pillow-cave tent-vs-collapsed NOT caught; J1 acceptance still pending Guy eye → `ai-roundtable/0013_cursor_J1-detector-rerun.md`  ← LATEST

(From here on, drop new exchanges as `NNNN_<author>_<topic>.md` IN this folder and add a line above. Claude's next review = `0014_claude_*.md`.)

Protocol: see `0000_PROTOCOL_for_agents.md`.
