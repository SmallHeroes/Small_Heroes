import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import * as ts from 'typescript';
import {
  createRepositorySourceInventory,
  STRUCTURAL_REPOSITORY_SCAN_TIMEOUT_MS,
} from './helpers/repository-source-inventory';
import { BARRIER_OWNED_PIPELINE_CACHE_KEYS } from '@/lib/generation-pipeline/pipeline-cache-store';

const ROOT = process.cwd();
const MODEL_NAMES = new Set(['generatedBook', 'bookPage', 'imageAsset', 'order', 'generationJob']);
const DELIVERY_ORDER_FIELDS = new Set([
  'customerEmail',
  'customerName',
  'childName',
  'expectedPageCount',
  'storySourceHash',
  'selectionFilename',
  'frozenProductVersion',
  'visualPackageAuthority',
  // Producing-snapshot delivery-binding inputs: the contract stamp is written
  // post-creation only inside the freeze's barrier mutation; illustrationStyle
  // has no post-creation writer today (creation-only), and tracking it here
  // forces any future writer through the barrier.
  'visualContractHash',
  'illustrationStyle',
  'fulfillmentVersion',
  'inputVersion',
  // (Codex round-5 finding 6) EVERY real generation input joins the census:
  // the child photo + anchor selections feed the render, the Order-level
  // cover is a delivery-payload fallback, and gender/age personalize the
  // book. Post-creation writers must be barrier-protected or carry an exact
  // pinned field-level exception below.
  'childImageUrl',
  'characterAnchors',
  'childGender',
  'childAge',
  'coverImageUrl',
]);
const WRITE_METHODS = new Set([
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
]);

interface WriterSite {
  relative: string;
  line: number;
  model: string;
  method: string;
  protectedByBarrier: boolean;
  dataFields: string[] | null;
}

interface DelegateAlias {
  model: string;
  client: string | null;
}
// (Codex round-4 MAJOR 3) The census scans the WHOLE writable source surface:
// operational scripts join the roots, and every supported source extension is
// inventoried — a .mjs/.cjs/.js/.tsx writer is a writer.
const repositorySources = createRepositorySourceInventory({
  root: ROOT,
  roots: ['app', 'lib', 'backend', 'scripts'],
  extensions: ['.ts', '.tsx', '.js', '.mjs', '.cjs'],
  excludedEntryNames: ['node_modules', '__tests__'],
  excludeDotEntries: true,
});

const RETIRED_SCRIPTS_DIR = 'scripts/retired/';

/**
 * (Codex round-4 MAJOR 3) The exact, reviewable allowlist of ACTIVE operational
 * scripts with direct delivery-row model writes. Scripts run operator-side
 * against dev/staging fixtures, outside the runtime barrier — that bounded
 * scope is sanctioned ONLY per-file and per-write-signature: a new writer
 * script, or a new write shape inside an allowlisted one, fails the census and
 * forces review. `pipelineCache` writes are NEVER sanctioned here (enforced
 * separately below): an active script may seed a job only through
 * `withoutBarrierOwnedPipelineCacheKeys`, and whole-cache updates live only in
 * `scripts/retired/` (explicitly retired, see its README).
 */
/** Exact per-site signature: `${model}.${method}[${sorted fields, or 'dynamic' for spread payloads}]`. */
function siteSignature(site: WriterSite): string {
  const fields = site.dataFields === null ? 'dynamic' : [...site.dataFields].sort().join(',');
  return `${site.model}.${site.method}[${fields}]`;
}

// (Codex round-5 finding 6) Field-level pinning — a new FIELD inside an allowlisted write, not just
// a new write, fails the census and forces review.
const ACTIVE_SCRIPT_WRITER_ALLOWLIST: Record<string, readonly string[]> = {
  // The operational twin of the runtime child-photo privacy scrub — same exact field shape,
  // additionally gated by isSanctionedChildPhotoScrub (fields + scrub-builder reference).
  'scripts/audit-child-photos.ts': ['order.update[characterAnchors,childImageUrl]'],
  'scripts/cancel-job.mjs': ['generationJob.updateMany[currentStage,lastError,leaseExpiresAt,lockedBy,retryable,status]'],
  'scripts/dry-run-bunny-manifest.ts': [
    'order.create[addonsPrice,audioEnabled,avoidFree,avoidItems,basePrice,bookName,bundleEnabled,challengeFree,challengeItems,characterAnchors,childAge,childGender,childImageUrl,childName,childSuperpower,childTraits,customerEmail,customerName,dedication,familyContext,helperFree,helperItems,illustrationStyle,outcomeFree,outcomeItems,paymentProvider,pdfEnabled,status,storyDirection,storyLength,topic,totalPrice,videoEnabled]',
  ],
  'scripts/run-bunny-smoke-render.ts': [
    'generatedBook.update[coverImageUrl]',
    'generationJob.create[currentStage,orderId,pipelineCache,status,triggerReason]',
    'generationJob.updateMany[currentStage,imagesDone,status]',
    'imageAsset.delete[dynamic]',
    'order.update[characterAnchors]',
    'order.update[coverImageUrl]',
  ],
  'scripts/run-five-page-gate-maia.ts': ['generationJob.update[currentStage,imagesDone,lastError,retryable,status]'],
  'scripts/run-page20-gate-maia.ts': ['generationJob.update[currentStage,imagesDone,lastError,retryable,status]'],
  'scripts/run-page8-gate-maia.ts': ['generationJob.update[currentStage,imagesDone,lastError,retryable,status]'],
  'scripts/run-spot-regen-dini-entity-pages.ts': ['generationJob.update[currentStage,imagesDone,lastError,retryable,status]'],
  'scripts/run-stage0-anchor-only.ts': ['generationJob.update[currentStage,lastError,leaseExpiresAt,lockedBy,retryable,status]'],
  'scripts/seed-hash-proof-order.ts': ['order.create[dynamic]'],
  'scripts/test-chunked-generation-resume.ts': [
    'bookPage.create[bookId,narrationText,pageNumber,text]',
    'bookPage.create[bookId,narrationText,pageNumber,text]',
    'bookPage.create[bookId,narrationText,pageNumber,text]',
    'bookPage.deleteMany[dynamic]',
    'generatedBook.create[coverText,orderId,title]',
    'generatedBook.deleteMany[dynamic]',
    'generationJob.create[currentStage,imagesDone,lastError,orderId,pageAttempts,retryable,status,textDone]',
    'generationJob.create[currentStage,imagesDone,orderId,pipelineCache,status,textDone]',
    'generationJob.deleteMany[dynamic]',
    'imageAsset.create[idempotencyKey,pageId,prompt,provider,url]',
    'imageAsset.create[idempotencyKey,pageId,prompt,provider,url]',
    'imageAsset.deleteMany[dynamic]',
    'order.create[addonsPrice,audioStatus,avoidItems,basePrice,challengeItems,childAge,childGender,childName,childTraits,customerEmail,customerName,helperItems,id,illustrationStyle,imageStatus,outcomeItems,packageStatus,paymentId,paymentProvider,status,storyLength,textStatus,topic,totalPrice]',
    'order.deleteMany[dynamic]',
    'order.update[imageStatus,lastError,status]',
  ],
};

