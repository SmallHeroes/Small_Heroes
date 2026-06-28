/**
 * runPageContractGate — the single shared "render → gate → feedback-reroll" orchestrator for one page,
 * used by BOTH the live render path (generateAllPageImages) and the calibration harness (parity).
 *
 * Hard guarantees (the T15 acceptance criteria):
 *  - NO-LEAK: it returns ONLY an image that PASSED every gate check. On exhaustion it THROWS
 *    VisualContractQaBlockError (code VISUAL_CONTRACT_QA_BLOCK) and returns nothing — a failed image
 *    never escapes, so the caller can never promote it to results/DB/callbacks.
 *  - BOUNDED render calls: render() is invoked at most maxRerolls+1 times (attempt 0 + the rerolls) —
 *    the page's total renderer-call budget. The caller's render closure must do exactly ONE underlying
 *    render per call (no internal regen multiplication) so the cap holds.
 *  - FEEDBACK-AWARE reroll: each reroll receives the previous attempt's observation-derived suppression
 *    + caught strays for the negative prompt — never a blind re-render.
 *
 * Pure orchestration with injected render + vision, so it is fully unit-testable without a live model.
 */
import {
  buildContractVisionInstruction,
  interpretVisionJson,
  evaluatePageContractQa,
  buildContractRerollSuppression,
  caughtStrayEntities,
  type BookVisualContract,
  type ResolvedPageContract,
  type ContractQaVerdict,
} from '@/lib/visual-contract-compiler';

export class VisualContractQaBlockError extends Error {
  readonly code = 'VISUAL_CONTRACT_QA_BLOCK' as const;
  readonly isVisualContractQaBlock = true as const;
  /** The full per-attempt verdict trace (for the proof sink), not just the last one. */
  readonly verdicts: ContractQaVerdict[];
  constructor(
    readonly pageNumber: number,
    readonly attempts: number,
    readonly lastVerdict: ContractQaVerdict,
    verdicts?: ContractQaVerdict[]
  ) {
    super(
      `VISUAL_CONTRACT_QA_BLOCK: page ${pageNumber} failed the visual contract gate after ${attempts} attempt(s)` +
        `${lastVerdict.failures.length ? ` — ${lastVerdict.failures.map((f) => f.check).join(', ')}` : ''}`
    );
    this.name = 'VisualContractQaBlockError';
    this.verdicts = verdicts ?? [lastVerdict];
  }
}

export function isVisualContractQaBlockError(e: unknown): e is VisualContractQaBlockError {
  return (
    e instanceof VisualContractQaBlockError ||
    (e as { isVisualContractQaBlock?: boolean })?.isVisualContractQaBlock === true
  );
}

/** Render one attempt. suppression/extraNegative are '' on attempt 0, fed-back corrections on rerolls. */
export type ContractGateRender<TImage> = (args: {
  suppression: string;
  extraNegative: string;
  attempt: number;
}) => Promise<{ image: TImage; url: string }>;

/** Vision seam: (imageUrl, instruction) → raw model text (JSON the gate reads). */
export type ContractGateVision = (imageUrl: string, instruction: string) => Promise<string>;

export interface RunPageContractGateInput<TImage> {
  page: ResolvedPageContract;
  contract: BookVisualContract;
  isCover?: boolean;
  render: ContractGateRender<TImage>;
  vision: ContractGateVision;
  /** Max feedback rerolls beyond attempt 0; render() is called at most maxRerolls+1 times. */
  maxRerolls: number;
}

export interface RunPageContractGateResult<TImage> {
  image: TImage;
  url: string;
  /** Number of render() invocations made (= renders for this page; the proven upper bound). */
  renderCalls: number;
  /** 0-based index of the attempt that passed. */
  passedAttempt: number;
  verdicts: ContractQaVerdict[];
}

/**
 * Drive a single page through render → gate → bounded feedback-reroll. Returns the PASSING image, or
 * throws VisualContractQaBlockError when every attempt fails (no image is returned on failure).
 */
export async function runPageContractGate<TImage>(
  input: RunPageContractGateInput<TImage>
): Promise<RunPageContractGateResult<TImage>> {
  const { page, contract, isCover, render, vision, maxRerolls } = input;
  const scaleContract = contract.cast.companion?.scaleContract ?? null;
  const instruction = buildContractVisionInstruction(page, contract, isCover);
  const verdicts: ContractQaVerdict[] = [];

  const totalAttempts = Math.max(0, Math.floor(maxRerolls)) + 1; // attempt 0 + rerolls = render budget
  let suppression = '';
  let extraNegative = '';

  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    const { image, url } = await render({ suppression, extraNegative, attempt });
    const observation = interpretVisionJson(await vision(url, instruction));
    const verdict = evaluatePageContractQa({ page, observation, isCover, scaleContract });
    verdicts.push(verdict);

    if (verdict.pass) {
      return { image, url, renderCalls: attempt + 1, passedAttempt: attempt, verdicts };
    }

    // Feed the gate's findings forward (NOT blind) so the next attempt actively fixes what was caught.
    suppression = buildContractRerollSuppression({ observation, verdict, page, contract, attempt });
    extraNegative = caughtStrayEntities(observation).join(', ');
  }

  // Exhausted — NEVER return a failed image; the caller must drop the page (typed fail), never promote it.
  throw new VisualContractQaBlockError(
    page.pageNumber,
    totalAttempts,
    verdicts[verdicts.length - 1] ?? { pass: false, failures: [] },
    verdicts
  );
}

