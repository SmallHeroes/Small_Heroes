> M13 update, base3185919b (2026-11-04): independent R1 HOLD corrections are documented in m13-qa-r1-fixes/REPORT.md and FINDING-MATRIX.md. Infrastructure ambiguity now retries boundedly then parks; only a deterministic/fenced terminal failure authorizes the refund path. Completed delivery survives later launch-policy changes; unsent jobs re-evaluate the same gate. Incompatible in-flight revisions fail through the engine fence, and abandoned generation has a four-hour execution backstop. Private metadata checks cover all three child-bearing tables and bind the Storage project. These are authorized technical corrections, not new product/spend approval. The minimal production Q1 PayMe patch is prepared separately and not applied.

STATUS: PHASE-0 DONE
HEAD: 348c85dc213f85597eb484d05e68e9048edb5603
Summary 1/5: FINAL launch offer is 59 ILS inclusive: cover + eight story pages + narration + PDF, no add-ons/coupons.
Summary 2/5: Customer image quality is explicit LOW, from one offer/order/image authority; HIGH is excluded and paid MEDIUM measurement is cancelled.
Summary 3/5: Use the NEW live-written personal engine, Anthropic API/current Opus design and existing durable jobs; no bank stories for new orders.
Summary 4/5: One automatic acceptance/delivery path has an initially required switchable operator gate bound to actor/time/exact book bytes.
Summary 5/5: Continue USD0 implementation in the owner's ordered milestones; recovery packages replace unavailable Git-index writes.

Owner decisions needed for this implementation: none. Product decisions above are FINAL and are not reopened. A proposed per-order cap is not activation/spend permission. Legal/customer delivery-refund sign-off and eventual paid/release GO remain owner items.

# Decision Gate ? final launch integration, 2026-11-04 round 3

This supersedes earlier launch-price/quality proposals in this track. Historical frozen patches and Git commits remain untouched evidence; they do not select current launch behavior. The original phase-0 investigation was at 6a223a28. Guy recovered five foundation commits through 8bc0c92d. There is no independent technical or product PASS implied by those commits.

## 1. Proposed change

Connect parent wizard -> personal order -> verified PayMe payment -> freshly written story -> C/D/E storyboard/review/references -> native-cde-book/v1 -> good-enough acceptance -> narration/reader/PDF -> delivery, with failure/operator/refund handling. Price/launch quality are read from a single client-safe offer definition; each order freezes explicit quality and product truth. Customer requests cannot choose runtime policy, budget or quality.

## 2. Why now / observed behavior / cause

The site order resolver and chunk runner still load bank product/story authority. The new engine's original operator envelopes depend on files, Git HEAD, local executable/session and one-use filesystem grants. They are not a production per-order lifecycle. Replacing a CTA or selecting a different writer alone would leave price, payment, storage, QA, delivery and retry authority disconnected.

Original phase0 foundation snapshot (historical, superseded by M07-M11 below): server contracts, receipt-based order meter/review audit, explicit image request planning, Anthropic API seam and default-off personal checkout bridge exist. Historical worker entry points refuse the personal protocol before bank generation. There is not yet a customer personal-order creator, private upload service, complete durable personal worker, production materializer or final readiness/outbox integration. Checkout must remain off until all exist.

Root cause: bank-bound production product truth versus process/file-bound personal engine authority. Contributing factors: divergent wizard shape, missing private assets, long stage deadlines, cost/UNKNOWN accounting, old reader/QA producing authority and stale policy documents. This is a general lifecycle integration, not a repair to one child/story/page.

## 3. Scope, topology and base strategy

Sole implementation writer: this thread, `C:/GNart/Work/sh-engine-site-launch`, branch `codex/engine-site-launch-20261104`. Current recovery base HEAD348c85dc;8bc0c92d was the prior foundation intake. No upstream, push, merge or deploy. User commits recovered packages; Codex never needs sandbox index access to continue.

Other worktrees are read-only references: scene branch `claude/book-render-20261009` independently advanced to ddc08c52 (clean; do not edit/import it); local release `codex/r1d-release-reader-voice-final` is006b3757 (clean, local upstream ahead by4); original checkout at90364542 has unrelated tracked/untracked changes, all preserved. The node_modules junction points to sh-order-package-authority and is not deleted/installed into/regenerated.

Original verified engine-vs-release divergence was542/18 at6a223a28. Five foundation commits are now on this branch. The18 release-only commits mainly concern landing/recording-wizard UX/middleware/docs; they are not18 missing engine infrastructure fixes. Do not blindly merge/cherry-pick their old CURRENT/ROADMAP entries or paid preview flags. Keep this engine branch as the integration base, review UI ports in a separate authorized merge window, and re-freeze refs before any such work. No merge is authorized now.

