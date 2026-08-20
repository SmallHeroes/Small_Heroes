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
 *   node scripts/mint-set-identity-board.cjs --story <key> --identity <id> --style <db-or-style-id> \
 *       --contract <path.json> [--out <path.json>]
 *
 *   # 2. mint for real — RENDERS + UPLOADS (spends), QAs, writes the registry entry (pending, UNAPPROVED)
 *   node scripts/mint-set-identity-board.cjs --story <key> --identity <id> --style <db-or-style-id> \
 *       --contract <path.json> --render [--quality low|medium] [--registry-root <dir>]
 *
 *   # 3. same-byte QA recheck — exactly once for a failed/unapproved rendered entry; no render or upload
 *   node scripts/mint-set-identity-board.cjs --recheck --entry <path.json> --contract <path.json>
 *
 *   # 4. human approval — the ONLY step that can approve, and only over a QA-passed entry
 *   node scripts/mint-set-identity-board.cjs --approve --entry <path.json> --approved-by "<name>"
 *
 * The canonical launcher preloads the repository's `server-only` shim before registering tsx or importing this
 * module. Do not invoke this TypeScript file directly: the live renderer's real transitive graph includes
 * `server-only`. Provider / storage / vision adapters remain injected and lazy, so importing this module alone
 * performs no provider, storage, or Vision operation.
 */
import path from 'path';
import { createHash } from 'crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'fs';

import { canonicalHash } from '@/lib/canonical-json';
import { styleIdFromDatabaseValue } from '@/lib/styles';
import type { BookVisualContract } from '@/lib/visual-contract-compiler';

