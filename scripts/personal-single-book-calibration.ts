/** Local text-only diagnostic. Import/preflight never reads a key or invokes a provider. */
import { closeSync, existsSync, fstatSync, lstatSync, openSync, readFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseEnv } from 'node:util';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { z } from 'zod';
import { causalCriticSchema, causalDigest, CausalExperimentError } from '../lib/personal-wizard/story-causal-experiment';
import { CAUSAL_STAGES, type CausalDispatch } from '../lib/personal-wizard/story-causal-experiment-runner';
import { preparePersonalStory } from '../lib/personal-wizard/story-writer';
import { resolvePersonalWizardOptions } from '../lib/personal-wizard/options';
import { withGenerationDeadline } from '../lib/personal-wizard/generation-deadline';
import { createCausalTrialHost, causalHostPolicySchema, causalOutputCap, type CausalHostTransport } from './personal-causal-trial-host';
import { CausalFamilyJournal, CausalHostError, exclusiveText, fencedText, hostFail, realDirectory } from './personal-causal-trial-journal';
import { CAUSAL_MODELS, createAstraCausalTransport, CausalTransportError, prepareCausalWire, wireReservation,
  type TransportReply, type WirePolicy } from './personal-causal-trial-adapters';
import { gitAt } from './personal-story-frozen-engine';

const sha = (b: string | Buffer) => createHash('sha256').update(b).digest('hex');
const PROBE_BYTES = 8192, PROBE_TOKENS = 2048, BOOK_BYTES = 104000;
const PROBE_ALLOWANCE = 250000, BOOK_ALLOWANCE = 11340000, TOTAL_ALLOWANCE = 12000000;
const approvalSchema = z.object({ reference: z.string().trim().min(10).max(600),
  maximumMicroUsd: z.literal(TOTAL_ALLOWANCE), acknowledgesCliEstimateLimits: z.literal(true) }).strict();
export const singleBookPolicySchema = z.object({ version: z.literal('personal-single-book-calibration/v1'),
  sourceHead: causalHostPolicySchema.shape.sourceHead, executable: z.string().min(1),
  executableSha256: causalHostPolicySchema.shape.executableSha256,
  pricing: causalHostPolicySchema.shape.pricing,
  mode: z.enum(['offline_injected', 'live_explicit']), approval: approvalSchema,
  // Operator attestation, not a claim that code can inspect provider-side routing.
  standardConfiguration: z.object({ attested: z.literal(true), reference: z.string().trim().min(10).max(600) }).strict(),
}).strict();
type SinglePolicy = z.infer<typeof singleBookPolicySchema>;

