# QA book trial admission — 2026-09-27

## Request, decision and ownership

Guy asked to check and handle the current QA state, then tell him when he can
render a book. A supervised trial of the already-qualified Kim bedtime slot can
start. This is not release readiness, a guarantee of completion, or qualification
of the other 17 stories. No paid trial was started by this diagnostic task.

Sole writer: codex/site-release-ui-integration-20260926 at
C:/GNart/Work/sh-site-release-ui-integration, diagnostic base c0a93966.
Deployed release: codex/r1d-release-reader-voice-final at
a0835b72216d792f38da6b557364147f184773ab, clean and 0/0 at inspection.
Stable QA deployment: dpl_B6iLmc3JkghRXnEF5hd9CTihXgjs.
Engine 5f4e938f, protected 768ccb2f / 63ccb484, Claude's branches and Production
were not modified. No application/backend/provider/test-infrastructure change.

## Direct observations (not independent PASS)

- Local `ENABLE_V3_APPROVED_BANK=true npm run render-qualification-audit`: exit 0,
  18 sellable / 1 render-qualified. This command does not require all 18 qualified.
- Live `GET /api/wizard/mvp-matrix`: only TRANSITION / chameleon_koko / bedtime is
  selectable and render-qualified. Other 17 remain story_ready_only.
- Live `GET /api/release/v1/preorder` for that slot and
  soft_hand_drawn_storybook: HTTP 200 at 18:47:08Z, no-store; pages=8,
  displayPages=16, priceILS=59 (catalog price, not a measured API cost).
- Returned Git SHA and deployment ID match the deployed release above.
  Source digest: 9acf0433386ac515d08d5d30f0429dc6b9f03596b29ba0994316ff69507195b1.
  Package revision: 836a3414174dbe3060010371e81ebdbef821f705650a199cc4bbfd70081d523f.
  Package authority: 3a4c6cda200e29b8d7702eb5708dad8ce3e7a76afb5facbc28715c788e8f782c.
  Contract: 6b23edc960ad8d7d27f49294dee6128a32ec6c37152e6b87eb80e77b3a48c8e8.
  Blueprint: 97fad2ac1499c6b578087771f614d474972b3c1f2f7153b3321c59c3f87bbdce.
- Exact immutable deployment worker OPTIONS: HTTP 204 and
  x-small-heroes-release-worker-probe=release-v1-worker-reachability/v1.
  Used authenticated Vercel CLI access, not worker POST. This proves reachability
  through the CLI's protection access, NOT a new execution of the worker's own
  branch-secret self-chain proof. No secret/protection setting was changed.
- small-heroes-staging (qvksgpzzosotubcbizay) reports ACTIVE_HEALTHY. Read-only
  information_schema query confirms GenerationJob.staleReclaimCount,
  lastReclaimStage, lastChainStatus, lastChainError, lastWorkerKickAt and
  Order.visualPackageAuthority, storySourceHash, selectionFilename: 8/8 present.
  This is not an exhaustive migration or transactional database test.
- Preview metadata contains OPENAI_API_KEY, ELEVENLABS_API_KEY and
  GENERATION_SECRET. No values were retrieved/printed/copied. Credential presence
  is not validity, quota or end-to-end generation proof.
- Six non-secret configuration flags are stored as sensitive branch overrides.
  Their individual read endpoint returned value=null. Do not infer false, absent
  or a verified value from null. No override was changed. The successful live
  preorder separately verifies only the environment rules it actually checks.
- Browser opened the Kim spotlight from stable QA and exposes the real link
  `/wizard?category=TRANSITION`. No name/photo/form submission or Order creation.

The connector's first matrix fetch returned a protection redirect; the later
authenticated CLI GET succeeded. A PowerShell wrapper dropped the curl argument
separator; invoking the installed CLI entry point directly fixed the diagnostic
OPTIONS invocation. Neither failure required an application change. No bypass
token is retained in this record.

## Boundaries and next user action

Use https://qa.smallheroes.co.il/wizard?category=TRANSITION and choose bedtime,
then the desired narration voice. The live preorder enforces Preview/fake-payment
configuration; a fake checkout does not make image/QA/TTS provider usage free.
Do not use this observation to initiate an unbounded batch or lift holds.

This exercises the deployed release engine, NOT all latest local owner-sample
continuity/decorative-priority work. No wholesale engine merge is authorized or
performed. Full-check RPC failures remain open; no third identical full retry,
timeout increase, pool/dependency change, suppressed exception or self-PASS.

There is no new completed book, generated narration, visual acceptance, or
release acceptance. Model spend this task: $0. No external write/deployment/push.
Evidence here is a transcription of direct tool observations, not raw archived
HTTP/DB payloads; independent reviewers must re-fetch current live observations.

## Read-only independent review / handoff

Documentation validation: `npx tsc --noEmit` and `git diff --check` exit 0.
No tests/full check rerun for the Markdown-only record; no independent PASS.

Review this documentation-only successor of c0a93966. Falsify: (1) current deployed
identity and exact slot/package binding; (2) 1/18 vs 18/18 distinction; (3) no
claim that OPTIONS proves dispatch or metadata proves secret values/validity;
(4) unchanged code and preserved RED/full-engine boundaries. No render, order,
payment, environment edit, deploy or push is requested of the reviewer.

No push is needed to try the live book. Inspection only:

```powershell
Set-Location 'C:\GNart\Work\sh-site-release-ui-integration'
git status --short --branch
git log -2 --oneline
git diff --stat c0a93966..HEAD
# This local documentation branch has no upstream. Do not replace the QA branch
# or promote engine commits to make this readout appear live.
```
