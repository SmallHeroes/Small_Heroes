/**
 * Approve Stage 0 child anchor after eyeball QA.
 *
 *   node scripts/approve-child-anchor.mjs <orderId>
 */
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });
loadEnv();

const orderId = process.argv[2]?.trim();
const attemptRaw = process.argv[3]?.trim();
const attempt = attemptRaw ? Number.parseInt(attemptRaw, 10) : undefined;
if (!orderId) {
  console.error('Usage: node scripts/approve-child-anchor.mjs <orderId> [attemptNumber]');
  process.exit(1);
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const res = await fetch(`${baseUrl}/api/dev/approve-child-anchor`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ orderId, ...(Number.isFinite(attempt) ? { attempt } : {}) }),
});
const data = await res.json();
console.log(JSON.stringify(data, null, 2));
if (!res.ok) process.exit(1);
