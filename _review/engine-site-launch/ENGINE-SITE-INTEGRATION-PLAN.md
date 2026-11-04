STATUS: PHASE-0 DONE
HEAD: 8bc0c92de0cb719e8951984cdb0596be3318265e
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

Verified foundation state: server contracts, receipt-based order meter/review audit, explicit image request planning, Anthropic API seam and default-off personal checkout bridge exist. Historical worker entry points refuse the personal protocol before bank generation. There is not yet a customer personal-order creator, private upload service, complete durable personal worker, production materializer or final readiness/outbox integration. Checkout must remain off until all exist.

Root cause: bank-bound production product truth versus process/file-bound personal engine authority. Contributing factors: divergent wizard shape, missing private assets, long stage deadlines, cost/UNKNOWN accounting, old reader/QA producing authority and stale policy documents. This is a general lifecycle integration, not a repair to one child/story/page.

## 3. Scope, topology and base strategy

Sole implementation writer: this thread, `C:/GNart/Work/sh-engine-site-launch`, branch `codex/engine-site-launch-20261104`. Current intake HEAD8bc0c92d. No upstream, push, merge or deploy. User commits recovered packages; Codex never needs sandbox index access to continue.

Other worktrees are read-only references: scene branch `claude/book-render-20261009` independently advanced to ddc08c52 (clean; do not edit/import it); local release `codex/r1d-release-reader-voice-final` is006b3757 (clean, local upstream ahead by4); original checkout at90364542 has unrelated tracked/untracked changes, all preserved. The node_modules junction points to sh-order-package-authority and is not deleted/installed into/regenerated.

Original verified engine-vs-release divergence was542/18 at6a223a28. Five foundation commits are now on this branch. The18 release-only commits mainly concern landing/recording-wizard UX/middleware/docs; they are not18 missing engine infrastructure fixes. Do not blindly merge/cherry-pick their old CURRENT/ROADMAP entries or paid preview flags. Keep this engine branch as the integration base, review UI ports in a separate authorized merge window, and re-freeze refs before any such work. No merge is authorized now.

Local main0524162e defers the personal compiler to post-MVP and conflicts with Guy's current decision. Its merge-base with the original engine ised1da86c. Do not silently follow that deferral or replay hundreds of engine commits from main. Later release uses an explicitly approved PR/review/merge/deployed-SHA gate. Local Git refs are not proof of what production currently serves.

## 4. Generality and production-stage mapping

| Stage | Reuse | Add/replace | Required evidence |
| --- | --- | --- | --- |
| Wizard -> order | Reviewed personal request, option fingerprint, session/auth, companion/voice registries | Personal-only strict envelope, one inclusive offer, immutable input snapshot, no bank resolver | Actual handler tests: invalid/fixture/stale options, price injection, retries/concurrency |
| Private uploads | Approved storage/provider libraries and owner sessions | Private object namespaces, owner-scoped upload/admission, byte/mime limits and hashes, retention hooks | Synthetic I/O tests; later approved real private-bucket/RLS proof |
| Payment/job admission | PayMe checkout lease, verified webhook/return and paid CAS, unique order job | Dispatch by immutable engine protocol, one-use authority/call plan, no bank/fake fallback | Preserve payment-ack isolation, exact5900agorot at provider seam, no job on unpaid/held state |
| Fresh story | Same causal planner/Opus author/editor/rest-of-review design and schemas | Anthropic API, raw private receipts and durable call checkpoints | Exact prompts/caps/fresh conversations, output validation, replay without another paid call |
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
