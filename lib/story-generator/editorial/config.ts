export const MAX_EDITORIAL_REPAIR_ATTEMPTS = 1;
export const EDITORIAL_DIFF_RATIO_MAX = 0.35;

export function isEditorialQaEnabled(): boolean {
  return process.env.EDITORIAL_QA_ENABLED !== 'false';
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
