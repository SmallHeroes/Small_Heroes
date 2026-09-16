# Next general gap: original accepted sources versus replacement revisions

Update2026-09-17: the general first-replacement implementation is now present,
with73 focused tests and a full6364pass/73skip check. Read-only inspection covers
all18 actual originals; synthetic end-to-end tests cover publication/reload and
the genuine visual-direction enrichment consumer. See ORIGINAL_SOURCE_REPLACEMENT_HANDOFF.md
in the parent directory. Independent technical QA remains pending. No actual
source has been published or accepted by this work. The diagnosis below records
the pre-implementation state and still explains why old directions cannot be reused.

Read-only observation on08eb84b2 with only test/evidence edits in progress.
No source publication, approval creation, provider call or runtime override.

All18 accepted root manifests use
small-heroes-product-accepted-story-source-manifest/v1. Only Dini adventure and
Kim bedtime currently have a revisions/ directory. Panda adventure has none.
Its root manifest binds old story97f1fffc... and an old editorial review, not
the newly reviewed playground manuscript. Neither old approval nor visuals can
be transferred to a new source by editing a filename or story key.

The current creative-replacement lifecycle loadPredecessor requires an exact
accepted/<storyKey>/revisions/<digest>/manifest.json path and recognizes revision
v2/v4/creative-v1. It does not accept original root-manifest/v1 as predecessor.
This is a source-generation compatibility gap affecting16 catalog slots, not
a special Panda exception. This observation is from code and disk inventory;
no synthetic product acceptance or live publication probe was fabricated.

The older materialize-story-source-revision tool recognizes root/v1, but its
request binds old storyboard directions and exact text/direction replacements.
Using it solely to mint a predecessor for a rewritten story would inherit
irrelevant visual dependencies and add a needless intermediate revision.

Recommended next bounded milestone: general first-creative-replacement support
for fully verified original accepted sources. Reuse the actual accepted-source
validation, preserve source/review/product-acceptance/audit bindings, and keep
new exact editorial review and new content acceptance separate. Do not promote
an unaccepted draft or weaken any v2/v4 checks. Inventory validation must inspect
all real v1 shapes before design; presence of a version string is not authority.

Free preparation may proceed while content acceptance remains separate: an
exact source-bound review packet, fresh visual state and page coverage. Paid
images must wait for a useful qualified sample, not substitute a local draft
renderer for the customer pipeline. Book goal remains open; no technical PASS
or product/release readiness is inferred from the new Editor pass.
