# R1D Typed Companion Appearance State Authority — Implementation Evidence

**Date:** 2026-08-23
**Owner:** Codex
**Product approval:** Guy
**Branch:** `codex/qa-wizard-presentation-dispositions`
**Worktree:** `C:\GNart\Work\sh-wt-r1d-output-budget`
**Base:** `48654340f2e879b91619a2c256d47f726970e395`
**Cost:** $0; no provider, render, image, audio, storage, database, payment, deployment or network call

## Outcome

The system now supports an optional closed companion appearance-state axis as
frozen Visual Contract authority. The implementation is general: runtime has no
Kim, Bar, Chameleon, bedtime, story-key or page-number branch. Kim's state axis
is the first declaration and remains data in the companion registry.

The separate Bar/Kim Story Source rewrite is intentionally not part of this
commit. It remains blocked on independent Claude Code PASS.

## Authority and lifecycle

- `lib/companion-appearance-state.ts` defines the pure authority, validation,
  resolution, prose-conflict and prompt-projection functions.
- A vocabulary must have canonical lowercase underscore ids, ordered contiguous
  continuity indexes, exactly one baseline default at index zero, at least one
  transition and mismatched state, and exactly one resolved final state.
- `lib/companions.ts` optionally declares authoring authority. The compiler
  freezes a complete defensive copy into the companion cast member.
- Runtime reads only the frozen contract copy; later registry edits cannot
  reinterpret an approved package.
- Page state starts at the frozen default. An override is legal only when the
  companion is present, changes to an exact declared id, carries typed origin,
  is not a no-op and moves no more than one continuity step.
- Omitted pages inherit the prior state. An absent page hides but does not reset
  it; the same state reappears when the companion returns.
- Contract/cover `mustShow` and `mustNotShow`, plus Blueprint narrative summary,
  cannot carry companion-scoped reserved appearance prose.

## Kim declaration

The closed state sequence is:

1. `settled_warm_green` — baseline, index 0
2. `alert_olive_shift` — transition, index 1
3. `mismatched_amber_stripes` — mismatch, index 2
4. `attuning_blue_green` — transition, index 3
5. `blended_moonlit_teal` — resolved, index 4

Every state controls one coherent hue, pattern and body-language cue. The
invariant identity separately fixes species, anatomy, proportions, face, eyes,
tail and the tiny warm-mustard shoulder satchel. The provider prompt suppresses
Kim's legacy fixed-green description when typed state exists and retains the
separate canonical accessory lock.

## Authoring and repair boundary

- Initial/full authoring exposes nullable `companionStateId` and
  `companionStateSourceEvidenceId` fields.
- The provider sees only the compact closed `[id,index,role]` selection table;
  render descriptions remain compiler-owned.
- A selected state requires one exact same-page Source Evidence id. Compilation
  turns it into an exact same-page story-evidence origin.
- The compiler ignores any provider-authored state vocabulary and injects the
  declared canonical authority.
- PageContract, catalog-strict and Structural Bundle narrow repair schemas omit
  state selection. Their authority inputs omit it and their appliers preserve
  prior state values. They therefore cannot rewrite state as collateral repair.
- Draft schema: `vc-draft-schema/v17`.
- Template prompt authorities: system `v15`, user `v15`.
- Serialized schema: 13,819 bytes; digest
  `72c2024f831cb0991ee262e5279a81ebc382983b3dc03334e6c344bbf385b6c1`.

## Runtime seams proven

The exact state is projected through:

1. materialized Visual Contract;
2. derived page facts and deterministic carry-forward;
3. Pre-render Blueprint validation;
4. runtime Blueprint frame;
5. runtime page authority;
6. Style01 companion lock;
7. final provider prompt assembly.

The provider-seam regression asserts that the state id, exact state hue and
mustard satchel are present while a hostile legacy fixed-green description is
absent.

## Input and compatibility evidence

- Largest 12-page QA source: `chameleon_koko_adventure` at 62,605/64,000,
  leaving 1,395 units headroom.
- Approved Fox exact case: 49,682/64,000, leaving 14,318.
- Largest approved source: `lion_shaket_fantasy` at 53,106/64,000, leaving
  10,894.
- No model, provider, call budget, repair budget, retry or cost ceiling changed.
- Legacy contracts with no frozen authority resolve with no companion state and
  retain their prior prompt behavior.

## Validation

- Dedicated Companion State: 1 file / 9 tests PASS.
- Complete authoring/lifecycle/Blueprint cross-section: 4 files / 242 tests
  PASS.
- Narrow PageContract + Structural Bundle repair: 2 files / 78 tests PASS.
- Runtime authority/provider seam: 1 file / 29 tests PASS.
- Prompt compaction + live authoring + structured-output compatibility: 3 files
  / 57 tests PASS.
- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.
- Canonical workload inventory: 323 total / 303 ordinary / 20
  resource-intensive; classifier 7/7 PASS.

One literal `npm run check` completed both phases but is truthfully not globally
green:

- ordinary: 3,544 PASS / 65 skipped / 8 failures;
- five failures are the established missing ignored `outputs/` fixtures;
- two unchanged package-migration tests exceeded the five-second timeout under
  parallel load and passed in isolation with a 30-second allowance (2/2; 6.5s
  and 6.1s);
- one inventory assertion observed the intentional new spec, was updated from
  322/302/20 to 323/303/20, and now passes 7/7;
- resource-intensive: 610 PASS / 1 timeout plus three known Vitest worker
  `onTaskUpdate` RPC timeouts;
- the unchanged QA Bridge timeout passed in isolation (1/1; 6.0s).

