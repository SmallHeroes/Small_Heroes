import { canonicalJson } from './request-acceptance';
import { STYLE_01_SHARED } from '../style01-prompt-core';
import { locationExclusionDescriptions } from './location-sheet-projection';
import { materialFunctionFromContext } from './storyboard-material-function';
import type { auditionSheetDesigns } from './simple-book-reviewed-audition';

export const PICTURE_BOOK_REVIEW = 'picture-book-materiality/v1' as const;
export const PICTURE_BOOK_SCALE_REVIEW = 'picture-book-materiality/v2' as const;
export const PICTURE_BOOK_SPARSE_LANDMARK_REVIEW = 'picture-book-materiality/v3' as const;
export type PictureBookReview = typeof PICTURE_BOOK_REVIEW | typeof PICTURE_BOOK_SCALE_REVIEW | typeof PICTURE_BOOK_SPARSE_LANDMARK_REVIEW;

export const PICTURE_BOOK_SCALE_REPORTING = 'Standing-scale coverage is recorded separately in scaleEvidence. On a non-comparable frame, when there is no actionable scale issue, report the coverage limitation as an observation with an empty issues list and empty correction. Continue to report any visible action-scale defect or unresolved action-scale evidence as an issue.';

export const PICTURE_BOOK_CONCISE_REVIEW = 'Complete every required field. Use one short visual observation per evidence or note field, without repeating the same observation or reasoning. Keep the precise part, location, state and finding needed for each decision.';

export const PICTURE_BOOK_LANDMARK_REPORTING = 'If the supplied catalogue gives a planned landmark exactly one decisive feature and that feature is a kind unique to that landmark, the whole visible object can be identified by kind alone. In this case a second decisive aspect is unnecessary. Account for every competing body with a visibly contradicted kind and complete all four scans. If any competing body could be another instance, report the uncertainty. A landmark with the same kind elsewhere in the catalogue still needs distinguishing evidence. Never use a neighbouring object, component, imagined feature or an absence of evidence as a match.';

export const PICTURE_BOOK_SPATIAL_STAGING = `Use one coherent view of the drawn instant. If an opening reveals an existing object in an adjacent space, position its one visible instance within the sightline and connect it to its own surroundings. Keep the framing around the opening simple and avoid a second copy or a separate overview above the scene.
Trace every required separate route with its own boundaries and surface. For liquids that have not yet joined, leave a visible continuous bank or strip of ground between the flows. Carry the divider through their closest point and around bends. Use visible connections only at the source-specified place and moment. Give small props room to read: for an object partly inside a pocket or container, show only the specified exposed end and place the rest behind its opening.`;

/** Prospective composition only; scene facts and state come from the verified frame. */
export const PICTURE_BOOK_READABLE_INSTANT = `One readable scene at the exact story instant. Prioritize the child's choice, gaze and physical cause and effect. Show a proposed action through attention and readiness only. Keep limbs and tools away from the target and show no spray, trail, disturbance or other effect until the source says the action happens. Keep unaffected materials and colors in their current state. Show a blocked path in visibly separate supply, barrier and dry downstream sections when that is the written state. Trace distinct flows to the moment of joining. Focus the camera on the active region and simplify incidental background or secondary areas. Keep cast, anatomy, clothing, body size and canonical set design consistent. One scene, no split panel, labels or inset.`;

export const PICTURE_BOOK_DRAWING_DIRECTION = `PICTURE BOOK ART DIRECTION
Make the main action and its result easy to see at a glance. Place the child and companion so their gaze, gesture and points of contact tell the same story. Keep unrelated detail away from the action. Use silhouette, spacing, colour and texture to distinguish neighbouring parts. For a change in state, draw the specified moment and make the visible before/after boundary clear. Keep the same recognisable designs as the camera moves. Choose a natural angle and composition that make the required action readable.`;

export const PICTURE_BOOK_REVIEW_DIRECTION = `PICTURE BOOK REVIEW STANDARD
Judge whether a child can follow the action and recognise the characters and important places or objects at normal reading size. Record ordinary artistic variation as detail. This includes palette and texture variation, background decoration, approximate framing and natural changes in appearance from perspective, posture or partial overlap, provided the required design and action remain readable. Crops clarify evidence but small differences visible only when magnified rarely affect the story.
Reserve story, identity and continuity findings for material problems. Cite the exact requirement and the visible contradiction, or explain why a required cue cannot be read. Check whether a cause and its effect are both understandable at the depicted instant. A different camera angle or a softly drawn edge alone is detail. Preserve the existing safety, visible anatomy, child identity, scale evidence and topology checks. Record uncertainty about incidental presentation as detail and keep uncertainty about required action, identity or physical state actionable.`;

