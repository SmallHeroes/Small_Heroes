# Simple story engine: matched four-book trial, factual closeout (2026-10-07)

Documentation-only record of Guy's approved matched trial. Claude Code wrote this record as sole writer of
`codex/claude-simple-story-literary-20261007` for this docs action only, at clean HEAD `caf1db00`. All book stages and reviews had
ended before it started. This is a factual record, not a new literary review and not an independent PASS.

Artifacts (absolute paths):

- Reading report (Hebrew): `C:/Users/guyna/.codex/visualizations/2026/09/04/01a06c5c-a233-76c0-ac8e-618c02ce6246/simple-story-matched-four-20261007/COMPARISON_REPORT_HE.md`
- Verification: `C:/Users/guyna/.codex/visualizations/2026/09/04/01a06c5c-a233-76c0-ac8e-618c02ce6246/simple-story-matched-four-20261007/verification.json`
- Preservation: `C:/Users/guyna/.codex/visualizations/2026/09/04/01a06c5c-a233-76c0-ac8e-618c02ce6246/simple-story-matched-four-20261007/preservation-after-books.json`
- The report names `BLIND_READING_SEALED.json` and `blind-key.json` in the same folder. This docs call did not read them or rerun
  anything.

## What ran

- Four fictional books in two matched pairs. Each pair has the same brief, seed, skeleton, age, companion and length:
  - Tom, 4, with Momo, 8 spreads, no theme (`tom4-fun-momo-8-v2`).
  - Itai, 8, with Leo, 12 spreads, confidence theme (`itai8-confidence-leo-12-v2`).
- Arms: baseline frozen at `0a845285`, follow-up at `caf1db00`. No source change, no manual story edit.
- 8 native author/editor stage dispatches. All succeeded with known cost and confirmed closed, no retry. Reported model
  `claude-opus-5-5`, fresh editor processes. The internal provider request count is unverified.
- Every saved text matches its receipt (`sourceTextExact: true`). Word counts are inside target. Only soft flag:
  `niqqud_in_prose` in all four.
- Adding provenance to Itai's theme gave a new input identity in both arms, so his skeleton is "strange guest", not the chase of the
  earlier sample. No old evidence was changed to keep the old skeleton.

## Blind reading (root, label-blind, sealed before the key)

| Book | Profile | Arm | Short note |
|---|---|---|---|
| A | Tom/Momo | follow-up | Growing rumour, concrete fix; Momo mostly complicates; generic ending. |
| D | Tom/Momo | base | Preferred in pair: two/teeth wordplay, comic escalation, group help. |
| B | Itai/Leo | base | Preferred story: real journey. But invents unapproved history ("never built without a booklet", "never climbed, always sat on the bench"); the editor kept it. **Not product-ready.** |
| C | Itai/Leo | follow-up | Original guest and humour, less categorical invented history; weaker journey (spreads 5–12 mostly one room) and an unclear cause for the resolution. |

- No proven overall literary improvement and no production adoption of the follow-up prompts.
- Do not roll back the factual-discipline rules (child facts, varied agency) and do not hand-fix the four books.
- Most quality is already in the drafts. Editors made local improvements and did not fix B's biography or C's journey.
- Both Momo premises converge on beach, sand dinosaur, misunderstanding and a crowd of sea creatures. One sample per profile and
  arm cannot attribute effects statistically.
- C's prose gives Leo four legs, a known visual-canon issue. Text is preview only (`runtimeEligible:false`,
  `pending_product_review`): no storyboard or render approval.

## Cost (Max list-equivalent estimates, not an API invoice)

| Item | USD |
|---|---:|
| Base arm, 2 books / 4 stages | 1.064173 |
| Follow-up arm, 2 books / 4 stages | 1.078073 |
| Book stages total | 2.142246 |
| Preflight review, first session (hit its 0.2 sub-cap, no verdict delivered) | 0.277259 |
| Preflight review, completion | 0.3617536 |
| Preflight counted conservatively as both | 0.6390126 |
| Conservative total | 2.7812586 |

- Inside Guy's new $10 cap. The old engineering $4 cap was not renewed. The preflight stop happened before any book and was not
  presented as a PASS.
- This docs call has a $0.5 cap inside the same $10, released after all books ended. Its usage is pending its receipt.

## Gates and preservation

- Full repo gate stays RED: 10 known ordinary assertion failures and 3 resource-lane RPC timeouts. Not rerun, because code is
  unchanged.
- 314 Claude evidence files and 650 historical entries unchanged (hash, size, timestamp). All six protected worktrees clean.
  Provider calls, key reads and source edits during the preservation check: 0.
- The browser tool blocked `file:` pages, so no automated visual inspection. The Markdown files are the usable local alternative.
  Opening the panel was queued, not confirmed.

## Still open

- Guy's own reading, enjoyment and product decision.
- No new paid experiment is authorized. A later focused test (skeleton versus profile as the source of variety, richer profiles)
  needs a new approval.
- Still blocked: wizard, production and current-storyboard integration, rendering, push, merge, deployment.