/** Fingerprint the opened regular binary before reservation, not text-decoded bytes. */
function assertExecutable(file: string, digest: string) {
  if (!path.isAbsolute(file)) hostFail('executable');
  realDirectory(path.dirname(file));
  const st = lstatSync(file);
  if (!st.isFile() || st.isSymbolicLink() || st.nlink !== 1 || st.size > 256000000 ||
    realpathSync.native(file).toLowerCase() !== path.resolve(file).toLowerCase()) hostFail('executable');
  const fd = openSync(file, 'r');
  try {
    const opened = fstatSync(fd);
    if (opened.dev !== st.dev || opened.ino !== st.ino || opened.size !== st.size || opened.nlink !== 1 ||
      sha(readFileSync(fd)) !== digest) hostFail('executable');
  } finally { closeSync(fd); }
}
function sourceAssertion(workspace: string, head: string) {
  return () => {
    if (gitAt(workspace, ['rev-parse', 'HEAD']).toString().trim() !== head ||
      gitAt(workspace, ['status', '--porcelain']).toString().trim()) hostFail('source_changed');
  };
}
function parsePolicy(raw: unknown): SinglePolicy {
  const result = singleBookPolicySchema.safeParse(raw);
  if (!result.success) hostFail('calibration_policy');
  const policy = structuredClone(result.data), age = Date.now() - Date.parse(policy.pricing.checkedAt);
  if (policy.mode === 'live_explicit' && (age < 0 || age > 86400000)) hostFail('pricing_stale');
  // This is the reviewed small-calibration recipe. A price change needs repricing,
  // not silently spending the unused $0.41 margin or shrinking output caps.
  const r = policy.pricing.rates;
  if (r.opus.inputMicroUsdPerToken !== 8 || r.opus.outputMicroUsdPerToken !== 20 ||
    r.astra.inputMicroUsdPerToken !== 12.5 || r.astra.outputMicroUsdPerToken !== 50) hostFail('calibration_rates');
  return policy;
}
export function prepareSingleBookCalibration(args: { workspace: string; outputParent: string; policy: unknown; request: unknown }) {
  const policy = parsePolicy(args.policy);
  if (![args.workspace, args.outputParent].every(path.isAbsolute)) hostFail('directory');
  const prepared = preparePersonalStory(structuredClone(args.request), resolvePersonalWizardOptions());
  if (!prepared.accepted.containsFixtureData || prepared.brief.beats !== 8) hostFail('fictional_eight_spreads');
  const request = prepared.accepted.canonical;
  // "Contains fixture data" alone means ANY field, not a wholly fictional input.
  // This diagnostic accepts only an entirely example-labelled request. Labels
  // remain operator provenance, not proof that its contents describe no real child.
  if ([request.child.nameSource, request.child.ageSource, request.child.addressSource, request.child.residenceSource].some(s => s !== 'fixture') ||
    request.facts.some(f => f.source !== 'fixture') || request.storyPlace && request.storyPlace.source !== 'fixture' ||
    request.intent?.kind === 'topic' && request.intent.suggestedBy !== 'fixture' || request.avoid.length ||
    request.appearance.photo !== 'none' || request.bookOptions.voiceId !== null) hostFail('fixture_only');
  // Binding to the approval reference, not output root/request, prevents a second
  // spend by moving files or substituting a different child under that allowance.
  const family = `personal-calibration-${causalDigest(policy.approval.reference).slice(0, 32)}`;
  const probeFamily = `${family}-probe`, bookFamily = `${family}-book`;
  const probeRoot = path.join(args.outputParent, probeFamily), bookRoot = path.join(args.outputParent, bookFamily);
  const probeReserved = wireReservation(PROBE_BYTES, PROBE_TOKENS, policy.pricing.rates.astra);
  const bookReserved = CAUSAL_STAGES.reduce((n, stage) => n + wireReservation(BOOK_BYTES,
    causalOutputCap(8, stage), policy.pricing.rates[['plan', 'replan', 'author', 'editor'].includes(stage) ? 'opus' : 'astra']), 0);
  if (probeReserved > PROBE_ALLOWANCE || bookReserved > BOOK_ALLOWANCE ||
    PROBE_ALLOWANCE + BOOK_ALLOWANCE > policy.approval.maximumMicroUsd) hostFail('budget');
  const digest = causalDigest({ policy, request: prepared.accepted.canonical,
    probeFamily, bookFamily, probeReserved, bookReserved });
  const probePacket = { version: 'synthetic-identity-schema-probe/v1', text: 'A fictional child opens a garden gate. No literary verdict is requested.' };
  const packetDigest = causalDigest(probePacket);
  const probeCall: CausalDispatch = { role: 'astra', stage: 'final_review', conversationKey: `${probeFamily}:case1:final_review`,
    instructions: 'Return the exact supplied packetDigest, a short factual summary and an empty findings array. This is an identity/schema probe, not literary approval.',
    input: JSON.stringify({ packetDigest, packet: probePacket }), schema: causalCriticSchema, maxOutputTokens: PROBE_TOKENS };
  const wirePolicy: WirePolicy = { executable: policy.executable, executableSha256: policy.executableSha256,
    workspace: args.workspace, maxWireBytes: PROBE_BYTES, rates: policy.pricing.rates };
  const probeWire = prepareCausalWire(probeCall, wirePolicy, probeReserved);
  return { policy, prepared, digest, packetDigest, probeCall, probeWire, wirePolicy,
    probeFamily, bookFamily, probeRoot, bookRoot, probeReserved, bookReserved,
    preview: { version: policy.version, sourceHead: policy.sourceHead, companionId: prepared.brief.companion.id,
      spreads: 8, models: CAUSAL_MODELS, probeFamily, bookFamily, probeRoot, bookRoot,
      probeReservedMicroUsd: probeReserved, bookReservedMicroUsd: bookReserved,
      combinedAllowancesMicroUsd: PROBE_ALLOWANCE + BOOK_ALLOWANCE, maximumLogicalAttempts: 8,
      runtimeEligible: false, invoiceCapGuaranteed: false, providerCalls: 0 } };
}

