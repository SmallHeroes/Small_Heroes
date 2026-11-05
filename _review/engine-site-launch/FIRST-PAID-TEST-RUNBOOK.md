STATUS: M19 CORRECTED FIRST PAID TEST RUNBOOK — PREPARE ONLY / INDEPENDENT QA PENDING
HEAD: 36bd62daf98cc73c1b3e49a2f3c3b23548d4bddd
Summary 1/5: זהו מדריך מוכן בלבד לספר פנימי אחד, עם ילד בדיוני, בסביבת Preview בפרויקט staging נפרד, עם שער גישה אפליקטיבי (בחירת גיא A).
Summary 2/5: לפני הפעלה נדרשים commit סופי, re-gate עצמאי של Claude Code, build תקין והוכחת פרטיות ותשלום ביעד המאושר.
Summary 3/5: ההצעה לאישור גיא היא USD 10 ועד 121 קריאות לוגיות; אין כאן אישור הוצאה, הבטחת השלמה או תקרת חשבונית של הספק.
Summary 4/5: המוצר קבוע: LOW, מחיר 59 ש״ח, כריכה ושמונה עמודים, קריינות ו־PDF; כל הגייטים והספים נשארים.
Summary 5/5: לא הופעלו כאן SQL, cron, worker, ספק, תשלום או פריסה. כל הדגלים בקוד נשארו כבויים כברירת מחדל.
Guy decisions: יש למלא יעד, SHA סופי, בעל תשתית, מזהי מפעיל ו־GO מתועד לפני שימוש. הספר הראשון עדיין ממתין לאישור העין של גיא לפני משלוח.

## 1. Freeze the one-test target and authority

Use ONE new application-gated Vercel **Preview** deployment in a dedicated STAGING Vercel project of the final independently reviewed engine/site commit, an isolated staging Supabase project/database, a dedicated clean long-worker checkout of that identical commit, PayMe sandbox, and an internal recipient mailbox controlled by Guy. Paid here means real AI/TTS usage; sandbox payment does not establish a real 59 ILS merchant settlement. A real card/merchant charge requires its own explicit approval. Do not use the current production project/domain/database, the source worktree, or the shared node_modules junction as the executor.

The target has not been provisioned or selected in this task. Before any activation, Guy/infra records these concrete values in a private run record: Vercel project/deployment id and stable HTTPS branch alias or custom-domain origin, Supabase project ref and server database role, long-host identity, actual final Git SHA, merchant sandbox identity, internal owner user id/email, operator user id, approval reference/actor/UTC time, USD/call ceilings and stop owner. No key value, cookie, OTP, raw photo or signed URL belongs in that record or chat.

Preconditions: owner commit of M15, Claude's whole relevant `6a223a28..FINAL_SHA` re-gate and fixes, complete positive production recipe/readmission composition, successful Linux production-like build and NFT/native-media/bundle qualification, then protected browser/auth/private/payment/cron smoke. M15's Windows build attempts are not Linux proof; see its BUILD-PROOF report. Pending proof is a stop, not a reason to turn off a gate. Confirm both web and long host run FINAL_SHA; do not activate using the M14 base SHA shown above.

Guy chose option A (2026-11-05): a dedicated staging project and stable Preview branch alias/custom domain, without platform Deployment Protection for THAT isolated test project, with the default-off application access gate enabled. Never change the current production project's protection. The application gate protects every path using Basic access for Guy's browser and a separate internal header for worker/cron traffic. Only POST to the exact /api/webhooks/payme path passes the transport gate; that handler still authenticates the PayMe signature and exact stored sale/order/amount/ILS proof. An unsigned webhook must refuse. No platform bypass token in a URL/header, customer URL or logs. Record ENGINE_SITE_STAGING_HOST as the stable alias/custom-domain host, also used by APP_URL/NEXT_PUBLIC_APP_URL/long-host self-calls. Internal staging calls use this recorded host even when VERCEL_URL differs on every deployment. Unknown aliases or wrong hosts fail closed. Verify browser gate, anonymous API denial and cross-parent authorization before paying. Use fictional description mode, no real photo.

## 2. Configure deployment/host variables without local .env files

