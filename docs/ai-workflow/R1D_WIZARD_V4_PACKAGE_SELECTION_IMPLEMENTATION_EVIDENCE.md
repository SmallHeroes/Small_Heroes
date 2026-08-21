# R1D Wizard Visual Package v4 Selection — Implementation Evidence

**Date:** 2026-08-21

**Branch:** `codex/qa-wizard-presentation-dispositions`

**Base:** `3afabd7a7ada9c3434dc7cc455a3d32d4ded31a4`

**Decision Gate:** `docs/ai-workflow/R1D_WIZARD_V4_PACKAGE_SELECTION_DECISION_GATE.md`

## Outcome

The approved Chameleon bedtime Visual Package v4 revision is now the shared
authority for fresh Wizard availability, server-side order-slot validation,
product/source resolution and the subsequent frozen Story Source load. The
implementation is generic: every future `storyKey + styleId` pair with a valid
current v4 locator and exact source bytes follows the same path.

The exact published revision is
`a9c253d989118262ed2b38a671fc7eccf6af44a084512af35285ad2f548a14fb`.
The current locator is
`visual-packages/approved/chameleon_koko_bedtime.soft_hand_drawn_storybook.visual-package-current.json`.

## Root cause closed

1. Wizard Matrix response used legacy visual-package/v3 qualification.
2. Product resolution preferred the old checked-in v3-approved Chameleon story.
3. Text finalization with an empty pipeline cache ignored the Order's frozen
   repo-relative source path and invoked the legacy companion selector.

The correction introduces `evaluateWizardVisualPackageSelection`, which:

- loads and validates the current v4 locator and immutable revision;
- requires exact package/style/story identity;
- resolves the package-bound Story Source inside the repository;
- compares raw text and raw SHA-256 to the immutable source snapshot; and
- re-derives and compares the normalized Story Source identity.

Matrix availability, order enforcement and product resolution reuse this one
boundary. The order freezes the full repo-relative Story Source path. Text
finalization accepts only the exact three-segment form
`story-bank/<bank>/<story>.md`; basename, traversal, non-Markdown and escaping
forms retain the legacy fallback rather than becoming new authority.

## Published authority

- Visual Package revision:
  `visual-packages/approved/revisions/a9c253d989118262ed2b38a671fc7eccf6af44a084512af35285ad2f548a14fb.visual-package.json`
- Current locator:
  `visual-packages/approved/chameleon_koko_bedtime.soft_hand_drawn_storybook.visual-package-current.json`
- Home Board registry:
  `set-identity-boards/chameleon_koko_bedtime/soft_hand_drawn_storybook/set_child_home_night/803dea01a0346579b0e38160cd683acfa09966daecf90d945389da4a3a67d172.json`
- Town Board registry:
  `set-identity-boards/chameleon_koko_bedtime/soft_hand_drawn_storybook/set_town_night/fd15ad19983952607f118282aa05d9e8f6931697453994ee4d8516ece78f7651.json`

Only those two approved Board registries are part of this milestone. Four
other local Board/recheck artifacts remain deliberately untracked.

## Provider-free proof

`scripts/run-published-wizard-low-page.ts` is dry by default. It requires an
exact current package, exact source, exact approved registry identities and
exact local Board bytes before it returns qualification evidence. Only the
explicit `--render-low` argument loads `OPENAI_API_KEY` and reaches the image
provider. It never publishes a package or changes a locator.

The dry run produced:

- package revision: `a9c253d989118262ed2b38a671fc7eccf6af44a084512af35285ad2f548a14fb`;
- source raw/frozen hash:
  `2d00d37e8aa290e5353bfe1b94fa2dc498d7200c46f6204bfe7903a033e685d4`;
- runtime authority: `style01-runtime-authority/v6`;
- runtime contract hash:
  `27c03ccb634eb8c1a68f2d81fc421bc7235982027d91e2fd0c0d2eda445e601a`;
- Home Board bytes:
  `7a782c72b86ceb07ba631def11d40b520b4753d97a63e8430a2fcb32180d7189`;
- Town Board bytes:
  `41580dfa9ea11a8dd5c6027ffd5cc5a46f5afe0bfc6eae62c047d00cd05a751e`;
- credential access: none;
- provider calls: zero.

With `ENABLE_WIZARD_QA_RENDER_CATALOG=false` and
`ENABLE_V3_APPROVED_BANK=false`, the Matrix reports Chameleon bedtime as the
single v4-qualified slot and the resolver returns the new autonomous source,
eight beats, 16 physical pages and ₪59.

## Browser proof

