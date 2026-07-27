# R1D-PVB-D0 Production Lifecycle Tooling

This document is the operator and reviewer map for the deterministic D0 tooling. It does not authorize a real lifecycle run.

## Authority sequence

Each arrow is a validation edge, not approval propagation:

```text
source snapshot + template
  -> reconciliation draft/review
  -> separate approved reconciliation
  -> source + template + reconciliation + stable style context
  -> provider-isolated whole-book Blueprint authoring
  -> Blueprint evidence/review
  -> separate exact Blueprint approval
  -> Board/prop compatibility
  -> content-addressed v4 candidate
  -> separate package review
  -> separate exact Guy package approval
  -> approved v4 finalization
  -> separate immutable publication and mutable locator update
```

The Blueprint is the sole composition, camera, staging, action, pose, blocking, placement, and layout authority. Visual Contract content remains facts-only. Set Boards and prop references supply only approved appearance/geometry identity.

## Canonical artifacts

- Style01 authority: `style-authorities/style01/soft_hand_drawn_storybook.style-authority.json`
- Production context: `production-authoring-context/v1`
- Reconciliation review: `source-prompt-reconciliation-review-bundle/v1`
- Authoring request/receipt: `production-blueprint-authoring-request/v1` and `production-blueprint-authoring-receipt/v1`
- v4 candidate: `visual-package-v4-candidate/v1`
- Package review: `visual-package-v4-package-review/v1`
- Package approval: `visual-package-v4-approval/v2`
- Offline qualification: `visual-package-v4-offline-qualification/v1`
- Final package: `visual-package/v4`

The v2 package approval adds `packageCandidateDigest`, `packageReviewDigest`, and the exact non-authorized-action boundary to the pre-existing exact Blueprint approval digest. Package review carries the same boundary. Removing any image-render, publication, locator, production, deployment, or release exclusion invalidates the review or approval even if its content digest is recomputed. A v1 approval cannot qualify.

## D0 CLI

Use PowerShell argument separation; do not combine a flag and value with `=`:

```powershell
npm run production-visual-lifecycle -- --help
npm run production-visual-lifecycle -- readiness --request .\request.json
npm run production-visual-lifecycle -- context --request .\request.json
npm run production-visual-lifecycle -- reconciliation-draft --request .\request.json --out visual-packages\working
npm run production-visual-lifecycle -- authoring-preflight --request .\request.json
npm run production-visual-lifecycle -- assemble-v4 --request .\request.json --out visual-packages\working
npm run production-visual-lifecycle -- qualify-v4 --repo-root . --candidate .\candidate.json --review .\review.json
```

`--out` on D0 draft/assembly commands returns only content-addressed planned paths. It does not write.

The final two commands validate already-existing external decisions without minting them:

```powershell
npm run production-visual-lifecycle -- finalize-plan --repo-root . --candidate .\candidate.json --review .\review.json --review-artifact visual-packages\working\package-reviews\<digest>.json --approval .\guy-approval.json
npm run production-visual-lifecycle -- publication-plan --repo-root . --package .\approved-package.json --approved-dir visual-packages\approved
```

They return in-memory/package-location plans only. The D0 CLI has no `approve`, `live`, or write-publication command.

## Request files

Readiness accepts the arguments of `auditProductionStoryReadiness`, including exact repository root, story/template/style/reconciliation paths, target stage, optional Blueprint artifact paths, and optional Board registry root.

Context accepts:

```json
{
  "repoRoot": "C:\\absolute\\repo",
  "storyKey": "story_key",
  "storyPath": "story-bank/story.md",
  "templatePath": "visual-contract-templates/story.visual-contract-template.json",
  "reconciliationPath": "visual-package-reconciliations/story.json",
  "styleId": "soft_hand_drawn_storybook",
  "styleAuthorityPath": "style-authorities/style01/soft_hand_drawn_storybook.style-authority.json",
  "expectedStyleAuthorityDigest": "optional exact digest"
}
```

Reconciliation draft accepts the first four source/template fields only. It snapshots the source, validates the template against it, derives authored cover authority, and returns an incomplete deterministic draft plus blocking review bundle.

Authoring preflight accepts:

```json
{
  "context": { "...": "the context request above" },
  "authoringRequest": {
    "version": "production-blueprint-authoring-request/v1",
    "mode": "preflight",
    "requestId": "bounded-operator-id",
    "requestedAt": "2026-07-27T12:00:00.000Z",
    "contextDigest": "exact context digest",
    "model": "exact future model id",
    "reasoningEffort": "exact future setting",
    "maxOutputTokens": 48000,
    "noFallback": true,
    "callBudget": {
      "maxCalls": 3,
      "maxRepairCount": 2
    }
  }
}
```

The D0 entrypoint rejects `mode:"live"` before a provider boundary can exist.

Assembly accepts the context request, exact five Blueprint lifecycle artifact paths, structured Visual Contract review reality, and optional Board registry directory.

## Failure and mutation semantics

- Source raw/normalized mutation invalidates context, Blueprint authority, candidate, review, and approval.
- Template, reconciliation, or stable style content mutation invalidates every dependent artifact.
- Blueprint, provenance, validation, review packet, or planning approval mutation invalidates the v4 candidate.
- Board/prop registry identity or bytes changing invalidates compatibility.
- Candidate changes invalidate package review and package approval.
- Review changes invalidate package approval.
- Approval never writes a locator and publication never creates approval.
- Malformed values return structured offline qualification reasons where qualification is total; assembly/finalization throws a bounded lifecycle error.
- Absolute/escaping artifact paths and content-address collisions fail closed.

## Persistable authoring receipt

Receipts may contain bounded provider/model/response labels, exact call and repair counts, prompt and response digests, sanitized token usage, validation errors, and stable failure codes.

They never contain raw system/user prompts, raw provider output, credential values, environment values, authorization headers, or raw provider exception text.

## D0 boundary

D0 implementation and tests use only synthetic temporary artifacts plus a read-only real readiness fixture. No command in this document has been run against a real lifecycle artifact. No approval, publication, locator, production flag, provider, render, network, storage, database, or Board action occurred.
