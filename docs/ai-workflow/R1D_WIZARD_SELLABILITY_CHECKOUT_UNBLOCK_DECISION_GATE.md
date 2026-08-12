# R1D Wizard Sellability Checkout Unblock — Decision Gate

## 1. Proposed change

Restore the customer Wizard's product-card availability contract: a direction is available for selection when the matrix marks it `sellable`. Keep `selectable`, QA-authoring readiness, Production render qualification, and candidate identity as separate internal readiness metadata.

## 2. Why now?

On the QA site, all three product cards are disabled as “coming soon”, so the flow cannot reach order creation or fake checkout. Runtime logs contain Wizard traffic but no `/api/orders` or `/api/checkout` request for the reproduced session. The deployed client currently gates product cards on `selectable`; that field becomes false when QA catalog/render authority is absent even when the story slot remains product-sellable.

Expected behavior is already defined by `PROJECT.md`: product sellability governs the purchasable slot, while render qualification is a later, independent prerequisite for a paid image call.

## 3. Scope

General customer-flow correction. It is not story-, child-, companion-, direction-, or environment-specific.

## 4. Risk of hardcoding

No story literals or special slot exceptions are allowed. Both product-card rendering and restored-selection validation must consume the typed `sellable` field for every matrix direction.

## 5. Files likely affected

- `public/JS/wizard.js`
- Wizard matrix/client contract tests under `lib/__tests__/`
- `CURRENT.md`
- this Decision Gate and its implementation evidence

No dependency or lockfile change is permitted.

## 6. Expected behavior after change

- A `sellable: true` direction remains selectable by a customer even when internal `selectable`/QA/render metadata is false.
- A `sellable: false` or missing direction remains disabled and cannot survive restored-state validation.
- `/api/orders` remains the server authority and continues to enforce `enforceMvpOrderSlot`.
- Fake-payment flags, authentication, checkout behavior, pricing, QA catalog exposure, render qualification, and Production safety remain unchanged.

## 7. Validation plan

1. Direct regression coverage for both customer gating sites in `wizard.js`.
2. API contract proof that Production can report `sellable: true` while internal `selectable: false`.
3. Existing fake-payment gate suite.
4. Existing matrix/readiness and MVP matrix suites.
5. Deterministic `npx tsc --noEmit` and literal `npm run check` once.
6. Independent Claude Code read-only adversarial review of the immutable base-to-head range.

No full book, image, payment, order, or database write is needed.

## 8. Cost impact

`$0`. No provider, model, image, audio, Vision, payment, or storage call.

## 9. Rollback plan

Revert the focused local commit. The deployed QA site remains unchanged unless a separate reviewed deployment is explicitly authorized.

## 10. Review assignment

Guy's product intent is explicit: investigate and fix the blocked pre-payment flow. The canonical product/render gate separation resolves the implementation decision without a new product choice.

Claude Code must try to falsify that:

- customer availability is controlled only by product sellability;
- non-sellable/missing directions still fail closed;
- server-side order enforcement and fake-payment safety are unchanged;
- no QA/render authority was weakened or reclassified;
- no unrelated Reader, story, Blueprint, Wizard copy/layout, pricing, or deployment behavior changed.

No Claude Cowork review is required because this is a contract regression, not a new UX or creative direction.

## 11. Do not do

- no credential access or environment mutation;
- no order, checkout, payment, database, storage, provider, model, render, or Vision action;
- no change to flags, pricing, authentication, server sellability enforcement, QA/render qualification, stories, companions, Blueprint, Reader, or production generation;
- no dependency/lockfile change;
- no deployment, promotion, merge, push, or branch cleanup.

## Stop-check result

1. General system fix: yes.
2. Cross-story risk: bounded to the shared direction predicate and covered for positive/negative/missing states.
3. Production behavior: customer selection only; server/render gates remain unchanged.
4. Spend: none.
5. Smallest proof: deterministic client-contract, API, matrix, and fake-payment tests.
6. Product decision: already explicit and consistent with canonical architecture.
7. QA falsification: gate separation, fail-closed negative paths, and unchanged payment/render safety.
8. Product/creative consultant: not required.
9. Guy eyeball: after a separately approved QA deployment, traverse one Wizard flow through the product step to the fake-payment page without confirming payment.
