/** Offline operator adapter: no provider factory, credential access, render or approval. */
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { resolvePersonalWizardOptions } from '../lib/personal-wizard/options';
import { preparePersonalStoryboard, compilePersonalStoryboard, personalStoryboardReviewInput,
  storyboardReviewDisposition, personalStoryboardFrame } from '../lib/personal-wizard/storyboard';

function readJson(file: string): unknown {
  const bytes = readFileSync(resolve(file));
  if (bytes.length > 256_000) throw Error('personal_storyboard_input_limit');
  return JSON.parse(bytes.toString('utf8'));
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 5) throw Error('personal_storyboard_usage');
  const root = realpathSync(process.cwd());
  const outputs = join(root, 'outputs');
  const output = resolve(args[4]);
  // One new direct child; no traversal, absolute escape, symlink/junction or overwrite.
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(relative(outputs, output)) || existsSync(output) ||
      (existsSync(outputs) && (lstatSync(outputs).isSymbolicLink() || !lstatSync(outputs).isDirectory()))) {
    throw Error('personal_storyboard_output_boundary');
  }
  const options = resolvePersonalWizardOptions(root);
  const request = readJson(args[0]);
  const writerResult = readJson(args[1]);
  const source = preparePersonalStoryboard(request, writerResult, options);
  const book = compilePersonalStoryboard(source, readJson(args[2]));
  const rawReview = args[3] === '-' ? null : readJson(args[3]);
  const decision = rawReview === null ? null : storyboardReviewDisposition(book, rawReview);
  const packets = decision?.disposition === 'review_supported'
    ? Array.from({ length: book.narrativeSpreads + 1 }, (_, pageNumber) =>
      personalStoryboardFrame(book, rawReview, pageNumber, { request, writerResult, options })) : [];
  // All validation occurs before creating output. Local operator execution only;
  // this is not a hostile multi-user filesystem/concurrent-write service.
  mkdirSync(outputs, { recursive: true });
  mkdirSync(output, { recursive: false });
  const write = (name: string, value: unknown) => writeFileSync(join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  write('planning-input.json', source.planningInput);
  write('storyboard.json', book);
  write('semantic-review-input.json', personalStoryboardReviewInput(book));
  if (decision) write('semantic-review.json', decision);
  if (packets.length) write('frame-packets.json', packets);
  const status = decision?.disposition ?? 'pending_semantic_review';
  const manifest = { scope: 'offline_personal_storyboard_not_render_authority', status,
    requestId: book.requestId, sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest,
    narrativeSpreads: book.narrativeSpreads, displayPages: book.displayPages,
    framePackets: packets.length, runtimeEligible: false, providerCalls: 0, costUsd: 0,
    storage: 'local_ignored_outputs_no_verified_off_machine_backup' };
  write('manifest.json', manifest);
  console.log(JSON.stringify(manifest));
  if (status !== 'review_supported') process.exitCode = 2;
}

try { main(); } catch (error) {
  // Never print source strings, raw schema errors, filenames, stack or provider errors.
  const message = error instanceof Error ? error.message : '';
  console.error(/^(personal_storyboard_|book_sequence_|continuity_|invalid_|empty_|unknown_|unsupported_|duplicate_|insufficient_|plan_)[a-z_]+$/.test(message)
    ? message : 'personal_storyboard_invalid_input');
  process.exitCode = 1;
}
