# Held P1 semantic recovery fixture provenance

`semantic-recovery-held-p1.json` is an exact byte copy of the immutable original:

`C:/Users/guyna/.codex/worktrees/d53b/Small_Heroes/outputs/r3b1b-p1a1-v22r2-02/b0/contract-candidates/efbdd2e13c03af194af425c5e050e0bfedad29d4e0c8cec1aa8b54530192ad88.json`

- Raw SHA-256: `33ce501865735be68fe99776a6ae3968efc88bc60d555da2b3fd7290c18d31f4`.
- Canonical candidate identity: `efbdd2e13c03af194af425c5e050e0bfedad29d4e0c8cec1aa8b54530192ad88`.
- Original template: `8632bd95869b93bf115500f3a24890daaa967a39805079e2f0ae86afc2543b18`.
- Frozen original catalog: v3. This is not a new current-catalog paid candidate.

The local `.gitattributes` disables line-ending conversion for this file.
Tests check the raw SHA before parsing. Accepted source revision
`64dcd0e741f17fc08cde95ad8a5a00b303955aa28ccd065d44f01e49e9d155fc`
is already tracked; the fixture builder reloads that accepted revision, prepares
source-bound cast evidence and constructs nine explicit review operations.
No production module imports the fixture or its story-specific choices.

Original files were only read. The copied candidate remains semantically HELD;
tests do not award independent QA, semantic acceptance or render authority.

## M2b historical-chain regression copies

Three further byte-identical files from the same original `b0/` root are used
to test frozen request/readiness reconstruction and complete tuple bindings.
Their line endings are pinned by the fixture-local `.gitattributes` and their
raw hashes are checked before parsing in the historical-chain spec.

| Copy | Original category / canonical digest | Raw SHA-256 |
| --- | --- | --- |
| semantic-recovery-held-request.json | authoring-requests / `2245a757ec6ae6552a974736d248f601609a419c0400a864c70c4880f049ed8d` | `e81964b616739c0e1c12ffd1cde2e78ddaa91285c9ca6a1d32b549ff6721006f` |
| semantic-recovery-held-receipt.json | authoring-receipts / `b6c0b37e9c7b7007a9aee47bf39f691e263ca32657ee9491c6dc9ae0204940bf` | `d39dace8fba47af25c617eeb698f13e0aa4ca2677a3fd3e0ed30d66b6ce3f6b3` |
| semantic-recovery-held-readiness.json | readiness-evidence / `9466af78e073d06b917bd77d2c3dada46444d73fa20b5ee850831d48886c61c1` | `356d8591a2c0f9b85f8f9f45d39bd1e988a7373c4993a2518e8038681951f7ce` |

The whole-graph runtime probe separately reads the real protected root, including
Supervisor/B0/replay evidence not copied into this fixture. In-memory hostile
byte overrides in that probe never modify the original files.
