import {engineTestDb} from './engine-test-db';
/** Extend only the new real-path fixtures; historical checkout fixtures retain their own schema additions. */
export async function r4TestDb(){
 const s=await engineTestDb();await s.pg.exec(`ALTER TABLE "Order" ADD COLUMN "paymentId" text,ADD COLUMN "totalPrice" int DEFAULT 5900,ADD COLUMN "paymeMetadata" jsonb,ADD COLUMN "stripePaid" boolean DEFAULT false;
 ALTER TABLE "GenerationJob" ADD COLUMN "staleReclaimCount" int DEFAULT 0,ADD COLUMN "lastReclaimStage" text,ADD COLUMN "lastChainStatus" int,ADD COLUMN "lastChainError" text,ADD COLUMN "lastWorkerKickAt" timestamptz;`);
 const find=s.db.generationJob.findMany.bind(s.db.generationJob);
 s.db.generationJob.findMany=(async(args:any)=>{const rows=await find(args);if(args.select?.order)for(const row of rows)(row as any).order=await s.db.order.findUnique({where:{id:row.orderId}});return rows;}) as typeof find;
 return s;
}
