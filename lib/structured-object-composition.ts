/**
 * Global composition safety for structured furniture/objects (all books, all styles).
 */

export const STRUCTURED_OBJECT_TERMS = [
  'crib',
  'bed',
  'chair',
  'table',
  'stroller',
  'cabinet',
  'door',
  'window',
  'blanket',
  'mattress',
  'basket',
  'box',
  'vehicle',
  'car',
  'wheelchair',
  'highchair',
  'high chair',
  'couch',
  'sofa',
  'desk',
  'shelf',
  'drawer',
  'rail',
  'bars',
  'handle',
  'wagon',
  'cart',
  'bathtub',
  'tub',
  'stairs',
  'step',
  'ladder',
  'fence',
  'gate',
  'swaddle',
  'pillow fort',
  'fortress',
  'עריסה',
  'מיטה',
  'שמיכה',
  'מזרן',
  'cot',
  'bassinet',
  'playpen',
  'play pen',
  'bassinette',
] as const;

/** Crib, cot, bassinet, playpen, or railed bed — needs closed-rail geometry rules. */
export const RAILED_BED_TERMS = [
  'crib',
  'cot',
  'bassinet',
  'playpen',
  'play pen',
  'bassinette',
  'crib rail',
  'baby bed',
  'עריסה',
  'מיטת תינוק',
] as const;

export const CLOSED_CRIB_BED_GEOMETRY_BLOCK = `CLOSED CRIB / RAILED BED GEOMETRY (global — all stories with crib, cot, bassinet, playpen, or railed bed):
1. The crib/bed is a CLOSED rectangular object with FOUR continuous sides (front, back, left, right). The near/front rail must NOT disappear, drop away, or open.
2. Rails stay visually coherent and connected — no drop-side gap, no broken fence, no missing front rail.
3. NO character passes THROUGH a rail. The child protagonist stays OUTSIDE the crib; hands reach OVER the top rail from above, never through bars or an open front.
4. NO blanket, body, mattress, or pillow breaks or intersects rail geometry.
5. Baby/person inside lies ON the mattress; blanket sits inside, over the baby — contained within the rails.
6. To show the baby WITH a closed near rail: use a slightly ELEVATED 3/4 side view — baby visible looking down OVER the top of the near rail. NEVER remove the front rail to show the baby.`;

export const CLOSED_CRIB_BED_STRICT_RETRY_BLOCK = `REGENERATION — CLOSED CRIB (mandatory):
Child STANDS beside the closed crib (safest). Child leans gently over the TOP rail only — both hands on blanket from ABOVE; arms/body do NOT enter the crib volume. Crib in 3/4 side view: all four rails continuous; near rail fully visible; baby visible over the top rail; yellow blanket tucked inside. Parents behind, looking at child and baby.`;

export const CLOSED_CRIB_HARD_NEGATIVES = `FORBIDDEN (crib/cot/bassinet pages):
open or missing near/front crib rail; drop-side gap; child arms/hands/body passing through bars or open front; blanket or fabric breaking through slats; three-sided crib fence; child reaching into crib interior below the top rail.`;

export const STRUCTURED_OBJECT_COMPOSITION_BLOCK = `STRUCTURED OBJECT / FURNITURE COMPOSITION (global — all books):
When this page includes furniture or structured objects (crib, bed, chair, table, stroller, cabinet, door, window, blanket-over-body, basket, box, vehicle, wheelchair, highchair, rails/bars/handles/layers):
PREFER: simple side or 3/4 view; readable object silhouette; physically clear relationships between rails, mattress, blanket, and body; simple perspective; clear separation between character, object, blanket, and mattress.
AVOID: dramatic top-down angles; complex tilted perspective; impossible rail/bar geometry; blankets or limbs passing through solid parts; unclear object interiors; furniture collapsing into the character.`;

export const STRUCTURED_OBJECT_STRICT_RETRY_BLOCK = `REGENERATION — STRUCTURED OBJECT GEOMETRY (stricter):
Simplify the scene: side or 3/4 view only; reduce perspective tilt; rails must form a coherent closed rectangle; blanket rests ON mattress and body — never through rails; baby/person clearly inside/on the object; parents look at the emotional subject.`;

