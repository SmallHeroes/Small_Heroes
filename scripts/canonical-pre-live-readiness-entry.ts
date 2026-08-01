import crypto from 'node:crypto';

const INTERNAL_CAPABILITY_FLAG =
  '--internal-launch-capability';
const INTERNAL_ENVIRONMENT_NAMES = {
  capability: 'SMALL_HEROES_PRE_LIVE_CAPABILITY',
  npmCliSha256:
    'SMALL_HEROES_PRE_LIVE_NPM_CLI_SHA256',
  offlineInstall:
    'SMALL_HEROES_PRE_LIVE_OFFLINE_INSTALL_COMPLETED',
  prismaGeneration:
    'SMALL_HEROES_PRE_LIVE_PRISMA_GENERATION_COMPLETED',
} as const;

function canonicalValue(value: unknown): unknown {
  if (typeof value === 'string') return value.normalize('NFC');
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number'
  ) {
    if (
      typeof value === 'number' &&
      !Number.isFinite(value)
    ) {
      throw new Error('non_finite_number');
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalValue);
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(
      value as Record<string, unknown>,
    )
      .map(
        ([key, entry]) =>
          [key.normalize('NFC'), entry] as const,
      )
      .sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0,
      );
    const result: Record<string, unknown> = {};
    for (const [key, entry] of entries) {
      if (Object.prototype.hasOwnProperty.call(result, key)) {
        throw new Error('normalized_key_collision');
      }
      result[key] = canonicalValue(entry);
    }
    return result;
  }
  return value;
}

function canonicalDigest(value: unknown): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalValue(value)))
    .digest('hex');
}

function output(value: unknown): void {
  process.stdout.write(
    `${JSON.stringify(canonicalValue(value), null, 2)}\n`,
  );
}

function launcherFailure(
  mode: 'prepare' | 'verify',
): Record<string, unknown> {
  const withoutDigest = {
    version: 'canonical-pre-live-readiness-failure/v2',
    status: 'rejected',
    mode,
    phase: 'launcher',
    reasonCodes: ['pre_live_private_entry_rejected'],
    authorityReasonCodes: [],
    requestIdentityDigest: null,
    pricingAuthority: 'not_checked',
    canonicalPreflight: 'not_run',
    credentialAccess: 'none',
    providerCalls: 0,
    liveAuthority: 'none',
  };
  return {
    ...withoutDigest,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalDigest(withoutDigest),
  };
}

function consumeLaunchAuthority(tokens: string[]): {
  publicTokens: string[];
  launchAuthority: {
    npmCliSha256: string;
    offlineInstallCompleted: boolean;
    prismaGenerationCompleted: boolean;
  };
} | null {
  const capabilityIndex = tokens.length - 2;
  if (
    capabilityIndex < 1 ||
    tokens[capabilityIndex] !==
      INTERNAL_CAPABILITY_FLAG
  ) {
    return null;
  }
  const argumentCapability = tokens[capabilityIndex + 1];
  const environmentCapability =
    process.env[INTERNAL_ENVIRONMENT_NAMES.capability];
  const npmCliSha256 =
    process.env[INTERNAL_ENVIRONMENT_NAMES.npmCliSha256];
  const offlineInstall =
    process.env[INTERNAL_ENVIRONMENT_NAMES.offlineInstall];
  const prismaGeneration =
    process.env[
      INTERNAL_ENVIRONMENT_NAMES.prismaGeneration
    ];
  if (
    typeof argumentCapability !== 'string' ||
    !/^[a-f0-9]{64}$/.test(argumentCapability) ||
    argumentCapability !== environmentCapability ||
    typeof npmCliSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(npmCliSha256) ||
    offlineInstall !== '1' ||
    prismaGeneration !== '1'
  ) {
    return null;
  }
  for (const name of Object.values(
    INTERNAL_ENVIRONMENT_NAMES,
  )) {
    delete process.env[name];
  }
  tokens.fill('', capabilityIndex);
  return {
    publicTokens: tokens.slice(0, capabilityIndex),
    launchAuthority: {
      npmCliSha256,
      offlineInstallCompleted: true,
      prismaGenerationCompleted: true,
    },
  };
}

