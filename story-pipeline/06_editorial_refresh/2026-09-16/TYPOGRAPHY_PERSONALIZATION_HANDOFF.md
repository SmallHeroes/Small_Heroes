# Typography, personalization and Guy's content approval

## Scope and authority

Guy approved all18 new stories, requested removing authored dashes, and required
dynamic child name and masculine/feminine language. This is a narrow copyediting
milestone, not a plot rewrite, new story bank, provider run or runtime promotion.
Same task/worktree, sole writer: C:/GNart/Work/sh-r3b1b-semantic-m1
Branch: codex/r3b1b-semantic-recovery-m1
Base:529b7522c68febf16feedace04c3d587afb19f93
End: the single child commit that first ADDS this handoff; resolve the exact SHA
below and compare its parent to base. Do not extend the review to a later HEAD.
Start: clean, ahead47/behind0 to local upstream; no fetch/push performed.
Protected dependencies remain clean at768ccb2f... and63ccb484....

Observed:65 authored dash/maqaf characters in title/prose, plus required technical
Markdown separators. Removing characters indiscriminately would break parsing or
join prefix letters to childName. Solution: punctuation-aware edits and several
short sentence rephrasings, retaining all216 page markers and dynamic chips.
No changes to app/backend/lib/scripts, active sources, images, QA or thresholds.

A real shared-gate probe initially found2 failures, both from the supporting name
Yael in Lion bedtime. It was NOT a fixed protagonist or proof of wrong gender.
That supporting character is now called 'the friend' without changing her role.
One actual agreement correction: Uri bedtime uses a feminine plural for a girl
walking with grandmother. Other name-prefix edits explicitly preserve both forms.

## Recorded owner decision

OWNER_APPROVAL.json binds each of18 baseline hashes at529b7522 to the corrected
file hash and records Guy's content approval and requested conditions. Source
frontmatter remains editorial_draft/runtimeAuthority:none to avoid silently
promoting a staging text. This is not a denial of Guy's already-given approval.
Do not request the same content approval again for this bound version.
Historical validation.json/validation-all18.json and earlier handoffs are unchanged.
The old 'Uri unchanged' assertion now applies to the pre-edit baseline, not current
punctuation-edited bytes. The validator explicitly binds the new approved identities.

## Verification

- Local validate.cjs: exit0,18 original accepted-source hashes/sizes unchanged,
  18 approval bindings,216 pages, zero authored dashes,17 rejected mutations.
  Both chip branches scanned; title/name/unknown tokens checked; reading copy matches.
- verify-personalization.cjs uses the REAL parseStoryMarkdown,
  resolveStoryBankPlaceholders and runStoryPersonalizationGate. No preview/render/
  provider module imported.144 cases =18 stories x4 names x2 genders;
  1728 TEXT-page expansions,5 negative controls rejected.
- Names include Hebrew, multiple words and a hyphenated name. A parent-supplied
  hyphen is preserved as part of the exact name, never confused with authored prose.
- Existing story-bank-personalization-gate.spec.ts:18/18 passed.
- Standalone npx --no-install tsc --noEmit: exit0.
- git diff --check clean. Only explicit paths staged.
- No full npm run check: existing NON-GREEN repository state remains open.
- No API/credential/image/audio calls. External API spend:USD0.

Evidence:validation-typography.json,personalization-check.json,OWNER_APPROVAL.json.
These checks are not exhaustive Hebrew grammar analysis, an independent PASS,
clinical validation, all-input support or full runtime readiness.

## Falsification targets for read-only first review

1. Recompute before hashes from529b7522 and after hashes from the current files.
   Confirm no old source, receipt, image or old evidence mutated.
2. Distinguish visible punctuation from Markdown page/frontmatter separators.
   Try ASCII/maqaf/en/em/minus/soft-hyphen in title/body and either gender branch.
3. Run the shared parser/resolver/gate, not just the local fixture checker.
   Verify literal name preservation and that supporting/companion gender remains
   fixed while references to the child vary appropriately.
4. Check sentence-level edits are limited to punctuation, prefix grammar, plural
   agreement and the disclosed supporting-name change, with no plot substitution.
5. Verify product-content approval is recorded without inventing technical QA,
   runtime publication, visual approval or permission to weaken an active gate.

## Copy-ready PowerShell

```powershell
Set-Location 'C:\GNart\Work\sh-r3b1b-semantic-m1'
$copyBase = '529b7522c68febf16feedace04c3d587afb19f93'
$copyHead = (git log -1 --diff-filter=A --format=%H -- 'story-pipeline/06_editorial_refresh/2026-09-16/TYPOGRAPHY_PERSONALIZATION_HANDOFF.md').Trim()
if ((git rev-parse "$copyHead^").Trim() -ne $copyBase) { throw 'Reconcile topology' }
git status --short --branch
git diff --stat $copyBase $copyHead
git diff --check $copyBase $copyHead
node story-pipeline/06_editorial_refresh/2026-09-16/validate.cjs
if ($LASTEXITCODE -ne 0) { throw 'Typography validation failed' }
node story-pipeline/06_editorial_refresh/2026-09-16/verify-personalization.cjs
if ($LASTEXITCODE -ne 0) { throw 'Personalization validation failed' }
npx --no-install vitest run lib/__tests__/story-bank-personalization-gate.spec.ts
if ($LASTEXITCODE -ne 0) { throw 'Personalization tests failed' }
npx --no-install tsc --noEmit
if ($LASTEXITCODE -ne 0) { throw 'Typecheck failed' }
```

Codex creates the local commit; no extra stage/commit required. Do not push without
Guy's explicit propagation request. A push carries the whole unpushed branch:

```powershell
git log --oneline 'origin/codex/r3b1b-semantic-recovery-m1..codex/r3b1b-semantic-recovery-m1'
# Only after an explicit push request:
git push origin codex/r3b1b-semantic-recovery-m1
```
