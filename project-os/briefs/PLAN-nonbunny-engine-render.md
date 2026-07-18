# PLAN — render a NON-bunny book through the wizard with the full engine (tool-authored contract)

**Goal (Guy):** render a book from the wizard where ALL our work applies — and specifically a **different** story (not bunny) whose visual contract was **built by our tool**. Target story = **`fox_uri_adventure`** (adventure, comparable to bunny, all source files exist).

**Core mental model (do not confuse):** the **wizard RENDERS** a book; the **offline tool BUILDS** the contract. The render never authors a contract — it only consumes one. So a non-bunny slot needs its contract **minted offline first**, then the wizard render shows the engine.

**Owners:** Guy = runs mint + staging render (holds the OpenAI key + the deployed env). Cowork(me) = reviews the minted candidate + the final render. CC = promotes the reviewed template into the bank (code/asset commit).

**Paths:** the tool lives on `feat/chunked-generation` = `C:\GNart\Work\sh-wt-style01` (run the mint there). I can only read `C:\GNart\Work\Small_Heroes` (the connected folder), so **all review output is written there** with an absolute `--out`.

---

## STEP 1 — Mint the contracts, OFFLINE (`--live`). Owner: Guy. Cost: ~2 LLM text calls, ZERO image spend.

Mints BOTH: `bunny_ometz_adventure` (validation — diffs vs the committed template via `--prev-bank`, proving the live path ≈ the fixture-authored gold) and `fox_uri_adventure` (the real target). Runs in `sh-wt-style01`; outputs land under the connected folder so I can review.

```powershell
cd C:\GNart\Work\sh-wt-style01

# 1a. load the OpenAI key from .env.local into THIS shell (standalone tsx doesn't auto-load it):
$env:OPENAI_API_KEY = ((Get-Content .env.local | Select-String '^OPENAI_API_KEY=') -replace '^OPENAI_API_KEY=','').Trim().Trim('"')

# 1b. extract sources (offline, no key needed) for both stories:
npx tsx --require ./scripts/shims/register-server-only.cjs scripts/extract-visual-contract-sources.ts --bank story-bank/v3-approved --out "C:\GNart\Work\Small_Heroes\_review\vc-sources" --only bunny_ometz_adventure
npx tsx --require ./scripts/shims/register-server-only.cjs scripts/extract-visual-contract-sources.ts --bank story-bank/v3-approved --out "C:\GNart\Work\Small_Heroes\_review\vc-sources" --only fox_uri_adventure

# 1c. mint the contracts LIVE (bunny diffs vs the committed template; fox is new). Output where I can read it:
npx tsx --require ./scripts/shims/register-server-only.cjs scripts/compile-visual-contract-templates.ts --sources "C:\GNart\Work\Small_Heroes\_review\vc-sources" --out "C:\GNart\Work\Small_Heroes\_review\vc-live" --prev-bank story-bank/v3-approved --live
```

**Expected output (in `C:\GNart\Work\Small_Heroes\_review\vc-live`):**
- `bunny_ometz_adventure.visual-contract-template.json` + `…​.visual-contract-review.md` (review includes a diff vs the committed bunny template)
- `fox_uri_adventure.visual-contract-template.json` + `…​.visual-contract-review.md`

**Then ping me: "mint ran."** Do NOT copy anything into `story-bank/` — candidates stay in `_review` until reviewed.

---

## STEP 2 — Review the minted candidates. Owner: Cowork (me). Gate.

I read both candidates + review reports and give a verdict:
- **Bunny:** does the `--live` output substantively match the committed template (same locations, cast, `laterality` unbound, companion-presence flags)? Proves the live path is trustworthy.
- **Fox:** are the locations/cast coherent, is the cast fact-authoritative (no leak-class flags), do the prose-absence flags make sense? Does it **generalize** or did the tool break on a new story?
- Verdict = **PROMOTE fox** (→ Step 3) or **FIX** (route the specific defect; the tool is fail-closed, so a real miss is a review-report flag, not a silent bad field).

Guy co-signs the fox candidate before it enters the bank.

---

## STEP 3 — Promote the reviewed fox template into the bank. Owner: CC. (copy-paste brief below)