Local main0524162e defers the personal compiler to post-MVP and conflicts with Guy's current decision. Its merge-base with the original engine ised1da86c. Do not silently follow that deferral or replay hundreds of engine commits from main. Later release uses an explicitly approved PR/review/merge/deployed-SHA gate. Local Git refs are not proof of what production currently serves.

## 4. Generality and production-stage mapping

| Stage | Reuse | Add/replace | Required evidence |
| --- | --- | --- | --- |
| Wizard -> order | Reviewed personal request, option fingerprint, session/auth, companion/voice registries | Personal-only strict envelope, one inclusive offer, immutable input snapshot, no bank resolver | Actual handler tests: invalid/fixture/stale options, price injection, retries/concurrency |
| Private uploads | Approved storage/provider libraries and owner sessions | Private object namespaces, owner-scoped upload/admission, byte/mime limits and hashes; lifecycle cleanup awaits the legal retention policy | Synthetic I/O tests; later approved real private-bucket/RLS proof |
| Payment/job admission | PayMe checkout lease, verified webhook/return and paid CAS, unique order job | Dispatch by immutable engine protocol, one-use authority/call plan, no bank/fake fallback | Preserve payment-ack isolation, exact5900agorot at provider seam, no job on unpaid/held state |
| Fresh story | Verified current momentum/child-first-v4: Opus author, Sol editor/readers, current source/compiler schemas | Anthropic API, raw private receipts and durable call checkpoints | Exact prompts/caps/fresh conversations, output validation, replay without another paid call |
| Preparation | C/D/E storyboard/compiler/review and reference-role/appearance contracts | Durable per-order source/plan/reference evidence and deterministic required-frame selection | No workstation Git/path grant as service authority, no accidental owner WAIT workflow |
| Images | native-cde-book/v1, existing attempt/review/identity behavior and common image planner | LOW from order authority, private candidates before QA, exact byte/wire claim binding | Nine ordered frames, full UNKNOWN reserves, no silent downgrade, no failed-call repurchase |
| Acceptance/operator gate | Existing impact vocabulary and 0.70, existing material/safety/scale/reference checks | Reconstruct raw evidence, exact final content digest, audited approve/reject, current launch policy | Detail nonblocking; unknown/misbound evidence holds; operator cannot override automatic HOLD |
| Reader/narration/PDF | Voice registry, TTS text helpers, per-page audio/read-v2, existing PDF primitives | Personal result materialization with private content and promised artifacts | Correct text/image/audio order/hash, no partial audio/image-only fallback for inclusive SKU |
| Delivery/refund | Readiness manifests, input/delivery fences, outbox/send CAS, ExceptionCase/RefundAttempt | Personal producing authority/gate digest at readiness and send-time, cap/terminal routing | Approve/reject/toggle/cancel/send races; dispatched refund response loss never reissues blindly |

Retain historical books/readers/receipts and their old pricing. Retiring the bank for new orders does not authorize deleting history. Native v2 scene preservation remains optional, unactivated and outside the critical path.

## 5. Ordered files and milestones

M06 reconciles final59ILS/LOW policy, current docs and LOW cost model. Then implement in exactly Guy's order:

1. Wizard -> personal order creation: strict personal envelope/offer snapshot; actual route and wizard consumer, server price only, idempotent owned session, no story-bank imports.
2. Private uploads: owner-scoped photo/description admission and private artifact storage, no public-photo fallback.
3. Personal worker: existing GenerationJob/lease/meter with durable step records and a long-step executor for the configured deadlines that exceed300s. No parallel whole-book queue.
4. Materialization: final story/cover/eight frames, narration and PDF into the production reader model and storage, preserving exact-byte authority.
5. Acceptance/operator gate -> readiness/delivery/refunds: same automatic path, initial required review, authenticated audit, final send fence and cap/UNKNOWN failure routing.

Expected files include `lib/engine-site/`, personal wizard components/options/request boundary, `/api/orders` or a versioned personal entry point, private upload routes/storage adapters, generation start/worker/lease/checkpoints, existing reader/audio/PDF interfaces and readiness/outbox/exception/refund seams. No production/Supabase migration/write or package regeneration through the shared junction occurs in this run.

## 6. Authority, caps and the good-enough rule

