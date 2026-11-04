STATUS: LOW-COST-AND-RUNTIME DONE
HEAD: 348c85dc213f85597eb484d05e68e9048edb5603
Summary 1/5: FINAL launch is59ILS inclusive, customer LOW; paid MEDIUM measurement is cancelled and HIGH remains excluded.
Summary 2/5: Owner-supplied book-r15e anchor is81 native calls andUSD5.457428 for cover/eight pages, plus aboutUSD1?2.5 story/preparation.
Summary 3/5: Supplied anchor estimate with4000 TTS characters is6.857428?8.357428USD; fresh-order overhead remains unmeasured.
Summary 4/5: Same FX/VAT/fee assumptions leaveUSD14.629094 for generation/contribution; propose a fail-closed USD10 total-order cap, not a grant.
Summary 5/5: Corrected current momentum/Sol/child runtime reserve envelope is82.263104USD; proposed10USD stops before an unaffordable next slot.

Product decisions required: none. LOW/59ILS are final. The cap is a financial-control proposal, not paid authority or a promise about invoices/completion. No live provider/key/account/receipt access occurred.

## LOW anchor and expected cost

Guy supplied book-r15e:81 calls, USD5.457428 for native cover+eight pages including images, reviews and identity. This exact aggregate replaces the earlier rounded observation. The81 calls are not81 image renders. The raw type/token split, retries/re-asks and billing invoice were not independently opened here. No new measurement was run.

Use the suppliedUSD1?2.5 story/preparation estimate. Narration remains the current conservative accounting rateUSD0.0001/character, with2x reservation. At4000 characters it isUSD0.40 accounted andUSD0.80 reserved. PDF/storage/worker overhead is in the separate illustrative infrastructure allocation. If a new child-reference cost is outside the supplied preparation aggregate, add its actual evidence; do not hide it in the anchor or count it twice.

| Story/preparation assumption | Native LOW | Narration model | Total generation | Contribution after stated assumptions |
| --- | ---: | ---: | ---: | ---: |
| USD1.00 | 5.457428 | 0.40 | **6.857428** | 7.771666 |
| USD1.75, midpoint | 5.457428 | 0.40 | **7.607428** | 7.021666 |
| USD2.50 | 5.457428 | 0.40 | **8.357428** | 6.271666 |

This is an anchor-based planning span, not a measured distribution or guarantee for every new book. It includes no invented MEDIUM multiplier. LOW is the customer policy; no path selects MEDIUM and its paid measurement is cancelled.

## Unchanged revenue assumptions

Use exactly the prior modeling assumptions:3.1570ILS/USD (previously fetched Bank of Israel page datedNov3),18%VAT, illustrative processing fee2.9% of gross+1ILS, infrastructureUSD0.35. Actual VAT treatment, PayMe contract and infrastructure invoices are not independently verified.

-59ILS gross /3.157 =USD18.688628.
-After assumedVAT: USD15.837821.
-Illustrative processing: `(59*0.029+1)/3.157` =USD0.858727.
-After infrastructure: **USD14.629094** is available for generation and contribution.

