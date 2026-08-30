import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  parseBlueprintReplacementCliArgs,
  runBlueprintReplacementCli,
} from '../qaWizardBlueprintReplacementCli';

const REPO_ROOT = process.cwd();
const SHIM = path.join(REPO_ROOT, 'scripts', 'shims', 'register-server-only.cjs');
const BIN = path.join(
  REPO_ROOT,
  'scripts',
  'qa-wizard-blueprint-replacement-cli.ts',
);
// The tsx CLI entry that the `tsx` bin resolves to. Invoking it under the
// server-only shim is byte-for-byte the process the canonical npm operator
// command (`npm run qa-wizard-blueprint-replacement -- …`, i.e.
// `tsx --require <shim> <bin>`) spawns.
const TSX_CLI = path.join(REPO_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const CANONICAL_NPM_SCRIPT =
  'tsx --require ./scripts/shims/register-server-only.cjs scripts/qa-wizard-blueprint-replacement-cli.ts';

function capture(argv: string[]): {
  code: number;
  out: string[];
  err: string[];
} {
  const out: string[] = [];
  const err: string[] = [];
  const code = runBlueprintReplacementCli({
    argv,
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
  });
  return { code, out, err };
}

function runSubprocess(args: string[]): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  // Exactly mirror the canonical operator command: `tsx --require <shim> <bin>`.
  const result = spawnSync(
    process.execPath,
    [TSX_CLI, '--require', SHIM, BIN, ...args],
    { cwd: REPO_ROOT, encoding: 'utf8', shell: false, windowsHide: true },
  );
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

const PREPARE_REQUIRED = [
  'prepare-replacement',
  '--repo-root',
  '.',
  '--preflight-manifest',
  'outputs/x/blueprint-authoring-manifests/deadbeef.json',
  '--output-dir',
  'outputs/x',
  '--reason',
  'orphan_claim_unknown_provider_outcome',
  '--prepared-by',
  'Codex',
  '--prepared-at',
  '2026-08-26T09:00:00.000Z',
];

describe('QA Wizard Blueprint replacement CLI — strict parser (in-process)', () => {
  it('parses a complete prepare command', () => {
    const parsed = parseBlueprintReplacementCliArgs(PREPARE_REQUIRED);
    expect(parsed.command).toBe('prepare-replacement');
    expect(parsed.values.get('--reason')).toBe(
      'orphan_claim_unknown_provider_outcome',
    );
    expect(parsed.flags.has('--write')).toBe(false);
  });

  it('rejects an unknown command', () => {
    const { code, err } = capture(['not-a-command']);
    expect(code).toBe(2);
    expect(err.join('\n')).toMatch(/unknown command/);
  });

  it('rejects the "--name=value" form', () => {
    const { code, err } = capture(['prepare-replacement', '--repo-root=.']);
    expect(code).toBe(2);
    expect(err.join('\n')).toMatch(/--name value/);
  });

  it('rejects duplicate flags', () => {
    const { code, err } = capture([
      ...PREPARE_REQUIRED,
      '--reason',
      'orphan_claim_unknown_provider_outcome',
    ]);
    expect(code).toBe(2);
    expect(err.join('\n')).toMatch(/duplicate flag/);
  });

  it('rejects unknown flags', () => {
    const { code, err } = capture([...PREPARE_REQUIRED, '--bogus', 'x']);
    expect(code).toBe(2);
    expect(err.join('\n')).toMatch(/unknown flag/);
  });

  it('rejects positional arguments', () => {
    const { code, err } = capture(['prepare-replacement', 'positional']);
    expect(code).toBe(2);
    expect(err.join('\n')).toMatch(/positional/);
  });

  it('rejects a value flag with no value', () => {
    const { code, err } = capture([
      'prepare-replacement',
      '--repo-root',
      '--preflight-manifest',
      'x',
    ]);
    expect(code).toBe(2);
    expect(err.join('\n')).toMatch(/requires a value/);
  });

  it('rejects missing required flags', () => {
    const { code, err } = capture(['prepare-replacement', '--repo-root', '.']);
    expect(code).toBe(2);
    expect(err.join('\n')).toMatch(/missing required flag/);
  });

  it('rejects a non-Guy approver before touching the ledger', () => {
    const { code, err } = capture([
      'approve-replacement',
      '--repo-root',
      '.',
      '--proposal-path',
      'outputs/x/replacement-proposals/a.json',
      '--proposal-digest',
      'a',
      '--review-path',
      'outputs/x/replacement-reviews/b.json',
      '--review-digest',
      'b',
      '--approved-by',
      'Codex',
      '--approved-at',
      '2026-08-26T10:00:00.000Z',
    ]);
    expect(code).toBe(1);
    expect(err.join('\n')).toMatch(/--approved-by must be "Guy"/);
  });

  it('surfaces a bounded sanitized error (no stack) when the manifest is missing', () => {
    const { code, out, err } = capture(PREPARE_REQUIRED);
    expect(code).toBe(1);
    expect(out).toEqual([]);
    const message = err.join('\n');
    expect(message).toMatch(/^error: /);
    expect(message).not.toMatch(/\n\s+at /);
  });
});

describe('QA Wizard Blueprint replacement CLI — hermetic subprocess', () => {
  it('exits 2 with a single sanitized line on an unknown command', () => {
    const result = runSubprocess(['unknown-cmd']);
    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr.trim()).toMatch(/^error: unknown command/);
    expect(result.stderr).not.toMatch(/\n\s+at /);
  });

  it('exits 2 on missing required flags', () => {
    const result = runSubprocess(['prepare-replacement', '--repo-root', '.']);
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/missing required flag/);
  });

  it('exits 2 on execute-replacement without --write (provider-unreachable)', () => {
    const result = runSubprocess([
      'execute-replacement',
      '--repo-root',
      '.',
      '--authorization-path',
      'outputs/x/replacement-authorizations/a.json',
      '--authorization-digest',
      'a',
      '--preflight-manifest',
      'outputs/x/blueprint-authoring-manifests/deadbeef.json',
      '--output-dir',
      'outputs/x',
    ]);
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/requires --write/);
    expect(result.stdout).toBe('');
  });

  it('exits 1 with a sanitized error when dispatch hits a missing artifact', () => {
    const result = runSubprocess(PREPARE_REQUIRED);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr.trim()).toMatch(/^error: /);
    expect(result.stderr).not.toMatch(/\n\s+at /);
  });
});

describe('QA Wizard Blueprint replacement CLI — canonical operator command', () => {
  it('exposes the documented npm script wired to the server-only shim and CLI bin', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'),
    ) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.['qa-wizard-blueprint-replacement']).toBe(
      CANONICAL_NPM_SCRIPT,
    );
  });

  it('reaches the strict parser under the canonical command (past the server-only shim)', () => {
    // Unknown command is a parser verdict: exit 2 with a single sanitized line —
    // proving the shimmed import resolved and control reached argument parsing
    // rather than crashing in `server-only`.
    const unknown = runSubprocess(['unknown-cmd']);
    expect(unknown.status).toBe(2);
    expect(unknown.stdout).toBe('');
    expect(unknown.stderr.trim()).toMatch(/^error: unknown command/);
    expect(unknown.stderr).not.toMatch(/\n\s+at /);
    // A known command missing a required flag is likewise a parser verdict.
    const incomplete = runSubprocess([
      'prepare-replacement',
      '--repo-root',
      '.',
    ]);
    expect(incomplete.status).toBe(2);
    expect(incomplete.stderr).toMatch(/missing required flag/);
  });
});
