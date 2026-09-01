import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { afterAll, describe, expect, it } from 'vitest';

import {
  SET_IDENTITY_BOARD_VERSION,
  SET_IDENTITY_REGISTRY_VERSION,
  computeExpectedRegistryKey,
  loadRegistryEntry,
  saveRegistryEntry,
  saveRegistryEntryCreateOnly,
  validateSetIdentityBoardRegistryEntry,
  verifyBoardAssetBytes,
  type ExpectedRegistryIdentity,
  type SetIdentityBoardRegistryEntry,
} from '../index';

const EXPECTED: ExpectedRegistryIdentity = {
  registryVersion: SET_IDENTITY_REGISTRY_VERSION,
  boardVersion: SET_IDENTITY_BOARD_VERSION,
  storyKey: 'synthetic_story',
  setIdentityId: 'set_alpha',
  styleId: 'detailed_whimsical_world',
  setDefinitionHash: 'a'.repeat(64),
  contentPolicyDigest: 'd'.repeat(64),
  declaredPropIds: [],
};

/** A fully-correct, human-approved, QA-passed entry. */
function approvedEntry(): SetIdentityBoardRegistryEntry {
  return {
    registryVersion: SET_IDENTITY_REGISTRY_VERSION,
    boardVersion: SET_IDENTITY_BOARD_VERSION,
    storyKey: 'synthetic_story',
    setIdentityId: 'set_alpha',
    styleId: 'detailed_whimsical_world',
    setDefinitionHash: 'a'.repeat(64),
    contentPolicyDigest: 'd'.repeat(64),
    declaredPropIds: [],
    storageKey: 'boards/set_alpha/board.png',
    assetSha256: 'b'.repeat(64),
    promptHash: 'c'.repeat(64),
    model: 'gpt-image-x',
    quality: 'high',
    qaStatus: 'passed',
    qaCheckedAt: '2026-07-17T00:00:00.000Z',
    approvedBy: 'guy',
    approvedAt: '2026-07-17T01:00:00.000Z',
  };
}

const tmpRoot = mkdtempSync(path.join(tmpdir(), 'set-identity-board-'));
afterAll(() => rmSync(tmpRoot, { recursive: true, force: true }));

describe('registry round-trip', () => {
  it('saves and loads an entry byte-for-byte', () => {
    const entry = approvedEntry();
    const file = path.join(tmpRoot, 'nested', 'entry.json');
    saveRegistryEntry(file, entry);
    expect(existsSync(file)).toBe(true);
    expect(loadRegistryEntry(file)).toEqual(entry);
  });

  it('returns null for a missing file', () => {
    expect(loadRegistryEntry(path.join(tmpRoot, 'does-not-exist.json'))).toBeNull();
  });

  it('create-only publication never replaces existing Registry evidence', () => {
    const file = path.join(tmpRoot, 'create-only', 'entry.json');
    const original = approvedEntry();
    saveRegistryEntryCreateOnly(file, original);
    const originalBytes = readFileSync(file, 'utf8');
    expect(() => saveRegistryEntryCreateOnly(file, {
      ...original,
      qaStatus: 'failed',
      approvedBy: null,
      approvedAt: null,
    })).toThrow(expect.objectContaining({ code: 'EEXIST' }));
    expect(readFileSync(file, 'utf8')).toBe(originalBytes);
  });
});

describe('validateSetIdentityBoardRegistryEntry — fail-closed', () => {
  it('ACCEPTS a fully-correct approved entry', () => {
    expect(validateSetIdentityBoardRegistryEntry(approvedEntry(), EXPECTED)).toEqual({ ok: true });
  });

  it('REJECTS an unapproved candidate (approvedBy/approvedAt null)', () => {
    const e = approvedEntry();
    e.approvedBy = null;
    e.approvedAt = null;
    const result = validateSetIdentityBoardRegistryEntry(e, EXPECTED);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/approvedBy|approvedAt/);
  });

  it('REJECTS the immediately prior set-board/v4 entry under current v5 authority', () => {
    const e = approvedEntry();
    e.boardVersion = 'set-board/v4';
    const result = validateSetIdentityBoardRegistryEntry(e, EXPECTED);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('boardVersion mismatch');
  });

  it('REJECTS the immediately prior set-registry/v4 entry under current v5 authority', () => {
    const e = approvedEntry();
    e.registryVersion = 'set-registry/v4';
    expect(validateSetIdentityBoardRegistryEntry(e, EXPECTED).ok).toBe(false);
  });

  it('REJECTS a wrong styleId', () => {
    const e = approvedEntry();
    e.styleId = 'soft_hand_drawn_storybook';
    expect(validateSetIdentityBoardRegistryEntry(e, EXPECTED).ok).toBe(false);
  });

  it('REJECTS a wrong setDefinitionHash', () => {
    const e = approvedEntry();
    e.setDefinitionHash = 'd'.repeat(64);
    expect(validateSetIdentityBoardRegistryEntry(e, EXPECTED).ok).toBe(false);
  });

  it('REJECTS a non-passed qaStatus', () => {
    for (const status of ['pending', 'failed'] as const) {
      const e = approvedEntry();
      e.qaStatus = status;
      expect(validateSetIdentityBoardRegistryEntry(e, EXPECTED).ok).toBe(false);
    }
  });

  it('REJECTS a non-object entry', () => {
    expect(validateSetIdentityBoardRegistryEntry(null, EXPECTED).ok).toBe(false);
    expect(validateSetIdentityBoardRegistryEntry('nope', EXPECTED).ok).toBe(false);
  });
});

describe('verifyBoardAssetBytes — byte fence', () => {
  it('ACCEPTS matching bytes', () => {
    const e = approvedEntry();
    expect(verifyBoardAssetBytes(e, e.assetSha256)).toEqual({ ok: true });
  });

  it('REJECTS changed bytes', () => {
    const e = approvedEntry();
    const result = verifyBoardAssetBytes(e, 'e'.repeat(64));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/changed/);
  });
});

describe('computeExpectedRegistryKey — global key', () => {
  it('joins the five identity fields', () => {
    expect(computeExpectedRegistryKey(approvedEntry())).toBe(
      ['synthetic_story', 'set_alpha', 'detailed_whimsical_world', 'a'.repeat(64), SET_IDENTITY_BOARD_VERSION].join('|')
    );
  });
});
