import { describe, expect, it } from 'vitest';
import {
  findChildScaleViolations,
  listAllStyle01CompositionCatalogEntries,
} from '../style01-child-scale-validator';
import { buildStyle01CompositionBlock } from '../style01-gptimage';
import { DRAGON_DINI_COMPOSITION_BY_PAGE } from '../dragon-dini-style01-blocks';

describe('style01-child-scale-validator', () => {
  it('does not flag Dini p5 or p11 after medium-scale fix', () => {
    const dini = listAllStyle01CompositionCatalogEntries().filter((e) => e.companionId === 'dragon_dini');
    const violations = findChildScaleViolations(dini);
    const pages = violations.map((v) => v.pageNumber);
    expect(pages).not.toContain(5);
    expect(pages).not.toContain(11);
  });

  it('reports other companions with small+child-present pages', () => {
    const violations = findChildScaleViolations(listAllStyle01CompositionCatalogEntries());
    const dobiSmall = violations.filter((v) => v.companionId === 'bear_cub_gahal');
    expect(dobiSmall.length).toBeGreaterThan(0);
  });

  it('injects IDENTITY COMPOSITION for child-on-page prompts', () => {
    const block = buildStyle01CompositionBlock({
      pageNumber: 5,
      compositionByPage: DRAGON_DINI_COMPOSITION_BY_PAGE,
      childOnPage: true,
    });
    expect(block).toMatch(/IDENTITY COMPOSITION \(child protagonist present\)/);
    expect(block).toMatch(/SUBJECT SCALE: medium/);
    expect(block).toMatch(/35-55/);
  });
});
