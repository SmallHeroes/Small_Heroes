import {
  canonicalLiveExecutionCliRejection,
  canonicalLiveExecutionExitDisposition,
  runCanonicalLiveExecution,
  verifyCanonicalLiveExecution,
} from '@/lib/visual-package';
import {
  canonicalLiveAuthoringJsonBytes,
} from '@/lib/visual-package/canonicalLiveAuthoringArtifacts';

function output(value: unknown): void {
  process.stdout.write(canonicalLiveAuthoringJsonBytes(value));
}

function parseArguments(tokens: string[]): {
  mode: 'live' | 'verify';
  repoRoot: string;
  requestPath: string;
} | null {
  const [mode, ...flags] = tokens;
  if (mode !== 'verify' && mode !== 'live') return null;
  if (flags.length !== 4) return null;
  const values = new Map<string, string>();
  for (let index = 0; index < flags.length; index += 2) {
    const flag = flags[index];
    const value = flags[index + 1];
    if (
      (flag !== '--repo-root' && flag !== '--request') ||
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
  const requestPath = values.get('--request');
  return repoRoot && requestPath
    ? { mode, repoRoot, requestPath }
    : null;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const parsed = parseArguments(argv);
  if (!parsed) {
    output(
      canonicalLiveExecutionCliRejection(
        argv[0] === 'live' ? 'live' : 'verify',
      ),
    );
    process.exitCode = 1;
    return;
  }
  if (parsed.mode === 'verify') {
    const readiness = verifyCanonicalLiveExecution({
      repoRoot: parsed.repoRoot,
      requestPath: parsed.requestPath,
    });
    output(readiness);
    process.exitCode = readiness.status === 'ready' ? 0 : 1;
    return;
  }
  const result = await runCanonicalLiveExecution({
    repoRoot: parsed.repoRoot,
    requestPath: parsed.requestPath,
  });
  output(result);
  const disposition =
    canonicalLiveExecutionExitDisposition(result);
  if (disposition.kind === 'signal') {
    process.kill(process.pid, disposition.signal);
  } else {
    process.exitCode = disposition.exitCode;
  }
}

const requestedMode =
  process.argv.slice(2)[0] === 'live' ? 'live' : 'verify';

main().catch(() => {
  output(canonicalLiveExecutionCliRejection(requestedMode));
  process.exitCode = 1;
});