The immutable order binds canonical request/options, offer/policy/source revision, explicit LOW image quality, promised narration/PDF and independently admitted budget/call slots. A browser cannot mint its own policy/cap/approval. Existing AtomicOperationReceipt and Order-first locking own one-use claims and exact wire payload hashes. Every new call reserves its full approved slot under the same cumulative order cap. Pending/UNKNOWN retains the full amount and blocks further dispatch; known billed overrun is preserved and stops. A local counter is not a provider invoice.

Automatic acceptance reuses the existing engine rule and admitted raw reviews/identity/reference/scale evidence: exact complete cover/eight pages, no material/safety finding, identity>=0.70, and complete promised audio/PDF. Fine detail is recorded, never a blocker or reason for another image. Missing/malformed/misbound evidence is a hold, not a visual defect authorizing repurchase.

Cap exhaustion stops and enters the existing operator/refund lifecycle. It never changes LOW to another quality, omits a page/artifact, skips identity/review or restarts a new paid cycle. Current declared full-attempt slot totals and the proposed total-order USD10 cap are detailed in COST-AND-RUNTIME.md; proposal is not a live grant.

## 7. Launch gate, validation and recovery

One automatic acceptance/readiness/outbox path has a required/off launch policy. Initially every book requires operator review. Approve/reject records authenticated actor, original server UTC time, order, policy revision, previous audit digest and exact ordered book digest (text, cover/page image, per-page audio, PDF, source/storyboard/quality). Changed bytes invalidate approval. A reject remains a domain hold even after gate-off until an audited later decision resolves it; automatic HOLD still wins. Missing/malformed policy never disables review.

Turning the gate off later is an audited server/operator configuration action, then the same automatic path advances eligible unreviewed books. It does not create another manual fulfillment flow. Readiness and final send must re-read/bind the policy and audit or bump the shared delivery fence so a toggle/rejection after evaluation cannot bypass the send CAS.

Required per-commit proof: `node node_modules/typescript/bin/tsc --noEmit` and relevant `node node_modules/vitest/vitest.mjs run ...`, all synthetic/local. `npm run check` is logged/reported, not a hard gate while known baseline failures stand, per Guy's explicit round3 instruction. Native PowerShell5.1 calls temporarily set ErrorActionPreference=Continue and check LASTEXITCODE. No npx. Every coherent milestone gets a patch, source pins, explicit-path recovery script, commit message and Hebrew summary. No Git index operation is needed from Codex. Guy verifies/commits; Claude Code independently reviews on request, read-only first.

Later runtime evidence must cover actual Postgres concurrent sessions/pooler, private-bucket/RLS, hosted stage/lease behavior, approved provider output, PayMe/email/refund and real browser E2E. Synthetic evidence does not certify those. No independent self-PASS, no paid/production execution now.

## 8. Cost, time and secrets

USD0 now. Book-r15e is the owner-supplied LOW anchor:81 reported native calls, USD5.457428, plus aboutUSD1?2.5 story/preparation. Retain the same3.157ILS/USD, assumed18%VAT, illustrative2.9%+1ILS processing andUSD0.35 infrastructure assumptions. Include narration and show both expected span and declared all-slot/worst-case exposure. A proposed USD10 cap leaves modeled margin on completed orders, but failed/refunded orders retain provider costs; no invoice/profit guarantee. Paid MEDIUM measurement is cancelled, not pending.

Keep the existing durable scheduler. Current plan780s, author380s, editor860s plus persistence do not fit300s. The long-step executor uses the same job/order/claim/meter and renews a fenced lease appropriate to the step; the legacy seven-minute lease cannot simply cover a14-minute call. Short invocations defer before claim/key access. Do not shrink story caps/timeouts to fit a function or duplicate the full book queue. No service is deployed/provisioned here.

Production secrets will be provided by Guy through deployment environment. No key is requested in chat, read from.env, printed or copied. Keys remain server-only, never in public variables, snapshots, URLs, task messages or logs. Script file-based key readers/Git authority are not imported as production identity. Stage/preview/production separation and approved activation must precede actual use. Photos/reference/candidate assets remain private and owner-scoped; a bearer reader link does not protect a public storage bucket.

## 9. Rollback and dated plan

Rollback only the current milestone's explicit diff. Preserve old grants, paid books, UNKNOWN reserves, user changes, packages and junction host. No cleanup/deletion. Later rollback disables new admission/dispatch, parks/reconciles claimed in-flight work, keeps refund/reader access and never routes personal orders to the bank or resets the cap.