Option A requires ENGINE_SITE_ENVIRONMENT=staging, ENGINE_SITE_STAGING_ACCESS_ENABLED=true, ENGINE_SITE_STAGING_HOST=<approved stable branch alias or custom-domain host>, ENGINE_SITE_STAGING_USER=<dedicated ASCII test login>, ENGINE_SITE_STAGING_PASSWORD=<random32+ character ASCII secret, letters/digits/._~- only>. Inject these only through approved secret managers on web, long host and scheduler. They do not enable intake/providers. VERCEL_ENV stays preview; production-domain or platform-production activation of this gate refuses. Browser Basic access is additional to the normal parent/operator session, never a substitute. Worker/cron use x-smallheroes-staging-access: Basic <base64(user:password)> alongside their unchanged Authorization: Bearer secret. Do not log either header. A push that moves the branch alias is a deployment and must follow the drain-before-change rule, even if the hostname is unchanged.

Before any payment, with intake/providers still disabled and no pending work, run one authorized provider-free self-chain smoke through the exact recorded host and unchanged internal authentication. Confirm it reaches the intended deployment/revision (not only a syntactically valid URL), that the gate accepts the internal request and rejects missing access, and that the worker refuses a nonexistent synthetic order without creating an order/job or calling a provider. An unreachable/wrong alias is a stop. No such live smoke is executed by this prepared guide.

Provision secrets only through the approved deployment/host secret manager. The long host uses injected process variables; no key in command arguments, source, reports, shell tracing or local env files. Web and long host must share the same project, source revision, policy and origin. Keep activation flags false until all later prerequisites and Guy's separate GO are recorded.

| Variable | Required value / purpose |
| --- | --- |
| `NODE_ENV` | `production` on both deployed runtimes. |
| `VERCEL_ENV` | Actual web platform value `preview`; long host is non-production, leave unset or use `preview`. Never pretend production to bypass separation. |
| `VERCEL_GIT_COMMIT_SHA` | Platform-provided FINAL_SHA on web. If present on the long host it must also match. |
| `ENGINE_SITE_SOURCE_REVISION` | FINAL_SHA, especially on the long host. The platform SHA takes precedence. |
| `NEXT_PUBLIC_APP_URL`, `APP_URL` | Identical approved Preview HTTPS origin, no path/query/credentials. No production host. |
| `VERCEL_URL` | Platform-provided changing deployment host. Ignored for gated staging dispatch, which always uses ENGINE_SITE_STAGING_HOST. |
| `INTERNAL_WORKER_BASE_URL` | Same approved origin on long host / non-Vercel runtime. Check effective target, not only this value. |
| `DATABASE_URL`, `DIRECT_URL` | Staging project's server-role pooled/direct DSNs. Must match SUPABASE_URL; no `host`/`hostaddr` override. Role must retain server access after RLS/revocation. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Same isolated staging project, server-only. Runtime binds DB and Storage project refs before constructing Storage. |
| `OPENAI_API_KEY` | Approved project access for existing Responses/review/identity/image code. No new model routing or quality override. |
| `ANTHROPIC_API_KEY` | Approved Anthropic API account; existing Opus author design. |
| `ELEVENLABS_API_KEY` | Approved account with the selected canonical voice available. Voice ids come from backend/config/voices, not a new invented env override. |
| `PAYMENT_PROVIDER` | `payme`. |
| `PAYME_API_BASE_URL`, `PAYME_API_KEY` | Authorized **sandbox** endpoint and seller credential; verify account's actual endpoint. Do not substitute production credentials. |
| `PAYME_WEBHOOK_SECRET` | Sandbox signing secret matching PayMe's configured callback. Signature proof is required for personal paid callbacks. |
| `PAYME_CHECKOUT_PAGE_ORIGIN` | Account's qualified sandbox checkout origin if generate-sale returns relative URLs; otherwise omit. |
| `PAYME_WEBHOOK_ALLOWED_IPS` | Optional documented merchant allowlist; not a replacement for personal signed-proof verification. |
| `PAYME_WEBHOOK_ALLOW_IP_FALLBACK` | Leave unset/false. No IP fallback activation for this test. |
| `PAYME_VERIFY_PATH` | Leave unset; the strict verifier uses get-sales and its stored sale/order/amount binding. |
| `PAYME_REDIRECT_TRUST_MODE` | `false`. |
| `NEXT_PUBLIC_BUY_MODE` | `live` only inside this protected test deployment when activation is approved; `waitlist` before/after. This does not make a sandbox card charge a production settlement. |
| `ENABLE_FAKE_PAYMENT`, `ALLOW_FAKE_PAYMENTS` | `false`; no fake payment route. |
| `STORY_PROVIDER`, `IMAGE_PROVIDER` | `claude`, `gpt-image` for existing generic env validation. The personal recipe fixes actual author/review/image wires. |
| `DISABLE_IMAGE_GENERATION`, `QA_SOFT_DELIVER` | `false`; no mock image or soft delivery bypass. |
| `EMAIL_PROVIDER`, `RESEND_API_KEY` | `resend`, staging-approved sender credentials. Route all test emails only to Guy's internal account. Qualify the sender in `content`/EMAIL.from and OTP sender, DNS and actual delivery; do not invent a new sender env var. |
| `GENERATION_SECRET` | Separate strong internal worker secret, identical web/long host. Worker self-calls send Bearer + x-generation-secret headers. |
| `CRON_SECRET` | Separate strong secret for authorized GET scheduler calls; never put it in a URL. |
| `ENGINE_SITE_OPERATOR_USER_IDS` | JSON array of actual stable staging `UserAccount.id` values, e.g. `["REPLACE_WITH_GUY_STAGING_USER_ID"]`; not email addresses or client-supplied actors. |
| `ENGINE_SITE_SPEND_POLICY` | Exact JSON below, only after Guy approves real values and exact final revision. No default policy. |
| `ENGINE_SITE_ORDER_INTAKE_ENABLED`, `ENGINE_SITE_CHECKOUT_ENABLED`, `ENGINE_SITE_WORKER_ENABLED`, `ENGINE_SITE_PROVIDERS_ENABLED`, `ENGINE_SITE_LONG_WORKER_ENABLED`, `ENGINE_SITE_READER_ENABLED`, `ENGINE_SITE_FULFILLMENT_ENABLED` | All `false` initially. All must become exactly `true` on the approved target before one checkout; set the corresponding long-host values too. Close intake/checkout again immediately after the single payment/order is confirmed. |
| `READINESS_MANIFEST_ENABLED` | `false`/unset. Personal fulfillment uses its own readiness path; enabling this legacy reactor is not part of the test. |
| `HUMAN_QA_NOTIFY_ENABLED` | `false`/unset. Personal infrastructure holds are reviewed on the personal review surface; this is a different legacy email sender. |
| `ENABLE_PROD_GENERATION` | `false`/unset in Preview. Actual Production additionally requires true, but production activation is excluded here. |
| `SUPABASE_STORAGE_BUCKET` | Existing generic public-path configuration; leave unchanged. Personal assets always use hard-coded private bucket `engine-site-private`, never this public bucket. |

