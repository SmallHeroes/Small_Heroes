# Wizard Preview Environment Authority — Implementation Evidence

## Outcome

One read-only Preview endpoint now makes the pre-order environment decision
independently inspectable without disclosing any secret. It does not create an
Order and has no database, storage, network or provider capability.

## Root cause

Vercel CLI can enumerate encrypted Preview variable names but does not return
their sensitive values. Independent QA was therefore forced to trust an
operator statement after a prior branch override briefly selected Production
resource identifiers. `CURRENT.md` also retained an unqualified historical
statement that the old deployment used one anchor attempt and lacked candidate
diagnostics, even though both conditions had already been corrected.

## Implementation

- `stage0-attempt-policy.ts` preserves the shipped 4/1/6 default/min/max
  calculation and is consumed by both anchor branches and the preflight.
- `wizard-preview-environment-preflight.ts` validates exact staging resource
  authority, fake payment, enforcement, LOW quality and bounded QA policy. It
  returns only safe hosts/refs, booleans/numbers, closed reasons and zero-effect
  counters.
- `/api/dev/wizard-environment-preflight` returns 200 only on exact PASS, 409 on
  Preview drift and 404 outside authorized non-production QA.
- `findProdResourceLeak` accepts an optional environment source for pure,
  deterministic validation; its existing callers and default behavior are
  unchanged.
- `CURRENT.md` distinguishes the immutable old incident from current authority.

## Security boundary

The response excludes complete connection strings, usernames, passwords,
service-role keys, site passwords, provider credentials and arbitrary error
text. The module performs no `fetch`, Prisma, Supabase client, provider or image
import. The fake-payment trigger remains separately password-gated.

## Validation

- passing exact staging and redaction
- all eleven closed mismatch families in canonical order
- preserved Stage-0 attempt semantics and both production call sites
- route 200/409/404 behavior
- throwing import/network sentinel with a provider positive control
- existing environment-separation, fake-payment, Stage-0 diagnostics and
  recovery suites
- `npx --no-install tsc --noEmit`
- `git diff --check`

The broader focused matrix passed 14 files / 152 tests. Literal `npm run check`
compiled both TypeScript projects and ran the canonical 319-file inventory. It
reproduced only five missing ignored-output-fixture assertions, the expected
new-file inventory pin (then corrected), seven unchanged 5-second Windows
timeouts, and three known Vitest worker RPC timeouts. All seven timed assertions
passed with one worker and a 30-second diagnostic allowance. No product assertion
failed and no ignored fixture was imported.

Independent Claude Code QA and deployed remote re-gate remain required before
the already-authorized fake-paid Wizard Order.
