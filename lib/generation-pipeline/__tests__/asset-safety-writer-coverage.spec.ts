import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import * as ts from 'typescript';
import {
  createRepositorySourceInventory,
  STRUCTURAL_REPOSITORY_SCAN_TIMEOUT_MS,
} from '../../__tests__/helpers/repository-source-inventory';

/**
 * (release shape C — the structural guard) The LAST line of defense before an unsafe image ships is the per-asset
 * safety signal (ImageAsset / GeneratedBook safety columns). Its integrity rests on ONE invariant: whenever the
 * detector's finding is written, the content SHA is co-written and any prior operator override is RESET — otherwise a
 * stale override bound to old bytes could survive new bytes (a silent fail-open). The field-builders
 * imageAssetSafetyFields / coverSafetyFields (asset-safety-signal.ts) guarantee that atomically.
 *
 * A field-builder is a convention until a build FAILS when it is bypassed. This walks app/lib/backend and fails if any
 * ImageAsset/GeneratedBook Prisma write sets a c-ii safety-signal column as an INLINE `data` property instead of via
 * the `...imageAssetSafetyFields(...)` / `...coverSafetyFields(...)` spread. The single sanctioned exception is the
 * phase-2 content-SHA advance (asset-safety-writer.ts), which writes ONLY safetyContentSha256/coverSafetyContentSha256
 * (never the detector finding or the override) — it cannot leave a stale override.
 */

const ROOT = process.cwd();
const WRITE_METHODS = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert']);

// The c-ii safety-signal columns that must only ever be written through the field-builders.
const IMAGE_ASSET_SIGNAL = new Set([
  'safetyVerified', 'safetyHazards', 'safetyContentSha256', 'safetyOverriddenHazards', 'safetyOverrideSha256',
]);
const GENERATED_BOOK_SIGNAL = new Set([
  'coverSafetyVerified', 'coverSafetyHazards', 'coverSafetyContentSha256', 'coverSafetyOverriddenHazards', 'coverSafetyOverrideSha256',
]);
const SIGNAL_BY_MODEL: Record<string, Set<string>> = {
  imageAsset: IMAGE_ASSET_SIGNAL,
  generatedBook: GENERATED_BOOK_SIGNAL,
};
const MODEL_NAMES = new Set(Object.keys(SIGNAL_BY_MODEL));

interface Violation {
  relative: string;
  line: number;
  model: string;
  fields: string[];
}
const repositorySources = createRepositorySourceInventory({
  root: ROOT,
  roots: ['app', 'lib', 'backend'],
  extensions: ['.ts'],
  excludedEntryNames: ['node_modules', '__tests__'],
  excludeDotEntries: true,
});

function nameText(name: ts.PropertyName | undefined): string | null {
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return null;
}