import {
  SET_IDENTITY_BOARD_VERSION,
  SET_IDENTITY_REGISTRY_VERSION,
  buildBoardQaInstruction,
  buildSetIdentityBoardPrompt,
  computeSetBoardContentPolicyDigest,
  computeSetDefinitionHash,
  loadRegistryEntry,
  projectSetDefinition,
  qaSetIdentityBoardImage,
  saveRegistryEntry,
  setIdentityBoardRegistryPath,
  validateSetIdentityBoardRegistryIdentity,
  verifyBoardAssetBytes,
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

/** Loads the exact durable bytes and provider-readable URL for a same-byte QA recheck. */
export type BoardAssetLoader = (args: {
  storageKey: string;
}) => Promise<{ buffer: Buffer; url: string }>;

export interface MintDeps {
  renderBoard: BoardRenderer;
  uploadBoard: BoardUploader;
  runBoardQa: BoardQaRunner;
  loadBoardAsset: BoardAssetLoader;
  /** Injected clock — keeps `qaCheckedAt`/`approvedAt` deterministic under test. */
  now: () => Date;
}

interface LiveRendererModules {
  generateGPTImage: typeof import('@/lib/generate-image').generateGPTImage;
  resolveStyle01GptModel: typeof import('@/lib/style01-gptimage').resolveStyle01GptModel;
}

interface LiveStorageModules {
  uploadContentAddressedObjectNoOverwrite: typeof import('@/lib/image-storage').uploadContentAddressedObjectNoOverwrite;
  downloadStorageObjectBytes: typeof import('@/lib/image-storage').downloadStorageObjectBytes;
  resolveStoragePublicUrl: typeof import('@/lib/image-storage').resolveStoragePublicUrl;
}

export interface LiveImportPreflightDeps {
  loadRendererModules: () => Promise<LiveRendererModules>;
  loadStorageModules: () => Promise<LiveStorageModules>;
  inspectVisionSurface: () => {
    endpoint: string;
    modelLabel: string;
    qaRunnerType: string;
    fetchType: string;
  };
}

export interface LiveImportPreflightResult {
  rendererFunctionExports: string[];
  storageFunctionExports: string[];
  visionEndpoint: string;
  visionModelLabel: string;
  visionQaRunnerType: string;
  visionFetchType: string;
  observedFetchAttempts: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Live adapters (lazy — importing this module must not construct any client)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The live renderer. Deliberately routed through the SAME `generateGPTImage` + `resolveStyle01GptModel` the page
 * path uses: a board rendered by a different model or a different style authority than the pages it is supposed to
 * anchor would be a reference that disagrees with its own book.
 */
export const loadLiveRendererModules: LiveImportPreflightDeps['loadRendererModules'] = async () => {
  const [{ generateGPTImage }, { resolveStyle01GptModel }] = await Promise.all([
    import('@/lib/generate-image'),
    import('@/lib/style01-gptimage'),
  ]);
  if (typeof generateGPTImage !== 'function' || typeof resolveStyle01GptModel !== 'function') {
    throw new Error('live renderer import surface is incomplete');
  }
  return { generateGPTImage, resolveStyle01GptModel };
};

const liveRenderBoard: BoardRenderer = async ({ prompt, negativePrompt, quality }) => {
  const { generateGPTImage, resolveStyle01GptModel } = await loadLiveRendererModules();
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
export const loadLiveStorageModules: LiveImportPreflightDeps['loadStorageModules'] = async () => {
  const {
    downloadStorageObjectBytes,
    resolveStoragePublicUrl,
    uploadContentAddressedObjectNoOverwrite,
  } = await import('@/lib/image-storage');
  if (
    typeof uploadContentAddressedObjectNoOverwrite !== 'function' ||
    typeof downloadStorageObjectBytes !== 'function' ||
    typeof resolveStoragePublicUrl !== 'function'
  ) {
    throw new Error('live storage import surface is incomplete');
  }
  return {
    uploadContentAddressedObjectNoOverwrite,
    downloadStorageObjectBytes,
    resolveStoragePublicUrl,
  };
};

const liveUploadBoard: BoardUploader = async ({ identity, buffer, contentType }) => {
  const { uploadContentAddressedObjectNoOverwrite } = await loadLiveStorageModules();
  const { url, storageKey } = await uploadContentAddressedObjectNoOverwrite({
    key: setIdentityBoardStorageKey(identity),
    buffer,
    contentType,
    expectedSha256: identity.assetSha256,
  });
  return { url, storageKey };
};

const liveLoadBoardAsset: BoardAssetLoader = async ({ storageKey }) => {
  const { downloadStorageObjectBytes, resolveStoragePublicUrl } = await loadLiveStorageModules();
  const buffer = await downloadStorageObjectBytes(storageKey);
  if (!buffer) throw new Error(`board object "${storageKey}" is missing or unreadable`);
  return { buffer, url: resolveStoragePublicUrl(storageKey) };
};

/**
 * The live vision adapter behind `qaSetIdentityBoardImage`. Mirrors the JSON-mode chat-completions shape used by
 * `lib/scene-memory/analyze.ts`. FAIL-CLOSED by omission: any throw here aborts the mint before an entry is
 * written, so a board whose QA could not run never reaches the registry as anything a human could approve.
 */
export const BOARD_QA_VISION_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

export function resolveBoardQaVisionModel(): string {
  return process.env.CHILD_PHOTO_VISION_MODEL?.trim() || 'gpt-4o';
}

const liveRunBoardQa: BoardQaRunner = async ({ imageUrl, def }) =>
  qaSetIdentityBoardImage(
    { imageUrl, def },
    {
      callVision: async ({ imageUrl: url, instruction }) => {
        const apiKey = process.env.OPENAI_API_KEY?.trim();
        if (!apiKey) throw new Error('OPENAI_API_KEY missing — cannot run board QA');
        const res = await fetch(BOARD_QA_VISION_ENDPOINT, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: resolveBoardQaVisionModel(),
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
  loadBoardAsset: liveLoadBoardAsset,
  now: () => new Date(),
};

export const inspectLiveVisionSurface: LiveImportPreflightDeps['inspectVisionSurface'] = () => {
  return {
    endpoint: BOARD_QA_VISION_ENDPOINT,
    modelLabel: resolveBoardQaVisionModel(),
    qaRunnerType: typeof liveRunBoardQa,
    fetchType: typeof globalThis.fetch,
  };
};

export const liveImportPreflightDeps: LiveImportPreflightDeps = {
  loadRendererModules: loadLiveRendererModules,
  loadStorageModules: loadLiveStorageModules,
  inspectVisionSurface: inspectLiveVisionSurface,
};

let liveImportPreflightInProgress = false;

/**
 * Zero-cost reachability proof for the exact live module graph.
 *
 * This code has no contract/board input and no access to `MintDeps`, so it cannot render, upload, run QA, write a
 * candidate/registry entry, or approve one. A throwing fetch sentinel remains installed for the whole import
 * window as a second line of defense; the subprocess smoke test adds lower-level network sentinels too.
 */
export async function runLiveImportPreflight(
  deps: LiveImportPreflightDeps = liveImportPreflightDeps
): Promise<LiveImportPreflightResult> {
  if (liveImportPreflightInProgress) {
    throw new Error('live-import preflight is already running in this process');
  }
  liveImportPreflightInProgress = true;

  const originalFetch = globalThis.fetch;
  try {
    if (typeof originalFetch !== 'function') {
      throw new Error('live-import preflight requires a runtime with global fetch');
    }

    let observedFetchAttempts = 0;
    globalThis.fetch = (async () => {
      observedFetchAttempts += 1;
      throw new Error('live-import preflight blocked an unexpected fetch');
    }) as typeof fetch;

    const renderer = await deps.loadRendererModules();
    const storage = await deps.loadStorageModules();
    const vision = deps.inspectVisionSurface();

    const rendererFunctionExports = [
      ...(typeof renderer.generateGPTImage === 'function' ? ['generateGPTImage'] : []),
      ...(typeof renderer.resolveStyle01GptModel === 'function' ? ['resolveStyle01GptModel'] : []),
    ];
    const storageFunctionExports = [
      ...(typeof storage.uploadContentAddressedObjectNoOverwrite === 'function'
        ? ['uploadContentAddressedObjectNoOverwrite']
        : []),
      ...(typeof storage.downloadStorageObjectBytes === 'function'
        ? ['downloadStorageObjectBytes']
        : []),
      ...(typeof storage.resolveStoragePublicUrl === 'function'
        ? ['resolveStoragePublicUrl']
        : []),
    ];
    const visionEndpoint = new URL(vision.endpoint);
    if (rendererFunctionExports.length !== 2 || storageFunctionExports.length !== 3) {
      throw new Error('live-import preflight found an incomplete renderer or storage function-export surface');
    }
    if (
      visionEndpoint.protocol !== 'https:' ||
      !vision.modelLabel.trim() ||
      vision.qaRunnerType !== 'function' ||
      vision.fetchType !== 'function'
    ) {
      throw new Error('live-import preflight found an incomplete local Vision function/label surface');
    }
    if (observedFetchAttempts !== 0) {
      throw new Error(`live-import preflight observed ${observedFetchAttempts} unexpected fetch attempt(s)`);
    }
    return {
      rendererFunctionExports,
      storageFunctionExports,
      visionEndpoint: visionEndpoint.toString(),
      visionModelLabel: vision.modelLabel,
      visionQaRunnerType: vision.qaRunnerType,
      visionFetchType: vision.fetchType,
      observedFetchAttempts,
    };
  } finally {
    globalThis.fetch = originalFetch;
    liveImportPreflightInProgress = false;
  }
}

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

export interface RecheckArgs {
  mode: 'recheck';
  entry: string;
  contract: string;
}

export interface LiveImportPreflightArgs {
  mode: 'preflight-live-imports';
}

export type CliArgs = MintArgs | ApproveArgs | RecheckArgs | LiveImportPreflightArgs;

export const CANONICAL_BOARD_MINT_COMMAND = 'node scripts/mint-set-identity-board.cjs';

export const USAGE = `mint-set-identity-board — mint + approve Set Identity Boards

  CANONICAL LAUNCHER (preloads the server-only shim; do not invoke the .ts file directly):
    ${CANONICAL_BOARD_MINT_COMMAND}

  DRY (no spend):
    ${CANONICAL_BOARD_MINT_COMMAND} --story <key> --identity <id> --style <db-or-style-id> --contract <path.json> [--out <path.json>]

  MINT (RENDERS + UPLOADS — spends):
    ${CANONICAL_BOARD_MINT_COMMAND} --story <key> --identity <id> --style <db-or-style-id> --contract <path.json> --render [--quality low|medium] [--registry-root <dir>] [--out <path.json>]

  APPROVE (the only step that may approve; refuses unless qaStatus === 'passed'):
    ${CANONICAL_BOARD_MINT_COMMAND} --approve --entry <path.json> --approved-by "<name>"

  RECHECK (one Vision-only pass over the exact existing bytes; never renders or uploads):
    ${CANONICAL_BOARD_MINT_COMMAND} --recheck --entry <path.json> --contract <path.json>

  LIVE-IMPORT PREFLIGHT (zero external cost; imports exact live renderer/storage graph, never invokes it;
  local imports may load operating-system/native modules):
    ${CANONICAL_BOARD_MINT_COMMAND} --preflight-live-imports`;

function parseQuality(raw: string | undefined): BoardQuality {
  const q = (raw ?? 'low').trim().toLowerCase();
  if (q === 'low' || q === 'medium') return q;
  // Not a typo-guard — a cost fence. A board is a reference sheet; HIGH is for the pages it anchors.
  throw new Error(`--quality must be low or medium (got "${raw}") — boards are never rendered at high quality`);
}

export function parseArgs(argv: string[]): CliArgs {
  const valueFlags = new Set([
    'story',
    'identity',
    'style',
    'contract',
    'out',
    'registry-root',
    'quality',
    'entry',
    'approved-by',
  ]);
  const booleanFlags = new Set(['render', 'approve', 'recheck', 'preflight-live-imports']);
  const flags: Record<string, string> = {};
  const bare = new Set<string>();
  const seen = new Set<string>();

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      throw new Error(`unexpected positional argument "${arg}"`);
    }
    if (arg.includes('=')) {
      throw new Error(`--flag=value syntax is unsupported; pass flag values as separate arguments (got "${arg}")`);
    }
    const key = arg.slice(2);
    if (!valueFlags.has(key) && !booleanFlags.has(key)) {
      throw new Error(`unknown flag "--${key}"`);
    }
    if (seen.has(key)) {
      throw new Error(`duplicate flag "--${key}"`);
    }
    seen.add(key);

    if (booleanFlags.has(key)) {
      bare.add(key);
      continue;
    }

    const value = argv[i + 1];
    if (value === undefined || value.startsWith('-')) {
      throw new Error(`--${key} requires a separated value`);
    }
    flags[key] = value;
    i += 1;
  }

  if (bare.has('preflight-live-imports')) {
    if (seen.size !== 1) {
      throw new Error('--preflight-live-imports must be used alone');
    }
    return { mode: 'preflight-live-imports' };
  }

  if (bare.has('approve')) {
    const approveFlags = new Set(['approve', 'entry', 'approved-by']);
    const incompatible = [...seen].find((key) => !approveFlags.has(key));
    if (incompatible) {
      throw new Error(`--${incompatible} cannot be used with --approve`);
    }
    for (const required of ['entry', 'approved-by'] as const) {
      if (!flags[required]?.trim()) throw new Error(`--${required} is required with --approve`);
    }
    return { mode: 'approve', entry: flags.entry, approvedBy: flags['approved-by'].trim() };
  }

  if (bare.has('recheck')) {
    const recheckFlags = new Set(['recheck', 'entry', 'contract']);
    const incompatible = [...seen].find((key) => !recheckFlags.has(key));
    if (incompatible) {
      throw new Error(`--${incompatible} cannot be used with --recheck`);
    }
    for (const required of ['entry', 'contract'] as const) {
      if (!flags[required]?.trim()) throw new Error(`--${required} is required with --recheck`);
    }
    return {
      mode: 'recheck',
      entry: flags.entry,
      contract: flags.contract,
    };
  }

  const mintFlags = new Set(['story', 'identity', 'style', 'contract', 'out', 'registry-root', 'render', 'quality']);
  const incompatible = [...seen].find((key) => !mintFlags.has(key));
  if (incompatible) {
    throw new Error(`--${incompatible} requires --approve`);
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
  const contentPolicyDigest = computeSetBoardContentPolicyDigest(def);
  const declaredPropIds = def.contentPolicy.includedPropIds;
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
      contentPolicyDigest,
      declaredPropIds,
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
    contentPolicyDigest,
    declaredPropIds,
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
        contentPolicyDigest,
        declaredPropIds,
      },
      args.registryRoot
    );
  saveRegistryEntry(outPath, entry);

  console.log(`\nWrote registry entry (qaStatus=${entry.qaStatus}, UNAPPROVED): ${outPath}`);
  if (qa.qaStatus === 'passed') {
    console.log(
      `\nNOT USABLE YET — a human must look at the board and approve it:\n` +
        `  ${CANONICAL_BOARD_MINT_COMMAND} --approve --entry "${outPath}" --approved-by "<name>"`
    );
  } else {
    console.log(
      `\nQA FAILED — this board is not approvable. A reviewed false positive may receive the one canonical ` +
        `same-byte --recheck; a verified visual defect requires a new mint.`,
    );
  }
  return entry;
}

// ─────────────────────────────────────────────────────────────────────────────
// RECHECK — exactly one Vision-only pass over the exact already-stored bytes
// ─────────────────────────────────────────────────────────────────────────────

export const SET_BOARD_QA_RECHECK_RECEIPT_VERSION = 'set-board-qa-recheck-receipt/v1' as const;
export const SET_BOARD_QA_INSTRUCTION_VERSION = 'set-board-qa-instruction/v2' as const;

interface SetBoardQaRecheckReceiptPayload {
  version: typeof SET_BOARD_QA_RECHECK_RECEIPT_VERSION;
  status: 'armed' | 'completed';
  storyKey: string;
  setIdentityId: string;
  styleId: string;
  setDefinitionHash: string;
  contentPolicyDigest: string;
  promptHash: string;
  storageKey: string;
  assetSha256: string;
  priorQaStatus: 'failed';
  priorQaCheckedAt: string;
  instructionVersion: typeof SET_BOARD_QA_INSTRUCTION_VERSION;
  instructionDigest: string;
  armedAt: string;
  result: null | {
    qaStatus: BoardQaResult['qaStatus'];
    qaFlagCount: number;
    qaFlagsDigest: string;
    qaCheckedAt: string;
  };
}

export type SetBoardQaRecheckReceipt = SetBoardQaRecheckReceiptPayload & {
  digest: string;
};

export function setBoardQaRecheckReceiptPath(entryPath: string): string {
  return `${entryPath}.qa-recheck.json`;
}

function qaRecheckReceipt(payload: SetBoardQaRecheckReceiptPayload): SetBoardQaRecheckReceipt {
  return { ...payload, digest: canonicalHash(payload) };
}

let qaRecheckTemporaryWriteCounter = 0;

function recheckAlreadyExistsError(receiptPath: string): Error {
  return new Error(`refusing to recheck: the one-shot recheck record already exists at "${receiptPath}"`);
}

function writeQaRecheckReceipt(
  receiptPath: string,
  receipt: SetBoardQaRecheckReceipt,
  exclusive: boolean,
): void {
  const bytes = JSON.stringify(receipt, null, 2);
  if (exclusive) {
    let descriptor: number | null = null;
    try {
      descriptor = openSync(receiptPath, 'wx');
      writeFileSync(descriptor, bytes, 'utf8');
      fsyncSync(descriptor);
      closeSync(descriptor);
      descriptor = null;
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        throw recheckAlreadyExistsError(receiptPath);
      }
      throw error;
    } finally {
      if (descriptor !== null) closeSync(descriptor);
    }
  }

  qaRecheckTemporaryWriteCounter += 1;
  const temporary = `${receiptPath}.tmp-${process.pid}-${qaRecheckTemporaryWriteCounter}`;
  let descriptor: number | null = null;
  try {
    descriptor = openSync(temporary, 'wx');
    writeFileSync(descriptor, bytes, 'utf8');
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = null;
    renameSync(temporary, receiptPath);
  } finally {
    if (descriptor !== null) closeSync(descriptor);
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

export async function runRecheck(
  args: RecheckArgs,
  deps: MintDeps = liveMintDeps,
): Promise<SetIdentityBoardRegistryEntry> {
  const receiptPath = setBoardQaRecheckReceiptPath(args.entry);
  if (existsSync(receiptPath)) {
    throw recheckAlreadyExistsError(receiptPath);
  }

  const entry = loadRegistryEntry(args.entry);
  if (!entry) throw new Error(`no registry entry at "${args.entry}"`);
  if (entry.qaStatus !== 'failed') {
    throw new Error(`refusing to recheck: qaStatus is "${entry.qaStatus}", not "failed"`);
  }
  if (entry.approvedBy !== null || entry.approvedAt !== null) {
    throw new Error('refusing to recheck: an approved registry entry is immutable');
  }
  if (
    typeof entry.storageKey !== 'string' ||
    typeof entry.assetSha256 !== 'string' ||
    typeof entry.qaCheckedAt !== 'string' ||
    !entry.storageKey.trim() ||
    !entry.assetSha256.trim() ||
    !entry.qaCheckedAt.trim()
  ) {
    throw new Error('refusing to recheck: entry has no complete rendered-byte/QA authority');
  }

  const contract = JSON.parse(readFileSync(args.contract, 'utf-8')) as BookVisualContract;
  const styleId = styleIdFromDatabaseValue(entry.styleId);
  const def = projectSetDefinition(contract, entry.setIdentityId, styleId);
  const setDefinitionHash = computeSetDefinitionHash(contract, entry.setIdentityId, styleId);
  const contentPolicyDigest = computeSetBoardContentPolicyDigest(def);
  const declaredPropIds = def.contentPolicy.includedPropIds;
  const { promptHash } = buildSetIdentityBoardPrompt(def);
  const identityValidation = validateSetIdentityBoardRegistryIdentity(entry, {
    registryVersion: SET_IDENTITY_REGISTRY_VERSION,
    boardVersion: SET_IDENTITY_BOARD_VERSION,
    storyKey: def.storyKey,
    setIdentityId: def.setIdentityId,
    styleId,
    setDefinitionHash,
    contentPolicyDigest,
    declaredPropIds,
  });
  if (!identityValidation.ok) {
    throw new Error(`refusing to recheck: ${identityValidation.errors.join('; ')}`);
  }
  if (entry.promptHash !== promptHash) {
    throw new Error('refusing to recheck: promptHash no longer matches the current exact Board prompt');
  }

  const loaded = await deps.loadBoardAsset({ storageKey: entry.storageKey });
  const actualSha256 = createHash('sha256').update(loaded.buffer).digest('hex');
  const byteValidation = verifyBoardAssetBytes(entry, actualSha256);
  if (!byteValidation.ok) {
    throw new Error(`refusing to recheck: ${byteValidation.errors.join('; ')}`);
  }

  const instruction = buildBoardQaInstruction(def);
  const instructionDigest = canonicalHash({
    version: SET_BOARD_QA_INSTRUCTION_VERSION,
    instruction,
  });
  const armedAt = deps.now().toISOString();
  const armedPayload: SetBoardQaRecheckReceiptPayload = {
    version: SET_BOARD_QA_RECHECK_RECEIPT_VERSION,
    status: 'armed',
    storyKey: entry.storyKey,
    setIdentityId: entry.setIdentityId,
    styleId: entry.styleId,
    setDefinitionHash: entry.setDefinitionHash,
    contentPolicyDigest: entry.contentPolicyDigest,
    promptHash: entry.promptHash,
    storageKey: entry.storageKey,
    assetSha256: entry.assetSha256,
    priorQaStatus: 'failed',
    priorQaCheckedAt: entry.qaCheckedAt,
    instructionVersion: SET_BOARD_QA_INSTRUCTION_VERSION,
    instructionDigest,
    armedAt,
    result: null,
  };
  writeQaRecheckReceipt(receiptPath, qaRecheckReceipt(armedPayload), true);

  const qa = await deps.runBoardQa({ imageUrl: loaded.url, def });
  const qaCheckedAt = deps.now().toISOString();
  const completedPayload: SetBoardQaRecheckReceiptPayload = {
    ...armedPayload,
    status: 'completed',
    result: {
      qaStatus: qa.qaStatus,
      qaFlagCount: qa.qaFlags.length,
      qaFlagsDigest: canonicalHash(qa.qaFlags),
      qaCheckedAt,
    },
  };
  writeQaRecheckReceipt(receiptPath, qaRecheckReceipt(completedPayload), false);

  if (qa.qaStatus !== 'passed') {
    console.log(`board QA recheck: failed (${qa.qaFlags.length} flag(s)); registry remains failed`);
    return entry;
  }

  const passed: SetIdentityBoardRegistryEntry = {
    ...entry,
    qaStatus: 'passed',
    qaCheckedAt,
    approvedBy: null,
    approvedAt: null,
  };
  saveRegistryEntry(args.entry, passed);
  console.log(`board QA recheck: passed; exact bytes remain UNAPPROVED: ${args.entry}`);
  return passed;
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

export async function runCli(
  argv: string[],
  deps: MintDeps = liveMintDeps,
  preflightDeps: LiveImportPreflightDeps = liveImportPreflightDeps
): Promise<void> {
  if (argv.length === 0 || (argv.length === 1 && (argv[0] === '--help' || argv[0] === '-h'))) {
    console.log(USAGE);
    return;
  }
  if (argv.includes('--help') || argv.includes('-h')) {
    throw new Error('--help must be used alone');
  }
  const args = parseArgs(argv);
  if (args.mode === 'preflight-live-imports') {
    const result = await runLiveImportPreflight(preflightDeps);
    console.log(
      `LIVE-IMPORT PREFLIGHT PASS\n` +
        `renderer function exports (typeof checked): ${result.rendererFunctionExports.join(', ')}\n` +
        `storage function exports (typeof checked): ${result.storageFunctionExports.join(', ')}\n` +
        `Vision surface inspected locally: endpoint=${result.visionEndpoint} model-label=${result.visionModelLabel} ` +
        `qaRunner typeof=${result.visionQaRunnerType} fetch typeof=${result.visionFetchType}\n` +
        `observed fetch attempts: ${result.observedFetchAttempts}\n` +
        `provider credentials, provider connectivity, and provider-side configuration were not validated\n` +
        `render/upload/Vision/registry/approval paths are structurally unreachable from this exclusive mode\n` +
        `local imports may load operating-system/native modules; this mode contains no provider/write invocation path`
    );
    return;
  }
  if (args.mode === 'approve') {
    await runApprove(args, deps);
    return;
  }
  if (args.mode === 'recheck') {
    await runRecheck(args, deps);
    return;
  }
  await runMint(args, deps);
}
/* eslint-enable no-console */

export const DIRECT_TYPESCRIPT_ENTRYPOINT_ERROR =
  `Direct invocation of scripts/mint-set-identity-board.ts is unsupported because it cannot guarantee ` +
  `server-only shim ordering. Use: ${CANONICAL_BOARD_MINT_COMMAND}`;

// Refuse the historically documented direct TypeScript path. The canonical CJS launcher imports this module only
// after preloading the shim, then calls `runCli` itself.
export function isDirectMintCoreEntrypoint(argv1: string | undefined): boolean {
  const basename = argv1?.split(/[\\/]/).pop()?.toLowerCase();
  return basename === 'mint-set-identity-board.ts';
}

const invokedDirectly =
  typeof process !== 'undefined' && Array.isArray(process.argv) && isDirectMintCoreEntrypoint(process.argv[1]);
if (invokedDirectly) {
  // eslint-disable-next-line no-console
  console.error(DIRECT_TYPESCRIPT_ENTRYPOINT_ERROR);
  process.exitCode = 1;
}
