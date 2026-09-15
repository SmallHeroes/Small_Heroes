import { z } from 'zod';

// Experimental evidence only: deliberately not PREVIEW_QUALITY_VERSION or a render permit.
export const LOCAL_ANATOMY_VERSION = 'localized-anatomy-experiment/v1';
export const LOCAL_ANATOMY_INVENTORY_VERSION = 'localized-anatomy-experiment/v2-inventory';
export const LOCAL_ANATOMY_GROUNDED_VERSION = 'localized-anatomy-experiment/v3-grounded-inventory';
export const normalizedBoxSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1),
  width: z.number().positive().max(1), height: z.number().positive().max(1) }).strict();
export type NormalizedBox = z.infer<typeof normalizedBoxSchema>;
const note = z.string().trim().min(1).max(1200);
export const childLocalizationSchema = z.object({ status: z.enum(['located', 'uncertain', 'absent']),
  box: normalizedBoxSchema.nullable(), observation: note }).strict();
export const localizedAnatomySchema = z.object({ verdict: z.enum(['pass', 'defect', 'uncertain']),
  targetInCrop: z.boolean(), summary: note, ordinaryOcclusions: z.array(note).max(8),
  issues: z.array(z.object({ kind: z.enum(['malformed_limb', 'disconnected_fragment', 'impossible_joint', 'merged_body_parts', 'extra_part', 'unclear_connection']),
    region: normalizedBoxSchema, evidence: note, visibility: z.enum(['visible_defect', 'uncertain']), correction: z.string().max(1200) }).strict()).max(8),
}).strict();

export const CHILD_LOCALIZATION_INSTRUCTION = `Locate the main child protagonist in the illustration using the reference portrait as an identity hint, not a clothing or pose template.
Return a tight box covering the child's entire depicted body from hair to feet, including visible limbs and adjacent skin fragments belonging to the child. Coordinate origin is top left; x,y,width,height are fractions of the FULL illustration, not the reference.
Do not diagnose anatomy or judge the story. Other people, props and creatures are not the target. If you cannot identify one target, report uncertain or absent and a null box. A cropped/occluded body can still be located; do not invent hidden body extent.`;

export const LOCALIZED_ANATOMY_INSTRUCTION = `Assess only the anatomical drawing of the target CHILD. You receive the full illustration and exact-pixel crops of the automatically located child. Other people and creatures are context, not targets.
Success means distinguishing visible malformed anatomy from normal child poses, stylized proportions, foreshortening and ordinary occlusion. Do not critique story, identity resemblance, clothing design, framing, prop design or safety of the activity.
An ordinary limb disappearing behind a foreground object is not a defect. Conversely, imagined hidden connections do not explain away an exposed malformed hand, fused body parts, impossible visible joint, or disconnected flesh fragment. Judge the visible outlines and attachment boundaries. If the visible evidence does not settle a connection, mark uncertain instead of inventing either an injury or a normal limb.
Report localized observable issues, using coordinates in the FULL illustration. Describe what is drawn rather than a hypothetical hidden skeleton. Pass only if there is no visible defect or unresolved anatomical issue. If the crop missed the target, say targetInCrop=false and uncertain. A visible defect needs a precise correction; normal occlusions need no correction. Keep the finding brief.`;

export const limbInventorySchema = z.array(z.object({ limb: z.enum(['arm_a', 'arm_b', 'leg_a', 'leg_b']),
  visibleParts: note, proximalBoundary: note, distalBoundary: note,
  connection: z.enum(['visible', 'ordinary_occlusion', 'untraceable']),
  region: normalizedBoxSchema.nullable() }).strict()).length(4);
export const inventoryAnatomySchema = z.object({ limbInventory: limbInventorySchema, ...localizedAnatomySchema.shape }).strict();
export const INVENTORY_ANATOMY_INSTRUCTION = LOCALIZED_ANATOMY_INSTRUCTION + `
Before the verdict, record an observational inventory of the child's two arms and two legs, each once (a/b are identifiers, not anatomical left/right). For each, describe visible parts and the actual proximal and distal boundaries. Name the garment edge, its visible color/shape, and which body it visibly joins; do not assume a nearby sleeve or skin patch belongs to this child. Describe a visible hand-to-wrist or foot-to-ankle connection rather than merely counting a hand or shoe. Use ordinary_occlusion when a clean foreground boundary explains disappearance, and untraceable when exposed parts cannot be accounted for. A completely hidden limb has a null region and should not be invented. Inventory observations must agree with the verdict; unresolved visible attachment is uncertain, not pass. Clothes may legitimately vary in color due to shadows; a color difference by itself is not an anatomical defect.`;
export const GROUNDED_INVENTORY_INSTRUCTION = INVENTORY_ANATOMY_INSTRUCTION + `
Coordinate units for EVERY region: x,y,width,height are decimal FRACTIONS of the FULL ILLUSTRATION width and height, not pixels and not fractions of the crop. Origin is the full illustration's top-left. Use real decimal positions, not placeholder zero/one values. The target is inside the supplied cropRect in full-image pixels: convert pixels to fractions by dividing horizontal coordinates by imageWidth and vertical coordinates by imageHeight. Region boxes identify the visible target limb and must lie inside this target crop (small estimation tolerance allowed). If a limb is fully hidden, use null rather than an invented box.`;

