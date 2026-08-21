# R1D Chameleon Home Board v6 — Product Acceptance Evidence

**Date:** 2026-08-21

**Branch/commit authority:** `codex/qa-wizard-presentation-dispositions` at pushed `8075ec8369e1876deeae497dc5ce0ea2b425b756`

## Result

The canonical v6 Home Board mint completed one `gpt-image-2` LOW generation, one content-addressed no-overwrite upload and one ordinary Vision QA call.

- Set Definition: `803dea01a0346579b0e38160cd683acfa09966daecf90d945389da4a3a67d172`
- content policy: `6ba2b1be70c243bc83e67770ed14b8fb227fab5da092a2f290c234254798bd70`
- prompt: `ecda380efcd76e3baa53df1c589cf0039729385bba5f1ac001854ea909d547db`
- PNG: 2,052,912 bytes
- PNG SHA-256: `7a782c72b86ceb07ba631def11d40b520b4753d97a63e8430a2fcb32180d7189`
- image model/quality: `gpt-image-2` / `low`
- ordinary Vision QA: `passed`
- Registry: `set-registry/v6`, Board `set-board/v6`

The exact stored object was downloaded to the local proof root and independently hashed to the same SHA-256. No second generation or Vision recheck occurred.

## Product decision

Guy inspected the exact proof image and responded "מעולה, נראה טוב". The canonical approval command then stamped only the already-QA-passed Registry entry:

- `approvedBy: Guy`
- `approvedAt: 2026-08-21T00:10:06.222Z`

The approval did not alter or replace image bytes. The same SHA remains bound after approval.

## Boundary

This approval makes only `set_child_home_night` bindable for the named story/style/contract identity. `set_town_night` is still absent and unapproved, so the two-board binding gate remains incomplete. No Wizard promotion, page render, book render, deployment or production action occurred.
