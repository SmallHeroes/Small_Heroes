/**
 * Canonical D1A Visual Contract authoring CLI core.
 *
 * This file is not a public executable. The CJS launcher owns dependency
 * resolution, server-only shim ordering, and the one-time child capability.
 * The exact live graph remains dynamically imported after strict mode parsing.
 */

import type {
  CanonicalLiveVisualContractAuthoringResult,
} from '@/lib/visual-package/canonicalLiveVisualContractAuthoring';

export const CANONICAL_VISUAL_CONTRACT_AUTHORING_COMMAND =
  'node scripts/visual-contract-authoring.cjs';

export const VISUAL_CONTRACT_AUTHORING_USAGE = [
  'Canonical Visual Contract authoring boundary:',
  `  ${CANONICAL_VISUAL_CONTRACT_AUTHORING_COMMAND} preflight`,
  `  ${CANONICAL_VISUAL_CONTRACT_AUTHORING_COMMAND} live --repo-root <absolute-dir> --source-authority-request <repo-relative-json> --snapshot <repo-relative-json> --request <repo-relative-json> --out <repo-relative-dir>`,
  '',
  'preflight is exclusive and zero-cost: it accepts no source, output, credential, model, price, or write arguments.',
  'live requires a separately created mode=live request and writes only immutable sanitized local evidence.',
  'The current $10 policy admits up to 12 pages: five standard calls plus one strictly gated terminal-reference cleanup; 13+ pages stop before provider access and require a separate budget or partition Decision Gate.',
  'This command never performs reconciliation, approval, Blueprint authoring, Board/package work, render, publication, or production activation.',
].join('\n');

const TEST_BOUNDARY_SENTINEL_ARMED_ENV =
  'SMALL_HEROES_TEST_LIVE_AUTHORING_BOUNDARY_SENTINEL_ARMED';
const TEST_BOUNDARY_SENTINEL_ARMED_VALUE =
  'credential-write-sentinel/v1';

export const CANONICAL_VISUAL_CONTRACT_AUTHORING_CLI_SUMMARY_VERSION =
  'canonical-visual-contract-authoring-cli-summary/v1' as const;

export interface VisualContractAuthoringPreflightArgs {
  mode: 'preflight';
}

export interface VisualContractAuthoringLiveArgs {
  mode: 'live';
  repoRoot: string;
  sourceAuthorityRequestPath: string;
  snapshotPath: string;
  requestPath: string;
  outputDir: string;
}

export type VisualContractAuthoringCliArgs =
  | VisualContractAuthoringPreflightArgs
  | VisualContractAuthoringLiveArgs;

const LIVE_VALUE_FLAGS = new Set([
  '--repo-root',
  '--source-authority-request',
  '--snapshot',
  '--request',
  '--out',
]);

function parseLiveFlags(tokens: string[]): Map<string, string> {
  const values = new Map<string, string>();
  for (let index = 0; index < tokens.length; index += 2) {
    const flag = tokens[index];
    const value = tokens[index + 1];
    if (!flag?.startsWith('--')) {
      throw new Error(
        `unexpected positional argument "${flag ?? '<missing>'}"`,
      );
    }
    if (flag.includes('=')) {
      throw new Error(
        `--flag=value syntax is unsupported (got "${flag}")`,
      );
    }
    if (!LIVE_VALUE_FLAGS.has(flag)) {
      throw new Error(`unknown flag "${flag}"`);
    }
    if (values.has(flag)) {
      throw new Error(`duplicate flag "${flag}"`);
    }
    if (!value || value.startsWith('--')) {
      throw new Error(`missing separated value for ${flag}`);
    }
    values.set(flag, value);
  }
  for (const required of LIVE_VALUE_FLAGS) {
    if (!values.has(required)) {
      throw new Error(`missing required flag "${required}"`);
    }
  }
  return values;
}

