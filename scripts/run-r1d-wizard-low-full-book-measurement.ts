import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createHash } from 'node:crypto';

import { parse as parseEnv } from 'dotenv';

import { generateImage } from '@/backend/providers/image';
import { enforceMvpOrderSlot } from '@/backend/config/mvp-story-matrix';
import { resolveStoryProductTruth } from '@/backend/providers/story-product-resolver';
import { getCompanionById } from '@/lib/companions';
import {
  blueprintStoryboardFrameSignature,
  projectPageShotToBlueprintStoryboard,
  validateBlueprintStoryboardDiversity,
} from '@/lib/generation-pipeline/blueprint-storyboard-diversity';
import { buildFrozenStoryProductTruth } from '@/lib/generation-pipeline/frozen-product-truth';
import { requireStyle01RenderQualification } from '@/lib/generation-pipeline/render-qualification-preflight';
import type { BookShotPlan } from '@/lib/book-shot-plan';
import { estimateGptImage2CostUsd } from '@/lib/pricing';
import { STYLE_IDS } from '@/lib/styles';
import {
  computeVisualContractHash,
  forbiddenPropIdsForPage,
  materialize,
  migrateLegacyBookVisualContractTemplateV1,
  projectPageMustShow,
  requiredPropIdsForPage,
  validateBookVisualContractTemplate,
  type BookVisualContract,
  type BookVisualContractTemplate,
  type ResolvedFamilyAppearanceProfile,
} from '@/lib/visual-contract-compiler';
import {
  buildFrozenVisualPackageAuthority,
  publishVisualPackageV4,
} from '@/lib/visual-package';
import type {
  BlueprintFramePlacement,
  BlueprintRegion,
} from '@/lib/visual-package/preRenderBlueprintTypes';
import { parseStorySourceContent } from '@/lib/visual-contract-compiler/storySourceContent';
import { bindApprovedPvbRuntimeAuthority } from '@/lib/visual-package/runtimeAuthority';
import { buildVisualPackageV4Fixture } from '@/lib/visual-package/__tests__/visual-package-v4.fixtures';
import {
  applyDiniBarFivePageMeasurementOverlay,
  DINI_BAR_MEASUREMENT_PAGES,
  DINI_BAR_SHOT_PLAN,
} from './lib/r1d-dini-bar-five-page-measurement-authority';

const ROOT = process.cwd();
const MEASUREMENT =
  process.argv.find((value) => value.startsWith('--measurement='))?.slice(14) ?? 'fox-full-book';
const IS_DINI_BAR = MEASUREMENT === 'dini-bar-five-page';
if (!IS_DINI_BAR && MEASUREMENT !== 'fox-full-book') {
  throw new Error(`Unsupported measurement: ${MEASUREMENT}`);
}
const OUTPUT_ARG = process.argv.find((value) => value.startsWith('--output-root='))?.slice(14);
const OUTPUT_ROOT = path.resolve(
  ROOT,
  OUTPUT_ARG ??
    (IS_DINI_BAR
      ? 'outputs/r1d-dini-bar-five-page-low-20260811'
      : 'outputs/r1d-full-book-storyboard-low-20260811'),
);
const AUTHORITY_ROOT = path.join(OUTPUT_ROOT, 'local-authority');
const STORAGE_ROOT = path.join(OUTPUT_ROOT, 'local-storage');
const PAGE_NUMBERS = IS_DINI_BAR
  ? [...DINI_BAR_MEASUREMENT_PAGES]
  : Array.from({ length: 12 }, (_, index) => index + 1);
const RENDER_PAGE_ARG = process.argv
  .find((value) => value.startsWith('--render-pages='))
  ?.slice(15);
const RENDER_PAGE_NUMBERS = RENDER_PAGE_ARG
  ? RENDER_PAGE_ARG.split(',').map((value) => Number(value.trim()))
  : PAGE_NUMBERS;
if (
  RENDER_PAGE_NUMBERS.length === 0 ||
  RENDER_PAGE_NUMBERS.some(
    (pageNumber) =>
      !Number.isInteger(pageNumber) ||
      !PAGE_NUMBERS.some((candidate) => candidate === pageNumber),
  ) ||
  new Set(RENDER_PAGE_NUMBERS).size !== RENDER_PAGE_NUMBERS.length
) {
  throw new Error(`Invalid --render-pages subset: ${RENDER_PAGE_ARG ?? ''}`);
}
const ORDER_ID = IS_DINI_BAR
  ? 'local-wizard-low-dini-bar-five-page-measurement'
  : 'local-wizard-low-full-book-storyboard-measurement';
const CHILD_ANCHOR =
  process.argv.find((value) => value.startsWith('--child-anchor='))?.slice(15) ??
  (IS_DINI_BAR
    ? 'C:\\GNart\\Work\\Small_Heroes\\public\\Images\\Bar.png'
    : 'C:\\GNart\\Work\\Small_Heroes\\outputs\\qa-anchors\\fox_uri_bedtime__98abe88141e4ae16__de8a6c41\\anchor.png');
const FAMILY: ResolvedFamilyAppearanceProfile = {
  skinTone: IS_DINI_BAR ? 'warm medium-light olive' : 'warm light-brown',
  hairColour: IS_DINI_BAR ? 'deep dark brown' : 'warm brown',
  hairTexture: IS_DINI_BAR ? 'dense soft curls' : 'soft wavy',
};

function replaceObject(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, structuredClone(source));
}

function addUnique(target: string[], value: string): void {
  if (!target.includes(value)) target.push(value);
}

