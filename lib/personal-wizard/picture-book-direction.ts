import { canonicalJson } from './request-acceptance';
import { STYLE_01_SHARED } from '../style01-prompt-core';
import { locationExclusionDescriptions } from './location-sheet-projection';
import { materialFunctionFromContext } from './storyboard-material-function';
import type { auditionSheetDesigns } from './simple-book-reviewed-audition';

export const PICTURE_BOOK_REVIEW = 'picture-book-materiality/v1' as const;

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
