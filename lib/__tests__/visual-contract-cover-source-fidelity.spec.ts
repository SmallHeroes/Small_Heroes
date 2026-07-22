import fs from 'fs';
import os from 'os';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { extractSourceFromMarkdown } from '../../scripts/extract-visual-contract-sources';
import {
  compileBookVisualContractTemplate,
  type TemplateCompileInput,
} from '../visual-contract-compiler/compileBookVisualContractTemplate';
import type { BookVisualContractTemplate } from '../visual-contract-compiler/contractTemplateTypes';
import {
  AuthoredCoverAuthorityError,
  applyAuthoredCoverAuthority,
  authoredCoverAuthorityFromLocationBible,
  coverSourceFidelityIssues,
  resolveAuthoredCoverZone,
  type AuthoredCoverAuthority,
} from '../visual-contract-compiler/coverSourceAuthority';
import { renderVisualContractReview } from '../visual-contract-compiler/writeVisualContractReview';
import { storyCoverSourceFidelityIssues } from '../visual-package/coverSourceFidelity';

const REPO = process.cwd();
const STORY_KEY = 'fox_uri_adventure';
const BANK = path.join(REPO, 'story-bank', 'v3-approved');

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function foxDraft(): BookVisualContractTemplate {
  return JSON.parse(
    fs.readFileSync(path.join(BANK, `${STORY_KEY}.visual-contract-template.json`), 'utf8'),
  ) as BookVisualContractTemplate;
}

function foxInput(): TemplateCompileInput & { authoredCoverAuthority: AuthoredCoverAuthority } {
  const markdown = fs.readFileSync(path.join(BANK, `${STORY_KEY}.md`), 'utf8');
  const source = extractSourceFromMarkdown(STORY_KEY, markdown);
  const bible = JSON.parse(
    fs.readFileSync(path.join(BANK, `${STORY_KEY}.location-bible.json`), 'utf8'),
  ) as unknown;
  const authority = authoredCoverAuthorityFromLocationBible(bible, source.companion);
  if (!authority) throw new Error('Fox fixture must author page 0');
  return { ...source, authoredCoverAuthority: authority };
}

function staleFoxDraft(): BookVisualContractTemplate {
  const draft = foxDraft();
  draft.coverContract = {
    ...draft.coverContract,
    locationId: 'loc_balcony',
    zoneId: 'z_balcony_railing',
    castIds: ['child:hero'],
    mustShow: [
      'child on the balcony',
      'small old tin bucket near balcony edge',
      'one or two gentle water droplets and tiny friendly rhythm marks',
    ],
    mustNotShow: ['monster'],
  };
  return draft;
}

const stubFrom = (draft: unknown) => async () => JSON.stringify(draft);

