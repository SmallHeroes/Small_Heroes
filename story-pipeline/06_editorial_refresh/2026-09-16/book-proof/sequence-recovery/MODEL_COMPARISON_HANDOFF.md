# Claude Code: model/quality comparison and measured outcome

Review-only first pass. No credentials, provider calls, rerenders, edits or push.
Guy requested a better evidenced approach to book consistency and approved the
staged model-only comparison, followed separately by one quality comparison.

## Frozen code range and ownership

Worktree C:/GNart/Work/sh-r3b1b-semantic-m1
Branch codex/r3b1b-semantic-recovery-m1
Code range 79dea3dbd292d8383d32981ac207f6563900ef26..9428578931f9e4d0459443818d9f4b620da0fdd3
Two commits, eight paths, +477/-7:

1. 69a75de0ac8adf69539dc54172d07a943482f864: optional sample-only model selection.
2. 9428578931f9e4d0459443818d9f4b620da0fdd3: optional sample-only quality selection.

Codex sole writer; no task delegated, independent QA was pending at handoff. See
MODEL_COMPARISON_QA_RESPONSE.md for the subsequently supplied technical PASS and
documentation corrections; that PASS does not extend to this wording revision.
Code tip clean,
ahead20/behind0 at execution; this handoff and current-state update are a separate
documentation closeout afterward, not another code change. Freeze its actual SHA
separately if reviewing transcription. No push. Protected worktree d53b at commit
768ccb2f and accepted-intent worktree at commit63ccb484 remain unchanged/clean.
Reconcile actual reviewer HEAD
before accepting any verdict. No extension of earlier independent PASS ranges.

## Implementation, compatibility and unchanged surfaces

Only scripts/run-owner-book-draft.ts is runtime code changed. Optional imageModel
allowlist: gpt-image-2 / gpt-image-2.5-sunburst. Optional imageQuality: low/medium.
Explicit settings require samplePages; unknown/malformed values reject before
input or credential access. Omission keeps Image2 LOW and old config bytes.
Requested model/quality bind identity, checkpoints and actual shared image call.
Changing either cannot reuse an old root. A mocked generator result with a wrong
model or fallback flag is retained and holds before QA/next image. This exercises
the caller's defensive contract, NOT detection of a provider model substitution:
the current shared generator echoes the requested model and computes fallbackUsed
by comparing that string to itself, so that condition cannot fire in its real
implementation. The installed SDK ImagesResponse has no model field. Model and
quality provenance in these saved artifacts is request-side only, not provider
attestation of internal model/compute or guaranteed visual improvement.

No shared generator, judge/anatomy, prompt assembly, sequence state, source/plan,
references, dimensions, thresholds, production/Wizard/reader or default changes.
Other code paths use the old defaults. One evidence harness calls the genuine
owner CLI, never another image generator. No automatic retry/repair/fallback.

Tests changed: lib/owner-book-draft.spec.ts and
lib/__tests__/generate-image-cancellation.spec.ts. Remaining paths are canonical
status docs, two Decision Gates and model-comparison.cjs in this directory.

## Tests and the RED full gate

Model-only stage: 192/192 = owner95 + transport23 + preview42 + sequence32, tsc0.
Final code stage: 204/204 = owner106 + transport24 + preview42 + sequence32, tsc0;
git diff --check0. Actual preflight0/providerCalls0. LOW offline report reproduces
after the MEDIUM extension. Both old pair readouts reproduced in the model stage.

Full check ran on the model-only working tree subsequently committed69a75de0:
native1, both typechecks0, ordinary391 files (5847pass/12fail/73skip), resource22
files (642pass/29fail). Total41 failures, NOT exclusively timeouts; assertion
mismatches include readiness_rejected versus child_failed and approval binding
versus repository authority errors. No untouched-base counterfactual, no claim
all failures are inherited. Resource phase2222.99seconds. No process was killed.
Full gate was NOT rerun for the quality follow-up; no full-green claim on94285789.
Full log paths/hashes are in MODEL_COMPARISON_GATE.md. Stability remains RED/open.

## Actual paid measurements

