import 'server-only';
/**
 * Age calibration of the drawn child anchor made from a real photo (opt-in; the new engine only; production is unchanged).
 *
 * calibratedPhotoAnchorPrompt is PRODUCTION's own method-B anchor prompt (buildStage0MethodBPrompt) with exactly two substitutions, each
 * required to occur exactly once (a refusal, never a silent drift, if production's text changes):
 * - the age line (buildStage0AnchorAgeLockLine, calibrated by production for age 5 only) becomes a calibrated line for the child's age band:
 *   plain, non-cartoon proportion cues and two-sided bounds;
 * - the always-on "not a toddler" block (STAGE0_ANCHOR_ANTI_TODDLER) becomes age-aware: unchanged for ages 4-5, a toddler bound for 2-3
 *   (where it contradicted the age line), and an "AGE BOUNDS" line for 6-12.
 * Age 5 keeps production's own line and block, so its prompt is byte-identical to production's. Nothing here is specific to one child.
 */
import { buildStage0AnchorAgeLockLine, buildStage0MethodBPrompt, STAGE0_ANCHOR_ANTI_TODDLER } from '../generation-pipeline/stage0-method-b';

export const ANCHOR_AGE_CALIBRATION_VERSION = 'anchor-age-calibration/v1' as const;
export type AnchorGender = 'boy' | 'girl';
const BANDS = [
  { min: 2, max: 3, band: 'toddler-age', cues: 'a large head for the body, short limbs, full rounded cheeks and small soft features' },
  { min: 4, max: 4, band: 'preschool-age', cues: 'a still-large head for the body, soft rounded cheeks, a small nose and short childlike limbs' },
  { min: 6, max: 7, band: 'early school-age',
    cues: 'a head still large for the body, a round face with soft full cheeks, a small rounded nose and a short chin, and slim but still short childlike limbs' },
  { min: 8, max: 9, band: 'middle-childhood',
    cues: 'a slightly longer face than a 6-year-old, cheeks still soft and rounded, longer limbs, and none of the leaner preteen features' },
  { min: 10, max: 12, band: 'older-childhood', cues: 'a longer face and leaner cheeks than a younger child, yet clearly still a child, with no teenage features' },
] as const;
const fail = (code: string): never => { throw Object.assign(new Error(code), { code }); };

/** The calibrated age line and the age-aware bound for one child (ages 2-12). */
export function calibratedAnchorAgeLines(age: number, gender: AnchorGender): { ageLock: string; ageBounds: string } {
  if (!Number.isInteger(age) || age < 2 || age > 12 || (gender !== 'boy' && gender !== 'girl')) return fail('anchor_age_out_of_range');
  // Age 5: production's own calibrated line and its "not a toddler" block, unchanged.
  if (age === 5) return { ageLock: buildStage0AnchorAgeLockLine({ childAge: 5, childGender: gender }), ageBounds: STAGE0_ANCHOR_ANTI_TODDLER };
  const band = BANDS.find(b => age >= b.min && age <= b.max)!, subject = gender === 'boy' ? 'He' : 'She';
  const ageLock = `The child is a ${age}-year-old ${band.band} ${gender}: ${band.cues}. ${subject} must read as about ${age}: NOT ${age + 2} or older ` +
    `(no longer jaw, leaner cheeks or older proportions) and not younger than ${age - 1}.`;
  const ageBounds = age <= 3 ? `AGE BOUNDS (mandatory): a ${age}-year-old toddler, NOT a baby and NOT older than ${age + 1}.`
    : age === 4 ? STAGE0_ANCHOR_ANTI_TODDLER
      : `AGE BOUNDS (mandatory): this is a ${age}-year-old, NOT a ${age + 2}-${age + 3}-year-old and NOT a preschooler. ` +
        `Keep the soft, rounded ${age}-year-old face; never make the face look older than ${age}.`;
  return { ageLock, ageBounds };
}

/** Production's method-B anchor prompt for this child with its two age elements replaced; each must occur exactly once in production's text. */
export function calibratedPhotoAnchorPrompt(input: Omit<Parameters<typeof buildStage0MethodBPrompt>[0], 'order'> & { order: { childAge: number; childGender: AnchorGender } }) {
  const { ageLock, ageBounds } = calibratedAnchorAgeLines(input.order.childAge, input.order.childGender);
  const prompt = buildStage0MethodBPrompt(input), productionLine = buildStage0AnchorAgeLockLine(input.order);
  const once = (part: string) => prompt.split(part).length - 1 === 1;
  if (!once(productionLine) || !once(STAGE0_ANCHOR_ANTI_TODDLER)) return fail('anchor_age_production_drift');
  return prompt.replace(productionLine, () => ageLock).replace(STAGE0_ANCHOR_ANTI_TODDLER, () => ageBounds);
}
