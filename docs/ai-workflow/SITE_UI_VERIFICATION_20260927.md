# Website integration follow-up: QA brief and observed results

Status: focused implementation checks green; repository full gate RED; browser
and configured-environment checks incomplete; no independent PASS or deployment.

## Requirement and scope

Guy wants Claude's approved website UI on the current QA release, retaining only
the opening/outcome hero captions. Yesterday he requested local integration only;
today he resumed work and requested a status report. Keep the current release
backend, payment flow, reader authority and engine. No new render or paid work.

The existing Name Moment changed the landing text and persisted a child identity,
but the legacy Wizard had no consumer. Added a single shared small browser/CJS
contract, used by both React and classic JS. This is optional prefill, not trust
authority. Do not replace a deliberate existing Wizard identity or mix identities.

Fields: version 1, trimmed name (1-16 characters, no C0/DEL controls), boy/girl,
createdAt, expiresAt. Exact record shape, bounded JSON, 30-minute TTL; future,
expired, malformed and unknown-field records reject. sessionStorage keeps the
handoff tab-scoped; load does not extend expiry, edits replace/clear it, Wizard
consumes once. The old sh.hero-child localStorage key is removed, never imported.
Storage failures do not break either page. No backend/migration dependency.

Wizard restores its draft first and only then tries the handoff. Either an
existing name or an existing gender preserves the entire Wizard identity. The
one optional record is consumed even when rejected due to an existing identity.
URL category selection and product/style/price authority remain separate.

Rejected: permanent localStorage identity, passing names through URLs, replacing
restored drafts, or importing the old website backend into the served release.
Rollback: revert only this follow-up or abandon the isolated integration branch;
do not rewrite or delete the existing release or Claude worktrees.

## Frozen review scope

Worktree: C:/GNart/Work/sh-site-release-ui-integration
Branch: codex/site-release-ui-integration-20260926
Served release base: f223a54af36b075fe21660959e5a591743b351d4
Yesterday's merge: 9b68338a32d4c08b200a5f14a071bd3045c8f859
Other merge parent: 992493f5cdbb098fd2c4b7a7fc071c712e2b706d
Follow-up: commit containing this document. The final handoff supplies its full SHA.

Review BOTH the merge against served base and the follow-up against 9b68338a.
Do not limit review to the new handoff helper and infer that the merge is covered.
No other implementation task writes this worktree. Claude's first pass is read-only.

Topology rechecked before handoff:

- QA-bound release: sh-release-reader-final, f223a54a, clean, origin parity.
- Claude UI: wowredesign2, 51ce55fc, origin parity; 11 existing untracked _review
  scripts retained untouched. Its tracked tree is clean.
- Claude integration: qaexperience1, 70d4f245, clean, origin parity.
- Engine: sh-r3b1b-semantic-m1, 5f4e938f, clean, ahead 1; not merged or pushed.
- Protected d53b: 768ccb2f, clean. Protected accepted-intent-wave-2: 63ccb484,
  clean. Neither received writes.

No upstream is configured for this isolated integration branch. No push occurred.
The bound QA release branch must not receive this diff until the remaining gates.

## Files and validation

New shared module and declaration: public/JS/hero-child-handoff.js and .d.ts.
Consumers: app/landing/landing-page.tsx, public/JS/wizard.js and wizard.html.
Tests: new hero-child-handoff spec; expanded accepted-landing-wizard-presentation
spec executing actual ready.js in a mocked DOM; one email copy expectation;
inventory count 374/354 -> 375/355 with the new spec asserted in ordinary.
CURRENT and the integration Decision Gate record the state and exclusions.

The earlier merge also contains Claude's gallery generator helper. It was not
executed. It is not a website runtime route or permission to call a provider.

Executed focused command (native exit 0; 14 files, 112 tests):

```powershell
npx vitest run lib/__tests__/hero-child-handoff.spec.ts lib/__tests__/landing-motion.spec.ts lib/__tests__/accepted-landing-wizard-presentation.spec.ts lib/__tests__/reader-nav.spec.ts lib/__tests__/reader-page-turn.spec.ts lib/__tests__/reader-storytime-dwell.spec.ts lib/__tests__/reader-narration-src.spec.ts lib/__tests__/wizard-render-readiness.spec.ts lib/__tests__/wizard-mvp-matrix-api.spec.ts lib/__tests__/wizard-customer-sellability.spec.ts lib/__tests__/book-ready-email-render.spec.ts lib/__tests__/frozen-product-truth.spec.ts lib/generation-pipeline/__tests__/wizard-runtime-qualification.spec.ts lib/__tests__/vitest-workload-classifier.spec.ts --silent
npx tsc --noEmit
```

