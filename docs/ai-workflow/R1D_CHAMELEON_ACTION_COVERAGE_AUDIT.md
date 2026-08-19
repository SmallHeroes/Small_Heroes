# R1D Chameleon Action Coverage Audit

Status: offline evidence audit; no provider, Fresh, live, Wizard mutation, image, or render authority.

## Decision use

This audit answers one narrow question before another paid authoring attempt:
does `chameleon_koko_bedtime` prove that the closed Action Semantic Catalog
needs new predicates, or do the observed diagnostics point to a different
action-authority failure?

It does not authorize a catalog edit. Candidate predicates below remain
hypotheses until a Decision Gate approves their complete semantic definitions.

## Sources and grain

- Story Source: `story-bank/qa-autonomous-20260815-v1/chameleon_koko_bedtime.md`
- Consumed source snapshot:
  `outputs/r1d-typed-prop-fresh-1df7fc41-20260819T071733950Z/b0/source-snapshots/11d2e009d7e7b4aabd4240aeb8aa5e057762dc5551b3ca322ba01103fba3c995.json`
- Consumed receipt:
  `outputs/r1d-typed-prop-fresh-1df7fc41-20260819T071733950Z/b0/authoring-receipts/0d74837114d463afe193e15fb4169678ee475f132f390866038221a1ffc5b4f1.json`
- Story pages: 8.
- Source Evidence entries: 92, distributed `10/13/8/13/16/14/9/9` by page.
- Attempt-1 diagnostic population: 22 emitted and 22 normalized unique issues.
- Attempt-1 capability gaps: 12, distributed `p2:2, p4:2, p5:1, p6:1, p7:3, p8:3`.
- Attempt-1 page-final identities carrying
  `page_action_requirements_invalid`: five (`p1, p3, p4, p5, p6`).
- Current catalog: 34 predicates.

The units above must not be merged. A capability-gap identity, a page-final
identity, a raw validator message, a Source Evidence entry, and a predicate are
different grains.

## Proven limitation

The failed provider draft is intentionally not persisted. The receipt retains
the capability-gap page and coverage index but not the draft coverage record or
its `sourceEvidenceId`. A coverage index therefore cannot be joined reliably to
one of the 92 Source Evidence entries after the fact.

Consequences:

1. The exact 12 failed phrases cannot be reconstructed from the consumed
   artifacts.
2. A story-text candidate on the same page is evidence for catalog design, but
   is not proof that it was the provider's failed coverage record.
3. `page_action_requirements_invalid` cannot be interpreted as a missing
   predicate without the lower-level validator clause.
4. A future observability change, if still needed, should persist a minimal
   typed Source Evidence reference and closed cause. It should not persist a
   raw failed draft, prompt, response, or story phrase in the receipt.

The offline harness now closes the corresponding future-test gap without
changing persisted live evidence. For every injected or recorded draft-shaped
response it emits a sanitized coverage census containing page/index/beat,
Source Evidence ID, disposition kind, matching action indexes and attempted
predicates. It deliberately omits source phrases, contract values, prompts and
raw responses. Historical receipts still cannot be retroactively enriched.

## Existing catalog coverage

The following prominent story actions already have a plausible closed
predicate and must not be used as evidence for catalog expansion without a
separate invariant failure:

| Story action | Existing predicate candidate | Pages | Audit note |
| --- | --- | ---: | --- |
| walking / leading movement | `walks`, `moves` | 1, 3, 5, 6, 7 | Existing; failures may be subject/object/spatial/binding rules. |
| turning | `turns` | 2, 8 | Existing. |
| waving the timetable | `waves` | 5 | Existing. |
| closing eyes | `closes` | 4 | Existing; object authority may still be invalid. |
| listening to the city | `listens_to` | 4 | Existing. |
| opening the bus door | `opens` | 6 | Existing. |
| placing the backpack / raising the flashlight | `places`, `holds` | 6 | Existing candidates. |
| climbing or sitting | `climbs_onto`, `sits`, `sits_on` | 3, 7 | Existing candidates. |

The observed failures of pages containing these verbs do not prove a catalog
gap. They may expose a static catalog rule, same-page authority, spatial
effect, laterality, projection, coverage, or beat-binding violation.

## Candidate missing predicates

Confidence refers only to the story-to-catalog comparison. It does not claim a
join to one of the 12 historical gap records.

