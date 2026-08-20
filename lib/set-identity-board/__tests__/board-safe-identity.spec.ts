import { describe, expect, it } from 'vitest';

import { buildBoardQaInstruction } from '../boardQa';
import { buildSetIdentityBoardPrompt } from '../boardPrompt';
import {
  setBoardSafeIdentityLabel,
  setBoardSafeLocationName,
} from '../boardSafeIdentity';
import { projectSetDefinition } from '../setDefinition';
import {
  LEGACY_SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION,
  SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION,
  type SetDefinition,
} from '../types';
import { clone, makeContract, STYLE } from './board-fixtures';

const FROZEN_CLEAN_PROMPT_HASH =
  '62b9a05cb790a21150d05e75b8152a245388069e1c9287b4fcb9682ec38c5743';

function unsafeDefinition(): SetDefinition {
  const definition = projectSetDefinition(makeContract(), 'set_alpha', STYLE);
  definition.setIdentityId = 'set_child_home_night';
  definition.locations[0].name = "Child's home";
  return definition;
}

describe('Set Board provider-safe identity labels', () => {
  it('locks the current clean provider prompt bytes and prompt hash exactly', () => {
    const definition = projectSetDefinition(makeContract(), 'set_alpha', STYLE);
    const result = buildSetIdentityBoardPrompt(definition);
    expect(definition.positiveAuthorityPolicy.version).toBe(
      SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION,
    );
    expect(setBoardSafeIdentityLabel(definition)).toBe('set_alpha');
    expect(setBoardSafeLocationName(definition, definition.locations[0])).toBe(
      'North Room',
    );
    expect(result.promptHash).toBe(FROZEN_CLEAN_PROMPT_HASH);
  });

  it('removes unsafe raw set and location labels from image and Vision prompts', () => {
    const definition = unsafeDefinition();
    const imagePrompt = buildSetIdentityBoardPrompt(definition).prompt;
    const qaInstruction = buildBoardQaInstruction(definition);
    const safeSetLabel = setBoardSafeIdentityLabel(definition);
    const safeLocationLabel = setBoardSafeLocationName(
      definition,
      definition.locations[0],
    );

    expect(safeSetLabel).toMatch(/^set_[a-f0-9]{64}$/);
    expect(safeLocationLabel).toMatch(/^location_[a-f0-9]{64}$/);
    expect(imagePrompt).toContain(safeSetLabel);
    expect(imagePrompt).toContain(safeLocationLabel);
    expect(qaInstruction).toContain(safeSetLabel);
    for (const raw of ['set_child_home_night', "Child's home"]) {
      expect(imagePrompt).not.toContain(raw);
      expect(qaInstruction).not.toContain(raw);
    }
  });

  it('is deterministic and content-addressed across distinct unsafe identities', () => {
    const first = unsafeDefinition();
    const repeat = clone(first);
    const distinct = unsafeDefinition();
    distinct.setIdentityId = 'set_companion_home_night';

    expect(setBoardSafeIdentityLabel(first)).toBe(
      setBoardSafeIdentityLabel(repeat),
    );
    expect(setBoardSafeIdentityLabel(first)).not.toBe(
      setBoardSafeIdentityLabel(distinct),
    );
    expect(buildSetIdentityBoardPrompt(first).promptHash).toBe(
      buildSetIdentityBoardPrompt(repeat).promptHash,
    );
  });

  it('reserves opaque namespaces so a clean raw label cannot collapse another identity', () => {
    const first = unsafeDefinition();
    const firstSetLabel = setBoardSafeIdentityLabel(first);
    const firstLocationLabel = setBoardSafeLocationName(
      first,
      first.locations[0],
    );
    const adversarial = unsafeDefinition();
    adversarial.setIdentityId = firstSetLabel;
    adversarial.locations[0].name = firstLocationLabel;

    expect(setBoardSafeIdentityLabel(adversarial)).toMatch(
      /^set_[a-f0-9]{64}$/,
    );
    expect(setBoardSafeIdentityLabel(adversarial)).not.toBe(firstSetLabel);
    expect(setBoardSafeLocationName(adversarial, adversarial.locations[0])).toMatch(
      /^location_[a-f0-9]{64}$/,
    );
    expect(
      setBoardSafeLocationName(adversarial, adversarial.locations[0]),
    ).not.toBe(firstLocationLabel);
  });

  it('keeps v1 label behavior explicit and rejects unsupported policy versions', () => {
    const legacy = unsafeDefinition() as SetDefinition;
    (legacy.positiveAuthorityPolicy as unknown as { version: string }).version =
      LEGACY_SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION;
    expect(setBoardSafeIdentityLabel(legacy)).toBe('set_child_home_night');
    expect(setBoardSafeLocationName(legacy, legacy.locations[0])).toBe(
      "Child's home",
    );
    expect(() => buildSetIdentityBoardPrompt(legacy)).toThrow(
      /positiveAuthorityPolicy\.version/,
    );

    const unsupported = unsafeDefinition();
    (unsupported.positiveAuthorityPolicy as unknown as { version: string }).version =
      'set-board-positive-authority/v999';
    expect(() => setBoardSafeIdentityLabel(unsupported)).toThrow(
      /unsupported Set Board positive-authority policy version/,
    );
  });

  it('keeps descriptive positive authority fail-closed after label projection', () => {
    const definition = unsafeDefinition();
    definition.locations[0].lighting = 'the child waits under a lamp';
    expect(() => buildSetIdentityBoardPrompt(definition)).toThrow(
      /set_board_positive_authority_leak/,
    );
    expect(() => buildBoardQaInstruction(definition)).toThrow(
      /set_board_positive_authority_leak/,
    );
  });
});