No Stripe/Replicate credentials or historical story-bank activation are required for this personal test. There is no image-quality or price env toggle: the offer/order contract selects LOW / 5900 agorot / eight story pages.

Proposed `ENGINE_SITE_SPEND_POLICY` (placeholders intentionally cannot be activated):

```json
{
  "version": "engine-site-spend-policy/v1",
  "sourceRevision": "REPLACE_WITH_ACTUAL_REVIEWED_40_HEX_FINAL_SHA",
  "maximumMicroUsd": 10000000,
  "maximumCalls": 121,
  "approvalReference": "REPLACE_WITH_ACTUAL_GUY_GO_REFERENCE",
  "approvedBy": "REPLACE_WITH_ACTUAL_APPROVER_ID",
  "approvedAt": "REPLACE_WITH_ACTUAL_UTC_GO_TIME",
  "paidProviderActivation": "owner_approved_live_personal_orders"
}
```

Guy must approve USD 10 / 121 logical calls explicitly; this document is only the proposal. Reservations + known usage enforce the order cap before each new claim. Unknown calls keep their full reserve and never automatically redispatch. Accounting is an estimate, not a provider invoice hard cap. The native LOW anchor plus existing assumptions is USD 6.857428–8.357428 before unmeasured fresh-order overhead; the conservative reserve envelope is USD 82.263104, so USD 10 can stop/refund before finishing. A refunded book still consumes generation cost. Do not increase the cap, change LOW, reduce gates or reset receipts to force completion. MEDIUM measurement remains cancelled.

## 3. Prepare and apply schema/privacy SQL in this order — owner only

None of these commands or files was executed against a service by Codex.

