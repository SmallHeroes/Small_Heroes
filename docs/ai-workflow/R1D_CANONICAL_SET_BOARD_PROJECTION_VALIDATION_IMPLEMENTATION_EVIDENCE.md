# R1D Canonical Set Board Projection Validation — Implementation Evidence

## Outcome

The persisted eight-page Chameleon Candidate now passes the current Visual Contract Template validator without changing the Candidate artifact. The correction is downstream-only and made no provider, image, Wizard, database, production, or render call.

## Root cause reproduced

The Candidate at:

`outputs/r1d-chameleon-fresh-4bb21939-20260819T111441049Z/b0/contract-candidates/fada3965253054a5703b7c26aa727d26c54ed23b15fb6a1bcf63d90802a5968f.json`

initially returned seven `spatialNodes do not equal the compiler-owned area projection` errors. The compared arrays had identical values and order. Only nested object-key insertion order differed after the canonical artifact writer recursively sorted keys.

`setBoardStableAuthorityErrors` used `JSON.stringify` for three compiler-owned projection identities:

- stable-area nodes versus page-zone nodes;
- stable-area relations versus page-zone relations;
- stable fixed objects versus recurring-prop projections.

The first and third are directly affected by canonical key sorting. The second belongs to the same semantic identity boundary and is corrected consistently.

## Implementation

`lib/visual-contract-compiler/setBoardStableAuthority.ts` now compares those projections through the existing repository canonical JSON hash. Canonical equality preserves array order and exact values while making nested object-key order and Unicode composition stable across persistence. Optional relations retain their prior semantics: only `undefined` compared with `undefined` is equal; `undefined` compared with a value is not.

`lib/set-identity-board/__tests__/set-definition.spec.ts` adds a canonical write/read round-trip regression. It proves nested node and fixed-object key order actually changes, the authority remains valid, and independent node-value and fixed-object-value tampering is still rejected. Existing node and relation drift tests remain green.

## Direct live-artifact replay

Before correction:

```text
validateBookVisualContractTemplate(candidate.template)
ok: false
errorCount: 7
```

After correction, using the same file bytes:

```text
validateBookVisualContractTemplate(candidate.template)
ok: true
errorCount: 0
```

No Candidate, receipt, readiness, Supervisor result, Fresh evidence, or source artifact was rewritten.

## Validation

- Focused Set Board/authority/template/QA bridge: 4 files, 85 tests PASS.
- `npx tsc --noEmit`: PASS.
- `git diff --check`: PASS.
- One literal `npm run check`:
  - TypeScript: PASS.
  - autonomous-story typecheck: PASS.
  - resource-intensive: 20 files / 609 tests PASS with valid diagnostics.
  - ordinary: 3,343 tests PASS, 65 skipped, and only the five established missing ignored-`outputs/` fixture assertions failed across the unchanged `child-lexicon-ages-5-8.spec.ts`, `momentum-gate-koko.spec.ts`, `page-entity-qa.spec.ts`, and two `story-read-back-validation.spec.ts` cases.

The full repository/release gate therefore remains truthfully HOLD on that separate historical fixture baseline. No missing fixture was copied or fabricated.

## Scope and exclusions

Unchanged:

- Candidate and all canonical live artifacts;
- authoring prompt, schema, model, policy, call limits, retry/fallback and cost;
- Set Board authority shape and compiler rules;
- array ordering and all tamper checks;
- reconciliation, approval, import, Wizard, Blueprint, package and render authority;
- story-bank production eligibility.

No credential, provider, network, database, image, render, publication, or deployment action occurred.

## Independent QA falsification targets

Claude Code should verify:

1. the immutable review range contains only the validator, direct test, Current record, Decision Gate and this evidence;
2. canonical equality does not sort arrays or ignore missing/extra fields;
3. `undefined` handling cannot equate absent relations with an authored value;
4. node, relation and fixed-object drift still fail closed;
5. the persisted Chameleon Candidate validates without modification;
6. no prompt, schema, policy, budget, provider, bridge, Wizard or render behavior changed;
7. the `npm run check` HOLD is exactly the disclosed pre-existing five-fixture baseline.
