# Decision Gate — Wizard Preview Environment Authority

## 1. Proposed change

Add one Preview-only, read-only environment preflight that exposes only safe
resource hostnames, the expected staging Supabase project reference, resolved
bounded QA policy values and closed pass/fail reasons. Extract the Stage-0
anchor-attempt calculation into one shared helper used by both render branches
and the preflight. Correct `CURRENT.md` so the old one-attempt incident is
clearly historical and the already-shipped per-candidate diagnostics are not
misread as an open blocker.

## 2. Why now?

Independent QA can reproduce the package/Board authority offline but cannot see
through Vercel SSO or inspect encrypted branch values. A prior Preview
misconfiguration briefly selected Production resource identifiers, so the next
fake-paid Wizard Order must be gated by runtime evidence rather than an operator
claim.

## 3. Scope

General non-production observability and fail-closed pre-order validation. No
story-, child-, companion- or page-specific runtime behavior is introduced.

## 4. Risk of hardcoding

The endpoint intentionally pins the existing staging Supabase project and the
approved bounded Preview policy. These are environment authorities, not content
special cases. Production always returns 404.

## 5. Files likely affected

- `lib/generation-pipeline/stage0-attempt-policy.ts`
- `lib/generation-pipeline/wizard-preview-environment-preflight.ts`
- `lib/generation-pipeline/chunk-runner.ts`
- `app/api/dev/wizard-environment-preflight/route.ts`
- focused tests
- `CURRENT.md`

## 6. Expected behavior after change

On the approved Preview, the endpoint returns `passed` only when all database
and Supabase authorities point to exact staging, no Production identifier is
present, fake payment and Visual Contract enforcement are active, image quality
is LOW, and the bounded anchor/page-QA policy resolves to the approved values.
The response never includes credentials, connection strings, tokens or secret
values. Any mismatch returns a closed reason list and HTTP 409. Production and
unapproved Preview deployments return 404.

## 7. Validation plan

Unit-test passing staging, every authority-family failure, production leakage,
bounded numeric parsing, response redaction, route status and provider/DB/network
import isolation. Run the Stage-0 diagnostics/recovery tests, fake-payment gate,
environment-separation tests, `npx --no-install tsc --noEmit`, diff hygiene and
the ordinary repository check where practical. Independent Claude Code review
precedes deployment; a temporary Vercel share URL then permits remote re-gate.

## 8. Cost impact

Zero provider, image, audio or database cost. The endpoint performs no network,
database or storage operation.

## 9. Rollback plan

Revert the focused commit. The existing generation and payment paths are
otherwise byte-for-byte unchanged.

## 10. Review assignment

Guy already authorized completing the Wizard path and one LOW full book after
the gates pass. Claude Code must falsify secret leakage, Production reachability,
policy drift, import/call capability and mismatch handling. No creative/product
review is needed for this observability milestone.

## 11. Do not do

Do not create an Order, confirm fake payment, call any provider, render an image
or audio asset, rotate Production secrets, mutate Production, or treat local
green status as independent technical PASS.