| Date | Exit criterion |
| --- | --- |
| Nov4?6 | Final policy/recovery packages; personal order and private upload boundaries |
| Nov7?10 | Personal durable stages/long executor and synthetic end-to-end graph |
| Nov11?13 | Separately approved LOW story/book sample passes Guy's eye; general engine fixes only |
| Nov14?18 | Reader/narration/PDF plus gate/readiness/outbox/refund integration |
| Nov19?22 | Separately approved staging/runtime/provider/payment/private-asset/email failure proofs |
| Nov23?26 | Independent Claude QA, fixes and re-gate; legal/customer promise/product sign-off |
| Nov27?29 | Approved exact-SHA release/deploy/live smoke and rollback drill |
| Nov30 | Guy's launch GO; initial operator gate required |

Risks: hosted long-step/replay/lease correctness; private child data; duplicated paid calls/UNKNOWN; new producing evidence at send-time; cost/cap completion and refunds; release UI divergence; narration/PDF completeness; legal/company/email setup; late runtime qualification. Optional v2 does not block v1. Calendar pressure does not waive gates.

## 10. Owner and reviewer assignments

Guy's remaining launch prep: company number, legal address, hello@ mailbox/sender/DNS, cancellation/refund/customer promise sign-off and lawyer review. Codex does not invent identity/legal facts or accept terms. Price/quality/format/Anthropic API are settled. Future paid calls, actual cap/grant activation, deployment and final release still need their explicit scope/GO, without reopening product policy.

Claude should falsify: client pricing/quality/budget injection, old-bank fallback, byte/policy/audit drift, one-use replay/concurrency, UNKNOWN resets, incomplete audio/PDF, private asset ownership, expired long lease, stale approval/send and duplicate refund. First pass read-only on an exact recovered commit range; reconcile HEAD mismatch before accepting findings. Cowork is optional only if Guy routes a product/UX/complexity consultation.

## 11. Completed stop-check / exclusions

General system work; no per-child/story patch. Production code may change behind default-off admission, with no service write. Smallest validation is strict contract/actual-handler/SQL seams with synthetic providers. Owner product decisions are explicit. Guy eyeballs a later separately approved LOW result. No keys/.env, paid providers, real customer data, bank connection, other-worktree edits, push/merge/deploy, gate/threshold weakening or cleanup. No independent/product/launch PASS claimed.

