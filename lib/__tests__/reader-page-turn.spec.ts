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
      expect(source).toContain('styles.sceneTurnForward');
      expect(source).toContain('styles.sceneTurnBackward');
    }
    expect(reader).toContain('setPageTurnDirection(restart.pageTurnDirection)');
  });

  it('provides motion reduction and two distinct directional animations', () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), 'app', 'book', '[id]', 'read-v2', 'reader-v2.module.css'),
      'utf8',
    );
    expect(css).toContain('@keyframes readerPageTurnForward');
    expect(css).toContain('@keyframes readerPageTurnBackward');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
