import fs from 'node:fs';

import {
  prepareCandidateCoverCorrection,
  type CoverVisibleRecurringPropOperation,
} from '@/lib/visual-package/visualContractCandidateCoverCorrection';

interface PrepareRequest {
  repoRoot: string;
  storyKey: string;
  storyPath: string;
  candidatePath: string;
  candidateValidationAttestationPath: string;
  operations: CoverVisibleRecurringPropOperation[];
}

const ALLOWED_FLAGS = new Set(['--request', '--out', '--write']);

function usage(): string {
  return [
    'QA Wizard Candidate cover semantic correction:',
    '  prepare --request <json> --out <repo-relative-dir> --write true|false',
    '',
    'This offline entrypoint cannot approve, invoke a provider, render, publish, qualify the Wizard, or deploy.',
  ].join('\n');
}

function parseFlags(tokens: string[]): Map<string, string> {
  if (tokens.length % 2 !== 0) throw new Error('invalid_arguments');
  const values = new Map<string, string>();
  for (let index = 0; index < tokens.length; index += 2) {
    const flag = tokens[index];
    const value = tokens[index + 1];
    if (
      !flag?.startsWith('--') ||
      flag.includes('=') ||
      !ALLOWED_FLAGS.has(flag) ||
      !value ||
      value.startsWith('--') ||
      values.has(flag)
    ) {
      throw new Error('invalid_arguments');
    }
    values.set(flag, value);
  }
  return values;
}

function required(flags: ReadonlyMap<string, string>, key: string): string {
  const value = flags.get(key);
  if (!value) throw new Error('invalid_arguments');
  return value;
}

function writeValue(flags: ReadonlyMap<string, string>): boolean {
  const value = required(flags, '--write');
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('invalid_arguments');
}

function readRequest(filePath: string): PrepareRequest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  } catch {
    throw new Error('request_invalid');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('request_invalid');
  }
  const value = parsed as Record<string, unknown>;
  const expected = [
    'repoRoot',
    'storyKey',
    'storyPath',
    'candidatePath',
    'candidateValidationAttestationPath',
    'operations',
  ];
  if (
    JSON.stringify(Object.keys(value).sort()) !==
      JSON.stringify(expected.sort()) ||
    typeof value.repoRoot !== 'string' ||
    typeof value.storyKey !== 'string' ||
    typeof value.storyPath !== 'string' ||
    typeof value.candidatePath !== 'string' ||
    typeof value.candidateValidationAttestationPath !== 'string' ||
    !Array.isArray(value.operations)
  ) {
    throw new Error('request_invalid');
  }
  return value as unknown as PrepareRequest;
}

function main(): void {
  const [command, ...tokens] = process.argv.slice(2);
  if (command !== 'prepare') {
    process.stderr.write(`${usage()}\n`);
    process.exitCode = 1;
    return;
  }
  try {
    const flags = parseFlags(tokens);
    const request = readRequest(required(flags, '--request'));
    const result = prepareCandidateCoverCorrection({
      ...request,
      outputDir: required(flags, '--out'),
      write: writeValue(flags),
    });
    process.stdout.write(`${JSON.stringify({
      status: writeValue(flags)
        ? 'candidate_cover_correction_review_written'
        : 'candidate_cover_correction_review_preview_ready',
      plan: {
        digest: result.plan.digest,
        path: result.artifacts.plan.path,
      },
      correction: {
        digest: result.correction.digest,
        effectiveTemplateDigest:
          result.correction.effective.templateDigest,
        path: result.artifacts.correction.path,
      },
      review: {
        digest: result.review.digest,
        path: result.artifacts.review.path,
        markdownPath: result.artifacts.markdown.path,
        decision: result.review.decision,
        readyForExactProductReview:
          result.review.readyForExactProductReview,
      },
      boundaryEvidence: {
        credentialAccess: 'none',
        providerCalls: 0,
        imageCalls: 0,
        networkCalls: 0,
        databaseWrites: 0,
        productionWrites: 0,
      },
    }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'candidate_cover_correction_failed'}\n`,
    );
    process.exitCode = 1;
  }
}

main();