describe('authored page-0 cover authority', () => {
  it('overrides stale draft cover topology/cast/content without changing page contracts', async () => {
    const input = foxInput();
    const draft = staleFoxDraft();
    const withSource = await compileBookVisualContractTemplate(input, { callLLM: stubFrom(draft) });
    const legacy = await compileBookVisualContractTemplate(
      { ...input, authoredCoverAuthority: undefined },
      { callLLM: stubFrom(draft) },
    );

    expect(withSource.template.coverContract).toMatchObject({
      locationId: 'loc_child_room',
      zoneId: 'z_room_window',
      castIds: ['child:hero', 'companion:fox_uri'],
      mustShow: input.authoredCoverAuthority.visibleAnchors,
    });
    expect(withSource.template.coverContract.mustShow.join(' ')).not.toMatch(/bucket|droplet|rhythm marks/i);
    expect(withSource.template.coverContract.mustNotShow).toEqual(expect.arrayContaining([
      'metal bucket',
      'drip source',
      'falling water',
      'water-catching object',
      'rhythm marks',
    ]));
    expect(withSource.template.pageContracts).toEqual(legacy.template.pageContracts);
    expect([...new Set(withSource.template.locations.map((location) => location.setIdentityId))])
      .toEqual(['set_room_balcony_night']);
    expect(withSource.notes).toEqual(expect.arrayContaining([
      expect.stringContaining('overridden by authored page 0'),
      'coverContract castIds overridden by authored page 0',
      'coverContract mustShow overridden by authored page-0 visibleAnchors',
    ]));
  });

  it('removes a hidden spoiler from mustShow and carries both structured and prose prohibitions', () => {
    const authority: AuthoredCoverAuthority = {
      sourceZoneId: 'bedroom_window',
      visibleAnchors: ['child listening beside the window'],
      forbiddenDrift: ['visible secret map'],
      hiddenObjects: ['secret_map'],
      castIds: ['child:hero'],
    };
    const result = applyAuthoredCoverAuthority({
      authority,
      zones: [{ id: 'z_room_window', locationId: 'loc_room' }],
      cover: {
        locationId: 'loc_garden',
        zoneId: 'z_garden',
        castIds: ['child:hero', 'human:phantom'],
        mustShow: ['child holding the secret map'],
        mustNotShow: ['monster'],
      },
    });
    expect(result.cover.mustShow).toEqual(['child listening beside the window']);
    expect(result.cover.mustNotShow).toEqual(['monster', 'visible secret map', 'secret map']);
  });

  it('fails closed when the source-to-contract zone mapping is missing or ambiguous', () => {
    const authority: AuthoredCoverAuthority = {
      sourceZoneId: 'bedroom_window',
      visibleAnchors: ['child'],
      forbiddenDrift: [],
      hiddenObjects: [],
      castIds: ['child:hero'],
    };
    expect(() => resolveAuthoredCoverZone(authority, [{ id: 'z_garden', locationId: 'loc_garden' }]))
      .toThrow(AuthoredCoverAuthorityError);
    try {
      resolveAuthoredCoverZone(authority, [
        { id: 'z_room_window', locationId: 'loc_room_a' },
        { id: 'zone_bedroom_window', locationId: 'loc_room_b' },
      ]);
      throw new Error('expected ambiguous mapping to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(AuthoredCoverAuthorityError);
      expect((error as AuthoredCoverAuthorityError).issues[0].code).toBe('cover_source_zone_ambiguous');
    }
  });
});

describe('cover review and qualification source-fidelity evidence', () => {
  it('reports location, zone, cast, mustShow, mustNotShow, and source conflicts; never claims parity', async () => {
    const input = foxInput();
    const compiled = await compileBookVisualContractTemplate(input, { callLLM: stubFrom(staleFoxDraft()) });
    const previous = staleFoxDraft();
    const review = renderVisualContractReview({
      storyKey: STORY_KEY,
      facts: compiled.facts,
      template: compiled.template,
      notes: compiled.notes,
      valid: true,
      previous,
      authoredCoverAuthority: input.authoredCoverAuthority,
    });

    for (const field of ['locationId', 'zoneId', 'castIds', 'mustShow', 'mustNotShow']) {
      expect(review).toContain(`coverContract.${field}`);
    }
    expect(review).toContain('Candidate source-fidelity conflicts: none.');
    expect(review).toContain('Previous-template source-fidelity conflicts:');
    expect(review).toContain('cover_source_location_mismatch');
    expect(review).toContain('cover_source_spoiler_contradiction');
    expect(review).not.toContain('candidate matches the previously approved template');
  });

  it('the package gate accepts a matching cover and rejects wrong location plus spoiler contradiction', async () => {
    const input = foxInput();
    const compiled = await compileBookVisualContractTemplate(input, { callLLM: stubFrom(staleFoxDraft()) });
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'smallheroes-cover-source-'));
    try {
      const storyPath = path.join(root, `${STORY_KEY}.md`);
      fs.writeFileSync(storyPath, 'fixture story\n', 'utf8');
      fs.copyFileSync(
        path.join(BANK, `${STORY_KEY}.location-bible.json`),
        path.join(root, `${STORY_KEY}.location-bible.json`),
      );

      expect(storyCoverSourceFidelityIssues({ storyPath, template: compiled.template })).toEqual([]);

      const wrongLocation = jsonClone(compiled.template);
      wrongLocation.coverContract.locationId = 'loc_balcony';
      expect(storyCoverSourceFidelityIssues({ storyPath, template: wrongLocation }).map((issue) => issue.code))
        .toContain('cover_source_location_mismatch');

      const spoiler = jsonClone(compiled.template);
      spoiler.coverContract.mustShow = [...spoiler.coverContract.mustShow, 'small metal bucket'];
      const spoilerCodes = storyCoverSourceFidelityIssues({ storyPath, template: spoiler }).map((issue) => issue.code);
      expect(spoilerCodes).toContain('cover_source_must_show_mismatch');
      expect(spoilerCodes).toContain('cover_source_spoiler_contradiction');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('a matching cover has no pure fidelity issues', async () => {
    const input = foxInput();
    const compiled = await compileBookVisualContractTemplate(input, { callLLM: stubFrom(staleFoxDraft()) });
    expect(coverSourceFidelityIssues(compiled.template, input.authoredCoverAuthority)).toEqual([]);
  });
});
