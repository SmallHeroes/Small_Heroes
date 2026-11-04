STATUS: PHASE-0 DONE
HEAD: 6a223a287913d0d5acb5693cf2ff280dd576e34f
Summary 1/5: This launch sells newly written personal stories, cover + eight story pages; the 18 bank stories are retired for new orders.
Summary 2/5: Customer illustrations must use explicit MEDIUM; LOW is test-only, HIGH is forbidden; resemblance stays 0.70.
Summary 3/5: One 49 ILS all-inclusive SKU includes narration/PDF; use Anthropic API for the same Opus author design and retain the durable job system.
Summary 4/5: One automatic acceptance/delivery path has an audited, switchable operator gate, initially enabled for Guy's review of each book.
Summary 5/5: Phase 1 is local, provider-free implementation; live service correctness, paid efficacy, independent QA and launch acceptance remain separate gates.

Owner decisions still required: per-order USD/call/correction caps and global pilot ceiling; customer delivery/refund promise; separate paid LOW sample and MEDIUM measurement GO; company/legal/contact completion; later gate-disable and release GO. Already decided: 49 ILS including book/narration/PDF with no add-ons, eight story pages, Anthropic API for the current Opus author design, existing durable jobs (long-step executor only where needed), MEDIUM, retired bank, automatic target plus initially enabled operator gate. No key is requested or read. The cost/runtime addendum below supersedes the preliminary cost sensitivity and the earlier open-price/host entries.

# Decision Gate — engine to site, 2026-11-04

This document follows `docs/ai-workflow/DECISION_GATE_TEMPLATE.md` sections 1–11 and answers every question in `STOP_BEFORE_MAJOR_ACTIONS.md`. Guy's current brief and subsequent answers are the implementation authority for $0, reversible work requiring no further product choice. They do not authorize spend, merge, push, deployment, production/Supabase writes, or credentials access. The referenced `CODEX-BRIEF-ENGINE-SITE-LAUNCH.md` was not present at the worktree root during intake; the brief and answers supplied in this thread are the controlling source.

## 1. Proposed change

Connect the personal wizard, PayMe payment, live author/editor, source preparation, native whole-book v1, acceptance, narration, reader and fulfillment as one order lifecycle. Phase 1 starts with reusable order authority, acceptance/review state and receipt-backed budget foundations. No customer route is activated by those foundations.

Binding owner decisions supersede older text in root documents/AGENTS/CLAUDE: a live-written story is the product, the bank is retired for new books, launch size is cover + eight story pages, customer quality is MEDIUM (never HIGH), and delivery targets automation. `main` commit `0524162e` explicitly defers the personal compiler; that July decision conflicts with Guy's November 4 instruction and must not silently govern this launch. The measured and approved live deployment revision has NOT been inspected; `main` and origin refs here are local Git facts, not proof of what production currently serves.

### Topology and base strategy

Snapshot taken read-only on 2026-11-04; no fetch or topology mutation:

| Task / owner | Worktree / branch | Frozen HEAD / state | Write authority here |
| --- | --- | --- | --- |
| This integration thread / Codex | `C:/GNart/Work/sh-engine-site-launch`, `codex/engine-site-launch-20261104` | `6a223a28`; no tracked changes at intake; three pre-existing untracked launch-thread logs | Sole writer, within this worktree |
| Other scene-preservation thread / Codex | `C:/GNart/Work/sh-book-render-20261009`, `claude/book-render-20261009` | `6a223a28`; clean; ahead of local upstream by 173 | None; read-only topology/status only |
| Reader/release reference | `C:/GNart/Work/sh-release-reader-final`, `codex/r1d-release-reader-voice-final` | `006b3757`; clean; local upstream reports behind 4 | None |
| Original working checkout | `C:/GNart/Work/Small_Heroes`, `feat/design-system-refresh` | `90364542`; dirty tracked `.claude/launch.json` and many untracked artifacts | None; preserve everything |
| Production branch reference | `main` (not checked out there) | `0524162e`; ahead of local `origin/main` by 1 | No merge/push |

`git worktree list --porcelain` and `git branch -vv` were inspected across the repository. Only the above worktrees are relevant to this milestone. Cross-worktree status required per-command `-c safe.directory=<exact worktree>` because the sandbox user differs from the owner; no global Git config was changed. Remote: `https://github.com/SmallHeroes/Small_Heroes.git`. This branch has no upstream. `node_modules` is a junction to `sh-order-package-authority/node_modules`: do not delete, reinstall or regenerate shared dependencies in that host.

