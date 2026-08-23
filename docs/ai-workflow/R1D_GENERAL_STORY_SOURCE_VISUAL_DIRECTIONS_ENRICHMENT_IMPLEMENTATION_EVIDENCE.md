# R1D General Story Source Visual Directions Enrichment — Implementation Evidence

**Date:** 2026-08-23

**State:** local implementation green; independent Claude Code QA required

**Branch:** `codex/qa-wizard-presentation-dispositions`

**Worktree:** `C:\GNart\Work\sh-wt-r1d-output-budget`

**Decision Gate:**
`docs/ai-workflow/R1D_GENERAL_STORY_SOURCE_VISUAL_DIRECTIONS_ENRICHMENT_DECISION_GATE.md`

## Outcome

The repository now has one general provider-free preparation boundary for
adding fresh Visual Directions to an immutable, accepted `story_text_only`
creative replacement. The lifecycle prepares a review candidate only. It has
no accepted-revision publication, package, locator, Wizard, deployment,
provider or render capability.

The first candidate binds:

- story key: `chameleon_koko_bedtime`;
- accepted source revision:
  `eca8b3c8a8ed32a6a884cd9bd4fc493fcc6f00fed3c4ebe710c6a870ead2115d`;
- source manifest SHA-256:
  `0cb441f8e51d8b1a228db449f07029626a949ef5bd5a0dcd3e1f884676f7635a`;
- source manifest digest:
  `1dffb1a6b4f0eda5d389fc33b799a94a86f071a81793867de42b7ea6541ab757`;
- Visual Directions SHA-256:
  `51e3bb3e7bd8266befe7f1030c86fb979feef919dfc223442dfe039dc6ab9778`;
- integrated Story Source SHA-256:
  `9acf0433386ac515d08d5d30f0429dc6b9f03596b29ba0994316ff69507195b1`;
- Candidate digest:
  `3ef645415b3cdd5945baeaa275d97ae0aa0491bf30addbcc46208475278f534a`;
- Candidate manifest digest:
  `42b8f35a72c89d559389c2d278eec3a12733d27061d89cdd2b3b2735cefe6795`;
- Review Bundle digest:
  `fa519a11bca42e0d565479329b9d5c0767972814ee28d6e73a764a35a1a3b57c`.

## Verified root cause and boundary

The legacy direction batch loads only top-level v1 accepted-source manifests
and cannot select the nested creative-replacement revision. The existing v2
accepted-revision/package loader additionally requires exactly the historical
`female -> neutral` metadata change. Reusing either surface would bind stale
bus-stop directions or represent a full creative rewrite as a metadata-only
migration.

`scripts/story-source-visual-direction-enrichment-lifecycle.cjs` therefore:

1. loads the source through the self-contained accepted creative-replacement
   loader;
2. verifies the request-pinned manifest path, whole-file SHA, manifest digest,
   revision digest and story identity;
3. accepts direction input only as a regular, single-link file below
   `outputs/` with exact bytes/SHA and closed request keys;
4. applies the existing typed Visual Direction schema and exact eight-page
   coverage;
5. rejects explicit direction prose that claims child wardrobe or role-bound
   companion appearance authority;
6. applies the versioned storyboard composition-review policy;
7. injects one exact direction line per page and proves that removing those
   lines restores the accepted Story Source byte-for-byte; and
8. writes the five-file candidate through a sibling staging directory and one
   atomic rename. Exact replay is a no-op; an unlike inventory, byte, link or
   hard-link alias is a collision/rejection.

Production code contains no Bar, Kim, Chameleon, kindergarten, lantern,
bedtime, story-key, page-number or pinned-digest branch. Those facts exist only
in the first candidate data beneath ignored `outputs/`.

## Storyboard and continuity result

The exact page plan is:

| Page | Shot | Angle | Visible beat |
|---:|---|---|---|
| 1 | `medium_close` | `three_quarter` | lantern/cart launch accident |
| 2 | `wide` | `ground_level` | hedge chase and child brake action |
| 3 | `close` | `low_angle` | handle correction and bread-roll misroute |
| 4 | `extreme_wide` | `overhead` | closed label ring circles the fountain |
| 5 | `detail` | `high_angle` | child opens the ring and adds the blank end |
| 6 | `medium_wide` | `low_angle` | child leads the final unmapped segment |
| 7 | `medium` | `three_quarter` | child hangs the lantern at the kindergarten |
| 8 | `medium_close` | `eye_level` | quiet bedroom and distant lantern landing |

