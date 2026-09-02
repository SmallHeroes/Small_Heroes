import { describe, it, expect, vi } from 'vitest';

import {
  isDeliveryTerminalHold, markerRank, TERMINAL_HOLD_NOT_LIKE_SQL,
  QA_RELEASED_SAFETY_PREFIX, qaReleasedSafetyMarker, isQaReleasedSafetyMarker,
  QA_HUMAN_VERIFIED_UNVERIFIED_PREFIX,
  parseSinglePageSafetyUnverifiedMarker,
  parseHumanVerifiedUnverifiedPageMarker,
  humanVerifiedUnverifiedMarker,
  executeHumanVerifiedUnverifiedReleaseTransition,
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

describe('qa_human_verified:safety:unverified: — exact single-page human verification', () => {
  const source = 'safety_hold:unverified:page:6';
  const released = humanVerifiedUnverifiedMarker(source);

  it('builds and parses a distinct marker while preserving the exact page', () => {
    expect(released).toBe('qa_human_verified:safety:unverified:page:6');
    expect(released.startsWith(QA_HUMAN_VERIFIED_UNVERIFIED_PREFIX)).toBe(true);
    expect(parseSinglePageSafetyUnverifiedMarker(source)).toEqual({ pageNumber: 6 });
    expect(parseHumanVerifiedUnverifiedPageMarker(released)).toEqual({ pageNumber: 6 });
  });

  it('accepts only one canonical positive safe-integer PAGE source (never cover, aggregate, hazard or typo)', () => {
    for (const marker of [
      'safety_hold:unverified:cover',
      'safety_hold:unverified:page:1,page:2',
      'safety_hold:unverified:page:0',
      'safety_hold:unverified:page:01',
      'safety_hold:unverified:page:9007199254740992',
      'safety_hold:hazard:page:6:unsafe_pose',
      'safety_hold:unverified:page:6:extra',
      'safety_hold:unverifed:page:6',
      '',
    ]) {
      expect(parseSinglePageSafetyUnverifiedMarker(marker), marker).toBeNull();
      expect(() => humanVerifiedUnverifiedMarker(marker), marker).toThrow();
    }
    expect(parseSinglePageSafetyUnverifiedMarker(null)).toBeNull();
    expect(parseSinglePageSafetyUnverifiedMarker(undefined)).toBeNull();
  });

  it('the released parser fails closed on a prefix typo, wrong target, aggregate or trailing detail', () => {
    for (const marker of [
      'qa_human_verifed:safety:unverified:page:6',
      'qa_human_verified:safety:unverified:cover',
      'qa_human_verified:safety:unverified:page:6,page:7',
      'qa_human_verified:safety:unverified:page:0',
      'qa_human_verified:safety:unverified:page:06',
      'qa_human_verified:safety:unverified:page:6:extra',
      'qa_released:safety:hazard:page:6:unsafe_pose',
      '',
    ]) {
      expect(parseHumanVerifiedUnverifiedPageMarker(marker), marker).toBeNull();
    }
    expect(parseHumanVerifiedUnverifiedPageMarker(null)).toBeNull();
    expect(parseHumanVerifiedUnverifiedPageMarker(undefined)).toBeNull();
  });

  it('is explicitly non-terminal/rank-1, so a later genuine safety hold can supersede it', () => {
    expect(isDeliveryTerminalHold(released)).toBe(false);
    expect(markerRank(released)).toBe(1);
    expect(TERMINAL_HOLD_NOT_LIKE_SQL.sql).not.toContain(QA_HUMAN_VERIFIED_UNVERIFIED_PREFIX);
  });
});

describe('executeHumanVerifiedUnverifiedReleaseTransition — fenced Order-authority CAS', () => {
  const args = {
    orderId: 'order-1',
    expectedMarker: 'safety_hold:unverified:page:6',
    observedFence: 11,
    expectedInputVersion: 7,
    releasedMarker: 'qa_human_verified:safety:unverified:page:6',
  };

  function fakeDb(result: number) {
    const execute = vi.fn(async (_strings: TemplateStringsArray, ..._values: unknown[]) => result);
    return { db: { $executeRaw: execute } as never, execute };
  }

  it('binds exact marker + input + fence + manual/payment invariants and bumps the fence exactly once', async () => {
    const { db, execute } = fakeDb(1);
    await expect(executeHumanVerifiedUnverifiedReleaseTransition(db, args)).resolves.toBe(1);
    expect(execute).toHaveBeenCalledTimes(1);

    const [strings, ...values] = execute.mock.calls[0] as unknown as [TemplateStringsArray, ...unknown[]];
    const sql = strings.join('?');
    expect(values).toEqual([
      args.releasedMarker,
      args.orderId,
      args.expectedMarker,
      args.expectedInputVersion,
      args.observedFence,
      `${args.orderId}:payment`,
    ]);
    expect(sql).toContain(`"status" = 'needs_human_qa'`);
    expect(sql).toContain('"deliveryHoldReason" = ?');
    expect(sql).toContain('"inputVersion" = ?');
    expect(sql).toContain('"deliveryFenceVersion" = ?');
    expect(sql).toContain('"manualReviewRequired" = false');
    expect(sql).toContain('FROM "HumanQaReviewCase"');
    expect(sql).toContain('c."activeKey" = ?');
    expect(sql).toContain(`c."status" = 'open'`);
    expect(sql).not.toContain(':base_book'); // the exact active base-book case is validated/resolved by apply, in-tx
    expect(sql.match(/"deliveryFenceVersion"\s*=\s*"deliveryFenceVersion"\s*\+\s*1/g)).toHaveLength(1);
    expect(sql).not.toContain(`SET "status" = 'ready'`);
  });

  it('returns a 0-row CAS result without retrying or performing another fence bump', async () => {
    const { db, execute } = fakeDb(0);
    await expect(executeHumanVerifiedUnverifiedReleaseTransition(db, args)).resolves.toBe(0);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-single-page source or a target for another page before touching the DB', async () => {
    const { db, execute } = fakeDb(1);
    await expect(executeHumanVerifiedUnverifiedReleaseTransition(db, {
      ...args,
      expectedMarker: 'safety_hold:unverified:page:6,page:7',
    })).rejects.toThrow('not a single-page safety-unverified marker');
    await expect(executeHumanVerifiedUnverifiedReleaseTransition(db, {
      ...args,
      releasedMarker: 'qa_human_verified:safety:unverified:page:7',
    })).rejects.toThrow('released marker must bind the same page');
    await expect(executeHumanVerifiedUnverifiedReleaseTransition(db, {
      ...args,
      releasedMarker: 'qa_released:safety:hazard:page:6:unsafe_pose',
    })).rejects.toThrow('released marker must bind the same page');
    expect(execute).not.toHaveBeenCalled();
  });
});
