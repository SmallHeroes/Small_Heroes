import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import {
  buildPvbVisualContractFactsPromptBlock,
  derivePageVisualContracts,
  materialize,
  validateBookVisualContract,
  type BookVisualContractTemplate,
} from '@/lib/visual-contract-compiler';

const PACKAGE_PATH = path.join(
  process.cwd(),
  'visual-packages',
  'approved',
  'revisions',
  '2b488f2db44702106f49ad80c257b88269972ffb8ebbc92cced95f81c13d98a6.visual-package.json',
);

function template(): BookVisualContractTemplate {
  const packageValue = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8')) as {
    visualContractTemplate: { content: BookVisualContractTemplate };
  };
  return structuredClone(packageValue.visualContractTemplate.content);
}

const PAJAMAS =
  'Soft two-piece sage-green pajamas with a small cream moon print, matching pajama trousers, and cream slipper-socks; exact garments and colours remain unchanged on this page.';

const FAMILY = {
  skinTone: 'warm brown',
  hairColour: 'dark brown',
  hairTexture: 'wavy',
};

describe('page-scoped child wardrobe authority', () => {
  it('changes only the explicitly authored page and projects the exact wardrobe into prompt facts', () => {
    const contract = template();
    contract.pageContracts[7]!.childWardrobeOverride = {
      description: PAJAMAS,
      forbidden: ['day clothes', 'outdoor shoes', 'a second pajama design'],
      origin: {
        kind: 'authored',
        authorNote: 'Product-approved bedtime transition after the child enters bed.',
      },
    };

    expect(validateBookVisualContract(contract).ok).toBe(true);
    const materialized = materialize(contract, FAMILY);
    const pages = derivePageVisualContracts(materialized);
    expect(pages.slice(0, 7).every((page) => page.childWardrobe.description === contract.cast.child.wardrobe.description)).toBe(true);
    expect(pages[7]!.childWardrobe).toEqual({
      description: PAJAMAS,
      forbidden: ['day clothes', 'outdoor shoes', 'a second pajama design'],
    });
    expect(buildPvbVisualContractFactsPromptBlock(pages[7]!, materialized)).toContain(PAJAMAS);
    expect(buildPvbVisualContractFactsPromptBlock(pages[6]!, materialized)).not.toContain(PAJAMAS);
  });

  it('rejects no-op, absent-child, and malformed-origin overrides', () => {
    const noOp = template();
    noOp.pageContracts[0]!.childWardrobeOverride = {
      description: noOp.cast.child.wardrobe.description,
      origin: { kind: 'authored', authorNote: 'no-op' },
    };
    expect(validateBookVisualContract(noOp)).toMatchObject({ ok: false });

    const absent = template();
    absent.pageContracts[0]!.characterPresence.child = false;
    absent.pageContracts[0]!.childWardrobeOverride = {
      description: PAJAMAS,
      origin: { kind: 'authored', authorNote: 'child absent' },
    };
    const absentResult = validateBookVisualContract(absent);
    expect(absentResult.ok).toBe(false);
    if (!absentResult.ok) {
      expect(absentResult.errors).toContain(
        'page 1.childWardrobeOverride requires the child to be present on the page',
      );
    }

    const malformed = template();
    malformed.pageContracts[7]!.childWardrobeOverride = {
      description: PAJAMAS,
      origin: {
        kind: 'story_evidence',
        page: 1,
        phrase: 'wrong page',
      },
    };
    const malformedResult = validateBookVisualContract(malformed);
    expect(malformedResult.ok).toBe(false);
    if (!malformedResult.ok) {
      expect(
        malformedResult.errors.some((entry) =>
          entry.includes('story_evidence must contain exact kind/page/phrase for this page'),
        ),
      ).toBe(true);
    }
  });
});
