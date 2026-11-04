STATUS: COST-AND-RUNTIME DONE
HEAD: 6a223a287913d0d5acb5693cf2ff280dd576e34f
Summary 1/5: Guy fixed the offer at 49 ILS including cover/eight story pages, narration and PDF; MEDIUM is mandatory.
Summary 2/5: At 3.157 ILS/USD and assumed 18% VAT, modeled revenue is USD13.15 before payment fees; actual business treatment/fees remain unverified.
Summary 3/5: A middle MEDIUM sensitivity gives USD13.15 generation, before fees/infra; profitability is unproven and that scenario loses contribution.
Summary 4/5: Current declared slot ceilings sum to USD55.57 in the explicit scenario; this is not a measured MEDIUM invoice maximum or an approved grant.
Summary 5/5: Proposed total cap USD8.50 requires owner approval and measured completion feasibility; long Opus steps do not fit the configured 300s invocation.

Decisions Guy must make: separately approve a bounded MEDIUM measurement; afterward approve total-order/global caps and any cost-policy changes required to fit 49 ILS. No paid GO or cap was activated by this report. Price, inclusive entitlements and Anthropic API are already decided.

## Sources and accounting boundary

Owner supplied: LOW native book approximately USD5.50 for 9 renders + 9 reviews + 9 identity calls, plus USD1–2.50 for story/preparation. These are reported aggregate observations, not newly inspected receipts, token splits or invoices. In particular, do not count the 27 calls as 27 images. The renderer's share of USD5.50 and MEDIUM multiplier are not measured.

Current source rules: `scripts/personal-simple-book-reviewed-audition.ts` exports `renderMaximum`, identity reserve USD0.05 and the actual wire policy; `scripts/personal-simple-book-illustrator.ts` exports the USD0.60 Sol review slot and raw-usage settlement; native v1 allows 3 attempts for each of 9 frames plus 9 unusable-answer re-asks; preparation slots total USD5; TTS accounting is USD0.0001 per character with a 2x reservation. `lib/engine-site/cost-model.ts` imports those rules rather than changing them. None of their historical dollar limits is new launch spend authority.

