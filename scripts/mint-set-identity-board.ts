/**
 * Offline CLI: the Set Identity Board MINT + APPROVE tool.
 *
 * This is the ONLY thing in the system allowed to create a board. The paid render path can look up, verify, and bind
 * an already-approved board and nothing else (see `lib/set-identity-board/resolveBoards.ts`) — so every board a
 * customer order can ever use came through here, and through a human.
 *
 * THE PIPELINE (`--render`):
 *   project SetDefinition → build the character-free board prompt (SAME style authority as page generation:
 *   getPositiveStylePromptBlock / getNegativeStylePromptBlock, via buildSetIdentityBoardPrompt) → render with the
 *   SAME model resolver as page generation (resolveStyle01GptModel) at LOW/MEDIUM quality → compute assetSha256 →
 *   upload CONTENT-ADDRESSED + NO-OVERWRITE → run the character-free vision QA → write a registry entry carrying
 *   qaStatus FROM THAT QA, `approvedBy:null`, `approvedAt:null`.
 *
 * CODE NEVER AUTO-APPROVES. There is no flag, no env var, and no QA result that makes this tool set
 * `approvedBy`/`approvedAt`. The ONLY writer of those two fields is `--approve`, a separate invocation that a human
 * types, and it REFUSES unless `qaStatus === 'passed'`. QA passing is necessary and explicitly not sufficient: a
 * clean vision pass means "no contamination detected", never "this is the right set".
 *
 * SPEND IS OPT-IN. Without `--render` this renders nothing, uploads nothing, and costs nothing — it prints the
 * hashes + prompt and writes an unrendered candidate preview. `--render` is the only door to the image provider,
 * and `--quality high` is refused outright (boards are references, not pages).
 *
 * USAGE:
 *   # 1. dry — no spend: print the prompt + hashes, write a candidate preview
 *   npx tsx scripts/mint-set-identity-board.ts --story <key> --identity <id> --style <db-or-style-id> \
 *       --contract <path.json> [--out <path.json>]
 *
 *   # 2. mint for real — RENDERS + UPLOADS (spends), QAs, writes the registry entry (pending, UNAPPROVED)
 *   npx tsx scripts/mint-set-identity-board.ts --story <key> --identity <id> --style <db-or-style-id> \
 *       --contract <path.json> --render [--quality low|medium] [--registry-root <dir>]
 *
 *   # 3. human approval — the ONLY step that can approve, and only over a QA-passed entry
 *   npx tsx scripts/mint-set-identity-board.ts --approve --entry <path.json> --approved-by "<name>"
 *
 * Kept env-free (no `server-only`) so it stays runnable via tsx. The provider / storage / vision adapters are
 * INJECTED and their live implementations are LAZY dynamic imports, so importing this module (in a test, say)
 * pulls in no OpenAI client, no Supabase client, and no env validation.
 */
import path from 'path';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

import { styleIdFromDatabaseValue } from '@/lib/styles';
import type { BookVisualContract } from '@/lib/visual-contract-compiler';

import {
  SET_IDENTITY_BOARD_VERSION,
  SET_IDENTITY_REGISTRY_VERSION,
  buildSetIdentityBoardPrompt,
  computeSetDefinitionHash,
  loadRegistryEntry,
  projectSetDefinition,
  qaSetIdentityBoardImage,
  saveRegistryEntry,
  setIdentityBoardRegistryPath,
  type BoardQaResult,
  type SetDefinition,
  type SetIdentityBoardRegistryEntry,
} from '@/lib/set-identity-board';
// Deep import: `setIdentityBoardStorageKey` is not on the barrel yet (see the report for the export request).
// It MUST come from here rather than be rebuilt locally — mint and the live binder agreeing on the storage key
// by construction is the entire point of there being one key-builder.
import {
  setIdentityBoardStorageKey,
  type BoardStorageIdentity,
} from '@/lib/set-identity-board/liveResolverDeps';

/** Board renders are references, not pages. HIGH is refused — see `parseQuality`. */
export type BoardQuality = 'low' | 'medium';

