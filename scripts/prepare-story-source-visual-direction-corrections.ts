#!/usr/bin/env tsx
/**
 * Zero-cost R3-B1a correction-candidate preparation.
 *
 * This command only validates tracked local authority. It may write one
 * immutable batch artifact or explicitly materialize one selected record.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_STORY_SOURCE_VISUAL_DIRECTION_CORRECTION_OUTPUT_ROOT,
  DEFAULT_STORY_SOURCE_VISUAL_DIRECTION_CORRECTION_PLAN_PATH,
  materializeStorySourceVisualDirectionCorrectionCandidate,
  prepareStorySourceVisualDirectionCorrectionBatch,
} from '@/lib/visual-package/storySourceVisualDirectionCorrectionBatch';

interface Options {
  command: 'materialize-record' | 'prepare';
  planPath: string;
  outputRoot: string;
  write: boolean;
  help: boolean;
  storyKey: string | null;
}

function usage(): string {
  return [
    'Story Source / Visual Direction correction-candidate preparation:',
    '  npm run prepare-story-source-visual-corrections -- prepare [--plan <repo-relative-json>] [--output-root <outputs/...>] [--write true|false]',
    '  npm run prepare-story-source-visual-corrections -- materialize-record --story-key <key> [--plan <repo-relative-json>] [--output-root <outputs/...>] [--write true|false]',
    'Defaults to dry-run. This surface cannot accept, publish, render, or call providers.',
  ].join('\n');
}

function requireValue(
  argv: readonly string[],
  index: number,
  flag: string,
): string {
  const value = argv[index + 1];
  if (!value) throw new Error(`${flag} requires a value`);
  return value;
}

export function parseStorySourceVisualDirectionCorrectionArgs(
  argv: readonly string[],
): Options {
  if (argv[0] === '--help' || argv[0] === 'help') {
    return {
      command: 'prepare',
      planPath: DEFAULT_STORY_SOURCE_VISUAL_DIRECTION_CORRECTION_PLAN_PATH,
      outputRoot: DEFAULT_STORY_SOURCE_VISUAL_DIRECTION_CORRECTION_OUTPUT_ROOT,
      write: false,
      help: true,
      storyKey: null,
    };
  }
  if (argv[0] !== 'prepare' && argv[0] !== 'materialize-record') {
    throw new Error(`supported commands are prepare and materialize-record\n${usage()}`);
  }
  const options: Options = {
    command: argv[0],
    planPath: DEFAULT_STORY_SOURCE_VISUAL_DIRECTION_CORRECTION_PLAN_PATH,
    outputRoot: DEFAULT_STORY_SOURCE_VISUAL_DIRECTION_CORRECTION_OUTPUT_ROOT,
    write: false,
    help: false,
    storyKey: null,
  };
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--plan') {
      options.planPath = requireValue(argv, index, token);
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
    if (token === '--story-key') {
      options.storyKey = requireValue(argv, index, token);
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${token}\n${usage()}`);
  }
  if (
    (options.command === 'materialize-record' && !options.storyKey) ||
    (options.command === 'prepare' && options.storyKey !== null)
  ) {
    throw new Error(`--story-key is required only for materialize-record\n${usage()}`);
  }
  return options;
}

function main(): void {
  const options = parseStorySourceVisualDirectionCorrectionArgs(
    process.argv.slice(2),
  );
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (options.command === 'materialize-record') {
    const materialized = materializeStorySourceVisualDirectionCorrectionCandidate({
      repoRoot: process.cwd(),
      storyKey: options.storyKey!,
      planPath: options.planPath,
      outputRoot: options.outputRoot,
      write: options.write,
    });
    process.stdout.write(`${JSON.stringify(materialized, null, 2)}\n`);
    return;
  }
  const prepared = prepareStorySourceVisualDirectionCorrectionBatch({
    repoRoot: process.cwd(),
    planPath: options.planPath,
    outputRoot: options.outputRoot,
    write: options.write,
  });
  process.stdout.write(
    `${JSON.stringify(
      {
        version: prepared.batch.version,
        status: prepared.batch.status,
        runtimeEligible: prepared.batch.runtimeEligible,
        productionEligible: prepared.batch.productionEligible,
        digest: prepared.batch.digest,
        summary: prepared.batch.summary,
        artifact: prepared.artifact,
        effects: prepared.batch.effects,
      },
      null,
      2,
    )}\n`,
  );
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const modulePath = path.resolve(fileURLToPath(import.meta.url));
const isMainModule =
  invokedPath !== null &&
  (process.platform === 'win32'
    ? invokedPath.toLowerCase() === modulePath.toLowerCase()
    : invokedPath === modulePath);

if (isMainModule) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
