TYPE: BRIEF
From: claude   To: cursor   Re: P0 — v3-approved-bank.spec deletes a real slot file on every `npm run check`   Date: 2026-06-17

# 0057 — Fix the test that overwrites + deletes story-bank/v3-approved/bunny_ometz_fantasy.md

Codex (2026-06-17) confirmed: `lib/__tests__/v3-approved-bank.spec.ts` uses the now-REAL imported slot `bunny_ometz_fantasy.md` as a temp fixture. `beforeEach` overwrites it with junk; `afterEach` `unlinkSync` deletes it. Every `npm run check` destroys a sellable slot file (this caused yesterday's phantom "deleted" + the green-gate-that-deletes danger). **P0: a green gate must never delete real content.**

Constraints (verified):
- `selectCompanionStory` only checks **file existence** (story-bank-index.ts:324), not content — so the fixture doesn't need real content, just presence/absence.
- It rejects future-pool + non-`V3_COMPANIONS` companions (lines 315–316) — so the fixture MUST stay a real V3 companion (can't swap to a fake id).
- All 18 slots will eventually be imported → there is NO permanently-unused real slot name. So the fix must **preserve the real file**, not pick a "safe" name.

## Fix — backup/restore (never clobber real content; always restore)
In `lib/__tests__/v3-approved-bank.spec.ts`:
1. Update the stale comment on line ~13 (it claims "fantasy not imported for real" — false now).
2. Replace the module-level flag var + `beforeEach` + `afterEach` with:

```ts
const originalFlag = process.env.ENABLE_V3_APPROVED_BANK;
let fixturePreexisted = false;
let savedContent: string | null = null;

describe('v3-approved bank selection (flag-gated, additive)', () => {
  beforeEach(() => {
    fs.mkdirSync(V3_APPROVED_DIR, { recursive: true });
    // bunny_ometz_fantasy.md is a REAL imported slot — preserve it.
    fixturePreexisted = fs.existsSync(TEMP_FILE);
    savedContent = fixturePreexisted ? fs.readFileSync(TEMP_FILE, 'utf8') : null;
    if (!fixturePreexisted) {
      fs.writeFileSync(
        TEMP_FILE,
        '---\ntitle: "temp"\n---\n--- Page 1 ---\nimageDirection: x\nשלום\n',
        'utf8',
      );
    }
  });

  afterEach(() => {
    if (fixturePreexisted) {
      fs.writeFileSync(TEMP_FILE, savedContent ?? '', 'utf8'); // restore real slot
    } else if (fs.existsSync(TEMP_FILE)) {
      fs.unlinkSync(TEMP_FILE); // remove only the temp we created
    }
    if (originalFlag === undefined) delete process.env.ENABLE_V3_APPROVED_BANK;
    else process.env.ENABLE_V3_APPROVED_BANK = originalFlag;
  });
```

- The "flag ON without an imported file" test that does `fs.unlinkSync(TEMP_FILE)` mid-test is now SAFE: `afterEach` restores the real content afterward. Leave that test as-is.
- Because `beforeEach` no longer overwrites when the file pre-exists, the present-file tests run against the real file's existence (which is all selection checks) — no content-clobber race with parallel specs.

## Verify
- `npm run check` → 512 green.
- After the run, confirm the slot survived: `git status` shows NO deletion/modification of `story-bank/v3-approved/bunny_ometz_fantasy.md`, and the file still has its real story content (not "temp").
- Optional hardening: add one assertion at end of the suite that `bunny_ometz_fantasy.md` still exists and does NOT contain `title: "temp"` — a self-check that the suite never corrupts the real slot.

## Also: commit the 3 untracked premise files (Codex flagged)
Real premise-lab content, part of the story track:
```
git add story-pipeline/02_prompts/drafts/chameleon_koko__bedtime.premises.md \
        story-pipeline/02_prompts/drafts/chameleon_koko__fantasy.premises.md \
        story-pipeline/02_prompts/drafts/lion_shaket__fantasy.premises.md
git commit -m "docs(story-pipeline): koko + lion premise-lab sets"
```

## Commit + push
```
git add lib/__tests__/v3-approved-bank.spec.ts
npm run check
git commit -m "fix(test): v3-approved-bank spec must not overwrite/delete the real bunny_ometz_fantasy slot (backup/restore)"
git push
```

## Acceptance
- `npm run check` green; `bunny_ometz_fantasy.md` intact (real content) after the run; 3 premise files committed; pushed. Report as `ai-roundtable/0058_cursor_v3bank-test-fix-result.md`.
