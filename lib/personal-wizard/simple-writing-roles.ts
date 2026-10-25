import 'server-only';

/**
 * Explicit per-role writing route: the author and the fresh editor are different providers. Not a model id and not a
 * default; source admission checks each receipt against its own role. The two cost estimates (a Claude Max CLI list
 * estimate and an API usage estimate) are never summed into one amount; each stays in its own receipt.
 */
export const SIMPLE_WRITING_ROLES = { version: 'role-split/v1', author: 'claude-opus-5-5', editor: 'gpt-6.1-sol',
  label: 'role-split/v1:author=claude-opus-5-5,editor=gpt-6.1-sol' } as const;
