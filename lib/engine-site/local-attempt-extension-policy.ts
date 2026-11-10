/** Explicit local-test activation of the existing shared +1 storyboard contract. No default changes. */
import 'server-only';
import path from 'node:path';
import {z} from 'zod';
import {STORYBOARD_ATTEMPT_EXTENSION_VERSION,STORYBOARD_ATTEMPT_EXTENSION_V2} from '@/lib/personal-wizard/storyboard-repair';

const digest=z.string().regex(/^[a-f0-9]{64}$/),absolute=z.string().refine(path.isAbsolute);
const originalExtension=z.object({
 version:z.literal(STORYBOARD_ATTEMPT_EXTENSION_VERSION),maxAttempts:z.literal(4),approvalSha256:digest,
}).strict();
export const localAttemptExtensionPolicySchema=z.union([originalExtension,z.object({version:z.literal(STORYBOARD_ATTEMPT_EXTENSION_V2),maxAttempts:z.literal(5),approvalSha256:digest,previous:originalExtension}).strict()]);
export const localAttemptApprovalSchema=z.object({
 version:z.literal('engine-local-attempt-approval/v1'),stage:z.literal('initial_storyboard'),
 fromAttempt:z.literal(3),toAttempt:z.literal(4),maximumAttempts:z.literal(4),
 sourceRoot:absolute,sourceHead:z.string().regex(/^[a-f0-9]{40}$/),parentGrantSha256:digest,rootConsentSha256:digest,
 requestSha256:digest,optionsSha256:digest,directory:absolute,readerId:z.string().min(1),ownerGoFile:absolute,
 maximumPlanningMicroUsd:z.literal(2400000),maximumPlanningCalls:z.literal(2),
 maximumTotalMicroUsd:z.literal(12000000),maximumTotalCalls:z.literal(121),furtherAttemptAllowed:z.literal(false),
}).strict();
export const localAttemptOwnerGoSchema=z.object({
 version:z.literal('engine-local-attempt-owner-go/v1'),kind:z.literal('new_explicit_owner_stage_extension_approval'),
 approvedBy:z.literal('Guy'),approvedAt:z.string().datetime({precision:3}),
 approvalSha256:digest,sourceHead:z.string().regex(/^[a-f0-9]{40}$/),parentGrantSha256:digest,
 attempt:z.literal(4),maximumAttempts:z.literal(4),maximumPlanningCalls:z.literal(2),maximumPlanningMicroUsd:z.literal(2400000),
 maximumTotalMicroUsd:z.literal(12000000),maximumTotalCalls:z.literal(121),
 ownerStatement:z.string().min(12).max(4000),
}).strict();
