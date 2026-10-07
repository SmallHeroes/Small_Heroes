import 'server-only';
import { readFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { canonicalJson } from './request-acceptance';
import { exclusiveJson, realDirectory } from '../../scripts/personal-causal-trial-journal';

const micro = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const claimSchema = z.object({ step: z.string(), wireDigest: hash, maximumMicroUsd: micro.positive() }).strict();
const resultSchema = z.object({ wireDigest: hash, estimatedMicroUsd: micro.nullable(), completed: z.boolean() }).strict();
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export class SimpleBookBudgetError extends Error { constructor(readonly code: string) { super(code); } }
function fail(code: string): never { throw new SimpleBookBudgetError(code); }
/** One process owns a previously claimed job. A pending/failed claim is never a free retry. */
export class SimpleBookBudget {
  readonly root: string;
  constructor(root: string, readonly externalMicroUsd: number, readonly maximumMicroUsd = 12000000) {
    if (maximumMicroUsd !== 12000000 || !Number.isSafeInteger(externalMicroUsd) || externalMicroUsd < 0 || externalMicroUsd > maximumMicroUsd) fail('simple_budget_policy');
    if (!existsSync(root)) mkdirSync(root); realDirectory(root); this.root = root;
  }
  snapshot() {
    let accountedMicroUsd = this.externalMicroUsd, knownEstimateMicroUsd = this.externalMicroUsd, unknownAttemptCosts = 0, logicalAttempts = 0, stopped = false;
    for (const name of readdirSync(this.root).filter(n => /^[a-z][a-z0-9_]{0,79}\.claim\.json$/.test(n))) {
      const claim = claimSchema.parse(JSON.parse(readFileSync(path.join(this.root, name), 'utf8'))), file = path.join(this.root, name.replace('.claim.', '.result.'));
      const result = existsSync(file) ? resultSchema.parse(JSON.parse(readFileSync(file, 'utf8'))) : null;
      if (result && result.wireDigest !== claim.wireDigest) fail('simple_budget_binding');
      logicalAttempts++;
      const known = result?.estimatedMicroUsd;
      if (known == null) { accountedMicroUsd += claim.maximumMicroUsd; unknownAttemptCosts++; }
      else { accountedMicroUsd += known; knownEstimateMicroUsd += known; }
      if (!result?.completed || known == null || known > claim.maximumMicroUsd) stopped = true;
    }
    return { accountedMicroUsd, knownEstimateMicroUsd, unknownAttemptCosts, logicalAttempts, stopped };
  }
  async run<T>(step: string, wire: unknown, maximumMicroUsd: number,
    dispatch: () => Promise<{ value: T; estimatedMicroUsd: number | null; receipt: unknown }>) {
    if (!/^[a-z][a-z0-9_]{0,79}$/.test(step) || !Number.isSafeInteger(maximumMicroUsd) || maximumMicroUsd < 1 || this.snapshot().logicalAttempts >= 80) fail('simple_budget_policy');
    const state = this.snapshot();
    if (state.stopped) fail('simple_paid_outcome_unknown_or_failed');
    if (state.accountedMicroUsd + maximumMicroUsd > this.maximumMicroUsd) fail('simple_budget_exhausted');
    const wireDigest = sha(canonicalJson(wire));
    exclusiveJson(path.join(this.root, `${step}.wire.json`), wire);
    exclusiveJson(path.join(this.root, `${step}.claim.json`), { step, wireDigest, maximumMicroUsd });
    try {
      const made = await dispatch();
      if (made.estimatedMicroUsd !== null && (!Number.isSafeInteger(made.estimatedMicroUsd) || made.estimatedMicroUsd < 0)) fail('simple_cost_invalid');
      exclusiveJson(path.join(this.root, `${step}.receipt.json`), made.receipt);
      exclusiveJson(path.join(this.root, `${step}.result.json`), { wireDigest, estimatedMicroUsd: made.estimatedMicroUsd, completed: true });
      if (made.estimatedMicroUsd === null) fail('simple_cost_unknown');
      if (made.estimatedMicroUsd > maximumMicroUsd || this.snapshot().accountedMicroUsd > this.maximumMicroUsd) fail('simple_cost_exceeded');
      return made.value;
    } catch (error) {
      if (!existsSync(path.join(this.root, `${step}.result.json`))) {
        const receipt = error && typeof error === 'object' && 'receipt' in error ? error.receipt : null;
        const cost = receipt && typeof receipt === 'object' && 'estimatedMicroUsd' in receipt
          ? micro.safeParse(receipt.estimatedMicroUsd) : null;
        const code = error instanceof SimpleBookBudgetError ? error.code : error && typeof error === 'object' && 'code' in error &&
          typeof error.code === 'string' && /^[a-z0-9_]+$/.test(error.code) ? error.code : 'simple_stage_failed';
        exclusiveJson(path.join(this.root, `${step}.failure.json`), { code,
          receipt });
        exclusiveJson(path.join(this.root, `${step}.result.json`), { wireDigest,
          estimatedMicroUsd: cost?.success ? cost.data : null, completed: false });
      }
      throw error;
    }
  }
}

/** A known billed, terminated engineering session counts even when its work failed. */
export function simpleBookExternalCosts(records: readonly { file: string; sha256: string }[]) {
  if (new Set(records.map(r => path.resolve(r.file).toLowerCase())).size !== records.length) throw Error('simple_external_cost_duplicate');
  return records.reduce((sum, r) => {
    if (!path.isAbsolute(r.file)) throw Error('simple_external_cost');
    const bytes = readFileSync(r.file); if (sha(bytes) !== r.sha256) throw Error('simple_external_cost_changed');
    const receipt = z.object({ terminationConfirmed: z.literal(true),
      reportedCostUsd: z.number().finite().nonnegative() }).passthrough().parse(JSON.parse(bytes.toString('utf8')));
    const cost = Math.ceil(receipt.reportedCostUsd * 1e6); if (!Number.isSafeInteger(cost)) throw Error('simple_external_cost');
    return sum + cost;
  }, 0);
}
