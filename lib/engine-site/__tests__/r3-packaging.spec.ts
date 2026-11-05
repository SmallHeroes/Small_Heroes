import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
const load=createRequire(path.resolve('package.json')),config=load(path.resolve('next.config.js')),picomatch=load('next/dist/compiled/picomatch');
const policy=load(path.resolve('scripts/lib/engine-package.cjs')),native=load(path.resolve('scripts/lib/native-media.cjs'));
const optionPackage=load(path.resolve('scripts/lib/option-package.cjs'));
const roots:string[]=[];afterEach(()=>{vi.unstubAllEnvs();for(const root of roots.splice(0))fs.rmSync(root,{recursive:true,force:true});});
describe('R3 actual deployment command and paid-path package contract',()=>{
 it('uses one canonical build command on Vercel, including the packager',()=>{
  expect(JSON.parse(fs.readFileSync('vercel.json','utf8')).buildCommand).toBe('npm run build');
  expect(JSON.parse(fs.readFileSync('package.json','utf8')).scripts.build).toContain('node scripts/engine-package.cjs --apply');
 });
 it('does not apply the homepage-only sheets include to checkout or unrelated routes',()=>{
  const keys=Object.entries(config.outputFileTracingIncludes as Record<string,string[]>).filter(([,files])=>files.includes('./public/companions/*/style01-sheets/**/*')).map(([key])=>key);
  const rootOnly=keys.filter(key=>picomatch(key,{contains:true,dot:true})('/'));
  expect(rootOnly).toHaveLength(1);
  const actualNextRoot=keys.filter(key=>picomatch(key,{contains:true,dot:true})('/app'));
  expect(actualNextRoot).toHaveLength(1);
  for(const route of ['/app/api/payme/return','/app/api/debug/storyboard-prompts','/app/wizard/personal'])
   expect(actualNextRoot.some(key=>picomatch(key,{contains:true,dot:true})(route))).toBe(false);
  for(const route of ['/api/payme/return','/api/my-books','/api/debug/storyboard-prompts','/api/checkout'])expect(rootOnly.some(key=>picomatch(key,{contains:true,dot:true})(route))).toBe(false);
 });
 it.each(['/','/wizard/personal','/personal/orders/[orderId]','/api/checkout'])('classifies actual paid-path route %s',route=>{
  expect(policy.isEngineRoute(route)).toBe(true);
 });
 it.each([{NODE_ENV:'production'},{NODE_ENV:'test',VERCEL:'1'}])('refuses raw installer fallback in deployed mode %j',env=>{
  for(const [key,value]of Object.entries(env))vi.stubEnv(key,value);
  const root=fs.mkdtempSync(path.join(tmpdir(),'r3-native-'));roots.push(root);
  expect(()=>native.nativeMediaBinaries({root})).toThrow('native_media_archive_required');
 });
 it('retains the card-art directory in engine packages along with the sheets',()=>{
  const exclude=policy.matchingExcludes(process.cwd(),config,'/api/engine-site/v1/orders',picomatch);
  expect(exclude(path.resolve('public/Images/personal-companions/elephant_momo.webp').replace(/\\/g,'/'))).toBe(false);
 });
 it('includes actual option assets in worker and every shared reconciliation route',()=>{
  for(const route of ['/app/api/generate/worker','/app/api/generate/cron/exceptions','/app/api/generate/cron/human-qa-reconcile','/app/api/generate/cron/operator-notifications']) {
   const includes=Object.entries(config.outputFileTracingIncludes as Record<string,string[]>).filter(([key])=>picomatch(key,{contains:true,dot:true})(route)).flatMap(([,files])=>files);
   expect(includes,route).toContain('./public/Images/personal-companions/**/*');
   expect(includes,route).toContain('./public/voice-samples/**/*');
   const exclude=policy.matchingExcludes(process.cwd(),config,route,picomatch);
   for(const file of ['public/Images/personal-companions/elephant_momo.webp','public/voice-samples/4RZ84U1b4WCqpu57LvIq.mp3'])
    expect(exclude(path.resolve(file).replace(/\\/g,'/')),route+':'+file).toBe(false);
  }
 });
 it('retains the actual legacy power-card Chromium and Puppeteer dependencies',()=>{
  const exclude=policy.matchingExcludes(process.cwd(),config,'/api/orders/[orderId]/power-card',picomatch);
  for(const file of ['node_modules/@sparticuz/chromium/bin/chromium.br','node_modules/puppeteer-core/lib/cjs/puppeteer/puppeteer-core.js'])
   expect(exclude(path.resolve(file).replace(/\\/g,'/'))).toBe(false);
 });
 it.each(['.envrc','.git-credentials','.yarnrc.yml','certificate.pem','private.key'])('rejects sensitive packaging path %s',file=>expect(policy.forbiddenPath('nested/'+file)).toBe(true));
 it('has no raw installer import in app/lib/backend runtime consumers',()=>{
  const visit=(dir:string):string[]=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?entry.name==='__tests__'?[]:visit(path.join(dir,entry.name)):/\.[cm]?[jt]sx?$/.test(entry.name)?[path.join(dir,entry.name)]:[]);
  for(const file of ['app','lib','backend'].flatMap(visit))expect(fs.readFileSync(file,'utf8'),file).not.toMatch(/(?:from\s*|require\s*\(\s*)['"]@ff(?:mpeg|probe)-installer\//);
 });
 it('replays the real options resolver on packaged file sets and refuses missing card art or passed views',()=>{
  const manifest=JSON.parse(fs.readFileSync('config/engine-runtime-assets.json','utf8'));
  const files=Object.values(manifest.groups).flat().map((row:any)=>path.resolve(row.path));
  const verify=optionPackage.createOptionVerifier(process.cwd(),manifest);
  const result=verify(['/','/wizard/personal','/api/engine-site/v1/orders','/api/generate/worker'].map(route=>({route,files})));
  expect(new Set(result.map((r:any)=>r.fingerprint)).size).toBe(1);
  expect(result.every((r:any)=>r.companions.includes('elephant_momo'))).toBe(true);
  expect(()=>verify([{route:'/api/engine-site/v1/orders',files:files.filter((f:string)=>!f.endsWith('elephant_momo.webp'))}])).toThrow('engine_package_options_changed');
  expect(()=>verify([{route:'/api/generate/worker',files:files.filter((f:string)=>!f.endsWith(path.join('elephant_momo','style01-sheets','front.png')))}])).toThrow('engine_package_options_changed');
 });
});
