/**
 * Visual-contract compile stage for the LIVE chunked render path.
 *
 * Compiles the BookVisualContract ONCE per book (from the full story text), validates it FAIL-CLOSED
 * inside compileBookVisualContract, and hands it back to be persisted on the GenerationJob's
 * pipelineCache so every page/chunk reuses the same contract — one LLM call per book, never per page.
 *
 * Entirely gated by VISUAL_CONTRACT_ENFORCEMENT (non-prod hard gate). With enforcement OFF this is a
 * no-op that returns the cache untouched → legacy render behavior is unchanged.
 *
 * The compile LLM is injectable (defaults to the shared pipeline LLM via compileBookVisualContract) so
 * the stage is unit-testable without a live model.
 */
import type { Prisma } from '@prisma/client';
import {
  compileBookVisualContract,
  isVisualContractEnforcementEnabled,
  type BookVisualContract,
  type ContractLlmCaller,
} from '@/lib/visual-contract-compiler';
import type { PipelineCache } from './types';

/**
 * Read the typed BookVisualContract back out of pipelineCache (stored as Prisma JSON for column
 * assignability). Centralizes the one cast so consumers stay strongly typed.
 */
export function getCachedVisualContract(cache: PipelineCache): BookVisualContract | null {
  return (cache.visualContract ?? null) as unknown as BookVisualContract | null;
}

/** Concatenate page prose into the full-story text the contract is compiled from (page-ordered). */
export function assembleFullStoryText(
  pages: Array<{ pageNumber: number; text?: string | null }>
): string {
  return pages
    .slice()
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((p) => `--- Page ${p.pageNumber} ---\n${(p.text ?? '').trim()}`)
    .join('\n\n');
}

export interface EnsureBookVisualContractInput {
  cache: PipelineCache;
  storyKey?: string;
  pages: Array<{ pageNumber: number; text?: string | null }>;
  childName?: string | null;
  childGender?: string | null;
  companion?: { id: string; name?: string } | null;
}

export interface EnsureBookVisualContractResult {
  /** The (possibly updated) cache — identity-equal to input when nothing changed. */
  cache: PipelineCache;
  /** The contract in force for this render, or null when enforcement is off. */
  contract: BookVisualContract | null;
  /** True only when a fresh compile happened this call (caller should persist the cache). */
  compiled: boolean;
}

/**
 * Ensure a valid BookVisualContract exists for this book when enforcement is on.
 *  - enforcement OFF        → no-op, returns cache unchanged, contract from cache (usually null).
 *  - already compiled       → reuse the cached contract, no LLM call.
 *  - first time, enforced   → compile from the full story, validate fail-closed (throws on invalid),
 *                             return the cache with `visualContract` set and `compiled: true`.
 *
 * Fail-closed: a missing/invalid contract throws (InvalidVisualContractError) BEFORE any page render —
 * the caller must not proceed to paid generation without a valid contract.
 */
export async function ensureBookVisualContract(
  input: EnsureBookVisualContractInput,
  deps?: { callLLM?: ContractLlmCaller }
): Promise<EnsureBookVisualContractResult> {
  if (!isVisualContractEnforcementEnabled()) {
    return { cache: input.cache, contract: getCachedVisualContract(input.cache), compiled: false };
  }
  if (input.cache.visualContract) {
    return { cache: input.cache, contract: getCachedVisualContract(input.cache), compiled: false };
  }

  const contract = await compileBookVisualContract(
    {
      storyKey: input.storyKey,
      fullStoryText: assembleFullStoryText(input.pages),
      pageCount: input.pages.length,
      childName: input.childName ?? undefined,
      childGender: input.childGender ?? undefined,
      companion: input.companion ?? null,
    },
    deps
  );

  return {
    cache: { ...input.cache, visualContract: contract as unknown as Prisma.InputJsonValue },
    contract,
    compiled: true,
  };
}