1. Verify isolated project/DSNs/current server role, backup/rollback owner and migration history. The existing schema uses `backend/schema.prisma`. [m15-self-check-build/SCHEMA-MIGRATIONS.json](m15-self-check-build/SCHEMA-MIGRATIONS.json) pins all 51 existing `backend/migrations/*/migration.sql` files in exact lexicographic migration order. On an already migrated staging DB, apply only reviewed pending migrations; never replay init or seed/data repair migrations manually. If history/schema differs, stop for migration reconciliation rather than guessing a subset.
2. On the approved infrastructure host with injected staging variables, inspect `node node_modules/prisma/build/index.js migrate status --schema backend/schema.prisma`. After separate infrastructure authorization, apply pending history with `node node_modules/prisma/build/index.js migrate deploy --schema backend/schema.prisma`. These are prepared instructions, not authority to run them. Required tables include the nine private tables, AtomicOperationReceipt, BookReadiness/Manifest, DeliveryOutbox, ExceptionCase/Audit and RefundAttempt; verify existing input/fence/checkout/lease columns and unique indexes.
3. Create Storage bucket **engine-site-private**, id/name identical, **public=false**, through the approved admin interface. Use limits supporting the runtime's private artifact sizes; no browser upload/read policy for this bucket.
4. Review/apply [m08-private-assets/PRIVATE-STORAGE-SETUP.sql](m08-private-assets/PRIVATE-STORAGE-SETUP.sql): WizardSession RLS/revocation and named restrictive `engine_site_private_server_only` Storage policy. It is not blindly repeatable: if the policy exists, verify its exact restrictive roles/USING/WITH CHECK expression instead of rerunning CREATE POLICY. Preserve unrelated bucket policies.
5. Review/apply [m17-r3-corrections/PRIVATE-DATABASE-SETUP.sql](m17-r3-corrections/PRIVATE-DATABASE-SETUP.sql), which supersedes M13's three-table file and revokes table/column grants on all nine tables. Do not separately apply the older M13 file. Confirm server role access and existing server-only login/payment paths still work; do not restore browser grants to fix a server-role mistake.
6. Run the prepared READ ONLY [m14-qa-r2-fixes/LIVE-PRIVATE-PRIVILEGES-READONLY.sql](m14-qa-r2-fixes/LIVE-PRIVATE-PRIVILEGES-READONLY.sql) in the verified target. Expected: **9 rows**, each `table_present=true`, `rls_enabled=true`, and all four anon/authenticated table/column access booleans **false**. Missing tables, true access or NULL is a stop. Keep only these catalog booleans/project identity in evidence, no session/payment row contents.
7. Prove actual anonymous, cross-parent and forged-session/OTP Data API denials; private bucket/object denial; authenticated owner/operator access; matching DB/Storage project; private signed-URL expiry and no child asset in public URLs. Catalog checks do not establish views/functions/security-definer or deployed access behavior by themselves.
8. Initialize the launch policy through its existing server helper on the clean approved host, after separate authorization for this metadata write. It creates only the missing required-mode default and preserves an existing policy; it makes no paid call. Prepared command (not executed here):

```sh
node --require ./scripts/shims/register-server-only.cjs --import tsx -e '(async()=>{const {prisma}=require("./lib/prisma.ts");const {ensureEngineLaunchPolicy}=require("./lib/engine-site/launch-policy.ts");try{await ensureEngineLaunchPolicy(prisma)}finally{await prisma.$disconnect()}})().catch(()=>{console.error("Policy initialization failed");process.exitCode=1})'
```

For the approved non-spending auth/policy smoke, READER/FULFILLMENT alone may be enabled on the verified empty isolated target; intake/checkout/worker/providers/long remain false. Do not turn on an active-order scheduler to test the policy. Confirm the stored policy is required; initialization does not reset a pre-existing off policy. Change an existing policy only through the audited operator command with expected hash and reason.

## 4. Configure scheduler and long host before payment

Before enabling a production-mode long host, prepare its native archive **on that clean host**, before any order/claim starts. Use its own pinned installed dependencies, never the development junction. Prepared command (not run against infrastructure here):

```sh
node -e 'const root=process.cwd();require("./scripts/lib/native-media-build.cjs").prepareNativeArchive(root);const b=require("./scripts/lib/native-media.cjs").nativeMediaBinaries({root});const cp=require("node:child_process");for(const n of ["ffmpeg","ffprobe"])cp.execFileSync(b[n],["-version"],{stdio:"ignore"});console.log("Native archive prepared and executables verified")'
```