export function parseVisualContractAuthoringArgs(
  argv: string[],
): VisualContractAuthoringCliArgs {
  const [command, ...tokens] = argv;
  if (command === 'preflight') {
    if (tokens.length !== 0) {
      throw new Error(
        'preflight is exclusive and must be used alone',
      );
    }
    return { mode: 'preflight' };
  }
  if (command === 'live') {
    const values = parseLiveFlags(tokens);
    return {
      mode: 'live',
      repoRoot: values.get('--repo-root')!,
      sourceAuthorityRequestPath: values.get(
        '--source-authority-request',
      )!,
      snapshotPath: values.get('--snapshot')!,
      requestPath: values.get('--request')!,
      outputDir: values.get('--out')!,
    };
  }
  if (!command) {
    throw new Error(
      `missing command\n${VISUAL_CONTRACT_AUTHORING_USAGE}`,
    );
  }
  if (command.startsWith('--') && command.includes('=')) {
    throw new Error(
      `--flag=value syntax is unsupported (got "${command}")`,
    );
  }
  throw new Error(
    `unknown or unexpected positional command "${command}"`,
  );
}

interface LiveImportGraph {
  adapterFactoryType: string;
  adapterBodyBuilderType: string;
  liveRunnerType: string;
  credentialEnvironmentName: string;
  providerEvidenceVersion: string;
}

export interface VisualContractAuthoringImportPreflightDeps {
  loadExactLiveGraph: () => Promise<LiveImportGraph>;
}

export const visualContractAuthoringImportPreflightDeps: VisualContractAuthoringImportPreflightDeps =
  {
    loadExactLiveGraph: async () => {
      const [adapter, runner] = await Promise.all([
        import(
          '@/lib/visual-package/openaiResponsesVisualContractAuthoringAdapter'
        ),
        import(
          '@/lib/visual-package/canonicalLiveVisualContractAuthoring'
        ),
      ]);
      return {
        adapterFactoryType:
          typeof adapter.createOpenAIResponsesVisualContractAuthoringAdapter,
        adapterBodyBuilderType:
          typeof adapter.buildOpenAIResponsesVisualContractAuthoringBody,
        liveRunnerType:
          typeof runner.runCanonicalLiveVisualContractAuthoring,
        credentialEnvironmentName:
          adapter.OPENAI_RESPONSES_AUTHORING_CREDENTIAL_ENV,
        providerEvidenceVersion:
          adapter.OPENAI_RESPONSES_AUTHORING_EVIDENCE_VERSION,
      };
    },
  };

let importPreflightInProgress = false;

export async function runVisualContractAuthoringImportPreflight(
  deps: VisualContractAuthoringImportPreflightDeps =
    visualContractAuthoringImportPreflightDeps,
): Promise<LiveImportGraph> {
  if (importPreflightInProgress) {
    throw new Error(
      'visual-contract-authoring import preflight is already running',
    );
  }
  importPreflightInProgress = true;
  const originalFetch = globalThis.fetch;
  try {
    if (typeof originalFetch !== 'function') {
      throw new Error(
        'visual-contract-authoring import preflight requires global fetch',
      );
    }
    globalThis.fetch = (async () => {
      throw new Error(
        'visual-contract-authoring import preflight blocked an unexpected fetch',
      );
    }) as typeof fetch;
    const graph = await deps.loadExactLiveGraph();
    if (
      graph.adapterFactoryType !== 'function' ||
      graph.adapterBodyBuilderType !== 'function' ||
      graph.liveRunnerType !== 'function' ||
      graph.credentialEnvironmentName !== 'OPENAI_API_KEY' ||
      graph.providerEvidenceVersion !==
        'openai-responses-authoring-evidence/v6'
    ) {
      throw new Error(
        'visual-contract-authoring import preflight found an incomplete exact live graph',
      );
    }
    return graph;
  } finally {
    globalThis.fetch = originalFetch;
    importPreflightInProgress = false;
  }
}

function outputJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

/**
 * Full sanitized receipt/readiness records remain durable content-addressed
 * artifacts. stdout crosses the Supervisor's bounded child channel and must
 * stay small regardless of diagnostic cardinality.
 */
