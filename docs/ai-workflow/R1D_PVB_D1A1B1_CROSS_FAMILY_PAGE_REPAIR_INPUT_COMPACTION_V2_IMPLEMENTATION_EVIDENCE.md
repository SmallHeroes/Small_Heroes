# R1D-PVB-D1A1B1-CROSS-FAMILY-PAGE-REPAIR-INPUT-COMPACTION-V2 — Implementation Evidence

**Base:** `f4cf27ea64494ec7a8697c013dff705797552f3a`
**Branch:** `codex/r1d-pvb-d1a1b1-cross-family-repair-input-compaction-v2`
**Status:** local implementation green; independent Claude Code QA pending

## Runtime evidence that motivated the change

Fresh Readiness `a7ede460afb9b41794eace579fe8dc48bf5dc09f6a5e10229994aa13f9049562` and Supervisor verify `d7ced9b993adaad509c12ff7d98ea6b2fcd1637c05649aa4e50e69cbe89164cb` passed on the prior pushed head. The consumed live attempt recorded receipt `f5881b3f2a06cebdff01c5916661c6c8ab3ecd5578f31d4651d946508d490c9a` and readiness `10a6c4b36107ce8e212cfdbe0b461560a884295adb9f468a5bc70be38c436ecb`.

- Call 1 completed: input 17,402; output 25,285; reasoning 2,747; total 42,687; nominal `$0.767265`; conservative `$0.954044`.
- Call 2 `page_spatial_reference_patch` completed: input 612; output 174; reasoning 84; total 786; nominal `$0.008280`; conservative `$0.009950`.
- The spatial repair resolved its three initial issues. Validation then exposed seven `closed_catalog_capability_gap` records and twelve `final_structural_invariant_invalid` page records.
- The cross-family planner correctly selected one third `page_contract_patch`, but admission stopped locally at `input_token_ceiling_exceeded`; provider calls/repairs/retries/fallback were `2/1/0/false`.
- Aggregate nominal/conservative authoring accounting was `$0.775545/$0.963994`. Candidate, Semantic Reconciliation, Blueprint, Wizard and render authority remained absent.

## Implementation

`page-contract-repair-input-encoding/v2` keeps every authority value and adds two closed deterministic compression surfaces:

- repeated fragments inside otherwise-unique strings are represented by numeric `fragmentDictionary` references and reconstructed by concatenation;
- repeated arrays/objects are represented by deep-copy `valueDictionary` references whose entries cannot reference the value table recursively.

The existing exact whole-string table, object-shape table and tagged arrays remain. Dictionary construction is canonical and byte-beneficial; prompt construction locally decodes and compares the complete payload canonically before returning bytes. Decoder validation rejects extra/missing envelope fields, noncanonical tables, invalid/unused references, duplicate values, nested value references, non-JSON input and cycles.

Page-contract prompt authority is v10/v10 and explains the two new tags. Output `PageContractRepairPatches` v1, page set semantics, full page parser/application, complete validation, candidate policy, model/tier, token/call/repair/cost budgets, timeout, retry/fallback policy and all downstream behavior are unchanged.

## Validation

- Direct codec/compiler/repair tests: `3 files / 116 tests` PASS.
- Source-authority lifecycle: `1 file / 64 tests` PASS.
- Canonical materialization, verifier, Supervisor and Fresh Readiness: `7 files / 310 tests` PASS.
- Provider-sized admission regression: raw mixed twelve-page authority `108,461` bytes; v2 user prompt `45,322` bytes; full conservative call bound `57,384`; headroom `6,616` below the unchanged 64K ceiling. Roundtrip equality PASS.
- Deterministic TypeScript: PASS.
- `git diff --check`: PASS.
- Literal `npm run check`: TypeScript PASS; all `19/19` resource-intensive files PASS with valid diagnostics; ordinary phase reported exactly the established six missing ignored-output fixture failures and no seventh assertion or infrastructure failure.

The six fixtures remain a separate release HOLD. They are accepted only for the bounded local LOW measurement and are not waived for production.

## Boundaries

No credential access, pricing/network/provider call, real B0/Fresh Readiness, preflight, live authoring, candidate, Reconciliation, Blueprint/Wizard execution, render/image/Vision, storage/database, publication, deployment or production action occurred in this implementation. External cost is `$0`. Historical consumed artifacts were not changed.

Independent Claude Code QA is required before the new head becomes operational authority. Codex does not self-award that PASS.
