# Decision Gate — Story Engine Editor Reasoning Headroom

**Milestone:** `STORY-ENGINE-EDITOR-REASONING-HEADROOM-HARDENING`

**Approved base:** `e987a9a97ca6ea2a1941a2617a2a79e4c7caf9eb`

**Owner authority:** Guy authorized autonomous continuation and general fixes
needed to complete the story wave without repeated approval stops.

## Observed failure

The first full-wave root produced three machine-qualified stories and then
repeated one terminal failure on two unrelated adventure commissions. Both
Editor calls used `reasoningEffort:high` and `maxOutputTokens:3000`; both
receipts report exactly 3,000 output tokens and exactly 3,000 reasoning tokens,
then terminate as `story_provider_max_output_tokens`. No structured Editor JSON
was available and no repair was eligible.

This is a shared output-envelope defect. It is not story prose, companion,
category, schema or personalization failure: the reasoning budget consumed the
entire combined output allowance before the model could emit the closed JSON.

The stopped root is immutable evidence. It contains 28 settled logical provider
calls (26 output-bearing and two terminal) at `$2.10405525`, three qualified
stories, two terminal Editor holds and one interrupted Architect request. That
in-flight request has a matched prompt digest and a conservative reservation
bound of `$0.258825`; it has no completed receipt and its root must never be
resumed.

## Nine decisions

1. Increase only the Editor `maxOutputTokens` allowance from 3,000 to 6,000.
2. Preserve Editor reasoning at `high`; do not reduce editorial judgment to
   hide the exhaustion symptom.
3. Preserve Architect, Selector, Writer and revision ceilings unchanged.
4. Preserve JSON schema, editorial validator, pass/revise/reject semantics,
   two-revision limit, no-retry and no-fallback policy unchanged.
5. Treat both exhausted calls as terminal historical evidence. Do not retry,
   rewrite or resume their root.
6. Start any replacement wave in a fresh output root at the corrected immutable
   HEAD. The original `$20` hard wave cap remains a ceiling, not a spend target.
7. Wire the dedicated autonomous CJS typecheck into the repository `check`
   command and strengthen its completed/terminal static assertions, closing the
   three non-blocking findings from the preceding Claude micro re-gate.
8. Add focused regressions proving all three story directions receive the new
   Editor allowance while provider forwarding and terminal incomplete handling
   remain exact and fail-closed.
9. Keep every result staging-only. No accepted-source, story-bank, Wizard,
   Visual Contract, render, storage, QA/Production or release authority follows.

## Acceptance criteria

- Editor prompts use exactly 6,000 output tokens for bedtime, adventure and
  fantasy; all other role settings remain byte-identical.
- The Responses adapter forwards that value exactly and still records a
  sanitized terminal receipt for any future incomplete response.
- The dedicated typecheck is part of the normal repository gate, and static
  assertions prove both union variants exist and require their receipts.
- Focused tests, both TypeScript checks, four CJS syntax checks and
  `git diff --check` pass before a replacement wave.
- Existing wave artifacts remain byte-immutable and no credential/provider call
  occurs during implementation or validation.

## Rollback

Revert the focused hardening commit. Ignore the unpromoted replacement output
root. The stopped wave and successful Bunny pilot remain immutable evidence;
accepted story sources and product runtime remain unchanged.