Measured composition evidence:

- wide pages: `2, 4`;
- close-focus pages: `1, 3, 5, 8`;
- distinct shot types: `7`;
- distinct camera angles: `6`;
- adjacent repeated shot/angle pairs: `0`;
- maximum same-shot run: `1`.

The direction prose intentionally owns only visible setting, action, camera,
lighting, cast presence, hero objects and object-state continuity. It contains
no child identity or clothing definition and no Kim hue, pattern or body-
language definition.

The review bundle separately binds downstream structured intent:

- book wardrobe authority: frozen Visual Contract;
- typed child wardrobe transition: page `8` only;
- companion accessory authority: canonical companion profile while visible;
- companion appearance authority: frozen Companion State;
- companion state-transition evidence pages: `2, 3, 5, 6`.

These are review requirements for the later Visual Contract, not free-text
runtime authority.

## Real candidate evidence

Request root:
`outputs/r1d-chameleon-first-kindergarten-visual-directions-v1/`

- `request.json`: 1,331 bytes, SHA-256
  `89380b206dd20d6cdee1f46ea1b854f18df3ed591fee9b55cd230eb36438692a`;
- source `visual-directions.json`: 7,000 bytes, SHA-256
  `51e3bb3e7bd8266befe7f1030c86fb979feef919dfc223442dfe039dc6ab9778`.

Candidate root:
`outputs/r1d-chameleon-first-kindergarten-visual-directions-v1/candidates/3ef645415b3cdd5945baeaa275d97ae0aa0491bf30addbcc46208475278f534a/`

| File | Bytes | SHA-256 |
|---|---:|---|
| `integrated.md` | 8,717 | `9acf0433386ac515d08d5d30f0429dc6b9f03596b29ba0994316ff69507195b1` |
| `manifest.json` | 2,732 | `9500106ebfdeef99b1e220ca18639bd4399ed06b032f71cf33850799120fa459` |
| `review-bundle.json` | 2,850 | `02abc8885da908f2799a9709817837f0d09268d85dd39dfd9c473ce194880dec` |
| `revision-identity.json` | 1,409 | `3ef645415b3cdd5945baeaa275d97ae0aa0491bf30addbcc46208475278f534a` |
| `visual-directions.json` | 7,000 | `51e3bb3e7bd8266befe7f1030c86fb979feef919dfc223442dfe039dc6ab9778` |

The first real write returned `created:true`. Exact replay returned
`created:false` with the same Candidate, manifest, Review Bundle, direction and
integrated-source identities.

## Runtime and cost boundary

The candidate manifest declares:

```json
{
  "eligible": false,
  "reason": "visual_directions_candidate_not_product_accepted"
}
```

No accepted revision was created or mutated. The current Visual Package
locator and Wizard continue to select the existing predecessor-bound package.
No provider, model, network, image, audio, Vision, database, storage, payment,
deployment or render operation occurred. Cost was `$0`.

## Validation

- new dedicated lifecycle suite: **5/5 PASS**;
- lifecycle plus creative-replacement, revision-materializer,
  story-commission, Companion State, Blueprint composition and workload
  inventory matrix: **7 files / 73 tests PASS**;
- canonical workload inventory: **325 total / 305 ordinary / 20
  resource-intensive**;
- one literal `npm run check` completed both canonical phases and remained
  truthfully non-green on pre-existing local-suite conditions:
  - ordinary: **3,555 PASS / 65 skipped / 7 failures**; five failures are the
    established absent ignored-`outputs/` fixtures, and two unchanged Story
    Source package-migration tests exceeded the five-second parallel timeout;
  - resource-intensive: **610 PASS / 1 timeout** plus three known Vitest worker
    `onTaskUpdate` RPC timeouts; the timed test belongs to the unchanged QA
    Wizard Candidate Bridge;
  - isolated diagnostics with one worker and a 30-second allowance pass the
    complete package-migration file **8/8** and the complete QA Bridge file
    **8/8**;
  - the new lifecycle spec passes in the literal repository run, and no
    assertion introduced by this milestone failed;
- `node --check scripts/story-source-visual-direction-enrichment-lifecycle.cjs`:
  PASS;
- `npx --no-install tsc --noEmit`: PASS;
- `git diff --check`: PASS.

## Independent QA HOLD and narrow correction