```
TASK: Promote the reviewed fox_uri_adventure visual-contract template into the bank + guard it with a validity test.

SCOPE (do exactly this, nothing else):
1. Copy the Cowork-approved candidate `_review/vc-live/fox_uri_adventure.visual-contract-template.json`
   → `story-bank/v3-approved/fox_uri_adventure.visual-contract-template.json`.
   (Content is the reviewed candidate verbatim — do NOT hand-edit the fields.)
2. Add a validity test mirroring the bunny one
   (`lib/__tests__/bunny-ometz-adventure-visual-contract.spec.ts`):
   load the fox template, assert it passes `validateBookVisualContractTemplate`, and assert the
   materialize→resolve path yields a valid ResolvedBookVisualContract (no unresolved required traits
   beyond the intended per-order ones). Name it `lib/__tests__/fox-uri-adventure-visual-contract.spec.ts`.

FILES: story-bank/v3-approved/fox_uri_adventure.visual-contract-template.json (new),
       lib/__tests__/fox-uri-adventure-visual-contract.spec.ts (new).

DO NOT TOUCH: the compiler/validator/materializer code; bunny's artifacts; any render or enforcement code;
              any other slot.

ACCEPTANCE: `npm run check` green (tsc --noEmit + vitest), including the new fox spec.
            The template validates and materializes to a valid Resolved contract.

GIT HYGIENE: branch off feat/chunked-generation; stage ONLY the two files above with explicit pathspecs
             (NEVER `git add -A`); commit message `feat(visual-contract): promote fox_uri_adventure template (Cowork-reviewed)`.
             Do NOT push until Guy says so.

VERIFY & REPORT: paste the `npm run check` summary + confirm the two files are the only diff.
```

---

## STEP 4 — Staging render through the wizard, engine ON. Owner: Guy. This is "render a book where all the work applies."

Renders must run on **deployed staging (preview)**, not locally (no local `.env`, per the render/`--live` wall). Reference: `project-os/09-staging-enforcement-enablement.md`.

1. On the **staging** Vercel env, set: `VISUAL_CONTRACT_FREEZE=true`, `VISUAL_CONTRACT_ENFORCEMENT=true`, `VISUAL_CONTRACT_STEERING=true`, `ENABLE_V3_APPROVED_BANK=true`, and `GPT_IMAGE_QUALITY=low` (audition, not production spend).
2. **Redeploy staging** (flags only take effect on redeploy). Confirm the deployment's `VERCEL_ENV=preview` (NOT production — prod is hard-off; if it reads production, enforcement never engages).
3. Place a **`fox_uri_adventure`** order through the wizard on staging (MEDICAL is bunny; fox = NIGHT_FEAR × adventure — pick that slot in the wizard).
4. Let it render. The full chain now runs: tool-authored template → materialize → freeze → **enforce** → **steer** → images → narration (selective niqqud) → reader.

**Positive control (optional, same session):** place a **bunny_ometz_adventure** order too — it already has a template, so it should also render. A gap slot with no template (e.g. `panda_anat_bedtime`) should **hard-block** — that proves enforcement is truly on.

**Rollback:** flags off → redeploy → byte-identical legacy behavior. Staging orders are disposable.

---

## STEP 5 — Eyeball the fox render vs the consistency bar. Owner: Guy + Cowork. The real proof.

Review the rendered fox book (reader + contact sheet) against the 5 first-render defect classes we know: location leak, size drift, companion identity/presence, family/mom likeness, child likeness. Compare to what bunny looked like. Verdict:
- **PASS** → the engine generalizes to a second story → repeat Steps 1–5 per launch slot (the path to the sellable catalog).
- **DEFECT** → log which class, route the fix (steering param vs template field vs engine) through the right owner. This is exactly the signal we want, cheaply, on ONE slot before the whole catalog.

---

## Where this sits vs launch (1.8)
This loop **is** the launch-critical path (OQ-T8: 0 contracts exist for 17 slots; the engine is only the mechanism). fox is slot #2 (bunny = #1). Every PASS here is one more sellable slot. Coupon/pricing/branch-consolidation run as parallel hygiene through Codex — not on this runway.
```

**Immediate next action:** Guy runs STEP 1. Ping "mint ran" → Cowork does STEP 2.