Verified `HEAD...codex/r1d-release-reader-voice-final` = **542 / 18** commits; merge-base with main = `ed1da86cc114a767dc1086b71a30a4ef4595c097`. The 18 release-only commits change 41 files (+4540/-624), predominantly landing/recording-wizard UX, lifecycle tests, middleware and historical docs. They are not 18 missing engine/reader infrastructure commits. Review their UI changes as a single bounded integration candidate after the foundations, preserving current engine documents. Do not blindly cherry-pick their stale CURRENT/ROADMAP entries or enable paid preview switches. No merge is performed under this brief's explicit prohibition. Before an owner-authorized merge window, re-freeze both refs (the upstream is already four commits beyond the local release branch), then integrate and independently re-test the exact result. Keep the engine as the launch base; do not start from main and replay 542 engine commits. Later release through a reviewed PR to main, resolving the deferred-compiler policy explicitly, with release SHA and deployment SHA verified separately.

The 18 local release-only commits, oldest first:
`26b7e58f`, `77f6d430`, `41eba860`, `42c67ce3`, `cdf5938b`, `dafe34fa`, `ef8269b4`, `1e3a9a40`, `70e33298`, `da9233da`, `c0827427`, `b7f4bf28`, `86ca47e8`, `41359878`, `86f1bb58`, `50eb17e5`, `c3db7a85`, `006b3757`.

## 2. Why now? Observed, expected and root cause

Expected: a parent submits their reviewed personal request, pays once, and receives that request's fresh story, nine illustrations and selected narration through the reader; failures are visible and recoverable/refundable. Interim target November 11–13 is an explicitly approved LOW sample and story, not release proof.

Observed in this checkout:

- `app/api/orders/handler.ts:297,345` applies `enforceMvpOrderSlot` and `resolveStoryProductTruth`; price, length and frozen product truth derive from bank bindings.
- `lib/generation-pipeline/chunk-runner.ts:19,1174` imports/loads bank content, including package-backed snapshots. Replacing only the wizard URL cannot change the actual writer.
- `lib/personal-wizard/native-book-bridge.ts:17,43,48` requires local absolute paths, an inherited env-file path, a Git HEAD/clean-tree check and a Git-common-dir queue. Its developer route is operator-only and `runtimeEligible:false`.
- `scripts/personal-single-book-calibration.ts` binds a local executable and hash; text generation is not yet a hosted production service. Existing OpenAI/CLI or Claude session authority cannot be inferred to cover a customer service.
- `scripts/personal-source-preparation.ts` plans/reviews and durably waits for a selected frame before references; those filesystem grants/one-use claims are operator envelopes, not per-order service credentials.
- `lib/personal-wizard/native-page-proof.ts:15` defines `native-cde-book/v1` and frames 0–8, three attempts/frame and at most nine unusable-review re-asks (90 total calls). Its USD7 ceiling covers its own LOW native run, not authoring, preparation, child reference, TTS or total order cost, and is NOT current spend permission.
- `scripts/personal-simple-book-reviewed-audition.ts:846,972` hard-checks LOW in both the wire planner and meter. `generate-image.ts` supports MEDIUM generically, but that does not make the native path MEDIUM-capable. Update both planner and audited meter under a new customer policy; retain historical LOW receipts unchanged.
- Native results explicitly remain audition-only (`runtimeEligible:false`, `productionQualified:false`). `native-cde-book/v2` has offline scene-preservation code, but the actual operator rejects it as `scene_preservation_unqualified`. v2 is optional and must not block v1 integration or be silently enabled.
- Existing acceptance (`simple-book-reviewed-audition.ts:642,662`) already ignores detail for blocking, requires child identity >=0.70 and blocks safety/material findings. Do not invent a second visual policy.
- Worker route and `vercel.json` specify 300s. `generation-chunked/constants.ts` supplies a 230s work budget, seven-minute lease, one image/chunk and persistence margins. Some native review transport deadlines are longer than a single current invocation.
- `reader-book-source.ts` and Prisma `BookPage.audioUrl` already support per-page narration; local narrated bundles remain private developer artifacts, not customer release evidence.
- Storage helpers currently construct **public** object URLs. Existing bearer reader access does not itself protect publicly addressable photo/reference assets. Inspect actual bucket policies only in an approved environment; production storage policy is currently unverified.

Root cause: production product authority is bank-bound; the new engine's authority and persistence are operator/process/file-bound. No durable order binding currently bridges these systems. Contributing factors: local executable dependencies, LOW-specific accounting, historical gates/flags, missing new-product pricing, and separate diagnostic versus customer fulfillment evidence. This is a lifecycle integration, not a story-specific defect.

