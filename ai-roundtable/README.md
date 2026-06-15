# AI Roundtable — shared exchange folder

A single, ordered place where Claude, Codex, and Cursor drop their briefs, reviews, and results as files — so Guy doesn't copy-paste big blocks between chats. Each agent reads the latest file(s) directly from disk and writes its response as the next file.

## Who can use it
- **Claude, Codex, Cursor** — all read/write this folder directly (same repo on Guy's machine). No paste needed.
- **ChatGPT** — has NO repo access. For ChatGPT, Guy still uploads/pastes the file. ChatGPT's reply gets saved here by Guy or Claude.

## Naming convention
`NNNN_<author>_<short-topic>.md`
- `NNNN` = zero-padded sequence (0001, 0002, …). **Highest number = latest.**
- `<author>` = `claude` | `codex` | `cursor` | `chatgpt` | `guy`
- Examples: `0012_claude_brief-J1.md`, `0013_codex_redline-J1.md`, `0014_cursor_J1-result.md`

## File header (top of every file)
```
From: <author>   To: <author(s)>   Re: <NNNN it responds to, or "new">   Date: YYYY-MM-DD
```

## How Guy drives it (the flow)
1. Claude answers → auto-saves `NNNN_claude_<topic>.md` here + appends to `INDEX.md`.
2. Guy to **Codex**: *"Read the latest file in `ai-roundtable/`, respond as the next file."* → Codex writes `NNNN+1_codex_*.md`.
3. Guy to **Cursor**: *"Read `ai-roundtable/NNNN+1...` and implement / respond as the next file."*
4. Guy to **Claude**: *"Read the latest in the roundtable"* → Claude consolidates.
- `INDEX.md` is the append-only log (seq · author · topic · one-line) — glance there for "what's latest."

## What this does / doesn't do
- ✅ Removes large copy-paste between Claude/Codex/Cursor; clear ordering; exact file/line refs; audit trail.
- ❌ Does NOT auto-trigger agents — Guy still tells each agent to read the latest. ChatGPT still needs the file handed to it.

## Git
This folder **is tracked in git as shared history** (Guy's choice, 2026-06-15). Commit roundtable files with **explicit pathspecs** (e.g. `git add ai-roundtable/0013_cursor_*.md`) — never `git add -A` (CRLF churn).
