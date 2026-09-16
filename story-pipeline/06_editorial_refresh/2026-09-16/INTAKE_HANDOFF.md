# Claude Code: canonical intake preparation, first pass read-only

## Requirement and authority

Guy approved18 rewritten stories, no authored prose dashes, dynamic child name and
boy/girl forms, then instructed continued implementation. Prepare actual compatible
text candidates without changing approved prose or pretending publication succeeded.
Independent review has NOT occurred. This handoff requests it, not self-awards it.

Worktree C:/GNart/Work/sh-r3b1b-semantic-m1, branch
codex/r3b1b-semantic-recovery-m1, sole writer this Codex task.
Base7b21c36ac0e4decf00bda21d3fe8f9169777ddbe. Review endpoint is the first commit
adding this handoff (resolve below); its parent must equal the stated base.
Start clean ahead48; intended close clean ahead49/behind0. Protected d53b768ccb2f
and accepted-intent-wave2 63ccb484 clean, unchanged. No push authority used.

## Implementation

Only CURRENT.md and this editorial corpus change. New prepare-intake.cjs/test,
intake18 candidate Markdown files, manifest/README, decision and this handoff.
No scripts/ or lib/ or app/ production changes. Originals and approval untouched.

The exact seven-key frontmatter required by story-editorial-validation-contract
rejects status/runtimeAuthority. Derived copies remove only these two exact header
lines and normalize CRLF to LF. Real parseStoryMarkdown proves title, other metadata
and all216 pages equal. Real validateEditorialPassDraft validates each output with
gender_flexible. Its name does not mean a human/LLM Editor supplied a verdict.

Read-only --emit prints prospective file data; --check verifies the checked-in
files and manifest against fresh deterministic derivation. Files were materialized
with apply_patch; writes:0 describes command behavior, not this implementation turn.
New sidecar binds hashes, labels candidate status and missing requirements. It is
not a publication request. Reading predecessors are NOT asserted to be current
runtime selections or verified creative-lifecycle predecessor descriptors.

## Observed validation

- --check:18 candidates/216 pages; saved file bytes and sidecar match; exit0.
- node --test prepare-intake.test.cjs:11/11, including raw staging rejection by
  real validator; unapproved bytes/size, forged active flag, unknown metadata,
  wrong slot, missing page, wrong gender and suffix chips rejected; CRLF parity.
- Existing corpus validate.cjs:exit0; original source preservation/approval and
  typography assertions retained. No approved source or manuscript modified.
- Existing verify-personalization.cjs:144 name/gender cases,1728 text pages,
  5 negative controls; exit0. Candidate page equality connects this to the copies.
- vitest:story-source-creative-replacement-lifecycle27 +
  story-bank-personalization-gate18 =45/45, exit0.
- npx --no-install tsc --noEmit:exit0.
- Full npm run check not rerun: isolated staging tooling/data, no runtime change;
  no claim of repository stability. Previous NON-GREEN remains open.

## Falsify these claims

1. Compare approved drafts and output pages/title independently; only two header
   fields and line endings should differ. No changes to name/gender alternatives.
2. Prove this really invokes the publication's shared structural validator.
3. Try altered source bytes/hash/size, metadata, slot and page count. No silent
   sanitization of arbitrary metadata and no acceptance of a production flag.
4. Verify all candidate hashes and approval linkage; raw originals byte-unchanged.
5. Find any false Editor PASS, publication readiness, runtime switch, provider
   dispatch, legacy review reuse or stale visual directions. None is authorized.

## Explicit unfinished work

External Editor and independent artifact reviews of the new bytes; lifecycle
creative briefs and predecessor reconciliation; evidence-bound source promotion;
fresh visual directions and consumer qualification. We do not ask Guy to approve
the same prose again, and do not invent approval of a missing review hash.
No lifecycle loadInputs/publish attempt, accepted-source overwrite, rendering,
narration, key/provider access, deployment, push, QA changes or cost. Existing
reader, visual continuity/anatomy findings and stability limitations remain.

## Copy-ready PowerShell

```powershell
Set-Location C:/GNart/Work/sh-r3b1b-semantic-m1
$intakeBase = '7b21c36ac0e4decf00bda21d3fe8f9169777ddbe'
$intakeHead = git log --diff-filter=A --format=%H -- story-pipeline/06_editorial_refresh/2026-09-16/INTAKE_HANDOFF.md | Select-Object -First 1
if ((git rev-parse "$intakeHead^") -ne $intakeBase) { throw 'Review range mismatch' }
git status --short --branch
git diff --stat "$intakeBase..$intakeHead"
git diff --check "$intakeBase..$intakeHead"
node story-pipeline/06_editorial_refresh/2026-09-16/prepare-intake.cjs --check
node --test story-pipeline/06_editorial_refresh/2026-09-16/prepare-intake.test.cjs
npx --no-install vitest run lib/__tests__/story-source-creative-replacement-lifecycle.spec.ts lib/__tests__/story-bank-personalization-gate.spec.ts
npx --no-install tsc --noEmit
# Optional, only on Guy's explicit push instruction; pushes all outstanding history:
# git push origin codex/r3b1b-semantic-recovery-m1
```