## 3. Scope and stage mapping

General system work. Retain historical paid orders/assets/receipts and their historical readers. A new order never selects or falls back to one of the 18 bank stories. Retiring the bank for new orders does not authorize deleting historical data.

| Stage | Reuse | Replace / add | Removal from NEW order path / acceptance evidence |
| --- | --- | --- | --- |
| Wizard | Personal request schema, reviewed facts, option fingerprints, companion registry; existing session/auth and upload interfaces | A versioned, server-validated personal product/order snapshot; real consented photo or explicit description; launch size locked to eight story pages | Bank category→story resolver, fixture authority; current `appearance.photo` only says none/local_preview_not_sent and does not upload a production photo |
| Order / checkout | `POST /api/orders` conventions, server pricing, idempotent session claim, `app/api/checkout/handler.ts`, PayMe sale/checkout lease | Explicit new-engine discriminator and owner-approved price SKU, input/options/model policy digests, audio/PDF entitlement snapshot | No fake-payment or bank-package token accepted as personal product authority; no pricing guessed from old tiers |
| Payment → job | Verified PayMe webhook/return, paid CAS, `app/api/generate/trigger.ts`, GenerationJob unique orderId | Route by immutable order engine version, preserve payment acknowledgement isolation | No local operator grant activation through a payment callback; no inference that browser redirect alone is payment proof |
| Fresh story | Personal request acceptance, current author/editor/planning schemas and editorial checks | Hosted transport for the SAME approved author/editor design; raw receipts and immutable final text committed per stage | Local Claude/Codex executable/session, bank loading, live server reliance on Git/absolute workstation paths |
| Preparation | Current C/D/E storyboard/compiler, review/appearance/ref-sheet contracts | Persist exact planned inputs/raw answers/results; deterministic selection of required frames from the whole book; durable state between calls | Local owner-choice WAIT must not become an accidental extra manual production workflow; design the deterministic selection without changing story quality policy |
| Child / companion / sheets | Existing qualified companion art and child-anchor admission; entities/location roles | Per-order photo/description reference generation and identity evidence, persisted before subsequent paid work; new MEDIUM wire + reserve policy | No historical child reuse, bank wardrobe/set-board requirements, arbitrary reference-role coercion |
| Native illustration | `runNativeBookFrames`, v1 C/D/E admission, bounded corrections, returned-image persistence and exact-byte QA | Durable step checkpoints, candidate bytes/raw review/identity evidence bound to one order, one-use provider claims | Local filesystem authority and whole-run-only memory state; v2 scene preservation remains optional |
| Automatic acceptance | Existing impact vocabulary, review recomputation, identity 0.70, full cover/page coverage, scale/reference requirements | Production evidence envelope and whole-book content digest; immutable automatic decision | Detail cannot block; malformed/missing/misbound QA cannot become approval or authorize a new image |
| Launch operator gate | Authenticated admin access/audit patterns | Versioned required/off policy; approve/reject binds operator, server time, order and exact book-content digest | No separate manual delivery pipeline; operator cannot override failed automated acceptance |
| Narration / reader | Voice registry, TTS text helpers/ElevenLabs seams, BookPage.audioUrl, read-v2 reader and access checks | Narrate accepted final text per page, durable audio bytes/receipts; persist new book into existing customer reader shape | No developer local-reader promotion, no reuse of another book's narration; audio-required book cannot silently ship image-only |
| Package / delivery | BookReadinessManifest, delivery-input barriers, shared input/fence versions, DeliveryOutbox/send-time CAS, ready email | New-engine producing-evidence evaluator + acceptance/review audit bound into the existing readiness and final send CAS | No bypass of legacy safety/payment/revocation fences; no email before readiness and required review |
| Failure / refund | ExceptionCase, operator notices, payment-refunds.ts, RefundAttempt and reconciliation | New-engine terminal classifications, explicit exhaustion/UNKNOWN status, durable refund intent after cancellation/failure policy permits it | No automatic paid retries/reset/new-book cycle, no blind repeat of a dispatched ambiguous PayMe refund |

### An approximately one-hour book

Keep HTTP checkout/webhook short. The book is a durable job, not one hour-long route. Preferred foundation: reuse the current Postgres job/lease/sweeper infrastructure, persist a checkpoint per paid operation, and drive a versioned new-engine worker distinct from bank stages. Plan/author/editor/reference/image/review/identity/audio each require their own durable claim/result; artifact persistence precedes QA. A dead worker leaves a pending/UNKNOWN reservation, not a fresh paid step. Keep a deployment/engine-policy pin across all worker invocations.

