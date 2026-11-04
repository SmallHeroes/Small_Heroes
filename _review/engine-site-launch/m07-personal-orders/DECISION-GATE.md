STATUS: M07-DECISION-GATE DONE
HEAD: 348c85dc213f85597eb484d05e68e9048edb5603
Summary 1/5: Continue the explicitly authorized launch integration, in this task and worktree.
Summary 2/5: The existing personal wizard validates preview requests; it creates no customer order.
Summary 3/5: Add an authenticated, immutable, idempotent personal-order boundary and a gated wizard mode.
Summary 4/5: Reuse Order/WizardSession and checkout; never select a bank story or accept browser pricing.
Summary 5/5: USD0, synthetic database/providers, checkout default-off, no service writes or Git-index changes.
Guy decisions: None for this milestone. USD10 remains a proposed future spend cap, not activated authority.

## 1. Proposed change
Bind reviewed personal requests, appearance and the final offer to an owner-scoped draft order. Add /wizard/personal and /api/engine-site/v1/orders behind ENGINE_SITE_ORDER_INTAKE_ENABLED (absent means off). Creation requires an explicit final click, authenticated parent and current options fingerprint.
## 2. Why now?
Preview acceptance cannot pay or resume an order. Existing worker rejection correctly prevents the new protocol falling into the bank path. The missing order boundary is the first ordered launch dependency.
## 3. Scope
General integration. One immutable WizardSession snapshot and one Order per owner/draft. A changed request requires a fresh draft rather than overwriting a paid input. Production/bank pricing, legacy wizard and local preview remain unchanged.
## 4. Risk of hardcoding
No story, child or companion exceptions. Use the admitted option resolver, shared request validator and single offer source. The engine's existing short tier means eight narrative beats; its historical 16 display-page count is internal and is not shown as the launch product length.
## 5. Files likely affected
lib/engine-site/order-input.ts, personal-orders.ts, order-http.ts, API route, personal wizard components, gated page, focused specs and CURRENT.md. No migration or generated client change.
## 6. Expected behavior after change
Server derives 5900 agorot, LOW, eight pages, narration/PDF and owner identity. Reject unknown fields, fixture data, unsupported options, local-only photos, changed/replayed bindings and foreign ownership. Identical retry returns the same order. Description-only orders are supported first; private photo transport follows in M08.
## 7. Validation plan
Direct-Node TypeScript; focused Vitest including actual SQL row fencing through isolated PGlite, HTTP origin/auth/body/flag controls and existing checkout/bank-refusal regressions. npm run check log is informational. No real database or Next server requiring environment secrets.
## 8. Cost impact
Zero provider calls, zero render/audio/story generations. Draft creation creates no spend authority or generation job.
## 9. Rollback plan
Unset intake flag; checkout remains off. Keep immutable records for audit. Revert the focused patch only in an owner-controlled operation; do not reset existing work.
## 10. Review assignment
Claude Code, only when Guy asks, should falsify cross-owner access, price/quality injection, retry uniqueness, drift and preview-to-paid leakage. Guy's visual/product review remains separate. No new creative decision or separate task is necessary for the already dedicated integration thread.
## 11. Do not do
No keys/.env reads, paid/live providers, production writes, bank stories, push/merge/deploy, other-worktree edits or threshold/gate changes.

Stop-check: general system; gated additive production path; USD0; smallest proof synthetic order/HTTP plus checkout regression; no unresolved owner decision; visual approval later; rollback by flags. Rejected alternatives: reuse legacy POST /api/orders (selects bank), mutable browser-price payload, automatic order creation on summary mount, public photo URL, local-operator authorization as parent identity.
