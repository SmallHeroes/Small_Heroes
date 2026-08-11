/**
 * Style 01 visual-polish prompt blocks (smoke #2 brief) — general rules, not story-specific patches.
 * Companion-specific PAGE EXPRESSION / scene-fidelity tables live here until the matrix catalog
 * owns per-story beat maps.
 */

/** Cover-only composition — separate from interior FRAMING RULE — BREATHE. */
export function buildStyle01CoverCompositionBlock(): string {
  return [
    'COVER COMPOSITION (cover-only — overrides general framing):',
    'Top 22–30% of frame: TITLE-SAFE BAND ONLY — soft scenery, sky, ceiling, or atmospheric wash. NO faces, NO heads, NO hands, NO focal characters in this band.',
    'Middle and bottom 70–78%: FULLY ILLUSTRATED scene — painted floor, furniture, characters, clinic/room detail. NO empty cream wash. NO fade-out band at the bottom.',
    'Characters and environment fully rendered through the bottom edge — this is a book cover, not a poster with a blank lower third.',
    'Focal characters in lower-mid frame with readable silhouettes; leave breathing room but paint the whole world edge-to-edge below the title band.',
  ].join('\n');
}

const BUNNY_PAGE_EXPRESSIONS: Record<number, string> = {
  1: 'curious and slightly nervous — heart pounding quietly, trying to stay calm',
  2: 'suppressed laughter — biting back a giggle, mouth barely holding a smile',
  6: 'small brave uncertainty during the exam — focused and quiet, NOT a broad smile',
  7: 'small brave uncertainty — quiet honesty about trembling hands, NOT a broad smile',
  8: 'relieved warm smile, quiet pride',
};

export type Style01PageExpressionKind =
  | 'subdued'
  | 'wary'
  | 'worried'
  | 'restrained_amusement'
  | 'surprised'
  | 'curious_uncertain'
  | 'joyful'
  | 'focused'
  | 'attentive_neutral';

const PAGE_EXPRESSION_DIRECTIVES: Record<Style01PageExpressionKind, string> = {
  subdued:
    'subdued and inward — relaxed closed mouth, softened gaze, slightly lowered brows; quiet hurt is readable without tears or a smile',
  wary:
    'wary and slightly crowded — closed mouth, alert sideways gaze, small brow tension; NOT cheerful and NOT frightened',
  worried:
    'worried — closed or barely parted mouth, knitted brows, concerned gaze; no smile',
  restrained_amusement:
    'surprised almost-smile — one restrained mouth corner and lifted brows, not a broad or open-mouth smile',
  surprised:
    'surprised — lifted brows and attentive eyes with a small naturally parted mouth, not a fixed grin',
  curious_uncertain:
    'curious and unsure — focused gaze, gently raised brows, relaxed closed mouth',
  joyful:
    'genuinely joyful — warm page-specific smile with natural eyes and cheeks, never a copied photo pose or mascot grin',
  focused:
    'focused — intent gaze, neutral relaxed mouth, subtle brow concentration',
  attentive_neutral:
    'attentive neutral — relaxed closed mouth, natural gaze and brows; no default smile',
};

const SUBDUED_RE =
  /\b(crowded out|left out|lonely|dejected|downcast|disappointed|hurt feelings|quiet hush|withdrawn)\b/i;
const WARY_RE = /\b(too tight|hemmed in|trapped|crowded by|wary|guarded|uneasy)\b/i;
const WORRIED_EXPRESSION_RE =
  /\b(worried|anxious|nervous|afraid|frightened|fearful|concerned|distressed)\b/i;
const RESTRAINED_AMUSEMENT_RE =
  /\b(almost[- ]smile|suppressed (?:smile|laugh|laughter)|trying not to (?:smile|laugh)|restrained (?:smile|amusement)|amused)\b/i;
const SURPRISED_RE = /\b(surprised|startled|shocked|astonished|wide eyes)\b/i;
const CURIOUS_UNCERTAIN_RE =
  /\b(curious|unsure|uncertain|hesitant|peeks?|peering|looks? inside|observing|investigating)\b/i;
const JOYFUL_RE = /\b(joyful|delighted|happy|beaming|smiles? with relief|proud and gentle)\b/i;
const FOCUSED_RE = /\b(focused|concentrating|determined|intent)\b/i;