Current 300s runtime cannot host an unmodified operator or a 600s judge. After individual-stage measurement, either (a) use a server-only background process/worker under approved hosting with durable DB jobs, or (b) use platform durable workflow with steps, verified plan/limits and no automatic provider retries. Existing platform Functions are still bounded (current official docs: 300s Hobby, up to 800s Pro/Enterprise, 1800s extended beta); none supports an uninterrupted one-hour book. A hosting/provider commitment or new spend awaits Guy; $0 state/SQL/adapters proceed now. Do not label `after()` alone a durable one-hour worker. Long text calls may need provider-side asynchronous execution or a worker even if page images fit.

## 4. Hardcoding and authority design

One versioned order authority binds order ID, canonical reviewed request hash/options fingerprint, approved offer/policy references, deployment source and explicit render quality. It contains no bank selection filename, workstation paths, owner script grants, credentials or real child fixtures. Customer policy is MEDIUM; synthetic/test policy is LOW and cannot be a customer paid authority. Nine frame slots are the owner-approved launch format, not a child/story patch.

Use existing `AtomicOperationReceipt` and an Order-first lock for immutable, order-scoped authority/claim/result records. This avoids a competing mutable budget counter or new schema just for the foundation. All keys include protocol + orderId + stable logical step; claim/result payload hashes detect a changed wire, policy or settlement. The application owns policy admission; a browser never submits its own cap or approval reference.

Before each provider dispatch: under one transaction lock, verify paid/generating order with no hold, exact authority/policy, one-use step, maximum call count, and `known accounted + full pending/UNKNOWN reserves + next reserve <= approved cap`. Commit claim before dispatch and settle from raw provider usage after it. Single-flight per order is the initial implementation. A committed claim is **never** a dispatch token on replay, even when the original response was lost. A connection loss after claim is conservatively UNKNOWN; do not auto-retry. Artifact and claim evidence survive crashes. Higher-than-reserved actual usage remains recorded in full and stops future calls; a local meter cannot guarantee the provider's invoice or prevent a provider from billing above a reserve. Validate reservation bounds on real approved calls and reconcile invoices separately.

Pending/UNKNOWN is not zero and is not cleared by changing a cap, new output folder, deployment, session or restarting a job. Every new book/order requires its own verified payment and immutable authority; parent retries of one session reuse the same order. Customer cancellation and order holds stop dispatch and delivery. Preserve all historical grants, UNKNOWN reserves and paid evidence.

## 5. Files likely affected and milestone boundaries

Continue in this dedicated execution thread/worktree as the sole writer; no new overlapping task. Proposed focused milestones:

| Milestone | Files / dependencies | Owner decisions needed first | Smallest proof / commit |
| --- | --- | --- | --- |
| M0 | This plan, root CURRENT/ROADMAP/PROJECT/QUALITY_GATES supersession notes | Already authorized | Read-only repository evidence + `npx tsc --noEmit`; local docs commit if Git permits |
| M1 | `lib/engine-site/contract.ts`, `delivery-gate.ts`, focused specs | None: encode binding decisions, keep monetary authority externally supplied | MEDIUM/HIGH/test distinctions, exact nine-frame coverage, detail/material behavior, switchable byte-bound review; no production route activation |
| M2 | `lib/engine-site/order-meter.ts`, existing AtomicOperationReceipt integration, focused SQL/transaction specs | None for local implementation; no configured paid authority | Actual SQL through isolated PGlite, duplicate/changed-step/unknown/cap/hold/settlement replay; real two-session PostgreSQL later |
| M3 | Personal wizard/server preflight, new order discriminator/resolver, checkout/payment dispatch, durable new-engine worker + stage adapters | Price/SKU/entitlements, hosted author transport/runtime choice, per-order/global spend limits | Synthetic production-handler→worker→storage→reader→outbox/refund; actual Postgres before monetary reliability claim |
| M4 | Versioned native MEDIUM planner + meter, current engine as unchanged semantic owner | No further product decision for MEDIUM implementation; paid measurement separately approved | Provider-denied exact assembled-wire tests; reference quality policy/version and measured reserves; no edit of historical LOW receipts |
| M5 | New-engine readiness producer, operator action routes/UI, narration/PDF persistence, reader/delivery integration | Approved promised deliverables and legal/customer-facing policy | Auth/CSRF, approve/reject conflicts, stale hashes, off/on gate, rejection/refund and delivery race controls |
| M6 | Approved sample, measured MEDIUM book, independent QA, staging/production release | Each spend, external write and deployment separately approved | Exact committed/deployed SHA, real provider receipts, Guy's story/visual acceptance, launch GO |