export function visualContractAuthoringCliSummary(
  result: CanonicalLiveVisualContractAuthoringResult,
): Record<string, unknown> {
  return {
    version:
      CANONICAL_VISUAL_CONTRACT_AUTHORING_CLI_SUMMARY_VERSION,
    mode: result.mode,
    status: result.status,
    receipt: {
      version: result.receipt.version,
      status: result.receipt.status,
      digest: result.receipt.digest,
      callCount: result.receipt.callCount,
      repairCount: result.receipt.repairCount,
      candidateDigest: result.receipt.candidateDigest,
      failureCode: result.receipt.failure?.code ?? null,
    },
    readiness: {
      version: result.readiness.version,
      digest: result.readiness.digest,
      authoringStatus:
        result.readiness.authoringOutcome.status,
      blueprintAuthoringReady:
        result.readiness.blueprintAuthoringReady,
      d1a1Authorized: result.readiness.d1a1Authorized,
    },
    persistence: {
      authoringRequestKind:
        result.persistence.authoringRequestKind,
      ...Object.fromEntries(
        Object.entries(result.persistence)
          .filter(([key]) => key !== 'authoringRequestKind')
          .map(([key, value]) => [
        key,
        value === null
          ? null
          : {
              path: (value as { path: string }).path,
              digest: (value as { digest: string }).digest,
              created: (value as { created: boolean }).created,
            },
          ]),
      ),
    },
  };
}

export async function runVisualContractAuthoringCli(
  argv: string[],
): Promise<void> {
  if (
    argv.length === 0 ||
    (argv.length === 1 &&
      (argv[0] === 'help' ||
        argv[0] === '--help' ||
        argv[0] === '-h'))
  ) {
    process.stdout.write(`${VISUAL_CONTRACT_AUTHORING_USAGE}\n`);
    return;
  }
  if (
    argv.includes('help') ||
    argv.includes('--help') ||
    argv.includes('-h')
  ) {
    throw new Error('help must be used alone');
  }

  const parsed = parseVisualContractAuthoringArgs(argv);
  if (parsed.mode === 'preflight') {
    const boundarySentinelArmed =
      process.env[TEST_BOUNDARY_SENTINEL_ARMED_ENV] ===
      TEST_BOUNDARY_SENTINEL_ARMED_VALUE;
    delete process.env[TEST_BOUNDARY_SENTINEL_ARMED_ENV];
    const graph =
      await runVisualContractAuthoringImportPreflight();
    process.stdout.write(
      [
        'LIVE-AUTHORING IMPORT PREFLIGHT PASS',
        `checked adapter factory export: ${graph.adapterFactoryType}`,
        `checked adapter request-body builder export: ${graph.adapterBodyBuilderType}`,
        `checked canonical live runner export: ${graph.liveRunnerType}`,
        `checked credential environment name label: ${graph.credentialEnvironmentName}`,
        `checked provider evidence version label: ${graph.providerEvidenceVersion}`,
        ...(boundarySentinelArmed
          ? [
              'checked canonical private-entry credential/write sentinel arming: armed',
            ]
          : []),
        'this exclusive mode checked imports and function/version labels only',
        'credential availability, provider connectivity, provider-side configuration, price currency, and billing were not checked',
        'no source, output, credential, model, price, or write argument is accepted by this mode',
      ].join('\n') + '\n',
    );
    return;
  }

  const { runCanonicalLiveVisualContractAuthoring } =
    await import(
      '@/lib/visual-package/canonicalLiveVisualContractAuthoring'
    );
  const result =
    await runCanonicalLiveVisualContractAuthoring({
      repoRoot: parsed.repoRoot,
      sourceAuthorityRequestPath:
        parsed.sourceAuthorityRequestPath,
      snapshotPath: parsed.snapshotPath,
      requestPath: parsed.requestPath,
      outputDir: parsed.outputDir,
    });
  outputJson(visualContractAuthoringCliSummary(result));
  if (result.status === 'failed') {
    process.exitCode = 1;
  }
}

export const DIRECT_VISUAL_CONTRACT_AUTHORING_CORE_ERROR =
  `Direct invocation of scripts/visual-contract-authoring.ts is unsupported because it cannot guarantee ` +
  `private capability and server-only shim ordering. Use: ${CANONICAL_VISUAL_CONTRACT_AUTHORING_COMMAND}`;

export function isDirectVisualContractAuthoringCoreEntrypoint(
  argv1: string | undefined,
): boolean {
  const basename = argv1
    ?.split(/[\\/]/)
    .pop()
    ?.toLowerCase();
  return basename === 'visual-contract-authoring.ts';
}

const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  isDirectVisualContractAuthoringCoreEntrypoint(
    process.argv[1],
  );
if (invokedDirectly) {
  // eslint-disable-next-line no-console
  console.error(
    DIRECT_VISUAL_CONTRACT_AUTHORING_CORE_ERROR,
  );
  process.exitCode = 1;
}
