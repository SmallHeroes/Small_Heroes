# Personal-story product: implementation decision

Owner intent: Guy approved planning followed by implementation and chose the existing API key (2026-09-29). Codex implements; Claude Code reviews independently. Base: `fd2b26bdd694e95fcea68393da97df35b2cf97d4` on isolated `codex/personal-story-product`. No deployment or push is implied.

## Observation and root cause

The reviewed wizard accepts a strict request but returns `writer: not_connected`. The landing still describes prewritten plots, topic-bound companions and genre-based prices. Existing experimental writers take the old direction/prescription contract and do not consume the reviewed personal request or support this six-companion choice. Connecting them directly would drop reviewed facts and revive old topic/direction constraints.

## Proposed general solution and scope

Guy's subsequent copy/design instruction makes resilience and coping central to the product promise, not a gift add-on. Adopt the provided GPT document's central distinction: an optional chosen difficulty, but resilience as a story principle. Do not promise therapy, a guaranteed benefit or a fear that disappears. Retain the existing three lengths and intake completeness contract rather than silently adopting the document's alternative two-length/optional-residence proposals.

1. Build a preview-only personal manuscript writer at the existing reviewed-request boundary. Validate the request and selected length before accessing a provider. Resolve the companion from canonical data, not from a client-supplied prompt. Plan the whole adventure first, validate the plan, then write the manuscript against that plan.
2. Carry exact approved fact IDs and request identity through both stages. Keep residence distinct from the adventure starting place. Do not send transcripts, photos, keys or old draft suggestions. Keep invented events distinct from claims about the real child/family. Explicit exclusions apply to both stages.
3. Present readable text and honest failure/cancel/stale-result states in the current wizard. A manuscript is pending editorial/product review, not a render-authorized source. No automatic image, narration, order, payment or source publication follows.
4. Add a local, gated preview of the approved landing design with new personal-product copy and length-only choices. Leave the public legacy flow unchanged until independent QA and rollout decisions. This avoids advertising an unavailable customer checkout.
5. Add explicit resilience mode and proposed concrete child-choice/help moments to whole-story planning. Bind the mode to the parent's deliberate topic choice. These entries are editorial proposals, not proof that the prose expresses them or that reading produces a psychological benefit. Add an early, explicitly hand-written synthetic example to the site; preserve approved artwork/fonts/motion while improving information hierarchy.

Likely/actual surfaces: isolated `lib/personal-wizard/story-*`, the local manuscript API/summary, scoped personal landing copy/route/CSS and optional header props with unchanged public defaults. No source-bank, render, payment or intake-algorithm migration.

## Acceptance criteria and validation

Invalid requests, unknown options, missing length, duplicate jobs, unauthorised callers and exceeded budgets cause zero provider dispatches. The client suppresses writes/results for stale UI state; this is not durable server knowledge of a parent's newest draft. Each selected length requires 8/12/16 narrative beats representing 16/24/32 display pages; this is a structural requirement, not a live-production success claim. Six companions remain independent of topic. The second call cannot run after a bad plan. Cancelled or obsolete responses cannot replace current results. No output grants render authority. Tests exercise the actual route and injected provider, with negative controls; run focused tests, tsc and repository check, distinguishing measured failures from unproven baseline attribution. Inspect local mobile/desktop previews.

## Dependencies, money and unchanged behavior

Reuse the existing SDK pattern, signed-in operator/session authority, same-origin guards and per-process reservation ledger implementation, with an independent writer budget/flag and explicit priced model. Two bounded text calls per job, no hidden retries or fallback. Existing-key use is authorised; this milestone does not run images or audio. A conservative reservation is distinct from usage-based cost and provider billing. Local ledger is not a multi-instance production spend guarantee.

Do not alter intake parsing/tombstones, companion anatomy/assets, resemblance thresholds, the 18 accepted sources, image QA, checkout or approved visual tokens. The old writer and catalog flow remain available unchanged. Production durability, editorial/semantic accuracy and image qualification remain future gates; structural validators cannot prove prose truth or story quality.

## Rejected alternatives and rollback

Do not rewrite Claude's design, merely replace labels while keeping old category/direction routing, silently select a length, hand raw transcripts to a writer, or turn a successful text call into automatic book approval. Do not add a new all-purpose generation framework. Disable the explicit writer/preview flags to roll back; no database migration or published source needs undoing.

## Stop-check and QA assignment

General system change, not a child/story patch. Production remains gated off. Spend is bounded text only. Guy's product/key decisions are explicit; prices, rollout and manuscript acceptance are not assumed. GPT copy/UX consultation requested by Guy was completed read-only and informs the preview. Guy should inspect the voice-first flow, manuscript and copy; Claude should attack request/fact binding, rejected plan propagation, options/length mapping, budget/retries, privacy, stale/cancel races and all links that might revive old topic constraints. No self-awarded independent PASS.

## Execution observation, not a completed live proof

Two bounded synthetic text trials on intermediate code stopped at plan coverage before manuscript writing. Usage-based estimates: $0.037582 + $0.038606 = $0.076188; conservative reservations: $0.9372 against the stated $1 fence. No third call was made. The second raw plan has eight beats but numbering `[1,2,5,7,8,1,1,1]`. The first raw plan was not retained, so its exact mechanism remains unmeasured.

Final adapter schemas require exact ordered arrays and omit model-authored row numbers; the engine attaches `index + 1` without reordering or changing content. Offline SDK-boundary tests verify this. Final code, including the later resilience schema, has NOT completed a successful live plan/manuscript pair. Accounting retains usage even when a returned paid response fails schema validation. No retry, editorial acceptance, render authority or fallback follows.