M3–M5 can be split into smaller green commits. They are not claimed complete by foundations or mock fixtures. No merge of release UI or main in this run. No Prisma generation/package install through the shared node_modules junction.

## 6. Expected acceptance and switchable launch gate

Automatic acceptance requires a complete cover + eight ordered story pages; current supported story/preparation/reference and whole-book scale evidence; exact stored candidate/context/raw-review/identity bindings; no material or safety finding; valid measured child identity >=0.70 per page; correct rendering policy; complete promised narration/package artifacts; verified payment and no cancellation/refund/hold. Do not use a caller's `qa_supported` string or boolean as evidence: reconstruct the existing engine's assessment and bind it to persisted byte digests. Fine-detail findings are preserved for diagnosis and never block or cause regeneration.

The automatic rule yields accepted/held evidence. Delivery then passes the **same** readiness/outbox path through an additional launch policy:

```
automatically acceptable + current payment/readiness/fences
  -> operator gate required? valid latest decision for these exact bytes must be approve
  -> common readiness commit / outbox / send-time recheck
```

Initial configuration defaults to required; malformed/missing configuration never silently disables review. Disabling requires an explicit audited owner action setting the gate to off with policy revision and reason. Configuration does not authorize a held book, resolve a previous explicit rejection, or create an email by itself. Automatic acceptance and downstream fences run identically with the gate on or off. Existing pending **unreviewed** books can advance after an intentional disable; explicit rejection stays a hold until an audited later decision for the same book (and all automatic checks still pass). A gate change between evaluation and email must be re-read at send time or bump the shared delivery fence; stale off-policy readiness must not bypass a newly enabled gate.

Approve/reject audit is append-only: order ID, immutable content-manifest digest (ordered final text hashes, cover/page image hashes, required per-page audio hashes and offered PDF hash; plus source/storyboard/quality versions), actor user ID from authenticated server session, server UTC time, decision, reason, previous decision/revision and policy revision. No bearer URLs/secrets or photo bytes in audit logs. Any changed text/image/audio/PDF/source binds a different digest and invalidates prior approval. A stale rejection is not silently applied as a finding about new bytes; an explicit domain hold remains until resolved. Authority, audit and final readiness commit use Order-first locking and the existing input/delivery fence discipline.

Guy's eye is a launch gate above the automatic rule, not a substitute for 0.70 or safety and not an alternative manual pipeline. A new production evidence envelope must be admitted explicitly; old diagnostic manifests with runtimeEligible:false are never upgraded by changing a flag.

## 7. Validation plan

Smallest current proof is entirely synthetic/provider-denied: strict order/policy contracts, real acceptance impact vocabulary, nine-slot integrity, review on/off/approve/reject/stale-byte/automatic-hold controls, durable claims/results using the existing receipt table shape. `npx tsc --noEmit` passed at intake. Run relevant specs and `npm run check` for code milestones; preserve exact results and any baseline/environment failures. Do not claim full stability from focused tests. No broad test may authorize a service, real customer, provider, migration or paid call.

Then prove actual production entry points with synthetic injected stage transports and local ephemeral DB; before release prove Postgres multi-connection locks/unique constraints and claim-response loss, persisted artifact recovery, concurrent payment callbacks, cancel-versus-dispatch, reject-versus-email, policy toggle and refund ambiguity. Test negative controls (wrong order/policy/bytes, HIGH/customer LOW, forged approval, retired bank fallback, missing audio, expired lease, failed QA). No self-awarded independent PASS: Guy forwards immutable ranges to Claude Code for first-pass read-only review.

Runtime evidence not obtained: hosted writer/API model access, actual MEDIUM images/price/latency, real database pooler races, actual bucket privacy, PayMe account/webhook/refund operation, email/DNS/deliverability, operator UI and customer browser E2E. Existing bank tests and local audition success do not establish those.

## 8. Cost impact and production secrets

This track has **USD0 authority** now. No image, text, narration, key read, network provider smoke, new provider account or invoice action is authorized. Code/schema plans and local synthetic tests do not change that. Existing local USD5/USD7/USD12 envelopes are scoped history, not launch caps or reusable consent.

### MEDIUM planning estimate, not measured COGS or a proposed grant

Current official gpt-image-2 standard token prices: USD5/M text input, USD8/M image input, USD30/M image output. Estimate each call as `(5*T + 8*I + 30*O)/1e6`; include uncached input references (no assumed Image API cache discount). The official calculator is interactive; no exact MEDIUM output-token figure or per-image invoice was established here. For an explicitly hypothetical 9-image scenario with per-call T=4000, I=8000, O=2000–8000, image cost is **USD1.30–2.92**. Three attempts for every frame would make that **USD3.89–8.75**, before references, reviews, text and audio. These token assumptions are a sensitivity range, not measured MEDIUM usage or a hard reservation.

