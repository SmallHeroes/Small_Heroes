import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import type { BookVisualContract } from '@/lib/visual-contract-compiler';
import {
  buildSetIdentityBoardPrompt,
  computeSetBoardContentPolicyDigest,
  computeSetDefinitionHash,
  projectSetDefinition,
  SET_IDENTITY_BOARD_VERSION,
  SET_IDENTITY_REGISTRY_VERSION,
  validateSetIdentityBoardRegistryEntry,
} from '@/lib/set-identity-board';
import type { SetIdentityBoardBindingContext } from '@/lib/set-identity-board/types';
import {
  PageReferenceCompatibilityError,
  resolvePageReferenceAssets,
} from '@/lib/generation-pipeline/page-reference-authority';
import { resolveRequiredPropArtifacts } from '../propArtifacts';

const REPO = process.cwd();
const STORY_KEY = 'fox_uri_adventure';
const STYLE_ID = 'soft_hand_drawn_storybook';
const SET_ID = 'set_room_balcony_night';
const PROP_ID = 'prop_tin_bucket';
const TEMPLATE_PATH = path.join(
  REPO,
  'story-bank',
  'v3-approved',
  `${STORY_KEY}.visual-contract-template.json`,
);

function contract(): BookVisualContract {
  return JSON.parse(fs.readFileSync(TEMPLATE_PATH, 'utf8')) as BookVisualContract;
}

function boardContext(source: BookVisualContract): SetIdentityBoardBindingContext {
  const definition = projectSetDefinition(source, SET_ID, STYLE_ID);
  return {
    mode: 'required-v2',
    frozenContractHash: 'fixture-contract-hash',
    bindings: {
      [SET_ID]: {
        setIdentityId: SET_ID,
        setDefinitionHash: computeSetDefinitionHash(source, SET_ID, STYLE_ID),
        contentPolicyDigest: computeSetBoardContentPolicyDigest(definition),
        declaredPropIds: definition.contentPolicy.includedPropIds,
        styleId: STYLE_ID,
        storageKey: 'fixture/board.png',
        resolvedUrl: 'https://fixtures.invalid/base-set-board.png',
        assetSha256: 'fixture-board-sha',
        boardVersion: SET_IDENTITY_BOARD_VERSION,
        approvedAt: '2026-07-22T00:00:00.000Z',
      },
    },
  };
}

function propArtifacts(source: BookVisualContract) {
  return resolveRequiredPropArtifacts({
    repoRoot: REPO,
    storyKey: STORY_KEY,
    storySourcePath: `story-bank/v3-approved/${STORY_KEY}.md`,
    styleId: STYLE_ID,
    template: source as never,
  });
}

