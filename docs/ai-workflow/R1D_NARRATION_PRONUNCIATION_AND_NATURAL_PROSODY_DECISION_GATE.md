# R1D — Narration Pronunciation Authority and Natural Prosody Decision Gate

**Approved by:** Guy

**Approval date:** 2026-09-02

**Base:** `f223a54af36b075fe21660959e5a591743b351d4`

**Branch:** `codex/r1d-narration-pronunciation-authority`
**Worktree:** `C:\GNart\Work\sh-narration-pronunciation`

## 1. Proposed change

First, run a bounded local ElevenLabs full-factorial audition that separates pronunciation from prosody. For each
test sentence, cross three niqqud scopes (none, context-correct risky words, and full sentence) with two punctuation
modes (the current ellipsis pacing and natural punctuation). Keep the voice settings and seed fixed within the item.

After Guy's listening decision, implement one shared, versioned narration authority for paid generation, Wizard QA,
auditions, and any retained full-book seam. The displayed text remains clean; the exact TTS text is derived after
personalization, audit-bound to its source text, and stored independently.

## 2. Why now?

Launch-readiness review found audible Hebrew mispronunciations. The reported examples `הד`, `ברחה`, `צפצפה`, and
`תפוח` currently pass through the paid TTS builder unchanged and without a coverage warning. The same builder also
replaces every period with three dots, or nine dots in sleep mode, which can introduce hesitation and overacting.

## 3. Scope

- General narration-system change, not a Lavi-, story-, page-, or companion-specific patch.
- Milestone A: local-only listening audition; no product runtime changes.
- Milestone B, only after listening acceptance: versioned pronunciation/prosody authority, unified call paths, safe
  content-addressed audio persistence, and targeted audio replacement.

## 4. Risk of hardcoding

Adding four global replacements would be unsafe. `צפצפה` and `תפוח` have multiple valid readings, so the final design
must support context-bound rules and exact page/sentence overrides. Unknown ambiguity must hold rather than guess.

## 5. Files likely affected

Milestone A is expected to touch only a new audition script, focused tests, this gate, and `CURRENT.md` evidence.
Milestone B may affect `backend/providers/audio.ts`, narration authority modules, generation text finalization and
audio chunking, QA/audition call sites, persistence metadata/migrations, tests, and `CURRENT.md`.

## 6. Expected behavior after change

- The fewest possible words are pointed, but each selected risky word carries enough niqqud to make its reading
  unambiguous.
- Homographs resolve from sentence context or an approved exact-text override.
- Removing niqqud from TTS text yields the exact displayed source text; no letter, word, or punctuation changes.
- Natural punctuation is preserved unless an explicit, reviewed pause is authored.
- A changed text, voice, model, settings, or policy version produces a new audio identity and invalidates stale QA.
- Existing audio bytes are never overwritten behind a stable cached URL.

## 7. Validation plan

### Milestone A — smallest empirical proof

- Four short Hebrew items covering `הד`, `ברחה`, both readings of `צפצפה`, and both readings of `תפוח`.
- Three niqqud scopes: none, context-correct risky words, and full sentence.
- Two punctuation modes for every niqqud scope: current ellipsis pacing and natural punctuation.
- One controlled, best-effort seed per item across all six conditions: 24 short clips in the current Fairy voice.
- Dry-run first: exact request and billed-character inventory; no provider call without `--live`.
- Human gate: score pronunciation and naturalness separately for every cell; no unintended word error.
- The live harness uses `eleven_v3`, Hebrew, the exact current Fairy settings, and explicit `mp3_44100_128` output.
- No retries or overwrite: a failed live run stops immediately and requires a newly approved run id.

### Milestone B — after Guy selects the winner

- Focused positive, negative, context-conflict, idempotency, prefix/inflection, stale-audio, retry, and bypass tests.
- `npx tsc --noEmit`, relevant tests, `npm run check`, exact generated-input evidence, and Claude Code adversarial QA.
- Targeted audio-only Preview proof; no book/image rerender.

## 8. Cost impact

- Milestone A: exactly 24 planned short ElevenLabs requests; the dry-run reports submitted Unicode code points before
  `--live`, and the live manifest records ElevenLabs' actual `character-cost` response headers.
- Zero image calls, zero Orders, zero database or Supabase writes.
- Milestone B cost is limited to accepted audition clips and later explicitly selected page-audio replacements.

## 9. Rollback plan

- Milestone A creates only local output artifacts; remove or ignore them with no product effect.
- Milestone B remains on a dedicated branch until independent QA and Guy acceptance.
- Content-addressed replacement retains the prior URL/bytes and supports atomic pointer rollback.

## 10. Review assignment

- Guy chooses pronunciation/prosody by ear and gives product acceptance.
- Codex owns architecture, implementation, tests, migration safety, and evidence.
- Claude Code must try to falsify context selection, source-text identity, bypass coverage, stale-audio invalidation,
  cache/overwrite safety, retries, and exact persisted authority.

## 11. Do not do

- Do not add story- or child-specific runtime regex patches.
- Do not auto-approve full-sentence niqqud without the listening comparison.
- Do not mutate the existing Lavi Order/book/audio during Milestone A.
- Do not overwrite an existing audio object or reuse a stable URL for changed bytes.
- Do not create images, Orders, payments, emails, PDFs, deployments, or Production mutations.

## Stop-check

1. General fix: yes; examples are evidence, not the implementation boundary.
2. Cross-story risk: yes; controlled by exact-text invariants, context tests, and fail-closed unknowns.
3. Production behavior affected: Milestone B only, after the listening gate.
4. Spend: Milestone A is bounded to 24 short TTS calls after dry-run disclosure; zero image spend.
5. Smallest validation: the 24-clip Fairy audition.
6. Guy decision: already approved the audition; must select the audible winner before Milestone B.
7. Claude falsification: pronunciation context, invariants, path parity, persistence, stale cache, and retry safety.
8. Claude Cowork: optional; no unresolved creative or story decision blocks the audition.
9. Guy eyeball/ear gate: listen to every cell, score pronunciation and flow separately, and approve the preferred
   niqqud scope plus punctuation mode.
