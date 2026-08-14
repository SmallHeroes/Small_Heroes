# Story Engine Editor Reasoning Headroom — Implementation Evidence

**Milestone:** `STORY-ENGINE-EDITOR-REASONING-HEADROOM-HARDENING`

**Base:** `e987a9a97ca6ea2a1941a2617a2a79e4c7caf9eb`

**Branch/worktree:**
`codex/story-engine-autonomous-batch-orchestrator` in
`C:\Users\guyna\.codex\worktrees\storybatch1\Small_Heroes`

## Independent precondition

Claude Code independently reviewed immutable range `6711b466..e987a9a9` and
returned PASS with zero BLOCKER and zero MAJOR. Its three non-blocking MINORs
were: inaccurate program-scope wording for the unchecked legacy materializer,
the dedicated CJS typecheck not being wired into the normal repository gate,
and static assertions that did not prove both call variants and their receipts
exist. Codex records Claude's verdict; it does not self-award it.

## Stopped full-wave evidence

The first 17-story attempt used root
`outputs/story-autonomous-full-wave-20260814-v1` at exact HEAD `e987a9a9`,
model `gpt-5.6-sol`, Standard/default service tier, `store:false` and hard cap
`$20`.

- Manifest status: `in_progress`; authority:
  `machine_qualified_staging_only`.
- Settled logical calls: `28` (`26` output-bearing and `2` terminal);
  transport retries: `0`; fallback: `false`.
- Exact settled-call cost: `$2.10405525`, including both terminal calls.
- Root inventory at evidence capture: `58` files / `205,588` bytes.
- Manifest: `25,806` bytes; SHA-256
  `c7a6fe37809c2ee01f8a7dac57ff2c48fd5216c3d7d2d8efd96e5155acf25467`.
- Three qualified staging stories:
  - `fox_uri_bedtime_moon_laundry_brief_v1`: one revision, six calls,
    final story `7,666` bytes at `98923ee5…`.
  - `fox_uri_fantasy_sound_footprints_brief_v1`: one revision, six calls,
    final story `9,551` bytes at `897d92ea…`.
  - `panda_anat_bedtime_last_puppet_bow_brief_v1`: two revisions, eight
    calls, final story `6,164` bytes at `52676b9a…`.

Two unrelated adventure records then failed terminally at their first Editor
call with identical closed reason `story_provider_max_output_tokens`:

| Story | Input | Cache write | Cached | Output | Reasoning | Total | Cost | Receipt |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Fox backward tracks | 4,018 | 2,979 | 1,036 | 3,000 | 3,000 | 7,018 | `$0.10915175` | `ab5e9fdd…` |
| Panda bridge orchestra | 3,662 | 2,623 | 1,036 | 3,000 | 3,000 | 6,662 | `$0.10692675` | `84a9aa15…` |

Both receipts bind Editor `reasoningEffort:high` and
`maxOutputTokens:3000`. No structured Editor output was available, no repair
was eligible, and neither story received qualified authority.

The process had begun the next Panda fantasy Architect call when the repeated
failure was observed. Its manifest record contains only stage `architect` and
prompt digest
`9e1f81b65a63f0edb2e0b9a9d1a9d46b8c1ccb8c9be194b55efd4b5ed3c75869`.
It has no completed receipt. The request's conservative reservation is
`$0.258825`; therefore the local upper bound is `$2.36288025` when the unknown
in-flight charge ceiling is added to completed cost. The wrapper and its exact
remaining child processes were stopped, and no matching process remains.

This root is terminal immutable evidence. It must not be resumed, rewritten or
used as authority for a replacement wave.

## Root cause and correction

The shared Editor request used one combined 3,000-token output allowance for
reasoning plus the closed JSON response. On both failures reasoning consumed
the full allowance. This is an Editor response-envelope defect, not a story,
companion, category, schema or personalization defect.

The correction:

- introduces `EDITOR_MAX_OUTPUT_TOKENS = 6000` and applies it only to Editor
  requests for bedtime, adventure and fantasy;
- preserves Editor reasoning `high` and all Architect, Selector, Writer and
  revision ceilings;
- leaves prompts, JSON schemas, validation, selection, Writer isolation,
  two-revision budget, transport retry/fallback policy, service tier and
  artifact versions unchanged;
- wires `story:autonomous-typecheck` into `npm run check`;
- makes the static contract prove that completed and terminal variants both
  exist, completed calls expose output and receipt, terminal calls expose a
  receipt, and terminal calls cannot expose output;
- corrects the earlier program-scope wording: the legacy materializer is
  transitively present but unchecked because `checkJs:false` and no file-level
  `@ts-check` apply to it.

No credential or provider call occurred during this correction. Existing wave
and pilot artifacts were not edited. No story was promoted.

## Validation

- `npm run story:autonomous-typecheck`: PASS.
- Focused Vitest: `2` files / `30` tests PASS.
- `npx --no-install tsc --noEmit`: PASS.
- `node --check`: PASS for launcher, private child, core, OpenAI provider and
  legacy materializer (`5` files).
- `git diff --check`: PASS.
- `npm run check`: intentionally not rerun. Its existing fixture/repository
  HOLD is independent, and the new normal-gate wiring is proven by the exact
  package script plus successful execution of both TypeScript commands.

The regressions prove exact Editor allowance `6000` for all three directions,
preserved high reasoning and exact provider forwarding. They do not perform a
live provider call.

## Independent QA and next gate

Claude Code independently reviewed exact correction range
`e987a9a9..f199b448` and returned PASS with zero BLOCKER, zero MAJOR and one
non-blocking documentation MINOR. It confirmed all twelve technical, boundary,
type-contract, forwarding, historical-evidence and authority targets. The
MINOR asked that the 28 settled calls be decomposed explicitly as 26
output-bearing plus two terminal calls, rather than described collectively as
completed calls.

The docs-only correction at `f199b448..6eb80faf` made that distinction without
changing any number or implementation claim. Claude Code's focused read-only
micro re-gate returned PASS and closed the MINOR with no new finding. Codex
records these independent verdicts; it does not self-award them.

The correction is therefore eligible for a replacement wave in a fresh root at
the corrected immutable HEAD under the existing hard `$20` cap.

All outputs remain staging-only. This milestone grants no accepted-source,
story-bank, Wizard, Visual Contract, render, image/audio, database/storage,
QA/Production deployment or release authority.

## Rollback

Revert the focused correction commit and ignore any unpromoted replacement
root. Preserve the stopped v1 wave and all pilot roots byte-for-byte as
historical execution evidence.
