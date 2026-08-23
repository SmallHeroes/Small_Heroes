# R1D Wizard Book Continuity And Composition — Implementation Evidence

**Date:** 2026-08-23
**Branch:** `codex/qa-wizard-presentation-dispositions`
**Worktree:** `C:\GNart\Work\sh-wt-r1d-output-budget`
**Decision Gate:** `docs/ai-workflow/R1D_WIZARD_BOOK_CONTINUITY_AND_COMPOSITION_DECISION_GATE.md`

## Observed regression

- Bar's body-page placement occupied only about 1.5%-2.8% of normalized frame area despite different camera labels.
- The approved eight-page Blueprint had no `close_up` frame.
- The child wardrobe was descriptive rather than an exact garment/colour lock and exposed no page transition authority.
- The authoritative Blueprint prompt branch did not compose the existing canonical companion accessory lock; Kim's mustard satchel could therefore disappear.

## Implemented contract

1. `childWardrobeOverride` is an optional, typed page authority with a required evidence origin. It is rejected when malformed, when the child is absent, or when it is a no-op.
2. Contract derivation resolves one exact wardrobe per page. That value is preserved in the immutable runtime Blueprint frame and replaces the global wardrobe at the provider boundary only for that page.
3. The authoritative Blueprint prompt combines package appearance with the canonical registry identity and accessory lock. Visible Kim therefore receives the mandatory warm-mustard shoulder satchel rule.
4. `blueprint-composition-policy/v1` measures exact placement geometry for books of eight or more pages. It rejects label-only close-ups, near-constant subject scale, insufficient shot/angle vocabulary and three-page shot repetition.
5. Production authoring and ordinary offline preparation opt into v1 explicitly. Historical Blueprints and authority-preserving migrations remain byte/semantic compatible unless separately migrated and approved.

## Tests

- Changed/adjacent matrix: 14 files / 347 tests PASS.
- Story Source revision migration: 8/8 PASS with `--testTimeout=30000`; the longest promotion case completed in 4.8 seconds.
- TypeScript: `npx --no-install tsc --noEmit` PASS.
- Diff hygiene: `git diff --check` PASS.
- Full canonical inventory: 322 files = 302 ordinary + 20 resource-intensive.

The first literal full run correctly exposed an accidental implicit policy opt-in on historical migration replays. The fix made policy selection explicit. The affected Story Source and time-authority migration suites then passed 14/14, and the workload classifier passed 7/7. Remaining canonical-suite failures are the five pre-existing absent ignored-output fixtures plus six unrelated resource workload timeouts/four known worker RPC timeouts.

## Preserved boundaries

- No provider, image, Vision, narration, database, storage, payment, deployment, package promotion, locator update or remote-system action.
- No approved package or source artifact rewritten.
- The four pre-existing untracked Board artifacts stay unstaged and byte-preserved.
- No Bar-, Kim-, Chameleon-, bedtime-, or page-8-specific production branch.

## Next gate

Claude Code should independently falsify the exact commit range. Only after PASS should a fresh Chameleon Blueprint/Visual Package be authored, reviewed, approved and promoted. A paid render remains a separate explicit execution after that authority exists.