Require both web and long host to preserve the reviewed source/assets and exact native platform hashes. A missing/corrupt archive is a startup stop, not permission to spend first or use raw fallback. No live host is qualified by this prepared command.

**Drain before any deploy, rollback, alias switch or source/policy revision:** close intake/checkout; keep the current matched web/long-host revision until all in-flight orders are settled. Check actual GenerationJob leases, incomplete stages, call claims/results, UNKNOWN/full reservations, delivery/outbox and refund ambiguity. Do not switch the stable alias, terminate the old executor or change source/policy while those remain. If draining cannot complete, stop and obtain an explicit owner migration/terminal decision; the next source-bound sweep can otherwise fail each affected order with a liability. Never reset its clock, receipts or meter. Do not activate a new-order scheduler as a way to inspect an old pending order.

Vercel's own crons run on Production deployments, not Preview. For this **protected Preview**, Guy/infra must provision an external scheduler on the approved host; do not assume vercel.json activates it. See [Vercel cron quickstart](https://vercel.com/docs/cron-jobs/quickstart) and [cron authentication](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

| GET path | Schedule (UTC) | Configured invocation ceiling |
| --- | --- | --- |
| `/api/engine-site/v1/cron/reconcile` | `*/2 * * * *` | 300 s |
| `/api/generate/cron/sweep` | `*/3 * * * *` | 60 s |
| `/api/generate/cron/outbox` | `*/2 * * * *` | 300 s |
| `/api/generate/cron/exceptions` | `*/2 * * * *` | 60 s |

Each call sends `Authorization: Bearer <injected CRON_SECRET>` and `x-smallheroes-staging-access: Basic <base64(injected staging user:password)>`. Never send a query-string secret, follow a redirect to production, or log header values. A 401/403/3xx or missing tick is a stop for payment readiness. Authorize the scheduler destination as the recorded stable staging alias/custom-domain origin, never a per-deployment VERCEL_URL. Keep readiness false so exception draining is personal-only. Do not schedule the unrelated operator-notifications/human-qa-reconcile paths for this one-book test.

Prepared minimal scheduler request body (Guy installs outside the clean application checkout and invokes once per path from the approved scheduler; NOT run here):

```javascript
const allowed = new Set(['/api/engine-site/v1/cron/reconcile', '/api/generate/cron/sweep',
  '/api/generate/cron/outbox', '/api/generate/cron/exceptions']);
async function main() {
  const route = process.argv[2], origin = new URL(process.env.NEXT_PUBLIC_APP_URL);
  if (!allowed.has(route) || origin.protocol !== 'https:' || origin.pathname !== '/' ||
      origin.search || origin.hash || origin.username || origin.password ||
      ['smallheroes.co.il', 'www.smallheroes.co.il'].includes(origin.hostname) || !process.env.CRON_SECRET)
    throw Error('Unapproved scheduler configuration');
  const headers = { Authorization: `Bearer ${process.env.CRON_SECRET}` };
  if (process.env.ENGINE_SITE_STAGING_ACCESS_ENABLED !== 'true' || process.env.ENGINE_SITE_ENVIRONMENT !== 'staging' ||
      origin.hostname !== process.env.ENGINE_SITE_STAGING_HOST || !process.env.ENGINE_SITE_STAGING_USER || !process.env.ENGINE_SITE_STAGING_PASSWORD)
    throw Error('Staging access configuration required');
  headers['x-smallheroes-staging-access'] = 'Basic ' + Buffer.from(process.env.ENGINE_SITE_STAGING_USER + ':' + process.env.ENGINE_SITE_STAGING_PASSWORD, 'utf8').toString('base64');
  const r = await fetch(new URL(route, origin), { headers, redirect: 'manual', signal: AbortSignal.timeout(295000) });
  console.log(JSON.stringify({ route, status: r.status }));
  if (!r.ok) process.exitCode = 1;
}
main().catch(() => { console.error('Internal cron failed; inspect protected logs without printing credentials'); process.exitCode = 1; });
```

Use command `node /srv/sh-ops/personal-cron-once.cjs <ONE_PATH_FROM_TABLE>` in each scheduler entry, with secret-manager environment injection and no shell tracing. Pin the actual host/URL in the run record. The callback GETs can perform paid/job/delivery/refund work once activated; do not use this as a USD 0 diagnostic against an active order.

