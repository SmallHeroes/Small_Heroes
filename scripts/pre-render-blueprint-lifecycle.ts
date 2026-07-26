/**
 * Offline-only local entrypoint for PVB-B Blueprint preparation and approval attestation.
 *
 * This script has no live/provider implementation. `prepare` reads an already-produced
 * whole-book draft fixture from disk and injects it into the strict authoring compiler.
 * `approve` records Guy's exact-digest attestation for an already-persisted review.
 *
 * Usage:
 *   npm run pre-render-blueprint -- prepare \
 *     --context <validation-context.json> --draft <whole-book-draft.json> \
 *     --out <artifact-root> --model <model-id> \
 *     --reasoning-effort <effort> --max-output-tokens <positive-integer>
 *
 *   npm run pre-render-blueprint -- approve \
 *     --context <validation-context.json> --candidate <blueprint.json> \
 *     --review <review.json> --out <artifact-root> --approved-by Guy \
 *     --approved-at <ISO-timestamp> [--note <text>]
 */
import { readFileSync } from 'fs';

import {
  compilePreRenderBookVisualBlueprint,
} from '@/lib/visual-package/preRenderBlueprintAuthoring';
import {
  persistPreRenderBlueprintLifecycle,
  writePreRenderBlueprintApprovalAttestation,
  type PreRenderBlueprintReviewPacket,
} from '@/lib/visual-package/preRenderBlueprintLifecycle';
import type {
  PreRenderBlueprintValidationContext,
  PreRenderBookVisualBlueprint,
} from '@/lib/visual-package/preRenderBlueprintTypes';

const PREPARE_FLAGS = new Set([
  '--context',
  '--draft',
  '--out',
  '--model',
  '--reasoning-effort',
  '--max-output-tokens',
]);
const APPROVE_FLAGS = new Set([
  '--context',
  '--candidate',
  '--review',
  '--out',
  '--approved-by',
  '--approved-at',
  '--note',
]);

function usage(): string {
  return [
    'Offline Blueprint lifecycle:',
    '  prepare --context <json> --draft <json> --out <dir> --model <id> --reasoning-effort <value> --max-output-tokens <integer>',
    '  approve --context <json> --candidate <json> --review <json> --out <dir> --approved-by Guy --approved-at <ISO> [--note <text>]',
    '',
    'No --live mode exists. This entrypoint imports no provider, network, storage, or database boundary.',
  ].join('\n');
}

function parseFlags(
  tokens: string[],
  allowed: ReadonlySet<string>,
): Map<string, string> {
  const values = new Map<string, string>();
  for (let index = 0; index < tokens.length; index += 2) {
    const flag = tokens[index];
    const value = tokens[index + 1];
    if (
      !flag?.startsWith('--') ||
      flag.includes('=') ||
      !allowed.has(flag)
    ) {
      throw new Error(`unknown or malformed flag: ${flag ?? '<missing>'}`);
    }
    if (!value || value.startsWith('--')) {
      throw new Error(`missing value for ${flag}`);
    }
    if (values.has(flag)) {
      throw new Error(`duplicate flag: ${flag}`);
    }
    values.set(flag, value);
  }
  return values;
}

function requireFlag(values: ReadonlyMap<string, string>, flag: string): string {
  const value = values.get(flag);
  if (!value) throw new Error(`missing required flag: ${flag}`);
  return value;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

async function prepare(tokens: string[]): Promise<void> {
  const flags = parseFlags(tokens, PREPARE_FLAGS);
  const context = readJson<PreRenderBlueprintValidationContext>(
    requireFlag(flags, '--context'),
  );
  const draft = readJson<unknown>(requireFlag(flags, '--draft'));
  const maxOutputTokens = Number(requireFlag(flags, '--max-output-tokens'));
  if (!Number.isSafeInteger(maxOutputTokens) || maxOutputTokens <= 0) {
    throw new Error('--max-output-tokens must be a positive safe integer');
  }

  const authored = await compilePreRenderBookVisualBlueprint(
    context,
    {
      model: requireFlag(flags, '--model'),
      reasoningEffort: requireFlag(flags, '--reasoning-effort'),
      maxOutputTokens,
    },
    {
      // Deliberately returns only the supplied local fixture. No provider exists here.
      callAuthor: async () => draft,
    },
  );
  const persisted = persistPreRenderBlueprintLifecycle({
    root: requireFlag(flags, '--out'),
    blueprint: authored.blueprint,
    context,
    provenance: authored.provenance,
    repairAttempts: authored.repairAttempts,
  });
  process.stdout.write(
    `${JSON.stringify({
      mode: 'offline_fixture_prepare',
      blueprintDigest: authored.blueprint.digest,
      authoringAuthorityDigest:
        authored.blueprint.identity.authoringAuthority.digest,
      reviewPacketDigest: persisted.review.packet.digest,
      artifacts: {
        candidate: persisted.candidate.path,
        provenance: persisted.provenance.path,
        validationEvidence: persisted.validationEvidence.path,
        reviewPacket: persisted.reviewPacket.path,
        reviewMarkdown: persisted.reviewMarkdown.path,
        contactSheet: persisted.contactSheet.path,
      },
    }, null, 2)}\n`,
  );
}

function approve(tokens: string[]): void {
  const flags = parseFlags(tokens, APPROVE_FLAGS);
  const context = readJson<PreRenderBlueprintValidationContext>(
    requireFlag(flags, '--context'),
  );
  const blueprint = readJson<PreRenderBookVisualBlueprint>(
    requireFlag(flags, '--candidate'),
  );
  const reviewPacket = readJson<PreRenderBlueprintReviewPacket>(
    requireFlag(flags, '--review'),
  );
  const result = writePreRenderBlueprintApprovalAttestation({
    root: requireFlag(flags, '--out'),
    blueprint,
    context,
    reviewPacket,
    approvedBy: requireFlag(flags, '--approved-by'),
    approvedAt: requireFlag(flags, '--approved-at'),
    ...(flags.has('--note') ? { note: flags.get('--note') } : {}),
  });
  process.stdout.write(
    `${JSON.stringify({
      mode: 'exact_digest_blueprint_approval',
      approvalDigest: result.attestation.digest,
      blueprintDigest: result.attestation.blueprintDigest,
      authoringAuthorityDigest:
        result.attestation.authoringAuthorityDigest,
      reviewPacketDigest: result.attestation.reviewPacketDigest,
      artifact: result.artifact.path,
    }, null, 2)}\n`,
  );
}

async function main(): Promise<void> {
  const [command, ...tokens] = process.argv.slice(2);
  if (!command || command === '--help' || command === 'help') {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (command === 'prepare') {
    await prepare(tokens);
    return;
  }
  if (command === 'approve') {
    approve(tokens);
    return;
  }
  throw new Error(`unknown command: ${command}\n${usage()}`);
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
