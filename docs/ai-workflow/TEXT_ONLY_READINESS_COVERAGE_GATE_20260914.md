# Text-only accepted-source readiness coverage — P2 gate

## Intake and finding
Claude supplied PASS0/0/1 for aa2e0711..3073b5ca. The fixture-isolation fix is
accepted; new P2 observes that no dedicated test pins how a creative-replacement
text-only accepted revision affects Wizard readiness. Guy previously directed
continuous progress. This milestone adds characterization coverage only.

## Intended contract verified from production code
A valid product acceptance in any revision makes acceptedProductLineage present
and closes V3 fallback. A creative-replacement revision has story.md and
runtimeEligibility false; acceptedProductSourceRevisionInventory deliberately
enumerates only fully reviewed integrated.md authoring revisions. Therefore a
text-only-only lineage must not become current product source, narration input,
or new render/spend authority for that text. It reports
accepted_story_source_revision_missing and routes to visual-direction
review/acceptance. A pre-existing approved package may remain render-qualified
against its own bound older integrated source; that status does not select or
qualify the text-only successor. When the matching integrated revision is added,
the strict accepted source becomes available and text readiness is computed.

This is a safety boundary, not a defect correction: accepted prose may exist
without being served against a stale visual package. The dedicated test must use
the actual tracked f77f4ca5 text-only bytes in an isolated accepted root and pin
the unavailable side explicitly. The existing canonical baseline already exercises
the integrated side; strengthen its Dini assertions instead of paying for a second
full audit in the new test. Do not change production code, summary expectations,
selectors, fallback, narration rules or accepted artifacts.

## Scope, topology and validation
Same sole-writer task/worktree/branch, base3073b5ca9c141a8185894b8a6b759cd1ba93c64f,
clean/ahead14. Protected dependencies768ccb2f/63ccb484 clean/read-only. One
existing Wizard readiness spec plus CURRENT/ROADMAP and this gate. Test creates a
contained temporary accepted root under outputs, copies exact revision directories,
and removes only its own checked absolute temp root in finally. Canonical sources
are read-only. Run the changed spec, fixture/correction adjacent specs, tsc and
full check; report full-check failures without waivers.

## Validation result
The changed Wizard readiness spec passes16/16. Its new isolated text-only test
completes in2.31s alone and1.46s inside the full check. The adjacent four-spec run
is56/57: only the unchanged correction-acceptance isolation test times out, and it
also times out when selected alone at5.72s. npx tsc --noEmit exits0.

Full npm run check exits1. Ordinary suite:353 files passed,1 failed,17 skipped;
5337 tests passed,2 failed,73 skipped. Resource suite:21 files passed,1 failed;
670 tests passed,1 failed. All three failures are five-second timeouts in existing
tests: Wizard allow-list override5.33s, Wizard semantic digest5.14s, and correction
acceptance isolation5.66s. The new text-only test passes. This does not classify
the failures as inherited/flaky or close the existing reliability P1.

Evidence logs:
outputs/dini-story-rewrite-20260913/execution-01/text-only-readiness-coverage-full-check.stdout.log
(SHA-256812667b6c3f732b52277ac5d84517ee293711d65955dff1a1cdaa6afef4a2767)
and matching stderr
(SHA-25619c03cf9c48f3deaddd10682ffbe8cf1fbfc575986dcd1d79042efaabd834236).

Acceptance: the dedicated text-only phase proves lineage present, zero strict revisions, no
current source/text readiness, revision-missing blocker and no provider-spend
authority. It also pins the deliberately surprising split: the old package remains
render-qualified and exposes its exact bound older integrated source, while the
text-only successor is not selected or qualified. The existing canonical integrated
baseline proves selected accepted source, successful supported narration/gender/
critical gates, zero soft-TTS items and no blocker. The isolated test must remain
independent of future accepted Dini revisions by copying only the exact text-only
revision it owns.

## Independent re-gate and P2 clarification
Claude independently returned PASS P0=0/P1=0/P2=1 for
3073b5ca9c141a8185894b8a6b759cd1ba93c64f..2ff3b4bd28bce5fb4a025f87f3c3a8aaf89f9b3f
and closed the original missing-coverage P2. Its new P2 correctly observed that the
test did not pin `productionStages.renderQualified: true`, despite the gate's broad
"no render authority" wording. Production inspection and Claude's whole-record
probe agree: the flag belongs to approved package4d6e8dee and its bound
64dcd0e7 integrated source, not to f77f4ca5. This correction adds the explicit
positive package-source and render-qualified assertions and narrows the prose; it
does not change runtime behavior, thresholds or authority.

Correction validation: exact selected test1/1 in1.412s; complete changed spec16/16
in14.32s; `npx tsc --noEmit` and `git diff --check` exit0. The full check was not
rerun because this correction adds assertions and documentation only. Its immediately
prior NON-GREEN result and three timeout records above remain current and receive no
waiver or classification.

## Stop-check and exclusions
Test-only general authority-boundary coverage, zero production behavior or spend.
The initial two-audit candidate passed alone but crossed Vitest's five-second test
budget under combined load. The final design uses one dedicated isolated audit and
strengthens the already-running canonical integrated baseline; raising timeouts was
rejected because it would hide the cost of redundant work rather than improve proof.
No story, source, review, image direction, prompt, anchor, reader, Blueprint,
package, payment, provider, credential, render, deployment, threshold or push.
No image to eyeball and no product decision required. Rollback is focused commit
revert. Claude should falsify that text-only authority cannot become current,
that the integrated transition is genuine, that temp containment/cleanup is safe,
and that no future canonical revision can alter the fixture.