Current fetched [OpenAI pricing](https://developers.openai.com/api/docs/pricing#image-generation): gpt-image-2 text input 5, image input 8, image output 30 USD/M tokens; gpt-6.1-sol short-context 2/10, gpt-4o 2.5/10, gpt-6-astra 10/50. The current image reserve prices all input conservatively at 8. The old calendar-specific CLI Opus input allowance was 8/20; approved hosted [Opus 5.5 API standard/global](https://platform.claude.com/docs/en/models/opus-5-5/overview) is 4/20. Do not rewrite historical cost evidence to the newer rate.

No account fees, billing dashboards, invoices, paid image, text or TTS call was queried. MEDIUM output token count and reservation adequacy are unqualified. A provider can bill above a local reserve; the meter preserves the full known amount and stops, rather than claiming an invoice guarantee.

## Expected sensitivity, explicitly unmeasured

Let R be the render share of the LOW native aggregate, and m the MEDIUM render multiplier. Then `native_MEDIUM = 5.50 * (1 + R*(m-1))`. Keep review/identity costs unchanged in this sensitivity; multiplying all USD5.50 by m would also multiply non-render costs incorrectly.

Nominal assumptions: R=50%, story/preparation USD1.75, final narration 4000 characters (USD0.40 at the repository accounting rate), no extra attempts in this expected case. Reference/preparation increases at MEDIUM are not yet measured and can increase these estimates.

| MEDIUM render multiplier | Native cost | Total generation | Modeled contribution after the fee/infra assumptions below |
| --- | ---: | ---: | ---: |
| 1x, LOW-equivalent reference | 5.50 | 7.65 | about +4.39 |
| 2x | 8.25 | 10.40 | about +1.64 |
| 3x, middle sensitivity | 11.00 | 13.15 | about -1.11 |
| 4x | 13.75 | 15.90 | about -3.86 |

These are sensitivity cases, not three forecasts. For m=3, changing R from 30% to 70% and story/preparation from USD1 to USD2.50 spans about USD10.20–16.10 total generation. The invoice split and correction frequency must be measured before selecting a forecast.

## Revenue and proposed cap

The latest fetched [Bank of Israel USD page](https://www.boi.org.il/roles/markets/exchangerates/usdollar) gives **3.1570 ILS/USD**, updated November 3, 2026. Thus 49 ILS is USD15.52 gross. Applying the explicit 18% VAT modeling assumption gives USD13.15. The [Knesset decision](https://main.knesset.gov.il/EN/News/PressReleases/Pages/press12324w.aspx) established the 18% rate from January 2025; Guy's actual business/VAT treatment is not established here.

Illustrative fees only: 2.9% of the gross 49 ILS + 1 ILS = about USD0.77, plus USD0.35 infrastructure allocation. This leaves about **USD12.04** for generation and contribution. These are not verified PayMe fees or operating invoices. No retail price, tax, legal status or provider contract was changed.

Propose **USD8.50 total per order**, including author/editor/review, child/reference/preparation, all native attempts/re-asks/identity, narration and full pending/UNKNOWN provisions. On a completed order it leaves about USD3.54 under the modeled revenue assumptions. This is a proposal, not a generated authority, permission to spend or proof of a viable book. The middle expected scenario exceeds it; refunded/failed orders retain provider costs and may have no net revenue. A low cap with many refunds can lose money across orders.

Before activation, a measured MEDIUM book must show an achievable cost distribution and suitable completion rate. At nominal R=50%/fixed story+prep+TTS USD2.15, the USD8.50 cap requires the MEDIUM render multiplier to be about 1.31x LOW or less for the no-extra-attempt scenario. There is no evidence yet that it does. A higher cap consumes margin and still needs Guy's decision.

## Declared full-attempt scenario, separate from actual invoice worst case

Explicit numerical inputs: 16,000 UTF8 prompt bytes per render, four references, existing 8192 output-token reserve; 104,000 byte ceiling for each text wire; existing stage output caps; child-reference allowance assumed USD1; 4000 narration characters. These are calculation assumptions, not a new approved run.

`renderReserve = promptBytes*8 + refs*8192*8 + 8192*30` microUSD = **USD0.635904**.

| Component | Current declared scenario |
| --- | ---: |
| 27 render slots | USD17.169408 |
| 27 ordinary + 9 re-asked review slots, USD0.60 each | USD21.600000 |
| 27 identity slots, USD0.05 each | USD1.350000 |
| Native subtotal | **USD40.119408** |
| Opus plan/replan/author/editor, 4/20, current caps + 10% reserve | USD3.238400 |
| Three current Astra text-review stages, 10/50 + 10% reserve | USD5.412000 |
| Existing preparation slot sum | USD5.000000 |
| Child reference assumed ceiling | USD1.000000 |
| Narration 2x reserve | USD0.800000 |
| Sum | **USD55.569808** |

The native subtotal follows 3 attempts/frame and the independent book-wide nine re-ask ceiling. The separate historic USD7 native allowance would stop well before this declaration sum was exhausted; it is not approval to spend USD40.12. The production total cap must be enforced cumulatively across all stages, with UNKNOWN retained. The 8192 image-output reservation is still a LOW declaration in existing tooling: MEDIUM needs its own measured qualification. More prompt bytes, different images or a provider overrun can exceed this scenario. There is no finite MEDIUM invoice worst case proven by this arithmetic.

## Cost levers, owner decisions and invariants

- Reduce the maximum correction attempts if measurement supports a completion/quality tradeoff; this lowers worst-case spending, not the cost of a successful first attempt.
- Test a cheaper review model/tier or smaller proven sufficient output/crop package only under a new explicit policy and independent QA. The existing model and review capacity are preserved now.
- Reuse qualified companion/reference material when it is actually valid for that order; never use another child's reference or reconnect bank stories. Dynamic story entities/location sheets cannot be assumed reusable.
- Measure provider caching and exact token categories rather than booking imaginary cache discounts. The Anthropic adapter accounts explicit cache buckets and holds unknown usage.
- LOW correction attempts would change Guy's current MEDIUM-only customer policy and are **not implemented or authorized**. HIGH is never a launch option. Identity stays 0.70; detail stays nonblocking.
- Run the same accepted engine through a durable step executor; avoid whole-book restart/re-purchase. This prevents duplicate losses but does not reduce legitimate provider COGS to zero.

## Invocation proof and hosting choice

The current source `generationTimeoutMs(outputTokens)` is `60000 + ceil(tokens/25)*1000`. Current eight-page causal caps yield:

| Step | Output-token cap | Provider timeout | +45s persistence | Fits configured 300s? |
| --- | ---: | ---: | ---: | --- |
| plan / replan | 18000 | 780s | 825s | No |
| author | 8000 | 380s | 425s | No |
| editor | 20000 | 860s | 905s | No |

These are configured engineering timeouts, not measured Anthropic latency. The existing book-preparation limits are still larger. [Vercel limits](https://vercel.com/docs/functions/limitations) cannot make the current 300s deployment honor these deadlines. An 800s plan, if later approved/verified, still would not cover the editor's 905s envelope.

Keep the existing durable GenerationJob scheduler, one-order authority, claims, storage, sweeper and delivery fence. Long steps need a dedicated step executor (or separately verified eligible extended runtime) that can honor their deadline and keep a fenced lease alive. The seven-minute legacy lease needs per-step renewal/deadline handling; copying it onto a 14-minute call is unsafe. Do not create a parallel whole-book queue or replay a claim after an ambiguous answer. The new adapter defers before claim/key access when the supplied budget is too short. No external worker/service was provisioned or run in this milestone.

Synthetic tests validate arithmetic, same body/instructions/output cap, standard/global/cache accounting, short-worker refusal, private persistence-before-success, one request/no retries and UNKNOWN settlement. Actual API schema acceptance, model access, output quality, account pricing/latency and real multi-process lease behavior remain unproven and require separate gates.