Long host requirements: complete clean checkout at FINAL_SHA with Git available, independently installed pinned dependencies including tsx, the same canonical styles/fonts/companion sheets, working platform-native ffmpeg/ffprobe, Sharp/Pango/SVG/RTL text/PDF support, private ephemeral temp space, working DB/Storage/provider egress and no process suspension. Install dependencies on that host, never modify this worktree's junction host. Allow at least the existing **25-minute invocation envelope** and heartbeat/lease persistence. Actual selected author can require 1180 + 45 seconds; the generic 780/380/860-second steps also exceed the web chunk. Web chunks remain 270 seconds under their configured 300-second ceiling.

Prepared host command, run only after GO and matching flags/policy:

```sh
cd /srv/sh-engine-internal
node --require ./scripts/shims/register-server-only.cjs --import tsx scripts/engine-site-long-worker.ts
```

The process refuses a wrong HEAD, tracked changes or untracked source in app/lib/backend/scripts. It uses the same GenerationJob, claims, leases and meter, not a second independent queue. Run one supervised host initially; preserve logs, expose no public worker port, inject credentials, disable automatic restarts during incident review. Four-hour inactivity / 24-hour absolute bounds survive restart/resume. A foreign-revision long host skips newer orders; it must not be used to terminate them.

## 5. Qualify PayMe and operator identity before paid AI activation

Register exact sandbox callback `POST <ORIGIN>/api/webhooks/payme` and return `GET <ORIGIN>/api/payme/return`. Confirm signatures and protected routing. Retain a sanitized REAL sandbox get-sales fixture with actual field names/types, sale id, order reference, status, integer agorot and currency. Confirm 45-minute sale expiration behavior, lost reply lookup by transaction_id, five-minute renewal margin, late predecessor capture, webhook/return ordering, idempotency and refund availability. These account checks need separate authorized sandbox/infrastructure work; synthetic fixtures are not real merchant observations.

Log in through the actual OTP/session flow as Guy's staging user; obtain stable UserAccount.id through an authorized internal admin/read-only lookup, not by copying a cookie/hash. Configure that id in ENGINE_SITE_OPERATOR_USER_IDS. After the approved initialization and non-spending flag setup above, verify `GET /api/engine-site/v1/review-policy` returns launch mode **required**. The actual per-book UI is `/personal/review/<ORDER_ID>` after an order exists; the authenticated inbox is `/personal/review`. An unauthorized second internal account must receive denial. Global required/off is audited state in private metadata, not an env boolean. Leave it required for this test.

## 6. Execute exactly one book after separate GO

1. Reconfirm all prerequisites, exact SHA/environment/GO and absence of other active orders. Save starting provider usage totals from authorized account dashboards and starting order-meter counts. No real child/customer data.
2. Apply the approved spend policy and activation flags to this target/host only. Confirm effective revision and worker/scheduler authentication. Do not activate Production or the legacy readiness reactor.
3. In `/wizard/personal`, use a fictional child, description mode, one admitted companion, personal story intent and fictional typed detail, short/eight-page format and one canonical narration voice. The UI must show the offer's 59 ILS inclusive price, no add-on/coupon. Use only the new personal order endpoint.
4. Submit once, record the resulting order id and offer/input/authority digests privately, and pay using the qualified PayMe sandbox procedure. The stored charged amount must be 5900 agorot; independent signed/query proof must mark that exact sale/order paid. Do not fake payment status or insert a GenerationJob manually.
5. Close ORDER_INTAKE and CHECKOUT flags again after this one payment is confirmed. Leave existing-order worker/provider/long/reader/fulfillment active only for this bounded run. Protection and the one-order record prevent a second test order.
6. Observe paid -> generating -> long-step/chunk checkpoints -> story/preparation/reference/native -> materialization. A single web invocation does not run the hour-long book. The meter must record stable logical claims/results; pending Responses ids are polled, never reposted. UNKNOWN/unsettled failures park for the operator with full reserves.
7. Wait for automatic acceptance. Confirm nine illustrated/narrated frames, text/image/audio/PDF digest binding, unchanged 0.70/review/identity gates and no legacy selection. The order must stop at operator review while mode is required; no email yet.
8. Guy opens `/personal/review/<ORDER_ID>`, previews the exact book and PDF, checks story/appearance/page continuity/narration/RTL/text and records approve or reject with a reason. Approval audit binds actor, time and exact book/manifest bytes. Approval cannot override automatic HOLD. Reject enters the existing failure/refund path.
9. On approval, observe readiness passed, one outbox send and one internal email/link. Verify authenticated reader, all nine audio clips/seek behavior and the PDF, plus anonymous/other-parent denial. Record manifest id/book digest/provider message id without private tokens. A replay/tick must not send again or refund a delivered book.
10. Record measured per-stage runtime, estimated meter vs account billed usage, logical calls/re-asks/attempts, acceptance and operator audit. Assess the original USD 10 proposal from actual observations; do not silently extend it. Stop worker/scheduler/provider activation after the single test is settled. Preserve receipts/assets/history for re-gate; retention cleanup is a separate approved policy action.

