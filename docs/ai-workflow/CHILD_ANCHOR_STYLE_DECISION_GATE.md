# Child-anchor style (R1, child-anchor-style/v1) — decision gate

Status (2026-10-17): built offline at 01fc7eb8, awaiting Codex code QA. No paid
run has happened. This is not product acceptance.

## Authority

- Plan: `_review/new-book-anchor-style-20261017/DECISION-GATE-CHILD-ANCHOR-STYLE-20261017.md`
  (sha256 0fad309d…3b89, unchanged).
- Codex plan review and its binding acceptance addendum (four points).
- Guy selected R1 and approved the offline milestone. He later approved up
  to USD 8 of API for this cycle: at most USD 1 for the anchor diagnostic,
  then at most USD 7 for one LOW experimental book. Each stage still needs
  Codex code QA PASS at a frozen HEAD and its own one-use grant.

## Contract

R1 is a NEW, unvalidated no-photo variant inspired by the owner-liked photo
anchor. Its success is not inherited from the photo route.

- **Request.** Production's description prompt, with only its
  generic-template sentence removed, then production's negative prompt.
- **References.** The two character-free Style-01 technique files, in
  production `style` reference mode: gpt-image-2, LOW, 1024 square. There is
  no child template.
- **Pinned authority.** An explicit manifest pins the files by path and
  sha256. If production's resolution differs (cwd, PHASE2_STYLE01_REF_CONFIG,
  subset) or the bytes changed, the run refuses. It also refuses if the real
  planning seam would truncate the references. All of these refuse before
  the stage folder exists.
- **Acceptance has three gates, all on ONE final candidate.** Each binds the
  candidate sha, context sha and recipe sha:
  - **Style:** a Sol 6.1 review using production's imported style criterion.
  - **Design:** the existing eight categories.
  - **Apparent age:** compatible / defect / uncertain. It shares the design
    call and has no numeric tolerance.
- **Outcomes.** Uncertain, unassessable, missing, malformed or unpriced
  evidence holds the child.
- **One correction, for a known defect only.** The correction edits the
  rejected candidate (`book_design`, `rejected_edit_target`). That edit gets
  its own style review and its own design + age review. A PASS on an earlier
  image never carries over.
- **Grant re-check.** The grant re-derives all three gates for the adopted
  bytes.
- **Meter.** Six named steps at most: reference_child,
  reference_child_style_qa, reference_child_qa, reference_child_repair,
  reference_child_repair_style_qa, reference_child_repair_qa.
- **Opt-in.** The config field `childAnchor: "child-anchor-style/v1"` turns
  this on. Without it, the legacy child stage, its four-call terms and its
  historical ledger reads are unchanged.
- **Standalone diagnostic** (`scripts/personal-child-anchor-style-probe.ts`):
  at most four calls, with no correction and no retry. It is dry by default.

## Limits

- Fake replies prove routing only, not the judge's visual ability.
- There is no all-age calibration.
- Fixing style does not fix scale: S1 stays O3 and S2 stays closed.
- `npm run check` remains RED, as it was before this change.
