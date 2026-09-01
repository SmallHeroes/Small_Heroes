import path from 'path';

import { describe, expect, it } from 'vitest';

import { mapStyleToDatabaseValue } from '@/lib/styles';
import { canonicalJsonDigest } from '@/lib/visual-package/integrity';
import {
  buildFrozenVisualPackageAuthority,
  loadVisualPackageV4Revision,
} from '@/lib/visual-package/visualPackageV4';

import { buildFrozenStoryProductTruth } from '../frozen-product-truth';
import {
  OrderVisualPackageAuthorityError,
  orderRequiresVisualPackageAuthority,
  requireOrderVisualPackageAuthority,
} from '../order-visual-package-authority';

function currentPackageOrder() {
  const packagePath =
    'visual-packages/approved/revisions/' +
    '2b488f2db44702106f49ad80c257b88269972ffb8ebbc92cced95f81c13d98a6.visual-package.json';
  const packageValue = loadVisualPackageV4Revision({
    repoRoot: process.cwd(),
    packagePath,
    expectedRevisionDigest:
      '2b488f2db44702106f49ad80c257b88269972ffb8ebbc92cced95f81c13d98a6',
  });
  const authority = buildFrozenVisualPackageAuthority({
    packageValue,
    packagePath,
  });
  const frozen = buildFrozenStoryProductTruth({
    storyFilePath: path.join(process.cwd(), ...authority.sourcePath.split('/')),
    expectedPageCount: packageValue.sourceSnapshot.identity.pageCount,
    storyDirection: 'bedtime',
  });
  return {
    ...frozen,
    illustrationStyle: mapStyleToDatabaseValue(
      authority.styleId,
    ),
    visualPackageAuthority: structuredClone(authority),
  };
}

