# One fictional Wizard order in PayMe Sandbox

This is a configuration and evidence checklist for an independently reviewed revision. It makes no deployment, payment or generation decision.

## Scope

Use the real `/wizard/personal` route on the dedicated HTTPS QA host. Sign in with the single QA parent. Enter a fictional child's details using the Wizard's written inputs and describe the child's appearance. The Wizard selects Dad (`dad_v2`), hides the photo control and requires a fictional-data confirmation on the summary. Its ordinary offer is still 59 ILS including a LOW cover, eight story pages, narration and PDF. The displayed Sandbox amount is for the test card flow.

The QA operator can use the existing fictional Ido6 scenario. Ido is six, lives in Kfar Saba and likes building with blocks. Choose the just-for-fun direction and Momo if offered by the exact QA roster. Enter fictional appearance details in text and tick the declaration. Keep the choice and the exact request in the evidence for the run.

Staging uses one fixed WizardSession namespace in its isolated database. The first valid draft binds the authenticated parent and request snapshot. An identical submit can replay the saved order. Another draft, an altered snapshot or a different parent cannot allocate another order. The photo endpoint stays closed in this mode. Keep the original tab open until an order ID is recorded so the in-memory draft can be replayed. Preserve the order and its receipts if QA stops.

## Configuration

Apply these values only after approval of the exact QA deployment. Use the existing staging checklist for the long worker, delivery, storage privacy and scheduler. Do not reuse production resources.

| Setting | Expected value or binding |
|---|---|
| `ENGINE_SITE_ENVIRONMENT`, `ENGINE_SITE_STAGING_ACCESS_ENABLED` | `staging`, `true`. Dedicated Vercel Preview with the application Basic gate. |
| `ENGINE_SITE_STAGING_HOST`, `NEXT_PUBLIC_APP_URL` | Same dedicated QA hostname and exact HTTPS origin. |
| `ENGINE_SITE_STAGING_USER`, `ENGINE_SITE_STAGING_PASSWORD` | Existing application gate policy with dedicated QA credentials. Browser Basic access is separate from parent login. |
| `ENGINE_SITE_QA_PARENT_USER_ID` | ID of one authenticated QA parent in the isolated database. This is the server-side ID, rather than an email or a browser value. |
| `ENGINE_SITE_QA_SUPABASE_REF` | Exact isolated Supabase project reference. The API URL, Prisma database URL and direct URL if supplied must identify that same project. The app also refuses known production targets. |
| `PAYMENT_PROVIDER` | `payme`. Leave fake payment, redirect trust and IP fallback off. |
| `NEXT_PUBLIC_BUY_MODE` | `live` on the isolated QA build only when its Sandbox checkout is approved. The existing checkout gate treats other values as waitlist mode. |
| `PAYME_API_BASE_URL`, `PAYME_CHECKOUT_PAGE_ORIGIN` | `https://sandbox.payme.io/api`, `https://sandbox.payme.io`. |
| `PAYME_API_KEY` | The Sandbox seller ID from PayMe. Keep it in the approved secret store. |
| `PAYME_WEBHOOK_SECRET` | The dedicated Sandbox seller path can operate without a partner signature. The native form callback only wakes verification of the exact server-stored sale through authenticated `get-sales`. No IP fallback is needed. Existing non-QA webhook verification remains in effect outside the QA path. |

The dedicated QA path accepts the native `sale-complete` form callback only for its stored Sandbox sale and the bound QA order. The callback cannot provide proof of price, currency, sale status or ownership. The server obtains those from PayMe, then the transaction and job gates apply. Browser return also checks the stored sale. The adapter refuses HTTP redirects and non-Sandbox hosted checkout origins. PayMe may retry or drop callbacks, so retain browser return and the existing reconciliation process. [PayMe Sandbox quickstart](https://docs.payme.io/payments/getting-started/quickstart) · [Native callbacks and payment confirmation](https://docs.payme.io/payments/getting-started/callbacks)

Keep checkout, worker, provider and fulfillment flags off during deployment readiness checks. Activate the real checkout only after the exact QA revision, one-order spend authority and runtime configuration are approved. Checkout requires the seven existing `ENGINE_SITE_*` flags and the revision-bound spend policy. The web and long worker must use the same QA project, scope, source revision and policy. Keep live Wizard intake and unrelated legacy generators disabled. PayMe Sandbox avoids a real card charge, while the actual book engine and Dad narration can incur API usage. The local Sunburst campaign's remaining balance does not authorize this order.

## Evidence for the later hosted run

1. Confirm the exact QA revision is READY and check its Linux packaging and long-worker binary compatibility. Verify the application gate and that the exact HTTPS callback POST reaches PayMe's handler. Confirm the database and private bucket belong to the approved QA project.
2. Open the real Wizard with the QA parent. Enter fictional data, confirm the declaration and select the test-card flow. Record the one order ID, hosted Sandbox origin and seller sale ID. Reopen that checkout only through the saved order and preserve the original record.
3. Confirm the native payment notification or browser return causes the exact seller query, one paid transition and one durable engine job. Verify a duplicate notification does not create another job.
4. If generation is separately admitted and succeeds, verify cover and eight frames, continuity and identity gates, Dad playback, PDF, parent-only Reader assets, operator decision and one delivery result in a controlled inbox. Record estimates, calls, any unresolved reserve and the final stop or outcome. A held or unknown result ends the test at its actual boundary.

No hosted order or payment was run to prepare this checklist.
