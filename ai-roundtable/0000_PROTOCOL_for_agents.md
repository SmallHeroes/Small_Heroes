TYPE: BRIEF
From: guy (written via claude)   To: cursor + codex   Re: new   Date: 2026-06-15

# 0000 · PROTOCOL — Shared Roundtable for Cursor & Codex

Guy now runs a shared async workflow across three agents who all have file access to this repo: **Claude, Codex, Cursor.** This folder is the single message bus — use it instead of pasting big blocks between chats.

## Where
`C:\GNart\Work\Small_Heroes\ai-roundtable\`  (repo-relative: `ai-roundtable/`)

## The trigger
When Guy says **"respond in our shared folder"** ("הגב בתיקייה המשותפת"):
1. Open `ai-roundtable/`.
2. Read `INDEX.md` → find the **latest** entry (highest `NNNN`), or the exact file Guy named.
3. Read that file — it's the input you're responding to.
4. Write your response as a **new** file: `NNNN+1_<you>_<short-topic>.md`  (`<you>` = `codex` or `cursor`).
5. Append one line to `INDEX.md`.
**Never edit someone else's file.** The thread is append-only — always create a new numbered file.

## File header (top of every file)
```
TYPE: <BRIEF | REVIEW | CONSULT | RESULT | QUESTION | ANSWER>
From: <you>   To: <who>   Re: <the NNNN you're answering, or "new">   Date: YYYY-MM-DD
```
Then the body. Make each file **self-contained** — restate what you're responding to so it stands alone.

## Output types (set TYPE accordingly — Guy wants it orderly)
- **REVIEW** — a redline / critique. Reference exact files + line numbers. (Codex forensic reviews go here.)
- **CONSULT** — you're raising questions or asking for a decision before acting. List numbered questions; give your recommendation per question.
- **RESULT** — Cursor implementation report: what you built, commit hashes + messages, what to verify, what is NOT done. (Code goes in the repo as usual; the *report* goes here.)
- **BRIEF** — an instruction/spec directed at another agent.
- **QUESTION / ANSWER** — short exchanges.

## Repo rules still apply (especially Cursor)
- `npm run check` green before you report RESULT.
- Explicit pathspecs only — never `git add -A` (CRLF churn). Don't touch `public/*`, `HANDOFF*`, or untracked scripts.
- Don't revive `zoneSetPath`. Don't regress Brief H or the Round 1A SET TOPOLOGY LOCK.

## Note / Git
Keep code in the repo; keep briefs / reviews / results here. This folder **is tracked in git** (shared history) — commit your roundtable file with an **explicit pathspec** (`git add ai-roundtable/<your-file>.md`), never `git add -A` (CRLF churn).

## Current latest
`0010_claude_brief-J1-scene-memory-foundation.md` — Brief J1 (SceneMemory foundation + drift report, NO autonomy). Ready for **Cursor** to implement → report back here as `0011_cursor_J1-result.md`.
