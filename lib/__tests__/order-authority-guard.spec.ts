import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import * as ts from 'typescript';

/**
 * (delivery fence — Codex round-5 Unit 4 + round-6 Unit B, MANDATORY structural guard) The FUNNEL
 * (`lib/generation-pipeline/order-authority.ts`: writeOrderHoldFenced / executeReadinessShipCas /
 * executeAnchorReleaseCas) is the only legal path for an Order DELIVERY-AUTHORITY transition, where every write binds
 * + bumps the shared fence and enforces marker precedence. This guard FAILS THE BUILD on a non-funnel authority write.
 *
 * WHAT IT PROVES (exactly — round-6 Unit B narrowed the claim to match enforcement; it is NOT "every Order.status
 * write"). Two independent delivery-authority surfaces:
 *   (1) the authority FIELDS — no non-funnel write sets `deliveryHoldReason` or `manualReviewRequired`
 *       (Prisma inline-literal `data`, or raw `UPDATE "Order" … SET`);
 *   (2) the deliverable STATE — no non-funnel write transitions an Order INTO `status = 'ready'` (the ONLY status the
 *       send CAS accepts). A Prisma order-write is flagged unless its `status` is an inline string literal ≠ 'ready'
 *       (so a literal `'ready'`, OR a NON-literal status — a variable/ternary/shorthand that could BE 'ready' — is
 *       caught, closing the indirect blind spot); a raw `UPDATE "Order"` is flagged if its SET assigns `"status"`.
 * Non-deliverable lifecycle writes (paid / failed / generating / pending_payment / draft / partial) are NOT authority
 * writes and are intentionally out of scope; they are enumerated + justified in the round-6 report, not gated here.
 *
 * NARROW, JUSTIFIED ALLOWANCES (NOT blanket exemptions):
 *   • the delivery-INPUT invalidation barrier `withDeliveryInputMutation` (readiness-manifest.ts) stamps
 *     `base_book_integrity:inputs_changed:*` and DEMOTES `ready → generating` when a previously-`ready` book's inputs
 *     change. It bumps `inputVersion` (which the ship CAS binds), never transitions INTO `ready`, and is recognised
 *     ONLY by its `base_book_integrity` + `staleReason` SET signature; any OTHER authority/status write there is flagged.
 *   • `app/api/dev/story-bank/route.ts` — a DEV-ONLY route (app/api/dev/*, banner-gated, NOT the production golden
 *     path; see CLAUDE.md) that writes `partial|ready` for a dev preview and never serves a paid order. Enumerated by
 *     exact path so a NEW non-funnel `ready` write ANYWHERE else still fails the build.
 *
 * LIMIT (honest): detection is SYNTACTIC — inline `data`/`create`/`update` object literals and raw SQL. A fully opaque
 * write (a bare-variable `data`, or an Order-shaped object built elsewhere and spread in) is not structurally proven
 * here. The round-6 audit exhaustively swept every write vector (Prisma inline/indirect/spread, raw SQL, wrapper
 * helpers) and confirmed the funnel is the sole production author of `ready`; the wrapper-helper path routes through
 * the funnel. This guard is the durable structural backstop; that audit is its one-time completeness proof.
 */

const ROOT = process.cwd();
const FUNNEL = 'lib/generation-pipeline/order-authority.ts';
const AUTHORITY_FIELDS = new Set(['deliveryHoldReason', 'manualReviewRequired']);
// (round-6 Unit B) The deliverable state — the ONLY Order.status the send CAS accepts. A transition INTO it is a
// delivery authorization and must originate in the funnel.
const DELIVERABLE_STATUS = 'ready';
// Narrow, justified allowance for the deliverable-'ready' guard (see the header): a DEV-ONLY route that writes
// partial|ready for a dev story-bank preview and never serves a paid order. Enumerated by exact path so a NEW
// non-funnel 'ready' write anywhere else still fails the build.
const DEV_READY_STATUS_ALLOWLIST = new Set(['app/api/dev/story-bank/route.ts']);

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

const PRISMA_WRITE_METHODS = new Set(['update', 'updateMany', 'upsert', 'create', 'updateManyAndReturn']);

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