/** Renders the board image. Injected so the CLI is testable; the live one is the ONLY path that spends. */
export type BoardRenderer = (args: {
  def: SetDefinition;
  prompt: string;
  negativePrompt: string;
  quality: BoardQuality;
}) => Promise<{ buffer: Buffer; model: string; contentType: string }>;

/** Persists the board bytes content-addressed + no-overwrite, returning the durable descriptor. */
export type BoardUploader = (args: {
  identity: BoardStorageIdentity;
  buffer: Buffer;
  contentType: string;
}) => Promise<{ storageKey: string; url: string }>;

/** Runs the character-free vision QA over the uploaded board. */
export type BoardQaRunner = (args: { imageUrl: string; def: SetDefinition }) => Promise<BoardQaResult>;

export interface MintDeps {
  renderBoard: BoardRenderer;
  uploadBoard: BoardUploader;
  runBoardQa: BoardQaRunner;
  /** Injected clock — keeps `qaCheckedAt`/`approvedAt` deterministic under test. */
  now: () => Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Live adapters (lazy — importing this module must not construct any client)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The live renderer. Deliberately routed through the SAME `generateGPTImage` + `resolveStyle01GptModel` the page
 * path uses: a board rendered by a different model or a different style authority than the pages it is supposed to
 * anchor would be a reference that disagrees with its own book.
 */
const liveRenderBoard: BoardRenderer = async ({ prompt, negativePrompt, quality }) => {
  const [{ generateGPTImage }, { resolveStyle01GptModel }] = await Promise.all([
    import('@/lib/generate-image'),
    import('@/lib/style01-gptimage'),
  ]);
  const result = await generateGPTImage({
    finalPrompt: prompt,
    negativePrompt,
    size: '1024x1024',
    quality,
    modelOverride: resolveStyle01GptModel(),
  });
  return { buffer: result.buffer, model: result.model, contentType: 'image/png' };
};

/** The live uploader: the content-addressed, no-overwrite door added for P0-4a. There is no other. */
const liveUploadBoard: BoardUploader = async ({ identity, buffer, contentType }) => {
  const { uploadContentAddressedObjectNoOverwrite } = await import('@/lib/image-storage');
  const { url, storageKey } = await uploadContentAddressedObjectNoOverwrite({
    key: setIdentityBoardStorageKey(identity),
    buffer,
    contentType,
    expectedSha256: identity.assetSha256,
  });
  return { url, storageKey };
};

/**
 * The live vision adapter behind `qaSetIdentityBoardImage`. Mirrors the JSON-mode chat-completions shape used by
 * `lib/scene-memory/analyze.ts`. FAIL-CLOSED by omission: any throw here aborts the mint before an entry is
 * written, so a board whose QA could not run never reaches the registry as anything a human could approve.
 */
const liveRunBoardQa: BoardQaRunner = async ({ imageUrl, def }) =>
  qaSetIdentityBoardImage(
    { imageUrl, def },
    {
      callVision: async ({ imageUrl: url, instruction }) => {
        const apiKey = process.env.OPENAI_API_KEY?.trim();
        if (!apiKey) throw new Error('OPENAI_API_KEY missing — cannot run board QA');
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: process.env.CHILD_PHOTO_VISION_MODEL?.trim() || 'gpt-4o',
            max_tokens: 800,
            temperature: 0,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: `${instruction}\n\nReturn ONLY JSON: {"flags": ["..."]}` },
              {
                role: 'user',
                content: [
                  { type: 'text', text: 'Inspect this set reference sheet.' },
                  { type: 'image_url', image_url: { url, detail: 'high' } },
                ],
              },
            ],
          }),
        });
        if (!res.ok) throw new Error(`board_qa_vision_http_${res.status}: ${(await res.text()).slice(0, 200)}`);
        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        // (P1-6) Return the RAW parsed response. `callVision` is typed `Promise<unknown>` precisely so the
        // fail-closed core (`parseVisionFlags`) is the ONE judge of the shape — this adapter must not pre-judge it.
        //
        // The previous `Array.isArray(parsed.flags) ? parsed.flags.map(String) : []` ERASED THE EVIDENCE before the
        // core ever saw it: `{"result":"clean"}` / `{"flags":"none"}` / `{}` all collapsed to `{flags:[]}`, which
        // reads as "no contamination" → passed → written to the registry → approvable by `--approve`. And
        // `.map(String)` laundered `{flags:[1,2]}` into a well-formed string list, defeating the core's
        // non-string-entry check. A malformed verdict means "we could not tell", which must land on the same side
        // as "we found contamination" — this board becomes the reference every page of the set is rendered against.
        //
        // A non-JSON body throws out of here; the core `await`s inside its try, so that lands as `qa-call-failed`.
        return JSON.parse(data.choices?.[0]?.message?.content ?? '{}') as unknown;
      },
    }
  );

