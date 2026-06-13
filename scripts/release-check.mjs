#!/usr/bin/env node
/**
 * Pre-deploy release check — fails before ship if F&F v3 config is incomplete.
 * Does NOT run in production runtime; invoke in CI or before deploy only.
 *
 *   npm run release-check
 */
import {
  allMvpCategories,
  configuredSlotStatus,
  isSlotSellable,
} from '../backend/config/mvp-story-matrix.ts';

const DIRECTIONS = ['bedtime', 'adventure', 'fantasy'];

function v3ApprovedSlots() {
  const slots = [];
  for (const category of allMvpCategories()) {
    for (const direction of DIRECTIONS) {
      if (configuredSlotStatus(category, direction) === 'approved_v3') {
        slots.push(`${category}.${direction}`);
      }
    }
  }
  return slots;
}

function countSellable() {
  let n = 0;
  for (const category of allMvpCategories()) {
    for (const direction of DIRECTIONS) {
      if (isSlotSellable(category, direction)) n += 1;
    }
  }
  return n;
}

const flag = String(process.env.ENABLE_V3_APPROVED_BANK ?? '').trim().toLowerCase();
const v3Enabled = flag === 'true' || flag === '1';
const v3Slots = v3ApprovedSlots();
const sellable = countSellable();

console.log(`[release-check] ENABLE_V3_APPROVED_BANK=${flag || '(unset)'}`);
console.log(`[release-check] sellable matrix slots: ${sellable}/18`);
console.log(`[release-check] configured approved_v3 slots: ${v3Slots.join(', ') || '(none)'}`);

if (!v3Enabled && v3Slots.length > 0) {
  console.error('');
  console.error('[release-check] FAIL — F&F config incomplete.');
  console.error(
    `[release-check] Set ENABLE_V3_APPROVED_BANK=true or v3 slots are unsellable: ${v3Slots.join(', ')}`
  );
  console.error(`[release-check] Current sellable count: ${sellable}/18 (expected 8/18 at launch)`);
  process.exit(1);
}

if (v3Enabled && sellable < 8) {
  console.warn(
    `[release-check] WARN — flag ON but only ${sellable}/18 sellable (expected ≥8). Check bank files + import sidecars.`
  );
}

console.log('[release-check] PASS');
