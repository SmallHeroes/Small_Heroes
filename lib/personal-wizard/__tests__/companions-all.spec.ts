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
import { assertCompanionSheetGeometryGrounded } from '../../generation-pipeline/companion-sheet-view-contract';
import { preparePersonalStoryboard, personalStoryboardFrame } from '../storyboard';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { PRE_ADMISSION_FINGERPRINT, preAdmissionOptions } from './pre-admission-options';

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
  it('Momo (admitted 2026-10-29): his drawing identity is the approved, review-passed front of the applied CSR-2 set, byte for byte', () => {
    expect(companionIdentityReference('elephant_momo', ROOT)).toMatchObject({ publicPath: '/companions/elephant_momo/style01-sheets/front.png',
      sha256: 'a4a8ba6db30374fd2a33513ecbb13c9b89676a2f5d5b705f0e909e81925d18a3' });
    const m = JSON.parse(readFileSync(path.join(sheets('elephant_momo'), 'manifest.json'), 'utf8'));
    const applied: Record<string, [string, string]> = { front: ['passed', 'a4a8ba6db30374fd2a33513ecbb13c9b89676a2f5d5b705f0e909e81925d18a3'],
      three_quarter_front: ['passed', '387bd4b89079a95acc5a7aa70ceffbedccf1bd1dbce113a5ee465bd9f50dd6af'], side: ['passed', 'd4388f3169bf44bde65d63e0d2178499a7e51cf3069bc925fc3471fac9d8587f'],
      three_quarter_back: ['owner_accepted', 'f8e6189dd089a329cd6f68827cb49e696150a36f0f25367b7219e733a6e169c5'],
      happy: ['owner_accepted', '4fc25cccefb1797df57878637751027db801e694d07ddce0f30b73c2d6d1462a'], theme: ['owner_accepted', '7e842dea8a3b31da1bdf38c699a030cd0d43d331fdc6409cf2b1b970fad64f09'] };
    for (const [view, [status, hash]] of Object.entries(applied)) {
      expect([m.views[view].qaStatus, m.views[view].sha256]).toEqual([status, hash]);
      expect(sha(path.join(sheets('elephant_momo'), m.views[view].filename))).toBe(hash);
    }
  });
  it('refuses a missing set, an unqualified or missing view, a wrong manifest and a bad id, before anything is drawn', () => {
    expect(() => companionIdentityReference('turtle_tuk', ROOT)).toThrow('companion_identity_missing');
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
  it('today: the six as before plus Momo (admitted 2026-10-29) are selectable; the other eight new ones are "in preparation"', () => {
    expect(options.companions.map(c => c.id)).toEqual([...PROTOTYPE_COMPANION_ROSTER, 'elephant_momo']);
    expect(options.pendingCompanions.map(c => c.id)).toEqual(PERSONAL_ADDED_COMPANIONS.map(c => c.id).filter(id => id !== 'elephant_momo'));
    expect(options.pendingCompanions.filter(c => c.image === null).map(c => c.id)).toEqual(['ibex_tzuki', 'mole_mishi']);
    expect(PERSONAL_COMPANION_IDS).toEqual([...PERSONAL_CHARACTER_IDS]); // the product list and the admitted literary profiles agree
    // Pending is its own list; unavailableCompanionIds keeps its meaning (roster companions missing something), empty today.
    expect(options.unavailableCompanionIds).toEqual([]);
    expect(options.companions.some(c => options.pendingCompanions.some(p => p.id === c.id))).toBe(false);
  });
  it('the fingerprint covers only selectable companions: admitting Momo changed it once, from the six-companion value', () => {
    // f5ad4e9d… was the six-companion value (computed from options.ts at a40677f4). Momo's admission (ADM-1, 2026-10-29) adds one selectable
    // companion, so requests bound to the old value no longer match; the book's new Wizard request is made after admission.
    expect(options.fingerprint).not.toBe(PRE_ADMISSION_FINGERPRINT);
    expect(options.fingerprint).toBe('98da536bcb17f23254d5c342f369a1b0e30935fe9dfe38df4e8bb1c4c378c88c');
  });
  it('the engine pins the admission moved, moved only because the offered menu changed', async () => {
    // The same menu without Momo, fingerprinted by options.ts's own rule, is exactly the six-companion menu...
    const before = preAdmissionOptions(options);
    expect(before.fingerprint).toBe(PRE_ADMISSION_FINGERPRINT);
    const pins = async (menu: typeof options) => { const f = await personalStoryboardFixture('short', 'dragon_dini', menu);
      return [preparePersonalStoryboard(f.request, f.result, menu).sourceDigest, preparePersonalStoryboard(f.request, f.result, menu, true).sourceDigest,
        f.book.storyboardDigest, personalStoryboardFrame(f.book, f.review, 1, f.current).packetDigest]; };
    // ...and gives back every pinned storyboard value byte for byte; the current menu gives the new pins (storyboard-*.spec.ts).
    expect(await pins(before)).toEqual(['f1ad9a28816945b860324527a4050018ecd43cbb4eae2bd01b60975dfc4344f5',
      'a72da5d557dba2e097c190febd3c0940ed1ac6a9b292f2b4e12aebb4ef379edb', 'cb09f0812bafb902f1a7c27de12cc0593636b42b2e33498ac9501c20402c8c1f',
      'd737d76dc01ff5f9311247ec78c78a79cdf09b4579802a0b3a7160e8454514a1']);
    expect(await pins(options)).toEqual(['a0ce658469cb5519c7b130ed517d935d5d61a5e5537b1cec6c92c9daf7b5a12f',
      '87d1eb5f296a94c4d82344f596ce4c45211cb19ce9701f2d51d4f484366ca80d', '695e4071681e90b060007d58a8edcc242f90c08042cb5638d19808018c518cf4',
      '59ac8ddedb9a1bd4635886acfb0afcd6e91c08ae12b020576e1cb417c60f958c']);
  });
  it('Momo carries his size beside the child (Guy: "A") and his sheet geometry stays grounded in his description', () => {
    const d = personalCompanionVisual('elephant_momo')!.description;
    expect(d.endsWith("Medium companion — roughly 60–75% of the child's standing height (about chest to shoulder beside the child). Never taller than the child. Never knee-high.")).toBe(true);
    expect(() => assertCompanionSheetGeometryGrounded(d, PERSONAL_ADDED_COMPANIONS.find(c => c.id === 'elephant_momo')!.sheetGeometry!)).not.toThrow();
  });
  it('the added card art is on disk, small, and never shadows a legacy registry id', () => {
    for (const c of PERSONAL_ADDED_COMPANIONS) {
      expect(getCompanionById(c.id)).toBeNull();
      if (c.image) { const size = readFileSync(path.join(ROOT, 'public', c.image.slice(1))).length; expect(size).toBeGreaterThan(20_000); expect(size).toBeLessThan(60_000); }
    }
  });
  it('the rule needs EVERY part: a full sheet set and card art are not enough without a declared appearance', () => {
    // A scratch tree giving one companion a full passed set and card art.
    const withSetAndArt = (id: string) => {
      const s = scratchSet('fox_uri'), dir = path.join(s.root, 'public', 'companions', id, 'style01-sheets');
      mkdirSync(path.dirname(dir), { recursive: true }); cpSync(path.join(s.root, 'public', 'companions', 'fox_uri', 'style01-sheets'), dir, { recursive: true });
      const m = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8')); m.companionId = id; writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(m));
      const art = path.join(s.root, 'public', 'Images', 'personal-companions'); mkdirSync(art, { recursive: true });
      writeFileSync(path.join(art, `${id}.webp`), readFileSync(path.join(ROOT, 'public', 'Images', 'personal-companions', 'elephant_momo.webp')));
      return s;
    };
    // Tzuki has no declared appearance: a set and art never make him drawable.
    const tzuki = withSetAndArt('ibex_tzuki');
    expect(companionSheetsComplete('ibex_tzuki', tzuki.root)).toBe(true);
    expect(companionDrawable('ibex_tzuki', '/Images/personal-companions/ibex_tzuki.webp', tzuki.root)).toBe(false);
    // Momo's appearance is declared (2026-10-28): once a passed set exists he becomes drawable by the same rule, with no flag.
    const s = withSetAndArt('elephant_momo');
    expect(companionDrawable('elephant_momo', '/Images/personal-companions/elephant_momo.webp', s.root)).toBe(true);
    expect(companionDrawable('elephant_momo', '/Images/personal-companions/elephant_momo.webp', ROOT)).toBe(true); // admitted 2026-10-29
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
    expect(personalCompanionVisual('ibex_tzuki')).toMatchObject({ id: 'ibex_tzuki', description: '', source: 'lib/personal-wizard/personal-companions.ts' });
    expect(personalCompanionVisual('elephant_momo')).toMatchObject({ id: 'elephant_momo', source: 'lib/personal-wizard/personal-companions.ts',
      description: PERSONAL_ADDED_COMPANIONS.find(c => c.id === 'elephant_momo')!.visualDescription });
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
