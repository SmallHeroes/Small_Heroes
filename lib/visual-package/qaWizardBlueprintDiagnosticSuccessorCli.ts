/**
 * Strict operator CLI for the one-shot failed-terminal diagnostic successor.
 * Unknown, duplicate, positional and `--name=value` arguments are rejected.
 * The execute command is the only paid boundary and requires an exact persisted
 * Guy authorization plus `--write` before the lifecycle can load a provider.
 */

import {
  authorizeBlueprintDiagnosticSuccessorCandidate,
  executeBlueprintDiagnosticSuccessorLiveRequest,
  prepareBlueprintDiagnosticSuccessorCandidate,
} from './qaWizardBlueprintAuthoringLifecycle';
import { QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_APPROVER } from './qaWizardBlueprintDiagnosticSuccessorAuthority';

export type BlueprintDiagnosticSuccessorCliCommand =
  | 'prepare-diagnostic-successor'
  | 'authorize-diagnostic-successor'
  | 'execute-diagnostic-successor';

interface FlagSpec {
  readonly value: readonly string[];
  readonly boolean: readonly string[];
  readonly optional: readonly string[];
}

const COMMAND_FLAGS: Record<BlueprintDiagnosticSuccessorCliCommand, FlagSpec> = {
  'prepare-diagnostic-successor': {
    value: [
      '--repo-root',
      '--predecessor-terminal-lookup-path',
      '--predecessor-terminal-lookup-digest',
      '--prepared-by',
      '--prepared-at',
    ],
    boolean: ['--write'],
    optional: ['--write'],
  },
  'authorize-diagnostic-successor': {
    value: [
      '--repo-root',
      '--candidate-path',
      '--candidate-digest',
      '--approved-by',
      '--approved-at',
    ],
    boolean: ['--write'],
    optional: ['--write'],
  },
  'execute-diagnostic-successor': {
    value: [
      '--repo-root',
      '--authorization-path',
      '--authorization-digest',
    ],
    boolean: ['--write'],
    optional: [],
  },
};

const COMMANDS = Object.keys(COMMAND_FLAGS) as BlueprintDiagnosticSuccessorCliCommand[];
const SANITIZE = /[^A-Za-z0-9 _."'/:@?()\-]+/g;

class CliUsageError extends Error {}

export interface ParsedBlueprintDiagnosticSuccessorCli {
  command: BlueprintDiagnosticSuccessorCliCommand;
  values: Map<string, string>;
  flags: Set<string>;
}

export interface BlueprintDiagnosticSuccessorCliIo {
  argv: readonly string[];
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
}

function sanitize(message: string): string {
  return message.replace(SANITIZE, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
}

export function parseBlueprintDiagnosticSuccessorCliArgs(
  argv: readonly string[],
): ParsedBlueprintDiagnosticSuccessorCli {
  if (argv.length === 0) throw new CliUsageError('a command is required');
  const [rawCommand, ...rest] = argv;
  if (!COMMANDS.includes(rawCommand as BlueprintDiagnosticSuccessorCliCommand)) {
    throw new CliUsageError(`unknown command "${rawCommand}"`);
  }
  const command = rawCommand as BlueprintDiagnosticSuccessorCliCommand;
  const spec = COMMAND_FLAGS[command];
  const known = new Set([...spec.value, ...spec.boolean]);
  const values = new Map<string, string>();
  const flags = new Set<string>();
  const seen = new Set<string>();
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index]!;
    if (!token.startsWith('--')) {
      throw new CliUsageError(`unexpected positional argument "${token}"`);
    }
    if (token.includes('=')) {
      throw new CliUsageError(
        'flags must use the "--name value" form, not "--name=value"',
      );
    }
    if (!known.has(token)) throw new CliUsageError(`unknown flag "${token}"`);
    if (seen.has(token)) throw new CliUsageError(`duplicate flag "${token}"`);
    seen.add(token);
    if (spec.boolean.includes(token)) {
      flags.add(token);
      continue;
    }
    const value = rest[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new CliUsageError(`flag "${token}" requires a value`);
    }
    values.set(token, value);
    index += 1;
  }
  const missing = spec.value.filter(
    (flag) => !spec.optional.includes(flag) && !values.has(flag),
  );
  if (missing.length > 0) {
    throw new CliUsageError(`missing required flag(s): ${missing.join(', ')}`);
  }
  return { command, values, flags };
}

