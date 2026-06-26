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
