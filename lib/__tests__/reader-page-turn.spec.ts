import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  pageTurnDirectionForIndexChange,
  readerRestartTransition,
} from '../book-layout/page-turn';
import {
  MOBILE_OVERLAY_LIMITS,
  mobileTextPresentationFor,
} from '../book-layout/adapters/mobile-page';
import {
  readerSourceAccessKey,
  readerSourceBookId,
  readerSourceExitHref,
  type ReaderBookSource,
} from '../reader-book-source';

describe('shared Reader page-turn contract', () => {
  it('derives deterministic forward/backward direction from scene order', () => {
    expect(pageTurnDirectionForIndexChange(1, 2)).toBe('forward');
    expect(pageTurnDirectionForIndexChange(2, 1)).toBe('backward');
    expect(pageTurnDirectionForIndexChange(2, 2)).toBe('initial');
  });

  it('resets restart state without exposing a stale turn direction', () => {
    expect(readerRestartTransition()).toEqual({
      sceneIndex: 0,
      pageTurnDirection: 'initial',
    });
  });

  it('keeps QA and production readers on the same directional data contract', () => {
    const qa = fs.readFileSync(
      path.join(process.cwd(), 'app', 'dev', 'viewer', 'DevBookViewer.tsx'),
      'utf8',
    );
    const reader = fs.readFileSync(
      path.join(process.cwd(), 'app', 'book', '[id]', 'read-v2', 'reader-v2.tsx'),
      'utf8',
    );
    for (const source of [qa, reader]) {
      expect(source).toContain('data-page-turn-direction={pageTurnDirection}');
      expect(source).toContain("data-page-turn-mode={physicalPageTurn ? 'physical-sheet' : 'instant'}");
      expect(source).toContain('<DesktopPhysicalPageTurn');
      expect(source).not.toContain('styles.sceneTurnForward');
      expect(source).not.toContain('styles.sceneTurnBackward');
    }
    expect(reader).toContain('setPageTurnDirection(restart.pageTurnDirection)');
  });

  it('keeps the old whole-book tilt/fade animation removed', () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), 'app', 'book', '[id]', 'read-v2', 'reader-v2.module.css'),
      'utf8',
    );
    expect(css).not.toContain('@keyframes readerPageTurnForward');
    expect(css).not.toContain('@keyframes readerPageTurnBackward');
    expect(css).not.toContain('@keyframes readerPageTurnShadow');
    expect(css).not.toContain('.sceneTurnForward');
    expect(css).not.toContain('.sceneTurnBackward');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('turns a two-segment paper sheet through 180 degrees while the book frame stays static', () => {
    const engine = fs.readFileSync(
      path.join(
        process.cwd(),
        'app',
        'book',
        '[id]',
        'read-v2',
        'components',
        'DesktopPhysicalPageTurn.tsx',
      ),
      'utf8',
    );
    const spread = fs.readFileSync(
      path.join(
        process.cwd(),
        'app',
        'book',
        '[id]',
        'read-v2',
        'components',
        'DesktopBookSpread.tsx',
      ),
      'utf8',
    );
    const css = fs.readFileSync(
      path.join(process.cwd(), 'app', 'book', '[id]', 'read-v2', 'reader-v2.module.css'),
      'utf8',
    );

    expect(engine).toContain('clamped * 180');
    expect(engine).toContain('styles.physicalTurnSegmentSpine');
    expect(engine).toContain('styles.physicalTurnSegmentOuter');
    expect(engine).toContain('styles.physicalTurnFaceBack');
    expect(spread).toContain('{pageTurnOverlay}');
    expect(css).toContain('backface-visibility: hidden');
    expect(css).toContain('rotateY(var(--physical-turn-deg');
  });

  it('keeps short mobile prose over the illustration and moves dense prose to paper', () => {
    expect(mobileTextPresentationFor('A short line for the page.', 'overlay')).toBe('overlay');

    const denseCopy = Array.from(
      { length: MOBILE_OVERLAY_LIMITS.words + 1 },
      (_, index) => `word${index}`,
    ).join(' ');
    expect(mobileTextPresentationFor(denseCopy, 'overlay')).toBe('paper_panel');
  });

  it('keeps captionless mobile scenes captionless even when source text exists', () => {
    expect(mobileTextPresentationFor('Hidden narration.', 'captionless')).toBe('captionless');
    expect(mobileTextPresentationFor('Hidden narration.', 'standard', false)).toBe('captionless');
  });

  it('uses a closed Reader source contract for orders and tracked QA fixtures', () => {
    const order: ReaderBookSource = {
      kind: 'order',
      bookId: 'book/1',
      accessKey: 'key from props',
    };
    const qaFixture: ReaderBookSource = {
      kind: 'qa_fixture',
      payload: {
        id: 'qa-book',
        status: 'QA_FIXTURE_READY',
        book: null,
      },
      exitHref: '/dev/viewer?dir=fixture',
      exitLabel: 'Back to QA library',
    };

    expect(readerSourceBookId(order)).toBe('book/1');
    expect(readerSourceBookId(qaFixture)).toBe('qa-book');
    expect(readerSourceAccessKey(order, 'browser key')).toBe('key from props');
    expect(readerSourceAccessKey({ ...order, accessKey: '' }, 'browser key')).toBe('browser key');
    expect(readerSourceAccessKey(qaFixture, 'ambient key')).toBe('');
    expect(readerSourceExitHref(order, 'resolved key')).toBe(
      '/ready?orderId=book%2F1&accessKey=resolved%20key',
    );
    expect(readerSourceExitHref(qaFixture, 'ignored')).toBe('/dev/viewer?dir=fixture');
  });

  it('routes tracked QA books through the same ReaderV2 controller as production orders', () => {
    const qaRoute = fs.readFileSync(
      path.join(process.cwd(), 'app', 'dev', 'reader', 'page.tsx'),
      'utf8',
    );
    const productionRoute = fs.readFileSync(
      path.join(process.cwd(), 'app', 'book', '[id]', 'read-v2', 'page.tsx'),
      'utf8',
    );
    const mobilePage = fs.readFileSync(
      path.join(
        process.cwd(),
        'app',
        'book',
        '[id]',
        'read-v2',
        'components',
        'MobileBookPage.tsx',
      ),
      'utf8',
    );
    const css = fs.readFileSync(
      path.join(process.cwd(), 'app', 'book', '[id]', 'read-v2', 'reader-v2.module.css'),
      'utf8',
    );

    expect(qaRoute).toContain('trackedQaReaderFixtureForDir');
    expect(qaRoute).toContain("kind: 'qa_fixture'");
    expect(qaRoute).toContain('<ReaderV2');
    expect(productionRoute).toContain("kind: 'order'");
    const reader = fs.readFileSync(
      path.join(process.cwd(), 'app', 'book', '[id]', 'read-v2', 'reader-v2.tsx'),
      'utf8',
    );
    expect(reader).toContain('const EMPTY_DEV_LAYOUT_FLAGS: DevLayoutQueryFlags = {}');
    expect(reader).toContain('devLayoutFlags = EMPTY_DEV_LAYOUT_FLAGS');
    expect(reader).not.toContain('devLayoutFlags = {}');
    expect(mobilePage).toContain("page.textPresentation === 'paper_panel'");
    expect(css).toContain('.mobilePaperPanel');
    expect(css).toContain('width: 44px');
    expect(css).toContain('height: 44px');
  });
});
