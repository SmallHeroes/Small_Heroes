import {
  canonicalLiveAuthoringJsonBytes,
} from '@/lib/visual-package/canonicalLiveAuthoringArtifacts';
import {
  canonicalMaterializationInputWriteRejection,
  writeCanonicalMaterializationInput,
  type CanonicalLiveExecutionRequestInputWrite,
  type CanonicalMaterializationInputWrite,
  type SourceAuthoringLiveRequestInputWrite,
} from '@/lib/visual-package/canonicalMaterializationInputWriter';

const SOURCE_MODE =
  'source-authoring-live-request' as const;
const EXECUTION_MODE =
  'canonical-live-execution-request' as const;

const SOURCE_FLAGS = new Set([
  '--repo-root',
  '--out',
  '--story-key',
  '--story-path',
  '--request-id',
  '--requested-at',
]);
const EXECUTION_FLAGS = new Set([
  '--repo-root',
  '--out',
  '--request-id',
  '--requested-at',
  '--manifest-path',
  '--materialization-output-dir',
  '--preserve',
  '--expected-absence',
  '--credential-source-path',
]);
const REPEATED_EXECUTION_FLAGS = new Set([
  '--preserve',
  '--expected-absence',
]);

function output(value: unknown): void {
  process.stdout.write(canonicalLiveAuthoringJsonBytes(value));
}

function singleValue(
  values: ReadonlyMap<string, readonly string[]>,
  flag: string,
): string | null {
  const entries = values.get(flag);
  return entries?.length === 1 ? entries[0]! : null;
}

function parseFlagValues(args: {
  tokens: string[];
  allowed: ReadonlySet<string>;
  repeated: ReadonlySet<string>;
}): Map<string, string[]> | null {
  if (args.tokens.length % 2 !== 0) return null;
  const values = new Map<string, string[]>();
  for (
    let index = 0;
    index < args.tokens.length;
    index += 2
  ) {
    const flag = args.tokens[index];
    const value = args.tokens[index + 1];
    if (
      !flag ||
      !value ||
      !flag.startsWith('--') ||
      flag.includes('=') ||
      !args.allowed.has(flag) ||
      value.startsWith('--')
    ) {
      return null;
    }
    const existing = values.get(flag) ?? [];
    if (
      (!args.repeated.has(flag) && existing.length > 0) ||
      existing.includes(value)
    ) {
      return null;
    }
    existing.push(value);
    values.set(flag, existing);
  }
  return values;
}

function parseSource(tokens: string[]): SourceAuthoringLiveRequestInputWrite | null {
  const values = parseFlagValues({
    tokens,
    allowed: SOURCE_FLAGS,
    repeated: new Set(),
  });
  if (!values || values.size !== SOURCE_FLAGS.size) {
    return null;
  }
  const repoRoot = singleValue(values, '--repo-root');
  const outputDir = singleValue(values, '--out');
  const storyKey = singleValue(values, '--story-key');
  const storyPath = singleValue(values, '--story-path');
  const requestId = singleValue(values, '--request-id');
  const requestedAt = singleValue(values, '--requested-at');
  if (
    !repoRoot ||
    !outputDir ||
    !storyKey ||
    !storyPath ||
    !requestId ||
    !requestedAt
  ) {
    return null;
  }
  return {
    mode: SOURCE_MODE,
    repoRoot,
    outputDir,
    storyKey,
    storyPath,
    requestId,
    requestedAt,
  };
}

function parseExecution(
  tokens: string[],
): CanonicalLiveExecutionRequestInputWrite | null {
  const values = parseFlagValues({
    tokens,
    allowed: EXECUTION_FLAGS,
    repeated: REPEATED_EXECUTION_FLAGS,
  });
  if (!values || values.size !== EXECUTION_FLAGS.size) {
    return null;
  }
  const repoRoot = singleValue(values, '--repo-root');
  const outputDir = singleValue(values, '--out');
  const requestId = singleValue(values, '--request-id');
  const requestedAt = singleValue(values, '--requested-at');
  const manifestPath = singleValue(values, '--manifest-path');
  const materializationOutputDir = singleValue(
    values,
    '--materialization-output-dir',
  );
  const credentialSourcePath = singleValue(
    values,
    '--credential-source-path',
  );
  const preservationPaths = values.get('--preserve');
  const expectedAbsentPaths = values.get(
    '--expected-absence',
  );
  if (
    !repoRoot ||
    !outputDir ||
    !requestId ||
    !requestedAt ||
    !manifestPath ||
    !materializationOutputDir ||
    !credentialSourcePath ||
    !preservationPaths?.length ||
    !expectedAbsentPaths?.length
  ) {
    return null;
  }
  return {
    mode: EXECUTION_MODE,
    repoRoot,
    outputDir,
    requestId,
    requestedAt,
    manifestPath,
    materializationOutputDir,
    preservationPaths,
    expectedAbsentPaths,
    credentialSourcePath,
  };
}

export function parseCanonicalMaterializationInputArguments(
  tokens: string[],
): CanonicalMaterializationInputWrite | null {
  const [mode, ...flags] = tokens;
  if (mode === SOURCE_MODE) return parseSource(flags);
  if (mode === EXECUTION_MODE) return parseExecution(flags);
  return null;
}

function main(): void {
  const parsed = parseCanonicalMaterializationInputArguments(
    process.argv.slice(2),
  );
  if (!parsed) {
    output(
      canonicalMaterializationInputWriteRejection(
        'canonical_materialization_input_write_cli_rejected',
      ),
    );
    process.exitCode = 1;
    return;
  }
  try {
    output(writeCanonicalMaterializationInput(parsed));
    process.exitCode = 0;
  } catch (error) {
    output(canonicalMaterializationInputWriteRejection(error));
    process.exitCode = 1;
  }
}

try {
  main();
} catch {
  output(canonicalMaterializationInputWriteRejection());
  process.exitCode = 1;
}