function regionInside(target: BlueprintRegion): BlueprintRegion {
  const width = Math.max(24, Math.floor(target.width * 0.32));
  const height = Math.max(20, Math.floor(target.height * 0.16));
  return {
    x: Math.floor(target.x + (target.width - width) / 2),
    y: Math.floor(target.y + Math.min(18, target.height * 0.08)),
    width,
    height,
  };
}

function verticalPathInto(target: BlueprintRegion): BlueprintRegion {
  const width = Math.max(42, Math.floor(target.width * 0.28));
  const x = Math.floor(target.x + (target.width - width) / 2);
  const y = Math.max(240, target.y - 320);
  return {
    x,
    y,
    width,
    height: target.y + Math.floor(target.height * 0.18) - y,
  };
}

function regionsOverlap(left: BlueprintRegion, right: BlueprintRegion): boolean {
  return !(
    left.x + left.width <= right.x ||
    right.x + right.width <= left.x ||
    left.y + left.height <= right.y ||
    right.y + right.height <= left.y
  );
}

const QA_CAUSAL_OVERLAY = [
  { pageNumber: 10, sourcePhrase: 'הטיפות ענו.' },
  { pageNumber: 11, sourcePhrase: 'טיפה נפלה.' },
  { pageNumber: 12, sourcePhrase: 'נפלה טיפה אחרונה.' },
] as const;

function applyQaCausalOverlay(migrated: BookVisualContractTemplate): void {
  for (const authority of QA_CAUSAL_OVERLAY) {
    const page = migrated.pageContracts.find((entry) => entry.pageNumber === authority.pageNumber);
    if (!page) throw new Error(`QA overlay page ${authority.pageNumber} is missing`);
    const sourceEvidenceId = `se1_${createHash('sha256')
      .update(
        JSON.stringify({
          scope: 'local-qa-causal-overlay/v2',
          storyKey: 'fox_uri_adventure',
          pageNumber: authority.pageNumber,
          sourcePhrase: authority.sourcePhrase,
        }),
      )
      .digest('hex')}`;
    const checkId = `action:page_${authority.pageNumber}_water_drop_into_bucket`;
    page.propConstraints ??= [];
    if (!page.propConstraints.some((entry) => entry.propId === 'prop_water_drops')) {
      page.propConstraints.push({ propId: 'prop_water_drops', visibility: 'required' });
    }
    page.actionRequirements = [
      ...(page.actionRequirements ?? []).filter((entry) => entry.checkId !== checkId),
      {
        checkId,
        subject: {
          kind: 'source_phenomenon',
          sourceEvidenceId,
          sourcePhrase: authority.sourcePhrase,
        },
        predicate: 'moves',
        object: { kind: 'prop', id: 'prop_water_drops' },
        spatialEffect: {
          kind: 'relation',
          relation: 'into',
          target: { kind: 'prop', id: 'prop_tin_bucket' },
        },
        polarity: 'must',
      },
    ];
    for (const projected of projectPageMustShow(
      page,
      migrated as unknown as BookVisualContract,
    )) {
      if (!page.mustShow.includes(projected)) page.mustShow.push(projected);
    }
  }
}

function focalPropRegion(
  propId: string,
  focalRegion: BlueprintRegion,
  propIndex: number,
  pageNumber: number,
): BlueprintRegion {
  if (IS_DINI_BAR) {
    if (pageNumber === 2 && propId === 'prop_toy_chest_portal') return { ...focalRegion };
    if (pageNumber === 4 && propId === 'prop_small_stone') {
      return {
        x: focalRegion.x + Math.floor(focalRegion.width * 0.58),
        y: focalRegion.y + Math.floor(focalRegion.height * 0.72),
        width: 54,
        height: 42,
      };
    }
    if (pageNumber === 5 && propId === 'prop_soft_nest') return { ...focalRegion };
    if (pageNumber === 5 && propId === 'prop_green_speckled_egg') {
      return regionInside(focalRegion);
    }
  }
  if (propId === 'prop_tin_bucket') return { ...focalRegion };
  if (propId === 'prop_water_drops') return verticalPathInto(focalRegion);
  return {
    x: 120 + (propIndex % 4) * 180,
    y: 585 + Math.floor(propIndex / 4) * 70,
    width: 120,
    height: 115,
  };
}

