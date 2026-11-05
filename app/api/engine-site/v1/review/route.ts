import {NextRequest} from 'next/server';
import {engineReaderPorts} from '@/lib/engine-site/reader-production';
import {engineSiteOrigin} from '@/lib/engine-site/fulfillment';
import {handleEngineOperator} from '@/lib/engine-site/operator-http';
export const runtime='nodejs';
export async function GET(req:NextRequest) {
  req.nextUrl.searchParams.set('view','cases');
  const ports=engineReaderPorts();return handleEngineOperator(req,null,{...ports,fulfillment:()=>({storage:ports.storage(),origin:engineSiteOrigin()})});
}