export function validateAnatomyRegionGrounding(value: unknown, rect: { left: number; top: number; width: number; height: number }, width: number, height: number) {
  if (![width, height, rect.width, rect.height].every(n => Number.isSafeInteger(n) && n > 0) ||
    ![rect.left, rect.top].every(n => Number.isSafeInteger(n) && n >= 0) ||
    rect.left + rect.width > width || rect.top + rect.height > height) throw Error('anatomy_grounding_dimensions');
  const report = inventoryAnatomySchema.parse(value);
  const regions = [...report.issues.map(i => i.region), ...report.limbInventory.flatMap(l => l.region ? [l.region] : [])];
  for (const region of regions) {
    const b = validateNormalizedBox(region), tolerance = 0.02;
    if (b.x < rect.left / width - tolerance || b.y < rect.top / height - tolerance ||
      b.x + b.width > (rect.left + rect.width) / width + tolerance || b.y + b.height > (rect.top + rect.height) / height + tolerance) {
      throw Error('anatomy_region_outside_target_crop');
    }
  }
}

export function inventoryAnatomyDisposition(value: unknown) {
  const parsed = inventoryAnatomySchema.parse(value);
  if (new Set(parsed.limbInventory.map(limb => limb.limb)).size !== 4) throw Error('anatomy_inventory_coverage');
  parsed.limbInventory.forEach(limb => {
    if (limb.region) validateNormalizedBox(limb.region);
    else if (limb.connection !== 'ordinary_occlusion') throw Error('anatomy_visible_limb_region_missing');
  });
  const { limbInventory, ...review } = parsed;
  if (limbInventory.some(limb => limb.connection === 'untraceable') && review.verdict === 'pass') throw Error('anatomy_inventory_unresolved_pass');
  return { ...localizedAnatomyDisposition(review), limbInventory };
}

export function validateNormalizedBox(value: unknown): NormalizedBox {
  const box = normalizedBoxSchema.parse(value);
  if (box.x + box.width > 1 + 1e-8 || box.y + box.height > 1 + 1e-8) throw Error('anatomy_box_outside_image');
  return box;
}
export function localizedCropRect(value: unknown, imageWidth: number, imageHeight: number) {
  const box = validateNormalizedBox(value);
  if (![imageWidth, imageHeight].every(n => Number.isSafeInteger(n) && n >= 32)) throw Error('anatomy_image_dimensions');
  if (box.width * imageWidth < 32 || box.height * imageHeight < 32) throw Error('anatomy_target_too_small');
  const left = Math.max(0, Math.floor((box.x - box.width * 0.15) * imageWidth));
  const top = Math.max(0, Math.floor((box.y - box.height * 0.15) * imageHeight));
  const right = Math.min(imageWidth, Math.ceil((box.x + box.width * 1.15) * imageWidth));
  const bottom = Math.min(imageHeight, Math.ceil((box.y + box.height * 1.15) * imageHeight));
  return { left, top, width: right - left, height: bottom - top };
}
export function localizedAnatomyDisposition(value: unknown) {
  const review = localizedAnatomySchema.parse(value);
  review.issues.forEach(issue => {
    validateNormalizedBox(issue.region);
    if (issue.visibility === 'visible_defect' && !issue.correction.trim()) throw Error('anatomy_correction_missing');
  });
  const expected = !review.targetInCrop || review.issues.some(i => i.visibility === 'uncertain') ? 'uncertain'
    : review.issues.length ? 'defect' : 'pass';
  if (review.verdict !== expected) throw Error('anatomy_verdict_evidence_conflict');
  return { review, disposition: expected === 'pass' ? 'observed_pass' : expected === 'defect' ? 'observed_defect' : 'held_uncertain',
    // No experimental output may authorize a render or repair, even if cases match.
    renderAuthorized: false as const };
}