export const liveMintDeps: MintDeps = {
  renderBoard: liveRenderBoard,
  uploadBoard: liveUploadBoard,
  runBoardQa: liveRunBoardQa,
  now: () => new Date(),
};

// ─────────────────────────────────────────────────────────────────────────────
// CLI parsing
// ─────────────────────────────────────────────────────────────────────────────

export interface MintArgs {
  mode: 'mint';
  story: string;
  identity: string;
  style: string;
  contract: string;
  out?: string;
  registryRoot?: string;
  /** The ONLY door to the image provider + storage. Default false → zero spend. */
  render: boolean;
  quality: BoardQuality;
}

export interface ApproveArgs {
  mode: 'approve';
  entry: string;
  approvedBy: string;
}

export type CliArgs = MintArgs | ApproveArgs;

export const USAGE = `mint-set-identity-board — mint + approve Set Identity Boards (offline)

  DRY (no spend):
    --story <key> --identity <id> --style <db-or-style-id> --contract <path.json> [--out <path.json>]

  MINT (RENDERS + UPLOADS — spends):
    ... --render [--quality low|medium] [--registry-root <dir>] [--out <path.json>]

  APPROVE (the only step that may approve; refuses unless qaStatus === 'passed'):
    --approve --entry <path.json> --approved-by "<name>"`;

function parseQuality(raw: string | undefined): BoardQuality {
  const q = (raw ?? 'low').trim().toLowerCase();
  if (q === 'low' || q === 'medium') return q;
  // Not a typo-guard — a cost fence. A board is a reference sheet; HIGH is for the pages it anchors.
  throw new Error(`--quality must be low or medium (got "${raw}") — boards are never rendered at high quality`);
}

