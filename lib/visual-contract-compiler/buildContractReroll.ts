/**
 * Feedback-aware reroll suppression — the difference between a BLIND re-render and one that actually
 * fixes what the gate caught.
 *
 * Given the vision observation + verdict from the attempt that just FAILED, build a forceful
 * correction addendum that NAMES the specific stray entity / wrong location / missing prop / wardrobe
 * drift and demands it be fixed — with escalating emphasis per attempt. The renderer leads the next
 * attempt's prompt with this block (and may also push the named strays into the negative prompt).
 *
 * Why this matters: gpt-image at LOW is stubborn with its "default pet" (the recurring armadillo) — a
 * blind re-render of the same prompt reproduces it. Feeding the caught "armadillo" back as an explicit,
 * escalating suppression is what turns detect → reroll → CLEAN (vs. detect → reroll → same stray).
 *
 * Pure string assembly — no I/O — so it is unit-testable without a live model.
 */
import type { BookVisualContract } from './types';
import type { ResolvedPageContract } from './derivePageVisualContracts';
import type { PageVisionObservation, ContractQaVerdict } from './pageVisualContractQa';

export interface ContractRerollInput {
  /** The vision observation from the attempt that just failed. */
  observation: PageVisionObservation;
  /** The gate verdict for that attempt (failures drive the correction lines). */
  verdict: ContractQaVerdict;
  /** The page contract (or cover-as-page). */
  page: ResolvedPageContract;
  contract: BookVisualContract;
  /** 0-based index of the attempt that just failed (0 = first render). Drives escalation. */
  attempt: number;
}

/** The specific strays the vision model reported (deduped, trimmed) — also useful for the negative prompt. */
export function caughtStrayEntities(observation: PageVisionObservation): string[] {
  return Array.from(
    new Set((observation.forbiddenEntitiesPresent ?? []).map((s) => s.trim()).filter(Boolean))
  );
}

/**
 * Build the correction addendum for the NEXT attempt. Returns '' when the verdict has no actionable
 * failures (caller then renders without a correction — e.g. a first attempt or a non-contract failure).
 */
export function buildContractRerollSuppression(input: ContractRerollInput): string {
  const { observation, verdict, page, contract, attempt } = input;
  if (verdict.pass || verdict.failures.length === 0) return '';

  const companionName = contract.cast.companion?.name;
  const onlyAllowed = `ONLY the child${companionName ? ` and ${companionName} (the panda companion)` : ' and the declared companion'}`;
  // Escalate forcefulness with each failed attempt.
  const emph = attempt >= 1 ? 'CRITICAL — ' : '';
  const lines: string[] = [
    '=== REROLL CORRECTION — the previous attempt FAILED the visual contract. Fix EXACTLY these and change NOTHING else. ===',
  ];

  const strays = caughtStrayEntities(observation);
  if (verdict.failures.some((f) => f.check === 'forbidden_entity') && strays.length > 0) {
    const list = strays.join(', ');
    lines.push(
      `${emph}The previous image WRONGLY contained: ${list}. This is STRICTLY FORBIDDEN. ` +
        `Do NOT draw ${list}. Do NOT draw ANY extra animal, creature, or pet of any kind. ` +
        `${onlyAllowed} may appear as living characters. Remove ${list} entirely — leave that area empty or with inanimate furniture/decor only.`
    );
    if (attempt >= 1) {
      lines.push(
        `This is attempt ${attempt + 2}. The ${list} MUST be completely gone now — no background animal, no second creature, no pet anywhere in the frame.`
      );
    }
  }

  if (verdict.failures.some((f) => f.check === 'wrong_location')) {
    const loc = contract.locations.find((l) => l.id === page.locationId);
    lines.push(
      `${emph}The setting was WRONG. The scene MUST take place in: ${loc?.name ?? page.locationId}` +
        `${loc?.description ? ` (${loc.description})` : ''}. Do NOT invent a different place.`
    );
  }

  const missing = observation.missingMajorProps ?? [];
  if (verdict.failures.some((f) => f.check === 'missing_major_prop') && missing.length > 0) {
    lines.push(`${emph}These required elements were MISSING and MUST be clearly visible: ${missing.join(', ')}.`);
  }

  if (verdict.failures.some((f) => f.check === 'companion_wardrobe_drift')) {
    lines.push(
      `${emph}${companionName ?? 'The companion'}'s outfit was WRONG. It MUST be exactly: ${page.companionWardrobeLock ?? 'the locked outfit'}.`
    );
  }

  if (verdict.failures.some((f) => f.check === 'cover_world_mismatch')) {
    lines.push(
      `${emph}The cover world/time-of-day was WRONG. It MUST match the story: ${contract.coverContract.worldType}` +
        `${contract.coverContract.timeOfDay ? `, ${contract.coverContract.timeOfDay}` : ''}.`
    );
  }

  // companion_scale — gross size violation. Feed the canonical band back (the brief's "previous
  // companion was ~child-sized; redraw within canonical band").
  const scaleFail = verdict.failures.find((f) => f.check === 'companion_scale');
  if (scaleFail) {
    const sc = contract.cast.companion?.scaleContract;
    lines.push(
      `${emph}The companion was the WRONG SIZE relative to the child (${scaleFail.detail}). ` +
        (sc
          ? `Redraw the companion as ${sc.humanLandmark} — about ${Math.round(sc.ratioToChild * 100)}% of the child's height; ${sc.prohibitions.join('; ')}.`
          : 'Redraw the companion clearly smaller than the child, within its canonical size band.')
    );
  }

  // Only a header means no actionable contract failure (e.g. a verdict with an unknown check) — render clean.
  return lines.length > 1 ? lines.join('\n') : '';
}
