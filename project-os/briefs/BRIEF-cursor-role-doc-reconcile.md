# BRIEF → Cursor — Reconcile role docs to the operator model (doc-only)

**Task title:** Align repo role docs to DEC-008 (operator model) — remove the CTO-role contradiction.
**Why now:** DEC-008 accepted (Guy, 2026-07-06). `AGENTS.md` names **Codex** as CTO; `CLAUDE.md` + `docs/ai-workflow/AI_ROLES_AND_PROTOCOL.md` name **Claude** as CTO. These auto-load as agent context — agents currently read contradictory authority (OQ-T1). Both Claude Code and Codex flagged it independently.
**MVP category:** technical debt (unblocks clean agent operation; not a launch blocker but low-cost + high-clarity).
**Assigned agent:** Cursor. **Requires Agent mode** (currently Ask mode = read-only).

**Context — the target model (from `project-os/03-agent-roles.md`, DEC-008):**
- **Claude Cowork** = Project Operator / Chief of Staff (planning, routing, Project OS, briefs).
- **Codex** = Technical Gatekeeper / forensic reviewer; the gate on money/concurrency/security.
- **Claude Code** = Deep Specialist (architecture/generation/content review + narrow-scope implementation).
- **Cursor** = Frontend/UI executor under narrow specs.
- **ChatGPT** = External advisor (product/UX/story/creative/business).
- **Guy** = owner / final approver / only one who merges + pushes.
- Rule of thumb: Operator routes → specialist proposes → Codex gatekeeps → ChatGPT challenges → **Guy approves** → Cursor/CC execute.

**Allowed files (edit ONLY these three):**
- `CLAUDE.md`
- `AGENTS.md`
- `docs/ai-workflow/AI_ROLES_AND_PROTOCOL.md`

Update ONLY the roles/authority sections to match the model above. Keep each file's other content (Decision Gate, engineering principles, repo landmines, protocol steps) intact — only fix WHO holds which role. Add a one-line pointer in each: "Canonical roles: `project-os/03-agent-roles.md` (DEC-008)."

**Forbidden files/areas:** everything else. No code, no config, no other docs, no renames. Do not change the Decision Gate / STOP-check content itself. No `git add -A` (EOL landmine) — stage explicit pathspecs. `docs/` is gitignored → use `git add -f` for the AI_ROLES file.

**Expected output:** the three files edited to a single consistent role model + the canonical pointer; a diff for Guy to review.

**Do not:** invent new roles/process; touch the operator-model wording semantics (copy from `03-agent-roles.md`); expand scope.

**Definition of done:** three files agree with `03-agent-roles.md`; no contradictory CTO/executor lines remain; diff shown; committed with explicit pathspec (incl. `git add -f docs/ai-workflow/AI_ROLES_AND_PROTOCOL.md`) after Guy's review.
**QA required:** no (doc-only) — Guy eyeballs the diff.
**Codex review required:** no.
**Owner approval required:** yes — Guy reviews diff before commit/merge.
