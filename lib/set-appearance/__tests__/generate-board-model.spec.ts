import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The set-appearance board image call used to omit modelOverride, so it fell through to the raw
 * GPT_IMAGE_MODEL env var (generate-image.ts). When that var was empty/misconfigured the board render
 * failed — and the board generates BEFORE page images, so it took down the entire qa-console run with
 * an opaque "model '-' does not exist". This pins that the board now uses resolveStyle01GptModel(),
 * the same resolver every other Style-01 image call uses.
 */

vi.mock('../../generate-image', () => ({ generateGPTImage: vi.fn() }));
vi.mock('../board-qa', () => ({ qaSetAppearanceBoardImage: vi.fn(async () => ({ passed: true, flags: [] })) }));
vi.mock('../board', () => ({
  buildSetAppearanceBoardPrompt: vi.fn(() => 'PROMPT'),
  saveSetAppearanceBoardManifest: vi.fn(),
  setAppearanceBoardImagePath: vi.fn(() => '/tmp/board/scene/set-appearance-board.png'),
}));
vi.mock('fs', () => ({ mkdirSync: vi.fn(), writeFileSync: vi.fn() }));

const ENV_KEY = 'STYLE_01_GPT_MODEL';
let prev: string | undefined;
beforeEach(() => {
  prev = process.env[ENV_KEY];
});
afterEach(() => {
  if (prev === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = prev;
  vi.clearAllMocks();
});

describe('generateSetAppearanceBoard model resolution', () => {
  it('passes modelOverride from resolveStyle01GptModel (e.g. gpt-image-2) — not the raw GPT_IMAGE_MODEL', async () => {
    process.env[ENV_KEY] = 'gpt-image-2';
    const { generateGPTImage } = await import('../../generate-image');
    vi.mocked(generateGPTImage).mockResolvedValue({ buffer: Buffer.from('x') } as never);
    const { generateSetAppearanceBoard } = await import('../generate-board');

    await generateSetAppearanceBoard({
      appearance: { sceneId: 'fixed_interior_night_bedroom_night' } as never,
      styleRefPaths: ['/ref/a.png'],
      quality: 'low',
    });

    expect(generateGPTImage).toHaveBeenCalledTimes(1);
    expect(vi.mocked(generateGPTImage).mock.calls[0][0]).toMatchObject({
      modelOverride: 'gpt-image-2',
    });
  });

  it('still resolves a non-empty model when STYLE_01_GPT_MODEL is unset (default, never empty)', async () => {
    delete process.env[ENV_KEY];
    const { generateGPTImage } = await import('../../generate-image');
    vi.mocked(generateGPTImage).mockResolvedValue({ buffer: Buffer.from('x') } as never);
    const { resolveStyle01GptModel } = await import('../../style01-gptimage');
    const { generateSetAppearanceBoard } = await import('../generate-board');

    await generateSetAppearanceBoard({
      appearance: { sceneId: 's' } as never,
      styleRefPaths: ['/ref/a.png'],
    });

    const passed = vi.mocked(generateGPTImage).mock.calls[0][0].modelOverride;
    expect(passed).toBe(resolveStyle01GptModel());
    expect(passed).toBeTruthy();
  });
});