Primary references retained for the stated assumptions/interfaces: [OpenAI pricing](https://developers.openai.com/api/docs/pricing#image-generation), [Anthropic API](https://platform.claude.com/docs/en/api/overview), [Vercel duration limits](https://vercel.com/docs/functions/limitations), [Supabase storage access](https://supabase.com/docs/guides/storage/security/access-control), [Bank of Israel USD](https://www.boi.org.il/roles/markets/exchangerates/usdollar). These were read in the prior planning work; this update intentionally keeps the same FX/fee/VAT assumptions requested by Guy, not a fresh billing/account query.


## M09 verified engine correction and runtime host (2026-11-04)

Investigation found the plan's earlier causal planner/Opus-editor mapping was a hypothesis, not the current native book producer. The current momentum route in personal-book-e2e-trial.ts uses child-first/v4 (momentum), Opus5.5 author and Sol editor/readers. The new host preserves that route and introduces a distinct Anthropic-API-author/Sol-Responses-editor source version; it does not forge CLI sessions or select an older story engine. It retains the current prose-first design, so no separate causal planning call is selected for launch. The generic long executor covers the earlier780/380/860s envelopes, while the actual current28000-token author needs1180s plus45s persistence. Sol editor/storyboard/review calls use a saved background Responses id in the existing chunk system; they keep their exact schemas/caps and store=false. No provider availability/account access/paid output is verified.

One GenerationJob owns both hosts, checkpoints and the existing atomic meter. The chunk budget is270s within the300s function ceiling, preserving30s platform margin; image180s plus45s persistence leaves45s for context restoration. Only synchronous calls unable to fit use the25min long host, with a longer fenced lease/heartbeat. Native completed pages have awaited private checkpoints and reuse only a contiguous prefix revalidated by the existing raw review/identity rules. Stable paid ids and the order-wide nine-re-ask fence survive resume. A new authority/job never resets a pending/UNKNOWN claim. Late known costs settle after hold/lease loss without committing progress. The normal sweeper excludes long jobs; bounded background polls count as durable activity without moving the original deadline. Missing/revoked policy, storage, revision or lease stops.

No default spend allowance is configured. ENGINE_SITE_SPEND_POLICY must name the separately approved cap/calls/reference/actor/time/source revision and paid activation, with ENGINE_SITE_WORKER_ENABLED/ENGINE_SITE_PROVIDERS_ENABLED explicit. The long host additionally requires ENGINE_SITE_LONG_WORKER_ENABLED and verifies its actual Git revision. These are deployment-time activation boundaries, never spend approval from this USD0 work. Readiness/materialization/delivery hooks remain the following milestones; checkout remains off.

Synthetic evidence: actual PostgreSQL receipt/lease fences, provider API seams, explicit API source admission, native raw-review/identity page resume and existing native/source regressions. An initial101 test failures were the inherited home-TEMP realpath restriction; workspace-contained synthetic TEMP made the native444 tests pass. The recovery script now contains that environment setup/restoration and no cleanup. Generated synthetic temp paths alone are excluded from TypeScript; all real source/specs stay checked. No full real production book or actual browser/provider/infrastructure proof is claimed.


## M10 implementation evidence (2026-11-04, base348c85dc)

Private nine-scene reader, exact selected image bytes, nine per-order metered ElevenLabs clips, full decode and private PDF materialization now exist. PDF is nine logical pages: portrait cover plus eight landscape body spreads preserving full portrait illustration and unchanged Hebrew text. Local fonts/Pango shape niqqud; rasterized PDF text is not selectable. ReaderV2 personal source and owner/operator preview endpoints never expose source photos/receipts or use bank book data. Family access remains deny-by-default until M11 connects publication. Personal PayMe return targets the personal order status page without payment tokens. TypeScript0;838/838 focused tests; synthetic media/PDF rendered/decoded. See m10-reader-materialization/REPORT.md for exact scope, packaging limitations and read-only QA targets. No live activation or provider work.


## M11 current implementation and release boundary (2026-11-04, base348c85dc)

The ordered phase1 implementation now includes personal intake, private assets, same-job chunk/long execution, reader/narration/PDF and automatic/operator/readiness/delivery/refund adapters. The actual current code/evidence is m11-acceptance-delivery/REPORT.md; the source is not deployed or activated. M07-M10 packages remain historical immutable snapshots and M12 supplies final cumulative recovery with nonoverlapping commit path allocation. Existing bank/main/release branches were not merged. The conflict with main's compiler-deferral roadmap remains explicitly overridden by Guy's Nov4 decision; no deferred-bank strategy was silently followed.

The switchable eye gate is implemented as a private global review state, not a deployment boolean: initially required, changed by an authenticated allowlisted operator with expected policy digest/reason, immutable event and server actor/time. Policy-first shared locks and Order locks are used by readiness and send; readers validate the same current policy/audit/book predicate. To turn it off later, use the global control on /personal/review/<orderId> or the authenticated /api/engine-site/v1/review-policy action. Keep reader/fulfillment enabled. An old policy/readiness/approval cannot authorize changed bytes; the manifest binds exact UTF8 text plus original image, audio, PDF, source/storyboard and LOW. Existing automatic materiality/identity/safety/scale/citation rules remain decisive, fine detail stays nonblocking, and a reject is never overridden by off. Fresh approvals record session actor/server time/policy/previous-decision/exact book digest in append-only atomic receipts.

Scoped readiness uses the existing readiness/manifest/outbox tables and stable delivery intent. Worker lease release precedes free publication; the outbox rechecks current private bytes and locked authority before send. Family access and delivery share that predicate. Personal full refunds share one order-wide PayMe fence across exception scopes; ambiguous/pending outcomes reconcile without re-issue or premature notice. Paid-without-job loss is recovered from durable state. The old ordinary cache and legacy send path cannot replace/ship a personal checkpoint. Site entry and its single visible offer cut over only under the default-off checkout flag; partial activation cannot send a parent back to bank purchase. The checkout also requires all runtime flags, valid explicit spend policy/current source and the existing Production enablement.

Engineering proof is synthetic and scoped:997/997 focused42files0, final exact-text controls separately, directNode tsc0; no live provider or account proof, native Linux/bundle/host/build proof, real private storage/anonymous denial, deployed browser/full payment/mail or product-eye proof. Lifecycle SQL tests inject admitted synthetic frames; provider/source/native component proofs are separate, and the complete positive production-recipe/readmission composition is specifically a QA qualification target. Full npm check is informational with the preserved baseline diagnostics. New private assets do not yet have a final legal retention/deletion schedule; public-photo cleanup is not private-object deletion proof.

FIRST-PAID-TEST.md separates Guy's bounded spend/cap/environment actions from engineering recovery/independent QA/build/host/browser qualification. A fictional-child internal paid LOW test still needs explicit GO and an actual approved cap; nothing selects MEDIUM. Public launch additionally needs company/address/hello@/sender, cancellation and lawyer/retention sign-offs, product/visual acceptance and measured complete new-flow cost/runtime. Deadline remains2026-11-30 with~11-13 LOW book target. Optional scene-v2 remains separate.
