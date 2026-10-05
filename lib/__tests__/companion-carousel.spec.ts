import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { PERSONAL_COMPANION_CAROUSEL } from '@/content/personal-landing';
import * as geometry from '@/lib/web/companion-carousel';
import { driftOffset, driftTimeForScroll, stillScrollLeft } from '@/lib/web/companion-carousel';

type Element = { type: unknown; props: Record<string, any>; key?: unknown };
type Friend = { id: string; name: string; line: string; image: string };

/**
 * The actual component, transpiled from the branch and rendered once with inert stand-in hooks (the pattern of
 * voice-stage-lifecycle.spec.ts): it checks the element tree it returns, not a browser, layout or CSS.
 */
function renderCarousel(friends: Friend[], startHref: string): Element {
  const source = readFileSync(join(process.cwd(), 'app/landing/personal-companion-carousel.tsx'), 'utf8');
  const compiled = ts.transpileModule(source, {
    fileName: 'personal-companion-carousel.tsx',
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const hooks = {
    useState: (initial: unknown) => [initial, () => {}],
    useRef: (initial: unknown) => ({ current: initial }),
    useEffect: () => {},
    useLayoutEffect: () => {},
  };
  const jsx = (type: unknown, props: Record<string, any>, key?: unknown): Element => ({ type, props: props ?? {}, key });
  const module = { exports: {} as Record<string, any> };
  vm.runInNewContext(compiled, {
    module, exports: module.exports,
    require: (name: string) => {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
      if (name === '@/content/personal-landing') return { PERSONAL_COMPANION_CAROUSEL };
      if (name === '@/lib/web/companion-carousel') return geometry;
      throw new Error(`unexpected import: ${name}`);
    },
  }, { filename: 'personal-companion-carousel.tsx' });
  return module.exports.PersonalCompanionCarousel({ friends, startHref });
}

function collect(value: unknown, type: string, found: Element[] = []): Element[] {
  if (Array.isArray(value)) { value.forEach((item) => collect(item, type, found)); return found; }
  if (!value || typeof value !== 'object' || !('props' in value)) return found;
  const element = value as Element;
  if (element.type === type) found.push(element);
  collect(element.props.children, type, found);
  return found;
}

/**
 * The personal landing's drifting friends row (Codex QA of 43a5116d, P2-1 and P2-2): every card the parent can
 * see must be a working choice through the whole loop, the reading order must meet each friend once, and a
 * stopped row must open exactly where the drift stood and continue from where it is left.
 */
const W = 3068; // one copy of thirteen 236px cards, as measured in Chrome at 1440px
const LOOP_MS = 84_500; // 13 x 6.5s

describe('friends row geometry', () => {
  it('reads the drift as a distance into one copy of the row', () => {
    expect(driftOffset(0, W)).toBe(0);
    expect(driftOffset(546.4, W)).toBeCloseTo(546.4);
    expect(driftOffset(W, W)).toBe(0);
    expect(driftOffset(W + 32, W)).toBe(32);
    expect(driftOffset(-10, W)).toBe(W - 10);
    expect(driftOffset(500, 0)).toBe(0);
    expect(driftOffset(Number.NaN, W)).toBe(0);
  });

  it('opens the still row where the drift stood (right to left: further along is negative)', () => {
    expect(stillScrollLeft(0)).toBe(0);
    expect(stillScrollLeft(546.4)).toBe(-546.4);
  });

  it('resumes the drift from wherever the still row was left, so neither switch jumps', () => {
    for (const offset of [0, 1, 236, 1500, W - 1]) {
      const time = driftTimeForScroll(stillScrollLeft(offset), W, LOOP_MS);
      expect((time / LOOP_MS) * W).toBeCloseTo(offset, 6);
    }
    // scrolled on into the second copy: the same picture as the first copy
    expect(driftTimeForScroll(-(W + 100), W, LOOP_MS)).toBeCloseTo((100 / W) * LOOP_MS, 6);
    expect(driftTimeForScroll(-100, 0, LOOP_MS)).toBe(0);
    expect(driftTimeForScroll(-100, W, 0)).toBe(0);
  });
});

describe('friends row markup (real component)', () => {
  const friends: Friend[] = ['dragon_dini', 'panda_anat', 'hedgehog_tuti'].map((id) => ({ id, name: `name ${id}`, line: `line ${id}`, image: `/art/${id}.webp` }));
  const tree = renderCarousel(friends, '/dev/personal-wizard');
  const items = collect(tree, 'li');
  const links = items.map((item) => collect(item.props.children, 'a')[0]);

  it('renders the friends twice, and no card is inert', () => {
    expect(items).toHaveLength(friends.length * 2);
    for (const element of [...items, ...links]) expect(element.props.inert).toBeUndefined();
  });

  it('makes every visible card, in both copies, a link to the wizard with that friend chosen', () => {
    links.forEach((link, index) => {
      expect(link.props.href).toBe(`/dev/personal-wizard?companion=${friends[index % friends.length].id}`);
      expect(link.props['data-companion']).toBe(friends[index % friends.length].id);
    });
  });

  it('meets each friend once in the reading and tab order: the loop copy is hidden and skipped, not disabled', () => {
    items.forEach((item, index) => {
      const loop = index >= friends.length;
      expect(item.props['aria-hidden']).toBe(loop ? true : undefined);
      expect(links[index].props.tabIndex).toBe(loop ? -1 : undefined);
    });
  });

  it('offers the stop control by name, and keyboard focus is wired to stop and reveal', () => {
    const [button] = collect(tree, 'button');
    expect(button.props.className).toBe('pcc-toggle');
    expect(JSON.stringify(button.props.children)).toContain(PERSONAL_COMPANION_CAROUSEL.pause);
    const [viewport] = collect(tree, 'div').filter((element) => element.props.className === 'pcc-viewport');
    expect(typeof viewport.props.onFocus).toBe('function');
  });
});

describe('friends row stopped state', () => {
  const css = readFileSync(join(process.cwd(), 'app/dev/personal-product/personal-wow.css'), 'utf8');
  it('turns a stopped row into a still scroller with room for the focus ring', () => {
    expect(css).toMatch(/\.pcc\[data-paused\] \.pcc-track \{ animation: none; \}/);
    const stopped = css.match(/\.pcc\[data-paused\] \.pcc-viewport \{([^}]*)\}/)?.[1] ?? '';
    expect(stopped).toContain('overflow-x: auto');
    expect(stopped).toMatch(/scroll-padding-inline: \d+px/);
  });
});
