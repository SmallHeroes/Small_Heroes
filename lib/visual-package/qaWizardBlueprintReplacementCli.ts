/**
 * Strict, hermetic operator CLI for the orphan-claim replacement lane.
 *
 * This module is a pure argument parser plus a thin dispatcher onto the
 * replacement lifecycle. It performs no provider, network or credential access
 * of its own; `execute-replacement` stays provider-unreachable unless the exact
 * approved authorization and matching preflight resolve inside the lifecycle.
 *
 * Parsing is deliberately unforgiving: only the `--name value` form is
 * accepted (never `--name=value`), unknown/duplicate/positional tokens are
 * rejected, and each command declares an exact flag set. Output is a single
 * sanitized JSON line on success; errors are a single bounded, sanitized line
 * on stderr with a non-zero exit. Raw exceptions and provider data never reach
 * the caller.
 */

import {
  approveBlueprintReplacementProposal,
  executeBlueprintReplacementLiveRequest,
  prepareBlueprintReplacementProposal,
  reviewBlueprintReplacementProposal,
} from './qaWizardBlueprintAuthoringLifecycle';
import { QA_WIZARD_BLUEPRINT_REPLACEMENT_APPROVER } from './qaWizardBlueprintReplacementAuthority';

export type BlueprintReplacementCliCommand =
  | 'prepare-replacement'
  | 'review-replacement'
  | 'approve-replacement'
  | 'execute-replacement';

interface FlagSpec {
  readonly value: readonly string[];
  readonly boolean: readonly string[];
  readonly optional: readonly string[];
}

const COMMAND_FLAGS: Record<BlueprintReplacementCliCommand, FlagSpec> = {
  'prepare-replacement': {
    value: [
      '--repo-root',
      '--preflight-manifest',
      '--output-dir',
      '--reason',
      '--prepared-by',
      '--prepared-at',
    ],
    boolean: ['--write'],
    optional: ['--write'],
  },
  'review-replacement': {
    value: [
      '--repo-root',
      '--proposal-path',
      '--proposal-digest',
      '--reviewed-by',
      '--reviewed-at',
      '--note',
    ],
    boolean: ['--write'],
    optional: ['--note', '--write'],
  },
  'approve-replacement': {
    value: [
      '--repo-root',
      '--proposal-path',
      '--proposal-digest',
      '--review-path',
      '--review-digest',
      '--approved-by',
      '--approved-at',
      '--note',
    ],
    boolean: ['--write'],
    optional: ['--note', '--write'],
  },
  'execute-replacement': {
    value: [
      '--repo-root',
      '--authorization-path',
      '--authorization-digest',
      '--preflight-manifest',
      '--output-dir',
    ],
    boolean: ['--write'],
    optional: ['--write'],
  },
};

const COMMANDS = Object.keys(COMMAND_FLAGS) as BlueprintReplacementCliCommand[];

export interface ParsedBlueprintReplacementCli {
  command: BlueprintReplacementCliCommand;
  values: Map<string, string>;
  flags: Set<string>;
}

class CliUsageError extends Error {}

