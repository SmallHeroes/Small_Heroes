# Personal story product pilot — implementation evidence and QA targets

2026-09-30. Codex implements; Claude Code's independent review is pending. Guy
accepted planning/building, existing-key use and the resilience-led copy/design
direction. Neither that instruction nor this record grants release/product PASS.

## Frozen scope and topology

Branch `codex/personal-story-product`, isolated worktree
`C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes`.
Base `fd2b26bdd694e95fcea68393da97df35b2cf97d4`; the outgoing handoff supplies the
immutable committed head. This root task is the sole writer. No other implementation
thread was dispatched. The earlier GPT copy consultation was read-only and completed.

Checked `git worktree list --porcelain`, `git branch -vv` and relevant statuses.
Protected d53b is `768ccb2fe20edb1351cb4783796613cbf7a2993c`, wave-2 is
`63ccb4846ebe5be9ab392960d389610a1b2b9d42`, original prototype is `fd2b26bd`,
site integration is `713017e1890cc87c7eefab408481ac1ea592811d`: no working changes.
The prototype/site/protected roots are read-only for this milestone. The new branch
has no upstream; no push, merge or deployment was performed.

## Observed cause and implementation claims

The prior wizard's strict request validator was not a manuscript writer. Existing
legacy writers used direction-bound source/companion constraints, not this reviewed
personal profile. A direct call into them would lose the new request contract.

New server-only writer validates the reviewed request and offered length, resolves
canonical companion personality, sends approved fact IDs rather than transcripts
or photos, plans the whole adventure, then binds prose to the canonical plan digest.
No old topic-to-companion rule. Chosen-topic resilience is distinguished from a
fictional adventure without a chosen difficulty; proposed choice/help moments are
structurally checked, NOT semantically accepted by this validator.

Paid r2 exposed a metadata issue: an exact eight-element array had duplicated and
missing row numbers. Final provider schema removes that model-owned field; engine
numbering follows array order. It does not sort, rewrite prose or conceal a failed
plan. Final tests attack the real SDK request/schema and decoder with mocked SDK
responses, including exact length, identity, digest, old numbered outputs, usage
retention on failure and signal propagation. Final code was not re-proven live.

The API is local/default-off/operator-only, same-origin, body-limited, no-store and
noindex. Separate per-process writer reservations, no SDK retry/fallback, maximum
two calls/job. Failed reservations remain accounted. Restarting a process or invoking
the CLI again resets that ledger: it is NOT a durable run-family budget guarantee.

UI aborts/invalidate-on-edit and suppresses obsolete responses; unknown connection
outcome does not trigger automatic retry or promise zero spend. The complete result
envelope is validated before rendering. Memory-only draft: refresh loses it. No
order, database persistence, approved source, Blueprint, images or narration.

## Site/design and UX evidence

`/dev/personal-product` is a gated noindex preview, not the public homepage. Existing
purple/paper/yellow visual language, Suez/font/artwork/gallery/motion are preserved.
Revised hero, early profile/example section, concrete coping choices, optional-topic
copy, six named companions and three length-only cards. The example is hand-written
with synthetic facts and explicitly NOT a verified engine or full-book output.

Browser verification via the Codex in-app browser, live local server at
`http://127.0.0.1:3491`, paid writer/intake OFF, nonfunctional synthetic service
settings. No credentials/database records were used in this browser run.

- Desktop 1440x900: revised hero, early profile/story section and existing endpoint
  hero captions visually inspected; document scrollWidth 1432 <= innerWidth 1440.
- Mobile 390x844: hero readable, controls stacked; landing scrollWidth 382 <= 390;
  wizard scrollWidth 375 <= 390. One H1 and noindex/nofollow metadata.
- Dini card navigated to `?companion=dragon_dini`; selected Dini remained at step 2.
- Fixture-only flow: removed trampoline interest, continued without chosen topic,
  selected short; accepted request contains no trampoline and `intent:null`.
- Writing is disabled with an explicit local-pilot message when the writer is OFF;
  request acceptance did NOT dispatch provider calls.
- Long card navigated to `?length=long`; step 3 showed 32-page choice selected.
- Public `/` still shows existing name/gender moment, old copy and `/start` routing.
  Personal preview contains no `/start` links. No public pricing/cutover claim.

Screenshots outside Git: `C:/Users/guyna/.codex/visualizations/2026/09/04/01a06c5c-a233-76c0-ac8e-618c02ce6246/personal-product-desktop.jpg`
and `personal-product-mobile.jpg` in that same directory. Initial dev CSS-import/HMR
errors were repaired before these checks; retained console history includes them.
Optional auth cannot reach the deliberately nonfunctional local database, so no
blanket zero-console-errors/authentication-success claim is made.

## Test results (not an independent PASS)

