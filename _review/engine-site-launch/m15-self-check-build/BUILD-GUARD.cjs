// Local build guard only: no environment files, inherited secrets, network or writes outside ignored proof output.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=process.cwd(),allowed=path.join(root,'.next','m15-build-proof');
function pathname(value){if(typeof value==='number')return null;if(value instanceof URL)return require('node:url').fileURLToPath(value);return typeof value==='string'||Buffer.isBuffer(value)?path.resolve(String(value)):null;}
function envFile(value){const p=pathname(value);return p&&/^\.env(?:\.|$)/i.test(path.basename(p));}
function denied(message,code='EACCES'){const e=new Error(message);e.code=code;return e;}
function checkRead(value){if(envFile(value))throw denied('BUILD_GUARD_ENV_FILE_DENIED','ENOENT');}
function checkWrite(value){const p=pathname(value);if(p&&p!==allowed&&!p.startsWith(allowed+path.sep))throw denied('BUILD_GUARD_WRITE_OUTSIDE_IGNORED_OUTPUT: '+path.relative(root,p));}
for(const key of ['readFileSync','readFile','createReadStream']){const original=fs[key];fs[key]=function(p,...args){checkRead(p);return original.call(this,p,...args);};}
for(const key of ['writeFileSync','writeFile','appendFileSync','appendFile','mkdirSync','mkdir','rmSync','rm','rmdirSync','rmdir','unlinkSync','unlink','createWriteStream','truncateSync','truncate','chmodSync','chmod']){const original=fs[key];if(original)fs[key]=function(p,...args){checkWrite(p);return original.call(this,p,...args);};}
for(const key of ['renameSync','rename','copyFileSync','copyFile']){const original=fs[key];fs[key]=function(a,b,...args){if(key.startsWith('copy'))checkRead(a);else checkWrite(a);checkWrite(b);return original.call(this,a,b,...args);};}
for(const key of ['openSync','open']){const original=fs[key];fs[key]=function(p,flags,...args){checkRead(p);if(typeof flags==='number'?flags!==fs.constants.O_RDONLY:/[wa+]/.test(String(flags)))checkWrite(p);return original.call(this,p,flags,...args);};}
const fsp=fs.promises;
for(const key of ['readFile']){const original=fsp[key];fsp[key]=async function(p,...args){checkRead(p);return original.call(this,p,...args);};}
for(const key of ['writeFile','appendFile','mkdir','rm','rmdir','unlink','truncate','chmod']){const original=fsp[key];if(original)fsp[key]=async function(p,...args){checkWrite(p);return original.call(this,p,...args);};}
for(const key of ['rename','copyFile']){const original=fsp[key];fsp[key]=async function(a,b,...args){if(key.startsWith('copy'))checkRead(a);else checkWrite(a);checkWrite(b);return original.call(this,a,b,...args);};}
const originalOpen=fsp.open;fsp.open=async function(p,flags,...args){checkRead(p);if(typeof flags==='number'?flags!==fs.constants.O_RDONLY:/[wa+]/.test(String(flags)))checkWrite(p);return originalOpen.call(this,p,flags,...args);};
const originalLoad=Module._load;
Module._load=function(id,...args){if(id==='@next/env')return{loadEnvConfig:()=>({combinedEnv:process.env,parsedEnv:{},loadedEnvFiles:[]}),updateInitialEnv:()=>{},resetEnv:()=>{},processEnv:()=>[process.env,{}]};return originalLoad.call(this,id,...args);};
const fontHosts=new Set(['fonts.googleapis.com','fonts.gstatic.com']);
function fontRequest(input,options){try{const u=typeof input==='string'||input instanceof URL?new URL(input):null;const o=u?{...options,hostname:u.hostname,protocol:u.protocol}:input;return o.protocol!=='http:'&&fontHosts.has(o.hostname||o.host)&&(!o.method||o.method==='GET');}catch{return false;}}
const socketConnect=require('node:net').Socket.prototype.connect;
require('node:net').Socket.prototype.connect=function(...args){const a=Array.isArray(args[0])?args[0][0]:args[0];if(!a||!fontHosts.has(a.host||a.hostname||a.servername))throw denied('BUILD_GUARD_NETWORK_DENIED');return socketConnect.apply(this,args);};
for(const protocol of ['node:http','node:https'])for(const method of ['request','get']){const lib=require(protocol),original=lib[method];lib[method]=function(...args){if(!fontRequest(args[0],args[1]))throw denied('BUILD_GUARD_NETWORK_DENIED');return original.apply(this,args);};}
const originalFetch=globalThis.fetch;globalThis.fetch=async function(input,init){if(!fontRequest(input,init))throw denied('BUILD_GUARD_NETWORK_DENIED');return originalFetch(input,init);};
const config=require(path.join(root,'next.config.js'));config.distDir='.next/m15-build-proof/output-final';
process.env.NEXT_TELEMETRY_DISABLED='1';
