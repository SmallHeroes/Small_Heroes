# M17 corrective package design

General corrections to the M15+M16 package after Claude R3 HOLD. No engine/model/art/manual-book modification. Runtime allowances, price, quality, attempts and defaults are unchanged. This file describes code prepared for independent review, not deployed infrastructure.

## Effective build and exact options

Vercel's buildCommand delegates to package.json's `npm run build` (Prisma generate, Next build, then the required packager). The build tail fails before applying any trace if any measured closure is >=250000000 bytes, lacks an expected engine route, required exact asset or runtime dependency, or changes the actual options fingerprint/companion list. `--check` refuses unprocessed traces. Every measured route, including shared-server and legacy traces, participates in the cap.

The 76-file static manifest retains the earlier 67 exact assets plus seven actual personal-companion cards and two voice previews (372497 additional bytes). The source roster comes from the same registry/resolver used by the Wizard. The build-only options verifier runs that real resolver with each proposed function filesystem projected through synchronous FS operations; it restores the FS in finally. The root, actual Wizard, order creation/status, worker and all reconciliation functions must agree. This is a read-side fingerprint check, not a synthetic substitute roster.

Next15 matches route globs with contains:true and presents its root as /app; public post-build routes use /. Two negative root globs target these roots independently, without attaching sheets to every route. The shared worker/cron includes and exclusions both retain options card/voice bytes. Declared Next exclusions are reapplied with normalized paths on every platform. Only retired Style01 archive/candidate files are newly excluded globally; originals remain on disk. Current locked refs, legacy bank/Style02 data outside their existing exclusions, and needed media survive. The /api/orders lean rule now retains Chromium/Puppeteer because contains-matching includes its real power-card child. Shared next-server NFTs are measured from their real listed entries; no nonexistent .next/next-server.js is invented.

## Native media

The platform-specific lossless native archive is required in production/Vercel. Only an unbuilt local process may use raw installers. Narration, audio intake and legacy video share the lazy resolver. It verifies manifest, gzip and raw digests and size bounds; it rechecks extracted executable bytes on reuse, never accepts a present corrupt archive, and retains licenses. Temporary extraction is process-private, 0700 on Linux, and normal-exit cleanup is limited to that resolver's own directories. Hard-kill cleanup and external authenticity of a mutable deployment image are not claimed. Deployment immutability remains the trust root.

## Resumption and financial safety

A permitted infrastructure resume refreshes only inactivity progress at the audited action time. It does not reset the 24-hour absolute deadline, creation time, claims, receipts, attempts or meter. Expired resumes are visibly refused. An executor with invalid/missing current configuration returns executor_unavailable before any failure/refund mutation; valid order-bound policy drift still holds/fails under the original policy.

## Observable manual cases

The first signed callback or existing server query that refuses a stored PayMe proof creates a deduplicated server-only ExceptionCase notice. Infrastructure holds create the same durable in-app operator inbox item. The list and per-order detail require the existing authenticated allowlisted operator, return private/no-store, and do not expose child/email/raw provider data. Resolved cases disappear from the active list while history remains. This is an in-app inbox plus safe structured log, **not** automatic email, financial approval or a retry. A failed committed-operator-fail reconciliation no longer prevents the cron from attempting other eligible work.

## Isolated staging option A, preparation only

Guy selected a separate staging project and application access gate. The gate defaults off. Once independently reviewed and separately provisioned, it requires exact HTTPS immutable staging hostname, staging environment and dedicated credentials; real-production Vercel/dev-debug protections still win. Browser Basic access is additional to the normal parent/operator authorization. Internal calls use x-smallheroes-staging-access so Bearer worker/cron auth remains intact; forwarding is limited to the exact recorded HTTPS host and does not follow redirects. Only POST /api/webhooks/payme is exempt at the transport gate; the handler's existing signature and exact stored-sale proof remain mandatory. No project-wide platform-bypass token is prepared or used. No credential, webhook, account or platform setting has been created.

## Private database preflight

The preflight inspects every public table/partition/view/materialized/foreign relation, not only nine named tables. The nine required authority tables must exist; public tables/partitions must have RLS; anon/authenticated table/column privileges and schema CREATE are refused. The separate SQL file is a proposed isolated-target template with schema-wide revokes, per-owner default privilege handling and column grants; it was not applied remotely. Existing public RPC/SECURITY DEFINER exposure is explicitly a separate real-target qualification. The change does not claim a real Supabase project is private.

## Remaining boundaries

Local Windows/Linux proofs do not measure the Vercel adapter's extra files or qualify its glibc deployment, actual private DB/storage, payment sandbox, long host, browser flow, scheduler or delivery providers. The old production PayMe webhook late-failed-order revival risk is disclosed beside the unchanged small M14 hotfix; it is not silently included in that production patch. Other retained R3 P3 notes are listed in REPORT.md. No deployment or first paid-book GO follows from this package.
