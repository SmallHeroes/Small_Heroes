# R3-B1b Accepted-Intent Wave 2 Technical-Review Envelopes — Evidence

Date: 2026-09-04

Branch: `codex/r3b1b-accepted-intent-wave-2`

Base: `f5fc5fb365fffd00936cfeb20c0596e25bed165b`

Candidate batch:
`96154a39091b71c9dffb64dcf60b8667c149b78d4b4c0d5a07787189d00a7e9b`

Product decision:
`9b625e71318cf3a26117bc89744a1e39c04d13f6d74f632cddab4aaa639113e8`

## Outcome

Six canonical correction technical-review v2 envelopes were prepared together
under ignored `outputs/`. Each envelope transcribes Claude Code's real final
PASS for exact range
`0f1af28ce4ae8dc51a69d4f54d5b0138d1c2b398..d47fe4e9abaf1eb1ebc76d4e4d97918409840501`
with P0/P1/P2 `0/0/0`, then binds a different record-decision and future
revision digest.

The earlier preparation review of `417d0807..0f1af28c` returned HOLD with one
P1 and one P2. It is not relabeled as PASS. The exact correction re-gate closed
both findings and explicitly concluded that wave-2 preparation was passing on
everything tested. The later `f5fc5fb3` documentation closeout is not claimed
as part of Claude's reviewed range.

No Guy product-acceptance receipt or canonical publication was created. The
envelopes and their focused documentation correction have now passed
independent artifact QA, so the six exact revision digests return to Guy for
explicit confirmation or rejection.

## Exact envelope matrix

| ID | Story | Record-decision digest | Revision digest | Technical-review digest |
| --- | --- | --- | --- | --- |
| P2 | `bunny_ometz_adventure` | `76758ca32c7fcef53763f5a6d7af4bb79b03d9eadc8fa0744d5cbb5f35271759` | `9b8c28ad8eeac4ee193c561573fd02fb5a3d62f053aa52cca24e94dc498948bd` | `4dd6ae5bb0020f08f0bba7d97904c466007bb5a1490f9fc7d1d579e8df734345` |
| P3 | `bunny_ometz_fantasy` | `3d66afe065625fd314259c95d79b502a5fe50b5c28a2407b07bba04cf2910216` | `432f555fded7efd5b17c224543ac7979afe16977e27dbab77c0c358941e1ff0e` | `23ff6887e07c22752949d34e5acf3456025c4c759a815881b6cb5547571c9509` |
| P4 | `chameleon_koko_adventure` | `3ab8692de07c9c81cc137febea72f48f1194bba58ea63de8853de293d0163bc8` | `5f57f2591e2301d8908f383a16bd62912aebeddb69bcf0f29157e21c60acbdf5` | `b86b84a5b54b9f3fb1c185401b7b8c965f0a096e22e78d9684423ae7925458e4` |
| P5 | `fox_uri_bedtime` | `4a329b88904c04ccf9e31efc5193fb3d50625503a7911ce2ece18dc457a3dc53` | `92cc7fe154485da7360907b750fcaf5bfd01d1027f8e59575435a27dccd6198a` | `2fb4fd44aad26cf55e2cd0b2562b3c6d98163a1ee4857668ef58570911da7833` |
| P7 | `lion_shaket_fantasy` | `47902fb7999068f1f6f3bee8cb00f8bdfb84f33521c10ca3b6920e2067d11a7e` | `394841c3d4559cc03b1900ad2a8e72309427a427821cfed10b4bdb627cee42d6` | `f896d94cf00024d4d91fc29785bfa6427010a605f13e6d56fca34794699af064` |
| P8 | `panda_anat_bedtime` | `1671d87848d067d792973601e5b82522734515d1315b3f903cb6e4baded545df` | `e304e877507f6f05ec2277fa2250fddfc99bbeb4aa3af98bc3916e3cb6a9d8ea` | `370392c9d13eccdf0a48cea23bdc7b6679d6a03de90b4f63465807779c3d3882` |

Each file is named `<technical-review-digest>.json` beneath:

`outputs/r3b1b-accepted-intent-wave-2/technical-reviews/`

