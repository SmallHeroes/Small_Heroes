# Hosted Wizard QA on the current engine (fake payment)

Branch `claude/wizard-qa-hosted-20261112` (from `1029ddf7`). Implemented by Claude Code at Guy's request on 2026-11-12. It needs Codex's independent review before anything merges.

## What Guy asked for

A QA site on the servers, not the local computer. The real `/wizard/personal` should be connected to the current, fixed engine, with GPT Image 2.6 illustrations. Everything should behave as if a customer did it, except payment: payment is simulated, so the book itself can be tested. Guy connects PayMe himself later.

## Changes

1. **Current-engine bundle for customer orders** (`lib/engine-site/current-engine-policy.ts`, `contract.ts`, `platform-policy.ts`, `personal-jobs.ts`).
   - The spend policy may carry `engineProfile: { version: 'customer-current-engine/v1', imageModelPolicy }`.
   - New orders then carry the whole set of policies the local books proved:
     - `responseSchemaPolicy`
     - `storyboardBindingPolicy`
     - `locationSheetPolicy` v2
     - `storyboardConcurrencyPolicy`
     - `imageModelPolicy`, e.g. `gpt-image-2.6-sunburst` at high complexity
     - `authorTransport`
   - The contract admits these on a customer authority only as a complete bundle. Owner extensions and queue policies stay test-only.
   - The budget adds the repair slots and the bound-review slot.
   - `assertEnginePolicyCurrent` checks each bundle field against the policy.
   - A policy without a profile keeps the historical recipe, digest and wire bytes.
2. **Opus author through Message Batches** (`provider-plans.ts`, `anthropic-author.ts`, `story-api-source.ts`).
   - The only step that needed a 25-minute "long worker" was the Opus author, with a 1,225 s budget.
   - Under the bundle, the author is now one batch create followed by short polls in later chunk invocations. It uses the existing durable pending-id mechanism, the same mechanism as OpenAI background responses.
   - Nothing is ever resubmitted.
   - An ambiguous create keeps the full reserve and parks the order (UNKNOWN). A transient poll counts as pending. An errored or expired request settles as unusable and unbilled.
   - Cost is priced at the documented 50% batch rate.
   - The pending deadline is 3 h.
   - Result: no separate long-running host is needed.
3. **Automatic storyboard repairs** (`native-recipe.ts`, `story-preparation.ts`, `provider-plans.ts`).
   - A held initial storyboard gets the engine's ordinary base ceiling automatically: up to two chained focused repairs, each built from the plan's own review.
   - This uses the same repair wire as the local runs. No owner extension is implied.
4. **Fake-payment QA mode** (`qa-order-policy.ts`, `qa-fake-payment.ts`, `app/api/engine-site/v1/qa/fake-payment`).
   - It is turned on by `ENGINE_SITE_QA_PAYMENT=fake`, and only inside the existing fail-closed QA scope: staging Preview, staging access gate, isolated Supabase project bound to the database URLs, and no production resource.
   - Fake mode never calls PayMe. Checkout, return and webhook all refuse, and the PayMe client base is blanked.
   - The QA parent's button marks their own fictional QA order `paid` with provider `qa_fake` and payment id `qa_fake:<orderId>`, once. Generation is then triggered.
   - Job start, the provider meter, recovery and family delivery all accept this proof only through `engineOrderPaymentAccepted`, which re-checks the scope.
   - A fake order has no refund liability.
5. **Several QA orders**: QA sessions are now per draft (`engine-site-qa-order/v2/<hash>`). An advisory-locked count caps them at `ENGINE_SITE_QA_MAX_ORDERS` (default 1, maximum 10). The legacy singleton id is still treated as QA.
6. **Cron stand-in on the Preview** (`qa-kick.ts`, order status route).
   - Vercel runs crons only on Production.
   - When the QA parent's status page polls, a QA job with no live lease and no update for 90 s gets one worker dispatch. The worker re-checks everything itself.
7. **Shared-project Preview self-calls** (`chain-worker.ts`): with `ENGINE_SITE_STAGING_PLATFORM_BYPASS=true` on a Preview, the worker self-call to its own staging host also carries the platform automation bypass. Option A, a dedicated project without platform protection, still never forwards it.
8. **Readiness report**: `GET /api/engine-site/v1/qa/readiness` returns booleans only:
   - scope, mode, flags, policy validity, model
   - database and storage privacy
   - whether each credential is present
   
   It is exempt from the app's Basic gate, but the platform's own protection still applies. It returns 404 outside QA.

## Staging database (applied 2026-11-12, staging only)

On `small-heroes-staging` (`qvksgpzzosotubcbizay`), migration `engine_site_private_posture` applied the reviewed private-database SQL:
- RLS on every public table
- browser roles lose table, column, sequence and schema-CREATE rights, and their default privileges
- the private bucket `engine-site-private` (`public=false`)
- the restrictive `engine_site_private_server_only` policy

Both runtime gates (`assertEnginePrivateDatabase`, `assertEnginePrivateStoragePolicy`) evaluate true. Existing rows were untouched: 9 orders, 9 sessions, 1 account. Production was not touched.

## Not covered / open

- Email delivery on the Preview needs the outbox cron. The Reader and status page show the book without it.
- A live hosted run has not happened yet. It needs Guy's explicit spend go.
