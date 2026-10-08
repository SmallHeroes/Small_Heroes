/** Explicit one-use reference edit, not an HTTP worker or a writing path. */
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { prepareSimpleBookReferenceRecovery } from '../lib/personal-wizard/simple-book-reference-recovery';
import { previewSha } from '../lib/local-story-preview';
import { exclusiveJson, fencedText } from './personal-causal-trial-journal';
import { readAuditionApproval, runSimpleBookIllustrator } from './personal-simple-book-illustrator';
import type { SimpleBookView } from '../lib/personal-wizard/simple-book-view';
const fail = (code: string): never => { throw Object.assign(new Error(code), { code }); };
export async function simpleBookReferenceRecoveryCLI(argv: string[]) {
  if (argv.length < 2 || argv.length > 3 || argv[0] !== '--config' || !path.isAbsolute(argv[1]) || argv.length === 3 && argv[2] !== '--execute') fail('reference_recovery_arguments');
  const ready = await prepareSimpleBookReferenceRecovery(argv[1]);
  readAuditionApproval(ready.current);
  if (previewSha(readFileSync(ready.current.executable)) !== ready.current.executableSha256) fail('reference_recovery_executable');
  if (argv.length === 2) {
    console.log(JSON.stringify({ status: 'controlled_reference_recovery_preview', requestId: ready.parent.job.queued.requestId,
      inherited: ready.inherited, extraEngineeringMicroUsd: ready.extra, totalBeforeMicroUsd: ready.externalMicroUsd,
      sourceHead: ready.config.sourceHead, maximumMicroUsd: ready.config.maximumMicroUsd, newWriters: 0, newPlanners: 0, providerCalls: 0, keyReads: 0,
      referenceCorrectionLimit: 1, runtimeEligible: false })); return 0;
  }
  if (process.env.GPT_IMAGE_EDIT_MAX_REFERENCES !== '4') fail('reference_recovery_reference_limit');
  const { budget, publish } = ready.claim(), controller = new AbortController();
  const check = () => { if (controller.signal.aborted) fail('reference_recovery_cancelled'); ready.verify(); };
  const key = () => {
    check(); const lines = fencedText(ready.current.existingKeyEnvFile, 256000).split(/\r?\n/).filter(l => /^\s*OPENAI_API_KEY\s*=/.test(l));
    const k = lines.length === 1 ? parseEnv(lines[0]).OPENAI_API_KEY : null;
    if (typeof k === 'string' && /^sk-\S{20,}$/.test(k)) return k;
    return fail('reference_recovery_key');
  };
  const save = (name: string, value: unknown) => exclusiveJson(path.join(ready.directory, `${name}.json`), value);
  let view: SimpleBookView = { ...ready.view, imageScope: ready.rebuildEntitiesFromDesign ? 'reference_rebuild_continuation' : ready.explicitReferenceTransport ? 'reference_transport_continuation' : ready.checkpoint ? 'role_scoped_reference_continuation' : 'owned_reference_recovery', error: null, images: [] };
  const update = (phase: SimpleBookView['phase'], images = view.images) => {
    const snapshot = budget.snapshot(); view = { ...view, phase, images, accounting: { ...view.accounting,
      knownEstimateMicroUsd: snapshot.knownEstimateMicroUsd, unknownAttemptCosts: snapshot.unknownAttemptCosts,
      allowanceMicroUsd: ready.config.maximumMicroUsd, logicalAttempts: ready.inheritedLogicalAttempts + snapshot.logicalAttempts } };
    publish(view); console.log(JSON.stringify({ phase, ...snapshot, inheritedLogicalAttempts: ready.inheritedLogicalAttempts, runtimeEligible: false }));
  };
  const interrupt = () => controller.abort(); process.on('SIGINT', interrupt);
  const deadline = setTimeout(interrupt, 40 * 60 * 1000);
  try {
    const manifest = await runSimpleBookIllustrator({ config: ready.current, directory: ready.directory, budget, key, assertCurrent: check,
      signal: controller.signal, result: ready.result, request: ready.parent.job.queued.request, options: ready.parent.job.options,
      referenceRecovery: ready.seed, referenceCheckpoint: ready.checkpoint, explicitReferenceTransport: ready.explicitReferenceTransport,
      rebuildEntitiesFromDesign: ready.rebuildEntitiesFromDesign,
      progress: (phase, images) => update(phase, images) });
    check(); update('illustrated_audition', manifest.pages.map(p => ({ pageNumber: p.pageNumber, ...p.candidate })));
    save('sealed', { status: 'illustrated_audition', sourceHead: ready.config.sourceHead, snapshot: budget.snapshot(), inheritedLogicalAttempts: ready.inheritedLogicalAttempts,
      bookPages: 9, runtimeEligible: false, productionQualified: false }); return 0;
  } catch (error) {
    const cancelled = controller.signal.aborted; controller.abort();
    view.error = cancelled ? 'reference_recovery_cancelled' : error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' &&
      /^[a-z0-9_]{1,80}$/.test(error.code) ? error.code : 'reference_recovery_failed';
    update('failed'); save('sealed', { status: 'failed', code: view.error, sourceHead: ready.config.sourceHead, snapshot: budget.snapshot(),
      inheritedLogicalAttempts: ready.inheritedLogicalAttempts, runtimeEligible: false }); return 1;
  } finally { clearTimeout(deadline); process.off('SIGINT', interrupt); }
}
