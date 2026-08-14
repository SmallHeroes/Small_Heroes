# Next-Generation Story Briefs

**Status:** staging only; no runtime, bank, render, or approval authority.

This directory contains the creative authorities between the six companion bibles and full-story drafting.

## Existing 18-slot dispatch

The v2 materializer remains byte-contract compatible. It can still list and
materialize the 18 curated slots, but its writer-facing rails have now been
shown to over-prescribe plot in the Dini cake example. Existing v2 outputs are
historical staging evidence, not preferred creative proof and not bank or
render authority.

The v2 dispatch continues to use:

1. `STORY_WRITER_FREEDOM_CHARTER.md`;
2. one selected card from `companion-authoring-cards.json`;
3. one closed writer-facing projection of the selected structured brief; and
4. commission identity and page/personalization metadata.

Do not change or migrate all 18 records merely because a new prompt is shorter.
Product evidence must establish that story quality actually improved.

## Story Architect pilot — historical proof

The first product-quality experiment deliberately covered only
`dragon_dini_adventure_wobble_cake_convoy_brief_v1`.

Its creative workflow is:

```text
small creative nucleus + Dini's inner psychology
  → Story Architect proposes exactly three genuinely different shapes
  → STOP: Guy selects A, B or C
  → Writer receives only the selected direction and writes the story freely
  → separate diagnostic-only Editor QA
  → targeted Writer revision that preserves proven strengths
  → only then derive structured metadata and image directions
```

The Architect does not receive the previous opening, beat sequence, companion
choreography, discovery, solution, climax, payoff or ending. The companion
portrait describes why Dini acts, not which wing, tail, object or maneuver she
must use. The three options must differ in their comic engine, journey,
obstacles, discovery, climax principle, payoff and surprise.

`STORY_DRAFT_EDITORIAL_QA_CONTRACT.md` retains the strict Small Heroes quality
standard after drafting. It is intentionally not dispatched to the Architect
or first-draft Writer, so quality checks do not prewrite the plot.
`companion-qa-canons.json` is also editor-only: it can reject a generic or
formulaic Dini without prescribing wings, tails, construction or catchphrases.

## Materialize the pilot

The command below writes a self-contained, content-addressed prompt and a
manifest. It does not call a model, use credentials or modify the story bank.

```powershell
node scripts/materialize-story-commission-briefs.cjs materialize-architect-pilot `
  --brief-id dragon_dini_adventure_wobble_cake_convoy_brief_v1 `
  --output-dir outputs/story-architect-pilot-dini-cake-v1
```

Paste the complete Markdown prompt into a new ChatGPT conversation. The first
response must contain three shapes and end with `WAITING_FOR_GUY_SELECTION`.
Do not ask it to write the story yet. Guy chooses one option first.

That pilot now has Editor PASS, independent artifact PASS and Guy product
acceptance. It is preserved as historical evidence. The general v3 route below
applies the proven creative separation to all 18 slots without changing the
old pilot or v2 dispatch.

## Manual v3 Story Architect commissions

`STORY_ARCHITECT_CHARTER_V3.md`, `companion-creative-psychology.json` and
`story-architect-commissions.json` remain the current manual-materialization
authority. They contain exactly 18 compact nuclei and six companion
psychologies. They do not dispatch the legacy screenplay rails, prescribed
locations, body-part choreography, exact discovery, exact climax or exact
payoff.

Materialize one commission:

```powershell
node scripts/materialize-story-commission-briefs.cjs materialize-architect `
  --brief-id bunny_ometz_bedtime_toy_inspection_depot_brief_v1 `
  --output-dir outputs/story-engine-vnext-bunny-bedtime-architect-v1
```

Materialize the complete next wave while excluding the already accepted Dini
adventure:

```powershell
node scripts/materialize-story-commission-briefs.cjs materialize-architect-wave `
  --exclude-brief-id dragon_dini_adventure_wobble_cake_convoy_brief_v1 `
  --output-dir outputs/story-engine-vnext-next-architect-wave-20260814-v1
```

The wave contains 17 prompts. Start with one bedtime and one fantasy prompt to
prove both remaining page contracts, then continue through the same queue. Each
story independently requires Architect selection, Writer draft, Editor PASS,
optional musical polish plus fresh PASS, and Guy product acceptance.

## Autonomous batch execution

The automated route reuses `story-architect-commissions.json` and
`companion-creative-psychology.json`, but replaces the manual v3 authoring
projection with `STORY_ARCHITECT_CHARTER_V4.md`,
`STORY_AUTONOMOUS_SELECTOR_CONTRACT.md` and
`STORY_AUTONOMOUS_WRITER_CONTRACT.md`. Its route is Architect → Selector →
Writer → Editor → at most two targeted revisions. It does not wait for Guy
to choose A, B or C: the Selector returns closed scores, and repository code
recomputes all eight equal-weight editorial axes, rejects disqualified or
sub-threshold options and requires one unique winner before the Writer can run.

