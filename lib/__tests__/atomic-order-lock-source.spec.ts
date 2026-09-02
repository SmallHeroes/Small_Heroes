import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('AtomicOperation Order-first lock wiring', () => {
  it('runs the optional hook before the receipt INSERT', () => {
    const text = source('lib/generation-pipeline/atomic-operation.ts');
    const fenced = text.slice(text.indexOf('async function runFenced'));
    expect(fenced.indexOf('await args.beforeReceipt?.(tx)')).toBeGreaterThanOrEqual(0);
    expect(fenced.indexOf('await args.beforeReceipt?.(tx)')).toBeLessThan(
      fenced.indexOf('INSERT INTO "AtomicOperationReceipt"'),
    );
  });

  it('wires every readiness AtomicOperation path through the Order lock hook', () => {
    const text = source('lib/generation-pipeline/readiness-manifest.ts');
    expect(text.match(/runAtomicOperation\(/g)).toHaveLength(3);
    expect(text.match(/beforeReceipt:/g)).toHaveLength(3);
    expect(text).toMatch(
      /lockOrderBeforeAtomicReceipt[\s\S]*?lockOrderForExceptionCase\(tx, orderId\)/,
    );
    expect(text).toMatch(
      /kind: args\.kind \?\? 'delivery_input'[\s\S]*?beforeReceipt:[\s\S]*?lockOrderBeforeAtomicReceipt\(tx, args\.orderId\)[\s\S]*?run: runBody/,
    );
    expect(text).toMatch(
      /kind: 'operator_action'[\s\S]*?beforeReceipt:[\s\S]*?lockOrderBeforeAtomicReceipt\(tx, args\.orderId\)[\s\S]*?run: \(tx\)/,
    );
    expect(text).toMatch(
      /kind: 'readiness_commit'[\s\S]*?beforeReceipt:[\s\S]*?lockOrderBeforeAtomicReceipt\(tx, args\.orderId\)[\s\S]*?run: \(tx\)/,
    );
  });

  it('locks Order before receipt for shared operator actions', () => {
    const text = source('lib/human-qa/operator-action.ts');
    expect(text).toMatch(
      /lockOperatorOrderBeforeReceipt[\s\S]*?SELECT "id" FROM "Order"[\s\S]*?FOR UPDATE/,
    );
    expect(text).toMatch(
      /kind: 'operator_action'[\s\S]*?beforeReceipt:[\s\S]*?lockOperatorOrderBeforeReceipt\(tx, input\.orderId\)[\s\S]*?run: async \(tx\)/,
    );
  });

  it('uses Order then BookReadiness in recovery and locks Order before its safety-claim receipt', () => {
    const text = source('lib/generation-pipeline/release-v1-recovery.ts');
    const snapshot = text.slice(
      text.indexOf('async function lockRecoverySnapshot'),
      text.indexOf('async function claimSafetyReverificationSnapshot'),
    );
    expect(snapshot.indexOf('await lockRecoveryOrder(tx, orderId)')).toBeGreaterThanOrEqual(0);
    expect(snapshot.indexOf('await lockRecoveryOrder(tx, orderId)')).toBeLessThan(
      snapshot.indexOf('FROM "BookReadiness"'),
    );

    const claim = text.slice(text.indexOf('async function claimSafetyReverificationSnapshot'));
    expect(claim).toMatch(
      /kind: 'release_v1_safety_evaluation_claim'[\s\S]*?beforeReceipt: \(tx\) => lockRecoveryOrder\(tx, plan\.order\.id\)[\s\S]*?run: async \(tx\)/,
    );
  });
});
