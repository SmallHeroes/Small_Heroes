import {
  canonicalLiveExecutionRequestMaterializationRejection,
  materializeCanonicalLiveExecutionRequest,
} from '@/lib/visual-package/liveExecutionRequestMaterialization';
import {
  canonicalLiveAuthoringJsonBytes,
} from '@/lib/visual-package/canonicalLiveAuthoringArtifacts';

function output(value: unknown): void {
  process.stdout.write(canonicalLiveAuthoringJsonBytes(value));
}

function parseArguments(tokens: string[]): {
  repoRoot: string;
  inputPath: string;
} | null {
  if (tokens.length !== 4) return null;
  const values = new Map<string, string>();
  for (let index = 0; index < tokens.length; index += 2) {
    const flag = tokens[index];
    const value = tokens[index + 1];
    if (
      (flag !== '--repo-root' && flag !== '--input') ||
      flag.includes('=') ||
      values.has(flag) ||
      !value ||
      value.startsWith('--')
    ) {
      return null;
    }
    values.set(flag, value);
  }
  const repoRoot = values.get('--repo-root');
  const inputPath = values.get('--input');
  return repoRoot && inputPath
    ? { repoRoot, inputPath }
    : null;
}

function main(): void {
  const parsed = parseArguments(process.argv.slice(2));
  if (!parsed) {
    output(
      canonicalLiveExecutionRequestMaterializationRejection(
        'execution_request_materialization_cli_arguments_invalid',
      ),
    );
    process.exitCode = 1;
    return;
  }
  try {
    const result = materializeCanonicalLiveExecutionRequest({
      repoRoot: parsed.repoRoot,
      inputPath: parsed.inputPath,
    });
    output(result);
    process.exitCode = 0;
  } catch (error) {
    output(
      canonicalLiveExecutionRequestMaterializationRejection(error),
    );
    process.exitCode = 1;
  }
}

try {
  main();
} catch {
  output(canonicalLiveExecutionRequestMaterializationRejection());
  process.exitCode = 1;
}
