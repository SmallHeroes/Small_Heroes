# Wizard Pre-Order Attestation — Implementation Evidence

## Outcome

The pre-Order decision is now one versioned, fail-closed artifact instead of an
operator joining two independent responses. Environment isolation remains pure;
an opaque Supabase backend key requires a real read-only proof against the exact
staging target; the approved package/contract/Blueprint/Board chain must then
pass in the same invocation.

## Authority semantics

- `wizard-preview-environment-preflight/v3` distinguishes
  `legacy_claims_matched`, `opaque`, `mismatched`, `missing` and `malformed`.
- The standalone environment endpoint never passes an opaque key. It returns
  `supabase_service_role_proof_required`.
- `wizard-preorder-attestation/v1` is the sole pre-Order PASS authority.
- A legacy staging service-role JWT uses its closed claims and still must pass
  the runtime Board-byte reads. An opaque key must additionally prove acceptance
  by listing at most one entry from the private child-photo bucket at the pinned
  staging URL.

## Capability boundary

The new Supabase adapter imports `@supabase/supabase-js` but exports only:

1. the bounded private-bucket credential proof; and
2. the read-only Board resolver used by dev preflights.

The runtime preflight core now requires injected Board resolver dependencies.
Both dev routes use the read-only adapter, so their transitive graph no longer
imports `lib/image-storage`, its upload helpers or its retry machinery. The
combined route remains free of Prisma, provider and image-generation imports.

## Privacy and effects

Responses contain only closed statuses/reasons, safe staging hosts/project ref,
bounded policy values, content digests and sanitized optional deployment
identity. They never include the service key, JWT payload bytes, DB URLs,
passwords, bucket contents or raw remote errors.

For the current two-Board package, the expected successful opaque path records
five Storage reads: one private-bucket list plus four real Board downloads (two
during binding and two during the final byte fence). The durable URL resolution
is pure and is not counted as I/O. Database writes, provider calls, render calls,
retries and fallbacks remain zero.

## Validation

The focused implementation tests cover:

- pure v3 environment classification and reason ordering;
- legacy and opaque combined PASS paths;
- hard-stop behavior for Production/wrong-role/malformed/missing credentials;
- rejected and unreachable proof results;
- runtime-authority and malformed-request failures;
- one bounded private-bucket call with no response-data leakage;
- 200/409/400/404 route behavior;
- exact Vercel trace authority files;
- a runtime import sentinel that rejects `image-storage`, Prisma, OpenAI,
  Replicate and generation modules.

The changed-and-adjacent matrix passes **9 files / 106 tests**.
`npx --no-install tsc --noEmit`, `npm run story:autonomous-typecheck` and
`git diff --check` pass.

The canonical Vitest supervisor exercised **320 files** partitioned as 300
ordinary and 20 resource-intensive files. The ordinary phase reported 3,522
passing assertions, 65 skipped and seven failed: five are the established
missing ignored-`outputs/` fixture assertions and two unchanged
package-promotion tests exceeded the repository's five-second timeout under
full parallel load. The resource phase reported 609 passing assertions and two
timeouts, plus three known `onTaskUpdate` RPC timeouts. All timeout cases passed
without code changes in bounded diagnostic runs: QA Bridge 8/8, execution
materialization 21/21, and package-promotion 8/8 with a 30-second test allowance
(the two slow cases took 7.4 and 5.8 seconds). No changed or adjacent functional
test failed. The repository-wide gate is therefore recorded as non-green rather
than being misrepresented as a PASS.

Independent Claude Code re-gate and deployment of the exact reviewed SHA remain
required before the authorized fresh Bar Order.
