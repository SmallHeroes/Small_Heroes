require('./shims/register-server-only.cjs');
require('tsx/cjs');
require('./engine-local-book.ts').localEngineBookCLI(process.argv.slice(2)).then(code=>{process.exitCode=code;}).catch(error=>{
 const code=typeof error?.code==='string'&&/^[a-z][a-z0-9_]{1,100}$/.test(error.code)?error.code:'local_book_preflight_failed';
 process.stderr.write(JSON.stringify({status:'stopped',code,providerDispatchNotConfirmed:true})+'\n');process.exitCode=1;
});
