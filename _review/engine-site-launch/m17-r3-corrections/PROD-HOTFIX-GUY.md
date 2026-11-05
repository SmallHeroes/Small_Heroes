# M17 reviewed-procedure correction (R3-11); prepared only

Supersedes the execution procedure in M14. The M14 patch/manifest remain unchanged and must be reviewed independently before any production action. No production action is authorized here.

STATUS: M15 PRODUCTION HOTFIX HANDOFF DONE
HEAD: 36bd62daf98cc73c1b3e49a2f3c3b23548d4bddd
Summary 1/5: גיא, זהו תיקון אבטחת תשלום מצומצם ומוכן בלבד לפרודקשן; הוא לא מחבר את מנוע הספרים החדש לפרודקשן.
Summary 2/5: האימות נקשר למכירה השמורה, להזמנה, לסכום ולמטבע; טיפוסי שדות מתאימים מתקבלים בלי עיגול או ניחוש.
Summary 3/5: redirect חוזר לא יוכל להחיות הזמנה שנכשלה ולהפעיל שוב יצירה; המחיר וזרימת הבנק הקיימים אינם משתנים.
Summary 4/5: לפני משלוח יש לאמת בלוגים מורשים שה־webhook הוא שמסמן תשלום, ולא להסיק זאת רק מהודעת “Received” או “Payment verified”.
Summary 5/5: ה־patch עבר 17 בקרות offline בלבד. לא נקראו לוגים חיים, לא הוחל תיקון, לא נוצר ענף פרודקשן ולא בוצעו push או deploy.
Guy decisions: יישום בענף נפרד, בדיקות, ביקורת, push ו־deploy הם פעולות נפרדות של גיא בלבד. ה־re-gate העצמאי של M14/M15 עדיין ממתין.

## What changes

Prepared patch: [PROD-PAYME-HOTFIX.patch](PROD-PAYME-HOTFIX.patch).

- Exact base: local `origin/main@ed1da86cc114a767dc1086b71a30a4ef4595c097`, not this engine/site branch.
- SHA-256: `522044285a813b7d2cd0317d15b93e0d0c57e11cdbddd58720f3f56d3d82287c`.
- Exactly two files: `lib/payme.ts`, `app/api/payme/return/route.ts`.
- The return verifier selects the **stored sale id** and requires one matching item with exact order reference, frozen charged integer-agorot amount and ILS. Safe number/string forms, currency case/alternate field and the generate-sale 50-character order reference are accepted; fractional/foreign/ambiguous/root-fallback proof is refused.
- The return paid CAS permits draft/pending_payment, excludes failed. Replaying a return URL cannot revive that failed order and retrigger generation.
- Existing production imports, coupon/frozen amount and legacy price behavior remain. No new personal-engine flow, webhook redesign, bank reconnection or source-branch merge is included. Optional production `queryPaymeSale` tightening remains separate; its historical root/first-item fallback is not silently fixed here.

## Mandatory pre-deploy check: prove the payment-marking path

Guy or an authorized infra reviewer performs this in the actual current Production deployment's Runtime Logs, with INFO-level retention and complete request history. Codex did not access them. Use the route/request filters and one authorized historical order/sale correlation; do not paste customer/contact/card/raw webhook data into chat. Record only the finding and sanitized correlation/reference.

1. Filter **POST `/api/webhooks/payme`**, JSON logger context `subsystem=payme-webhook`, `route=/api/webhooks/payme`. Look for this exact sequence for the same orderId/transactionId and invocation/time window:
   - `[PayMeWebhook] Received` — request receipt only.
   - `[PayMeWebhook] Payment verified`, with `verifiedBy: signature` (or explicitly identified existing IP-only fallback) — origin/status acceptance only.
   - **`[PayMeWebhook] Order marked paid`** — emitted after the money transaction resolves.
   - `[PayMeWebhook] Generation triggered` — emitted BEFORE awaiting the trigger; it is not proof that job creation succeeded. Check for `[PayMeWebhook] Generation trigger failed` and the durable job separately.
