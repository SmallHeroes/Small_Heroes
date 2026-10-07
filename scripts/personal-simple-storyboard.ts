/** Offline replay only. No --live, SDK/client/key factory, authoring, image or paid permission. */
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { resolvePersonalWizardOptions, type PersonalWizardOptions } from '../lib/personal-wizard/options';
import { canonicalJson } from '../lib/personal-wizard/request-acceptance';
import { prepareSimpleStory, simpleAuthorCall, simpleEditorCall } from '../lib/personal-wizard/simple-story-engine';
import { createCurrentSimpleStorySource } from '../lib/personal-wizard/simple-story-source';
import { runSimpleStoryboardDiagnostic, SimpleStoryboardDiagnosticError } from '../lib/personal-wizard/simple-storyboard-diagnostic';
import { textCanonOptions } from './personal-simple-story';

const sourceNames = ['result.json', 'evidence.json', 'author-receipt.json', 'editor-receipt.json',
  'author-instructions.txt', 'editor-instructions.txt', 'author-wire.json', 'editor-wire.json'] as const;
const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const fail = (code: string): never => { throw new SimpleStoryboardDiagnosticError(code); };
const read = (file: string) => {
  const bytes = readFileSync(file);
  if (bytes.length > 2_500_000) fail('file_limit');
  return bytes;
};
const json = (bytes: Buffer): any => JSON.parse(bytes.toString('utf8').replace(/^\ufeff/, ''));

/** Keep exact native bytes plus the locally saved instructions/wire; none is provider attestation. */
export function loadSimpleStoryboardSource(request: unknown, directory: string, options: PersonalWizardOptions) {
  const files = Object.fromEntries(sourceNames.map(name => [name, read(path.join(directory, name))])) as Record<typeof sourceNames[number], Buffer>;
  const generated = { result: json(files['result.json']), evidence: json(files['evidence.json']) };
  const writerResult = createCurrentSimpleStorySource(request, generated,
    { author: json(files['author-receipt.json']), editor: json(files['editor-receipt.json']) }, options);
  const prepared = prepareSimpleStory(request, options, generated.evidence.seed);
  const calls = { author: simpleAuthorCall(prepared), editor: simpleEditorCall(prepared, generated.evidence.draft, generated.evidence.findings) };
  for (const role of ['author', 'editor'] as const) {
    const call = calls[role], wire = json(files[`${role}-wire.json`]);
    if (files[`${role}-instructions.txt`].toString('utf8') !== call.instructions || wire.input !== call.input ||
      wire.outputCap !== call.maxOutputTokens || wire.model !== writerResult.simpleSource[role].model ||
      typeof wire.digest !== 'string' || !/^[a-f0-9]{64}$/.test(wire.digest)) fail('source_wire_binding');
  }
  return { writerResult, files };
}

function parse(argv: string[]) {
  const names = new Set(['--request', '--source-dir', '--storyboard', '--review', '--out']);
  if (argv.length !== names.size * 2) fail('arguments');
  const fields: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!names.delete(argv[i]) || !argv[i + 1] || argv[i + 1].startsWith('--')) fail('arguments');
    fields[argv[i].slice(2)] = argv[i + 1];
  }
  return fields;
}
const exists = (file: string) => {
  try { lstatSync(file); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
};
function outputBoundary(root: string, value: string) {
  const outputs = path.join(root, 'outputs'), output = path.resolve(root, value), name = path.relative(outputs, output);
  if (!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name) || exists(output) ||
    (exists(outputs) && (lstatSync(outputs).isSymbolicLink() || !lstatSync(outputs).isDirectory()))) fail('output_boundary');
  return { outputs, output };
}
const safeCode = (error: unknown) => {
  const message = error instanceof Error ? error.message : '';
  return /^(simple_storyboard_diagnostic_|simple_story_source_|personal_storyboard_)[a-z_]+$/.test(message)
    ? message : 'simple_storyboard_diagnostic_invalid_input';
};

/** All validation before any output. Local trusted-operator filesystem, not a hostile concurrent-write service. */
export async function main(argv: string[], deps: { root?: string; options?: PersonalWizardOptions; log?: (line: string) => void } = {}) {
  const log = deps.log ?? ((line: string) => console.log(line));
  let a: Record<string, string>;
  try { a = parse(argv); } catch (error) { log(safeCode(error)); return 3; }
  try {
    const root = realpathSync(deps.root ?? process.cwd()), boundary = outputBoundary(root, a.out);
    const options = textCanonOptions(deps.options ?? resolvePersonalWizardOptions(root));
    const requestBytes = read(path.resolve(root, a.request)), request = json(requestBytes);
    const loaded = loadSimpleStoryboardSource(request, path.resolve(root, a['source-dir']), options);
    const draftBytes = read(path.resolve(root, a.storyboard)), reviewBytes = read(path.resolve(root, a.review));
    const draft = json(draftBytes), review = json(reviewBytes);
    const result = await runSimpleStoryboardDiagnostic({ request, writerResult: loaded.writerResult, options,
      signal: new AbortController().signal, generate: async call => structuredClone(call.stage === 'storyboard' ? draft : review) });
    mkdirSync(boundary.outputs, { recursive: true }); mkdirSync(boundary.output);
    const save = (name: string, value: unknown) => writeFileSync(path.join(boundary.output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
    const sourceDir = path.join(boundary.output, 'source'); mkdirSync(sourceDir);
    const originals = { ...loaded.files, 'request.json': requestBytes, 'planner-output.json': draftBytes, 'reviewer-output.json': reviewBytes };
    for (const [name, bytes] of Object.entries(originals)) writeFileSync(path.join(sourceDir, name), bytes, { flag: 'wx' });
    save('effective-options.json', options); save('source-envelope.json', loaded.writerResult);
    save('storyboard.json', result.storyboard); save('calls.json', result.calls);
    save('semantic-review-input.json', JSON.parse(result.calls[1].input)); save('semantic-review.json', result.review);
    if (result.framePackets.length) save('frame-packets.json', result.framePackets);
    const manifest = { version: result.version, mode: 'offline_saved_outputs_replay', status: result.status,
      sourceDigest: result.sourceDigest, storyboardDigest: result.storyboardDigest, optionsFingerprint: options.fingerprint,
      narrativeSpreads: result.storyboard.narrativeSpreads, framePackets: result.framePackets.length,
      runtimeEligible: false, providerCalls: 0, costUsd: 0, replayCallbackInvocations: result.calls.length,
      costScope: 'this_offline_replay_only_not_prior_writing_or_supplied_model_outputs',
      measurementScope: result.measurementScope,
      originalFileHashes: Object.fromEntries(Object.entries(originals).map(([name, bytes]) => [name, sha(bytes)])),
      provenance: 'local_record_and_saved_wire_consistency_not_provider_prompt_or_history_attestation',
      storage: 'local_ignored_outputs_no_verified_off_machine_backup' };
    save('manifest.json', manifest); log(canonicalJson(manifest));
    return result.status === 'review_supported' ? 0 : 2;
  } catch (error) { log(safeCode(error)); return 1; }
}

if (require.main === module) main(process.argv.slice(2)).then(code => { process.exitCode = code; },
  () => { console.error('simple_storyboard_diagnostic_failed'); process.exitCode = 1; });