describe('Order Visual Package authority', () => {
  it('accepts the exact package selected for the frozen accepted-revision Order', () => {
    const order = currentPackageOrder();
    expect(orderRequiresVisualPackageAuthority(order)).toBe(true);
    expect(
      canonicalJsonDigest(requireOrderVisualPackageAuthority(order)),
    ).toBe(canonicalJsonDigest(order.visualPackageAuthority));
    expect(order.visualPackageAuthority.sourcePath).toBe(
      order.selectionFilename.replace(/\\/g, '/'),
    );
  });

  it.each([
    ['missing', (order: ReturnType<typeof currentPackageOrder>) => ({ ...order, visualPackageAuthority: null })],
    ['extra key', (order: ReturnType<typeof currentPackageOrder>) => ({
      ...order,
      visualPackageAuthority: { ...order.visualPackageAuthority, hostileExtraKey: 'x' },
    })],
    ['source digest drift', (order: ReturnType<typeof currentPackageOrder>) => ({
      ...order,
      visualPackageAuthority: { ...order.visualPackageAuthority, sourceRawDigest: 'a'.repeat(64) },
    })],
    ['story drift', (order: ReturnType<typeof currentPackageOrder>) => ({
      ...order,
      visualPackageAuthority: { ...order.visualPackageAuthority, storyKey: 'another_story' },
    })],
    ['style drift', (order: ReturnType<typeof currentPackageOrder>) => ({
      ...order,
      visualPackageAuthority: { ...order.visualPackageAuthority, styleId: 'painterly_wonder' },
    })],
  ])('rejects package-backed Order authority that is %s', (_label, mutate) => {
    expect(() => requireOrderVisualPackageAuthority(mutate(currentPackageOrder()))).toThrow(
      OrderVisualPackageAuthorityError,
    );
  });

  it('rejects malformed accepted-revision paths instead of classifying them as legacy', () => {
    const order = currentPackageOrder();
    expect(() =>
      orderRequiresVisualPackageAuthority({
        ...order,
        selectionFilename: path.posix.join(
          'story-pipeline/04_approved_story_sources/accepted',
          'chameleon_koko_bedtime',
          'revisions/not-a-digest/integrated.md',
        ),
      }),
    ).toThrow(OrderVisualPackageAuthorityError);
  });

  it.each([
    ['backslash alias', (value: string) => value.replace(/\//g, '\\')],
    ['leading whitespace alias', (value: string) => ` ${value}`],
    ['trailing whitespace alias', (value: string) => `${value} `],
    ['self-directory ./ alias', (value: string) => `./${value}`],
    ['doubled ./ alias', (value: string) => `././${value}`],
    ['rooted / alias', (value: string) => `/${value}`],
    [
      'doubled-separator namespace alias',
      (value: string) => value.replace('story-pipeline/', 'story-pipeline//'),
    ],
    [
      'doubled-separator story alias',
      (value: string) => value.replace('/revisions/', '//revisions/'),
    ],
    [
      'case alias',
      (value: string) => value.replace('story-pipeline', 'Story-Pipeline'),
    ],
    [
      'uppercase revision digest alias',
      (value: string) =>
        value.replace(/revisions\/([0-9a-f]{64})/, (match) =>
          match.toUpperCase().replace('REVISIONS', 'revisions'),
        ),
    ],
    [
      'parent-segment alias',
      (value: string) =>
        value.replace(
          'accepted/',
          'accepted/../accepted/',
        ),
    ],
    [
      'leading parent-collapse alias',
      (value: string) => `x/../${value}`,
    ],
    [
      'nested parent-collapse alias',
      (value: string) => `x/y/../../${value}`,
    ],
    [
      'interior parent-collapse alias',
      (value: string) =>
        value.replace('story-pipeline/', 'story-pipeline/x/../'),
    ],
    [
      'escaping parent alias',
      (value: string) => `../${value}`,
    ],
    [
      'embedded namespace alias',
      (value: string) => `a/b/${value}`,
    ],
  ])('rejects a noncanonical %s instead of degrading it to legacy', (_label, mutate) => {
    const order = currentPackageOrder();
    const selectionFilename = mutate(order.selectionFilename);
    expect(selectionFilename).not.toBe(order.selectionFilename);
    // Both the discriminator and the full authority reader must fail closed —
    // an aliased accepted spelling must never classify as a legacy Order.
    expect(() =>
      orderRequiresVisualPackageAuthority({ ...order, selectionFilename }),
    ).toThrow(OrderVisualPackageAuthorityError);
    expect(() =>
      requireOrderVisualPackageAuthority({ ...order, selectionFilename }),
    ).toThrow(OrderVisualPackageAuthorityError);
  });

  it.each([
    ['self-directory ./ alias', (value: string) => `./${value}`],
    ['doubled separator alias', (value: string) => value.replace('visual-packages/', 'visual-packages//')],
    ['backslash alias', (value: string) => value.replace(/\//g, '\\')],
    ['trailing whitespace alias', (value: string) => `${value} `],
    ['parent-segment escape', (value: string) => `../${value}`],
    ['absolute path', () => 'C:/visual-packages/approved/revisions/deadbeef.visual-package.json'],
  ])('rejects an authority envelope whose packagePath is a %s', (_label, mutate) => {
    const order = currentPackageOrder();
    expect(() =>
      requireOrderVisualPackageAuthority({
        ...order,
        visualPackageAuthority: {
          ...order.visualPackageAuthority,
          packagePath: mutate(order.visualPackageAuthority.packagePath),
        },
      }),
    ).toThrow(OrderVisualPackageAuthorityError);
  });

  it('rejects an authority envelope whose packagePath does not name its own revision digest', () => {
    const order = currentPackageOrder();
    expect(() =>
      requireOrderVisualPackageAuthority({
        ...order,
        visualPackageAuthority: {
          ...order.visualPackageAuthority,
          packagePath: `visual-packages/approved/revisions/${'9'.repeat(64)}.visual-package.json`,
        },
      }),
    ).toThrow(OrderVisualPackageAuthorityError);
  });

  it('keeps a genuine story-bank Order legacy and rejects an injected package envelope', () => {
    const packageOrder = currentPackageOrder();
    const legacy = {
      selectionFilename: 'story-bank/v3-approved/bunny_ometz_bedtime.md',
      storySourceHash: 'b'.repeat(64),
      illustrationStyle: mapStyleToDatabaseValue('soft_hand_drawn_storybook'),
      visualPackageAuthority: null,
    };
    expect(orderRequiresVisualPackageAuthority(legacy)).toBe(false);
    expect(requireOrderVisualPackageAuthority(legacy)).toBeNull();
    expect(() =>
      requireOrderVisualPackageAuthority({
        ...legacy,
        visualPackageAuthority: packageOrder.visualPackageAuthority,
      }),
    ).toThrow(OrderVisualPackageAuthorityError);
  });
});
