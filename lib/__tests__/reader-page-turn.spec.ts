import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  pageTurnDirectionForIndexChange,
  readerRestartTransition,
} from '../book-layout/page-turn';

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
});
