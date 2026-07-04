/**
 * Fail-closed guards for the render path — the migration/fallback contract.
 *
 *  - Production full render: NO full render without a valid contract (throws, clear message).
 *  - QA audition: fails with a clear, actionable message (never silently proceeds).
 *  - Dev creator: an override is allowed ONLY when explicitly set (VISUAL_CONTRACT_DEV_OVERRIDE).
 *
 * Enforcement of the whole layer is flag-gated by VISUAL_CONTRACT_ENFORCEMENT so it can be enabled
 * per-environment after the calibration gate proves out — renders STAY STOPPED until then. The flag is
 * additionally hard-gated to NON-PRODUCTION runtimes: even if VISUAL_CONTRACT_ENFORCEMENT=true leaks
 * onto Vercel Production, enforcement stays OFF there (QA/preview/local only) until prod is explicitly
 * cut over — mirroring the prod-generation kill-switch so the live customer path stays on legacy behavior.
 */
import {
  validateBookVisualContract,
  InvalidVisualContractError,
} from './validateBookVisualContract';
import { isVercelProductionRuntime } from '@/lib/runtime-env';
import type { BookVisualContract } from './types';

export type RenderContext = 'production' | 'qa_audition' | 'dev_creator';

/**
 * Whether the contract layer is enforced in this environment. Default OFF (renders stay on legacy
 * behavior). Hard-gated to non-production: NEVER true on Vercel Production regardless of the env var —
 * QA/preview/local only. Prod is cut over deliberately later, not by this flag leaking onto it.
 */
export function isVisualContractEnforcementEnabled(): boolean {
  if (isVercelProductionRuntime()) return false;
  return process.env.VISUAL_CONTRACT_ENFORCEMENT === 'true';
}

/** Whether a dev override is explicitly permitted (dev creator only). */
export function isVisualContractDevOverrideEnabled(): boolean {
  return process.env.VISUAL_CONTRACT_DEV_OVERRIDE === 'true';
}

/**
 * (WS0b) Whether the contract is PRODUCED, FROZEN, and BOUND on the live generation path — i.e. whether
 * `ensureFrozenVisualContract` compiles/loads the contract, stamps `Order.visualContractHash`, and persists
 * it into `pipelineCache` before the cover. Default OFF: with the flag off the freeze is a no-op and render
 * output is byte-identical to today (no stamp, no cache write, no `inputVersion` bump). This gates ONLY the
 * freeze/binding plumbing — it changes NOTHING that gets rendered (steering is a separate flag) and enables
 * NO blocking check. Hard-gated to NON-PRODUCTION (mirrors enforcement + the prod-generation kill-switch):
 * even if the var leaks onto Vercel Production the freeze stays OFF there until prod is deliberately cut over.
 */
export function isVisualContractFreezeEnabled(): boolean {
  if (isVercelProductionRuntime()) return false;
  return process.env.VISUAL_CONTRACT_FREEZE === 'true';
}

/**
 * (WS0b) Whether the contract STEERS live render output — prompt threading, scene-class routing, and style-ref
 * routing fed by the contract's projections. Default OFF, hard-off on prod. This is the flag Codex insisted on:
 * steering must NOT ship without the blocking location/cast QA gate (WS1). WS0b only BUILDS the projection
 * adapters; with this flag OFF they are available but do NOT drive the prompt/scene/style path, so render output
 * is byte-identical to today. WS1 turns this ON together with the gate.
 *
 * (B3) The "flip both together" rule is now a CODE invariant, not just operational intent: steering returns false
 * unless enforcement (the gate) is ALSO on, so steering can never drive live render output by misconfiguration
 * without a gate to catch a wrong contract. (Enforcement is itself hard-off on prod, so steering stays hard-off there.)
 */
export function isVisualContractSteeringEnabled(): boolean {
  if (isVercelProductionRuntime()) return false;
  if (!isVisualContractEnforcementEnabled()) return false; // fail-closed: steering NEVER without the gate
  return process.env.VISUAL_CONTRACT_STEERING === 'true';
}

export class MissingVisualContractError extends Error {
  readonly isMissingVisualContract = true as const;
  constructor(message: string, readonly context: RenderContext, readonly errors?: string[]) {
    super(message);
    this.name = 'MissingVisualContractError';
  }
}

export function isMissingVisualContractError(e: unknown): e is MissingVisualContractError {
  return (
    e instanceof MissingVisualContractError ||
    (e as { isMissingVisualContract?: boolean })?.isMissingVisualContract === true
  );
}

/**
 * Require a valid contract before rendering. Fail-closed per context:
 *  - production: always required (unless enforcement is globally off — then this is a no-op pass).
 *  - qa_audition: required, with a clear message.
 *  - dev_creator: required UNLESS the explicit dev override is set.
 *
 * Returns the validated contract. Throws MissingVisualContractError (missing) or surfaces the
 * validation errors otherwise.
 */
export function requireValidContractForRender(
  contract: unknown,
  context: RenderContext
): BookVisualContract {
  // When the layer is globally disabled, do not block legacy renders — but if a contract IS provided
  // it must still be structurally valid (don't feed a broken contract into the prompt).
  const enforcement = isVisualContractEnforcementEnabled();

  if (contract == null) {
    if (context === 'dev_creator' && isVisualContractDevOverrideEnabled()) {
      // Explicit dev override — caller proceeds without a contract knowingly.
      return null as unknown as BookVisualContract;
    }
    if (!enforcement) {
      // Layer off and no contract supplied → legacy behavior, nothing to enforce.
      return null as unknown as BookVisualContract;
    }
    const msg =
      context === 'qa_audition'
        ? 'QA audition blocked: no BookVisualContract for this story. Compile + validate the contract before auditioning.'
        : 'Full render blocked: no valid BookVisualContract. The contract is required before rendering (fail-closed).';
    throw new MissingVisualContractError(msg, context);
  }

  const result = validateBookVisualContract(contract);
  if (!result.ok) {
    // A present-but-invalid contract is always a hard stop (even with enforcement off) — never render
    // against a broken source of truth.
    throw new InvalidVisualContractError(result.errors);
  }
  return result.contract;
}