type SheetDesigns = ReturnType<typeof auditionSheetDesigns>;

/** Source-owned landmarks and page-zero attributes are the drawing inventory. The full design remains with the reviewer. */
export function pictureBookLocationPrompt(
  design: SheetDesigns['locations'],
  entityDesign: SheetDesigns['entities'],
  repairRequirements?: readonly string[],
) {
  const { locations, landmarks, props, referenceState } = design;
  const materialFunction = materialFunctionFromContext(design);
  const initialAttributes = referenceState.mutableAttributes.map(({ entityId, attribute, initialValue }) => ({
    entityId, attribute, initialValue,
  }));
  const excludedEntities = locationExclusionDescriptions(design, entityDesign).map(({ deferredDescriptions: _later, ...initial }) => initial);
  return `${STYLE_01_SHARED}
Draw exactly ${locations.length} distinct establishing views in the initial story state, one for each location ID: ${locations.map(l => l.id).join(', ')}. Label each view only with its exact short location ID. Show the owned landmarks once in their proper view, with their source-defined material, parts, count and placement. Treat mentions of excluded entities in location descriptions as placement cues. Use the approved character references for illustration style. Keep the surroundings free of live actors, excluded entities, their effects and later events.
Make the physical relationships legible. Give nearby or touching features separate outlines, textures or negative space so the viewer can tell where one ends and the next begins. Show what is above, below, inside, attached, open or blocked with visible spatial cues. For a blocked route, show the obstacle between its two sides, what stops against it, and the distinct route beyond it in its specified state. If a path is recessed, show its edges and floor in the terrain. Give adjacent raised or projecting structures their own silhouette and contact points. Use a view that reveals the important relationship, with a simple background and room around it.
${repairRequirements?.length ? `The first reference is the image to edit. Preserve its readable layout, labels, unaffected landmarks and watercolor style. Correct these requirements using the initial design data below: ${repairRequirements.join(', ')}. Make the corrected relationship easy to read without explanatory text. The other references establish style only.\n` : ''}
INITIAL DRAWING DATA: ${canonicalJson({ locations, landmarks, props, initialAttributes, stableAttachments: referenceState.stableAttachments,
    ...(materialFunction ? { materialFunction } : {}) })}
EXCLUSIONS FOR RECOGNITION ONLY: ${canonicalJson(excludedEntities)}`;
}

/** Convert known review targets into drawing obligations from the original scoped design. */
export function pictureBookLocationCorrection(
  design: SheetDesigns['locations'],
  entityDesign: SheetDesigns['entities'],
  requirements: readonly string[],
  placements: readonly { entityId: string; relation: string; targetId: string }[],
) {
  const ids = [...new Set(requirements)];
  const exclusions = locationExclusionDescriptions(design, entityDesign);
  const lines = ids.map(id => {
    if (id === 'sheet_scope') {
      return `Clear entity-owned content from both views. Remove these excluded designs wherever they appear: ${exclusions.map(e => e.entityId).join(', ')}. Keep their existing surrounding terrain and empty space. Clear any revealed event, track or effect that is absent from the initial design.`;
    }
    const [kind, name] = id.split(':');
    const location = design.locations.find(row => row.id === name);
    if (kind === 'design' && location) {
      return `In ${location.id}, restore the missing fixed spatial cues in this location description: ${location.design} When the design calls for a view through an opening, show the prescribed visible feature inside the opening in its initial form. Use the same existing feature seen through the opening.`;
    }
    const landmark = design.landmarks.find(row => row.id === name);
    if (kind === 'landmark_unique' && landmark) {
      const bases = placements.filter(row => row.entityId === name &&
        (row.relation === 'at' || row.relation === 'inside') && design.locations.some(l => l.id === row.targetId));
      const base = bases[0]?.targetId;
      const label = landmark.id.replace(/_/g, ' ');
      const connector = new RegExp(`\\breached (?:by|via) the ${label}\\b`, 'i');
      const views = design.locations.filter(row => base && row.id !== base && connector.test(row.design));
      const keep = views.length === 1 ? views[0].id : base;
      return `Show one readable main depiction of ${landmark.id}${keep ? ` in ${keep}` : ''}. Remove other full depictions from the other tiles. Preserve a source-required opening or endpoint as a small partial view of this same connected feature.`;
    }
    return `Correct ${id} against the fixed drawing data. Preserve all other designs.`;
  });
  return 'FOCUSED SHEET EDIT\n' + lines.join('\n') +
    '\nKeep the watercolor rendering and every readable spatial relationship already present, including the supply, obstruction, and continuation where specified. Keep the view count and labels. Repaint only what these instructions require.';
}
