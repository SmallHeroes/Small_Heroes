# Decision Gate: new-book experiment, storyboard planner → Claude Opus 5.5 (Claude Max CLI), judge stays Sol 6.1

Date: 2026-10-15 · Developer and book operator: Claude Code · Independent QA: Codex · Owner: Guy

## Topology

| item | value |
|---|---|
| worktree | `C:/GNart/Work/sh-book-render-20261009` |
| branch | `claude/book-render-20261009` |
| reviewed clean base | `4725c38221baf5382cbc83496daadffc92c7b737` (Codex narrow PASS of the carry-resolution write boundary, 2026-10-15) |
| book | `new-book-20261012`, "איתי ועדר האבנים המתגלגלות" |
| saved book | `C:/GNart/Work/book-renders/new-book-20261012` |
| claims and amendments | the repository's git common dir, `claude-new-book-experiments/` |

The consumed configuration and its original pin `6124696049f142590ec47db8da27bc84cfc90751` are historical and are never rewritten.

## Owner decision

Guy, in the Codex chat, quoted in Codex's execution brief and delivered by Guy to Claude Code on 2026-10-15:

> "יאללה, תן לקלוד בריף לעבור לאופוס 5.5 לתכנון הסטוריבורד ולהשאיר את Sol 6.1 כשופט. אתה תעשה QA על השינוי, ובוא נתקדם כבר לספר מלא."

## Decision Gate

### 1. Change

The new-book experiment's next storyboard planning call is the already-approved one-shot repair (continuation-4). It goes to **claude-opus-5-5** through the existing restricted Claude Max CLI route that the author and editor use:
- a pinned executable;
- `--safe-mode`, no tools, no session persistence;
- a stripped credential environment;
- the per-session `--max-budget-usd 2` guard and medium effort.

Unchanged: the story readers, the storyboard review and the pixel review stay **gpt-6.1-sol**, and the child-identity model and the 0.70 gate are untouched. The routing is explicit (provider, model and stage identity), not a renamed string.

### 2. Why

The repair's planning reservation on the OpenAI API ($2.724854 at the normal cap) does not fit beside the full unresolved $2.267639 carry. On the Claude Max route, the planner is not an API call:
- only the Sol review's ceiling ($0.710600) must fit the remaining $2.494679, so the stage fits with the full carry retained;
- the missing 10/13 dashboard numbers stop being a prerequisite for this stage.

No claim is made that Opus plans better. The same compiler and an independent fresh Sol review decide.

### 3. Scope

- General provider routing for this experiment's repair stage, opt-in at the experiment boundary (versioned in the amendment).
- A narrow reusable storyboard-planner transport over the same CLI hardening.

Not touched:
- production and the Wizard;
- Goni and default callers, and earlier attempts (their Astra records replay under Astra rules);
- any other tool.

### 4. Hardcoding risk

None intended. The planner gets exactly the engine's request: the same instructions with the provider note, the same canonical planning input including the repair, and the same provider JSON schema, decoded by the same decoder back to the engine contract. There is no prompt about this book, its stones, the fox or any page.

### 5. Files

- `scripts/personal-causal-trial-adapters.ts`: the shared CLI runner (`runClaudeCli`), with existing behaviour unchanged;
- `scripts/personal-opus-storyboard-transport.ts` (new): the request is taken from the unchanged `personalBookProviderPayload` builder, so `book-openai.ts` is not modified;
- `scripts/personal-new-book-experiment.ts`: the repair stage's planner route, amendment fields, Max journal and its verification;
- focused specs;
- `CURRENT.md`, `ROADMAP.md`, this record.

### 6. Expected behaviour

- The same story bytes are replayed with no paid writer, editor or reader call.
- The same request content as the Astra route: instructions, input, schema, the 32,000 storyboard cap through `CLAUDE_CODE_MAX_OUTPUT_TOKENS`, and the 39,000 review cap.
- The same compiler and continuity contracts, the repair-parent binding, and a fresh Sol review of the newly compiled Opus storyboard.

Only the planner transport and its truthful accounting change:
- the Claude Max journal is separate and records its CLI estimate (never $0, never an API invoice);
- the API meter holds only the Sol review, at the full carry.

### 7. Validation

All offline and provider-free:
- **Routing:** exactly one Opus planner call and zero Astra planning; one Sol review.
- **Wire binding:** model, executable hash, schema, instructions, stdin, cap, flags, guard and signal.
- **CLI failure refusals:** wrong model, nonzero exit with success JSON, `is_error`, missing structured output, usage or cost, unconfirmed termination. Each stops before Sol.
- **Contracts and compile:** the decoded output compiles under every contract.
- **Budget:** full carry, a separate Max record, no API charge for the planner, an understated Max cost refused.
- **Single use, loader, grant and audition:** the once-only amendment and synchronous final check; later stages follow the new bound result.
- **Legacy and checks:** legacy bytes unchanged; tsc; representative negative controls; a real-data dry preview.

Codex QA of a frozen clean range comes before any call.

### 8. Cost

Offline: $0 API. After a Codex PASS, the live proof is:
- one Opus planner call on Claude Max, guarded at $2 per session and reported separately;
- one Sol review (API, reserved at its ceiling under the same cumulative $7 cap);
- then the already-approved child → grant → two samples → the rest and the cover only if both pass.

No new key, account, cap, retry or fallback.

### 9. Rollback

Before any model call, revert the routing in a new commit. After a claim exists: never rewind or delete it; stop, preserve, account and diagnose.

### 10. Review

Claude Code implements; Codex re-gates the range. Guy owns product and visual acceptance of the output; no literary or visual PASS can be inferred from tests.

### 11. Do not

- push, merge or deploy;
- restore the bank or categories;
- rewrite the story or hand-edit the storyboard;
- use a fallback model or self-review;
- weaken a threshold or a gate, or shrink a cap;
- invent usage, use the hypothetical attestations as evidence, or reset the carry or the allowance;
- start a new book or rerun the full book.

## Stop-check

| question | answer |
|---|---|
| General or story-specific? | General (routing and accounting). |
| Could it break another book or caller? | Only through the opt-in. Absent, every existing call, digest and byte is unchanged (tested). |
| Production? | No. |
| Money? | None before the PASS. Then one guarded Max planner session and one Sol review under the unchanged $7 API cap, with the full carry retained. |
| Smallest live proof | The one approved repair, then its fresh Sol review, then the existing two-page sample. |
