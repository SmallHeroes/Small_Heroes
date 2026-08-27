# Retired operational scripts

These are pre-provenance-era experiment/operator scripts that write
`GenerationJob.pipelineCache` (and related delivery rows) DIRECTLY through
Prisma model operations — bypassing the delivery-input barrier
(`withDeliveryInputMutation`) and the structural ordinary-cache store
(`lib/generation-pipeline/pipeline-cache-store.ts`). Since the
order-package-authority milestone, the barrier-owned cache keys
(`visualContract`, `visualPackageAuthority`, `setIdentityBoards`) are the
durable producing-provenance/Board record every delivery gate binds to; a
whole-object cache write from any of these scripts could delete or roll back
that record without an `inputVersion` bump.

They are therefore RETIRED:

- Do not run any of them against a database that carries provenance-era
  Orders (staging or production). They remain in the repository for
  historical reference only (their outputs and evidence trails are cited in
  dated handoffs).
- Every script here is MECHANICALLY non-operational: a top-level
  `throw new Error('[retired-script] …')` guard sits directly after its
  imports, so it exits before any DB work. The writer census
  (`lib/__tests__/delivery-input-writer-coverage.spec.ts`) pins both the
  exact file list and the presence of that guard marker.
- The census scans `scripts/` and pins this directory as the ONLY place a
  direct `pipelineCache` model write may exist. Adding such a write to an
  active script fails the census; reviving one of these scripts requires
  migrating its cache writes to `persistOrdinaryPipelineCache` (ordinary
  keys) or a barrier mutation (barrier-owned keys), removing the guard, and
  moving it back out.