/**
 * (round-6 Unit B) Prisma `order.<write>({ … data|create|update: { … } … })` sites that can transition an Order INTO
 * the deliverable `ready` state. A site is FLAGGED unless its `status` is an inline string literal ≠ 'ready':
 *   - a literal `status: 'ready'`                       → flagged (a direct ship outside the funnel);
 *   - a NON-literal `status: <expr>` (variable/ternary/call) or a shorthand `{ status }` → flagged (could BE 'ready'
 *     — this closes the indirect blind spot, e.g. `status: orderStatus` where orderStatus = x ? 'partial' : 'ready');
 *   - a literal `status: 'paid'|'failed'|'generating'|…` (≠ 'ready') → NOT flagged (a safe lifecycle write);
 *   - no `status` property at all                       → NOT flagged (does not touch the deliverable state).
 * SYNTACTIC LIMIT (see header): spread elements (`data: { …x }`) are not inspected — the round-6 audit confirmed no
 * production spread carries a `ready` status; the funnel remains the sole author of `ready`.
 */
export function prismaDeliverableStatusWriteLines(relative: string, text: string): number[] {
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
        const dataObjs: ts.ObjectLiteralExpression[] = [];
        for (const prop of arg.properties) {
          if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) &&
              (prop.name.text === 'data' || prop.name.text === 'create' || prop.name.text === 'update') &&
              ts.isObjectLiteralExpression(prop.initializer)) {
            dataObjs.push(prop.initializer);
          }
        }
        let flagged = false;
        for (const obj of dataObjs) {
          for (const p of obj.properties) {
            if (!(ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p))) continue; // skip spreads (see limit)
            if (!p.name || !ts.isIdentifier(p.name) || p.name.text !== 'status') continue;
            if (ts.isShorthandPropertyAssignment(p)) { flagged = true; break; } // { status } — a variable, could be 'ready'
            const v = p.initializer;
            const safeLiteral = (ts.isStringLiteral(v) || ts.isNoSubstitutionTemplateLiteral(v)) && v.text !== DELIVERABLE_STATUS;
            if (!safeLiteral) { flagged = true; break; } // literal 'ready', OR a non-literal (variable/ternary/call)
          }
          if (flagged) break;
        }
        if (flagged) lines.push(file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return lines;
}

/**
 * (round-6 Unit B) Raw `UPDATE "Order" … SET … "status" = … WHERE` sites. Raw SQL is the dangerous bypass (it skips
 * Prisma typing), so ANY non-funnel raw write to `Order.status` is flagged — the funnel and the inputs barrier are the
 * only sanctioned raw status writers. `inputsBarrier` marks the demote-to-`generating` invalidation barrier, exempted
 * by the caller exactly as the authority-field guard exempts it.
 */