## 7. Watch, stop, recover and roll back

Watch Order status/hold/fence, GenerationJob stage/lease/progressAt/recovery, atomic claim/result counts and estimated/reserved/UNKNOWN accounting, private asset read/hash failures, readiness/manifest/outbox sendAttempted/provider id, operator/ExceptionCase audits and confirmed refunds. Watch self-chain 401/403/lastChainError, missing cron ticks, repeated signed PayMe proof refusal, long-host revision mismatch and media decode errors. Use authorized server views/status UI; do not query/download child/session/payment contents into reports.

Stop intake/checkout first; stop new scheduler ticks and the supervised long-host loop. Disable WORKER/PROVIDERS/LONG_WORKER to block future claims. Already dispatched requests may finish and bill: retain the running process long enough to settle known replies when safe; do not kill it simply to reset the budget. UNKNOWN is not permission for another POST. If delivery must stop, disable fulfillment before new dispatch; an in-flight email can still settle. Preserve logs and never clear receipts, reserve rows, pending ids or delivery fences.

Infrastructure hold: use the existing operator review surface. **Resume** only if no unsettled/failed/unknown meter state remains and current source/policy/hold matches; **fail** uses the existing refund path, with one liability. Unknown paid calls cannot be resumed by deleting their claim. Keep the authenticated exception/refund scheduler available only under an approved recovery window if a refund must complete; disabling every process also stops refunds. Confirm refund independently before its notice. Never retry an ambiguous email outside its existing provider dedupe window or refund a successfully delivered book from a stale generation failure.

Rollback is a separately approved code/environment action: restore the last reviewed protected deployment only after stopping dispatch and inspecting active claims/deliveries. Keep matching web/host revisions; a rollback/policy revision can cause in-flight source-bound orders to fail with a liability; drain before changing source or policy, never reset source/meter. Preserve private buckets, RLS/revocations, metadata, receipts, failed evidence and book bytes. Do not restore public access or run destructive DB rollback/cleanup. There is no push/deploy/SQL/paid execution in this prepared runbook.

Public launch additionally needs Guy's company/address/mailbox/sender/cancellation/lawyer/retention and product/visual/launch sign-off. A successful fictional-child internal book would be evidence for that decision, not public launch approval.


## M17 additional acceptance checks, preparation only

- The effective vercel.json buildCommand must be npm run build, including the native archive, all-route cap and packaged-options verification. Read the completed Linux/Windows reports; no oversized route may be waved through as legacy. Actual Vercel glibc/adapter qualification is still separate.
- Query get-sales by the stored sale_payme_id and prove transaction_id equals exactly this order id (the current50-character wire bound), exactly one items entry, exact integer5900 agorot, ILS and a verified paid status. Confirm sale_url belongs to that sale and the intended sandbox before opening it. Browser return is not the sole payment authority. Qualify a callback with NO browser return, duplicate delivery, an invalid signed proof alert, a late old capture and the corresponding single liability using the existing payment tests/approved target.
- Open /personal/review as an allowlisted operator. Infrastructure and first authenticated payment-proof refusals produce a durable in-app notice and structured warning. The inbox is stored server-only; no legacy email-notification sender is enabled by this milestone. Record the operator on duty and poll the inbox/structured warnings during the one-order test. Verified proof/resume closes the active case, preserving history.
- The24h absolute generation bound remains; manual resume updates only inactivity progress. An expired resume is visibly unavailable. A misconfigured executor must not refund an in-flight order.
- Schema privacy preflight checks all public tables/views, not just nine. The prepared M17 SQL handles table/column grants, RLS and defaults for current creators. Inventory RPC/SECURITY DEFINER and any future new DDL role separately. No SQL has been applied.
