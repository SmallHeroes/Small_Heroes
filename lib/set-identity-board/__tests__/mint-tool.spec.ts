import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import os from 'os';
import path from 'path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { canonicalHash } from '@/lib/canonical-json';
import {
  SET_BOARD_QA_RECHECK_RECEIPT_VERSION,
  liveMintDeps,
  parseArgs,
  runApprove,
  runCli,
  runMint,
  runRecheck,
  setBoardQaRecheckReceiptPath,
  type MintArgs,
  type MintDeps,
} from '@/scripts/mint-set-identity-board';
import { setIdentityBoardStorageKey } from '../liveResolverDeps';
import { buildSetIdentityBoardPrompt } from '../boardPrompt';
import { deriveExpectedSetBoardIdentity } from '../expectedIdentity';
import { validateSetIdentityBoardRegistryEntry } from '../registry';
import { computeSetDefinitionHash } from '../setDefinition';
import type { SetBoardPositiveAuthorityLeakError } from '../positiveAuthoritySpoilerGuard';
import { currentSetBoardAmbientDressingPolicy } from '../ambientDressing';
import {
  SET_BOARD_CONTENT_POLICY_VERSION,
  SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION,
  SET_IDENTITY_BOARD_RESERVED_PAGE_PLACEMENT_VERSION,
  SET_IDENTITY_BOARD_VERSION,
  SET_IDENTITY_REGISTRY_VERSION,
} from '../types';
import type { SetDefinition, SetIdentityBoardRegistryEntry } from '../types';
import { makeContract } from './board-fixtures';

/**
 * (P0-3b) The mint tool.
 *
 * Everything here is SYNTHETIC and injected — no image provider, no storage, no vision, no network, no spend. What
 * these specs are actually about is one property: THE CODE NEVER APPROVES. Not on a QA pass, not with a flag, not
 * by accident. `approvedBy`/`approvedAt` have exactly one writer, `--approve`, and it refuses over anything that
 * did not pass QA.
 */

const STORY = 'synthetic_story';
const IDENTITY_ID = 'set_alpha';
/** A RAW DB value on purpose — mint must normalize it, same as the live binder does (P0-2). */
const RAW_DB_STYLE = 'pencil_watercolor';
const NORMALIZED_STYLE = 'soft_hand_drawn_storybook';

const BOARD_BYTES = Buffer.from('SYNTHETIC-BOARD-PNG');
const BOARD_SHA = createHash('sha256').update(BOARD_BYTES).digest('hex');
const NOW = new Date('2026-07-17T09:00:00.000Z');

let tmp: string;
let contractPath: string;

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), 'mint-board-'));
  contractPath = path.join(tmp, 'contract.json');
  writeFileSync(contractPath, JSON.stringify(makeContract()));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
  vi.restoreAllMocks();
});
afterAll(() => vi.restoreAllMocks());

/** Silence the CLI's operator output; these specs assert on files and return values, not stdout. */
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

function makeDeps(overrides: Partial<MintDeps> = {}): MintDeps {
  return {
    renderBoard: vi.fn(async () => ({
      buffer: BOARD_BYTES,
      model: 'gpt-image-1',
      contentType: 'image/png',
    })),
    uploadBoard: vi.fn(async ({ identity }) => ({
      storageKey: setIdentityBoardStorageKey(identity),
      url: `https://cdn.example/${setIdentityBoardStorageKey(identity)}`,
    })),
    runBoardQa: vi.fn(async () => ({ qaStatus: 'passed' as const, qaFlags: [] })),
    loadBoardAsset: vi.fn(async ({ storageKey }) => ({
      buffer: BOARD_BYTES,
      url: `https://cdn.example/${storageKey}`,
    })),
    now: () => NOW,
    ...overrides,
  };
}

function mintArgs(overrides: Partial<MintArgs> = {}): MintArgs {
  return {
    mode: 'mint',
    story: STORY,
    identity: IDENTITY_ID,
    style: RAW_DB_STYLE,
    contract: contractPath,
    out: path.join(tmp, 'entry.json'),
    render: true,
    quality: 'low',
    ...overrides,
  };
}

function readEntry(p: string): SetIdentityBoardRegistryEntry {
  return JSON.parse(readFileSync(p, 'utf-8')) as SetIdentityBoardRegistryEntry;
}

function writeReservedContract() {
  const contract = makeContract();
  contract.recurringProps.push({
    id: 'prop_page_lantern',
    name: 'Page Lantern',
    description: 'page-conditioned content',
    firstRevealPage: 1,
  });
  contract.pageContracts[0]!.actionRequirements = [{
    checkId: 'action:places-page-lantern',
    subject: {
      kind: 'entity',
      entity: { kind: 'cast', id: contract.cast.child.id },
    },
    predicate: 'places',
    object: { kind: 'prop', id: 'prop_page_lantern' },
    polarity: 'must',
  }];
  contract.pageContracts[0]!.propConstraints = [{
    propId: 'prop_page_lantern',
    visibility: 'required',
    anchorId: 'anchor_hearth',
  }];
  writeFileSync(contractPath, JSON.stringify(contract));
  return contract;
}

