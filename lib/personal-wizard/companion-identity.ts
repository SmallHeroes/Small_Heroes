import 'server-only';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

/**
 * A companion's DRAWING identity: its own complete style01 sheet set (every view passed in its manifest). The engine draws a book's
 * companion from that set's front view. Card art is a presentation choice only and is never the drawing reference (bunny's card is its
 * happy view). A companion without a complete passed set has no drawing identity and is not selectable for a book.
 */
export const COMPANION_SHEET_VIEWS = Object.freeze({ front: 'front.png', three_quarter_front: '3-4.png', side: 'side.png',
  three_quarter_back: 'back.png', happy: 'happy.png', theme: 'theme.png' } as const);
export class CompanionIdentityError extends Error { constructor(readonly code: string) { super(code); } }
const fail = (code: string): never => { throw new CompanionIdentityError(code); };

function sheetsDirectory(id: string, root: string) {
  if (!/^[a-z][a-z0-9_]{1,40}$/.test(id)) fail('companion_identity_id');
  return path.join(root, 'public', 'companions', id, 'style01-sheets');
}
/** The complete passed sheet set, or a refusal naming what is missing. */
function verifiedSheets(id: string, root: string) {
  const dir = sheetsDirectory(id, root), manifestFile = path.join(dir, 'manifest.json');
  if (!existsSync(manifestFile)) fail('companion_identity_missing');
  let manifest: { companionId?: unknown; views?: Record<string, { filename?: unknown; qaStatus?: unknown }> };
  try { manifest = JSON.parse(readFileSync(manifestFile, 'utf8')); } catch { return fail('companion_identity_manifest'); }
  if (manifest.companionId !== id) fail('companion_identity_manifest');
  for (const [view, filename] of Object.entries(COMPANION_SHEET_VIEWS)) {
    const entry = manifest.views?.[view], file = path.join(dir, filename);
    if (entry?.filename !== filename || entry.qaStatus !== 'passed') fail('companion_identity_unqualified');
    if (!existsSync(file) || !statSync(file).isFile() || statSync(file).size <= 1000) fail('companion_identity_missing');
  }
  return dir;
}
/** The drawing reference of a companion: its passed front sheet (public path, absolute file and bytes hash). */
export function companionIdentityReference(id: string, root: string = process.cwd()) {
  const file = path.join(verifiedSheets(id, root), COMPANION_SHEET_VIEWS.front);
  return { companionId: id, publicPath: `/companions/${id}/style01-sheets/${COMPANION_SHEET_VIEWS.front}`, file,
    sha256: createHash('sha256').update(readFileSync(file)).digest('hex') };
}
export function companionSheetsComplete(id: string, root: string = process.cwd()) {
  try { verifiedSheets(id, root); return true; } catch { return false; }
}
