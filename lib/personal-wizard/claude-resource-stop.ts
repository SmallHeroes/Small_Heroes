/** Observability only. Never changes a journal, cost, attempt, model or retry/continuation authority. */
export type ClaudeQuotaStop = { version: 'claude-resource-stop/v1'; code: 'provider_quota_exhausted'; provider: 'claude_max';
  quotaPeriod: 'weekly' | 'daily' | 'monthly'; providerStatus: 429; reportedResourceMicroUsd: 0;
  automaticRetryAllowed: false; continuationGranted: false; futureAvailabilityVerified: false };

/** Strictly recognize a terminated, known-reported-zero quota refusal, not ordinary429s or an unknown/partial result. */
export function claudeQuotaStop(receipt: unknown): ClaudeQuotaStop | null {
  if (!receipt || typeof receipt !== 'object') return null;
  const r = receipt as Record<string, any>, wire = r.raw;
  if (r.estimatedMicroUsd !== 0 || !wire || wire.termination?.code !== 1 || wire.termination?.signal !== null ||
    wire.killConfirmed !== true || wire.stopped !== false || typeof wire.stdout !== 'string' || wire.stdout.length > 16000) return null;
  let raw: any;
  try { raw = JSON.parse(wire.stdout); } catch { return null; }
  if (!raw || raw.type !== 'result' || raw.is_error !== true || raw.terminal_reason !== 'api_error' || raw.api_error_status !== 429 ||
    raw.total_cost_usd !== 0 || typeof raw.result !== 'string' || !raw.usage || typeof raw.usage !== 'object' || Array.isArray(raw.usage) ||
    !raw.modelUsage || typeof raw.modelUsage !== 'object' || Array.isArray(raw.modelUsage) || Object.keys(raw.modelUsage).length || raw.structured_output !== undefined ||
    ['input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens'].some(k => raw.usage[k] !== 0)) return null;
  const period = /\bhit your (weekly|daily|monthly) limit\b/i.exec(raw.result)?.[1]?.toLowerCase() as ClaudeQuotaStop['quotaPeriod'] | undefined;
  if (!period) return null;
  return { version: 'claude-resource-stop/v1', code: 'provider_quota_exhausted', provider: 'claude_max', quotaPeriod: period,
    providerStatus: 429, reportedResourceMicroUsd: 0, automaticRetryAllowed: false, continuationGranted: false, futureAvailabilityVerified: false };
}

/** Capture at the transport boundary before existing generic callback wrappers erase the cause; rethrow the ORIGINAL error unchanged. */
export async function observeClaudeQuotaStop<T>(dispatch: () => Promise<T>, observe: (stop: ClaudeQuotaStop) => void): Promise<T> {
  try { return await dispatch(); } catch (error) {
    const stop = claudeQuotaStop(error && typeof error === 'object' && 'receipt' in error ? error.receipt : null);
    // Diagnostic/logging faults must not erase the original provider receipt or turn its known0 into an unpriced failure.
    try { if (stop) observe(stop); } finally { throw error; }
  }
}

/** Terminal metadata only. It does not alter failed_trial, accounting, the spent claim or remaining attempts. */
export function trialFailureDetails(error: unknown, stop: ClaudeQuotaStop | null) {
  const code = stop?.code ?? (error && typeof error === 'object' && 'code' in error ? error.code : undefined) ?? 'trial_failure';
  return { code, ...(stop ? { providerStop: stop } : {}) };
}
