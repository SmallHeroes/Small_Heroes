# Codex re-review — P0: Contract Template + Deterministic Materializer + Resolved Validator (money-adjacent)

**Status:** implementation-complete, per-commit `npm run check` green, **unpushed on `feat/chunked-generation`**.
This is the money-adjacent slice (it changes what the atomic freeze HASHES). Per the approved brief it goes back to
Codex **before ANY P1**. Guy verified each SHA as it landed; this package is the whole-slice re-review.

> **UPDATE — round-2 re-review (this is the current ask).** Round-1 Codex verdict on `f69795b6..4fb613d2`:
> **atomic mechanics PASS** (resume-reuse, deterministic hash, `mutationPayload` 100%, no receipt/outbox/refund/
> readiness-txn change — all confirmed) but **3 fail-closed COMPLETENESS gaps** to close before ANY P1. All 3 are now
> fixed on top of the slice (`4fb613d2..c5f28b20`, HEAD `c5f28b20`, green **1321 pass / 15 skip**). **The round-2 ask +
> per-fix detail + confirmations are in [PART 2](#part-2--codex-hold-fixes-4fb613d2c5f28b20) at the bottom — read that.**
> PART 1 below (round-1) is unchanged context.

**Commits (review in order; parent = `f69795b6`, so the round-1 slice = `git diff f69795b6..4fb613d2`):**
- `29efa386` — P0 commit 1: Template/Resolved types + validators (PURE, no live-path).
- `f6e7bdf5` — P0 commit 2: versioned palette + pure deterministic materializer (PURE).
- `4fb613d2` — P0 commit 3: Template loader + family adapter + materialize→freeze wiring (LIVE, money-adjacent).
- **round-2 (PART 2): `7e45bcd9` (Fix 1), `d1b7b7b8` (Fix 2), `c5f28b20` (Fix 3) — the 3 HOLD fixes.**

**Green per commit:** `npm run check` → tsc clean + 1308 pass / 15 skip at `4fb613d2`; **1321 pass / 15 skip at HEAD `c5f28b20`**.

---

## Why (the defect this closes)

The visual-contract human cast (mother/doctor) deferred skin tone + hair colour "to the per-order Family Appearance
Lock", but that deferral is a **broken consistency mechanism** for text-only humans: the family colour is injected
only via a page-text REGEX (`detectHumanFamilyRolesOnPage`) DECOUPLED from the contract cast (misses `אִמָּא`/"a
parent"), and the **doctor is never a family role at all** → colours free-picked → drift between pages. P0 replaces
prose deferral with **one authoritative STRUCTURED source per human trait, deterministically resolved per order** →
vague prose cannot exist (the prose the model sees is GENERATED from the concrete traits).

**Scope of concrete resolution = recurring HUMANS only** (mother/father/doctor/nurse/…). NOT the child (hero anchor +
book wardrobe lock, unchanged) and NOT the companion (existing companion lock, unchanged).

---

## Architecture

- **`BookVisualContractTemplate`** — story-level, authored. TYPED bindings, may hold UNRESOLVED traits. DISTINCT type +
  DISTINCT loader (`{storyKey}.visual-contract-template.json`). NEVER frozen/rendered.
- **`ResolvedBookVisualContract`** — per-order, fully concrete; a **SUPERSET of the vNext `BookVisualContract`** (so it
  flows through the existing steering/adapters/QA/freeze unchanged). The **ONLY** thing hashed/frozen/rendered/QA'd.
  Structured traits are AUTHORITATIVE; `coarseAppearance`/`wardrobe.description` are deterministic PROJECTIONS.
- **Binding mode** per human trait (skin tone, hair colour, hair style, each garment colour):
  `explicit | family_profile (relatives ONLY) | deterministic_palette` + a **typed evidence origin**
  (`story_evidence{page,phrase} | family_profile | policy_default{policyId,version} | deterministic_palette{paletteId,version}`
  — a compiler-picked colour never fabricates a story phrase).

Files: `lib/visual-contract-compiler/contractTemplateTypes.ts`.

---

## Commit 1 (`29efa386`) — types + validators (PURE)

`validateTemplateContract.ts` / `validateResolvedContract.ts` (both pure; may import the pure vNext validator only):
- **Template validator** — reuses the vNext STRUCTURAL rules via a placeholder-prose SHADOW (coverage/transition/
  castIds/humanCast pagesPresent bindings), then layers: **`family_profile` is relatives-ONLY** (the clinic-doctor
  fix — rejects family_profile on `doctor`); the evidence origin is present + well-formed + **coherent with the mode**
  (family_profile↔family_profile origin, palette↔palette origin, explicit↔story/policy origin); `explicit` carries a
  value, unresolved carries none; garment colours must be `explicit` (a garment colour is authored, not ethnicity).
  Replaces the vNext humanCast prose checks (`validateVNextVisualContract.ts:157-159`) for templates.
- **Resolved validator** — runs the vNext validator (Resolved is a superset) THEN asserts FULL concreteness: no
  unresolved/deferred trait, every garment concrete-coloured, and **DEFERRAL_MARKERS** (`/deferred|not set/fixed
  here|per-order family|family lock|free-pick|unresolved|template-unresolved/i`) reject any deferral text smuggled into
  a concrete value OR the projected prose; and **REJECTS a Template shape** (`contractKind:"template"`) so a Template
  can never be frozen/rendered as Resolved. This is what P1's render guard will call.
- Tests `lib/__tests__/visual-contract-template.spec.ts` (11): accept valid; reject family_profile-on-doctor / missing
  origin / empty slot / explicit-without-value / deferred trait / garment-without-colour / template-as-resolved.

## Commit 2 (`f6e7bdf5`) — palette + materializer (PURE)

- `appearancePalette.ts` — curated COHERENT `{skin, hair}` entries (a plausible pairing per entry, never
  independently-hashed). `paletteEntryFor` keyed **EXACTLY** by
  `hash(VISUAL_CONTRACT_SCHEMA_VERSION + palette.version + normalizeStoryKey(storyKey) + castId)` — **NO orderId, NO
  timestamp, NO deployment version**. So a non-family human is stable across ALL orders of a story and varies across
  stories/casts. `normalizeStoryKey` is dir/extension/case-insensitive.
- `materializeContract.ts` — `materialize(template, family, palette) → Resolved`. Resolves each human's appearance
  ONCE (**castIds = page placement, not appearance**): `explicit`→verbatim, `family_profile`→from the
  `ResolvedFamilyAppearanceProfile`, `deterministic_palette`→from the palette entry. Projects
  `coarseAppearance`/`wardrobe.description` DETERMINISTICALLY from the structured traits. **PURE + canonical: NO clock,
  NO random, NO orderId, NO derivedAt/metadata in the output.** Fail-CLOSED `MaterializationError` on a family gap, a
  palette-on-style, a non-explicit garment, or a non-template input.
- Resolved records `schemaVersion` + `materializerVersion` + `paletteVersion` (top-level, hashed + auditable → a bump
  safely re-hashes). *(Guy approved top-level over nesting in `provenance`.)*
- Tests `lib/__tests__/visual-contract-materialize.spec.ts` (9): **byte-identical determinism** (same inputs →
  identical `JSON.stringify` → identical `computeVisualContractHash`; no derivedAt/metadata; a changed value re-hashes);
  **palette fairness** (18 stories: distinct ≥ 5, max-cluster ≤ 6; selection ignores order/time; dir/case normalized);
  materialized Resolved passes `validateResolvedContract`; family-gap + non-template FAIL.

## Commit 3 (`4fb613d2`) — wiring (LIVE, money-adjacent)

**Seam:** `materialize()` runs INSIDE `ensureFrozenVisualContract`'s produce (`ensure-frozen-visual-contract.ts`,
`defaultProduceContract`) — the freeze runs after text-final + DNA, so the family is available. The **Resolved** it
returns is what the **UNCHANGED** `withDeliveryInputMutation` hashes + persists in the SAME fenced operation;
`operationKey` stays `delivery_input:<order>:visual_contract:<resolvedHash>`. No chunk-runner change.

- `contractArtifact.ts` — DISTINCT Template loader. `tryLoadVisualContractTemplateArtifact` returns `null` ONLY when
  the file is genuinely **ABSENT** (clean legacy fallback); a present-but-INVALID template THROWS (fail-closed).
- `readFrozenVisualContract.ts` — explicit guard: `if (raw.contractKind === 'template') return null` (a Template is
  NEVER read as a frozen contract; the vNext validator would also reject it — belt + suspenders).
- `resolve-family-appearance.ts` (adapter) — WRAPS `lib/family-coherence` (adds only a small additive
  `familyProfileHairDescriptor` read-accessor to `member-locks.ts`; **no rewrite of the derivation/locks**). Maps the
  derived profile → `ResolvedFamilyAppearanceProfile {skinTone, hairColour}`, **EXCLUDES `derivedAt`/metadata**, and
  **FAILS CLOSED when there is NO family input** (childPhotoDescription/childStructured/familyContext all empty) —
  refusing the legacy `inferSkinToneBand` light-neutral default. (A genuinely light-neutral child still derives.)
- `defaultProduceContract` — bank story → PREFER a Template (load → derive family → materialize → Resolved); MISSING
  template → legacy vNext artifact; invalid template / missing family / any gap → THROWS (WS0b non-blocking catch
  degrades to legacy in prod — the P0 CALIBRATION will REQUIRE resolution, commit 6).
- Tests `lib/__tests__/materialize-freeze-wiring.spec.ts` (6): readFrozen rejects Template / accepts Resolved; loader
  missing→null / valid / invalid→throws; adapter derives {skin,hair} with NO derivedAt + fails closed on empty input;
  **freeze hashes+persists the RESOLVED** (barrier spy: operationKey hash-keyed on the Resolved, payload.visualContract
  is `contractKind:resolved`); **RESUME reuses without calling produce**.

**Resume-reuse invariant (verbatim from the unchanged fast-path):**
```ts
if (order.visualContractHash && cache.visualContract) {
  const cached = readFrozenVisualContract(cache.visualContract);
  if (cached && computeVisualContractHash(cached) === order.visualContractHash) return cache; // returns BEFORE produce
}
```
The Resolved round-trips through `readFrozenVisualContract` (vNext superset) and its hash matches the Order stamp →
returns BEFORE `produce` → **never re-materializes** → a shifted input cannot drift the hash / break the fence. Family
input captured once per freeze.

---

## Please confirm (the review asks)

1. **Exactly-once / atomic invariants still hold** — esp. (a) resume REUSES an already-frozen valid Resolved and never
   re-materializes (fast-path unchanged, returns before produce); (b) the materializer is deterministic so
   `computeVisualContractHash(Resolved)` is byte-stable across renders (no clock/random/orderId/derivedAt); (c) a
   genuine resolved-content change → new hash → new `operationKey` → new `inputVersion` (B1/B2/C3 preserved).
2. **No delivery/receipt/outbox/refund regression** — `withDeliveryInputMutation` / `AtomicOperationReceipt` /
   `DeliveryOutbox` / readiness-txn structure are UNTOUCHED; the only change is the CONTENT produce returns (a Resolved
   instead of a legacy vNext contract) + the freeze hashing it. Confirm the `mutationPayload` still covers 100% of what
   the freeze writes.
3. **Template/Resolved seam + fail-closed boundaries are correct** — Template never frozen (distinct loader +
   `readFrozenVisualContract` guard + Resolved-validator rejects a Template); the family adapter wraps-not-rewrites,
   excludes `derivedAt`, and fails closed on missing input (no silent light-neutral); produce falls back to legacy ONLY
   on an ABSENT template, and throws (not silently degrades content) on an invalid template / resolution gap.
4. **Any residual before P1** — the compiler side (Template/Resolved validators, palette, materializer) and the render
   side (the render guard `requireValidContractForRender` is exported but NOT yet wired — P1). Flag anything that must
   land before P1 batch-compile / render-guard / Vision-QA.

---

## Verify locally
```
npm run check   # tsc + full suite → 1308 pass / 15 skip at 4fb613d2
git diff f69795b6..4fb613d2   # the whole P0 slice (3 commits: 29efa386, f6e7bdf5, 4fb613d2)
```
Files (compiler, pure): `lib/visual-contract-compiler/{contractTemplateTypes,validateTemplateContract,validateResolvedContract,appearancePalette,materializeContract,contractArtifact,readFrozenVisualContract,index}.ts`.
Files (live, commit 3): `lib/generation-pipeline/{resolve-family-appearance,ensure-frozen-visual-contract}.ts`, `lib/family-coherence/member-locks.ts` (+9 accessor only).
Tests: `lib/__tests__/{visual-contract-template,visual-contract-materialize,materialize-freeze-wiring}.spec.ts`.

**Do NOT start P1 until Codex passes.** After a PASS: P0 commit 4 (prompt-parity harness) → 5 (convert clinic artifact
to a Template) → 6 (prove resolution; calibration REQUIRES a valid Resolved) → 7 (render min mother+doctor pages).

---
---

# PART 2 — Codex-HOLD fixes (`4fb613d2..c5f28b20`)

**Round-1 verdict (recap):** atomic mechanics PASS — but **3 fail-closed COMPLETENESS gaps** must close before ANY P1
(none are money bugs; a validator/adapter was present but not strict enough). Brief:
`outputs/cc-brief-P0-codex-hold-3-failclosed-gaps.md`. Constraints held on all 3: **pure/validator/adapter only** — no
receipts/outbox/refund/readiness-txn/PayMe touched; **render guard NOT wired** (that is P1); **flags OFF**; small
commits, per-SHA `npm run check` green + NEW negative tests, stop-at-each-SHA (Guy verified each). The colour/texture
split (Fix 2) changes the Resolved hash SHAPE — nothing is frozen on staging, so re-materialization on the next
calibration is expected and safe.

**Review in order:** `git diff 4fb613d2..c5f28b20` (3 commits). Green at HEAD `c5f28b20`: **1321 pass / 15 skip**.

---

## Fix 1 (`7e45bcd9`) — `readFrozenVisualContract` dispatches on the discriminant  → closes **finding 1**

- **Finding it closes:** `readFrozenVisualContract` validated **only** the vNext superset. A
  `contractKind:"resolved"` carrying a missing/deferred structured trait still passes the vNext check, so the
  **resume fast-path would REUSE a bad cached Resolved** (`ensure-frozen-visual-contract.ts:157-159`) — the
  deferred-trait drift survives a resume.
- **How:** `readFrozenVisualContract.ts` now **DISPATCHES on `contractKind`**: `=== "resolved"` →
  `assertValidResolvedBookVisualContract` (FULL concreteness); legacy/absent kind → `assertValidVNextVisualContract`.
  On any failure it returns **`null`** (the contract stays NEVER-throws → the caller re-produces). No import cycle
  (`validateResolvedContract` imports only the pure vNext validator + types).
- **Why the resume is now safe:** in the fast-path, a corrupt Resolved → `readFrozenVisualContract` returns `null` →
  the `if (cached && hash===stamp)` guard is false → falls through to re-produce (never reuses the bad contract).
- **Negative tests** (`materialize-freeze-wiring.spec.ts`): (a) a Resolved with a deferred trait → `readFrozen` →
  `null`; a legacy vNext (no `contractKind`) → still passes. (b) **resume with a CORRUPT frozen Resolved whose hash
  MATCHES the Order stamp** → fast-path SKIPPED, `produce` IS called (the exact inverse of the round-1 resume-reuse
  test — proving only the Resolved-validation, not the hash match, prevents the bad reuse).

## Fix 2 (`d1b7b7b8`) — positive trait-specific evidence + colour/texture split  → closes **finding 2**

- **Finding it closes:** `inferSkinToneBand`/`inferHairColor`/`inferHairTexture` (`family-coherence/derive.ts`)
  ALWAYS returned a band, silently defaulting to `light-neutral`/`mixed-dark`/`mixed` on absent evidence. So
  `{face:"round face"}` produced a concrete-LOOKING profile → the adapter's `if(!isStr(skinTone)) throw` never fired
  → a **silent wrong-ethnicity default flowed into the freeze** (the drift's back door). Also `hairColour` bundled
  texture+colour, which blocked Fix-3 projection-equality.
- **How (WRAP, additive — legacy flag-off behaviour byte-identical):**
  - `derive.ts` extracts `matchSkinToneBand`/`matchHairColor`/`matchHairTexture` that return **`null` on NO positive
    match**; `inferX` become thin wrappers `matchX ?? '<legacy default>'`, so `deriveFamilyCoherenceProfile`
    (family-coherence's own consumer) is **unchanged**. Added `matchFamilyAppearance(input) →
    {ok:true; value:{skinTone,hairColour,hairTexture}} | {ok:false; defaulted:('skin'|'hairColour'|'hairTexture')[]}`
    (maps matched enums via `SKIN_BAND_PROMPTS` + the now-`export`ed `HAIR_COLOR_WORD`/`HAIR_TEXTURE_WORD` from
    `member-locks.ts`).
  - `resolve-family-appearance.ts` (adapter) calls `matchFamilyAppearance`; on `!ok` it **THROWS listing the DEFAULTED
    traits** — refusing the light-neutral/mixed default. Returns `{skinTone,hairColour,hairTexture}`, no `derivedAt`.
  - **NOT over-blocking a legit light child:** `matchSkinToneBand` has a POSITIVE `light-warm` branch
    (`/\b(warm pale|light skin|fair skin|peachy|light peach)\b/`) — a genuinely light-skinned child WITH explicit
    evidence (e.g. `"light skin"`) MATCHES and resolves. Only the *silent default on NO evidence* is refused.
  - **Colour/texture split** (so Fix-3 projection-equality is checkable): `HumanAppearanceTraits` gains `hairTexture`;
    `PaletteEntry` = `{skin, hairColour, hairTexture}` (curated entries updated); `ResolvedFamilyAppearanceProfile`
    gains `hairTexture`; materializer projection is `${hairStyle}, ${hairTexture} ${hairColour} hair`; both validators
    iterate `[skinTone, hairColour, hairTexture, hairStyle]`.
- **Negative/positive tests** (`materialize-freeze-wiring.spec.ts`, family-adapter block): `{face:"round face"}`
  (structure, no skin/hair evidence) → adapter **FAILS**; no input at all → FAILS; explicit skin+hair evidence →
  resolves concretely; **a legit LIGHT child WITH evidence (`"light skin, blonde straight hair"`) → resolves (NOT
  falsely rejected)**.

## Fix 3 (`c5f28b20`) — version / origin / projection coherence  → closes **finding 3**

- **Finding it closes:** version/origin/projection completeness — the validators were present but not strict enough:
  Template `schemaVersion` accepted any non-empty string; `storyKey` was not required (an empty/mismatched key lets the
  deterministic palette seed `hash(… | storyKey | castId)` degenerate or be driven by the wrong story); the Resolved
  validator did not pin supported versions, did not check trait mode↔origin coherence, and did not verify the projected
  prose EQUALS the structured projection (prose could silently diverge from the authoritative source).
- **How:**
  - **Template validator** (`validateTemplateContract.ts`): `schemaVersion` must **EQUAL**
    `VISUAL_CONTRACT_SCHEMA_VERSION` (not any non-empty string); `storyKey` **required non-empty**.
  - **Template loader** (`contractArtifact.ts`, BOTH `load`/`tryLoad`): **artifact-key/storyKey AGREEMENT** — the
    loaded template's own `storyKey` must equal the bank key it loads under (`assertTemplateStoryKeyAgrees`); a
    mismatch throws `InvalidTemplateContractError` (the palette seed can't be driven by the wrong story). `tryLoad`
    still returns `null` ONLY on genuine ABSENCE.
  - **Resolved validator** (`validateResolvedContract.ts`) adds: **(a)** supported `schemaVersion` /
    `materializerVersion` / `paletteVersion` (each `=== ` its constant); **(b)** mode/origin coherence — every
    appearance trait + garment colour carries its typed origin, coherent with its mode (`explicit`→
    `story_evidence`/`policy_default`, `family_profile`→`family_profile`, `deterministic_palette`→
    `deterministic_palette`); **(c)** deterministic **projection EQUALITY** — the stored `coarseAppearance` +
    `wardrobe.description` must EQUAL the shared projection of the structured traits (only checked when the member is
    fully concrete, so the concreteness errors fire first on a partial).
  - **Two shared PURE modules so generate + verify can't drift:** `appearanceBindingCoherence.ts` (`bindingCoherenceError`
    — the ONE mode↔origin table, used by BOTH validators; the Template validator's per-binding coherence now DELEGATES
    to it) and `projectResolvedHumanProse.ts` (`projectResolvedCoarseAppearance`/`projectResolvedWardrobeDescription` —
    the ONE projection, used by BOTH `materializeContract` to GENERATE and `validateResolvedContract` to VERIFY; the
    materializer's local projection functions were removed).
- **Negative tests** (`visual-contract-template.spec.ts` + `materialize-freeze-wiring.spec.ts`): wrong `schemaVersion`
  → reject; missing `storyKey` → reject; **storyKey mismatch at load** → reject; unsupported version → reject;
  incoherent mode/origin (template AND resolved) → reject; **prose ≠ structured projection** (both `coarseAppearance`
  and `wardrobe.description`) → reject.

---

## Please confirm (round-2 re-review asks)

1. **All 3 fail-closed gaps are CLOSED** — (1) a deferred/invalid Resolved can no longer be reused on resume
   (`readFrozenVisualContract` dispatch → `null` → re-produce); (2) a silent light-neutral/mixed default can no longer
   reach the freeze (`match*` return `null` on no evidence → adapter throws on any DEFAULTED skin/colour/texture);
   (3) version/origin/projection coherence is enforced (exact versions, required+agreeing storyKey, mode↔origin
   coherence, prose≡projection via the one shared module).
2. **No new delivery/receipt/outbox/refund/atomic regression** — all 3 fixes are pure validator/adapter/type changes
   (+ the shared projection/coherence modules). `withDeliveryInputMutation` / `AtomicOperationReceipt` / `DeliveryOutbox`
   / readiness-txn are UNTOUCHED; the freeze seam + `mutationPayload` coverage are unchanged from round-1 (only the
   Resolved hash SHAPE changed via the colour/texture split — safe, nothing frozen on staging).
3. **Fix 2 does NOT over-block a legitimately light-skinned child** — `matchSkinToneBand`'s positive `light-warm`
   branch resolves a light child WITH explicit evidence; only the *silent default on absent evidence* is refused (see
   the "legit LIGHT child → resolves" test).
4. **Clearance for P1** — the compiler side is complete + fail-closed. Confirm readiness for P1 = wire the render guard
   `requireValidContractForRender` (exported, ZERO call-sites today) so a present-but-invalid Template/Resolved **BLOCKS
   render** — eliminating the current WS0b non-blocking fallback (`ensure-frozen-visual-contract.ts:167-177`: a produce
   throw is caught and the render silently degrades to legacy). Flag anything else that must land before P1.

## Verify locally (round-2)
```
npm run check                 # tsc + full suite → 1321 pass / 15 skip at c5f28b20
git diff 4fb613d2..c5f28b20   # the 3 HOLD fixes (7e45bcd9, d1b7b7b8, c5f28b20)
```
New shared files: `lib/visual-contract-compiler/{appearanceBindingCoherence,projectResolvedHumanProse}.ts`.
Changed (compiler): `.../{readFrozenVisualContract,validateTemplateContract,validateResolvedContract,materializeContract,contractArtifact,contractTemplateTypes,appearancePalette,index}.ts`.
Changed (family/adapter): `lib/family-coherence/{derive,member-locks}.ts`, `lib/generation-pipeline/resolve-family-appearance.ts`.
Tests: `lib/__tests__/{visual-contract-template,visual-contract-materialize,materialize-freeze-wiring}.spec.ts`.
