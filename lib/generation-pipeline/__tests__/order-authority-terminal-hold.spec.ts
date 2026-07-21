import { describe, it, expect } from 'vitest';

import {
  isDeliveryTerminalHold, markerRank, TERMINAL_HOLD_NOT_LIKE_SQL,
  QA_RELEASED_SAFETY_PREFIX, qaReleasedSafetyMarker, isQaReleasedSafetyMarker,
} from '@/lib/generation-pipeline/order-authority';

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

describe('qa_released:safety: — the released marker is DELIVERABLE by explicit declaration, not by absence (2a-0)', () => {
  const released = qaReleasedSafetyMarker('safety_hold:hazard:page:4:unsafe_pose');

  it('builds qa_released:safety:<detail> preserving the hazard detail, stripping the safety_hold: prefix', () => {
    expect(released).toBe('qa_released:safety:hazard:page:4:unsafe_pose');
    expect(released.startsWith(QA_RELEASED_SAFETY_PREFIX)).toBe(true);
  });

  it('refuses to mint a released marker for anything that is not a safety HAZARD hold (never unverified / non-safety)', () => {
    expect(() => qaReleasedSafetyMarker('safety_hold:unverified:page:4')).toThrow();
    expect(() => qaReleasedSafetyMarker('anchor_low_confidence:soft_band')).toThrow();
  });

  it('is NON-terminal (a released book may ship) and markerRank 1 (a NEW real hazard can still escalate over it)', () => {
    expect(isDeliveryTerminalHold(released)).toBe(false);
    expect(markerRank(released)).toBe(1);
    // and it is NOT listed in the terminal SQL twin — deliverable by declaration, verified against the blocklist.
    expect(TERMINAL_HOLD_NOT_LIKE_SQL.sql).not.toContain('qa_released');
    expect(TERMINAL_PREFIXES).not.toContain(QA_RELEASED_SAFETY_PREFIX);
  });

  it('a prefix TYPO is NOT silently recognised as released (the silent-un-hold this declaration closes)', () => {
    expect(isQaReleasedSafetyMarker(released)).toBe(true);
    for (const typo of ['qa_relesed:safety:hazard:x', 'qa_release:safety:hazard:x', 'qarelease:safety:x', 'safety_hold:hazard:x', '', null, undefined]) {
      expect(isQaReleasedSafetyMarker(typo)).toBe(false);
    }
  });
});
