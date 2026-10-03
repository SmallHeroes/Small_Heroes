# Momo visual pilot results

Guy approved the proposed two-image pilot on 2026-10-03. The front candidate and
an alternate-angle study are saved with a pending literary profile and visual
specification. This is not a completed six-view sheet pack or runtime admission.
Codex owns this implementation; independent Claude Code QA has not run.

## Saved assets and observations

Packet: `outputs/personal-momo-companion-pilot-20261003/` in this checkout.
It contains the two PNGs, pending character/visual JSON, exact prompts, receipt,
local comparison preview, offline verifier, verification output and QA handoff.
This ignored packet has no verified remote backup.

| Image | Bytes | SHA-256 |
| --- | --- | --- |
| front-candidate.png | 2336911 | a4a8ba6db30374fd2a33513ecbb13c9b89676a2f5d5b705f0e909e81925d18a3 |
| three-quarter-candidate.png | 2218627 | d00b7a4b91adf459252b418ca4a63cd640123d9261f5b2806f5d46d161685f99 |

Both images are 1024 by 1536. Front style inputs are the existing Dini, Anat and
Uri fronts; the alternate uses Momo's generated front as its sole identity input.
The four limbs, large ears, peach blush, curved trunk and coral scarf remain
recognisably consistent. Knot side is retained, not exact knot geometry.

The alternate is only near-frontal, not a sufficiently clear three-quarter view;
that sheet slot remains incomplete. Body colour reads warm gray rather than
distinctly blue-gray. Upright animal stance, three nail marks per paw and head
tuft are candidate choices, not previously approved canon. Tail, other views,
child-relative scale and scene continuity remain unestablished. No numeric
resemblance score or visual PASS is claimed. Read-only subagent critique agrees
with these observations, but is not independent Claude Code QA.

## Execution and cost limits

Two built-in image tool calls, no Codex automatic retries or extra generations,
no book render or video. The existing OpenAI API key was not used. The tool
returns no model identity, quality tier, token usage or actual charge. The planned
LOW tier could not be configured; this limitation was disclosed before dispatch.
Do not present these as attested gpt-image-2 LOW results or as a zero-cost run.
The receipt uses null for unknown cost, not zero. The separate $12 text trial
remains pending and was not run.

## Offline checks

The verifier exits 0 with 28 assertions: generated PNG hashes/sizes/signatures,
three source-reference hashes, source-document identity, candidate status,
literary shape and fail-closed current-engine admission. The candidate satisfies
the current literary field shape excluding the ID, while the full schema rejects
`elephant_momo` and the actual resolver returns null. This is deliberate pending
admission, not a production error. Verifier makes no live calls.

~~~powershell
node --require ./scripts/shims/register-server-only.cjs ./outputs/personal-momo-companion-pilot-20261003/verify.cjs
npx tsc --noEmit
~~~

Both commands exited 0. Full repository gate and real browser audit were not
rerun. The preview file was sent to the Codex browser panel; opening was queued,
not proof of rendering. No production files or existing assets were edited.

## Owner decision and independent review

Guy reviews the proposed appearance, including the warmer gray and upright
stance. A clearly rotated 3/4 view requires a new bounded generation decision;
there is no automatic third call. All nine complete packs and their animations,
roster activation, site integration, QA/public deployment remain future work.

Claude Code should falsify image/file binding, current-schema rejection, the
near-front and palette disclosures, and the absence of catalogue/runtime edits.
Do not expand any prior PASS, use a key, generate, push or deploy in that review.
See the local `HANDOFF.md` for the exact review and inspection commands.
