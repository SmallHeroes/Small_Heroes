import { existsSync } from 'fs';
import { join } from 'path';
import type { Companion } from './companions';
import { getCompanionReferencePublicUrl } from './companions';

/**
 * Resolve a reference image source to a fetchable URL or absolute local path.
 * Supports public asset paths (/companions/...), http(s) URLs, and absolute paths.
 */
export function resolveReferenceImageSource(source: string, baseUrl?: string): string {
  const trimmed = source.trim();
  if (!trimmed) return trimmed;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  if (existsSync(trimmed)) {
    return trimmed;
  }

  const publicRel = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  const publicAbs = join(process.cwd(), 'public', publicRel);
  if (existsSync(publicAbs)) {
    return publicAbs;
  }

  if (baseUrl && trimmed.startsWith('/')) {
    const url = getCompanionReferencePublicUrl(
      { image: trimmed } as Companion,
      baseUrl
    );
    if (url) return url;
  }

  return trimmed;
}

/**
 * Build gpt-image `images.edit` reference list: child photo first, companion sheet second.
 */
export function mergeGptImageReferenceSources(
  childPhotoUrl: string | null | undefined,
  companion: Companion | null | undefined,
  baseUrl?: string
): string[] | undefined {
  const refs: string[] = [];

  if (childPhotoUrl?.trim()) {
    refs.push(resolveReferenceImageSource(childPhotoUrl.trim(), baseUrl));
  }

  if (companion?.image?.trim()) {
    const companionSource = resolveReferenceImageSource(companion.image.trim(), baseUrl);
    if (companionSource && !refs.includes(companionSource)) {
      refs.push(companionSource);
    }
  }

  return refs.length > 0 ? refs : undefined;
}