export function createSingleBookCalibration(args: {
  workspace: string; outputParent: string; policy: unknown; request: unknown; signal: AbortSignal;
  existingOpenAIKey?: () => string;
  injected?: { commonDir: string; assertSource: () => void; transport: CausalHostTransport };
}) {
  const spec = prepareSingleBookCalibration(args), { policy } = spec, signal = args.signal;
  if ((policy.mode === 'offline_injected') !== Boolean(args.injected) ||
    policy.mode === 'live_explicit' && !args.existingOpenAIKey) hostFail('authorization');
  if (policy.mode === 'live_explicit' && path.resolve(args.workspace).toLowerCase() !==
    path.resolve(__dirname, '..').toLowerCase()) hostFail('loaded_source_workspace');
  const assertSource = args.injected?.assertSource ?? sourceAssertion(args.workspace, policy.sourceHead);
  const admission = () => {
    if (signal.aborted) hostFail('cancelled');
    assertSource(); assertExecutable(policy.executable, policy.executableSha256);
    realDirectory(args.workspace); realDirectory(args.outputParent);
  };
  admission();
  const commonDir = args.injected?.commonDir ?? gitAt(args.workspace, ['rev-parse', '--path-format=absolute', '--git-common-dir']).toString().trim();
  realDirectory(commonDir);
  if (existsSync(spec.probeRoot) || existsSync(spec.bookRoot)) hostFail('output_exists');
  for (const family of [spec.probeFamily, spec.bookFamily]) for (const namespace of ['codex-causal-text-trials', 'codex-text-trials']) {
    if (existsSync(path.join(commonDir, namespace, family))) hostFail('family_consumed');
  }
  let phase: 'ready' | 'probing' | 'planning' | 'planned' | 'writing' | 'complete' | 'failed' = 'ready';
  let journal: CausalFamilyJournal | null = null, host: ReturnType<typeof createCausalTrialHost> | null = null;
  const probe = { attempted: false, receipt: null as TransportReply | null, failureCode: null as string | null };
  const terminated = () => phase === 'failed';
  const stop = () => { signal.removeEventListener('abort', stop); if (phase === 'complete' || phase === 'failed') return;
    phase = 'failed'; probe.failureCode ??= signal.aborted ? 'cancelled' : 'operator_stopped';
    journal?.seal(probe.failureCode); host?.stop(); };
  signal.addEventListener('abort', stop, { once: true });
  const active = () => { if (phase === 'failed' || signal.aborted) hostFail('terminal'); admission(); };
  const fail = (error: unknown): never => {
    const code = error instanceof CausalHostError || error instanceof CausalExperimentError ? error.code : 'driver_failed';
    if (phase !== 'failed') { probe.failureCode ??= code; stop(); }
    signal.removeEventListener('abort', stop);
    throw new CausalHostError(code);
  };
  return {
    preview: structuredClone(spec.preview),
    async plan() {
      if (phase !== 'ready') hostFail('phase'); phase = 'probing';
      try {
        active();
        journal = CausalFamilyJournal.reserve({ commonDir, outputRoot: spec.probeRoot, family: spec.probeFamily,
          coordinatorDigest: spec.digest, maximumMicroUsd: spec.probeReserved,
          slots: [{ id: 'case1:final_review', capMicroUsd: spec.probeReserved }],
          manifest: { ...spec.preview, policy, driverDigest: spec.digest, requestDigest: causalDigest(spec.prepared.accepted.canonical),
            actualProbeBytes: spec.probeWire.bytes, packetDigest: spec.packetDigest, costKind: 'estimate_not_invoice' } });
        journal.claim(spec.probeFamily, spec.digest, 'case1:final_review');
        active(); journal.dispatch('case1:final_review', { wire: spec.probeWire, sourceHead: policy.sourceHead });
        active();
        const transport = args.injected?.transport ?? createAstraCausalTransport({
          key: args.existingOpenAIKey ?? (() => hostFail('authorization')), rates: policy.pricing.rates.astra });
        probe.attempted = true;
        const reply = await withGenerationDeadline(PROBE_TOKENS, signal,
          reason => new CausalHostError(reason === 'timeout' ? 'probe_timeout' : 'cancelled'),
          stageSignal => transport(spec.probeWire, spec.probeCall, stageSignal));
        // A timely received result remains evidence even if source/executable drift
        // now blocks the book. A cancelled/late result must never revive authority.
        if (terminated() || signal.aborted) hostFail('terminal');
        probe.receipt = structuredClone(reply);
        journal.settle('case1:final_review', probe);
        active();
        const output = causalCriticSchema.parse(reply.output), u = reply.usage, cost = reply.estimatedMicroUsd;
        if (output.packetDigest !== spec.packetDigest || output.findings.length || !u ||
          ![u.inputTokens, u.outputTokens].every(n => Number.isSafeInteger(n) && n >= 0) || u.outputTokens > PROBE_TOKENS ||
          cost === null || !Number.isSafeInteger(cost) || cost < 0 || cost > spec.probeReserved ||
          reply.metadata.reportedModel !== CAUSAL_MODELS.astra || reply.metadata.serviceTier !== 'default' || reply.metadata.status !== 'completed') hostFail('probe_invalid');
        journal.save('probe-result', { output, receipt: reply, providerReportedNotAttestation: true, runtimeEligible: false });
        journal.verifyRecords(); journal.seal('probe_completed');
        active(); phase = 'planning';
        host = createCausalTrialHost({ workspace: args.workspace, outputRoot: spec.bookRoot,
          policy: { version: 'causal-trial-host/v1', family: spec.bookFamily, sourceHead: policy.sourceHead,
            maximumMicroUsd: BOOK_ALLOWANCE, maxWireBytes: BOOK_BYTES, executable: policy.executable,
            executableSha256: policy.executableSha256, pricing: policy.pricing, mode: policy.mode,
            approval: policy.mode === 'live_explicit' ? { ...policy.approval, maximumMicroUsd: BOOK_ALLOWANCE } : null },
          cases: [{ id: 'case1', request: spec.prepared.accepted.canonical }], signal,
          existingOpenAIKey: args.existingOpenAIKey, injected: args.injected });
        const bundle = await host.plan(); active(); phase = 'planned'; return bundle;
      } catch (error) {
        if (!terminated() && error instanceof CausalTransportError && journal && !probe.receipt) {
          probe.receipt = { ...structuredClone(error.receipt), output: null };
          try { journal.settle('case1:final_review', { ...probe, failureCode: error.code }); } catch { /* terminal regardless */ }
        }
        return fail(error);
      }
    },
    async writeFromReviewFile() {
      if (phase !== 'planned' || !host) hostFail('phase');
      phase = 'writing';
      try { active(); const result = await host.writeFromReviewFile(); active();
        exclusiveText(path.join(spec.bookRoot, 'index.html'), renderSingleBookText(result));
        phase = 'complete'; signal.removeEventListener('abort', stop); return result;
      } catch (error) { return fail(error); }
    },
    stop,
    snapshot() { return structuredClone({ phase, probe, host: host?.snapshot() ?? null,
      allowanceMicroUsd: PROBE_ALLOWANCE + BOOK_ALLOWANCE,
      knownEstimateMicroUsd: (probe.receipt?.estimatedMicroUsd ?? 0) +
        (host?.snapshot().host.rows.reduce((n, r) => n + (r.receipt?.estimatedMicroUsd ?? 0), 0) ?? 0),
      kind: 'estimate_not_invoice', runtimeEligible: false }); },
  };
}

