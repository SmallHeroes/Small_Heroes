export const MAX_EDITORIAL_REPAIR_ATTEMPTS = 1;
export const EDITORIAL_DIFF_RATIO_MAX = 0.35;

export function isEditorialQaEnabled(): boolean {
  return process.env.EDITORIAL_QA_ENABLED !== 'false';
}

/**
 * Y-lite — two independent reviewers (Book Editor + Resilience).
 * Default OFF for safety. Enable with EDITORIAL_MODE=y-lite.
 */
export type EditorialMode = 'single' | 'y-lite';
export function getEditorialMode(): EditorialMode {
  const m = process.env.EDITORIAL_MODE?.trim();
  return m === 'y-lite' ? 'y-lite' : 'single';
}

/**
 * v0.4 — Structured (JSON) Author mode vs free-form markdown.
 * Default OFF. Enable with DRAFT_MODE=structured.
 *
 * Structured mode is the architectural fix for the persistent "model dumps
 * 30-90 words onto a critical page" failure. The page caps are enforced
 * at JSON schema validation time — the model cannot exceed them.
 */
export type DraftMode = 'free-form' | 'structured';
export function getDraftMode(): DraftMode {
  const m = process.env.DRAFT_MODE?.trim();
  return m === 'structured' ? 'structured' : 'free-form';
}

export function getEditorialQaModel(): string {
  // v0.2.4 — Ruthless QA principle: AI is the last gate before customer.
  // Default to gpt-5-chat-latest (same as writer) for editorial parity.
  // gpt-4o-mini caused Zod parse failures + 5/5 rubber-stamp verdicts that
  // effectively bypassed editorial review. Cost: ~$0.05 per QA call vs ~$0.007 mini.
  return process.env.EDITORIAL_QA_MODEL?.trim() || 'gpt-5-chat-latest';
}

export function getEditorialRepairModel(): string {
  return (
    process.env.EDITORIAL_REPAIR_MODEL?.trim() ||
    process.env.GENERATOR_LLM_MODEL?.trim() ||
    'gpt-5-chat-latest'
  );
}
