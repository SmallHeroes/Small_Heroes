import { createRequire } from 'module';
import { resolve, join } from 'path';
import { existsSync, readdirSync, realpathSync } from 'fs';
import { describe, expect, it } from 'vitest';
const load=createRequire(resolve('package.json')),config=load(resolve('next.config.js'));
// Exactly the matcher imported by Next's collect-build-traces, including contains and dot.
const picomatch=load('next/dist/compiled/picomatch');
// Deployed traces use POSIX paths; preserve the actual files through the Windows junction.
const posix=(p:string)=>p.replace(/\\/g,'/');
const matches=(glob:string|string[],file:string)=>picomatch(Array.isArray(glob)?glob.map(posix):posix(glob),{dot:true,contains:true})(posix(file));
const patterns=(rules:Record<string,string[]>,route:string)=>Object.entries(rules).filter(([key])=>matches(key,route)).flatMap(([,v])=>v);
function firstFile(dir:string,extension:RegExp):string {
  for(const entry of readdirSync(dir,{withFileTypes:true})) {const path=join(dir,entry.name);
    if(entry.isDirectory()){const found=firstFile(path,extension);if(found)return found;}else if(extension.test(entry.name))return resolve(path);}
  return '';
}
const logicalPath=(file:string)=>file.replace(realpathSync('node_modules'),resolve('node_modules'));
const files=[logicalPath(load('@ffmpeg-installer/ffmpeg').path),logicalPath(load('@ffprobe-installer/ffprobe').path),
  firstFile('backend/assets/fonts',/\.(ttf|otf)$/i),firstFile('style-references/01',/\.png$/i),
  firstFile('style-references/01-child-template',/\.png$/i),firstFile('public/companions',/\.png$/i)];
describe('R2-2 effective Next include/exclude semantics against actual disk files',()=>{
  it.each(['/api/generate/worker','/api/generate/cron/sweep','/api/generate/cron/outbox','/api/generate/cron/exceptions',
    '/api/engine-site/v1/cron/reconcile','/api/engine-site/v1/review/[orderId]','/api/engine-site/v1/books/[orderId]',
    '/api/engine-site/v1/books/[orderId]/assets/[assetId]','/personal/book/[orderId]','/personal/review/[orderId]'])(
    '%s retains every required real media/style/font/companion file after all matching excludes',route=>{
      const included=patterns(config.outputFileTracingIncludes,route).map(p=>resolve(p));
      const excluded=patterns(config.outputFileTracingExcludes,route).map(p=>resolve(p));
      for(const file of files){expect(file).not.toBe('');expect(existsSync(file)).toBe(true);
        expect(matches(included,file),`${route} missing ${file}`).toBe(true);
        expect(excluded.length>0&&matches(excluded,file),`${route} excludes ${file}`).toBe(false);}
    });
  it('the broad generate key really does match worker and cron routes in Next',()=>{
    expect(matches('/api/generate','/api/generate/worker')).toBe(true);
    expect(matches('/api/generate','/api/generate/cron/outbox')).toBe(true);
  });
});
