/** Persistent experiment-family claim, not public multi-tenant billing infrastructure. */
import { appendFileSync, closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, realpathSync } from 'node:fs';
import path from 'node:path';
import type { StoryUsage } from '../lib/personal-wizard/story-contract';

export type TrialSlot = { id: string; maxOutputTokens: number };
type Row = { id: string; status: 'started' | 'completed' | 'failed'; usage: StoryUsage };
export const TRIAL_FAMILY = 'personal-planning-comparison-20261001';
export const trialSlotReservation = (slot: TrialSlot) => (64_000 * 2 + slot.maxOutputTokens * 10) / 1e6 * 1.1;
export function safeUsage(raw: unknown): StoryUsage {
  try {
    const u = raw as { inputTokens?: unknown; outputTokens?: unknown };
    const inputTokens = u?.inputTokens, outputTokens = u?.outputTokens;
    return typeof inputTokens === 'number' && typeof outputTokens === 'number' && Number.isSafeInteger(inputTokens) && Number.isSafeInteger(outputTokens) && inputTokens >= 0 && outputTokens >= 0
      ? { inputTokens, outputTokens } : null;
  } catch { return null; }
}
function realDirectory(dir: string) {
  if (!existsSync(dir) || !lstatSync(dir).isDirectory() || lstatSync(dir).isSymbolicLink() ||
    realpathSync(dir).toLowerCase() !== path.resolve(dir).toLowerCase()) throw Error('trial_directory');
}
export class TrialFamilyGuard {
  readonly reservedUsd: number;
  private readonly rows: Row[] = [];
  private stopped = false;
  private closed = false;
  private busy = false;
  private readonly journal: string;
  private constructor(claim: string, private readonly slots: TrialSlot[]) {
    this.reservedUsd = slots.reduce((sum, slot) => sum + trialSlotReservation(slot), 0);
    this.journal = path.join(claim, 'events.jsonl');
  }
  static claim(commonDir: string, outputRoot: string, slots: TrialSlot[], provenance: unknown) {
    if (!slots.length || slots.length > 15 || new Set(slots.map(slot => slot.id)).size !== slots.length || slots.some(slot =>
      !/^[a-z0-9_/]+$/.test(slot.id) || !Number.isInteger(slot.maxOutputTokens) || slot.maxOutputTokens < 1 || slot.maxOutputTokens > 20_000) ||
      slots.reduce((sum, slot) => sum + trialSlotReservation(slot), 0) > 5) throw Error('trial_budget');
    realDirectory(commonDir); realDirectory(path.dirname(outputRoot));
    const families = path.join(commonDir, 'codex-text-trials');
    if (!existsSync(families)) { try { mkdirSync(families); } catch { if (!existsSync(families)) throw Error('trial_directory'); } }
    realDirectory(families);
    const claim = path.join(families, TRIAL_FAMILY);
    // Empty/partial claims survive crashes and remain consumed. No deletion/reset path.
    try { mkdirSync(claim); } catch { throw Error('trial_already_claimed'); }
    const guard = new TrialFamilyGuard(claim, structuredClone(slots));
    guard.persist({ event: 'claimed', family: TRIAL_FAMILY, budgetUsd: 5, reservedUsd: guard.reservedUsd,
      maxProviderAttempts: slots.length, slots, provenance, outputRoot });
    if (existsSync(outputRoot)) throw Error('trial_output_exists');
    mkdirSync(outputRoot);
    return guard;
  }
  private persist(event: unknown) {
    const fd = openSync(this.journal, 'a');
    try { appendFileSync(fd, `${JSON.stringify(event)}\n`); fsyncSync(fd); } finally { closeSync(fd); }
  }
  snapshot() {
    const knownUsageEstimateUsd = this.rows.reduce((sum, row) => sum + (row.usage ? (row.usage.inputTokens * 2 + row.usage.outputTokens * 10) / 1e6 : 0), 0);
    return { family: TRIAL_FAMILY, budgetUsd: 5, reservedUsd: this.reservedUsd, maxProviderAttempts: this.slots.length,
      providerAttempts: this.rows.length, knownUsageEstimateUsd,
      estimatedUsd: this.rows.every(row => row.usage !== null) ? knownUsageEstimateUsd : null,
      kind: 'usage_estimate_not_invoice', stopped: this.stopped, rows: structuredClone(this.rows) };
  }
  async dispatch(id: string, cap: number, run: () => Promise<{ output: unknown; usage: StoryUsage }>) {
    const slot = this.slots.find(item => item.id === id);
    if (this.stopped || this.busy || !slot || slot.maxOutputTokens !== cap || this.rows.some(row => row.id === id) ||
      this.rows.length >= this.slots.length) throw Error('trial_dispatch_refused');
    const row: Row = { id, status: 'started', usage: null };
    this.rows.push(row); this.busy = true;
    try {
      this.persist({ event: 'dispatch_started', row }); // Durable BEFORE adapter dispatch.
      const result = await run();
      if (this.closed) throw Error('trial_terminal');
      row.usage = safeUsage(result.usage); row.status = 'completed';
      this.persist({ event: 'dispatch_completed', row });
      if (this.snapshot().knownUsageEstimateUsd > this.reservedUsd || (row.usage &&
        ((row.usage.inputTokens * 2 + row.usage.outputTokens * 10) / 1e6 > trialSlotReservation(slot)))) throw Error('trial_reservation_exceeded');
      if (!row.usage) throw Error('trial_usage_unknown');
      return { ...result, usage: row.usage };
    } catch (error) {
      if (this.closed) throw error; // Late results cannot rewrite a sealed terminal receipt.
      if (!row.usage) { try { row.usage = safeUsage((error as { providerUsage?: unknown })?.providerUsage); } catch { /* untrusted errors */ } }
      row.status = 'failed'; this.stopped = true;
      this.persist({ event: 'dispatch_failed', row });
      throw error;
    } finally { this.busy = false; }
  }
  stop(reason: string) {
    this.closed = true;
    this.stopped = true;
    this.persist({ event: 'terminal', reason: /^trial_[a-z_]+$/.test(reason) ? reason : 'trial_failed', accounting: this.snapshot() });
  }
}
