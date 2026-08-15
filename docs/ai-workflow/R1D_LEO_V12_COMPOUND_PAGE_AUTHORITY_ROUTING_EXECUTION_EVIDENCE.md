# R1D Leo v12 Compound Page-Authority Routing — Execution Evidence

## Scope and authority

- Repository head used by the consumed attempt: `9d4b8c2203d6739862ac03e901f51e7366f2dd9b`.
- Output root: `outputs/r1d-leo-v12-compound-page-authority-routing`.
- Execution was bounded to one canonical preflight, one Supervisor verify and one Supervisor live invocation.
- Model: `gpt-5.6-sol`; endpoint: Responses API; service tier: `default`.
- Maximum logical provider calls: three; transport retries: zero; fallback: none; hard ceiling: `$5.00`.
- This record is sanitized. It contains no raw prompt, response, provider message, stack or credential value.

## Fresh Readiness and arming

- Canonical Git probe: PASS, digest `0aac1b6b82600a970e4c63f968580138f5651988c80801b6c4b8b42e39cb4bad`.
- Canonical Fresh Readiness prepare/verify: PASS/PASS, digest `ac943aa34dbeeac256ece123ea84f17fe91321edf67dfe4d7a941da8ecc7319c`.
- Execution Request digest: `73fd35a72d4a588af246882a36d845cd189a1c4aa37f0c1cd15ab86903fdf6ed`.
- B0 authoring request digest: `7010a35f7929288c012d4c3ca3d2403bdf3864969850f9b4cb675059cbc22b8b`.
- Live request materialization digest: `981dd957182ce34966f9d80324e545cb6f69ce5d072650241238bd732d359e7c`.
- Supervisor readiness digest: `5889eeedb9482e81d88b823efc930f63eef79055430eef70fc503c8e29ce079e`.
- Canonical preflight count: one, PASS. Supervisor verify count: one, PASS. Supervisor live count: one.
- Credential-source access was attempted and succeeded only inside Supervisor for the live child. Ambient inheritance was false, credential authority was cleared, and raw stdout/stderr was suppressed.

An unsupported local `--help` discovery invocation exited before the canonical readiness entrypoint and created no output root or authority. It is not counted as canonical prepare, verify, preflight or live execution and grants no authority.

## Canonical live outcome

- Receipt: `visual-contract-authoring-receipt/v21`.
- Receipt digest: `02b5d2f8b1922c9d2747604b0ec34f9689ef064a9d70c16055ad6fd8ad704b2e`.
- Status: `failed`; draft validation status: `interrupted`.
- Logical provider calls / repairs / transport dispatches / transport retries: `3 / 2 / 3 / 0`.
- Fallback used: `false`.
- Candidate digest: `null`; Reconciliation digest: `null`.
- Aggregate usage: input `52,423`; cache-write input `47,806`; cached input `4,608`; output `91,332`; reasoning `8,534`; total `143,755`.
- Nominal estimated cost: `$3.041097`; conservative accounted cost: `$3.374366`; projected maximum: `$4.884`.
- Final terminal classification: `provider_completion_failure / completion_status_invalid`.
- Terminal phase: `provider_response_validation`; repair eligibility: `ineligible`; reason: `provider_completion_not_repairable`.
- Terminal message: provider response did not report a completed result.

### Attempt 1 — completed initial response

- Usage: input `17,075`; cache-write `17,072`; cached `0`; output `29,115`; reasoning `3,616`; total `46,190`.
- Nominal/conservative cost: `$0.980165 / $1.078186`.
- Validation: `38` unique issues, `94` emitted diagnostics.
- Composition: `24` closed action-semantic capability gaps across the twelve pages; one cover projection issue; twelve page final-structure issues; one recurring-props lifecycle issue.
- Next repair: `full_draft`.

### Attempt 2 — completed full-draft repair

- Usage: input `17,783`; cache-write `17,780`; cached `0`; output `26,217`; reasoning `1,882`; total `44,000`.
- Nominal/conservative cost: `$0.897650 / $0.987420`.
- All `38` prior unique issues were resolved.
- Validation then found `20` new unique page-local issues and emitted `26` diagnostics:
  - three action-binding-cardinality issues on pages `2`, `10` and `12`;
  - seventeen page-spatial-reference issues on pages `3`, `4`, `5`, `6`, `8`, `9`, `10` and `12`.
- The sorted affected-page union was `2, 3, 4, 5, 6, 8, 9, 10, 12`.
- The then-current compound router selected another `full_draft` repair.

### Attempt 3 — terminal incomplete repair response

- Usage: input `17,565`; cache-write `12,954`; cached `4,608`; output `36,000`; reasoning `3,036`; total `53,565`.
- Nominal/conservative cost: `$1.163282 / $1.308760`.
- Completion status: `incomplete`; output reached the exact `36,000`-token ceiling.
- No validation diagnostics were produced because provider completion validation failed first.

## Persisted artifact identities

Canonical content digests and raw file SHA-256 values are distinct domains and are recorded separately:

| Artifact | Canonical digest / filename | Raw SHA-256 |
|---|---|---|
| authoring receipt | `02b5d2f8b1922c9d2747604b0ec34f9689ef064a9d70c16055ad6fd8ad704b2e` | `53e722cdd2082d6a845d9e5c15aac4ccd541e1b6da19613e97dd482014f09822` |
| authoring readiness v19 | `f11f48dcd2db5c54c5b2bf3a87b6294693c5c60f9c6dca4d7171d0fad16f4b11` | `05a04996f34d6977c3146014d06800a28804e2fd9982166c83bbeb1e58674aa0` |
| canonical Fresh Readiness | `ac943aa34dbeeac256ece123ea84f17fe91321edf67dfe4d7a941da8ecc7319c` | `20c97641bac9bed8e9612268aaead31acb147728dee9c3f2b06e94a37f6facf9` |
| Execution Request | `73fd35a72d4a588af246882a36d845cd189a1c4aa37f0c1cd15ab86903fdf6ed` | `fca891595861103f6faebe2c25d9845d4784534216ba369f824f35ceb19d2541` |
| B0 request | `7010a35f7929288c012d4c3ca3d2403bdf3864969850f9b4cb675059cbc22b8b` | `dc1c87a3309d659f13ce0325aaf1b60869e6f46145875798c0582645f4abb0bc` |
| live materialization | `981dd957182ce34966f9d80324e545cb6f69ce5d072650241238bd732d359e7c` | `48e5a54b2cf4820d89dd5d42498ce14643997e4decedbd7c02b3521a96eff36a` |
| source snapshot | `c064dfcba3dcb315a39f2483165c4dd43c7b1b36406a1c0bd8924dfe40385acb` | `e6cbcb723c1f1b223ccf02fffdb84b19d4997e1d1aa0c3344292109321419105` |
| source-authority request | `92062d712e5fb625183ef2b6114b550b702fc9efb650e5bfaa51481e86f197b7` | `495f22a982ff8ce5273d71cd87a63ce4f15812ff5607d791ba6cb5f0b235890e` |

## Authority boundary

The attempt is exhausted. It produced no Visual Contract candidate, Semantic Reconciliation, D1A1 approval, Blueprint readiness, Wizard qualification, image request, render, storage/database action, publication, promotion or deployment authority. The artifacts are immutable historical evidence and are not authority for a new live attempt.