export function resolveStyle01PageExpressionKind(input: {
  narrativeSummary?: string | null;
  bookPageText?: string | null;
  imageDirection?: string | null;
}): Style01PageExpressionKind {
  const evidence = [input.narrativeSummary, input.bookPageText, input.imageDirection]
    .filter(Boolean)
    .join('\n');
  if (SUBDUED_RE.test(evidence)) return 'subdued';
  if (WARY_RE.test(evidence)) return 'wary';
  if (WORRIED_EXPRESSION_RE.test(evidence)) return 'worried';
  if (RESTRAINED_AMUSEMENT_RE.test(evidence)) return 'restrained_amusement';
  if (SURPRISED_RE.test(evidence)) return 'surprised';
  if (CURIOUS_UNCERTAIN_RE.test(evidence)) return 'curious_uncertain';
  if (JOYFUL_RE.test(evidence)) return 'joyful';
  if (FOCUSED_RE.test(evidence)) return 'focused';
  return 'attentive_neutral';
}

export function buildPageExpressionLock(input: {
  pageNumber: number;
  companionId?: string | null;
  childPresence?: string;
  narrativeSummary?: string | null;
  bookPageText?: string | null;
  imageDirection?: string | null;
}): string {
  if (input.childPresence && !['present', 'partial', 'background'].includes(input.childPresence)) {
    return '';
  }
  if (input.companionId === 'bunny_ometz') {
    const expr = BUNNY_PAGE_EXPRESSIONS[input.pageNumber];
    if (expr) {
      return `PAGE EXPRESSION: ${expr}. Override the default hopeful mood for THIS page only.`;
    }
  }
  const hasPageEvidence = Boolean(
    input.narrativeSummary?.trim() ||
      input.bookPageText?.trim() ||
      input.imageDirection?.trim()
  );
  if (!hasPageEvidence) return '';
  const kind = resolveStyle01PageExpressionKind(input);
  return [
    `PAGE EXPRESSION [${kind}]: ${PAGE_EXPRESSION_DIRECTIVES[kind]}.`,
    'This page expression overrides the child-photo expression. Preserve identity, but do NOT copy the photographed smile, open mouth, or gaze.',
  ].join('\n');
}

export function buildSmallFrameChildFidelityLock(input: {
  cameraShot?: string | null;
  childCastId: string;
  placements: Array<{
    subject: { kind: string; castId?: string };
    region: { width: number; height: number };
  }>;
}): string {
  const placement = input.placements.find(
    (entry) =>
      entry.subject.kind === 'cast' && entry.subject.castId === input.childCastId
  );
  if (!placement) return '';
  const smallInFrame =
    placement.region.height <= 300 ||
    placement.region.width <= 300 ||
    ['wide', 'tracking'].includes(input.cameraShot ?? '');
  if (!smallInFrame) return '';
  return [
    'SMALL-IN-FRAME CHILD FIDELITY (within the approved Blueprint region):',
    'Render the same recognisable human child with the photo\'s stable facial morphology, curl silhouette, age, and natural head-to-body ratio even at this scale.',
    'Keep ordinary-size human eyes, visible eyelids, a developed nose and mouth, articulated limbs, and semi-naturalistic watercolor modelling.',
    'Do NOT simplify the child into chibi, mascot, doll, or companion-like anatomy, and do NOT inherit facial proportions from a creature reference.',
    'Improve readable identity detail only inside the approved placement; do not move, enlarge beyond, crop, or replan the Blueprint region.',
  ].join('\n');
}

const INTERACTION_RE =
  /\b(nurse|doctor|thermometer|examining|examination|handing|showing|lean(?:s|ing)?\s+in|opens?\s+the\s+door|מדחום|אחות|בודק)/i;

/** Mutual gaze / staged interaction — scenes, not posters. */
export function buildMutualGazeInteractionLock(input: {
  bookPageText?: string | null;
  imageDirection?: string | null;
  childPresence?: string;
}): string {
  const hay = [input.bookPageText, input.imageDirection].filter(Boolean).join(' ');
  if (!INTERACTION_RE.test(hay)) return '';
  if (input.childPresence !== 'present' && input.childPresence !== 'partial') return '';

  return [
    'SCENE INTERACTION / GAZE (not a poster):',
    'When characters interact (handing, showing, examining, talking): the child looks at the nurse/thermometer/object of action — NOT at the camera.',
    'The nurse looks at the child or the object of action — NOT at the camera.',
    'Hands and gaze point toward the object of action. This is a story scene, not a posed portrait.',
  ].join('\n');
}

const BUNNY_P1_SCENE_FIDELITY =
  'PAGE SCENE FIDELITY (prose wins over decorative imageDirection): Bunny is INSIDE the clinic room, on the exam table or beside the child. His ears spring upward as the nurse opens the door. Do NOT hide Bunny behind the door. Do NOT place him outside the room.';

