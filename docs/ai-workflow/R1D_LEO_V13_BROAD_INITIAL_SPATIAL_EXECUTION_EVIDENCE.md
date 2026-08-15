# R1D Leo v13 — Consumed Authoring Execution Evidence

## Scope and topology

- Pushed immutable HEAD during execution:
  `6156bf70c4943a9ee367e69a25329dd1d46ff6b3`.
- Branch: `codex/r1d-compound-page-authority-compact-routing` at exact
  same-name upstream parity and a clean worktree.
- Output root:
  `outputs/r1d-leo-v13-compound-page-authority-compact-routing`.
- Story Source: `lion_shaket_adventure`; no story-specific code or repair rule
  was introduced by the attempt.

## Canonical preparation

- Git probe: PASS, digest
  `dde45a98a3da486aa1ad7c53219e68de27b6c27e92758f58655bd86acceb2a80`.
- Fresh Readiness v15 prepare and verify: PASS, digest
  `d3bbee5000584f41d752a55cac5277df432cb07da4255070b648c76412ab83dd`.
- B0 authoring request digest:
  `74c19e0390ab45adbd17bd859951db3021239ff9a5e1739df542c79206e729f1`.
- B0 manifest digest:
  `1886e7a99f9af913ac59d5920bdd803107265e387686d5caf7903bccc8e7e92e`.
- Execution Request digest:
  `47466581ff84db21a00436650a763dc007c59efedaca3ac19ad93c89fe8ab443`.
- Supervisor verify readiness digest:
  `c90125062e4621842fdae86fbbea87d63fed21567a3823436a84d1e75e75e2ad`.
- Exactly one canonical preflight and one Supervisor verify passed before the
  one live invocation.

The credential source was used only inside the Supervisor child. Ambient
inheritance was false, credential authority was cleared, and raw stdout/stderr
was suppressed. No secret, raw prompt, raw response, provider message or stack
is stored in this record.

## Canonical authoring result

- Receipt: `visual-contract-authoring-receipt/v21`, digest
  `6aedf6f513bb3ff1ca8d2baf58ec8faf7017dae63bc6bed13d7232e8d5068344`.
- Readiness: `visual-contract-authoring-readiness/v19`, digest
  `ac182c7e0e1856c90b0ac4ee38e9a44fe03f7363acde004966b36114127a9424`.
- Calls / repairs / transport retries / fallback: `3 / 2 / 0 / false`.
- Provider, model, endpoint and tier: OpenAI, `gpt-5.6-sol`, Responses API,
  `default`.
- Aggregate usage: input `37,883`; cache-write `37,874`; cached `0`; output
  `49,117`; reasoning `5,858`; total `87,000`.
- Nominal cost: `$1.710267`; conservative accounted cost: `$1.881307`;
  projected maximum `$4.884`; hard ceiling `$5.00`.

Attempt trail:

1. Initial response completed. It emitted 24 current-unique
   `out_of_scope_reference` page-action issues across pages 1, 3, 4, 5, 6, 8,
   9, 10, 11 and 12. The next mode was
   `page_spatial_reference_patch`.
2. The compact spatial repair completed and resolved all 24 prior issues.
   Complete validation then emitted 21 current-unique issues: eight
   `closed_catalog_capability_gap` identities, one cover final-structure
   identity and twelve page final-structure identities. The next mode was
   `full_draft`.
3. The full-draft repair completed and resolved all 21 prior issues. It left
   one new page-3 `action_binding_cardinality_invalid` identity at page-action
   index 1. The unchanged repair budget was exhausted.

Terminal classification is
`draft_validation_repair_exhausted / draft_validation /
draft_validation_budget_exhausted / budget_exhausted /
draft_validation_budget_consumed`. The sanitized receipt diagnostic count is
97 and its broad diagnostic code is `draft_contract_validation_failed`.

## Downstream absence and interpretation

The output root contains exactly ten canonical files. Candidate and
Reconciliation digests are null; `blueprintAuthoringReady:false` and
`d1a1Authorized:false`. No Semantic Reconciliation, human approval, Blueprint,
Visual Package, Wizard qualification, page selection, image/Vision, render,
storage/database, publication, promotion or deployment occurred.

This attempt is consumed and cannot be replayed. Its evidence proves that the
field-scoped repair worked and that the final full-draft repair came one call
too late for the remaining page-local issue. It grants no authority to rewrite
the ten artifacts or to render.