## Envelope contract

Every envelope has exactly the correction technical-review v2 fields and:

- `version: small-heroes-story-source-visual-direction-correction-technical-review/v2`;
- `status: pass` and `reviewer: Claude Code`;
- exact `baseCommit: 0f1af28c...` and `headCommit: d47fe4e9...`;
- `p0: 0`, `p1: 0`, `p2: 0`;
- exact common candidate-batch and product-decision digests; and
- fresh per-record `recordDecisionDigest` and `revisionDigest` from lifecycle
  `inspect`.

The digest is the canonical JSON SHA-256 of the payload without `digest`. The
six review digests and six revision digests are each unique.

## Validation evidence

A fresh six-record audit re-ran lifecycle `inspect`, rebuilt every expected
envelope with the exported digest kernel, and compared the stored file to the
expected canonical bytes. Result:

- entries: 6;
- unique technical-review digests: 6;
- unique revision digests: 6;
- canonical bytes: 6/6 true;
- canonical payload equality: 6/6 true;
- regular files: 6/6 true;
- hardlink count: 1 for all six.

Focused validation:

```powershell
npx vitest run lib/visual-package/__tests__/story-source-visual-direction-correction-batch.spec.ts lib/__tests__/story-source-visual-direction-correction-acceptance-lifecycle.spec.ts --maxWorkers=1 --no-file-parallelism --reporter=basic
npx tsc --noEmit
npm run story:autonomous-typecheck
git diff --check
```

Observed: **2/2 files and 20/20 tests PASS** in 44.19 seconds; both TypeScript
checks exit 0. The deprecated `basic` reporter emitted a warning but did not
change the exit/result. The literal repository-wide `npm run check` was not run
for this no-code operational milestone; no repository-wide green claim is made.

The real read-only readiness audit also exited 0 with semantic digest
`39819a34f01385e1aa6ea11307e788aaeaefa3e4cdf451e3753796c481faad4a`:
18 nominal slots, 17 environment-product-sellable, 2 accepted-source lineages,
1 render-qualified, 10 soft TTS items across 5 stories, and every audit effect
counter zero.

## Independent artifact QA

Claude Code reviewed exact range
`f5fc5fb365fffd00936cfeb20c0596e25bed165b..d2e7392d10620bb4d78f9ffb7fd8de87346fcabf`
read-only and returned **PASS with no P0/P1 and one P2**. It independently
reproduced all six stored 792-byte envelopes, their exact schema/range/counts,
common and per-record identities, canonical digests, filenames, regular-file
and single-link inventory, 20/20 focused tests, both typechecks, the readiness
digest/state and zero effects. It found no envelope or lifecycle defect.

The P2 was a repeated unqualified `Guy pushed` attribution in `CURRENT.md`.
That sentence now states separately that Guy reported the push and Git verified
the exact parity.

Claude Code independently re-gated exact correction range
`d2e7392d10620bb4d78f9ffb7fd8de87346fcabf..eee1356e3e5a40bfccce4027eb90c8e356a9f85b`
read-only and returned **PASS with no P0/P1/P2**. It confirmed the exact
four-document scope, closed the prior attribution P2, and verified that all six
envelopes remain byte-identical. The envelope milestone is technically passed
on everything tested.

## Effects and exclusions

No accepted-source revision, product-acceptance receipt, package, locator,
runtime flag or production/test code changed. Provider/network calls 0;
image/audio/PDF renders 0; database/storage/order/payment/deployment writes 0;
spend USD 0. Wizard sellability remains 17/18. Publishing all six without
exact-source packages remains unapproved and is still expected to reduce the
catalog to 11/18. The resemblance threshold remains 0.70.

The wave's 10 soft narration items for `שם`, across four wave stories, remain
open under the separate pronunciation/human-ear gate. This differs from the
current canonical-readiness count of 10 soft items across five stories because
the two statements describe different source sets. P6 and all HOLD/D records
remain excluded.

## Next gate

Guy must explicitly confirm or reject each exact revision digest and choose
publication/package sequencing. No product acceptance or publication may be
inferred from these review files.