function source(relative: string): string {
  return readFileSync(path.join(ROOT, relative), 'utf8');
}

function propertyText(name: ts.PropertyName | ts.BindingName | undefined): string | null {
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return null;
}

function clientIdentifier(node: ts.Expression): string | null {
  return ts.isIdentifier(node) ? node.text : null;
}

function collectDelegateAliases(file: ts.SourceFile): Map<string, DelegateAlias> {
  const aliases = new Map<string, DelegateAlias>();
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      if (
        ts.isIdentifier(node.name) &&
        ts.isPropertyAccessExpression(node.initializer) &&
        MODEL_NAMES.has(node.initializer.name.text)
      ) {
        aliases.set(node.name.text, {
          model: node.initializer.name.text,
          client: clientIdentifier(node.initializer.expression),
        });
      }
      if (ts.isObjectBindingPattern(node.name)) {
        for (const element of node.name.elements) {
          const local = propertyText(element.name);
          const model = propertyText(element.propertyName ?? element.name);
          if (local && model && MODEL_NAMES.has(model)) {
            aliases.set(local, { model, client: clientIdentifier(node.initializer) });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return aliases;
}

function barrierProtected(node: ts.Node, client: string | null): boolean {
  let cursor: ts.Node | undefined = node;
  while (cursor) {
    if (
      (ts.isArrowFunction(cursor) || ts.isFunctionExpression(cursor)) &&
      ts.isCallExpression(cursor.parent) &&
      cursor.parent.arguments[2] === cursor &&
      cursor.parent.expression.getText().endsWith('withDeliveryInputMutation') &&
      cursor.parameters.length > 0 &&
      ts.isIdentifier(cursor.parameters[0].name) &&
      cursor.parameters[0].name.text === client
    ) {
      return true;
    }
    cursor = cursor.parent;
  }
  return false;
}

function objectDataFields(call: ts.CallExpression): string[] | null {
  const args = call.arguments[0];
  if (!args || !ts.isObjectLiteralExpression(args)) return null;
  const data = args.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) && propertyText(property.name) === 'data',
  );
  if (!data || !ts.isObjectLiteralExpression(data.initializer)) return null;
  const fields: string[] = [];
  for (const property of data.initializer.properties) {
    if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) return null;
    const field = propertyText(property.name);
    if (!field) return null;
    fields.push(field);
  }
  return fields.sort();
}

