# QA landing integration review

Guy asked Codex to check and push Claude's latest work to QA. This handoff is for
Claude's independent review of Codex's port, not an independent PASS awarded by
Codex. Product acceptance remains Guy's. The source design is Claude's work.

## Scope and topology

Base: `c3db7a856910c1400e0e0c6da11840ef187d21fc`. Integration branch:
`codex/personal-site-qa-integration-20260930`, worktree
`C:/Users/guyna/.codex/worktrees/personal-site-qa/Small_Heroes`.
The exact committed head is supplied in the closeout after this milestone.

Frozen source: `86ca47e8..ae502594ead3ea0c01f23386f2a060d715c1347c`, three
commits (`be82efb7`, `87b0d196`, `ae502594`), clean Claude branch
`claude/personal-landing-clarity-20261002` in
`C:/GNart/Work/sh-landing-clarity-20261002`. Codex imported this focused delta,
not the whole source/engine branch. The source remained read-only.

QA release was clean at `50eb17e5`, matching the live remote before editing.
The local engine remains at `2ec333a3`, listener 3443/PID 145892 on loopback.
Protected checkouts were clean at `768ccb2f` and `63ccb484`. No pilot reset.

## Implementation and unchanged behavior

The hero now identifies a personal children's book before describing its mood.
A new section connects three invented child details to a hand-written excerpt,
using existing hero art. The note explicitly denies that this is engine output.
The six companion cards get topic-free character lines. The existing sky wash
continues into later sections. The primary action consistently names the next
step; the example links to the new section.

New content renders only with `personalPreview`. Public landing markup and
`/start` are unchanged. Preview code still ships in shared JavaScript; this is
render isolation, not bundle exclusion. Codex corrected one inherited note to
state that QA live decoding is OFF and authorized local trials are separate.
Destination's newer recording-copy test expectations were preserved.

Changed application paths: `app/dev/personal-product/personal-wow.css`,
`app/landing/landing-page.tsx`, `app/landing/personal-proof.tsx`,
`app/landing/personal-wow/PersonalWowHero.tsx`, `content/personal-landing.ts`,
and the existing `lib/personal-wizard/__tests__/story-writer.spec.ts`.
Remaining changes are source evidence, this handoff/decision and canonical docs.
No schema, migration, dependency, API, middleware, wizard, engine, ledger,
payment, anchor, image prompt, or QA threshold changed. No provider call or cost.

## Validation

- `npx tsc --noEmit`: native exit 0.
- Focused command below: 17 files, **350/350**, exit 0. Logged model telemetry
  comes from injected test providers, not real paid calls.
- Offline rendering of the actual shared React component compared against its
  base Git blob: public markup byte-equal, 50,566 UTF-8 bytes. Preview has one
  example section, its disclaimer, wizard links and all six companion lines.
- The check detects an in-memory deliberate removal of the shipped preview JSX
  fence. No source file is rewritten for this negative control. React effects,
  browser layout and hydration are outside this SSR measurement.
- `git diff --check HEAD`: clean. Application landing files equal frozen Claude
  source, except the explicit QA/local-trial note. The source tests are merged,
  not replaced wholesale.
- `npm run build`: native exit 1 at Prisma's shared Windows DLL rename (`EPERM`),
  before Next. Separate `npx next build`: native exit 0. The user's local pilot
  was not stopped and no shared dependency was deleted. These are distinct
  measurements, not a full-build PASS.
- Config-only `ENABLE_V3_APPROVED_BANK=true npm run release-check`: exit 0,
  18/18 sellable, 1/18 render-qualified, DB skipped without DATABASE_URL. This is
  not a render qualification or database certification.
- Full `npm run check`: native exit 1, RED. Ordinary stage has 10 failures /
  5,069 passes / 73 skipped. Resource stage has 635/635 tests but three
  `onTaskUpdate` RPC errors, native exit 1. Ten ordinary failure names are identical
  to the prior UI milestone log; a fresh base full run was not done here.
- Browser inventory timed out twice and reset its kernel. No fresh visual or
  interaction acceptance is claimed. Claude's source browser results remain
  attributed source evidence, not Codex measurements.

Evidence is under ignored `outputs/personal-landing-qa-clarity-20261002`:
`verify-render.cjs`, `render-verification.json`, `full-check.log` and
`release-check.log`, `build.log` and `next-build.log`. These local files have no
verified external backup.

```powershell
Set-Location 'C:\Users\guyna\.codex\worktrees\personal-site-qa\Small_Heroes'
npx tsc --noEmit
npx vitest run lib/personal-wizard lib/__tests__/personal-site-qa-home.spec.ts lib/__tests__/hero-child-handoff.spec.ts lib/__tests__/voice-stage-lifecycle.spec.ts lib/__tests__/vitest-workload-classifier.spec.ts
node outputs/personal-landing-qa-clarity-20261002/verify-render.cjs
```

## Falsification targets

1. Try to leak the example, new hero or companion lines into the public render.
   Confirm actual route gates and noindex/middleware are unchanged.
2. Challenge the example's attribution: invented family, existing illustration,
   hand-written prose, no claim of measured engine or clinical performance.
3. Confirm that the QA/local-trial note cannot imply a live cloud service is ON.
   Verify runtime status remains `live_flag_off`; story/book remain unavailable.
4. Compare the recording wizard, API, middleware, packages and local engine to
   base; prove no old source test replaced the one-minute lead assertion.
5. Check desktop/mobile header links, new proof layout, reveal behavior and
   reduced motion in a real browser. Codex could not complete that check.
6. Verify Git target, stable QA alias and unchanged production deployment. A
   safe QA preview is not release readiness; the full gate remains open.

## Exclusions and rollback

No public rollout, provider activation, payment, full story/render trial,
credential read, DB write, protection change, branch cleanup or forced push.
Prior QA READY deployment is `dpl_8nhVmZT5hasBEmCzWL5iTbrGJrqc`; production
identity before promotion is `dpl_2X7E6d1acZ5vKJVhLSuKFGP5Q4HN`. A rollback
requires a reviewed additive revert or separately authorized QA alias restore.
