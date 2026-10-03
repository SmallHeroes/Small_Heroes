'use strict';
// Bounded diagnostic only. Native CLI estimates are never GPT-priced product accounting.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), Module = require('node:module');
const { spawn, execFileSync } = require('node:child_process');
const FAMILY = 'personal-opus-semantic-six-v2-20261003', MODEL = 'claude-opus-5-5', TOTAL_MICRO = 12000000;
const CLI = 'C:/Users/guyna/AppData/Roaming/npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe';
const CAPS = { 8: .8, 12: 1, 16: 1.2 }, TIMEOUTS = { 8: 300000, 12: 420000, 16: 540000 };
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function durable(file, bytes, flag = 'wx') { const fd = fs.openSync(file, flag); try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
const save = (file, data) => durable(file, JSON.stringify(data, null, 2) + '\n');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
function shuffled(rows, seed, purpose) {
  const result = structuredClone(rows);
  for (let i = result.length - 1; i > 0; i--) {
    const j = parseInt(sha(`${seed}:${purpose}:${i}`).slice(0, 12), 16) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function buildCases(engine, seed) {
  const source = engine.companionTrialCohort();
  const companions = shuffled(source.map(row => row.request.companion.id), seed, 'companion');
  const lengths = shuffled(source.map(row => row.request.bookOptions.lengthId), seed, 'length');
  const options = engine.resolvePersonalWizardOptions();
  return shuffled(source, seed, 'order').map((row, i) => {
    row.request.companion.id = companions[i]; row.request.bookOptions.lengthId = lengths[i];
    const prepared = engine.preparePersonalStory(row.request, options);
    if (!prepared.accepted.containsFixtureData) throw Error('cohort_not_fictional');
    return { id: row.id, request: row.request, brief: prepared.brief, capUsd: CAPS[prepared.brief.beats], timeoutMs: TIMEOUTS[prepared.brief.beats] };
  });
}
function assertManifest(manifest, engine) {
  if (manifest.version !== 'personal-opus-six/diagnostic-v1' || manifest.family !== FAMILY || manifest.model !== MODEL ||
    manifest.effort !== 'medium' || manifest.configuredCliEstimateUsd !== 12 || !/^[a-f0-9]{48}$/.test(manifest.seed) ||
    engine.canonicalJson(manifest.cases) !== engine.canonicalJson(buildCases(engine, manifest.seed))) throw Error('cohort_manifest_authority');
}
function assertSlot(state, row, stage) {
  const index = state.rows.length, expected = state.manifest.cases[Math.floor(index / 2)];
  if (index >= 12 || !expected || expected.id !== row.id || stage !== (index % 2 === 0 ? 'author' : 'editor') ||
    row.capUsd !== CAPS[row.brief.beats] || row.timeoutMs !== TIMEOUTS[row.brief.beats] ||
    state.microUsd + Math.round(row.capUsd * 1e6) > TOTAL_MICRO) throw Error('cohort_slot_authority');
}
function validateCli(payload, termination, timedOut, raw, cap, previousMicro) {
  if (timedOut || termination.code !== 0 || termination.signal || payload.is_error !== false || payload.subtype !== 'success' || raw.includes('\ufffd')) throw Error('cli_incomplete');
  const models = Object.keys(payload.modelUsage ?? {});
  if (models.length !== 1 || models[0] !== MODEL) throw Error('cli_unexpected_model');
  if (!Number.isFinite(payload.total_cost_usd) || payload.total_cost_usd < 0) throw Error('cli_unknown_cost');
  const micro = Math.round(payload.total_cost_usd * 1e6);
  if (payload.total_cost_usd > cap || previousMicro + micro > TOTAL_MICRO) throw Error('cli_allowance_exceeded');
  return micro;
}
function loadEngine(workspace) {
  const resolve = name => require(require.resolve(name, { paths: [workspace] }));
  const source = `export {preparePersonalStory,STORY_INSTRUCTIONS,RESILIENCE_INSTRUCTIONS,NARRATIVE_CRAFT_INSTRUCTIONS,ADVENTURE_SELECTION_INSTRUCTIONS} from './lib/personal-wizard/story-writer';
export {STORY_EDITOR_INSTRUCTIONS,storyEditorOutputTokens} from './lib/personal-wizard/story-editor';
export {storyEditorProviderSchema,decodeStoryEditorOutput} from './lib/personal-wizard/story-editor-openai';
export {personalStoryPlanSchema,personalManuscriptSchema} from './lib/personal-wizard/story-contract';
export {adventureSelectionSchema,adventureSelectionIssue} from './lib/personal-wizard/story-planning-contract';
export {canonicalJson} from './lib/personal-wizard/request-acceptance'; export {comparableText} from './lib/personal-wizard/contract';
export {measureStoryText} from './lib/personal-wizard/story-text-metrics'; export {resolvePersonalWizardOptions} from './lib/personal-wizard/options';
export {assertSemanticEditEvidence,semanticEditNeedsWork} from './lib/personal-wizard/story-semantic-audit';
export {prepareStoryTextReview} from './lib/personal-wizard/story-text-review';
export {companionTrialCohort} from './scripts/personal-book-companion-cohort';`;
  const built = resolve('esbuild').buildSync({ stdin: { contents: source, resolveDir: workspace, sourcefile: 'semantic-cohort-memory.ts', loader: 'ts' },
    bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false, logLevel: 'silent' });
  const memory = new Module(path.join(workspace, 'semantic-cohort-memory.cjs')); memory.filename = path.join(workspace, 'semantic-cohort-memory.cjs');
  memory.paths = Module._nodeModulePaths(workspace); memory._compile(built.outputFiles[0].text, memory.filename);
  return { ...memory.exports, zodTextFormat: resolve('openai/helpers/zod').zodTextFormat };
}
function normalize(raw, brief, engine) {
  if (raw.requestId !== brief.requestId) throw Error('cohort_request_binding');
  const plan = engine.personalStoryPlanSchema.parse({ ...raw.plan, requestId: brief.requestId,
    beats: raw.plan.beats.map((b, i) => ({ ...b, pageNumber: i + 1 })) });
  const manuscript = engine.personalManuscriptSchema.parse({ ...raw.manuscript, requestId: brief.requestId,
    planDigest: sha(engine.canonicalJson(plan)), pages: raw.manuscript.pages.map((p, i) => ({ ...p, pageNumber: i + 1 })) });
  const ids = new Set(brief.facts.map(f => f.id));
  if (plan.beats.length !== brief.beats || manuscript.pages.length !== brief.beats || plan.resilience.mode !== brief.resilienceMode ||
    new Set(plan.resilience.moments.map(m => m.pageNumber)).size !== plan.resilience.moments.length ||
    plan.resilience.moments.some(m => m.pageNumber > brief.beats) || plan.beats.some(b => b.factIds.some(id => !ids.has(id))) ||
    !brief.facts.some(f => f.kind === 'interest' && plan.beats.some(b => b.factIds.includes(f.id)))) throw Error('cohort_content_binding');
  const prose = manuscript.title + '\n' + manuscript.pages.map(p => p.text).join('\n');
  if (/[-\u05be\u2013\u2014]/u.test(prose) || /imageDirection\s*:/iu.test(prose) ||
    brief.excludedSubjects.some(s => engine.comparableText(prose).includes(engine.comparableText(s)))) throw Error('cohort_prose_exclusion');
  return { plan, manuscript, characterDigest: brief.companion.characterDigest };
}
function snapshots(roots) {
  const result = {};
  for (const root of roots) {
    if (!fs.existsSync(root)) throw Error('preserved_root_missing');
    const visit = dir => { for (const name of fs.readdirSync(dir).sort()) {
      const file = path.join(dir, name), stat = fs.lstatSync(file);
      if (stat.isSymbolicLink()) throw Error('preserved_link');
      if (stat.isDirectory()) visit(file);
      else { const bytes = fs.readFileSync(file); result[file] = { sha256: sha(bytes), bytes: bytes.length, mtimeMs: stat.mtimeMs }; }
    } };
    visit(root);
  }
  return result;
}
function context(workspace) {
  const git = (...args) => execFileSync('git', args, { cwd: workspace, encoding: 'utf8' }).trim();
  const common = path.resolve(workspace, git('rev-parse', '--git-common-dir'));
  const output = path.join(workspace, 'outputs', FAMILY), claim = path.join(common, 'codex-text-trials', FAMILY);
  const roots = ['personal-six-companion-books-20261002', 'personal-opus-editor-sample-20261003', 'personal-opus-authored-astra-qa-20261003', 'personal-opus-author-approved-20261003'].map(name => path.join(workspace, 'outputs', name));
  roots.push(path.join(common, 'codex-text-trials/personal-opus-authored-astra-qa-20261003'));
  const guidancePath = path.join(workspace, 'outputs/personal-opus-authored-astra-qa-20261003/personal-editor-craft-guidance-20261003.cjs');
  roots.push(path.join(workspace, 'outputs/personal-opus-semantic-six-20261003')); // Superseded FREE preparation stays immutable.
  return { workspace, git, output, claim, roots, guidancePath };
}
function prepare(workspace, expectedHead) {
  const c = context(workspace);
  if (!/^[a-f0-9]{40}$/.test(expectedHead) || c.git('rev-parse', 'HEAD') !== expectedHead || c.git('status', '--porcelain')) throw Error('cohort_source_not_frozen');
  if (fs.existsSync(c.output) || fs.existsSync(c.claim)) throw Error('cohort_family_consumed');
  const engine = loadEngine(workspace), seed = crypto.randomBytes(24).toString('hex'), cases = buildCases(engine, seed);
  if (cases.reduce((n, c) => n + Math.round(c.capUsd * 2e6), 0) !== TOTAL_MICRO) throw Error('cohort_reservation');
  const guidancePath = c.guidancePath;
  const manifest = { version: 'personal-opus-six/diagnostic-v1', family: FAMILY, sourceHead: expectedHead, sourceBranch: c.git('branch', '--show-current'),
    authorization: 'Guy approved general semantic correction followed by six varied fictional Opus author/fresh editor/Astra QA books on 2026-10-03. Configured CLI estimate ceiling USD12, twelve one-use slots. No retries, render or deployment.',
    seed, cases, model: MODEL, effort: 'medium', cliVersion: execFileSync(CLI, ['--version'], { windowsHide: true, encoding: 'utf8' }).trim(), cliSha256: sha(fs.readFileSync(CLI)),
    runnerSha256: sha(fs.readFileSync(__filename)), guidancePath, guidanceSha256: sha(fs.readFileSync(guidancePath)),
    configuredCliEstimateUsd: 12, invoiceCapGuaranteed: false, astraSubscriptionCost: 'unmeasured', internalProviderCallCount: 'unverified',
    originalAuthoring: 'brief only; combined concept selection, whole plan and manuscript; no prior story', priorCliEstimateUsd: 1.277727,
    runtimeEligible: false, providerMigration: false, independentTechnicalPass: false, before: snapshots(c.roots) };
  fs.mkdirSync(c.output); save(path.join(c.output, 'manifest.json'), manifest);
  save(path.join(c.output, 'preparation.json'), { providerDispatches: 0, cases: cases.length, slots: 12, configuredEstimateUsd: 12 });
  return manifest;
}
async function dispatch(c, row, stage, input, instructions, schema, state, engine) {
  assertSlot(state, row, stage);
  if (fs.existsSync(path.join(c.output, 'halt.json'))) throw Error('cohort_halted');
  if (c.git('rev-parse', 'HEAD') !== state.manifest.sourceHead || c.git('status', '--porcelain')) throw Error('cohort_source_changed');
  const schemaJson = engine.zodTextFormat(schema, 'personal_opus_' + stage).schema;
  const args = ['-p', '--safe-mode', '--model', MODEL, '--effort', 'medium', '--tools', '', '--max-budget-usd', String(row.capUsd),
    '--output-format', 'json', '--no-session-persistence', '--system-prompt', instructions, '--json-schema', JSON.stringify(schemaJson)];
  // Windows argv ceiling, including escaping. Reject before consuming a paid slot.
  if (args.map(s => JSON.stringify(s)).join(' ').length + CLI.length > 31000) throw Error('cohort_argv_limit');
  const dir = path.join(c.output, row.id), slot = `${row.id}-${stage}`;
  const invocation = { slot, executable: CLI, args, stdinSha256: sha(input), requestedModel: MODEL, freshProcess: true, noSessionPersistence: true, managedHooksMayRemain: true,
    capUsd: row.capUsd, timeoutMs: row.timeoutMs, productOutputTokenCapNotEnforcedByCli: true };
  durable(path.join(dir, stage + '-input.json'), input); durable(path.join(dir, stage + '-instructions.txt'), instructions);
  save(path.join(dir, stage + '-schema.json'), schemaJson); save(path.join(dir, stage + '-invocation.json'), invocation);
  save(path.join(c.claim, slot + '.json'), invocation); // Exclusive durable claim BEFORE spawn. Never resume/retry.
  const receipt = { slot, status: 'held', cliInvocationCount: 1, costKnown: false, estimatedUsd: null, capUsd: row.capUsd, termination: null, timedOut: false };
  state.rows.push(receipt);
  const chunks = [], errors = []; let timer; const start = Date.now();
  const event = data => durable(path.join(c.claim, 'events.jsonl'), JSON.stringify(data) + '\n', 'a');
  try {
    event({ event: 'dispatch_started', slot, time: new Date().toISOString(), inputSha256: invocation.stdinSha256 });
    const child = spawn(CLI, args, { cwd: c.workspace, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const terminated = new Promise(resolve => { child.once('error', () => resolve({ code: null, signal: null, spawnError: true })); child.once('close', (code, signal) => resolve({ code, signal })); });
    child.stdout.on('data', b => chunks.push(Buffer.from(b))); child.stderr.on('data', b => errors.push(Buffer.from(b)));
    child.stdin.on('error', () => {}); child.stdin.end(input);
    timer = setTimeout(() => { receipt.timedOut = true; child.kill(); }, row.timeoutMs);
    receipt.termination = await terminated;
    const raw = Buffer.concat(chunks).toString('utf8'), payload = JSON.parse(raw);
    receipt.estimatedUsd = Number.isFinite(payload.total_cost_usd) && payload.total_cost_usd >= 0 ? payload.total_cost_usd : null;
    receipt.costKnown = receipt.estimatedUsd !== null; receipt.usage = payload.usage ?? null;
    receipt.cliReportedTurns = payload.num_turns ?? null; receipt.cliReportedModels = Object.keys(payload.modelUsage ?? {});
    state.microUsd += validateCli(payload, receipt.termination, receipt.timedOut, raw, row.capUsd, state.microUsd);
    const result = schema.parse(payload.structured_output ?? JSON.parse(payload.result));
    receipt.status = 'schema_admitted'; return result;
  } catch (error) { receipt.failureCode = String(error.message).split('\n')[0].slice(0, 140); throw Error('cohort_' + slot + '_failed'); }
  finally {
    clearTimeout(timer); receipt.elapsedMs = Date.now() - start;
    durable(path.join(dir, stage + '-cli-result.json'), Buffer.concat(chunks)); durable(path.join(dir, stage + '-stderr.txt'), Buffer.concat(errors));
    save(path.join(dir, stage + '-receipt.json'), receipt); event({ event: 'dispatch_finished', receipt });
    console.log(JSON.stringify({ stageFinished: slot, estimatedUsd: receipt.estimatedUsd, status: receipt.status }));
  }
}
async function run(workspace) {
  const c = context(workspace), manifest = read(path.join(c.output, 'manifest.json'));
  if (fs.existsSync(c.claim)) throw Error('cohort_family_consumed');
  const engine = loadEngine(workspace);
  assertManifest(manifest, engine);
  if (c.git('rev-parse', 'HEAD') !== manifest.sourceHead || c.git('status', '--porcelain') || manifest.runnerSha256 !== sha(fs.readFileSync(__filename)) ||
    manifest.guidancePath !== c.guidancePath || manifest.cliSha256 !== sha(fs.readFileSync(CLI)) || manifest.guidanceSha256 !== sha(fs.readFileSync(c.guidancePath)) ||
    JSON.stringify(snapshots(c.roots)) !== JSON.stringify(manifest.before)) throw Error('cohort_preflight_mismatch');
  fs.mkdirSync(c.claim); save(path.join(c.claim, 'claim.json'), { manifestSha256: sha(fs.readFileSync(path.join(c.output, 'manifest.json'))), configuredCliEstimateUsd: 12, slots: 12 });
  const state = { manifest, rows: [], microUsd: 0, cases: [], consecutiveEditorialHolds: 0, status: 'held' }, guidance = require(c.guidancePath);
  try {
    for (const row of manifest.cases) {
      const dir = path.join(c.output, row.id); fs.mkdirSync(dir); save(path.join(dir, 'request.json'), row.request); save(path.join(dir, 'brief.json'), row.brief);
      const prepared = engine.preparePersonalStory(row.request, engine.resolvePersonalWizardOptions());
      if (engine.canonicalJson(prepared.brief) !== engine.canonicalJson(row.brief)) throw Error('cohort_brief_changed');
      const contextCall = { stage: 'editor', input: engine.canonicalJson({ brief: row.brief, draftDigest: '0'.repeat(64) }) };
      const authorSchema = engine.storyEditorProviderSchema(contextCall).omit({ draftDigest: true, checks: true, semanticAudit: true }).extend({ adventureSelection: engine.adventureSelectionSchema });
      const numbering = `Ordered beats/pages omit pageNumber; engine assigns positions. Evidence/resilience references use narrative spread numbers1..${row.brief.beats}. There are exactly${row.brief.beats} narrative spreads, not display pages.`;
      const authorInput = engine.canonicalJson({ brief: row.brief, task: `Create two genuinely different adventure concepts, choose one, plan the WHOLE story and write an ORIGINAL complete Hebrew manuscript of${row.brief.beats} spreads. No prior story or outline is supplied. Return matching plan/manuscript/adventureSelection. Word targets are soft; do not pad or turn backstage continuity into narration. Enact the resolution and the pleasure the child wanted.` });
      const authorInstructions = [engine.STORY_INSTRUCTIONS, engine.RESILIENCE_INSTRUCTIONS, engine.NARRATIVE_CRAFT_INSTRUCTIONS,
        engine.ADVENTURE_SELECTION_INSTRUCTIONS, guidance.childNativeAuthorGuidance(row.brief.child.age), numbering].join('\n\n');
      const rawAuthor = await dispatch(c, row, 'author', authorInput, authorInstructions, authorSchema, state, engine);
      save(path.join(dir, 'author-output.json'), rawAuthor); const original = normalize(rawAuthor, row.brief, engine);
      const issue = engine.adventureSelectionIssue(rawAuthor.adventureSelection, row.brief.facts, row.brief.beats, original.plan.beats.flatMap(b => b.factIds));
      if (issue && issue !== 'story_outline_held') throw Error(issue);
      save(path.join(dir, 'original.json'), original);
      const draftDigest = sha(engine.canonicalJson(original));
      const editorCall = { stage: 'editor', maxOutputTokens: engine.storyEditorOutputTokens(row.brief.beats),
        instructions: [engine.STORY_EDITOR_INSTRUCTIONS, guidance.childNativeEditorialGuidance(row.brief.child.age), numbering].join('\n\n'),
        input: engine.canonicalJson({ brief: row.brief, draft: original, draftDigest, draftTextMetrics: engine.measureStoryText(original.manuscript, row.brief.child.age),
          task: 'Edit this complete original draft in a fresh conversation. Return all matching revised spreads plus honest final observations and exact original/revised semantic evidence. No author self-ratings or author conversation are supplied.' }) };
      const rawEditor = await dispatch(c, row, 'editor', editorCall.input, editorCall.instructions, engine.storyEditorProviderSchema(editorCall), state, engine);
      const edited = engine.decodeStoryEditorOutput(editorCall, rawEditor); save(path.join(dir, 'editor-output.json'), edited);
      if (edited.draftDigest !== draftDigest) throw Error('cohort_draft_binding');
      const final = normalize(edited, row.brief, engine);
      engine.assertSemanticEditEvidence(edited.semanticAudit, original.manuscript, final.manuscript);
      save(path.join(dir, 'final.json'), final);
      const packets = engine.prepareStoryTextReview(prepared, original, final);
      save(path.join(dir, 'astra-final.json'), packets.final); save(path.join(dir, 'astra-comparison.json'), packets.comparison);
      const disposition = { id: row.id, child: row.brief.child, companion: row.brief.companion.name, spreads: row.brief.beats,
        authorSelfHeld: issue === 'story_outline_held', editorSelfHeld: Object.values(edited.checks).some(v => v.outcome === 'needs_work') || engine.semanticEditNeedsWork(edited.semanticAudit),
        originalDigest: draftDigest, finalDigest: sha(engine.canonicalJson(final)), auditDigest: sha(engine.canonicalJson(edited.semanticAudit)), packets: packets.bindings,
        originalMetrics: engine.measureStoryText(original.manuscript, row.brief.child.age), finalMetrics: engine.measureStoryText(final.manuscript, row.brief.child.age),
        runtimeEligible: false, status: 'awaiting_independent_literary_advisory' };
      save(path.join(dir, 'admission.json'), disposition); state.cases.push(disposition);
      console.log(JSON.stringify({ bookReady: row.id, companion: disposition.companion, spreads: disposition.spreads, editorSelfHeld: disposition.editorSelfHeld }));
      state.consecutiveEditorialHolds = disposition.editorSelfHeld ? state.consecutiveEditorialHolds + 1 : 0;
      if (state.consecutiveEditorialHolds >= 2) throw Error('cohort_repeated_editorial_hold');
    }
    state.status = 'six_books_awaiting_literary_advisory';
  } catch (error) { state.failureCode = String(error.message).split('\n')[0].slice(0, 140); }
  finally {
    const after = snapshots(c.roots), sourcePreserved = JSON.stringify(after) === JSON.stringify(manifest.before);
    save(path.join(c.output, 'preservation.json'), { before: manifest.before, after, sourcePreserved });
    const known = state.rows.every(r => r.costKnown), actualMicro = state.rows.reduce((n, r) => n + Math.round((r.estimatedUsd ?? 0) * 1e6), 0);
    const receipt = { ...state, manifest: undefined, cliInvocationCount: state.rows.length, internalProviderCallCount: 'unverified', costKnown: known,
      newCliEstimateUsd: known ? actualMicro / 1e6 : null, priorPlusNewCliEstimateUsd: known ? 1.277727 + actualMicro / 1e6 : null,
      costKind: 'CLI usage estimate not invoice; Astra subscription cost unmeasured', sourcePreserved,
      headUnchanged: c.git('rev-parse', 'HEAD') === manifest.sourceHead, worktreeClean: !c.git('status', '--porcelain'), runtimeEligible: false, renders: 0, narrationCalls: 0 };
    if (!sourcePreserved || !receipt.headUnchanged || !receipt.worktreeClean) { receipt.status = 'held'; receipt.failureCode = 'cohort_preservation_failed'; }
    save(path.join(c.output, 'receipt.json'), receipt); save(path.join(c.claim, 'sealed.json'), receipt);
    console.log(JSON.stringify({ status: receipt.status, books: state.cases.length, cliInvocationCount: receipt.cliInvocationCount, newCliEstimateUsd: receipt.newCliEstimateUsd, failureCode: receipt.failureCode }));
    if (receipt.status !== 'six_books_awaiting_literary_advisory') process.exitCode = 2;
  }
}
module.exports = { buildCases, shuffled, validateCli, normalize, assertManifest, assertSlot, prepare, run, FAMILY, TOTAL_MICRO, CAPS };
if (require.main === module) {
  const workspace = process.cwd();
  if (process.argv[2] === '--prepare') { try { const m = prepare(workspace, process.argv[3]); console.log(JSON.stringify({ family: m.family, cases: m.cases.map(c => ({ id: c.id, name: c.brief.child.name, companion: c.brief.companion.name, spreads: c.brief.beats })), providerDispatches: 0 })); } catch (e) { console.error(e.message); process.exitCode = 1; } }
  else if (process.argv[2] === '--execute-approved') run(workspace).catch(e => { console.error(e.message); process.exitCode = 1; });
  else { console.error('cohort_explicit_mode_required'); process.exitCode = 1; }
}
