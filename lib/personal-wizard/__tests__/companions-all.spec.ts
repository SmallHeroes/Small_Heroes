import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { getCompanionById } from '../../companions';
import { companionIdentityReference, companionSheetsComplete, COMPANION_SHEET_VIEWS } from '../companion-identity';
import { PERSONAL_ADDED_COMPANIONS, personalCompanionVisual } from '../personal-companions';
import { resolvePersonalWizardOptions, companionDrawable, PROTOTYPE_COMPANION_ROSTER, PERSONAL_COMPANION_IDS } from '../options';
import { PERSONAL_CHARACTER_IDS } from '../companion-character';

const ROOT = path.resolve(__dirname, '../../..'), sha = (f: string) => createHash('sha256').update(readFileSync(f)).digest('hex');
const sheets = (id: string) => path.join(ROOT, 'public', 'companions', id, 'style01-sheets');
/** A scratch public tree holding a copy of one real sheet set (for refusal cases), never the real assets. */
function scratchSet(id = 'fox_uri') {
  const root = mkdtempSync(path.join(tmpdir(), 'companion-identity-')), dir = path.join(root, 'public', 'companions', id, 'style01-sheets');
  mkdirSync(path.dirname(dir), { recursive: true }); cpSync(sheets(id), dir, { recursive: true });
  return { root, dir };
}

describe('the drawing identity of a companion is its own passed front sheet, never its card art', () => {
  it('bunny: the card is the happy view, the drawing reference is the front sheet (the R17 blocker)', () => {
    const ref = companionIdentityReference('bunny_ometz', ROOT);
    expect(getCompanionById('bunny_ometz')!.cardImage).toBe('/companions/bunny_ometz/style01-sheets/happy.png');
    expect(ref.publicPath).toBe('/companions/bunny_ometz/style01-sheets/front.png');
    expect(ref.sha256).toBe(sha(path.join(sheets('bunny_ometz'), 'front.png')));
    expect(ref.sha256).toBe('5cafce583bc9276be34ebc7a2dd0a443c9fc2f1c5c9d04264c0bf7339d370472');
    expect(ref.sha256).not.toBe(sha(path.join(sheets('bunny_ometz'), 'happy.png')));
  });
  it('the other five: exactly the same file as their card, so their books and pins are unchanged', () => {
    for (const id of PROTOTYPE_COMPANION_ROSTER.filter(id => id !== 'bunny_ometz')) {
      const card = getCompanionById(id)!.cardImage!, ref = companionIdentityReference(id, ROOT);
      expect(ref.publicPath).toBe(card);
      expect(ref.file).toBe(path.join(ROOT, 'public', card.slice(1)));
    }
  });
  it('refuses a missing set, an unqualified or missing view, a wrong manifest and a bad id, before anything is drawn', () => {
    expect(() => companionIdentityReference('elephant_momo', ROOT)).toThrow('companion_identity_missing');
    expect(() => companionIdentityReference('../fox_uri', ROOT)).toThrow('companion_identity_id');
    const failing = (change: (dir: string) => void) => { const s = scratchSet(); change(s.dir); return s.root; };
    const manifest = (dir: string) => JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
    let root = failing(dir => { const m = manifest(dir); m.views.side.qaStatus = 'failed'; writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(m)); });
    expect(() => companionIdentityReference('fox_uri', root)).toThrow('companion_identity_unqualified'); expect(companionSheetsComplete('fox_uri', root)).toBe(false);
    root = failing(dir => rmSync(path.join(dir, 'theme.png')));
    expect(() => companionIdentityReference('fox_uri', root)).toThrow('companion_identity_missing');
    root = failing(dir => { const m = manifest(dir); m.companionId = 'panda_anat'; writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(m)); });
    expect(() => companionIdentityReference('fox_uri', root)).toThrow('companion_identity_manifest');
    root = failing(dir => { const m = manifest(dir); delete m.views.happy; writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(m)); });
    expect(() => companionIdentityReference('fox_uri', root)).toThrow('companion_identity_unqualified');
    expect(Object.keys(COMPANION_SHEET_VIEWS)).toEqual(['front', 'three_quarter_front', 'side', 'three_quarter_back', 'happy', 'theme']);
  });
});