const SANITIZE = /[^A-Za-z0-9 _."'/:@?()\-]+/g;

function sanitize(message: string): string {
  return message.replace(SANITIZE, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
}

/**
 * Strictly parse argv (already stripped of node/script) into a command and its
 * exact flags. Throws `CliUsageError` on any ambiguity.
 */
export function parseBlueprintReplacementCliArgs(
  argv: readonly string[],
): ParsedBlueprintReplacementCli {
  if (argv.length === 0) {
    throw new CliUsageError('a command is required');
  }
  const [command, ...rest] = argv;
  if (!COMMANDS.includes(command as BlueprintReplacementCliCommand)) {
    throw new CliUsageError(`unknown command "${command}"`);
  }
  const spec = COMMAND_FLAGS[command as BlueprintReplacementCliCommand];
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
    if (!known.has(token)) {
      throw new CliUsageError(`unknown flag "${token}"`);
    }
    if (seen.has(token)) {
      throw new CliUsageError(`duplicate flag "${token}"`);
    }
    seen.add(token);
    if (spec.boolean.includes(token)) {
      flags.add(token);
      continue;
    }
    const next = rest[index + 1];
    if (next === undefined || next.startsWith('--')) {
      throw new CliUsageError(`flag "${token}" requires a value`);
    }
    values.set(token, next);
    index += 1;
  }
  const missing = spec.value.filter(
    (flag) => !spec.optional.includes(flag) && !values.has(flag),
  );
  if (missing.length > 0) {
    throw new CliUsageError(`missing required flag(s): ${missing.join(', ')}`);
  }
  return { command: command as BlueprintReplacementCliCommand, values, flags };
}

function dispatch(parsed: ParsedBlueprintReplacementCli): Record<string, unknown> {
  const v = (flag: string): string => {
    const value = parsed.values.get(flag);
    if (value === undefined) throw new CliUsageError(`missing value for ${flag}`);
    return value;
  };
  const optional = (flag: string): string | undefined => parsed.values.get(flag);
  const write = parsed.flags.has('--write');
  switch (parsed.command) {
    case 'prepare-replacement': {
      const result = prepareBlueprintReplacementProposal({
        repoRoot: v('--repo-root'),
        preflightManifestPath: v('--preflight-manifest'),
        outputDir: v('--output-dir'),
        reason: v('--reason'),
        preparedBy: v('--prepared-by'),
        preparedAt: v('--prepared-at'),
        write,
      });
      return {
        command: parsed.command,
        proposalPath: result.proposalPath,
        proposalDigest: result.proposal.digest,
        wrote: result.wrote,
      };
    }
    case 'review-replacement': {
      const result = reviewBlueprintReplacementProposal({
        repoRoot: v('--repo-root'),
        proposalPath: v('--proposal-path'),
        proposalDigest: v('--proposal-digest'),
        reviewedBy: v('--reviewed-by'),
        reviewedAt: v('--reviewed-at'),
        write,
        ...(optional('--note') ? { note: optional('--note')! } : {}),
      });
      return {
        command: parsed.command,
        reviewPath: result.reviewPath,
        reviewDigest: result.review.digest,
        wrote: result.wrote,
      };
    }
    case 'approve-replacement': {
      const approvedBy = v('--approved-by');
      if (approvedBy !== QA_WIZARD_BLUEPRINT_REPLACEMENT_APPROVER) {
        throw new CliUsageError(
          `--approved-by must be "${QA_WIZARD_BLUEPRINT_REPLACEMENT_APPROVER}"`,
        );
      }
      const result = approveBlueprintReplacementProposal({
        repoRoot: v('--repo-root'),
        proposalPath: v('--proposal-path'),
        proposalDigest: v('--proposal-digest'),
        reviewPath: v('--review-path'),
        reviewDigest: v('--review-digest'),
        approvedBy: QA_WIZARD_BLUEPRINT_REPLACEMENT_APPROVER,
        approvedAt: v('--approved-at'),
        write,
        ...(optional('--note') ? { note: optional('--note')! } : {}),
      });
      return {
        command: parsed.command,
        authorizationPath: result.authorizationPath,
        authorizationDigest: result.authorization.digest,
        successorExecutionDigest: result.successorExecutionDigest,
        wrote: result.wrote,
      };
    }
    case 'execute-replacement': {
      if (!write) {
        throw new CliUsageError('execute-replacement requires --write');
      }
      // No providerFactory is supplied: the lifecycle stays provider-unreachable
      // unless the exact authorization and preflight resolve, and any real
      // provider access is the operator's responsibility outside tests.
      // The promise is intentionally not awaited by the parser tests.
      throw new CliUsageError(
        'execute-replacement runs the paid successor; invoke runBlueprintReplacementCliAsync',
      );
    }
    default: {
      throw new CliUsageError('unknown command');
    }
  }
}

export interface BlueprintReplacementCliIo {
  argv: readonly string[];
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
}

/**
 * Synchronous entry for every command except `execute-replacement` (which is
 * paid and asynchronous). Returns a process exit code and never throws.
 */
export function runBlueprintReplacementCli(io: BlueprintReplacementCliIo): number {
  const out = io.stdout ?? ((line: string) => process.stdout.write(`${line}\n`));
  const err = io.stderr ?? ((line: string) => process.stderr.write(`${line}\n`));
  let parsed: ParsedBlueprintReplacementCli;
  try {
    parsed = parseBlueprintReplacementCliArgs(io.argv);
  } catch (cause) {
    err(`error: ${sanitize(cause instanceof Error ? cause.message : 'invalid arguments')}`);
    return 2;
  }
  try {
    const result = dispatch(parsed);
    out(JSON.stringify(result));
    return 0;
  } catch (cause) {
    err(`error: ${sanitize(cause instanceof Error ? cause.message : 'operation failed')}`);
    return 1;
  }
}

/**
 * Async entry that also runs `execute-replacement`. Kept separate so the
 * synchronous surface and its tests never touch the paid boundary.
 */
export async function runBlueprintReplacementCliAsync(
  io: BlueprintReplacementCliIo,
): Promise<number> {
  const out = io.stdout ?? ((line: string) => process.stdout.write(`${line}\n`));
  const err = io.stderr ?? ((line: string) => process.stderr.write(`${line}\n`));
  let parsed: ParsedBlueprintReplacementCli;
  try {
    parsed = parseBlueprintReplacementCliArgs(io.argv);
  } catch (cause) {
    err(`error: ${sanitize(cause instanceof Error ? cause.message : 'invalid arguments')}`);
    return 2;
  }
  if (parsed.command !== 'execute-replacement') {
    return runBlueprintReplacementCli(io);
  }
  const v = (flag: string): string => parsed.values.get(flag)!;
  if (!parsed.flags.has('--write')) {
    err('error: execute-replacement requires --write');
    return 2;
  }
  try {
    const result = await executeBlueprintReplacementLiveRequest({
      repoRoot: v('--repo-root'),
      authorizationPath: v('--authorization-path'),
      authorizationDigest: v('--authorization-digest'),
      preflightManifestPath: v('--preflight-manifest'),
      outputDir: v('--output-dir'),
      write: true,
    });
    out(
      JSON.stringify({
        command: parsed.command,
        replayed: result.replayed,
        stage: result.manifest.stage,
        manifestPath: result.manifestPath,
        claimPath: result.claimPath,
        executionRecordPath: result.executionRecordPath,
      }),
    );
    return 0;
  } catch (cause) {
    err(`error: ${sanitize(cause instanceof Error ? cause.message : 'operation failed')}`);
    return 1;
  }
}