export function rawOrderStatusWriteSites(relative: string, text: string): Array<{ line: number; inputsBarrier: boolean }> {
  const sites: Array<{ line: number; inputsBarrier: boolean }> = [];
  const re = /UPDATE\s+"Order"([\s\S]*?)\bWHERE\b/gi;
  for (const m of text.matchAll(re)) {
    const setClause = m[1];
    if (/"status"\s*=/.test(setClause)) {
      const line = text.slice(0, m.index).split('\n').length;
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

  it('no non-funnel Prisma write transitions an Order INTO the deliverable "ready" state (except the dev allowlist)', () => {
    const offenders: string[] = [];
    for (const abs of files) {
      const relative = path.relative(ROOT, abs).split(path.sep).join('/');
      if (relative === FUNNEL) continue;
      if (DEV_READY_STATUS_ALLOWLIST.has(relative)) continue; // dev-only route, justified in the header
      for (const line of prismaDeliverableStatusWriteLines(relative, readFileSync(abs, 'utf8'))) {
        offenders.push(`${relative}:${line}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no non-funnel raw UPDATE "Order" writes status (except the inputs_changed barrier)', () => {
    const offenders: string[] = [];
    for (const abs of files) {
      const relative = path.relative(ROOT, abs).split(path.sep).join('/');
      if (relative === FUNNEL) continue;
      for (const site of rawOrderStatusWriteSites(relative, readFileSync(abs, 'utf8'))) {
        if (site.inputsBarrier) continue; // narrow, justified allowance (demote ready→generating — see the header)
        offenders.push(`${relative}:${site.line}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the funnel itself IS where the authority writes live (sanity: the guard is not vacuous)', () => {
    const funnelText = readFileSync(path.join(ROOT, FUNNEL), 'utf8');
    expect(rawAuthorityWriteSites(FUNNEL, funnelText).length).toBeGreaterThanOrEqual(3); // hold + ship + release CAS
    // the funnel is also where the raw `ready` transitions live (ship + release) — the deliverable-status detector is
    // not vacuous either.
    expect(rawOrderStatusWriteSites(FUNNEL, funnelText).length).toBeGreaterThanOrEqual(2); // ship + release set status
  });

  it('the detectors catch a bypassing write (not vacuous)', () => {
    const prismaFixture = `async function w(tx: any) { await tx.order.update({ where: { id }, data: { status: 'needs_human_qa', deliveryHoldReason: 'safety_hold:x' } }); }`;
    expect(prismaAuthorityWriteLines('fixture.ts', prismaFixture).length).toBe(1);
    const rawFixture = 'await tx.$executeRaw`UPDATE "Order" SET "manualReviewRequired" = true WHERE "id" = ${id}`;';
    const raw = rawAuthorityWriteSites('fixture.ts', rawFixture);
    expect(raw.length).toBe(1);
    expect(raw[0].inputsBarrier).toBe(false);
    // a bare status transition (no authority field) is NOT flagged by the AUTHORITY-FIELD detector…
    const okFixture = `async function w(tx: any) { await tx.order.update({ where: { id }, data: { status: 'paid' } }); }`;
    expect(prismaAuthorityWriteLines('fixture.ts', okFixture).length).toBe(0);
  });

  it('(round-6 Unit B) the deliverable-status detector catches a ship bypass — direct AND indirect — but not lifecycle writes', () => {
    // a direct literal `ready` ship outside the funnel → flagged
    expect(prismaDeliverableStatusWriteLines('f.ts', `await tx.order.update({ where: { id }, data: { status: 'ready' } });`).length).toBe(1);
    // an INDIRECT status (a ternary variable that can be 'ready') → flagged — this is the story-bank blind spot
    expect(prismaDeliverableStatusWriteLines('f.ts', `const s = x ? 'partial' : 'ready'; await prisma.order.update({ where: { id }, data: { status: s, imageStatus: 'done' } });`).length).toBe(1);
    // a shorthand `{ status }` → flagged (a variable — could be 'ready')
    expect(prismaDeliverableStatusWriteLines('f.ts', `await prisma.order.update({ where: { id }, data: { status } });`).length).toBe(1);
    // a non-'ready' string literal lifecycle write → NOT flagged
    expect(prismaDeliverableStatusWriteLines('f.ts', `await tx.order.update({ where: { id }, data: { status: 'paid' } });`).length).toBe(0);
    expect(prismaDeliverableStatusWriteLines('f.ts', `await tx.order.update({ where: { id }, data: { status: 'failed', lastError: e } });`).length).toBe(0);
    // no status property at all → NOT flagged
    expect(prismaDeliverableStatusWriteLines('f.ts', `await tx.order.update({ where: { id }, data: { imageStatus: 'done' } });`).length).toBe(0);
    // raw: a non-funnel raw ship IS flagged; the demote-to-generating inputs barrier is exempted
    const rawShip = 'await db.$executeRaw`UPDATE "Order" SET "status" = \'ready\'::"OrderStatus" WHERE "id" = ${id}`;';
    const rawSites = rawOrderStatusWriteSites('f.ts', rawShip);
    expect(rawSites.length).toBe(1);
    expect(rawSites[0].inputsBarrier).toBe(false);
    const barrier = 'await tx.$queryRaw`UPDATE "Order" SET "status" = CASE WHEN true AND "status" = \'ready\' THEN \'generating\' ELSE "status" END, "deliveryHoldReason" = ${`base_book_integrity:${staleReason}`} WHERE "id" = ${id}`;';
    expect(rawOrderStatusWriteSites('f.ts', barrier).every((s) => s.inputsBarrier)).toBe(true);
  });
});
