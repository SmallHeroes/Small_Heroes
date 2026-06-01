import { GENERATION_VERSION } from './constants';

export type ArtifactKind = 'cover' | 'page_image' | 'page_audio';

export function buildArtifactIdempotencyKey(input: {
  orderId: string;
  kind: ArtifactKind;
  pageNumber?: number;
  model?: string;
  quality?: string;
  generationVersion?: number;
}): string {
  const pagePart =
    input.kind === 'cover' ? 'cover' : `p${input.pageNumber ?? 0}`;
  const model = (input.model ?? 'gpt-image-2').replace(/\s+/g, '_');
  const quality = (input.quality ?? 'low').replace(/\s+/g, '_');
  const ver = input.generationVersion ?? GENERATION_VERSION;
  return `${input.orderId}:${input.kind}:${pagePart}:${model}:${quality}:v${ver}`;
}

export function isValidImageAssetUrl(url: string | null | undefined): boolean {
  const u = (url ?? '').trim();
  return u.length > 8 && (u.startsWith('http://') || u.startsWith('https://'));
}