Budget planning allowances only: author/editor/story reviews USD1–5; preparation/child/reference sheets USD1–4; page reviews/identity USD0.5–2; TTS at the repository's conservative accounting rate (USD0.0001/character, not invoice verification), e.g. 4000 characters = USD0.40 and USD0.80 full reserve; storage/email/worker/PayMe fees/VAT/refunds separate. This puts an **illustrative short-book generation scenario around USD4–15 before widespread corrections**, potentially higher with correction allowance. Do not set retail price or an enforceable USD cap from this estimate. Required paid milestone: one exact MEDIUM book with Guy's explicit scope/cap/credential-reuse GO, record all input/output usage, wall time, corrections, known/UNKNOWN amounts and TTS/provider invoice limits, then decide margin and cap. LOW literary/visual sample also needs separate explicit approval.

### Secrets and authority

Use server environment/managed secret configuration for approved author, OpenAI image/review, ElevenLabs, PayMe, email and DB/storage credentials. Never NEXT_PUBLIC, client state, order payload, queue message, trace or audit. Worker uses scoped service credentials; separate preview/staging/production projects and deny production dispatch in previews. No env-file copies or absolute workstation secret paths in product state. Never import script keyReader into customer routes. Inspect only names/presence under a separately approved setup, never values. This run does not read `.env*`, list secret values or authenticate to production. Approved credential reuse/model/provider rights are a future activation decision; no new credential flow is needed for the $0 modules.

Store child photos and diagnostic/reference material privately with owner-scoped access and an approved retention/deletion policy; review public delivery images against the actual customer privacy promise. Supabase Storage RLS controls uploads/access and service-role bypass must remain server-only. Do not infer private storage from the reader's accessKey alone. Keep short-lived signed delivery links out of logging/chat.

## 9. Rollback, compatibility and unchanged behavior

Foundations are not imported by customer routes; reverting their focused commit removes them without data migration. Existing bank orders/readers/payments/refunds remain readable; no bank content is newly wired. Later rollout requires a new-order admission flag default OFF and immutable order engine discriminator. Disable **new** admissions/dispatch on rollback, park/reconcile in-flight claimed steps, keep artifacts/receipts and refunds operational, and never redirect personal orders into the bank or mint a new budget. Revert UI/worker independently only if old job versions remain serviceable. Do not delete tables, branches, worktrees, junctions or historical evidence.

### Dated critical path to November 30 (Asia/Jerusalem)

| Date | Exit criterion | Dependency / response to risk |
| --- | --- | --- |
| Nov 4–6 | Phase 0, local authority/gate/budget foundations, owner price/cap/host answers; immutable Claude review brief | This dedicated branch only; no external activation |
| Nov 7–10 | Personal order/payment dispatch + hosted stage design, synthetic E2E and durable checkpoints; MEDIUM wire tests | Review release UI refs separately; vendor/runtime decision must land by Nov 6 |
| Nov 11–13 | Guy approves fresh story + good-enough LOW short book by eye; fixes general engine defects only | Exact paid sample GO is required beforehand; scope/timing is a target, not present approval |
| Nov 14–18 | One explicitly approved MEDIUM measurement; narration, private assets, reader/PDF and launch review gate integrated | Decide measured cap/margin; no HIGH; no v2 dependency |
| Nov 19–22 | Approved staging: real Postgres/PayMe/provider/email gates and failure/refund exercises | Separate environment/write/spend authorization; exact service credentials |
| Nov 23–26 | Claude read-only adversarial QA, corrective commit(s), re-gate; Guy legal/content/visual/customer promise sign-off | Freeze launch changes, retain unresolved fine-detail notes as backlog |
| Nov 27–29 | Release-check at exact merge SHA, approved deployment, live signed-in/payment/delivery smoke, rollback drill | Requires Guy merge/push/deploy and paid/live approval; reserve two days for fixes |
| Nov 30 | Launch only after explicit Guy GO, initially operator review required for every book | If critical gates fail, return concrete HOLD/options; calendar does not override money/safety/privacy |

