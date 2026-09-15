# Cross-family QA comparison: approved experiment

Guy approved the preceding recommendation: compare alternative visual judges on
existing images, no rendering. Existing sole writer/worktree sh-r3b1b-semantic-m1,
branch codex/r3b1b-semantic-recovery-m1, base59f79166a8ab09cb8fcba0d063a6cbd37d87a7db,
clean ahead21/behind0. d53b768ccb2f and accepted-intent63ccb484 clean/protected.

Observed:5.5 and5.6 Sol both rationalized the known malformed image. Crops and
inventories did not fix perception. Different-family performance is a hypothesis.
Expected: identify a useful discriminator without promoting unverified model claims.
Scope: isolated general experiment, no active QA/default/threshold/production change.
Files: visual-qa-comparison lib/adapter/CLI/preparation/spec and CURRENT/evidence.
No new abstraction in the customer pipeline; reuse claim-first checkpoint handling.

Implementation observations superseding the initial plan: provider metadata version
is the REQUESTED version, not an attested immutable deployment. Actual Qwen receipts
return version="hidden". Exact model name is still required; hidden is retained,
not silently rewritten to the requested hash. Sonnet did not complete; its claim
remains unresolved, and no subsequent Sonnet image was attempted.

Qwen POST504 can follow real creation. Recovery is GET-only with a previously
persisted dispatch ID or unique exact-input/time-scoped discovery. Redacted image
placeholders cannot establish that match; those cases remain unknown. Explicit
--continue-unresolved permits other independent cases only; the old claim still
prevents another POST. This does not authorize image repair or release.

Availability: existing Replicate token present; read-only model metadata200 for
Sonnet4.5 and Qwen3.7-Plus. Version/schema pinned from API2026-09-15. No direct
Anthropic/Gemini key present in checked env. MagicAssessor is available as model
weights (https://huggingface.co/wj-inf/MagicAssessor-7B); not installed, no custom
GPU service provisioned. Defer hosting work rather than infer it is a drop-in API.

30 unique existing page images available; exactly1 owner-labelled anatomy defect,
5 provisional controls,24 unlabelled. Do NOT claim30 independent human labels.
Group related page variants in development/reserved splits to avoid repair leakage.
Hold reserved rows out of provider calls. Six smoke images, both models get the
same full PNG and exact neutral instructions, no expected label/filename/source
story/previous verdict. Different provider preprocessing/settings remain; comparison
is of endpoints, not pure architecture. Earlier Sol used crops/different instruction,
so this is not a controlled numerical superiority claim over that run.

At most12 vision calls,3000output tokens each,120s provider deadline,3USD planning
allowance via0.25/call fixed reservations, including missing usage. This is not a
provider-enforced billing cap. No new key or public image upload, data URIs sent to
the approved alternative inference providers through Replicate. No child reference
photo sent. Store receipt metadata/text only, no echoed image/input/credentials.
Unknown dispatch/HTTP outcomes never auto-resubmit; persist ID for manual read-only
reconciliation. Malformed known output is unknown, not pass or paid repair.

Validation: schema/routing/label-leak/hash/cache/failed/unknown/receipt tests; tsc;
fake-key replay; original media hashes. No fullcheck closure or self-PASS. Provisional
agreement separate from owner evidence; uncertain outcomes separate from false alarms.
Small/single-story pool cannot establish general accuracy. No repair/release authority.

Stop-check: general isolated tooling; other stories/production unchanged; bounded
paid comparison authorized; smallest2x6 smoke; no unresolved creative decision;
QA should falsify provenance, input equality, cache/retry bounds and result claims;
no Cowork or new product image review needed. Rollback: don't invoke experiment;
preserve evidence, no source edits, pushes, rendering, training or model installation.
