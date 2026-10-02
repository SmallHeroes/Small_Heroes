/** Controlled local Git-source build. No checkout, network, key or provider call. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import type * as writer from '../lib/personal-wizard/story-writer';
import type * as provider from '../lib/personal-wizard/story-openai';
import type * as editor from '../lib/personal-wizard/story-editor';
import type * as editorProvider from '../lib/personal-wizard/story-editor-openai';
import type * as config from '../lib/personal-wizard/story-config';
import type * as options from '../lib/personal-wizard/options';
import type { IntakeLedger } from '../lib/personal-wizard/intake-ledger';
import type * as bookRunner from '../lib/personal-wizard/book-runner';
import type * as bookProvider from '../lib/personal-wizard/book-openai';
import type * as bookConfig from '../lib/personal-wizard/book-config';
import type * as storyboard from '../lib/personal-wizard/storyboard';

export type FrozenEngine = Pick<typeof writer, 'preparePersonalStory' | 'writePersonalStory'> &
  Pick<typeof provider, 'createPersonalStoryProvider'> & Pick<typeof config, 'storyReservationUsd' | 'personalStoryOutputLimits'> &
  Pick<typeof options, 'resolvePersonalWizardOptions'> & { IntakeLedger: new () => IntakeLedger } &
  Partial<Pick<typeof editor, 'prepareStoryEdit' | 'compileStoryEdit' | 'editorNeedsWork' | 'storyEditorReservationUsd'>> &
  Partial<Pick<typeof editorProvider, 'createStoryEditorProvider'>>;
const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const executionExternals = ['crypto', 'fs', 'path', 'node:crypto', 'node:fs', 'node:path', 'openai', 'openai/helpers/zod', 'zod'];
// Assert the final bundle too, rather than relying on resolution checks alone.
export function assertFrozenExecutionImports(imports: { path: string; external?: boolean }[]) {
  if (imports.some(item => item.external && !executionExternals.includes(item.path))) throw Error('trial_execution_import');
}
export function gitEnvironment() {
  return Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.toUpperCase().startsWith('GIT_'))) as NodeJS.ProcessEnv;
}
export function gitAt(repo: string, args: string[]): Buffer {
  return execFileSync('git', args, { cwd: repo, env: gitEnvironment(), maxBuffer: 8_000_000 });
}

export async function loadFrozenStoryEngine(repo: string, commit: string, includeEditor: boolean, includeBook = false) {
  if (!/^[a-f0-9]{40}$/.test(commit) || gitAt(repo, ['rev-parse', `${commit}^{commit}`]).toString().trim() !== commit) throw Error('trial_source_commit');
  const names = gitAt(repo, ['ls-tree', '-r', '--name-only', commit]).toString().split('\n');
  const files = new Set(names); const sourceSha256: Record<string, string> = {};
  const entry = [
    "export { preparePersonalStory, writePersonalStory } from './lib/personal-wizard/story-writer';",
    "export { createPersonalStoryProvider } from './lib/personal-wizard/story-openai';",
    "export { storyReservationUsd, personalStoryOutputLimits } from './lib/personal-wizard/story-config';",
    "export { resolvePersonalWizardOptions } from './lib/personal-wizard/options';",
    "export { IntakeLedger } from './lib/personal-wizard/intake-ledger';",
    ...(includeEditor ? ["export { prepareStoryEdit, compileStoryEdit, editorNeedsWork, storyEditorReservationUsd } from './lib/personal-wizard/story-editor';",
      "export { createStoryEditorProvider } from './lib/personal-wizard/story-editor-openai';"] : []),
    ...(includeBook ? [
      "export { generatePersonalBook, PersonalBookError, PersonalBookPlanningHeldError } from './lib/personal-wizard/book-runner';",
      "export { createPersonalBookProvider } from './lib/personal-wizard/book-openai';",
      "export { personalBookOutputLimits, personalBookReservationUsd, BOOK_LIMITS } from './lib/personal-wizard/book-config';",
      "export { storyEditorOutputTokens } from './lib/personal-wizard/story-editor';",
      "export { preparePersonalStoryboard, compilePersonalStoryboard, storyboardReviewDisposition, personalStoryboardFrame } from './lib/personal-wizard/storyboard';",
    ] : []),
  ].join('\n');
  const answer = await build({ stdin: { contents: entry, resolveDir: repo, sourcefile: 'frozen-entry.ts', loader: 'ts' },
    bundle: true, write: false, metafile: true, platform: 'node', format: 'cjs', target: 'node20', logLevel: 'silent', plugins: [{
      name: 'immutable-git-source', setup(builder) {
        builder.onResolve({ filter: /.*/ }, args => {
          if (args.path === 'server-only') return { path: 'server-only', namespace: 'frozen-empty' };
          let relative: string;
          if (args.path.startsWith('@/')) relative = args.path.slice(2);
          else if (args.path.startsWith('.')) relative = path.posix.normalize(path.posix.join(args.namespace === 'frozen-git' ? path.posix.dirname(args.importer) : '.', args.path));
          else {
            if (!executionExternals.includes(args.path)) throw Error('trial_external_import');
            return { path: args.path, external: true };
          }
          const file = [relative, `${relative}.ts`, `${relative}.tsx`, `${relative}.js`, `${relative}/index.ts`].find(candidate => files.has(candidate));
          if (!file || file.startsWith('../')) throw Error('trial_source_import');
          return { path: file, namespace: 'frozen-git' };
        });
        builder.onLoad({ filter: /.*/, namespace: 'frozen-empty' }, () => ({ contents: '', loader: 'js' }));
        builder.onLoad({ filter: /.*/, namespace: 'frozen-git' }, args => {
          const bytes = gitAt(repo, ['show', `${commit}:${args.path}`]); sourceSha256[args.path] = sha(bytes);
          return { contents: bytes.toString('utf8'), loader: args.path.endsWith('.tsx') ? 'tsx' : args.path.endsWith('.json') ? 'json' : 'ts' };
        });
      },
    }] });
  const bundle = answer.outputFiles[0].text;
  const executionImports = Object.values(answer.metafile!.outputs).flatMap(output => output.imports);
  assertFrozenExecutionImports(executionImports); // Before evaluating ANY source.
  const holder = { exports: {} };
  const localRequire = createRequire(path.join(repo, 'package.json'));
  const installedEntrySha256 = Object.fromEntries(['openai', 'openai/helpers/zod', 'zod'].map(name => [name, sha(readFileSync(localRequire.resolve(name)))]));
  // Only immutable, owner-scoped local repository source is evaluated. Never model output.
  new Function('require', 'module', 'exports', bundle)(localRequire, holder, holder.exports);
  return { engine: holder.exports as FrozenEngine, bundle, evidence: { commit, sourceSha256,
    bundleSha256: sha(bundle), esbuildVersion: require('esbuild').version as string,
    openaiVersion: JSON.parse(readFileSync(path.join(path.dirname(require.resolve('openai')), 'package.json'), 'utf8')).version as string,
    entrySha256: sha(entry), executionImports, installedEntrySha256,
    dependencyScope: 'installed_external_entry_hashes_not_hermetic_dependency_tree',
    kind: 'local_source_freeze_not_provider_attestation' } };
}

export type FrozenBookEngine = FrozenEngine & Pick<typeof bookRunner, 'generatePersonalBook' | 'PersonalBookError' | 'PersonalBookPlanningHeldError'> &
  Pick<typeof bookProvider, 'createPersonalBookProvider'> & Pick<typeof bookConfig, 'personalBookOutputLimits' | 'personalBookReservationUsd' | 'BOOK_LIMITS'> &
  Pick<typeof editor, 'storyEditorOutputTokens'> & Pick<typeof storyboard, 'preparePersonalStoryboard' | 'compilePersonalStoryboard' | 'storyboardReviewDisposition' | 'personalStoryboardFrame'>;
export async function loadFrozenBookEngine(repo: string, commit: string) {
  const loaded = await loadFrozenStoryEngine(repo, commit, true, true);
  return { ...loaded, engine: loaded.engine as FrozenBookEngine };
}
