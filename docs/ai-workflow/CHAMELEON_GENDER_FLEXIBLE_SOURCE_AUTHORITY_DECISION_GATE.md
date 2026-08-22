# Chameleon gender-flexible Story Source authority — Decision Gate

**Owner decision already supplied:** Guy authorized completing a fresh Bar-boy Wizard book through the new engine and instructed Codex to proceed autonomously while preserving fail-closed QA.

## Observed behavior

The pending Chameleon revision resolves its Hebrew prose correctly for boy and girl, but its frontmatter remains `gender: female`. The Story Bank runtime resolves chips from the Wizard child gender, while Story Source authoring copies the frontmatter value into its immutable snapshot and compiler input. A fresh reusable package would therefore still be authored with an explicitly female source authority.

## Root cause

The historical editorial contract treats `gender: female` as a smoke/default value even for chip-complete reusable sources. Runtime personalization and package authoring consequently interpret the same field differently.

## Approved correction

- Introduce the closed source mode `neutral` for a source proven complete for both boy and girl.
- Preserve historical `female` and `male` meanings and every existing accepted source byte.
- Require an explicit gender-flexible editorial-validation profile; legacy callers remain female-only by default.
- Require one exact metadata migration from `gender: female` to `gender: neutral` in the revision request.
- Keep package authoring order-independent and describe a neutral source as gender-flexible; the Wizard continues to resolve customer-visible prose from the order's boy/girl value.
- Version the changed request, pending manifest, review bundle, revision identity/accepted revision manifest, and Story Source snapshot authorities.

## Rejected alternatives

- `unspecified`: already means that a recurring human's gender is unknown, not that a child template supports both genders.
- Deriving the package source snapshot from one Wizard order: would make a reusable package order-specific.
- Treating unknown metadata as neutral: would silently widen malformed sources.
- Mutating historical accepted files or the current approved package: violates immutable authority and replay guarantees.

## Acceptance criteria

1. Legacy editorial validation still defaults to exact `female`; the new profile requires exact `neutral`.
2. Boy and girl projections match the production resolver and contain no unresolved gender chips.
3. Female product prose is unchanged except for the explicitly reviewed metadata line.
4. Backend Story Bank recognizes `neutral` but resolves prose only from Wizard gender.
5. Story Source snapshot and authoring prompt carry closed, explicit gender-flexible semantics and reject arbitrary values.
6. Historical accepted sources, packages, locators, and Boards remain byte-identical.
7. Existing time-only migration artifacts remain readable against their exact historical Snapshot digest without admitting that version as current authoring authority.
8. No provider, render, database, storage, deployment, promotion, or approval occurs in this milestone.

## Rollback

Revert the focused implementation commit and discard only the new pending output root. Historical tracked and approved artifacts are not rewritten.
