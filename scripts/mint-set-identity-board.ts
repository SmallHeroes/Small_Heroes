/**
 * Offline CLI: mint a CANDIDATE Set Identity Board record from a frozen visual contract.
 *
 * MILESTONE A — this NEVER renders and NEVER spends. It loads a contract JSON, computes the setDefinitionHash, builds
 * the character-free board prompt, prints both, and writes a CANDIDATE registry entry (qaStatus:'pending',
 * approvedBy:null, approvedAt:null). Code never auto-approves. The `--render` path calls an INJECTED renderer, whose
 * default stub THROWS — real rendering is a later milestone.
 *
 * Run (not part of this step's verification):
 *   npx tsx scripts/mint-set-identity-board.ts --story <key> --identity <id> --style <db> --contract <path.json> [--out <path.json>]
 *
 * Kept env-free (no `server-only`) so it stays runnable via tsx.
 */
import path from 'path';
import { readFileSync } from 'fs';

import { styleIdFromDatabaseValue } from '@/lib/styles';
import type { BookVisualContract } from '@/lib/visual-contract-compiler';

import {
  SET_IDENTITY_BOARD_VERSION,
  SET_IDENTITY_REGISTRY_VERSION,
  buildSetIdentityBoardPrompt,
  computeSetDefinitionHash,
  projectSetDefinition,
  saveRegistryEntry,
  type SetDefinition,
  type SetIdentityBoardRegistryEntry,
} from '@/lib/set-identity-board';

/** A renderer is injected so the CLI stays pure/testable; the default one refuses to render in this milestone. */
export type BoardRenderer = (args: {
  def: SetDefinition;
  prompt: string;
  negativePrompt: string;
}) => Promise<{ storageKey: string; assetSha256: string; model: string; quality: string }>;

// TODO(milestone-B): replace with a real injected renderer (image provider + durable upload).
const notEnabledRenderer: BoardRenderer = async () => {
  throw new Error('offline mint render not enabled in this step');
};

interface CliArgs {
  story: string;
  identity: string;
  style: string;
  contract: string;
  out?: string;
  render: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const flags: Record<string, string> = {};
  let render = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--render') {
      render = true;
      continue;
    }
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) throw new Error(`missing value for --${key}`);
      flags[key] = value;
      i += 1;
    }
  }
  for (const required of ['story', 'identity', 'style', 'contract'] as const) {
    if (!flags[required]) throw new Error(`--${required} is required`);
  }
  return {
    story: flags.story,
    identity: flags.identity,
    style: flags.style,
    contract: flags.contract,
    out: flags.out,
    render,
  };
}

function defaultOutPath(args: CliArgs, styleId: string, setDefinitionHash: string): string {
  const safe = (s: string) => s.replace(/[^a-z0-9_-]+/gi, '_');
  return path.join(
    process.cwd(),
    'set-identity-board-candidates',
    `${safe(args.story)}.${safe(args.identity)}.${safe(styleId)}.${setDefinitionHash.slice(0, 12)}.json`
  );
}

export async function runMint(args: CliArgs, renderer: BoardRenderer): Promise<void> {
  const contract = JSON.parse(readFileSync(args.contract, 'utf-8')) as BookVisualContract;
  const styleId = styleIdFromDatabaseValue(args.style);

  const def = projectSetDefinition(contract, args.identity, styleId);
  const setDefinitionHash = computeSetDefinitionHash(contract, args.identity, styleId);
  const { prompt, negativePrompt, promptHash } = buildSetIdentityBoardPrompt(def);

  // eslint-disable-next-line no-console
  console.log(`setDefinitionHash: ${setDefinitionHash}`);
  // eslint-disable-next-line no-console
  console.log(`promptHash:        ${promptHash}`);
  // eslint-disable-next-line no-console
  console.log('\n--- BOARD PROMPT ---\n');
  // eslint-disable-next-line no-console
  console.log(prompt);
  // eslint-disable-next-line no-console
  console.log('\n--- NEGATIVE PROMPT ---\n');
  // eslint-disable-next-line no-console
  console.log(negativePrompt);

  // Candidate is minted PENDING + UNAPPROVED. Rendering is opt-in and refused in this milestone.
  let storageKey = '';
  let assetSha256 = '';
  let model = '(unrendered)';
  let quality = '(unrendered)';
  if (args.render) {
    const rendered = await renderer({ def, prompt, negativePrompt });
    storageKey = rendered.storageKey;
    assetSha256 = rendered.assetSha256;
    model = rendered.model;
    quality = rendered.quality;
  }

  const entry: SetIdentityBoardRegistryEntry = {
    registryVersion: SET_IDENTITY_REGISTRY_VERSION,
    boardVersion: SET_IDENTITY_BOARD_VERSION,
    storyKey: def.storyKey,
    setIdentityId: def.setIdentityId,
    styleId,
    setDefinitionHash,
    storageKey,
    assetSha256,
    promptHash,
    model,
    quality,
    qaStatus: 'pending',
    qaCheckedAt: '',
    approvedBy: null, // NEVER auto-approved
    approvedAt: null, // NEVER auto-approved
  };

  const outPath = args.out ?? defaultOutPath(args, styleId, setDefinitionHash);
  saveRegistryEntry(outPath, entry);
  // eslint-disable-next-line no-console
  console.log(`\nWrote CANDIDATE registry entry (pending, unapproved): ${outPath}`);
}

// Only run when invoked directly (keeps the module importable/testable without executing).
const invokedDirectly =
  typeof process !== 'undefined' && Array.isArray(process.argv) && /mint-set-identity-board\.ts$/.test(process.argv[1] ?? '');
if (invokedDirectly) {
  runMint(parseArgs(process.argv.slice(2)), notEnabledRenderer).catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