describe('spoiler-safe board and page-conditioned prop authority', () => {
  it('carries the Fox reveal lifecycle through structured data and exact approved asset identity', () => {
    const source = contract();
    const prop = source.recurringProps.find((candidate) => candidate.id === PROP_ID);
    expect(prop?.firstRevealPage).toBe(5);
    for (const pageNumber of [1, 2, 3, 4]) {
      expect(source.pageContracts.find((page) => page.pageNumber === pageNumber)?.propConstraints)
        .toContainEqual({ propId: PROP_ID, visibility: 'forbidden' });
    }
    expect(source.coverContract.mustNotShow).toContain(
      'old tin bucket (first revealed on page 5 — no spoiler)',
    );

    const resolved = propArtifacts(source);
    expect(resolved.issues).toEqual([]);
    expect(resolved.artifacts).toHaveLength(1);
    expect(resolved.artifacts[0]).toMatchObject({
      propId: PROP_ID,
      assetSha256: '60ee317551759e42e08dba592b52d206ec4ed22e47d85a43789acfd977b869bc',
      approvedBy: 'Guy',
      approvedAt: '2026-06-12',
    });
  });

  it('projects one stable physical base board with excluded story content negative-only', () => {
    const definition = projectSetDefinition(contract(), SET_ID, STYLE_ID);
    expect(definition.contentPolicy.excludedProps).toContainEqual({
      propId: PROP_ID,
      name: 'old tin bucket',
      reasons: ['lifecycle', 'page_forbidden'],
    });
    expect(definition.contentPolicy.includedPropIds).not.toContain(PROP_ID);
    expect(definition.fixedSetFacts.some((fact) => fact.propId === PROP_ID)).toBe(false);
    expect(definition.zones.flatMap((zone) => zone.spatialNodes).some(
      (node) => node.bindsTo?.kind === 'prop' && node.bindsTo.id === PROP_ID,
    )).toBe(false);
    expect(definition.zones.flatMap((zone) => zone.spatialRelations).some(
      (relation) => relation.subjectId === 'bucket' || relation.objectId === 'bucket',
    )).toBe(false);
    expect(definition.fixedSetFacts.find(
      (fact) => fact.propId === 'prop_metal_railing',
    )?.quantity).toBe(1);

    const { prompt, negativePrompt } = buildSetIdentityBoardPrompt(definition);
    expect(prompt).not.toMatch(/\b(bucket|drip|water|rhythm)\b/i);
    expect(negativePrompt).toContain('NO old tin bucket');
  });

  it('locks the corrected Fox dry projection and positive-vs-negative authority boundary', () => {
    const source = contract();
    const definition = projectSetDefinition(source, SET_ID, STYLE_ID);
    const { prompt, negativePrompt, promptHash } = buildSetIdentityBoardPrompt(definition);

    expect({
      boardVersion: definition.boardVersion,
      setDefinitionHash: computeSetDefinitionHash(source, SET_ID, STYLE_ID),
      contentPolicyDigest: computeSetBoardContentPolicyDigest(definition),
      promptHash,
    }).toEqual({
      boardVersion: 'set-board/v3',
      setDefinitionHash: 'dc86d58e443bf9b3274f9d64c7b4ecbe9e443d1a2c8d52fb2f211dae32989bfe',
      contentPolicyDigest: 'c00b9b6b6b6da477e045065b2ca4b364f5d1885a03385aa6757e3734bc3900df',
      promptHash: '7ce108dadef5ab877bb945ae639fb3fd1bd561635b421cce6572ee1ff1eeeecd',
    });
    expect(definition.contentPolicy.includedPropIds).toEqual([
      'prop_chair_leg',
      'prop_metal_railing',
      'prop_single_slipper',
      'prop_window',
    ]);
    expect(definition.contentPolicy.includedPropIds).not.toContain(PROP_ID);

    for (const retained of [
      'SINGLE CONTINUOUS ILLUSTRATION',
      'small listening casement window',
      'separate full-height glazed balcony door',
      'soft curtains',
      'continuous bedroom floor',
      'exterior balcony floor',
      'metal balcony railing',
      'fixed low threshold',
      'simple chair leg',
      'single balcony slipper',
      'Stable blue night ambience',
      'warm indoor environmental glow',
    ]) {
      expect(prompt).toContain(retained);
    }
    expect(definition.fixedSetFacts.find((fact) => fact.propId === 'prop_single_slipper')?.quantity)
      .toBe(1);

    expect(prompt).not.toMatch(
      /\buri\b|\b(child|children|cast|character|characters|resemblance|emotion|emotional|companion)\b|30\s*[–-]\s*50|neck flashlight|portable beam|ear pressing|pressing (?:an? )?ear|steps? through|stepping through|behind them|strange ticking|\b(bucket|drip|water|rhythm)\b|\breveal(?:ed|s|ing)?\b/i,
    );
    expect(negativePrompt).toMatch(/NO children/i);
    expect(negativePrompt).toMatch(/NO action/i);
    expect(negativePrompt).toContain('NO old tin bucket');
    expect(negativePrompt).toContain("NO Uri's neck flashlight");
    expect(negativePrompt).toContain('NO falling water drops');
    expect(negativePrompt).toContain('NO gentle rhythm marks');
  });

  it('gives cover/pages 1–4 only the same base board and page 5 exactly one approved prop reference', () => {
    const source = contract();
    const artifacts = propArtifacts(source);
    const boards = boardContext(source);

    for (const pageNumber of [0, 1, 2, 3, 4]) {
      const references = resolvePageReferenceAssets({
        repoRoot: REPO,
        contract: source,
        pageNumber,
        boardBindings: boards,
        propArtifacts: artifacts.artifacts,
      });
      expect(references.filter((reference) => reference.kind === 'set')).toHaveLength(1);
      expect(references.filter((reference) => reference.kind === 'prop')).toHaveLength(0);
    }

    const revealReferences = resolvePageReferenceAssets({
      repoRoot: REPO,
      contract: source,
      pageNumber: 5,
      boardBindings: boards,
      propArtifacts: artifacts.artifacts,
    });
    expect(revealReferences.filter((reference) => reference.kind === 'set')).toHaveLength(1);
    expect(revealReferences.filter((reference) => reference.kind === 'prop')).toHaveLength(1);
    expect(revealReferences.find((reference) => reference.kind === 'prop')).toMatchObject({
      identityId: PROP_ID,
      declaredPropIds: [PROP_ID],
      assetSha256: '60ee317551759e42e08dba592b52d206ec4ed22e47d85a43789acfd977b869bc',
    });
  });

  it('blocks a board declaring forbidden page content before any provider can consume it', () => {
    const source = contract();
    const boards = boardContext(source);
    boards.bindings[SET_ID].declaredPropIds = [PROP_ID];
    expect(() => resolvePageReferenceAssets({
      repoRoot: REPO,
      contract: source,
      pageNumber: 1,
      boardBindings: boards,
      propArtifacts: propArtifacts(source).artifacts,
    })).toThrow(PageReferenceCompatibilityError);
  });

  it('preserves historical Fox evidence while rejecting both v1 and v2 identities for v3 authority', () => {
    const source = contract();
    const definition = projectSetDefinition(source, SET_ID, STYLE_ID);
    const historicalPath = path.join(
      REPO,
      'set-identity-boards',
      STORY_KEY,
      STYLE_ID,
      SET_ID,
      'aaa469afd9c6b0b15fa06d44d64045ba26787988fd2f58740527c2512c1f1f05.json',
    );
    const historical = JSON.parse(fs.readFileSync(historicalPath, 'utf8')) as {
      assetSha256: string;
    };
    expect(historical.assetSha256).toBe(
      '30392c033bba385738ba7399efa78135f869d2b222b3e86ff7a42f8ed0c75083',
    );
    const expected = {
      registryVersion: SET_IDENTITY_REGISTRY_VERSION,
      boardVersion: SET_IDENTITY_BOARD_VERSION,
      storyKey: STORY_KEY,
      setIdentityId: SET_ID,
      styleId: STYLE_ID,
      setDefinitionHash: computeSetDefinitionHash(source, SET_ID, STYLE_ID),
      contentPolicyDigest: computeSetBoardContentPolicyDigest(definition),
      declaredPropIds: definition.contentPolicy.includedPropIds,
    };
    expect(validateSetIdentityBoardRegistryEntry(historical, expected).ok).toBe(false);
    expect(validateSetIdentityBoardRegistryEntry({
      ...historical,
      registryVersion: 'set-registry/v2',
      boardVersion: 'set-board/v2',
    }, expected).ok).toBe(false);
  });
});