2. Correlate **GET `/api/payme/return`**, logger context `subsystem=payme-return`, `route=/api/payme/return`, and exact text **`PayMe redirect verification attempted`** with `verified`/`status`. Also inspect `UNSAFE redirect trust mode accepted paid state (dev only)` and `PayMe redirect processing failed`. A redirect verification log alone does not prove that its CAS won. These exact contexts were verified at the pinned local production base; check that the actual deployed revision agrees.
3. Establish that this order was unpaid before the webhook transaction and first became paid in that webhook window, **before any return route could claim the paid transition**. Use the authorized existing state/audit timeline and PaymentRecord.paidAt, and complete same-order request chronology. A useful controlled sandbox qualification leaves the return URL unopened until the webhook has committed; that requires separate sandbox authority and is not performed here.
4. Important source limit: the production webhook's `Order marked paid` message can ALSO be emitted while recovering an already-paid order. It logs `shouldTriggerGeneration`, not the paid CAS count. Therefore that one log line, an HTTP 200, or absence of a redirect log in incomplete retention is **not conclusive**. `[PayMeWebhook] Duplicate transaction replay ignored` and `No generation trigger needed` are also not evidence of the first transition.
5. If the complete timeline cannot distinguish webhook-first from redirect-first, record **NOT CONFIRMED and hold deployment**. Obtain a separately authorized controlled account test or a separately reviewed observability change. Do not enable redirect trust or infer the answer. Retain a sanitized real sandbox get-sales fixture with actual field names/types/order/status/agorot/currency before shipping the strict verifier.

Check this against the **actually deployed production revision**, not merely local origin/main. No production logs/state were inspected in M14/M15. The explicit precondition matters because this patch fails closed when proof is absent and can leave payment confirmation waiting for the webhook.

## Owner-only local branch/application steps — prepared, not executed

Do not apply this patch to the engine/site branch or its worktree. The block creates a NEW branch/worktree from the exact origin/main base and stops if that local ref has changed. Guy may refresh remote refs separately; a different base requires renewed applicability/review rather than an automatic forced apply. Choose an unused target directory and branch; the command never overwrites an existing one. It does not merge, push or deploy.

