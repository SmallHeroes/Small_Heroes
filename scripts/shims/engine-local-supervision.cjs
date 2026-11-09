'use strict';
const fs=require('node:fs'),p=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const fail=code=>{throw Object.assign(Error(code),{code});};
/** Load the exact reviewed pure classifier bytes ONCE, before any launch/claim. Never use mutable require.cache. */
function loadTerminalClassifier(ref){
 if(!ref||!p.isAbsolute(ref.file)||!/^([a-f0-9]{64})$/.test(ref.sha256??'')||/(^|[\\/])\.env(?:\.|$)/i.test(ref.file))fail('local_terminal_classifier_pin');
 const st=fs.lstatSync(ref.file);if(!st.isFile()||st.isSymbolicLink()||st.size>65536||fs.realpathSync(ref.file)!==ref.file)fail('local_terminal_classifier_file');
 const bytes=fs.readFileSync(ref.file);if(crypto.createHash('sha256').update(bytes).digest('hex')!==ref.sha256)fail('local_terminal_classifier_changed');
 const module={exports:{}};try{vm.runInNewContext(bytes.toString('utf8'),{module},{filename:ref.file,timeout:1000});}catch{fail('local_terminal_classifier_load');}
 const classify=module.exports.classifyLocalBookExit;if(typeof classify!=='function')fail('local_terminal_classifier_export');
 return Object.freeze({sha256:ref.sha256,classify(input){
  const incomplete=completionReason=>({supervisorExitCode:1,completionStatus:'incomplete',completionReason});
  if(!Number.isSafeInteger(input?.expected?.carriedMicroUsd)||input.expected.carriedMicroUsd<0||!Number.isSafeInteger(input?.expected?.carriedCalls)||input.expected.carriedCalls<0)return incomplete('terminal_carry_required');
  try{const r=classify(input);if(!r||Object.keys(r).sort().join()!=='completionReason,completionStatus,supervisorExitCode'||!Number.isInteger(r.supervisorExitCode)||r.supervisorExitCode<0||r.supervisorExitCode>255||!['incomplete','native_failed','terminal_outcome_recorded'].includes(r.completionStatus)||typeof r.completionReason!=='string'||!/^[a-z][a-z0-9_]{1,100}$/.test(r.completionReason)||(r.supervisorExitCode===0)!==(r.completionStatus==='terminal_outcome_recorded'))return incomplete('terminal_classifier_invalid');
   // Explicit field selection: classifier output can NEVER override actual native code/signal/error.
   return {supervisorExitCode:r.supervisorExitCode,completionStatus:r.completionStatus,completionReason:r.completionReason};
  }catch{return incomplete('terminal_classifier_failed');}
 }});
}
module.exports={loadTerminalClassifier};
