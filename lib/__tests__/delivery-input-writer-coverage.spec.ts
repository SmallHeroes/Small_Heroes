import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import * as ts from 'typescript';
import {
  createRepositorySourceInventory,
  STRUCTURAL_REPOSITORY_SCAN_TIMEOUT_MS,
} from './helpers/repository-source-inventory';

const ROOT = process.cwd();
const MODEL_NAMES = new Set(['generatedBook', 'bookPage', 'imageAsset', 'order']);
const DELIVERY_ORDER_FIELDS = new Set([
  'customerEmail',
  'customerName',
  'childName',
  'expectedPageCount',
  'storySourceHash',
  'selectionFilename',
  'frozenProductVersion',
  'visualPackageAuthority',
  'fulfillmentVersion',
  'inputVersion',
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
const repositorySources = createRepositorySourceInventory({
  root: ROOT,
  roots: ['app', 'lib', 'backend'],
  extensions: ['.ts'],
  excludedEntryNames: ['node_modules', '__tests__'],
  excludeDotEntries: true,
});

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

function writerSitesFromSource(relative: string, text: string): WriterSite[] {
  const file = ts.createSourceFile(relative, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
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

function isDeliveryInputWriter(site: WriterSite): boolean {
  if (site.model !== 'order') return true;
  if (!site.dataFields) return true;
  return site.dataFields.some((field) => DELIVERY_ORDER_FIELDS.has(field));
}

function isOrderCreationException(site: WriterSite): boolean {
  return (
    site.model === 'order' &&
    site.method === 'create' &&
    site.relative === 'app/api/orders/route.ts'
  );
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
 * tx, and the release override writes inside the READINESS tx, not this barrier. TWO tightly-scoped shapes, both in
 * that exact file, both writing ONLY non-delivery-input, non-detector safety columns:
 *   • phase-2 SHA bind — `updateMany`, the single content SHA (safetyContentSha256 / coverSafetyContentSha256);
 *   • release override — `update`, ONLY the override columns (safety{,cover}OverriddenHazards + OverrideSha256).
 * A detector-field (safetyVerified / safetyHazards) write is NOT covered here either — the complementary guard
 * asset-safety-writer-coverage.spec.ts forces every detector write through the field-builders.
 */
const SAFETY_WRITER_OVERRIDE_FIELDS: Record<string, Set<string>> = {
  imageAsset: new Set(['safetyOverriddenHazards', 'safetyOverrideSha256']),
  generatedBook: new Set(['coverSafetyOverriddenHazards', 'coverSafetyOverrideSha256']),
};
const SAFETY_WRITER_CONTENT_SHA: Record<string, string> = {
  imageAsset: 'safetyContentSha256',
  generatedBook: 'coverSafetyContentSha256',
};
function isSanctionedSafetyWriterWrite(site: WriterSite): boolean {
  if (site.relative !== 'lib/generation-pipeline/asset-safety-writer.ts' || !site.dataFields) return false;
  if (site.model !== 'imageAsset' && site.model !== 'generatedBook') return false;
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
        isDeliveryInputWriter(site) &&
        !site.protectedByBarrier &&
        !isDisplayOnlyException(site) &&
        !isOrderCreationException(site) &&
        !isReadinessCommitOrderStateWrite(site) &&
        !isExplicitReconciliationFulfillmentRoll(site) &&
        !isSanctionedSafetyWriterWrite(site) &&
        !hasFlagOnDevWriteGuard(site.relative, sourceByRelative.get(site.relative)),
    );
    expect(
      unsafe.map((site) => `${site.relative}:${site.line} ${site.model}.${site.method}`),
    ).toEqual([]);

    const devSites = sites.filter(
      (site) => site.relative.startsWith('app/api/dev/') && site.model !== 'order',
    );
    expect(devSites.length).toBeGreaterThan(0);
    expect([...new Set(devSites.map((site) => site.relative))]).toEqual([
      'app/api/dev/story-bank/route.ts',
    ]);
    expect(hasFlagOnDevWriteGuard('app/api/dev/story-bank/route.ts')).toBe(true);
  }, STRUCTURAL_REPOSITORY_SCAN_TIMEOUT_MS);

  it('has no raw SQL writer bypass for delivery-input tables', () => {
    const rawWrite =
      /\b(?:UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+(?:public\.)?["']?(GeneratedBook|BookPage|ImageAsset|Order)["']?/gi;
    const found: string[] = [];
    for (const { relative, text } of repositorySources()) {
      for (const match of text.matchAll(rawWrite)) {
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
    for (const field of ['storySourceHash', 'selectionFilename', 'frozenProductVersion', 'expectedPageCount', 'visualPackageAuthority']) {
      expect(DELIVERY_ORDER_FIELDS.has(field), `${field} must be a tracked Order delivery input`).toBe(true);
    }
    const fixture = `
      async function w(tx: any) {
        await tx.order.update({ data: { storySourceHash: 'x' } });
        await tx.order.update({ data: { selectionFilename: 'x' } });
        await tx.order.update({ data: { frozenProductVersion: 'x' } });
        await tx.order.update({ data: { expectedPageCount: 5 } });
        await tx.order.update({ data: { visualPackageAuthority: { packageRevisionDigest: 'x' } } });
        await tx.order.update({ data: { status: 'ready', packageStatus: 'done' } });
      }
    `;
    const sites = writerSitesFromSource('fixture.ts', fixture);
    // each frozen-field Order write is classified as a delivery-input writer (→ must be barrier-protected)…
    const flaggedFields = sites.filter(isDeliveryInputWriter).flatMap((site) => site.dataFields ?? []);
    expect(flaggedFields).toEqual(
      expect.arrayContaining(['storySourceHash', 'selectionFilename', 'frozenProductVersion', 'expectedPageCount', 'visualPackageAuthority']),
    );
    // …while a pure order-STATE write (no delivery input) is NOT flagged, so the classifier stays discriminating.
    const stateSite = sites.find((site) => site.dataFields?.includes('status'));
    expect(stateSite && isDeliveryInputWriter(stateSite)).toBe(false);
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
    expect(source('app/api/orders/route.ts')).toContain('buildFrozenStoryProductTruth');
    expect(source('lib/generation-pipeline/chunk-runner.ts')).not.toContain('sendBookReadyEmail');
    expect(source('lib/generation-pipeline/chunk-runner.ts')).toContain('finalizePackageDelivery');
  });
});
