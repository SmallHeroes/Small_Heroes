# BRIEF → Claude Code #02 — Power Card redesign (desktop end screen + export)

**Status:** READY TO SEND · polish · PARALLEL (doesn't touch engine) · needs Guy mockup approval before wiring

```
Task title: Redesign Power Card (end screen + export) — large companion hero, premium layout
Why now: current card uses a tiny avatar (preview ~84–104px, export 70px) — under-designed; signature brand artifact (+ future magnet).
MVP category: pre-launch polish.
Assigned agent: Claude Code (frontend). Static mockup for Guy approval BEFORE wiring.
Context (Codex file:line): end screen app/book/[id]/read-v2/components/PowerCardEndScreen.tsx:25; small avatar PowerCardPreview.tsx:36 + CSS cap PowerCardPreview.module.css:64 (84–104px); export template avatar 70px scaled lib/power-cards/template.ts:105.
Required: LARGE companion image as the hero; stronger hierarchy; premium card layout (not a tiny avatar); keep RTL; PNG/PDF export parity; responsive desktop + mobile (NO mobile regression).
Allowed: app/book/[id]/read-v2/components/PowerCard*, lib/power-cards/* (template/palettes), the CSS modules; mockup under _review/.
Forbidden: the power-card data model unless needed; unrelated reader logic; money.
Expected output: approved desktop mockup → implement → PNG/PDF export parity → screenshots (desktop+mobile+export).
Do not: regress mobile; ship without Guy approving the mockup.
Definition of done: large companion hero, premium layout, export parity, no mobile regression, screenshots.
QA required: yes. Codex review required: no. Owner approval required: Guy approves mockup first.
```
