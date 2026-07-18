/**
 * (Human-QA Slice 1, Unit 3) Feature flags for the operator-notification worker.
 *
 * The operator-review email is a purely INTERNAL notification (no customer-facing side effect), so it is safe to
 * run in production — but it must stay INERT until explicitly enabled. Default OFF: the cron route no-ops unless
 * `HUMAN_QA_NOTIFY_ENABLED === 'true'`. There is NO hard-false on prod (unlike a customer-facing gate) — the flag
 * is a plain env read so ops can turn the worker on wherever the outbox has scheduled rows.
 */
export function isOperatorNotifyEnabled(): boolean {
  return process.env.HUMAN_QA_NOTIFY_ENABLED === 'true';
}
