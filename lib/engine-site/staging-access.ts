/** Dedicated staging only. The PayMe webhook remains public at the transport layer and validates its signature/body itself. */
type StagingEnv=Readonly<Record<string,string|undefined>>;
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};
function sameSecret(actual:string,expected:string){
 let difference=actual.length^expected.length;
 // Fixed bounded work, Edge-compatible, no early prefix comparison or Node dependency.
 for(let n=0;n<1024;n++)difference|=(actual.charCodeAt(n)||0)^(expected.charCodeAt(n)||0);return difference===0;
}
export function enforceEngineStagingAccess(request:Request,env:StagingEnv=process.env):Response|null{
 if(env.ENGINE_SITE_STAGING_ACCESS_ENABLED!=='true')return null;
 const url=new URL(request.url),host=env.ENGINE_SITE_STAGING_HOST?.trim().toLowerCase(),user=env.ENGINE_SITE_STAGING_USER,password=env.ENGINE_SITE_STAGING_PASSWORD;
 if(env.ENGINE_SITE_ENVIRONMENT!=='staging'||url.protocol!=='https:'||env.VERCEL&& !['preview','development'].includes(env.VERCEL_ENV??'')||
   !host||['smallheroes.co.il','www.smallheroes.co.il'].includes(host)||!/^([a-z0-9-]+\.)*[a-z0-9-]+$/.test(host)||url.hostname.toLowerCase()!==host||
   !user||!password||user.includes(':')||user.length>128||password.length<20||password.length>256||!/^[-A-Za-z0-9._~]+$/.test(user+password))
  return Response.json({error:'staging_access_configuration_required'},{status:503,headers});
 if(url.pathname==='/api/webhooks/payme'&&request.method==='POST')return null;
 // Boolean-only wiring report (no values, no writes); still behind the platform's own deployment protection.
 if(url.pathname==='/api/engine-site/v1/qa/readiness'&&request.method==='GET')return null;
 const authorization=(request.headers.get('authorization')??'').replace(/^basic /i,'Basic '),internal=request.headers.get('x-smallheroes-staging-access')??'',expected='Basic '+btoa(user+':'+password);
 if((authorization.length>1024||!sameSecret(authorization,expected))&&(internal.length>1024||!sameSecret(internal,expected)))return Response.json({error:'staging_access_required'},
  {status:401,headers:{...headers,'WWW-Authenticate':'Basic realm="Small Heroes staging", charset="UTF-8"'}});
 return null;
}
/** Separate header preserves Bearer worker/cron authentication and never leaves the exact recorded staging origin. */
export function engineStagingInternalHeaders(target:string,env:StagingEnv=process.env):Record<string,string>{
 if(env.ENGINE_SITE_STAGING_ACCESS_ENABLED!=='true')return {};
 const url=new URL(target),probe=new Request(url,{headers:{authorization:'Basic '+btoa((env.ENGINE_SITE_STAGING_USER??'')+':'+(env.ENGINE_SITE_STAGING_PASSWORD??''))}});
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||enforceEngineStagingAccess(probe,env))throw Error('engine_staging_target_invalid');
 return {'x-smallheroes-staging-access':probe.headers.get('authorization')!};
}
