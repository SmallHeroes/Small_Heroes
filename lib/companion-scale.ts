/**
 * Canonical companion SIZE-vs-child contracts — the primary lever for the scale dimension.
 *
 * Why this and not the companion reference: the style01 companion sheets are ISOLATED figures (no
 * child in frame), so they lock identity/internal proportions but carry NO relative-size signal. And
 * reroll alone won't converge scale (same failure mode as the stray armadillo). So canonical, general
 * per-companion scale data + authoritative composition wording is the lever; the vision gate is only a
 * code-computed safety net.
 *
 * General per companion (NEVER per-story) — the same mechanism serves all MVP companions. The 6 MVP
 * companions come from backend/config/mvp-story-matrix.ts (fox_uri, panda_anat, bunny_ometz,
 * dragon_dini, chameleon_koko, lion_shaket). Ratios are companion-height ÷ child-height with both
 * standing on the same ground (child ≈ 5–6yo). Bands are deliberately wide enough that only a GROSS
 * violation (child-sized+, giant, or toy-tiny) fails the code-computed gate.
 */
import type { CompanionScaleContract } from '@/lib/visual-contract-compiler/types';

const COMMON_PROHIBITIONS = [
  'never drawn as tall as or taller than the child',
  'never giant or human-adult-sized',
  'never shrunk to a tiny palm-sized toy or figurine — always a living animal companion',
];

/** Canonical scale per MVP companion id. Absent id → no scale lock (legacy behavior). */
export const COMPANION_SCALE_CONTRACTS: Record<string, CompanionScaleContract> = {
  // SOCIAL — a small panda cub: clearly shorter than the child, chest-high.
  panda_anat: {
    ratioToChild: 0.6,
    ratioBand: [0.5, 0.72],
    humanLandmark: "a small panda cub whose head reaches about the child's chest — clearly shorter than the child",
    prohibitions: COMMON_PROHIBITIONS,
  },
  // MEDICAL — a small bunny: knee-to-thigh height.
  bunny_ometz: {
    ratioToChild: 0.35,
    ratioBand: [0.25, 0.45],
    humanLandmark: "a small bunny standing about knee-to-thigh height on the child",
    prohibitions: COMMON_PROHIBITIONS,
  },
  // NEW_SIBLING — a young dragon at large-dog scale: reaches the child's waist/hip.
  dragon_dini: {
    ratioToChild: 0.5,
    ratioBand: [0.4, 0.62],
    humanLandmark: "a young dragon the size of a large dog, reaching about the child's waist/hip",
    prohibitions: COMMON_PROHIBITIONS,
  },
  // NIGHT_FEAR — a small fox: reaches about the child's hip.
  fox_uri: {
    ratioToChild: 0.45,
    ratioBand: [0.35, 0.55],
    humanLandmark: "a small fox reaching about the child's hip — a small animal companion, not a person",
    prohibitions: COMMON_PROHIBITIONS,
  },
  // TRANSITION — a small chameleon: lap/shoulder sized.
  chameleon_koko: {
    ratioToChild: 0.28,
    ratioBand: [0.16, 0.4],
    humanLandmark: "a small chameleon, small enough to perch on the child's shoulder or be cradled in two hands",
    prohibitions: [
      'never as large as a child, person, or dog',
      'never giant',
      'a living chameleon, not a static toy or ornament',
    ],
  },
  // ANGER — a lion cub: reaches about the child's waist.
  lion_shaket: {
    ratioToChild: 0.5,
    ratioBand: [0.4, 0.6],
    humanLandmark: "a lion CUB reaching about the child's waist — a cub, never a full-grown lion",
    prohibitions: [
      'never drawn as tall as or taller than the child',
      'never a full-grown adult lion',
      'never giant or human-sized',
    ],
  },
};

/** The canonical scale contract for a companion id (null when none — non-MVP or no companion). */
export function getCompanionScaleContract(companionId?: string | null): CompanionScaleContract | null {
  const id = (companionId ?? '').trim();
  return id && COMPANION_SCALE_CONTRACTS[id] ? COMPANION_SCALE_CONTRACTS[id] : null;
}

/** Authoritative one-block prompt line for a scale contract (used by the contract block + the cover). */
export function buildCompanionScalePromptLine(sc: CompanionScaleContract): string {
  const pct = Math.round(sc.ratioToChild * 100);
  return (
    `COMPANION SIZE vs CHILD (locked, authoritative): the companion is ${sc.humanLandmark}. ` +
    `When both stand on the same ground it is about ${pct}% of the child's height — ` +
    `${sc.prohibitions.join('; ')}.`
  );
}