function runNonExecute(
  parsed: ParsedBlueprintDiagnosticSuccessorCli,
): Record<string, unknown> {
  const value = (flag: string): string => {
    const found = parsed.values.get(flag);
    if (found === undefined) throw new CliUsageError(`missing value for ${flag}`);
    return found;
  };
  const write = parsed.flags.has('--write');
  if (parsed.command === 'prepare-diagnostic-successor') {
    const result = prepareBlueprintDiagnosticSuccessorCandidate({
      repoRoot: value('--repo-root'),
      predecessorTerminalLookupPath: value(
        '--predecessor-terminal-lookup-path',
      ),
      predecessorTerminalLookupDigest: value(
        '--predecessor-terminal-lookup-digest',
      ),
      preparedBy: value('--prepared-by'),
      preparedAt: value('--prepared-at'),
      write,
    });
    return {
      command: parsed.command,
      candidatePath: result.candidatePath,
      candidateDigest: result.candidate.digest,
      evidenceTargetDigest: result.candidate.evidenceTargetDigest,
      wrote: result.wrote,
    };
  }
  if (parsed.command === 'authorize-diagnostic-successor') {
    const approvedBy = value('--approved-by');
    if (approvedBy !== QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_APPROVER) {
      throw new CliUsageError(
        `--approved-by must be exact value ${QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_APPROVER}`,
      );
    }
    const result = authorizeBlueprintDiagnosticSuccessorCandidate({
      repoRoot: value('--repo-root'),
      candidatePath: value('--candidate-path'),
      candidateDigest: value('--candidate-digest'),
      approvedBy: QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_APPROVER,
      approvedAt: value('--approved-at'),
      write,
    });
    return {
      command: parsed.command,
      authorizationPath: result.authorizationPath,
      authorizationDigest: result.authorization.digest,
      successorExecutionDigest: result.successorExecutionDigest,
      wrote: result.wrote,
    };
  }
  throw new CliUsageError(
    'execute-diagnostic-successor must use the asynchronous entrypoint',
  );
}

export async function runBlueprintDiagnosticSuccessorCliAsync(
  io: BlueprintDiagnosticSuccessorCliIo,
): Promise<number> {
  const out = io.stdout ?? ((line: string) => process.stdout.write(`${line}\n`));
  const err = io.stderr ?? ((line: string) => process.stderr.write(`${line}\n`));
  let parsed: ParsedBlueprintDiagnosticSuccessorCli;
  try {
    parsed = parseBlueprintDiagnosticSuccessorCliArgs(io.argv);
  } catch (cause) {
    err(`error: ${sanitize(cause instanceof Error ? cause.message : 'invalid arguments')}`);
    return 2;
  }
  try {
    if (parsed.command !== 'execute-diagnostic-successor') {
      out(JSON.stringify(runNonExecute(parsed)));
      return 0;
    }
    if (!parsed.flags.has('--write')) {
      throw new CliUsageError('execute-diagnostic-successor requires --write');
    }
    const value = (flag: string): string => parsed.values.get(flag)!;
    const result = await executeBlueprintDiagnosticSuccessorLiveRequest({
      repoRoot: value('--repo-root'),
      authorizationPath: value('--authorization-path'),
      authorizationDigest: value('--authorization-digest'),
      write: true,
    });
    out(
      JSON.stringify({
        command: parsed.command,
        replayed: result.replayed,
        stage: result.manifest.stage,
        manifestPath: result.manifestPath,
        receiptPath: result.receiptPath,
        claimPath: result.claimPath,
        executionRecordPath: result.executionRecordPath,
        observabilityCapture: result.manifest.observabilityCapture ?? null,
      }),
    );
    return 0;
  } catch (cause) {
    err(`error: ${sanitize(cause instanceof Error ? cause.message : 'operation failed')}`);
    return cause instanceof CliUsageError ? 2 : 1;
  }
}