/** Presentation only; all provider/raw authority remains in immutable JSON records. */
type BookResult = Awaited<ReturnType<ReturnType<typeof createCausalTrialHost>['write']>>;
export function singleBookOutcome(result: BookResult) {
  if (!result.books.length) return 'synopsis_held' as const;
  const held = result.books.some(book => book.edit.disposition === 'held' ||
    // A blocking original defect may have been repaired. Only the final reading
    // and comparison, or editor HOLD, hold the resulting text here.
    book.readings.slice(1).some(reading => reading.findings.some(f => f.severity === 'blocking' &&
      ['issue', 'remaining_problem', 'new_regression'].includes(f.kind))));
  return held ? 'text_held_by_model' as const : 'text_ready_for_human_review' as const;
}
export function renderSingleBookText(result: BookResult) {
  const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  const outcome = singleBookOutcome(result), intro = outcome === 'synopsis_held'
    ? 'התקציר הוחזק לבדיקה. לא נכתבה פרוזה ולא נוצר ספר.'
    : 'Opus כתב מאפס וערך בשיחה חדשה; Astra בדק. הסיפור עדיין דורש קריאה ואישור אנושי.';
  return `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ספר ניסיון אישי</title><style>body{max-width:850px;margin:auto;padding:24px;background:#faf7f2;color:#24342d;font:20px/1.8 system-ui}article{background:white;padding:24px;margin:20px 0;border-radius:12px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.6 system-ui}a{color:#17674b}p{white-space:pre-wrap}</style><h1>ספר ניסיון: מקור ועריכה</h1><p>${intro} טקסט בלבד. אלה הערכות מודל, לא אישור מוצר או הוכחת איכות. לא נוצרו איורים.</p><p>תוצאת הניסוי: ${esc(outcome)}</p>` + result.books.map(book =>
    `<nav><a href="#original">הטיוטה</a> · <a href="#edited">העריכה</a> · <a href="#qa">הביקורת</a></nav>` +
    ([['original', 'הטיוטה המקורית', book.original], ['edited', 'הסיפור הערוך', book.edit.revised]] as const).map(([id, label, doc]) =>
      `<section id="${id}"><h2>${esc(label)}: ${esc(doc.manuscript.title)}</h2>` + doc.manuscript.pages.map(page =>
        `<article><h3>כפולה ${page.pageNumber}</h3><p>${esc(page.text)}</p></article>`).join('') + '</section>').join('') +
    `<section id="qa"><h2>אבחון ו־QA</h2><p>סטטוס העריכה: ${esc(book.edit.disposition)}</p><pre>${esc(JSON.stringify({ diagnosis: book.edit.diagnosis, strengths: book.edit.strengths, readings: book.readings }, null, 2))}</pre></section>`).join('') + '</html>';
}

