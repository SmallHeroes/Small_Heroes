/** Explicit operator CLI: synthetic text-only proof; no orders/images/source publication. */
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve, relative, isAbsolute } from 'path';
import { resolvePersonalWizardOptions } from '../lib/personal-wizard/options';
import { preparePersonalStory, writePersonalStory, StoryWriterError } from '../lib/personal-wizard/story-writer';
import { createPersonalStoryProvider } from '../lib/personal-wizard/story-openai';
import { resolveStorySettings, STORY_LIMITS } from '../lib/personal-wizard/story-config';
import { readIntakeApiKey } from '../lib/personal-wizard/intake-config';
import { IntakeLedger } from '../lib/personal-wizard/intake-ledger';

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 3 || args[0] !== '--live') throw new Error('usage: --live request.json output-directory');
  const outputRoot = resolve(process.cwd(), 'outputs');
  const output = resolve(args[2]);
  const boundary = relative(outputRoot, output);
  if (!boundary || boundary.startsWith('..') || isAbsolute(boundary)) throw new Error('output_must_be_child_of_outputs');
  const prepared = preparePersonalStory(JSON.parse(readFileSync(resolve(args[1]), 'utf8')), resolvePersonalWizardOptions());
  const settings = resolveStorySettings();
  if (!settings) throw new Error('writer_settings_required');
  // Reject an existing output root BEFORE paid calls. No overwrite/replay can re-bill this root.
  mkdirSync(outputRoot, { recursive: true });
  mkdirSync(output, { recursive: false });
  const apiKey = readIntakeApiKey();
  if (!apiKey) throw new Error('existing_key_unavailable');
  const startedAt = new Date().toISOString();
  const signal = AbortSignal.timeout(STORY_LIMITS.timeoutMs);
  let receipt: unknown = null;
  try {
    const result = await writePersonalStory({ prepared, userId: 'explicit-local-operator', jobId: 's_singlepreview0001', settings, ledger: new IntakeLedger(), signal, provider: () => {
      const actual = createPersonalStoryProvider(apiKey, settings.model);
      return { generate: async (call, signal) => {
        const response = await actual.generate(call, signal);
        // This is adapter-normalised output, NOT the raw response (numbering is engine-owned).
        writeFileSync(resolve(output, `${call.stage}-engine-output.json`), JSON.stringify(response, null, 2) + '\n', { flag: 'wx' });
        return response;
      } };
    }, record: (entry) => { receipt = entry; } });
    writeFileSync(resolve(output, 'result.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
    writeFileSync(resolve(output, 'story.md'), `# ${result.manuscript.title}\n\n` + result.manuscript.pages.map((page) => `## כפולה ${page.pageNumber}\n\n${page.text}`).join('\n\n') + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ status: result.status, requestId: result.requestId, beats: result.manuscript.pages.length, runtimeEligible: false, accounting: result.accounting }));
  } catch (error) {
    console.error(error instanceof StoryWriterError ? error.code : 'preview_failed');
    process.exitCode = 1;
  } finally {
    writeFileSync(resolve(output, 'receipt.json'), JSON.stringify({ startedAt, endedAt: new Date().toISOString(), scope: 'explicit_local_text_only_trial_not_customer_release', receipt }, null, 2) + '\n', { flag: 'wx' });
  }
}
main().catch(() => { console.error('preview_setup_failed'); process.exitCode = 1; });