describe('all fifteen companions are shown; a companion is selectable only when the engine can write and draw it', () => {
  const options = resolvePersonalWizardOptions(ROOT);
  it('today: the six are selectable exactly as before, the nine new ones are "in preparation"', () => {
    expect(options.companions.map(c => c.id)).toEqual([...PROTOTYPE_COMPANION_ROSTER]);
    expect(options.pendingCompanions.map(c => c.id)).toEqual(PERSONAL_ADDED_COMPANIONS.map(c => c.id));
    expect(options.pendingCompanions.filter(c => c.image === null).map(c => c.id)).toEqual(['ibex_tzuki', 'mole_mishi']);
    expect(PERSONAL_COMPANION_IDS).toEqual([...PERSONAL_CHARACTER_IDS]); // the product list and the admitted literary profiles agree
    // Pending is its own list; unavailableCompanionIds keeps its meaning (roster companions missing something), empty today.
    expect(options.unavailableCompanionIds).toEqual([]);
    expect(options.companions.some(c => options.pendingCompanions.some(p => p.id === c.id))).toBe(false);
  });
  it('request identities do not change: the fingerprint covers only selectable companions and equals the pre-change value', () => {
    // Computed from the previous options.ts at a40677f4 (same six, same topics/voices/lengths).
    expect(options.fingerprint).toBe('f5ad4e9d849c971d05d60a72f3751cdcd4b03998a7c018a4865b0db1e56377ff');
  });
  it('the added card art is on disk, small, and never shadows a legacy registry id', () => {
    for (const c of PERSONAL_ADDED_COMPANIONS) {
      expect(getCompanionById(c.id)).toBeNull();
      if (c.image) { const size = readFileSync(path.join(ROOT, 'public', c.image.slice(1))).length; expect(size).toBeGreaterThan(20_000); expect(size).toBeLessThan(60_000); }
    }
  });
  it('the rule needs EVERY part: a full sheet set and card art are not enough without a declared appearance', () => {
    const s = scratchSet('fox_uri'), dir = path.join(s.root, 'public', 'companions', 'elephant_momo', 'style01-sheets');
    mkdirSync(path.dirname(dir), { recursive: true }); cpSync(path.join(s.root, 'public', 'companions', 'fox_uri', 'style01-sheets'), dir, { recursive: true });
    const m = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8')); m.companionId = 'elephant_momo'; writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(m));
    const art = path.join(s.root, 'public', 'Images', 'personal-companions'); mkdirSync(art, { recursive: true });
    writeFileSync(path.join(art, 'elephant_momo.webp'), readFileSync(path.join(ROOT, 'public', 'Images', 'personal-companions', 'elephant_momo.webp')));
    expect(companionSheetsComplete('elephant_momo', s.root)).toBe(true);
    expect(companionDrawable('elephant_momo', '/Images/personal-companions/elephant_momo.webp', s.root)).toBe(false); // appearance not declared yet
    expect(companionDrawable('fox_uri', getCompanionById('fox_uri')!.cardImage, ROOT)).toBe(true);
    expect(companionDrawable('fox_uri', getCompanionById('fox_uri')!.cardImage, scratchSet('panda_anat').root)).toBe(false); // no fox sheets there
    // Card art present but the sheet set incomplete (one view not passed): still not drawable.
    const partial = scratchSet('fox_uri'), m2 = JSON.parse(readFileSync(path.join(partial.dir, 'manifest.json'), 'utf8'));
    m2.views.theme.qaStatus = 'failed'; writeFileSync(path.join(partial.dir, 'manifest.json'), JSON.stringify(m2));
    expect(companionDrawable('fox_uri', getCompanionById('fox_uri')!.cardImage, partial.root)).toBe(false);
  });
});

describe('one visual authority for the engine (writer, storyboard) for every companion', () => {
  it('the six resolve to exactly their legacy registry fields; added ones to their own declaration; unknown ids to null', () => {
    for (const id of PROTOTYPE_COMPANION_ROSTER) {
      const registry = getCompanionById(id)!;
      expect(personalCompanionVisual(id)).toEqual({ id, name: registry.name, description: registry.visualDescription,
        appearanceStateAuthority: registry.appearanceStateAuthority ?? null, source: 'lib/companions.ts' });
    }
    expect(personalCompanionVisual('elephant_momo')).toMatchObject({ id: 'elephant_momo', description: '', source: 'lib/personal-wizard/personal-companions.ts' });
    expect(personalCompanionVisual('no_such_friend')).toBeNull();
  });
  it('the loader and the trial plan use the shared identity reference, and the engine uses the shared visual authority', () => {
    const read = (f: string) => readFileSync(path.join(ROOT, f), 'utf8');
    const loader = read('scripts/personal-simple-book-reviewed-audition.ts'), trial = read('scripts/personal-book-e2e-trial.ts');
    expect(loader).toContain('reference = companionIdentityReference((queued.request as { companion: { id: string } }).companion.id, workspace);');
    expect(loader).toContain('const companionBytes = readFileSync(reference.file);');
    expect(loader).not.toMatch(/style01-sheets\\\/front\\\.png\$\/\.test\(card\)/);
    expect(trial).toContain('identity=companionIdentityReference(context.profile.companionId,source);');
    expect(trial).toContain('companionPath=identity.file;');
    expect(trial).toContain('companion:{id:companion.id,file:companionPath,sha:shaFile(companionPath)}');
    expect(read('lib/personal-wizard/simple-story-engine.ts')).toContain('const companion = personalCompanionVisual(id);');
    expect(read('lib/personal-wizard/storyboard.ts')).toContain('const companion = personalCompanionVisual(prepared.accepted.canonical.companion.id);');
  });
});
