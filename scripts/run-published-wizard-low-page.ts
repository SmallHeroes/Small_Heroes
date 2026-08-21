import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

import { parse as parseEnv } from 'dotenv';

import { generateImage } from '@/backend/providers/image';
import { resolveStoryProductTruth } from '@/backend/providers/story-product-resolver';
import { getCompanionById } from '@/lib/companions';
import { buildFrozenStoryProductTruth } from '@/lib/generation-pipeline/frozen-product-truth';
import {
  requireStyle01RenderQualification,
  runAfterPageReferencePreflight,
} from '@/lib/generation-pipeline/render-qualification-preflight';
import { estimateGptImage2CostUsd } from '@/lib/pricing';
import {
  loadRegistryEntry,
  validateSetIdentityBoardRegistryEntry,
  verifyBoardAssetBytes,
} from '@/lib/set-identity-board/registry';
import type {
  SetIdentityBoardBindingContext,
  SetIdentityBoardRegistryEntry,
} from '@/lib/set-identity-board/types';
import { STYLE_IDS } from '@/lib/styles';
import {
  computeVisualContractHash,
  materialize,
  type ResolvedFamilyAppearanceProfile,
} from '@/lib/visual-contract-compiler';
import { parseStorySourceContent } from '@/lib/visual-contract-compiler/storySourceContent';
import { evaluateWizardVisualPackageSelection } from '@/lib/visual-package';
import { bindApprovedPvbRuntimeAuthority } from '@/lib/visual-package/runtimeAuthority';

const ROOT = process.cwd();
const STYLE_ID = STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK;

function requiredArg(name: string): string {
  const prefix = `--${name}=`;
  const value = process.argv.find((entry) => entry.startsWith(prefix))?.slice(prefix.length).trim();
  if (!value) throw new Error(`${prefix}<value> is required`);
  return value;
}

function optionalArg(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.find((entry) => entry.startsWith(prefix))?.slice(prefix.length).trim() || null;
}

function positiveIntegerArg(name: string, fallback: number): number {
  const raw = optionalArg(name);
  const value = raw === null ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`--${name} must be a positive safe integer`);
  }
  return value;
}

function parseBoardAssets(): Map<string, string> {
  const result = new Map<string, string>();
  for (const value of process.argv.filter((entry) => entry.startsWith('--board-asset='))) {
    const binding = value.slice('--board-asset='.length);
    const separator = binding.indexOf('=');
    if (separator <= 0 || separator === binding.length - 1) {
      throw new Error('--board-asset must use <setIdentityId>=<absolute PNG path>');
    }
    const setIdentityId = binding.slice(0, separator).trim();
    const assetPath = path.resolve(binding.slice(separator + 1).trim());
    if (result.has(setIdentityId)) throw new Error(`duplicate Board asset: ${setIdentityId}`);
    result.set(setIdentityId, assetPath);
  }
  return result;
}

function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function loadOnlyOpenAiKey(): void {
  const envPath = optionalArg('env-file') ?? 'C:\\GNart\\Work\\Small_Heroes\\.env.local';
  const values = parseEnv(fs.readFileSync(envPath));
  const key = values.OPENAI_API_KEY?.trim();
  if (!key) throw new Error('OPENAI_API_KEY is missing from the approved local source');
  process.env.OPENAI_API_KEY = key;
}

