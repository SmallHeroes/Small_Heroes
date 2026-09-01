import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const wizardSource = readFileSync('public/JS/wizard.js', 'utf8');

type DirectionMetadata = {
  sellable: boolean;
  selectable: boolean;
};

type FakeCard = {
  className: string;
  disabled?: boolean;
  listeners: Map<string, () => void>;
  attributes: Map<string, string>;
  addEventListener: (event: string, listener: () => void) => void;
  setAttribute: (name: string, value: string) => void;
};

function loadRenderProductCards(direction: DirectionMetadata, productId: string | null = null) {
  const start = wizardSource.indexOf('function renderProductCards() {');
  const end = wizardSource.indexOf('\nfunction renderStyleStepGrid()', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const functionSource = wizardSource.slice(start, end);

  const cards: FakeCard[] = [];
  const wrap = {
    innerHTML: '',
    style: { direction: '' },
    appendChild(card: FakeCard) {
      cards.push(card);
    },
  };
  const continueButton = { disabled: true };
  const document = {
    getElementById(id: string) {
      if (id === 'product-cards') return wrap;
      if (id === 'btn-continue') return continueButton;
      return null;
    },
    createElement() {
      const card: FakeCard = {
        className: '',
        listeners: new Map(),
        attributes: new Map(),
        addEventListener(event, listener) {
          this.listeners.set(event, listener);
        },
        setAttribute(name, value) {
          this.attributes.set(name, value);
        },
      };
      return card;
    },
  };
  const state = {
    currentStep: 8,
    productId,
    storyDirection: productId,
    priceILS: productId ? 59 : null,
    productTruth: productId ? {} : null,
  };
  const productPackages = [
    {
      id: 'bedtime',
      featured: false,
      includes: [],
      pages: 8,
      priceILS: 59,
      productName: 'Bedtime',
    },
  ];

  const factory = new Function(
    'state',
    'document',
    'WIZ',
    'PRODUCT_PACKAGES',
    'getDirectionSellability',
    'PRODUCT_ORIGINAL_PRICES',
    'applyProductSelection',
    'queueWizardSave',
    `${functionSource}; return renderProductCards;`,
  ) as (...args: unknown[]) => () => void;
  const renderProductCards = factory(
    state,
    document,
    { steps: { product: {} } },
    productPackages,
    () => direction,
    {},
    () => undefined,
    () => undefined,
  );

  renderProductCards();
  return { card: cards[0], state };
}

describe('Wizard customer product sellability contract', () => {
  it('uses product sellability, not QA/render selectability, for product cards', () => {
    expect(wizardSource).toContain('const comingSoon = dirMeta.sellable === false;');
    expect(wizardSource).not.toContain('const comingSoon = dirMeta.selectable === false;');
  });

  it('enables a sellable product even when internal QA selectability is false', () => {
    const { card, state } = loadRenderProductCards(
      { sellable: true, selectable: false },
      'bedtime',
    );

    expect(card.disabled).not.toBe(true);
    expect(card.className).not.toContain('product-card-coming-soon');
    expect(card.listeners.has('click')).toBe(true);
    expect(state.productId).toBe('bedtime');
  });

  it('disables and clears a non-sellable product regardless of QA selectability', () => {
    const { card, state } = loadRenderProductCards(
      { sellable: false, selectable: true },
      'bedtime',
    );

    expect(card.disabled).toBe(true);
    expect(card.className).toContain('product-card-coming-soon');
    expect(card.listeners.has('click')).toBe(false);
    expect(state.productId).toBeNull();
    expect(state.storyDirection).toBeNull();
  });

  it('invalidates restored selections only when the product is no longer sellable', () => {
    expect(wizardSource).toContain(
      'if (state.productId && !getDirectionSellability(state.productId).sellable) {',
    );
    expect(wizardSource).not.toContain(
      'if (state.productId && !getDirectionSellability(state.productId).selectable) {',
    );
  });

  it('keeps missing matrix directions fail-closed', () => {
    expect(wizardSource).toContain(
      "{ sellable: false, selectable: false, configured: 'missing' }",
    );
  });

  it('keeps the server order route as the final MVP slot authority', () => {
    const orderHandler = readFileSync('app/api/orders/handler.ts', 'utf8');
    expect(orderHandler).toContain('const enforced = enforceMvpOrderSlot({');
    expect(orderHandler).toContain('clientDirection: product?.direction');
    expect(orderHandler).toContain('clientCompanionId: storedCompanionId');
  });
});
