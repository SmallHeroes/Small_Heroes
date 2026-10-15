# Decision Gate: child-likeness probe from a real photo (Lavi), 2026-10-16

**Owner decision:** Guy (AskUserQuestion, 2026-10-16), "Likeness probe first (Recommended)":

> "Small and cheap: from Lavi.png build the drawn reference portrait (Style-01) plus one sample page, and compare them to the real photo. This directly answers 'too cartoony / not identifiable'. It needs a small photo path in the engine (offline, then Codex QA, then a paid call). Estimated API ~$0.1–0.5."

**Context:** Guy's notes.
- The new-book child is too cartoony, and its face has too few identifiable details.
- Its reference was itself a drawing, so the pages matched it.
- The product starts from a real photo.

Developer: Claude Code. QA: Codex. Product acceptance: Guy.

## 1. Proposed change

**A standalone diagnostic script,** `scripts/personal-likeness-probe.ts`, plus its spec. It is not wired into the Wizard, production or the new-book experiment. It runs one pass and makes no retry.

1. **The drawn anchor from the photo:** production's *own* real-photo anchor prompt and references, `buildStage0MethodBPrompt` and `buildStage0MethodBReferences` (layout `photo_only_no_template`).
   - The inputs are the photo plus the Style-01 technique references, in production's reference mode `anchor_photo_style_only` ("Image 1: REAL CHILD PHOTO — PRIMARY identity anchor… NOT a mascot or simplified cartoon").
   - It is rendered with the book engine's model and contract: gpt-image-2, LOW, 1024×1024.
2. **One probe page,** rendered through the engine's real page mode `book_identity` with its 4 references: the anchor, the fox companion card, and the held new-book audition's two design sheets, which serve as neutral world atlases.
   - The scene is configuration data: a calm medium shot in the meadow, with the child's face readable at about 45% of the picture height.
   - The age and gender come from the configuration (Lavi: 7, boy).
3. **Likeness checks** with the engine's existing identity evaluator (`page-child-resemblance-vision`, gpt-4o; the threshold 0.70 is unchanged and only reported here):
   - photo ↔ anchor;
   - photo ↔ page;
   - anchor ↔ page;
   - **a control:** the fictional Itai reference ↔ Lavi's anchor, where a correct evaluator says "different". This tests the evaluator's discrimination (Q2).
4. **A local viewer** (`probe.html`): photo | anchor | page, with each check's decision, features and score. **Guy's eye is the verdict**; the automated scores are diagnostic only.

**Shared-code change (one line, plus a test):**
- The engine's metered render adapter (`auditionAdapters`) also accepts production's existing reference mode `anchor_photo_style_only`.
- Model, quality, size, reference cap and pricing contract are all unchanged.
- No current caller uses the mode, so every existing render stays byte-identical.

## 2. Why now

Guy's product note. Likeness to a real child is the core of the product. The engine has never been tested against a real photo: the experiment refuses photos by design (`new_book_request`, `audition_request_binding`).

## 3. Scope

One-off diagnostic and test. It reuses production's general anchor prompt and the engine's general page mode. Nothing child-specific enters shared code: the photo path, age, gender, scene and reference files are configuration (in the scratchpad, never committed).

## 4. Hardcoding risk

The scene is data, not code; the anchor prompt is production's. The world atlases come from one existing book, as named inputs (a probe artefact, stated plainly).

## 5. Files

- `scripts/personal-likeness-probe.ts` (new)
- `lib/personal-wizard/__tests__/likeness-probe.spec.ts` (new)
- `scripts/personal-simple-book-reviewed-audition.ts` (the one accepted mode)

No change to `lib/generation-pipeline/*`, the Wizard, Style-01 text, judges, thresholds or the experiment.

## 6. Expected behaviour

- **Without `--execute`:** the dry run prints the prompts, the references (names and hashes only), the reservations and the cap fit. It reads no key.
- **With `--execute`:** 6 paid calls. Each has its own claim, wire, result and receipt (images are recorded by hash; no photo bytes in the records). The run writes the anchor, the page and the viewer.
- **Stop rules:** any provider error or an unknown cost stops the run. There is no retry and no second attempt.

## 7. Validation

**Offline:**
- a synthetic photo and synthetic sheets with stubbed providers;
- the dry run reads no key;
- the prompts equal production's anchor prompt plus the probe's page prompt;
- the reference order and modes;
- the cap refusal;
- the records and the viewer;
- the new adapter mode, with legacy renders unchanged (the existing audition specs).

**Paid** (after Codex PASS): the run above. **Offline tests cannot judge likeness**; Guy's comparison does.

## 8. Cost (measured by the real dry run, no call)

- **Calls:** 2 renders (~$0.06–0.08 actual each, LOW) + 4 identity checks (~$0.006 actual each).
- **Expected actual spend:** ≈ $0.15–0.20, inside Guy's ~$0.1–0.5.
- **Reservations:** the meter reserves each call's *worst case* before sending it.

  | call | reservation |
  |---|---|
  | anchor | $0.480384 |
  | page | $0.522280 |
  | each identity check | $0.05 |

  A call is admitted only if its reservation fits beside the spend settled so far.
- **The ceiling must therefore be at least about $0.65**, so the page can be admitted after the anchor. **Proposed hard ceiling: $0.70.** This is a reservation ceiling; the real spend stays ≈ $0.15–0.20. **Guy confirms** (it exceeds the $0.5 upper end of his estimate as a ceiling, not as expected spend).
- **Ledger:** its own, starting at $0; separate from the new book's $7 and its $1.059077 remainder.
- **Claude Max:** none.

## 9. Rollback

Delete the script and spec; revert the one adapter line. The output folder is local and can be deleted by Guy.

## 10. Privacy

- **Where the photo goes:** it is sent only to OpenAI (the image edit and the identity checks), as production does today.
- **Where it is kept:** only in the probe's output folder outside the repository (`C:/GNart/Work/book-renders/likeness-probe-lavi-20261016/`, as a byte copy the metered adapter requires). It is never put in the repository, `_review`, logs, tests or a published artefact.
- **Other children:** none. The control uses the fictional Itai.

## 11. Review and decisions

- **Guy** (defaults in brackets):
  - Lavi's age [7, from the 10/6 notes; please confirm, since the anchor's age lock uses it];
  - the $0.70 reservation ceiling (section 8);
  - the scene [a calm medium shot in the meadow beside the fox];
  - LOW only [yes; HIGH is a later, separate approval];
  - whether to add production's anchor style check (gpt-4o, "no mascot/chibi") as a 7th call [not in v1].
- **Recorded for later, unchanged here:** production's anchor negative prompt (`STYLE_01_AVOIDANCE_NEGATIVE`) carries old book-specific lines ("No green dragon (Dini is copper-orange)…"). The probe sends it exactly as production does.
- **Codex:** QA of the script, the adapter line, privacy handling, stop rules and records before any paid call.

## 12. Do not

- No Wizard, production or experiment change. No 0.70 change.
- No retries, no HIGH, and no full book.
- No publishing or committing of the photo or derived images.
- No use of other children's photos.