export function parseArgs(argv: string[]): CliArgs {
  const flags: Record<string, string> = {};
  const bare = new Set<string>();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) {
      bare.add(key);
      continue;
    }
    flags[key] = value;
    i += 1;
  }

  if (bare.has('approve')) {
    for (const required of ['entry', 'approved-by'] as const) {
      if (!flags[required]?.trim()) throw new Error(`--${required} is required with --approve`);
    }
    return { mode: 'approve', entry: flags.entry, approvedBy: flags['approved-by'].trim() };
  }

  for (const required of ['story', 'identity', 'style', 'contract'] as const) {
    if (!flags[required]) throw new Error(`--${required} is required`);
  }
  return {
    mode: 'mint',
    story: flags.story,
    identity: flags.identity,
    style: flags.style,
    contract: flags.contract,
    out: flags.out,
    registryRoot: flags['registry-root'],
    render: bare.has('render'),
    quality: parseQuality(flags.quality),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MINT
// ─────────────────────────────────────────────────────────────────────────────

/** Where an UNRENDERED preview goes — deliberately NOT the registry; nothing lives there but real boards. */
function candidatePreviewPath(args: MintArgs, styleId: string, setDefinitionHash: string): string {
  const safe = (s: string) => s.replace(/[^a-z0-9_-]+/gi, '_');
  return path.join(
    process.cwd(),
    'set-identity-board-candidates',
    `${safe(args.story)}.${safe(args.identity)}.${safe(styleId)}.${setDefinitionHash.slice(0, 12)}.json`
  );
}

/* eslint-disable no-console */
export async function runMint(args: MintArgs, deps: MintDeps = liveMintDeps): Promise<SetIdentityBoardRegistryEntry> {
  const contract = JSON.parse(readFileSync(args.contract, 'utf-8')) as BookVisualContract;
  // (P0-2) NORMALIZE ONCE, here — the same conversion `set-identity-board-stage.ts` applies to
  // `Order.illustrationStyle`. The board is keyed by the normalized StyleId in the projection, the hash, the
  // registry path, and the storage key, so a board minted for `--style pencil_watercolor` is THE board a live
  // order carrying `pencil_watercolor` binds. Accepting either a DB value or a StyleId is deliberate: both
  // normalize to the same id, so the operator cannot mint into the wrong namespace by choosing the wrong word.
  const styleId = styleIdFromDatabaseValue(args.style);

  const def = projectSetDefinition(contract, args.identity, styleId);
  const setDefinitionHash = computeSetDefinitionHash(contract, args.identity, styleId);
  const { prompt, negativePrompt, promptHash } = buildSetIdentityBoardPrompt(def);

  console.log(`styleId (normalized): ${styleId}  (from --style "${args.style}")`);
  console.log(`setDefinitionHash:    ${setDefinitionHash}`);
  console.log(`promptHash:           ${promptHash}`);
  console.log('\n--- BOARD PROMPT ---\n');
  console.log(prompt);
  console.log('\n--- NEGATIVE PROMPT ---\n');
  console.log(negativePrompt);

  if (!args.render) {
    // DRY: nothing rendered, nothing uploaded, nothing QA'd, nothing spent.
    const preview: SetIdentityBoardRegistryEntry = {
      registryVersion: SET_IDENTITY_REGISTRY_VERSION,
      boardVersion: SET_IDENTITY_BOARD_VERSION,
      storyKey: def.storyKey,
      setIdentityId: def.setIdentityId,
      styleId,
      setDefinitionHash,
      storageKey: '',
      assetSha256: '',
      promptHash,
      model: '(unrendered)',
      quality: '(unrendered)',
      qaStatus: 'pending',
      qaCheckedAt: '',
      approvedBy: null, // NEVER auto-approved
      approvedAt: null, // NEVER auto-approved
    };
    const outPath = args.out ?? candidatePreviewPath(args, styleId, setDefinitionHash);
    saveRegistryEntry(outPath, preview);
    console.log(`\nDRY RUN — nothing rendered, nothing uploaded, nothing spent.`);
    console.log(`Wrote UNRENDERED candidate preview: ${outPath}`);
    console.log(`Re-run with --render to mint for real.`);
    return preview;
  }

  // ── from here on this SPENDS ──────────────────────────────────────────────
  console.log(`\n--- RENDERING (quality=${args.quality}) — this spends ---`);
  const rendered = await deps.renderBoard({ def, prompt, negativePrompt, quality: args.quality });
  const assetSha256 = createHash('sha256').update(rendered.buffer).digest('hex');
  console.log(`rendered: model=${rendered.model} bytes=${rendered.buffer.length} sha256=${assetSha256}`);

  const identity: BoardStorageIdentity = {
    storyKey: def.storyKey,
    setIdentityId: def.setIdentityId,
    styleId,
    setDefinitionHash,
    assetSha256,
  };
  const { storageKey, url } = await deps.uploadBoard({
    identity,
    buffer: rendered.buffer,
    contentType: rendered.contentType,
  });
  console.log(`uploaded (content-addressed, no-overwrite): ${storageKey}`);

  // QA decides qaStatus. Nothing else may. A throw here aborts BEFORE any entry is written.
  const qa = await deps.runBoardQa({ imageUrl: url, def });
  console.log(`board QA: ${qa.qaStatus}${qa.qaFlags.length ? ` — flags: ${qa.qaFlags.join(', ')}` : ''}`);

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
    model: rendered.model,
    quality: args.quality,
    qaStatus: qa.qaStatus, // FROM the QA — never assumed
    qaCheckedAt: deps.now().toISOString(),
    approvedBy: null, // NEVER auto-approved — only `--approve` may write this
    approvedAt: null, // NEVER auto-approved — only `--approve` may write this
  };

  const outPath =
    args.out ??
    setIdentityBoardRegistryPath(
      {
        registryVersion: SET_IDENTITY_REGISTRY_VERSION,
        boardVersion: SET_IDENTITY_BOARD_VERSION,
        storyKey: def.storyKey,
        setIdentityId: def.setIdentityId,
        styleId,
        setDefinitionHash,
      },
      args.registryRoot
    );
  saveRegistryEntry(outPath, entry);

  console.log(`\nWrote registry entry (qaStatus=${entry.qaStatus}, UNAPPROVED): ${outPath}`);
  if (qa.qaStatus === 'passed') {
    console.log(
      `\nNOT USABLE YET — a human must look at the board and approve it:\n` +
        `  npx tsx scripts/mint-set-identity-board.ts --approve --entry "${outPath}" --approved-by "<name>"`
    );
  } else {
    console.log(`\nQA FAILED — this board can never be approved. Fix the set/prompt and re-mint.`);
  }
  return entry;
}

