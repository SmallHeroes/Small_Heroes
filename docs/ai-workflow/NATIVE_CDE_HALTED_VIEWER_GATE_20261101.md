# Native CDE halted-page reporting — 2026-11-01

Guy returned independent R2 PASS on a3ab1f88 and asked Codex to fix R2-F1 before the approved small LOW visual proof. Codex verified all 41 source pins, 108 writer and 59 reviewer files. One released writer, same clean checkout and branch; continue in this chat.

Observed/root cause: the native catch lists only diagnostic_render records; the viewer reads only selected/page/diagnostic_render records. The engine saves paid drawn candidates with unusable review/identity under halted_page_N, so both outputs falsely say no image was drawn. Fix the general prospective reporting boundary, not any historical book or verdict.

Scope: scripts/personal-book-e2e-trial.ts, native-book-continuity.spec.ts, CURRENT.md and ROADMAP.md. List candidate-bearing completed/halted pages in the opted-in stop record; display halted candidates as drawn with review incomplete, never approved. Keep original thrown error, accounting, no retry and legacy viewer bytes. No image/prompt/threshold/source-contract change.

Validation: positive page1/page2 review and identity stops; no-image render failure stays absent; real catch/source and viewer output; unmarked bytes; full18-spec offline gate, both typechecks, source diff/privacy and R17 preservation. Independent technical review remains Claude's role; route via Guy.

Cost: correction $0. User separately approved at most two LOW page images under a cumulative $1 cap including reviews and full UNKNOWN reserves. No new/full book, narration, extra image attempts or cap extension. A visual execution needs a compiled eligible source, qualified references and hard page-only envelope; current full-book sample success can continue automatically and is not admitted as that envelope. Reuse an existing approved source or hold, never rewrite R17.

Rollback: focused revert of this milestone. No resets, cleanup, push or deployment. Product acceptance and scale/image efficacy remain Guy's, not a technical pass.
