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
- `supabase-service-role-authority.ts` decodes only closed legacy JWT claims and
  returns `matched`, `mismatched`, `missing` or `unverifiable`; it never returns
  key bytes or claims. Opaque `sb_secret_*` keys fail closed because project
  identity cannot be established without a network/capability expansion.
- `wizard-preview-environment-preflight.ts` validates exact staging resource and
  service-role authority, fake payment plus its site password, enforcement, LOW
  quality and bounded QA policy. It returns only safe hosts/refs, closed enums,
  booleans/numbers, closed reasons and zero-effect counters.
- `quality-regen-policy.ts` is the single pure source for the durable Page-QA
  budget and environment resolution consumed by the renderer, evidence gate and
  preflight.
- `/api/dev/wizard-environment-preflight` returns 200 only on exact PASS, 409 on
  Preview drift and 404 outside authorized non-production QA.
- `findProdResourceLeak` accepts an optional environment source for pure,
  deterministic validation and now also identifies a decoded Production
  Supabase JWT supplied as the backend key.
- `CURRENT.md` distinguishes the immutable old incident from current authority.

## Security boundary

The response excludes complete connection strings, usernames, passwords,
service-role keys, site passwords, provider credentials, raw env values and
arbitrary error text. The module performs no `fetch`, Prisma, Supabase client,
provider or image import. PASS now proves that the fake-payment trigger's
password gate is configured; it does not disclose or validate the password.

## Validation

- passing exact staging and redaction
- all thirteen closed mismatch families in canonical order
- exact staging service-role classification plus prod, anon-role, missing and
  non-inspectable key rejection
- required fake-payment site-password presence and closed output enums
- preserved Stage-0 attempt semantics and both production call sites
- preserved Page-QA regeneration semantics through one shared policy source
- route 200/409/404 behavior
- throwing import/network sentinel with a provider positive control
- existing environment-separation, fake-payment, Stage-0 diagnostics and
  recovery suites
- `npx --no-install tsc --noEmit`
- `git diff --check`

The corrective focused matrix passed 14 files / 189 tests. Literal
`npm run check` compiled both TypeScript projects and ran the canonical
319/299/20 inventory. Ordinary reported 3,500 passed, 65 skipped and six
failures: five established missing ignored-output-fixture assertions plus one
unchanged 5-second package-migration timeout. Resource-intensive reported 608
passed and three 5-second timeouts plus three known Vitest worker RPC timeouts.
The four timed assertions passed with one worker and a 30-second allowance:
package migration 8/8, execution materialization 21/21, and QA Bridge 8/8; the
Bridge process still emitted one post-assertion RPC timeout. No product
assertion failed and no ignored fixture was imported.

Independent Claude Code QA and deployed remote re-gate remain required before
the already-authorized fake-paid Wizard Order.
