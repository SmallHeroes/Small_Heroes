# Decision Gate — one bounded shared-pipeline sample repair

Guy explicitly approved the proposed single-repair pipeline step and completing Uri
pages2/7/10, using the existing key. This task remains sole writer in
C:/GNart/Work/sh-r3b1b-semantic-m1, codex/r3b1b-semantic-recovery-m1,
base29baf75c, clean/ahead43. Protected d53b768ccb2f/accepted-intent63ccb484 clean,
read-only. No new task needed for this small opt-in milestone, no push authorized.

1. Change: opt-in sampleRepairOnce and pinned sampleInitialImages in owner-draft
   config. Wire the EXISTING shared quality loop's repair callbacks. One repair
   across the entire sample, not one per page. Default/legacy stays no repair.
2. Why: numeric wide target reaches generation but did not produce wide pixels;
   existing sample halts without feeding the detected defect into a corrective edit.
   Underlying noncompliance cause unknown; this is bounded feedback, not a guarantee.
3. General system change in local editorial sample only; arbitrary pages/stories.
   No customer/order/Blueprint/catalog/accepted-source route or threshold changes.
4. No Uri/Bar-specific engine branches or coordinates. Plan remains authoritative.
5. Files: scripts/run-owner-book-draft.ts, lib/owner-book-draft.spec.ts, CURRENT.md,
   this gate. Paid input/output go to NEW ignored roots; old roots immutable.
6. Expected: imported candidate is untrusted, hash checked and judged anew; only
   bound defect evidence can trigger repair. Uncertain/error/schema/budget/unknown
   outcomes hold. Persist each valid attempt before next image; repair new filename
   and checkpoint plus new QA step. Rejudge all categories, no optimistic acceptance.
7. Offline tests for caps, default compatibility, no repair on uncertainty/malformed
   evidence, attempt binding/names, replay, imports, budgets and prior-page continuity;
   tsc and full check. Then bounded LOW sample using old board and page2 import,
   at most3 new page images including the single repair (if later pages pass).
8. Image fenceUSD2, QA fenceUSD5 (unchanged ceilings, conservative not invoice).
   Max4 candidate assessments (8 judge calls). Existing API key only, no secret
   writes/printing. No audio/full-book run. Stop if the repair still fails.
9. Rollback: opt-in absent retains old behavior; fresh held root can remain unused.
   Do not overwrite/displace original paid evidence or weaken judge to get a pass.
10. Owner decision supplied by Guy's go-ahead; no unresolved creative choices.
    Claude first pass read-only should falsify run-wide cap, fail-closed judgments,
    identity/replay separation, budget accounting, import is not acceptance,
    default compatibility and preservation. No independent self-PASS.
11. Forbidden: unbounded retries, provider fallback, anatomy/QA bypass, product
    acceptance, production deployment, catalog rewrite, automatic push or full book.

Stop-check: general opt-in change; risk to existing paths constrained by absence of
new fields. Does spend money only after offline proof; smallest proof reuses page2
and board, attempts at most one repair then follows requested page order. Guy will
view the result; no new Cowork/product decision needed. Judge remains uncalibrated.

Previous review: Claude supplied PASS0/0/1 on64dac53f..29baf75c; remaining P2 is
listing outputs/uri-evidence-correction-20260916 (HANDOFF.md,preservation.json).
It is ignored/local-only, no verified off-machine backup, like the other two Uri
roots. Claude's harness returned2 in both shell probes; his P1 closure rests on
proper boundary disclosure, NOT independent reproduction of Codex's wrapper behavior.