/** When page prose contradicts a decorative imageDirection, prose location wins. */
export function resolvePageSceneFidelityAddendum(input: {
  companionId?: string | null;
  pageNumber: number;
}): string {
  if (input.companionId === 'bunny_ometz' && input.pageNumber === 1) {
    return BUNNY_P1_SCENE_FIDELITY;
  }
  return '';
}

/** Always-on — comic motion must not detach body parts (ears, tails, limbs). */
export function buildStyle01AnatomyIntegrityLock(): string {
  return [
    'ANATOMY INTEGRITY (always):',
    'All body parts stay ATTACHED — ears, tails, limbs never detach or float.',
    'Comic exaggeration is expressed through posture, stretch, and motion lines — NEVER through detachment.',
    'HUMAN CHILDREN: use observational semi-naturalistic drawing with believable age-appropriate anatomy — ordinary-size eyes with visible eyelids, a developed nose bridge and mouth, a credible head-to-body ratio, articulated fingers, ordinary feet, and natural joints.',
    'Keep the child clearly hand-painted in watercolor, but never chibi, bobble-headed, anime-eyed, shortened into a doll face, plastic-doll-like, mascot-like, or toy-proportioned.',
  ].join('\n');
}

const MENTIONED_CHARACTER_ACTING_RE =
  /(?:מרימה|מחייכת|אומרת|צועקת|מתקרבת|נכנסת|speaks?|smiling|shouting|raising|leaning|opens?|examining|handing)/i;

const NURSE_MENTION_RE = /(?:nurse|אחות)/i;
const DOCTOR_MENTION_RE = /(?:doctor|רופא|דוקטור)/i;
const MIRROR_MENTION_RE = /(?:mirror|מראה)/i;

/**
 * Characters named in page prose as acting/reacting must appear (background OK).
 */
export function buildMentionedCharacterPresenceLock(
  bookPageText?: string | null
): string {
  const text = (bookPageText ?? '').trim();
  if (!text) return '';

  const lines: string[] = [];
  if (NURSE_MENTION_RE.test(text) && MENTIONED_CHARACTER_ACTING_RE.test(text)) {
    lines.push(
      'Nurse (אחות): MUST appear in the illustration — background presence is fine. Show the action the text describes (e.g. raising eyes, quiet smile, speaking).'
    );
  }
  if (DOCTOR_MENTION_RE.test(text) && MENTIONED_CHARACTER_ACTING_RE.test(text)) {
    lines.push(
      'Doctor: MUST appear in the illustration — background presence is fine when the text describes them acting.'
    );
  }
  if (lines.length === 0) return '';

  return [
    'MENTIONED-CHARACTER PRESENCE:',
    ...lines,
    'Any character the page text describes as acting/reacting (speaking, smiling, raising eyes) MUST appear — background is fine; absence is not.',
  ].join('\n');
}

/** Mirror scenes: physical character + reflection, matched pose. */
export function buildReflectionRuleLock(input: {
  bookPageText?: string | null;
  imageDirection?: string | null;
}): string {
  const hay = [input.bookPageText, input.imageDirection].filter(Boolean).join(' ');
  if (!MIRROR_MENTION_RE.test(hay)) return '';

  return [
    'REFLECTION RULE (mirror scenes):',
    'When a mirror shows a character\'s reflection, the physical character must also be visible in the scene — NOT only inside the mirror.',
    'Reflection matches pose: show both the real bodies in front of the mirror AND their reflections.',
  ].join('\n');
}

export function buildCompanionSizeVsChildLock(input: {
  childPresence?: string;
  companionPresence?: string;
}): string {
  if (
    input.childPresence === 'present' &&
    (input.companionPresence === 'present' || input.companionPresence === 'partial')
  ) {
    return 'COMPANION SIZE vs CHILD: keep the exact registry size relation on every page.';
  }
  return '';
}

export function buildStyle01CoverSceneDescription(input: {
  storyTitle?: string | null;
  coverText?: string | null;
  topicLabel?: string | null;
  coverSceneHint?: string | null;
}): string {
  const parts = [
    input.coverSceneHint?.trim(),
    input.storyTitle?.trim() ? `Book cover scene: ${input.storyTitle.trim()}.` : '',
    input.coverText?.trim() ? `Story hook: ${input.coverText.trim()}.` : '',
    input.topicLabel?.trim() ? `Topic: ${input.topicLabel.trim()}.` : '',
    'Opening moment of the story. Warm, inviting, emotionally readable.',
  ].filter(Boolean);
  return parts.join(' ');
}
