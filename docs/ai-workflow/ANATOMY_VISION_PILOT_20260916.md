# Targeted anatomy evidence vision pilot — approved Decision Gate

Owner approved continuing the recommended small visual pilot on existing images,
then next-story work only if useful. Existing-key reuse was explicitly authorized.
Current task sole writer: C:/GNart/Work/sh-r3b1b-semantic-m1,
codex/r3b1b-semantic-recovery-m1, base5e25996fa94a2d595cd0fd35da44dd558dabaf63,
clean/ahead33 at intake. Protected d53b768ccb2f / accepted-intent63ccb484 read-only.
Stay in current task, no overlapping implementation/reviewer. Claude supplied
PASS0/0/0 on 01f092ea..5e25996f (offline rules ONLY), not this new API adapter.

## Decision / stop-check

1. Isolated research adapter: extract structured observations for one specified
   person and feed the real reviewed offline-v2 adjudicator. Not an active judge.
2. Root problem: synthetic rules cannot establish pixel accuracy; legacy observations
   lack new fields and must not be retroactively promoted. Test extraction, not
   another schema-only claim. General target description, no story-specific rules.
3. Reuse five high-detail exact-pixel views, GPT-5.5 medium, explicit Flex, no retries
   or tier/model fallback. No change to current book/render/QA policy or calibration.
4. Four target cases / three image files: Dini original child (operator defect), Dini
   corrected child (operator no obvious defect), panda page3 conductor (defect),
   same page3 tuba player (ordinary-occlusion negative). Two books but tiny sample;
   repeated targets on same image are not independent images. Labels are implementer
   visual judgments, NOT an independent goldset. Target descriptions do not expose
   labels/corrections or page numbers; only one target inspected per request.
5. Freeze manifest image SHA, neutral target description, expected labels and code
   before first call. Full image plus same four overlapping high-detail crops.
   This is targeted anatomy only, NOT all-page automatic target discovery or QA.
6. At most8 calls: each target once, repeat in reversed order only if at least one
   positive contains a defect. Stop after first4 if neither positive is detected.
   Stop immediately on transport/tier/model/incomplete/schema/budget failure;
   no automatic recovery, no local label/prompt adjustment after seeing responses.
7. Conservative checkpoint budget3USD, reservation0.5USD/call, max6000output tokens.
   Admission accounting at30USD/M all tokens remains conservative; not an invoice
   or guarantee of provider-side cap. Price estimate uses observed tier/usage only.
   Known over-reservation results persist and halt; unknown claims cannot retry.
8. Validation: focused offline/mock tests, tsc, no-network preflight; then bounded
   live calls. Persist raw responses/usage/tier/id, decisions and request hashes.
   No regex reinterpretation, no held -> defect conversion. Count defect presence,
   actionable disposition, misses, false defect reports, false holds separately.
9. Rollback: revert focused code, preserve local outputs/old book. No schema change
   to offline policy: export its existing schema, preserving adjudication semantics.
10. Claude re-gate after completion: read-only; falsify label leakage, bindings,
    accounting, hold/no-retry and reporting. No self-awarded independent PASS.
11. No new image/audio generation, source publication, launch, deployment or push.
    Future extraction accuracy remains unproven even if this small pilot matches.

## Documentation and credential skills

OpenAI Docs verified GPT-5.5 image input/structured outputs and medium support;
Flex docs specify 15-minute timeout and possible unavailable capacity. SDK retries
explicitly disabled; no Standard fallback. Existing key presence checked without
revealing value; reused in-memory only, no credential file writes.
https://developers.openai.com/api/docs/models/gpt-5.5
https://developers.openai.com/api/docs/guides/flex-processing
https://developers.openai.com/api/docs/pricing
Rates verified: Flex input2.50/cached0.25/output15USD per million below272k input.

## Limits

Expected max2 hands/feet applies only to these ordinary-human targets and stays
outside the model request. It is not a universal species rule. The visual observer
can still omit fragments or hallucinate boundaries. We do not solve those failures
by changing expected labels. Local outputs are ignored/not backed up by a push.
No evidence here changes the existing book's held status or 0.70 resemblance gate.
