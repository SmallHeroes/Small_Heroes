# Story Writer Freedom Projection — Decision Gate

**Status:** approved by Guy on 2026-08-13 through direct product feedback.

**Milestone:** replace the over-specified ChatGPT dispatch bundle with a compact, general writer-facing projection.

**Branch/worktree:** `codex/story-bank-next-generation-briefs-qa-integration` at `C:\Users\guyna\.codex\worktrees\storyqa1\Small_Heroes`.

## Observed failure

The current Dini adventure commission is 607 lines / 33,416 bytes. It embeds the full shared contract, full writer contract, full companion bible and full structured brief. The same prompt exposes sample dialogue, `lineTargets`, `playRule`, anti-copy phrases and repeated “rule” language. A writer therefore receives both “write freely” and a large set of apparently authoritative phrasings. In practice the draft converted those labels into mechanical dialogue such as “הגנה מלאה”, “כלל ראשון” and repeated counted formulas.

This is a dispatch-design failure. The source bibles and briefs may remain useful editorial authority, but transmitting every field makes the model perform the specification instead of authoring a story.

## Expected behavior

ChatGPT receives enough information to preserve premise, causality, companion identity, set-piece variety, child agency, continuity, length and output shape, while retaining genuine freedom over prose, dialogue, rhythm, comic timing, local blocking and page allocation. Character identity is expressed primarily through behavior and relationship, not a mandatory verbal tic.

## Root cause

The materializer has no writer-facing projection. It concatenates four complete authorities verbatim. Fields intended for human review—especially sample voice, `lineTargets`, reread targets and anti-copy evidence—become positive prompt material. Renaming examples “not mandatory” does not remove their imitation pressure.

## Nine decisions

1. Preserve the 18 canonical briefs and six full companion bibles as immutable editorial source for this correction; change only what is dispatched to the writer.
2. Introduce one short writer-freedom charter that treats story data as outcomes rather than wording and explicitly rejects catchphrases, status calls and specification-to-dialogue conversion.
3. Introduce exactly six compact companion authoring cards with role, lovable mistake, embodied comedy, child partnership and voice direction—without sample lines, slogans, rules or catchphrase fields.
4. Project each full brief through one closed allowlist. Keep plot identity, physical causality, set-piece names, high-level movement, companion complication, child discovery/climax, payoff, continuity and declared model freedom. Do not transmit separately scripted attempt or comic-outcome wording already represented by those rails.
5. Exclude `lineTargets`, `rereadHooks`, `oldStoryAntiCopy`, `mustAvoid`, `worldAndSafetyLocks`, `companionIndispensability`, internal status/version fields and the full source documents from the dispatched bundle.
6. Rename `playRule` to writer-facing `physicalLogic` and state that it is world causality, never mandatory dialogue or an announced rule.
7. Advance commission and manifest versions to v2; preserve v1 generated bundles as historical staging artifacts and never overwrite an existing output directory.
8. Add regressions across all 18 commissions proving exact page accounting, closed projection keys, selected-only isolation, absence of excluded field names/values and sample dialogue, content addressing, and meaningful size reduction.
9. Regenerate a new 18-commission staging root, inspect it for mechanical-language contamination, run focused tests/TypeScript/diff checks, commit locally, and send the exact range to Claude Code read-only. No draft generation or runtime integration is authorized by this correction.

## Rejected alternatives

- Editing only the phrase “הגנה מלאה”: it is model output, not the systemic source.
- Adding another list of forbidden phrases: it expands the same compliance burden and cannot enumerate future model tics.
- Deleting causality or companion identity: it would trade mechanical prose for generic, swappable stories.
- Rewriting all 18 source briefs immediately: it would erase useful editorial structure before proving that dispatch projection is the real correction.

## Acceptance criteria

- Every generated bundle is materially smaller and contains only the freedom charter, one compact companion card, one closed story-rails projection and commission metadata.
- No bundle contains full source documents, sample dialogue, `lineTargets`, target-line values or another slot's identity.
- The Dini adventure bundle contains neither the three sample-voice sentences nor its child-repeatable/parent-reread targets.
- All 18 page-count and personalization boundaries remain exact.
- Existing approved banks, runtime, Wizard, Reader, provider, render, payment, storage and Production remain unchanged.

## Rollback

Revert the focused materializer/card/charter commit and continue using the historical v1 staging output. No approved story or runtime artifact requires migration.

## Cost and exclusions

External cost is `$0`. No credential, provider/model/network call, story drafting, bank import, image/audio/Vision render, database/storage action, QA deployment, Production action or push is authorized by this milestone.
