import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import * as ts from 'typescript';

/**
 * (delivery fence — Codex round-5 Unit 4, MANDATORY structural guard) The FUNNEL is the only legal path for an
 * Order delivery-AUTHORITY write. This guard FAILS THE BUILD if any write sets `deliveryHoldReason` or
 * `manualReviewRequired` outside `lib/generation-pipeline/order-authority.ts` (writeOrderHoldFenced /
 * executeReadinessShipCas / executeAnchorReleaseCas), where every such write binds + bumps the shared fence and
 * enforces marker precedence. This is stricter and more durable than a field-set/whole-file-exemption list: a NEW
 * authority write anywhere else can never silently bypass the fence — it will not compile past this test.
 *
 * ONE narrow, justified allowance (NOT a blanket file exemption): the delivery-INPUT invalidation barrier
 * `withDeliveryInputMutation` in readiness-manifest.ts stamps `base_book_integrity:inputs_changed:*` when a
 * previously-`ready` book's inputs change (ready → generating). It is a DIFFERENT mechanism — it bumps
 * `inputVersion`, which the ship CAS already binds, so a stale ship is rejected by inputVersion, not the fence. It is
 * recognised ONLY by that exact `inputs_changed` invalidation marker in its SET; any OTHER authority write in that
 * file is still flagged.
 */

const ROOT = process.cwd();
const FUNNEL = 'lib/generation-pipeline/order-authority.ts';
const AUTHORITY_FIELDS = new Set(['deliveryHoldReason', 'manualReviewRequired']);

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__' || entry.startsWith('.')) continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, acc);
    else if (entry.endsWith('.ts')) acc.push(full);
  }
  return acc;
}

const PRISMA_WRITE_METHODS = new Set(['update', 'updateMany', 'upsert', 'create']);

/** Prisma `order.<write>({... data: { deliveryHoldReason | manualReviewRequired ... } ...})` sites. */
export function prismaAuthorityWriteLines(relative: string, text: string): number[] {
  const file = ts.createSourceFile(relative, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const lines: number[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      PRISMA_WRITE_METHODS.has(node.expression.name.text) &&
      ts.isPropertyAccessExpression(node.expression.expression) &&
      node.expression.expression.name.text === 'order'
    ) {
      const arg = node.arguments[0];
      if (arg && ts.isObjectLiteralExpression(arg)) {
        // scan create/update `data` AND upsert `create`/`update` for an authority field
        const dataObjs: ts.ObjectLiteralExpression[] = [];
        for (const prop of arg.properties) {
          if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) &&
              (prop.name.text === 'data' || prop.name.text === 'create' || prop.name.text === 'update') &&
              ts.isObjectLiteralExpression(prop.initializer)) {
            dataObjs.push(prop.initializer);
          }
        }
        for (const obj of dataObjs) {
          for (const p of obj.properties) {
            const name = (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) && p.name && ts.isIdentifier(p.name) ? p.name.text : null;
            if (name && AUTHORITY_FIELDS.has(name)) {
              lines.push(file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1);
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return lines;
}

/** Raw `UPDATE "Order" … SET <…> WHERE` whose SET clause assigns an authority field. */
export function rawAuthorityWriteSites(relative: string, text: string): Array<{ line: number; inputsBarrier: boolean }> {
  const sites: Array<{ line: number; inputsBarrier: boolean }> = [];
  const re = /UPDATE\s+"Order"([\s\S]*?)\bWHERE\b/gi;
  for (const m of text.matchAll(re)) {
    const setClause = m[1];
    if (/"deliveryHoldReason"\s*=|"manualReviewRequired"\s*=/.test(setClause)) {
      const line = text.slice(0, m.index).split('\n').length;
      // The input-invalidation barrier is the ONLY allowed non-funnel authority SET: withDeliveryInputMutation stamps
      // `base_book_integrity:${staleReason}` via a CASE. Both tokens together are unique to that barrier.
      const inputsBarrier = /base_book_integrity/.test(setClause) && /staleReason/.test(setClause);
      sites.push({ line, inputsBarrier });
    }
  }
  return sites;
}

describe('order-authority funnel guard (Codex round-5 Unit 4)', () => {
  const files = ['app', 'lib', 'backend'].flatMap((dir) => walk(path.join(ROOT, dir)));

  it('no Prisma authority-field write (deliveryHoldReason/manualReviewRequired) exists outside the funnel', () => {
    const offenders: string[] = [];
    for (const abs of files) {
      const relative = path.relative(ROOT, abs).split(path.sep).join('/');
      if (relative === FUNNEL) continue;
      for (const line of prismaAuthorityWriteLines(relative, readFileSync(abs, 'utf8'))) {
        offenders.push(`${relative}:${line}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no raw UPDATE "Order" sets an authority field outside the funnel (except the inputs_changed barrier)', () => {
    const offenders: string[] = [];
    for (const abs of files) {
      const relative = path.relative(ROOT, abs).split(path.sep).join('/');
      if (relative === FUNNEL) continue;
      for (const site of rawAuthorityWriteSites(relative, readFileSync(abs, 'utf8'))) {
        if (site.inputsBarrier) continue; // narrow, justified allowance (delivery-input barrier — see the header)
        offenders.push(`${relative}:${site.line}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the funnel itself IS where the authority writes live (sanity: the guard is not vacuous)', () => {
    const funnelText = readFileSync(path.join(ROOT, FUNNEL), 'utf8');
    expect(rawAuthorityWriteSites(FUNNEL, funnelText).length).toBeGreaterThanOrEqual(3); // hold + ship + release CAS
  });

  it('the detectors catch a bypassing write (not vacuous)', () => {
    const prismaFixture = `async function w(tx: any) { await tx.order.update({ where: { id }, data: { status: 'needs_human_qa', deliveryHoldReason: 'safety_hold:x' } }); }`;
    expect(prismaAuthorityWriteLines('fixture.ts', prismaFixture).length).toBe(1);
    const rawFixture = 'await tx.$executeRaw`UPDATE "Order" SET "manualReviewRequired" = true WHERE "id" = ${id}`;';
    const raw = rawAuthorityWriteSites('fixture.ts', rawFixture);
    expect(raw.length).toBe(1);
    expect(raw[0].inputsBarrier).toBe(false);
    // a bare status transition (no authority field) is NOT flagged
    const okFixture = `async function w(tx: any) { await tx.order.update({ where: { id }, data: { status: 'paid' } }); }`;
    expect(prismaAuthorityWriteLines('fixture.ts', okFixture).length).toBe(0);
  });
});
