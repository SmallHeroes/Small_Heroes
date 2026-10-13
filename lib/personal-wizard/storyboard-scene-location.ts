/**
 * Opt-in scene-location contract: the planner's instructions state the rule the book-sequence compiler already enforces
 * (lib/local-book-sequence.ts: a page keeps the previous page's scene visit only at the same planned location; any new scene visit needs
 * same-page source evidence). It adds NO schema field and NO compiler check, only the instruction, and like the other contracts it is bound
 * into the source and the compiled book only when enabled: without it every existing source, book, digest, instruction and packet stays
 * byte-identical.
 */
export const SCENE_LOCATION_CONTRACT_VERSION = 'storyboard-scene-location/v1' as const;

export const SCENE_LOCATION_STORYBOARD_ADDENDUM = `SCENE VISITS FOLLOW PLANNED LOCATIONS (active): on every body page after page 1, keep the previous page's
scene visit ID ONLY when this page's planned locationId is the same as the previous page's. Whenever the planned locationId changes, start a new
scene visit ID and give sceneChangeEvidence: an exact excerpt of THIS page's text that moves the story to the new place. A page that only shows
another place through a window, a door, a hole or any opening still belongs to its own planned location; the scene visit of that other place
begins on the page where the story arrives there. Page 1's scene visit ID belongs to page 1's own planned location.`;
