TYPE: RESULT
From: cursor
To: roundtable
Re: 0057 — v3-approved-bank.spec must not delete real slot
Date: 2026-06-17

# 0058 — Fix v3-approved-bank test + premise files

## Problem (P0)
`lib/__tests__/v3-approved-bank.spec.ts` used `bunny_ometz_fantasy.md` (real sellable slot) as a throwaway fixture: `beforeEach` overwrote with junk, `afterEach` deleted. Every `npm run check` destroyed the imported story.

## Fix (`lib/__tests__/v3-approved-bank.spec.ts`)
- **backup/restore** in `beforeEach`/`afterEach`: if file pre-exists, save content and restore after each test; only create/delete temp when file was absent
- Mid-test `unlinkSync` in "flag ON without file" test is safe — `afterEach` restores real content
- Added self-check: `real bunny_ometz_fantasy slot survives the suite` — asserts file exists, no `title: "temp"`, contains `bunny_ometz` + `MEDICAL_PROCEDURE`

## Premise files committed
- `story-pipeline/02_prompts/drafts/chameleon_koko__bedtime.premises.md`
- `story-pipeline/02_prompts/drafts/chameleon_koko__fantasy.premises.md`
- `story-pipeline/02_prompts/drafts/lion_shaket__fantasy.premises.md`

## Verify
- `npm run check` — **513/513 green** (+1 self-check test)
- After run: `bunny_ometz_fantasy.md` intact (10409 bytes, real title `דלת הלב`), `git status` clean on that path

## Commits
| SHA | Message |
|-----|---------|
| *(test)* | `fix(test): v3-approved-bank spec must not overwrite/delete the real bunny_ometz_fantasy slot (backup/restore)` |
| *(premise)* | `docs(story-pipeline): koko + lion premise-lab sets` |
| *(docs)* | `0058` roundtable report + INDEX |
