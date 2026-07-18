# BRIEF (CC) — Set Board prompt: single establishing view (kill the multi-panel layout)

## 1. ROUTING + TARGET BRANCH
- **Executor:** Claude Code (CC). **Target:** `feat/chunked-generation` (`sh-wt-style01`). Branch pre-check first; single session.
- **Gate:** prompt-CONTENT refinement of the board engine — does NOT touch the gated surfaces (resolver/binder/chunk-resume/reference-transport/money/safety). The real proof is the re-mint QA result (Guy runs it). No full Codex round needed for a prompt string change; Cowork verifies the diff + the re-mint.
- **Origin:** the first fox board minted end-to-end (pipeline + content-addressed upload + vision QA all worked). QA CORRECTLY **failed** it: `flags: panels`. The rendered board came out as a **3-panel watercolor sheet with cream gutters** — panel borders that would leak into pages. The SET CONTENT is excellent and correct (open window NOT a door, balcony + bedroom connected, railing, tin bucket under the drip, chair, slipper, curtains, right watercolor style, no characters). Only the multi-panel LAYOUT is wrong.

## 2. SCOPE
Change the board prompt from a **multi-view reference sheet** (which makes the model draw panels) to **ONE canonical establishing view** of the whole set — panel-free by construction. The top panel of the rejected board already proves a single wide establishing view captures the entire connected set (bedroom → open window → balcony → railing → bucket) beautifully. Keep everything else (set geometry, fixed objects, wall openings, strict forbids incl. no-panels, the order style).

## 3. FILES / AREAS
- `lib/set-identity-board/boardPrompt.ts`:
  - Replace the header `SET IDENTITY BOARD — CHARACTER-FREE MULTI-VIEW SET REFERENCE SHEET` and the "one canonical establishing view plus 1–2 neutral alternate views… arranged as a clean reference sheet" framing with: **render ONE single canonical establishing view of the whole set, empty of inhabitants — a single continuous illustration, NOT a sheet, NOT multiple views, NOT panels.**
  - Remove the `VIEW PLAN: 1. / 2. / 3.` numbered multi-view block entirely (it is what enumerates panels).
  - Keep: SET IDENTITY, LOCATIONS/VIEWPOINTS (as the description of the ONE space), SET GEOMETRY, FIXED SET OBJECTS, WALL OPENINGS, STRICT FORBIDS (keep the no-panels/no-gutters/no-dividing-lines forbids — belt and suspenders), the STYLE block, the negative prompt.
  - No fox/balcony literals in the reusable code (unchanged rule).

## 4. ACCEPTANCE CRITERIA
- The board prompt requests a SINGLE establishing view (no "multi-view", no "reference sheet", no numbered VIEW PLAN); the no-panel/no-gutter forbids remain.
- `promptHash` changes (prompt changed); `setDefinitionHash` unchanged (set-only, prompt not in it) → re-mint replaces the failed candidate at the same registry key.
- `npm run check` green (real toolchain — tsc via node).
- The existing boardPrompt spec updated to assert single-view shape (no VIEW PLAN / no "reference sheet"); other tests green.

## 5. TESTS
- boardPrompt spec: asserts the prompt has no numbered VIEW PLAN, no "multi-view"/"reference sheet" language, and still carries set geometry + forbids + style.

## 6. WHAT NOT TO TOUCH
- The resolver/binder, chunk lifecycle (`set_refs`), reference transport (B/C), Stage-1 safety, money, reader. Only `boardPrompt.ts` content + its spec.

## 7. GIT HYGIENE
Explicit pathspecs; NEVER `git add -A`. Commit on `feat/chunked-generation`; Guy pushes.

## 8. FINAL VERIFICATION
- `npm run check` green. Report the boardPrompt diff. Then STOP — Guy re-mints (`--render --quality low`) and eyeballs; the board should now pass QA (no panels) and be a single clean set plate → then `--approve` → 5-page proof.
