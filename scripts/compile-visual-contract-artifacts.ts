/**
 * WS0 — compile BookVisualContract IMPORT ARTIFACTS for the story bank (Guy/CI run; needs LLM access).
 *
 * NO RENDER. For each story SOURCE file it runs the text+imageDirection compile once, fail-closed vNext
 * validates the result, and writes a reviewable `<storyKey>.visual-contract.json` artifact. The runtime bank
 * path then LOADS these artifacts (no LLM on the customer path). Auto-compile first → the artifacts are then
 * human-reviewable (ChatGPT/Guy correct zones/cast where the auto-compile is wrong — a parallel track).
 *
 * A source file (`<storyKey>.source.json`) is the decoupling seam so this tool does not couple to the bank
 * loader's LLM/personalization signature; a separate extraction step (or CI) produces the sources:
 *   { "storyKey", "fullStoryText", "pageCount", "childName"?, "childGender"?,
 *     "companion"? { "id", "name"? } | null,
 *     "pageImageDirections"? [ { "pageNumber", "imageDirection" } ] }
 *
 * Usage (run with the server-only shim):
 *   tsx --require ./scripts/shims/register-server-only.cjs \
 *     scripts/compile-visual-contract-artifacts.ts --sources <dir> --out <dir> [--only <storyKey>]
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import {
  compileBookVisualContract,
  assertValidVNextVisualContract,
  computeVisualContractHash,
  CONTRACT_ARTIFACT_SUFFIX,
  type CompileBookVisualContractInput,
} from '@/lib/visual-contract-compiler';

const SOURCE_SUFFIX = '.source.json';

interface ContractSourceFile extends CompileBookVisualContractInput {
  storyKey: string;
}

function parseArgs(argv: string[]): { sources: string; out: string; only?: string } {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const sources = get('--sources');
  const out = get('--out');
  if (!sources || !out) {
    throw new Error('usage: --sources <dir> --out <dir> [--only <storyKey>]');
  }
  return { sources, out, only: get('--only') };
}

async function main(): Promise<void> {
  const { sources, out, only } = parseArgs(process.argv.slice(2));
  if (!existsSync(sources)) throw new Error(`sources dir not found: ${sources}`);
  mkdirSync(out, { recursive: true });

  const files = readdirSync(sources)
    .filter((f) => f.endsWith(SOURCE_SUFFIX))
    .sort();

  let compiled = 0;
  const failures: Array<{ storyKey: string; error: string }> = [];

  for (const file of files) {
    const raw = JSON.parse(readFileSync(path.join(sources, file), 'utf8')) as ContractSourceFile;
    const storyKey = raw.storyKey ?? file.replace(SOURCE_SUFFIX, '');
    if (only && storyKey !== only) continue;

    try {
      const contract = await compileBookVisualContract({ ...raw, storyKey });
      // Fail-closed on the STRICTER vNext rules (coverage / transitions / cast resolution) before writing.
      assertValidVNextVisualContract(contract);
      const contractHash = computeVisualContractHash(contract);
      const artifactPath = path.join(out, `${storyKey}${CONTRACT_ARTIFACT_SUFFIX}`);
      writeFileSync(artifactPath, `${JSON.stringify(contract, null, 2)}\n`, 'utf8');
      compiled += 1;
      console.log(`[compile-vc] ${storyKey} → ${artifactPath} (hash ${contractHash.slice(0, 12)}…)`);
    } catch (err) {
      failures.push({ storyKey, error: (err as Error).message });
      console.error(`[compile-vc] FAILED ${storyKey}: ${(err as Error).message}`);
    }
  }

  console.log(`[compile-vc] compiled ${compiled}/${files.length} artifact(s); ${failures.length} failure(s).`);
  if (failures.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
