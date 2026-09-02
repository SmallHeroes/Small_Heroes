import { describe, expect, it } from 'vitest';
import * as ts from 'typescript';

import {
  createRepositorySourceInventory,
  STRUCTURAL_REPOSITORY_SCAN_TIMEOUT_MS,
} from '../../__tests__/helpers/repository-source-inventory';

const ROOT = process.cwd();
const WRITE_METHODS = new Set(['update', 'updateMany', 'upsert']);
const INVALIDATING_FIELDS = new Set([
  'assetSha256',
  'verdict',
  'evaluatorContractVersion',
  'reason',
  'providerModel',
  'evidence',
  'contractHash',
]);
const REVIEW_PROJECTION_FIELDS = [
  'reviewStatus',
  'reviewedAssetSha256',
  'reviewedContractHash',
  'reviewedBy',
  'reviewedAt',
  'reviewReason',
] as const;

interface QualityEvidenceWriteSite {
  relative: string;
  line: number;
  functionName: string;
  method: string;
  fields: Set<string>;
  nullFields: Set<string>;
}

const repositorySources = createRepositorySourceInventory({
  root: ROOT,
  roots: ['app', 'lib', 'backend'],
  extensions: ['.ts'],
  excludedEntryNames: ['node_modules', '__tests__'],
  excludeDotEntries: true,
});

function propertyName(name: ts.PropertyName | undefined): string | null {
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return null;
}

function objectProperty(
  object: ts.ObjectLiteralExpression,
  name: string,
): ts.PropertyAssignment | null {
  return (
    object.properties.find(
      (property): property is ts.PropertyAssignment =>
        ts.isPropertyAssignment(property) && propertyName(property.name) === name,
    ) ?? null
  );
}

function isQualityEvidenceDelegate(expression: ts.Expression): boolean {
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text === 'qualityEvidence';
  }
  return (
    ts.isElementAccessExpression(expression) &&
    !!expression.argumentExpression &&
    ts.isStringLiteral(expression.argumentExpression) &&
    expression.argumentExpression.text === 'qualityEvidence'
  );
}

function enclosingFunctionName(node: ts.Node): string {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isFunctionDeclaration(current) && current.name) return current.name.text;
    if (ts.isMethodDeclaration(current)) return propertyName(current.name) ?? '<method>';
    if (
      (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) &&
      current.parent &&
      ts.isVariableDeclaration(current.parent) &&
      ts.isIdentifier(current.parent.name)
    ) {
      return current.parent.name.text;
    }
    current = current.parent;
  }
  return '<module>';
}

function writePayload(
  call: ts.CallExpression,
  method: string,
): ts.ObjectLiteralExpression | null {
  const argument = call.arguments[0];
  if (!argument || !ts.isObjectLiteralExpression(argument)) return null;
  const property = objectProperty(argument, method === 'upsert' ? 'update' : 'data');
  return property && ts.isObjectLiteralExpression(property.initializer)
    ? property.initializer
    : null;
}