Top risks: unhosted local writer and long calls (critical); no measured MEDIUM reservation/latency (critical); lost paid calls and duplicate grants (critical); unproven payment/refund/receipt and delivery races (critical); child-photo privacy/public storage (critical); source-preparation manual frame choice and engine retry/resume semantics (high); release UI divergence and stale flags/docs (high); voice/media/PDF packaging and missing narration (high); company/legal/email setup (critical external); optional v2 drift (exclude from critical path); November schedule with slow owner/vendor gates (high). Each requires a named proof, not an optimistic checklist tick.

## 10. Review assignment and Guy's launch preparation

Guy supplies/decides:

1. Exact launch SKU/price, whether narration is included, whether PDF is offered, and the delivery-time/refund promise; no longer-length sales before December.
2. Per-order total/call/correction budgets and global launch spend ceiling after measured evidence; exact separate LOW and MEDIUM paid GO. No default dollar amount is activated.
3. Hosted author/worker/provider arrangement, permitted credential reuse, and later service/DB/deploy activation. The technical recommendation is durable ordered stages; provider spend/hosting purchase is Guy's choice.
4. Company/legal entity number, legal business address, access to `hello@` mailbox/domain and verified sender setup, cancellation/refund-policy sign-off, lawyer review of terms/privacy/child photos. Codex prepares integration/checks; does not invent identity details, accept terms or claim legal compliance.
5. Guy's story/visual acceptance, initial operator assignment, an explicit later audited gate-disable action, and final launch GO. The automatic target is already settled.

Claude Code should falsify: caller-supplied budget/approval, bank fallback, changed evidence after approval, LOW/HIGH on customer authority, duplicate dispatch after ambiguous claim, concurrent cap overruns, UNKNOWN reset, forged complete book/audio, stale policy at final send, rejection bypass when gate is off, unauthenticated review, wrong environment/deployment, payment-ack regression and repeat refund. First pass remains read-only; review exact base/head and report any mismatch before a verdict. Codex's local checks are not independent technical PASS. Claude Cowork can review customer promise, review UX and unnecessary launch complexity if Guy routes it; no automatic advisor/tool handoff occurs.

## 11. Do not do / completed stop-check

| Stop-check question | Answer |
| --- | --- |
| General or story-specific? | General order lifecycle, fixed launch-size product decision; no names/one-book patches |
| Could another story/child/style break? | Yes when live adapters land; version policies and test distinct synthetic requests/negative controls; preserve old readers |
| Production behavior affected? | M0–M2 foundation imports stay isolated; later wiring requires exact gate and approved decisions; no service writes now |
| Money spent? | USD0 now; no credential reads, provider construction/dispatch or paid tests |
| Smallest safe validation? | Strict contracts + acceptance/toggle controls + isolated receipt SQL and tsc/focused/full repository checks |
| Guy decision before implementation? | Binding format/quality/gate already explicit; monetary/hosting/legal decisions do not block isolated foundations |
| What must Claude falsify? | Authority, idempotency, cost/UNKNOWN, byte/policy binding, retired-bank fallback and money/delivery races listed above |
| Cowork review? | Optional product promise/UX/complexity only through Guy |
| What must Guy eyeball? | Fresh story + separately approved LOW sample by Nov 11–13; measured MEDIUM customer-format book before launch |

Forbidden: edits to another worktree, paid calls, full-book execution, `.env*` reads/copies, real customer data, production/Supabase writes, merge/push/deploy, bank reconnection, threshold changes, HIGH customer renders, new cleanup, changing an old grant/cap, automatic reviewer dispatch, or claiming launch/independent PASS from synthetic results.

### External documentation checked read-only (2026-11-04)

