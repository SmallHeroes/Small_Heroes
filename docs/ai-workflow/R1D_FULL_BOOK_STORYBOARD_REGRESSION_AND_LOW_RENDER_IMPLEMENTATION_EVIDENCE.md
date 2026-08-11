# R1D-FULL-BOOK-STORYBOARD-REGRESSION-AND-LOW-RENDER - implementation evidence

Status: local implementation and twelve-page LOW measurement complete; independent Claude Code technical-record QA closed; product/visual acceptance pending; production blocked.

## Authority and scope

- Base: `21e501794ea7931c8bdd73366056ad0a9bf9eb3a`
- Branch: `codex/r1d-full-book-storyboard-regression-low-render`
- Worktree: `C:\Users\guyna\.codex\worktrees\fullbookaudit1\Small_Heroes`
- Story Source: `story-bank/v3-approved/fox_uri_adventure.md`
- Story Source SHA-256: `02629e886a9aaa1e714d9a8d652c24d94ca5843465ff8a9cb70d320a24e2231c`
- Book Shot Plan: `story-bank/v3-approved/fox_uri_adventure.shot-plan.json`
- Shot-plan SHA-256: `200085ffb3e68203ee410e0f869a74b2809292a2506c5eabe0b24e0c2f1c30ed`
- Guy explicitly authorized one local LOW render of all twelve interior story pages. The cover, HIGH quality, Vision, remote storage/database, Board, approval, publication, production activation and deployment were excluded.

## Root cause

The approved shot plan already carried twelve page-specific shot decisions. The prior local three-page runner did not project them into the Blueprint. It assigned pages 10-12 the same cast positions, bucket placement, vertical drop path, eye-level camera family and generic narrative. Because the runtime correctly treats the Blueprint as composition authority, the provider received near-identical composition contracts. The observed repetition was therefore a measurement-authority regression, not an absent storyboard.

## General correction

`lib/generation-pipeline/blueprint-storyboard-diversity.ts` introduces `blueprint-storyboard-projection/v1`:

- maps canonical shot and angle vocabulary to typed Blueprint camera authority;
- projects deterministic child, companion and focal regions per page;
- applies deterministic bounded page nudges so adjacent pages cannot collapse to one signature;
- uniformly scales composition regions by `0.75` into the normalized body illustration space so they stay above the required bottom text-safe band;
- rejects adjacent identity and insufficient shot/angle/rhythm vocabulary.

`scripts/run-r1d-wizard-low-full-book-measurement.ts` consumes the real Story Source, approved Visual Contract and shot plan and passes the actual Visual Package, Blueprint, runtime-binding and Wizard qualification validators. Its twelve-page Visual Package/Blueprint is assembled from `buildVisualPackageV4Fixture` plus measurement-only placements in `mutateWorld`, and the contract receives `local-qa-causal-overlay/v2`. It does **not** execute the production authoring/chunk-runner path. The result proves Story Source and storyboard connectivity at the qualification boundary, not production-path authoring. Pages 10-12 derive their typed falling-water action path and destination from that page's actual bucket placement. The runner has no retry, fallback or Vision branch and clears credential authority in `finally`.

## Zero-cost authority and qualification

Successful qualification root:

`outputs/r1d-full-book-storyboard-low-20260811-attempt-6`

The dry-run proved:

- twelve pages and twelve non-identical camera-plus-placement signatures. The validator proves identity non-equality, not perceptual diversity: some pages reuse a layout family and differ only through bounded single-digit coordinate nudges;
- `visual-package/v5` revision `c173d0922326df0e29d275b1cee20d7c76170744e9e75fc89a1fd769ff63f1b5`;
- `pre-render-book-visual-blueprint/v4` digest `5609cadef3a998b4538c2bd1f32714f61f79a9e2acfa2054617b3603eecbbb17`;
- `style01-runtime-authority/v6` runtime contract hash `d9b58021c0fcff20b48df7084844d5538d4dbbbe5328bb34ed75456463df04a9`;
- Wizard `renderQualified: true`;
- no credential access and zero provider calls during qualification.

Earlier local qualification failures were corrected before spend: action/safety/traversal affordance completeness, transition-opening semantics, and preserving the exact Visual Package body text-safe policy by fitting illustration placements above it. No production policy or schema was weakened.

## Full-book LOW measurement

Output root:

`outputs/r1d-full-book-storyboard-low-20260811-render-1`

Evidence files:

- `authority-evidence.json`
- `storyboard-dry-run-evidence.json`
- `render-evidence-full-book.json`
- `contact-sheet-12-pages.png`

Observed execution:

- pages: `1..12`, sequential;
- model/quality/size: `gpt-image-2`, LOW, `1024x1536`;
- provider calls: `12`;
- transport retries: literal structural attestation `0`;
- fallback used: literal structural attestation `false`;
- Visual QA provider calls: literal structural attestation `0`;
- remote database access: `false`;
- remote storage access: `false`;
- production blocked: `true`;
- usage per image: input `8`, output `158`, total `166` tokens;
- estimated cost: `null` because local pricing rates were not configured. This is not a provider billing or account audit.

Every page persisted a different image SHA-256:

