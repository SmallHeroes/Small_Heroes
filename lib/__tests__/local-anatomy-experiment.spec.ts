import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localizedCropRect, localizedAnatomyDisposition, validateNormalizedBox, inventoryAnatomyDisposition, validateAnatomyRegionGrounding } from '../local-anatomy-experiment';
import { previewSha } from '../local-story-preview';
const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('openai', () => ({ default: class { responses = { create }; } }));
import { inspectLocalizedAnatomy } from '../../scripts/lib/local-anatomy-experiment';

const box = { x: 0.2, y: 0.1, width: 0.4, height: 0.7 };
const valid = { verdict: 'pass', targetInCrop: true, summary: 'visible structure coherent', ordinaryOcclusions: ['far arm behind torso'], issues: [] };
const issue = { kind: 'merged_body_parts', region: box, evidence: 'visible merged hand and knee contour', visibility: 'visible_defect', correction: 'separate hand contour from knee' };
const limbInventory = ['arm_a', 'arm_b', 'leg_a', 'leg_b'].map(limb => ({ limb, visibleParts: 'visible segment', proximalBoundary: 'sleeve/shorts edge', distalBoundary: 'hand/shoe', connection: 'visible', region: box }));
describe('localized anatomy geometry and disposition', () => {
  it.each([0, -1, NaN, Infinity])('rejects invalid grounding dimensions %s', width => {
    expect(() => validateAnatomyRegionGrounding({ ...valid, limbInventory }, localizedCropRect(box, 200, 300), width, 300)).toThrow('anatomy_grounding_dimensions');
  });
  it('rejects syntactically valid coordinates outside the target instead of treating them as grounded evidence', () => {
    expect(() => validateAnatomyRegionGrounding({ ...valid, limbInventory }, localizedCropRect(box, 200, 300), 200, 300)).not.toThrow();
    expect(() => validateAnatomyRegionGrounding({ ...valid, limbInventory: limbInventory.map(l => ({ ...l, region: { x: 0, y: 0, width: 0.01, height: 0.01 } })) }, localizedCropRect(box, 200, 300), 200, 300)).toThrow('anatomy_region_outside_target_crop');
  });
  it('requires distinct limb inventory and rejects a PASS that relies on untraceable exposed attachment', () => {
    expect(inventoryAnatomyDisposition({ ...valid, limbInventory })).toMatchObject({ disposition: 'observed_pass', renderAuthorized: false });
    expect(() => inventoryAnatomyDisposition({ ...valid, limbInventory: limbInventory.map(() => limbInventory[0]) })).toThrow('anatomy_inventory_coverage');
    expect(() => inventoryAnatomyDisposition({ ...valid, limbInventory: limbInventory.map(l => ({ ...l, connection: 'untraceable' })) })).toThrow('anatomy_inventory_unresolved_pass');
    expect(() => inventoryAnatomyDisposition({ ...valid, limbInventory: limbInventory.map(l => ({ ...l, region: null })) })).toThrow('anatomy_visible_limb_region_missing');
    expect(inventoryAnatomyDisposition({ ...valid, limbInventory: limbInventory.map(l => ({ ...l, region: null, connection: 'ordinary_occlusion' })) }).disposition).toBe('observed_pass');
  });
  it.each([{ ...box, x: -0.1 }, { ...box, width: 0 }, { ...box, y: 0.9 }, { ...box, x: 0.9 }, { ...box, width: NaN }])('rejects invalid region %o', value => {
    expect(() => validateNormalizedBox(value)).toThrow();
  });
  it('pads and clamps real-pixel crops without stretching or leaving source bounds', () => {
    expect(localizedCropRect({ x: 0, y: 0, width: 1, height: 1 }, 200, 300)).toEqual({ left: 0, top: 0, width: 200, height: 300 });
    const rect = localizedCropRect(box, 200, 300);
    expect(rect.left).toBeLessThan(40); expect(rect.top).toBe(0);
    expect(rect.left + rect.width).toBeGreaterThanOrEqual(120);
    expect(rect.top + rect.height).toBeGreaterThanOrEqual(240);
    expect(() => localizedCropRect({ ...box, width: 0.001 }, 200, 300)).toThrow('anatomy_target_too_small');
  });
  it('distinguishes visible defect, ordinary occlusion and uncertainty without render authority', () => {
    expect(localizedAnatomyDisposition(valid)).toMatchObject({ disposition: 'observed_pass', renderAuthorized: false });
    expect(localizedAnatomyDisposition({ ...valid, verdict: 'defect', issues: [issue] })).toMatchObject({ disposition: 'observed_defect', renderAuthorized: false });
    expect(localizedAnatomyDisposition({ ...valid, targetInCrop: false, verdict: 'uncertain' }).disposition).toBe('held_uncertain');
    expect(localizedAnatomyDisposition({ ...valid, verdict: 'uncertain', issues: [issue, { ...issue, visibility: 'uncertain', correction: '' }] }).disposition).toBe('held_uncertain');
  });
  it.each([
    { ...valid, issues: [issue] }, { ...valid, verdict: 'defect' }, { ...valid, targetInCrop: false },
    { ...valid, verdict: 'defect', issues: [{ ...issue, correction: ' ' }] },
    { ...valid, verdict: 'defect', issues: [{ ...issue, region: { ...box, x: 0.9 } }] },
  ])('rejects contradictory or ungrounded report %o', report => {
    expect(() => localizedAnatomyDisposition(report)).toThrow();
  });
});

