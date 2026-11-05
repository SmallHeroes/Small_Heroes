STATUS: M14 PROD PAYME PATCH PREPARED DONE
HEAD: f4dd9d46c35b871d02934a577cb4490fd0073b6c
Summary 1/5: Regenerated the separate minimal Q1 production patch against verified local origin/main@ed1da86cc114a767dc1086b71a30a4ef4595c097, with both required R2 changes.
Summary 2/5: Exact sale/order/frozen-agorot proof now tolerates safe numeric strings, ILS case and sale_currency ?? currency, and binds the actual50character generate-sale order reference.
Summary 3/5: The production return paid CAS excludes failed; replay cannot revive the failed order or trigger generation.
Summary 4/5: The old M13 prepared patch fails6 of17 new synthetic cases; M14 passes17/17 plus the read-only applicability check against copied original files.
Summary 5/5: Prepared only. No patch application, live merchant query, key/env read, production edit, index/commit/push/deploy or service operation.
Guy decisions: Before any shipping, confirm from authorized production logs that the webhook marks orders paid; separately approve review/application/deployment. No such action was performed here.

Files in the patch: `lib/payme.ts` and `app/api/payme/return/route.ts`. The production return retains its own architecture/imports. This is not the branch's whole checkout/webhook/exception integration. Read `PROD-PAYME-HOTFIX.json` for exact original/planned blobs and the raw patch hash. The optional production queryPaymeSale tightening is not included; its historical root/first-item fallback remains a separately recorded limitation. The branch retains M13's strict refund-sale query.

`node _review/engine-site-launch/m14-qa-r2-fixes/verify-production-hotfix.cjs` reconstructs planned source from immutable original Git blobs, validates exact hashes, executes the actual planned verifier/return in a synthetic VM denying unknown modules, and runs `git apply --check` against a workspace-contained copy. It never applies a patch or changes the index. The failed-return test evaluates the actual CAS status predicate and asserts zero transitions and zero generation triggers. Type tolerance still refuses a foreign sale/order/currency, fractional/invalid money, provider failure, ambiguous items and root fallback.

`--baseline-m13` reads the historical M13 manifest/patch and committed pre-M14 verifier without changing them. `PROD-PAYME-HOTFIX-BASELINE-RED.json` preserves its five normalization refusals and the failed-order revival/trigger. This is synthetic proof of those code paths, not observed exploitation or an actual merchant-account response fixture.

No sandbox fixture was invented as a live observation. Before activation, an authorized owner must retain a sanitized real sandbox get-sales fixture covering the merchant's returned field names/types, order reference, status, price and currency. Confirm the sale-expiry behavior and the payment-marking webhook in that account. Those account/log operations require separate authority and are listed in ACTIVATION-CHECKLIST.md.

Reference: [PayMe List Sales](https://docs.payme.io/payments/query-apis/post-get-sales) documents the exact sale filter, nonunique order query and agorot fields. No PayMe API was called.
