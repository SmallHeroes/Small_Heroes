/**
 * (Human-QA Slice 3 — RE-RENDER) The SINGLE, provable seam where an operator note may enter image generation.
 *
 * Brief §2.5: the operator note is mandatory guidance ("the child is well away from the railing") but it is NEVER
 * authority. It may enter ONLY as low-priority ADDITIVE pose / spacing / composition guidance, and it must NEVER
 * reach: the visual-contract prompt block, the safety-QA prompt, qaInput, extraNegativeRules, the contract hash or
 * evidence, any threshold, or any "must not show" / safety rule.
 *
 * This function is that seam and nothing else is. It appends the note as the LAST line of the ALREADY-composed
 * render prompt — i.e. AFTER `composeContractAuthoritativePrompt` has prepended the authoritative VISUAL CONTRACT
 * block (backend/providers/image.ts, the Style-01 phase-2 render seam). Consequences, by construction:
 *   • The note is textually SUBORDINATE to the contract block, which sits at the top and states "Where they
 *     conflict, THIS contract wins" — so an appended note can only ever be weaker guidance.
 *   • The note is a SEPARATE string appended here; it is never passed to buildVisualContractPromptBlock, so it
 *     cannot enter the contract block, its hash, or its evidence.
 *   • The safety-QA evaluator (evaluatePageVisualQa) takes only an imageUrl + booleans — it has NO free-text
 *     channel — and its safety prompt is a module constant, so the note is structurally unable to reach QA.
 *   • The Style-01 negative prompt is a constant and extraNegativeRules is not even threaded on this path.
 * The note is also stored VERBATIM on the HumanQaOperatorAction audit row (separate from any prompt).
 */

/** The label that fronts every operator note in the prompt — makes the note self-identifying and non-authoritative. */
export const OPERATOR_NOTE_PROMPT_PREFIX =
  'OPERATOR STAGING NOTE (non-authoritative — additive pose / spacing / composition guidance ONLY; the VISUAL ' +
  'CONTRACT above overrides this. It may NEVER change the location, cast, wardrobe, or any safety / must-not-show ' +
  'rule):';

/**
 * Append the operator note as the final, lowest-priority line of a fully-composed render prompt. A blank/absent
 * note returns the prompt byte-for-byte unchanged (so a re-render without a note is identical to today). Pure.
 */
export function appendOperatorNoteToRenderPrompt(prompt: string, note: string | null | undefined): string {
  const trimmed = (note ?? '').trim();
  if (!trimmed) return prompt;
  return `${prompt}\n\n${OPERATOR_NOTE_PROMPT_PREFIX} ${trimmed}`;
}
