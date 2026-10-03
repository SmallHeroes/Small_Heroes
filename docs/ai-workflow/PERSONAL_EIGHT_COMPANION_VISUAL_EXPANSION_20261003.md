# Eight additional companion visual candidates

## Owner decision and execution scope

Guy accepted the Momo pilot visually and requested: "מעולה תמשיך לשאר החברים". This milestone continues its bounded two-view format for the remaining eight concepts: Tuk, Tuti, Shush, Pipa, Nula, Zohar, Yuli and Puf. Codex is the sole implementation writer in `personal-story-product` on `codex/personal-book-storyboard-bridge`, starting at `eef0475a`. Profile preparation agents are read-only.

The approved allowance is at most 16 built-in image generation calls: one front and one reference-bound alternate per character, with no automatic retries. This is not an API batch. No existing API key is read. The built-in tool does not expose a model, quality tier, token usage or invoice; those remain unknown, not LOW-attested or zero-cost.

## Observed state and recommended solution

The source describes nine new personalities, but the runtime registry and literary schema still admit only the existing six. Momo has two local candidate images, not a complete production sheet set. The remaining eight have no approved identity assets. Generating scenes or admitting placeholder IDs now would make identity drift harder to audit.

Create local candidates first, using the existing six and accepted Momo as style references only. Each alternate uses its own front as the identity reference. Preserve source personalities, specify anatomical limits, and record any visual choices the source leaves open. Do not present structural checks as visual accuracy or production acceptance.

## Narrow reversible visual choices

- Tuk: mustard ribbon centered near the front of the shell; freeze its placement and shell pattern from the front.
- Tuti: no accessory; two forepaws and two hind feet, distinct soft rounded spines.
- Shush: two wings and two feet, no human arms or teacher accessories.
- Pipa: one dusty pink neck ribbon; freeze knot placement from the front.
- Nula: exactly eight rounded arms, no human torso, hands or legs; lock suction-cup treatment from the front.
- Zohar: one visible pair of wings, six limbs and two antennae; steady light, never flashing.
- Yuli: omit the source's optional wristband in this candidate; long smooth tail, four limbs.
- Puf: exactly three main cloud lobes and two small side paws, no legs or shape changes.

These are candidate choices, not new runtime powers or irrevocable product decisions.

## Order of work and acceptance boundaries

1. Generate and inspect each front, then its alternate without a repair loop.
2. Save project-local copies, exact prompts, literary profiles, visual contracts, checksums and provenance receipts in a new output root. Preserve existing assets.
3. Produce a local gallery, run offline preservation and admission checks, and type-check before a focused documentation commit.
4. Give Claude Code an immutable read-only handoff. Guy chooses visual acceptance separately.

Reject full-set generation, live catalogue extension, website/carousel implementation and full book rendering in this milestone. There is no motion asset generation, push, deployment, paid text rerun or new API budget. Runtime eligibility remains false. Later work must complete and verify the required view set and companion assets before admission. Rollback is simply not promoting the local candidate root; no existing runtime path changes.

## Execution record

During execution Guy narrowed the product requirement: no aquatic animals, no insects, and no tiny companions that disappear beside the child. He explicitly requested replacing the flying insect and octopus. Penguin Pipa, octopus Nula, firefly Zohar and otter Yuli are excluded from the proposed selection; their already-created evidence stays archived rather than deleted. Tuk is a land tortoise, not a water turtle.

Fourteen tool calls had produced six pairs and two fronts. The Nula and Zohar alternates were stopped even before the new exclusion: Nula showed seven visible arm endpoints, and Zohar showed four wings instead of the proposed pair. Neither is accepted. Tuk's bow is at his neck, not the proposed shell edge; Tuti's spine tips are pointed, not the requested rounded tips. These are explicit open design differences, not concealed passes.

The two unused calls in the existing 16-call ceiling now produce replacement fronts only: `kangaroo_nula` and `dog_zohar`. These are new proposed identities inspired by the earlier personality ideas, not aliases or species edits to admitted runtime records. Kangaroo Nula has four limbs and one tail, not eight arms. Dog Zohar has four limbs and one tail, no glow or flight. No replacement alternate or retry is authorized in this execution.

Companions must be visibly substantial beside a child. A proposed size range is 0.65 to 0.9 of child standing height (Puf measured by cloud body, Tuk by shell/head extent); this is not a product-approved runtime constant or a measured property of isolated images. A shared-child scale comparison remains required. The existing six are not retrospectively changed.

## Saved result and technical observations

The bounded execution used exactly 16 built-in tool calls: fourteen original-concept images and two replacement fronts. There were no retries, replacement alternates, API-key reads, book renders or videos. All 16 project copies match their original tool PNGs and are 1024 by 1536. Cost, model and quality tier remain unknown.

Output root: `outputs/personal-eight-companion-candidates-20261003/`. It contains six pending literary profiles and visual specs, sixteen images including excluded evidence, the copied source brief, exact prompts, receipt, gallery, offline verifier and handoff. The local root is ignored by Git and has no verified remote backup; the documentation commit does not back up those media.

The proposed new identities are Tuk, Tuti, Shush, Puf, kangaroo Nula and dog Zohar, plus Momo from his unchanged prior root. Four proposed identities have two views; the two replacements have fronts only. Momo appearance acceptance does not qualify his complete sheet set. There are seven proposed additions, not nine: two additional land-animal concepts remain undefined.

Validation: offline verifier exit 0, 248 assertions; `npx tsc --noEmit` exit 0; existing `lib/personal-wizard/__tests__/companion-character.spec.ts` passes 36/36. All six new profile bodies match the current v3 field shape when excluding the ID enum, all six complete profiles are rejected by current admission, and all six existing companions still resolve. These checks establish structure and isolation, not story quality or image accuracy.

SHA/size verification covers 17 preserved files: the supplied source, six original front assets, and ten prior Momo packet files. The baseline was captured after generation and before packet closeout; it is not a reconstruction of pre-generation metadata. No prior evidence was edited. Gallery opening was queued by the app, not verified as a real-browser responsive audit.

Tuk's neck bow and Tuti's pointed spine tips remain design differences. The new dog has a fluffier tail than requested. Shush/Puf have no numeric resemblance or exact pattern-map validation. No candidate has a child-scale comparison, complete view set or animation asset. The proposed size range is not measured or adopted by runtime.

No independent technical or visual PASS is claimed. The full repository gate was not rerun and remains open/red from prior evidence. Four removed concepts are excluded, not selectable. Registry, personal wizard, landing, site QA and production source bytes are unchanged. No push or deployment occurred. The separate $12 text-calibration proposal remains untouched.

## Claude Code read-only handoff

Review the single documentation milestone starting at `eef0475a` and ending at its frozen local successor. The exact SHA and PowerShell commands are in the output root's `HANDOFF.md`, written after the commit. Do not expand earlier PASS boundaries or infer a product acceptance from candidate checks.

Please falsify: production bytes unchanged; no excluded ID in the proposed gallery cards or active candidate list; old animal IDs are not aliases of the two new ones; all new IDs still fail runtime admission; prompts bind each generated alternate to its own front; sixteen unique outputs/calls with no retries; every visual limitation is disclosed; unknown model/tier/cost never becomes an attestation or zero; preserved source/Momo assets unchanged. Review profile semantics and actual images separately from the offline assertions. No provider, key, render, edit, push or deployment on the first pass.