/** Resolve a call's delegate to one of our model names, following `tx.model` / `prisma.model` / a local alias. */
function collectAliases(file: ts.SourceFile): Map<string, string> {
  const aliases = new Map<string, string>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) && node.initializer &&
      ts.isIdentifier(node.name) && ts.isPropertyAccessExpression(node.initializer) &&
      MODEL_NAMES.has(node.initializer.name.text)
    ) {
      aliases.set(node.name.text, node.initializer.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return aliases;
}

function modelOfDelegate(delegate: ts.Expression, aliases: Map<string, string>): string | null {
  if (ts.isPropertyAccessExpression(delegate) && MODEL_NAMES.has(delegate.name.text)) return delegate.name.text;
  if (ts.isElementAccessExpression(delegate) && ts.isStringLiteral(delegate.argumentExpression) && MODEL_NAMES.has(delegate.argumentExpression.text)) {
    return delegate.argumentExpression.text;
  }
  if (ts.isIdentifier(delegate)) return aliases.get(delegate.text) ?? null;
  return null;
}

/** INLINE property names of the `data:` object (SpreadAssignments — i.e. the field-builder — are deliberately ignored). */
function inlineDataFields(call: ts.CallExpression): string[] {
  const arg0 = call.arguments[0];
  if (!arg0 || !ts.isObjectLiteralExpression(arg0)) return [];
  const data = arg0.properties.find(
    (p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && nameText(p.name) === 'data',
  );
  if (!data || !ts.isObjectLiteralExpression(data.initializer)) return [];
  const fields: string[] = [];
  for (const p of data.initializer.properties) {
    if (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) {
      const n = nameText(p.name as ts.PropertyName);
      if (n) fields.push(n);
    }
    // ts.isSpreadAssignment(p) → the field-builder spread; not an inline write, so not scanned.
  }
  return fields;
}

function violationsFromSource(relative: string, text: string): Violation[] {
  const file = ts.createSourceFile(relative, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const aliases = collectAliases(file);
  const out: Violation[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && WRITE_METHODS.has(node.expression.name.text)) {
      const model = modelOfDelegate(node.expression.expression, aliases);
      if (model) {
        const signal = SIGNAL_BY_MODEL[model];
        const bad = inlineDataFields(node).filter((f) => signal.has(f));
        if (bad.length > 0) {
          const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
          out.push({ relative, line: line + 1, model, fields: bad.sort() });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
}

/**
 * The sole sanctioned inline writer of safety-signal columns: asset-safety-writer.ts, and ONLY the non-detector
 * columns — the phase-2 content SHA (bind*SafetySha) and the operator-release override (writeSafetyReleaseOverride).
 * The DETECTOR fields (safetyVerified / safetyHazards + cover twins) are NOT in the allow-set, so a detector-field
 * write EVEN IN THIS FILE fails the build — that is what keeps the allowance from widening into a bypass.
 */
const SANCTIONED_WRITER_FIELDS: Record<string, Set<string>> = {
  imageAsset: new Set(['safetyContentSha256', 'safetyOverriddenHazards', 'safetyOverrideSha256']),
  generatedBook: new Set(['coverSafetyContentSha256', 'coverSafetyOverriddenHazards', 'coverSafetyOverrideSha256']),
};
function isSanctionedShaBind(v: Violation): boolean {
  if (v.relative !== 'lib/generation-pipeline/asset-safety-writer.ts') return false;
  const allowed = SANCTIONED_WRITER_FIELDS[v.model];
  return !!allowed && v.fields.length > 0 && v.fields.every((f) => allowed.has(f));
}

describe('asset safety-signal writer coverage — the detector finding flows ONLY through the field-builders', () => {
  it('no ImageAsset/GeneratedBook write sets a safety-signal column inline (must spread imageAssetSafetyFields/coverSafetyFields)', () => {
    const sources = repositorySources();
    expect(
      sources.some(({ relative }) => relative === 'lib/generation-pipeline/asset-safety-writer.ts'),
      'asset-safety-writer.ts must be present in the repository inventory',
    ).toBe(true);
    const violations = sources
      .flatMap(({ relative, text }) => violationsFromSource(relative, text))
      .filter((v) => !isSanctionedShaBind(v));
    expect(violations.map((v) => `${v.relative}:${v.line} ${v.model} { ${v.fields.join(', ')} }`)).toEqual([]);
  }, STRUCTURAL_REPOSITORY_SCAN_TIMEOUT_MS);

  it('the render sites route the safety signal through the field-builders', () => {
    for (const rel of ['lib/generation-pipeline/chunk-runner.ts', 'lib/single-page-image-regen.ts']) {
      expect(readFileSync(path.join(ROOT, rel), 'utf8')).toContain('imageAssetSafetyFields(');
    }
    expect(readFileSync(path.join(ROOT, 'lib/generation-pipeline/chunk-runner.ts'), 'utf8')).toContain('coverSafetyFields(');
  });

  it('the detector FAILS a deliberately bypassing inline write (and does not flag a field-builder spread)', () => {
    const bypass = `
      async function bad(tx: any, prisma: any) {
        await tx.imageAsset.update({ where: { id: 'x' }, data: { url: 'u', safetyVerified: true, safetyHazards: [] } });
        await prisma.generatedBook.update({ where: { id: 'b' }, data: { coverSafetyVerified: true } });
        const assets = tx.imageAsset;
        await assets.create({ data: { safetyOverrideSha256: 'forged' } });
      }
    `;
    expect(violationsFromSource('fixture.ts', bypass).map((v) => `${v.model} { ${v.fields.join(', ')} }`)).toEqual([
      'imageAsset { safetyHazards, safetyVerified }',
      'generatedBook { coverSafetyVerified }',
      'imageAsset { safetyOverrideSha256 }',
    ]);

    const good = `
      async function ok(tx: any) {
        await tx.imageAsset.update({ where: { id: 'x' }, data: { url: 'u', ...imageAssetSafetyFields({ verified: true, hazards: [], contentSha256: null }) } });
        await tx.generatedBook.update({ where: { id: 'b' }, data: { coverImageUrl: 'c', ...coverSafetyFields({ verified: false, hazards: [], contentSha256: null }) } });
        await tx.imageAsset.updateMany({ where: { pageId: 'p' }, data: { safetyContentSha256: 'abc' } });
      }
    `;
    // The spreads carry the signal (not inline) → no violation; the bare updateMany here IS an inline content-SHA
    // write, but in a fixture path — proving the detector is precise, the file-scoped sanction handles the real one.
    expect(violationsFromSource('fixture.ts', good).map((v) => `${v.model} { ${v.fields.join(', ')} }`)).toEqual([
      'imageAsset { safetyContentSha256 }',
    ]);
    expect(isSanctionedShaBind({ relative: 'lib/generation-pipeline/asset-safety-writer.ts', line: 1, model: 'imageAsset', fields: ['safetyContentSha256'] })).toBe(true);
  });

  it('(2a-2 §6 constraint 4) the writer allowance covers the override columns but NEVER the detector fields — a detector write IN the writer still fails', () => {
    const WRITER = 'lib/generation-pipeline/asset-safety-writer.ts';
    // sanctioned: the phase-2 SHA bind + the release override columns, in the writer file
    expect(isSanctionedShaBind({ relative: WRITER, line: 1, model: 'imageAsset', fields: ['safetyOverrideSha256', 'safetyOverriddenHazards'] })).toBe(true);
    expect(isSanctionedShaBind({ relative: WRITER, line: 1, model: 'generatedBook', fields: ['coverSafetyOverrideSha256', 'coverSafetyOverriddenHazards'] })).toBe(true);
    // NEVER a detector field, even in the writer — the guard still fails the build
    expect(isSanctionedShaBind({ relative: WRITER, line: 1, model: 'imageAsset', fields: ['safetyVerified'] })).toBe(false);
    expect(isSanctionedShaBind({ relative: WRITER, line: 1, model: 'imageAsset', fields: ['safetyHazards', 'safetyOverrideSha256'] })).toBe(false);
    expect(isSanctionedShaBind({ relative: WRITER, line: 1, model: 'generatedBook', fields: ['coverSafetyHazards'] })).toBe(false);
    // the allowance is file-scoped — another file writing the override columns is NOT sanctioned
    expect(isSanctionedShaBind({ relative: 'lib/foo.ts', line: 1, model: 'imageAsset', fields: ['safetyOverrideSha256'] })).toBe(false);
    // and the real writer actually contains the sanctioned override write (guard is not vacuous)
    expect(readFileSync(path.join(ROOT, WRITER), 'utf8')).toContain('writeSafetyReleaseOverride');
  });
});
