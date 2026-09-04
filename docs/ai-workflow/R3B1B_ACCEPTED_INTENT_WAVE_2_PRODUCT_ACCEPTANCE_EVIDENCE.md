# R3-B1b Accepted-Intent Wave 2 Product-Acceptance Receipts — Evidence

Date: 2026-09-04

Branch: `codex/r3b1b-accepted-intent-wave-2`

Base: `8d05973054c9ddda54241a2b51b75800f2fdea24`

Candidate batch:
`96154a39091b71c9dffb64dcf60b8667c149b78d4b4c0d5a07787189d00a7e9b`

Product decision:
`9b625e71318cf3a26117bc89744a1e39c04d13f6d74f632cddab4aaa639113e8`

## Approval and outcome

Guy explicitly confirmed all six final revision digests for P2-P5/P7/P8 and
authorized creation of their product-acceptance receipts. He approved only the
preparation of a staged rollout Decision Gate and explicitly withheld canonical
publication, package implementation, render, narration, deployment and paid
work.

Six tracked correction product-acceptance v2 receipts were created. They bind
Guy, the exact candidate/product/record/revision identities, each independently
passed technical-review envelope, the accepted world mode, the limited
`story_source_and_visual_directions_only` authority scope, false runtime
eligibility and the full downstream exclusion list.

No accepted revision or publication candidate was written. The current
accepted tree and Wizard 17/18 state remain unchanged.

## Exact receipt matrix

| ID | Story | Revision digest | Technical-review digest | Product-acceptance digest | Dry-run manifest digest |
| --- | --- | --- | --- | --- | --- |
| P2 | `bunny_ometz_adventure` | `9b8c28ad8eeac4ee193c561573fd02fb5a3d62f053aa52cca24e94dc498948bd` | `4dd6ae5bb0020f08f0bba7d97904c466007bb5a1490f9fc7d1d579e8df734345` | `48354b591726c453915748b08d0d1f1cd1d4c16175be1e8dcb5801a056bb5eb2` | `7fde952807493c9782e68093b485c5b976f2789a33ae76a0e85ccef1b4df5455` |
| P3 | `bunny_ometz_fantasy` | `432f555fded7efd5b17c224543ac7979afe16977e27dbab77c0c358941e1ff0e` | `23ff6887e07c22752949d34e5acf3456025c4c759a815881b6cb5547571c9509` | `b14ea13f00b52368411a2559458300f777271487688388de76ca25e394be3a8b` | `b0eeea328296f708830e566d35f631fae1e8dd7efc253d4e2f58349228069a99` |
| P4 | `chameleon_koko_adventure` | `5f57f2591e2301d8908f383a16bd62912aebeddb69bcf0f29157e21c60acbdf5` | `b86b84a5b54b9f3fb1c185401b7b8c965f0a096e22e78d9684423ae7925458e4` | `bfdd96e77d0c90062155de0c2d08b88246e23e93932b804711596a1c0f9b0309` | `1c3d1dfb805427adb5c5902019432f6701f05588c0e7ae1a761f36bd70969962` |
| P5 | `fox_uri_bedtime` | `92cc7fe154485da7360907b750fcaf5bfd01d1027f8e59575435a27dccd6198a` | `2fb4fd44aad26cf55e2cd0b2562b3c6d98163a1ee4857668ef58570911da7833` | `01dc3fa3fc2e59274c6e290f770d757e16968542398d439fd1bf828bf18478c6` | `d35313f87efc92f5c8f4dfb978cff880cbb793d6f774afc1f631bd65b3187332` |
| P7 | `lion_shaket_fantasy` | `394841c3d4559cc03b1900ad2a8e72309427a427821cfed10b4bdb627cee42d6` | `f896d94cf00024d4d91fc29785bfa6427010a605f13e6d56fca34794699af064` | `28d3d849b7616f9c44209b2f655f5202cf73a37186de2accdd626d56847a98ba` | `76570ef4c420b23afb1852647492957bcef0220d96339346de38f2c38a243e46` |
| P8 | `panda_anat_bedtime` | `e304e877507f6f05ec2277fa2250fddfc99bbeb4aa3af98bc3916e3cb6a9d8ea` | `370392c9d13eccdf0a48cea23bdc7b6679d6a03de90b4f63465807779c3d3882` | `20f5b8f039ef545ffafead5f3c1bb65a49456a54a60a1e8245e98344961d8a25` | `5b5d96f93f23e9022a6b9cc033d4f777f179e1693bfe14299d38775416d95520` |

Every receipt is stored as:

`story-pipeline/04_approved_story_sources/approvals/r3b1b-<story>-product-acceptance-<digest>.json`

## Canonical and lifecycle verification

A fresh read-only six-record audit:

- recomputed every receipt through the exported canonical digest kernel;
- verified digest equals filename for 6/6;
- verified stored bytes equal canonical bytes for 6/6;
- re-ran correction lifecycle `inspect` for every exact pending manifest;
- loaded the matching 792-byte technical-review envelope;
- ran `prepare --write false` twice per story;
- obtained the same publication manifest digest on both dry-runs for 6/6;
- returned `created:false` for every preview;
- observed all ten external counters at zero for every record; and
- confirmed the configured output root does not exist after the audit.

The receipt files themselves are the only new approval authority. A receipt is
not an accepted-source publication, package, locator, Wizard switch or render
authorization.

## Focused validation

```powershell
npx vitest run lib/visual-package/__tests__/story-source-visual-direction-correction-batch.spec.ts lib/__tests__/story-source-visual-direction-correction-acceptance-lifecycle.spec.ts --maxWorkers=1 --no-file-parallelism
npx tsc --noEmit
npm run story:autonomous-typecheck
git diff --check
```

Observed focused result: **2/2 files and 20/20 tests PASS** in 45.65 seconds.
`npx tsc --noEmit`, `npm run story:autonomous-typecheck` and `git diff --check`
all exit 0.

The real read-only readiness audit also exits 0 with unchanged semantic digest
`39819a34f01385e1aa6ea11307e788aaeaefa3e4cdf451e3753796c481faad4a`:
18 nominal slots, 17 environment-product-sellable, two accepted-source
lineages, one render-qualified story, 10 soft TTS items across five current
catalog stories and every effect counter zero. This independently confirms
that receipt creation did not publish the six sources or change catalog state.

The repository-wide `npm run check` is not yet represented as green and must
not be inferred from this focused result.

## Effects and exclusions

Provider/network calls 0; image/audio/PDF renders 0; database/storage/order/
payment/deployment writes 0; spend USD 0. No path beneath the accepted revision
tree or `visual-packages/` changed. The resemblance threshold remains 0.70.

P6, all HOLD/D records, the 10 wave soft narration items, P1 package authority,
canonical source publication and package rollout remain separate gates.

## Prepared rollout gate

`R3B1B_STAGED_SOURCE_PACKAGE_ROLLOUT_DECISION_GATE.md` records the approved
sequence intent and the remaining stops. It requires P1 package recovery and a
verified 18/18 catalog before P2, then one source/package milestone at a time.
It grants no package implementation, publication, provider call or spend.

## Next gate

Claude Code independently reviews this receipt milestone read-only. After PASS,
Guy receives the P1 zero-cost package-prerequisite inventory and exact proposed
budget for a separate implementation decision. No downstream authority follows
from the six receipts alone.
