/** Inactivity may restart on an audited manual resume; the creation-based upper bound never moves. */
export const ENGINE_ORDER_DEADLINE_MS = 4 * 60 * 60_000;
export const ENGINE_ORDER_ABSOLUTE_DEADLINE_MS = 24 * 60 * 60_000;
export function engineAbsoluteDeadlineExpired(createdAt: Date, now = Date.now()) {
  return !Number.isFinite(createdAt.getTime()) || now - createdAt.getTime() >= ENGINE_ORDER_ABSOLUTE_DEADLINE_MS;
}
