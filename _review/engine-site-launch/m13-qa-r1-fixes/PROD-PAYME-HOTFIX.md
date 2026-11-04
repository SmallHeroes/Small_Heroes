STATUS: M13 PROD PAYME PATCH PREPARED DONE
HEAD: 3185919b42c493b0f56c4d67867aef1fa1798a89
Summary 1/5: PROD-PAYME-HOTFIX.patch is a separate minimal Q1 verifier/return correction against origin/main@ed1da86cc114a767dc1086b71a30a4ef4595c097.
Summary 2/5: Only lib/payme.ts and app/api/payme/return/route.ts change in that patch; no engine dependency, bank price/SKU, deploy or migration is included.
Summary 3/5: Verification uses the stored sale, its own order reference, frozen amount and ILS; no root/first-list/browser-chosen proof fallback.
Summary 4/5: Nine synthetic cases exercise the planned production functions and the patch passes a read-only applicability check against copied original source bytes.
Summary 5/5: The patch has NOT been applied to a production worktree/branch/service, pushed or deployed; its manifest records exact original/planned hashes.
Guy decisions: Any production application/review/deployment is a separate explicit owner action. This package prepares it only.

Read PROD-PAYME-HOTFIX.json and PROD-PAYME-HOTFIX-VALIDATION.json. The verifier function is identical to the reviewed branch's Q1 function after Git newline normalization. The production return keeps that line's existing architecture/imports and adds only server-side selection, amount/currency verification and a stored-payment CAS predicate. It deliberately does not carry engine-site modules or the wider M13 Q10 lifecycle changes. Therefore it is not a claim to fix all old production payment/webhook/deploy concerns.

The dry run uses `git apply --check --directory=<workspace-contained copy>` with original files read from the immutable production ref. No actual patch application or git index mutation occurs. `node _review/engine-site-launch/m13-qa-r1-fixes/verify-production-hotfix.cjs` repeats the offline proof: synthetic VM globals deny unknown modules and use a synthetic environment/fetch; no inherited credential or provider constructor is available.

Q1's browser-selected/status-only acceptance is confirmed in source and synthetic reproductions. PayMe ignoring the old unknown filter, and any actual exploitation, remain unverified. [Official List Sales documentation](https://docs.payme.io/payments/query-apis/post-get-sales) supports the selected filter and sale-binding fields; it is not a live merchant-account test.
