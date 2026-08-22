# Decision Gate — Wizard Pre-Order Attestation

## 1. Proposed change

Replace the operator-side joining of two Preview preflight responses with one
dev-only, read-only `wizard-preorder-attestation/v1` response. It combines the
pure environment isolation decision, a bounded credential-validity proof for a
modern opaque Supabase secret, and the existing Visual Package / Contract /
Blueprint / Set Board runtime authority preflight in one invocation.

## 2. Why now?

The deployed environment preflight v2 rejected the current backend credential
as `unverifiable`, while the runtime authority preflight successfully used that
credential against the independently pinned staging Supabase URL. Supabase's
current backend credential is intentionally opaque (`sb_secret_*`), so project
identity cannot be decoded from the key. Treating the official credential form
as permanently invalid would block every fresh Wizard Order; treating it as
passed without a runtime proof would weaken the gate.

## 3. Observed and expected behavior

Observed: exact staging URL/database authorities and every bounded QA policy
passed, but v2 returned HTTP 409 solely because the opaque key carried no JWT
claims. The separate runtime preflight passed the exact current package and four
authenticated Board-byte downloads. No Order or paid call occurred.

Expected: the pure environment endpoint remains fail-closed and reports opaque
credentials as requiring proof. The combined endpoint returns PASS only when
all non-credential environment checks are exact, the opaque credential succeeds
on a bounded private-bucket read at the pinned staging URL, and the complete
runtime authority passes in the same request.

## 4. Root cause

The zero-network v2 classifier conflated two different states: malformed keys
and modern keys whose identity is intentionally opaque. The target project is
already selected independently by exact `SUPABASE_URL`, `DATABASE_URL` and
`DIRECT_URL` authorities. For an opaque secret, validity must therefore be
proved against that pinned target rather than inferred from nonexistent claims.

## 5. Scope

- environment preflight v2 to v3 vocabulary and reason semantics;
- one read-only Supabase preflight adapter with no upload API;
- one combined dev-only endpoint and orchestration module;
- removal of the write-capable `image-storage` import from both preflight route
  graphs;
- Vercel trace declarations, focused tests, `CURRENT.md`, and evidence.

No Wizard UI, Order, payment, database mutation, provider, render, production
environment, secret rotation, package, Story Source, Blueprint or Board artifact
changes are in scope.

## 6. Security invariants

1. Production and unauthorized Preview environments return 404.
2. Any missing, malformed, wrong-role or wrong-project credential stops before
   the proof call.
3. The proof targets only the exact staging Supabase origin and lists at most one
   item from the configured private child-photo bucket.
4. A rejected, unreachable or ambiguous proof can never PASS.
5. No secret, connection string, bucket contents or raw remote error is returned.
6. The route imports no Prisma, provider, generation, retry/upload or
   `image-storage` capability.
7. PASS requires the full current package/contract/Board preflight after the
   credential proof.

## 7. Alternatives rejected

- A manual waiver leaves no canonical evidence.
- A SHA-256 pin of the secret proves equality to operator-entered bytes, not
  validity at staging, and adds rotation/bootstrap coupling.
- A conditional standalone response still requires a human to join evidence.
- Credential rotation would issue another opaque key and does not solve the
  classifier mismatch.

## 8. Validation plan

- exact legacy, opaque, malformed, missing, wrong-role and Production-key
  classification;
- no proof invocation for every hard environment failure;
- proved/rejected/unreachable proof paths and bounded timeout;
- combined PASS, runtime-authority failure, invalid request and 200/409/400/404
  route behavior;
- response redaction and closed error vocabulary;
- import sentinel with `image-storage` and provider positive controls;
- exact Vercel trace includes/excludes;
- existing environment/runtime preflight suites, relevant storage/Board tests,
  `npx --no-install tsc --noEmit`, autonomous typecheck and diff hygiene.

## 9. Cost and rollback

The deployed gate adds one bounded read-only Storage list before the existing
four Board-byte reads. It creates no object and calls no provider. Rollback is a
focused commit revert; v2 and the split preflights remain historical evidence.

## 10. Approval and stop condition

Guy authorized completing the Wizard path and one LOW full-book render. Claude
Code issued GO on this architecture. The fresh Order remains HOLD until this
exact implementation receives independent re-gate PASS, is deployed from the
reviewed SHA, and the combined endpoint returns PASS.