const cliConfigSchema = z.object({ workspace: z.string().min(1), outputParent: z.string().min(1),
  policy: singleBookPolicySchema, request: z.unknown(), existingKeyEnvFile: z.string().min(1) }).strict();
export async function singleBookCalibrationCLI(argv: string[]) {
  if (argv.length === 1 && argv[0] === '--help') {
    console.log('node scripts/personal-single-book-calibration.cjs --config <absolute.json> [--execute]'); return 0;
  }
  if (argv.length < 2 || argv.length > 3 || argv[0] !== '--config' || !path.isAbsolute(argv[1]) ||
    argv.length === 3 && argv[2] !== '--execute') hostFail('arguments');
  const config = cliConfigSchema.parse(JSON.parse(fencedText(argv[1], 64000)));
  if (config.policy.mode !== 'live_explicit' || !path.isAbsolute(config.existingKeyEnvFile)) hostFail('authorization');
  const spec = prepareSingleBookCalibration({ ...config, request: config.request });
  if (argv.length === 2) { console.log(JSON.stringify({ ...spec.preview, mode: 'budget_preview_only_no_reservation' })); return 0; }
  const controller = new AbortController(), cancel = () => controller.abort();
  process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
  let trial: ReturnType<typeof createSingleBookCalibration> | null = null;
  let reader: ReturnType<typeof createInterface> | null = null;
  try {
    trial = createSingleBookCalibration({ ...config, request: config.request, signal: controller.signal, existingOpenAIKey: () => {
      const text = fencedText(config.existingKeyEnvFile, 256000), lines = text.split(/\r?\n/).filter(l => /^\s*OPENAI_API_KEY\s*=/.test(l));
      const key = lines.length === 1 ? parseEnv(lines[0]).OPENAI_API_KEY : null;
      if (!key || !/^sk-[A-Za-z0-9_-]{20,}$/.test(key)) hostFail('key_unavailable'); return key;
    } });
    console.log(JSON.stringify({ status: 'starting_identity_probe', ...spec.preview }));
    const synopsis = await trial.plan();
    console.log(JSON.stringify({ status: 'synopsis_review_required', sourceDigest: synopsis.sourceDigest,
      bookRoot: spec.bookRoot, instruction: 'Read synopses.json; write digest-bound review.json. Enter continue, or stop. Same process only.' }));
    reader = createInterface({ input: process.stdin, output: process.stdout });
    const decision = await new Promise<string>(resolve => {
      const timer = setTimeout(() => resolve('stop'), 1200000);
      reader!.once('line', line => { clearTimeout(timer); resolve(line.trim()); });
      reader!.once('close', () => { clearTimeout(timer); resolve('stop'); });
      controller.signal.addEventListener('abort', () => { clearTimeout(timer); resolve('stop'); }, { once: true });
    });
    if (decision !== 'continue' || controller.signal.aborted) { trial.stop(); return 2; }
    const result = await trial.writeFromReviewFile();
    const snapshot = trial.snapshot();
    console.log(JSON.stringify({ status: singleBookOutcome(result), viewer: path.join(spec.bookRoot, 'index.html'),
      accounting: { kind: snapshot.kind, allowanceMicroUsd: snapshot.allowanceMicroUsd,
        knownEstimateMicroUsd: snapshot.knownEstimateMicroUsd,
        logicalAttempts: Number(snapshot.probe.attempted) + (snapshot.host?.host.rows.filter(r => r.attempted).length ?? 0),
        unknownAttemptCosts: Number(snapshot.probe.attempted && snapshot.probe.receipt?.estimatedMicroUsd == null) +
          (snapshot.host?.host.rows.filter(r => r.attempted && r.receipt?.estimatedMicroUsd == null).length ?? 0) },
      runtimeEligible: false })); return 0;
  } finally {
    trial?.stop(); reader?.close(); process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel);
  }
}