Counts: 25+3+6+8+30+2+4+5+5+6+8+2+1+7=112. tsc native exit 0.
Earlier focused pass: 102/102, before the 3 ready-client cases and classifier.
Initial focused attempt failed only the footer's em dash vs approved plain hyphen;
the updated expectation matches the merged content source, not a weakened check.

Literal npm run check: native 1. Both typechecks passed. Ordinary: 355 files,
331 passed / 7 failed / 17 skipped; 4745 passed / 11 failed / 73 skipped tests.
Inventory assertion was fixed afterward and passed in the focused run. Ten
other failures are missing local output fixtures in these six specs:

- child-lexicon-ages-5-8.spec.ts
- momentum-gate-koko.spec.ts
- page-entity-qa.spec.ts
- story-read-back-validation.spec.ts
- story-source-visual-direction-acceptance-lifecycle.spec.ts
- set-identity-board/__tests__/reserved-page-placement-authority.spec.ts

Their source bytes match f223a54a, but no fresh base full run was performed.
Resource: 20/20 files, 635/635 tests, three unhandled onTaskUpdate RPC timeouts,
phase native 1. This is NOT a green full check, and matches are not causal proof.
The full run did not include the later 3 ready-client cases. No whole raw full
log was archived; the figures above come from observed command/phase summaries.

Build: ENABLE_V3_APPROVED_BANK=true npm run build, native 0, compiled and 39/39
static pages. Existing Prisma configuration deprecation and skipped environment
validation warnings remain. Next skips its type validation by existing config;
the separate tsc was therefore required and passed. Prisma generated the client
in the existing shared node_modules target; no dependency/schema change.

Release checks, with ENABLE_V3_APPROVED_BANK=true and no DATABASE_URL:

- npm run release-check: 0, product/config only, 18/18 sellable, 1/18 render
  qualified. Explicit DB-schema skip, not a DB PASS.
- npm run release-check -- --require-render-qualified: 1; 17 missing approved
  packages (one also has an unqualified legacy contract). No gate bypass.

git diff --quiet f223a54a for app/api, backend, lib/generation-pipeline,
lib/visual-package, visual-packages, story-pipeline, story-bank, next.config.js:
exit 0. No engine policy, resemblance threshold, render cost or book bytes changed.

## Runtime limitation and remaining work

Built local next start on 127.0.0.1:3137 failed its instrumentation validation
because this isolated worktree has no service environment (only .env.example).
An attempted local-only dummy configuration was rejected by tool policy before
execution. No repeated/obfuscated attempt was made, no real keys pulled, and no
validation guard altered. The failed server was stopped and empty test tab closed.
Desktop/mobile rendering, hydration, name-prefill navigation and actual audio
playback are therefore NOT runtime-verified here. Unit/VM evidence is not a
substitute. No actual order, checkout, database, upload, model or TTS call ran.

Contact email remains unresolved: website uses hellosmallheroes@gmail.com;
retained legal surfaces use hello@smallheroes.co.il. Guy was asked asynchronously.
No answer was assumed, no legal text/promise changed. Resolve before promotion.

## Falsification targets for Claude

1. Attack the real shared module and both consumers, including malformed storage,
   expiry, future timestamps, removal refusal, pre-existing half/full identity,
   legacy-key retirement and script execution ordering. Try to corrupt product,
   price, gender or another saved Wizard draft through the handoff.
2. Inspect the entire served-base-to-head merge, especially Spotlight, withdrawn
   Style02 selection/default, fullscreen generating UI, cover/audio ready links,
   held-order handling and unchanged backend authority. No render to test this.
3. Verify the typed/CommonJS export is actually consumable in the built browser;
   unit VM tests alone do not establish React hydration or same-tab navigation.
4. Confirm the two endpoint captions, gallery, Suez font and voice preview remain
   correct on desktop/mobile once an approved configured preview is available.
5. Verify no real credentials, provider calls, source/package edits, threshold
   changes or deployment happened; do not call the strict render gate green.
6. Keep the full-check errors and missing runtime/environment proof visible. Do
   not promote matching historical failure signatures to proven root causes.

Cost: $0. No self-awarded independent PASS, no launch acceptance or new book proof.