function sitesFromSource(relative: string, text: string): QualityEvidenceWriteSite[] {
  const source = ts.createSourceFile(
    relative,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const sites: QualityEvidenceWriteSite[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      WRITE_METHODS.has(node.expression.name.text) &&
      isQualityEvidenceDelegate(node.expression.expression)
    ) {
      const method = node.expression.name.text;
      const payload = writePayload(node, method);
      if (payload) {
        const fields = new Set<string>();
        const nullFields = new Set<string>();
        for (const property of payload.properties) {
          if (!ts.isPropertyAssignment(property)) continue;
          const name = propertyName(property.name);
          if (!name) continue;
          fields.add(name);
          if (property.initializer.kind === ts.SyntaxKind.NullKeyword) {
            nullFields.add(name);
          }
        }
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
        sites.push({
          relative,
          line: line + 1,
          functionName: enclosingFunctionName(node),
          method,
          fields,
          nullFields,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return sites;
}

function invalidatesReview(site: QualityEvidenceWriteSite): boolean {
  return [...site.fields].some((field) => INVALIDATING_FIELDS.has(field));
}

function missingExplicitNulls(site: QualityEvidenceWriteSite): string[] {
  return REVIEW_PROJECTION_FIELDS.filter((field) => !site.nullFields.has(field));
}

describe('QualityEvidence fresh-review invalidation writer coverage', () => {
  it('every production update that replaces evidence, context, or asset identity explicitly clears the full review projection', () => {
    const sites = repositorySources().flatMap(({ relative, text }) =>
      sitesFromSource(relative, text),
    );
    const invalidatingSites = sites.filter(invalidatesReview);
    expect(
      invalidatingSites.map((site) => `${site.relative}:${site.functionName}`).sort(),
    ).toEqual([
      'lib/generation-chunked/clear-page-images-for-regen.ts:reserveMarkAndClearRegen',
      'lib/generation-pipeline/asset-safety-writer.ts:writeRetainedSafetyEvaluation',
      'lib/generation-pipeline/human-verified-unverified-preparation.ts:prepareHumanVerifiedUnverifiedRelease',
      'lib/generation-pipeline/quality-evidence-producer.ts:persistQualityContext',
      'lib/generation-pipeline/quality-evidence.ts:persistQualityEvidence',
      'lib/generation-pipeline/release-v1-recovery.ts:executeReleaseV1Recovery',
    ]);
    expect(
      invalidatingSites.flatMap((site) => {
        const missing = missingExplicitNulls(site);
        return missing.length > 0
          ? [`${site.relative}:${site.line} ${site.functionName} missing ${missing.join(', ')}`]
          : [];
      }),
    ).toEqual([]);
  }, STRUCTURAL_REPOSITORY_SCAN_TIMEOUT_MS);

  it('asset deletion paths also clear the full projection even though no replacement evidence is written yet', () => {
    const source = repositorySources().find(
      ({ relative }) =>
        relative === 'lib/generation-chunked/clear-page-images-for-regen.ts',
    );
    expect(source, 'clear-page-images-for-regen.ts must be inventoried').toBeDefined();
    const sites = sitesFromSource(source!.relative, source!.text);
    for (const functionName of ['clearOrderPageImages', 'clearOrderCover']) {
      const site = sites.find((candidate) => candidate.functionName === functionName);
      expect(site, `${functionName} must update QualityEvidence`).toBeDefined();
      expect(missingExplicitNulls(site!)).toEqual([]);
    }
  });

  it('the delivered-evidence producer replaces evidence only inside the Order-first delivery-input barrier', () => {
    const source = repositorySources().find(
      ({ relative }) =>
        relative === 'lib/generation-pipeline/quality-evidence-producer.ts',
    );
    expect(source, 'quality-evidence-producer.ts must be inventoried').toBeDefined();
    const ast = ts.createSourceFile(
      source!.relative,
      source!.text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const producer = ast.statements.find(
      (statement): statement is ts.FunctionDeclaration =>
        ts.isFunctionDeclaration(statement) &&
        statement.name?.text === 'persistDeliveredQualityEvidence',
    );
    expect(producer?.body, 'persistDeliveredQualityEvidence body must exist').toBeDefined();
    let barrier: ts.CallExpression | null = null;
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'withDeliveryInputMutation'
      ) {
        barrier = node;
      }
      ts.forEachChild(node, visit);
    };
    visit(producer!.body!);
    expect(barrier, 'fresh delivered QA must use withDeliveryInputMutation').not.toBeNull();
    const callback = barrier!.arguments[2];
    expect(callback?.getText(ast)).toContain('persistQualityEvidence(tx, persistArgs)');
    expect(barrier!.arguments[1]?.getText(ast)).toContain(
      "reason: 'quality_evidence_changed'",
    );
  });

  it('a root-client regen reservation advances delivery authority inside the Order-first barrier', () => {
    const source = repositorySources().find(
      ({ relative }) => relative === 'lib/generation-pipeline/quality-evidence.ts',
    );
    expect(source, 'quality-evidence.ts must be inventoried').toBeDefined();
    const start = source!.text.indexOf('export function makeQualityRegenReserver');
    expect(start).toBeGreaterThanOrEqual(0);
    const body = source!.text.slice(start);
    expect(body).toContain("reason: 'quality_regen_reserved'");
    expect(body).toContain('withDeliveryInputMutation(');
    expect(body).toContain('ensureQualityEvidenceRow(tx, args)');
    expect(body).toContain('reserveQualityRegen(tx, args)');
  });

  it('the guard fails a representative stale-review write and accepts an explicit full invalidation', () => {
    const broken = sitesFromSource(
      'fixture.ts',
      `async function broken(tx: any) {
        await tx.qualityEvidence.update({
          where: { id: 'e1' },
          data: { evidence: { changed: true }, assetSha256: 'new-sha' },
        });
      }`,
    )[0]!;
    expect(invalidatesReview(broken)).toBe(true);
    expect(missingExplicitNulls(broken)).toEqual(REVIEW_PROJECTION_FIELDS);

    const valid = sitesFromSource(
      'fixture.ts',
      `async function valid(tx: any) {
        await tx.qualityEvidence.update({
          where: { id: 'e1' },
          data: {
            evidence: { changed: true },
            reviewStatus: null,
            reviewedAssetSha256: null,
            reviewedContractHash: null,
            reviewedBy: null,
            reviewedAt: null,
            reviewReason: null,
          },
        });
      }`,
    )[0]!;
    expect(invalidatesReview(valid)).toBe(true);
    expect(missingExplicitNulls(valid)).toEqual([]);
  });
});
