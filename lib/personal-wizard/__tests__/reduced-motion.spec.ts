import { readFileSync } from 'fs';
import { join } from 'path';

import { describe, expect, it } from 'vitest';

/**
 * Reduced motion must win the cascade, not merely be written down (Codex UI review, P2-1: the
 * override sat above the animation rules it meant to stop, so with equal specificity they won).
 * This resolves the prototype stylesheet's cascade for every moving element, with the reduced-motion
 * preference on and off: origin order, specificity and !important, with rules in any other media
 * query counted as possibly matching. The browser check of the same elements is in the evidence doc.
 */
const CSS_PATH = join(process.cwd(), 'app/dev/personal-wizard/personal-wizard.module.css');
const REDUCE = '(prefers-reduced-motion: reduce)';

type Rule = { selectors: string[]; declarations: Map<string, { value: string; important: boolean }>; media: string | null; order: number };

/** Plain CSS as used by the module: comments, rules, @media and @keyframes. No braces in strings. */
function parseRules(css: string): Rule[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: Rule[] = [];
  const walk = (block: string, media: string | null) => {
    let at = 0;
    while (at < block.length) {
      const open = block.indexOf('{', at);
      if (open === -1) break;
      let depth = 1;
      let close = open + 1;
      for (; close < block.length && depth > 0; close += 1) {
        if (block[close] === '{') depth += 1;
        else if (block[close] === '}') depth -= 1;
      }
      const prelude = block.slice(at, open).trim();
      const body = block.slice(open + 1, close - 1);
      if (prelude.startsWith('@media')) walk(body, prelude.slice('@media'.length).trim());
      else if (!prelude.startsWith('@')) {
        const declarations = new Map<string, { value: string; important: boolean }>();
        for (const part of body.split(';')) {
          const colon = part.indexOf(':');
          if (colon === -1) continue;
          const raw = part.slice(colon + 1).trim();
          declarations.set(part.slice(0, colon).trim(), {
            value: raw.replace(/\s*!important$/, ''),
            important: raw.endsWith('!important'),
          });
        }
        rules.push({
          selectors: prelude.split(',').map((selector) => selector.trim().replace(/\s+/g, ' ')),
          declarations,
          media,
          order: rules.length,
        });
      }
      at = close;
    }
  };
  walk(text, null);
  return rules;
}

/** Specificity for the selector forms this stylesheet uses; :not() and :has() count their argument. */
function specificity(selector: string): [number, number, number] {
  const total: [number, number, number] = [0, 0, 0];
  let rest = selector.replace(/:(?:not|has)\(([^()]*)\)/g, (_, inner: string) => {
    const [a, b, c] = specificity(inner);
    total[0] += a;
    total[1] += b;
    total[2] += c;
    return '';
  });
  const count = (pattern: RegExp, index: 0 | 1 | 2) => {
    rest = rest.replace(pattern, () => {
      total[index] += 1;
      return ' ';
    });
  };
  count(/\[[^\]]*\]/g, 1);
  count(/::[\w-]+/g, 2);
  count(/:[\w-]+(?:\([^)]*\))?/g, 1);
  count(/#[\w-]+/g, 0);
  count(/\.[\w-]+/g, 1);
  for (const token of rest.split(/[\s>+~]+/)) if (/^[a-z][\w-]*$/i.test(token)) total[2] += 1;
  return total;
}

const compare = (left: [number, number, number], right: [number, number, number]) =>
  left[0] - right[0] || left[1] - right[1] || left[2] - right[2];

type Motion = 'reduce' | 'no-preference';
type Property = 'animation' | 'transform';

/**
 * The winning value of `property` for an element matched by exactly `selectors`. A rule in
 * the reduced-motion query applies only when motion is reduced; a rule in any other media query is
 * counted as applying (some viewport matches it), which can only make this check stricter.
 */
function winning(rules: Rule[], selectors: readonly string[], property: Property, motion: Motion): string | null {
  const names = property === 'animation' ? ['animation', 'animation-name'] : ['transform'];
  let best: { important: boolean; specificity: [number, number, number]; order: number; value: string } | null = null;
  for (const rule of rules) {
    if (rule.media === REDUCE && motion !== 'reduce') continue;
    for (const selector of rule.selectors) {
      if (!selectors.includes(selector)) continue;
      for (const name of names) {
        const declaration = rule.declarations.get(name);
        if (!declaration) continue;
        const candidate = { important: declaration.important, specificity: specificity(selector), order: rule.order, value: declaration.value };
        const wins =
          !best ||
          (candidate.important !== best.important
            ? candidate.important
            : compare(candidate.specificity, best.specificity) > 0 ||
              (compare(candidate.specificity, best.specificity) === 0 && candidate.order >= best.order));
        if (wins) best = candidate;
      }
    }
  }
  return best?.value ?? null;
}

/** The keyframes an `animation` value runs, or 'none'. */
const animationName = (value: string | null, keyframes: ReadonlySet<string>) =>
  value === null ? null : value.trim() === 'none' ? 'none' : (value.split(/\s+/).find((token) => keyframes.has(token)) ?? value);

/** Every moving element of the prototype, by the exact selectors that match it. */
const bars = (parent: string, count: number) =>
  Array.from({ length: count }, (_, index) => ({
    name: `${parent} bar ${index + 1}`,
    selectors: index === 0 ? [`${parent} > span`] : [`${parent} > span`, `${parent} > span:nth-child(${index + 1})`],
    property: 'animation' as const,
  }));
