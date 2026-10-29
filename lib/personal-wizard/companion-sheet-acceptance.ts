/**
 * The pure owner-acceptance rule of a companion sheet view (CSR-2, 2026-10-29), shared by the writer (scripts/personal-companion-sheets.ts)
 * and the reader (companion-identity.ts) so they cannot disagree. No I/O, no server-only import: hashing the bytes stays with each caller.
 *
 * An owner may accept a view the sheet review held ONLY on its angle: the verdict is "hold", correctAngle is false and every other check is
 * true. The front is never owner-accepted (it is the drawing reference and must pass its review).
 */
export const OWNER_ANGLE_ONLY = 'owner_angle_only' as const;
/** The eight checks of a sheet review verdict, in the review's order. */
export const SHEET_REVIEW_CHECKS = ['correctAngle', 'sameCharacterAsFront', 'anatomyConsistent', 'accessoryConsistent', 'paletteConsistent',
  'styleMatchesFront', 'isolatedOnPlainBackground', 'noTextNoExtraFigures'] as const;
type Verdict = { verdict?: unknown } & Partial<Record<typeof SHEET_REVIEW_CHECKS[number], unknown>>;

/** The one hold an owner may accept. An inconsistent answer (a "pass" with a false check) is not one, nor is any other false check. */
export const angleOnlyHold = (v: Verdict) =>
  v.verdict === 'hold' && v.correctAngle === false && SHEET_REVIEW_CHECKS.every(c => c === 'correctAngle' || v[c] === true);

const isSha = (x: unknown): x is string => typeof x === 'string' && /^[0-9a-f]{64}$/.test(x);

/**
 * Whether a published manifest entry carries the COMPLETE owner-acceptance record the writer emits, for this view:
 * qaStatus owner_accepted; acceptance { kind owner_angle_only, ownerAcceptanceSha256 }; the image's sha256; and review { outcomeSha256,
 * verdict } where the verdict names this view and is an angle-only hold. Never for the front. The caller still binds sha256 to the bytes.
 */
export function ownerAngleAcceptanceRecorded(view: string, entry: unknown): entry is { sha256: string } {
  if (view === 'front' || !entry || typeof entry !== 'object') return false;
  const e = entry as { qaStatus?: unknown; sha256?: unknown; acceptance?: { kind?: unknown; ownerAcceptanceSha256?: unknown };
    review?: { outcomeSha256?: unknown; verdict?: Verdict & { view?: unknown } } };
  return e.qaStatus === 'owner_accepted' && isSha(e.sha256) && e.acceptance?.kind === OWNER_ANGLE_ONLY && isSha(e.acceptance.ownerAcceptanceSha256) &&
    isSha(e.review?.outcomeSha256) && !!e.review?.verdict && e.review.verdict.view === view && angleOnlyHold(e.review.verdict);
}
