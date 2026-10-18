import 'server-only';

/**
 * Opt-in VISIBLE-MOMENT contract (Guy 2026-10-18 storyboard recovery brief): an instruction contract that extends the moments contract with
 * two general planning rules a semantic review found broken in a real held storyboard:
 *   1. what a frame must SHOW is inside that frame's own camera and composition (a required visible element is never only implied);
 *   2. a continuity state is the condition at the end of its page (a depicted value: at the drawn instant), never an action still in progress;
 * and that every declared state is established, in every part, by its own quote. Instruction only, like the scene-location and compiler-rules
 * contracts: no new schema, the compilers are unchanged, the review's instructions and criteria are unchanged; the compiled book's marker records
 * it. A repair may add it (storyboard-repair REPAIR_ADDABLE_CONTRACTS); absent, nothing changes: no source, digest, instruction or input byte.
 */
export const VISIBLE_MOMENT_CONTRACT_VERSION = 'storyboard-visible-moment/v1' as const;

export const VISIBLE_MOMENT_STORYBOARD_ADDENDUM = `VISIBLE MOMENT (visible-moment contract; it extends the moments contract):
- A frame's shot, angle and composition must be able to show everything its page must show at the drawn instant: every moments requirement of kind "show" and every discovery the page's text makes visible are inside the frame and readable. Light, a reflection, a shadow, a gaze or an offscreen element never stands in for something the picture must show. When the planned shot or angle cannot contain it (for example a view looking down when the sky itself must be seen), change the shot, angle or composition, never the requirement or the text.
- Every continuity state is the condition that holds at the END of its page, and every depicted relation or attribute the condition at the drawn instant: never an action still in progress. A process the page completes is recorded as its completed result, and a state the story has finished or reversed is never carried forward as still ongoing.
- Every continuity change, depicted relation, depicted attribute and actor state cites a quote that establishes every part of it. A part its own quote does not establish is dropped, or given its own quote that does.`;
