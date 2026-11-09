'use strict';
// A pending promise or an unref'ed transport timer must never let a paid CLI silently exit0 mid-call.
const hold=setInterval(()=>{},1000);
Promise.resolve().then(()=>{require('./shims/register-server-only.cjs');require('tsx/cjs');
 return require('./engine-local-image-comparison.ts').imageComparisonCLI(process.argv.slice(2));
}).then(code=>{process.exitCode=code;},error=>{process.stderr.write(JSON.stringify({status:'comparison_entry_refused',code:/^[A-Za-z0-9_:-]{1,120}$/.test(error?.message||'')?error.message:'comparison_entry_failed'})+'\n');process.exitCode=1;})
.finally(()=>clearInterval(hold));