```powershell
$sourceRoot = 'C:\GNart\Work\sh-engine-site-launch'
$hotfixRoot = 'C:\GNart\Work\sh-payme-hotfix-20261105'
$package = Join-Path $sourceRoot '_review\engine-site-launch\m14-qa-r2-fixes'
$patch = Join-Path $package 'PROD-PAYME-HOTFIX.patch'
$expectedBase = 'ed1da86cc114a767dc1086b71a30a4ef4595c097'
$ErrorActionPreference = 'Stop'

function Run-Native {
  param([string]$Exe, [string[]]$Arguments)
  $oldPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & $Exe @Arguments; $code = $LASTEXITCODE }
  finally { $ErrorActionPreference = $oldPreference }
  if ($code -ne 0) { throw "$Exe exit=$code; stop and inspect" }
}

function Get-HotfixFileHash([string]$LiteralPath,[string]$Algorithm) {
  if ($Algorithm -ne 'SHA256') { throw 'Only reviewed SHA256 is supported' }
  $hasher=[Security.Cryptography.SHA256]::Create()
  try { return [pscustomobject]@{Hash=[BitConverter]::ToString($hasher.ComputeHash([IO.File]::ReadAllBytes($LiteralPath))).Replace('-','')} } finally { $hasher.Dispose() }
}

if ((Get-HotfixFileHash -LiteralPath $patch -Algorithm SHA256).Hash.ToLowerInvariant() -ne
    '522044285a813b7d2cd0317d15b93e0d0c57e11cdbddd58720f3f56d3d82287c') { throw 'Patch hash mismatch' }
$base = (& git -C $sourceRoot rev-parse origin/main | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $base -ne $expectedBase) { throw 'origin/main changed; obtain a newly reviewed patch' }
if (Test-Path -LiteralPath $hotfixRoot) { throw 'Choose a new unused worktree path' }
Run-Native 'git' @('-C', $sourceRoot, '-c', 'core.autocrlf=false', 'worktree', 'add', '-b',
  'codex/payme-proof-hotfix-20261105', $hotfixRoot, 'origin/main')
Set-Location -LiteralPath $hotfixRoot
Run-Native 'git' @('-c', 'core.autocrlf=false', 'apply', '--check', $patch)
Run-Native 'git' @('-c', 'core.autocrlf=false', 'apply', $patch)
Run-Native 'git' @('diff', '--check')

# Before tests, bind the actual applied files to the reviewed planned blobs.
$manifest = Get-Content -LiteralPath (Join-Path $package 'PROD-PAYME-HOTFIX.json') -Raw | ConvertFrom-Json
foreach ($entry in $manifest.plannedBlobs.PSObject.Properties) {
  $actual = (Get-HotfixFileHash -LiteralPath (Join-Path $hotfixRoot $entry.Name) -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $entry.Value) { throw "Applied bytes differ: $($entry.Name); inspect EOL/content, do not bypass" }
}

# Fresh independent dependencies in this NEW worktree; never delete/modify the engine junction host.
# Review install hooks first; use the normal lockfile/client-generation process on this clean target.
Run-Native 'npm.cmd' @('ci')
Run-Native 'node' @('node_modules/typescript/bin/tsc', '--noEmit')
Run-Native 'node' @('node_modules/vitest/vitest.mjs', 'run',
  'lib/__tests__/money-truth.spec.ts',
  'lib/__tests__/payment-generation-trigger-isolation.spec.ts',
  'lib/__tests__/recovery-providers.spec.ts',
  'lib/__tests__/payment-refunds.spec.ts')
Run-Native 'node' @((Join-Path $package 'verify-production-hotfix.cjs'))
Run-Native 'git' @('diff', '--check')
Run-Native 'git' @('diff', '--stat')

# Only after inspection, tests and the required independent hotfix review:
Run-Native 'git' @('--literal-pathspecs', 'add', '--', 'lib/payme.ts', 'app/api/payme/return/route.ts')
Run-Native 'git' @('diff', '--cached', '--check')
Run-Native 'git' @('diff', '--cached', '--stat')
Run-Native 'git' @('commit', '-m', 'fix(payme): bind return proof and prevent failed-order replay')
Run-Native 'git' @('rev-parse', 'HEAD')
```

These four specs exist at the pinned production base; the engine branch's new payme-proof.spec does not. No future production-worktree result is claimed. A failing install/typecheck/spec must be diagnosed and recorded before commit/shipping. The prepared 17-case VM proof reconstructs the reviewed production blobs from immutable Git originals; the explicit applied-file SHA check above is what binds that proof to the new worktree's actual bytes. It is not a live merchant/account test or a whole production integration test. Preserve all failures; do not substitute a branch's green run for the target run.

Guy/Claude may inspect staged paths before commit; exactly those two files must be staged, and no unrelated index entry may be included. The fresh worktree avoids mixing current engine changes with the production patch. If a target already has staged/dirty files, preserve them and stop. No cleanup/delete or forced worktree operation is implied.

## Review, shipping and rollback ownership

Have Claude independently review the exact origin/main-base-to-hotfix-commit range, the applied blobs, forged/foreign/fractional proof controls and failed-order replay/zero generation trigger. Check the actual account fixture and webhook-first evidence above. M14/M15's independent full-engine re-gate remains a separate pending gate.

**Push and deployment are Guy's alone.** No push/deploy command is issued or executed here. Guy decides target, timing, production log verification and rollout/rollback after the independent review. A rollback is a reviewed revert/previous deployment under his authority, preserving payment/refund receipts; it would restore the old proof/replay vulnerability and is not a silent operational default. Do not roll back bookkeeping or retry customer charges to test this patch.


R3 pre-existing risk retained: inspect the production WEBHOOK paid-transition status list for failed/refunded order revival. Do not treat return-route protection as proof that the webhook cannot revive a failed order. This package does not apply or enlarge the separate production patch.