function parsePublicArguments(tokens: string[]): {
  mode: 'prepare' | 'verify';
  input: {
    repoRoot: string;
    outputRoot: string;
    storySourceKey: string;
    storySourcePath: string;
    requestId: string;
    requestedAt: string;
    credentialSourcePath: string;
  };
} | null {
  const [mode, ...flags] = tokens;
  if (
    mode !== 'prepare' &&
    mode !== 'verify'
  ) {
    return null;
  }
  const expected = new Set([
    '--repo-root',
    '--output-root',
    '--story-source-key',
    '--story-source-path',
    '--request-id',
    '--requested-at',
    '--credential-source-path',
  ]);
  if (flags.length !== expected.size * 2) return null;
  const values = new Map<string, string>();
  for (let index = 0; index < flags.length; index += 2) {
    const flag = flags[index];
    const value = flags[index + 1];
    if (
      !flag ||
      !value ||
      !expected.has(flag) ||
      flag.includes('=') ||
      values.has(flag) ||
      value.startsWith('--')
    ) {
      return null;
    }
    values.set(flag, value);
  }
  const repoRoot = values.get('--repo-root');
  const outputRoot = values.get('--output-root');
  const storySourceKey = values.get('--story-source-key');
  const storySourcePath = values.get('--story-source-path');
  const requestId = values.get('--request-id');
  const requestedAt = values.get('--requested-at');
  const credentialSourcePath = values.get(
    '--credential-source-path',
  );
  if (
    !repoRoot ||
    !outputRoot ||
    !storySourceKey ||
    !storySourcePath ||
    !requestId ||
    !requestedAt ||
    !credentialSourcePath
  ) {
    return null;
  }
  return {
    mode,
    input: {
      repoRoot,
      outputRoot,
      storySourceKey,
      storySourcePath,
      requestId,
      requestedAt,
      credentialSourcePath,
    },
  };
}

async function main(): Promise<void> {
  const requestedMode =
    process.argv[2] === 'verify'
      ? 'verify'
      : 'prepare';
  const consumed = consumeLaunchAuthority(
    process.argv.slice(2),
  );
  if (!consumed) {
    output(launcherFailure(requestedMode));
    process.exitCode = 1;
    return;
  }
  const parsed = parsePublicArguments(
    consumed.publicTokens,
  );
  if (!parsed) {
    const {
      buildCanonicalPreLiveReadinessFailure,
    } = await import(
      '@/lib/visual-package/canonicalPreLiveReadiness'
    );
    output(
      buildCanonicalPreLiveReadinessFailure({
        mode: requestedMode,
        phase: 'launcher',
        reasonCodes: ['pre_live_cli_arguments_invalid'],
      }),
    );
    process.exitCode = 1;
    return;
  }
  const readiness = await import(
    '@/lib/visual-package/canonicalPreLiveReadiness'
  );
  const result =
    parsed.mode === 'prepare'
      ? readiness.prepareCanonicalPreLiveReadiness({
          input: parsed.input,
          launchAuthority: consumed.launchAuthority,
        })
      : readiness.verifyCanonicalPreLiveReadiness({
          input: parsed.input,
          launchAuthority: consumed.launchAuthority,
        });
  output(result);
  process.exitCode =
    result.status === 'ready_for_spend_gate' ? 0 : 1;
}

main().catch(async () => {
  const requestedMode =
    process.argv[2] === 'verify'
      ? 'verify'
      : 'prepare';
  try {
    const {
      buildCanonicalPreLiveReadinessFailure,
    } = await import(
      '@/lib/visual-package/canonicalPreLiveReadiness'
    );
    output(
      buildCanonicalPreLiveReadinessFailure({
        mode: requestedMode,
        phase: 'launcher',
        reasonCodes: ['pre_live_private_entry_rejected'],
      }),
    );
  } catch {
    output(launcherFailure(requestedMode));
  }
  process.exitCode = 1;
});
