/** Explicit local operator CLI. Import/preview never dispatches; no automatic worker. */
import path from 'node:path';
import { nativeBridgeConfig, queuedNativeRequest, claimNativeWorker, emptyNativeView } from '../lib/personal-wizard/native-book-bridge';
import { singleBookCalibrationCLI, singleBookOutcome, prepareSingleBookCalibration, type SingleBookUpdate } from './personal-single-book-calibration';
import { exclusiveJson } from './personal-causal-trial-journal';
import { compileCausalPlan, compileCausalOriginal } from '../lib/personal-wizard/story-causal-experiment';
import type { NativeBookView } from '../lib/personal-wizard/native-book-preview';

export function nativeUpdateView(requestId: string, prepared: ReturnType<typeof queuedNativeRequest>['prepared'], event: SingleBookUpdate): NativeBookView {
  const view = emptyNativeView(requestId), s = event.snapshot, rows = s.host?.host.rows ?? [];
  view.phase = event.phase; view.error = event.error ?? null;
  view.accounting = { knownEstimateMicroUsd: s.knownEstimateMicroUsd, allowanceMicroUsd: s.allowanceMicroUsd,
    logicalAttempts: Number(s.probe.attempted) + rows.filter(r => r.attempted).length,
    unknownAttemptCosts: Number(s.probe.attempted && s.probe.receipt?.estimatedMicroUsd == null) +
      rows.filter(r => r.attempted && r.receipt?.estimatedMicroUsd == null).length, kind: 'estimate_not_invoice' };
  const book = event.result?.books[0];
  if (book) {
    view.phase = singleBookOutcome(event.result!) === 'text_ready_for_human_review' ? 'complete' : 'held';
    view.original = { title: book.original.manuscript.title, pages: book.original.manuscript.pages };
    view.edited = { title: book.edit.revised.manuscript.title, pages: book.edit.revised.manuscript.pages };
    view.readings = book.readings.map(r => ({ stage: r.stage, summary: r.summary, findings: r.findings.map(f => ({
      severity: f.severity, kind: f.kind, criterion: f.criterion, explanation: f.explanation,
      original: f.original, revised: f.revised })) }));
  } else if (event.result) view.phase = 'held';
  else if (event.phase === 'failed') {
    // Recompile an already-paid author receipt for DRAFT-ONLY display. Never
    // trust raw prose, manufacture an edit receipt, resume or remove a finding.
    try {
      const p = [...rows].reverse().find(r => /:(replan|plan)$/.test(r.slot) && r.receipt)?.receipt?.output;
      const a = rows.find(r => r.slot.endsWith(':author'))?.receipt?.output;
      const plan = compileCausalPlan(prepared, p);
      if (plan.disposition === 'selected' && a) {
        const draft = compileCausalOriginal(prepared, plan, a);
        view.original = { title: draft.manuscript.title, pages: draft.manuscript.pages };
      }
    } catch { /* No source-validated partial text is available. */ }
  }
  return view;
}
export async function nativeWizardWorkerCLI(argv: string[]) {
  if (argv.length < 2 || argv.length > 3 || argv[0] !== '--config' || !path.isAbsolute(argv[1]) ||
      argv.length === 3 && argv[2] !== '--execute') throw Error('native_worker_arguments');
  const config = nativeBridgeConfig(argv[1]), queued = queuedNativeRequest(config);
  const preview = prepareSingleBookCalibration({ ...config, request: queued.queued.request,
    reviewedTextAuthorization: queued.queued.authorization }).preview;
  if (argv.length === 2) {
    console.log(JSON.stringify({ status: 'native_worker_preview', requestId: queued.queued.authorization.requestId,
      models: emptyNativeView(queued.queued.authorization.requestId).models, maximumUsd: 12,
      bookReservedMicroUsd: preview.bookReservedMicroUsd, providerCalls: 0, runtimeEligible: false }));
    return 0;
  }
  if (process.stdin.isTTY !== true) throw Error('interactive_stdin_required');
  const worker = claimNativeWorker(config);
  const driverConfig = path.join(worker.directory, 'worker-config.json');
  exclusiveJson(driverConfig, { ...config, version: undefined, request: worker.queued.request });
  let terminalPublished = false;
  try {
    return await singleBookCalibrationCLI(['--config', driverConfig, '--execute'], {
      reviewedTextAuthorization: worker.queued.authorization,
      onUpdate: event => {
        worker.publish(nativeUpdateView(worker.queued.authorization.requestId, worker.prepared, event));
        terminalPublished = event.phase === 'complete' || event.phase === 'failed';
      },
    });
  } catch (error) {
    if (!terminalPublished) {
      const view = emptyNativeView(worker.queued.authorization.requestId);
      view.phase = 'failed'; view.error = 'native_worker_failed'; worker.publish(view);
    }
    throw error;
  }
}