function scriptKindOf(relative: string): ts.ScriptKind {
  if (relative.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (relative.endsWith('.ts')) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS; // .js / .mjs / .cjs
}

function writerSitesFromSource(relative: string, text: string): WriterSite[] {
  const file = ts.createSourceFile(relative, text, ts.ScriptTarget.Latest, true, scriptKindOf(relative));
  const aliases = collectDelegateAliases(file);
  const sites: WriterSite[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      if (WRITE_METHODS.has(method)) {
        const delegate = node.expression.expression;
        let model: string | undefined;
        let client: string | null = null;
        if (ts.isPropertyAccessExpression(delegate) && MODEL_NAMES.has(delegate.name.text)) {
          model = delegate.name.text;
          client = clientIdentifier(delegate.expression);
        } else if (ts.isElementAccessExpression(delegate) && ts.isStringLiteral(delegate.argumentExpression)) {
          if (MODEL_NAMES.has(delegate.argumentExpression.text)) {
            model = delegate.argumentExpression.text;
            client = clientIdentifier(delegate.expression);
          }
        } else if (ts.isIdentifier(delegate)) {
          const alias = aliases.get(delegate.text);
          model = alias?.model;
          client = alias?.client ?? null;
        }
        if (model) {
          const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
          sites.push({
            relative,
            line: line + 1,
            model,
            method,
            protectedByBarrier: barrierProtected(node, client),
            dataFields: objectDataFields(node),
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return sites;
}

function isDisplayOnlyException(site: WriterSite): boolean {
  if (!site.dataFields) return false;
  const fields = new Set(site.dataFields);
  if (
    site.relative === 'app/api/orders/[orderId]/video/route.ts' &&
    site.model === 'generatedBook'
  ) {
    return fields.size === 1 && fields.has('videoUrl');
  }
  if (
    (site.relative === 'lib/generation-pipeline/chunk-runner.ts' ||
      site.relative === 'lib/single-page-image-regen.ts') &&
    site.model === 'bookPage'
  ) {
    const displayOnly = new Set(['textZone', 'lighting', 'textColorScheme']);
    return [...fields].every((field) => displayOnly.has(field));
  }
  return false;
}

function isDeliveryInputWriter(site: WriterSite, sourceText?: string): boolean {
  if (site.model === 'generationJob') {
    // The job row is delivery-relevant ONLY through the producing pipeline
    // snapshot: any prisma-level write carrying `pipelineCache` is a
    // delivery-input write (the sanctioned writers — the freeze barrier's
    // jsonb_set and the ordinary merge store that structurally preserves the
    // producing keys — are raw SQL and thus outside this census by design).
    if (site.dataFields) return site.dataFields.includes('pipelineCache');
    // Fields unresolvable (spread / identifier payload): decide from the call
    // window — a `pipelineCache:` KEY within it marks a cache write. Spread
    // laundering through helper params is closed at the type level
    // (updateStage excludes pipelineCache from its extra input).
    if (!sourceText) return true;
    return /(^|[^A-Za-z])pipelineCache\s*:/.test(sourceWindow(site, sourceText, 24));
  }
  if (site.model !== 'order') return true;
  if (!site.dataFields) return true;
  return site.dataFields.some((field) => DELIVERY_ORDER_FIELDS.has(field));
}

function isOrderCreationException(site: WriterSite): boolean {
  return (
    site.model === 'order' &&
    site.method === 'create' &&
    site.relative === 'app/api/orders/handler.ts'
  );
}

/**
 * (Codex round-5 finding 6) The post-completion child-photo privacy scrub — the runtime deletion
 * policy (lib/child-photo-deletion.ts) and its operational audit twin (scripts/audit-child-photos.ts).
 * Sanctioned by EXACT model+method+fields: `order.update` writing exactly
 * {childImageUrl, characterAnchors} through buildCharacterAnchorsAfterPhotoDeletion (the window must
 * reference the scrub builder). Deliberately OUTSIDE the barrier: the scrub runs after
 * completion/terminal failure and must not re-trigger packaging; a photo-dependent re-render after
 * deletion is impossible by design (Track 4) — the scrub IS the durable record of that.
 */
const CHILD_PHOTO_SCRUB_FILES = new Set([
  'lib/child-photo-deletion.ts',
  'scripts/audit-child-photos.ts',
]);
function isSanctionedChildPhotoScrub(site: WriterSite, sourceText?: string): boolean {
  return (
    CHILD_PHOTO_SCRUB_FILES.has(site.relative) &&
    site.model === 'order' &&
    site.method === 'update' &&
    site.dataFields !== null &&
    [...(site.dataFields ?? [])].sort().join(',') === 'characterAnchors,childImageUrl' &&
    sourceWindow(site, sourceText).includes('buildCharacterAnchorsAfterPhotoDeletion')
  );
}

/**
 * (Codex round-5 finding 6) GENERATION-STAGE input persistence: the Stage-0/cover writes that
 * FREEZE anchors and the cover URL during the generation run itself — before the readiness
 * evaluation that will bind them ever runs. Pinned by EXACT model+method+field-set per file; any
 * new field or file fails the census. Post-delivery mutation flows do NOT qualify: the regen flow's
 * anchor write goes through the barrier (single-page-image-regen), and every redrive that could
 * re-enter these stages re-runs the readiness commit afterward.
 */
const GENERATION_STAGE_INPUT_FIELDSETS: Record<string, readonly string[]> = {
  'lib/generation-pipeline/chunk-runner.ts': [
    'characterAnchors',
    'characterAnchors,childImageUrl',
    'coverImageUrl',
  ],
  // Dev anchor approval resumes generation with the approved anchor in one write.
  'app/api/dev/approve-child-anchor/route.ts': [
    'characterAnchors,errorAt,lastError,status',
  ],
};
function isGenerationStageInputPersistence(site: WriterSite): boolean {
  const allowedFieldSets = GENERATION_STAGE_INPUT_FIELDSETS[site.relative];
  if (!allowedFieldSets || site.model !== 'order' || site.method !== 'update') return false;
  if (site.dataFields === null) return false;
  const fieldSet = [...site.dataFields].sort().join(',');
  return allowedFieldSets.includes(fieldSet);
}

function sourceWindow(site: WriterSite, sourceText: string | undefined, lines = 25): string {
  if (!sourceText) return '';
  return sourceText
    .split(/\r?\n/)
    .slice(Math.max(0, site.line - 1), site.line + lines)
    .join('\n');
}

function isJobCreationSeedException(site: WriterSite, sourceText?: string): boolean {
  // Creating a job that does not exist yet has no barrier-written state to
  // protect — but ONLY when the seed is structurally stripped at the call site
  // (the window must reference withoutBarrierOwnedPipelineCacheKeys, so a seed
  // that could smuggle producing provenance or a Board binding never
  // qualifies). (Codex round-4 MAJOR 2: creation/reseed paths must strip.)
  return (
    site.model === 'generationJob' &&
    site.method === 'create' &&
    sourceWindow(site, sourceText).includes('withoutBarrierOwnedPipelineCacheKeys')
  );
}

/**
 * (Codex round-4 MAJOR 3) Script-side discipline. A retired script (scripts/retired/)
 * is sanctioned wholesale — it is explicitly retired from operational use (README)
 * and pinned by exact file list below. An ACTIVE script write is sanctioned only
 * when its file + exact write signature is in ACTIVE_SCRIPT_WRITER_ALLOWLIST AND
 * it is not a pipelineCache write (a stripped creation seed is the one exception,
 * via isJobCreationSeedException). Signature pinning happens in its own test; this
 * predicate only decides membership for the unsafe-scan.
 */
function isSanctionedScriptWrite(site: WriterSite, sourceText?: string): boolean {
  if (!site.relative.startsWith('scripts/')) return false;
  if (site.relative.startsWith(RETIRED_SCRIPTS_DIR)) return true;
  if (!(site.relative in ACTIVE_SCRIPT_WRITER_ALLOWLIST)) return false;
  if (site.model !== 'generationJob') return true;
  // generationJob in an ACTIVE script: a cache write is sanctioned only as a
  // stripped creation seed; job-STATE writes pass the isDeliveryInputWriter
  // classifier anyway.
  if (!isDeliveryInputWriter(site, sourceText)) return true;
  return isJobCreationSeedException(site, sourceText);
}

function isReadinessCommitOrderStateWrite(site: WriterSite): boolean {
  return (
    site.model === 'order' &&
    site.method === 'updateMany' &&
    site.relative === 'lib/generation-pipeline/readiness-manifest.ts'
  );
}

function isExplicitReconciliationFulfillmentRoll(site: WriterSite): boolean {
  return (
    site.model === 'order' &&
    site.method === 'updateMany' &&
    site.relative === 'lib/generation-chunked/exception-case.ts' &&
    site.dataFields?.length === 1 &&
    site.dataFields[0] === 'fulfillmentVersion'
  );
}

/**
 * (release shape C + 2a-2) asset-safety-writer.ts is the ONE sanctioned ImageAsset/GeneratedBook writer that runs
 * OUTSIDE the delivery-input barrier — by design: the phase-2 SHA bind must not `inspectAsset` inside the Order-lock
 * tx, and the release override writes inside the READINESS tx, not this barrier. Three tightly-scoped shapes live in
 * that exact file:
 *   • phase-2 SHA bind — `updateMany`, the single content SHA (safetyContentSha256 / coverSafetyContentSha256);
 *   • release override — `update`, ONLY the override columns (safety{,cover}OverriddenHazards + OverrideSha256).
 *   • retained-byte reconciliation — `updateMany` through the canonical safety field-builder, called from the
 *     release recovery's delivery-input barrier after exact-byte QA.
 * An INLINE detector-field write is NOT covered — asset-safety-writer-coverage.spec.ts still forces detector writes
 * through the field-builders.
 */
const SAFETY_WRITER_OVERRIDE_FIELDS: Record<string, Set<string>> = {
  imageAsset: new Set(['safetyOverriddenHazards', 'safetyOverrideSha256']),
  generatedBook: new Set(['coverSafetyOverriddenHazards', 'coverSafetyOverrideSha256']),
};
const SAFETY_WRITER_CONTENT_SHA: Record<string, string> = {
  imageAsset: 'safetyContentSha256',
  generatedBook: 'coverSafetyContentSha256',
};
function isSanctionedSafetyWriterWrite(site: WriterSite, sourceText?: string): boolean {
  if (site.relative !== 'lib/generation-pipeline/asset-safety-writer.ts') return false;
  if (site.model !== 'imageAsset' && site.model !== 'generatedBook') return false;
  if (!site.dataFields) {
    const window = sourceWindow(site, sourceText, 35);
    return (
      site.method === 'updateMany' &&
      (site.model === 'imageAsset'
        ? window.includes('data: imageAssetSafetyFields(')
        : window.includes('data: coverSafetyFields('))
    );
  }
  if (site.method === 'updateMany' && site.dataFields.length === 1 && site.dataFields[0] === SAFETY_WRITER_CONTENT_SHA[site.model]) return true;
  const override = SAFETY_WRITER_OVERRIDE_FIELDS[site.model];
  if (site.method === 'update' && site.dataFields.length > 0 && site.dataFields.every((f) => override.has(f))) return true;
  return false;
}

function hasFlagOnDevWriteGuard(relative: string, cachedText?: string): boolean {
  if (!relative.startsWith('app/api/dev/')) return false;
  const text = cachedText ?? source(relative);
  return (
    text.includes('isReadinessManifestEnabled() && !packageDryRun') &&
    text.includes('Story-bank generation is unavailable while readiness enforcement is enabled')
  );
}

describe('P1-f #5 delivery-input writer coverage', () => {
  const requiredBarrierFiles = [
    'lib/generation-pipeline/text-finalization.ts',
    'lib/generation-pipeline/chunk-runner.ts',
    'lib/single-page-image-regen.ts',
    'lib/generation-chunked/clear-page-images-for-regen.ts',
    'app/api/debug/replicate-image/route.ts',
  ];

  it('all known base-book input writers call the central transactional barrier', () => {
    for (const file of requiredBarrierFiles) {
      expect(source(file), `${file} must use withDeliveryInputMutation`).toContain(
        'withDeliveryInputMutation',
      );
    }
  });

  it('has no unprotected model writer, including tx/aliases/destructuring and guarded dev routes', () => {
    const sources = repositorySources();
    const sourceByRelative = new Map(sources.map((entry) => [entry.relative, entry.text]));
    const sites = sources.flatMap(({ relative, text }) =>
      writerSitesFromSource(relative, text),
    );

    const unsafe = sites.filter(
      (site) =>
        isDeliveryInputWriter(site, sourceByRelative.get(site.relative)) &&
        !site.protectedByBarrier &&
        !isDisplayOnlyException(site) &&
        !isOrderCreationException(site) &&
        !isJobCreationSeedException(site, sourceByRelative.get(site.relative)) &&
        !isReadinessCommitOrderStateWrite(site) &&
        !isExplicitReconciliationFulfillmentRoll(site) &&
        !isSanctionedSafetyWriterWrite(site, sourceByRelative.get(site.relative)) &&
        !isSanctionedChildPhotoScrub(site, sourceByRelative.get(site.relative)) &&
        !isGenerationStageInputPersistence(site) &&
        !isSanctionedScriptWrite(site, sourceByRelative.get(site.relative)) &&
        !hasFlagOnDevWriteGuard(site.relative, sourceByRelative.get(site.relative)),
    );
    expect(
      unsafe.map((site) => `${site.relative}:${site.line} ${site.model}.${site.method}`),
    ).toEqual([]);

    const devSites = sites.filter(
      (site) => site.relative.startsWith('app/api/dev/') && site.model !== 'order',
    );
    expect(devSites.length).toBeGreaterThan(0);
    // generationJob joined the census: approve-child-anchor and resume carry job-STATE
    // writes only (their pipelineCache persistence goes through the ordinary store /
    // is absent — the empty unsafe list above proves neither writes the cache key).
    expect([...new Set(devSites.map((site) => site.relative))].sort()).toEqual([
      'app/api/dev/approve-child-anchor/route.ts',
      'app/api/dev/generation/resume/route.ts',
      'app/api/dev/story-bank/route.ts',
    ]);
    expect(hasFlagOnDevWriteGuard('app/api/dev/story-bank/route.ts')).toBe(true);
  }, STRUCTURAL_REPOSITORY_SCAN_TIMEOUT_MS);

  it('pins the exact script-writer allowlist (active signatures + the retired set + its README)', () => {
    const sources = repositorySources();
    const sourceByRelative = new Map(sources.map((entry) => [entry.relative, entry.text]));
    const scriptSites = sources
      .filter(({ relative }) => relative.startsWith('scripts/'))
      .flatMap(({ relative, text }) => writerSitesFromSource(relative, text));

    const byFile = new Map<string, string[]>();
    for (const site of scriptSites) {
      const list = byFile.get(site.relative) ?? [];
      list.push(siteSignature(site));
      byFile.set(site.relative, list);
    }

    // Retired scripts: the exact file set is pinned (adding one is a reviewed decision) and each
    // must actually be a writer (a non-writer does not belong in the retired-writers directory).
    const retired = [...byFile.keys()].filter((file) => file.startsWith(RETIRED_SCRIPTS_DIR)).sort();
    expect(retired).toEqual([
      'scripts/retired/approve-mia-expression-partial.ts',
      'scripts/retired/approve-mia-expression-sheet.ts',
      'scripts/retired/configure-baby-dragon-anchor.ts',
      'scripts/retired/generate-mia-child-expression-sheet.ts',
      'scripts/retired/generate-shouting-variants-maia.ts',
      'scripts/retired/run-family-coherence-pages.ts',
      'scripts/retired/run-fox-uri-generalization-test.ts',
      'scripts/retired/run-slot01-final-visual-fixes.ts',
      'scripts/retired/run-slot01-fox-full-render.ts',
      'scripts/retired/run-slot01-selective-reroll-object-fix.ts',
      'scripts/retired/run-slot02-lion-bedtime-full-render.ts',
      'scripts/retired/run-style02-five-page-sample.ts',
      'scripts/retired/select-mia-shouting-anchor.ts',
    ]);
    expect(readFileSync(path.join(ROOT, 'scripts/retired/README.md'), 'utf8')).toContain(
      'persistOrdinaryPipelineCache',
    );
    // (Codex round-5 finding 6) MECHANICALLY non-operational: every retired script must throw its
    // retirement guard before any DB work — the exact marker is pinned so removing it fails here.
    for (const file of retired) {
      expect(
        sourceByRelative.get(file),
        `${file} must carry the mechanical retirement guard`,
      ).toContain("throw new Error('[retired-script]");
    }

    // Active scripts: every writer file and its exact write-signature multiset is pinned; no
    // stale allowlist entries; and NO active script writes pipelineCache except a stripped
    // creation seed (the structural rule the unsafe-scan enforces; re-asserted here directly).
    const active = [...byFile.entries()].filter(([file]) => !file.startsWith(RETIRED_SCRIPTS_DIR));
    const actual = Object.fromEntries(active.map(([file, sigs]) => [file, [...sigs].sort()]));
    const pinned = Object.fromEntries(
      Object.entries(ACTIVE_SCRIPT_WRITER_ALLOWLIST).map(([file, sigs]) => [file, [...sigs].sort()]),
    );
    expect(actual).toEqual(pinned);
    for (const site of scriptSites) {
      if (site.relative.startsWith(RETIRED_SCRIPTS_DIR) || site.model !== 'generationJob') continue;
      const text = sourceByRelative.get(site.relative);
      if (!isDeliveryInputWriter(site, text)) continue;
      expect(
        isJobCreationSeedException(site, text),
        `${site.relative}:${site.line} — active scripts may write pipelineCache only as a stripped creation seed`,
      ).toBe(true);
    }
  }, STRUCTURAL_REPOSITORY_SCAN_TIMEOUT_MS);

  it('derives the barrier-owned pipelineCache key inventory from the jsonb_set writers and pins the store arms', () => {
    // (Codex round-4 MAJOR 2) The inventory of barrier-owned keys is DERIVED from the actual
    // barrier jsonb_set call sites, then pinned equal to BARRIER_OWNED_PIPELINE_CACHE_KEYS — a new
    // barrier-owned key cannot appear without joining the structural store's protection set.
    const derivedKeys = new Set<string>();
    const writerFiles = new Set<string>();
    for (const { relative, text } of repositorySources()) {
      if (relative.startsWith(RETIRED_SCRIPTS_DIR)) continue;
      for (const statement of text.matchAll(/SET\s+"pipelineCache"\s*=\s*jsonb_set[^`]*/g)) {
        writerFiles.add(relative);
        for (const key of statement[0].matchAll(/'\{(\w+)\}'/g)) derivedKeys.add(key[1]);
      }
    }
    expect([...derivedKeys].sort()).toEqual([...BARRIER_OWNED_PIPELINE_CACHE_KEYS].sort());
    expect([...writerFiles].sort()).toEqual([
      'lib/generation-pipeline/ensure-frozen-visual-contract.ts',
      'lib/generation-pipeline/set-identity-board-stage.ts',
    ]);

    // The ordinary store must carry a value-verbatim overlay arm for EVERY barrier-owned key — and
    // never a normalizing function (jsonb_strip_nulls rewrites nested nulls recursively; the real-
    // Postgres spec pipeline-cache-store.pg.spec.ts proves the executed semantics byte-for-byte).
    const store = source('lib/generation-pipeline/pipeline-cache-store.ts');
    const storeStatement = store.match(/UPDATE "GenerationJob"[^`]*/)?.[0] ?? '';
    for (const key of BARRIER_OWNED_PIPELINE_CACHE_KEYS) {
      expect(storeStatement).toContain(`"pipelineCache" ? '${key}'`);
      expect(storeStatement).toContain(`jsonb_build_object('${key}', "pipelineCache" -> '${key}')`);
    }
    expect(storeStatement).not.toContain('jsonb_strip_nulls');
    expect(storeStatement).not.toContain('INSERT');
  }, STRUCTURAL_REPOSITORY_SCAN_TIMEOUT_MS);

  it('pins the exact raw-SQL statement shapes of every sanctioned raw writer (not file trust)', () => {
    // (Codex round-5 finding 6) The raw allowlists are backed by SHAPE pinning: every raw
    // `UPDATE "Order"` in the sanctioned files may SET only delivery-AUTHORITY columns, and every
    // raw `UPDATE "GenerationJob"` must be one of the exact known cache-writer statements. A new
    // SET column or a new statement shape fails here even inside an allowlisted file.
    // Line-based SET-column extraction (statement bodies interpolate nested template literals, so
    // whole-statement regexes truncate): from each `UPDATE "Order"` line until WHERE/RETURNING,
    // collect the columns of line-leading assignments (the repo's SQL style); CASE internals
    // (WHEN/THEN/ELSE lines) never lead with an assignment and are excluded by construction.
    const rawOrderSetColumns = (text: string): string[][] => {
      const lines = text.split(/\r?\n/);
      const statements: string[][] = [];
      for (let i = 0; i < lines.length; i++) {
        if (!/UPDATE\s+"Order"/.test(lines[i])) continue;
        const columns: string[] = [];
        for (let j = i; j < Math.min(lines.length, i + 60); j++) {
          const line = j === i ? lines[j].replace(/^[^]*UPDATE\s+"Order"[^S]*?(SET|$)/, '$1') : lines[j];
          if (j > i && /^\s*(WHERE|RETURNING)\b/.test(line)) break;
          if (/^\s*(?:SET\s+)?"(\w+)"\s*=/.test(line) || /^\s*SET\s+"/.test(line)) {
            for (const m of line.matchAll(/"(\w+)"\s*=(?!=)/g)) columns.push(m[1]);
          }
        }
        statements.push(columns);
      }
      return statements;
    };
    const RAW_ORDER_ALLOWED: Record<string, { statements: number; columns: Set<string> }> = {
      // The shared authority funnel: hold/ship/release/transition CASes — authority columns only.
      'lib/generation-pipeline/order-authority.ts': {
        statements: 4,
        columns: new Set(['status', 'packageStatus', 'deliveryHoldReason', 'manualReviewRequired', 'deliveryFenceVersion']),
      },
      // The delivery-input barrier's version-bump statements (flag-on + flag-off arms): the bump
      // itself plus the frozen-truth COALESCE-if-null stamps and the redrive status stack.
      'lib/generation-pipeline/readiness-manifest.ts': {
        statements: 2,
        columns: new Set([
          'inputVersion', 'expectedPageCount', 'storySourceHash', 'selectionFilename', 'frozenProductVersion',
          'status', 'packageStatus', 'imageStatus', 'deliveryHoldReason',
        ]),
      },
      // The anchor-release route performs NO raw Order UPDATE itself (its lock is a SELECT FOR
      // UPDATE; the release CAS lives in order-authority).
      'app/api/admin/anchor-hold-release/route.ts': { statements: 0, columns: new Set() },
    };
    for (const [relative, allowed] of Object.entries(RAW_ORDER_ALLOWED)) {
      const statements = rawOrderSetColumns(source(relative));
      expect(statements, `${relative}: raw Order UPDATE statement count`).toHaveLength(allowed.statements);
      for (const columns of statements) {
        expect(columns.length, `${relative}: raw Order UPDATE with unparseable SET`).toBeGreaterThan(0);
        for (const column of columns) {
          expect(
            allowed.columns.has(column),
            `${relative}: raw Order UPDATE sets unsanctioned column "${column}"`,
          ).toBe(true);
        }
      }
    }

    const jobStatements: string[] = [];
    for (const relative of [
      'lib/generation-pipeline/pipeline-cache-store.ts',
      'lib/generation-pipeline/ensure-frozen-visual-contract.ts',
      'lib/generation-pipeline/set-identity-board-stage.ts',
    ]) {
      const text = source(relative);
      for (const statement of text.matchAll(/UPDATE\s+"GenerationJob"[^`]*/g)) {
        jobStatements.push(statement[0].replace(/\s+/g, ' ').trim());
      }
    }
    // Exactly four sanctioned raw GenerationJob statements exist: the ordinary store's overlay,
    // the freeze's package (double jsonb_set) and legacy (single jsonb_set) arms, and the Board
    // bind. Each must keep its exact shape.
    expect(jobStatements).toHaveLength(4);
    const shapes = {
      storeOverlay: jobStatements.filter((s) => s.includes(`"pipelineCache" ? 'visualContract'`)),
      freezeDouble: jobStatements.filter((s) => /jsonb_set\( jsonb_set\(/.test(s) && s.includes("'{visualPackageAuthority}'")),
      freezeSingle: jobStatements.filter((s) => s.includes("'{visualContract}'") && !s.includes("'{visualPackageAuthority}'") && !s.includes('?')),
      boardBind: jobStatements.filter((s) => s.includes("'{setIdentityBoards}'")),
    };
    expect(shapes.storeOverlay).toHaveLength(1);
    expect(shapes.freezeDouble).toHaveLength(1);
    expect(shapes.freezeSingle).toHaveLength(1);
    expect(shapes.boardBind).toHaveLength(1);
    for (const statement of jobStatements) {
      expect(statement.startsWith('UPDATE "GenerationJob" SET "pipelineCache" =')).toBe(true);
      expect(statement).not.toMatch(/jsonb_strip_nulls/);
    }
  }, STRUCTURAL_REPOSITORY_SCAN_TIMEOUT_MS);

  it('migration SQL never rewrites GenerationJob.pipelineCache', () => {
    const migrationSources = createRepositorySourceInventory({
      root: ROOT,
      roots: ['backend/migrations'],
      extensions: ['.sql'],
      excludedEntryNames: ['node_modules'],
    })();
    const offenders: string[] = [];
    for (const { relative, text } of migrationSources) {
      for (const match of text.matchAll(/\b(?:UPDATE|INSERT\s+INTO)\s+(?:public\.)?"?GenerationJob"?[^;]*/gi)) {
        if (/pipelineCache/i.test(match[0])) offenders.push(relative);
      }
    }
    expect(offenders).toEqual([]);
  }, STRUCTURAL_REPOSITORY_SCAN_TIMEOUT_MS);

  it('has no raw SQL writer bypass for delivery-input tables', () => {
    const rawWrite =
      /\b(?:UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+(?:public\.)?["']?(GeneratedBook|BookPage|ImageAsset|Order|GenerationJob)["']?/gi;
    const found: string[] = [];
    for (const { relative, text } of repositorySources()) {
      for (const match of text.matchAll(rawWrite)) {
        if (
          // (Codex round-4 MAJOR 3) Raw GenerationJob writes join the census. The exhaustive
          // allowlist: the two barrier jsonb_set writers (single-key, inside
          // withDeliveryInputMutation callbacks) and the structural ordinary store (whose SQL
          // overlays the row's own barrier-owned keys). Nothing else may touch the table raw.
          match[1] === 'GenerationJob' &&
          (relative === 'lib/generation-pipeline/pipeline-cache-store.ts' ||
            relative === 'lib/generation-pipeline/ensure-frozen-visual-contract.ts' ||
            relative === 'lib/generation-pipeline/set-identity-board-stage.ts')
        ) {
          continue;
        }
        if (
          match[1] === 'Order' &&
          // (delivery fence — Codex round-4/5) The readiness ship-CAS, the anchor-release CAS, and the shared
          // order-authority funnel use raw `UPDATE "Order"` because their WHERE needs a NOT EXISTS subquery / a
          // fence+precedence CAS (delivery-AUTHORITY guards). They write only status/packageStatus/
          // deliveryHoldReason/manualReviewRequired/deliveryFenceVersion — NEVER a delivery-INPUT field — so they
          // are not a barrier bypass. This is the exhaustive allowlist for authority-only raw writes. (The
          // dedicated bind+bump structural guard is order-authority-writer-guard.spec.ts.)
          (relative === 'lib/generation-pipeline/readiness-manifest.ts' ||
            relative === 'app/api/admin/anchor-hold-release/route.ts' ||
            relative === 'lib/generation-pipeline/order-authority.ts')
        ) {
          continue;
        }
        const line = text.slice(0, match.index).split('\n').length;
        found.push(`${relative}:${line} ${match[0]}`);
      }
    }
    expect(found).toEqual([]);
  }, STRUCTURAL_REPOSITORY_SCAN_TIMEOUT_MS);

  it('the detector itself catches transaction clients and aliased/destructured delegates', () => {
    const fixture = `
      async function sample(tx: any) {
        await tx.generatedBook.update({ data: { title: 'x' } });
        const pages = tx.bookPage;
        await pages.deleteMany({});
        const { imageAsset: assets } = tx;
        await assets.upsert({ data: { url: 'x' } });
        await tx.order.update({ data: { inputVersion: 4 } });
      }
    `;
    expect(
      writerSitesFromSource('fixture.ts', fixture).map((site) => `${site.model}.${site.method}`),
    ).toEqual([
      'generatedBook.update',
      'bookPage.deleteMany',
      'imageAsset.upsert',
      'order.update',
    ]);
  });

  it('covers Order-table frozen delivery inputs, including immutable Visual Package authority — set + classifier, regression-proof', () => {
    // The frozen product-truth fields ARE delivery inputs: any post-creation writer of them must be
    // barrier-protected (order creation is the sole exemption). Pin both the coverage SET and the classifier so a
    // dropped field can't silently narrow Order coverage (the comprehensive scan above already enforces it, but
    // nothing tested that Order + these fields are in scope until now).
    for (const field of ['storySourceHash', 'selectionFilename', 'frozenProductVersion', 'expectedPageCount', 'visualPackageAuthority', 'visualContractHash', 'illustrationStyle']) {
      expect(DELIVERY_ORDER_FIELDS.has(field), `${field} must be a tracked Order delivery input`).toBe(true);
    }
    const fixture = `
      async function w(tx: any) {
        await tx.order.update({ data: { storySourceHash: 'x' } });
        await tx.order.update({ data: { selectionFilename: 'x' } });
        await tx.order.update({ data: { frozenProductVersion: 'x' } });
        await tx.order.update({ data: { expectedPageCount: 5 } });
        await tx.order.update({ data: { visualPackageAuthority: { packageRevisionDigest: 'x' } } });
        await tx.order.update({ data: { visualContractHash: 'x' } });
        await tx.order.update({ data: { illustrationStyle: 'x' } });
        await tx.order.update({ data: { status: 'ready', packageStatus: 'done' } });
      }
    `;
    const sites = writerSitesFromSource('fixture.ts', fixture);
    // each frozen-field Order write is classified as a delivery-input writer (→ must be barrier-protected)…
    const flaggedFields = sites.filter((site) => isDeliveryInputWriter(site)).flatMap((site) => site.dataFields ?? []);
    expect(flaggedFields).toEqual(
      expect.arrayContaining(['storySourceHash', 'selectionFilename', 'frozenProductVersion', 'expectedPageCount', 'visualPackageAuthority', 'visualContractHash', 'illustrationStyle']),
    );
    // …while a pure order-STATE write (no delivery input) is NOT flagged, so the classifier stays discriminating.
    const stateSite = sites.find((site) => site.dataFields?.includes('status'));
    expect(stateSite && isDeliveryInputWriter(stateSite)).toBe(false);

    // GenerationJob: a pipelineCache write is a delivery-input write (producing provenance);
    // a job-STATE write is not.
    const jobFixture = `
      async function j(tx: any) {
        await tx.generationJob.update({ data: { pipelineCache: { textFinalized: true } } });
        await tx.generationJob.update({ data: { status: 'pending', currentStage: 'dna' } });
      }
    `;
    const jobSites = writerSitesFromSource('job-fixture.ts', jobFixture);
    const cacheSite = jobSites.find((site) => site.dataFields?.includes('pipelineCache'));
    const jobStateSite = jobSites.find((site) => site.dataFields?.includes('status'));
    expect(cacheSite && isDeliveryInputWriter(cacheSite)).toBe(true);
    expect(jobStateSite && isDeliveryInputWriter(jobStateSite)).toBe(false);
  });

  it('only treats the barrier callback transaction client as atomically protected', () => {
    const fixture = `
      async function sample(prisma: any) {
        await withDeliveryInputMutation(prisma, { orderId: 'o1' }, async (tx) => {
          await tx.generatedBook.update({ data: { title: 'safe' } });
          await prisma.generatedBook.update({ data: { title: 'outside-the-tx' } });
        });
      }
    `;
    expect(
      writerSitesFromSource('fixture.ts', fixture).map((site) => site.protectedByBarrier),
    ).toEqual([true, false]);
  });

  it('freezes product truth at order creation and removes direct email from chunk-runner', () => {
    expect(source('app/api/orders/handler.ts')).toContain('buildFrozenStoryProductTruth');
    expect(source('lib/generation-pipeline/chunk-runner.ts')).not.toContain('sendBookReadyEmail');
    expect(source('lib/generation-pipeline/chunk-runner.ts')).toContain('finalizePackageDelivery');
  });

  it('threads the reviewed recovery resemblance marker through the production page-delivery seam', () => {
    const chunkRunner = source('lib/generation-pipeline/chunk-runner.ts');

    // The durable reviewed-recovery marker activates the paid provider-loop gate and pins it to
    // the approved canonical child anchor. This is intentionally a source-level seam test: it
    // fails if a future refactor leaves the individually-tested producer/provider pieces present
    // but disconnects any of their real production call sites.
    expect(chunkRunner).toMatch(
      /releaseV1PageResemblanceGateRequired\s*=\s*requiresReleaseV1PageResemblanceGate\(cache\)/,
    );
    expect(chunkRunner).toMatch(
      /requirePageResemblanceGate:\s*releaseV1PageResemblanceGateRequired/,
    );
    expect(chunkRunner).toMatch(
      /pageResemblanceReferenceImage:\s*childCanonicalAnchor!\.url/,
    );

    // The same marker-derived policy must be committed atomically beside the selected delivered
    // bytes, included in the delivery-input receipt, and forwarded to delivered-byte QA together
    // with the raw candidate evidence. These three assertions close the recovery -> candidate ->
    // full-QA proof path for the resumed page set.
    expect(chunkRunner).toMatch(
      /const deliveredPageResemblancePolicy\s*=\s*releaseV1PageResemblanceGateRequired\s*&&\s*deliveredPageExpectsChild/,
    );
    expect(chunkRunner).toMatch(
      /mutationPayload:\s*\{[\s\S]*?pageResemblanceGate:\s*\(deliveredPageResemblancePolicy \?\? null\)/,
    );
    expect(chunkRunner).toMatch(
      /persistQualityContext\(tx,\s*\{[\s\S]*?pageResemblanceGate:\s*deliveredPageResemblancePolicy/,
    );
    expect(chunkRunner).toMatch(
      /persistDeliveredQualityEvidence\(prisma,\s*\{[\s\S]*?pageResemblanceGate:\s*\{[\s\S]*?\.\.\.deliveredPageResemblancePolicy[\s\S]*?rawEvidence:/,
    );
  });
});
