# R1D Candidate Validation Attestation — Decision Gate

**Status:** approved for implementation by Guy; Claude Code architecture diagnosis PASS
**Date:** 2026-08-19
**Branch:** `codex/r1d-mixed-source-compact-scheduler`
**Base:** `d461080bb86c4e32bfe8442891d583a699e46880`

## 1. Proposed change

Add one content-addressed, versioned
`qa-wizard-candidate-validation-attestation/v1` artifact. It records and
cross-binds immutable historical authoring provenance, the immutable Visual
Contract Candidate subject, the clean current consumer repository authority,
and the current `validateBookVisualContractTemplate` result.

Advance the QA Wizard candidate bridge manifest from v2 to v3 by adding a
required `candidateValidation` descriptor. Preserve exact v2 and v1 manifests
as read-only legacy evidence. Add an `attest-candidate-validation` CLI command
and require the attestation path for current `prepare-reconciliation` requests.

## 2. Why now?

The first new-story Chameleon live authoring run completed successfully and
persisted an immutable Candidate. A downstream validator correction at a later
clean pushed HEAD proved that Candidate valid without changing its bytes.

The bridge currently compares live Git directly to the historical Fresh
Readiness HEAD. That is correct during authoring but makes any downstream
validator correction impossible to consume: `prepare`, `approve`, and
`advance` all reject solely because current HEAD no longer equals the
authoring HEAD. Copying or weakening the Git checks would make stale consumer
code replayable. A separately named consumer-validation authority is the
missing concept.

## 3. Scope

This is a general QA-boundary and provenance change. It is not specific to
Chameleon, a child, companion, page, story, style, or render.

The milestone changes only:

- candidate-validation attestation construction, strict validation, loading,
  and content-addressed persistence;
- current consumer Git binding;
- QA Wizard bridge manifest v3 and legacy v2/v1 replay;
- bridge CLI request/command wiring;
- focused tests and engineering state/evidence.

## 4. Root cause and contributing factors

The bridge conflates two legitimate but different identities:

- historical authoring provenance: the exact Fresh/Execution/Candidate chain
  produced at the old pushed HEAD;
- current consumer authority: the clean pushed HEAD whose validator is now
  interpreting that immutable Candidate.

The raw Supervisor result also needs a content-addressed capture before the
bridge may consume it. That is a pure byte-preserving relocation and is not a
provider or authoring operation.

## 5. Rejected alternatives

- **Remove or relax Git checks:** permits arbitrary current code to reinterpret
  historical Candidates.
- **Accept an ancestor HEAD:** ancestry does not prove validator compatibility
  and is unsafe under rewritten history.
- **Retrofit authoring readiness/import preflight:** mutates historical
  authoring provenance to express a later consumer fact.
- **Run authoring again:** spends money, discards an audited valid Candidate,
  and does not repair the architectural gap.
- **Reuse human approval authority:** conflates machine validation with Guy's
  separate exact-content reconciliation approval.

## 6. Expected behavior

1. Historical authoring artifacts remain byte-for-byte immutable and are
   cross-bound only to each other.
2. Attestation construction runs the current template validator and live Git
   checks at a clean pushed 0/0 repository state.
3. A passed attestation is accepted only for its exact Candidate, source,
   request, receipt, readiness, Fresh evidence, execution request/result, and
   current consumer HEAD.
4. Every current manifest load re-runs live Git and requires exact equality to
   the attestation consumer section, preventing stale replay.
5. `prepare`, `approve`, and `advance` share the same pinned attestation through
   manifest v3.
6. The attestation authorizes reconciliation validation only. It grants no
   approval, Blueprint, Wizard, provider, image, render, publication, or
   deployment authority.

## 7. Validation plan

The focused proof must cover:

- successful cross-HEAD consumer validation with unchanged Candidate bytes;
- byte-identical `write:false` and `write:true` attestation construction;
- strict missing/extra-field, digest, path/category, and canonical-byte checks;
- modified Candidate/template and cross-Candidate replay rejection;
- wrong Fresh/request/result/receipt/readiness provenance rejection;
- historical authoring HEAD mismatch rejection;
- dirty, ahead, behind, wrong-branch, stale-head, and ancestor-only consumer
  rejection;
- failed validator result rejection as bridge authority;
- frozen scope and `doesNotAuthorize` enforcement;
- current v3 prepare/load/approve/advance propagation;
- exact v2 and v1 read-only replay without mutation or upgrade;
- CLI request-shape and new command coverage.

Run the focused bridge/Set Board/template surface, `npx tsc --noEmit`, one
literal `npm run check`, and `git diff --check`. Then commit locally and return
the immutable range to Claude Code for independent adversarial re-gate.

Only after Claude PASS may the existing Chameleon artifacts be handled in this
order: Supervisor capture preview, attestation preview, capture write,
attestation write, reconciliation preview. Stop before reconciliation write or
Guy approval unless separately authorized at that exact boundary.

## 8. Cost and render impact

Implementation and all validation are offline: zero provider, image, audio,
render, network-service, database, publication, or deployment calls. No new
paid live authoring attempt is needed or authorized by this milestone.

## 9. Rollback

Revert the focused commit. Existing authoring artifacts and legacy bridge
manifests are unchanged. No migration or destructive rewrite is required.

## 10. Owner and QA decisions

Guy has approved the technical milestone and the eventual render only after
the existing gates pass. Claude Code must independently falsify the exact
artifact bindings, current live-Git replay protection, v3 propagation, legacy
read-only behavior, scope containment, and absence of unrelated version or
authority drift.

No additional product, UX, story, visual, or creative decision is introduced.

## 11. Do not do

- Do not invoke a provider, Fresh Readiness, live authoring, image generation,
  render, publication, or deployment.
- Do not mutate the Candidate or any historical authoring artifact.
- Do not approve reconciliation or grant Wizard/production authority.
- Do not change prompts, schemas, model, policy, budgets, retry/fallback,
  style, reconciliation content, Blueprint, or Candidate shape.
- Do not accept dirty, divergent, ancestor-only, or stale consumer Git state.