Both executed from clean respective code commits through the existing key/CLI.
Same page1 prompt SHA375998771cf5ea16aa575aa96ddb0d26e0249ee8f846f6db5bc861e5f9638571,
same three reference hashes/bytes,1024x1536, same source/plan/sequence and exact QA
context SHA779e28104086f7149c5b28ac9f6d56a0006a5cd8daaeb9cebd7513be3f823be9.
Context judge GPT5.5 medium/Flex and blind anatomy unchanged. Request-side model
is Sunburst; metadata GET200 established account availability before paid calls.
Both image responses reported5251 input tokens; output image tokens increased
from158 to343 (ratio2.170886). This independently supports changed consumption,
consistent with the changed quality request, but token count alone is NOT an
attestation of the exact quality tier. The SDK exposes optional top-level quality
and size fields; the shared generator does not retain them. Their presence or
values in the original responses cannot be recovered from the saved artifacts.

| Run | Native exit | Images / QA | Automated result | Usage estimate USD | Accounted upper USD |
| --- | --- | --- | --- | --- | --- |
| LOW,69a75de0 | 2 | 1 / 2 | props defect: wheel spokes | 0.12878 | 0.74079 |
| MEDIUM,94285789 | 2 | 1 / 2 | relative_scale defect: station height | 0.13120 | 0.73818 |

LOW page2 was not rendered. MEDIUM selected only page1; no page2 was requested.
Both remain sample_held / held_repair_limit, productionReady:false. Seven other
context categories and blind anatomy passed in each run. In MEDIUM the wheel's
three spokes passed, but the judge estimated the station at nearly2 child heights
versus the authored1.4. Codex visually inspected both images; agrees three spokes
are visible in MEDIUM, but has not independently measured/calibrated station size.
No visual accuracy/product PASS is inferred from either automated result.

Combined new nominal estimate0.25998 (images0.07774, QA0.18224), no unpriced new
steps. These are usage x official rates, NOT invoice verified. Image input cache
discount not assumed. Pricing checked2026-09-23:
https://developers.openai.com/api/docs/pricing
Final cumulative accounted upper8.13226 <9.50; historical unknown1 reservation
retained. New admission caps were2.80 then2.00 with prior costs recomputed before
each dispatch; no budget reset/refill. Stop here: no further paid calls this stage.

## Artifacts, preservation and local storage limitation

All following outputs/ roots are ignored/untracked, machine-local, no verified
off-machine backup; pushing code does NOT preserve images, logs or raw QA.
Regeneration cannot reproduce original timestamps/receipts.

- outputs/panda-sunburst-comparison-input-20260923: config and full-check logs.
- outputs/panda-sunburst-comparison-execution-20260923: native split/status,
  invocation, budget, before/after preservation, execution summary.
- outputs/panda-sunburst-comparison-sample-20260923: image, request, identities,
  ledger, raw QA, manifest, comparison.json, index.html.
- outputs/panda-sunburst-medium-input-20260923: config.
- outputs/panda-sunburst-medium-execution-20260923: analogous execution evidence.
- outputs/panda-sunburst-medium-sample-20260923: analogous one-page result.

LOW preserved172/172 previous files; MEDIUM preserved203/203 including LOW
inputs/outputs/logs, all SHA/size/mtime identical. Offline reports rechecked disk.
No run locks remain. Raw verdicts and old HELD images have not been rewritten.

| Artifact | SHA256 |
| --- | --- |
| LOW page1 | 364418828dd33cf15c76cd2e5ddf8b9b0aeb4b6410b6a7ae564d10078559f9be |
| MEDIUM page1 | b14e1d9c1f58e614c69ba5655695e12b97d07192da9336b9ddd81ff1b616aca6 |
| LOW comparison.json | 55773930d90596af7afdd195f7d1bbc153c9bef6ff21492539918c216e85ef82 |
| MEDIUM comparison.json | bbdd26447982b7de0fc570ca7b0f8fc84615f623d4e5e212e9ecb9502ecb4097 |
| LOW sample-manifest | 4365204dea4ea0c66a54c4de0b48db137096fa24e3ff302a9dffa6d7d5ab6482 |
| MEDIUM sample-manifest | d06689f7edc2088be71375160a260f63990da735ab21e9f822a9d9e440d496d0 |