function buildPackage(
  rawStorySource: string,
  migrated: BookVisualContractTemplate,
  shotPlan: BookShotPlan,
) {
  const storyboardByPage = new Map(
    shotPlan.pages.map((shot) => [shot.page, projectPageShotToBlueprintStoryboard(shot)]),
  );
  const diversityIssues = validateBlueprintStoryboardDiversity([...storyboardByPage.values()]);
  if (diversityIssues.length > 0) {
    throw new Error(`Storyboard diversity rejected: ${diversityIssues.join(' | ')}`);
  }

  return buildVisualPackageV4Fixture('wizard_runtime_qualification', undefined, {
    storyKey: IS_DINI_BAR ? 'dragon_dini_fantasy' : 'fox_uri_adventure',
    pageCount: shotPlan.pageCount,
    rawStorySource,
    sourcePath: IS_DINI_BAR
      ? 'story-bank/v3-approved/dragon_dini_fantasy.md'
      : 'story-bank/v3-approved/fox_uri_adventure.md',
    styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
    styleContent: {
      styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
      renderingContract:
        IS_DINI_BAR
          ? 'premium cinematic hand-painted storybook watercolor and gouache on textured paper; Bar must retain recognisable real facial structure from the supplied photo with anatomically natural five-year-old proportions; richly modeled light and dimensional environments; expressive but never flat cartoon, mascot, chibi, plastic 3D or photorealistic'
          : 'soft hand-drawn storybook watercolor; observational semi-naturalistic child anatomy; ordinary human eyes, nose, mouth, hands and feet; expressive but never mascot-like; non-photographic',
    },
    mutateTemplate(template) {
      replaceObject(
        template as unknown as Record<string, unknown>,
        migrated as unknown as Record<string, unknown>,
      );
    },
    mutateWorld({ template, connections, affordances, revealSafeSupportingGeometry, frames }) {
      connections.splice(0, connections.length);
      affordances.splice(0, affordances.length);
      revealSafeSupportingGeometry.splice(0, revealSafeSupportingGeometry.length);

      const contract = template as unknown as BookVisualContract;
      const pageByNumber = new Map(template.pageContracts.map((page) => [page.pageNumber, page]));
      const locationById = new Map(template.locations.map((location) => [location.id, location]));
      const safetyIdsByPage = new Map<number, string[]>();

      for (const [index, frame] of frames.entries()) {
        const pageNumber = frame.kind === 'cover' ? null : frame.pageNumber;
        const page = pageNumber == null ? null : pageByNumber.get(pageNumber)!;
        const frameAuthority = page ?? template.coverContract;
        const locationId = page?.locationId ?? template.coverContract.locationId;
        const zoneId = page?.zoneId ?? template.coverContract.zoneId!;
        const requiredProps = requiredPropIdsForPage(contract, pageNumber ?? 0);
        const forbiddenProps = forbiddenPropIdsForPage(contract, pageNumber ?? 0);
        const actions = (page?.actionRequirements ?? []).filter((action) => action.polarity === 'must');
        const castIds = [...(frameAuthority.castIds ?? [])];
        const frameId = frame.id;
        const storyboard = pageNumber == null ? null : storyboardByPage.get(pageNumber)!;
        if (pageNumber != null && !storyboard) {
          throw new Error(`Storyboard page ${pageNumber} is missing`);
        }

        frame.locationId = locationId;
        frame.zoneId = zoneId;
        frame.castIds = [...castIds];
        frame.propLifecycle = {
          requiredPropIds: [...requiredProps],
          forbiddenPropIds: [...forbiddenProps],
        };
        frame.narrative =
          pageNumber == null
            ? {
                purpose: 'cover_promise',
                summary: IS_DINI_BAR
                  ? 'A bedroom portal opens onto Dini’s orange-hill world and a lesson about protective space.'
                  : 'A quiet nighttime mystery becomes a safe shared rhythm.',
              }
            : {
                purpose:
                  pageNumber === 1
                    ? 'establish_world'
                    : pageNumber === 5
                      ? 'reveal'
                      : pageNumber === 12
                        ? 'resolution'
                        : page?.transition?.kind !== 'steady'
                          ? 'transition'
                          : 'advance_action',
                summary: [page?.camera, ...(page?.mustShow ?? [])].filter(Boolean).join(' | '),
              };

        const placements: BlueprintFramePlacement[] = [];
        for (const [castIndex, castId] of castIds.entries()) {
          const region =
            pageNumber == null
              ? castIndex === 0
                ? { x: 110, y: 330, width: 300, height: 390 }
                : { x: 590, y: 430, width: 240, height: 290 }
              : castIndex === 0
                ? storyboard!.childRegion
                : storyboard!.companionRegion;
          placements.push({
            id: `placement:${pageNumber ?? 'cover'}:cast:${castIndex}`,
            subject: { kind: 'cast', castId },
            region: { ...region },
            depth: castIndex === 0 ? 'midground' : 'foreground',
            importance: 'key',
          });
        }
        for (const [propIndex, propId] of requiredProps.entries()) {
          const projectedRegion =
            pageNumber == null
              ? { x: 380 + propIndex * 120, y: 600, width: 120, height: 110 }
              : focalPropRegion(propId, storyboard!.focalRegion, propIndex, pageNumber);
          placements.push({
            id: `placement:${pageNumber ?? 'cover'}:prop:${propIndex}`,
            subject: { kind: 'prop', propId },
            region: projectedRegion,
            depth: 'foreground',
            importance: 'key',
          });
        }
        for (const [actionIndex, action] of actions.entries()) {
          const spatialTarget =
            action.spatialEffect?.kind === 'relation'
              ? action.spatialEffect.target
              : null;
          const targetPlacement =
            spatialTarget
              ? placements.find(
                  (placement) =>
                    placement.subject.kind === spatialTarget.kind &&
                    placement.subject.kind === 'prop' &&
                    placement.subject.propId === spatialTarget.id,
                )
              : undefined;
          const isIntoTarget =
            action.spatialEffect?.kind === 'relation' &&
            action.spatialEffect.relation === 'into' &&
            targetPlacement;
          placements.push({
            id: `placement:${pageNumber}:action:${actionIndex}`,
            subject: { kind: 'action', checkId: action.checkId },
            region: isIntoTarget
              ? verticalPathInto(targetPlacement.region)
              : { ...(storyboard?.actionRegion ?? { x: 80, y: 260, width: 760, height: 470 }) },
            depth: 'midground',
            importance: 'key',
          });
          if (action.spatialEffect) {
            placements.push({
              id: `placement:${pageNumber}:action-destination:${actionIndex}`,
              subject: { kind: 'action_destination', checkId: action.checkId },
              region: targetPlacement
                ? regionInside(targetPlacement.region)
                : { x: 420, y: 560, width: 90, height: 70 },
              depth: 'foreground',
              importance: 'key',
            });
          }
        }
        frame.placements = placements;

        const cameraId = `affordance:camera:${frameId}`;
        affordances.push({
          id: cameraId,
          kind: 'camera_access',
          zoneId,
          footprint: { x: 0, y: 850, width: 140, height: 140 },
          visibleRegion: { x: 0, y: 0, width: 1000, height: 750 },
          consumers: [{ kind: 'frame', frameId }],
        });
        frame.camera = {
          shot: storyboard?.camera.shot ?? 'wide',
          angle: storyboard?.camera.angle ?? 'eye_level',
          affordanceId: cameraId,
        };
        frame.affordanceIds = [cameraId];

        for (const [actionIndex, action] of actions.entries()) {
          const spatialTarget =
            action.spatialEffect?.kind === 'relation'
              ? action.spatialEffect.target
              : null;
          const supportedEntities = [] as Array<{
            kind: 'cast' | 'prop' | 'anchor' | 'spatial';
            id: string;
          }>;
          if (action.subject.kind === 'entity') supportedEntities.push(action.subject.entity);
          if (action.subject.kind === 'cast_group') {
            supportedEntities.push(
              ...action.subject.castIds.map((id) => ({ kind: 'cast' as const, id })),
            );
          }
          if (action.object) supportedEntities.push(action.object);
          if (action.spatialEffect?.kind === 'relation') supportedEntities.push(action.spatialEffect.target);
          if (action.spatialConstraint) supportedEntities.push(action.spatialConstraint.target);
          const actionId = `affordance:action:${pageNumber}:${actionIndex}`;
          const targetRegion =
            spatialTarget
              ? placements.find(
                  (placement) =>
                    placement.subject.kind === spatialTarget.kind &&
                    placement.subject.kind === 'prop' &&
                    placement.subject.propId === spatialTarget.id,
                )?.region
              : undefined;
          affordances.push({
            id: actionId,
            kind: 'action_space',
            zoneId,
            footprint: { x: 0, y: 0, width: 1000, height: 750 },
            supportedPredicates: [action.predicate],
            supportedSubjectKinds: [
              action.subject.kind === 'entity' ? action.subject.entity.kind : action.subject.kind,
            ],
            supportedEntities,
            supportedSpatialDirections:
              action.spatialEffect?.kind === 'directional' ? [action.spatialEffect.direction] : [],
            supportedSpatialRelations:
              action.spatialEffect?.kind === 'relation' ? [action.spatialEffect.relation] : [],
            supportedSpatialConstraintRelations: action.spatialConstraint
              ? [action.spatialConstraint.relation]
              : [],
            spatialTargetRegions:
              action.spatialEffect?.kind === 'relation' && targetRegion
                ? [{ target: action.spatialEffect.target, region: targetRegion }]
                : [],
            maximumActors: Math.max(
              1,
              action.subject.kind === 'cast_group' ? action.subject.castIds.length : 1,
            ),
            consumers: [{ kind: 'action', pageNumber: pageNumber!, checkId: action.checkId }],
          });
          addUnique(frame.affordanceIds, actionId);
        }

        for (const [propIndex, propId] of requiredProps.entries()) {
          const placement = placements.find(
            (entry) => entry.subject.kind === 'prop' && entry.subject.propId === propId,
          );
          if (!placement) throw new Error(`prop placement ${propId} is missing`);
          const supportAnchor = locationById.get(locationId)?.anchors?.[0];
          if (!supportAnchor) throw new Error(`location ${locationId} has no support anchor`);
          const propAffordanceId = `affordance:prop:${pageNumber}:${propIndex}`;
          affordances.push({
            id: propAffordanceId,
            kind: 'placement_support',
            zoneId,
            footprint: {
              x: Math.max(0, placement.region.x - 20),
              y: Math.max(0, placement.region.y - 20),
              width: placement.region.width + 40,
              height: placement.region.height + 40,
            },
            support: { kind: 'anchor', id: supportAnchor.id },
            supportedEntities: [{ kind: 'prop', id: propId }],
            maximumOccupants: 1,
            consumers: [{ kind: 'placement', pageNumber: pageNumber!, propId }],
          });
          addUnique(frame.affordanceIds, propAffordanceId);
        }

        if (pageNumber != null) {
          const pageSafetyIds: string[] = [];
          for (const [safetyIndex, safety] of (page?.safetyConstraints ?? []).entries()) {
            const safetyId = `affordance:safety:${pageNumber}:${safetyIndex}`;
            affordances.push({
              id: safetyId,
              kind: 'safe_boundary',
              zoneId,
              footprint: { x: 800, y: 0, width: 80, height: 750 },
              target: safety.target,
              permittedRegion: { x: 0, y: 0, width: 1000, height: 750 },
              consumers: [
                {
                  kind: 'safety',
                  pageNumber,
                  subjectId: safety.subjectId,
                  relation: safety.relation,
                  target: safety.target,
                },
              ],
            });
            pageSafetyIds.push(safetyId);
            addUnique(frame.affordanceIds, safetyId);
          }
          safetyIdsByPage.set(pageNumber, pageSafetyIds);
        }

        frame.continuity = {
          previousFrameId: index === 0 ? null : frames[index - 1]!.id,
          transitionKind: page?.transition?.kind ?? 'steady',
          carryoverRefs: [
            ...castIds.map((id) => ({ kind: 'cast' as const, id })),
            ...requiredProps.map((id) => ({ kind: 'prop' as const, id })),
          ],
        };
      }

      for (let index = 2; index < frames.length; index += 1) {
        const current = frames[index]!;
        if (current.kind !== 'page') throw new Error('cross-zone cover transition is unsupported');
        const page = pageByNumber.get(current.pageNumber)!;
        if (!page.transition || page.transition.kind === 'steady') continue;
        const fromZoneId = page.transition.fromZoneId!;
        const toZoneId = page.transition.toZoneId!;
        const connectionId = `connection:${fromZoneId}:${toZoneId}:${current.pageNumber}`;
        const traversalId = `affordance:traversal:${current.pageNumber}`;
        const openingId = `affordance:opening:${current.pageNumber}`;
        const boundaryId = `affordance:boundary:${current.pageNumber}`;
        const transitionConsumer = { kind: 'transition' as const, pageNumber: current.pageNumber };
        const targetAnchor = locationById.get(current.locationId)?.anchors?.[0];
        if (!targetAnchor) throw new Error(`location ${current.locationId} has no transition anchor`);
        const openingCandidates: BlueprintRegion[] = [
          { x: 0, y: 260, width: 180, height: 520 },
          { x: 820, y: 260, width: 180, height: 520 },
        ];
        const requiredPropPlacements = current.placements.filter(
          (placement) =>
            placement.subject.kind === 'prop' &&
            current.propLifecycle.requiredPropIds.includes(placement.subject.propId),
        );
        const openingRegion = openingCandidates.find((candidate) =>
          requiredPropPlacements.every(
            (placement) => !regionsOverlap(candidate, placement.region),
          ),
        );
        if (!openingRegion) {
          throw new Error(`No collision-free transition opening exists on page ${current.pageNumber}`);
        }
        affordances.push(
          {
            id: traversalId,
            kind: 'traversal',
            zoneId: current.zoneId,
            footprint: { x: 0, y: 0, width: 1000, height: 750 },
            connectionId,
            direction: 'forward',
            minimumClearance: 180,
            consumers: [transitionConsumer],
          },
          {
            id: openingId,
            kind: 'opening_clearance',
            zoneId: current.zoneId,
            footprint: { ...openingRegion },
            clearanceRegion: { ...openingRegion },
            connectionId,
            consumers: [transitionConsumer],
          },
          {
            id: boundaryId,
            kind: 'safe_boundary',
            zoneId: current.zoneId,
            footprint: { x: 800, y: 250, width: 80, height: 700 },
            target: { kind: 'anchor', id: targetAnchor.id },
            permittedRegion: { x: 0, y: 0, width: 1000, height: 750 },
            consumers: [transitionConsumer],
          },
        );
        current.continuity.connectionId = connectionId;
        addUnique(current.affordanceIds, traversalId);
        addUnique(current.affordanceIds, openingId);
        addUnique(current.affordanceIds, boundaryId);
        connections.push({
          id: connectionId,
          from: { zoneId: fromZoneId },
          to: { zoneId: toZoneId },
          kind: 'threshold',
          bidirectional: false,
          traversalAffordanceIds: [traversalId],
          openingClearanceAffordanceIds: [openingId],
          safeBoundaryAffordanceIds: [
            ...(safetyIdsByPage.get(current.pageNumber) ?? []),
            boundaryId,
          ],
        });
      }
    },
  }).packageValue;
}