- OpenAI [gpt-image-2 model](https://developers.openai.com/api/docs/models/gpt-image-2), [standard pricing](https://developers.openai.com/api/docs/pricing#image-generation), [cost calculation](https://developers.openai.com/api/docs/guides/image-generation#calculating-costs): prices above support the sensitivity formula, not a measured MEDIUM book cost. No model migration is proposed.
- Vercel [Function limits](https://vercel.com/docs/functions/limitations): a one-hour book exceeds the documented single-invocation limits; actual account/plan was not queried.
- Supabase [Storage access control](https://supabase.com/docs/guides/storage/security/access-control) and [changelog](https://supabase.com/changelog): RLS/access principles checked; markdown changelog fetch was unsupported, HTML fallback inspected. No live bucket/project/advisor query, schema change or policy write occurred.

## Binding answers, second round, and implemented foundation boundary

Guy subsequently fixed the launch offer at **49 ILS all-inclusive: cover + eight story pages + narration + PDF, no add-ons**. Anthropic API is approved for the current Opus author/editor design; the production key will be supplied as an environment variable by Guy, never via chat or copied from an env file. Existing durable jobs remain the orchestrator. These supersede the open pricing/provider questions above; they are not paid execution approval.

The implemented local foundations are recorded in `PHASE-1-FOUNDATIONS.md`. They include the shared acceptance/review gate and append-only operator audit, order-scoped receipt meter, MEDIUM request planner/revalidation, server checkout pricing and default-off admission, legacy bank-worker refusal, and an injected/metered Anthropic API adapter. They do **not** yet create personal orders from the wizard, run the whole personal worker, materialize a production reader/PDF or send customer email. No new route is activated; `ENGINE_SITE_CHECKOUT_ENABLED` defaults off and must stay off until the complete flow qualifies.

### Revised economics and margin risk

See `COST-AND-RUNTIME.md` for formulas, sensitivity table, current-code reservation totals, source links and proposed USD8.50 total-order cap. The owner-supplied LOW observation is about USD5.50 for nine render/review/identity triplets (27 calls, not 27 image renders), plus USD1–2.50 for story/preparation. It was supplied in this thread; no local raw receipt/invoice was opened to verify that aggregate. It invalidates using the preliminary hypothetical token-only range above as a COGS forecast.

At the latest fetched Bank of Israel USD rate (3.1570, dated November 3), 49 ILS is USD15.52 gross; under the explicit 18% VAT modeling assumption it is USD13.15 before payment fees. Actual business VAT treatment and PayMe fees require Guy's business details. An illustrative 2.9% + 1 ILS payment fee and USD0.35 infrastructure allocation leave roughly USD12.04 for generation and contribution. These fee/infra figures are assumptions, not verified PayMe terms.

With 50% of the LOW native cost attributed to render calls, MEDIUM render multipliers 2/3/4 give approximately USD10.40/13.15/15.90 total generation including USD1.75 story/prep and 4000 narration characters. The middle scenario loses money after fees. Current per-step reserve declarations, at 16,000 prompt UTF8 bytes/four references, sum to about USD55.57 for all three attempts/frame, nine review re-asks, story/review ceilings, USD5 preparation, assumed USD1 child reference and narration reserve. This is a provisional declaration sum, **not** an established MEDIUM invoice upper bound or expected bill; current 8192 image-output reservation adequacy has not been measured at MEDIUM. Existing scoped operator caps would stop before all worst-case slots ran and are not reusable approval.

Propose a USD8.50 **total** order cap only after measurement and owner approval. It leaves modeled contribution on a completed order, but the middle cost scenario does not fit it: a cap can stop an order and trigger a refund, not make the product profitable. Preserve all UNKNOWN reserves. Never silently lower review capacity, switch the judge, use LOW corrections or weaken 0.70. Levers requiring separately approved evidence include fewer correction attempts, cheaper reviewer/tier, qualified shared references/cache and reducing proven redundant calls. Customer LOW correction images would contradict the current MEDIUM-only decision and need a new explicit owner decision. Measure a complete MEDIUM book before claiming 49 ILS viable.

### Concrete long-step finding

The existing timeout policy gives plan/replan 18,000 output tokens and 780s, author 8000 and 380s, editor 20,000 and 860s. Add 45s to persist. All exceed the currently configured 300s invocation; editor also exceeds an 800s invocation. CDE storyboard preparation and its semantic review have still larger configured caps. Do not shrink output caps/timeouts merely to fit a function.

The new Anthropic adapter returns `long_step_required` before claim/key access when the supplied invocation budget is too short. Finish the dedicated **step executor**, under the same durable GenerationJob/order/meter (not a parallel whole-book queue), for those long calls. It must heartbeat/fence its lease for the selected deadline: the existing seven-minute lease cannot simply wrap a 780/860s call. The standard chunk worker continues short steps and polling/checkpoint duties. No worker service was provisioned or run here; implementation and deployment remain distinct. OpenAI durable background review may fit existing jobs but must be proved at its exact assembled request and accounting boundary before activation.

Additional primary sources checked: [Anthropic Opus 5.5](https://platform.claude.com/docs/en/models/opus-5-5/overview), [API pricing](https://platform.claude.com/docs/en/about-claude/pricing), [structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs), [API authentication/version](https://platform.claude.com/docs/en/api/overview), [Bank of Israel USD](https://www.boi.org.il/roles/markets/exchangerates/usdollar), [Knesset VAT decision](https://main.knesset.gov.il/EN/News/PressReleases/Pages/press12324w.aspx). The Anthropic adapter pins standard global pricing, uses no tools or CLI, preserves original prompts/caps and validates decoded output against the original engine schema. It has only synthetic transport evidence; API schema/model/credential/latency efficacy is not claimed.
