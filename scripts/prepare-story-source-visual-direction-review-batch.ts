#!/usr/bin/env tsx
/**
 * Zero-cost R3-B0b review-batch preparation.
 *
 * This command only validates committed local authority and optionally writes
 * one immutable content-addressed JSON review artifact beneath outputs/.
 */
import {
  DEFAULT_STORY_SOURCE_VISUAL_DIRECTION_REVIEW_OUTPUT_ROOT,
  DEFAULT_STORY_SOURCE_VISUAL_DIRECTION_REVIEW_REQUEST_PATH,
  prepareStorySourceVisualDirectionReviewBatch,
} from '@/lib/visual-package/storySourceVisualDirectionReviewBatch';

interface Options {
  requestPath: string;
  outputRoot: string;
  write: boolean;
}

function usage(): string {
  return [
    'Story Source / Visual Direction review-batch preparation:',
    '  npm run prepare-story-source-visual-review-batch -- prepare [--request <repo-relative-json>] [--output-root <outputs/...>] [--write true|false]',
    'Defaults to dry-run. This surface has no runtime or provider action.',
  ].join('\n');
}

function requireValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value) throw new Error(`${flag} requires a value`);
  return value;
}

function parseArgs(argv: readonly string[]): Options {
  if (argv[0] === '--help' || argv[0] === 'help') {
    process.stdout.write(`${usage()}\n`);
    process.exit(0);
  }
  if (argv[0] !== 'prepare') {
    throw new Error(`the only supported command is prepare\n${usage()}`);
  }
  const options: Options = {
    requestPath: DEFAULT_STORY_SOURCE_VISUAL_DIRECTION_REVIEW_REQUEST_PATH,
    outputRoot: DEFAULT_STORY_SOURCE_VISUAL_DIRECTION_REVIEW_OUTPUT_ROOT,
    write: false,
  };
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--request') {
      options.requestPath = requireValue(argv, index, token);
      index += 1;
      continue;
    }
    if (token === '--output-root') {
      options.outputRoot = requireValue(argv, index, token);
      index += 1;
      continue;
    }
    if (token === '--write') {
      const value = requireValue(argv, index, token);
      if (value !== 'true' && value !== 'false') {
        throw new Error('--write must be exactly true or false');
      }
      options.write = value === 'true';
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${token}\n${usage()}`);
  }
  return options;
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const prepared = prepareStorySourceVisualDirectionReviewBatch({
    repoRoot: process.cwd(),
    requestPath: options.requestPath,
    outputRoot: options.outputRoot,
    write: options.write,
  });
  process.stdout.write(`${JSON.stringify({
    version: prepared.batch.version,
    status: prepared.batch.status,
    runtimeEligible: prepared.batch.runtimeEligible,
    digest: prepared.batch.digest,
    candidateCount: prepared.batch.selection.candidateCount,
    directionCounts: prepared.batch.selection.directionCounts,
    totalPageCount: prepared.batch.selection.totalPageCount,
    artifact: prepared.artifact,
    effects: prepared.batch.effects,
  }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