/**
 * 3-STATE identity verdict for a PROMOTED reroll. The reroll re-score is a WEAK whole-image palette-
 * histogram (NOT real face identity), so it must NEVER silently keep and NEVER hard-drop on an
 * unmeasurable face:
 *   - not_measurable → multi-face / tiny / low-confidence face → the score can't gauge identity → the
 *                      caller routes to HUMAN REVIEW (the page is kept, flagged, recorded — not silently kept).
 *   - fail           → a RELIABLY measured face (single, prominent, confident) with a CLEAR palette
 *                      mismatch → drop (no-leak); the only case a weak histogram plausibly = different child.
 *   - pass           → reliably measured face with no clear mismatch.
 * Real face identity replaces this weak signal in Fix B; until then `fail` is intentionally rare.
 */
export type IdentityStatus = 'pass' | 'fail' | 'not_measurable';

export interface RerollIdentityVerdict {
  status: IdentityStatus;
  /** The raw palette-histogram score (diagnostic only), or null when unscored. */
  score: number | null;
  reason: string;
}

/** Face must be at least this confidently detected for the histogram to be trusted enough to HARD-FAIL. */
export const IDENTITY_MIN_FACE_DETECT_CONFIDENCE = 0.6;

/**
 * Classify a promoted reroll's identity from the (weak) palette-histogram signals. NEVER hard-blocks on
 * an unmeasurable face — that is `not_measurable` (→ human review), not `fail`. Hard `fail` requires a
 * reliably measured single, prominent face AND a CLEAR mismatch (drastic palette divergence). The old
 * `score < 0.70` whole-image hard-block is removed — it false-dropped busy/multi-face scenes.
 */
export function evaluateRerollIdentity(input: {
  score: number | null | undefined;
  /** geometryWeird = faceCount !== 1 || faceAreaRatio < 0.05 (from scoreResemblanceAgainstReference). */
  geometryWeird?: boolean | null;
  faceDetectConfidence?: number | null;
  /** Drastic palette divergence (clear mismatch) — the ONLY basis for a histogram hard-fail. */
  clearMismatch?: boolean | null;
}): RerollIdentityVerdict {
  const score = typeof input.score === 'number' ? input.score : null;
  const reliablyMeasured =
    !input.geometryWeird &&
    (input.faceDetectConfidence ?? 0) >= IDENTITY_MIN_FACE_DETECT_CONFIDENCE &&
    score !== null;
  if (!reliablyMeasured) {
    return {
      status: 'not_measurable',
      score,
      reason:
        'face not reliably measurable (multi-face / tiny / low-confidence) — palette-histogram cannot gauge identity',
    };
  }
  if (input.clearMismatch) {
    return {
      status: 'fail',
      score,
      reason: `clear palette mismatch (score ${score.toFixed(3)}) on a measurable, prominent single face`,
    };
  }
  return { status: 'pass', score, reason: `measurable face, no clear palette mismatch (score ${score.toFixed(3)})` };
}

/**
 * Re-score identity on a PROMOTED reroll: returns the 3-STATE verdict. `fail` DROPS the page (no-leak);
 * `not_measurable` keeps it but flags human review; `pass` keeps it. Not called on attempt 0.
 */
export type ResemblanceRecheck<TImage> = (
  image: TImage,
  url: string,
  passedAttempt: number
) => Promise<RerollIdentityVerdict>;

export type PageGateOutcome<TImage> =
  | {
      kept: true;
      image: TImage;
      renderCalls: number;
      passedAttempt: number;
      verdicts: ContractQaVerdict[];
      /** undefined when no reroll recheck ran (attempt-0 pass); else the reroll identity verdict status. */
      identityStatus?: IdentityStatus;
    }
  | {
      kept: false;
      reason: string;
      renderCalls: number;
      verdicts: ContractQaVerdict[];
      identityStatus?: IdentityStatus;
    };

/**
 * The full live decision for one page: run the contract gate (bounded feedback reroll), and — when a
 * REROLL is promoted — re-check identity (3-state). A real CONTRACT block OR an identity `fail` returns
 * kept:false (drop, no-leak). `not_measurable` and `pass` keep the image, carrying identityStatus so the
 * caller routes `not_measurable` to human review. This is the unit the live loop runs.
 */
export async function gatePageWithResemblance<TImage>(
  input: RunPageContractGateInput<TImage> & {
    resemblanceRecheck?: ResemblanceRecheck<TImage> | null;
  }
): Promise<PageGateOutcome<TImage>> {
  let result: RunPageContractGateResult<TImage>;
  try {
    result = await runPageContractGate(input);
  } catch (e) {
    if (isVisualContractQaBlockError(e)) {
      return { kept: false, reason: e.message, renderCalls: e.attempts, verdicts: e.verdicts };
    }
    throw e;
  }
  if (input.resemblanceRecheck && result.passedAttempt > 0) {
    const verdict = await input.resemblanceRecheck(result.image, result.url, result.passedAttempt);
    if (verdict.status === 'fail') {
      return {
        kept: false,
        reason: `reroll (attempt ${result.passedAttempt}) identity FAIL — ${verdict.reason}`,
        renderCalls: result.renderCalls,
        verdicts: result.verdicts,
        identityStatus: 'fail',
      };
    }
    return {
      kept: true,
      image: result.image,
      renderCalls: result.renderCalls,
      passedAttempt: result.passedAttempt,
      verdicts: result.verdicts,
      identityStatus: verdict.status,
    };
  }
  return {
    kept: true,
    image: result.image,
    renderCalls: result.renderCalls,
    passedAttempt: result.passedAttempt,
    verdicts: result.verdicts,
  };
}