function loadOnlyOpenAiKey(): void {
  const envPath = 'C:\\GNart\\Work\\Small_Heroes\\.env.local';
  const values = parseEnv(fs.readFileSync(envPath));
  const key = values.OPENAI_API_KEY?.trim();
  if (!key) throw new Error('OPENAI_API_KEY is missing from the approved local source');
  process.env.OPENAI_API_KEY = key;
}

async function startLocalStorage(): Promise<http.Server> {
  fs.mkdirSync(STORAGE_ROOT, { recursive: true });
  const server = http.createServer((request, response) => {
    const requestPath = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
    const objectPrefix = '/storage/v1/object/';
    const publicPrefix = '/storage/v1/object/public/';
    const isPublic = requestPath.startsWith(publicPrefix);
    const relative = requestPath.slice((isPublic ? publicPrefix : objectPrefix).length);
    const localPath = path.join(STORAGE_ROOT, ...relative.split('/').filter(Boolean));
    if (!localPath.startsWith(STORAGE_ROOT)) {
      response.writeHead(400).end();
      return;
    }
    if (request.method === 'POST' && requestPath.startsWith(objectPrefix) && !isPublic) {
      const chunks: Buffer[] = [];
      request.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      request.on('end', () => {
        fs.mkdirSync(path.dirname(localPath), { recursive: true });
        fs.writeFileSync(localPath, Buffer.concat(chunks));
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end('{"stored":true}');
      });
      return;
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && isPublic && fs.existsSync(localPath)) {
      response.writeHead(200, { 'content-type': 'image/png' });
      if (request.method === 'GET') response.end(fs.readFileSync(localPath));
      else response.end();
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('local storage did not bind');
  process.env.SUPABASE_URL = `http://127.0.0.1:${address.port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-measurement-only';
  process.env.SUPABASE_STORAGE_BUCKET = 'local-images';
  process.env.SUPABASE_PERSIST_MAX_ATTEMPTS = '1';
  process.env.SUPABASE_PERSIST_TIMEOUT_MS = '15000';
  return server;
}

async function createFivePageContactSheet(
  renders: Array<{ pageNumber: number; localImage: string }>,
): Promise<{ path: string; sha256: string } | null> {
  if (!IS_DINI_BAR || renders.length !== 5) return null;
  const sharp = (await import('sharp')).default;
  const cellWidth = 320;
  const cellHeight = 500;
  const composites: Array<{ input: Buffer; left: number; top: number }> = [];
  for (const [index, render] of renders.entries()) {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const imagePath = path.resolve(ROOT, render.localImage);
    const resized = await sharp(imagePath)
      .resize({ width: 300, height: 450, fit: 'contain', background: '#f6f0e6' })
      .png()
      .toBuffer();
    composites.push({ input: resized, left: column * cellWidth + 10, top: row * cellHeight + 38 });
    composites.push({
      input: Buffer.from(
        `<svg width="300" height="32"><text x="150" y="23" text-anchor="middle" font-family="Arial" font-size="22" font-weight="700" fill="#2d241d">Page ${render.pageNumber}</text></svg>`,
      ),
      left: column * cellWidth + 10,
      top: row * cellHeight + 4,
    });
  }
  const contactPath = path.join(OUTPUT_ROOT, 'contact-sheet-pages-01-05.png');
  await sharp({
    create: {
      width: cellWidth * 3,
      height: cellHeight * 2,
      channels: 4,
      background: '#f6f0e6',
    },
  })
    .composite(composites)
    .png()
    .toFile(contactPath);
  return {
    path: path.relative(ROOT, contactPath).replace(/\\/g, '/'),
    sha256: createHash('sha256').update(fs.readFileSync(contactPath)).digest('hex'),
  };
}

async function main(): Promise<void> {
  if (fs.existsSync(OUTPUT_ROOT) && fs.readdirSync(OUTPUT_ROOT).length > 0) {
    throw new Error(`Output root already exists and is non-empty: ${OUTPUT_ROOT}`);
  }
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
  process.env.ENABLE_V3_APPROVED_BANK = 'true';
  process.env.VISUAL_CONTRACT_ENFORCEMENT = 'true';

  const sourcePath = path.join(
    ROOT,
    'story-bank',
    'v3-approved',
    IS_DINI_BAR ? 'dragon_dini_fantasy.md' : 'fox_uri_adventure.md',
  );
  const explicitTemplatePath = process.argv
    .find((value) => value.startsWith('--template-path='))
    ?.slice(16);
  const templatePath = IS_DINI_BAR
    ? path.resolve(
        explicitTemplatePath ??
          'C:\\GNart\\Work\\Small_Heroes\\_review\\vc-live-cheap\\dragon_dini_fantasy.visual-contract-template.json',
      )
    : path.join(
        ROOT,
        'story-bank',
        'v3-approved',
        'fox_uri_adventure.visual-contract-template.json',
      );
  const shotPlanPath = IS_DINI_BAR
    ? null
    : path.join(ROOT, 'story-bank', 'v3-approved', 'fox_uri_adventure.shot-plan.json');
  const rawStorySource = fs.readFileSync(sourcePath, 'utf8');
  const parsedStorySource = parseStorySourceContent(rawStorySource);
  const storyPageText = new Map(
    parsedStorySource.pages.map((page) => [page.pageNumber, page.text]),
  );
  const storyPageDirection = new Map(
    parsedStorySource.pageImageDirections.map((page) => [
      page.pageNumber,
      page.imageDirection,
    ]),
  );
  const legacyTemplate = JSON.parse(fs.readFileSync(templatePath, 'utf8')) as unknown;
  const shotPlan = IS_DINI_BAR
    ? DINI_BAR_SHOT_PLAN
    : (JSON.parse(fs.readFileSync(shotPlanPath!, 'utf8')) as BookShotPlan);
  const migrated = migrateLegacyBookVisualContractTemplateV1(
    legacyTemplate,
    IS_DINI_BAR
      ? undefined
      : {
          areaZoneIds: {
            set_room_balcony_night: {
              board_room_openings: ['z_room_window', 'z_window_threshold'],
              board_balcony: ['z_balcony_railing', 'z_balcony_bucket_corner'],
            },
          },
          pageZoneNodeIds: {
            z_balcony_railing: { railing: 'metal_railing' },
          },
        },
  );
  if (IS_DINI_BAR) applyDiniBarFivePageMeasurementOverlay(migrated);
  else applyQaCausalOverlay(migrated);
  const migratedValidation = validateBookVisualContractTemplate(migrated);
  if (!migratedValidation.ok) {
    throw new Error(`Measurement Visual Contract invalid: ${migratedValidation.errors.join(' | ')}`);
  }

  const selectedSlot = enforceMvpOrderSlot({
    challengeCategory: IS_DINI_BAR ? 'NEW_SIBLING' : 'NIGHT_FEAR',
    clientDirection: IS_DINI_BAR ? 'fantasy' : 'adventure',
    clientCompanionId: IS_DINI_BAR ? 'dragon_dini' : 'fox_uri',
  });
  const productTruth = resolveStoryProductTruth({
    challengeCategory: selectedSlot.category,
    clientDirection: selectedSlot.direction,
    companionId: selectedSlot.companionId,
  });
  if (!productTruth.storyFile) throw new Error('Story Source resolution failed');
  const frozenProduct = buildFrozenStoryProductTruth({
    storyFilePath: productTruth.storyFile,
    expectedPageCount: productTruth.pages,
    storyDirection: productTruth.storyDirection,
  });
  const packageValue = buildPackage(rawStorySource, migrated, shotPlan);
  const storyboardRows = packageValue.blueprint.content.frames
    .filter((frame) => frame.kind === 'page')
    .map((frame) => {
      const layout = projectPageShotToBlueprintStoryboard(
        shotPlan.pages.find((entry) => entry.page === frame.pageNumber)!,
      );
      const page = migrated.pageContracts.find((entry) => entry.pageNumber === frame.pageNumber)!;
      return {
        pageNumber: frame.pageNumber,
        shotPlan: shotPlan.pages.find((entry) => entry.page === frame.pageNumber),
        contractCamera: page.camera,
        blueprintCamera: frame.camera,
        childRegion: layout.childRegion,
        companionRegion: layout.companionRegion,
        focalRegion: layout.focalRegion,
        signature: blueprintStoryboardFrameSignature(layout),
      };
    });
  const measuredRows = storyboardRows.filter((entry) => PAGE_NUMBERS.includes(entry.pageNumber));
  if (new Set(measuredRows.map((entry) => entry.signature)).size !== PAGE_NUMBERS.length) {
    throw new Error('Measured pages do not have distinct frame signatures');
  }
  fs.writeFileSync(
    path.join(OUTPUT_ROOT, 'storyboard-dry-run-evidence.json'),
    `${JSON.stringify(
      {
        version: 'local-wizard-storyboard-dry-run/v1',
        storySource: path.relative(ROOT, sourcePath).replace(/\\/g, '/'),
        shotPlan: shotPlanPath
          ? path.relative(ROOT, shotPlanPath).replace(/\\/g, '/')
          : 'embedded:r1d-dini-bar-five-page-measurement-authority',
        pageCount: storyboardRows.length,
        measuredPageCount: measuredRows.length,
        distinctMeasuredFrameSignatures: new Set(
          measuredRows.map((entry) => entry.signature),
        ).size,
        rows: measuredRows,
        credentialAccess: 'none',
        providerCalls: 0,
        productionBlocked: true,
      },
      null,
      2,
    )}\n`,
  );

  const publication = publishVisualPackageV4({
    repoRoot: AUTHORITY_ROOT,
    approvedPackagesDir: path.join(AUTHORITY_ROOT, 'visual-packages', 'approved'),
    packageValue,
    write: true,
  });
  const frozenPackage = buildFrozenVisualPackageAuthority({
    packageValue,
    packagePath: publication.packagePath,
  });
  const contract = bindApprovedPvbRuntimeAuthority(
    materialize(migrated, FAMILY),
    packageValue,
    frozenPackage,
  );
  const contractHash = computeVisualContractHash(contract);
  const cache = {
    storyFilePath: frozenProduct.selectionFilename,
    storyDir: 'v3-approved',
    selectionFilename: path.basename(frozenProduct.selectionFilename),
    visualPackageAuthority: frozenPackage,
    visualContract: contract as never,
  };
  const authority = requireStyle01RenderQualification({
    illustrationStyle: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
    frozenContractHash: contractHash,
    storySourceHash: frozenProduct.storySourceHash,
    cache,
    repoRoot: AUTHORITY_ROOT,
    pageNumbers: PAGE_NUMBERS,
  });
  if (!authority) throw new Error('Wizard render qualification did not return runtime authority');
  const authorityEvidence = {
    version: IS_DINI_BAR
      ? 'local-wizard-dini-bar-five-page-authority-evidence/v1'
      : 'local-wizard-full-book-authority-evidence/v1',
    measurement: MEASUREMENT,
    storySource: frozenProduct.selectionFilename,
    storySourceHash: frozenProduct.storySourceHash,
    shotPlanPath: shotPlanPath
      ? path.relative(ROOT, shotPlanPath).replace(/\\/g, '/')
      : 'embedded:r1d-dini-bar-five-page-measurement-authority',
    shotPlanSha256: shotPlanPath
      ? createHash('sha256').update(fs.readFileSync(shotPlanPath)).digest('hex')
      : createHash('sha256').update(JSON.stringify(shotPlan)).digest('hex'),
    templateInputPath: templatePath,
    templateInputSha256: createHash('sha256').update(fs.readFileSync(templatePath)).digest('hex'),
    distinctMeasuredFrameSignatures: new Set(measuredRows.map((entry) => entry.signature)).size,
    migratedTemplateVersion: migrated.schemaVersion,
    packageVersion: packageValue.manifestVersion,
    packageRevisionDigest: packageValue.revisionDigest,
    blueprintVersion: packageValue.blueprint.content.version,
    blueprintDigest: packageValue.blueprint.digest,
    runtimeAuthorityVersion: authority.version,
    runtimeContractHash: authority.contractHash,
    wizardRenderQualified: authority.qualification.renderQualified,
    pageNumbers: PAGE_NUMBERS,
    measurementOverlay: IS_DINI_BAR
      ? 'dini-bar-five-page-prop-placement-overlay/v1'
      : 'local-qa-causal-overlay/v2',
    childAnchorSha256: createHash('sha256').update(fs.readFileSync(CHILD_ANCHOR)).digest('hex'),
    productionBlocked: true,
  };
  fs.writeFileSync(
    path.join(OUTPUT_ROOT, 'authority-evidence.json'),
    `${JSON.stringify(authorityEvidence, null, 2)}\n`,
  );
  console.log(JSON.stringify({ stage: 'wizard_qualification_pass', ...authorityEvidence }, null, 2));
  if (process.argv.includes('--qualify-only')) return;

  loadOnlyOpenAiKey();
  process.env.IMAGE_PROVIDER = 'gpt-image';
  process.env.PHASE2_STYLE01_BOOK_PIPELINE = 'true';
  process.env.STYLE_01_GPT_MODEL = 'gpt-image-2';
  process.env.GPT_IMAGE_MODEL = 'gpt-image-2';
  process.env.STYLE_01_AUDITION_MODE = 'true';
  process.env.STYLE01_QA_IMAGE_QUALITY = 'low';
  process.env.GPT_IMAGE_QUALITY = 'low';
  process.env.PAGE_VISUAL_QA_ENABLED = 'false';
  process.env.ENABLE_PRESENTATION_POSTPROCESS = 'false';
  process.env.PAGE_REF_MANIFEST_DIR = path.join(OUTPUT_ROOT, 'reference-evidence');

  const storageServer = await startLocalStorage();
  try {
    const companionId = IS_DINI_BAR ? 'dragon_dini' : 'fox_uri';
    const companion = getCompanionById(companionId);
    if (!companion) throw new Error(`${companionId} companion is missing`);
    const renders = [];
    for (const pageNumber of RENDER_PAGE_NUMBERS) {
      const result = await generateImage({
        pagePrompt: storyPageDirection.get(pageNumber) ?? '',
        rawScenePrompt: storyPageDirection.get(pageNumber) ?? '',
        bookPageText: storyPageText.get(pageNumber) ?? '',
        illustrationStyle: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
        runtimeVisualAuthority: authority,
        companion,
        orderId: ORDER_ID,
        pageNumber,
        totalPages: shotPlan.pageCount,
        childFirstName: IS_DINI_BAR ? 'Bar' : 'Noam',
        childAge: IS_DINI_BAR ? 5 : 7,
        childGender: 'boy',
        childStructured: {
          face: IS_DINI_BAR
            ? 'recognisable real face from the supplied photo: warm brown almond eyes, round-oval cheeks, natural child nose and mouth proportions'
            : 'soft round-oval face, warm brown eyes, gentle expressive brows',
          hair: IS_DINI_BAR
            ? 'dense short dark-brown curls with the same curl silhouette as the supplied photo'
            : 'warm brown, softly wavy, short child haircut',
          body: IS_DINI_BAR
            ? 'anatomically natural small five-year-old boy proportions, never chibi or mascot-like'
            : 'small seven-year-old child proportions',
          clothing: 'authority supplied',
          signature: IS_DINI_BAR
            ? 'same real Bar identity across all five pages; consistent facial structure and curl silhouette without caricature'
            : 'gentle curious expression',
        },
        referenceImages: [CHILD_ANCHOR],
        requestTimeoutMs: 10 * 60 * 1000,
      });
      const urlPath = decodeURIComponent(new URL(result.url).pathname).replace(
        '/storage/v1/object/public/',
        '',
      );
      const storedPath = path.join(STORAGE_ROOT, ...urlPath.split('/').filter(Boolean));
      const finalPath = path.join(
        OUTPUT_ROOT,
        `page-${String(pageNumber).padStart(2, '0')}-wizard-storyboard-gpt-image-2-low.png`,
      );
      fs.copyFileSync(storedPath, finalPath);
      const promptPath = path.join(
        OUTPUT_ROOT,
        `page-${String(pageNumber).padStart(2, '0')}-final-prompt.txt`,
      );
      fs.writeFileSync(promptPath, `${result.prompt}\n`, 'utf8');
      const bytes = fs.readFileSync(finalPath);
      const cost = estimateGptImage2CostUsd(result.style01Meta?.usage ?? undefined);
      renders.push({
        pageNumber,
        model: result.provider,
        width: result.width,
        height: result.height,
        imageBytes: bytes.length,
        imageSha256: createHash('sha256').update(bytes).digest('hex'),
        localImage: path.relative(ROOT, finalPath).replace(/\\/g, '/'),
        usage: result.style01Meta?.usage ?? null,
        estimatedCostUsd: cost.estimatedCostUsd,
        promptSha256: createHash('sha256').update(result.prompt, 'utf8').digest('hex'),
        promptPath: path.relative(ROOT, promptPath).replace(/\\/g, '/'),
      });
      console.log(
        JSON.stringify({
          stage: 'page_rendered',
          pageNumber,
          sha256: renders[renders.length - 1]?.imageSha256,
        }),
      );
    }
    const contactSheet = await createFivePageContactSheet(renders);
    const evidence = {
      ...authorityEvidence,
      status: IS_DINI_BAR
        ? 'rendered_local_low_dini_bar_five_page_measurement'
        : 'rendered_local_low_full_book_measurement',
      quality: 'low',
      providerCalls: renders.length,
      transportRetries: 0,
      fallbackUsed: false,
      remoteDatabaseAccess: false,
      remoteStorageAccess: false,
      visualQaProviderCalls: 0,
      contactSheet,
      renders,
    };
    fs.writeFileSync(
      path.join(
        OUTPUT_ROOT,
        IS_DINI_BAR ? 'render-evidence-five-pages.json' : 'render-evidence-full-book.json',
      ),
      `${JSON.stringify(evidence, null, 2)}\n`,
    );
    console.log(JSON.stringify(evidence, null, 2));
  } finally {
    await new Promise<void>((resolve, reject) =>
      storageServer.close((error) => (error ? reject(error) : resolve())),
    );
    delete process.env.OPENAI_API_KEY;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