| Candidate | Exact story evidence | Page | Confidence | Recommendation |
| --- | --- | ---: | --- | --- |
| `runs` | `התחנה רצה אחריו.` | 5 | high | Visually material and no equivalent locomotion predicate preserves running. |
| `blinks` | `קִים מצמצה.` | 2 | high | Visually material facial action; no current predicate is equivalent. |
| `folds` | `הספסל שלה התקפל כמו זוג ידיים עקשניות.` | 2 | high | State-changing object action; requires a non-cast subject design decision. |
| `sings` | `האופה שר בקול.` | 4 | high | Visible performance with sound; decide action versus presentation cue. |
| `nods` | `{{childName}} הנהנה.` | 4 | high | Common visible child gesture; no equivalent predicate. |
| `sleeps` | `...ונרדם.` and `עכשיו זמן לישון.` | 8 | high | Repeated bedtime state; decide action versus static-state presentation. |
| `braces` | `התחנה נטעה את רגליה במדרכה.` | 2 | medium | Visual resistance pose; may be static-state presentation rather than action. |
| `stops` | bus/station/swing stops | 4, 5, 7 | medium | May be represented by movement state or negative transition, not necessarily a new predicate. |
| `rolls` | `הוא התגלגל ברחוב...` | 5 | medium | Could be `moves` with a typed spatial effect if semantics are adequate. |
| `falls` | `כשעץ נפל...` | 6 | medium | Historical/background event may be non-visual on the current page. |
| `spreads` / `settles` | station spreads its roof and settles | 7 | medium | Could be prop-state/presentation rather than action. |
| `yawns` | station yawns | 1, 8 | medium | Could be a visible action or a graphic/sound presentation cue. |

## Page-level interpretation

| Page | Observed gaps | Story candidates | What is proven |
| ---: | ---: | --- | --- |
| 1 | 0 | walks, shakes, yawns | No capability gap; one page-action structural identity proves another action invariant can fail even when catalog coverage does not. |
| 2 | 2 | blinks, turns, braces, folds | At least two coverage records were unsupported; exact records are unavailable. |
| 3 | 0 | climbs, frees, returns, leads | Existing catalog can cover the page, while a page-action structural identity still exists. |
| 4 | 2 | stops, sings, closes, listens, nods | Mixed existing and missing candidates; catalog expansion alone is not a complete fix. |
| 5 | 1 | rolls, waves, stops, runs | Running is the strongest true-gap candidate; exact historical join is unavailable. |
| 6 | 1 | falls, waits, leads, places, opens | The historical tree fall may be context rather than a current visual action. |
| 7 | 3 | boards, moves, stops, spreads, settles, sits | Several actions may belong to prop state or presentation authority. |
| 8 | 3 | enters, curls, sleeps, slides, turns, yawns, waits | Bedtime state is visibly central; `sleeps` is a strong catalog-or-presentation decision. |

## Findings

### High confidence

1. Action Semantics is a dominant blocker for this story: 17 of the 22
   attempt-1 unique identities are the 12 capability gaps plus five page-action
   structural identities.
2. The current 34-predicate catalog cannot describe every prominent visible
   action in the story without semantic substitution.
3. Catalog expansion alone is insufficient: pages 1 and 3 have action
   structural failures without capability gaps, and pages 4-6 contain existing
   predicates alongside gaps.
4. The claim that every page must carry an action is false. An omitted
   `actionRequirements` field is accepted by the final validator; only a
   present empty array is rejected.

### Medium confidence

`runs`, `blinks`, `folds`, `sings`, `nods`, and `sleeps` form the smallest
high-confidence catalog-design set for this one story. They still require full
subject/object/effect/projection and presentation-boundary decisions before
implementation.

### Unproven

- Which of those candidates correspond to the exact 12 historical gaps.
- Whether adding any particular candidate would have made the consumed provider
  draft valid.
- The lower-level causes of the five `page_action_requirements_invalid`
  identities.

## Next gate

Before editing the Action Semantic Catalog:

1. Claude reviews this evidence/grain separation.
2. A Decision Gate selects only high-confidence predicates that are required
   as actions rather than presentation/static-state records.
3. Every selected predicate receives a complete semantic definition and
   catalog/schema/prompt/input-headroom tests.
4. A story-shaped offline draft demonstrates that each selected beat is
   representable and that existing-predicate pages still fail closed on invalid
   subject/object/spatial/binding rules.
5. The complete offline repair sequence reaches a Candidate without increasing
   the complete issue census.

No paid call is justified by this audit alone.