| Page | SHA-256 |
| --- | --- |
| 1 | `b4ebc59731b08c52850b5d7fc7322f3138f6288696f2811c0b4fe059c18973e4` |
| 2 | `24c0d178d0030cbbca678f11993860959b631b361b06b7baa0ec7ec0ff30552e` |
| 3 | `995304b42c31dbc269048d7ec798d0efd8d73886dafa4f2a0f08971ea9fb6ef1` |
| 4 | `4b05807edc5fb8991684280dce03ae6f89fb822eb7d98433111009fad05e6618` |
| 5 | `a4377a11fd9bcf0c1f4b88ae7973b6dc07cf96f318d55cfc7fa4c533d1b70561` |
| 6 | `c3c0fb3f87b59f365ad1006959617c0509600c839cdd8d801f16c15ec779d6e3` |
| 7 | `a15d42903dd932a641fff403206a92391d02278e8e4aebdb4611013a8d4aa73f` |
| 8 | `1a571f50c0d2a661bf79495f0a0cfda58d76063df94d88bab5e21da0b730d658` |
| 9 | `cb94cec8bb6937353e5475ea941a8ca5d45564d381544b119b029e91baaf0997` |
| 10 | `f329e38d95b5c60a795abb7fbb3bf6e8a51ecb51c675d5eee6516050f3af36e0` |
| 11 | `7fd5814a5be3931124f42e1d3354b2f96530869f401365618bd29f75a712e585` |
| 12 | `7fad99ca7a7dee3e1a04f01911e51a20be2e36cb98e71f2d18ab5dfddc244b1e` |

## Visual audit

Material progress is visible and the prior same-image regression is falsified:

1. Page 1 uses a wide establishing/listening frame.
2. Page 2 moves to an intimate threshold frame; the child is too cartoon-like.
3. Page 3 changes to a playful dynamic frame; the imaginary notebook reads too much like a physical glowing prop.
4. Page 4 uses a railing-height tap composition.
5. Page 5 provides a wider flashlight/bucket reveal and correct destination geometry.
6. Page 6 moves to a low bucket-rim close-up; child and fox remain overly cute.
7. Page 7 makes droplet/fingertip/bucket causal geometry legible, but begins a repetitive setup run.
8. Page 8 gives a wider quiet listening break.
9. Page 9 emphasizes bucket movement, but returns to the same child-fox-bucket triangle.
10. Page 10 correctly lands the drip inside the bucket and reads the sound rhythm, but staging remains familiar.
11. Page 11 carries the calm beside-the-bucket beat, with insufficiently distinct staging.
12. Page 12 widens into a readable resolution.

The book is useful measurement evidence, not production art. Remaining visible defects are child realism/anatomy, mascot-like fox rendering, child/fox continuity drift, repeated slippers/background clutter, and insufficient second-half environment/camera separation. No Vision service was used; this judgment comes from direct local inspection of all twelve images and the contact sheet.

## Independent Claude Code first pass

Claude Code audited exact pushed range `21e501794ea7931c8bdd73366056ad0a9bf9eb3a..e01cfde83410ae33ea8fbec064c8751cbf58852a` read-only. It verified HEAD/origin `0/0`, the exact seven-file range, ignored output status, all twelve image hashes/dimensions/byte counts, usage records, qualification facts, causal geometry and the visual-audit limitations. It returned technical/artifact PASS with zero BLOCKER and identified one MAJOR disclosure gap plus two MINOR disclosure limits:

1. The original record did not state that Visual Package/Blueprint assembly uses a repository test fixture and measurement-only overlay, so its connectivity claim could be overread as production authoring-path proof.
2. Twelve non-identical signatures are partly achieved through single-digit deterministic nudges within repeated layout families, a weaker guarantee than materially different composition.
3. The zero retry/fallback/Visual-QA counts are structural literal attestations rather than separately measured provider telemetry.

This correction records those limits without changing code, artifacts or product claims. Claude Code then micro-re-gated exact correction range `e01cfde83410ae33ea8fbec064c8751cbf58852a..3a69832673c7b24cf6320c6b1170c2ccac216c88` and returned **PASS**, closing the MAJOR and both MINOR disclosure findings with no new findings and two advisory notes only. This is Claude's closure, not a Codex self-awarded result.

## Validation

- `npm ci --offline --ignore-scripts`: PASS.
- local deterministic Prisma generation: PASS.
- storyboard projection: `1 file / 3 tests` PASS.
- Wizard qualification: `1 file / 1 test` PASS.
- workload classifier after inventory correction: `1 file / 7 tests` PASS.
- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.

The literal `npm run check` ran once and was not rerun. TypeScript and all nineteen resource-intensive files passed with valid diagnostics and no timeout/RPC/IPC/reporter/launch/signal/teardown class. The ordinary phase contained the six established missing ignored-output fixture failures plus one stale inventory assertion caused by the new storyboard spec (`290/271` expected versus `291/272` actual). Only those two mechanical counts were updated, and the focused classifier passed 7/7. The six fixtures remain a separate repository/release HOLD and are not waived for production.

## Rollback and authority limits

Rollback is a focused revert of this milestone's commits plus deletion of only the ignored local output/qualification roots. Historical authorities and earlier images are not rewritten. Production remains blocked. This work grants no publication, approval, deployment, release, remote storage/database or full-book production-render authority. Independent technical-record QA is closed; Guy retains product/visual acceptance.