## Implementation and checks
Code commit575bda08d39f09c444c3810a5fced28cd3650333. One production entry module
changed, one existing spec extended. New opt-in v3 run identity; legacy/v2 unchanged.
Pinned imports do not import old verdicts. Correction references append the candidate
after original canonical refs, with explicit role and bound feedback; no-board case
replaces conflicting third-reference prop label. Cap checked before image claim.
Every valid attempt saved before repair; candidate/review/context/digests separate
per attempt, all categories rejudged, one repair across the entire selected sample.
135/135 focused (owner59,quality28,judge16,checkpoints32), tsc0. Actual preflight0.
Full check captured exit1: both typechecks0; ordinary5651pass/2fail/73skip, resource
670pass/1fail. Claude-model inventory contains claude-4; classifier expected393got409;
resource canonical-pre-live-readiness.spec.ts:913 timed out5000ms, recorded5693ms.
No untouched-base reproduction, so no inherited-failure classification. The focused
rerun and subsequent live run overlapped portions of the full check; no causal claim
about timeout. Repository stability remains NON-GREEN, unrelated gates untouched.

## Live outcome
Old plan/source unchanged. New config
outputs/uri-system-repair-input-20260916/config.json
SHA9eb0755d48025cd95bd05fae6d68982ebf095549468cb4c4053c04b3d7e2d5a2.
Output outputs/uri-system-repair-20260916. Logs/wrappers/check results and preservation
inventory: outputs/draft-repair-once-evidence-20260916. All ignored/local-only;
no verified off-machine backup, push does not preserve them. Existing three roots
uri-system-sample-input-20260916,uri-system-sample-20260916 and
uri-evidence-correction-20260916 preserve all28 files byte/size-identically.

Initial capture.cjs used require-only tsx registration. Preflight passed but dynamic
judge import failed in live mode, before any provider call/claim or imported page.
Isolated import probe returned ERR_MODULE_NOT_FOUND; --import tsx probe succeeded.
No run.lock left, only identities/reference assets persisted. No hidden paid retry:
capture-tsx.cjs resumes this zero-dispatch root with existing tsx CLI; native child
exit2 captured with stdout/stderr and timestamps. Both launch records retained.

Imported page2 rechecked: framing defect. Single corrective images.edit call with
four refs produced page-02-repair-01.png,
SHA4c6823aad4a9b16b8383dfc65c752fc1be3d652dcaa318e22ee47769cfc59080.
All8 categories pass on recheck. Framing observation explicitly says ~two-fifths,
not one-third; same unchanged judge accepts this as approximate wide staging. This
is a model verdict, NOT an exact numeric measure/acceptance/calibration claim.
Next page7 image SHA40a59b8eb47c6564f128b0723c6f38c392ad9b8abc05880cf5ffd9ed5dc179e5.
Scene defect: chain of droplets instead of one, and fox forepaws at lantern instead
of resting on belly. Other7 categories pass. Cap spent on2, no repair7 and no page10.
Manifest sample_held/productionReadyfalse/productAcceptancepending/repairsUsed1.
Raw judgments preserved; no unilateral waiver of seemingly incidental staging.

Eight claims/eight results/no unknowns:2 image calls+6 QA calls (three assessments).
New image listUSD0.074275,QA0.271905,total0.34618; old run0.1150785,
cumulative0.4612585. New conservative accounting2.16495, not additional charge;
image0.30249/QA1.86246 within fences2/5. No invoice verified. Rates per million:
gpt-image-2 text input5/image input8/image output30, GPT-5.5 Flex input2.5/output15;
all QA cached input0 and returned tier flex. Sources verified earlier this date:
[OpenAI image announcement](https://community.openai.com/t/introducing-gpt-image-2-available-today-in-the-api-and-codex/1379479)
and [OpenAI GPT-5.5 pricing](https://openai.com/index/introducing-gpt-5-5/).
Read-only audit.cjs in new input root verifies receipts/image hashes/repair links,
stop condition and all28 preserved files; cost-audit.json is its captured output.
Local index.html shows before/after and held7, no fictional page10 or narration.

## Limits and next question
The bounded defect-feedback loop worked on2 and stopped at its configured cap on7.
It does not establish reliable three-page/book completion. Consider whether future
plans should type story-critical requirements separately from incidental staging
preferences; any such change needs a separate product/QA contract, not overwriting
this review. No further paid attempt, source/plan edit or judge change in this run.
Independent code review of this new opt-in remains pending; old PASS ends c1ae489a.
