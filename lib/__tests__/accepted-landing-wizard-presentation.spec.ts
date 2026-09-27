import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { ROUTES } from '../routes';

const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), 'utf8');

// Render the JSX from the actual branch, not a copied test-only component.
// This tests output navigation only; it does not simulate polling or hydration.
function generatingBranchMarkup(condition: string): string {
  const code = source('app/generating/generating-client.tsx');
  const tree = ts.createSourceFile('generating-client.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const component = tree.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === 'GeneratingClient');
  const branch = component?.body?.statements.find((node): node is ts.IfStatement =>
    ts.isIfStatement(node) && node.expression.getText(tree) === condition);
  if (!branch || !ts.isBlock(branch.thenStatement)) throw new Error('expected generating state branch');
  const result = branch.thenStatement.statements.find(ts.isReturnStatement);
  if (!result?.expression) throw new Error('expected generating state output');
  const js = ts.transpileModule(`(${result.expression.getText(tree)});`, {
    fileName: 'state.tsx', compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const element = vm.runInNewContext(js, {
    React, ROUTES, error: 'fixture error',
    styles: Object.fromEntries(['errorWrap', 'errorIcon', 'errorTitle', 'errorMsg', 'errorBack'].map((key) => [key, key])),
  });
  return renderToStaticMarkup(element);
}

async function readyScreen(data: Record<string, unknown>) {
  const elements = new Map<string, any>();
  const getElement = (id: string) => {
    if (!elements.has(id)) elements.set(id, {
      hidden: ['readyCoverLink', 'readyBook', 'readyError'].includes(id),
      href: '#', src: '', textContent: '', click: vi.fn(),
      setAttribute: vi.fn(), classList: { add: vi.fn(), remove: vi.fn() },
      addEventListener: vi.fn(),
    });
    return elements.get(id);
  };
  const fetch = vi.fn(async () => ({ status: 200, ok: true, json: async () => data }));
  const replace = vi.fn();
  const context = vm.createContext({
    URLSearchParams, console, setTimeout, clearTimeout,
    window: { location: { search: '?orderId=fixture&accessKey=test-key', replace } },
    document: { getElementById: getElement },
    SH_ROUTES: {
      generating: '/generating',
      readerV2: (id: string, key: string) => `/book/${id}/read-v2?accessKey=${key}`,
      listen: (id: string, key: string) => `/book/${id}/listen?accessKey=${key}`,
    },
    fetch, requestAnimationFrame: (fn: () => void) => fn(),
    saveBookToHistory: vi.fn(), track: vi.fn(),
  });
  vm.runInContext(source('public/JS/ready.js'), context);
  await new Promise<void>((resolve) => setImmediate(resolve));
  return { getElement, fetch, replace };
}

describe('accepted Landing and Wizard presentation boundary', () => {
  it.each(['heldReview && !ready', 'error'])('keeps a real home link in the %s state without release actions', (condition) => {
    const html = generatingBranchMarkup(condition);
    expect(html).toContain('<a href="/" class="errorBack">חזרה לדף הבית</a>');
    expect(html.match(/<a\b/g)).toHaveLength(1);
    expect(html).not.toMatch(/<form\b|<button\b|accessKey=|\/read-v2|\/api\//);
  });

  it('keeps the accepted 2027 Landing composition and its required media', () => {
    const page = source('app/page.tsx');
    const landing = source('app/landing/landing-page.tsx');
    const collage = source('app/landing/hero-collage.tsx');
    const spotlight = source('app/components/CompanionSpotlight.tsx');

    expect(page).toContain("import './landing/wow-2027.css'");
    expect(landing).toContain("import { HeroCollage } from './hero-collage'");
    expect(landing).toContain("import { CompanionSpotlight } from '@/app/components/CompanionSpotlight'");
    expect(landing).toContain('data-motion="on"');
    expect(collage.match(/\/Images\/hero-beat-[1-3]\.webp/g)).toEqual([
      '/Images/hero-beat-1.webp',
      '/Images/hero-beat-2.webp',
      '/Images/hero-beat-3.webp',
    ]);
    expect(spotlight).toContain('export function companionSpotlightCutoutSrc');
    expect(spotlight).toContain('export function companionSpotlightWizardHref');

    const requiredMedia = [
      'public/Images/hero-beat-1.webp',
      'public/Images/hero-beat-2.webp',
      'public/Images/hero-beat-3.webp',
      'public/Fonts/SuezOne-Regular.ttf',
      'public/Videos/Chameleon_Idle.mp4',
      'public/Videos/Dragon_Idle.mp4',
      'public/Videos/Fox_Idle.mp4',
      'public/Videos/Lion_Idle.mp4',
      'public/Videos/Panda_Idle.mp4',
      'public/Videos/Rabbit_Idle.mp4',
    ];
    for (const relativePath of requiredMedia) {
      const absolutePath = join(root, relativePath);
      expect(existsSync(absolutePath), relativePath).toBe(true);
      expect(statSync(absolutePath).size, relativePath).toBeGreaterThan(1_024);
    }
  });

  it('keeps the accepted Wizard styling while retaining current sellability and no-photo logic', () => {
    const wizardHtml = source('public/HTML/wizard.html');
    const wizardJs = source('public/JS/wizard.js');
    const matrixResponse = source('lib/web/mvp-matrix-response.ts');

    expect(wizardHtml).toContain('family=Rubik:wght@400;500;600;700;800;900');
    expect(wizardHtml).toContain('/CSS/main.css?v=wow-2027-v2');
    expect(wizardHtml).toContain('/CSS/wizard.css?v=wow-2027-v2');
    expect(wizardJs).toContain("btn.textContent = 'להמשיך בלי תמונה'");
    expect(wizardJs).toContain('const comingSoon = dirMeta.sellable === false');
    expect(wizardJs).not.toContain('const comingSoon = dirMeta.selectable === false');
    expect(matrixResponse).toContain('sellable: boolean');
  });

  it('keeps restored marketing media out of the unreachable debug function bundle', () => {
    const nextConfig = source('next.config.js');

    expect(nextConfig).toContain("excludes['/api/debug/replicate-image']");
    expect(nextConfig).toContain("'./public/Videos/**/*'");
    expect(nextConfig).toContain("'./public/Images/**/*'");
  });

  it('renders the real ready client with its cover and the same keyed reader destination', async () => {
    const { getElement, fetch } = await readyScreen({ status: 'ready', childName: 'נועה', book: {
      title: 'ספר בדיקה', pages: [
        { imageUrl: '/page.png' },
        { isCover: true, imageUrl: '/cover.png' },
        { audioUrl: '/page.mp3' },
      ],
    } });
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/orders/fixture?accessKey=test-key');
    expect(getElement('readyBook').hidden).toBe(false);
    expect(getElement('readyCoverImg').src).toBe('/cover.png');
    expect(getElement('readyCoverLink').hidden).toBe(false);
    expect(getElement('readySparkle').hidden).toBe(true);
    expect(getElement('readyBtnRead').href).toBe('/book/fixture/read-v2?accessKey=test-key');
    const click = getElement('readyCoverLink').addEventListener.mock.calls[0][1];
    click({ preventDefault: vi.fn() });
    expect(getElement('readyBtnRead').click).toHaveBeenCalledOnce();
    expect(getElement('readyBtnAudio').href).toBe('/book/fixture/listen?accessKey=test-key');
    expect(getElement('readyBtnAudio').hidden).toBe(false);
    expect(getElement('readyBtnPdf').hidden).toBe(true);
    expect(getElement('readyBtnVideo').hidden).toBe(true);
  });

  it('keeps the no-cover fallback and does not offer cover-only audio as narration', async () => {
    const { getElement } = await readyScreen({ status: 'partial', book: {
      pages: [{ isCover: true, audioUrl: '/cover.mp3' }],
    } });
    expect(getElement('readyBook').hidden).toBe(false);
    expect(getElement('readyCoverLink').hidden).toBe(true);
    expect(getElement('readySparkle').hidden).toBe(false);
    expect(getElement('readyBtnAudio').hidden).toBe(true);
    expect(source('public/CSS/main.css')).toMatch(/\[hidden\]\s*\{\s*display:\s*none\s*!important/);
  });

  it('does not let the new cover UI present an under-review book as ready', async () => {
    const { getElement, replace } = await readyScreen({ status: 'under_review', book: {
      pages: [{ isCover: true, imageUrl: '/held.png' }],
    } });
    expect(replace).toHaveBeenCalledExactlyOnceWith('/generating?orderId=fixture&accessKey=test-key');
    expect(getElement('readyBook').hidden).toBe(true);
    expect(getElement('readyCoverLink').hidden).toBe(true);
    expect(getElement('readyCoverImg').src).toBe('');
  });
});
