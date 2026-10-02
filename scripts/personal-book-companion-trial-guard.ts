import { appendFileSync, closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { safeUsage } from './personal-story-trial-guard';
import type { StoryUsage } from '../lib/personal-wizard/story-contract';

export const BOOK_TRIAL_FAMILY = 'personal-six-companion-books-20261002';
export const BOOK_TRIAL_MODEL = 'gpt-6.1-sol' as const;
export const BOOK_TRIAL_STAGES = ['plan', 'manuscript', 'editor', 'storyboard', 'review'] as const;
export type BookTrialSlot = { caseId: string; stage: typeof BOOK_TRIAL_STAGES[number]; maxOutputTokens: number; inputCeiling: number };
type Row = BookTrialSlot & { status: 'started' | 'completed' | 'failed'; usage: StoryUsage };
export const bookSlotReservation = (slot: BookTrialSlot) => (slot.inputCeiling * 2 + slot.maxOutputTokens * 10) / 1e6 * 1.1;
const knownCost = (usage: StoryUsage) => usage ? (usage.inputTokens * 2 + usage.outputTokens * 10) / 1e6 : 0;
function directory(dir: string) {
  if (!existsSync(dir) || !lstatSync(dir).isDirectory() || lstatSync(dir).isSymbolicLink() ||
      realpathSync(dir).toLowerCase() !== path.resolve(dir).toLowerCase()) throw Error('book_trial_directory');
}
export function assertBookTrialSlots(slots: BookTrialSlot[]) {
  const caps = [[12,8,16,32,39], [14,10,18,39,47], [16,12,20,51,55]];
  if (slots.length !== 30 || slots.some((slot, n) => slot.caseId !== `case${Math.floor(n / 5) + 1}` ||
      slot.stage !== BOOK_TRIAL_STAGES[n % 5] || slot.maxOutputTokens !== caps[Math.floor(n / 5) % 3][n % 5] * 1000 ||
      slot.inputCeiling !== (n % 5 < 3 ? 64_000 : 128_000)) ||
      Math.abs(slots.reduce((sum, s) => sum + bookSlotReservation(s), 0) - 14.4716) > 1e-10) throw Error('book_trial_policy_changed');
}
/** Local fixed family, not multi-tenant billing. Claim survives crash; no reset/resume/refund. */
export class BookTrialGuard {
  private rows: Row[] = [];
  private cursor = 0;
  private busy = false;
  private sealed = false;
  private terminalReason: string | null = null;
  private consecutiveHolds = 0;
  private outcomes: { caseId: string; outcome: 'completed' | 'held'; skipped: number }[] = [];
  private constructor(private journal: string, private slots: BookTrialSlot[]) {}
  static claim(common: string, output: string, slots: BookTrialSlot[], provenance: unknown) {
    assertBookTrialSlots(slots); directory(common); directory(path.dirname(output));
    const families = path.join(common, 'codex-text-trials');
    if (!existsSync(families)) { try { mkdirSync(families); } catch { if (!existsSync(families)) throw Error('book_trial_directory'); } }
    directory(families);
    const claim = path.join(families, BOOK_TRIAL_FAMILY);
    try { mkdirSync(claim); } catch { throw Error('book_trial_already_claimed'); }
    const guard = new BookTrialGuard(path.join(claim, 'events.jsonl'), structuredClone(slots));
    guard.persist({ event: 'claimed', provenance, output, slots, accounting: guard.snapshot() });
    if (existsSync(output)) throw Error('book_trial_output_exists');
    mkdirSync(output); return guard;
  }
  private persist(event: unknown) {
    const fd = openSync(this.journal, 'a');
    try { appendFileSync(fd, JSON.stringify(event) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
  }
  snapshot() {
    const knownUsageEstimateUsd = this.rows.reduce((sum, row) => sum + knownCost(row.usage), 0);
    return { family: BOOK_TRIAL_FAMILY, modelRequested: BOOK_TRIAL_MODEL, budgetUsd: 15, reservedUsd: 14.4716,
      maxProviderAttempts: 30, providerAttempts: this.rows.length, knownUsageEstimateUsd,
      estimatedUsd: this.rows.every(row => row.usage !== null) ? knownUsageEstimateUsd : null,
      rows: structuredClone(this.rows), outcomes: structuredClone(this.outcomes), sealed: this.sealed, terminalReason: this.terminalReason,
      kind: 'usage_estimate_not_invoice' };
  }
  async dispatch(caseId: string, call: { stage: string; maxOutputTokens: number; instructions: string; input: string },
    run: () => Promise<{ output: unknown; usage: StoryUsage }>) {
    const slot = this.slots[this.cursor];
    if (this.sealed || this.busy || !slot || caseId !== slot.caseId || call.stage !== slot.stage ||
        call.maxOutputTokens !== slot.maxOutputTokens || Buffer.byteLength(call.instructions + call.input, 'utf8') > slot.inputCeiling ||
        this.rows.length >= 30) throw Error('book_trial_dispatch_refused');
    const row: Row = { ...slot, status: 'started', usage: null }; this.rows.push(row); this.busy = true;
    try {
      this.persist({ event: 'dispatch_started', row }); // durable BEFORE run()!
      const answer = await run();
      if (this.sealed) throw Error('book_trial_terminal');
      row.usage = safeUsage(answer.usage); row.status = 'completed';
      this.persist({ event: 'dispatch_completed', row });
      if (!row.usage) throw Error('book_trial_usage_unknown');
      if (knownCost(row.usage) > bookSlotReservation(slot) || this.snapshot().knownUsageEstimateUsd > 14.4716) throw Error('book_trial_reservation_exceeded');
      this.cursor++; return { output: answer.output, usage: row.usage };
    } catch (error) {
      if (!this.sealed) {
        if (!row.usage) { try { row.usage = safeUsage((error as { providerUsage?: unknown })?.providerUsage); } catch { /* untrusted */ } }
        row.status = 'failed';
        // Seal even if a failing journal cannot persist another record.
        this.sealed = true; this.terminalReason = 'book_trial_failed'; this.persist({ event: 'dispatch_failed', row });
      }
      throw error;
    } finally { this.busy = false; }
  }
  finishCase(caseId: string, outcome: 'completed' | 'held') {
    const n = this.outcomes.length, end = (n + 1) * 5, used = this.cursor - n * 5;
    if (this.sealed || this.busy || !['completed', 'held'].includes(outcome) || caseId !== `case${n + 1}` || (outcome === 'completed' ? used !== 5 : ![1,3,5].includes(used))) throw Error('book_trial_case_refused');
    const row = { caseId, outcome, skipped: end - this.cursor };
    this.persist({ event: 'case_finished', ...row }); this.outcomes.push(row); this.cursor = end;
    this.consecutiveHolds = outcome === 'held' ? this.consecutiveHolds + 1 : 0;
    if (this.consecutiveHolds >= 2) this.stop('book_trial_repeated_hold');
  }
  stop(reason: string) {
    if (this.sealed) return;
    this.sealed = true; this.terminalReason = /^book_trial_[a-z_]+$/.test(reason) ? reason : 'book_trial_failed';
    this.persist({ event: 'terminal', reason: this.terminalReason, accounting: this.snapshot() });
  }
}
