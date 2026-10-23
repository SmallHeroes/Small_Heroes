import 'server-only';
import type { PreviewPlan } from '../local-story-preview';
import type { sequencePageState } from '../local-book-sequence';
import { CALIBRATION_STORYBOARD_ADDENDUM, CALIBRATION_REVIEW_ADDENDUM } from './storyboard-calibration';

/** Prospective clarification of the EXISTING compiler/state model, not another ledger or an admission policy. */
export const STORYBOARD_STATE_PARITY_VERSION = 'storyboard-state-parity/v1' as const;
const rules = Object.freeze({ version: STORYBOARD_STATE_PARITY_VERSION,
  attributeAuthority: Object.freeze({ default: 'fixed', declaredMutableInvariant: 'initial_value_not_immutable',
    changesRequire: 'declared_attribute_and_exact_same_page_source_support', declarationAloneIsSemanticPermission: false }),
  temporalAuthority: Object.freeze({ initialStates: 'end_of_first_body_page', firstBodyPageTransitions: 'must_be_empty',
    laterStates: 'end_of_current_body_page', transitions: 'prior_page_end_to_current_page_end',
    depicted: 'this_picture_instant_only_never_persisted', cover: 'own_picture_not_a_body_page_end' }),
  validationScope: 'compiled_structure_and_source_provenance_not_semantic_or_pixel_acceptance',
} as const);
export const stateParityRules = () => structuredClone(rules);
type Sequence = Parameters<typeof sequencePageState>[0];

/** Derived from the same validated plan/sequence used to render. Never infer support or change the compiler's values. */
export function stateParityAuthority(plan: PreviewPlan, sequence: Sequence) {
  const entities = plan.continuity?.entities;
  if (!entities) throw Error('storyboard_state_parity_continuity');
  const keys = sequence.mutableAttributes.map(m => `${m.entityId}:${m.attribute}`), mutable = new Set(keys);
  if (mutable.size !== keys.length || sequence.mutableAttributes.some(m => !entities.some(e => e.id === m.entityId &&
    e.invariants.some(a => a.attribute === m.attribute)))) throw Error('storyboard_state_parity_mutable_binding');
  if (plan.continuity!.pages.some(p => p.changes.some(c => !mutable.has(`${c.entityId}:${c.attribute}`))))
    throw Error('storyboard_state_parity_fixed_change');
  return { ...stateParityRules(), entities: entities.map(e => ({ entityId: e.id,
    fixedAttributes: e.invariants.filter(a => !mutable.has(`${e.id}:${a.attribute}`)).map(a => ({ ...a })),
    mutableAttributes: e.invariants.filter(a => mutable.has(`${e.id}:${a.attribute}`)).map(a => ({ attribute: a.attribute, initialValue: a.value,
      changes: plan.continuity!.pages.flatMap(p => p.changes.filter(c => c.entityId === e.id && c.attribute === a.attribute)
        .map(c => ({ pageNumber: p.pageNumber, value: c.value, storyEvidence: c.storyEvidence }))) })),
  })) };
}

/** Replace the conflicting entry; appending a second, contrary rule would reproduce the defect. Missing/duplicate entries refuse. */
function replaceEntry(text: string, prefix: string, replacement: string) {
  const lines = text.split('\n'), matches = lines.flatMap((line, i) => line.startsWith(prefix) ? [i] : []);
  if (matches.length !== 1) throw Error('storyboard_state_parity_instruction_binding');
  let end = matches[0] + 1;
  while (end < lines.length && lines[end].startsWith('  ')) end++;
  return [...lines.slice(0, matches[0]), replacement, ...lines.slice(end)].join('\n');
}
export const stateParityPlannerCalibration = () => replaceEntry(CALIBRATION_STORYBOARD_ADDENDUM, '- One source for changing state:',
  '- One source for changing state: the legacy field continuity.entities[].invariants stores baseline values. An attribute is fixed UNLESS its exact entityId/attribute is declared in sequence.mutableAttributes; for that declared exception the invariant is its INITIAL VALUE, which the compiler REQUIRES, not a ban on change. Keep that baseline and record only exact source-supported changes on their pages. Never remove the baseline to make an attribute mutable. A mutable declaration alone does not prove a change or override canon, identity or safety. List visual-language state statements in selfCheck.visualStates as {phrase: exact visual-language words, refs: their p{n}:change:{entityId}:{attribute} refs}; empty when none. At most8entries,phrase<=300characters,1to4refs.');
export const stateParityReviewerCalibration = () => replaceEntry(CALIBRATION_REVIEW_ADDENDUM, '- calibration.visualStates',
  '- calibration.visualStates maps visual-language statements to source-supported mutable changes. stateParity.entities splits genuinely fixed attributes from declared mutable baselines and their exact change timeline, derived by the same compiler. A changed declared mutable attribute is NOT a contradiction merely because its initial value is stored in the legacy invariants field. Judge whether the actual change is supported and agrees with its page/current instant, canon and visual language; undeclared changes, unsupported states, fixed-attribute contradictions and uncertainty still hold. The declaration and the projection are not semantic evidence.');

export const STATE_PARITY_PLANNER_ADDENDUM = `STATE PARITY (storyboard-state-parity/v1): read the bound stateParity rules in the input.
- The sequence is an END-OF-PAGE ledger. sequence.initialStates means END OF BODY PAGE1, not the opening paragraph. Read that whole page before assigning it. Page1 transitions and sceneChangeEvidence stay empty, as the compiler requires; do not add an initial transition to fix an end-state mistake. Later page transitions join the previous page's end to this page's end.
- moments.frames[n].depicted is only the illustrated instant. If it is earlier than the page end, put its supported overrides there; they must not replace the ledger or leak into later pages. Offscreen does not erase state. A cover has its own picture, not a body-page end.
- Use the existing selfCheck.events/keyEvent to choose what the page consequentially changes. When a provisional success is reversed within the page, an isolated success must not read as the final outcome. Prefer the reversal/escape or readable result cues at ONE supported instant. Do not paint successive instants together, force every event into one image or always choose the last sentence. Quiet endings and jokes may themselves be consequential. The reviewer still judges meaning.
- Fixed identities/safety and nonmutable attributes remain fixed. No arbitrary mutable state, unrelated quote, inferred certainty or suppression of a material finding is allowed.`;
export const STATE_PARITY_REVIEW_ADDENDUM = `STATE PARITY (storyboard-state-parity/v1): planner, compiler, renderer and this review share the bound stateParity authority.
- Read sequence.pages[].states as END-OF-PAGE states, including the first body page; do not demand page1 transitions (the compiler forbids them). An earlier depicted instant does not establish the end state, and an end state is not automatically what the picture depicts. A cover is separate.
- A source-supported intermediate instant is not invented. Independently judge whether the selected instant/cues preserve this page's consequential action, reversal, reveal or joke. A temporary success that falsely reads as the resolution may still be material; do not demand every sequential event simultaneously, equate every omission with a contradiction, or declare every intermediate instant acceptable. Uncertainty remains uncertain.
- The structured fixed/mutable split explains compiler semantics, not semantic approval. Judge exact source support, actual effective state, canon, age, safety and identity as before; material findings retain their existing typed impact. Never convert an old raw review into a new-contract verdict.`;
export const STATE_PARITY_RENDER_ADDENDUM = `STATE PARITY storyboard-state-parity/v1: the supplied effective visual state and drawn instant are authoritative for THIS picture. Declared mutable attributes' legacy baseline values are not immutable current values. Do not carry earlier pictured overrides into later pages or paint multiple sequential instants. Preserve fixed canon, visible identity, safety and the required consequential action.`;
