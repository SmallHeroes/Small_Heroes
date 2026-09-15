# Decision Gate: anatomical comparison with GPT-5.6 Sol Medium

Owner decision: Guy explicitly requested this exact model/effort and an experiment.
Continue in the existing sole-writer task; no new task/agent or independent PASS.
Worktree C:/GNart/Work/sh-r3b1b-semantic-m1, branch
codex/r3b1b-semantic-recovery-m1, base807b59ea266352239027bb1be4b039af450c1cc7,
clean ahead20/behind0 at start. Protected d53b768ccb2f and accepted-intent63ccb484
clean/read-only. No push in scope.

## Change, evidence and scope

The v3 grounded inventory experiment still missed the owner-rejected visible
anatomy with5.5 Medium. Exact crops and valid coordinates did not establish
perception reliability. Whether changing model helps is a hypothesis, not a fix
already proven. Add only an allowlisted optional experiment model; keep active
QA, legacy experiment defaults, instructions, parser and thresholds unchanged.
Both localization and inspection switch to Sol: this compares the two-stage
pipeline, NOT inspector-only fixed-crop performance. Crop differences are possible.
General tooling, no story/page-specific prompt or production hardcoding.

Files: scripts/lib/local-anatomy-experiment.ts, scripts/experiment-localized-anatomy.ts,
existing anatomy spec, CURRENT and this gate/handoff. No migration needed.
Model/config/checkpoint identity must prevent old receipts from posing as new calls.
Reject arbitrary overrides at CLI and adapter boundaries. No fallback substitution.

## Compatibility, validation and cost

Official https://developers.openai.com/api/docs/models/gpt-5.6-sol.md fetched
2026-09-15: exact model supports image input, Responses, structured outputs and
medium effort. API model metadata GET returned200 and id gpt-5.6-sol with the
existing key; key presence only disclosed, no plaintext output. Documented input
4USD/M, output20USD/M; cache writes1.25xinput, prompts>272Kinput different rates.
This small-image experiment retains conservative30USD/M all-token accounting;
rates are covered for this small input, but estimates are NOT invoice charges.

Use the original page01 and its existing corrected control, same bytes and
grounded instructions; expectations/filenames never enter model input. At most
4 calls, task planning cap2USD, locator reservation0.3/inspection0.5 per case,
no retries or image/audio generation. Unknown/incomplete/malformed evidence holds.
No book render or automatic release even if both cases match. Two cases cannot
establish broad accuracy. Tests cover explicit routing, default compatibility,
cache mismatch, replay, invalid overrides, geometry; tsc before focused commit.
Replay old/new outputs with fake key; verify reader image/audio preservation.
Full-check non-green status stays open; full check not required for this isolated
experiment, and any omission will be disclosed.

## Stop-check, rollback and review

1 General experiment, not production patch. 2 Other stories unaffected; no active
default changes. 3 No production effect. 4 Paid vision only within2USD. 5 Two existing
images are the smallest paired check. 6 Exact owner choice already supplied; no
unresolved product decision. 7 QA should falsify routing, no-label-leak, cache
separation, old replay, receipts/cost and result claims. 8 No new creative decision
needs Cowork. 9 Guy should eyeball new images only if future rendering is requested;
none produced here. Rollback by omitting optional model/use previous commit, never
delete historical evidence. Artifacts remain ignored/local-only, not backed up by
Git push. Independent QA pending; existing v5 calibration hold unchanged.