No changed or adjacent functional assertion remains failed.

## Independent QA finding and focused correction

Claude Code's first read-only pass verified the authority, continuity,
identity/accessory preservation, repair isolation, runtime seam and preservation
fence, but issued one MAJOR HOLD on prose ownership. The original exact Unicode
word boundary did not recognize attached Hebrew prefixes on an alias or term,
and stripped niqqud could not reconcile marked defective `יָרֹק` with plene
`ירוק`. Three exact English expressions were also not reserved.

The corrective milestone is intentionally limited to the pure prose matcher,
Kim's reserved appearance-term data, its dedicated regression suite and this
status evidence:

- Hebrew terms accept up to two attached prefixes from the closed prefix set;
- Hebrew aliases accept the narrower non-ambiguous set, including `לקים` and
  `וקים`, without classifying the ordinary verb `מקים` as the alias Kim;
- marked defective `יָרֹק` is a marked-only reserved term, so the ordinary
  unmarked noun `ירק` remains valid;
- exact English `greenish`, `olive` and `stripes sharpen` are reserved without
  a broad stem rule, preserving `greenhouse` and `evergreen`;
- all reported inputs now reject: `קים לירוק`, `קים בירוק`, `קים וירוק`,
  `קים מירוק`, `קים הירוק`, `קים והירוק`, `לקים ירוק`, `לְקִים יָרֹק`, the
  canon-shaped niqqud sentence `קִים נִשְׁאַרָה בְּיָרֹק רַךְ הַיּוֹם`,
  `Kim turns greenish`, `Kim goes olive`, and `Kim's stripes sharpen`;
- explicit safe controls remain accepted: `Kim stands by the greenhouse`,
  `Kim watches evergreen branches`, `קים אכלה ירק`, and
  `בר מקים אוהל ירוק`.

Corrective validation: dedicated Companion State **9/9**, adjacent Blueprint
**112/112** (**121/121** total), `npx --no-install tsc --noEmit` PASS, and
`git diff --check` PASS. No frozen authority, continuity, schema, repair,
runtime, Story Source, package, locator, Board or provider behavior changed.
The Bar/Kim rewrite remains blocked pending the narrow independent re-gate.

## Second narrow QA finding and correction

Claude Code's re-gate reproduced all first-correction claims but retained HOLD
for Hebrew adjectival suffixes: `קים ירוקה`, `קים נעשתה ירוקה`,
`הזיקית הירוקה`, and `קים בירוקה` escaped. It also identified the coupled
over-block risk: simply accepting `ה`, `ים` and `ות` after a colour would make
an alias plus unrelated world colour in the same sentence fail, for example
`קים הביטה בשמיים הכחולים`. English `Kim's stripes sharpened` was the remaining
past-tense escape.

The correction addresses the under-block and over-block as one matcher rule:

- Hebrew appearance terms accept the bounded adjective suffix family `ה`,
  `ים`, `ות`, `ית`, `יים`, and `יות`;
- ordinary appearance terms require direct attribution to a matched companion
  alias: adjacency, possessive form, or one closed copula/appearance/change
  link with optional bounded modifiers;
- exact closed state ids remain unambiguous and reject beside a companion alias
  anywhere in the same text;
- `stripes sharpened` is now an exact reserved phrase;
- the four Hebrew suffix cases and English past tense reject;
- companion-plus-world-colour controls remain valid: `Kim looks at the blue
  sky`, `Kim sits on the green grass`, `Kim's blue scarf rests by the bed`, and
  `קים הביטה בשמיים הכחולים`.

Second-correction validation: dedicated Companion State **9/9**, adjacent
Blueprint **112/112** (**121/121** total),
`npx --no-install tsc --noEmit` PASS, and `git diff --check` PASS. The change is
limited to the pure matcher, reserved-term data, dedicated regressions and
status evidence. No frozen state authority, continuity, schema, validator call
site, repair, runtime seam, Story Source, package, locator, Board or provider
behavior changed.

## Preservation fence

The four pre-existing untracked Board artifacts remain unstaged and
byte-identical:

- `8e530b4489c003307d85ebb22fc7125912d94a99809330bb7b7f0d2ef22892db`
- `bbce002dbee70639dc6651f0aaf85f274b7cf45fac6f99a7041168e75f4c74b3`
- `a2bff52603b01bef4dfc61c78c9e078e9c2d9adeef35bfbbb2bb94ca3522fbf8`
- `53e446c9db371fb67e1d851f7c3ecdcf356019a7ef083abd1c97e676820bfe86`

No approved package, locator, Story Source, Blueprint, Board, Order, payment,
image, audio, database, storage, deployment or remote state was changed.

## Independent falsification targets

Claude Code should attempt to prove:

- a registry edit can reinterpret a frozen approved contract;
- a malformed, unordered, non-gradual, no-mismatch or unresolved vocabulary
  passes;
- a page can select an undeclared state, no-op, jump, or change while absent;
- state resets across omission or temporary absence;
- a narrow repair can see, author, delete or mutate state selection;
- loose page, cover or Blueprint prose can compete with typed appearance;
- the legacy fixed-green lock reaches the provider when state is active;
- the satchel or invariant identity disappears when colour changes;
- the state is lost at any contract → Blueprint → runtime → provider seam;
- a historical/non-capable companion changes behavior;
- any runtime code branches on Kim, Bar, Chameleon, story key or page number.

The first QA pass is read-only. No push, Story Source rewrite, provider call,
render, package/locator mutation, deployment or product approval is authorized
by this evidence.