const TARGETS: { name: string; selectors: string[]; property: Property }[] = [
  ...bars('.decodeWave', 6),
  ...bars('.decodeFlow', 3),
  ...bars('.decodeLines', 3),
  ...[1, 2, 3].map((spark) => ({ name: `spark ${spark}`, selectors: ['.decodeSpark', `.decodeSpark[data-spark='${spark}']`], property: 'animation' as const })),
  { name: 'decoding step', selectors: ['.decodeStep'], property: 'animation' },
  // The voice stage: the halos breathe at rest and follow the measured input level while listening.
  { name: 'idle halo', selectors: ['.halo'], property: 'animation' },
  { name: 'idle halo 2', selectors: ['.halo', ".halo[data-halo='2']"], property: 'animation' },
  { name: 'voice halo 1', selectors: ['.halo', ".stage[data-phase='recording'] .halo"], property: 'transform' },
  {
    name: 'voice halo 2',
    selectors: [
      '.halo',
      ".halo[data-halo='2']",
      ".stage[data-phase='recording'] .halo",
      ".stage[data-phase='recording'] .halo[data-halo='2']",
    ],
    property: 'transform',
  },
  { name: 'cue entrance', selectors: ['.cueArc > .cueTag'], property: 'animation' },
  { name: 'recording dot', selectors: ['.recDot', '.recDot[data-live]'], property: 'animation' },
  { name: 'microphone hover', selectors: ['.recordCircle', '.recordButton:hover .recordCircle'], property: 'transform' },
  { name: 'companion hover', selectors: ['.companionCard', '.companionCard:hover'], property: 'transform' },
  { name: 'continue hover', selectors: ['.btnContinue', '.btnContinue:hover:not(:disabled)'], property: 'transform' },
];

function motionOf(css: string) {
  const rules = parseRules(css);
  const keyframes = new Set([...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((match) => match[1]));
  return {
    rules,
    resolve: (motion: Motion) =>
      Object.fromEntries(
        TARGETS.map((target) => {
          const value = winning(rules, target.selectors, target.property, motion);
          return [target.name, target.property === 'animation' ? animationName(value, keyframes) : value];
        }),
      ) as Record<string, string | null>,
  };
}

const css = readFileSync(CSS_PATH, 'utf8');

describe('reduced motion wins the cascade in the prototype stylesheet', () => {
  it('the specificity used here agrees with the selectors that matter', () => {
    expect(specificity('.decodeWave > span')).toEqual([0, 1, 1]);
    expect(specificity('.decodeWave > span:nth-child(2)')).toEqual([0, 2, 1]);
    expect(specificity(".decodeSpark[data-spark='2']")).toEqual([0, 2, 0]);
    expect(specificity('.recordButton:hover .recordCircle')).toEqual([0, 3, 0]);
    expect(specificity('.btnContinue:hover:not(:disabled)')).toEqual([0, 3, 0]);
    expect(specificity('.companionCard:has(input:focus-visible)')).toEqual([0, 2, 1]);
  });

  it('with reduced motion every moving element resolves to no animation and no hover movement', () => {
    const resolved = motionOf(css).resolve('reduce');
    for (const target of TARGETS) expect([target.name, resolved[target.name]]).toEqual([target.name, 'none']);
  });

  it('without it, the same elements keep their animation and hover movement', () => {
    const resolved = motionOf(css).resolve('no-preference');
    const expected: Record<string, string> = {
      'decoding step': 'pw-step-in',
      'idle halo': 'pw-glow',
      'idle halo 2': 'pw-glow',
      'voice halo 1': 'scale(calc(1 + var(--level, 0) * 0.32))',
      'voice halo 2': 'scale(calc(1 + var(--level, 0) * 0.5))',
      'cue entrance': 'pw-cue-in',
      'recording dot': 'pw-pulse',
      'microphone hover': 'scale(1.03)',
      'companion hover': 'translateY(-2px)',
      'continue hover': 'translateY(-1px)',
    };
    for (const target of TARGETS) {
      const name = target.name.startsWith('.decodeWave')
        ? 'pw-wave'
        : target.name.startsWith('.decodeFlow')
          ? 'pw-flow'
          : target.name.startsWith('.decodeLines')
            ? 'pw-write'
            : target.name.startsWith('spark')
              ? 'pw-twinkle'
              : expected[target.name];
      expect([target.name, resolved[target.name]]).toEqual([target.name, name]);
    }
  });

  it('no animation or hover movement exists that this check does not cover', () => {
    const covered = new Set(TARGETS.flatMap((target) => target.selectors));
    const uncovered = motionOf(css)
      .rules.filter((rule) => rule.media !== REDUCE)
      .flatMap((rule) =>
        rule.selectors.filter((selector) => {
          const animation = rule.declarations.get('animation') ?? rule.declarations.get('animation-name');
          const moves = (animation && animation.value !== 'none') || (selector.includes(':hover') && rule.declarations.has('transform'));
          return moves && !covered.has(selector);
        }),
      );
    expect(uncovered).toEqual([]);
  });

  it('control: the block back where it was (the reviewed defect) leaves exactly those elements moving', () => {
    const at = css.lastIndexOf('@media (prefers-reduced-motion: reduce)');
    const marker = '/* ── Live intake (P2)';
    expect(at).toBeGreaterThan(css.indexOf(marker));
    const defect = css.slice(0, at).replace(marker, `${css.slice(at)}\n\n${marker}`);
    const resolved = motionOf(defect).resolve('reduce');
    const stillMoving = TARGETS.filter((target) => resolved[target.name] !== 'none').map((target) => target.name);
    expect(stillMoving).toEqual([
      ...TARGETS.filter((target) => target.name.startsWith('.decode') || target.name.startsWith('spark') || target.name === 'decoding step').map(
        (target) => target.name,
      ),
      'idle halo',
      'idle halo 2',
      'voice halo 1',
      'voice halo 2',
      'cue entrance',
      'microphone hover',
    ]);
  });
});
