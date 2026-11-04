STATUS: M08-DECISION-GATE DONE
HEAD: 348c85dc213f85597eb484d05e68e9048edb5603
Summary 1/5: Continue immediately after the frozen M07 package; this package will be cumulative if HEAD is unchanged.
Summary 2/5: Existing upload-photo writes public URLs and cannot satisfy the new product's privacy requirement.
Summary 3/5: Add bounded authenticated private upload, immutable metadata, owner/draft validation and private access.
Summary 4/5: Reuse service-side storage client and WizardSession storage; refuse public buckets and namespace collisions.
Summary 5/5: USD0 synthetic bytes/storage/database only; no real service, key/env read, migration execution or deployment.
Guy decisions: None. Actual private bucket/RLS verification is a later release prerequisite, not authorization for a production write.

## 1. Proposed change
General private asset boundary for child photos and later generated artifacts; wire photo selection to private upload before personal order creation. Never use legacy public photo storage.
## 2. Why now?
Public URLs and browser previews are not private persisted inputs. The worker must read exact owner-bound bytes after the browser closes.
## 3. Scope
New server storage adapter, private asset schema/store, guarded upload/access endpoints, order asset validation, wizard photo state and tests. Reserve engine-site session namespaces at legacy order entry to prevent its unowned upsert from modifying private records.
## 4. Risk of hardcoding
No named child, companion or book assumptions. Every key is generated from opaque ids/digests. No private path can fall back to a public bucket/URL.
## 5. Files likely affected
lib/engine-site/private-*.ts, new API routes, personal-orders.ts, order route, wizard components, legacy order entry guard, tests, CURRENT.md and report. No database/client regeneration through the junction.
## 6. Expected behavior after change
Authenticate before body/storage access; stream ceiling3MiB (under current serverless request ceiling), decode only JPEG/PNG/WebP, bound pixels, rotate/strip metadata and persist immutable canonical JPEG bytes. Store owner/draft/hash/mime/key metadata, return only asset id/hash, and verify owner/draft before binding. Owner-only short signed read; child photos are never accessible through family reader tokens. Internal receipts are not customer-readable.
## 7. Validation plan
Direct-Node tsc + focused Vitest with Sharp-generated synthetic images and storage SDK seam mocks. Negative controls cover foreign owner/draft, malformed data, public bucket, metadata/hash drift, upload failure and unauthenticated/cross-origin/oversized upload. Informational full check log. No live DB/storage query.
## 8. Cost impact
USD0; no image/LLM/TTS generations. Future storage charges are operational, with no production write in this task.
## 9. Rollback plan
Intake flag remains default-off. Disable it to remove the new entry; retain private objects/metadata for audit. No automatic deletion, bucket changes or legacy asset migration.
## 10. Review assignment
Claude Code on Guy's request: falsify private-to-public fallback, namespace collision, IDOR and changed-byte reuse. Guy visual review later; no unresolved product decision or separate implementation task required.
## 11. Do not do
No secrets or .env reads, real children, service writes, provider spend, other worktrees, push/deploy/merge or acceptance-gate changes. No live migration execution.

Stop-check: general additive gated flow, no new spend, minimum synthetic upload/order/access proof, unchanged bank price and identity0.70. Reject public URL reuse, trusting MIME/filename and treating a local preview as a persisted photo. Documentation checked against current Supabase upload/private bucket/signed URL docs and changelog; live infrastructure is not verified.