function rewriteAsHistoricalV6(
  out: string,
  contract: ReturnType<typeof writeReservedContract>,
): SetIdentityBoardRegistryEntry {
  const current = readEntry(out);
  const { definition, expected } = deriveExpectedSetBoardIdentity({
    contract,
    setIdentityId: IDENTITY_ID,
    styleId: NORMALIZED_STYLE,
    frozenBoardVersion: SET_IDENTITY_BOARD_VERSION,
  });
  const historical: SetIdentityBoardRegistryEntry = {
    ...current,
    ...expected,
    promptHash: buildSetIdentityBoardPrompt(definition).promptHash,
  };
  writeFileSync(out, JSON.stringify(historical));
  return historical;
}

// ─────────────────────────────────────────────────────────────────────────────
// Spend is opt-in
// ─────────────────────────────────────────────────────────────────────────────

describe('mint — the render/upload path is OPT-IN and never runs by default', () => {
  it('without --render: renders nothing, uploads nothing, QAs nothing', async () => {
    const deps = makeDeps();
    const entry = await runMint(mintArgs({ render: false }), deps);

    expect(deps.renderBoard).not.toHaveBeenCalled();
    expect(deps.uploadBoard).not.toHaveBeenCalled();
    expect(deps.runBoardQa).not.toHaveBeenCalled();
    expect(entry.storageKey).toBe('');
    expect(entry.assetSha256).toBe('');
    expect(entry.qaStatus).toBe('pending');
    expect(entry.approvedBy).toBeNull();
    expect(entry.approvedAt).toBeNull();
  });

  it('parseArgs defaults render to false — a bare invocation cannot spend', () => {
    const args = parseArgs(['--story', STORY, '--identity', IDENTITY_ID, '--style', RAW_DB_STYLE, '--contract', 'c.json']);
    expect(args.mode).toBe('mint');
    expect((args as MintArgs).render).toBe(false);
    expect((args as MintArgs).quality).toBe('low');
  });

  it('--quality high is REFUSED (a board is a reference sheet, not a page)', () => {
    const base = ['--story', STORY, '--identity', IDENTITY_ID, '--style', RAW_DB_STYLE, '--contract', 'c.json'];
    expect(() => parseArgs([...base, '--quality', 'high'])).toThrow(/must be low or medium/);
    expect((parseArgs([...base, '--quality', 'medium']) as MintArgs).quality).toBe('medium');
  });

  it('--help prints usage and does nothing else', async () => {
    const deps = makeDeps();
    await runCli(['--help'], deps);
    expect(deps.renderBoard).not.toHaveBeenCalled();
    expect(deps.uploadBoard).not.toHaveBeenCalled();
  });

  it('a dry preview cannot overwrite any existing output or Registry evidence', async () => {
    const out = path.join(tmp, 'preserved.json');
    const sentinel = '{"historical":"evidence"}';
    writeFileSync(out, sentinel);
    const deps = makeDeps();
    await expect(runMint(mintArgs({ out, render: false }), deps)).rejects.toThrow(
      /target output already exists/,
    );
    expect(readFileSync(out, 'utf8')).toBe(sentinel);
    expect(deps.renderBoard).not.toHaveBeenCalled();
    expect(deps.uploadBoard).not.toHaveBeenCalled();
    expect(deps.runBoardQa).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The full pipeline
// ─────────────────────────────────────────────────────────────────────────────

describe('mint --render — render → sha → content-addressed upload → QA → entry', () => {
  it('rejects an existing target before render, upload, or QA and preserves its bytes', async () => {
    const out = path.join(tmp, 'preserved.json');
    const sentinel = '{"historical":"candidate"}';
    writeFileSync(out, sentinel);
    const deps = makeDeps();
    await expect(runMint(mintArgs({ out }), deps)).rejects.toThrow(
      /target output already exists/,
    );
    expect(readFileSync(out, 'utf8')).toBe(sentinel);
    expect(deps.renderBoard).not.toHaveBeenCalled();
    expect(deps.uploadBoard).not.toHaveBeenCalled();
    expect(deps.runBoardQa).not.toHaveBeenCalled();
  });

  it('loses a publication race fail-closed without replacing the winner bytes', async () => {
    const out = path.join(tmp, 'race.json');
    const sentinel = '{"winner":"other-process"}';
    const deps = makeDeps({
      renderBoard: vi.fn(async () => {
        writeFileSync(out, sentinel);
        return {
          buffer: BOARD_BYTES,
          model: 'gpt-image-1',
          contentType: 'image/png',
        };
      }),
    });
    await expect(runMint(mintArgs({ out }), deps)).rejects.toMatchObject({
      code: 'EEXIST',
    });
    expect(readFileSync(out, 'utf8')).toBe(sentinel);
  });

  it('records v7 identity for a qualifying reserved-placement successor', async () => {
    writeReservedContract();
    const entry = await runMint(mintArgs(), makeDeps());
    expect(entry.boardVersion).toBe(
      SET_IDENTITY_BOARD_RESERVED_PAGE_PLACEMENT_VERSION,
    );
    expect(entry.contentPolicyDigest).toBe(
      deriveExpectedSetBoardIdentity({
        contract: writeReservedContract(),
        setIdentityId: IDENTITY_ID,
        styleId: NORMALIZED_STYLE,
      }).expected.contentPolicyDigest,
    );
  });

  it('rejects a blocked transient prop in positive authority before render/upload/QA callbacks are reachable', async () => {
    const contract = makeContract();
    contract.recurringProps.push({
      id: 'prop_reveal_key',
      name: 'Hidden Brass Key',
      description: 'a page-conditioned key',
      firstRevealPage: 2,
    });
    contract.setBoardAuthorities![0].locations[0].lighting = 'a bright spotlight on the key';
    writeFileSync(contractPath, JSON.stringify(contract));

    const deps = makeDeps();
    await expect(runMint(mintArgs(), deps)).rejects.toMatchObject({
      name: 'SetBoardPositiveAuthorityLeakError',
      code: 'set_board_positive_authority_leak',
      fieldPath: 'locations[0].lighting',
      blockedIdentity: 'prop_reveal_key',
      matchedTerm: 'key',
    } satisfies Partial<SetBoardPositiveAuthorityLeakError>);
    expect(deps.renderBoard).not.toHaveBeenCalled();
    expect(deps.uploadBoard).not.toHaveBeenCalled();
    expect(deps.runBoardQa).not.toHaveBeenCalled();
  });

  it('runs the whole pipeline in order and content-addresses the upload by the RENDERED bytes sha', async () => {
    const deps = makeDeps();
    const entry = await runMint(mintArgs(), deps);

    expect(deps.renderBoard).toHaveBeenCalledTimes(1);
    expect(deps.uploadBoard).toHaveBeenCalledTimes(1);
    expect(deps.runBoardQa).toHaveBeenCalledTimes(1);

    // The sha is computed from the bytes that came back from the renderer — not declared anywhere.
    expect(entry.assetSha256).toBe(BOARD_SHA);
    const uploaded = vi.mocked(deps.uploadBoard).mock.calls[0][0];
    expect(uploaded.identity.assetSha256).toBe(BOARD_SHA);
    expect(entry.storageKey).toContain(BOARD_SHA); // content-addressed by construction
    expect(entry.model).toBe('gpt-image-1');
    expect(entry.quality).toBe('low');
  });

  it('renders at the requested LOW/MEDIUM quality — never anything else', async () => {
    const deps = makeDeps();
    await runMint(mintArgs({ quality: 'medium' }), deps);
    expect(vi.mocked(deps.renderBoard).mock.calls[0][0].quality).toBe('medium');
  });

  it('QAs the UPLOADED url (the durable object), not a local buffer', async () => {
    const deps = makeDeps();
    const entry = await runMint(mintArgs(), deps);
    const qaArg = vi.mocked(deps.runBoardQa).mock.calls[0][0];
    expect(qaArg.imageUrl).toBe(`https://cdn.example/${entry.storageKey}`);
    expect(qaArg.def.setIdentityId).toBe(IDENTITY_ID);
  });

  it('(P0-2) normalizes --style ONCE — the entry is keyed by the StyleId a live order binds with', async () => {
    const entry = await runMint(mintArgs(), makeDeps());
    expect(entry.styleId).toBe(NORMALIZED_STYLE);
    expect(entry.styleId).not.toBe(RAW_DB_STYLE);
    // …and the set hash is the one the live path recomputes for that normalized id.
    expect(entry.setDefinitionHash).toBe(computeSetDefinitionHash(makeContract(), IDENTITY_ID, NORMALIZED_STYLE));
  });

  it('a mint whose QA THROWS writes no entry at all (fail-closed, never a half-filed board)', async () => {
    const out = path.join(tmp, 'never-written.json');
    const deps = makeDeps({ runBoardQa: vi.fn(async () => { throw new Error('vision down'); }) });
    await expect(runMint(mintArgs({ out }), deps)).rejects.toThrow('vision down');
    expect(() => readEntry(out)).toThrow(); // no file
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// THE property: code never auto-approves
// ─────────────────────────────────────────────────────────────────────────────

describe('mint NEVER auto-approves', () => {
  it('a PASSING QA still leaves approvedBy/approvedAt null', async () => {
    const entry = await runMint(mintArgs(), makeDeps());
    expect(entry.qaStatus).toBe('passed'); // QA is happy…
    expect(entry.approvedBy).toBeNull(); // …and the board is still not approved.
    expect(entry.approvedAt).toBeNull();
    expect(readEntry(mintArgs().out!).approvedBy).toBeNull(); // and that's what hit disk
  });

  it('the freshly minted, QA-PASSED entry is REJECTED by the live validator until a human signs it', async () => {
    // The end-to-end proof that "minted" ≠ "usable": this is the exact validation the paid binder runs.
    const entry = await runMint(mintArgs(), makeDeps());
    const validation = validateSetIdentityBoardRegistryEntry(entry, {
      registryVersion: SET_IDENTITY_REGISTRY_VERSION,
      boardVersion: SET_IDENTITY_BOARD_VERSION,
      storyKey: STORY,
      setIdentityId: IDENTITY_ID,
      styleId: NORMALIZED_STYLE,
      setDefinitionHash: entry.setDefinitionHash,
      contentPolicyDigest: entry.contentPolicyDigest,
      declaredPropIds: entry.declaredPropIds,
    });
    expect(validation.ok).toBe(false);
    expect((validation as { errors: string[] }).errors.join(' ')).toMatch(/a human must explicitly approve/);
  });

  it('qaStatus comes FROM the QA — a failing QA is recorded as failed, not massaged', async () => {
    const deps = makeDeps({
      runBoardQa: vi.fn(async () => ({ qaStatus: 'failed' as const, qaFlags: ['people', 'text'] })),
    });
    const entry = await runMint(mintArgs(), deps);
    expect(entry.qaStatus).toBe('failed');
    expect(entry.approvedBy).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// --recheck: one Vision-only adjudication over the exact already-stored bytes
// ─────────────────────────────────────────────────────────────────────────────

describe('--recheck — one-shot, same-byte, Vision-only QA adjudication', () => {
  async function failedEntry(out = path.join(tmp, 'entry.json')) {
    await runMint(
      mintArgs({ out }),
      makeDeps({
        runBoardQa: vi.fn(async () => ({
          qaStatus: 'failed' as const,
          qaFlags: ['excluded-prop:prop_synthetic'],
        })),
      }),
    );
    return out;
  }

  it('parses only the exact recheck surface and refuses spend/approval flags', () => {
    expect(parseArgs(['--recheck', '--entry', 'e.json', '--contract', 'c.json'])).toEqual({
      mode: 'recheck',
      entry: 'e.json',
      contract: 'c.json',
    });
    expect(() => parseArgs(['--recheck', '--entry', 'e.json'])).toThrow(/--contract is required/);
    expect(() =>
      parseArgs(['--recheck', '--entry', 'e.json', '--contract', 'c.json', '--render']),
    ).toThrow(/--render cannot be used with --recheck/);
    expect(() =>
      parseArgs(['--recheck', '--entry', 'e.json', '--contract', 'c.json', '--approved-by', 'guy']),
    ).toThrow(/--approved-by cannot be used with --recheck/);
  });

  it('arms before Vision, verifies exact bytes, passes without render/upload, and remains unapproved', async () => {
    const out = await failedEntry();
    const before = readEntry(out);
    const receiptPath = setBoardQaRecheckReceiptPath(out);
    const recheckTime = new Date('2026-07-17T09:05:00.000Z');
    const runBoardQa = vi.fn(async () => {
      const armed = JSON.parse(readFileSync(receiptPath, 'utf-8')) as Record<string, unknown>;
      expect(armed.status).toBe('armed');
      expect(armed.result).toBeNull();
      return { qaStatus: 'passed' as const, qaFlags: [] };
    });
    const deps = makeDeps({ runBoardQa, now: () => recheckTime });

    const result = await runRecheck({ mode: 'recheck', entry: out, contract: contractPath }, deps);

    expect(deps.renderBoard).not.toHaveBeenCalled();
    expect(deps.uploadBoard).not.toHaveBeenCalled();
    expect(deps.loadBoardAsset).toHaveBeenCalledTimes(1);
    expect(runBoardQa).toHaveBeenCalledTimes(1);
    expect(result.qaStatus).toBe('passed');
    expect(result.qaCheckedAt).toBe(recheckTime.toISOString());
    expect(result.approvedBy).toBeNull();
    expect(result.approvedAt).toBeNull();
    expect(readEntry(out)).toEqual(result);
    expect({ ...result, qaStatus: before.qaStatus, qaCheckedAt: before.qaCheckedAt }).toEqual(before);

    const stored = JSON.parse(readFileSync(receiptPath, 'utf-8')) as Record<string, unknown>;
    const { digest, ...payload } = stored;
    expect(stored.version).toBe(SET_BOARD_QA_RECHECK_RECEIPT_VERSION);
    expect(stored.instructionVersion).toBe('set-board-qa-instruction/v4');
    expect(stored.status).toBe('completed');
    expect(stored.result).toEqual({
      qaStatus: 'passed',
      qaFlagCount: 0,
      qaFlagsDigest: canonicalHash([]),
      qaCheckedAt: recheckTime.toISOString(),
    });
    expect(digest).toBe(canonicalHash(payload));
  });

  it('rechecks a current v7 candidate under QA instruction v4', async () => {
    writeReservedContract();
    const out = await failedEntry();
    expect(readEntry(out).boardVersion).toBe(
      SET_IDENTITY_BOARD_RESERVED_PAGE_PLACEMENT_VERSION,
    );
    const result = await runRecheck(
      { mode: 'recheck', entry: out, contract: contractPath },
      makeDeps(),
    );
    expect(result.qaStatus).toBe('passed');
    const receipt = JSON.parse(
      readFileSync(setBoardQaRecheckReceiptPath(out), 'utf8'),
    ) as { instructionVersion: string };
    expect(receipt.instructionVersion).toBe('set-board-qa-instruction/v4');
  });

  it('rejects a historical failed v6 row after v7 cutover before bytes, receipt, or Vision', async () => {
    const contract = writeReservedContract();
    const out = await failedEntry();
    rewriteAsHistoricalV6(out, contract);
    const before = readFileSync(out, 'utf8');
    const deps = makeDeps();
    await expect(runRecheck(
      { mode: 'recheck', entry: out, contract: contractPath },
      deps,
    )).rejects.toThrow(/boardVersion mismatch/);
    expect(readFileSync(out, 'utf8')).toBe(before);
    expect(deps.loadBoardAsset).not.toHaveBeenCalled();
    expect(deps.runBoardQa).not.toHaveBeenCalled();
    expect(() => readFileSync(setBoardQaRecheckReceiptPath(out), 'utf8'))
      .toThrow();
  });

  it('persists a failed adjudication without changing the registry and refuses every second recheck', async () => {
    const out = await failedEntry();
    const before = readEntry(out);
    const deps = makeDeps({
      runBoardQa: vi.fn(async () => ({
        qaStatus: 'failed' as const,
        qaFlags: ['people', 'excluded-prop:prop_synthetic'],
      })),
    });

    await expect(runRecheck({ mode: 'recheck', entry: out, contract: contractPath }, deps)).resolves.toEqual(before);
    expect(readEntry(out)).toEqual(before);
    expect(deps.renderBoard).not.toHaveBeenCalled();
    expect(deps.uploadBoard).not.toHaveBeenCalled();
    expect(deps.runBoardQa).toHaveBeenCalledTimes(1);

    const receipt = JSON.parse(readFileSync(setBoardQaRecheckReceiptPath(out), 'utf-8')) as {
      status: string;
      result: { qaStatus: string; qaFlagCount: number; qaFlagsDigest: string };
    };
    expect(receipt.status).toBe('completed');
    expect(receipt.result).toEqual(expect.objectContaining({
      qaStatus: 'failed',
      qaFlagCount: 2,
      qaFlagsDigest: canonicalHash(['people', 'excluded-prop:prop_synthetic']),
    }));

    await expect(runRecheck({ mode: 'recheck', entry: out, contract: contractPath }, deps)).rejects.toThrow(
      /one-shot recheck record already exists/,
    );
    expect(deps.loadBoardAsset).toHaveBeenCalledTimes(1);
    expect(deps.runBoardQa).toHaveBeenCalledTimes(1);
  });

  it('leaves an armed one-shot record when Vision throws, so an unrecorded retry is impossible', async () => {
    const out = await failedEntry();
    const deps = makeDeps({
      runBoardQa: vi.fn(async () => {
        throw new Error('synthetic Vision outage');
      }),
    });

    await expect(runRecheck({ mode: 'recheck', entry: out, contract: contractPath }, deps)).rejects.toThrow(
      'synthetic Vision outage',
    );
    expect(readEntry(out).qaStatus).toBe('failed');
    const receipt = JSON.parse(readFileSync(setBoardQaRecheckReceiptPath(out), 'utf-8')) as Record<string, unknown>;
    expect(receipt.status).toBe('armed');
    expect(receipt.result).toBeNull();
    await expect(runRecheck({ mode: 'recheck', entry: out, contract: contractPath }, deps)).rejects.toThrow(
      /one-shot recheck record already exists/,
    );
  });

  it('reports the same bounded one-shot refusal when another process wins the exclusive-create race', async () => {
    const out = await failedEntry();
    const receiptPath = setBoardQaRecheckReceiptPath(out);
    const deps = makeDeps({
      loadBoardAsset: vi.fn(async () => {
        writeFileSync(receiptPath, '{"synthetic":"race-winner"}');
        return { buffer: BOARD_BYTES, url: 'https://cdn.example/race-winner' };
      }),
    });

    await expect(runRecheck({ mode: 'recheck', entry: out, contract: contractPath }, deps)).rejects.toThrow(
      /refusing to recheck: the one-shot recheck record already exists/,
    );
    expect(deps.runBoardQa).not.toHaveBeenCalled();
    expect(deps.renderBoard).not.toHaveBeenCalled();
    expect(deps.uploadBoard).not.toHaveBeenCalled();
  });

  it('rejects identity/prompt drift and byte drift before Vision and before arming', async () => {
    const out = await failedEntry();
    const original = readEntry(out);
    writeFileSync(out, JSON.stringify({ ...original, setDefinitionHash: 'e'.repeat(64) }));
    const identityDeps = makeDeps();
    await expect(runRecheck({ mode: 'recheck', entry: out, contract: contractPath }, identityDeps)).rejects.toThrow(
      /setDefinitionHash mismatch/,
    );
    expect(identityDeps.loadBoardAsset).not.toHaveBeenCalled();
    expect(identityDeps.runBoardQa).not.toHaveBeenCalled();

    const promptDrift = { ...original, promptHash: 'f'.repeat(64) };
    writeFileSync(out, JSON.stringify(promptDrift));
    const promptDeps = makeDeps();
    await expect(runRecheck({ mode: 'recheck', entry: out, contract: contractPath }, promptDeps)).rejects.toThrow(
      /promptHash no longer matches/,
    );
    expect(promptDeps.loadBoardAsset).not.toHaveBeenCalled();
    expect(promptDeps.runBoardQa).not.toHaveBeenCalled();
    expect(() => readFileSync(setBoardQaRecheckReceiptPath(out), 'utf-8')).toThrow();

    writeFileSync(out, JSON.stringify(original));
    const byteDeps = makeDeps({
      loadBoardAsset: vi.fn(async () => ({
        buffer: Buffer.from('different bytes'),
        url: 'https://cdn.example/different',
      })),
    });
    await expect(runRecheck({ mode: 'recheck', entry: out, contract: contractPath }, byteDeps)).rejects.toThrow(
      /board bytes changed/,
    );
    expect(byteDeps.runBoardQa).not.toHaveBeenCalled();
    expect(() => readFileSync(setBoardQaRecheckReceiptPath(out), 'utf-8')).toThrow();
  });

  it.each([
    ['pending', false],
    ['passed', false],
    ['failed', true],
  ] as const)('rejects a %s or approved entry before loading bytes', async (qaStatus, approved) => {
    const out = await failedEntry();
    const entry = {
      ...readEntry(out),
      qaStatus,
      approvedBy: approved ? 'guy' : null,
      approvedAt: approved ? NOW.toISOString() : null,
    };
    writeFileSync(out, JSON.stringify(entry));
    const deps = makeDeps();
    await expect(runRecheck({ mode: 'recheck', entry: out, contract: contractPath }, deps)).rejects.toThrow(
      approved ? /approved registry entry is immutable/ : /qaStatus is .* not "failed"/,
    );
    expect(deps.loadBoardAsset).not.toHaveBeenCalled();
    expect(deps.runBoardQa).not.toHaveBeenCalled();
  });

  it('routes --recheck through runCli without making render or upload reachable', async () => {
    const out = await failedEntry();
    const deps = makeDeps();
    await runCli(['--recheck', '--entry', out, '--contract', contractPath], deps);
    expect(deps.renderBoard).not.toHaveBeenCalled();
    expect(deps.uploadBoard).not.toHaveBeenCalled();
    expect(deps.loadBoardAsset).toHaveBeenCalledTimes(1);
    expect(readEntry(out).qaStatus).toBe('passed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// --approve: the ONLY writer of the approval stamp
// ─────────────────────────────────────────────────────────────────────────────

describe('--approve — the only path to an approved board, and only over a QA pass', () => {
  async function mintWith(qaStatus: 'passed' | 'failed', out = path.join(tmp, 'entry.json')) {
    await runMint(
      mintArgs({ out }),
      makeDeps({ runBoardQa: vi.fn(async () => ({ qaStatus, qaFlags: qaStatus === 'failed' ? ['people'] : [] })) })
    );
    return out;
  }

  it('REFUSES to approve when qaStatus is "failed"', async () => {
    const out = await mintWith('failed');
    await expect(runApprove({ mode: 'approve', entry: out, contract: contractPath, approvedBy: 'guy' }, { now: () => NOW })).rejects.toThrow(
      /refusing to approve: qaStatus is "failed"/
    );
    expect(readEntry(out).approvedBy).toBeNull(); // and it did not write
  });

  it('REFUSES to approve when qaStatus is "pending" (an unrendered/unQA\'d candidate)', async () => {
    const out = path.join(tmp, 'dry.json');
    await runMint(mintArgs({ out, render: false }), makeDeps());
    await expect(runApprove({ mode: 'approve', entry: out, contract: contractPath, approvedBy: 'guy' }, { now: () => NOW })).rejects.toThrow(
      /refusing to approve: qaStatus is "pending"/
    );
    expect(readEntry(out).approvedBy).toBeNull();
  });

  it('REFUSES to approve an entry with no bytes behind it', async () => {
    // A hand-edited entry claiming a QA pass but pointing at nothing — a human's name must not land on it.
    const out = path.join(tmp, 'hollow.json');
    const hollow = { ...(await runMint(mintArgs(), makeDeps())), storageKey: '', assetSha256: '' };
    writeFileSync(out, JSON.stringify(hollow));
    await expect(runApprove({ mode: 'approve', entry: out, contract: contractPath, approvedBy: 'guy' }, { now: () => NOW })).rejects.toThrow(
      /no storageKey\/assetSha256/
    );
  });

  it('APPROVES a QA-passed entry — and this is what makes the live validator accept it', async () => {
    const out = await mintWith('passed');
    const approved = await runApprove({ mode: 'approve', entry: out, contract: contractPath, approvedBy: 'guy' }, { now: () => NOW });

    expect(approved.approvedBy).toBe('guy');
    expect(approved.approvedAt).toBe(NOW.toISOString());
    expect(readEntry(out).approvedBy).toBe('guy'); // persisted

    const validation = validateSetIdentityBoardRegistryEntry(approved, {
      registryVersion: SET_IDENTITY_REGISTRY_VERSION,
      boardVersion: SET_IDENTITY_BOARD_VERSION,
      storyKey: STORY,
      setIdentityId: IDENTITY_ID,
      styleId: NORMALIZED_STYLE,
      setDefinitionHash: approved.setDefinitionHash,
      contentPolicyDigest: approved.contentPolicyDigest,
      declaredPropIds: approved.declaredPropIds,
    });
    expect(validation.ok).toBe(true);
  });

  it('approves a current v7 successor after re-deriving its exact forward contract authority', async () => {
    writeReservedContract();
    const out = await mintWith('passed');
    const approved = await runApprove(
      {
        mode: 'approve',
        entry: out,
        contract: contractPath,
        approvedBy: 'guy',
      },
      { now: () => NOW },
    );
    expect(approved.boardVersion).toBe(
      SET_IDENTITY_BOARD_RESERVED_PAGE_PLACEMENT_VERSION,
    );
    expect(approved.approvedBy).toBe('guy');
  });

  it('rejects a QA-passed historical v6 row after v7 cutover without changing its bytes', async () => {
    const contract = writeReservedContract();
    const out = await mintWith('passed');
    rewriteAsHistoricalV6(out, contract);
    const before = readFileSync(out, 'utf8');
    await expect(runApprove(
      {
        mode: 'approve',
        entry: out,
        contract: contractPath,
        approvedBy: 'guy',
      },
      { now: () => NOW },
    )).rejects.toThrow(/boardVersion mismatch/);
    expect(readFileSync(out, 'utf8')).toBe(before);
  });

  it('rejects a partial approval stamp instead of repairing or overwriting it', async () => {
    const out = await mintWith('passed');
    const partial = { ...readEntry(out), approvedBy: 'guy', approvedAt: null };
    writeFileSync(out, JSON.stringify(partial));
    const before = readFileSync(out, 'utf8');
    await expect(runApprove(
      {
        mode: 'approve',
        entry: out,
        contract: contractPath,
        approvedBy: 'guy',
      },
      { now: () => NOW },
    )).rejects.toThrow(/partial approval stamp/);
    expect(readFileSync(out, 'utf8')).toBe(before);
  });

  it('approving changes ONLY approvedBy/approvedAt — never QA, bytes, or identity', async () => {
    const out = await mintWith('passed');
    const before = readEntry(out);
    const after = await runApprove({ mode: 'approve', entry: out, contract: contractPath, approvedBy: 'guy' }, { now: () => NOW });
    expect({ ...after, approvedBy: null, approvedAt: null }).toEqual(before);
  });

  it('is idempotent — re-approving an approved board keeps the ORIGINAL approver and timestamp', async () => {
    const out = await mintWith('passed');
    await runApprove({ mode: 'approve', entry: out, contract: contractPath, approvedBy: 'guy' }, { now: () => NOW });
    const again = await runApprove(
      { mode: 'approve', entry: out, contract: contractPath, approvedBy: 'someone-else' },
      { now: () => new Date('2027-01-01T00:00:00.000Z') }
    );
    expect(again.approvedBy).toBe('guy');
    expect(again.approvedAt).toBe(NOW.toISOString());
  });

  it('--approve requires a named human', () => {
    expect(() => parseArgs(['--approve', '--entry', 'e.json', '--contract', 'c.json'])).toThrow(/--approved-by is required/);
    expect(() => parseArgs(['--approve', '--contract', 'c.json', '--approved-by', 'guy'])).toThrow(/--entry is required/);
    expect(() => parseArgs(['--approve', '--entry', 'e.json', '--approved-by', 'guy'])).toThrow(/--contract is required/);
  });

  it('the approve path never renders or uploads anything', async () => {
    const out = await mintWith('passed');
    const deps = makeDeps();
    await runCli(['--approve', '--entry', out, '--contract', contractPath, '--approved-by', 'guy'], deps);
    expect(deps.renderBoard).not.toHaveBeenCalled();
    expect(deps.uploadBoard).not.toHaveBeenCalled();
    expect(readEntry(out).approvedBy).toBe('guy');
  });
});

/**
 * (P1-6) THE ADAPTER SEAM — the bypass the core's own tests cannot see.
 *
 * `qaSetIdentityBoardImage` is correctly fail-closed, and board-qa.spec.ts proves it. But those specs inject their
 * own `callVision`, so they exercise the CORE and never touch the LIVE adapter that ships. The adapter used to
 * coerce `parsed.flags` to `[]` when it was not an array — erasing the evidence BEFORE the fail-closed core could
 * judge it. `{"result":"clean"}` became `{flags:[]}` → "no contamination" → passed → written to the registry →
 * approvable by `--approve`. The core was never wrong; it was never shown the truth.
 *
 * These tests therefore go THROUGH `liveMintDeps.runBoardQa` (real adapter, mocked HTTP) — the only place the
 * coercion could hide. No network, no spend.
 */
describe('mint — the LIVE vision adapter is fail-closed (P1-6 seam)', () => {
  const DEF: SetDefinition = {
    boardVersion: SET_IDENTITY_BOARD_VERSION,
    storyKey: 'synthetic_story',
    styleId: 'detailed_whimsical_world',
    setIdentityId: 'set_alpha',
    locations: [],
    zones: [],
    fixedSetFacts: [],
    contentPolicy: {
      version: SET_BOARD_CONTENT_POLICY_VERSION,
      includedPropIds: [],
      excludedProps: [],
      ambientDressing: currentSetBoardAmbientDressingPolicy(),
    },
    positiveAuthorityPolicy: {
      version: SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION,
      blockedCast: [],
      blockedProps: [],
    },
  };

  /** Mock the chat-completions call so the adapter parses `content` exactly as it would in production. */
  function stubVisionContent(content: string): void {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ choices: [{ message: { content } }] }),
      }))
    );
  }

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key-not-used-no-network';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENAI_API_KEY;
  });

  const MALFORMED: Array<[string, string]> = [
    ['a verdict with no flags key at all', '{"result":"clean"}'],
    ['flags as a string', '{"flags":"none"}'],
    ['an empty object', '{}'],
    ['flags with non-string entries', '{"flags":[1,2]}'],
    ['flags as null', '{"flags":null}'],
    ['a bare array', '[]'],
  ];

  for (const [label, content] of MALFORMED) {
    it(`FAILS closed on ${label} — never "passed"`, async () => {
      stubVisionContent(content);
      const result = await liveMintDeps.runBoardQa({ imageUrl: 'https://example.test/board.png', def: DEF });
      expect(result.qaStatus).toBe('failed');
      expect(result.qaStatus).not.toBe('passed');
      expect(result.qaFlags.join(' ')).toMatch(/qa-response-malformed/);
    });
  }

  it('FAILS closed when the model returns non-JSON (the parse throws → qa-call-failed)', async () => {
    stubVisionContent('I could not analyse this image.');
    const result = await liveMintDeps.runBoardQa({ imageUrl: 'https://example.test/board.png', def: DEF });
    expect(result.qaStatus).toBe('failed');
    expect(result.qaFlags.join(' ')).toMatch(/qa-call-failed/);
  });

  it('FAILS closed on an HTTP error (no verdict was ever obtained)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500, text: async () => 'upstream exploded' }))
    );
    const result = await liveMintDeps.runBoardQa({ imageUrl: 'https://example.test/board.png', def: DEF });
    expect(result.qaStatus).toBe('failed');
    expect(result.qaFlags.join(' ')).toMatch(/qa-call-failed/);
  });

  it('a WELL-FORMED contaminated verdict still fails, carrying the real flags (unchanged)', async () => {
    stubVisionContent('{"flags":["people","panel-borders"]}');
    const result = await liveMintDeps.runBoardQa({ imageUrl: 'https://example.test/board.png', def: DEF });
    expect(result.qaStatus).toBe('failed');
    expect(result.qaFlags).toEqual(['people', 'panel-borders']);
  });

  it('a GENUINELY clean verdict still passes (the fix must not break the happy path)', async () => {
    stubVisionContent('{"flags":[]}');
    const result = await liveMintDeps.runBoardQa({ imageUrl: 'https://example.test/board.png', def: DEF });
    expect(result.qaStatus).toBe('passed');
    expect(result.qaFlags).toEqual([]);
  });
});