## Interpretation and next recommendation

Model-only LOW did not solve the wheel. MEDIUM matched that constraint in one
sample but another failed. Randomness and n=1 prevent causal superiority claims.
Neither run reached a same-scene successor, so neither establishes continuity.
This is not evidence that Image2.5 cannot do the task, nor that Astra authored a
bad plan; the experiment changes image request parameters, not the text planner.

Keep whole-book state and canonical scene/object references. Before more spend,
separate story-critical invariants (cast, occupancy, custody, state transitions,
recognizable object identity) from optional invented design precision. Three
spokes/0.27 wheel diameter/1.4 roof height originate in five-page-sample/prepare.cjs
design, not a measured physical-world requirement from prose. Their severity must
be decided explicitly upstream, not silently relaxed after seeing failed pixels.
This recommendation is NOT implemented by this range and does not clear holds.
Regional repair remains a separately scoped option, not a guarantee. Do not add
another identical full-image retry or a new paid ladder under this handoff.

## Falsification targets

1. Call the real loader/CLI with omitted/invalid/model/quality combinations and
   non-sample overrides. Prove credentials/providers are not reached on rejection.
2. Attack old-root reuse and fingerprint binding; inspect actual mocked shared
   edit seam for Sunburst LOW/MEDIUM, maxRetries0 and unchanged references.
3. Compare real saved prompt/ref/context hashes, including actual normalized
   reference pixels; detect any hidden simultaneous prompt or judge changes.
4. Recompute claims/results/costs including old unresolved reservation. Both child
   native exits2 are persisted. The surrounding execution tool reported exit1 in
   Codex's session, but the harness's own exit was not independently captured in
   these artifacts; its normal successful-preservation branch assigns2. Claude
   did not reproduce a2-to1 conversion. Do not attribute the tool observation to
   the harness, PowerShell or another layer without measurement. No retry/next
   page/import occurred. See the QA response for the deferred logging follow-up.
5. Independently recompute preservation and raw QA-to-manifest binding rather
   than relying only on our helper. Report accuracy limitations honestly.
6. Check the full-check RED disclosure and exact tested code range. Do not label
   resource failures wholly timeout or inherited. No independent self-PASS.

## Separate site-QA notice

Guy supplied merge70d4f245 (parents4f1c8e2c/51ce55fc),24 paths. Read-only Git
inspection found no path overlap with this comparison range. No merge into this
branch, no site deployment action, no independent live-site QA or release claim.

## Copy-ready offline inspection

```powershell
Set-Location 'C:/GNart/Work/sh-r3b1b-semantic-m1'
git status --short --branch
git log --oneline 79dea3db..HEAD
git diff --check 79dea3db..94285789
git diff --stat 79dea3db..94285789
npx tsc --noEmit
npx vitest run lib/owner-book-draft.spec.ts lib/__tests__/generate-image-cancellation.spec.ts lib/__tests__/local-story-preview.spec.ts lib/__tests__/local-book-sequence.spec.ts
node story-pipeline/06_editorial_refresh/2026-09-16/book-proof/sequence-recovery/model-comparison.cjs --report
node story-pipeline/06_editorial_refresh/2026-09-16/book-proof/sequence-recovery/model-comparison.cjs --report --medium
```

Do not add --write to report: original reports already exist, writes use wx.
Do not use --run or --check for this read-only review. No provider authority.

Owner-only optional propagation after review, NOT executed by Codex:
```powershell
Set-Location 'C:/GNart/Work/sh-r3b1b-semantic-m1'
git status --short --branch
git log --oneline '@{u}..HEAD'
git push origin HEAD:refs/heads/codex/r3b1b-semantic-recovery-m1
```

Push carries the entire ahead set, not only this range. No merge/deploy/release,
no complete book/narration/five-page proof, no anatomy calibration or product
acceptance. Earlier semantic and reader findings remain outside this range.
