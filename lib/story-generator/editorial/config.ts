export const MAX_EDITORIAL_REPAIR_ATTEMPTS = 1;
export const EDITORIAL_DIFF_RATIO_MAX = 0.35;

export function isEditorialQaEnabled(): boolean {
  return process.env.EDITORIAL_QA_ENABLED !== 'false';
}

export function getEditorialQaModel(): string {
  return process.env.EDITORIAL_QA_MODEL?.trim() || 'gpt-4o-mini';
}

export function getEditorialRepairModel(): string {
  return (
    process.env.EDITORIAL_REPAIR_MODEL?.trim() ||
    process.env.GENERATOR_LLM_MODEL?.trim() ||
    'gpt-5-chat-latest'
  );
}
