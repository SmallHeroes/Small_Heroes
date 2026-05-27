import { describe, expect, it } from 'vitest';
import { adaptLegacyBookToStoryScenes, buildRenderedBookMeta } from '../legacy-adapter';

describe('legacy book adapter', () => {
  it('maps legacy pages to StoryScene with defaults', () => {
    const scenes = adaptLegacyBookToStoryScenes({
      book: {
        pages: [
          { pageNumber: 0, text: '', imageUrl: '/cover.png', isCover: true },
          {
            pageNumber: 1,
            text: 'בבוקר קם ילד קטן.',
            imageUrl: '/p1.png',
          },
        ],
      },
      storyDirection: 'bedtime',
    });
    expect(scenes).toHaveLength(2);
    expect(scenes[0]?.kind).toBe('cover');
    expect(scenes[1]?.kind).toBe('story');
    expect(scenes[1]?.direction).toBe('bedtime');
    expect(scenes[1]?.effectiveLayout).toBe('standard');
    const meta = buildRenderedBookMeta(scenes);
    expect(meta.layoutVersion).toBe('book-layout-v1');
    expect(meta.templateVersion).toBe('bedtime-v1');
    expect(meta.sceneCount).toBe(1);
  });

  it('degrades wide-spread without wide asset to standard layout', () => {
    const scenes = adaptLegacyBookToStoryScenes({
      book: {
        pages: [
          {
            pageNumber: 1,
            text: 'טקסט קצר',
            imageUrl: '/p.png',
            layout: 'wide-spread',
            illustrationAspect: 'portrait',
          },
        ],
      },
      storyDirection: 'bedtime',
    });
    expect(scenes[0]?.effectiveLayout).toBe('standard');
  });
});
