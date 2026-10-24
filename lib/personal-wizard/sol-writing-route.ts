/** Dependency-free route identity: source schemas must not initialize through the transport/runner import graph. */
export const SOL_WRITING = Object.freeze({ version: 'sol-writing-responses/v1', model: 'gpt-6.1-sol' as const,
  route: 'openai_responses' as const, maxWireBytes: 104000, timeoutMs: 600000, minimumReserveMicroUsd: 600000 });
