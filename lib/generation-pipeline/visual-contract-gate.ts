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
 * Re-score resemblance on a PROMOTED reroll (election pages only): return false to DROP the page
 * because the contract correction lost child identity. Not called on attempt 0 or non-election pages.
 */
export type ResemblanceRecheck<TImage> = (
  image: TImage,
  url: string,
  passedAttempt: number
) => Promise<boolean>;

export type PageGateOutcome<TImage> =
  | { kept: true; image: TImage; renderCalls: number; passedAttempt: number; verdicts: ContractQaVerdict[] }
  | { kept: false; reason: string; renderCalls: number; verdicts: ContractQaVerdict[] };

/**
 * The full live decision for one page: run the contract gate (bounded feedback reroll), and — when a
 * REROLL is promoted on an election page — re-run resemblance so a contract fix can't silently lose
 * child identity. Returns kept:false on a contract block OR a failed resemblance re-check; the caller
 * drops the page (failedPages) and promotes NOTHING (no-leak). This is the unit the live loop runs.
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
    const ok = await input.resemblanceRecheck(result.image, result.url, result.passedAttempt);
    if (!ok) {
      return {
        kept: false,
        reason: `reroll (attempt ${result.passedAttempt}) failed the resemblance re-check`,
        renderCalls: result.renderCalls,
        verdicts: result.verdicts,
      };
    }
  }
  return {
    kept: true,
    image: result.image,
    renderCalls: result.renderCalls,
    passedAttempt: result.passedAttempt,
    verdicts: result.verdicts,
  };
}