A local Next.js runtime was started with dummy local-only database/storage
configuration and both legacy Story flags off. In the actual Wizard UI:

1. `מעבר ושינוי` selected Chameleon/Kim.
2. Synthetic child Bar, age five, boy, no raw photo was used.
3. Realistic Illustrated and Mother voice were selected.
4. Only the eight-beat bedtime package was enabled.
5. The flow reached the final checkout summary showing 16 pages and ₪59.

No browser warning/error was observed. The payment action was not submitted;
there was no remote database, payment or Order mutation.

## One LOW page proof

After all provider-free checks passed, the same runner was invoked once with
`--render-low` for page 1 and an existing canonical child anchor.

- model: `gpt-image-2`;
- quality: LOW;
- provider calls: 1;
- retries: 0;
- fallback: false;
- visual-QA calls: 0;
- remote database/storage: false;
- output: 1024x1536, 2,940,407 bytes;
- image SHA-256:
  `439087aa931545a9cf9d3afabc9e8cf7bb7e9d062b23c355fc518a42eb9655a7`;
- prompt SHA-256:
  `5833b18fbf842e13f64ce7393a9cfbadc40c20c2faabebcda8cdc62fa38730ee`;
- evidence:
  `outputs/r1d-published-wizard-chameleon-page1-proof/render-evidence.json`.

The provider prompt includes the exact package revision, `set_town_night`,
the new walking-bus-stop source phenomenon, and all four ordered references:
child anchor, Kim sheet, approved Town Board and Style 01 reference. It does
not contain the old Chameleon story.

The rendered page is technically valid proof that the connected path reaches
the provider. It is not automatically product-approved: Kim acquired a small
satchel despite the natural/no-permanent-clothing authority. No retry and no
full-book spend were performed.

## Validation

- Focused runtime/selection suites: 9 files, 109 tests passed.
- `npx --no-install tsc --noEmit`: passed.
- `git diff --check`: passed.
- Literal `npm run check`:
  - TypeScript passed;
  - autonomous Story typecheck passed;
  - 3,415 ordinary tests passed;
  - 610/610 resource-intensive tests passed;
  - nonzero only for five established missing ignored-`outputs/` fixture
    assertions in four unchanged specs and three known Vitest worker
    `onTaskUpdate` RPC timeouts after the resource assertions completed.

## Boundaries

- No package revision was overwritten.
- No legacy Story Source was edited or relabeled.
- No full book was rendered.
- No payment, customer Order, remote database or remote Storage mutation was
  performed.
- No Vercel deployment or Production kill-switch was changed. The proof is
  local/preview runtime evidence; existing production quarantine/cutover work
  remains a separate operational boundary.

## Independent QA correction

Claude Code's first read-only pass verified every original handoff claim and
returned PASS with one pre-existing MINOR: the now load-bearing mutable current
locator validated required values but tolerated unknown keys. The corrective
milestone makes its exact five-key shape mandatory before loading the immutable
revision. A hostile locator carrying an additional key is rejected by both the
direct loader and the Wizard selection boundary. The locator version and valid
locator bytes are unchanged; no package, Story Source, Board, renderer,
provider, payment, deployment or production-switch behavior changes.
Corrective validation passes 9 adjacent files / 110 tests, TypeScript and
`git diff --check`.

Claude Code independently re-gated exact corrective range
`282182fcb2fbee70bab91f00d06cabef30a7240c..9329d4856770217b4bd01fb2110ad40ff4305644`
and returned PASS with no remaining finding. Its hostile probes verified all
missing/additional locator-key cases, rejection before immutable revision
loading, fail-closed Wizard selection, accepted key-order permutations, and
unchanged package/source/Board/sellability behavior. Its expanded suite passed
32 files / 990 tests; the only process noise was the established Vitest worker
RPC timeout after assertions completed.

Read-only remote inspection then verified that the exact HEAD Preview is READY
and returns Chameleon bedtime as selectable and production-render-qualified.
It also established the operational boundary: `qa.smallheroes.co.il` still
targets an older Preview, the current branch lacks the staging-QA middleware
scope, and Production remains on `ed1da86c…` while this feature branch is 557
commits ahead. No environment, alias, database, payment, provider or Production
mutation was performed during that inspection.

The next separately gated operation is documented in
`R1D_WIZARD_REMOTE_QA_FULL_BOOK_OPERATIONAL_PROOF_DECISION_GATE.md`: one
synthetic fake-paid LOW book on branch-scoped Preview authority, followed by
readiness and Reader verification. That gate is not Production launch
authority.