Run one bounded pilot by supplying a single `--brief-id`, or omit that flag for
the default wave. The default wave excludes the already accepted Dini adventure
and therefore contains the other 17 slots:

```powershell
npm run story:autonomous-batch -- `
  --credential-source <LOCAL_ENV_FILE> `
  --output-root outputs/<NEW_CONTENT_ADDRESSED_RUN> `
  --brief-id bunny_ometz_bedtime_toy_inspection_depot_brief_v1 `
  --max-cost-usd <APPROVED_HARD_CAP>
```

The launcher exposes only `OPENAI_API_KEY` to the private child. Every result
remains `machine_qualified` staging only. It grants no accepted-source, bank,
Wizard, Visual Contract, render, storage, deployment or release authority.
Resume accepts only an identical HEAD and authority set, reuses completed
content-addressed stages and refuses to resend an ambiguous in-flight call.

## Product-accepted story sources

`story-pipeline/04_approved_story_sources/` is durable text-source authority,
not the served story bank. Promotion requires an exact Editor PASS, exact story
digest, independent artifact PASS and a tracked Guy acceptance record. The
accepted story is written byte-for-byte as `story.md` with a bound manifest.

This source still needs page-grounded visual directions and the normal bank,
Wizard and visual-pipeline gates before it can replace a served slot. Never copy
an accepted prose-only source directly over `story-bank/v3-approved`.

## Materialize an Editor review

Store the completed staging draft as a regular Markdown file under `outputs`,
then materialize a diagnostic-only review prompt:

```powershell
node scripts/materialize-story-commission-briefs.cjs materialize-editorial-review-pilot `
  --brief-id dragon_dini_adventure_wobble_cake_convoy_brief_v1 `
  --draft-path outputs/story-engine-vnext-dini-cake-draft1/draft.md `
  --output-dir outputs/story-engine-vnext-dini-cake-editor-review-v1
```

The Editor returns a closed `pass`, `revise` or `reject` JSON result. It may
name functional gaps and revision priorities, but it must not rewrite the
story. The Writer revision remains a separate step. Draft input is restricted
to non-symlink Markdown files under `outputs`, between 1 byte and 64 KiB.

For a validated `revise` result, store the returned JSON under `outputs` and
materialize the separate targeted Writer commission:

```powershell
node scripts/materialize-story-commission-briefs.cjs materialize-targeted-revision-pilot `
  --brief-id dragon_dini_adventure_wobble_cake_convoy_brief_v1 `
  --draft-path outputs/story-engine-vnext-dini-cake-draft1/draft.md `
  --review-path outputs/story-engine-vnext-dini-cake-editor-result-20260813-v1/review.json `
  --output-dir outputs/story-engine-vnext-dini-cake-targeted-revision-v1
```

The review input has an exact closed schema, bounded issue catalog and bounded
page locators. Only a `revise` verdict can authorize this materializer. The
commission binds the original draft and review digests, preserves the Editor's
strengths and `mustPreserve` list, exposes deterministic mechanical fixes only
for diagnosed format issues and leaves the creative implementation of a
functional story gap to the Writer.

Before a revised story returns to the Editor, pass it through the bounded intake:

```powershell
node scripts/materialize-story-commission-briefs.cjs normalize-targeted-revision-pilot `
  --brief-id dragon_dini_adventure_wobble_cake_convoy_brief_v1 `
  --draft-path outputs/story-engine-vnext-dini-cake-revision1-raw/draft.md `
  --review-path outputs/story-engine-vnext-dini-cake-editor-result-20260813-v1/review.json `
  --output-dir outputs/story-engine-vnext-dini-cake-revision1-normalized-v1
```

This intake is not a prose editor. It verifies exact identity, 12 sequential
nonempty pages and full-form gender chips. It may normalize only a malformed
frontmatter closing delimiter when the bound Editor result explicitly contains
`output_structure_invalid`; all other malformed structure fails closed.

## Existing v2 commands

```powershell
node scripts/materialize-story-commission-briefs.cjs list

node scripts/materialize-story-commission-briefs.cjs materialize `
  --brief-id dragon_dini_adventure_wobble_cake_convoy_brief_v1 `
  --output-dir outputs/story-commissions/dini-adventure

node scripts/materialize-story-commission-briefs.cjs materialize-all `
  --output-dir outputs/story-commissions/all-18
```

Every generated file remains staging-only. Brief acceptance does not approve prose.
Draft acceptance does not approve bank integration or rendering.
Do not supply any V3/V5 story, rejected spine or provider output as positive
authoring context.

## Catalog guarantees

- exactly 18 records: six MVP companions × three directions;
- page counts remain bedtime 8, adventure 12 and fantasy 16 text pages;
- every full editorial brief remains available for post-draft review;
- child references use `{{childName}}` plus distinct `{boy-form|girl-form}` chips only where Hebrew grammar differs;
- every companion remains causally indispensable;
- old-bank material remains anti-copy evidence, never positive authoring input;
- all records remain `draft_for_guy_review` until Guy explicitly accepts them.
