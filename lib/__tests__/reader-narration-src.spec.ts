import { describe, expect, it } from 'vitest';

import {
  COVER_NO_AUDIO_ADVANCE_MS,
  narrationAudioSrcForScene,
} from '../../app/book/[id]/read-v2/reader-v2';
import type { StoryScene } from '@/lib/book-layout';

function scene(partial: Partial<StoryScene> & Pick<StoryScene, 'kind'>): StoryScene {
  return {
    sceneIndex: 0,
    sceneId: 'scene-0',
    text: '',
    illustration: { imageUrl: null, aspect: 'portrait', alt: '' },
    direction: 'adventure',
    layout: 'standard',
    illustrationAspect: 'portrait',
    textTreatment: 'standard',
    audioUrl: null,
    title: null,
    effectiveLayout: 'standard',
    effectiveTextTreatment: 'standard',
    ...partial,
  };
}

describe('narrationAudioSrcForScene', () => {
  it('uses cover title clip only (not whole-book fallback)', () => {
    const cover = scene({ kind: 'cover', audioUrl: 'https://cdn.example/cover.mp3' });
    expect(narrationAudioSrcForScene(cover, 'https://cdn.example/book.mp3')).toBe(
      'https://cdn.example/cover.mp3'
    );
    expect(narrationAudioSrcForScene(scene({ kind: 'cover' }), 'https://cdn.example/book.mp3')).toBe(
      null
    );
  });

  it('falls back to whole-book audio for interior story scenes', () => {
    const story = scene({ kind: 'story', sceneIndex: 1, sceneId: 'scene-1' });
    expect(narrationAudioSrcForScene(story, 'https://cdn.example/book.mp3')).toBe(
      'https://cdn.example/book.mp3'
    );
    expect(narrationAudioSrcForScene(story, null)).toBe(null);
  });

  it('skips dedication and captionless scenes', () => {
    const dedication = scene({ kind: 'dedication', audioUrl: 'https://cdn.example/d.mp3' });
    expect(narrationAudioSrcForScene(dedication, 'https://cdn.example/book.mp3')).toBe(null);

    const captionless = scene({
      kind: 'story',
      sceneIndex: 2,
      sceneId: 'scene-2',
      effectiveTextTreatment: 'captionless',
      audioUrl: 'https://cdn.example/p2.mp3',
    });
    expect(narrationAudioSrcForScene(captionless, 'https://cdn.example/book.mp3')).toBe(null);
  });
});

describe('COVER_NO_AUDIO_ADVANCE_MS', () => {
  it('is a 2 second cover dwell when title audio is absent', () => {
    expect(COVER_NO_AUDIO_ADVANCE_MS).toBe(2000);
  });
});
