# R1D-PVB-D1A1B1 Post Stable Prop Repair Live Attempts 2–3 — Execution Evidence

## Shared authority boundary

- Branch/head/upstream: `codex/r1d-pvb-d1a1b1-stable-prop-scope-compact-repair` at `c3c0937d15eef84a26caa22735f809031ce10012`, clean and `0/0` at both attempts.
- Model/endpoint/tier: `gpt-5.6-sol`, Responses, `default`.
- Per-attempt policy: one initial call plus at most two repairs, transport retries `0`, fallback `false`, conservative ceiling `$4.884`, hard ceiling `$5.00`.
- Production, storage/database, publication, deployment, approval, Blueprint, Wizard, and render authority were absent.

Both attempts used a new content-addressed Fresh Readiness root, exactly one canonical preflight, exactly one Supervisor verify, and exactly one Supervisor live invocation. Credential access occurred only in the live child, ambient inheritance was false, credential authority was cleared, and stdout/stderr were suppressed. No raw prompt, provider response, provider message, stack, or secret was persisted.

## Attempt 2

- Output root: `outputs/r1d-pvb-d1a1b1-post-stable-prop-scope-repair-fresh-readiness-attempt-2-20260810T143500Z`.
- Fresh Readiness v15: `8232729224933084877d3c6b5efeeb410d72ddf11ad2510077b279168e618988`.
- Execution Request v15: `fc3bc0141a6050bd372d73f66c6f436a923aba2eb13e7a336f52d07fda74411a`.
- B0 manifest/verifier v16: `7949139c5353d82f3cffe4692d4bcec6ee3948621713c3a91d5b8ebd91c3eef6`.
- Supervisor verify readiness: `be0991fd96c64e59b05626af8603b49dadc38d8f7dffb79ab9ad874ca9a73e82`.

The provider completed all three logical calls. Attempt 1 emitted six page-spatial `out_of_scope_reference` issues. `page_spatial_reference_patch` resolved all six. Validation then emitted two `closed_catalog_capability_gap` issues on pages 2 and 8. `presentation_requirement_patch` resolved both. Complete validation then emitted exactly twelve `final_structural_invariant_invalid` page locators, one for every page 1–12. With the bounded repair budget consumed, the attempt stopped as `draft_validation_budget_exhausted / draft_validation_repair_exhausted`.

- Calls/repairs/retries/fallback: `3 / 2 / 0 / false`.
- Aggregate usage: input `21,053`; cache-write input `2,932`; cached input `17,399`; output `20,233`; reasoning `3,197`; total `41,286`.
- Nominal/conservative accounting: `$0.637625 / $0.812430`.
- Receipt v21: `f4bb6a7dba0921a06875a0b63091f61a638b09ad8a23daa3f7ba239357ad16f3`.
- Readiness v19: `76cbaeb4a7157ab0d47789b10c98e63fa0aceeca8472450f7d0b7dca0eefd027`.

## Attempt 3

- Output root: `outputs/r1d-pvb-d1a1b1-post-stable-prop-scope-repair-fresh-readiness-attempt-3-20260810T144731344Z`.
- Git probe: `5786b4c228beeedca597fa57a704a2d0df55d72a504cc705072f9b5def95105d`.
- Fresh Readiness v15: `4f480ec7881907930b6c73113934aa0a765ea412fb00fc08cd1eab7d09c093bc`.
- Execution Request v15: `aac8365ea9a6b379d4926ae983d83d14600028260cf9d8c4218c17b6413b4a35`.
- B0 manifest/verifier v16: `dc2f2c9dad3bc7a702a75989b0d768cb03cd4d396e759935d79e7e8a27958d8e`.
- Supervisor verify/live readiness: `44386b2f020c83a5817adf96d9bc69623c4a000c573ac2524fa033b9f21a9cee` / `af97bbab50c540b9f573bd8d7afeb7a584eaefbc3c896a751b5431c8f5a08847`.

The single live invocation ended after `370.4` seconds. The provider completed all three calls. The initial response emitted one page-8 `closed_catalog_capability_gap`. `presentation_requirement_patch` resolved it in the second call. Complete validation then emitted exactly twelve `final_structural_invariant_invalid` page locators. The third call used the existing compact `page_contract_patch`, returned a completed response, and left all twelve page identities persistent. The attempt stopped as `draft_validation_budget_exhausted / draft_validation_repair_exhausted`.

- Calls/repairs/retries/fallback: `3 / 2 / 0 / false`.
- Aggregate usage: input `29,015`; cache-write input `11,112`; cached input `17,399`; output `27,108`; reasoning `4,042`; total `56,123`.
- Nominal/conservative accounting: `$0.893910 / $1.094043`.
- Receipt v21: `99c73ef6311691ae7b9be8ed40084efae1bc8994eacb386054d650e3f31ad2d4`.
- Readiness v19: `0a11cc6fc4a7747d162a7f2ba7be5f887a0e7e17097c511db01cb96fb366ee2d`.

## Root cause and continuation

The failures are not provider transport failures, schema-compatibility failures, or missing repair routing. The compact page repair received the correct twelve-page authority and stayed inside the unchanged input ceiling, but its provider input contained only the coarse typed code `final_structural_invariant_invalid`. The deterministic validator's exact page-local messages were available in memory but omitted from the page repair payload. The provider therefore had no invariant-specific repair instruction and returned pages that remained invalid.

Neither attempt produced a Visual Contract candidate. Semantic Reconciliation is absent, Blueprint readiness is false, D1A1 is unauthorized, and no Wizard or render action occurred. Both readiness authorities are consumed. The next milestone is the general page-repair validation-hints correction defined in the adjacent Decision Gate; no rerun against these authorities is permitted. Production remains blocked.