// ─────────────────────────────────────────────────────────────────────────────
// APPROVE — the ONLY writer of approvedBy / approvedAt, anywhere in the system
// ─────────────────────────────────────────────────────────────────────────────

export async function runApprove(
  args: ApproveArgs,
  deps: Pick<MintDeps, 'now'> = liveMintDeps
): Promise<SetIdentityBoardRegistryEntry> {
  const entry = loadRegistryEntry(args.entry);
  if (!entry) throw new Error(`no registry entry at "${args.entry}"`);

  // The gate. QA passing is NECESSARY, not sufficient — the human below supplies the sufficiency.
  if (entry.qaStatus !== 'passed') {
    throw new Error(
      `refusing to approve: qaStatus is "${entry.qaStatus}", not "passed" — a board that did not pass the ` +
        `character-free QA must never be approvable (${args.entry})`
    );
  }
  // A QA-passed entry with no bytes behind it is incoherent; approving it would stamp a human's name on nothing.
  if (!entry.storageKey.trim() || !entry.assetSha256.trim()) {
    throw new Error(
      `refusing to approve: entry has no storageKey/assetSha256 — it was never rendered or uploaded (${args.entry})`
    );
  }
  if (!args.approvedBy.trim()) throw new Error('refusing to approve: --approved-by must name a human');

  if (entry.approvedBy && entry.approvedAt) {
    console.log(`already approved by "${entry.approvedBy}" at ${entry.approvedAt} — nothing to do.`);
    return entry;
  }

  const approved: SetIdentityBoardRegistryEntry = {
    ...entry,
    approvedBy: args.approvedBy.trim(),
    approvedAt: deps.now().toISOString(),
  };
  saveRegistryEntry(args.entry, approved);
  console.log(`APPROVED by "${approved.approvedBy}" at ${approved.approvedAt}: ${args.entry}`);
  console.log(`This board is now bindable by live orders (story=${approved.storyKey} style=${approved.styleId}).`);
  return approved;
}

export async function runCli(argv: string[], deps: MintDeps = liveMintDeps): Promise<void> {
  if (argv.includes('--help') || argv.includes('-h') || argv.length === 0) {
    console.log(USAGE);
    return;
  }
  const args = parseArgs(argv);
  if (args.mode === 'approve') {
    await runApprove(args, deps);
    return;
  }
  await runMint(args, deps);
}
/* eslint-enable no-console */

// Only run when invoked directly (keeps the module importable/testable without executing).
const invokedDirectly =
  typeof process !== 'undefined' && Array.isArray(process.argv) && /mint-set-identity-board\.ts$/.test(process.argv[1] ?? '');
if (invokedDirectly) {
  runCli(process.argv.slice(2)).catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