export const EMOTIONAL_CLOSING_STAGING_BLOCK = `EMOTIONAL CLOSING STAGING (when this page is a warm final/home resolution beat):
Parents or important secondary characters must look AT the child and/or baby/subject — not at empty space or the camera.
Scene must read warm, gentle closure. Child anatomy: natural head/neck alignment; no twisted neck.`;

const EMOTIONAL_CLOSING_RE =
  /\b(final|closing|wraps? the|tucking|tender|goodnight|kingdom transformed|calms?|נאנח|שמיכה|סיום)\b/i;

export function detectStructuredObjectsInText(...texts: Array<string | null | undefined>): string[] {
  const hay = texts.filter(Boolean).join(' ').toLowerCase();
  const hits = new Set<string>();
  for (const term of STRUCTURED_OBJECT_TERMS) {
    if (hay.includes(term.toLowerCase())) hits.add(term);
  }
  return [...hits];
}

export function sceneHasStructuredObjects(input: {
  imagePrompt?: string | null;
  bookPageText?: string | null;
  rawScenePrompt?: string | null;
  staging?: string | null;
}): boolean {
  return detectStructuredObjectsInText(
    input.imagePrompt,
    input.bookPageText,
    input.rawScenePrompt,
    input.staging
  ).length > 0;
}

/** Word-boundary crib/cot/bassinet/playpen only — NOT generic bed/bedroom/furniture. */
const EXPLICIT_CRIB_PATTERNS = [
  /\bcrib\b/i,
  /\bcot\b/i,
  /\bbassinet(?:te)?\b/i,
  /\bplaypen\b/i,
  /\bplay pen\b/i,
  /\bcrib rail/i,
  /\bbaby bed\b/i,
  /(?:^|[^\w])עריסה(?:$|[^\w])/u,
  /מיטת תינוק/u,
] as const;

export function sceneHasRailedBedOrCrib(input: {
  imagePrompt?: string | null;
  bookPageText?: string | null;
  rawScenePrompt?: string | null;
  staging?: string | null;
}): boolean {
  const hay = [input.imagePrompt, input.bookPageText, input.rawScenePrompt, input.staging]
    .filter(Boolean)
    .join(' ');
  return EXPLICIT_CRIB_PATTERNS.some((re) => re.test(hay));
}

export function isEmotionalClosingBeat(input: {
  pageNumber: number;
  totalPages?: number;
  pagePurpose?: string;
  imagePrompt?: string | null;
  bookPageText?: string | null;
  staging?: string | null;
}): boolean {
  if (input.totalPages && input.pageNumber === input.totalPages) return true;
  const hay = [input.pagePurpose, input.imagePrompt, input.bookPageText, input.staging]
    .filter(Boolean)
    .join(' ');
  return EMOTIONAL_CLOSING_RE.test(hay) || /FINAL\b/i.test(hay);
}

export function buildStructuredObjectCompositionAddendum(input: {
  imagePrompt?: string | null;
  bookPageText?: string | null;
  rawScenePrompt?: string | null;
  staging?: string | null;
  pageNumber?: number;
  totalPages?: number;
  pagePurpose?: string;
  strictRetry?: boolean;
}): string {
  if (!sceneHasStructuredObjects(input)) return '';
  const hasRailedBed = sceneHasRailedBedOrCrib(input);
  const parts = [STRUCTURED_OBJECT_COMPOSITION_BLOCK];
  if (hasRailedBed) {
    parts.push(CLOSED_CRIB_BED_GEOMETRY_BLOCK);
    parts.push(CLOSED_CRIB_HARD_NEGATIVES);
  }
  if (input.strictRetry) {
    parts.push(STRUCTURED_OBJECT_STRICT_RETRY_BLOCK);
    if (hasRailedBed) parts.push(CLOSED_CRIB_BED_STRICT_RETRY_BLOCK);
  }
  if (
    isEmotionalClosingBeat({
      pageNumber: input.pageNumber ?? 0,
      totalPages: input.totalPages,
      pagePurpose: input.pagePurpose,
      imagePrompt: input.imagePrompt,
      bookPageText: input.bookPageText,
      staging: input.staging,
    })
  ) {
    parts.push(EMOTIONAL_CLOSING_STAGING_BLOCK);
  }
  return parts.join('\n\n');
}
