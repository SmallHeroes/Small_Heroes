/** Git-only source assertions. Safe for local routes; no compiler/provider dependency. */
import { execFileSync } from 'node:child_process';

export function gitEnvironment() {
  return Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.toUpperCase().startsWith('GIT_'))) as NodeJS.ProcessEnv;
}
export function gitAt(repo: string, args: string[]): Buffer {
  return execFileSync('git', args, { cwd: repo, env: gitEnvironment(), maxBuffer: 8_000_000 });
}
