import 'server-only';
import {z} from 'zod';
import {engineSiteFail} from './contract';

export const ENGINE_RESPONSE_QUEUE_POLICY='bounded-responses-queue/v1' as const;
export const responseQueueTimingSchema=z.object({version:z.literal(ENGINE_RESPONSE_QUEUE_POLICY),
 queueMs:z.literal(1_800_000),generationMs:z.number().int().positive().max(3_600_000),absoluteMs:z.literal(3_600_000)}).strict();
export type ResponseQueueTiming=z.infer<typeof responseQueueTimingSchema>;
export const responseQueueTiming=(generationMs:number):Readonly<ResponseQueueTiming>=>Object.freeze(responseQueueTimingSchema.parse({
 version:ENGINE_RESPONSE_QUEUE_POLICY,queueMs:1_800_000,generationMs,absoluteMs:3_600_000}));

/** Derive from append-only observations, never a mutable/resettable timer. No provider or clock access here. */
export function responseQueueDeadline(timing:ResponseQueueTiming,dispatchAt:number,polls:readonly {id:string;raw:unknown;at:number}[],now:number){
 const t=responseQueueTimingSchema.parse(timing);
 if(!Number.isSafeInteger(dispatchAt)||dispatchAt<0||!Number.isSafeInteger(now)||now<dispatchAt)engineSiteFail('engine_queue_clock');
 let activeAt:number|undefined,previous=dispatchAt,id:string|undefined;
 for(const [i,p]of polls.entries()){
  if(!/^resp_[A-Za-z0-9_-]+$/.test(p.id)||id!==undefined&&p.id!==id||!Number.isSafeInteger(p.at)||p.at<previous||p.at>now)engineSiteFail('engine_queue_observation');
  id=p.id;previous=p.at;const raw=p.raw as any;
  if(raw?.transientPoll===true){if(i===0)engineSiteFail('engine_queue_observation');continue;}
  if(raw?.id!==id||!['queued','in_progress'].includes(raw?.status))engineSiteFail('engine_queue_observation');
  if(raw.status==='in_progress'&&activeAt===undefined)activeAt=p.at;
  if(raw.status==='queued'&&activeAt!==undefined)engineSiteFail('engine_queue_regressed');
 }
 const queueDeadline=dispatchAt+t.queueMs,absoluteDeadline=dispatchAt+t.absoluteMs;
 if(activeAt!==undefined&&activeAt>=queueDeadline)engineSiteFail('engine_queue_deadline');
 const generationDeadline=activeAt===undefined?undefined:activeAt+t.generationMs+45_000;
 const deadlineAt=Math.min(absoluteDeadline,generationDeadline??queueDeadline);
 if(now>=deadlineAt)engineSiteFail(deadlineAt===absoluteDeadline?'engine_queue_absolute_deadline':activeAt===undefined?'engine_queue_deadline':'engine_generation_deadline');
 return{dispatchAt,queueDeadline,activeAt,generationDeadline,absoluteDeadline,deadlineAt};
}
