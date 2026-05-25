# Cursor Brief — ImageGuard Base-Slug Fix + Prompt Hygiene

**Owner:** CTO · **Status:** ready for Cursor · **Type:** contained fix
**Depends on:** the flux-clean-prompt build (already landed)
**Goal:** unblock the Flux clean-path A/B experiment. The clean prompt path works; the experiment failed 0/10 on a guard/version-pin string conflict. Fix that, plus three prompt-hygiene items, then a prompts-only verification gate before any paid render.

---

## 0. Why this brief exists

The clean-path Bedtime A/B re-run failed every page:

```
[ImageGuard] Development mode expected model
  black-forest-labs/flux-dev
but got
  black-forest-labs/flux-dev:6e4a938f85952bdabcc15aa329178c4d681c52bf25a0342403287dc26944661d
```

The clean path itself is fine — prompts logged as `path=flux_clean`, scene-led, ~87–115 words, varied storyboard shots. The failure is purely a string conflict: `resolveVersionPinnedModel` rewrites the base model into its version-pinned form (`owner/model:version`), and `ImageGuard`'s dev-mode check does an **exact-string** compare against the bare slug. Same model, different string → every page rejected. No image was rendered.

---

## 1. Fix A — ImageGuard compares base slugs

Find the `ImageGuard` dev-mode model check (the code that emits `[ImageGuard] Development mode expected model ... but got ...`).

Change the comparison so it matches on the **base slug** — the `owner/model` part before the `:version` suffix — not the full string:

- Normalize both the expected and the actual model string by taking everything before the first `:` (e.g. `value.split(':')[0]`).
- Compare the normalized values.
- `black-forest-labs/flux-dev` and `black-forest-labs/flux-dev:<version>` must pass the **same** guard.
- Keep the rest of the guard intact — it must still reject a genuinely wrong base model.
- If the log message prints the model, keep printing the full (pinned) string so the version hash stays visible for debugging.

This keeps version-pinning working everywhere (private LoRA slugs still need it) and keeps the guard doing its real job — validating the base model.

---

## 2. Prompt hygiene — same commit

All in `lib/flux-clean-prompt.ts` (the clean-prompt builder).

**2.1 — No Hebrew in the Flux prompt.** The assembled clean prompt still carries Hebrew tokens — child name `מיכל`, companion `בּוֹלִי`. Flux cannot read Hebrew; it is prompt pollution. The child line and companion line must be English-only. Zero Hebrew characters anywhere in the positive prompt.

**2.2 — Normalize the child name.** The name has appeared as `מיכל` / `Micha` / `Michael` / `Michal`. Standardize on **`Michal`**. Trace where the child name enters the builder and fix it at that point so every page emits `Michal` — never `Micha`, `Michael`, or the Hebrew form.

**2.3 — Companion typo.** The companion line emits `soft pi  ink belly` (corrupted "soft pink belly"). Fix to `soft pink belly`.

---

## 3. Do NOT

- Do NOT bypass with `NODE_ENV=production`.
- Do NOT disable ImageGuard.
- Do NOT use Fix B (skip pinning for public models) — Fix A only.
- Do NOT change the provider strategy, the LoRA, or the clean-path prompt structure.
- Do NOT touch the legacy prompt path.
- Do NOT run paid image generation until the prompts-only gate (§4) passes and the CTO approves.

---

## 4. Prompts-only gate — run BEFORE any paid render

Run the experiment in `--prompts-only` mode. Report back:

- The full page-1 assembled clean prompt text.
- Page-1 word count.
- Confirmation: zero Hebrew characters in the prompt — checked across all 10 pages, not just page 1.
- Confirmation: child name is `Michal` everywhere — no `Micha`, `Michael`, or `מיכל`.
- Confirmation: companion line reads `soft pink belly`.

Stop there. Do not proceed to renders.

---

## 5. Paid A/B re-run — only after §4 is clean and CTO-approved

Once the CTO approves the prompts-only report, re-run the Bedtime A/B with real Flux images:

- `DISABLE_IMAGE_GENERATION=false`
- `FLUX_CLEAN_PROMPT=on`
- `IMAGE_PROVIDER=replicate`
- `ENABLE_LORA=true`
- Arm A — child photo passed as `input_images`.
- Arm B — without the child photo.

Output saved alongside `image-experiment-1/`, same as the prior runs.

---

## 6. Definition of done

- ImageGuard passes for both `flux-dev` and `flux-dev:<version>`; still rejects a wrong base model.
- The clean prompt is English-only, child name `Michal`, companion line `soft pink belly`.
- Prompts-only report delivered: page-1 text + word count + the three confirmations.
- Files changed listed.
- Then — and only then — the paid A/B re-run.
