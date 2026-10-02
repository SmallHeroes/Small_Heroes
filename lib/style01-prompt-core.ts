/** Pure prompt bytes shared by offline storyboard and production Style 01. */
export const STYLE_01_SHARED =
  "Style 01: soft hand-drawn children's storybook illustration on warm cream paper. Gentle transparent watercolor washes, delicate linework, luminous muted palette, cozy picture-book warmth. NOT cinematic Style 02. NOT dense ink-and-gouache. NOT photorealistic. NOT Pixar CGI.";

export const STYLE_01_RENDERING_CORRECTION =
  'RENDERING: soft watercolor storybook — visible paper texture, gentle pigment bleeds, observational semi-naturalistic human drawing, warm local color, airy negative space. Render the child with recognizably human facial proportions: ordinary-size eyes with visible eyelids, a developed nose bridge and mouth, a head proportionate to an age-appropriate body, and non-mascot hands and feet. Human emotion comes from subtle posture, gaze, brows, and mouth — never from enlarged eyes, a shortened doll face, or an oversized round head. Keep the result hand-painted rather than photographic. NOT harsh shadows. NOT global orange filter. NOT empty cream void background.';

export const STYLE_01_FRAMING_RULE = `FRAMING RULE — BREATHE:
- Medium-wide storybook scene; environment visible; child and companion mostly full-figure; no giant cropped faces or oversized foreground characters unless shotType=close_up explicitly.
- Characters fill NO MORE than 35-50% of frame height.
- Environment must occupy at least 50% of visible area.
- Avoid tight portrait crops. Avoid close-up faces unless explicitly specified as "close-up" shotType.
- For "wide" / "medium-wide" / "establishing" shots: characters should be in lower third or off-center, environment dominates.
- For "intimate" shots: still leave breathing room — show the surrounding environment described in THIS page's staging (never default to a cave or any fixed location); keep depth and scene context visible. NOT a portrait crop.
- FORBIDDEN: character filling frame, tight headshot, claustrophobic framing, no environmental context.`;

/** Sanctioned close_up / intimate pages — tight crop allowed; identity locks unchanged. */
export const STYLE_01_FRAMING_RULE_CLOSE_UP = `FRAMING RULE — BREATHE (close_up / intimate page):
- Tight crop allowed — child + companion hands/face/meaningful object share the frame.
- Intimacy over aggression: NO giant isolated face portrait; companion or story object should remain visible.
- Anatomy and identity locks unchanged (CHILD VISUAL LOCK, companion lock).
- Still enough context to read the story beat — not a blank void background.`;

/** When reference[0] is the per-order canonical child anchor (not the raw upload). */
export const STYLE_01_CANONICAL_CHILD_ANCHOR_RULE =
  'CANONICAL CHILD ANCHOR (reference[0]): IDENTITY + STYLE FIDELITY ONLY — face, hair, skin tone, age, gender, natural human anatomy, and the anchor\'s refined semi-naturalistic Style 01 treatment. ' +
  'Keep this exact level of human realism and watercolor detail at every character scale; never simplify the child into a mascot, chibi, flat cartoon, or generic picture-book child. ' +
  'Do NOT copy the anchor neutral standing pose, portrait framing, tight crop, or empty background. ' +
  'Each page MUST show this child performing the scene action with a natural, varied pose appropriate to the story beat. ' +
  'REJECT copying the anchor like a sticker into a new background.';

function childAgeBandLabel(age: number): string {
  if (age <= 3) return 'toddler';
  if (age <= 5) return 'preschool/kindergarten';
  if (age <= 8) return 'young school-age';
  return 'school-age';
}

function buildChildAgeLockLine(age: number): string {
  const band = childAgeBandLabel(age);
  if (age <= 3) {
    return `approximately ${age} years old (${band}). NOT a school-age child. NOT a teenager.`;
  }
  if (age <= 5) {
    return `approximately ${age} years old (${band}). Face and body must read as this age — NOT an older school-age child, NOT a teen, NOT a baby younger than ${age}.`;
  }
  if (age <= 8) {
    return `approximately ${age} years old (${band}). Face and body proportions must read as this age — NOT a teen, NOT a preschool toddler, NOT an adult shrunk down.`;
  }
  return `approximately ${age} years old (${band}). Proportions must read as this age — NOT a teen/adult, NOT a much younger child.`;
}

/** Structural child lock only — appearance comes from CHILD VISUAL LOCK (photo-derived). */
export function buildStyle01ChildAnatomicalLock(input?: {
  companionId?: string | null;
  childAge?: number;
  allowDistinctSupportingChildren?: boolean;
}): string {
  const age = Math.max(2, Math.min(12, input?.childAge ?? 5));
  const base = `CHILD ANATOMICAL LOCK (structural only — NO hair color, skin tone, eye color, or face-feature descriptors here; those come ONLY from CHILD VISUAL LOCK):
- Age: ${buildChildAgeLockLine(age)}
- Body proportions: child-appropriate build for age ${age}. Head-to-body ratio appropriate for this age. NOT an adult body shrunk down.
- Expression: gentle childlike expression vocabulary; SAME child every page.
- EXACTLY ONE child protagonist when a child is present — ${input?.allowDistinctSupportingChildren ? 'distinct supporting children required by the scene are allowed; NEVER two copies of the protagonist' : 'NEVER two children'}, NEVER a duplicate protagonist, NEVER a second copy of the same child in background/foreground.`;

  if (input?.companionId === 'dragon_dini') {
    return `${base}

CHILD CONSISTENCY OVER WARDROBE:
Bird-print pajamas are story-constant wardrobe only. Face, hair, skin, age, and proportions must match CHILD VISUAL LOCK on every page even when pajama details are partially hidden.`;
  }

  return `${base}

CHILD CONSISTENCY OVER WARDROBE:
Wardrobe is secondary. Age, face, hair, body, and skin must match CHILD VISUAL LOCK every page even when outfit details are partially hidden.`;
}
