# Set Board Same-Byte QA Recheck — Implementation Evidence

**Date:** 2026-08-20

**Branch:** `codex/qa-wizard-presentation-dispositions`

**Base:** `a001a097e003df68b5c96639ed2cbb2ce93f94da`

**Decision Gate:** `R1D_SET_BOARD_SAME_BYTE_QA_RECHECK_DECISION_GATE.md`

## Outcome

The first LOW Chameleon home Board was not regenerated. Its exact
content-addressed PNG remains unchanged and unapproved. The code now supports
one bounded Vision-only adjudication over those exact bytes after independent
QA, while keeping render, upload and approval unreachable from that mode.

## Production changes

1. `buildBoardQaInstruction` now includes the already-guarded zone geometry
   and tells Vision to require a distinct recognizable physical object before
   emitting an excluded-prop flag. An allowed surface, furnishing, color,
   stripe, pattern, texture, material or shape is not sufficient.
2. Registry validation exposes the immutable identity/content portion as a
   separate pure validator. The existing live validator preserves its prior
   full fail-closed QA and human-approval behavior and continues to report all
   identity plus approval defects for structurally valid entries.
3. The canonical Board CLI now accepts only
   `--recheck --entry <path> --contract <path>`. It refuses pending, passed,
   approved, stale-identity, stale-policy, stale-prompt, incomplete or
   byte-mismatched entries before Vision.
4. Recheck downloads the durable storage object and independently recomputes
   SHA-256. It writes a canonical-digest `set-board-qa-recheck-receipt/v1`
   record with `status: armed` before Vision. The record is created with
   exclusive-create semantics; any existing armed or completed record blocks
   another call.
5. A completed receipt persists only closed status/count/digest evidence, not
   raw model flags. A pass changes only `qaStatus` and `qaCheckedAt`, leaves
   both approval fields null, and performs no render or upload. Failure leaves
   the Registry byte-equivalent. A thrown Vision call leaves the armed record
   and therefore also blocks retry.
6. The live-import preflight now verifies the exact download and public-URL
   storage exports used by recheck while retaining zero fetch/provider/write
   reachability.

## Test evidence

Focused command:

```powershell
npx vitest run `
  lib/set-identity-board/__tests__/registry.spec.ts `
  lib/set-identity-board/__tests__/board-qa.spec.ts `
  lib/set-identity-board/__tests__/mint-tool.spec.ts `
  lib/set-identity-board/__tests__/mint-launcher.spec.ts `
  --maxWorkers=1 --no-file-parallelism
```

Result: **4 files / 130 tests PASS**.

The focused suite proves instruction geometry/object semantics, exact CLI
surface, armed-before-call ordering, same-byte SHA fence, zero render/upload,
pass-without-approval, failed-result immutability, interruption one-shot
behavior, repeat refusal, identity/prompt/byte drift rejection, status and
approval rejection, and the canonical launcher/preflight surface.

Additional checks:

- `npx tsc --noEmit` — PASS.
- `git diff --check` — PASS.
- `npm run check` — TypeScript and autonomous Story typecheck PASS;
  ordinary **3,360 tests PASS**, 65 skipped; resource-intensive **20 files /
  610 tests PASS**. Overall exit remains nonzero only because five unchanged
  tests reference ignored historical files absent from this worktree under
  `outputs/`:
  `momentum-gate-koko`, `page-entity-qa`, two
  `story-read-back-validation` cases and `child-lexicon-ages-5-8`.

## Runtime evidence and exclusions

No provider, Vision, image, upload, database, approval, Wizard, Blueprint,
page-render or production action occurred during this implementation. The
failed home Registry artifact and downloaded inspection PNG are intentionally
not part of the code commit. The town Board remains unminted.

After an independent Claude Code PASS and push, the only next external action
is one canonical Vision-only recheck of the existing home Board. A pass still
requires Guy's separate visual inspection and explicit `--approve` command.