Claude Code verified claims 1–6 and 8–14 on range
`a970af6888e8025aeb4d342a36e2fee4e678afe9..15fa4c9dc2d2757a7b82e41d98207a51c633cb8f`
but issued `HOLD / 1 MAJOR` on claim 7. The first guard recognized companion
appearance only when the literal role token `companion` and an appearance term
occurred in the same punctuation-delimited clause. Declared aliases, an
elliptical second-sentence body-state claim and six ordinary child-wardrobe
phrasings could therefore pass into `imageDirection` prose.

The corrective scope is deliberately narrow:

- resolve the accepted source's `companionId` through the already shipped and
  validated `CompanionAppearanceStateAuthority` declaration;
- reuse that authority's canonical `subjectAliases`,
  `reservedAppearanceTerms` and existing attribution matcher rather than add a
  story-specific alias branch;
- include the generic role word `companion` in the per-validation clone only;
- reject explicit body/skin hue, colour, tone, pattern or state-change prose
  even when an alias appears in a preceding sentence;
- recognize ordinary dressing actions and child-attributed garment prose;
- preserve legal set/prop colour and garment descriptions that do not claim
  the child's wardrobe or the companion's appearance.

Regression coverage reproduces all eleven reported bypasses and three negative
controls. The historical `striped sock fallen from laundry line` continuity
anchor remains legal because it is a prop, not child wardrobe authority.

After the correction, the real provider-free preview returns `created:false`
and preserves every identity exactly:

- Candidate `3ef645415b3cdd5945baeaa275d97ae0aa0491bf30addbcc46208475278f534a`;
- manifest `42b8f35a72c89d559389c2d278eec3a12733d27061d89cdd2b3b2735cefe6795`;
- Review Bundle `fa519a11bca42e0d565479329b9d5c0767972814ee28d6e73a764a35a1a3b57c`;
- Visual Directions `51e3bb3e7bd8266befe7f1030c86fb979feef919dfc223442dfe039dc6ab9778`;
- integrated source `9acf0433386ac515d08d5d30f0429dc6b9f03596b29ba0994316ff69507195b1`.

Corrective validation:

- dedicated lifecycle suite: **6/6 PASS**;
- lifecycle plus creative replacement, revision materializer, story commission,
  Companion State, Blueprint composition and workload inventory: **7 files /
  74 tests PASS**;
- `node --check`: PASS;
- `npx --no-install tsc --noEmit`: PASS;
- `git diff --check`: PASS.

The literal repository check was not repeated for this two-production/test-file
micro-correction because Claude explicitly confined the re-gate to the guard and
its rejection fixtures. The parent run's complete 325-file result and its
fixture/parallel-timeout classification remain recorded above.

This correction still performs no provider, model, image, Vision, network,
storage, database, payment, deployment, publication, Wizard or render action.

## Preservation fence

- accepted creative source revision `eca8b3c8...2115d`: unchanged;
- current Chameleon Visual Package locator SHA-256:
  `6d3d9431054a71b47456b659f343bc0674efa62403e6f488156b8a8fc02bb96b`;
- four pre-existing untracked Board artifacts remain unstaged and
  byte-identical:
  - `8e530b4489c003307d85ebb22fc7125912d94a99809330bb7b7f0d2ef22892db`;
  - `bbce002dbee70639dc6651f0aaf85f274b7cf45fac6f99a7041168e75f4c74b3`;
  - `a2bff52603b01bef4dfc61c78c9e078e9c2d9adeef35bfbbb2bb94ca3522fbf8`;
  - `53e446c9db371fb67e1d851f7c3ecdcf356019a7ef083abd1c97e676820bfe86`.

## Independent QA targets and next gate

Claude Code should try to falsify:

1. source identity can be rebound to another story or revision;
2. stale/extra/unlike request or direction bytes can cross the boundary;
3. incomplete pages, weak composition or protected appearance/wardrobe prose
   can pass;
4. integrated-source projection is not byte-exact;
5. links, hard links, collisions, partial writes or replay create mixed
   authority;
6. lifecycle code contains story/child/companion/page-specific behavior;
7. the candidate can reach accepted-source, package, Wizard or render
   authority; and
8. predecessor, locator or Board bytes changed.

After independent PASS, Guy must approve the exact Candidate
`3ef64541...f534a` and Review Bundle `fa519a11...a3b57c`. A later, separately
gated lifecycle may then publish an immutable integrated revision. This
implementation evidence is not independent technical PASS, product acceptance
or render authorization.
