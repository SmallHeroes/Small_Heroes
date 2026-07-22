import path from 'path';

import type { ExpectedRegistryIdentity } from './registry';

/** Repo-relative root of the committed board registry. */
export const SET_IDENTITY_BOARD_REGISTRY_DIR = 'set-identity-boards';

function safeSegment(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/\.{2,}/g, '.');
  return cleaned.length === 0 || /^\.+$/.test(cleaned) ? '_' : cleaned;
}

/** Pure path builder shared by offline qualification/promotion and the live read-only resolver. */
export function setIdentityBoardRegistryPath(key: ExpectedRegistryIdentity, rootDir?: string): string {
  return path.join(
    rootDir ?? path.join(process.cwd(), SET_IDENTITY_BOARD_REGISTRY_DIR),
    safeSegment(key.storyKey),
    safeSegment(key.styleId),
    safeSegment(key.setIdentityId),
    `${safeSegment(key.setDefinitionHash)}.json`,
  );
}

export function setIdentityBoardStorageKey(
  key: {
    storyKey: string;
    setIdentityId: string;
    styleId: string;
    setDefinitionHash: string;
    assetSha256: string;
  },
  opts?: { ext?: string },
): string {
  const ext = safeSegment(opts?.ext ?? 'png').replace(/^\.+/, '');
  return [
    SET_IDENTITY_BOARD_REGISTRY_DIR,
    safeSegment(key.storyKey),
    safeSegment(key.styleId),
    safeSegment(key.setIdentityId),
    `${safeSegment(key.setDefinitionHash)}.${safeSegment(key.assetSha256)}.${ext}`,
  ].join('/');
}