async function startLocalStorage(storageRoot: string): Promise<{
  server: http.Server;
  publicBaseUrl: string;
}> {
  fs.mkdirSync(storageRoot, { recursive: true });
  const server = http.createServer((request, response) => {
    const requestPath = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
    const objectPrefix = '/storage/v1/object/';
    const publicPrefix = '/storage/v1/object/public/';
    const isPublic = requestPath.startsWith(publicPrefix);
    const relative = requestPath.slice((isPublic ? publicPrefix : objectPrefix).length);
    const localPath = path.resolve(storageRoot, ...relative.split('/').filter(Boolean));
    const relativeToRoot = path.relative(storageRoot, localPath);
    if (relativeToRoot.startsWith(`..${path.sep}`) || path.isAbsolute(relativeToRoot)) {
      response.writeHead(400).end();
      return;
    }
    if (request.method === 'POST' && requestPath.startsWith(objectPrefix) && !isPublic) {
      const chunks: Buffer[] = [];
      request.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      request.on('end', () => {
        fs.mkdirSync(path.dirname(localPath), { recursive: true });
        fs.writeFileSync(localPath, Buffer.concat(chunks));
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end('{"stored":true}');
      });
      return;
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && isPublic && fs.existsSync(localPath)) {
      response.writeHead(200, { 'content-type': 'image/png' });
      if (request.method === 'GET') response.end(fs.readFileSync(localPath));
      else response.end();
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('local storage did not bind');
  const origin = `http://127.0.0.1:${address.port}`;
  process.env.SUPABASE_URL = origin;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-wizard-proof-only';
  process.env.SUPABASE_STORAGE_BUCKET = 'local-images';
  process.env.SUPABASE_PERSIST_MAX_ATTEMPTS = '1';
  process.env.SUPABASE_PERSIST_TIMEOUT_MS = '15000';
  return { server, publicBaseUrl: `${origin}/storage/v1/object/public` };
}

function boardBindingContext(args: {
  requiredBoards: Array<{
    registryVersion: string;
    boardVersion: string;
    storyKey: string;
    setIdentityId: string;
    styleId: string;
    setDefinitionHash: string;
    contentPolicyDigest: string;
    declaredPropIds: string[];
    artifactPath: string;
    storageKey: string;
    assetSha256: string;
    approvedAt: string;
  }>;
  boardAssets: Map<string, string>;
  storageRoot: string;
  publicBaseUrl: string;
  contractHash: string;
}): SetIdentityBoardBindingContext {
  const bindings: SetIdentityBoardBindingContext['bindings'] = {};
  for (const expected of args.requiredBoards) {
    const registryPath = path.resolve(ROOT, expected.artifactPath);
    const registry = loadRegistryEntry(registryPath);
    const validation = validateSetIdentityBoardRegistryEntry(registry, expected);
    if (!validation.ok) {
      throw new Error(`Board registry rejected for ${expected.setIdentityId}: ${validation.errors.join(' | ')}`);
    }
    const assetPath = args.boardAssets.get(expected.setIdentityId);
    if (!assetPath || !fs.existsSync(assetPath) || !fs.lstatSync(assetPath).isFile()) {
      throw new Error(`approved Board asset is missing for ${expected.setIdentityId}`);
    }
    const assetBytes = fs.readFileSync(assetPath);
    const assetValidation = verifyBoardAssetBytes(
      registry as SetIdentityBoardRegistryEntry,
      sha256(assetBytes),
    );
    if (!assetValidation.ok) {
      throw new Error(`Board bytes rejected for ${expected.setIdentityId}: ${assetValidation.errors.join(' | ')}`);
    }
    const localStoragePath = path.resolve(
      args.storageRoot,
      ...expected.storageKey.split('/').filter(Boolean),
    );
    fs.mkdirSync(path.dirname(localStoragePath), { recursive: true });
    fs.writeFileSync(localStoragePath, assetBytes);
    const encodedStorageKey = expected.storageKey
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    bindings[expected.setIdentityId] = {
      setIdentityId: expected.setIdentityId,
      setDefinitionHash: expected.setDefinitionHash,
      contentPolicyDigest: expected.contentPolicyDigest,
      declaredPropIds: [...expected.declaredPropIds],
      styleId: expected.styleId,
      storageKey: expected.storageKey,
      resolvedUrl: `${args.publicBaseUrl}/${encodedStorageKey}`,
      assetSha256: expected.assetSha256,
      boardVersion: expected.boardVersion,
      approvedAt: expected.approvedAt,
    };
  }
  if (args.boardAssets.size !== args.requiredBoards.length) {
    throw new Error('Board asset arguments must exactly match the package-required Board identities');
  }
  return { mode: 'required-v2', frozenContractHash: args.contractHash, bindings };
}

async function main(): Promise<void> {
  process.env.VISUAL_CONTRACT_ENFORCEMENT = 'true';
  const storyKey = requiredArg('story-key');
  const companionId = requiredArg('companion-id');
  const pageNumber = positiveIntegerArg('page', 1);
  const childAge = positiveIntegerArg('child-age', 5);
  const childName = optionalArg('child-name') ?? 'Bar';
  const childGender = optionalArg('child-gender') ?? 'boy';
  const renderLow = process.argv.includes('--render-low');
  const outputRoot = path.resolve(
    optionalArg('output-root') ??
      path.join('outputs', `published-wizard-low-${storyKey}-${new Date().toISOString().replace(/[:.]/g, '')}`),
  );
  const storageRoot = path.join(outputRoot, 'local-storage');
  fs.mkdirSync(outputRoot, { recursive: true });

  const selection = evaluateWizardVisualPackageSelection({
    repoRoot: ROOT,
    storyKey,
    styleId: STYLE_ID,
  });
  if (
    !selection.renderQualified ||
    !selection.packageValue ||
    !selection.frozenAuthority ||
    !selection.sourcePath
  ) {
    throw new Error(`Wizard Visual Package selection failed: ${selection.reasons.join(' | ')}`);
  }
  if (pageNumber > (selection.pageCount ?? 0)) {
    throw new Error(`page ${pageNumber} exceeds package page count ${selection.pageCount ?? 0}`);
  }
  const product = resolveStoryProductTruth(
    {
      companionId,
      clientDirection: storyKey.slice(`${companionId}_`.length),
    },
    { repoRoot: ROOT },
  );
  if (product.source !== 'visual_package_v4' || !product.storyFile) {
    throw new Error('Story Product resolver did not select Visual Package v4 source authority');
  }
  const frozenProduct = buildFrozenStoryProductTruth({
    storyFilePath: product.storyFile,
    expectedPageCount: product.pages,
    storyDirection: product.storyDirection,
  });
  const rawStorySource = fs.readFileSync(product.storyFile, 'utf8');
  const parsedStory = parseStorySourceContent(rawStorySource);
  const storyPage = parsedStory.pages.find((entry) => entry.pageNumber === pageNumber);
  const imageDirection = parsedStory.pageImageDirections.find(
    (entry) => entry.pageNumber === pageNumber,
  );
  if (!storyPage || !imageDirection) throw new Error(`Story Source page ${pageNumber} is incomplete`);

  const family: ResolvedFamilyAppearanceProfile = {
    skinTone: optionalArg('skin-tone') ?? 'warm medium-light olive',
    hairColour: optionalArg('hair-colour') ?? 'deep dark brown',
    hairTexture: optionalArg('hair-texture') ?? 'dense soft curls',
  };
  const contract = bindApprovedPvbRuntimeAuthority(
    materialize(selection.packageValue.visualContractTemplate.content, family),
    selection.packageValue,
    selection.frozenAuthority,
  );
  const contractHash = computeVisualContractHash(contract);
  const localStorage = await startLocalStorage(storageRoot);
  try {
    const setIdentityBoards = boardBindingContext({
      requiredBoards: selection.packageValue.requiredBoards,
      boardAssets: parseBoardAssets(),
      storageRoot,
      publicBaseUrl: localStorage.publicBaseUrl,
      contractHash,
    });
    const cache = {
      storyFilePath: frozenProduct.selectionFilename,
      storyDir: path.dirname(frozenProduct.selectionFilename),
      selectionFilename: path.basename(frozenProduct.selectionFilename),
      visualPackageAuthority: selection.frozenAuthority,
      visualContract: contract as never,
      setIdentityBoards,
    };
    const authority = requireStyle01RenderQualification({
      illustrationStyle: STYLE_ID,
      frozenContractHash: contractHash,
      storySourceHash: frozenProduct.storySourceHash,
      cache,
      repoRoot: ROOT,
      pageNumbers: [pageNumber],
    });
    if (!authority) throw new Error('Wizard render qualification returned no runtime authority');
    await runAfterPageReferencePreflight(authority, [pageNumber], async () => undefined);

    const childAnchor = optionalArg('child-anchor');
    const qualificationEvidence = {
      version: 'published-wizard-low-page-proof/v1',
      status: renderLow ? 'qualified_for_single_low_page' : 'qualified_provider_free',
      storyKey,
      companionId,
      pageNumber,
      packagePath: selection.packagePath,
      packageRevisionDigest: selection.packageValue.revisionDigest,
      sourcePath: selection.sourcePath,
      sourceRawDigest: selection.sourceRawDigest,
      frozenStorySourceHash: frozenProduct.storySourceHash,
      runtimeAuthorityVersion: authority.version,
      runtimeContractHash: authority.contractHash,
      boardAssetSha256: Object.fromEntries(
        Object.entries(setIdentityBoards.bindings).map(([id, binding]) => [id, binding.assetSha256]),
      ),
      childAnchorSha256:
        childAnchor && fs.existsSync(childAnchor) ? sha256(fs.readFileSync(childAnchor)) : null,
      credentialAccess: 'none',
      providerCalls: 0,
      transportRetries: 0,
      fallbackUsed: false,
    };
    fs.writeFileSync(
      path.join(outputRoot, 'qualification-evidence.json'),
      `${JSON.stringify(qualificationEvidence, null, 2)}\n`,
      'utf8',
    );
    console.log(JSON.stringify({ stage: 'qualification_pass', ...qualificationEvidence }, null, 2));
    if (!renderLow) return;

    if (!childAnchor || !fs.existsSync(childAnchor) || !fs.lstatSync(childAnchor).isFile()) {
      throw new Error('--child-anchor must point to a canonical styled child anchor for --render-low');
    }
    loadOnlyOpenAiKey();
    process.env.IMAGE_PROVIDER = 'gpt-image';
    process.env.PHASE2_STYLE01_BOOK_PIPELINE = 'true';
    process.env.STYLE_01_GPT_MODEL = 'gpt-image-2';
    process.env.GPT_IMAGE_MODEL = 'gpt-image-2';
    process.env.STYLE_01_AUDITION_MODE = 'true';
    process.env.STYLE01_QA_IMAGE_QUALITY = 'low';
    process.env.GPT_IMAGE_QUALITY = 'low';
    process.env.PAGE_VISUAL_QA_ENABLED = 'false';
    process.env.ENABLE_PRESENTATION_POSTPROCESS = 'false';
    process.env.PAGE_REF_MANIFEST_DIR = path.join(outputRoot, 'reference-evidence');

    const companion = getCompanionById(companionId);
    if (!companion) throw new Error(`${companionId} companion is missing`);
    const result = await generateImage({
      pagePrompt: imageDirection.imageDirection,
      rawScenePrompt: imageDirection.imageDirection,
      bookPageText: storyPage.text,
      illustrationStyle: STYLE_ID,
      runtimeVisualAuthority: authority,
      companion,
      orderId: `published-wizard-low-${storyKey}`,
      pageNumber,
      totalPages: product.pages,
      childFirstName: childName,
      childAge,
      childGender,
      childStructured: {
        face: 'recognisable real face from the supplied canonical anchor, with natural child proportions',
        hair: `${family.hairTexture} ${family.hairColour} hair matching the canonical anchor silhouette`,
        body: `anatomically natural small ${childAge}-year-old child proportions, never chibi or mascot-like`,
        clothing: 'authority supplied',
        signature: `same real ${childName} identity; consistent facial structure and hair silhouette without caricature`,
      },
      referenceImages: [childAnchor],
      childReferenceKind: 'canonical_anchor',
      requestTimeoutMs: 10 * 60 * 1000,
    });
    const urlPath = decodeURIComponent(new URL(result.url).pathname).replace(
      '/storage/v1/object/public/',
      '',
    );
    const storedPath = path.resolve(storageRoot, ...urlPath.split('/').filter(Boolean));
    if (!fs.existsSync(storedPath)) throw new Error('generated page was not persisted to local storage');
    const finalPath = path.join(outputRoot, `page-${String(pageNumber).padStart(2, '0')}-gpt-image-2-low.png`);
    fs.copyFileSync(storedPath, finalPath);
    const promptPath = path.join(outputRoot, `page-${String(pageNumber).padStart(2, '0')}-final-prompt.txt`);
    fs.writeFileSync(promptPath, `${result.prompt}\n`, 'utf8');
    const imageBytes = fs.readFileSync(finalPath);
    const cost = estimateGptImage2CostUsd(result.style01Meta?.usage ?? undefined);
    const renderEvidence = {
      ...qualificationEvidence,
      status: 'rendered_single_low_page',
      credentialAccess: 'approved_local_env_file',
      providerCalls: 1,
      model: result.provider,
      quality: 'low',
      width: result.width,
      height: result.height,
      usage: result.style01Meta?.usage ?? null,
      estimatedCostUsd: cost.estimatedCostUsd,
      costRateSource: cost.costRateSource,
      promptSha256: sha256(result.prompt),
      imageSha256: sha256(imageBytes),
      imageBytes: imageBytes.length,
      imagePath: path.relative(ROOT, finalPath).replace(/\\/g, '/'),
      promptPath: path.relative(ROOT, promptPath).replace(/\\/g, '/'),
      visualQaProviderCalls: 0,
      remoteDatabaseAccess: false,
      remoteStorageAccess: false,
    };
    fs.writeFileSync(
      path.join(outputRoot, 'render-evidence.json'),
      `${JSON.stringify(renderEvidence, null, 2)}\n`,
      'utf8',
    );
    console.log(JSON.stringify({ stage: 'render_complete', ...renderEvidence }, null, 2));
  } finally {
    await new Promise<void>((resolve, reject) =>
      localStorage.server.close((error) => (error ? reject(error) : resolve())),
    );
    delete process.env.OPENAI_API_KEY;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
