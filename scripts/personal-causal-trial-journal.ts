/** One-shot diagnostic allowance. No resume, refund, overwrite or deletion API. */
import { closeSync, existsSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { causalDigest } from '../lib/personal-wizard/story-causal-experiment';

export class CausalHostError extends Error {
  constructor(readonly code: string) { super(`causal_host_${code}`); }
}
export function hostFail(code: string): never { throw new CausalHostError(code); }
export function realDirectory(directory: string) {
  const absolute = path.resolve(directory);
  if (!path.isAbsolute(directory)) hostFail('directory');
  // Check each component, including junctions. No lexical alias authority.
  let current = path.parse(absolute).root;
  for (const part of absolute.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const st = lstatSync(current);
    if (!st.isDirectory() || st.isSymbolicLink() || realpathSync.native(current).toLowerCase() !== current.toLowerCase()) hostFail('directory');
  }
  return lstatSync(absolute);
}
export function exclusiveJson(file: string, value: unknown) {
  exclusiveText(file, JSON.stringify(value, null, 2) + '\n');
}
export function exclusiveText(file: string, value: string) {
  realDirectory(path.dirname(file));
  const fd = openSync(file, 'wx');
  try {
    const st = fstatSync(fd), lexical = lstatSync(file);
    if (!st.isFile() || st.nlink !== 1 || lexical.isSymbolicLink() || st.dev !== lexical.dev || st.ino !== lexical.ino) hostFail('file');
    writeFileSync(fd, value, 'utf8'); fsyncSync(fd);
  } finally { closeSync(fd); }
}
export function fencedText(file: string, maxBytes: number) {
  realDirectory(path.dirname(file));
  const st = lstatSync(file);
  if (!st.isFile() || st.isSymbolicLink() || st.nlink !== 1 || st.size > maxBytes ||
    realpathSync.native(file).toLowerCase() !== path.resolve(file).toLowerCase()) hostFail('file');
  const fd = openSync(file, 'r');
  try {
    const opened = fstatSync(fd);
    if (opened.dev !== st.dev || opened.ino !== st.ino || opened.nlink !== 1 || opened.size !== st.size) hostFail('file');
    const text = readFileSync(fd, 'utf8');
    if (Buffer.byteLength(text) > maxBytes) hostFail('file');
    return text;
  } finally { closeSync(fd); }
}
export type JournalSlot = { id: string; capMicroUsd: number };
export class CausalFamilyJournal {
  private terminal = false;
  private readonly claims = new Set<string>();
  private readonly settlements = new Set<string>();
  private readonly records = new Map<string, string>();
  private readonly directoryIdentity: { dev: number; ino: number };
  private constructor(readonly directory: string, readonly outputRoot: string,
    private readonly family: string, private readonly digest: string, private readonly slots: readonly JournalSlot[]) {
    this.directoryIdentity = realDirectory(directory);
  }
  static reserve(args: { commonDir: string; outputRoot: string; family: string; coordinatorDigest: string;
    maximumMicroUsd: number; slots: readonly JournalSlot[]; manifest: unknown }) {
    const { family, coordinatorDigest, maximumMicroUsd, slots } = args;
    if (!/^[a-z0-9][a-z0-9_-]{2,100}$/.test(family) || !/^[a-f0-9]{64}$/.test(coordinatorDigest) || !slots.length || slots.length > 42 ||
      new Set(slots.map(s => s.id)).size !== slots.length || slots.some(s => !/^case[1-6]:(plan|replan|author|editor|original_review|final_review|comparison)$/.test(s.id) ||
        !Number.isSafeInteger(s.capMicroUsd) || s.capMicroUsd <= 0) || !Number.isSafeInteger(maximumMicroUsd) || maximumMicroUsd <= 0 ||
      slots.reduce((n, s) => n + s.capMicroUsd, 0) !== maximumMicroUsd) hostFail('reservation');
    realDirectory(args.commonDir); realDirectory(path.dirname(args.outputRoot));
    if (existsSync(args.outputRoot)) hostFail('output_exists');
    if (existsSync(path.join(args.commonDir, 'codex-text-trials', family))) hostFail('family_consumed');
    const namespace = path.join(args.commonDir, 'codex-causal-text-trials');
    if (!existsSync(namespace)) { try { mkdirSync(namespace); } catch { if (!existsSync(namespace)) hostFail('directory'); } }
    realDirectory(namespace);
    const directory = path.join(namespace, family);
    // Atomic family acquisition across processes/worktrees. Partial acquisition is consumed.
    try { mkdirSync(directory); } catch { hostFail('family_consumed'); }
    const journal = new CausalFamilyJournal(directory, args.outputRoot, family, coordinatorDigest, structuredClone(slots));
    try {
      journal.record('reservation', { family, coordinatorDigest, maximumMicroUsd, slots, manifest: args.manifest,
        hostManifestDigest: causalDigest(args.manifest), accounting: 'estimate_not_invoice', runtimeEligible: false });
      mkdirSync(args.outputRoot); realDirectory(args.outputRoot);
      journal.save('manifest', args.manifest);
    } catch { journal.seal('reservation_write'); hostFail('reservation_write'); }
    return journal;
  }
  assertActive() {
    if (this.terminal) hostFail('terminal');
    const st = realDirectory(this.directory);
    if (st.dev !== this.directoryIdentity.dev || st.ino !== this.directoryIdentity.ino) hostFail('directory_changed');
    realDirectory(this.outputRoot);
    // Only immutable authority records are needed at every dispatch. Prior receipts
    // never confer execution authority; verify the full inventory once at completion.
    for (const [file, expected] of this.records) if (['reservation.json', 'manifest.json'].includes(path.basename(file))) this.verify(file, expected);
  }
  private verify(file: string, expected: string) { if (createHash('sha256').update(fencedText(file, 4_000_000)).digest('hex') !== expected) hostFail('record_changed'); }
  verifyRecords() { this.assertActive(); for (const [file, expected] of this.records) this.verify(file, expected); }
  private remember(file: string) { this.records.set(file, createHash('sha256').update(fencedText(file, 4_000_000)).digest('hex')); }
  record(name: string, data: unknown) {
    if (!/^[a-z0-9_-]+$/.test(name)) hostFail('record');
    const st = realDirectory(this.directory);
    if (st.dev !== this.directoryIdentity.dev || st.ino !== this.directoryIdentity.ino) hostFail('directory_changed');
    const file = path.join(this.directory, `${name}.json`); exclusiveJson(file, data); this.remember(file);
  }
  claim(family: string, digest: string, id: string) {
    this.assertActive();
    if (family !== this.family || digest !== this.digest || !this.slots.some(s => s.id === id) || this.claims.has(id)) hostFail('claim');
    this.record(`claim-${id.replace(':', '-')}`, { family, digest, id });
    this.claims.add(id);
  }
  dispatch(id: string, payload: unknown) {
    this.assertActive(); if (!this.claims.has(id) || this.settlements.has(id)) hostFail('claim');
    const claim = path.join(this.directory, `claim-${id.replace(':', '-')}.json`);
    this.verify(claim, this.records.get(claim)!);
    this.record(`dispatch-${id.replace(':', '-')}`, payload);
  }
  instructionPath(id: string) {
    if (!this.slots.some(s => s.id === id)) hostFail('claim');
    return path.join(this.directory, `instructions-${id.replace(':', '-')}.txt`);
  }
  instructions(id: string, value: string) {
    this.assertActive(); if (!this.claims.has(id)) hostFail('claim');
    const file = this.instructionPath(id); exclusiveText(file, value); this.remember(file);
  }
  settle(id: string, receipt: unknown) {
    this.assertActive(); if (!this.claims.has(id) || this.settlements.has(id)) hostFail('settlement');
    this.record(`receipt-${id.replace(':', '-')}`, receipt); this.settlements.add(id);
  }
  save(name: string, data: unknown) {
    this.assertActive(); if (!/^[a-z0-9_-]+$/.test(name)) hostFail('record');
    const file = path.join(this.outputRoot, `${name}.json`); exclusiveJson(file, data); this.remember(file);
  }
  seal(reason: string) {
    if (this.terminal) return;
    this.terminal = true; // A write failure never restores authority.
    try { this.record('sealed', { reason: /^[a-z0-9_]+$/.test(reason) ? reason : 'failed', claims: [...this.claims],
      settled: [...this.settlements], runtimeEligible: false }); } catch { /* retained partial family is terminal */ }
  }
}
