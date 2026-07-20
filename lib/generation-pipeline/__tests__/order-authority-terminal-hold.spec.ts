import { describe, it, expect } from 'vitest';

import { isDeliveryTerminalHold, markerRank, TERMINAL_HOLD_NOT_LIKE_SQL } from '@/lib/generation-pipeline/order-authority';

const TERMINAL_PREFIXES = ['safety_hold:', 'contract_world_hold:', 'quarantine_cutover:', 'manual_resolution_hold:'];

describe('isDeliveryTerminalHold — terminal parks (incl. Slice-4 manual_resolution_hold)', () => {
  it('recognizes every terminal prefix', () => {
    for (const p of TERMINAL_PREFIXES) {
      expect(isDeliveryTerminalHold(`${p}whatever`)).toBe(true);
    }
  });

  it('does NOT treat non-terminal / recoverable holds (or null) as terminal', () => {
    for (const r of ['anchor_low_confidence:soft_band', 'base_book_integrity:blocked', 'qa_soft_deliver:blocked', '', null, undefined]) {
      expect(isDeliveryTerminalHold(r)).toBe(false);
    }
  });

  it('manual_resolution_hold is terminal-for-resume but markerRank 1 (a real safety_hold can still escalate over it)', () => {
    expect(markerRank('manual_resolution_hold:anchor_low_confidence:x')).toBe(1);
    expect(markerRank('safety_hold:x')).toBe(3); // still outranks a manual park
    expect(markerRank('contract_world_hold:x')).toBe(2);
  });
});

describe('LOCK-STEP: the SQL twin lists exactly the TS predicate prefixes (they must never drift)', () => {
  it('TERMINAL_HOLD_NOT_LIKE_SQL blocks every prefix isDeliveryTerminalHold recognizes', () => {
    const sqlText = TERMINAL_HOLD_NOT_LIKE_SQL.sql;
    for (const p of TERMINAL_PREFIXES) {
      // the ship CAS interpolates this; each terminal prefix must appear as a NOT LIKE guard so the SQL can never
      // ship a book the TS predicate would call terminal.
      expect(sqlText).toContain(`${p}%`);
    }
  });
});
