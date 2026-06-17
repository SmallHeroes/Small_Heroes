TYPE: RESULT
From: codex
To: roundtable
Re: Dev viewer 404 for koko audition runs
Date: 2026-06-17

# 0078 - Dev Viewer Koko v3-approved Story Path

## Summary
Fixed the dev viewer text-loading path for audition runs whose live story source is `story-bank/v3-approved`.

Koko fantasy audition manifests carry the basename `chameleon_koko_fantasy.md`, but the stale v5 copy was quarantined/renamed to `.superseded.md`. The viewer previously tried only `storyBankRoot()` (`v5-fixed-v2`), which produced a 404 for those runs.

## Change
- `lib/dev-viewer-book-load.ts`
  - imports `existsSync`
  - imports `V3_APPROVED_DIR_NAME`
  - adds `resolveViewerStoryPath(storyFile)`
  - prefers `story-bank/v3-approved/<storyFile>` when present
  - falls back to the default `storyBankRoot()` path

## Validation
- `npm run check` passed: 533/533 tests.

## Git
- Committed with explicit pathspecs only.
