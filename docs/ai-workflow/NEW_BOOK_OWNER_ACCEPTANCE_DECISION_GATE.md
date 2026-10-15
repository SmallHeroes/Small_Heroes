# Decision Gate: the owner accepts the second repair's held storyboard with its notes (2026-10-15)

**Context.** The one approved second repair ran at `8dee5f62` after Codex PASS. The fresh Sol 6.1 review held it (`held_uncertain`: 39 supported, 3 contradictions, 1 uncertain). Stop report: `_review/new-book-run-repair2-20261015/STOP-REPORT-REPAIR2-20261015.md`.

- **Fixed:** page 3's flat tail and page 7's gate; the review now supports both.
- **Remaining:** the herd's wetness as a group on pages 5–6 (latent: the first repair's plan had it identically and that review passed it), and where the rest of the herd is during page 7's push (forced by the completeness rule; the text does not say).

**Guy's decision** (AskUserQuestion, 2026-10-15): "Accept with notes (Recommended)", on this description:

> "You accept this storyboard as product owner despite these 4 notes, recorded and bound to this exact storyboard. Needs a small engine path (the engine refuses held storyboards today) plus Codex QA. Then child reference, grant, two samples; the image checks and the 0.70 likeness bar stay unchanged."

## 1. Proposed change (general, opt-in, experiment path)

**A. Engine: `storyboard-owner-acceptance/v1`.** The record names:
- the storyboard digest and its review's digest;
- **every** unsupported check of that review, verbatim (derived by the engine, never chosen);
- who accepted it, and the owner's recorded decision.

`personalStoryboardFrame` builds frames for a held storyboard **only** under a record that binds exactly that book, that review and that complete list of findings. The packet context then carries the record's version and digest. Without a record, nothing changes. The exported binding (`storyboardOwnerAcceptance(book, rawReview, record)`) derives the review's decision itself; no caller supplies it.

**B. Loader and audition.** `storyboard_owner_acceptance.json` beside the storyboard, present exactly when this path is used:
- the saved held result and its review are checked as saved;
- the frames are derived under the record (a held run saves none);
- the record reaches every frame call: the render, and a re-judge of a saved image (the same packet);
- the audition's admission names the acceptance (version and digest), as every page packet does.

Absent, the existing checks, packets and admission are byte-identical. A re-plan of an accepted storyboard is refused.

**C. Experiment stage `storyboard-acceptance`** (one use; amendment `<slot>.storyboard-owner-acceptance-1.json`):
- **Admission:** at one pinned HEAD, the claim and chain through the second repair, which must be held; never after a child stage or an audition; both repairs' producer requests re-derived.
- **The record:** derived from the saved book and its own review, and bound by the engine.
- **The amendment** binds the second repair amendment's bytes, every record of that folder, the record's hash and Guy's decision. Its summary fields (book, review, number of accepted checks, held status) are re-checked against the record and the sealed folder on every read.
- **The preview** builds and validates the exact record and amendment an execution writes, and shows the record's hash.
- **Execution:** the record beside the storyboard first (an identical record left by an interrupted run is the same record), then the one-shot amendment naming it by hash.
- **Later stages:** child, grant and audition accept the held second repair only through this bound record; the lineage pin covers it.

No paid call in this stage.

## 2. Scope / hardcoding

A general owner-authority path. Nothing names this book's pages or entities: the findings come from the review itself.

## 3. Unchanged

- Every image gate: the pixel judge, the identity bar at 0.70, the sample gate (two pages first; the rest only if both pass).
- The caps ($7 with the full carry), the models and the one-use stages.
- No story, plan or review edit.

## 4. Validation (no paid call)

- **Engine tests:** binding, wrong book/review/findings, a supported review refusing a record, the exported binding deriving its own decision, and the absent path pinned.
- **Audition tests:** the render and a re-judge pass the acceptance into every page packet; absent, the packets are as before.
- **Experiment tests:** the stage (the preview names the exact bytes written), consumers, tamper cases (the record, the amendment's own fields), an audition under acceptance with its admission, and a re-judge through the generic runner.
- **Negative controls:** in-memory mutants of each check.
- **Evidence:** real dry preview; preservation of 92 records and Goni 412; Codex QA before any spend.

## 5. Cost

- **Offline build:** none.
- **After Codex PASS:** child (~$0.1–0.3) → grant → audition: two samples, then the rest only if both pass, under the remaining $2.370377 with the carry kept. The cap may stop the book partway (stop rules unchanged).

## 6. Do not

- No paid call before Codex PASS.
- No change to the 0.70 identity bar, models, caps or judges.
- No edit of the story, plan, review or earlier records.
- No production or Wizard change, and no push or deploy.