let root: string, file: string, sha: string;
beforeEach(async () => {
  create.mockReset(); root = fs.mkdtempSync(path.join(os.tmpdir(), 'sh-localized-anatomy-'));
  file = path.join(root, 'candidate.png');
  await sharp({ create: { width: 200, height: 300, channels: 3, background: '#fac' } }).png().toFile(file);
  sha = previewSha(fs.readFileSync(file));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
const response = (value: unknown) => ({ status: 'completed', model: 'gpt-5.5-2026-04-23', id: 'response-test', output_text: JSON.stringify(value), usage: { input_tokens: 100, output_tokens: 100 } });
const args = () => ({ root, step: 'sample-a', budgetUsd: 2, apiKey: 'test', candidatePath: file, candidateSha: sha, anchorPath: file, anchorSha: sha });
describe('real experimental two-stage adapter', () => {
  it('pins the explicit Sol experiment to medium in both stages and isolates its receipts from the default', async () => {
    create.mockResolvedValueOnce({ ...response({ status: 'located', box, observation: 'target' }), model: 'gpt-5.6-sol' })
      .mockResolvedValueOnce({ ...response({ ...valid, limbInventory }), model: 'gpt-5.6-sol' });
    const options = { ...args(), inspectionMode: 'grounded_inventory' as const, model: 'gpt-5.6-sol' as const };
    const result = await inspectLocalizedAnatomy(options);
    expect(result).toMatchObject({ status: 'inspected', renderAuthorized: false });
    for (const [request] of create.mock.calls) expect(request).toMatchObject({ model: 'gpt-5.6-sol', reasoning: { effort: 'medium' }, store: false });
    expect(await inspectLocalizedAnatomy(options)).toEqual(result);
    await expect(inspectLocalizedAnatomy({ ...args(), inspectionMode: 'grounded_inventory' })).rejects.toThrow('checkpoint_identity_changed');
    expect(create).toHaveBeenCalledTimes(2);
  });
  it('rejects arbitrary model overrides before dispatch', async () => {
    await expect(inspectLocalizedAnatomy({ ...args(), model: 'gpt-5.6' as 'gpt-5.6-sol' })).rejects.toThrow('invalid_anatomy_model');
    expect(create).not.toHaveBeenCalled();
  });
  it('grounded mode refuses misplaced limb evidence and retains the known receipt without retry', async () => {
    create.mockResolvedValueOnce(response({ status: 'located', box, observation: 'target' })).mockResolvedValueOnce(response({ ...valid,
      limbInventory: limbInventory.map(l => ({ ...l, region: { x: 0, y: 0, width: 0.01, height: 0.01 } })) }));
    await expect(inspectLocalizedAnatomy({ ...args(), inspectionMode: 'grounded_inventory' })).rejects.toThrow('anatomy_region_outside_target_crop');
    await expect(inspectLocalizedAnatomy({ ...args(), inspectionMode: 'grounded_inventory' })).rejects.toThrow('anatomy_region_outside_target_crop');
    expect(create).toHaveBeenCalledTimes(2);
  });
  it('inventory mode retains observations and has a separate version-bound cache', async () => {
    create.mockResolvedValueOnce(response({ status: 'located', box, observation: 'target body' })).mockResolvedValueOnce(response({ ...valid, limbInventory }));
    const result = await inspectLocalizedAnatomy({ ...args(), inspectionMode: 'inventory' });
    expect(result).toMatchObject({ status: 'inspected', limbInventory, renderAuthorized: false });
    expect(create.mock.calls[1][0].text.format.schema.required).toContain('limbInventory');
    expect(create.mock.calls[1][0].instructions).toContain('Before the verdict');
    await expect(inspectLocalizedAnatomy(args())).rejects.toThrow('checkpoint_identity_changed');
    expect(create).toHaveBeenCalledTimes(2);
  });
  it('locates then inspects exact crops; exposes no labels and replays without calls', async () => {
    create.mockResolvedValueOnce(response({ status: 'located', box, observation: 'target body' })).mockResolvedValueOnce(response({ ...valid, verdict: 'defect', issues: [issue] }));
    const result = await inspectLocalizedAnatomy(args());
    expect(result).toMatchObject({ status: 'inspected', disposition: 'observed_defect', renderAuthorized: false });
    for (const [request] of create.mock.calls) {
      expect(request).toMatchObject({ model: 'gpt-5.5', reasoning: { effort: 'medium' }, store: false });
      expect(JSON.stringify(request)).not.toContain('sample-a'); expect(JSON.stringify(request)).not.toContain('expected');
    }
    const input = create.mock.calls[1][0].input[0].content;
    const images = input.filter((item: {type: string}) => item.type === 'input_image');
    expect(images).toHaveLength(4);
    const crop = Buffer.from(images[1].image_url.split(',')[1], 'base64');
    expect(previewSha(crop)).toBe(previewSha(fs.readFileSync(path.join(root, 'sample-a-child.png'))));
    const pixels = await sharp(crop).raw().toBuffer();
    const expectedPixels = await sharp(file).extract(localizedCropRect(box, 200, 300)).raw().toBuffer();
    expect(pixels.equals(expectedPixels)).toBe(true);
    expect(await inspectLocalizedAnatomy(args())).toEqual(result); expect(create).toHaveBeenCalledTimes(2);
  });
  it('uncertain locator never dispatches anatomy and is not retried', async () => {
    create.mockResolvedValueOnce(response({ status: 'uncertain', box: null, observation: 'cannot select one target' }));
    expect(await inspectLocalizedAnatomy(args())).toMatchObject({ status: 'held_localization', renderAuthorized: false });
    await inspectLocalizedAnatomy(args()); expect(create).toHaveBeenCalledTimes(1);
  });
  it('invalid localization cannot become a clamped false positive', async () => {
    create.mockResolvedValueOnce(response({ status: 'located', box: { ...box, x: 0.9 }, observation: 'invalid location' }));
    await expect(inspectLocalizedAnatomy(args())).rejects.toThrow('anatomy_box_outside_image'); expect(create).toHaveBeenCalledTimes(1);
  });
  it('incomplete inspection is preserved and replay does not rebill', async () => {
    create.mockResolvedValueOnce(response({ status: 'located', box, observation: 'target' })).mockResolvedValueOnce({ ...response(valid), status: 'incomplete' });
    await expect(inspectLocalizedAnatomy(args())).rejects.toThrow('localized_anatomy_incomplete');
    await expect(inspectLocalizedAnatomy(args())).rejects.toThrow('localized_anatomy_incomplete'); expect(create).toHaveBeenCalledTimes(2);
  });
  it('byte changes and orphan claims prevent dispatch', async () => {
    await expect(inspectLocalizedAnatomy({ ...args(), candidateSha: 'f'.repeat(64) })).rejects.toThrow('anatomy_image_binding');
    fs.mkdirSync(path.join(root, 'steps')); fs.writeFileSync(path.join(root, 'steps/sample-a-locate.claim.json'), '{}');
    await expect(inspectLocalizedAnatomy(args())).rejects.toThrow('paid_step_outcome_unknown'); expect(create).not.toHaveBeenCalled();
  });
});
