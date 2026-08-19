# R1D Hebrew Conjunction-Prefixed Companion Presence — Decision Gate

Status: approved for implementation by Guy's standing instruction to continue
the `$0` Chameleon unblock after independent Claude Code review. Claude Code's
PASS on `5963301a..1dc1e189` independently verified the exact pre-existing
defect and required a separate anchor-semantic gate.

## 1. Proposed change

Add a companion-identity-only token boundary that recognizes one attached
Hebrew conjunction `ו` before a Hebrew proper-name alias. Use it consistently
for deterministic companion presence, positive absent-companion contradictions,
and review flags. Preserve the existing generic standalone matcher unchanged.

## 2. Why now?

The canonical Chameleon source says `{{childName}} וקִים עלו אחריה` on page 7,
but deterministic facts omit the companion because every Hebrew letter is
currently forbidden immediately before the alias. That produces a persistent
`cast_authority_mismatch` before Action Semantic calibration can close.

## 3. Scope

General companion identity-presence behavior. No story-specific data or
special case for Kim, Koko, page 7, or Chameleon in production code.

## 4. Risk of hardcoding

The fix is defined by Hebrew morphology, not a story token. It permits only one
attached conjunction `ו`, only for companion name/identity aliases. It does not
permit the wider ב/ל/כ/מ/ש/ה prefix set because words such as `מקים`, `הקים`,
and `שקים` would create false Kim presence. It does not widen species, human,
child, denylist, or gender-marker matching.

## 5. Files likely affected

- `lib/companion-presence-aliases.ts`
- `lib/visual-contract-compiler/extractDeterministicFacts.ts`
- `lib/visual-contract-compiler/castPresenceContradiction.ts`
- `lib/visual-contract-compiler/writeVisualContractReview.ts`
- focused companion/compiler/audit tests
- `CURRENT.md` and implementation evidence

## 6. Expected behavior after change

- `קִים` and `וקִים` establish the same companion identity.
- `ודניאל` does not match identity `דני`.
- `מקים`, `הקים`, and `שקים` do not establish Kim.
- generic standalone-token personalization behavior is byte-for-byte unchanged.
- the canonical Chameleon page 7 deterministic facts include the companion.
- the source-faithful eight-page offline fixture reaches Candidate without a
  provider call.

## 7. Validation plan

1. direct token boundary positives and hostile suffix/prefix negatives;
2. deterministic companion presence with niqqud and attached `ו`;
3. positive absent-companion mustShow contradiction with an attached `ו`;
4. canonical Chameleon Story Source + visual directions through the production
   offline compiler/harness;
5. existing personalization, companion, compiler, and harness suites;
6. TypeScript, diff-check, one literal repository check, focused commit, and
   independent read-only Claude Code review.

## 8. Cost impact

`$0`. No credential, provider, network, Fresh, image, audio, or render boundary
is reachable.

## 9. Rollback plan

Revert the focused milestone commit. There is no migration or persisted artifact.

## 10. Review assignment

Guy already authorized continued `$0` work. Claude Code must falsify prefix
scope, suffix boundaries, niqqud handling, false positives, consistency across
facts/validator/review, Chameleon completion, and absence of unrelated authority
or version drift.

## 11. Do not do

- Do not change the generic standalone matcher.
- Do not allow every Hebrew clitic prefix.
- Do not add Kim/Chameleon/page-specific production logic.
- Do not edit Story Source, visual directions, Action Catalog, prompts, schemas,
  policy, budgets, Wizard, or render behavior.
- Do not run Fresh, provider, live authoring, image generation, or render.