These are explicit scenario inputs, not tax advice or confirmed provider terms. [Bank of Israel USD](https://www.boi.org.il/roles/markets/exchangerates/usdollar) and the prior [VAT decision source](https://main.knesset.gov.il/EN/News/PressReleases/Pages/press12324w.aspx) are retained without a new account/network/provider query.

## Proposed fail-closed cap and worst-case distinctions

Propose **USD10.00 TOTAL per order**, inclusive of story/planning/edit/reviews, child/reference/preparation, all native attempts/re-asks/identity, narration and full pending/UNKNOWN provisions. The proposal is separate from actual spend authority. No executable grant or activation is created by this constant/report.

Compared to the expected upper planning costUSD8.357428, this leavesUSD1.642572 headroom. A completed order using the fullUSD10 leaves modeled contributionUSD4.629094 after the stated fees/infra. A failed/refunded order retains provider costs and may have no revenue; positive contribution on completed orders does not guarantee portfolio profit.

A new call is admitted only when the full exact slot reservation fits the cumulative order cap. Pending/UNKNOWN retains its full reservation; ambiguity never becomes zero. On exhaustion, UNKNOWN, failed response or above-reserve usage: stop new dispatch, preserve all costs/assets, open the existing operator/refund lifecycle, and never silently downgrade, redraw an unverified failure, omit a page/audio/PDF, skip QA/identity or reset a grant. Final integration into that existing lifecycle is the ordered delivery/refund milestone.

The LOW anchor is empirical; the following is the deliberately conservative sum of every declared slot at the current attempt ceilings. It is not an expected bill or provider invoice hard cap:

| Component at16000 UTF8 prompt bytes/four refs | Declared reserve |
| --- | ---: |
| 27 render slots, current renderMaximum | USD17.169408 |
| 27 ordinary reviews + at most9 re-asks atUSD0.60 | USD21.600000 |
| 27 identity slots atUSD0.05 | USD1.350000 |
| Native subtotal | **USD40.119408** |
| Opus plan/replan/author/editor, current output caps +10% | USD3.238400 |
| Three current Astra text-review ceilings +10% | USD5.412000 |
| Preparation slot sum | USD5.000000 |
| Separate child-reference assumed ceiling | USD1.000000 |
| Narration2x reserve for4000characters | USD0.800000 |
| All-slot declaration sum | **USD55.569808** |

Formula from existing code: `renderMaximum = promptUtf8Bytes*8 + refs*8192*8 +8192*30` microUSD =USD0.635904 per declared render in this scenario. Keep three attempts/frame and nine re-asks exactly as current engine; a totalUSD10 cap stops before the full conservative scenario could be consumed. The historic scopedUSD7 native cap is not a new order grant. Real usage settles from raw receipts; a provider can exceed a local reservation, which is recorded in full and stops, rather than being erased or represented as an invoice guarantee.

Source rules are imported by `lib/engine-site/cost-model.ts`: native attempt/re-ask constants, renderMaximum, Sol review reserve, identity reserve, preparation slots, narration rate/reserve and current text caps. Current standard model rates remain as previously checked in [OpenAI pricing](https://developers.openai.com/api/docs/pricing#image-generation) and [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing); no model/tier/threshold/attempt changes are proposed to reopen the final launch policy.

## Runtime, unchanged

Current causal deadlines are plan/replan780s, author380s, editor860s, plus45s persistence. They do not fit the configured300s invocation; editor also exceeds800s. These are configured timeouts, not a new Anthropic latency measurement. Do not shrink caps or split story meaning to fit serverless.

Use existing durable GenerationJob/lease/meter/checkpoints. A fenced long-step executor executes the long call under the same order authority; it is not a second whole-book queue. Heartbeat/lease handling must cover the chosen deadline, since the old seven-minute lease alone cannot cover780/860s. Short workers defer before claim/key access. No hosted worker/service is provisioned or run in this USD0 work.

Per-milestone validation uses Node-direct TypeScript/focused Vitest. Full `npm run check` is logged/reported and nonblocking while its known baseline failures stand. Any actual paid book still requires separate explicit scope/GO; there is no pending MEDIUM measurement.


## M09 current selected recipe and corrected worst-case envelope

The M06 four-Opus/three-Astra reserve illustration above is historical and is not the selected production recipe. Source inspection selected the existing momentum Opus author + Sol editor/readers. Generic780/380/860s classification remains supported, but the current author has28000 output tokens:1180s +45s persistence =1225s and uses the same job's long executor. The Sol editor is28000 tokens with its existing600s provider route, handled via a durable background id. Storyboard/review calls also use background polling; synchronous images180s fit the270s chunk envelope with45s persistence and45s restoration allowance. The25min long host is not an additional order queue.

Same assumptions remain FX3.157 ILS/USD, assumed VAT18%, fee2.9% of gross +1ILS and infrastructure0.35USD. Gross59ILS is18.688628USD; net revenue15.837821USD; fee0.858727USD; generation room14.629094USD. Owner's81-call native anchor5.457428USD plus the supplied1?2.5USD story/preparation range and4000-character narration0.4USD gives the anchor-based expectation6.857428?8.357428USD, contribution6.271666?7.771666USD. This is NOT a measurement of the complete fresh-order route: fresh child adoption, initial storyboard, photo description and the exact API source route remain unmeasured and may increase it. No paid measurement is performed or authorized here.

Current declared conservative worst-case reservations, from the actual engine-site policy table and existing tariff rules:

| Component | USD reserve | Boundary |
| --- | ---: | --- |
| Native27 renders |34.449408|96k UTF8 prompt ceiling, four refs,8192 output reservation, LOW|
| Native reviews including at most9 re-asks |21.600000|36 Sol reviews at0.60 slot each|
| Native identity |1.350000|27 calls at0.05|
| Opus API author |1.073600|104k wire ceiling,28000 output,4/20 tariff plus10%|
| Sol editor |0.600000|Existing0.60 minimum, same28000 cap|
| Two Sol readings and at most two citation corrections |2.400000|Four0.60 slots; correction is bounded by the existing engine helper|
| Initial storyboard and review |2.200000|Current preparation stage allowances|
| Final source preparation and two qualified sheets |5.000000|Existing six preparation slots|
| Child anchor: up to two render/style/design attempts + one photo identity |3.990096|Existing one correction, no retry of unusable answer|
| Photo appearance, if supplied |0.600000|One Sol slot, exact private photo binding|
| Narration at the runtime ceiling |9.000000|Nine5000-character slots,100microUSD/character, x2 reserve; typical4000 total has0.8reserve|
| Entire declared envelope |82.263104|An upper reservation envelope, NOT an expected invoice or authorization|

The earlier16k-prompt/4000-character scenario with the corrected current story/child stages is56.783104USD. The actual policy uses the larger96k render and per-frame narration ceilings shown here. The121 reachable logical-call ceiling includes all permitted correction/re-ask/identity/TTS slots; not every slot is reached together, and the engine still owns eligibility. The server does not require reserving82USD before the first call: it reserves each complete next slot while keeping the cumulative cap.

The proposed per-order cap remains10USD and proposed maximumCalls121, both requiring Guy's paid activation before use. A completed order at10USD has4.629094USD contribution under these assumptions; the cap does not guarantee profit for failed/refunded orders or include a salary for Guy's launch review. It leaves1.642572USD above the supplied upper anchor-based estimate; unmeasured fresh-order costs may consume that headroom. If any full next reservation does not fit, or an outcome/price is unknown, the job stops for the existing operator/refund path. No quality downgrade, omitted narration/PDF, lowered0.70 threshold, extra attempt or skipped review is available. A provider usage estimate above reserve is retained and held; a local meter is not a provider invoice or contractual billing cap.

No price/quality/spend decision is reopened. Future tuning may reduce prompt/reference token overhead or improve failure rate without weakening gates; any changed attempt/review tier, spend cap or product promise returns to Guy. The cancelled MEDIUM measurement remains cancelled. Current SDK protocol documentation: [OpenAI background](https://developers.openai.com/api/docs/guides/background) supports GET polling of the same id and store=false temporary retrieval; [Anthropic API overview](https://platform.claude.com/docs/en/api/overview) confirms Bearer API-key authentication and2026-10-21 version. Our current source retains those fields; no account/model availability probe was made.