- `npx tsc --noEmit`: exit 0, final separate run.
- `npx vitest run lib/personal-wizard lib/__tests__/vitest-workload-classifier.spec.ts`:
  exit 0, 14 files, 256/256 (personal suite 249 + classifier 7).
- Full `npm run check`: native exit 1. Both typechecks completed; ordinary 368 files,
  23 failures/4987 passed/73 skipped. Ten artifact/content failure signatures and
  thirteen 5s timeouts. Resource phase 20 files/635 tests passed BUT 3 unhandled
  `onTaskUpdate` RPC timeouts and native exit 1. Canonical inventory 388.
- Six specs responsible for ordinary timeouts rerun with `--maxWorkers 1`: 102/102,
  exit 0. Command targets audio-probe, runtime-world-authority,
  wizard-runtime-authority-preflight, openai-responses-blueprint-authoring-adapter,
  qa-wizard-blueprint-replacement-cli and story-source-revision-blueprint-migration.
- Full check preceded two compatibility comments and the final preview-only render
  identity guard/payment disclosure. It was not repeated after those last changes;
  focused/type checks were repeated. No timeout threshold changed.

No untouched-base full reproduction was performed. A passing isolated run does not
prove machine/load causality, permanent stability or that all full failures are
inherited. The initial full run's introduced inventory assertion was corrected by
explicitly including the three new specs (388 total, 368 ordinary, 20 resource).
Full repository gate remains RED.

## Paid text evidence, unchanged local roots

| Trial | Calls | Input/output tokens | Estimated USD | Reserved USD | Outcome |
| --- | ---: | --- | ---: | ---: | --- |
| `personal-manuscript-live-20260929` | 1 | 1226 / 3513 | 0.037582 | 0.4686 | plan coverage held |
| `personal-manuscript-live-20260929-r2` | 1 | 1328 / 3595 | 0.038606 | 0.4686 | plan coverage held |
| Total | 2 | | 0.076188 | 0.9372 | no manuscript |

Requested model `gpt-6-sol`; this is a caller setting, not provider attestation.
Token-based estimates use the verified price table, not an invoice or settled bill.
No images/audio, third trial or automatic retry. Both trials predate the final
numbering/resilience contract; neither proves its current live success.

All paths below are under the worktree's ignored, untracked `outputs/`. Stored only
locally here; no verified off-machine backup. A push does not preserve these files.

| File | SHA-256 |
| --- | --- |
| `personal-manuscript-live-20260929/receipt.json` | `db2126a23a9a6406608fdf9b10bbd36bf009008682e41fca4f0266281808f379` |
| `personal-manuscript-live-20260929-r2/receipt.json` | `92fc14a884b416c4a6ed7ee20a5df96317d8a5b05832b1bcef2f6e00544c8d69` |
| `personal-manuscript-live-20260929-r2/plan-provider-output.json` | `df9d6bb93733066ead38e1ec760ce0fdf615ad57f962cc6e221c6c7d96da81cd` |
| `personal-product-full-check-final.log` | `41336e36e22d6f021d09e964df4d201ed39782947b20e376101c156f58a0e355` |

Other local files: `personal-product-full-check.log` (earlier run),
`personal-product-focused-final.log`, `personal-product-focused-committable.log`
(latest 256/256 after the final UI guard), `personal-product-timeout-isolation.log`.
Future CLI captures are named `*-engine-output.json` because the adapter assigns
row metadata. The historical r2 provider-output filename/bytes were NOT migrated.
First trial raw plan is missing; its exact failure mechanism cannot be reconstructed.

## Adversarial review assignment

Read-only first pass, immutable base-to-head supplied in the outgoing brief. No
provider/key access, renders, source edits, commits, pushes or deployment.

1. Poison facts, options, identity, digest, length and resilience mode. Verify the
   second call never follows a rejected plan; raw transcript/photo/removed facts
   never enter the approved brief. Do not confuse prompt instruction with proof.
2. Attack actual SDK schema/decoder on 8/12/16 arrays and old duplicated numbering;
   verify model-authored content/order survive unchanged. Attack result envelope.
3. Exercise actual route auth, host/origin, flag/production, body and budget checks.
   Prove no retries/fallback, retained billed usage and failed reservations. Record
   per-process/restart/CLI limits instead of asserting a global spend fence.
4. Attack client edit/cancel/unmount/double-click and delayed result boundaries,
   including a response for another request and partial/malformed accounting.
5. Inspect every personal CTA/card/header/length link; prove no revival of legacy
   topic/genre constraints or public default regressions. Test mobile and keyboard.
6. Challenge copy against actual availability. Hand-written examples are not model
   evidence; resilience fields are not psychological or semantic QA acceptance.
7. Recompute receipts/log identity and protected topology. Keep full RED explicit.

Open beyond this milestone: successful bounded live manuscript, whole-story semantic
evaluation, durable recovery/spend, approved source/visual-plan bridge, image continuity,
narration/package, product acceptance, pricing/privacy and launch qualification.
