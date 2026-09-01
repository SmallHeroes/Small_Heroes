# Architecture Simplification Findings — Observation Log

**Status:** observations only; no refactor is authorized before the first successful full render
through the new Wizard path.

**Product direction:** preserve fail-closed validation, replay safety and provenance while reducing
moving parts. After the first successful render, stop before a second book and review these items.

## Milestone boundary

Define two separately visible outcomes:

- **AUTHORING PASS:** Story Source → Blueprint → Visual Contract → required Boards → valid Candidate.
- **RELEASE PASS:** approved Candidate → package → locator/release selection → Wizard eligibility →
  Order → render/delivery.

A package locator or Wizard activation failure is a Release failure, not an Authoring failure.

## Findings to review after the first render

### Duplicated authority

- Frozen Visual Package, Order authority, pipeline cache and resolved contract repeat overlapping
  source/package/template/style/reconciliation identities and then cross-validate them.
- Frozen Board inventory repeats fields derivable from contract + style + Board version. This is
  useful hostile evidence today, but creates many contradiction states and validators.
- Board bind and pre-render assertion both re-derive admission/identity; retain the distinct
  byte-freshness fence, but investigate sharing one validated resolution result.

### Provider-owned data that may be compiler-owned

- Blueprint draft frames still ask the provider for `kind` and `pageNumber`, although exact frame
  coverage and canonical identities are compiler-owned and most technical fields are already
  overlaid deterministically.
- Continue the established principle: provider expresses semantic intent; compiler owns frame,
  check, prop/consumer and reverse-link plumbing wherever derivable.

### Repeated validation and gates

- Product resolution and sellability can evaluate the same Wizard selection more than once.
- Wizard runtime preflight qualifies a package, binds/asserts Boards, then render qualification
  reloads/revalidates the same immutable package.
- Separate real stage-specific freshness/CAS checks from repeated pure identity validation and
  consider one reusable validated authority snapshot.

### Legacy isolation

- Fresh product selection still contains ordinary v3/golden fallback for lineages that do not
  require a Visual Package. Review whether fresh authored products can use an explicit package-only
  lane while legacy slots remain isolated.
- Blueprint assembly shares current and legacy schema branches in one core implementation; current
  dispatch is guarded, but replay coupling remains.

### Earlier failure classification

- Visual Contract provider failures use rich sanitized classification; Blueprint provider failures
  currently collapse more cases into generic `provider_call_failed`. Reuse early structural
  classification without exposing raw provider prose or PII.

### Authoring versus release

- Package lifecycle artifacts distinguish candidate, approved and published, but publishing the
  current locator effectively activates Wizard sellability. Clarify whether locator publication is
  a Release action and whether a separate explicit release authority is needed.
- Track package/locator/Wizard/Order failures under RELEASE PASS rather than presenting them as book
  authoring failure.

## Review constraints

- No weakening of validation, provenance, replay or fail-closed behavior.
- Prefer one canonical owner plus derived views over duplicated authored truth.
- Do not invalidate historical artifacts merely to simplify fresh authoring.
- Tier future work: local/content → focused regression; contract/compiler → affected integration;
  authority/provenance/replay → full hostile QA and independent review.
